import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { homeFor, useAuth, type Role } from "@/lib/auth";
import { AppHeader } from "./AppHeader";

export function RoleGuard({ role, children }: { role: Role | Role[]; children: ReactNode }) {
  const roles = Array.isArray(role) ? role : [role];
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const allowed = !!user && user.status === "active" && roles.some((r) => user.roles.includes(r));

  useEffect(() => {
    if (loading) return;
    if (!user || user.status !== "active") {
      navigate({ to: "/", replace: true });
      return;
    }
    if (!roles.some((r) => user.roles.includes(r))) {
      navigate({ to: homeFor(user), replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, role, navigate]);

  if (loading || !allowed) {
    return (
      <div className="text-muted-foreground flex min-h-screen items-center justify-center text-sm">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      {children}
    </div>
  );
}
