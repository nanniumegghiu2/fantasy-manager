import { motion } from "framer-motion";
import { Crown, Shield, Star, Target } from "lucide-react";
import type { ObjectiveTier } from "@app/game-engine";

/**
 * **L'obiettivo stagionale, dichiarato dal DS.**
 *
 * Non lo fissa il club in automatico: tre fasce, centrate su dove la rosa attuale si
 * collocherebbe davvero (`seasonObjectiveChoices`, career.ts) — sceglierne una è una vera
 * dichiarazione d'intenti, non un dettaglio. Pesa sul morale durante la stagione
 * (`positionsBelowTarget`) e sul rapporto col mister a fine anno: superarlo lo rende più
 * esigente, mancarlo più accomodante.
 */

const ICONA: Record<ObjectiveTier["label"], typeof Target> = {
  Salvezza: Shield,
  "Metà classifica": Target,
  Europa: Star,
  Titolo: Crown,
};

export function SeasonObjectiveScreen({
  season,
  choices,
  onChoose,
}: {
  season: number;
  choices: ObjectiveTier[];
  onChoose: (tier: ObjectiveTier) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.92, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)]"
      >
        <div className="flex flex-col items-center gap-1.5 px-6 py-6 text-center" style={{ backgroundColor: "var(--brand)18" }}>
          <p className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            Stagione {season}
          </p>
          <h2 className="text-xl leading-tight font-extrabold">Qual è l'obiettivo?</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            Una dichiarazione d'intenti alla società: pesa sul morale della rosa durante l'anno
            e sul rapporto col mister a fine stagione.
          </p>
        </div>

        <div className="flex flex-col gap-2 p-4">
          {choices.map((tier) => {
            const Icona = ICONA[tier.label];
            return (
              <button
                key={tier.targetPosition}
                type="button"
                onClick={() => onChoose(tier)}
                className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3.5 text-left transition-transform active:scale-[0.98] hover:border-[var(--brand)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/15 text-[var(--brand)]">
                  <Icona size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">{tier.label}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Obiettivo: entro la {tier.targetPosition}ª posizione
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
