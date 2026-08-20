import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PaperRenderer } from "@/components/PaperRenderer";
import { RoleGuard } from "@/components/RoleGuard";
import type { PaperRow } from "@/lib/paper-types";
import { getPaper } from "@/lib/papers-db";

export const Route = createFileRoute("/coord/print/$id")({
  head: () => ({
    meta: [
      { title: "Print Exam Paper — Paper Path" },
      { name: "description", content: "Exam-facing print copy of an approved question paper, without course outcomes." },
      { property: "og:title", content: "Print Exam Paper — Paper Path" },
      { property: "og:description", content: "Coordinator print view of a DQC-approved question paper." },
    ],
  }),
  component: () => (
    <RoleGuard role="coord">
      <PrintView />
    </RoleGuard>
  ),
});

function PrintView() {
  const { id } = Route.useParams();
  const [paper, setPaper] = useState<PaperRow | null>(null);

  useEffect(() => {
    getPaper(id)
      .then(setPaper)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load paper"));
  }, [id]);

  useEffect(() => {
    if (paper && paper.status === "approved") {
      const t = window.setTimeout(() => window.print(), 600);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [paper]);

  if (!paper) return <p className="text-muted-foreground p-8 text-sm">Loading paper…</p>;
  if (paper.status !== "approved") {
    return <p className="text-destructive p-8 text-sm">This paper is not DQC-approved yet, so it cannot be printed.</p>;
  }
  const set = paper.sets[paper.selected_set_index ?? 0];
  if (!set) return <p className="text-muted-foreground p-8 text-sm">This paper has no finalized set.</p>;

  return (
    <main className="py-8">
      <PaperRenderer meta={paper.meta} set={set} diagrams={paper.diagrams} examView />
    </main>
  );
}
