/**
 * Base di partenza dell'Overall derivata da **fatti anagrafici e di contesto** (CLAUDE.md
 * sez. 2.2): età, prestigio del club, del campionato e della nazionalità.
 *
 * A cosa serve: `applySeasonAdjustment` ha bisogno di un valore di partenza da correggere
 * col rendimento, e senza una base ogni giocatore parte da zero informazione. Questa è la
 * base — costruita da dati che sono fatti (dove gioca, in che campionato, che età ha), non
 * dal giudizio di qualcun altro.
 *
 * Il ragionamento è quello di uno scout che non ha ancora visto giocare nessuno: un
 * ventisettenne titolare in un top club di un campionato importante è, *a priori*, più forte
 * di un diciannovenne in una squadra di bassa classifica. Non è un verdetto: è la
 * previsione migliore possibile prima di guardare le prestazioni.
 *
 * ⚠️ **Limite intrinseco, da conoscere**: basandosi sul club, questa base dà lo stesso
 * valore a tutti i compagni di squadra — è lo stesso "effetto maglia" che avevamo eliminato
 * dall'Overall v1. Qui è accettabile *solo* perché è un punto di partenza che
 * `applySeasonAdjustment` poi differenzia con le prestazioni individuali. Diventa un
 * problema se lo si usa da solo: la differenziazione vera arriva dai minuti giocati, ed è
 * per questo che raccogliere `minutes` resta la priorità.
 */

/**
 * Banda in cui vive una base da solo contesto — **volutamente più stretta** della scala
 * completa 60-99.
 *
 * Il primo tentativo usava tutta la scala e produceva Premier League e Liga a 77-99 contro
 * una Serie A editoriale a 65-89: ogni giocatore inglese avrebbe surclassato chiunque, e il
 * draft misto sarebbe diventato "prendi solo stranieri". Il motivo è concettuale prima che
 * numerico: 99 vuol dire "il più forte al mondo nel suo ruolo", e sapere che uno gioca nel
 * Real Madrid a 27 anni non lo giustifica — giustifica "molto forte", non "il migliore".
 * Gli estremi della scala se li deve guadagnare una valutazione individuale (editoriale o
 * da statistiche), non un prior.
 */
const PRIOR_FLOOR = 62;
const PRIOR_CEILING = 92;

/**
 * Pesi delle componenti (sommano a 1).
 *
 * Il **club domina nettamente**: è di gran lunga il segnale più informativo su un giocatore
 * che non hai mai visto, ed è l'unico che distingue le squadre DENTRO lo stesso campionato.
 * Con pesi più equilibrati (club .55 / lega .22) l'intera Premier si sollevava in blocco —
 * media 84.9 contro la Serie A a 73.2 — perché la quota garantita da campionato e
 * nazionalità alzava anche l'ultimo rincalzo del Burnley. Il campionato conta ancora
 * (i Big 5 non sono equivalenti e la Premier è il torneo più forte) ma deve spostare la
 * media di qualche punto, non ribaltare il confronto.
 */
const WEIGHTS = { club: 0.75, league: 0.12, nation: 0.04, age: 0.09 };

/** Età di picco e ampiezza della curva: prima si cresce, dopo si cala, con decadimento morbido. */
const PEAK_AGE = 27;
const AGE_SPREAD = 7;

export interface ContextPriorInput {
  /** Età alla data di riferimento della stagione. Assente = si assume l'età di picco. */
  age?: number | null;
  /** `clubs.prestige_tier` 1-5. */
  clubPrestige?: number | null;
  /** `leagues.prestige_tier` 1-5. */
  leaguePrestige?: number | null;
  /** Tier di prestigio della nazionalità 1-5 (stessa scala usata dal valore di mercato). */
  nationPrestige?: number | null;
}

function tierScore(tier: number | null | undefined): number {
  const value = tier ?? 3;
  return Math.min(Math.max((value - 1) / 4, 0), 1);
}

/**
 * Curva d'età a campana: 1 al picco, scende simmetricamente ai lati ma con una coda più
 * lunga verso il basso (un ventenne ha ancora margine, un trentacinquenne no).
 */
function ageScore(age: number | null | undefined): number {
  if (age == null) return 1;
  const distance = age - PEAK_AGE;
  const spread = distance < 0 ? AGE_SPREAD * 1.3 : AGE_SPREAD;
  return Math.max(0, 1 - (distance / spread) ** 2);
}

/** Base 62-92 da soli fatti di contesto, prima di guardare qualunque prestazione. */
export function computeContextPrior(input: ContextPriorInput): number {
  const score =
    WEIGHTS.club * tierScore(input.clubPrestige) +
    WEIGHTS.league * tierScore(input.leaguePrestige) +
    WEIGHTS.nation * tierScore(input.nationPrestige) +
    WEIGHTS.age * ageScore(input.age);

  return Math.round(PRIOR_FLOOR + (PRIOR_CEILING - PRIOR_FLOOR) * score);
}

/** Età compiuta a una data di riferimento, da una data di nascita. */
export function ageAt(dateOfBirth: Date, reference: Date): number {
  let age = reference.getFullYear() - dateOfBirth.getFullYear();
  const beforeBirthday =
    reference.getMonth() < dateOfBirth.getMonth() ||
    (reference.getMonth() === dateOfBirth.getMonth() && reference.getDate() < dateOfBirth.getDate());
  return beforeBirthday ? age - 1 : age;
}
