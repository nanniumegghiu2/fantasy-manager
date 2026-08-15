import { useMemo } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import {
  contractFor,
  formatWage,
  playerFactsOf,
  renewalDemandOf,
  type CareerState,
  type CareerWorld,
} from "@app/game-engine";
import { ContractOfferForm, type ContractOffer } from "./ContractOfferForm";

/**
 * **Il tavolo del rinnovo.**
 *
 * Il contenuto è quello condiviso da tutte e tre le trattative contrattuali
 * (`ContractOfferForm`): rinnovo, acquisto e parametro zero negoziano lo stesso pacchetto e lo
 * fanno valutare dalla stessa funzione del motore. Qui resta solo il guscio — chi è, che
 * contratto ha oggi, come si chiude.
 */
export function RenewalModal({
  state,
  world,
  playerId,
  onRenew,
  onShiftFinances,
  onClose,
}: {
  state: CareerState;
  world: CareerWorld;
  playerId: string;
  onRenew: (offer: ContractOffer) => { ok: boolean; message: string };
  /** Riequilibra il bilancio senza uscire dalla trattativa. */
  onShiftFinances?: (share: number) => void;
  onClose: () => void;
}) {
  const facts = useMemo(() => playerFactsOf(state, world, playerId), [state, world, playerId]);
  const terms = useMemo(() => renewalDemandOf(state, world, playerId), [state, world, playerId]);
  const contratto = useMemo(() => contractFor(state, world, playerId), [state, world, playerId]);

  if (!facts || !terms) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 330, damping: 32 }}
        className="flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] sm:rounded-card"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--surface-border)] p-4">
          <div className="min-w-0">
            <p className="truncate text-body font-extrabold">{facts.name}</p>
            <p className="text-label text-[var(--text-secondary)]">
              {contratto
                ? `Scade nel ${contratto.until} · ${formatWage(contratto.wage)}`
                : "Senza contratto"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)]"
          >
            <X size={15} />
          </button>
        </header>

        <ContractOfferForm
          state={state}
          world={world}
          demand={terms}
          currentWage={facts.wage}
          submitLabel="Presenta la proposta"
          onSubmit={onRenew}
          onShiftFinances={onShiftFinances}
        />
      </motion.div>
    </motion.div>
  );
}
