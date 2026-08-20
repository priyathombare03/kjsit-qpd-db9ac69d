import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchSessionUser, homeFor } from "@/lib/auth";
import { listInstitutions, type Institution } from "@/lib/reference-db";
import logo from "@/assets/svv-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Paper Path Question Paper Workflow" },
      {
        name: "description",
        content:
          "Sign in to Paper Path to design, review and approve Somaiya question papers with AI-generated sets, Bloom analysis and DQC sign-off.",
      },
      { property: "og:title", content: "Sign in — Paper Path Question Paper Workflow" },
      {
        property: "og:description",
        content: "Faculty, HOD, DQC and exam coordinator access to the Somaiya question paper workflow.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listInstitutions()
      .then((rows) => {
        setInstitutions(rows);
        setInstitutionId((cur) => cur || (rows[0]?.id ?? ""));
      })
      .catch(() => setInstitutions([]));
  }, []);

  useEffect(() => {
    void fetchSessionUser().then((u) => {
      if (u) navigate({ to: homeFor(u), replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const user = await fetchSessionUser();
    if (user && user.status !== "active") {
      setBusy(false);
      toast.error("Your account is awaiting HOD approval.");
      await supabase.auth.signOut();
      return;
    }
    setBusy(false);
    navigate({ to: homeFor(user), replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-card border-border w-full max-w-md rounded-xl border p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>


        <form onSubmit={submit} className="mt-6 space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Institution portal</legend>
            <div className="space-y-2">
              {institutions.map((inst) => (
                <label
                  key={inst.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                    institutionId === inst.id ? "border-brand bg-brand-muted" : "border-border hover:bg-accent/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="institution"
                    className="accent-current"
                    checked={institutionId === inst.id}
                    onChange={() => setInstitutionId(inst.id)}
                  />
                  <span>
                    <span className="font-medium">{inst.code}</span>
                    <span className="text-muted-foreground block text-xs">{inst.name}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
              placeholder="you@somaiya.edu"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Link to="/auth/forgot" className="text-brand text-xs hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-3 text-sm font-medium transition disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-muted-foreground mt-4 text-center text-sm">
          New faculty member?{" "}
          <Link to="/auth/register" className="text-brand font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
