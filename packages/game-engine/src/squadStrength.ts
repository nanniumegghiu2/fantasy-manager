/**
 * Da una rosa (o da un undici) ai due numeri che la simulazione mette a confronto:
 * **attacco** e **difesa** (`TeamStrength`).
 *
 * Questa logica viveva in `apps/web/src/classic/engineHelpers.ts`, cioè dentro l'app React,
 * pur essendo pura e perfettamente testabile senza DOM. È risalita qui perché la DS mode ha
 * bisogno delle stesse identiche formule — se ne esistessero due copie, la calibrazione del
 * motore varrebbe per una sola delle due modalità. `engineHelpers.ts` mantiene dei re-export
 * sottili, quindi la Modalità Classica non cambia un import.
 */
import {
  computeChemistryBonus,
  computeChemistryLink,
  computeDepartmentChemistryLinks,
} from "./chemistry";
import { computeAllDepartmentRatings, computeDepartmentRating, computeSquadRating } from "./rating";
import { formationBoardEdges } from "./board";
import { DIFFICULTY_OPPONENT_MODIFIER, LEAGUE_SIZE } from "./championship";
import type { LeagueTeam, ScorerCandidate, TeamStrength } from "./championship";
import type { ClubPackage, Difficulty } from "./draft";
import type { ChemistryLink, Department, Formation, Player } from "@app/shared-types";

export const DEPARTMENTS: Department[] = ["POR", "DIF", "CC", "ATT"];

/** Titolari per casella del modulo: `slotId` → giocatore. */
export type StartersBySlot = Record<string, Player>;

/**
 * Come i reparti si traducono nei due lati che la simulazione confronta. Il centrocampo pesa
 * su entrambi, perché chi domina a metà campo crea occasioni **e** ne concede meno; il
 * portiere conta solo in difesa.
 */
export const ATTACK_MIX: Record<Department, number> = { ATT: 0.62, CC: 0.38, DIF: 0, POR: 0 };
export const DEFENCE_MIX: Record<Department, number> = { DIF: 0.55, POR: 0.28, CC: 0.17, ATT: 0 };

/** Un reparto ancora vuoto vale come il minimo della scala: non deve regalare forza. */
const EMPTY_DEPARTMENT_VALUE = 60;

/**
 * Quanti titolari per reparto ha una formazione tipo, per costruire l'undici di un club
 * avversario **come una squadra vera**. Prendendo semplicemente gli 11 col Overall più alto
 * uscivano formazioni impossibili — l'undici del PSG risultava 6 centrocampisti, 4 difensori,
 * 1 attaccante e **zero portieri**, e con il reparto vuoto il calcolo ripiegava sulla media
 * di squadra, inventando a ogni grande club un portiere fantasma più forte di quello vero.
 */
export const OPPONENT_SHAPE: Record<Department, number> = { POR: 1, DIF: 4, CC: 4, ATT: 2 };

/** L'undici che un club schiererebbe: i suoi migliori per ogni reparto, secondo `OPPONENT_SHAPE`. */
export function bestElevenByDepartment(players: Player[]): Player[] {
  return DEPARTMENTS.flatMap((department) =>
    players
      .filter((p) => p.department === department)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, OPPONENT_SHAPE[department]),
  );
}

/** Peso relativo di un reparto nel segnare un gol (placeholder di bilanciamento dichiarato). */
const ROLE_GOAL_WEIGHT: Record<Department, number> = { ATT: 3, CC: 1.5, DIF: 0.5, POR: 0.05 };

/**
 * Pool di marcatori pesato per reparto e Overall. Usato sia per la propria rosa sia per le
 * avversarie, così i gol subiti seguono la stessa logica di quelli fatti.
 */
export function buildScorerPool(players: Player[]): ScorerCandidate[] {
  return players.map((p) => ({ id: p.id, weight: p.overall * ROLE_GOAL_WEIGHT[p.department] }));
}

/** Bonus intesa calcolato sulle coppie di caselle adiacenti sullo scacchiere (sez. 3.4). */
export function squadChemistry(
  formation: Formation,
  starters: StartersBySlot,
): { links: ChemistryLink[]; bonus: number } {
  const links = formationBoardEdges(formation)
    .map((edge) => [starters[edge.slotAId], starters[edge.slotBId]] as const)
    .filter((pair): pair is [Player, Player] => !!pair[0] && !!pair[1])
    .map(([a, b]) => computeChemistryLink(a, b));
  return { links, bonus: computeChemistryBonus(links) };
}

/** Rating per reparto sui titolari schierati (null se il reparto non ha ancora nessuno). */
export function departmentRatings(starters: StartersBySlot): Record<Department, number | null> {
  const result = {} as Record<Department, number | null>;
  for (const department of DEPARTMENTS) {
    const group = Object.values(starters).filter((p) => p.department === department);
    result[department] = group.length > 0 ? computeDepartmentRating(group) : null;
  }
  return result;
}

/**
 * Opzioni previste per la DS mode. Tutte facoltative e neutre di default: la Modalità
 * Classica passa solo formazione e titolari e ottiene esattamente i numeri di sempre.
 */
export interface SquadStrengthOptions {
  /**
   * Sostituisce il bonus intesa calcolato dai tratti condivisi. In DS mode al suo posto va
   * l'**affiatamento** (anni insieme, nazionalità, familiarità col modulo), perché con una
   * sola epoca in database l'intesa classica è degenere e penalizzerebbe ogni acquisto
   * straniero.
   */
  cohesionBonus?: number;
  /** Stile dell'allenatore: sposta i due lati in modo indipendente. */
  coachModifier?: { attack: number; defence: number };
  /** Penalità per casella (fuori ruolo, fatica, morale), sottratte al valore del giocatore. */
  penalties?: Record<string, number>;
}

/**
 * Forza offensiva e difensiva della rosa. Il bonus di coesione si somma a **entrambi** i
 * lati: una squadra affiatata difende e attacca meglio, non solo una delle due cose.
 */
export function computeSquadStrength(
  formation: Formation,
  starters: StartersBySlot,
  options: SquadStrengthOptions = {},
): TeamStrength {
  const penalized = applyPenalties(starters, options.penalties);
  const depts = departmentRatings(penalized);
  const bonus = options.cohesionBonus ?? squadChemistry(formation, starters).bonus;
  const value = (department: Department) => depts[department] ?? EMPTY_DEPARTMENT_VALUE;

  const side = (mix: Record<Department, number>, coach: number) =>
    Math.round(
      DEPARTMENTS.reduce((sum, department) => sum + mix[department] * value(department), 0) +
        bonus +
        coach,
    );

  return {
    attack: side(ATTACK_MIX, options.coachModifier?.attack ?? 0),
    defence: side(DEFENCE_MIX, options.coachModifier?.defence ?? 0),
  };
}

/** Applica le penalità per casella producendo giocatori "effettivi", senza toccare gli originali. */
function applyPenalties(
  starters: StartersBySlot,
  penalties: Record<string, number> | undefined,
): StartersBySlot {
  if (!penalties) return starters;
  const result: StartersBySlot = {};
  for (const [slotId, player] of Object.entries(starters)) {
    const penalty = penalties[slotId] ?? 0;
    result[slotId] = penalty === 0 ? player : { ...player, overall: player.overall - penalty };
  }
  return result;
}

/** Overall complessivo mostrato all'utente: media dei reparti più il bonus di coesione. */
export function computeSquadOverallRating(
  formation: Formation,
  starters: StartersBySlot,
  options: SquadStrengthOptions = {},
): number {
  const startersByDepartment = Object.fromEntries(
    DEPARTMENTS.map((department) => [
      department,
      Object.values(starters).filter((p) => p.department === department),
    ]),
  ) as Record<Department, Player[]>;
  const ratings = computeAllDepartmentRatings(startersByDepartment);
  const bonus = options.cohesionBonus ?? squadChemistry(formation, starters).bonus;
  return computeSquadRating(ratings, bonus);
}

/**
 * Le avversarie del campionato, ricavate dai club reali del pool: la forza di un club è la
 * media degli Overall dell'undici che schiererebbe.
 *
 * Un campionato reale ha già 20 squadre e le 38 giornate ne richiedono esattamente 20
 * contando la nostra: si tengono le **19 più forti** e la più scarsa cede il posto.
 *
 * **L'intesa vale per entrambi i lati.** Prima si sommava solo alla nostra rosa e, dato che in
 * database c'è una sola epoca, in un campionato singolo *ogni* coppia condivide lega ed epoca:
 * qualunque rosa — anche la peggiore possibile — incassava il massimo mentre le avversarie
 * prendevano zero. Era un regalo fisso di 10 punti che portava una rosa da 70 a giocarsela da
 * 80. Ora la ricevono anche i club reali, che essendo compagni di squadra se la meritano.
 */
export function buildLeagueOpponents(
  packages: ClubPackage[],
  clubNames: Record<string, string>,
  /** Competizione scelta: `null` = tutti i club del pool (Superlega, solo Modalità Classica). */
  league: string | null = null,
  /** Difficoltà scelta in setup: sposta la forza delle avversarie. */
  difficulty: Difficulty = "normale",
): LeagueTeam[] {
  const modifier = DIFFICULTY_OPPONENT_MODIFIER[difficulty];
  return packages
    .filter((pkg) => pkg.players.length > 0)
    .filter((pkg) => league === null || pkg.players[0]?.league === league)
    .map((pkg) => {
      const bestEleven = bestElevenByDepartment(pkg.players);
      const rating = bestEleven.reduce((sum, p) => sum + p.overall, 0) / bestEleven.length;
      const byDepartment = (department: Department) => {
        const group = bestEleven.filter((p) => p.department === department);
        return group.length > 0 ? group.reduce((s, p) => s + p.overall, 0) / group.length : rating;
      };
      const chemistry = computeChemistryBonus(computeDepartmentChemistryLinks(bestEleven));
      const attack = Math.round(
        ATTACK_MIX.ATT * byDepartment("ATT") + ATTACK_MIX.CC * byDepartment("CC") + chemistry + modifier,
      );
      const defence = Math.round(
        DEFENCE_MIX.DIF * byDepartment("DIF") +
          DEFENCE_MIX.POR * byDepartment("POR") +
          DEFENCE_MIX.CC * byDepartment("CC") +
          chemistry +
          modifier,
      );
      return {
        id: pkg.clubId,
        name: clubNames[pkg.clubId] ?? "Club",
        rating: Math.round(rating),
        strength: { attack, defence },
        // Solo l'undici titolare: chi segna contro di noi è uno che quella squadra
        // schiererebbe davvero, non l'ultimo della rosa.
        scorers: buildScorerPool(bestEleven),
      };
    })
    .sort((a, b) => b.rating - a.rating)
    .slice(0, LEAGUE_SIZE - 1);
}
