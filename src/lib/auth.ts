import { useEffect, useState } from "react";

export type Role = "designer" | "dqc" | "coord";

export type DemoUser = { email: string; role: Role };

export const DEMO_USERS: DemoUser[] = [
  { email: "designer@somaiya.edu", role: "designer" },
  { email: "dqc@somaiya.edu", role: "dqc" },
  { email: "examcoord@somaiya.edu", role: "coord" },
];

const KEY = "qpd-demo-user";

export function roleHome(role: Role) {
  return role === "designer" ? "/designer" : role === "dqc" ? "/dqc" : "/coord";
}

export function roleLabel(role: Role) {
  return role === "designer" ? "Faculty (Designer)" : role === "dqc" ? "DQC Member" : "Exam Coordinator";
}

export function readUser(): DemoUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DemoUser) : null;
  } catch {
    return null;
  }
}

export function signIn(user: DemoUser) {
  window.localStorage.setItem(KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("qpd-user-changed"));
}

export function signOut() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("qpd-user-changed"));
}

/** Demo session read from localStorage. Returns null until hydrated. */
export function useUser(): DemoUser | null {
  const [user, setUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    const sync = () => setUser(readUser());
    sync();
    window.addEventListener("qpd-user-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("qpd-user-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return user;
}
