import { computeMarketValue, computeOverallRatings, nationPrestigeTier } from "@app/game-engine";
import type { Department } from "@app/shared-types";
import { connectDb } from "./db";

const DEPARTMENTS: Department[] = ["POR", "DIF", "CC", "ATT"];

interface PlayerStatsRow {
  id: string;
  department: Department;
  appearances: number;
  goals: number;
  assists: number;
  trophies: number;
  caps: number;
  overall_override: number | null;
}

interface PlayerValueRow {
  id: string;
  overall: number;
  nation: string;
  era: string;
  club_prestige_tier: number;
  league_prestige_tier: number;
}

async function recomputeOveralls(client: import("pg").Client) {
  let updated = 0;
  for (const department of DEPARTMENTS) {
    const { rows } = await client.query<PlayerStatsRow>(
      `select id, department, appearances, goals, assists, trophies, caps, overall_override
       from player_pool where department = $1`,
      [department],
    );
    if (rows.length === 0) continue;

    const results = computeOverallRatings(
      rows.map((r) => ({
        id: r.id,
        department: r.department,
        stats: {
          appearances: r.appearances,
          goals: r.goals,
          assists: r.assists,
          trophies: r.trophies,
          caps: r.caps,
        },
      })),
    );

    const overrideById = new Map(rows.map((r) => [r.id, r.overall_override]));
    for (const { id, overall } of results) {
      if (overrideById.get(id) != null) continue; // l'override manuale vince sempre
      await client.query(`update player_pool set overall = $1 where id = $2`, [overall, id]);
      updated++;
    }
    console.log(`  ${department}: ${rows.length} giocatori nel pool, overall ricalcolato`);
  }
  console.log(`Overall aggiornati: ${updated} giocatori (override manuali non toccati).`);
}

async function recomputeMarketValues(client: import("pg").Client) {
  const { rows: eraCountsRows } = await client.query<{ era: string; count: string }>(
    `select era, count(*)::text as count from clubs group by era`,
  );
  const eraCounts = new Map(eraCountsRows.map((r) => [r.era, Number(r.count)]));

  const { rows } = await client.query<PlayerValueRow>(
    `select p.id, p.overall, p.nation, c.era, c.prestige_tier as club_prestige_tier,
            l.prestige_tier as league_prestige_tier
     from player_pool p
     join clubs c on c.id = p.club_id
     join leagues l on l.id = c.league_id`,
  );

  for (const row of rows) {
    const marketValue = computeMarketValue({
      overall: row.overall,
      leaguePrestigeTier: row.league_prestige_tier,
      clubPrestigeTier: row.club_prestige_tier,
      nationPrestigeTier: nationPrestigeTier(row.nation),
      clubsInSameEra: eraCounts.get(row.era) ?? 1,
    });
    await client.query(`update player_pool set market_value = $1 where id = $2`, [
      marketValue,
      row.id,
    ]);
  }
  console.log(`Valori di mercato aggiornati: ${rows.length} giocatori.`);
}

async function main() {
  const client = await connectDb();
  try {
    console.log("Ricalcolo Overall per reparto...");
    await recomputeOveralls(client);
    console.log("Ricalcolo valori di mercato...");
    await recomputeMarketValues(client);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
