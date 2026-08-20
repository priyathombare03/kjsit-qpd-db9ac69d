import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/RoleGuard";
import { listTracking, sendReminder, type TrackingRow } from "@/lib/assignments.functions";
import { YEAR_LEVEL_LABEL, type YearLevel } from "@/lib/reference-db";

export const Route = createFileRoute("/tracking")({
  head: () => ({
    meta: [
      { title: "Submission Tracking — Paper Path" },
      {
        name: "description",
        content: "See which faculty have submitted question papers, who is reviewing them and what is overdue.",
      },
      { property: "og:title", content: "Submission Tracking — Paper Path" },
      { property: "og:description", content: "Live index of paper submissions, reviewers and overdue reminders." },
    ],
  }),
  component: () => (
    <RoleGuard role={["hod", "coord"]}>
      <Tracking />
    </RoleGuard>
  ),
});

const statusTone: Record<string, string> = {
  assigned: "bg-amber-100 text-amber-800",
  in_review: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800",
  returned: "bg-rose-100 text-rose-800",
};

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function Tracking() {
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useServerFn(listTracking);
  const remind = useServerFn(sendReminder);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await load({}));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load tracking data.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const overdue = (r: TrackingRow) =>
    r.status !== "approved" && r.dueAt !== null && new Date(r.dueAt).getTime() < Date.now();

  const nudge = async (r: TrackingRow, target: "faculty" | "dqc") => {
    setBusy(r.id);
    try {
      await remind({ data: { assignmentId: r.id, target } });
      toast.success("Reminder sent.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the reminder.");
    } finally {
      setBusy(null);
    }
  };

  const pendingRows = rows.filter(overdue);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Submission tracking</h1>
          <p className="text-muted-foreground text-sm">Who submitted, who is reviewing, and what is overdue.</p>
        </div>
        {pendingRows.length > 0 && (
          <button
            onClick={async () => {
              for (const r of pendingRows) await nudge(r, "faculty");
            }}
            className="border-border rounded-lg border px-4 py-2.5 text-sm font-medium"
          >
            Remind all overdue ({pendingRows.length})
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground mt-8 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground mt-8 text-sm">No papers have been submitted yet.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="mt-6 space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="border-border bg-card rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{r.course}</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone[r.status] ?? "bg-muted"}`}>
                    {r.status.replace("_", " ")}
                  </span>
                </div>
                <dl className="text-muted-foreground mt-2 space-y-1 text-xs">
                  <div>
                    {r.yearLevel ? YEAR_LEVEL_LABEL[r.yearLevel as YearLevel] : "—"}
                    {r.semester ? ` · Sem ${r.semester}` : ""}
                  </div>
                  <div>Submitted by {r.submittedByName} on {fmt(r.submittedAt)}</div>
                  <div>Reviewer: {r.assignedToName}</div>
                  <div className={overdue(r) ? "text-destructive font-medium" : ""}>Due {fmt(r.dueAt)}</div>
                </dl>
                <button
                  disabled={busy === r.id}
                  onClick={() => void nudge(r, r.status === "assigned" ? "dqc" : "faculty")}
                  className="border-border mt-3 w-full rounded-md border px-3 py-2 text-xs font-medium"
                >
                  Send reminder{r.reminderCount ? ` (${r.reminderCount} sent)` : ""}
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="border-border mt-6 hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Submitted by</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Reviewer</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-border border-t">
                    <td className="px-4 py-3 font-medium">{r.course}</td>
                    <td className="px-4 py-3">
                      {r.yearLevel ?? "—"}
                      {r.semester ? ` · ${r.semester}` : ""}
                    </td>
                    <td className="px-4 py-3">{r.submittedByName}</td>
                    <td className="px-4 py-3">{fmt(r.submittedAt)}</td>
                    <td className="px-4 py-3">{r.assignedToName}</td>
                    <td className={`px-4 py-3 ${overdue(r) ? "text-destructive font-medium" : ""}`}>{fmt(r.dueAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone[r.status] ?? "bg-muted"}`}>
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        disabled={busy === r.id}
                        onClick={() => void nudge(r, r.status === "assigned" ? "dqc" : "faculty")}
                        className="border-border rounded-md border px-3 py-1.5 text-xs font-medium"
                      >
                        Remind{r.reminderCount ? ` (${r.reminderCount})` : ""}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
