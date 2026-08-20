import { supabase } from "@/integrations/supabase/client";
import type { GeneratedSet, PaperMeta, PaperRow, PaperStatus } from "./paper-types";
import type { YearLevel } from "./reference-db";

const TABLE = "papers";

export type NotificationRow = {
  id: string;
  recipient_email: string;
  paper_id: string | null;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
};

export async function listPapers(status?: PaperStatus[]): Promise<PaperRow[]> {
  let query = supabase.from(TABLE).select("*").order("created_at", { ascending: false });
  if (status?.length) query = query.in("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PaperRow[];
}

export async function listPapersByIds(ids: string[]): Promise<PaperRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from(TABLE).select("*").in("id", ids).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PaperRow[];
}

export async function getPaper(id: string): Promise<PaperRow> {
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Paper not found");
  return data as unknown as PaperRow;
}

export async function createPaper(args: {
  meta: PaperMeta;
  sets: GeneratedSet[];
  createdBy: string;
  createdById: string;
  institutionId: string | null;
  yearLevel: YearLevel | null;
  academicYearId: string | null;
  semesterId: string | null;
}): Promise<PaperRow> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      meta: args.meta as never,
      sets: args.sets as never,
      created_by: args.createdBy,
      created_by_id: args.createdById,
      institution_id: args.institutionId,
      year_level: args.yearLevel,
      academic_year_id: args.academicYearId,
      semester_id: args.semesterId,
      status: "draft",
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PaperRow;
}

export async function updatePaper(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(TABLE).update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function notify(recipientEmail: string, paperId: string | null, message: string, type = "assignment") {
  const { error } = await supabase
    .from("notifications")
    .insert({ recipient_email: recipientEmail, paper_id: paperId, message, type });
  if (error) throw error;
}

export async function listNotifications(email: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_email", email)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return [];
  return (data ?? []) as NotificationRow[];
}

export async function unreadCount(email: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_email", email)
    .eq("read", false);
  if (error) return 0;
  return count ?? 0;
}

export async function markAllRead(email: string) {
  await supabase.from("notifications").update({ read: true }).eq("recipient_email", email).eq("read", false);
}

export const statusLabel: Record<PaperStatus, string> = {
  draft: "Draft",
  sent_to_dqc: "Sent to DQC",
  approved: "Approved",
  not_approved: "Not Approved",
};
