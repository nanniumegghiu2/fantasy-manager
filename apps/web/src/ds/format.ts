/** Formattazioni condivise dalle schermate della DS Mode. */

/** Cifre di mercato leggibili a colpo d'occhio: 12,5M€ invece di 12.500.000 €. */
export function euro(value: number): string {
  if (value >= 1_000_000) {
    const milioni = value / 1_000_000;
    return `${milioni >= 100 ? Math.round(milioni) : milioni.toFixed(1).replace(".0", "")}M€`;
  }
  if (value >= 1000) return `${Math.round(value / 1000)}k€`;
  return `${value}€`;
}

/** Il morale come parola, non come numero: "in rotta" dice più di "18". */
export function moraleLabel(morale: number): { label: string; color: string } {
  if (morale >= 80) return { label: "Entusiasta", color: "#3ddc6b" };
  if (morale >= 60) return { label: "Sereno", color: "#8fd4a4" };
  if (morale >= 40) return { label: "Nervoso", color: "#ffab2e" };
  if (morale >= 20) return { label: "Scontento", color: "#ff8a3d" };
  return { label: "In rotta", color: "#ff4d4d" };
}

/** Esito di una partita, per colorare la riga. */
export type Outcome = "V" | "N" | "P";

export function outcomeOf(goalsFor: number, goalsAgainst: number): Outcome {
  if (goalsFor > goalsAgainst) return "V";
  if (goalsFor === goalsAgainst) return "N";
  return "P";
}

export const OUTCOME_COLOR: Record<Outcome, string> = {
  V: "#3ddc6b",
  N: "#ffab2e",
  P: "#ff4d4d",
};

/** Posizione come ordinale italiano: "1º", "3ª" non serve, le posizioni sono maschili (posto). */
export function ordinale(position: number): string {
  return `${position}º`;
}

/** Nome leggibile della fase di coppa. */
export const CUP_STAGE_LABEL: Record<string, string> = {
  girone: "Girone",
  quarti: "Quarti di finale",
  semifinali: "Semifinale",
  finale: "Finale",
};
