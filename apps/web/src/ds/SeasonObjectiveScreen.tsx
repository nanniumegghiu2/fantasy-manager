import { motion } from "framer-motion";
import { ArrowUpCircle, Crown, Shield, ShieldHalf, Star, Swords, Target, Users, Wallet } from "lucide-react";
import { formatEuro, objectiveBudgetMultiplier, type ObjectiveTier } from "@app/game-engine";

/**
 * **L'obiettivo stagionale, dichiarato dal DS.**
 *
 * Non lo fissa il club in automatico: tre fasce, centrate su dove la rosa attuale si
 * collocherebbe davvero (`seasonObjectiveChoices`, career.ts) — sceglierne una è una vera
 * dichiarazione d'intenti, non un dettaglio. Pesa sul morale durante la stagione
 * (`positionsBelowTarget`) e sul rapporto col mister a fine anno: superarlo lo rende più
 * esigente, mancarlo più accomodante.
 */

/**
 * Le fasce sono **due scale**, una per divisione (`seasonObjectives.ts`): in Serie B non
 * esistono Europa e Titolo, esistono promozione e playoff. Il motore sceglie la scala giusta,
 * qui si dà un'icona a ciascuna etichetta possibile.
 */
const ICONA: Record<ObjectiveTier["label"], typeof Target> = {
  Salvezza: Shield,
  "Parte bassa": ShieldHalf,
  "Metà classifica": Target,
  Europa: Star,
  Titolo: Crown,
  Playoff: Swords,
  Promozione: ArrowUpCircle,
};

export function SeasonObjectiveScreen({
  season,
  choices,
  finances,
  secondDivision = false,
  onChoose,
}: {
  season: number;
  choices: ObjectiveTier[];
  /**
   * **I mezzi che la società mette a disposizione**, dichiarati qui e non solo nel pannello
   * Finanze.
   *
   * È il momento narrativo giusto — è chi dà i soldi a dire quanti sono — e soprattutto è
   * l'unica schermata che compare *ogni* stagione prima di qualunque decisione. Senza, il
   * fatturato non veniva mai detto in chiaro: si vedeva solo un budget che cala.
   */
  finances?: { revenue: number; wageBudget: number; transferBudget: number };
  /** La scala degli obiettivi cambia fra le due divisioni, e con essa i moltiplicatori. */
  secondDivision?: boolean;
  onChoose: (tier: ObjectiveTier) => void;
}) {
  const budgetMoltiplicatore = (tier: ObjectiveTier) => objectiveBudgetMultiplier(tier, secondDivision);
  // Verde se l ambizione porta mezzi in piu, rame se ne toglie: il colore dice il verso prima
  // ancora che si legga la cifra.
  const budgetColore = (tier: ObjectiveTier) => {
    const m = budgetMoltiplicatore(tier);
    return m > 1 ? "#3ddc6b" : m < 1 ? "#b07a5e" : "var(--text-secondary)";
  };

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

        {finances && (
          <div className="border-y border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-3">
            <p className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
              La società mette a disposizione
            </p>
            <p className="mt-0.5 text-lg leading-none font-extrabold tabular-nums">
              {formatEuro(finances.revenue)}
            </p>
            <p className="mt-1.5 flex items-center gap-3 text-[11px] font-semibold text-[var(--text-secondary)]">
              <span className="flex items-center gap-1">
                <Wallet size={11} /> {formatEuro(finances.transferBudget)} mercato
              </span>
              <span className="flex items-center gap-1">
                <Users size={11} /> {formatEuro(finances.wageBudget)} ingaggi
              </span>
            </p>
            <p className="mt-1 text-[10px] leading-snug text-[var(--text-secondary)]">
              La divisione la decidi tu, dal pannello Finanze o da qualunque tavolo contrattuale.
            </p>
          </div>
        )}

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
                {/* **I mezzi che quell'ambizione porta con sé.** Senza questo numero la scelta
                    sarebbe al buio, e la regola "più ambizioso, più budget" resterebbe una
                    meccanica nascosta invece di essere il compromesso su cui si decide. */}
                {finances && (
                  <span
                    className="shrink-0 rounded-lg px-2 py-1 text-right text-[10px] font-extrabold tabular-nums"
                    style={{
                      backgroundColor: `${budgetColore(tier)}1f`,
                      color: budgetColore(tier),
                    }}
                  >
                    {formatEuro(Math.round(finances.revenue * budgetMoltiplicatore(tier)))}
                    <span className="block text-[9px] font-bold opacity-80">fatturato</span>
                  </span>
                )}
              </button>
            );
          })}
          {choices.length === 1 && (
            <p className="px-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
              Con questa rosa la società non ammette alternative: sei la squadra da battere, e
              l'unico risultato che conta è vincere.
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
