import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PaperRenderer } from "@/components/PaperRenderer";
import { RoleGuard } from "@/components/RoleGuard";
import { diagramsForSet } from "@/lib/diagrams";
import { downloadPdf, downloadWord } from "@/lib/export";
import { btLabel, type PaperRow } from "@/lib/paper-types";
import { getPaper, statusLabel } from "@/lib/papers-db";

export const Route = createFileRoute("/hod/paper/$id")({
  head: () => ({
    meta: [
      { title: "Paper Details — Paper Path" },
      { name: "description", content: "Read a department question paper draft, its sets and its review status." },
      { property: "og:title", content: "Paper Details — Paper Path" },
      { property: "og:description", content: "HOD view of a department question paper and its generated sets." },
    ],
  }),
  component: () => (
    <RoleGuard role="hod">
      <HodPaper />
    </RoleGuard>
  ),
});

const btnGhost = "rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent";

function HodPaper() {
  const { id } = Route.useParams();
  const [paper, setPaper] = useState<PaperRow | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    getPaper(id)
      .then((p) => {
        setPaper(p);
        setActive(p.selected_set_index ?? 0);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load paper"));
  }, [id]);

  if (!paper) return <p className="text-muted-foreground p-8 text-sm">Loading paper…</p>;
  const set = paper.sets[active];
  if (!set) return <p className="text-muted-foreground p-8 text-sm">This paper has no generated sets.</p>;

  const diagrams = diagramsForSet(paper.diagrams, active);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{paper.meta.courseName}</h1>
          <p className="text-muted-foreground text-sm">
            {paper.meta.courseCode} · {paper.meta.marks} marks · {statusLabel[paper.status]} · by {paper.created_by}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button className={btnGhost} onClick={() => void downloadPdf({ meta: paper.meta, set, diagrams })}>
            Download PDF
          </button>
          <button className={btnGhost} onClick={() => void downloadWord({ meta: paper.meta, set, diagrams })}>
            Download Word
          </button>
        </div>
      </div>

      {paper.dqc_note && (
        <div className="border-border bg-muted mt-4 rounded-lg border p-4 text-sm">DQC note: {paper.dqc_note}</div>
      )}

      <div className="no-print border-border mt-6 flex flex-wrap gap-1 border-b">
        {paper.sets.map((s, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`px-4 py-2 text-sm font-medium transition ${
              active === i ? "border-brand text-brand border-b-2" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Set {i + 1} · {btLabel[s.bt]}
            {paper.selected_set_index === i ? " ✓" : ""}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <PaperRenderer
          meta={paper.meta}
          set={set}
          diagrams={diagrams}
          signatureUrl={paper.dqc_signature}
          setLabel={`Set ${active + 1} — ${btLabel[set.bt]}`}
        />
      </div>
    </main>
  );
}
