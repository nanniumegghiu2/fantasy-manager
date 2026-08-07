import type { LineState } from "./engineHelpers";

/**
 * Linguaggio visivo condiviso da tutte le schermate del gioco rapido, per non ripetere
 * (e far divergere) gli stessi colori in ogni componente.
 *
 * Le tinte sono deliberatamente poche e con ruoli distinti: **rosso/arancione/verde** solo
 * per le linee di intesa (sez. CLAUDE.md 3.4), **oro/rame** solo per la qualità di un
 * giocatore. Nessun colore per reparto sul campo: l'erba è già verde e le linee usano
 * tre colori, aggiungerne altri quattro renderebbe il campo illeggibile.
 */

/** Colore "led" delle linee di intesa: spento finché manca un giocatore, poi rosso/arancione/verde. */
export const CHEMISTRY_LINE_COLOR: Record<LineState, string> = {
  off: "rgba(255,255,255,0.28)",
  red: "#ff4d4d",
  orange: "#ffab2e",
  green: "#3ddc6b",
};

export const CHEMISTRY_LABEL: Record<Exclude<LineState, "off">, string> = {
  green: "Ottima",
  orange: "Discreta",
  red: "Scarsa",
};

interface OverallTier {
  /** Colore del cerchio dell'Overall sul campo (sfondo pieno). */
  dot: string;
  /** Colore del testo dentro il cerchio. */
  dotText: string;
  /** Classi per il badge Overall nelle liste/card. */
  badge: string;
}

const TIER_ELITE: OverallTier = {
  dot: "#f5c518",
  dotText: "#3a2c00",
  badge: "bg-[#f5c518] text-[#3a2c00]",
};
const TIER_HIGH: OverallTier = {
  dot: "#cba89e",
  dotText: "#2c1a15",
  badge: "bg-copper-300 text-[#2c1a15]",
};
const TIER_BASE: OverallTier = {
  dot: "#e8eeec",
  dotText: "#1a2624",
  badge: "bg-[var(--surface-raised)] text-[var(--text-primary)]",
};

/** Fascia di qualità di un Overall (60-99): oro per i fuoriclasse, rame per i buoni, neutro per il resto. */
export function overallTier(overall: number): OverallTier {
  if (overall >= 88) return TIER_ELITE;
  if (overall >= 80) return TIER_HIGH;
  return TIER_BASE;
}
