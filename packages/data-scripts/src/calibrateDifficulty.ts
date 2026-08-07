/**
 * Calibrazione della **difficoltà** (CLAUDE.md sez. 3.2/3.5).
 *
 * Obiettivi dichiarati dall'utente:
 *  - **facile**: vincere il campionato dev'essere la norma, ed è il livello in cui il 38-0-0
 *    è più abbordabile;
 *  - **normale**: una via di mezzo;
 *  - **difficile**: vincere è già impegnativo, il 38-0-0 un'impresa.
 *
 * Il punto delicato è che la difficoltà cambia **due** cose insieme: la forza delle
 * avversarie (`DIFFICULTY_OPPONENT_MODIFIER`) e la qualità dei giocatori che escono nei
 * pacchetti (`QUALITY_BIAS`, sez. 3.2). Misurarle separatamente darebbe numeri che non si
 * verificano mai in partita, quindi qui la rosa viene **davvero pescata** con la stessa
 * funzione del gioco, difficoltà per difficoltà.
 *
 * Strumento di sola lettura: non tocca il database.
 */
import {
  DIFFICULTY_OPPONENT_MODIFIER,
  FORMATIONS,
  LEAGUE_SIZE,
  aggregateRecord,
  candidatesForRequirement,
  computeChemistryBonus,
  computeChemistryLink,
  computeDepartmentChemistryLinks,
  computeDepartmentRating,
  formationBoardEdges,
  isPerfectRecord,
  openRequirements,
  simulateLeagueSeason,
} from "@app/game-engine";
import type { Difficulty, LeagueTeam, TeamStrength } from "@app/game-engine";
import type { Department, Player } from "@app/shared-types";
import { connectDb } from "./db";

const DEPARTMENTS: Department[] = ["POR", "DIF", "CC", "ATT"];
const ATTACK_MIX: Record<Department, number> = { ATT: 0.62, CC: 0.38, DIF: 0, POR: 0 };
const DEFENCE_MIX: Record<Department, number> = { DIF: 0.55, POR: 0.28, CC: 0.17, ATT: 0 };
const OPPONENT_SHAPE: Record<Department, number> = { POR: 1, DIF: 4, CC: 4, ATT: 2 };
const DIFFICULTIES: Difficulty[] = ["facile", "normale", "difficile"];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Le avversarie, esattamente come `buildLeagueOpponents` nella UI (modificatore compreso). */
function buildOpponents(
  pool: Player[],
  clubNames: Map<string, string>,
  league: string | null,
  difficulty: Difficulty,
): LeagueTeam[] {
  const modifier = DIFFICULTY_OPPONENT_MODIFIER[difficulty];
  const byClub = new Map<string, Player[]>();
  for (const player of pool.filter((p) => league === null || p.league === league)) {
    const list = byClub.get(player.clubId);
    if (list) list.push(player);
    else byClub.set(player.clubId, [player]);
  }

  const teams: LeagueTeam[] = [...byClub.entries()]
    .map(([clubId, players]) => {
      const best = DEPARTMENTS.flatMap((d) =>
        players
          .filter((p) => p.department === d)
          .sort((a, b) => b.overall - a.overall)
          .slice(0, OPPONENT_SHAPE[d]),
      );
      const rating = best.reduce((s, p) => s + p.overall, 0) / best.length;
      const byDepartment = (department: Department) => {
        const group = best.filter((p) => p.department === department);
        return group.length > 0 ? group.reduce((s, p) => s + p.overall, 0) / group.length : rating;
      };
      const chemistry = computeChemistryBonus(computeDepartmentChemistryLinks(best));
      return {
        id: clubId,
        name: clubNames.get(clubId) ?? "Club",
        rating: Math.round(rating),
        strength: {
          attack: Math.round(0.62 * byDepartment("ATT") + 0.38 * byDepartment("CC") + chemistry + modifier),
          defence: Math.round(
            0.55 * byDepartment("DIF") + 0.28 * byDepartment("POR") + 0.17 * byDepartment("CC") + chemistry + modifier,
          ),
        },
      };
    })
    .sort((a, b) => b.rating - a.rating)
    .slice(0, LEAGUE_SIZE - 1);

  const needed = LEAGUE_SIZE - 1;
  if (teams.length < needed && teams.length > 0) {
    const average = Math.round(teams.reduce((s, t) => s + t.rating, 0) / teams.length);
    for (let i = teams.length; i < needed; i++) {
      teams.push({ id: `filler-${i}`, name: `Avversaria ${i + 1}`, rating: average });
    }
  }
  return teams;
}

/**
 * Una rosa pescata **davvero**, in modalità "per ruolo": per ogni casella si estrae un
 * pacchetto di candidati con la stessa funzione del gioco (che applica `QUALITY_BIAS`) e si
 * prende il migliore, come farebbe un giocatore attento. È il modo per misurare la
 * difficoltà come la vive chi gioca, invece di assumere una rosa ideale.
 */
function draftSquad(pool: Player[], difficulty: Difficulty, random: () => number) {
  const formation = FORMATIONS.find((f) => f.name === "4-3-3")!;
  const squad: Record<string, Player> = {};
  const taken = new Set<string>();

  for (const requirement of openRequirements({ formation, filledStarterSlotIds: new Set() })) {
    const available = pool.filter((p) => !taken.has(p.id));
    const candidates = candidatesForRequirement(available, requirement, random, undefined, difficulty);
    const pick = candidates.sort((a, b) => b.overall - a.overall)[0];
    if (!pick) continue;
    taken.add(pick.id);
    squad[requirement.id] = pick;
  }

  const links = formationBoardEdges(formation)
    .map((e) => [squad[e.slotAId], squad[e.slotBId]] as const)
    .filter(([a, b]) => !!a && !!b)
    .map(([a, b]) => computeChemistryLink(a, b));
  const chemistry = computeChemistryBonus(links);

  const departments = {} as Record<Department, number>;
  for (const d of DEPARTMENTS) {
    const group = Object.values(squad).filter((p) => p.department === d);
    departments[d] = group.length > 0 ? computeDepartmentRating(group) : 60;
  }
  const side = (mix: Record<Department, number>) =>
    Math.round(DEPARTMENTS.reduce((s, d) => s + mix[d] * departments[d], 0) + chemistry);

  return {
    strength: { attack: side(ATTACK_MIX), defence: side(DEFENCE_MIX) } as TeamStrength,
    average: Math.round(
      Object.values(squad).reduce((s, p) => s + p.overall, 0) / Math.max(Object.keys(squad).length, 1),
    ),
  };
}

async function main() {
  const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 200);
  // Override da riga di comando per provare tarature senza ricompilare il motore.
  const override = process.argv.find((a) => a.startsWith("--mod="))?.split("=")[1];
  if (override) {
    const [f, n, d] = override.split(",").map(Number);
    DIFFICULTY_OPPONENT_MODIFIER.facile = f!;
    DIFFICULTY_OPPONENT_MODIFIER.normale = n!;
    DIFFICULTY_OPPONENT_MODIFIER.difficile = d!;
  }
  const client = await connectDb();
  const { rows } = await client.query<{
    id: string;
    name: string;
    overall: number;
    club_id: string;
    club: string;
    league: string;
    era: string;
    nation: string;
    role: string;
    secondary_roles: string[];
    department: string;
  }>(
    `select p.id, p.name, p.overall, p.club_id, c.name as club, l.name as league,
            c.era, p.nation, p.role::text as role,
            coalesce(p.secondary_roles::text[], '{}') as secondary_roles, p.department
     from player_pool p
     join clubs c on c.id = p.club_id
     join leagues l on l.id = c.league_id`,
  );
  await client.end();

  const clubNames = new Map(rows.map((r) => [r.club_id, r.club]));
  const pool: Player[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    overall: r.overall,
    marketValue: 0,
    clubId: r.club_id,
    era: r.era,
    nation: r.nation,
    league: r.league,
    role: r.role as Player["role"],
    secondaryRoles: r.secondary_roles as Player["secondaryRoles"],
    department: r.department as Department,
  }));

  const competitions: { label: string; league: string | null }[] = [
    { label: "Superlega", league: null },
    ...[...new Set(pool.map((p) => p.league))].sort().map((l) => ({ label: l, league: l })),
  ];

  console.log(`Modificatore avversarie: ${JSON.stringify(DIFFICULTY_OPPONENT_MODIFIER)}`);
  console.log(`Rose pescate davvero (modalità per ruolo, ${runs} draft per riga)\n`);

  const table: Record<string, string | number>[] = [];
  for (const competition of competitions) {
    for (const difficulty of DIFFICULTIES) {
      const random = mulberry32(7);
      const opponents = buildOpponents(pool, clubNames, competition.league, difficulty);
      // Il pool del draft segue la competizione, tranne in Superlega dove è tutto.
      const draftPool = competition.league === null ? pool : pool.filter((p) => p.league === competition.league);

      let titles = 0;
      let perfect = 0;
      let top4 = 0;
      let points = 0;
      let averageOverall = 0;
      for (let i = 0; i < runs; i++) {
        const { strength, average } = draftSquad(draftPool, difficulty, random);
        averageOverall += average;
        const season = simulateLeagueSeason(strength, [], opponents, random);
        const row = season.standings.find((s) => s.isUser)!;
        if (row.position === 1) titles++;
        if (row.position <= 4) top4++;
        points += row.points;
        if (isPerfectRecord(aggregateRecord(season.userMatches))) perfect++;
      }

      table.push({
        competizione: competition.label,
        difficoltà: difficulty,
        "rosa media": Math.round(averageOverall / runs),
        "titoli": `${((titles / runs) * 100).toFixed(0)}%`,
        "primi 4": `${((top4 / runs) * 100).toFixed(0)}%`,
        "punti": Math.round(points / runs),
        "38-0-0": `${((perfect / runs) * 100).toFixed(1)}%`,
      });
    }
  }
  console.table(table);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
