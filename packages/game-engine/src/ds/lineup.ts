/**
 * L'undici titolare si **deriva**, non si memorizza.
 *
 * È la scelta di architettura più importante della gestione rosa, e vale la pena dire perché:
 * un undici salvato è una fotografia che invecchia male. Il portiere si infortuna, un
 * difensore viene venduto, un attaccante torna dal prestito — e ogni volta servirebbe del
 * codice che ripara la fotografia, con un caso speciale per ogni evento. Derivandolo, gli
 * eventi non hanno bisogno di sapere che esiste una formazione: basta che il giocatore esca
 * da `availableEntries` e l'undici successivo si rifà da solo, corretto per costruzione.
 *
 * La funzione è **deterministica**: nessun PRNG. A parità di rosa e di modulo la formazione è
 * sempre la stessa, altrimenti l'utente vedrebbe la squadra cambiare da sola fra due render.
 */
import { ROLE_DEPARTMENT } from "@app/shared-types";
import type { Formation, FormationSlot, Role } from "@app/shared-types";
import type { Lineup, PlayerIndex, PlayerRef, RosterEntry } from "./types";

/* -------------------------------------------------------------------------- */
/* Penalità (costanti di bilanciamento: placeholder dichiarati, da tarare)     */
/* -------------------------------------------------------------------------- */

/**
 * Quanto costa schierare un giocatore fuori dal suo ruolo.
 *
 * **Zero per i ruoli secondari**: il malus fisso da ruolo secondario è stato rimosso dal
 * progetto (Decision Log 2026-07-27, `effectiveOverallForRole`) e non va reintrodotto di
 * soppiatto qui. Un ruolo secondario è un ruolo che il giocatore *sa fare*.
 */
export const POSITIONAL_PENALTY = {
  /** Ruolo principale o secondario: nessuna penalità. */
  natural: 0,
  /** Ruolo diverso ma dello stesso reparto (un mediano da centrocampista centrale). */
  sameDepartment: 7,
  /** Reparto diverso (un centrocampista adattato in difesa). */
  otherDepartment: 14,
  /**
   * Un giocatore di movimento in porta — o, simmetricamente, un portiere in campo.
   *
   * La regola richiesta parlava solo del primo caso, ma renderla simmetrica evita un effetto
   * perverso: col solo `otherDepartment` il terzo portiere, che ha un Overall confrontabile
   * con quello di un rincalzo, diventerebbe un ripiego *conveniente* per una casella di
   * difesa scoperta. In campo un portiere è un pesce fuor d'acqua quanto il contrario.
   */
  goalkeeperMismatch: 25,
} as const;

/** Sotto questa soglia la stanchezza non si vede: un giocatore fresco non ha malus. */
const FATIGUE_FREE_THRESHOLD = 40;
/** Penalità massima a stanchezza 100 (placeholder di bilanciamento). */
const MAX_FATIGUE_PENALTY = 8;
/** Il morale conta solo quando è sotto la neutralità: sopra non regala nulla. */
const MORALE_NEUTRAL = 50;
/** Penalità massima a morale 0 (placeholder di bilanciamento). */
const MAX_MORALE_PENALTY = 6;

/** Panchina di default: sette cambi più i rincalzi che il regolamento moderno consente. */
export const DEFAULT_BENCH_SIZE = 9;

/**
 * Tetto di passate del miglioramento locale. Non serve nella pratica — ogni scambio aumenta
 * strettamente il punteggio totale e i punteggi possibili sono finiti, quindi il ciclo
 * termina da solo — ma un cappio infinito in una simulazione di 380 partite sarebbe
 * catastrofico e questa riga costa nulla.
 */
const MAX_IMPROVEMENT_PASSES = 20;

/** Uno scambio si applica solo se migliora davvero: mai per pareggio, altrimenti l'undici oscilla. */
const IMPROVEMENT_EPSILON = 1e-9;

/* -------------------------------------------------------------------------- */
/* Punteggio di un giocatore su una casella                                   */
/* -------------------------------------------------------------------------- */

/** Penalità di posizione: quanto vale in meno questo giocatore in questa casella. */
export function positionalPenalty(player: PlayerRef, slotRole: Role): number {
  if (player.role === slotRole || player.secondaryRoles.includes(slotRole)) {
    return POSITIONAL_PENALTY.natural;
  }
  const isGoalkeeperSlot = slotRole === "POR";
  const isGoalkeeper = player.role === "POR";
  if (isGoalkeeperSlot !== isGoalkeeper) return POSITIONAL_PENALTY.goalkeeperMismatch;
  return ROLE_DEPARTMENT[player.role] === ROLE_DEPARTMENT[slotRole]
    ? POSITIONAL_PENALTY.sameDepartment
    : POSITIONAL_PENALTY.otherDepartment;
}

export function fatiguePenalty(fatigue: number, weight = 1): number {
  const excess = Math.max(0, Math.min(fatigue, 100) - FATIGUE_FREE_THRESHOLD);
  return (excess / (100 - FATIGUE_FREE_THRESHOLD)) * MAX_FATIGUE_PENALTY * weight;
}

export function moralePenalty(morale: number, weight = 1): number {
  const deficit = Math.max(0, MORALE_NEUTRAL - Math.max(0, Math.min(morale, 100)));
  return (deficit / MORALE_NEUTRAL) * MAX_MORALE_PENALTY * weight;
}

export interface LineupOptions {
  /** Quanto pesano stanchezza e morale nella scelta (0 = l'allenatore li ignora). */
  fatigueWeight?: number;
  moraleWeight?: number;
  benchSize?: number;
  /**
   * Titolarità imposta dalla direttiva DS-Mister, **esclusiva per casella**: una casella
   * (ruolo) → al più un giocatore garantito. A differenza di `anyRoleBoost`, qui il bonus
   * scatta solo per la casella richiesta, non per una qualunque compatibile — è ciò che rende
   * la sostituzione vera: garantire un altro giocatore per lo stesso ruolo revoca il primo,
   * perché la entry per quella chiave viene sovrascritta a monte (`career.ts`).
   */
  guaranteedStarters?: Partial<Record<Role, string>>;
  /**
   * Giocatori con un bonus di selezione per **qualunque** ruolo compatibile (principale o
   * secondario) — usato dalle promesse di più spazio (sez. "chat coi giocatori"), che sono una
   * promessa di minutaggio, non di una casella specifica.
   */
  anyRoleBoost?: string[];
  /**
   * Penalità aggiuntiva per giocatore, decisa da fuori: è l'aggancio previsto per il malus
   * di chi ha visto rifiutata la richiesta di cessione (`ds/events.ts`), che non deve
   * conoscere la formazione per farsi sentire.
   */
  extraPenalty?: (entry: RosterEntry) => number;
}

/** Penalità complessiva di una voce di rosa in una casella: è ciò che la simulazione sottrae. */
export function slotPenalty(
  entry: RosterEntry,
  player: PlayerRef,
  slotRole: Role,
  options: LineupOptions = {},
): number {
  return (
    positionalPenalty(player, slotRole) +
    fatiguePenalty(entry.fatigue, options.fatigueWeight ?? 1) +
    moralePenalty(entry.morale, options.moraleWeight ?? 1) +
    (options.extraPenalty?.(entry) ?? 0)
  );
}

/** Quanto vale davvero questo giocatore in questa casella: Overall meno le penalità. */
export function playerSlotScore(
  entry: RosterEntry,
  player: PlayerRef,
  slotRole: Role,
  options: LineupOptions = {},
): number {
  let score = entry.overall - slotPenalty(entry, player, slotRole, options);
  if (options.guaranteedStarters?.[slotRole] === entry.playerId) {
    score += 100;
  } else if (
    options.anyRoleBoost?.includes(entry.playerId) &&
    (player.role === slotRole || player.secondaryRoles.includes(slotRole))
  ) {
    score += 100;
  }
  return score;
}

/* -------------------------------------------------------------------------- */
/* Scelta dell'undici                                                         */
/* -------------------------------------------------------------------------- */

/** Massimo per punteggio, con pareggio risolto sul `playerId`: l'esito non dipende dall'ordine di input. */
function bestOf(pool: RosterEntry[], score: (entry: RosterEntry) => number): RosterEntry {
  let best = pool[0]!;
  let bestScore = score(best);
  for (let i = 1; i < pool.length; i++) {
    const candidate = pool[i]!;
    const candidateScore = score(candidate);
    if (
      candidateScore > bestScore + IMPROVEMENT_EPSILON ||
      (Math.abs(candidateScore - bestScore) <= IMPROVEMENT_EPSILON &&
        candidate.playerId < best.playerId)
    ) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return best;
}

/**
 * L'undici titolare per un modulo, dato chi è disponibile.
 *
 * Tre passi, ognuno con una ragione precisa:
 *
 * 1. **Assegnazione greedy partendo dalle caselle con meno candidati.** Andare in ordine di
 *    modulo, o per Overall decrescente, produce l'errore classico: i ruoli abbondanti si
 *    prendono i giocatori migliori e quando si arriva al ruolo raro non è rimasto nessuno che
 *    lo sappia fare. Servendo prima la casella più affamata il problema non si pone.
 * 2. **Riempimento forzato** delle caselle rimaste senza candidati naturali (entrambi i
 *    portieri infortunati): meglio un adattato penalizzato che una squadra in dieci.
 * 3. **Miglioramento locale a scambi di coppia**, fino a punto fisso. Il greedy è miope —
 *    fissa la casella rara per prima e può sprecare lì un giocatore che altrove renderebbe
 *    molto di più — e gli scambi recuperano proprio quelle scelte.
 */
export function pickStartingEleven(
  formation: Formation,
  availableEntries: readonly RosterEntry[],
  playersById: PlayerIndex,
  options: LineupOptions = {},
): Lineup {
  // Un giocatore non risolvibile dal pool non è schierabile: la carriera regge un database
  // che cambia sotto i piedi, non si ferma.
  const candidates = availableEntries.filter((entry) => playersById[entry.playerId]);
  const slots = [...formation.slots].sort((a, b) => a.order - b.order);
  const scoreOf = (entry: RosterEntry, slot: FormationSlot) =>
    playerSlotScore(entry, playersById[entry.playerId]!, slot.role, options);

  const assigned = new Map<string, RosterEntry>();
  const used = new Set<string>();
  const unfilled = new Set(slots.map((slot) => slot.id));

  const naturalPool = (slot: FormationSlot) =>
    candidates.filter(
      (entry) =>
        !used.has(entry.playerId) &&
        positionalPenalty(playersById[entry.playerId]!, slot.role) === POSITIONAL_PENALTY.natural,
    );

  // 1. Caselle scarse per prime, ricalcolando la scarsità a ogni assegnazione: togliere un
  //    giocatore dal mercato cambia chi è davvero raro.
  for (;;) {
    let target: FormationSlot | undefined;
    let targetPool: RosterEntry[] = [];
    for (const slot of slots) {
      if (!unfilled.has(slot.id)) continue;
      const pool = naturalPool(slot);
      if (pool.length === 0) continue;
      if (!target || pool.length < targetPool.length) {
        target = slot;
        targetPool = pool;
      }
    }
    if (!target) break;
    const chosen = bestOf(targetPool, (entry) => scoreOf(entry, target!));
    assigned.set(target.id, chosen);
    used.add(chosen.playerId);
    unfilled.delete(target.id);
  }

  // 2. Riempimento forzato: nessuno sa fare quel ruolo, ma la casella va coperta.
  for (const slot of slots) {
    if (!unfilled.has(slot.id)) continue;
    const pool = candidates.filter((entry) => !used.has(entry.playerId));
    if (pool.length === 0) break; // rosa più corta di 11: si gioca in inferiorità numerica
    const chosen = bestOf(pool, (entry) => scoreOf(entry, slot));
    assigned.set(slot.id, chosen);
    used.add(chosen.playerId);
    unfilled.delete(slot.id);
  }

  // 3. Miglioramento locale. Solo scambi **strettamente** migliorativi: il punteggio totale
  //    cresce a ogni passo e non può tornare indietro, quindi la procedura termina e non
  //    esiste la coppia di configurazioni equivalenti fra cui la formazione "ballerebbe".
  const filledSlots = slots.filter((slot) => assigned.has(slot.id));
  for (let pass = 0; pass < MAX_IMPROVEMENT_PASSES; pass++) {
    let improved = false;
    for (let i = 0; i < filledSlots.length; i++) {
      for (let j = i + 1; j < filledSlots.length; j++) {
        const slotA = filledSlots[i]!;
        const slotB = filledSlots[j]!;
        const entryA = assigned.get(slotA.id)!;
        const entryB = assigned.get(slotB.id)!;
        const delta =
          scoreOf(entryA, slotB) +
          scoreOf(entryB, slotA) -
          scoreOf(entryA, slotA) -
          scoreOf(entryB, slotB);
        if (delta > IMPROVEMENT_EPSILON) {
          assigned.set(slotA.id, entryB);
          assigned.set(slotB.id, entryA);
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  const starters: Record<string, string> = {};
  const outOfPosition: string[] = [];
  for (const slot of slots) {
    const entry = assigned.get(slot.id);
    if (!entry) continue;
    starters[slot.id] = entry.playerId;
    if (positionalPenalty(playersById[entry.playerId]!, slot.role) > POSITIONAL_PENALTY.natural) {
      outOfPosition.push(slot.id);
    }
  }

  const startersIds = new Set(Object.values(starters));
  const bench = candidates
    .filter((entry) => !startersIds.has(entry.playerId))
    .sort((a, b) => b.overall - a.overall || (a.playerId < b.playerId ? -1 : 1))
    .slice(0, options.benchSize ?? DEFAULT_BENCH_SIZE)
    .map((entry) => entry.playerId);

  return { starters, bench, outOfPosition };
}

/* -------------------------------------------------------------------------- */
/* Ponti verso il resto del motore                                            */
/* -------------------------------------------------------------------------- */

/**
 * Le penalità per casella nel formato che `computeSquadStrength` si aspetta
 * (`SquadStrengthOptions.penalties`): è così che un undici rattoppato pesa davvero sul
 * risultato invece di essere solo un'etichetta rossa nella UI.
 */
export function lineupPenalties(
  formation: Formation,
  lineup: Lineup,
  entries: readonly RosterEntry[],
  playersById: PlayerIndex,
  options: LineupOptions = {},
): Record<string, number> {
  const byId = new Map(entries.map((entry) => [entry.playerId, entry]));
  const penalties: Record<string, number> = {};
  for (const slot of formation.slots) {
    const playerId = lineup.starters[slot.id];
    if (!playerId) continue;
    const entry = byId.get(playerId);
    const player = playersById[playerId];
    if (!entry || !player) continue;
    penalties[slot.id] = slotPenalty(entry, player, slot.role, options);
  }
  return penalties;
}

/** Numero di caselle effettivamente coperte: 11 salvo rosa decimata. */
export function lineupSize(lineup: Lineup): number {
  return Object.keys(lineup.starters).length;
}

/** L'undici è completo? Un modulo ha sempre 11 caselle, quindi il confronto è con `formation`. */
export function isLineupComplete(formation: Formation, lineup: Lineup): boolean {
  return formation.slots.every((slot) => lineup.starters[slot.id] !== undefined);
}
