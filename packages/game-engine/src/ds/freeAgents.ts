/**
 * **Il mercato dei parametri zero.**
 *
 * È il luogo in cui si vede l'abilità del direttore sportivo: uno svincolato non costa
 * cartellino, quindi **il portafoglio non decide, decide chi lo convince**. Una piccola squadra
 * può strappare un giocatore a un club più ricco offrendo ciò che il ricco non può offrire — il
 * campo. E siccome i minuti garantiti sono un impegno verificato (`commitments.ts`), quel colpo
 * è anche un debito: tenerlo poi in panchina produce la rottura, con gli interessi.
 *
 * ## Ogni carriera è unica
 *
 * Il pool non è una lista di nomi scelti a mano: nasce dai **contratti scaduti**, e le scadenze
 * si derivano dal seme di carriera (`contracts.ts`). Due carriere sullo stesso database hanno
 * quindi svincolati diversi. Il test `dsFreeAgents.test.ts` blocca la proprietà misurandola:
 * semi diversi → sovrapposizione bassa.
 *
 * ## Il pool si consuma e decade
 *
 * Senza queste due regole sarebbe un negozio sempre aperto:
 *  - **decadimento**: chi resta senza squadra perde condizione, finestra dopo finestra;
 *  - **concorrenza**: i club IA firmano, e il colpo migliore sparisce se non lo prendi subito.
 */
import { ROLE_DEPARTMENT, type Department, type Role } from "@app/shared-types";
import { derivedRandom } from "../random";
import { ageInSeason } from "./aging";
import { baseWageOf, contractExpiryOf, type ContractOverrides } from "./contracts";
import { generateName } from "./names";
import { derivePlayerPersonality, type PlayerPersonality } from "./types";
import { aiOverallInSeason, isRetiredBySeason, type WorldPlayer } from "./aiWorld";

/* -------------------------------------------------------------------------- */
/* Modello                                                                     */
/* -------------------------------------------------------------------------- */

export type FreeAgentOrigin = "scaduto" | "svincolato" | "regen" | "rottura";

export interface FreeAgent {
  id: string;
  name: string;
  nation: string;
  role: Role;
  secondaryRoles: Role[];
  department: Department;
  birthDate?: string | null;
  age: number;
  /** Overall **già decaduto** per le finestre passate da libero. */
  overall: number;
  /** Overall di partenza, prima del decadimento: serve a mostrare quanto sta perdendo. */
  baseOverall: number;
  origin: FreeAgentOrigin;
  /** Da quante finestre è senza squadra. */
  windowsFree: number;
  /** Quanto perderà ancora se resta libero un'altra finestra. */
  nextDecay: number;
  personality: PlayerPersonality;
  /** Ingaggio annuo richiesto. */
  askingWage: number;
  /** Durata richiesta, in stagioni. */
  askingSeasons: number;
  /** Vuole garanzie di titolarità per firmare? */
  wantsStarter: boolean;
  /** Quanti club lo stanno seguendo: è l'urgenza, e si vede nella lista. */
  suitors: number;
}

/** Quanto Overall si perde per ogni finestra passata da svincolato, e il tetto complessivo. */
export const DECAY_PER_WINDOW = 1;
export const MAX_DECAY = 4;

/** Chi sta sotto questa soglia non entra nella vetrina: allungherebbe la lista senza scelte vere. */
export const FREE_AGENT_MIN_OVERALL = 64;

/* -------------------------------------------------------------------------- */
/* Costruzione del pool                                                        */
/* -------------------------------------------------------------------------- */

export interface FreeAgentPoolInput {
  /** I giocatori del mondo alla stagione corrente (da `evolveWorld`). */
  worldPlayers: readonly WorldPlayer[];
  seed: string;
  season: number;
  /** La finestra aperta: in inverno il decadimento è già di una tacca. */
  winter?: boolean;
  overrides?: ContractOverrides;
  /** Chi è stato svincolato per decisione (nostra o dell'IA). */
  released?: readonly string[];
  /** Chi ha già firmato con qualcuno: esce dal pool. */
  signed?: ReadonlySet<string>;
  /** Prestigio per club, per stimare l'ingaggio richiesto di chi veniva da una grande. */
  clubPrestige?: Record<string, number>;
  /** Quanti giovani senza squadra generare, oltre ai contratti scaduti. */
  regenCount?: number;
}

/**
 * Il pool degli svincolati adesso.
 *
 * Puro e derivato: ricostruirlo dà sempre la stessa lista, quindi non occupa un byte di
 * salvataggio — stesso principio di `aiWorld.ts`.
 */
export function buildFreeAgentPool(input: FreeAgentPoolInput): FreeAgent[] {
  const {
    worldPlayers,
    seed,
    season,
    winter = false,
    overrides,
    released = [],
    signed,
    clubPrestige = {},
    regenCount = 6,
  } = input;

  const rilasciati = new Set(released);
  const pool: FreeAgent[] = [];

  for (const player of worldPlayers) {
    if (signed?.has(player.id)) continue;

    const override = overrides?.[player.id];
    const scadenza = override ? override.until : contractExpiryOf(player, seed);
    const svincolato = rilasciati.has(player.id);
    // Libero da: la stagione dopo la scadenza, oppure subito se rescisso.
    if (!svincolato && scadenza >= season) continue;

    const primaStagioneLibero = svincolato ? season : scadenza + 1;
    const finestreLibero = Math.max(0, (season - primaStagioneLibero) * 2 + (winter ? 1 : 0));

    const agente = toFreeAgent(player, {
      seed,
      season,
      windowsFree: finestreLibero,
      origin: svincolato ? "svincolato" : "scaduto",
      prestige: clubPrestige[player.clubId] ?? 3,
    });
    if (!agente || agente.overall < FREE_AGENT_MIN_OVERALL) continue;
    pool.push(agente);
  }

  pool.push(...generateUnattachedYouth(seed, season, regenCount, pool));

  return pool.sort((a, b) => b.overall - a.overall);
}

interface ToFreeAgentCtx {
  seed: string;
  season: number;
  windowsFree: number;
  origin: FreeAgentOrigin;
  prestige: number;
}

function toFreeAgent(player: WorldPlayer, ctx: ToFreeAgentCtx): FreeAgent | null {
  if (isRetiredBySeason(player.birthDate, ctx.season)) return null;
  const age = ageInSeason(player.birthDate, ctx.season);
  if (age === null) return null;

  const base = aiOverallInSeason(player.overall, player.birthDate, ctx.season);
  const decadimento = Math.min(MAX_DECAY, ctx.windowsFree * DECAY_PER_WINDOW);
  const overall = Math.max(50, base - decadimento);

  const personality = derivePlayerPersonality(player.id, age, overall, ctx.season, ctx.season);
  const random = derivedRandom(ctx.seed, "freeagent", player.id, ctx.season);

  // Chi è libero da tempo abbassa le pretese: è l'altra faccia del decadimento, e rende sensato
  // aspettare gennaio per un affare — al prezzo di prenderlo meno in forma.
  const sconto = 1 - Math.min(0.35, ctx.windowsFree * 0.12);
  const richiesta = baseWageOf(overall, age, ctx.prestige) * (0.95 + random() * 0.3) * sconto;

  return {
    id: player.id,
    name: player.name,
    nation: player.nation,
    role: player.role,
    secondaryRoles: player.secondaryRoles,
    department: player.department,
    birthDate: player.birthDate,
    age,
    overall,
    baseOverall: base,
    origin: ctx.origin,
    windowsFree: ctx.windowsFree,
    nextDecay: ctx.windowsFree * DECAY_PER_WINDOW >= MAX_DECAY ? 0 : DECAY_PER_WINDOW,
    personality,
    askingWage: Math.max(60_000, Math.round(richiesta / 10_000) * 10_000),
    askingSeasons: age >= 33 ? 1 : age >= 30 ? 2 : age <= 22 ? 4 : 3,
    wantsStarter: overall >= 74 || personality === "giovane_ambizioso",
    suitors: 0,
  };
}

const YOUTH_ROLES: Role[] = ["POR", "TD", "DC", "TS", "MED", "CC", "ED", "ES", "TRQ", "ATT"];
const YOUTH_NATIONS = ["Italia", "Francia", "Spagna", "Germania", "Inghilterra", "Brasile", "Argentina", "Portogallo"];

/**
 * I giovani senza squadra: coprono i ruoli che il caso lascia scoperti e danno alle piccole una
 * scommessa a basso costo. Nomi generati dalla stessa macchina dei regen, quindi già unici.
 */
function generateUnattachedYouth(
  seed: string,
  season: number,
  quanti: number,
  esistenti: readonly FreeAgent[],
): FreeAgent[] {
  const nomiUsati = new Set(esistenti.map((a) => a.name));
  const out: FreeAgent[] = [];

  for (let i = 0; i < quanti; i++) {
    const random = derivedRandom(seed, "freeyouth", season, i);
    const nation = YOUTH_NATIONS[Math.floor(random() * YOUTH_NATIONS.length)]!;
    const role = YOUTH_ROLES[Math.floor(random() * YOUTH_ROLES.length)]!;
    const age = 18 + Math.floor(random() * 4);
    const overall = FREE_AGENT_MIN_OVERALL + Math.floor(random() * 8);
    const name = generateName(nation, nomiUsati, random);
    nomiUsati.add(name);

    out.push({
      id: `freeyouth-${seed}-${season}-${i}`,
      name,
      nation,
      role,
      secondaryRoles: [],
      department: ROLE_DEPARTMENT[role],
      birthDate: `${2025 + season - 1 - age}-0${1 + Math.floor(random() * 9)}-12`,
      age,
      overall,
      baseOverall: overall,
      origin: "regen",
      windowsFree: 0,
      nextDecay: 0,
      personality: "giovane_ambizioso",
      askingWage: Math.max(60_000, Math.round(baseWageOf(overall, age, 2) / 10_000) * 10_000),
      askingSeasons: 4,
      wantsStarter: false,
      suitors: 0,
    });
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* La trattativa: cinque assi, non una cifra                                   */
/* -------------------------------------------------------------------------- */

export interface FreeAgentBid {
  clubId: string;
  clubName: string;
  /** 1-5. Pesa sull'ambizione percepita. */
  prestige: number;
  /** Ingaggio annuo offerto. */
  wage: number;
  /** Durata offerta, in stagioni. */
  seasons: number;
  /** Titolarità garantita: è un impegno verificato, non una frase. */
  guaranteedStarter: boolean;
  /** Fascia da capitano. */
  captain: boolean;
  /** Posizione promessa in campionato (1 = titolo). Più bassa, più ambiziosa. */
  ambitionTarget?: number;
}

/**
 * Quanto vale un'offerta **per lui**, 0-100.
 *
 * I pesi cambiano con la personalità, ed è tutto il senso della meccanica: al `mercenario`
 * interessa la cifra, al `giovane_ambizioso` i minuti, al `leader` il ruolo e le ambizioni. Ecco
 * perché una piccola può battere il Real: non gareggia sullo stesso asse.
 */
export function freeAgentBidScore(agent: FreeAgent, bid: FreeAgentBid): number {
  const pesi: Record<PlayerPersonality, { soldi: number; durata: number; campo: number; ambizione: number; ruolo: number }> = {
    mercenario: { soldi: 0.58, durata: 0.14, campo: 0.1, ambizione: 0.1, ruolo: 0.08 },
    giovane_ambizioso: { soldi: 0.2, durata: 0.15, campo: 0.42, ambizione: 0.15, ruolo: 0.08 },
    leader: { soldi: 0.26, durata: 0.12, campo: 0.18, ambizione: 0.24, ruolo: 0.2 },
    insofferente: { soldi: 0.36, durata: 0.12, campo: 0.3, ambizione: 0.14, ruolo: 0.08 },
    professionista: { soldi: 0.34, durata: 0.24, campo: 0.2, ambizione: 0.14, ruolo: 0.08 },
  };
  const p = pesi[agent.personality];

  const soldi = Math.min(1.3, bid.wage / Math.max(1, agent.askingWage));
  const durata = 1 - Math.min(1, Math.abs(bid.seasons - agent.askingSeasons) / 3);
  const campo = agent.wantsStarter ? (bid.guaranteedStarter ? 1 : 0.2) : bid.guaranteedStarter ? 1 : 0.75;
  const ambizione = Math.min(1, (bid.prestige / 5) * 0.7 + (bid.ambitionTarget ? Math.max(0, (8 - bid.ambitionTarget) / 8) * 0.3 : 0.15));
  const ruolo = bid.captain ? 1 : 0.55;

  const grezzo =
    p.soldi * soldi + p.durata * durata + p.campo * campo + p.ambizione * ambizione + p.ruolo * ruolo;
  return Math.round(Math.max(0, Math.min(1, grezzo)) * 100);
}

/** Sotto questo punteggio non firma con nessuno: preferisce restare libero e aspettare. */
export const FREE_AGENT_MIN_SCORE = 46;

export interface FreeAgentVerdict {
  accepted: boolean;
  score: number;
  /** Il punteggio della migliore offerta rivale, per raccontare perché ha scelto. */
  rivalScore: number;
  rivalClubName?: string;
  message: string;
}

/**
 * Chi vince la corsa.
 *
 * L'esito non è mai "chi offre di più": è chi ottiene il punteggio più alto **sulla sua** scala.
 * Un pizzico di rumore seedato impedisce che la scelta sia un calcolo esatto ripetibile a mente,
 * ma resta stabile a parità di offerta — ricaricare un salvataggio non cambia il verdetto.
 */
export function resolveFreeAgentBids(
  agent: FreeAgent,
  ourBid: FreeAgentBid,
  rivalBids: readonly FreeAgentBid[],
  seed: string,
  season: number,
): FreeAgentVerdict {
  const rumore = derivedRandom(seed, "faBid", agent.id, season);
  const nostro = freeAgentBidScore(agent, ourBid) + (rumore() - 0.5) * 6;

  let miglioreRivale = 0;
  let nomeRivale: string | undefined;
  for (const bid of rivalBids) {
    const punteggio = freeAgentBidScore(agent, bid) + (rumore() - 0.5) * 6;
    if (punteggio > miglioreRivale) {
      miglioreRivale = punteggio;
      nomeRivale = bid.clubName;
    }
  }

  const score = Math.round(nostro);
  const rivalScore = Math.round(miglioreRivale);

  if (score < FREE_AGENT_MIN_SCORE) {
    return {
      accepted: false,
      score,
      rivalScore,
      rivalClubName: nomeRivale,
      message: "Non è la proposta che aspettavo. Preferisco aspettare ancora.",
    };
  }
  if (rivalScore > score) {
    return {
      accepted: false,
      score,
      rivalScore,
      rivalClubName: nomeRivale,
      message: nomeRivale
        ? `Mi dispiace, Direttore: ho accettato la proposta del ${nomeRivale}.`
        : "Ho ricevuto una proposta migliore altrove.",
    };
  }
  return {
    accepted: true,
    score,
    rivalScore,
    rivalClubName: nomeRivale,
    message: "Ci sto: firmo con voi.",
  };
}

/* -------------------------------------------------------------------------- */
/* La concorrenza dell'IA                                                      */
/* -------------------------------------------------------------------------- */

export interface RivalClubInfo {
  clubId: string;
  clubName: string;
  prestige: number;
  /** Margine di cassa ingaggi del club, in €/anno: senza spazio non può offrire. */
  wageRoom: number;
  /** Il reparto che gli manca davvero: fuori da lì non si muove. */
  needs: readonly Department[];
  /** Livello del suo undici: decide se offrirebbe la titolarità a questo giocatore. */
  elevenAverage: number;
}

/**
 * Le offerte che i club IA presentano allo stesso svincolato.
 *
 * Un club offre solo se: gli serve quel reparto, ha spazio a bilancio, e il giocatore è alla sua
 * portata. Le tre condizioni insieme sono ciò che rende battibile un club più ricco — spesso il
 * grande non ha bisogno di quel ruolo, o non gli garantirebbe mai il posto.
 */
export function rivalBidsFor(
  agent: FreeAgent,
  rivals: readonly RivalClubInfo[],
  seed: string,
  season: number,
): FreeAgentBid[] {
  const bids: FreeAgentBid[] = [];

  for (const club of rivals) {
    const random = derivedRandom(seed, "faRival", agent.id, club.clubId, season);
    if (!club.needs.includes(agent.department)) continue;
    if (club.wageRoom < agent.askingWage * 0.85) continue;
    // Un club molto più forte non perde tempo con chi non alzerebbe il livello.
    if (club.elevenAverage - agent.overall > 6) continue;
    if (random() > 0.65) continue;

    const generosita = 0.9 + random() * 0.45;
    bids.push({
      clubId: club.clubId,
      clubName: club.clubName,
      prestige: club.prestige,
      wage: Math.min(club.wageRoom, Math.round(agent.askingWage * generosita)),
      seasons: agent.askingSeasons,
      // Il posto da titolare lo promette solo chi ne ha davvero bisogno.
      guaranteedStarter: agent.overall >= club.elevenAverage + 1,
      captain: false,
      ambitionTarget: club.prestige >= 4 ? 3 : club.prestige >= 3 ? 7 : 12,
    });
  }

  return bids;
}
