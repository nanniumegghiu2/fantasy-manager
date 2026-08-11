import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ShieldAlert, X } from "lucide-react";
import {
  availableMoves,
  moveContextOf,
  outcomeSummary,
  playerFactsOf,
  type CareerState,
  type CareerWorld,
  type Dialogue,
  type DialogueMove,
  type MoveOption,
} from "@app/game-engine";

/**
 * **La conversazione col giocatore, riscritta.**
 *
 * Quattro differenze rispetto alla chat precedente, ognuna contro un difetto preciso:
 *  - **"il suo caso"**: i fatti che porta al tavolo, in chip. Prima l'utente doveva rispondere
 *    senza sapere *perché* quel giocatore stesse parlando;
 *  - **fiducia in intestazione**: la memoria del rapporto è la prima cosa che si vede;
 *  - la barra si chiama **Pazienza** e verde vuol dire "ti sta ascoltando". Prima era etichettata
 *    "Tensione" pur mostrando la pazienza: semantica invertita;
 *  - le mosse sono **carte con il costo scritto** e, se non sono possibili, **col motivo**. Prima
 *    "Premio in Denaro" falliva dopo il clic se il budget non bastava.
 */
export function PlayerDialogueChat({
  state,
  world,
  dialogue,
  onMove,
  onClose,
}: {
  state: CareerState;
  world: CareerWorld;
  dialogue: Dialogue;
  onMove: (move: DialogueMove) => void;
  onClose: () => void;
}) {
  const fondo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fondo.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [dialogue.log.length]);

  const [repartoAperto, setRepartoAperto] = useState(false);

  const mosse = useMemo<MoveOption[]>(() => {
    const facts = playerFactsOf(state, world, dialogue.playerId);
    if (!facts) return [];
    return availableMoves(dialogue, facts, moveContextOf(state, world, facts));
  }, [state, world, dialogue]);

  const chiusa = dialogue.status !== "aperta";
  const esito = outcomeSummary(dialogue.status);
  const tono = esito.tone === "verde" ? "#3ddc6b" : esito.tone === "rosso" ? "#ff4d4d" : "#ffab2e";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 330, damping: 32 }}
        className="flex h-[90svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] sm:h-[85svh] sm:rounded-3xl"
      >
        <header className="border-b border-[var(--surface-border)] bg-[var(--surface-raised)]/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold">{dialogue.playerName}</p>
              <p className="truncate text-[11px] text-[var(--text-secondary)]">{dialogue.topicLabel}</p>
            </div>
            {(!dialogue.forced || chiusa) && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Chiudi"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)]"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[9px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
              Fiducia
            </span>
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--surface)]">
              <motion.span
                className="block h-full rounded-full bg-[#5aa9e6]"
                animate={{ width: `${dialogue.trust}%` }}
              />
            </span>
            <span className="text-[10px] font-bold tabular-nums text-[var(--text-secondary)]">
              {dialogue.trust}
            </span>
          </div>
        </header>

        {/* Il suo caso: i fatti, non solo il testo. */}
        <div className="flex flex-wrap gap-1.5 border-b border-[var(--surface-border)] bg-black/20 px-4 py-2">
          {dialogue.highlights.map((h) => (
            <span
              key={h}
              className="rounded-lg bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]"
            >
              {h}
            </span>
          ))}
        </div>

        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs">
          <p className="text-[10px] font-extrabold tracking-wider text-amber-300 uppercase">Chiede</p>
          <p className="mt-0.5 font-medium leading-tight text-amber-100/90">{dialogue.demand.description}</p>
        </div>

        <div className="flex items-center gap-2 border-b border-[var(--surface-border)] px-4 py-2">
          <span className="text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
            Pazienza
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-raised)]">
            <motion.span
              className="block h-full rounded-full"
              animate={{
                width: `${dialogue.patience}%`,
                backgroundColor: dialogue.patience > 55 ? "#3ddc6b" : dialogue.patience > 25 ? "#ffab2e" : "#ff4d4d",
              }}
            />
          </span>
          <span className="font-mono text-[11px] font-bold text-[var(--text-secondary)]">
            {dialogue.patience}%
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <AnimatePresence initial={false}>
            {dialogue.log.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className={`flex ${m.speaker === "ds" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    m.speaker === "ds"
                      ? "rounded-br-md bg-[var(--brand)] font-medium text-[var(--brand-contrast)]"
                      : "rounded-bl-md border border-[var(--surface-border)] bg-[var(--surface-raised)]"
                  }`}
                >
                  {m.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={fondo} />
        </div>

        <footer className="border-t border-[var(--surface-border)] bg-[var(--surface-raised)]/30 p-3">
          {chiusa ? (
            <div className="flex flex-col gap-2">
              <p
                className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold"
                style={{ backgroundColor: `${tono}22`, color: tono }}
              >
                {dialogue.status === "rottura" ? <ShieldAlert size={16} /> : <Check size={16} />}
                {esito.title}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl bg-[var(--brand)] py-3 text-sm font-extrabold text-[var(--brand-contrast)]"
              >
                Torna allo spogliatoio
              </button>
            </div>
          ) : repartoAperto ? (
            <div className="flex flex-col gap-2">
              <p className="px-1 text-[11px] font-bold text-[var(--text-secondary)]">
                In quale reparto prometti il rinforzo?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["POR", "DIF", "CC", "ATT"] as const).map((dep) => (
                  <button
                    key={dep}
                    type="button"
                    onClick={() => {
                      setRepartoAperto(false);
                      onMove({ kind: "promessa_rinforzo", department: dep });
                    }}
                    className="rounded-2xl bg-[var(--brand)] px-3 py-2.5 text-xs font-bold text-[var(--brand-contrast)]"
                  >
                    {dep}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setRepartoAperto(false)}
                className="w-full rounded-2xl border border-[var(--surface-border)] py-2 text-[11px] font-bold text-[var(--text-secondary)]"
              >
                Annulla
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {mosse.map((m) => {
                const bloccata = !!m.disabledReason;
                return (
                  <button
                    key={m.kind}
                    type="button"
                    disabled={bloccata}
                    onClick={() =>
                      m.kind === "promessa_rinforzo" ? setRepartoAperto(true) : onMove({ kind: m.kind })
                    }
                    className={`flex flex-col items-start gap-0.5 rounded-2xl border px-3 py-2 text-left transition-transform active:scale-95 ${
                      bloccata
                        ? "cursor-not-allowed border-[var(--surface-border)] opacity-45"
                        : m.answersDemand
                          ? "border-emerald-500 bg-emerald-500/15"
                          : m.risk === "rottura"
                            ? "border-rose-500/50"
                            : "border-[var(--surface-border)] bg-[var(--surface-raised)]"
                    }`}
                  >
                    <span className="flex w-full items-center gap-1 text-[12px] font-extrabold">
                      {m.answersDemand && !bloccata && <Check size={11} className="text-emerald-400" />}
                      <span className="min-w-0 flex-1 truncate">{m.label}</span>
                    </span>
                    <span
                      className={`text-[9px] leading-tight font-semibold ${
                        bloccata ? "text-rose-400" : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {bloccata ? `✕ ${m.disabledReason}` : m.cost}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </footer>
      </motion.div>
    </motion.div>
  );
}
