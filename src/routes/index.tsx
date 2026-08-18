import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { DEMO_USERS, roleHome, roleLabel, signIn, type DemoUser } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paper Path — KJSIT Question Paper Designer" },
      {
        name: "description",
        content:
          "Design, review and approve K J Somaiya Institute of Technology question papers with AI-generated sets, Bloom analysis and DQC sign-off.",
      },
      { property: "og:title", content: "Paper Path — KJSIT Question Paper Designer" },
      {
        property: "og:description",
        content: "AI-assisted question paper generation, DQC review and exam coordinator distribution for KJSIT.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<DemoUser>(DEMO_USERS[0]!);

  const enter = () => {
    signIn(selected);
    navigate({ to: roleHome(selected.role) });
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-card border-border w-full max-w-md rounded-xl border p-8 shadow-sm">
        <Logo size={48} />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Paper Path</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Question paper design, quality check and distribution for K J Somaiya Institute of Technology.
        </p>

        <div className="mt-6 space-y-2">
          {DEMO_USERS.map((u) => (
            <button
              key={u.email}
              onClick={() => setSelected(u)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                selected.email === u.email
                  ? "border-brand bg-brand-muted"
                  : "border-border hover:border-brand/50 hover:bg-accent/40"
              }`}
            >
              <div className="text-sm font-medium">{roleLabel(u.role)}</div>
              <div className="text-muted-foreground text-xs">{u.email}</div>
            </button>
          ))}
        </div>

        <button
          onClick={enter}
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 w-full rounded-lg px-4 py-3 text-sm font-medium transition"
        >
          Enter as {roleLabel(selected.role)}
        </button>
        <p className="text-muted-foreground mt-3 text-center text-xs">
          Demo access — no password required. You can switch roles any time.
        </p>
      </div>
    </main>
  );
}
