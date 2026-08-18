import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PaperRenderer } from "@/components/PaperRenderer";
import { RoleGuard } from "@/components/RoleGuard";
import { downloadPdf, downloadWord } from "@/lib/export";
import type { PaperRow } from "@/lib/paper-types";
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
  const [paper, setPaper] = useState<PaperRow | null>(null);

  useEffect(() => {
    getPaper(id)
      .then(setPaper)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load paper"));
  }, [id]);

  if (!paper) return <p className="text-muted-foreground p-8 text-sm">Loading paper…</p>;
  const set = paper.sets[paper.selected_set_index ?? 0];
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
          <button className={btnGhost} onClick={() => window.print()}>
            Print
          </button>
          <button
            className={btnGhost}
            onClick={() => downloadPdf({ meta: paper.meta, set, diagrams: paper.diagrams, signature: paper.dqc_signature })}
          >
            Download PDF
          </button>
          <button className={btnGhost} onClick={() => downloadWord({ meta: paper.meta, set, signature: paper.dqc_signature })}>
            Download Word
          </button>
        </div>
      </div>

      <div className="mt-6">
        <PaperRenderer
          meta={paper.meta}
          set={set}
          diagrams={paper.diagrams}
          signatureUrl={paper.dqc_signature}
          setLabel={`Final paper — ${set.difficulty}`}
        />
      </div>
    </main>
  );
}
