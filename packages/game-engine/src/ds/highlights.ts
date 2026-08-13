/**
 * **Quali partite meritano di essere guardate**, e la sequenza dei rigori.
 *
 * La cronaca vera e propria vive ora in `matchSim.ts`, che costruisce un flusso di gioco
 * continuo invece di un pugno di clip preconfezionate. Qui resta ciò che riguarda la *scelta*
 * della partita e l'unico esito già deciso altrove che va soltanto raccontato: i rigori.
 *
 * L'invariante è la stessa di sempre e non si tocca: niente di quello che sta in questo file o
 * in `matchSim.ts` decide un risultato. Guardare una partita o saltarla dà lo stesso esito.
 */
import { derivedRandom } from "../random";

/* -------------------------------------------------------------------------- */
/* Quali partite meritano di essere guardate                                    */
/* -------------------------------------------------------------------------- */

export interface KeyMatchInput {
  /** Fase di coppa, se la partita è di Corona. */
  cupStage?: string;
  /**
   * Fase di Coppa Tricolore, se la partita è di coppa nazionale.
   *
   * Serve un campo distinto da `cupStage` perché le due coppe non hanno lo stesso tabellone: la
   * Corona comincia con un girone e va in eliminazione dai quarti, la Tricolore parte da un
   * preliminare a quaranta squadre. Con un campo solo, un sedicesimo di Tricolore sarebbe
   * risultato "eliminazione diretta" quanto una semifinale — e si finirebbe per proporre di
   * guardare mezza dozzina di partite contro squadre di terza fascia.
   */
  nationalCupStage?: string;
  /** Giornata di campionato giocata, se ce n'è una. */
  leagueRound?: number;
  totalRounds: number;
  /** La nostra posizione in classifica dopo questa giornata. */
  position?: number;
  /** Punti di distacco dal primo (0 se siamo noi). */
  gapFromFirst?: number;
  /** La posizione dell'avversaria di giornata: senza, non si può giudicare uno scontro diretto. */
  opponentPosition?: number;
}

/** Quante squadre contano come "vertice" per uno scontro diretto. */
const TOP_TIER = 4;

/**
 * Le fasi finali della Coppa Tricolore: dai quarti in poi.
 *
 * La soglia è la stessa della Corona — "quando restano otto squadre" — ma va dichiarata a parte
 * perché nella Tricolore ci sono due turni prima (preliminare e sedicesimi) che nella Corona non
 * esistono affatto.
 */
const NATIONAL_CUP_KEY_STAGES = new Set(["quarti", "semifinale", "finale"]);

/** Etichette leggibili per l'invito a guardare una partita di Coppa Tricolore. */
const NATIONAL_CUP_LABEL: Record<string, string> = {
  quarti: "Quarti di Coppa Tricolore",
  semifinale: "Semifinale di Coppa Tricolore",
  finale: "Finale di Coppa Tricolore",
};

/**
 * Questa partita merita di essere vista?
 *
 * Quattro casi, deliberatamente pochi — allargare l'elenco significherebbe chiedere all'utente
 * di scegliere ogni settimana, e la domanda smetterebbe di valere qualcosa:
 *  - **il tabellone di Corona** (quarti in su): ogni partita è un'eliminazione;
 *  - **le fasi finali di Coppa Tricolore** (quarti, semifinale, finale): stessa ragione, ma
 *    non i turni di prima — una coppa da quaranta squadre comincia con partite che non
 *    decidono niente, e proporle tutte svuoterebbe l'invito;
 *  - **scontro diretto**: noi e l'avversaria siamo entrambi fra le prime quattro, a
 *    prescindere dalla giornata — è la partita che pesa di più nella corsa al vertice, non
 *    solo quella dell'ultimo mese;
 *  - **partita scudetto**: siamo 1º/2º, o comunque a uno svantaggio ancora colmabile coi punti
 *    rimasti in palio, e mancano al massimo due giornate (placeholder dichiarato — la stessa
 *    finestra "ultime giornate", solo più stretta delle quattro di prima).
 */
export function isKeyMatch({
  cupStage,
  nationalCupStage,
  leagueRound,
  totalRounds,
  position,
  gapFromFirst,
  opponentPosition,
}: KeyMatchInput): boolean {
  if (cupStage && cupStage !== "girone") return true;
  if (nationalCupStage && NATIONAL_CUP_KEY_STAGES.has(nationalCupStage)) return true;
  if (leagueRound === undefined || position === undefined) return false;

  const scontroDiretto = position <= TOP_TIER && opponentPosition !== undefined && opponentPosition <= TOP_TIER;
  if (scontroDiretto) return true;

  const mancano = totalRounds - (leagueRound + 1);
  const puntiInPalio = (mancano + 1) * 3;
  const inCorsaPerIlTitolo = position <= 2 || (gapFromFirst ?? 99) <= puntiInPalio;
  return mancano <= 2 && inCorsaPerIlTitolo;
}

/** Perché questa partita conta: la UI lo mostra nell'invito a guardarla. */
export function keyMatchReason(input: KeyMatchInput): string {
  if (input.cupStage && input.cupStage !== "girone") {
    return input.cupStage === "finale"
      ? "Finale di Corona Continentale"
      : `Corona: ${input.cupStage}, si gioca tutto in una partita`;
  }
  if (input.nationalCupStage && NATIONAL_CUP_KEY_STAGES.has(input.nationalCupStage)) {
    return NATIONAL_CUP_LABEL[input.nationalCupStage] ?? "Coppa Tricolore: si gioca tutto in una partita";
  }
  if (
    input.position !== undefined &&
    input.position <= TOP_TIER &&
    input.opponentPosition !== undefined &&
    input.opponentPosition <= TOP_TIER
  ) {
    return "Scontro diretto per il vertice";
  }
  return "Volata per il titolo: ogni punto pesa";
}

/* -------------------------------------------------------------------------- */
/* Rigori: la sequenza si racconta, non si decide                             */
/* -------------------------------------------------------------------------- */

export interface ShootoutKick {
  order: number;
  team: "for" | "against";
  scored: boolean;
}

/**
 * La sequenza dei tiri dal dischetto, coerente con l'esito **già deciso** (`season/cup.ts`,
 * 50/50 dichiarato — sempre 5 a 4, mai una vera sequenza di tiri). Stessa regola del motore
 * 2D: qui non si decide chi vince, si racconta chi ha già vinto. Chi vince fa tutti e cinque i
 * rigori, chi perde ne sbaglia esattamente uno — il seme decide solo **quale** dei cinque, così
 * due rivincite non si assomigliano mai nei dettagli.
 */
export function buildShootout(weWon: boolean, seed: string): ShootoutKick[] {
  const random = derivedRandom(seed, "shootout");
  const missIndexFor = weWon ? -1 : Math.floor(random() * 5);
  const missIndexAgainst = weWon ? Math.floor(random() * 5) : -1;
  const kicks: ShootoutKick[] = [];
  for (let i = 0; i < 5; i++) {
    kicks.push({ order: kicks.length + 1, team: "for", scored: i !== missIndexFor });
    kicks.push({ order: kicks.length + 1, team: "against", scored: i !== missIndexAgainst });
  }
  return kicks;
}
