/**
 * Il ciclo di vita di un giocatore in carriera: **invecchia, cresce, declina, si ritira.**
 *
 * La regola che regge tutto: **l'età dice quanto margine c'è, il campo dice se te lo meriti.**
 * Il margine dell'età è un *tetto*, non un automatismo — un diciannovenne con potenziale 85
 * che gioca trenta partite prende tutto il margine, lo stesso ragazzo lasciato in panchina non
 * cresce affatto. È questo a rendere sensata la strategia della squadra piccola che compra
 * giovani e dà loro campo, invece di parcheggiarli.
 *
 * La componente di rendimento **non è una formula nuova**: riusa `applySeasonAdjustment` di
 * `overallV2.ts`, scritta e testata tempo fa ma **mai attivata** perché ai dati reali mancava
 * il minutaggio (CLAUDE.md sez. 2.2). In una carriera i minuti li produce la simulazione,
 * quindi il blocco che la teneva ferma non esiste più. Ha già le tre proprietà che servono:
 * confronta col rendimento **atteso per quel livello** (un giovane da 68 che segna 10 gol è
 * premiato, un 85 che ne segna 10 no), scala lo scostamento **sui minuti giocati**, ed è
 * limitata, così una stagione non ribalta un giudizio.
 */
import { ageAt } from "../contextPrior";
import { applySeasonAdjustment } from "../overallV2";
import type { Role } from "@app/shared-types";
import { RETIREMENT_AGE, type RosterEntry, type SeasonStats } from "./types";

/** Estremi della scala Overall del progetto. */
const MIN_OVERALL = 60;
const MAX_OVERALL = 99;

/**
 * Margine di crescita (o declino) concesso dall'età, in punti di Overall per stagione.
 *
 * Placeholder di bilanciamento **dichiarati**, da tarare misurando: il criterio è che un
 * giovane di belle speranze raggiunga il suo potenziale in 4-6 stagioni giocando molto, e
 * che un trentaduenne perda abbastanza da rendere sensato sostituirlo.
 */
export function ageMargin(age: number): number {
  if (age <= 21) return 3;
  if (age <= 23) return 2;
  if (age <= 28) return 1; // picco: oscilla col rendimento, non cresce strutturalmente
  if (age <= 30) return -1;
  if (age <= 32) return -2;
  return -3;
}

/** Il giocatore è nella fascia in cui il rendimento può ancora farlo crescere? */
export function isDeveloping(age: number): boolean {
  return age <= 23;
}

/** Nel picco l'Overall oscilla ma non cresce strutturalmente. */
export function isAtPeak(age: number): boolean {
  return age >= 24 && age <= 28;
}

/** Data di inizio di una stagione di carriera (1 settembre dell'anno corrispondente). */
export function seasonStartDate(season: number, firstSeasonYear = 2025): Date {
  return new Date(Date.UTC(firstSeasonYear + season - 1, 8, 1));
}

/** Età di un giocatore all'inizio di una data stagione di carriera. */
export function ageInSeason(birthDate: string | null | undefined, season: number): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  return ageAt(born, seasonStartDate(season));
}

/**
 * Si ritira a fine di questa stagione?
 *
 * Regola voluta dall'utente: ritiro a 34 anni. Chi però ha **già** 34 o più alla prima
 * stagione non sparisce subito — se ne va alla fine della **seconda**. Senza questa clausola
 * il primo anno di carriera perderebbe di colpo 123 giocatori del database reale, fra cui
 * diversi titolari, e la prima finestra di mercato sarebbe un'emergenza invece di una scelta.
 */
export function shouldRetire(ageAtSeason: number | null, season: number): boolean {
  if (ageAtSeason === null) return false;
  if (season === 1) return false;
  if (season === 2) return ageAtSeason >= RETIREMENT_AGE;
  return ageAtSeason >= RETIREMENT_AGE;
}

/**
 * Stima del potenziale di un giocatore reale a inizio carriera.
 *
 * Il database non ha un campo "potenziale": va dedotto da Overall ed età, che è poi il
 * ragionamento di uno scout. Un ventenne da 78 ha molto margine davanti; un ventinovenne da
 * 78 è già arrivato e il suo potenziale coincide col valore attuale.
 *
 * `variation` (0-1, tipicamente da un PRNG) sporca leggermente la stima: due coetanei con lo
 * stesso Overall non devono avere per forza lo stesso futuro, altrimenti lo scouting non
 * avrebbe nulla da scoprire.
 */
export function estimatePotential(overall: number, age: number, variation = 0.5): number {
  // Quanto margine resta, in punti, prima del picco.
  const yearsToPeak = Math.max(0, 24 - age);
  const headroom = Math.min(yearsToPeak * 2.5, 14);
  // La variazione sposta di ±3 punti attorno alla stima centrale.
  const noise = (variation - 0.5) * 6;
  return clampOverall(Math.round(overall + headroom + noise));
}

function clampOverall(value: number): number {
  return Math.min(Math.max(value, MIN_OVERALL), MAX_OVERALL);
}

export interface AgingInput {
  entry: RosterEntry;
  role: Role;
  /** Età del giocatore nella stagione appena conclusa. */
  age: number;
  /** Prestigio del campionato in cui ha giocato (1-5), per `applySeasonAdjustment`. */
  leaguePrestige?: number | null;
  /**
   * Moltiplicatore dell'allenatore sulla crescita (`Coach.development`). Agisce **solo** in
   * positivo: un buon tecnico accelera un giovane, ma non salva un trentatreenne dal declino.
   */
  development?: number;
}

export interface AgingResult {
  playerId: string;
  before: number;
  after: number;
  /** Quanto è arrivato dal rendimento in campo, al netto del margine dell'età. */
  meritDelta: number;
  /** Il tetto concesso dall'età in questa stagione. */
  margin: number;
  retired: boolean;
  /** Di quanto sale il *tetto* stesso (`potential`), non solo l'Overall verso di esso. */
  potentialDelta: number;
}

/** Età oltre la quale il potenziale non cresce più: è un prospetto, non più un progetto. */
export const POTENTIAL_GROWTH_MAX_AGE = 23;

/** Minuti giocati (quota di stagione piena) sotto cui il potenziale non si muove. */
const POTENTIAL_GROWTH_MIN_SHARE = 0.55;

/** Tetto assoluto oltre cui nessun potenziale cresce, per crescita di minuti: si diventa forti, non infiniti. */
export const POTENTIAL_ABSOLUTE_CAP = 96;

/**
 * Il potenziale stesso può crescere, non solo l'Overall avvicinarvisi.
 *
 * Prima `potential` era fissato alla creazione e mai più toccato — solo `overall` si
 * avvicinava a un tetto immutabile, quindi un giovane con potenziale 78 restava per sempre un
 * giocatore da 78, per quanto bene giocasse. Richiesta esplicita dell'utente: chi gioca molto
 * **e** rende sopra attese da giovane deve poter diventare, nel tempo, un top player — non
 * automaticamente ("gioca tanto" da solo non basta, serve anche rendere bene), e non subito
 * (piccoli passi a stagione, non un salto).
 */
export function growPotential(
  currentPotential: number,
  age: number,
  playedShare: number,
  meritDelta: number,
): number {
  if (age > POTENTIAL_GROWTH_MAX_AGE) return 0;
  if (playedShare < POTENTIAL_GROWTH_MIN_SHARE) return 0;
  if (meritDelta <= 0) return 0;
  if (currentPotential >= POTENTIAL_ABSOLUTE_CAP) return 0;
  const crescita = Math.min(2, Math.max(1, Math.round(meritDelta / 3)));
  return Math.min(crescita, POTENTIAL_ABSOLUTE_CAP - currentPotential);
}

/** Quanti minuti costituiscono una stagione "da titolare" per la scala del rendimento. */
const FULL_SEASON_MINUTES = 2700; // ~30 partite intere

/**
 * Fa evolvere gli Overall di un gruppo di giocatori a fine stagione.
 *
 * Si lavora su tutto il gruppo insieme, non giocatore per giocatore, perché
 * `applySeasonAdjustment` normalizza il rendimento **rispetto ai pari ruolo**: valutare un
 * attaccante da solo, senza altri attaccanti con cui confrontarlo, darebbe un giudizio senza
 * riferimento.
 */
export function advanceSeasonOveralls(
  inputs: AgingInput[],
  season: number,
): AgingResult[] {
  if (inputs.length === 0) return [];

  const adjusted = applySeasonAdjustment(
    inputs.map(({ entry, role, leaguePrestige }) => ({
      id: entry.playerId,
      role,
      leaguePrestige,
      baseOverall: entry.overall,
      stats: statLineOf(entry.stats),
    })),
  );
  const adjustmentById = new Map(adjusted.map((a) => [a.id, a.adjustment]));

  return inputs.map(({ entry, age, development = 1 }) => {
    const margin = ageMargin(age);
    const merit = adjustmentById.get(entry.playerId) ?? 0;
    const playedShare = Math.min(entry.stats.minutes / FULL_SEASON_MINUTES, 1);

    let delta: number;
    if (margin > 0) {
      // **Il margine è un tetto, non un regalo.** Un giovane cresce in proporzione a quanto
      // ha giocato e a quanto ha reso: chi non gioca resta fermo per quanto sia promettente.
      const earned = Math.max(0, merit) + playedShare * margin;
      const room = Math.max(0, entry.potential - entry.overall);
      delta = Math.min(Math.round(earned * development), margin, room);
    } else {
      // Nel declino il rendimento può attenuare la caduta ma non invertirla: un trentatreenne
      // in gran forma invecchia più lentamente, non ringiovanisce.
      delta = Math.min(0, margin + Math.max(0, merit));
    }

    const after = clampOverall(entry.overall + delta);
    return {
      playerId: entry.playerId,
      before: entry.overall,
      after,
      meritDelta: merit,
      margin,
      retired: shouldRetire(age + 1, season + 1),
      potentialDelta: growPotential(entry.potential, age, playedShare, merit),
    };
  });
}

/** Traduce le statistiche di carriera nella riga attesa da `overallV2`. */
function statLineOf(stats: SeasonStats) {
  return {
    minutes: stats.minutes,
    goals: stats.goals,
    assists: stats.assists,
    // Media voto e clean sheet non esistono in DS mode: `overallV2` sa già trattare un dato
    // mancante come neutro invece di ridistribuirne il peso (lezione del 2026-07-28: così i
    // portieri non finivano valutati al 100% sul solo minutaggio).
    averageRating: null,
    cleanSheets: null,
  };
}
