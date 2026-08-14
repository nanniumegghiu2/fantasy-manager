/**
 * La rosa di un club durante una carriera DS.
 *
 * **La banda 21-27 e le soglie di reparto sono state rimosse** su richiesta dell'utente
 * (2026-07-31): il direttore sportivo dev'essere libero di svuotare la rosa e ricostruirla,
 * vendendo rapidamente chi vuole e riempiendo poi gli spazi. Erano anche la causa strutturale
 * di un difetto segnalato — con la rosa vicina al minimo `canSell` negava quasi tutti, quindi
 * il mercato **non generava più offerte in entrata** dalla seconda stagione in poi.
 *
 * Resta un solo limite, e non è un vincolo di prodotto ma una regola del calcio: **undici
 * giocatori schierabili**. Sotto quella soglia non esiste una formazione, e il motore non
 * saprebbe cosa mandare in campo. Il tetto massimo è alto abbastanza da non farsi sentire:
 * serve solo a impedire una rosa da centinaia di nomi che renderebbe illeggibili le schermate.
 */
import { ROLE_DEPARTMENT } from "@app/shared-types";
import type { Department } from "@app/shared-types";
import type { PlayerIndex, RosterEntry, SeasonStats } from "./types";
import { emptySeasonStats } from "./types";

/**
 * L'unico minimo che resta: gli undici che scendono in campo.
 *
 * Non è una scelta di bilanciamento — è la condizione perché una partita esista.
 */
export const MIN_SQUAD_SIZE = 11;

/** Tetto pratico, non un vincolo di gioco: serve solo a tenere leggibili le liste. */
export const MAX_SQUAD_SIZE = 40;

/**
 * Nessun minimo per reparto.
 *
 * Restano dichiarati a zero, invece di sparire, perché il codice che li consulta continua a
 * funzionare e perché il giorno in cui si volesse reintrodurre un vincolo il punto è questo.
 * Giocare senza portieri di ruolo è ora **permesso**: si pagherà in campo con la penalità da
 * fuori ruolo (`positionalPenalty`), che è il modo giusto di scoraggiarlo — una conseguenza,
 * non un divieto.
 */
export const MIN_BY_DEPARTMENT: Record<Department, number> = {
  POR: 0,
  DIF: 0,
  CC: 0,
  ATT: 0,
};

/**
 * Calcola la Media Voto (0.0 - 10.0) di un giocatore in rosa nella stagione corrente.
 *
 * Basata sulle valutazioni maturate sul campo, presenze, gol ed assist.
 */
export function computeAvgRating(entry: RosterEntry): number {
  if (entry.stats.appearances === 0) return 0;

  const base = 6.0 + (entry.overall - 70) * 0.035;
  const bonus = (entry.stats.goals * 0.2 + entry.stats.assists * 0.1) / Math.max(1, entry.stats.appearances);
  const raw = base + bonus;
  return Number(Math.min(9.5, Math.max(5.4, raw)).toFixed(1));
}

// I reparti hanno un'unica fonte di verità nel motore (`squadStrength.ts`): riesportarli da
// qui creerebbe due elenchi da tenere allineati a mano.
import { DEPARTMENTS } from "../squadStrength";
export { DEPARTMENTS };

/** Perché un'operazione di mercato è vietata. Il codice è per la logica, il testo per la UI. */
export type RosterViolation =
  | "not_in_roster"
  | "not_owned"
  | "on_loan_out"
  | "injured"
  | "min_squad_size"
  | "max_squad_size"
  | "min_department";

export interface RosterCheck {
  ok: boolean;
  reason?: RosterViolation;
  /** Messaggio già pronto per l'utente: la UI non deve conoscere i codici. */
  message?: string;
  /** Reparto coinvolto, quando la violazione lo riguarda. */
  department?: Department;
}

const OK: RosterCheck = { ok: true };

function deny(reason: RosterViolation, message: string, department?: Department): RosterCheck {
  return { ok: false, reason, message, department };
}

/* -------------------------------------------------------------------------- */
/* Interrogare la rosa                                                        */
/* -------------------------------------------------------------------------- */

/** È nostro ma sta giocando altrove: non lo possiamo schierare, resta di nostra proprietà. */
export function isLoanedOut(entry: RosterEntry): boolean {
  return entry.loan?.hostClubId !== undefined;
}

/** È qui in prestito da un altro club: lo schieriamo, ma non è nostro e non lo possiamo vendere. */
export function isLoanedIn(entry: RosterEntry): boolean {
  return entry.loan?.ownerClubId !== undefined;
}

export function isInjured(entry: RosterEntry): boolean {
  return entry.injuryMatchdaysLeft > 0;
}

/**
 * La rosa **utilizzabile**: chi è in prestito fuori esce dal conto, chi è in prestito da noi
 * ci entra. È su questo insieme che valgono la banda e le soglie di reparto — altrimenti
 * mandando sei giovani in prestito ci si ritroverebbe a giocare con quindici uomini restando
 * formalmente in regola.
 */
export function squadEntries(roster: readonly RosterEntry[]): RosterEntry[] {
  return roster.filter((entry) => !isLoanedOut(entry));
}

/** Chi è di nostra proprietà, prestiti in uscita compresi: è l'insieme che ha un valore. */
export function ownedEntries(roster: readonly RosterEntry[]): RosterEntry[] {
  return roster.filter((entry) => !isLoanedIn(entry));
}

/** Schierabili adesso: in rosa utilizzabile e non infortunati. È l'input di `pickStartingEleven`. */
export function availableEntries(roster: readonly RosterEntry[]): RosterEntry[] {
  return squadEntries(roster).filter((entry) => !isInjured(entry));
}

export function injuredEntries(roster: readonly RosterEntry[]): RosterEntry[] {
  return squadEntries(roster).filter(isInjured);
}

export function squadSize(roster: readonly RosterEntry[]): number {
  return squadEntries(roster).length;
}

export function findEntry(
  roster: readonly RosterEntry[],
  playerId: string,
): RosterEntry | undefined {
  return roster.find((entry) => entry.playerId === playerId);
}

/** `playerId` → voce di rosa, per non ripetere una ricerca lineare a ogni casella dell'undici. */
export function indexEntries(roster: readonly RosterEntry[]): Map<string, RosterEntry> {
  return new Map(roster.map((entry) => [entry.playerId, entry]));
}

/**
 * Reparto di una voce di rosa. Passa dal ruolo del giocatore, unica fonte di verità
 * (`ROLE_DEPARTMENT`): il reparto non è un dato indipendente che si possa disallineare.
 * `undefined` se il giocatore non è risolvibile dal pool — caso reale dopo un aggiornamento
 * del database, che `resolveCareer` tollera invece di far crollare la carriera.
 */
export function departmentOf(entry: RosterEntry, players: PlayerIndex): Department | undefined {
  const player = players[entry.playerId];
  return player ? ROLE_DEPARTMENT[player.role] : undefined;
}

export function entriesByDepartment(
  roster: readonly RosterEntry[],
  players: PlayerIndex,
): Record<Department, RosterEntry[]> {
  const result = { POR: [], DIF: [], CC: [], ATT: [] } as Record<Department, RosterEntry[]>;
  for (const entry of squadEntries(roster)) {
    const department = departmentOf(entry, players);
    if (department) result[department].push(entry);
  }
  return result;
}

export function departmentCounts(
  roster: readonly RosterEntry[],
  players: PlayerIndex,
): Record<Department, number> {
  const byDepartment = entriesByDepartment(roster, players);
  return {
    POR: byDepartment.POR.length,
    DIF: byDepartment.DIF.length,
    CC: byDepartment.CC.length,
    ATT: byDepartment.ATT.length,
  };
}

/** Media degli Overall: serve al mercato e all'evento "voglio giocare", che è relativo alla rosa. */
export function averageOverall(entries: readonly RosterEntry[]): number {
  if (entries.length === 0) return 0;
  return entries.reduce((sum, entry) => sum + entry.overall, 0) / entries.length;
}

/** Reparti sotto la soglia minima: è la lista della spesa del mercato, per noi e per l'IA. */
export function rosterNeeds(
  roster: readonly RosterEntry[],
  players: PlayerIndex,
): Department[] {
  const counts = departmentCounts(roster, players);
  return DEPARTMENTS.filter((department) => counts[department] < MIN_BY_DEPARTMENT[department]);
}

/**
 * Violazioni presenti **adesso**. Serve a verificare l'integrità di una rosa caricata da un
 * salvataggio o generata dall'IA, non a decidere un'operazione: per quello ci sono
 * `canSell`/`canBuy`, che ragionano sullo stato *dopo* l'operazione.
 */
export function rosterViolations(
  roster: readonly RosterEntry[],
  players: PlayerIndex,
): RosterCheck[] {
  const violations: RosterCheck[] = [];
  const size = squadSize(roster);
  if (size < MIN_SQUAD_SIZE) {
    violations.push(deny("min_squad_size", `Rosa incompleta: ${size} giocatori su ${MIN_SQUAD_SIZE} minimi.`));
  }
  if (size > MAX_SQUAD_SIZE) {
    violations.push(deny("max_squad_size", `Rosa troppo numerosa: ${size} giocatori su ${MAX_SQUAD_SIZE} massimi.`));
  }
  const counts = departmentCounts(roster, players);
  for (const department of DEPARTMENTS) {
    if (counts[department] < MIN_BY_DEPARTMENT[department]) {
      violations.push(
        deny(
          "min_department",
          `Servono almeno ${MIN_BY_DEPARTMENT[department]} giocatori nel reparto ${department}.`,
          department,
        ),
      );
    }
  }
  return violations;
}

export function isRosterValid(roster: readonly RosterEntry[], players: PlayerIndex): boolean {
  return rosterViolations(roster, players).length === 0;
}

/* -------------------------------------------------------------------------- */
/* Vincoli sulle operazioni di mercato                                        */
/* -------------------------------------------------------------------------- */

/**
 * Si può cedere questo giocatore? Le quattro ragioni per cui no, in ordine di specificità:
 * non è in rosa, non è nostro, è già impegnato altrove, oppure la sua uscita lascerebbe la
 * rosa sotto un minimo (complessivo o di reparto).
 */
export function canSell(
  roster: readonly RosterEntry[],
  playerId: string,
  players: PlayerIndex,
): RosterCheck {
  const entry = findEntry(roster, playerId);
  if (!entry) return deny("not_in_roster", "Il giocatore non fa parte della rosa.");
  if (isLoanedIn(entry)) {
    return deny("not_owned", "Il giocatore è in prestito da un altro club: non è tuo da vendere.");
  }
  if (isLoanedOut(entry)) {
    return deny("on_loan_out", "Il giocatore è in prestito altrove: rientrerà a fine stagione.");
  }
  if (isInjured(entry)) {
    return deny("injured", "Infortunato: nessun club fa offerte per un giocatore ai box. Aspetta il rientro.");
  }

  const size = squadSize(roster);
  if (size - 1 < MIN_SQUAD_SIZE) {
    return deny(
      "min_squad_size",
      `La rosa scenderebbe a ${size - 1} giocatori: il minimo è ${MIN_SQUAD_SIZE}.`,
    );
  }

  const department = departmentOf(entry, players);
  if (department) {
    const counts = departmentCounts(roster, players);
    if (counts[department] - 1 < MIN_BY_DEPARTMENT[department]) {
      return deny(
        "min_department",
        `Resterebbero ${counts[department] - 1} giocatori nel reparto ${department}: il minimo è ${MIN_BY_DEPARTMENT[department]}.`,
        department,
      );
    }
  }

  return OK;
}

/**
 * Si può aggiungere un giocatore? L'unico limite è il tetto: nessuno obbliga a comprare in un
 * reparto specifico, i minimi si controllano in uscita. Un prestito in entrata occupa un posto
 * come un acquisto, quindi passa dalla stessa porta.
 */
export function canBuy(roster: readonly RosterEntry[]): RosterCheck {
  const size = squadSize(roster);
  if (size + 1 > MAX_SQUAD_SIZE) {
    return deny(
      "max_squad_size",
      `La rosa salirebbe a ${size + 1} giocatori: il massimo è ${MAX_SQUAD_SIZE}. Cedi qualcuno prima.`,
    );
  }
  return OK;
}

/** Quanti posti restano prima del tetto: la UI del mercato lo mostra, l'IA ci pianifica sopra. */
export function freeSquadSlots(roster: readonly RosterEntry[]): number {
  return Math.max(0, MAX_SQUAD_SIZE - squadSize(roster));
}

/** Quante cessioni sono ancora possibili prima di toccare il minimo complessivo. */
export function sellableCount(roster: readonly RosterEntry[]): number {
  return Math.max(0, squadSize(roster) - MIN_SQUAD_SIZE);
}

/* -------------------------------------------------------------------------- */
/* Creazione e manutenzione                                                   */
/* -------------------------------------------------------------------------- */

export interface NewRosterEntry {
  playerId: string;
  overall: number;
  potential: number;
  sinceSeason: number;
  /** Giornata in cui entra in rosa, se arriva a stagione in corso: conta le sue occasioni da li. */
  joinedAtMatchday?: number;
  /** Morale di partenza: 70 = contento ma non euforico (placeholder di bilanciamento). */
  morale?: number;
  stats?: SeasonStats;
}

export function createRosterEntry(input: NewRosterEntry): RosterEntry {
  return {
    playerId: input.playerId,
    overall: input.overall,
    potential: input.potential,
    sinceSeason: input.sinceSeason,
    joinedAtMatchday: input.joinedAtMatchday,
    morale: input.morale ?? 70,
    injuryMatchdaysLeft: 0,
    fatigue: 0,
    stats: input.stats ?? emptySeasonStats(),
  };
}

/** Azzera le statistiche stagionali di tutti: memorizza le statistiche della stagione appena conclusa per il mercato estivo. */
export function resetSeasonStats(roster: readonly RosterEntry[]): RosterEntry[] {
  return roster.map((entry) => ({
    ...entry,
    lastSeasonStats: entry.stats.appearances > 0 ? { ...entry.stats } : entry.lastSeasonStats,
    stats: emptySeasonStats(),
  }));
}
