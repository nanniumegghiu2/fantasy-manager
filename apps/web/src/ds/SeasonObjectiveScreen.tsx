import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpCircle, Crown, Shield, ShieldHalf, Star, Swords, Target, Users, Wallet } from "lucide-react";
import {
  formatEuro,
  objectiveBudgetMultiplier,
  type CupObjectiveTier,
  type ObjectiveTier,
} from "@app/game-engine";

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
  cups,
  agreed,
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
  /**
   * Gli obiettivi di **coppa**, quando si partecipa: si dichiarano accanto a quello di
   * campionato e la dirigenza li giudica tutti, con pesi diversi (Corona > campionato >
   * Tricolore). Assenti = non si gioca quella competizione, e non se ne parla.
   */
  cups?: { key: "continental" | "national"; label: string; tiers: CupObjectiveTier[] }[];
  /**
   * L'obiettivo di campionato **già concordato** al colloquio con la società.
   *
   * Quando c'è, questa schermata non lo chiede più: lo mostra e si limita alle coppe. È la
   * conseguenza di aver spostato la contrattazione dov'è il suo posto — al tavolo con chi mette
   * i soldi (`BoardMeetingScreen`) — e senza questa distinzione il DS sceglierebbe due volte la
   * stessa cosa, la seconda senza nessuno di fronte.
   */
  agreed?: { label: string; targetPosition: number };
  onChoose: (tier: ObjectiveTier, cupTiers: Record<string, CupObjectiveTier>) => void;
}) {
  /** Le scelte di coppa gia fatte: si dichiarano tutte insieme, poi si conferma. */
  const [sceltoCoppa, setSceltoCoppa] = useState<Record<string, CupObjectiveTier>>({});

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
      {/* ⚠️ **Il riquadro non scorreva.** Non aveva né altezza massima né `overflow`: con le
          finanze, due coppe da dichiarare e tre fasce, il contenuto supera i 740px di un
          telefono piccolo e le ultime scelte finivano fuori schermo **senza modo di
          raggiungerle** — cioè la stessa classe di vicolo cieco del cancello del mister.

          Corretto anche `backgroundColor: "var(--brand)18"`: non è CSS valido (un `var()` non
          si concatena con l'alfa), quindi quella fascia non ha mai avuto lo sfondo che
          l'autore intendeva. `color-mix` è la forma che funziona davvero. */}
      <motion.div
        initial={{ scale: 0.92, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="flex max-h-[88svh] w-full max-w-sm flex-col overflow-y-auto rounded-card border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--elev-overlay)]"
      >
        <div
          className="flex flex-col items-center gap-1.5 px-5 py-5 text-center"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand) 12%, transparent)" }}
        >
          <p className="text-micro text-[var(--text-secondary)] uppercase">Stagione {season}</p>
          <h2 className="text-display leading-tight">
            {agreed ? "E nelle coppe?" : "Qual è l'obiettivo?"}
          </h2>
          <p className="text-label leading-relaxed text-[var(--text-secondary)] text-balance">
            {agreed
              ? `In campionato con la società avete concordato «${agreed.label}», entro la ${agreed.targetPosition}ª. Restano da dichiarare le coppe.`
              : "Una dichiarazione d'intenti alla società: pesa sul morale della rosa durante l'anno e sul rapporto col mister a fine stagione."}
          </p>
        </div>

        {finances && (
          <div className="border-y border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-3">
            <p className="text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
              La società mette a disposizione
            </p>
            <p className="mt-0.5 text-title leading-none font-extrabold tabular-nums">
              {formatEuro(finances.revenue)}
            </p>
            <p className="mt-1.5 flex items-center gap-3 text-label font-semibold text-[var(--text-secondary)]">
              <span className="flex items-center gap-1">
                <Wallet size={11} /> {formatEuro(finances.transferBudget)} mercato
              </span>
              <span className="flex items-center gap-1">
                <Users size={11} /> {formatEuro(finances.wageBudget)} ingaggi
              </span>
            </p>
            <p className="mt-1 text-label leading-snug text-[var(--text-secondary)]">
              La divisione la decidi tu, dal pannello Finanze o da qualunque tavolo contrattuale.
            </p>
          </div>
        )}

        {/**
         * **Le coppe si dichiarano prima del campionato**, e non è un dettaglio d'ordine: sono
         * scelte che si fanno *insieme* — puntare al titolo e alla Corona nello stesso anno è
         * un'ambizione diversa da puntare al solo titolo — quindi devono stare sotto gli occhi
         * mentre si decide, non in una schermata successiva.
         *
         * Compaiono solo per le competizioni a cui si partecipa davvero: chiedere un traguardo
         * in una coppa che non si gioca sarebbe una domanda senza risposta.
         */}
        {cups && cups.length > 0 && (
          <div className="flex flex-col gap-3 border-b border-[var(--surface-border)] px-4 py-3">
            {cups.map((coppa) => (
              <div key={coppa.key}>
                <p className="text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                  {coppa.label}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {coppa.tiers.map((tier) => {
                    const attivo = sceltoCoppa[coppa.key]?.label === tier.label;
                    return (
                      <button
                        key={tier.label}
                        type="button"
                        aria-pressed={attivo}
                        onClick={() =>
                          setSceltoCoppa((prev) => ({ ...prev, [coppa.key]: tier }))
                        }
                        className={`min-h-tap flex-1 rounded-control px-3 text-label font-bold whitespace-nowrap transition-colors ${
                          attivo
                            ? "bg-[var(--accent)] text-[var(--accent-contrast)]"
                            : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {tier.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-label leading-snug text-[var(--text-secondary)]">
              La dirigenza giudica tutti gli obiettivi dichiarati, ma non allo stesso modo: la
              Corona pesa più del campionato, il campionato più della Coppa Tricolore.
            </p>
          </div>
        )}

        {/* Concordato al tavolo con la società: qui resta solo da confermare le coppe, e il
            primario dice l'azione invece di ripresentare una scelta già fatta. */}
        {agreed && (
          <div className="p-4">
            <button
              type="button"
              onClick={() =>
                onChoose({ label: agreed.label as ObjectiveTier["label"], targetPosition: agreed.targetPosition }, sceltoCoppa)
              }
              className="min-h-tap w-full rounded-card bg-[var(--brand)] px-4 text-body font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-[0.98]"
            >
              {cups && cups.length > 0 ? "Dichiara gli obiettivi di coppa" : "Prosegui"}
            </button>
          </div>
        )}

        <div className={`flex flex-col gap-2 p-4 ${agreed ? "hidden" : ""}`}>
          {choices.map((tier) => {
            const Icona = ICONA[tier.label];
            return (
              <button
                key={tier.targetPosition}
                type="button"
                onClick={() => onChoose(tier, sceltoCoppa)}
                className="flex items-center gap-3 rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3.5 text-left transition-transform active:scale-[0.98] hover:border-[var(--brand)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/15 text-[var(--brand)]">
                  <Icona size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-extrabold">{tier.label}</p>
                  <p className="text-label text-[var(--text-secondary)]">
                    {tier.targetPosition === 1
                      ? "Vincere, e basta"
                      : `Chiudere entro la ${tier.targetPosition}ª`}
                  </p>
                </div>
                {/* **I mezzi che quell'ambizione porta con sé.** Senza questo numero la scelta
                    sarebbe al buio, e la regola "più ambizioso, più budget" resterebbe una
                    meccanica nascosta invece di essere il compromesso su cui si decide. */}
                {finances && (
                  <span
                    className="shrink-0 rounded-control px-2 py-1 text-right"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${budgetColore(tier)} 14%, transparent)`,
                      color: budgetColore(tier),
                    }}
                  >
                    <span className="num block text-body font-extrabold">
                      {formatEuro(Math.round(finances.revenue * budgetMoltiplicatore(tier)))}
                    </span>
                    <span className="block text-micro tracking-normal opacity-80">fatturato</span>
                  </span>
                )}
              </button>
            );
          })}
          {choices.length === 1 && (
            <p className="px-1 text-label leading-relaxed text-[var(--text-secondary)]">
              Con questa rosa la società non ammette alternative: sei la squadra da battere, e
              l'unico risultato che conta è vincere.
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
