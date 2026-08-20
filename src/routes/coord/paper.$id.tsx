import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { diagramsForSet } from "@/lib/diagrams";
import { PaperRenderer } from "@/components/PaperRenderer";
import { RoleGuard } from "@/components/RoleGuard";
import { downloadPdf, downloadWord } from "@/lib/export";
import { btLabel, type PaperRow } from "@/lib/paper-types";
import { getPaper } from "@/lib/papers-db";

export const Route = createFileRoute("/coord/paper/$id")({
  head: () => ({
    meta: [
      { title: "Approved Paper — Paper Path" },
      { name: "description", content: "View, print or download an approved KJSIT question paper." },
      { property: "og:title", content: "Approved Paper — Paper Path" },
      { property: "og:description", content: "Print-ready approved question paper with diagrams and DQC signature." },
    ],
  }),
  component: () => (
    <RoleGuard role="coord">
      <CoordPaper />
    </RoleGuard>
  ),
});

const btnGhost = "rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent";

function CoordPaper() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<PaperRow | null>(null);

  useEffect(() => {
    getPaper(id)
      .then(setPaper)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load paper"));
  }, [id]);

  if (!paper) return <p className="text-muted-foreground p-8 text-sm">Loading paper…</p>;
  if (paper.status !== "approved") {
    return (
      <p className="text-destructive p-8 text-sm">
        This paper is not DQC-approved yet, so printing and downloading are locked.
      </p>
    );
  }
  const set = paper.sets[paper.selected_set_index ?? 0];
  const diagrams = diagramsForSet(paper?.diagrams, paper?.selected_set_index ?? 0);
  if (!set) return <p className="text-muted-foreground p-8 text-sm">This paper has no finalized set.</p>;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="no-print flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{paper.meta.courseName}</h1>
          <p className="text-muted-foreground text-sm">
            {paper.meta.courseCode} · {paper.meta.marks} marks · approved
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium"
            onClick={() => navigate({ to: "/coord/print/$id", params: { id } })}
          >
            Print direct
          </button>
          <button
            className={btnGhost}
            onClick={() =>
              downloadPdf({
                meta: paper.meta,
                set,
                diagrams,
                signature: paper.dqc_signature,
                includeCourseOutcomes: false,
              })
            }
          >
            Download PDF
          </button>
          <button className={btnGhost} onClick={() =>
              downloadWord({ meta: paper.meta, set, signature: paper.dqc_signature, includeCourseOutcomes: false })
            }>
            Download Word
          </button>
        </div>
      </div>

      <div className="mt-6">
        <PaperRenderer
          meta={paper.meta}
          set={set}
          diagrams={diagrams}
          setLabel={`Final paper — ${btLabel[set.bt]}`}
          examView
        />
      </div>
    </main>
  );
}
