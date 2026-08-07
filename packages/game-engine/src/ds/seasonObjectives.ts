/**
 * **L'obiettivo stagionale, scelto dal DS.**
 *
 * Non lo fissa il club in automatico: lo dichiara l'utente, nel dossier di inizio stagione,
 * come una vera dichiarazione d'intenti. Serve a due cose che prima non esistevano:
 *  - dà finalmente un valore a `MoraleContext.positionsBelowTarget` (`events.ts`), un campo che
 *    esisteva nel tipo ed era già letto dalla deriva del morale, ma che nessun codice popolava
 *    mai — un aggancio pronto e mai collegato;
 *  - diventa un termine di paragone per il rapporto col mister a fine stagione: un obiettivo
 *    superato lo rende più esigente l'anno dopo, uno mancato più accomodante.
 */
import type { LeagueTeam } from "../season/leagueState";
import type { RosterEntry } from "./types";

export type ObjectiveLabel = "Salvezza" | "Parte bassa" | "Metà classifica" | "Europa" | "Titolo";

export interface ObjectiveTier {
  targetPosition: number;
  label: ObjectiveLabel;
}

/**
 * Soglie **fisse**, non più un offset di posizioni attorno a una stima: dichiarate
 * dall'utente, sostituiscono il placeholder a ±4 posizioni. In ordine dalla più ambiziosa alla
 * più prudente.
 */
export const OBJECTIVE_THRESHOLDS: readonly ObjectiveTier[] = [
  { targetPosition: 1, label: "Titolo" },
  { targetPosition: 4, label: "Europa" },
  { targetPosition: 9, label: "Metà classifica" },
  { targetPosition: 13, label: "Parte bassa" },
  { targetPosition: 17, label: "Salvezza" },
];

/**
 * Lo scaglione fisso di cui `position` ha bisogno per dirsi "in obiettivo": il più ambizioso
 * fra quelli ancora raggiunti (`position <= targetPosition`). Sotto Salvezza (18ª-20ª, già
 * zona retrocessione) resta comunque Salvezza — non c'è uno scaglione più permissivo.
 */
export function tierFor(position: number): ObjectiveTier {
  return (
    OBJECTIVE_THRESHOLDS.find((t) => position <= t.targetPosition) ??
    OBJECTIVE_THRESHOLDS[OBJECTIVE_THRESHOLDS.length - 1]!
  );
}

/**
 * Tre scelte (ambiziosa/realistica/conservativa) lungo la scala fissa, centrate sullo
 * scaglione di dove la rosa attuale si collocherebbe davvero — stimato confrontando la nostra
 * forza media con quella delle 19 avversarie, lo stesso segnale che il mercato usa per il
 * prezzo di un giocatore. Non più un offset numerico di posizioni: un salto di **scaglione**
 * lungo la scala fissa (realistica ± uno scaglione), quindi il `targetPosition` di ogni scelta
 * è sempre una delle 5 soglie dichiarate (17/13/9/4/1), mai un numero calcolato al volo. Agli
 * estremi (rosa già da titolo, o già la più debole) alcuni scaglioni coincidono e le scelte
 * proposte scendono a due invece di tre — non c'è un sesto scaglione da inventare.
 */
export function suggestObjectiveTiers(
  roster: readonly RosterEntry[],
  opponents: readonly LeagueTeam[],
  teamsInLeague: number,
): ObjectiveTier[] {
  const nostra = roster.length > 0 ? roster.reduce((s, e) => s + e.overall, 0) / roster.length : 70;
  // Quante avversarie sono più forti di noi: è la stima grezza di dove finiremmo.
  const piuForti = opponents.filter((o) => o.rating > nostra).length;
  const posizioneStimata = Math.max(1, Math.min(teamsInLeague, piuForti + 1));

  const indiceRealistico = OBJECTIVE_THRESHOLDS.findIndex((t) => posizioneStimata <= t.targetPosition);
  const r = indiceRealistico === -1 ? OBJECTIVE_THRESHOLDS.length - 1 : indiceRealistico;
  const ultimo = OBJECTIVE_THRESHOLDS.length - 1;
  const indiceAmbizioso = Math.max(0, r - 1);
  const indiceConservativo = Math.min(ultimo, r + 1);

  const indici = [...new Set([indiceAmbizioso, r, indiceConservativo])].sort((a, b) => a - b);
  return indici.map((i) => OBJECTIVE_THRESHOLDS[i]!);
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
