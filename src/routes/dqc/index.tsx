import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PaperList } from "@/components/PaperList";
import { RoleGuard } from "@/components/RoleGuard";
import type { PaperRow } from "@/lib/paper-types";
import { listPapers } from "@/lib/papers-db";

export const Route = createFileRoute("/dqc/")({
  head: () => ({
    meta: [
      { title: "DQC Inbox — Paper Path" },
      { name: "description", content: "Review submitted question papers, check Bloom and CO coverage, then approve or return them." },
      { property: "og:title", content: "DQC Inbox — Paper Path" },
      { property: "og:description", content: "Quality check queue for KJSIT question papers." },
    ],
  }),
  component: () => (
    <RoleGuard role="dqc">
      <DqcHome />
    </RoleGuard>
  ),
});

function DqcHome() {
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPapers(["sent_to_dqc"])
      .then(setPapers)
      .catch(() => setPapers([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Papers awaiting quality check</h1>
      <p className="text-muted-foreground text-sm">Open a paper to review its analysis and record your decision.</p>
      <div className="mt-6">
        {loading ? <p className="text-muted-foreground text-sm">Loading…</p> : <PaperList papers={papers} basePath="/dqc" />}
      </div>
    </main>
  );
}
