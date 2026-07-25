import { LogIn, Sparkles, Trophy } from "lucide-react";
import { FORMATIONS } from "@app/game-engine";
import type { Profile } from "@app/shared-types";
import { ThemeToggle } from "./ThemeToggle";
import { ProfileMenu } from "./ProfileMenu";

interface HomeScreenProps {
  profile: Profile | null;
  onExitGuest?: () => void;
}

export function HomeScreen({ profile, onExitGuest }: HomeScreenProps) {
  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src="/logo-512.png" alt="" className="h-8 w-8" />
          <span className="text-base font-extrabold tracking-tight">Fantasy Manager</span>
        </div>

        {profile ? (
          <ProfileMenu profile={profile} />
        ) : (
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={onExitGuest}
              className="flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-semibold transition-colors hover:border-[var(--brand)]"
            >
              <LogIn size={16} />
              Accedi
            </button>
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-8 px-4 py-6">
        {profile ? (
          <section className="flex items-center gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-contrast)]">
              <Trophy size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
                Livello attuale
              </p>
              <p className="truncate text-lg font-extrabold">{profile.livelloId}</p>
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                {profile.puntiLivello} punti · {profile.perfect38Count} campionati perfetti
                38-0-0
              </p>
            </div>
          </section>
        ) : (
          <section className="flex items-start gap-3 rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-raised)] p-5">
            <Sparkles size={20} className="mt-0.5 shrink-0 text-[var(--accent)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--accent)]">Modalità ospite</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Stai giocando senza account: i risultati non verranno salvati. Accedi con
                Google per sbloccare storico, livelli, classifiche e le sfide PvP.
              </p>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-1 text-lg font-bold">Moduli disponibili</h2>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            Libreria dei moduli piu' famosi del calcio a 11, selezionabile prima del draft.
          </p>
          <ul className="flex flex-wrap gap-2">
            {FORMATIONS.map((formation) => (
              <li
                key={formation.id}
                className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm font-semibold"
              >
                {formation.name}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-[var(--surface-border)] px-4 py-4 text-xs text-[var(--text-secondary)]">
        Fantasy Manager è un gioco indipendente non affiliato, sponsorizzato o approvato da
        leghe, club o calciatori citati. I dati utilizzati hanno natura storica e statistica.
      </footer>
    </div>
  );
}
