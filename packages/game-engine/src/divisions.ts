/**
 * **Le due divisioni italiane**: Serie A e Serie B, legate da promozioni e retrocessioni.
 *
 * Questo modulo tiene insieme due cose che è comodo non separare, perché rispondono alla
 * stessa domanda ("che rango ha questo campionato?") da due lati:
 *
 * 1. la **politica** — quali campionati sono di seconda divisione, e cosa questo comporta
 *    (niente Corona Continentale, niente Modalità Classica);
 * 2. la **meccanica** — chi sale e chi scende a fine stagione, e come si ricostruisce
 *    l'appartenenza di un club a una lega dopo N stagioni di movimenti.
 *
 * ## Perché la politica ragiona sui nomi e la meccanica sugli id
 *
 * Non è un'incoerenza. I nomi sono l'unica cosa stabile fra un database e l'altro: il seed
 * ricrea le leghe con `gen_random_uuid()`, quindi un id non sopravvive a un reimport, mentre
 * "Serie B" sì — ed è già la convenzione di `continentalSeed.ts`, che nomina i club per nome.
 * I movimenti di un salvataggio, invece, devono puntare a **quel** club preciso, e lì l'id è
 * l'unica chiave sicura (due club possono chiamarsi uguale in epoche diverse, sez. 2.1).
 *
 * ## Perché la coppia è dichiarata e non generalizzata
 *
 * Solo l'Italia ha una seconda divisione nel database. Modellare "ogni campionato ha una lega
 * sotto" significherebbe scrivere un sistema per un caso che non esiste, e poi doverlo tenere
 * in piedi. Quando arriverà una seconda seconda divisione, `DIVISION_PAIRS` diventerà un
 * elenco: è già scritto come tale.
 */

/** Una coppia di divisioni collegate da promozione/retrocessione. */
export interface DivisionPair {
  /** Nome del campionato di prima divisione, come in `leagues.name`. */
  top: string;
  /** Nome del campionato di seconda divisione. */
  second: string;
}

/** Le coppie di divisioni del database. Oggi una sola: l'Italia. */
export const DIVISION_PAIRS: DivisionPair[] = [{ top: "Serie A", second: "Serie B" }];

/**
 * Quante squadre salgono e scendono a fine stagione.
 *
 * Tre e tre, com'è nella realtà italiana per le retrocessioni. Le promozioni vere sono due
 * dirette più una dai playoff: qui sono le **prime tre secche**, scelta dichiarata dall'utente.
 * Il playoff resta un tabellone aggiungibile in seguito senza toccare questo modello — cambia
 * *chi* sale, non *quanti*.
 */
export const PROMOTION_SLOTS = 3;

/** Il campionato è una seconda divisione? */
export function isSecondDivision(leagueName: string): boolean {
  return DIVISION_PAIRS.some((pair) => pair.second === leagueName);
}

/* -------------------------------------------------------------------------- */
/* Leghe vetrina: nel database per i giocatori, non per le carriere            */
/* -------------------------------------------------------------------------- */

/**
 * **I campionati che esistono solo per popolare il mercato.**
 *
 * Richiesta dell'utente (2026-08-13): più squadre e più giocatori in database, *non giocabili*,
 * perché la ricerca di mercato smetta di proporre sempre gli stessi venti nomi.
 *
 * Non sono giocabili per tre ragioni concrete, non per pigrizia:
 *  1. **il calendario non regge** — Brasile e Argentina giocano ad anno solare, la MLS ha le
 *     conference, e il motore ha un formato solo (l'italiana a 18/20 squadre);
 *  2. **le loro coppe non esistono** nel gioco: niente Libertadores, niente AFC Champions
 *     League, e un club brasiliano nella Corona Continentale sarebbe assurdo;
 *  3. **non è ciò che è stato chiesto**: servono a fornire *giocatori*, non carriere.
 *
 * La politica sta qui e non altrove perché questo è già "il modulo che sa che rango ha un
 * campionato" (vedi `isSecondDivision`). E come per la Serie B, l'esclusione va **attiva e non
 * per omissione**: tre punti del codice leggono "tutte le leghe del database" — il selettore
 * del club, le iscritte alla Corona e il selettore della Modalità Classica — e senza questi
 * predicati si sarebbero autopopolati il giorno stesso dell'import.
 */
export const SHOWCASE_LEAGUES: readonly string[] = [
  "Primeira Liga",
  "Eredivisie",
  "Süper Lig",
  "Brasileirão",
  "Primera División",
  "Saudi Pro League",
  "Liga MX",
  "Major League Soccer",
];

/** Il campionato è una lega vetrina (in database per i giocatori, non per le carriere)? */
export function isShowcaseLeague(leagueName: string): boolean {
  return SHOWCASE_LEAGUES.includes(leagueName);
}

/**
 * Ci si può costruire una carriera dentro questo campionato?
 *
 * L'unico predicato che il selettore del club deve consultare. Le seconde divisioni **sì** (la
 * Serie B è una carriera legittima, anzi è la più dura); le leghe vetrina no.
 */
export function isPlayableLeague(leagueName: string): boolean {
  return !isShowcaseLeague(leagueName);
}

/** La coppia di cui questo campionato fa parte, se ne fa parte. */
export function divisionPairOf(leagueName: string): DivisionPair | undefined {
  return DIVISION_PAIRS.find((pair) => pair.top === leagueName || pair.second === leagueName);
}

/**
 * Il campionato **gemello** di questo: la Serie B per la Serie A e viceversa.
 *
 * È la lega di cui bisogna comunque conoscere la classifica anche quando non ci si gioca,
 * perché è da lì che arrivano le tre promosse (o le tre retrocesse) che compongono il proprio
 * campionato dell'anno dopo.
 */
export function siblingDivisionOf(leagueName: string): string | undefined {
  const pair = divisionPairOf(leagueName);
  if (!pair) return undefined;
  return pair.top === leagueName ? pair.second : pair.top;
}

/**
 * Il campionato dà accesso alla **Corona Continentale**?
 *
 * No per le seconde divisioni, decisione esplicita dell'utente. Si esclude il *campionato*,
 * non i singoli club: un club retrocesso non gioca la Corona nemmeno se l'anno prima si era
 * qualificato, e uno promosso vi accede solo col piazzamento della stagione successiva.
 *
 * Conseguenza voluta e da ricordare: **il triplete è irraggiungibile dalla Serie B**, dove i
 * trofei in palio sono due (campionato e Coppa Tricolore).
 */
export function isContinentalEligible(leagueName: string): boolean {
  return !isSecondDivision(leagueName) && !isShowcaseLeague(leagueName);
}

/**
 * Il campionato compare nella **Modalità Classica**?
 *
 * No per le seconde divisioni (decisione dell'utente): né come competizione selezionabile né
 * fra i giocatori del pool "tutto il database".
 *
 * **Va escluso attivamente, non per omissione**: la Classica costruisce il selettore dai
 * campionati che trova nel pool (`ClassicMode`), quindi senza questo filtro la Serie B
 * comparirebbe da sola il giorno stesso in cui entra nel database.
 */
export function isClassicEligible(leagueName: string): boolean {
  return !isSecondDivision(leagueName) && !isShowcaseLeague(leagueName);
}

/* -------------------------------------------------------------------------- */
/* Meccanica: chi sale, chi scende, e dove si trova un club dopo N stagioni    */
/* -------------------------------------------------------------------------- */

/**
 * I movimenti di una stagione fra due divisioni collegate.
 *
 * È **l'unica cosa che si salva** del sistema promozioni/retrocessioni: la composizione delle
 * due leghe si ricostruisce applicando i movimenti all'appartenenza originale del database,
 * esattamente come `aiWorld.ts` ricostruisce il mondo dai soli trasferimenti. Dieci stagioni
 * costano sessanta id, non quaranta club per dieci anni.
 */
export interface DivisionMove {
  season: number;
  /** Id dei club saliti dalla seconda divisione alla prima. */
  promoted: string[];
  /** Id dei club scesi dalla prima alla seconda. */
  relegated: string[];
}

/**
 * Dove si trova un club **adesso**, applicando i movimenti alla sua lega di partenza.
 *
 * I movimenti si applicano in ordine di stagione, e l'ultimo vince: un club può salire nella
 * stagione 2 e riscendere nella 5, e ciò che conta è dove si trova dopo l'ultimo movimento
 * che lo riguarda.
 */
export function leagueOfClub(
  clubId: string,
  baseLeagueId: string,
  moves: readonly DivisionMove[],
  topLeagueId: string,
  secondLeagueId: string,
): string {
  let league = baseLeagueId;
  for (const move of [...moves].sort((a, b) => a.season - b.season)) {
    if (move.promoted.includes(clubId)) league = topLeagueId;
    else if (move.relegated.includes(clubId)) league = secondLeagueId;
  }
  return league;
}

/**
 * Le tre promosse e le tre retrocesse di una classifica.
 *
 * Prende posizioni **già ordinate** (1º per primo): non riordina nulla, perché la classifica
 * è già stata calcolata con i suoi criteri (punti, differenza reti, gol fatti) e riordinarla
 * qui su un criterio diverso produrrebbe due verità.
 */
export function promotionAndRelegation(orderedClubIds: readonly string[]): {
  promoted: string[];
  relegated: string[];
} {
  return {
    promoted: orderedClubIds.slice(0, PROMOTION_SLOTS),
    relegated: orderedClubIds.slice(Math.max(0, orderedClubIds.length - PROMOTION_SLOTS)),
  };
}
