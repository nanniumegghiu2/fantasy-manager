/**
 * Il **budget di mercato** di una carriera: quanto si ha da spendere a inizio stagione.
 *
 * Due regole, entrambe chieste dall'utente:
 *  - il budget iniziale nasce dall'**Overall medio della rosa** — chi eredita una grande
 *    squadra ha grandi mezzi, chi ne eredita una piccola deve inventarsi qualcosa;
 *  - ogni anno cresce o cala **in base a dove si è arrivati** in campionato, con il cammino
 *    in coppa a fare da moltiplicatore.
 *
 * La crescita è **esponenziale sull'Overall**, non lineare, per la stessa ragione per cui lo
 * è il valore di mercato (`marketValue.ts`): fra una rosa da 72 e una da 80 non c'è una
 * differenza di ricchezza dell'11%, ce n'è una di categoria.
 *
 * Il sistema Livelli del profilo (CLAUDE.md sez. 5.2) **non c'entra nulla** con questo budget
 * ed è bene metterlo per iscritto: sono due economie separate, e collegarle renderebbe la DS
 * mode più facile a chi ha giocato tanto alla Modalità Classica, il che non ha senso.
 */

/**
 * Budget di una rosa esattamente da 70 di media, in euro. Placeholder di bilanciamento
 * **dichiarato**: il criterio di taratura è che il club più ricco possa permettersi **un**
 * fuoriclasse a stagione, non tre.
 */
export const BASE_BUDGET = 18_000_000;

/** Quanti punti di Overall medio servono per moltiplicare il budget per `e`. */
export const BUDGET_SCALE = 7.5;

/**
 * Budget minimo, qualunque sia il livello della rosa.
 *
 * Serve a rendere **giocabile** la piccola squadra, ed è tarato misurando
 * (`pnpm calibrate-piccola`), non a intuito. La prima versione dava a un club da 68 di media
 * circa 2 milioni: con i prezzi reali del pool — un 72 costa 5,6 milioni, un 78 ne costa 16 —
 * non bastava per **nessun** acquisto che migliorasse l'undici, e la retrocessione risultava al
 * 95-100% qualunque cosa si facesse sul mercato. Non era una sfida, era un destino.
 *
 * La misura dice che per salvarsi servono circa quattro punti sull'undici titolare, cioè
 * sostituire quattro o cinque titolari deboli con giocatori di poco migliori: un'operazione da
 * venti-venticinque milioni contando le cessioni del fondo rosa. Il pavimento è tarato lì. Non
 * regala una grande squadra — con questi mezzi non si prende un fuoriclasse — ma rende la
 * salvezza il risultato di un buon mercato invece che di un miracolo.
 */
export const MIN_BUDGET = 20_000_000;

/**
 * Difficoltà della carriera. Agisce **solo sul budget di mercato**, che nella DS mode è la
 * leva che conta: chi ha più mezzi può correggere gli errori, chi ne ha meno paga ogni scelta.
 */
export type DsDifficulty = "facile" | "normale" | "difficile";

/**
 * Moltiplicatore del budget per difficoltà.
 *
 * "Difficile" è lo stato di riferimento (nessun aiuto), come chiesto dall'utente; "normale" dà
 * il 30% in più e "facile" il 70%. La leva è il budget e non la forza delle avversarie perché
 * in una modalità da direttore sportivo il mercato **è** la partita: rendere più deboli gli
 * altri falsificherebbe il campionato, dare più mezzi allarga solo le tue possibilità.
 */
export const DIFFICULTY_BUDGET_MULTIPLIER: Record<DsDifficulty, number> = {
  facile: 1.7,
  normale: 1.3,
  difficile: 1,
};

/**
 * Tetto massimo al budget base iniziale derivato dall'Overall della rosa per difficoltà.
 * Evita che rose d'élite (OVR > 82) producano budget base illimitati solo in virtù dei propri campioni.
 */
export const DIFFICULTY_BASE_BUDGET_CAP: Record<DsDifficulty, number> = {
  facile: 135_000_000,
  normale: 85_000_000,
  difficile: 60_000_000,
};

/**
 * Tetto massimo al moltiplicatore cumulativo dei premi di fine stagione (Piazzamento × Coppa × Miglioramento).
 */
export const DIFFICULTY_REWARD_MULTIPLIER_CAP: Record<DsDifficulty, number> = {
  facile: 2.1,
  normale: 1.7,
  difficile: 1.45,
};

/**
 * Overall medio di soglia oltre il quale la crescita del budget base diventa logaritmica/smorzata
 * a rendimenti decrescenti invece che pura esponenziale.
 */
export const OVR_DAMPING_THRESHOLD = 76;

/** Budget iniziale a partire dall'Overall medio della rosa. */
export function initialBudget(averageOverall: number, difficulty: DsDifficulty = "difficile"): number {
  let raw: number;
  if (averageOverall <= OVR_DAMPING_THRESHOLD) {
    raw = BASE_BUDGET * Math.exp((averageOverall - 70) / BUDGET_SCALE);
  } else {
    // Oltre il 76 di media, crescita logaritmica a rendimenti decrescenti
    const baseAtThreshold = BASE_BUDGET * Math.exp((OVR_DAMPING_THRESHOLD - 70) / BUDGET_SCALE);
    const excess = averageOverall - OVR_DAMPING_THRESHOLD;
    raw = baseAtThreshold + 25_000_000 * Math.log1p(excess / 4);
  }
  const multiplied = Math.max(raw, MIN_BUDGET) * DIFFICULTY_BUDGET_MULTIPLIER[difficulty];
  const capped = Math.min(multiplied, DIFFICULTY_BASE_BUDGET_CAP[difficulty]);
  return roundToStep(capped);
}

/**
 * Moltiplicatore per il piazzamento in campionato.
 *
 * Gli ultimi tre posti tagliano il budget del 30%: nella DS mode la retrocessione **chiude la
 * carriera**, quindi questo malus riguarda solo chi si salva per un soffio — ma serve lo
 * stesso, perché rende la lotta salvezza una spirale da cui bisogna uscire in fretta.
 */
export function positionMultiplier(position: number, _teamsInLeague?: number): number {
  if (position === 1) return 1.6;
  if (position <= 4) return 1.35;
  if (position <= 7) return 1.15;
  if (position <= 12) return 1.0;
  // Chi si salva per un soffio non viene punito: nella DS mode la retrocessione chiude già la
  // carriera, e tagliare il budget a chi è appena sopravvissuto trasformerebbe la salvezza in
  // una spirale da cui non si esce più — l'opposto della scalata che la modalità deve rendere
  // possibile a una piccola squadra.
  return 0.95;
}

/**
 * Premio per il **salto di qualità**: quanto si è migliorati rispetto all'anno prima.
 *
 * È la leva che rende possibile la scalata di una piccola. Senza, il budget dipende solo dal
 * livello assoluto della rosa, quindi chi parte in basso resta in basso: un mercato brillante
 * non produce mezzi per il mercato successivo, e le dieci stagioni diventano dieci ripetizioni
 * della prima. Con il premio, chiudere sopra le aspettative finanzia il passo dopo.
 */
export function improvementMultiplier(position: number, previousPosition: number | undefined): number {
  if (previousPosition === undefined) return 1;
  const salto = previousPosition - position;
  if (salto >= 8) return 1.45;
  if (salto >= 4) return 1.25;
  if (salto >= 1) return 1.1;
  return 1;
}

/** Cammino in Corona Continentale: premia arrivare in fondo, non solo qualificarsi. */
export function cupMultiplier(outcome: string | undefined): number {
  switch (outcome) {
    case "vittoria":
      return 1.25;
    case "finale":
      return 1.15;
    case "semifinale":
      return 1.1;
    case "quarti":
      return 1.08;
    case "girone":
      return 1.03;
    default:
      return 1;
  }
}

/**
 * Quanta parte del budget non speso si porta all'anno dopo.
 *
 * Solo il 30%: accumulare per due stagioni e poi fare il colpo deve restare possibile, ma
 * costoso. Riportare tutto renderebbe ottimale non spendere mai, che è il contrario di ciò
 * che rende viva una carriera.
 */
export const CARRY_OVER_SHARE = 0.3;

export interface SeasonBudgetInput {
  /** Overall medio della rosa **attuale**, dopo il ciclo di vita di fine stagione. */
  averageOverall: number;
  position: number;
  teamsInLeague: number;
  cupOutcome?: string;
  /** Budget rimasto non speso nella stagione appena conclusa. */
  leftover: number;
  /** Piazzamento della stagione precedente, per premiare il miglioramento. */
  previousPosition?: number;
  difficulty?: DsDifficulty;
}

/** Il budget della stagione successiva. */
export function nextSeasonBudget({
  averageOverall,
  position,
  teamsInLeague,
  cupOutcome,
  leftover,
  previousPosition,
  difficulty = "difficile",
}: SeasonBudgetInput): number {
  const rawRewardMultiplier =
    positionMultiplier(position, teamsInLeague) *
    cupMultiplier(cupOutcome) *
    improvementMultiplier(position, previousPosition);
  const cappedRewardMultiplier = Math.min(
    rawRewardMultiplier,
    DIFFICULTY_REWARD_MULTIPLIER_CAP[difficulty],
  );
  const base = initialBudget(averageOverall, difficulty) * cappedRewardMultiplier;
  return roundToStep(base + Math.max(0, leftover) * CARRY_OVER_SHARE);
}

/** Come i valori di mercato, si arrotonda a multipli di 50.000. */
function roundToStep(value: number, step = 50_000): number {
  return Math.max(0, Math.round(value / step) * step);
}
