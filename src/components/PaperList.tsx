import { Link } from "@tanstack/react-router";
import type { PaperRow } from "@/lib/paper-types";
import { statusLabel } from "@/lib/papers-db";

export function PaperList({ papers, basePath }: { papers: PaperRow[]; basePath: "/designer" | "/dqc" | "/coord" }) {
  if (papers.length === 0) {
    return <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">No papers here yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {papers.map((p) => (
        <li key={p.id}>
          <Link
            to={`${basePath}/paper/$id`}
            params={{ id: p.id }}
            className="border-border hover:border-brand/60 bg-card flex items-center justify-between gap-4 rounded-lg border p-4 transition"
          >
            <div>
              <div className="font-medium">{p.meta?.courseName || "Untitled course"}</div>
              <div className="text-muted-foreground text-xs">
                {p.meta?.courseCode} · {p.meta?.marks} marks · {p.meta?.date}
              </div>
              {p.status === "not_approved" && p.dqc_note && (
                <div className="text-destructive mt-1 text-xs">DQC note: {p.dqc_note}</div>
              )}
            </div>
            <span className="bg-accent text-accent-foreground rounded-full px-3 py-1 text-xs font-medium">
              {statusLabel[p.status]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
