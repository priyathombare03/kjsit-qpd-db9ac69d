import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/lib/auth";
import {
  listAcademicYears,
  listSemesters,
  YEAR_LEVEL_LABEL,
  type AcademicYear,
  type Semester,
  type YearLevel,
} from "@/lib/reference-db";
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
      { property: "og:description", content: "AI generation of three question paper sets tagged by Bloom Taxonomy level." },
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
  const { user } = useAuth();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [busy, setBusy] = useState(false);
  const [syllabus, setSyllabus] = useState<File | null>(null);
  const [bank, setBank] = useState<File | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    courseName: "",
    courseCode: "",
    className: "TY B.Tech",
    academicYearId: "",
    yearLevel: "TY" as YearLevel,
    semesterId: "",
    marks: 20 as 20 | 30,
    department: "DEPARTMENT OF ARTIFICIAL INTELLIGENCE AND DATA SCIENCE",
  });

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    listAcademicYears()
      .then((rows) => {
        setYears(rows);
        setForm((f) => ({
          ...f,
          academicYearId: f.academicYearId || (rows.find((r) => r.is_active)?.id ?? rows[0]?.id ?? ""),
        }));
      })
      .catch(() => setYears([]));
  }, []);

  useEffect(() => {
    if (!form.academicYearId) return;
    listSemesters(form.academicYearId)
      .then((rows) => {
        setSemesters(rows);
        setForm((f) => {
          const valid = rows.filter((r) => r.year_level === f.yearLevel);
          return { ...f, semesterId: valid.some((v) => v.id === f.semesterId) ? f.semesterId : (valid[0]?.id ?? "") };
        });
      })
      .catch(() => setSemesters([]));
  }, [form.academicYearId, form.yearLevel]);

  const visibleSemesters = semesters.filter((s) => s.year_level === form.yearLevel);

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

      const academicYearLabel = years.find((y) => y.id === form.academicYearId)?.label ?? "";
      const semesterLabel = semesters.find((s) => s.id === form.semesterId)?.label ?? "";

      const meta: PaperMeta = {
        courseName: form.courseName,
        courseCode: form.courseCode,
        className: form.className,
        semester: semesterLabel,
        academicYear: academicYearLabel,
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
        createdBy: user?.email ?? "",
        createdById: user?.id ?? "",
        institutionId: user?.institutionId ?? null,
        yearLevel: form.yearLevel,
        academicYearId: form.academicYearId,
        semesterId: form.semesterId || null,
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
            <select
              className={inputClass}
              value={form.academicYearId}
              onChange={(e) => set("academicYearId", e.target.value)}
              required
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Year level (routes to DQC)">
            <select className={inputClass} value={form.yearLevel} onChange={(e) => set("yearLevel", e.target.value)}>
              {(Object.keys(YEAR_LEVEL_LABEL) as YearLevel[]).map((y) => (
                <option key={y} value={y}>
                  {YEAR_LEVEL_LABEL[y]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Semester">
            <select className={inputClass} value={form.semesterId} onChange={(e) => set("semesterId", e.target.value)} required>
              {visibleSemesters.map((s) => (
                <option key={s.id} value={s.id}>
                  Semester {s.label}
                </option>
              ))}
            </select>
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
