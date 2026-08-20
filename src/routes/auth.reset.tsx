import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/reset")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Paper Path" },
      { name: "description", content: "Set a new password for your Paper Path question paper workflow account." },
      { property: "og:title", content: "Choose a new password — Paper Path" },
      { property: "og:description", content: "Complete your password reset and get back to your papers." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-card border-border w-full max-w-md rounded-xl border p-6 shadow-sm sm:p-8">
        <Logo size={44} />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Set a new password</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">New password</span>
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Confirm password</span>
            <input
              required
              type="password"
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-3 text-sm font-medium transition disabled:opacity-60"
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}
