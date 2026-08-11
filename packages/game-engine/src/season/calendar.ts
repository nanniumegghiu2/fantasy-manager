/**
 * Il **calendario di una stagione** di carriera: quando si gioca il campionato, quando la
 * Corona Continentale, quando si apre il mercato.
 *
 * L'unità di avanzamento non è la giornata ma la **settimana**: un clic dell'utente fa
 * giocare la giornata di campionato e, nelle settimane di coppa, anche il turno
 * infrasettimanale. Con 34-38 settimane a stagione e un paio di secondi l'una, una stagione
 * si completa in poco più di un minuto — il ritmo chiesto dall'utente.
 *
 * I turni di coppa sono collocati a **frazioni** della stagione, non a numeri di giornata
 * fissi: i campionati non hanno tutti la stessa lunghezza (38 giornate a 20 squadre, 34 a 18)
 * e una tabella di numeri andrebbe riscritta per ciascuno. Con le frazioni la stessa regola
 * vale ovunque.
 */
import { GROUP_ROUNDS } from "./cup";
import { NATIONAL_CUP_STAGES, type NationalCupStage } from "./nationalCup";

export type WeekSlot =
  | { kind: "campionato"; round: number }
  | { kind: "coppa"; stage: "girone" | "quarti" | "semifinali" | "finale"; round: number }
  | { kind: "coppa_nazionale"; stage: NationalCupStage; round: number }
  | { kind: "mercato"; window: "riparazione" };

export interface SeasonWeek {
  index: number;
  slots: WeekSlot[];
}

/**
 * Posizione dei nove turni di coppa come frazione della stagione.
 *
 * I sei del girone stanno nella prima metà (la fase a gruppi si chiude prima di Natale, come
 * nella realtà), il tabellone nella seconda. Nessun turno cade nella settimana della finestra
 * di riparazione: sovrapporre mercato e coppa costringerebbe l'utente a due decisioni
 * importanti nello stesso momento.
 */
type CupStageName = "girone" | "quarti" | "semifinali" | "finale";
const CUP_FRACTIONS: { stage: CupStageName; at: number }[] = [
  { stage: "girone", at: 0.08 },
  { stage: "girone", at: 0.14 },
  { stage: "girone", at: 0.21 },
  { stage: "girone", at: 0.29 },
  { stage: "girone", at: 0.37 },
  { stage: "girone", at: 0.45 },
  { stage: "quarti", at: 0.63 },
  { stage: "semifinali", at: 0.79 },
  { stage: "finale", at: 0.95 },
];

/** La giornata a cui si apre la finestra di riparazione: il giro di boa del campionato. */
export function midSeasonRound(leagueRounds: number): number {
  return Math.floor(leagueRounds / 2);
}

/**
 * Dove cadono i sei turni di **Coppa Tricolore**, come frazione della stagione.
 *
 * Sono incastrati fra quelli di Corona, non sovrapposti: chi gioca entrambe arriva a
 * **quindici** impegni infrasettimanali su trentotto settimane, ed è voluto — la rotazione
 * della rosa smette di essere un consiglio e diventa una necessità, che è esattamente ciò che
 * la fatica (`fatigueTeamModifier`) modella da tempo senza aver mai pesato davvero.
 *
 * Il preliminare sta prestissimo (è agosto, prima che il campionato entri nel vivo) e la
 * finale a stagione quasi conclusa.
 */
const NATIONAL_CUP_FRACTIONS: { stage: NationalCupStage; at: number }[] = [
  { stage: "preliminare", at: 0.03 },
  { stage: "sedicesimi", at: 0.18 },
  { stage: "ottavi", at: 0.33 },
  { stage: "quarti", at: 0.55 },
  { stage: "semifinale", at: 0.72 },
  { stage: "finale", at: 0.9 },
];

export interface SeasonCalendarOptions {
  leagueRounds: number;
  /** La squadra partecipa alla Corona in questa stagione? */
  inCup: boolean;
  /**
   * La squadra partecipa alla Coppa Tricolore?
   *
   * Vero per tutti i club di Serie A e Serie B, cioè quasi sempre nelle carriere italiane.
   * Assente = falso, così i campionati esteri e i salvataggi precedenti non cambiano di nulla.
   */
  inNationalCup?: boolean;
}

/**
 * Costruisce le settimane della stagione.
 *
 * Una settimana per giornata di campionato; i turni di coppa si aggiungono alla settimana più
 * vicina alla loro frazione, spostandosi in avanti se quella è già occupata dal mercato o da
 * un altro turno di coppa.
 */
export function buildSeasonCalendar({
  leagueRounds,
  inCup,
  inNationalCup = false,
}: SeasonCalendarOptions): SeasonWeek[] {
  const weeks: SeasonWeek[] = Array.from({ length: leagueRounds }, (_, i) => ({
    index: i,
    slots: [{ kind: "campionato", round: i } as WeekSlot],
  }));

  // La finestra di riparazione si apre subito dopo il giro di boa.
  const marketWeek = midSeasonRound(leagueRounds);
  weeks[marketWeek]!.slots.push({ kind: "mercato", window: "riparazione" });

  const taken = new Set<number>([marketWeek]);

  /**
   * Trova la settimana libera più vicina alla frazione voluta.
   *
   * Una settimana ospita **al più una coppa**: mercoledì è uno solo, e accumulare due turni
   * infrasettimanali nella stessa settimana significherebbe far giocare tre partite in sette
   * giorni senza che il giocatore possa farci nulla.
   */
  const prenota = (at: number): number => {
    let week = Math.min(Math.max(Math.round(at * leagueRounds), 0), leagueRounds - 1);
    while (taken.has(week) && week < leagueRounds - 1) week++;
    // Se la coda è satura si torna indietro: meglio anticipare un turno che perderlo.
    while (taken.has(week) && week > 0) week--;
    taken.add(week);
    return week;
  };

  /**
   * La **Coppa Tricolore si prenota per prima**, e non è indifferente.
   *
   * Chi prenota per primo ottiene la settimana più vicina alla frazione voluta; chi arriva
   * dopo scivola in avanti. La coppa nazionale ha turni molto più radi (sei contro nove) e
   * spalmati su tutta la stagione, quindi lasciarle scegliere per prima produce meno
   * spostamenti che il contrario — e soprattutto tiene il **preliminare in agosto**, dove
   * deve stare, invece di farlo scivolare dentro il girone di Corona.
   */
  if (inNationalCup) {
    let round = 0;
    for (const { stage, at } of NATIONAL_CUP_FRACTIONS) {
      weeks[prenota(at)]!.slots.push({ kind: "coppa_nazionale", stage, round: round++ });
    }
  }

  if (inCup) {
    let cupRound = 0;
    for (const { stage, at } of CUP_FRACTIONS) {
      weeks[prenota(at)]!.slots.push({ kind: "coppa", stage, round: cupRound++ });
    }
  }

  return weeks;
}

/** Quanti turni di coppa prevede il formato (6 di girone + quarti, semifinali, finale). */
export const TOTAL_CUP_ROUNDS = GROUP_ROUNDS + 3;

/** Quanti turni ha la Coppa Tricolore: preliminare, sedicesimi, ottavi, quarti, semifinale, finale. */
export const TOTAL_NATIONAL_ROUNDS = NATIONAL_CUP_STAGES.length;

/** La settimana contiene un turno di Coppa Tricolore? */
export function nationalCupSlotOf(
  week: SeasonWeek,
): Extract<WeekSlot, { kind: "coppa_nazionale" }> | undefined {
  const slot = week.slots.find((s) => s.kind === "coppa_nazionale");
  return slot?.kind === "coppa_nazionale" ? slot : undefined;
}

/** La settimana contiene una giornata di campionato? */
export function leagueRoundOf(week: SeasonWeek): number | undefined {
  const slot = week.slots.find((s) => s.kind === "campionato");
  return slot?.kind === "campionato" ? slot.round : undefined;
}

/** La settimana contiene un turno di coppa? */
export function cupSlotOf(week: SeasonWeek): Extract<WeekSlot, { kind: "coppa" }> | undefined {
  const slot = week.slots.find((s) => s.kind === "coppa");
  return slot?.kind === "coppa" ? slot : undefined;
}

/** La settimana apre la finestra di mercato? */
export function hasMarketWindow(week: SeasonWeek): boolean {
  return week.slots.some((s) => s.kind === "mercato");
}
