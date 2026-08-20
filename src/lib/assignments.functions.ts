import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, callerProfile, callerRoles } from "@/lib/assignments.server";

export type DqcCandidate = { id: string; email: string; fullName: string; openLoad: number };
/** DQC members whose year scopes cover the requested level, in the caller's institution + department. */
export const resolveDqcs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { yearLevel: "SY" | "TY" | "LY" }) => input)
  .handler(async ({ data, context }): Promise<DqcCandidate[]> => {
    const me = await callerProfile(context.supabase, context.userId);
    const db = await admin();

    const { data: scopes } = await db.from("dqc_scopes").select("user_id").eq("year_level", data.yearLevel);
    const ids = (scopes ?? []).map((s: { user_id: string }) => s.user_id);
    if (ids.length === 0) return [];

    // Department is a free-text field, so it must not be a hard filter: a DQC
    // member is valid for the whole institution, with same-department first.
    const { data: profiles } = await db
      .from("profiles")
      .select("id, email, full_name, department, institution_id, status")
      .in("id", ids)
      .eq("status", "active")
      .eq("institution_id", me.institution_id);

    const candidates = profiles ?? [];
    if (candidates.length === 0) return [];


    const { data: open } = await db
      .from("paper_assignments")
      .select("assigned_to")
      .in(
        "assigned_to",
        candidates.map((c: { id: string }) => c.id),
      )
      .in("status", ["assigned", "in_review"]);

    const load = new Map<string, number>();
    for (const row of (open ?? []) as { assigned_to: string | null }[]) {
      if (row.assigned_to) load.set(row.assigned_to, (load.get(row.assigned_to) ?? 0) + 1);
    }

    return candidates
      .map((c: { id: string; email: string; full_name: string }) => ({
        id: c.id,
        email: c.email,
        fullName: c.full_name || c.email,
        openLoad: load.get(c.id) ?? 0,
      }))
      .sort((a: DqcCandidate, b: DqcCandidate) => a.openLoad - b.openLoad);
  });

/** Faculty (or HOD) finalizes a paper: create assignment rows, flag the paper, notify + email the DQC. */
export const submitPaperForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      paperId: string;
      yearLevel: "SY" | "TY" | "LY";
      academicYearId: string | null;
      semesterId: string | null;
      assignedTo: string[];
      dueAt: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const me = await callerProfile(context.supabase, context.userId);
    const db = await admin();

    const { data: paper } = await db.from("papers").select("*").eq("id", data.paperId).maybeSingle();
    if (!paper) throw new Error("Paper not found.");

    const roles = await callerRoles(context.supabase, context.userId);
    if (paper.created_by_id !== context.userId && !roles.includes("hod")) {
      throw new Error("You cannot submit this paper.");
    }
    if (data.assignedTo.length === 0) throw new Error("No DQC member selected for this year level.");

    await db.from("paper_assignments").delete().eq("paper_id", data.paperId).in("status", ["assigned", "in_review"]);

    const rows = data.assignedTo.map((to, i) => ({
      paper_id: data.paperId,
      assigned_by: context.userId,
      assigned_to: to,
      submitted_by: paper.created_by_id ?? context.userId,
      year_level: data.yearLevel,
      academic_year_id: data.academicYearId,
      semester_id: data.semesterId,
      status: "assigned" as const,
      is_primary: i === 0,
      due_at: data.dueAt,
      submitted_at: new Date().toISOString(),
    }));
    const { data: inserted, error } = await db.from("paper_assignments").insert(rows).select("id, assigned_to");
    if (error) throw new Error(error.message);

    await db
      .from("papers")
      .update({
        status: "sent_to_dqc",
        year_level: data.yearLevel,
        academic_year_id: data.academicYearId,
        semester_id: data.semesterId,
        institution_id: paper.institution_id ?? me.institution_id,
      })
      .eq("id", data.paperId);

    const { data: reviewers } = await db
      .from("profiles")
      .select("id, email, full_name")
      .in("id", data.assignedTo);

    const course = (paper.meta as { courseName?: string })?.courseName ?? "a question paper";
    for (const r of reviewers ?? []) {
      await db.from("notifications").insert({
        recipient_email: r.email,
        paper_id: data.paperId,
        type: "assignment",
        message: `${me.full_name || me.email} submitted "${course}" (${data.yearLevel}) for your quality check.`,
      });
    }

    return { assignments: inserted ?? [], reviewers: reviewers ?? [] };
  });

/** HOD or coordinator nudges the faculty member who owns an overdue assignment. */
export const sendReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { assignmentId: string; target: "faculty" | "dqc" }) => input)
  .handler(async ({ data, context }) => {
    const roles = await callerRoles(context.supabase, context.userId);
    if (!roles.includes("hod") && !roles.includes("coord")) throw new Error("Only HOD or exam coordinator can remind.");
    const me = await callerProfile(context.supabase, context.userId);
    const db = await admin();

    const { data: a } = await db.from("paper_assignments").select("*").eq("id", data.assignmentId).maybeSingle();
    if (!a) throw new Error("Assignment not found.");

    const targetId = data.target === "faculty" ? a.submitted_by : a.assigned_to;
    if (!targetId) throw new Error("No recipient for this reminder.");
    const { data: target } = await db.from("profiles").select("email").eq("id", targetId).maybeSingle();
    if (!target) throw new Error("Recipient profile missing.");

    const { data: paper } = await db.from("papers").select("meta").eq("id", a.paper_id).maybeSingle();
    const course = (paper?.meta as { courseName?: string })?.courseName ?? "a question paper";

    await db.from("notifications").insert({
      recipient_email: target.email,
      paper_id: a.paper_id,
      type: "reminder",
      message: `Reminder from ${me.full_name || me.email}: "${course}" is still pending your action.`,
    });

    await db
      .from("paper_assignments")
      .update({
        reminder_count: (a.reminder_count ?? 0) + 1,
        last_reminded_at: new Date().toISOString(),
        last_reminded_by: context.userId,
      })
      .eq("id", a.id);

    return { ok: true };
  });

/** HOD approves or rejects a pending faculty registration. */
export const decideFacultyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; approve: boolean }) => input)
  .handler(async ({ data, context }) => {
    const roles = await callerRoles(context.supabase, context.userId);
    if (!roles.includes("hod")) throw new Error("Only an HOD can approve accounts.");
    const me = await callerProfile(context.supabase, context.userId);
    const db = await admin();

    const { data: target } = await db.from("profiles").select("*").eq("id", data.userId).maybeSingle();
    if (!target || target.institution_id !== me.institution_id) throw new Error("Profile not in your institution.");

    await db
      .from("profiles")
      .update({
        status: data.approve ? "active" : "rejected",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.userId);

    await db.from("notifications").insert({
      recipient_email: target.email,
      paper_id: null,
      type: "approval",
      message: data.approve
        ? "Your Paper Path account has been approved. You can sign in now."
        : "Your Paper Path account request was declined. Contact your HOD.",
    });

    return { ok: true };
  });

/** HOD sets a member's roles and DQC year scopes. */
export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; roles: string[]; yearLevels: string[] }) => input)
  .handler(async ({ data, context }) => {
    const roles = await callerRoles(context.supabase, context.userId);
    if (!roles.includes("hod")) throw new Error("Only an HOD can change roles.");
    const me = await callerProfile(context.supabase, context.userId);
    const db = await admin();

    const { data: target } = await db.from("profiles").select("institution_id").eq("id", data.userId).maybeSingle();
    if (!target || target.institution_id !== me.institution_id) throw new Error("Profile not in your institution.");

    await db.from("user_roles").delete().eq("user_id", data.userId);
    if (data.roles.length > 0) {
      await db.from("user_roles").insert(data.roles.map((r) => ({ user_id: data.userId, role: r as "hod" | "dqc" | "coord" | "designer" })));
    }
    await db.from("dqc_scopes").delete().eq("user_id", data.userId);
    if (data.roles.includes("dqc") && data.yearLevels.length > 0) {
      await db.from("dqc_scopes").insert(data.yearLevels.map((y) => ({ user_id: data.userId, year_level: y as "SY" | "TY" | "LY" })));
    }
    return { ok: true };
  });

export type TrackingRow = {
  id: string;
  paperId: string;
  course: string;
  yearLevel: string | null;
  semester: string | null;
  status: string;
  dueAt: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  reminderCount: number;
  lastRemindedAt: string | null;
  submittedByName: string;
  assignedToName: string;
};

/** Tracking dashboard feed: every assignment with names resolved. HOD / coordinator only. */
export const listTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrackingRow[]> => {
    const roles = await callerRoles(context.supabase, context.userId);
    if (!roles.includes("hod") && !roles.includes("coord")) throw new Error("Not allowed.");
    const me = await callerProfile(context.supabase, context.userId);
    const db = await admin();

    const { data: assignments } = await db
      .from("paper_assignments")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = assignments ?? [];
    if (rows.length === 0) return [];

    const paperIds = [...new Set(rows.map((r: { paper_id: string }) => r.paper_id))];
    const userIds = [
      ...new Set(rows.flatMap((r: { submitted_by: string | null; assigned_to: string | null }) => [r.submitted_by, r.assigned_to])),
    ].filter(Boolean) as string[];
    const semesterIds = [...new Set(rows.map((r: { semester_id: string | null }) => r.semester_id))].filter(
      Boolean,
    ) as string[];

    const [{ data: papers }, { data: profiles }, { data: semesters }] = await Promise.all([
      db.from("papers").select("id, meta, institution_id").in("id", paperIds),
      db.from("profiles").select("id, full_name, email").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      semesterIds.length
        ? db.from("semesters").select("id, label").in("id", semesterIds)
        : Promise.resolve({ data: [] as { id: string; label: string }[] }),
    ]);

    const paperMap = new Map((papers ?? []).map((p: any) => [p.id, p]));
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name || p.email]));
    const semMap = new Map((semesters ?? []).map((s: any) => [s.id, s.label]));

    return rows
      .filter((r: any) => {
        const p = paperMap.get(r.paper_id);
        return !p?.institution_id || p.institution_id === me.institution_id;
      })
      .map((r: any) => ({
        id: r.id,
        paperId: r.paper_id,
        course: paperMap.get(r.paper_id)?.meta?.courseName ?? "Untitled course",
        yearLevel: r.year_level,
        semester: r.semester_id ? (semMap.get(r.semester_id) ?? null) : null,
        status: r.status,
        dueAt: r.due_at,
        submittedAt: r.submitted_at,
        decidedAt: r.decided_at,
        reminderCount: r.reminder_count ?? 0,
        lastRemindedAt: r.last_reminded_at,
        submittedByName: r.submitted_by ? (nameMap.get(r.submitted_by) ?? "—") : "—",
        assignedToName: r.assigned_to ? (nameMap.get(r.assigned_to) ?? "—") : "Unassigned",
      }));
  });

/** DQC approves or returns a paper; updates the assignment row and notifies faculty / coordinator. */
export const decidePaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paperId: string; approve: boolean; note: string | null }) => input)
  .handler(async ({ data, context }) => {
    const me = await callerProfile(context.supabase, context.userId);
    const roles = await callerRoles(context.supabase, context.userId);
    if (!roles.includes("dqc")) throw new Error("Only a DQC member can decide on a paper.");
    const db = await admin();

    const { data: assignment } = await db
      .from("paper_assignments")
      .select("*")
      .eq("paper_id", data.paperId)
      .eq("assigned_to", context.userId)
      .in("status", ["assigned", "in_review"])
      .maybeSingle();
    if (!assignment) throw new Error("This paper is not assigned to you.");

    const now = new Date().toISOString();
    await db
      .from("paper_assignments")
      .update({ status: data.approve ? "approved" : "returned", decided_at: now, note: data.note })
      .eq("id", assignment.id);

    await db
      .from("papers")
      .update({
        status: data.approve ? "approved" : "not_approved",
        dqc_note: data.approve ? null : data.note,
      })
      .eq("id", data.paperId);

    const { data: paper } = await db.from("papers").select("meta, created_by").eq("id", data.paperId).maybeSingle();
    const course = (paper?.meta as { courseName?: string })?.courseName ?? "a question paper";

    if (data.approve) {
      const { data: coordRoles } = await db.from("user_roles").select("user_id").eq("role", "coord");
      const coordIds = (coordRoles ?? []).map((r: { user_id: string }) => r.user_id);
      const { data: coords } = coordIds.length
        ? await db.from("profiles").select("email").in("id", coordIds).eq("institution_id", me.institution_id)
        : { data: [] as { email: string }[] };
      for (const c of coords ?? []) {
        await db.from("notifications").insert({
          recipient_email: c.email,
          paper_id: data.paperId,
          type: "decision",
          message: `Approved paper ready to print: "${course}".`,
        });
      }
    }

    if (paper?.created_by) {
      await db.from("notifications").insert({
        recipient_email: paper.created_by,
        paper_id: data.paperId,
        type: "decision",
        message: data.approve
          ? `Your paper "${course}" was approved by the DQC.`
          : `Your paper "${course}" was returned by the DQC: ${data.note ?? "no note"}`,
      });
    }

    return { ok: true };
  });
