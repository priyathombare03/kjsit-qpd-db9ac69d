import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { homeFor, primaryRole, roleLabel, signOutUser, useAuth } from "@/lib/auth";
import { listNotifications, markAllRead, type NotificationRow } from "@/lib/papers-db";

export function AppHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const email = user?.email ?? "";

  useEffect(() => {
    if (!email) return;
    let mounted = true;
    listNotifications(email)
      .then((rows) => mounted && setItems(rows))
      .catch(() => undefined);

    const channel = supabase
      .channel(`notifications-${email}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_email=eq.${email}` },
        (payload) => setItems((prev) => [payload.new as NotificationRow, ...prev].slice(0, 30)),
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [email]);

  if (!user) return null;

  const unread = items.filter((n) => !n.read).length;
  const role = primaryRole(user);

  const openBell = async () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (next && unread > 0) {
      await markAllRead(email);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOutUser();
    navigate({ to: "/", replace: true });
  };

  return (
    <header className="border-border bg-card no-print sticky top-0 z-40 border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to={homeFor(user)} className="flex items-center">
          <Logo />
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="relative">
            <button
              onClick={() => void openBell()}
              aria-label="Notifications"
              className="hover:bg-accent relative rounded-md p-2 transition"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="bg-destructive text-destructive-foreground absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
                  {unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="bg-popover border-border absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-md border p-2 shadow-lg">
                <div className="text-muted-foreground px-2 py-1 text-xs font-medium">Notifications</div>
                {items.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-4 text-sm">Nothing yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {items.map((n) => (
                      <li key={n.id} className="hover:bg-accent rounded-md px-2 py-2 text-sm">
                        <div>{n.message}</div>
                        <div className="text-muted-foreground text-[11px]">
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium">{role ? roleLabel(role) : user.fullName}</div>
            <div className="text-muted-foreground text-xs">{user.email}</div>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="hover:bg-accent rounded-md p-2 transition"
              aria-label="Account menu"
            >
              <LogOut className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="bg-popover border-border absolute right-0 z-50 mt-2 w-56 rounded-md border p-2 shadow-lg">
                <div className="text-muted-foreground px-2 py-2 text-xs">
                  Signed in as
                  <div className="text-foreground text-sm font-medium">{user.email}</div>
                </div>
                <div className="border-border my-1 border-t" />
                <button
                  onClick={() => void handleSignOut()}
                  className="text-destructive hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
