import { AnimatePresence, motion } from "framer-motion";
import { Activity, AlertTriangle, Info, Trophy } from "lucide-react";
import type { CoachUltimatum, MatchResult, WeekReport } from "@app/game-engine";
import { CompetitionNightBanner } from "./CupProgress";
import {
  COMPETITION_ACCENT,
  CUP_STAGE_LABEL,
  NATIONAL_CUP_STAGE_LABEL,
  OUTCOME_COLOR,
  outcomeOf,
} from "./format";

/**
 * Il referto della settimana appena giocata.
 *
 * È il cuore del ritmo della modalità: un clic, un risultato, e subito si capisce **cosa è
 * successo** — chi ha segnato, chi si è fatto male, cosa cambia. Il tabellino entra con una
 * molla perché il risultato deve avere un momento suo, non comparire come una riga di elenco.
 */

function Scoreline({
  result,
  opponent,
  clubName,
  nameById,
  accent,
  penalties,
}: {
  result: MatchResult;
  opponent: string;
  clubName: string;
  nameById: Record<string, string>;
  accent?: string;
  /**
   * L'esito dei rigori, quando la gara ci è finita.
   *
   * Senza, in un tabellone un 1-1 si legge come un pareggio — cioè come se non fosse successo
   * nulla — mentre è il momento in cui si passa il turno o si esce. Il punteggio resta quello
   * vero (il motore non lo inventa, sez. 3.7.14): qui si aggiunge solo *come è finita*.
   */
  penalties?: { weWon: boolean };
}) {
  const esito =
    penalties ? (penalties.weWon ? "V" : "P") : outcomeOf(result.goalsFor, result.goalsAgainst);
  const marcatori = result.events
    .filter((e) => e.team === "for" && e.scorerId)
    .map((e) => ({ minute: e.minute, name: nameById[e.scorerId!] ?? "?", penalty: e.kind === "penalty" }));
  const subiti = result.events
    .filter((e) => e.team === "against" && e.scorerId)
    .map((e) => ({ minute: e.minute, name: nameById[e.scorerId!] ?? "?", penalty: e.kind === "penalty" }));

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: `${accent ?? OUTCOME_COLOR[esito]}55` }}
    >
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-right text-sm font-extrabold">{clubName}</span>
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 20 }}
          className="shrink-0 rounded-xl px-3 py-1.5 text-xl font-extrabold tabular-nums"
          style={{
            backgroundColor: `${OUTCOME_COLOR[esito]}22`,
            color: OUTCOME_COLOR[esito],
          }}
        >
          {result.goalsFor} - {result.goalsAgainst}
        </motion.span>
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{opponent}</span>
      </div>

      {penalties && (
        <p
          className="mt-2 text-center text-[11px] font-bold tracking-wide uppercase"
          style={{ color: OUTCOME_COLOR[esito] }}
        >
          {penalties.weWon ? "Passiamo il turno ai rigori" : "Fuori ai rigori"}
        </p>
      )}

      {(marcatori.length > 0 || subiti.length > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] leading-relaxed">
          <ul className="space-y-0.5 text-right">
            {marcatori.map((m, i) => (
              <li key={i} className="truncate">
                <span className="font-semibold">{m.name}</span>{" "}
                <span className="text-[var(--text-secondary)]">
                  {m.minute}&apos;{m.penalty ? " rig." : ""}
                </span>
              </li>
            ))}
          </ul>
          <ul className="space-y-0.5 text-[var(--text-secondary)]">
            {subiti.map((m, i) => (
              <li key={i} className="truncate">
                <span className="font-semibold">{m.name}</span> {m.minute}&apos;
                {m.penalty ? " rig." : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface WeekReportCardProps {
  report: WeekReport | null;
  clubName: string;
  nameById: Record<string, string>;
  ultimatum?: CoachUltimatum | null;
}

export function WeekReportCard({ report, clubName, nameById, ultimatum }: WeekReportCardProps) {
  if (!report) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--surface-border)] px-4 py-10 text-center">
        <Trophy size={22} className="text-[var(--text-secondary)]" />
        <p className="text-sm font-semibold">La stagione ti aspetta</p>
        <p className="max-w-xs text-xs leading-relaxed text-[var(--text-secondary)]">
          Avanza di una settimana per giocare la prima giornata.
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${report.season}-${report.week}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="flex flex-col gap-2.5"
      >
        {ultimatum && (
          <div className="flex items-center gap-2.5 rounded-2xl border border-[#ff4d4d]/40 bg-[#ff4d4d]/10 p-3 text-xs">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#ff4d4d]" />
            <div>
              <p className="font-extrabold text-[#ff4d4d]">⚡ ULTIMATUM DELLA SOCIETÀ</p>
              <p className="text-[11px] text-[var(--text-primary)]">
                Obiettivo: <strong className="font-bold">{ultimatum.pointsAccumulated}/{ultimatum.targetPoints} pt</strong> · Mancano <strong className="font-bold">{ultimatum.matchdaysLeft}</strong> giornate per salvare la panchina!
              </p>
            </div>
          </div>
        )}

        {report.match && (
          <Scoreline
            result={report.match.result}
            opponent={report.match.opponent}
            clubName={clubName}
            nameById={nameById}
          />
        )}

        {report.cupMatch && (
          <div className="flex flex-col gap-2">
            <CompetitionNightBanner
              competition="corona"
              stage={CUP_STAGE_LABEL[report.cupMatch.stage] ?? report.cupMatch.stage}
            />
            <Scoreline
              result={report.cupMatch.result}
              opponent={report.cupMatch.opponent}
              clubName={clubName}
              nameById={nameById}
              accent={COMPETITION_ACCENT.corona}
            />
          </div>
        )}

        {/**
         * **La Coppa Tricolore, che fino a ieri non si vedeva affatto.**
         *
         * Il motore ne giocava sei turni a stagione — con i loro gol, i loro infortuni e il loro
         * peso sulla fatica — e nessuna riga di questo file li leggeva: `report.nationalCupMatch`
         * arrivava e veniva buttato. Chi giocava concludeva, ragionevolmente, che la competizione
         * non esistesse.
         */}
        {report.nationalCupMatch && (
          <div className="flex flex-col gap-2">
            <CompetitionNightBanner
              competition="tricolore"
              stage={
                NATIONAL_CUP_STAGE_LABEL[report.nationalCupMatch.stage] ??
                report.nationalCupMatch.stage
              }
            />
            <Scoreline
              result={report.nationalCupMatch.result}
              opponent={report.nationalCupMatch.opponent}
              clubName={clubName}
              nameById={nameById}
              accent={COMPETITION_ACCENT.tricolore}
              penalties={
                report.nationalCupMatch.wentToPenalties
                  ? { weWon: !!report.nationalCupMatch.weWonPenalties }
                  : undefined
              }
            />
          </div>
        )}

        {report.injuries.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-2xl border border-[#ff4d4d]/30 bg-[#ff4d4d]/5 p-3">
            {report.injuries.map((injury) => (
              <li key={injury.playerId} className="flex items-center gap-2 text-xs">
                <Activity size={13} className="shrink-0 text-[#ff4d4d]" />
                <span className="font-semibold">{nameById[injury.playerId] ?? "Un giocatore"}</span>
                <span className="text-[var(--text-secondary)]">
                  infortunato · {injury.matchdays} {injury.matchdays === 1 ? "giornata" : "giornate"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {report.messages.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3">
            {report.messages.map((message, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                <Info size={13} className="mt-0.5 shrink-0 text-[var(--text-secondary)]" />
                {message}
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
