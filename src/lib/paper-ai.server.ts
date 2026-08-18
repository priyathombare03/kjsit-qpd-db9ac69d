import { getPattern, type Bloom } from "./paper-pattern";
import type { GeneratedSet, PaperMeta } from "./paper-types";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.5-flash";

export type GenerateInput = {
  meta: PaperMeta;
  syllabusText: string;
  questionBankText: string;
};

export type GenerateOutput = {
  sets: GeneratedSet[];
  courseOutcomes: Record<string, string>;
};

function buildPrompt(input: GenerateInput) {
  const pattern = getPattern(input.meta.marks);
  const slots = pattern
    .map((s) => `${s.key}: ${s.qNo}(${s.subQ}) — ${s.marks} marks — Bloom level ${s.bloom}`)
    .join("\n");

  return `You are an examination paper designer for K J Somaiya Institute of Technology.

Course: ${input.meta.courseName} (${input.meta.courseCode})
Class: ${input.meta.className}, Semester ${input.meta.semester}, AY ${input.meta.academicYear}
Total marks: ${input.meta.marks}

RULES (strict):
1. Every question MUST be derived ONLY from the QUESTION BANK text below. Do not invent new questions; you may lightly rephrase a bank question so it fits the marks allotted.
2. Use ONLY Bloom levels Remember, Understand and Apply, matching the level fixed for each slot.
3. Distribute questions across syllabus modules proportionally to the module hours/weightage inferred from the syllabus.
4. Produce exactly THREE sets: one "Easy", one "Medium" and one "Hard". The three sets must not repeat the same question.
5. Fill EVERY slot listed below, using the exact slot key.
6. Map each question to a course outcome code (CO1..CO6) inferred from the syllabus.
7. Also extract the course outcome statements (CO1..CO6) found in the syllabus.

SLOTS:
${slots}

SYLLABUS:
"""
${input.syllabusText.slice(0, 20000)}
"""

QUESTION BANK:
"""
${input.questionBankText.slice(0, 30000)}
"""

Reply with JSON only, in this shape:
{"courseOutcomes":{"CO1":"...","CO2":"..."},"sets":[{"difficulty":"Easy","questions":[{"key":"q1a","text":"...","bloom":"Remember","co":"CO1","module":"Module 1"}]}]}`;
}

function parseJson(raw: string): any {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("The AI response could not be parsed. Please try generating again.");
  }
}

export async function generateSets(input: GenerateInput): Promise<GenerateOutput> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "You generate exam papers as strict JSON. No prose, no markdown." },
        { role: "user", content: buildPrompt(input) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached. Please wait a moment and try again.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up your workspace AI credits.");
    throw new Error(`AI request failed [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content ?? "";
  const parsed = parseJson(String(content));

  const pattern = getPattern(input.meta.marks);
  const sets: GeneratedSet[] = (parsed.sets ?? []).slice(0, 3).map((s: any, i: number) => ({
    difficulty: (["Easy", "Medium", "Hard"] as const)[i] ?? "Medium",
    questions: pattern.map((slot) => {
      const found = (s.questions ?? []).find((q: any) => q.key === slot.key);
      return {
        key: slot.key,
        text: String(found?.text ?? "").trim() || "[No matching question found in the uploaded question bank]",
        bloom: (found?.bloom as Bloom) ?? slot.bloom,
        co: String(found?.co ?? "CO1"),
        module: String(found?.module ?? ""),
      };
    }),
  }));

  if (sets.length === 0) throw new Error("The AI did not return any question sets. Please try again.");

  return { sets, courseOutcomes: (parsed.courseOutcomes ?? {}) as Record<string, string> };
}
