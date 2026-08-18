import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { roleHome, roleLabel, signOut, useUser } from "@/lib/auth";
import { unreadCount } from "@/lib/papers-db";

export function AppHeader() {
  const user = useUser();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const load = async () => {
      const count = await unreadCount(user.email);
      if (mounted) setUnread(count);
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user]);

  if (!user) return null;

  return (
    <header className="border-border bg-card no-print sticky top-0 z-40 border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link to={roleHome(user.role)} className="flex items-center">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          {user.role === "designer" && (
            <Link
              to="/designer"
              aria-label="Notifications"
              className="hover:bg-accent relative rounded-md p-2 transition"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="bg-destructive text-destructive-foreground absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
                  {unread}
                </span>
              )}
            </Link>
          )}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium">{roleLabel(user.role)}</div>
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
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                    navigate({ to: "/", replace: true });
                  }}
                  className="text-destructive hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
                >
                  <LogOut className="h-4 w-4" /> Switch role / Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
