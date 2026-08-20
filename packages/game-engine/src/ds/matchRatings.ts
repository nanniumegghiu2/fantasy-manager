/**
 * **Il voto di una partita.**
 *
 * ⚠️ Richiesta dell'utente: *"voglio vedere le medie voto per capire i giocatori in crescita"*, e
 * la scelta dichiarata è che **contino**: il voto diventa l'ingrediente che mancava a
 * `applySeasonAdjustment` (`overallV2.ts`), dove `statLineOf` diceva letteralmente *"media voto e
 * clean sheet non esistono in DS mode"*. Da qui in poi esistono.
 *
 * ## Perché sta qui e non dentro la partita
 *
 * `simulateMatch` e `simulateMatchday` sono **condivise con la Modalità Classica** e protette da
 * un characterization test che congela l'esatta sequenza del generatore casuale — su cui poggia
 * la calibrazione del 38-0-0. Toccarle per aggiungere i voti significherebbe rifare quella
 * calibrazione. Il voto si deriva quindi **qui**, nello strato DS, da ciò che la partita ha già
 * prodotto, con un flusso casuale separato: zero impatto sul consumo del generatore.
 *
 * ## Le regole, che sono quelle che un lettore riconosce
 *
 * Si parte da una base per ruolo e la si muove con i fatti della partita: com'è finita, quanti
 * gol si sono fatti e subiti, quanto ha inciso il singolo, e quanto era forte l'avversaria. Un
 * portiere che tiene la porta inviolata prende molto; un attaccante che non segna in una
 * sconfitta prende poco; chi la decide prende il voto della giornata.
 */
import type { Department } from "@app/shared-types";

/** I due estremi della scala: sotto e sopra non si va, come in ogni pagella. */
export const MIN_RATING = 4;
export const MAX_RATING = 10;

export interface MatchRatingInput {
  department: Department;
  /** Ha giocato? Chi non scende in campo non prende voto (≠ prendere insufficienza). */
  played: boolean;
  goals: number;
  assists: number;
  /** Gol della propria squadra e dell'avversaria in quella partita. */
  teamGoals: number;
  opponentGoals: number;
  /** Forza dell'avversaria (media Overall dell'undici) e della propria: pesa il contesto. */
  ownStrength: number;
  opponentStrength: number;
  /** Rumore 0-1 già seedato dal chiamante: due partite identiche non danno la stessa pagella. */
  noise: number;
}

/**
 * Il voto di questo giocatore in questa partita, 4.0-10.0 con un decimale.
 *
 * Funzione pura: entrano i fatti, esce un numero. È testabile senza montare una carriera, ed è
 * il motivo per cui vive nel motore invece che nella schermata che la mostra.
 */
export function matchRating(input: MatchRatingInput): number | null {
  if (!input.played) return null;

  const {
    department,
    goals,
    assists,
    teamGoals,
    opponentGoals,
    ownStrength,
    opponentStrength,
    noise,
  } = input;

  // La base: un 6 pieno, il voto di chi ha fatto il suo senza lasciare traccia.
  let voto = 6;

  /**
   * **L'esito pesa, ma non allo stesso modo per tutti.** Un portiere e un difensore vivono del
   * risultato difensivo, un attaccante di quello offensivo: è la ragione per cui in una goleada
   * subita il portiere prende 4,5 e la punta che ha segnato prende 7.
   */
  const esito = teamGoals - opponentGoals;
  const pesoEsito: Record<Department, number> = { POR: 0.18, DIF: 0.22, CC: 0.16, ATT: 0.1 };
  voto += Math.max(-1.6, Math.min(1.2, esito * pesoEsito[department] * 2));

  // Il fronte difensivo: la porta inviolata è il risultato del reparto arretrato.
  if (department === "POR" || department === "DIF") {
    if (opponentGoals === 0) voto += 0.9;
    else if (opponentGoals >= 3) voto -= 0.9;
    else if (opponentGoals >= 2) voto -= 0.4;
  }

  // Il fronte offensivo: chi segna decide, chi serve accompagna.
  voto += goals * (department === "ATT" ? 0.95 : 1.15);
  voto += assists * 0.55;

  /**
   * **Il contesto**: fare un punto in casa della più forte non è come farlo con l'ultima. Lo
   * scarto di forza sposta poco — mezzo voto al massimo — perché resta una pagella individuale,
   * non un giudizio sulla squadra.
   */
  const scarto = (opponentStrength - ownStrength) / 20;
  voto += Math.max(-0.5, Math.min(0.5, scarto * (esito >= 0 ? 0.5 : -0.3)));

  // Il rumore: ±0,35. Senza, due partite identiche darebbero pagelle identiche, e la media voto
  // diventerebbe una funzione dei gol invece che un giudizio.
  voto += (noise - 0.5) * 0.7;

  return Math.round(Math.max(MIN_RATING, Math.min(MAX_RATING, voto)) * 10) / 10;
}

/**
 * **Chi ha servito l'assist di questo gol.**
 *
 * Non esiste nel `MatchResult` — la partita produce marcatori, non assistenti — quindi si
 * attribuisce qui, pescando fra i compagni con lo stesso peso di ruolo usato per i gol. Due
 * regole sole: **non ci si serve da soli**, e **non tutti i gol hanno un assist** (una rete su
 * quattro nasce da una giocata individuale o da una palla inattiva).
 */
export function pickAssistId(
  scorerId: string,
  candidates: readonly { id: string; weight: number }[],
  random: () => number,
): string | null {
  if (random() < 0.26) return null;
  const pool = candidates.filter((c) => c.id !== scorerId && c.weight > 0);
  const totale = pool.reduce((s, c) => s + c.weight, 0);
  if (pool.length === 0 || totale <= 0) return null;
  let roll = random() * totale;
  for (const c of pool) {
    roll -= c.weight;
    if (roll <= 0) return c.id;
  }
  return pool[pool.length - 1]!.id;
}

/**
 * Il peso di ciascun ruolo nel servire un assist.
 *
 * Diverso da quello dei gol: i centrocampisti servono più di quanto segnino, i difensori quasi
 * mai, i portieri praticamente mai. È la stessa forma di `scorerPoolOf`, ribaltata sul fronte
 * della rifinitura.
 */
export const ASSIST_WEIGHT: Record<Department, number> = { ATT: 2, CC: 3, DIF: 0.8, POR: 0.05 };
