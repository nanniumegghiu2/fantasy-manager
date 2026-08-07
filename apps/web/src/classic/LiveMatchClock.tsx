import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Flag, Goal } from "lucide-react";
import type { MatchEvent, MatchResult } from "@app/game-engine";

/**
 * Ritmo della simulazione live (rallentato su richiesta esplicita dell'utente: deve
 * "sperare partita per partita" invece di vedere il risultato scorrere via veloce).
 * Ogni evento (gol/rigore) guadagna una pausa extra per lasciarlo "respirare" invece di
 * passare inosservato — più un minuto qualsiasi.
 */
const MINUTE_STEP = 4;
const BASE_TICK_MS = 45;
const EVENT_BONUS_MS = 320;
const END_PAUSE_MS = 650;

const EVENT_STYLE: Record<MatchEvent["team"], string> = {
  for: "bg-[#39e05c]/15",
  against: "bg-[#ff3b3b]/15",
};

function EventRow({ event, nameById }: { event: MatchEvent; nameById: Record<string, string> }) {
  const isFor = event.team === "for";
  const Icon = event.kind === "penalty" ? Flag : Goal;
  const label = event.kind === "penalty" ? "Rigore" : "Gol";
  // Lookup difensivo: un marcatore senza nome è un dettaglio mancante, non un motivo per
  // far fallire il render e lasciare la schermata di simulazione completamente vuota.
  const scorer = event.scorerId ? nameById?.[event.scorerId] : undefined;

  // Anche i gol subiti hanno un marcatore reale: è un giocatore dell'avversaria di
  // giornata, pescato dai suoi 11 migliori (sez. CLAUDE.md 3.5).
  const text = scorer
    ? `${label} ${isFor ? "" : "subito "}— ${scorer}`
    : `${label} ${isFor ? "" : "subito"}`.trim();

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${EVENT_STYLE[event.team]}`}
    >
      <Icon size={13} className="shrink-0 text-[var(--text-primary)]" />
      <span className="shrink-0 font-extrabold">{event.minute}&apos;</span>
      <span className="min-w-0 flex-1 truncate font-semibold">{text}</span>
    </motion.div>
  );
}

interface LiveMatchClockProps {
  match: MatchResult;
  matchNumber: number;
  /** Nome dell'avversaria di giornata: dà un contesto alla partita e collega al calendario del campionato. */
  opponentName: string;
  nameById?: Record<string, string>;
  onDone: () => void;
}

/** Mostra una partita "dal vivo": il minutaggio scorre e gli eventi (gol fatti/subiti, rigori) compaiono man mano. */
export function LiveMatchClock({
  match,
  matchNumber,
  opponentName,
  nameById = {},
  onDone,
}: LiveMatchClockProps) {
  const [minute, setMinute] = useState(0);
  const [shown, setShown] = useState<MatchEvent[]>([]);

  useEffect(() => {
    setMinute(0);
    setShown([]);
    let current = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      current = Math.min(current + MINUTE_STEP, 90);
      setMinute(current);
      const newlyReached = match.events.filter(
        (e) => e.minute <= current && e.minute > current - MINUTE_STEP,
      );
      if (newlyReached.length > 0) setShown((prev) => [...prev, ...newlyReached]);

      if (current >= 90) {
        timeoutId = setTimeout(onDone, END_PAUSE_MS);
        return;
      }
      const delay = newlyReached.length > 0 ? BASE_TICK_MS + EVENT_BONUS_MS : BASE_TICK_MS;
      timeoutId = setTimeout(tick, delay);
    }

    timeoutId = setTimeout(tick, BASE_TICK_MS);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match]);

  const scoreFor = shown.filter((e) => e.team === "for").length;
  const scoreAgainst = shown.filter((e) => e.team === "against").length;
  const live = minute < 90;

  return (
    <div className="rounded-2xl border border-[var(--brand)]/40 bg-[var(--surface-raised)] p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-[var(--text-secondary)] uppercase">
            <Clock size={14} className={live ? "animate-pulse text-[var(--accent)]" : ""} />
            Giornata {matchNumber} · {minute}&apos;{live ? "" : " FT"}
          </span>
          <p className="mt-0.5 truncate text-sm font-extrabold">
            La tua squadra <span className="text-[var(--text-secondary)]">vs</span> {opponentName}
          </p>
        </div>
        <span className="shrink-0 text-2xl leading-none font-extrabold tabular-nums">
          {scoreFor}-{scoreAgainst}
        </span>
      </div>
      <div className="flex min-h-[74px] flex-col-reverse gap-1.5 overflow-hidden">
        <AnimatePresence initial={false}>
          {shown.map((event, index) => (
            <EventRow key={index} event={event} nameById={nameById} />
          ))}
        </AnimatePresence>
        {shown.length === 0 && (
          <p className="text-center text-xs text-[var(--text-secondary)]">In corso…</p>
        )}
      </div>
    </div>
  );
}
