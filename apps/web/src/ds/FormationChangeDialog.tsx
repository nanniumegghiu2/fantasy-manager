import { motion } from "framer-motion";
import { AlertTriangle, ClipboardList } from "lucide-react";
import type { Coach } from "@app/game-engine";

/**
 * **Il mister vuole cambiare sistema di gioco.**
 *
 * È una richiesta **rifiutabile**, non un fatto compiuto: il direttore sportivo resta al centro.
 * Ma dire di no non è gratis — costa sintonia, e se il rapporto era già logoro il tecnico se ne
 * va *"per mancanza di visione comune"*, che è il motivo per cui un allenatore lascia davvero.
 *
 * Le due strade dichiarano il prezzo **prima** del clic, come ogni altro bivio della modalità:
 * scoprirlo dopo trasformerebbe una decisione in una trappola.
 */
export function FormationChangeDialog({
  coach,
  currentFormationId,
  request,
  harmony,
  resignRisk,
  onAnswer,
}: {
  coach: Coach;
  currentFormationId: string;
  request: { formationId: string; message: string };
  harmony: number;
  /** Vero se il no lo porterebbe alle dimissioni: allora il bottone lo dice in chiaro. */
  resignRisk: boolean;
  onAnswer: (accept: boolean) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] sm:rounded-3xl"
      >
        <header className="flex items-start gap-3 border-b border-[var(--surface-border)] p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/15 text-[var(--brand)]">
            <ClipboardList size={19} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
              Richiesta del mister
            </p>
            <p className="text-base leading-tight font-extrabold">Vuole cambiare sistema</p>
          </div>
        </header>

        <div className="flex flex-col gap-3 p-4">
          <p className="rounded-2xl bg-[var(--surface-raised)] p-3 text-[12px] leading-relaxed">
            «{request.message}»
            <span className="mt-1 block text-[11px] font-bold text-[var(--text-secondary)]">
              — {coach.name}
            </span>
          </p>

          <div className="flex items-center justify-center gap-3 rounded-2xl border border-[var(--surface-border)] p-3">
            <span className="text-center">
              <span className="block text-lg font-extrabold">{currentFormationId}</span>
              <span className="block text-[10px] text-[var(--text-secondary)]">adesso</span>
            </span>
            <span className="text-[var(--text-secondary)]">→</span>
            <span className="text-center">
              <span className="block text-lg font-extrabold text-[var(--brand)]">
                {request.formationId}
              </span>
              <span className="block text-[10px] text-[var(--text-secondary)]">la sua idea</span>
            </span>
          </div>

          {resignRisk && (
            <p className="flex items-start gap-2 rounded-xl bg-[#ff4d4d]/15 px-3 py-2 text-[11px] font-bold text-[#ff4d4d]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              La sintonia è già bassa ({harmony}): un rifiuto adesso lo porterebbe alle dimissioni.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--surface-border)] p-3">
          <button
            type="button"
            onClick={() => onAnswer(true)}
            className="min-h-12 w-full rounded-2xl bg-[var(--brand)] text-sm font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-[0.98]"
          >
            Va bene, si cambia
          </button>
          <button
            type="button"
            onClick={() => onAnswer(false)}
            className="min-h-12 w-full rounded-2xl border text-sm font-extrabold transition-transform active:scale-[0.98]"
            style={{
              borderColor: resignRisk ? "#ff4d4d66" : "var(--surface-border)",
              color: resignRisk ? "#ff4d4d" : "var(--text-secondary)",
            }}
          >
            {resignRisk ? "Rifiuto, anche a costo di perderlo" : "No, si continua così"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
