import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, X } from "lucide-react";
import { getFormation } from "@app/game-engine";
import { ChemistryGraph } from "./ChemistryGraph";
import type { useDraftPool } from "../hooks/useDraftPool";
import {
  buildLeagueOpponents,
  buildNameById,
  computeSquadChemistry,
  computeSquadOverallRating,
  computeSquadStrength,
  departmentRatings,
} from "./engineHelpers";
import { SeasonSimulation } from "./SeasonSimulation";
import { CHEMISTRY_LINE_COLOR } from "./theme";
import type { SetupConfig, SquadAssignment } from "./types";

interface ResultScreenProps {
  config: SetupConfig;
  squad: SquadAssignment;
  pool: ReturnType<typeof useDraftPool>;
  onPlayAgain: () => void;
  onExit: () => void;
}

export function ResultScreen({ config, squad, pool, onPlayAgain, onExit }: ResultScreenProps) {
  const formation = getFormation(config.formationId)!;
  const [phase, setPhase] = useState<"squad" | "season">("squad");
  /** Le avversarie restano le stesse per tutta la schermata: ricalcolarle rifarebbe il campionato da capo. */
  const opponents = useMemo(
    () => buildLeagueOpponents(pool.packages, pool.clubNames, config.league, config.difficulty),
    [pool.packages, pool.clubNames, config.league, config.difficulty],
  );
  const nameById = useMemo(() => buildNameById(pool.players), [pool.players]);
  const { bonus, links } = useMemo(
    () => computeSquadChemistry(formation, squad),
    [formation, squad],
  );
  const linkCounts = useMemo(
    () => ({
      green: links.filter((l) => l.color === "green").length,
      orange: links.filter((l) => l.color === "orange").length,
      red: links.filter((l) => l.color === "red").length,
    }),
    [links],
  );
  const depts = useMemo(() => departmentRatings(squad), [squad]);
  const squadRating = useMemo(
    () => computeSquadOverallRating(formation, squad),
    [formation, squad],
  );
  const squadStrength = useMemo(() => computeSquadStrength(formation, squad), [formation, squad]);

  if (phase === "season") {
    return (
      <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur">
          <h1 className="text-base font-extrabold">Simulazione campionato</h1>
          <button
            type="button"
            onClick={onExit}
            aria-label="Torna alla home"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-border)]"
          >
            <X size={16} />
          </button>
        </header>
        <main className="flex flex-1 flex-col gap-6 px-4 py-6">
          <SeasonSimulation
            squad={squad}
            squadStrength={squadStrength}
            opponents={opponents}
            nameById={nameById}
            onPlayAgain={onPlayAgain}
            onExit={onExit}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--surface-border)] bg-[var(--surface)] px-4 py-2.5">
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-[var(--brand)] text-[var(--brand-contrast)]"
        >
          <span className="text-lg leading-none font-extrabold">{squadRating}</span>
          <span className="text-[8px] leading-none font-bold tracking-wide uppercase opacity-80">
            Overall
          </span>
        </motion.div>

        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-extrabold">Rosa completata — {formation.name}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-[var(--text-secondary)]">
            <span>POR {depts.POR ?? "–"}</span>
            <span>DIF {depts.DIF ?? "–"}</span>
            <span>CC {depts.CC ?? "–"}</span>
            <span>ATT {depts.ATT ?? "–"}</span>
            <span className="font-bold text-[var(--accent)]">Intesa +{bonus}</span>
            {(["green", "orange", "red"] as const).map((color) => (
              <span key={color} className="flex items-center gap-1 font-bold">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: CHEMISTRY_LINE_COLOR[color] }}
                />
                {linkCounts[color]}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onExit}
          aria-label="Torna alla home"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
        >
          <X size={16} />
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex min-h-0 flex-1 justify-center"
        >
          <ChemistryGraph formation={formation} starters={squad.starters} />
        </motion.div>

        <motion.button
          type="button"
          onClick={() => setPhase("season")}
          whileTap={{ scale: 0.97 }}
          animate={{ boxShadow: ["0 4px 18px rgba(0,0,0,0.12)", "0 8px 26px rgba(0,0,0,0.22)", "0 4px 18px rgba(0,0,0,0.12)"] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
          className="flex shrink-0 items-center justify-center gap-2.5 rounded-2xl bg-[var(--brand)] px-5 py-4 text-base font-extrabold text-[var(--brand-contrast)]"
        >
          <Trophy size={18} />
          Simula campionato
        </motion.button>
      </main>
    </div>
  );
}
