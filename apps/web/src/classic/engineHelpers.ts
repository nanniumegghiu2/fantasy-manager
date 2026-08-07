import {
  buildLeagueOpponents as buildLeagueOpponentsFromEngine,
  buildScorerPool as buildScorerPoolFromEngine,
  computeChemistryLink,
  computeSquadOverallRating as computeSquadOverallRatingFromEngine,
  computeSquadStrength as computeSquadStrengthFromEngine,
  departmentRatings as departmentRatingsFromEngine,
  eligibleClubPackages,
  formationBoardEdges,
  squadChemistry,
} from "@app/game-engine";
import type {
  ClubPackage,
  DraftProgress,
  DraftRequirement,
  TeamStrength,
} from "@app/game-engine";
import type {
  ChemistryColor,
  ChemistryLink,
  Department,
  Formation,
  Player,
} from "@app/shared-types";
import type { SquadAssignment } from "./types";

/** Stato di una linea di chemistry sul campo: "off" (led spento, manca ancora un giocatore) o un colore reale. */
export type LineState = "off" | ChemistryColor;

export interface SquadLine {
  slotAId: string;
  slotBId: string;
  state: LineState;
}

interface BoardEdge {
  slotAId: string;
  slotBId: string;
  playerA?: Player;
  playerB?: Player;
}

/**
 * Coppie di slot ADIACENTI sullo "scacchiere" tattico (sez. 3.1/3.4 CLAUDE.md), decorate
 * con i giocatori assegnati. La topologia vive tutta in `formationBoardEdges`
 * (`packages/game-engine/src/board.ts`), che sa già distribuire un arco ruolo→ruolo sulle
 * caselle reali quando un ruolo centrale è schierato più volte. Unica fonte di verità
 * riusata sia per le linee visive (`squadLines`) sia per il bonus chemistry numerico
 * (`computeSquadChemistry`).
 */
function boardEdges(formation: Formation, assignment: SquadAssignment): BoardEdge[] {
  return formationBoardEdges(formation).map((edge) => ({
    slotAId: edge.slotAId,
    slotBId: edge.slotBId,
    playerA: assignment.starters[edge.slotAId],
    playerB: assignment.starters[edge.slotBId],
  }));
}

/** "led spento" finché uno dei due slot adiacenti è vuoto, altrimenti il colore reale della chemistry. */
export function squadLines(formation: Formation, assignment: SquadAssignment): SquadLine[] {
  return boardEdges(formation, assignment).map((edge) => ({
    slotAId: edge.slotAId,
    slotBId: edge.slotBId,
    state: edge.playerA && edge.playerB ? computeChemistryLink(edge.playerA, edge.playerB).color : "off",
  }));
}

export function toProgress(formation: Formation, assignment: SquadAssignment): DraftProgress {
  return {
    formation,
    filledStarterSlotIds: new Set(Object.keys(assignment.starters)),
  };
}

export function assignPlayer(
  assignment: SquadAssignment,
  req: DraftRequirement,
  player: Player,
): SquadAssignment {
  return { ...assignment, starters: { ...assignment.starters, [req.id]: player } };
}

export function assignedPlayerIds(assignment: SquadAssignment): Set<string> {
  return new Set(Object.values(assignment.starters).map((p) => p.id));
}

/** Pool giocatori/pacchetti al netto di chi è già stato assegnato: un giocatore reale non può finire in due slot. */
export function remainingPlayers(players: Player[], assignment: SquadAssignment): Player[] {
  const assigned = assignedPlayerIds(assignment);
  return players.filter((p) => !assigned.has(p.id));
}

export function remainingPackages(packages: ClubPackage[], assignment: SquadAssignment): ClubPackage[] {
  const assigned = assignedPlayerIds(assignment);
  return packages
    .map((pkg) => ({ clubId: pkg.clubId, players: pkg.players.filter((p) => !assigned.has(p.id)) }))
    .filter((pkg) => pkg.players.length > 0);
}

export function drawPackage(packages: ClubPackage[], progress: DraftProgress): ClubPackage | null {
  const eligible = eligibleClubPackages(packages, progress);
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/**
 * Le avversarie del campionato, ricavate dai club reali del pool: la forza di un club è la
 * media degli Overall dell'undici che schiererebbe (vedi `bestElevenByDepartment`).
 *
 * Un campionato reale ha già 20 squadre, e le nostre 38 giornate ne richiedono esattamente
 * 20 contando la squadra del giocatore: si tengono quindi le **19 più forti** e si lascia
 * fuori la più scarsa, che cede il posto alla nostra. Nessuna estrazione casuale — la
 * classifica finale è la stessa competizione ogni volta, non un gruppo diverso a ogni
 * partita.
 *
 * **L'intesa vale per entrambi i lati.** Prima il bonus intesa si sommava solo alla nostra
 * rosa: dato che in database c'è una sola epoca, in un campionato singolo *ogni* coppia
 * condivide lega ed epoca, quindi qualunque rosa — anche la peggiore possibile — incassava
 * il massimo (+10) su attacco e difesa mentre le avversarie prendevano zero. Era un regalo
 * fisso di 10 punti che portava una rosa da 70 a giocarsela da 80, cioè in zona Europa.
 * Ora l'intesa la ricevono anche i club reali, che essendo compagni di squadra se la
 * meritano piena: in un campionato singolo i due bonus si annullano e conta solo la qualità
 * dei giocatori, mentre una rosa pescata da più campionati paga davvero la minore coesione.
 */
/**
 * Le avversarie del campionato. L'implementazione vive ora nel motore
 * (`packages/game-engine/src/squadStrength.ts`): è logica pura e la DS mode ha bisogno delle
 * stesse identiche formule. Qui resta solo il passaggio, così la Modalità Classica non cambia
 * un import.
 */
export const buildLeagueOpponents = buildLeagueOpponentsFromEngine;

/** Pool di marcatori pesato per reparto e Overall (implementazione nel motore). */
export const buildScorerPool = buildScorerPoolFromEngine;

/** Cognome per id, per tutti i giocatori del pool: serve a dare un nome anche ai marcatori avversari. */
export function buildNameById(players: Player[]): Record<string, string> {
  return Object.fromEntries(players.map((p) => [p.id, p.name.split(" ").at(-1) ?? p.name]));
}

/**
 * Pool ristretto alla competizione scelta. La scelta agisce **anche sul draft**, non solo
 * sulle avversarie: giocare "la Serie A" significa pescare da giocatori di Serie A e
 * affrontare i club di Serie A, com'era previsto in sez. 3.5 fin dall'inizio.
 */
export function filterPoolByLeague<T extends { league: string }>(
  players: T[],
  league: string | null,
): T[] {
  return league === null ? players : players.filter((p) => p.league === league);
}

export function filterPackagesByLeague(
  packages: ClubPackage[],
  league: string | null,
): ClubPackage[] {
  return league === null
    ? packages
    : packages.filter((pkg) => pkg.players[0]?.league === league);
}

/** Estrazione casuale senza ripetizioni di al più n elementi (usata per i pacchetti da 5, sez. 3.2). */
export function sampleN<T>(items: T[], n: number, random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/**
 * Le funzioni qui sotto sono passaggi verso il motore. Accettano ancora `SquadAssignment`
 * (la forma usata dalla UI) e girano al motore i soli titolari: è l'unico adattamento
 * rimasto fra i due mondi.
 */

/** Bonus intesa calcolato sulle stesse coppie adiacenti mostrate sul campo (sez. 3.4). */
export function computeSquadChemistry(
  formation: Formation,
  assignment: SquadAssignment,
): { links: ChemistryLink[]; bonus: number } {
  return squadChemistry(formation, assignment.starters);
}

/** Rating per reparto sui titolari assegnati finora (null se il reparto è ancora vuoto). */
export function departmentRatings(assignment: SquadAssignment): Record<Department, number | null> {
  return departmentRatingsFromEngine(assignment.starters);
}

/** Forza offensiva e difensiva della rosa, per la simulazione del campionato (sez. 3.5). */
export function computeSquadStrength(
  formation: Formation,
  assignment: SquadAssignment,
): TeamStrength {
  return computeSquadStrengthFromEngine(formation, assignment.starters);
}

export function computeSquadOverallRating(
  formation: Formation,
  assignment: SquadAssignment,
): number {
  return computeSquadOverallRatingFromEngine(formation, assignment.starters);
}
