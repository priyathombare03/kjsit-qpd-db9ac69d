import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { readUser } from "@/lib/auth";
import { extractText } from "@/lib/extract";
import { generatePaper } from "@/lib/paper.functions";
import type { PaperMeta } from "@/lib/paper-types";
import { createPaper } from "@/lib/papers-db";

export const Route = createFileRoute("/designer/new")({
  head: () => ({
    meta: [
      { title: "Generate Question Paper — Paper Path" },
      {
        name: "description",
        content: "Upload the syllabus and question bank to generate three AI question paper sets in the KJSIT format.",
      },
      { property: "og:title", content: "Generate Question Paper — Paper Path" },
      { property: "og:description", content: "AI generation of Easy, Medium and Hard question paper sets." },
    ],
  }),
  component: () => (
    <RoleGuard role="designer">
      <NewPaper />
    </RoleGuard>
  ),
});

const inputClass =
  "border-border bg-background focus:ring-brand/40 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2";

function NewPaper() {
  const navigate = useNavigate();
  const generate = useServerFn(generatePaper);
  const [busy, setBusy] = useState(false);
  const [syllabus, setSyllabus] = useState<File | null>(null);
  const [bank, setBank] = useState<File | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    courseName: "",
    courseCode: "",
    className: "TY B.Tech",
    academicYear: "2026-27",
    semester: "V",
    marks: 20 as 20 | 30,
    department: "DEPARTMENT OF ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
  });

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syllabus || !bank) {
      toast.error("Please upload both the syllabus and the question bank.");
      return;
    }
    setBusy(true);
    try {
      const [syllabusText, questionBankText] = await Promise.all([extractText(syllabus), extractText(bank)]);
      if (!questionBankText.trim()) throw new Error("No readable text found in the question bank file.");

      const meta: PaperMeta = {
        courseName: form.courseName,
        courseCode: form.courseCode,
        className: form.className,
        semester: form.semester,
        academicYear: form.academicYear,
        date: form.date,
        marks: form.marks,
        department: form.department,
        testNumber: form.marks === 20 ? 1 : 2,
      };

      const result = await generate({
        data: { meta: { ...meta, courseOutcomes: undefined } as never, syllabusText, questionBankText },
      });

      const paper = await createPaper({
        meta: { ...meta, courseOutcomes: result.courseOutcomes },
        sets: result.sets,
        createdBy: readUser()?.email ?? "designer@somaiya.edu",
      });

      toast.success("Three question paper sets generated.");
      navigate({ to: "/designer/paper/$id", params: { id: paper.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Generate new question paper</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Questions are derived strictly from the uploaded question bank and laid out in the institute paper format.
      </p>

      <form onSubmit={submit} className="bg-card border-border mt-6 space-y-5 rounded-xl border p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date">
            <input type="date" className={inputClass} value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </Field>
          <Field label="Course name">
            <input className={inputClass} value={form.courseName} onChange={(e) => set("courseName", e.target.value)} required />
          </Field>
          <Field label="Course code">
            <input className={inputClass} value={form.courseCode} onChange={(e) => set("courseCode", e.target.value)} required />
          </Field>
          <Field label="Year / Class">
            <input className={inputClass} value={form.className} onChange={(e) => set("className", e.target.value)} required />
          </Field>
          <Field label="Academic year">
            <input className={inputClass} value={form.academicYear} onChange={(e) => set("academicYear", e.target.value)} required />
          </Field>
          <Field label="Semester">
            <input className={inputClass} value={form.semester} onChange={(e) => set("semester", e.target.value)} required />
          </Field>
          <Field label="Marks">
            <select
              className={inputClass}
              value={form.marks}
              onChange={(e) => set("marks", Number(e.target.value) as 20 | 30)}
            >
              <option value={20}>20</option>
              <option value={30}>30</option>
            </select>
          </Field>
          <Field label="Department">
            <input className={inputClass} value={form.department} onChange={(e) => set("department", e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Syllabus (PDF / DOCX / TXT)">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="text-sm"
              onChange={(e) => setSyllabus(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label="Question bank (PDF / DOCX / TXT)">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="text-sm"
              onChange={(e) => setBank(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-3 text-sm font-medium transition disabled:opacity-60"
        >
          {busy ? "Generating three sets…" : "Generate"}
        </button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-xs font-medium uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
