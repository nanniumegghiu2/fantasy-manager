import { CalendarCheck, ShieldCheck, LogOut, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Profile } from "@app/shared-types";
import { supabase } from "../lib/supabaseClient";
import { ThemeToggle } from "../components/ThemeToggle";

export type AdminSection = "leagues" | "players" | "clubs" | "challenges";

const NAV_ITEMS: { id: AdminSection; label: string; icon: typeof Users }[] = [
  { id: "leagues", label: "Campionati", icon: Trophy },
  { id: "clubs", label: "Club", icon: ShieldCheck },
  { id: "players", label: "Giocatori", icon: Users },
  { id: "challenges", label: "Sfide", icon: CalendarCheck },
];

interface AdminLayoutProps {
  profile: Profile;
  section: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  children: ReactNode;
}

export function AdminLayout({ profile, section, onSectionChange, children }: AdminLayoutProps) {
  const currentLabel = NAV_ITEMS.find((item) => item.id === section)?.label ?? "";

  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)] md:flex-row">
      {/* Barra superiore mobile */}
      <header className="flex items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <img src="/logo-512.png" alt="" className="h-7 w-7" />
          <p className="text-sm font-bold">{currentLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            aria-label="Esci"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-primary)]"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Sidebar desktop */}
      <aside className="hidden w-60 flex-col border-r border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <img src="/logo-512.png" alt="" className="h-8 w-8" />
          <div>
            <p className="text-xs text-[var(--text-secondary)]">Fantasy Manager</p>
            <p className="text-sm font-bold">Admin</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSectionChange(id)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                section === id
                  ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                  : "text-[var(--text-primary)] hover:bg-[var(--surface-border)]"
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-6 border-t border-[var(--surface-border)] pt-4">
          <p className="mb-3 truncate text-sm font-semibold">{profile.nickname}</p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              aria-label="Esci"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-primary)] transition-colors hover:border-[var(--brand)]"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto px-4 py-5 pb-24 md:px-8 md:py-8 md:pb-8">
        {children}
      </main>

      {/* Barra di navigazione inferiore mobile */}
      <nav className="fixed right-0 bottom-0 left-0 z-10 flex border-t border-[var(--surface-border)] bg-[var(--surface-raised)] pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSectionChange(id)}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
              section === id ? "text-[var(--brand)]" : "text-[var(--text-secondary)]"
            }`}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
