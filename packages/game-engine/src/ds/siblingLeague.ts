/**
 * **La lega gemella**: il campionato in cui *non* stiamo giocando.
 *
 * ## Il problema che risolve
 *
 * Fino a ieri la DS mode simulava un campionato solo, il nostro: gli altri esistevano come
 * rose, non come competizioni. Con promozioni e retrocessioni quella scorciatoia non regge
 * più — se la carriera prosegue in Serie B, qualcuno deve pur decidere **chi retrocede dalla
 * Serie A** per comporre il nostro campionato dell'anno dopo, e viceversa.
 *
 * ## Perché una stagione intera e non un sorteggio
 *
 * Estrarre tre nomi a caso sarebbe stato più semplice e più veloce. Ma il mondo di questa
 * modalità ha una gerarchia costruita con cura — Overall editoriali, prestigio, mercato IA che
 * muove i giocatori verso l'alto — e un sorteggio la butterebbe via: prima o poi il Milan
 * scenderebbe in B mentre una neopromossa vince lo scudetto, e la gerarchia smetterebbe di
 * significare qualcosa.
 *
 * Si simula quindi una stagione vera, con **lo stesso modello attacco-contro-difesa già
 * calibrato** per il nostro campionato. Il costo è trascurabile perché si paga **una volta
 * l'anno a fine stagione**, non a ogni clic: 380 partite sono qualche millisecondo.
 *
 * ## Riproducibile, come tutto il resto
 *
 * Il generatore è derivato dal seme di carriera più la stagione, quindi ricaricare un
 * salvataggio e rigiocare la stessa stagione produce le stesse promozioni. È la stessa regola
 * del calendario e del sorteggio di Corona (sez. 3.7.13).
 */
import {
  buildStandings,
  createLeagueState,
  simulateMatchday,
  totalRounds,
  type LeagueTeam,
  type StandingRow,
} from "../season/leagueState";

/**
 * Gioca una stagione intera fra squadre del computer e restituisce la classifica finale.
 *
 * `buildStandings` riceve `-1` come indice della squadra "seguita": in questo campionato non
 * giochiamo, quindi **nessuna riga va marcata come nostra**. Passare il default (0) marcherebbe
 * come "utente" la prima squadra dell'elenco, e quella bandierina finirebbe dritta nella UI
 * della classifica di Serie A vista da chi milita in Serie B.
 */
export function simulateSiblingSeason(
  teams: readonly LeagueTeam[],
  random: () => number,
): StandingRow[] {
  // Meno di due squadre non è un campionato: restituire una classifica vuota è più onesto che
  // inventarne una, e chi chiama sa già che senza classifica non ci sono movimenti.
  if (teams.length < 2) return [];

  /**
   * Il metodo del cerchio pretende un numero **pari** di squadre e `createLeagueState` lancia
   * se non lo è. Qui la lega gemella si compone dal database e dai movimenti degli anni
   * precedenti, quindi un numero dispari è possibile — basta un club in più promosso rispetto
   * ai retrocessi in uno scenario di test. Si scarta l'ultima della lista invece di far
   * fallire l'intera chiusura di stagione: è la stessa scelta di `fillLeague`, che taglia al
   * pari più vicino, e riguarda comunque un campionato che l'utente non gioca.
   */
  const pari = teams.length % 2 === 0 ? [...teams] : teams.slice(0, teams.length - 1);

  const state = createLeagueState(pari, random);
  const rounds = totalRounds(state);
  for (let round = 0; round < rounds; round++) {
    simulateMatchday(state, random, { followedIndex: -1 });
  }
  return buildStandings(state, -1);
}

/** Gli id della classifica, dal primo all'ultimo: quel che serve a `promotionAndRelegation`. */
export function orderedClubIds(standings: readonly StandingRow[]): string[] {
  return standings.map((row) => row.teamId);
}
