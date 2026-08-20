import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/forgot")({
  head: () => ({
    meta: [
      { title: "Reset your password — Paper Path" },
      { name: "description", content: "Request a password reset email for your Paper Path question paper account." },
      { property: "og:title", content: "Reset your password — Paper Path" },
      { property: "og:description", content: "Password recovery for faculty, HOD, DQC and exam coordinators." },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-card border-border w-full max-w-md rounded-xl border p-6 shadow-sm sm:p-8">
        <Logo size={44} />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Forgot password</h1>
        {sent ? (
          <p className="text-muted-foreground mt-3 text-sm">
            If an account exists for <span className="text-foreground font-medium">{email}</span>, a reset link is on
            its way. Open it to choose a new password.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground mt-1 text-sm">
              Enter your account email and we will send a reset link.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@somaiya.edu"
                className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-3 text-sm font-medium transition disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}
        <p className="text-muted-foreground mt-4 text-center text-sm">
          <Link to="/" className="text-brand font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
