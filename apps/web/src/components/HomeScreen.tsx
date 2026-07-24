import { LogIn, LogOut } from "lucide-react";
import { FORMATIONS } from "@app/game-engine";
import type { Profile } from "@app/shared-types";
import { supabase } from "../lib/supabaseClient";
import { ThemeToggle } from "./ThemeToggle";

interface HomeScreenProps {
  profile: Profile | null;
  onExitGuest?: () => void;
}

export function HomeScreen({ profile, onExitGuest }: HomeScreenProps) {
  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="flex items-center justify-between border-b border-[var(--surface-border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <img src="/logo-512.png" alt="" className="h-9 w-9" />
          <div>
            <p className="text-xs font-semibold tracking-wide text-[var(--brand)] uppercase">
              Draft Game Calcistico
            </p>
            <h1 className="text-xl font-bold">Fantasy Manager</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {profile ? (
            <>
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
            </>
          ) : (
            <>
              <ThemeToggle />
              <button
                type="button"
                onClick={onExitGuest}
                className="flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-semibold transition-colors hover:border-[var(--brand)]"
              >
                <LogIn size={16} />
                Accedi
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-5 py-8">
        {profile ? (
          <section className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4">
            <p className="text-xs text-[var(--text-secondary)] uppercase">Livello attuale</p>
            <p className="text-lg font-bold">{profile.livelloId}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {profile.puntiLivello} punti livello · {profile.perfect38Count} campionati
              perfetti 38-0-0
            </p>
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-raised)] p-4">
            <p className="text-sm font-semibold text-[var(--accent)]">Modalità ospite</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Stai giocando senza account: i risultati non verranno salvati. Accedi con Google
              per sbloccare storico, livelli, classifiche e le sfide PvP.
            </p>
          </section>
        )}

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
        Fantasy Manager è un gioco indipendente non affiliato, sponsorizzato o approvato da
        leghe, club o calciatori citati. I dati utilizzati hanno natura storica e statistica.
      </footer>
    </div>
  );
}
