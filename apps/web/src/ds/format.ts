/** Formattazioni condivise dalle schermate della DS Mode. */

/**
 * Le particelle che **fanno parte del cognome** e non vanno lasciate indietro.
 *
 * ⚠️ Trovata guardando il risultato nel browser, non ipotizzata: prendendo l'ultima parola,
 * «Virgil van Dijk» diventava **«Dijk»**. Non è una semplificazione imperfetta, è un nome
 * sbagliato — e in un gioco di calcio è il genere di errore che si nota subito. Stesso problema
 * per «De Bruyne», «dos Santos», «van der Sar», «Di Lorenzo».
 */
const PARTICELLE = new Set([
  "van", "von", "de", "del", "della", "dello", "dei", "degli", "di", "da", "dal", "dalla",
  "der", "den", "dos", "das", "do", "du", "la", "le", "el", "al", "bin", "ibn", "mc", "mac",
  "ter", "te", "op", "in", "'t", "st", "san", "santa",
]);

/**
 * Il nome come si legge in una lista: **cognome soltanto**.
 *
 * Il database porta i nomi legali completi — «Joshua Walter Kimmich», «Alejandro Grimaldo
 * García», «Jonathan Michael Burkardt» — e nelle liste finivano tagliati a metà (misurati 110px
 * disponibili su 134 necessari). La funzione esisteva già, scritta **due volte** e in nessuno
 * dei due posti in cui serviva di più: `cognome()` in `MatchTheatre.tsx` e `shortName()` in
 * `classic/Pitch.tsx`. Qui è una sola, e la usano tutte le liste.
 *
 * ⚠️ Il nome intero resta nel **dettaglio**, dove c'è spazio: il cognome serve a scorrere una
 * lista, non a identificare una persona in un contratto.
 *
 * Resta un limite dichiarato: i doppi cognomi spagnoli e portoghesi («Grimaldo García») danno
 * solo l'ultimo, che è spesso quello *meno* usato. Non è automatizzabile senza sapere la
 * nazionalità di ogni nome, e sbagliare la scelta fra due cognomi veri è molto meno grave che
 * tagliarne uno a metà — che era il difetto di partenza.
 */
export function cognome(nome: string): string {
  const parti = nome.trim().split(/\s+/);
  if (parti.length <= 1) return nome;

  // Si risale finché la parola precedente è una particella: «van der Sar» resta intero.
  let inizio = parti.length - 1;
  while (inizio > 1 && PARTICELLE.has(parti[inizio - 1]!.toLowerCase().replace(/[.']$/, ""))) {
    inizio -= 1;
  }
  return parti.slice(inizio).join(" ");
}

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

/** Nome leggibile della fase di Coppa Tricolore: sei turni, tutti a eliminazione. */
export const NATIONAL_CUP_STAGE_LABEL: Record<string, string> = {
  preliminare: "Turno preliminare",
  sedicesimi: "Sedicesimi di finale",
  ottavi: "Ottavi di finale",
  quarti: "Quarti di finale",
  semifinale: "Semifinale",
  finale: "Finale",
};

/**
 * I colori delle due competizioni, in un posto solo.
 *
 * Servono a **distinguerle a colpo d'occhio**: prima l'unico accento di coppa era l'oro della
 * Corona, quindi una serata di Tricolore sarebbe risultata indistinguibile da una europea. Il
 * rame è quello del marchio (CLAUDE.md § 8.1), non un colore nuovo inventato per l'occasione.
 */
export const COMPETITION_ACCENT = {
  corona: "#f5c518",
  tricolore: "#b07a5e",
} as const;

export type Competition = keyof typeof COMPETITION_ACCENT;
