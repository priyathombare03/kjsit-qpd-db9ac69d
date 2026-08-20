import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "hod" | "dqc" | "designer" | "coord";
export type AccountStatus = "pending" | "active" | "rejected";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  department: string;
  institutionId: string | null;
  status: AccountStatus;
  roles: Role[];
};

export const ROLE_ORDER: Role[] = ["hod", "dqc", "coord", "designer"];

export function roleHome(role: Role) {
  return role === "hod" ? "/hod" : role === "dqc" ? "/dqc" : role === "coord" ? "/coord" : "/designer";
}

export function homeFor(user: SessionUser | null) {
  if (!user) return "/";
  const primary = ROLE_ORDER.find((r) => user.roles.includes(r)) ?? "designer";
  return roleHome(primary);
}

export function roleLabel(role: Role) {
  return role === "hod"
    ? "Head of Department"
    : role === "dqc"
      ? "DQC Member"
      : role === "coord"
        ? "Exam Coordinator"
        : "Faculty (Designer)";
}

export function primaryRole(user: SessionUser | null): Role | null {
  if (!user) return null;
  return ROLE_ORDER.find((r) => user.roles.includes(r)) ?? null;
}

export async function fetchSessionUser(): Promise<SessionUser | null> {
  const { data: auth } = await supabase.auth.getUser();
  const authUser = auth.user;
  if (!authUser) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", authUser.id),
  ]);

  return {
    id: authUser.id,
    email: authUser.email ?? profile?.email ?? "",
    fullName: profile?.full_name ?? "",
    department: profile?.department ?? "",
    institutionId: profile?.institution_id ?? null,
    status: (profile?.status ?? "pending") as AccountStatus,
    roles: (roleRows ?? []).map((r) => r.role as Role),
  };
}

export async function signOutUser() {
  await supabase.auth.signOut();
}

/** Live session + profile + roles. `loading` is true until the first resolve. */
export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await fetchSessionUser());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const u = await fetchSessionUser().catch(() => null);
      if (active) {
        setUser(u);
        setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void refresh();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  return { user, loading, refresh };
}
