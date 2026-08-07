import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, SkipForward, Trophy } from "lucide-react";
import {
  aggregateRecord,
  isPerfectRecord,
  LEAGUE_SIZE,
  simulateLeagueSeason,
} from "@app/game-engine";
import type { LeagueTeam, MatchResult, TeamStrength } from "@app/game-engine";

import { buildNameById, buildScorerPool } from "./engineHelpers";
import { LiveMatchClock } from "./LiveMatchClock";
import { StandingsTable } from "./StandingsTable";
import { SeasonOverlay } from "./SeasonOverlay";
import type { SquadAssignment } from "./types";

const OUTCOME_STYLES: Record<MatchResult["outcome"], string> = {
  win: "border-l-4 border-l-[#39e05c] bg-[#39e05c]/10",
  draw: "border-l-4 border-l-[#f5c518] bg-[#f5c518]/10",
  loss: "border-l-4 border-l-[#ff3b3b] bg-[#ff3b3b]/10",
};

const OUTCOME_LABEL: Record<MatchResult["outcome"], string> = { win: "V", draw: "N", loss: "P" };

const OUTCOME_COLOR: Record<MatchResult["outcome"], string> = {
  win: "#3ddc6b",
  draw: "#f5c518",
  loss: "#ff4d4d",
};

interface SeasonSimulationProps {
  squad: SquadAssignment;
  /** Attacco e difesa della rosa: la simulazione confronta i reparti, non un rating unico. */
  squadStrength: TeamStrength;
  /** Le altre squadre del campionato, per poter mostrare la classifica completa a fine stagione. */
  opponents: LeagueTeam[];
  /**
   * Cognome per id di TUTTI i giocatori del pool: serve per i marcatori **avversari**, che
   * questo componente non potrebbe ricavare da solo. I nomi dei propri titolari vengono
   * invece derivati qui da `squad`, così restano leggibili anche se questa prop manca.
   */
  nameById?: Record<string, string>;
  onPlayAgain: () => void;
  onExit: () => void;
}

/** Suffisso ordinale italiano per la posizione finale (1ª, 2ª, …). */
function ordinal(position: number): string {
  return `${position}ª`;
}

/** Simulazione match-by-match del campionato (CLAUDE.md sez. 3.5): ogni giornata scorre dal vivo (minutaggio + eventi), poi il resoconto di stagione. */
export function SeasonSimulation({
  squad,
  squadStrength,
  opponents,
  nameById = {},
  onPlayAgain,
  onExit,
}: SeasonSimulationProps) {
  const starters = useMemo(() => Object.values(squad.starters), [squad]);
  const season = useMemo(
    () => simulateLeagueSeason(squadStrength, buildScorerPool(starters), opponents),
    [squadStrength, starters, opponents],
  );
  const matches = season.userMatches;

  /**
   * I propri titolari sono già qui dentro: i loro nomi non dipendono dalla prop. La prop
   * aggiunge il resto del pool (serve per gli avversari) e non può quindi far sparire i
   * nomi della propria rosa se non arriva.
   */
  const names = useMemo(
    () => ({ ...buildNameById(starters), ...nameById }),
    [starters, nameById],
  );

  const [currentIndex, setCurrentIndex] = useState(0);

  const completed = matches.slice(0, currentIndex);
  const done = currentIndex >= matches.length;
  const record = aggregateRecord(completed);
  const perfect = done && isPerfectRecord(record);
  const userRow = season.standings.find((row) => row.isUser)!;

  const topScorers = useMemo(() => {
    if (!done) return [];
    const counts = new Map<string, number>();
    for (const match of matches) {
      for (const id of match.scorerIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, goals]) => ({ name: names[id] ?? "?", goals }))
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 5);
  }, [done, matches, names]);

  const goalsFor = completed.reduce((sum, m) => sum + m.goalsFor, 0);
  const goalsAgainst = completed.reduce((sum, m) => sum + m.goalsAgainst, 0);
  const points = record.wins * 3 + record.draws;

  /**
   * La sovraimpressione di fine stagione compare una sola volta, appena l'ultima giornata è
   * stata giocata: "Dettagli" la chiude e lascia il resoconto completo sotto, che resta
   * quello di sempre.
   */
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        {done && !overlayDismissed && (
          <SeasonOverlay
            standings={season.standings}
            wins={record.wins}
            draws={record.draws}
            losses={record.losses}
            goalsFor={goalsFor}
            goalsAgainst={goalsAgainst}
            perfect={perfect}
            onPlayAgain={onPlayAgain}
            onExit={onExit}
            onSeeDetails={() => setOverlayDismissed(true)}
          />
        )}
      </AnimatePresence>
      {!done && (
        <>
          <LiveMatchClock
            key={currentIndex}
            match={matches[currentIndex]}
            matchNumber={currentIndex + 1}
            opponentName={season.userOpponents[currentIndex]}
            nameById={names}
            onDone={() => setCurrentIndex((n) => n + 1)}
          />
          <button
            type="button"
            onClick={() => setCurrentIndex(matches.length)}
            className="flex items-center justify-center gap-2 self-center rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs font-bold text-[var(--text-secondary)]"
          >
            <SkipForward size={13} />
            Salta simulazione
          </button>
        </>
      )}

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold tracking-wide text-[var(--text-secondary)] uppercase">
            {done ? "Stagione conclusa" : `Giornate concluse: ${currentIndex}/38`}
          </p>
          <p className="text-lg font-extrabold">
            {record.wins}-{record.draws}-{record.losses}
          </p>
        </div>
        {/* Avanzamento stagione: 38 tacche colorate per esito, la stagione a colpo d'occhio. */}
        <div className="mb-3 flex gap-px">
          {matches.map((match, index) => (
            <span
              key={index}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{
                backgroundColor:
                  index < currentIndex ? OUTCOME_COLOR[match.outcome] : "var(--surface-border)",
              }}
            />
          ))}
        </div>

        {/* Ordine invertito in memoria (non con flex-col-reverse) così la giornata più
            recente è la prima del DOM: entra dall'alto e resta visibile senza scrollare. */}
        <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
          {completed
            .map((match, index) => ({ match, day: index + 1 }))
            .reverse()
            .map(({ match, day }) => (
              <motion.div
                key={day}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm ${OUTCOME_STYLES[match.outcome]}`}
              >
                <span className="w-7 shrink-0 text-xs font-semibold text-[var(--text-secondary)]">
                  G{day}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {season.userOpponents[day - 1]}
                </span>
                <span className="shrink-0 font-extrabold tabular-nums">
                  {OUTCOME_LABEL[match.outcome]} {match.goalsFor}-{match.goalsAgainst}
                </span>
                <span className="hidden min-w-0 max-w-[40%] flex-1 truncate text-right text-xs text-[var(--text-secondary)] sm:block">
                  {match.scorerIds.map((id) => names[id] ?? "?").join(", ") || "—"}
                </span>
              </motion.div>
            ))}
        </div>
      </div>

      {done && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={`rounded-2xl border p-5 ${
            perfect
              ? "border-[#f5c518] bg-gradient-to-br from-[#f5c518]/15 to-transparent"
              : "border-[var(--surface-border)] bg-[var(--surface-raised)]"
          }`}
        >
          <div className="mb-4 flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.4, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.15 }}
              className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${
                userRow.position === 1
                  ? "bg-[#f5c518] text-[#3a2c00]"
                  : "bg-[var(--brand)] text-[var(--brand-contrast)]"
              }`}
            >
              {userRow.position === 1 ? (
                <Trophy size={22} />
              ) : (
                <span className="text-xl leading-none font-extrabold">
                  {ordinal(userRow.position)}
                </span>
              )}
              <span className="mt-0.5 text-[8px] leading-none font-bold tracking-wide uppercase opacity-80">
                {userRow.position === 1 ? "Campione" : "Posto"}
              </span>
            </motion.div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
                {perfect
                  ? "Stagione perfetta"
                  : userRow.position === 1
                    ? "Campionato vinto"
                    : `Chiusa al ${ordinal(userRow.position)} posto`}
              </p>
              <p className="text-xl font-extrabold">
                {points} punti {perfect && "— 38-0-0!"}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {record.wins}V · {record.draws}N · {record.losses}P su {LEAGUE_SIZE} squadre
              </p>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <StatBox label="Gol fatti" value={goalsFor} />
            <StatBox label="Gol subiti" value={goalsAgainst} />
            <StatBox label="Differenza" value={goalsFor - goalsAgainst} />
            <StatBox
              label="Distacco dal 1º"
              value={userRow.position === 1 ? 0 : season.standings[0].points - points}
            />
          </div>
          {topScorers.length > 0 && (
            <>
              <p className="mb-2 text-xs font-bold tracking-wide text-[var(--text-secondary)] uppercase">
                Capocannonieri stagionali
              </p>
              <div className="flex flex-col gap-1.5">
                {topScorers.map((scorer) => (
                  <div
                    key={scorer.name}
                    className="flex items-center justify-between rounded-lg bg-[var(--surface)] px-3 py-2 text-sm"
                  >
                    <span className="font-semibold">{scorer.name}</span>
                    <span className="font-extrabold">{scorer.goals}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}

      {done && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: "easeOut" }}
        >
          <StandingsTable standings={season.standings} />
        </motion.div>
      )}

      {done && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--surface-border)] px-4 py-3 text-sm font-bold"
          >
            <RotateCcw size={16} />
            Rigioca
          </button>
          <button
            type="button"
            onClick={onExit}
            className="flex-1 rounded-full bg-[var(--brand)] px-4 py-3 text-sm font-bold text-[var(--brand-contrast)]"
          >
            Torna alla home
          </button>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[var(--surface)] px-2 py-2">
      <p className="text-[10px] font-semibold tracking-wide text-[var(--text-secondary)] uppercase">{label}</p>
      <p className="text-lg font-extrabold">{value}</p>
    </div>
  );
}
