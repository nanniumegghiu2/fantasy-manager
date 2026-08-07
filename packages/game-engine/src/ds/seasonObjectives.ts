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

export type ObjectiveLabel = "Salvezza" | "Metà classifica" | "Europa" | "Titolo";

export interface ObjectiveTier {
  targetPosition: number;
  label: ObjectiveLabel;
}

/** Etichetta per fascia di classifica, sullo stesso principio già usato altrove nel motore. */
function labelFor(position: number, teamsInLeague: number): ObjectiveLabel {
  if (position <= 1) return "Titolo";
  if (position <= 4) return "Europa";
  if (position <= teamsInLeague - 3) return "Metà classifica";
  return "Salvezza";
}

/**
 * Tre fasce (conservativa/realistica/ambiziosa), centrate su dove la rosa attuale si
 * collocherebbe davvero — stimato confrontando la nostra forza media con quella delle 19
 * avversarie, lo stesso segnale che il mercato usa per il prezzo di un giocatore.
 *
 * Placeholder di bilanciamento dichiarato (±4 posizioni), tarabile come `AI_CLUB_COHESION`.
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

  const scarto = 4;
  const posizioni = [
    Math.min(teamsInLeague, posizioneStimata + scarto),
    posizioneStimata,
    Math.max(1, posizioneStimata - scarto),
  ];
  // Tre fasce distinte: se lo scarto le fa collassare (rosa già al vertice o già ultima), si
  // allarga finché non sono tre posizioni davvero diverse — un obiettivo non può ripetersi.
  const uniche = [...new Set(posizioni)];
  while (uniche.length < 3 && uniche.length > 0) {
    const ultimo = uniche[uniche.length - 1]!;
    const prossimo = ultimo < teamsInLeague ? ultimo + 1 : Math.max(1, uniche[0]! - 1);
    if (!uniche.includes(prossimo)) uniche.push(prossimo);
    else break;
  }
  return uniche
    .sort((a, b) => a - b)
    .map((targetPosition) => ({ targetPosition, label: labelFor(targetPosition, teamsInLeague) }));
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
