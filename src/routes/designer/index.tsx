import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PaperList } from "@/components/PaperList";
import { RoleGuard } from "@/components/RoleGuard";
import type { PaperRow, PaperStatus } from "@/lib/paper-types";
import { listPapers, markAllRead, statusLabel } from "@/lib/papers-db";
import { readUser } from "@/lib/auth";

export const Route = createFileRoute("/designer/")({
  head: () => ({
    meta: [
      { title: "Designer Dashboard — Paper Path" },
      { name: "description", content: "Generate, review and send KJSIT question papers to the DQC for approval." },
      { property: "og:title", content: "Designer Dashboard — Paper Path" },
      { property: "og:description", content: "Faculty workspace for generating and tracking question papers." },
    ],
  }),
  component: () => (
    <RoleGuard role="designer">
      <DesignerHome />
    </RoleGuard>
  ),
});

const TABS: PaperStatus[] = ["draft", "sent_to_dqc", "approved", "not_approved"];

function DesignerHome() {
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [tab, setTab] = useState<PaperStatus>("draft");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPapers()
      .then(setPapers)
      .catch(() => setPapers([]))
      .finally(() => setLoading(false));
    const user = readUser();
    if (user) markAllRead(user.email);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My question papers</h1>
          <p className="text-muted-foreground text-sm">Generate a new paper or continue where you left off.</p>
        </div>
        <Link
          to="/designer/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2.5 text-sm font-medium transition"
        >
          Generate new question paper
        </Link>
      </div>

      <div className="border-border mt-6 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition ${
              tab === t ? "border-brand text-brand border-b-2" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {statusLabel[t]} ({papers.filter((p) => p.status === t).length})
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading papers…</p>
        ) : (
          <PaperList papers={papers.filter((p) => p.status === tab)} basePath="/designer" />
        )}
      </div>
    </main>
  );
}
