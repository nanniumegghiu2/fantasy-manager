import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useDraftPool } from "../hooks/useDraftPool";
import { DraftScreen } from "./DraftScreen";
import { ResultScreen } from "./ResultScreen";
import { SetupScreen } from "./SetupScreen";
import type { SetupConfig, SquadAssignment } from "./types";

type Step =
  | { kind: "setup" }
  | { kind: "draft"; config: SetupConfig }
  | { kind: "result"; config: SetupConfig; squad: SquadAssignment };

export function ClassicMode({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "setup" });
  const pool = useDraftPool();
  /** Campionati disponibili nel pool, in ordine alfabetico, per il selettore di competizione. */
  const leagues = useMemo(
    () => [...new Set(pool.players.map((p) => p.league))].filter((l) => l !== "—").sort(),
    [pool.players],
  );

  if (pool.loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[var(--surface)] text-sm text-[var(--text-secondary)]">
        Caricamento del pool giocatori...
      </div>
    );
  }

  if (pool.error || pool.players.length === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[var(--surface)] px-6 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          {pool.error ?? "Nessun giocatore disponibile nel database al momento."}
        </p>
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-2 rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold"
        >
          <ArrowLeft size={16} />
          Torna alla home
        </button>
      </div>
    );
  }

  if (step.kind === "setup") {
    return (
      <SetupScreen
        leagues={leagues}
        onStart={(config) => setStep({ kind: "draft", config })}
        onExit={onExit}
      />
    );
  }

  if (step.kind === "draft") {
    return (
      <DraftScreen
        config={step.config}
        pool={pool}
        onComplete={(squad) => setStep({ kind: "result", config: step.config, squad })}
        onExit={onExit}
      />
    );
  }

  return (
    <ResultScreen
      config={step.config}
      squad={step.squad}
      pool={pool}
      onPlayAgain={() => setStep({ kind: "setup" })}
      onExit={onExit}
    />
  );
}
