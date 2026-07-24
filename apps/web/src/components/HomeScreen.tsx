import { LogOut } from "lucide-react";
import { FORMATIONS } from "@app/game-engine";
import type { Profile } from "@app/shared-types";
import { supabase } from "../lib/supabaseClient";
import { ThemeToggle } from "./ThemeToggle";

export function HomeScreen({ profile }: { profile: Profile }) {
  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="flex items-center justify-between border-b border-[var(--surface-border)] px-5 py-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[var(--brand)] uppercase">
            Draft Game Calcistico
          </p>
          <h1 className="text-xl font-bold">38-0-0 Potenziato</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <p className="font-semibold">{profile.nickname}</p>
            <p className="text-xs text-[var(--text-secondary)]">{profile.nazione}</p>
          </div>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            aria-label="Esci"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] text-[var(--text-primary)] transition-colors hover:border-[var(--brand)]"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-5 py-8">
        <section className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4">
          <p className="text-xs text-[var(--text-secondary)] uppercase">Livello attuale</p>
          <p className="text-lg font-bold">{profile.livelloId}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {profile.puntiLivello} punti livello · {profile.perfect38Count} campionati perfetti
            38-0-0
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Moduli disponibili</h2>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            Libreria dei moduli piu' famosi del calcio a 11, selezionabile prima del draft.
          </p>
          <ul className="flex flex-wrap gap-2">
            {FORMATIONS.map((formation) => (
              <li
                key={formation.id}
                className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-1 text-sm font-medium"
              >
                {formation.name}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-[var(--surface-border)] px-5 py-4 text-xs text-[var(--text-secondary)]">
        Questo prodotto e' un gioco indipendente non affiliato, sponsorizzato o approvato da
        leghe, club o calciatori citati. I dati utilizzati hanno natura storica e statistica.
      </footer>
    </div>
  );
}
