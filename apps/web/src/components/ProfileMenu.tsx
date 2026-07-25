import { useEffect, useRef, useState } from "react";
import { LogOut, Moon, Shield, Sun } from "lucide-react";
import type { Profile } from "@app/shared-types";
import { supabase } from "../lib/supabaseClient";
import { useThemeStore } from "../store/useThemeStore";

export function ProfileMenu({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initial = profile.nickname.charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Profilo"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] py-1 pr-3 pl-1 transition-colors hover:border-[var(--brand)]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-bold text-[var(--brand-contrast)]">
          {initial}
        </span>
        <span className="max-w-24 truncate text-sm font-semibold">{profile.nickname}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] shadow-lg">
          <div className="border-b border-[var(--surface-border)] px-4 py-3">
            <p className="font-semibold">{profile.nickname}</p>
            <p className="text-xs text-[var(--text-secondary)]">{profile.nazione}</p>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--surface)]"
          >
            <span className="flex items-center gap-3">
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              Tema {theme === "dark" ? "chiaro" : "scuro"}
            </span>
          </button>

          {profile.isAdmin && (
            <a
              href="/admin"
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--surface)]"
            >
              <Shield size={17} />
              Pannello admin
            </a>
          )}

          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="flex w-full items-center gap-3 border-t border-[var(--surface-border)] px-4 py-3 text-sm font-medium text-red-500 transition-colors hover:bg-[var(--surface)]"
          >
            <LogOut size={17} />
            Esci
          </button>
        </div>
      )}
    </div>
  );
}
