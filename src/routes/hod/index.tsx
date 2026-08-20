import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PaperList } from "@/components/PaperList";
import { RoleGuard } from "@/components/RoleGuard";
import { supabase } from "@/integrations/supabase/client";
import { decideFacultyAccount, setUserRoles } from "@/lib/assignments.functions";
import { roleLabel, type Role } from "@/lib/auth";
import type { PaperRow } from "@/lib/paper-types";
import { listPapers } from "@/lib/papers-db";
import { YEAR_LEVEL_LABEL, type YearLevel } from "@/lib/reference-db";

export const Route = createFileRoute("/hod/")({
  head: () => ({
    meta: [
      { title: "HOD Dashboard — Paper Path" },
      {
        name: "description",
        content: "Approve faculty accounts, assign DQC year scopes and follow every question paper in your department.",
      },
      { property: "og:title", content: "HOD Dashboard — Paper Path" },
      { property: "og:description", content: "Department control centre for question paper approvals and reviewers." },
    ],
  }),
  component: () => (
    <RoleGuard role="hod">
      <HodHome />
    </RoleGuard>
  ),
});

type Member = {
  id: string;
  email: string;
  full_name: string;
  department: string;
  status: string;
  roles: Role[];
  years: YearLevel[];
};

const ALL_ROLES: Role[] = ["hod", "dqc", "coord", "designer"];

function HodHome() {
  const [tab, setTab] = useState<"papers" | "people">("papers");
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const decide = useServerFn(decideFacultyAccount);
  const saveRoles = useServerFn(setUserRoles);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: scopes }, paperRows] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, department, status").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("dqc_scopes").select("user_id, year_level"),
      listPapers().catch(() => [] as PaperRow[]),
    ]);
    setMembers(
      (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role),
        years: (scopes ?? []).filter((s) => s.user_id === p.id).map((s) => s.year_level as YearLevel),
      })),
    );
    setPapers(paperRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = members.filter((m) => m.status === "pending");

  const onDecide = async (userId: string, approve: boolean) => {
    try {
      await decide({ data: { userId, approve } });
      toast.success(approve ? "Faculty approved." : "Request declined.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the account.");
    }
  };

  const toggle = async (m: Member, role: Role) => {
    const roles = m.roles.includes(role) ? m.roles.filter((r) => r !== role) : [...m.roles, role];
    try {
      await saveRoles({ data: { userId: m.id, roles, yearLevels: m.years } });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update roles.");
    }
  };

  const toggleYear = async (m: Member, year: YearLevel) => {
    const years = m.years.includes(year) ? m.years.filter((y) => y !== year) : [...m.years, year];
    try {
      await saveRoles({ data: { userId: m.id, roles: m.roles, yearLevels: years } });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update year scopes.");
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Department dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Approve faculty, set DQC year scopes and watch every paper in the department.
          </p>
        </div>
        <Link
          to="/tracking"
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2.5 text-sm font-medium"
        >
          Submission tracking
        </Link>
      </div>

      {pending.length > 0 && (
        <div className="border-brand/40 bg-brand-muted mt-6 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Pending faculty approvals ({pending.length})</h2>
          <ul className="mt-3 space-y-2">
            {pending.map((m) => (
              <li key={m.id} className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg p-3">
                <div>
                  <div className="text-sm font-medium">{m.full_name || m.email}</div>
                  <div className="text-muted-foreground text-xs">
                    {m.email} · {m.department}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void onDecide(m.id, true)}
                    className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => void onDecide(m.id, false)}
                    className="border-border rounded-md border px-3 py-1.5 text-xs font-medium"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-border mt-6 flex gap-1 border-b">
        {(["papers", "people"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? "border-brand text-brand border-b-2" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : tab === "papers" ? (
          <PaperList papers={papers} basePath="/hod" />
        ) : (
          <ul className="space-y-3">
            {members.map((m) => (
              <li key={m.id} className="border-border bg-card rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{m.full_name || m.email}</div>
                    <div className="text-muted-foreground text-xs">
                      {m.email} · {m.status}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ALL_ROLES.map((r) => (
                    <button
                      key={r}
                      onClick={() => void toggle(m, r)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        m.roles.includes(r) ? "border-brand bg-brand-muted font-medium" : "border-border"
                      }`}
                    >
                      {roleLabel(r)}
                    </button>
                  ))}
                </div>
                {m.roles.includes("dqc") && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-xs">Reviews:</span>
                    {(Object.keys(YEAR_LEVEL_LABEL) as YearLevel[]).map((y) => (
                      <button
                        key={y}
                        onClick={() => void toggleYear(m, y)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          m.years.includes(y) ? "border-brand bg-brand-muted font-medium" : "border-border"
                        }`}
                      >
                        {YEAR_LEVEL_LABEL[y]}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
