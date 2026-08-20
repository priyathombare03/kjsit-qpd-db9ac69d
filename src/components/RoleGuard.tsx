import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { homeFor, useAuth, type Role } from "@/lib/auth";
import { AppHeader } from "./AppHeader";

export function RoleGuard({ role, children }: { role: Role; children: ReactNode }) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const allowed = !!user && user.status === "active" && user.roles.includes(role);

  useEffect(() => {
    if (loading) return;
    if (!user || user.status !== "active") {
      navigate({ to: "/", replace: true });
      return;
    }
    if (!user.roles.includes(role)) {
      navigate({ to: homeFor(user), replace: true });
    }
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
