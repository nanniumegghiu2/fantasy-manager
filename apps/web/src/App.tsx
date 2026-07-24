import { useEffect } from "react";
import { FORMATIONS } from "@app/game-engine";
import { useThemeStore } from "./store/useThemeStore";
import { ThemeToggle } from "./components/ThemeToggle";

function App() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="flex items-center justify-between border-b border-[var(--surface-border)] px-5 py-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[var(--brand)] uppercase">
            Draft Game Calcistico
          </p>
          <h1 className="text-xl font-bold">38-0-0 Potenziato</h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col gap-8 px-5 py-8">
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

export default App;
