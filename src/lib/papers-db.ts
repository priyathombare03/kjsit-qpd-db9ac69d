import { supabase } from "@/integrations/supabase/client";
import type { GeneratedSet, PaperMeta, PaperRow, PaperStatus } from "./paper-types";

const TABLE = "papers";

export async function listPapers(status?: PaperStatus[]): Promise<PaperRow[]> {
  let query = supabase.from(TABLE).select("*").order("created_at", { ascending: false });
  if (status?.length) query = query.in("status", status);
  const { data, error } = await query;
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
}): Promise<PaperRow> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      meta: args.meta as never,
      sets: args.sets as never,
      created_by: args.createdBy,
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

export async function notify(recipientEmail: string, paperId: string, message: string) {
  const { error } = await supabase
    .from("notifications")
    .insert({ recipient_email: recipientEmail, paper_id: paperId, message });
  if (error) throw error;
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
