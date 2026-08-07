import { motion } from "framer-motion";
import { ArrowLeft, ListOrdered, RotateCcw, Trophy } from "lucide-react";
import type { StandingRow } from "@app/game-engine";

interface SeasonOverlayProps {
  standings: StandingRow[];
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  perfect: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
  /** Chiude la sovraimpressione e lascia il resoconto dettagliato sotto. */
  onSeeDetails: () => void;
}

/** Titolo e sottotitolo scelti in base a com'è andata: il momento va commentato, non solo misurato. */
function seasonVerdict(position: number, perfect: boolean) {
  if (perfect) {
    return {
      title: "Stagione perfetta",
      subtitle: "38 vittorie su 38. Non è capitato a nessuno.",
      tone: "gold" as const,
    };
  }
  if (position === 1) {
    return { title: "Campione", subtitle: "Il titolo è tuo.", tone: "gold" as const };
  }
  if (position <= 4) {
    return {
      title: `${position}º posto`,
      subtitle: "Champions conquistata.",
      tone: "brand" as const,
    };
  }
  if (position <= 6) {
    return { title: `${position}º posto`, subtitle: "Qualificazione europea.", tone: "brand" as const };
  }
  if (position >= 18) {
    return { title: `${position}º posto`, subtitle: "Retrocessione.", tone: "danger" as const };
  }
  return { title: `${position}º posto`, subtitle: "Stagione di metà classifica.", tone: "neutral" as const };
}

const TONE_RING: Record<string, string> = {
  gold: "from-amber-400/30 to-amber-600/10 text-amber-300",
  brand: "from-[var(--brand)]/30 to-[var(--brand)]/5 text-[var(--brand-300)]",
  neutral: "from-white/10 to-white/0 text-[var(--text-primary)]",
  danger: "from-red-500/25 to-red-700/5 text-red-300",
};

/**
 * Sovraimpressione di fine campionato: chiude la stagione con un momento, invece di lasciare
 * l'utente davanti a una lista di 38 righe che si è fermata. Mostra l'essenziale (posizione,
 * record, gol) e le tre azioni che servono subito — rigioca, home, o guarda i dettagli.
 */
export function SeasonOverlay({
  standings,
  wins,
  draws,
  losses,
  goalsFor,
  goalsAgainst,
  perfect,
  onPlayAgain,
  onExit,
  onSeeDetails,
}: SeasonOverlayProps) {
  const userRow = standings.find((row) => row.isUser)!;
  const { title, subtitle, tone } = seasonVerdict(userRow.position, perfect);
  const leader = standings[0]!;

  const stats: { label: string; value: string }[] = [
    { label: "Punti", value: String(userRow.points) },
    { label: "V-N-P", value: `${wins}-${draws}-${losses}` },
    { label: "Gol fatti", value: String(goalsFor) },
    { label: "Gol subiti", value: String(goalsAgainst) },
    { label: "Diff. reti", value: `${goalsFor - goalsAgainst > 0 ? "+" : ""}${goalsFor - goalsAgainst}` },
    {
      label: userRow.position === 1 ? "Vantaggio" : "Dal primo",
      value:
        userRow.position === 1
          ? `+${userRow.points - (standings[1]?.points ?? userRow.points)}`
          : `-${leader.points - userRow.points}`,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Riepilogo di fine campionato"
    >
      <motion.div
        initial={{ scale: 0.9, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="m-auto w-full max-w-md overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-2xl"
      >
        <div className={`relative bg-gradient-to-b ${TONE_RING[tone]} px-6 pb-6 pt-8 text-center`}>
          <motion.div
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.15 }}
            className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-black/25"
          >
            <Trophy size={30} />
          </motion.div>
          <motion.h2
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-2xl font-extrabold tracking-tight"
          >
            {title}
          </motion.h2>
          <motion.p
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.32 }}
            className="mt-1 text-sm opacity-80"
          >
            {subtitle}
          </motion.p>
        </div>

        <div className="grid grid-cols-3 gap-px bg-[var(--surface-border)]">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              className="bg-[var(--surface)] px-2 py-3 text-center"
            >
              <p className="text-lg font-extrabold tabular-nums">{stat.value}</p>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col gap-2 p-4"
        >
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-4 py-3 text-sm font-extrabold text-white transition-[filter] hover:brightness-110"
          >
            <RotateCcw size={16} />
            Rigioca
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSeeDetails}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border border-[var(--surface-border)] px-3 py-3 text-sm font-bold transition-colors hover:border-[var(--brand)]"
            >
              <ListOrdered size={16} />
              Dettagli
            </button>
            <button
              type="button"
              onClick={onExit}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border border-[var(--surface-border)] px-3 py-3 text-sm font-bold transition-colors hover:border-[var(--brand)]"
            >
              <ArrowLeft size={16} />
              Home
            </button>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
