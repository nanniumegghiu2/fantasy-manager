import { LogOut, ShieldCheck, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Profile } from "@app/shared-types";
import { supabase } from "../lib/supabaseClient";

export type AdminSection = "players" | "clubs" | "challenges";

const NAV_ITEMS: { id: AdminSection; label: string; icon: typeof Users }[] = [
  { id: "players", label: "Giocatori", icon: Users },
  { id: "clubs", label: "Club", icon: ShieldCheck },
  { id: "challenges", label: "Sfide giornaliere", icon: Trophy },
];

interface AdminLayoutProps {
  profile: Profile;
  section: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  children: ReactNode;
}

export function AdminLayout({ profile, section, onSectionChange, children }: AdminLayoutProps) {
  return (
    <div className="flex min-h-svh bg-[var(--surface)] text-[var(--text-primary)]">
      <aside className="flex w-60 flex-col border-r border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-6">
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

        <div className="mt-6 flex items-center justify-between border-t border-[var(--surface-border)] pt-4">
          <p className="truncate text-sm font-semibold">{profile.nickname}</p>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            aria-label="Esci"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-primary)] transition-colors hover:border-[var(--brand)]"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  );
}
