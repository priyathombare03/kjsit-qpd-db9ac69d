import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { readUser, roleHome, type Role } from "@/lib/auth";
import { AppHeader } from "./AppHeader";

export function RoleGuard({ role, children }: { role: Role; children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ok" | "redirect">("checking");

  useEffect(() => {
    const user = readUser();
    if (!user) {
      setState("redirect");
      navigate({ to: "/", replace: true });
      return;
    }
    if (user.role !== role) {
      setState("redirect");
      navigate({ to: roleHome(user.role), replace: true });
      return;
    }
    setState("ok");
  }, [role, navigate]);

  if (state !== "ok") {
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
