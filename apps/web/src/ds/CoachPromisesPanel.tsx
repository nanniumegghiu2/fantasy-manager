import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, Clock, Repeat, Sparkles } from "lucide-react";
import type { CoachPromise } from "@app/game-engine";

/** Una promessa con lo stato **live**: si aggiorna a ogni transazione, non solo a fine mercato. */
export type LiveCoachPromise = CoachPromise & { liveFulfilled?: boolean };

interface CoachPromisesPanelProps {
  promises: LiveCoachPromise[];
  /**
   * Apre la scelta di un'alternativa **dal database** per una promessa nominata e non ancora
   * soddisfatta — a mercato aperto, senza aspettare la prossima negoziazione stagionale.
   */
  onProposeAlternative?: (promise: LiveCoachPromise) => void;
}

export function CoachPromisesPanel({ promises, onProposeAlternative }: CoachPromisesPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!promises || promises.length === 0) return null;

  // Il pallino usa lo stato live quando disponibile (mercato aperto): `fulfilled` da solo
  // resterebbe fermo all'ultima verifica salvata, che è esattamente il difetto segnalato.
  const isFulfilled = (p: LiveCoachPromise) => p.liveFulfilled ?? p.fulfilled ?? false;
  const fulfilledCount = promises.filter(isFulfilled).length;
  const totalCount = promises.length;

  return (
    <div className="overflow-hidden rounded-card border border-[var(--brand)]/30 bg-[var(--brand)]/5 shadow-sm transition-colors hover:border-[var(--brand)]/50">
      {/* Header compatto ed espandibile al click */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-[var(--brand)]/15 text-[var(--brand)]">
            <Sparkles size={15} />
          </span>
          <div className="min-w-0">
            {/* Il nome del mister toglieva spazio senza aggiungere nulla — in questa finestra
                ce n'è uno solo — e faceva perdere 80px al titolo su 267 necessari. */}
            <h3 className="text-micro text-[var(--brand)] uppercase">Promesse al mister</h3>
            <p className="text-label text-[var(--text-secondary)] font-medium">
              {fulfilledCount} su {totalCount} promesse già mantenute
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`rounded-full px-2.5 py-0.5 text-label font-extrabold uppercase tracking-wider ${
              fulfilledCount === totalCount
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            }`}
          >
            {fulfilledCount === totalCount ? "Tutte Mantenute" : `${fulfilledCount}/${totalCount} OK`}
          </span>

          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-[var(--text-secondary)]"
          >
            <ChevronDown size={16} />
          </motion.div>
        </div>
      </button>

      {/* Contenuto espandibile delle promesse singole */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="border-t border-[var(--brand)]/20 px-4 py-3"
          >
            <p className="mb-2 text-micro font-extrabold uppercase tracking-widest text-[var(--text-secondary)]">
              Dettaglio Accordi da Rispettare Entro la Fine del Mercato:
            </p>
            <div className="flex flex-col gap-2">
              {promises.map((p) => {
                const ok = isFulfilled(p);
                // Ha senso solo per promesse con un ruolo nominato: è lì che "un'alternativa"
                // significa qualcosa (un altro giocatore reale per la stessa casella).
                const puoProporreAlternativa = !ok && !!p.targetRole && !!onProposeAlternative;
                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-2 rounded-control border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2.5 text-label shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            ok ? "bg-emerald-400 shadow-sm" : "bg-amber-400 animate-pulse"
                          }`}
                        />
                        <span className="font-semibold text-[var(--text-primary)]">{p.description}</span>
                      </div>
                      {ok ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-label">
                          <CheckCircle2 size={14} /> Mantenuta
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-400 font-extrabold text-label">
                          <Clock size={14} /> In Corso
                        </span>
                      )}
                    </div>
                    {puoProporreAlternativa && (
                      <button
                        type="button"
                        onClick={() => onProposeAlternative!(p)}
                        className="flex items-center justify-center gap-1.5 self-start rounded-full border border-[var(--brand)]/40 px-2.5 py-1 text-label font-bold text-[var(--brand)] transition-transform active:scale-95"
                      >
                        <Repeat size={11} /> Proponi un'alternativa
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
