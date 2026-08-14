/**
 * **L'obiettivo stagionale, scelto dal DS.**
 *
 * Non lo fissa il club in automatico: lo dichiara l'utente, nel dossier di inizio stagione,
 * come una vera dichiarazione d'intenti. Serve a tre cose:
 *  - dà finalmente un valore a `MoraleContext.positionsBelowTarget` (`events.ts`), un campo che
 *    esisteva nel tipo ed era già letto dalla deriva del morale, ma che nessun codice popolava
 *    mai — un aggancio pronto e mai collegato;
 *  - diventa un termine di paragone per il rapporto col mister a fine stagione: un obiettivo
 *    superato lo rende più esigente l'anno dopo, uno mancato più accomodante;
 *  - è il metro con cui **la dirigenza** giudica la stagione (`board.ts`): mancarlo apre la
 *    richiesta di esonero del mister.
 *
 * ## Due correzioni volute dall'utente, entrambe di sostanza
 *
 * 1. **La stima si fa sugli undici migliori, non sulla rosa intera.** Confrontare la media di
 *    venticinque giocatori (riserve comprese) con il `rating` delle avversarie — che è la media
 *    dei *loro* undici migliori — è un paragone fra due cose diverse, e sbaglia sempre nella
 *    stessa direzione: ci sottostima. È il difetto per cui alla squadra più forte della Serie A
 *    veniva proposta l'Europa come massima ambizione invece del titolo.
 * 2. **La scala si adatta al campionato.** In Serie B non esistono Europa e Titolo: esistono
 *    promozione, playoff e salvezza. Una scala sola per due divisioni proponeva obiettivi che
 *    in quel campionato non vogliono dire niente.
 */
import type { LeagueTeam } from "../season/leagueState";

export type ObjectiveLabel =
  /* — prima divisione — */
  | "Salvezza"
  | "Parte bassa"
  | "Metà classifica"
  | "Europa"
  | "Titolo"
  /* — seconda divisione — */
  | "Playoff"
  | "Promozione";

export interface ObjectiveTier {
  targetPosition: number;
  label: ObjectiveLabel;
}

/**
 * Soglie **fisse** della prima divisione, non un offset di posizioni attorno a una stima.
 * In ordine dalla più ambiziosa alla più prudente.
 */
export const OBJECTIVE_THRESHOLDS: readonly ObjectiveTier[] = [
  { targetPosition: 1, label: "Titolo" },
  { targetPosition: 4, label: "Europa" },
  { targetPosition: 9, label: "Metà classifica" },
  { targetPosition: 13, label: "Parte bassa" },
  { targetPosition: 17, label: "Salvezza" },
];

/**
 * Soglie della **seconda divisione**.
 *
 * Le prime tre salgono (`PROMOTION_SLOTS`, `divisions.ts`), quindi "Promozione" è la 3ª e non
 * la 1ª: vincere il campionato o salire terzi è, per un club di Serie B, lo stesso risultato.
 * Il "Playoff" è la fascia immediatamente sotto — l'ottava, la zona che nel calcio italiano dà
 * l'ultima chance di salire — e in fondo resta la salvezza, che qui è il pavimento vero: sotto
 * c'è la fine della carriera (`ending: "retrocessione"`).
 */
export const SECOND_DIVISION_THRESHOLDS: readonly ObjectiveTier[] = [
  { targetPosition: 3, label: "Promozione" },
  { targetPosition: 8, label: "Playoff" },
  { targetPosition: 12, label: "Metà classifica" },
  { targetPosition: 17, label: "Salvezza" },
];

/** La scala giusta per il campionato in cui si sta giocando. */
export function thresholdsFor(secondDivision = false): readonly ObjectiveTier[] {
  return secondDivision ? SECOND_DIVISION_THRESHOLDS : OBJECTIVE_THRESHOLDS;
}

/**
 * Lo scaglione fisso di cui `position` ha bisogno per dirsi "in obiettivo": il più ambizioso
 * fra quelli ancora raggiunti (`position <= targetPosition`). Sotto l'ultimo scaglione (già
 * zona retrocessione) resta comunque quello — non c'è uno scaglione più permissivo.
 */
export function tierFor(position: number, secondDivision = false): ObjectiveTier {
  const scala = thresholdsFor(secondDivision);
  return scala.find((t) => position <= t.targetPosition) ?? scala[scala.length - 1]!;
}

/**
 * Tre scelte (ambiziosa/realistica/conservativa) lungo la scala fissa, centrate sullo
 * scaglione di dove la rosa attuale si collocherebbe davvero.
 *
 * `ourRating` è la forza dei **nostri undici migliori**, la stessa grandezza con cui è costruito
 * il `rating` di ogni avversaria: il chiamante la calcola dalla formazione vera, così qui non
 * serve sapere nulla di rose, moduli o infortuni. Da questo confronto omogeneo esce la posizione
 * stimata, e da lì lo scaglione realistico più uno indietro e uno avanti.
 *
 * Agli estremi (rosa già da titolo, o già la più debole) alcuni scaglioni coincidono e le scelte
 * proposte scendono a due invece di tre — non c'è uno scaglione in più da inventare.
 */
export function suggestObjectiveTiers(
  ourRating: number,
  opponents: readonly LeagueTeam[],
  teamsInLeague: number,
  secondDivision = false,
): ObjectiveTier[] {
  const scala = thresholdsFor(secondDivision);
  // Quante avversarie sono più forti di noi: è la stima grezza di dove finiremmo.
  const piuForti = opponents.filter((o) => o.rating > ourRating).length;
  const posizioneStimata = Math.max(1, Math.min(teamsInLeague, piuForti + 1));

  const indiceRealistico = scala.findIndex((t) => posizioneStimata <= t.targetPosition);
  const r = indiceRealistico === -1 ? scala.length - 1 : indiceRealistico;
  const ultimo = scala.length - 1;

  /**
   * ⚠️ **La società si allinea alla propria forza** (richiesta esplicita dell'utente).
   *
   * Prima le tre scelte erano sempre simmetriche — una più ambiziosa, una realistica, una più
   * prudente — anche per la squadra più forte della nazione, a cui veniva quindi offerto di
   * dichiarare "metà classifica" e incassarne il giudizio benevolo a fine anno. Non è quello che
   * fa un presidente: chi ha la rosa migliore del campionato **deve vincere**, e non c'è nulla da
   * scegliere.
   *
   * La prudenza si guadagna scendendo di livello: chi è fra i primi può scegliere *se* puntare al
   * titolo o alla sua lotta, ma non può chiamarsi fuori.
   */
  const nessunoPiuForte = piuForti === 0;
  const fraIPrimi = piuForti <= 2;

  const indici = nessunoPiuForte
    ? [0] // la più forte della nazione ha un obiettivo solo: vincere
    : fraIPrimi
      ? [...new Set([Math.max(0, r - 1), r])]
      : [...new Set([Math.max(0, r - 1), r, Math.min(ultimo, r + 1)])];

  return indici.sort((a, b) => a - b).map((i) => scala[i]!);
}

/**
 * **Quanto vale, in mezzi, dichiarare un obiettivo ambizioso.**
 *
 * Richiesta dell'utente: *"più si è ambiziosi più il budget sarà alto"*. È ciò che trasforma la
 * dichiarazione d'intenti in una **decisione**: prima sceglierla non costava e non rendeva
 * nulla, quindi la scelta razionale era sempre la più prudente — si incassava il giudizio
 * benevolo della dirigenza senza rinunciare a niente.
 *
 * Ora il compromesso è esplicito e a doppio taglio: chi promette il titolo riceve i mezzi per
 * provarci, ma verrà giudicato su quello (`board.ts`), e mancarlo apre la richiesta di esonero
 * del mister. Chi promette poco tiene la dirigenza tranquilla e va sul mercato con meno.
 *
 * Il moltiplicatore dipende dalla **posizione nella scala**, non dall'etichetta: così vale
 * identico nelle due divisioni senza casi speciali — la promozione in Serie B è ambiziosa quanto
 * il titolo in Serie A, ed è giusto che paghi uguale.
 */
export function objectiveBudgetMultiplier(tier: ObjectiveTier, secondDivision = false): number {
  const scala = thresholdsFor(secondDivision);
  const indice = scala.findIndex((t) => t.label === tier.label);
  if (indice < 0) return 1;

  // Dalla più ambiziosa (indice 0) alla più prudente: +35%, +18%, pari, −12%, −20%.
  const moltiplicatori = [1.35, 1.18, 1, 0.88, 0.8];
  return moltiplicatori[Math.min(indice, moltiplicatori.length - 1)]!;
}

/**
 * Quante posizioni siamo sotto l'obiettivo dichiarato: positivo = peggio delle attese. Alimenta
 * `MoraleContext.positionsBelowTarget`.
 */
export function positionsBelowTarget(currentPosition: number, targetPosition: number): number {
  return currentPosition - targetPosition;
}

/** L'obiettivo è stato raggiunto a fine stagione? */
export function objectiveMet(finalPosition: number, targetPosition: number): boolean {
  return finalPosition <= targetPosition;
}

/* -------------------------------------------------------------------------- */
/* Gli obiettivi di coppa                                                      */
/* -------------------------------------------------------------------------- */

/**
 * **Le coppe entrano fra gli obiettivi dichiarati** (richiesta dell'utente).
 *
 * Non come modificatore del traguardo di campionato ma come **obiettivo a sé**: si dichiara
 * dove si vuole arrivare in Europa e dove in Coppa Tricolore, e la dirigenza li giudica tutti.
 * È la lettura più ricca — mancarne uno solo pesa meno che mancarli tutti — ed è quella scelta
 * esplicitamente.
 *
 * Le fasce sono le stesse per le due competizioni, ma il **peso** no: vedi `OBJECTIVE_WEIGHTS`.
 */
export type CupObjectiveLabel = "Vincerla" | "Finale" | "Semifinale" | "Quarti" | "Partecipare";

export interface CupObjectiveTier {
  label: CupObjectiveLabel;
  /**
   * Quanti turni prima della vittoria ci si accontenta: 0 = alzare il trofeo, 1 = arrivare in
   * finale, e così via. È un numero e non un'etichetta di fase perché i due tabelloni non hanno
   * la stessa forma — la Corona ha un girone, la Tricolore sei turni secchi — e confrontare le
   * fasi per nome richiederebbe una tabella per competizione.
   */
  roundsFromWin: number;
}

export const CUP_OBJECTIVE_TIERS: readonly CupObjectiveTier[] = [
  { label: "Vincerla", roundsFromWin: 0 },
  { label: "Finale", roundsFromWin: 1 },
  { label: "Semifinale", roundsFromWin: 2 },
  { label: "Quarti", roundsFromWin: 3 },
  { label: "Partecipare", roundsFromWin: 4 },
];

/**
 * **Quanto pesa ciascun trofeo nel giudizio di fine anno**, nell'ordine dichiarato dall'utente:
 * Corona, campionato, Coppa Tricolore.
 *
 * I pesi contano solo l'uno rispetto all'altro. La Corona vale più del campionato perché è la
 * competizione più difficile del gioco — sedici squadre, tutte fra le migliori di cinque
 * campionati — mentre la Tricolore, con quaranta iscritte e sorteggio libero, è la più
 * accessibile: centrarla non riscatta un'annata, mancarla non la rovina.
 */
export const OBJECTIVE_WEIGHTS = {
  continental: 1.3,
  league: 1,
  national: 0.6,
} as const;

/**
 * Le fasce proponibili in coppa, tarate su quanto si è forti rispetto alle altre iscritte.
 *
 * Stessa regola del campionato (`suggestObjectiveTiers`): chi è la squadra da battere non può
 * dichiarare "partecipare" e incassare il giudizio benevolo. Chi entra da outsider, invece, non
 * si vede chiedere il trofeo.
 */
export function suggestCupObjectiveTiers(rank: number, entrants: number): CupObjectiveTier[] {
  const quota = entrants > 0 ? rank / entrants : 0.5;
  const indiceRealistico = quota <= 0.12 ? 0 : quota <= 0.3 ? 1 : quota <= 0.55 ? 2 : 3;

  // La favorita ha una sola strada, come in campionato; le altre scelgono fra due fasce vicine.
  if (indiceRealistico === 0) return [CUP_OBJECTIVE_TIERS[0]!];
  return [CUP_OBJECTIVE_TIERS[indiceRealistico - 1]!, CUP_OBJECTIVE_TIERS[indiceRealistico]!];
}

/** L'obiettivo di coppa è stato raggiunto? `roundsFromWin` più basso = risultato migliore. */
export function cupObjectiveMet(reachedRoundsFromWin: number, tier: CupObjectiveTier): boolean {
  return reachedRoundsFromWin <= tier.roundsFromWin;
}

/**
 * Il giudizio complessivo sull'annata, 0-1, pesato sui tre fronti.
 *
 * Serve alla dirigenza (`board.ts`): con obiettivi multipli "raggiunto sì/no" non basta più —
 * un'annata in cui si vince la Corona e si manca il quarto posto non è un fallimento, e una in
 * cui si perde tutto tranne la Coppa Tricolore non è un successo. Il peso di ciascun fronte è
 * quello dichiarato dall'utente.
 *
 * I fronti non dichiarati (nessuna coppa giocata) semplicemente non entrano nel conto, invece di
 * contare come mancati: non si giudica qualcuno per una competizione a cui non era iscritto.
 */
export function seasonVerdictScore(esiti: {
  league?: boolean;
  continental?: boolean;
  national?: boolean;
}): number {
  let peso = 0;
  let punti = 0;
  for (const chiave of ["continental", "league", "national"] as const) {
    const esito = esiti[chiave];
    if (esito === undefined) continue;
    peso += OBJECTIVE_WEIGHTS[chiave];
    if (esito) punti += OBJECTIVE_WEIGHTS[chiave];
  }
  return peso > 0 ? punti / peso : 1;
}
