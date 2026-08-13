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
  const indiceAmbizioso = Math.max(0, r - 1);
  const indiceConservativo = Math.min(ultimo, r + 1);

  const indici = [...new Set([indiceAmbizioso, r, indiceConservativo])].sort((a, b) => a - b);
  return indici.map((i) => scala[i]!);
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
