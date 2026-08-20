import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { listInstitutions, type Institution } from "@/lib/reference-db";

export const Route = createFileRoute("/auth/register")({
  head: () => ({
    meta: [
      { title: "Create a faculty account — Paper Path" },
      {
        name: "description",
        content: "Register as faculty to design question papers. Accounts are activated after your HOD approves them.",
      },
      { property: "og:title", content: "Create a faculty account — Paper Path" },
      { property: "og:description", content: "Faculty registration for the Somaiya question paper workflow." },
    ],
  }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    department: "Computer Engineering",
    institutionId: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    listInstitutions()
      .then((rows) => {
        setInstitutions(rows);
        setForm((f) => ({ ...f, institutionId: f.institutionId || (rows[0]?.id ?? "") }));
      })
      .catch(() => setInstitutions([]));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: form.fullName,
          department: form.department,
          institution_id: form.institutionId,
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
    toast.success("Account created. Awaiting HOD approval.");
  };

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="bg-card border-border w-full max-w-md rounded-xl border p-8 text-center shadow-sm">
          <Logo size={44} />
          <h1 className="mt-6 text-xl font-semibold">Registration received</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Confirm your email address if prompted, then wait for your Head of Department to approve your account. You
            will be notified once it is active.
          </p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="bg-primary text-primary-foreground mt-6 w-full rounded-lg px-4 py-3 text-sm font-medium"
          >
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-card border-border w-full max-w-md rounded-xl border p-6 shadow-sm sm:p-8">
        <Logo size={44} />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Faculty registration</h1>
        <p className="text-muted-foreground mt-1 text-sm">Your HOD approves the account before you can sign in.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Full name">
            <input
              required
              value={form.fullName}
              onChange={set("fullName")}
              className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </Field>

          <Field label="Institution">
            <select
              required
              value={form.institutionId}
              onChange={set("institutionId")}
              className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
            >
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Department">
            <input
              required
              value={form.department}
              onChange={set("department")}
              className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </Field>

          <Field label="Email">
            <input
              required
              type="email"
              value={form.email}
              onChange={set("email")}
              className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
              placeholder="you@somaiya.edu"
            />
          </Field>

          <Field label="Password">
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={set("password")}
              className="border-border bg-background w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </Field>

          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-3 text-sm font-medium transition disabled:opacity-60"
          >
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-muted-foreground mt-4 text-center text-sm">
          Already registered?{" "}
          <Link to="/" className="text-brand font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
