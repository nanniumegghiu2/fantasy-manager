import { motion } from "framer-motion";
import { AlertTriangle, Building2, ShieldCheck, UserMinus } from "lucide-react";
import { boardConfidenceLabel, type BoardSackDemand, type BoardState } from "@app/game-engine";

/**
 * **La dirigenza chiede la testa del mister.**
 *
 * Non è un avviso da chiudere: è un bivio, e per questo non ha la X. Le due strade dichiarano il
 * loro prezzo in chiaro — assecondare libera la panchina e ricompone il rapporto col presidente,
 * difendere lega il mister a te ma consuma fiducia. Su un **ultimatum** il costo raddoppia, e la
 * schermata lo dice prima del clic invece di scoprirlo dopo: è la stessa regola che vale per le
 * mosse dello Spogliatoio.
 */
export function BoardDemandDialog({
  demand,
  board,
  onChoose,
}: {
  demand: BoardSackDemand;
  board: BoardState;
  onChoose: (scelta: "esonera" | "difendi") => void;
}) {
  const fiducia = boardConfidenceLabel(board.confidence);
  const ultimatum = demand.severity === "ultimatum";

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
        className="flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] sm:rounded-3xl"
      >
        <header
          className="flex items-start gap-3 border-b p-4"
          style={{
            borderColor: ultimatum ? "#ff4d4d55" : "var(--surface-border)",
            backgroundColor: ultimatum ? "#ff4d4d12" : "transparent",
          }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: ultimatum ? "#ff4d4d22" : "var(--surface-raised)" }}
          >
            <Building2 size={17} style={{ color: ultimatum ? "#ff4d4d" : "var(--brand)" }} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
              {ultimatum ? "Ultimatum della dirigenza" : "Convocazione in società"}
            </p>
            <p className="text-base leading-tight font-extrabold">
              {ultimatum ? "Questa volta non è una richiesta" : "La società vuole un cambio in panchina"}
            </p>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <p className="rounded-2xl bg-[var(--surface-raised)] p-3 text-[12px] leading-relaxed">
            «Avevamo dichiarato <strong>{demand.objectiveLabel}</strong> — entro la{" "}
            {demand.targetPosition}ª — e abbiamo chiuso <strong>{demand.finalPosition}º</strong>.{" "}
            {ultimatum
              ? `L'anno scorso hai difeso ${demand.coachName} e ti abbiamo dato retta. Adesso basta: o cambia lui, o cambiamo noi.`
              : `Per noi ${demand.coachName} ha finito il suo ciclo. Decidi tu, ma sappi come la pensiamo.»`}
          </p>

          <div className="flex items-center justify-between rounded-2xl border border-[var(--surface-border)] p-3">
            <span className="text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
              Fiducia in te
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${board.confidence}%`, backgroundColor: fiducia.tone }}
                />
              </span>
              <span className="text-[11px] font-extrabold" style={{ color: fiducia.tone }}>
                {fiducia.label}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => onChoose("esonera")}
            className="flex w-full items-start gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3 text-left transition-transform active:scale-98"
          >
            <UserMinus size={16} className="mt-0.5 shrink-0 text-[var(--brand)]" />
            <span className="min-w-0">
              <span className="block text-sm font-extrabold">Esonera {demand.coachName}</span>
              <span className="block text-[11px] leading-snug text-[var(--text-secondary)]">
                La dirigenza torna dalla tua parte. Dovrai scegliere un nuovo allenatore e pagarne
                l'ingaggio — e il modulo cambierà con lui.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onChoose("difendi")}
            className="flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-transform active:scale-98"
            style={{
              borderColor: ultimatum ? "#ff4d4d55" : "var(--surface-border)",
              backgroundColor: ultimatum ? "#ff4d4d10" : "var(--surface-raised)",
            }}
          >
            <ShieldCheck size={16} className="mt-0.5 shrink-0" style={{ color: ultimatum ? "#ff4d4d" : "#ffc107" }} />
            <span className="min-w-0">
              <span className="block text-sm font-extrabold">Difendilo davanti al presidente</span>
              <span className="block text-[11px] leading-snug text-[var(--text-secondary)]">
                Lui non lo dimenticherà: la sintonia sale. Il presidente nemmeno: la fiducia in te
                scende {ultimatum ? "del doppio" : "parecchio"}.
              </span>
            </span>
          </button>

          {ultimatum && (
            <p className="flex items-start gap-2 rounded-xl bg-[#ff4d4d]/15 px-3 py-2 text-[11px] font-bold text-[#ff4d4d]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Difenderlo un'altra volta può costarti l'incarico: la carriera finirebbe qui.
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
