import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PaperList } from "@/components/PaperList";
import { RoleGuard } from "@/components/RoleGuard";
import { readUser } from "@/lib/auth";
import type { PaperRow } from "@/lib/paper-types";
import { listPapers, markAllRead } from "@/lib/papers-db";

export const Route = createFileRoute("/coord/")({
  head: () => ({
    meta: [
      { title: "Exam Coordinator — Paper Path" },
      { name: "description", content: "View, print and download approved KJSIT question papers ready for the exam." },
      { property: "og:title", content: "Exam Coordinator — Paper Path" },
      { property: "og:description", content: "Approved question papers ready for printing and distribution." },
    ],
  }),
  component: () => (
    <RoleGuard role="coord">
      <CoordHome />
    </RoleGuard>
  ),
});

function CoordHome() {
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPapers(["approved"])
      .then(setPapers)
      .catch(() => setPapers([]))
      .finally(() => setLoading(false));
    const user = readUser();
    if (user) markAllRead(user.email);
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Approved question papers</h1>
      <p className="text-muted-foreground text-sm">Open a paper to print or download it.</p>
      <div className="mt-6">
        {loading ? <p className="text-muted-foreground text-sm">Loading…</p> : <PaperList papers={papers} basePath="/coord" />}
      </div>
    </main>
  );
}
