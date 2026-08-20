import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { diagramsForSet } from "@/lib/diagrams";
import { PaperRenderer } from "@/components/PaperRenderer";
import { RoleGuard } from "@/components/RoleGuard";
import { fileToDataUrl } from "@/lib/extract";
import { getPattern } from "@/lib/paper-pattern";
import { btLabel, type PaperRow } from "@/lib/paper-types";
import { getPaper, updatePaper } from "@/lib/papers-db";
import { decidePaper } from "@/lib/assignments.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/dqc/paper/$id")({
  head: () => ({
    meta: [
      { title: "Review Paper — Paper Path" },
      { name: "description", content: "Bloom analysis, CO mapping and unit coverage before approving a question paper." },
      { property: "og:title", content: "Review Paper — Paper Path" },
      { property: "og:description", content: "DQC review with Bloom, CO and module coverage analysis." },
    ],
  }),
  component: () => (
    <RoleGuard role="dqc">
      <DqcPaper />
    </RoleGuard>
  ),
});

const btn = "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90";
const btnGhost = "rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent";

function DqcPaper() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const decide = useServerFn(decidePaper);
  const [paper, setPaper] = useState<PaperRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPaper(id)
      .then(setPaper)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load paper"));
  }, [id]);

  const set = paper?.sets[paper.selected_set_index ?? 0];
  const diagrams = diagramsForSet(paper?.diagrams, paper?.selected_set_index ?? 0);

  const analysis = useMemo(() => {
    if (!paper || !set) return null;
    const slots = getPattern(paper.meta.marks);
    const bloom: Record<string, number> = {};
    const co: Record<string, number> = {};
    const modules: Record<string, number> = {};
    slots.forEach((slot) => {
      const q = set.questions.find((x) => x.key === slot.key);
      const b = q?.bloom ?? slot.bloom;
      bloom[b] = (bloom[b] ?? 0) + 1;
      const c = q?.co ?? "—";
      co[c] = (co[c] ?? 0) + 1;
      const m = q?.module || "Unspecified";
      modules[m] = (modules[m] ?? 0) + 1;
    });
    return { bloom, co, modules, total: slots.length };
  }, [paper, set]);

  if (!paper || !set || !analysis) return <p className="text-muted-foreground p-8 text-sm">Loading paper…</p>;

  const refresh = async () => setPaper(await getPaper(id));

  const approve = async () => {
    try {
      await decide({ data: { paperId: id, approve: true, note: null } });
      toast.success("Paper approved and forwarded to the exam coordinator.");
      navigate({ to: "/dqc" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve the paper.");
    }
  };

  const reject = async () => {
    const note = window.prompt("Why is this paper not approved?");
    if (!note) return;
    try {
      await decide({ data: { paperId: id, approve: false, note } });
      toast.success("Paper returned to the designer.");
      navigate({ to: "/dqc" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not return the paper.");
    }
  };

  const addSignature = async (file?: File) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    await updatePaper(id, { dqc_signature: dataUrl });
    await refresh();
    toast.success("Signature added.");
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{paper.meta.courseName}</h1>
          <p className="text-muted-foreground text-sm">
            {paper.meta.courseCode} · {paper.meta.marks} marks · submitted by {paper.created_by}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button className={btnGhost} onClick={() => fileRef.current?.click()}>
            Add signature
          </button>
          <button className={btnGhost} onClick={reject}>
            Not approved
          </button>
          <button className={btn} onClick={approve}>
            Approve
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          void addSignature(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="mt-6">
        <PaperRenderer
          meta={paper.meta}
          set={set}
          diagrams={diagrams}
          signatureUrl={paper.dqc_signature}
          setLabel={`Selected set — ${btLabel[set.bt]}`}
        />
      </div>

      <section className="no-print mt-8 grid gap-4 md:grid-cols-3">
        <AnalysisCard title="Bloom analysis" data={analysis.bloom} total={analysis.total} />
        <AnalysisCard title="CO mapping" data={analysis.co} total={analysis.total} />
        <AnalysisCard title="Unit coverage" data={analysis.modules} total={analysis.total} />
      </section>
    </main>
  );
}

function AnalysisCard({ title, data, total }: { title: string; data: Record<string, number>; total: number }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {entries.map(([label, count]) => (
          <li key={label}>
            <div className="flex justify-between text-xs">
              <span className="truncate pr-2">{label}</span>
              <span className="text-muted-foreground">{count}</span>
            </div>
            <div className="bg-muted mt-1 h-2 overflow-hidden rounded-full">
              <div className="bg-brand h-full rounded-full" style={{ width: `${(count / total) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
