/**
 * **L'IA che si comporta come un direttore sportivo.**
 *
 * `planWorldTransfers` (`aiWorld.ts`) sa comprare, ma **non ha un bilancio**: un club prende un
 * giocatore migliore da un club più debole, punto. Finché il mondo faceva quattordici operazioni
 * a stagione era una semplificazione accettabile. Con i parametri zero non lo è più: la
 * disponibilità economica *è* la partita, e un'IA senza vincoli firmerebbe ogni svincolato
 * interessante prima di noi.
 *
 * Qui ogni club riceve **un profilo strategico** e **due casse** come le nostre. Il profilo non è
 * un'etichetta decorativa: decide l'ordine con cui il club affronta il mercato, ed è ciò che
 * rende il mondo *leggibile* ("il Genoa sta ricostruendo") invece che casuale.
 *
 * Tutto **derivato**: profilo e casse sono funzioni pure di `(club, rosa, piazzamento, stagione,
 * seme)`. Zero byte di salvataggio, stesso principio di `aiWorld.ts`.
 */
import type { Department } from "@app/shared-types";
import { derivedRandom } from "../random";
import { FABBISOGNO_PER_REPARTO, type WorldClub, type WorldPlayer } from "./aiWorld";
import { baseWageOf } from "./contracts";
import { DEFAULT_WAGE_SHARE } from "./finances";

export type ClubStrategy = "assalto" | "consolidamento" | "ricostruzione" | "sopravvivenza";

export interface StrategyInput {
  club: WorldClub;
  squad: readonly WorldPlayer[];
  /** Posizione dell'ultima stagione, se conosciuta. */
  lastPosition?: number;
  leagueSize?: number;
  season: number;
  seed: string;
}

/**
 * Che aria tira in quel club.
 *
 * Il profilo cambia di stagione in stagione in base ai **risultati veri**: è la ragione per cui
 * dopo tre stagioni il mondo racconta una storia invece di essere una sequenza di operazioni.
 */
export function strategyOf({ club, squad, lastPosition, leagueSize = 20, season, seed }: StrategyInput): ClubStrategy {
  const forza = elevenAverage(squad);
  const attesa = attesaPerPrestigio(club.prestigeTier, leagueSize);
  const random = derivedRandom(seed, "strategy", club.id, season);

  // Chi lotta per non retrocedere non ha altra scelta: taglia e tampona.
  if (lastPosition !== undefined && lastPosition >= leagueSize - 3) return "sopravvivenza";

  // Molto sotto le attese del proprio blasone: si rifonda.
  if (lastPosition !== undefined && lastPosition > attesa + 4) return "ricostruzione";

  // Alto prestigio e rosa all'altezza: si va all'assalto.
  if (club.prestigeTier >= 4 && forza >= 79) return random() < 0.8 ? "assalto" : "consolidamento";

  // La fascia media consolida, con una minoranza che prova il salto.
  return random() < 0.25 ? "assalto" : "consolidamento";
}

function attesaPerPrestigio(tier: number, leagueSize: number): number {
  if (tier >= 5) return 2;
  if (tier >= 4) return 5;
  if (tier >= 3) return Math.round(leagueSize * 0.45);
  if (tier >= 2) return Math.round(leagueSize * 0.65);
  return leagueSize - 4;
}

export function elevenAverage(squad: readonly WorldPlayer[]): number {
  if (squad.length === 0) return 70;
  const migliori = [...squad].sort((a, b) => b.overall - a.overall).slice(0, 11);
  return migliori.reduce((s, p) => s + p.overall, 0) / migliori.length;
}

/* -------------------------------------------------------------------------- */
/* Le due casse dell'IA                                                        */
/* -------------------------------------------------------------------------- */

export interface AiFinances {
  /** Liquidità per i cartellini. */
  transfer: number;
  /** Tetto del monte ingaggi, €/anno. */
  wage: number;
  /** Margine ancora libero sul monte ingaggi: è ciò che può offrire a uno svincolato. */
  wageRoom: number;
  /** La quota di fatturato che questo club destina agli ingaggi, decisa dal profilo. */
  wageShare: number;
}

/**
 * Quanto un club dell'IA può spendere, e come lo ripartisce.
 *
 * La ripartizione **dipende dal profilo**, esattamente come per l'utente: chi ricostruisce sposta
 * sugli ingaggi perché i parametri zero sono la sua unica strada; chi va all'assalto tiene i
 * soldi sui cartellini. È ciò che mette il mondo in competizione con noi *sullo stesso asse* su
 * cui stiamo giocando noi.
 */
export function aiFinances(
  club: WorldClub,
  squad: readonly WorldPlayer[],
  strategy: ClubStrategy,
  season: number,
  seed: string,
): AiFinances {
  const random = derivedRandom(seed, "aiFinance", club.id, season);
  const forza = elevenAverage(squad);

  // Stessa forma esponenziale del nostro fatturato (`budget.ts`), su scala ridotta e senza i
  // premi: qui serve una scala credibile, non una simulazione contabile.
  const fatturato = Math.round(
    (14_000_000 * Math.exp((forza - 70) / 8) + club.prestigeTier * 6_000_000) * (0.85 + random() * 0.3),
  );

  const quota =
    strategy === "ricostruzione" ? 0.58 : strategy === "sopravvivenza" ? 0.55 : strategy === "assalto" ? 0.38 : DEFAULT_WAGE_SHARE;

  const wage = Math.round(fatturato * quota);
  const monteAttuale = squad.reduce(
    (s, p) => s + baseWageOf(p.overall, 26, club.prestigeTier),
    0,
  );

  return {
    transfer: Math.max(0, fatturato - wage),
    wage,
    wageRoom: Math.max(0, wage - monteAttuale),
    wageShare: quota,
  };
}

/* -------------------------------------------------------------------------- */
/* Il piano stagionale                                                         */
/* -------------------------------------------------------------------------- */

/** I reparti in cui al club manca davvero qualcuno (titolari + panchina, non gli undici nudi). */
export function neededDepartments(squad: readonly WorldPlayer[]): Department[] {
  const ordine: Department[] = ["POR", "DIF", "CC", "ATT"];
  return ordine.filter(
    (dep) => squad.filter((p) => p.department === dep).length < FABBISOGNO_PER_REPARTO[dep],
  );
}

/** Chi il club lascerebbe partire: fuori dai piani per età, livello o eccedenza nel reparto. */
export function releaseCandidates(
  squad: readonly WorldPlayer[],
  strategy: ClubStrategy,
  ageOf: (p: WorldPlayer) => number | null,
): WorldPlayer[] {
  const forza = elevenAverage(squad);
  const sogliaEta = strategy === "ricostruzione" ? 30 : 33;
  const sogliaLivello = strategy === "sopravvivenza" ? forza - 10 : forza - 8;

  return squad.filter((p) => {
    const eta = ageOf(p) ?? 26;
    const eccedenza =
      squad.filter((q) => q.department === p.department).length > FABBISOGNO_PER_REPARTO[p.department];
    return (eta >= sogliaEta || p.overall < sogliaLivello) && eccedenza;
  });
}

/**
 * L'ordine in cui un club affronta la finestra.
 *
 * **I parametri zero prima degli acquisti**: è il comportamento di un DS vero, che prima guarda
 * chi può prendere gratis e poi spende — ed è ciò che mette l'IA in gara con noi sugli svincolati
 * invece di lasciarci il mercato libero.
 */
export const MARKET_PLAN: readonly (
  | "rinnovi"
  | "rinnovo_mister"
  | "svincoli"
  | "necessita"
  | "parametri_zero"
  | "acquisti"
  | "precontratti"
  | "cessioni"
)[] = [
  "rinnovi",
  "rinnovo_mister",
  "svincoli",
  "necessita",
  "parametri_zero",
  "acquisti",
  "precontratti",
  "cessioni",
];

/** Quanti svincolati un club prova a tesserare in una finestra, per profilo. */
export function freeAgentAppetite(strategy: ClubStrategy): number {
  switch (strategy) {
    case "ricostruzione":
      return 3;
    case "sopravvivenza":
      return 2;
    case "consolidamento":
      return 1;
    case "assalto":
      return 1;
  }
}

/**
 * Un club rinnova a chi è in scadenza?
 *
 * La regola è la stessa che userebbe un DS: si tiene chi serve al progetto e si lascia scadere
 * chi è vecchio o sotto il livello — con l'eccezione di chi sta ricostruendo, che libera anche
 * gente ancora valida pur di alleggerire il monte ingaggi.
 */
export function wouldRenew(
  player: WorldPlayer,
  squad: readonly WorldPlayer[],
  strategy: ClubStrategy,
  age: number,
): boolean {
  const forza = elevenAverage(squad);
  if (age >= 34) return false;
  if (strategy === "ricostruzione") return age <= 26 && player.overall >= forza - 2;
  if (strategy === "sopravvivenza") return player.overall >= forza - 1 && age <= 32;
  if (strategy === "assalto") return player.overall >= forza - 4;
  return player.overall >= forza - 3 && age <= 32;
}
