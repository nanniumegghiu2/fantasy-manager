import { motion } from "framer-motion";
import { Eye, FastForward, Flame, Film } from "lucide-react";
import type { MatchViewMode } from "@app/game-engine";

/**
 * **"Questa vuoi vederla?"**
 *
 * L'invito compare solo prima delle partite che decidono qualcosa — il tabellone di Corona e la
 * volata per il titolo. Chiederlo ogni settimana lo trasformerebbe in un intoppo, e la domanda
 * smetterebbe di valere: è proprio la rarità a farne un momento.
 *
 * Il risultato è **già deciso** dal motore: guardare o saltare non cambia nulla di ciò che
 * succede, cambia solo se lo si vede succedere.
 *
 * ⚠️ **Le due modalità si scelgono qui**, non dentro il teatro: sono la domanda "quanto tempo ci
 * metto?", e va risposta prima di entrare. La durata attesa è dichiarata accanto a ciascuna —
 * novanta minuti di gioco vero non si comprimono, e far scoprire dopo che una dura sei minuti
 * sarebbe una sorpresa spiacevole.
 */
export function KeyMatchPrompt({
  opponent,
  reason,
  onWatch,
  onSkip,
}: {
  opponent: string;
  reason: string;
  onWatch: (mode: MatchViewMode) => void;
  onSkip: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.92, y: 18, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 26 }}
        className="w-full max-w-sm overflow-hidden rounded-card border border-[var(--surface-border)] bg-[var(--surface)]"
      >
        <div className="flex flex-col items-center gap-2 bg-[var(--accent)]/12 px-6 py-6 text-center">
          <motion.span
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 16, delay: 0.1 }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/25 text-[var(--accent)]"
          >
            <Flame size={26} />
          </motion.span>
          <p className="text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            Partita decisiva
          </p>
          <h2 className="text-title leading-tight font-extrabold">contro {opponent}</h2>
          <p className="text-body leading-relaxed text-[var(--text-secondary)]">{reason}</p>
        </div>

        <div className="flex flex-col gap-2 p-4">
          <button
            type="button"
            onClick={() => onWatch("salienti")}
            className="flex w-full items-center justify-between gap-2 rounded-card bg-[var(--brand)] px-4 py-3.5 text-body font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              <Eye size={17} />
              Guarda i gol
            </span>
            <span className="text-label font-bold opacity-75">~2 min</span>
          </button>
          <button
            type="button"
            onClick={() => onWatch("estesa")}
            className="flex w-full items-center justify-between gap-2 rounded-card border border-[var(--brand)]/50 bg-[var(--brand)]/10 px-4 py-3 text-body font-bold text-[var(--brand)] transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              <Film size={16} />
              Guarda la partita
            </span>
            <span className="text-label font-bold opacity-75">~7 min</span>
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="flex w-full items-center justify-center gap-2 rounded-card border border-[var(--surface-border)] py-3 text-body font-bold"
          >
            <FastForward size={16} />
            Vai al risultato
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
