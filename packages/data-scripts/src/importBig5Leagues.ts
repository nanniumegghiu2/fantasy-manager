import xlsx from "xlsx";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb } from "./db";
import { ageAt, computeContextPrior, computeMarketValue } from "@app/game-engine";
import type { Role } from "@app/shared-types";
import { BIG5_LEAGUES, NATION_IT, type LeagueSeed } from "../seeds/big5-leagues";

/**
 * Importa gli altri quattro campionati Big 5 (Premier League, La Liga, Bundesliga,
 * Ligue 1) dal foglio `Cartel1.xlsx`, usando **solo le colonne fattuali**: nome, data di
 * nascita, nazionalità, club e posizione tattica. Le colonne `overall` e `Valore` del
 * foglio non vengono lette (CLAUDE.md sez. 2.2): l'Overall di partenza è calcolato dal
 * nostro `computeContextPrior` e il valore di mercato dal nostro `computeMarketValue`.
 *
 * Uso: `pnpm import-big5` (dry run) oppure `pnpm import-big5 -- --apply`.
 * Rieseguirlo cancella e ricrea i quattro campionati, quindi è ripetibile senza duplicati.
 */

/** Stessa mappa posizione→casella usata da `importRolesFromSheet.ts` (sez. 3.1). */
const POSITION_TO_ROLE: Record<string, Role> = {
  GK: "POR",
  RB: "TD",
  RWB: "QD",
  CB: "DC",
  LB: "TS",
  LWB: "QS",
  CDM: "MED",
  CM: "CC",
  RM: "ED",
  LM: "ES",
  CAM: "TRQ",
  RW: "TQD",
  LW: "TQS",
  ST: "ATT",
  CF: "ATT",
};

/** Terzino ↔ quinto: stessa regola dell'import Serie A, altrimenti le caselle Quinto restano vuote. */
const INTERCHANGEABLE: Partial<Record<Role, Role>> = { TD: "QD", QD: "TD", TS: "QS", QS: "TS" };

/** Prestigio calcistico della nazionalità (1-5), stessa scala del valore di mercato (sez. 2.3). */
const NATION_PRESTIGE: Record<string, number> = {
  Brasile: 5,
  Francia: 5,
  Argentina: 5,
  Germania: 5,
  Spagna: 5,
  Italia: 5,
  Inghilterra: 5,
  Portogallo: 4,
  "Paesi Bassi": 4,
  Belgio: 4,
  Uruguay: 4,
  Croazia: 4,
};

/** La stagione di riferimento, coerente con la Serie A già in database. */
const ERA = "2025/26";
const SEASON_REFERENCE = new Date("2026-01-01");

interface SheetRow {
  "Nome Completo": string | null;
  Posizione: string | null;
  "Nome Club": string | null;
  Campionato: string | null;
  Nazionalità: string | null;
  "Data di nascita": number | null;
}

/** Le date del foglio sono seriali Excel (giorni dal 30/12/1899). */
function excelDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
}

/**
 * Nome mostrabile a partire dal nome legale del foglio.
 *
 * Il foglio riporta l'anagrafica completa — "Abdul-Nasir Oluwatosin Oluwadoyinsolami
 * Adarabioyo" — che in una lista di draft è illeggibile, e sul campo verrebbe troncata a
 * metà. Sopra le tre parole si tiene solo la prima e l'ultima. Alcune parti del foglio
 * incollano al nome la versione in alfabeto non latino: viene rimossa.
 *
 * ⚠️ Limite noto: sui nomi spagnoli e portoghesi con due cognomi resta il **secondo**
 * ("Álvaro Borja Morata Martín" → "Álvaro Martín") mentre quello d'uso è il primo. Non è
 * distinguibile automaticamente da un nome composto di altra origine; i casi che danno
 * fastidio si correggono a mano, come per i ruoli.
 */
function displayName(fullName: string): string {
  const cleaned = fullName
    .replace(/[^\p{Script=Latin}\p{M}\s'’.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length <= 3) return cleaned;
  return `${parts[0]} ${parts.at(-1)}`;
}

function rolesFromPositions(positions: string): { role: Role; secondary: Role[] } | null {
  const mapped = positions
    .split(",")
    .map((p) => POSITION_TO_ROLE[p.trim().toUpperCase()])
    .filter((r): r is Role => !!r);
  if (mapped.length === 0) return null;

  const [role, ...rest] = mapped;
  const secondary = new Set(rest.filter((r) => r !== role));
  const twin = INTERCHANGEABLE[role];
  if (twin) secondary.add(twin);
  for (const other of rest) {
    const otherTwin = INTERCHANGEABLE[other];
    if (otherTwin && otherTwin !== role) secondary.add(otherTwin);
  }
  return { role, secondary: [...secondary] };
}

function sheetPath(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../Cartel1.xlsx");
}

interface PreparedPlayer {
  name: string;
  nation: string;
  role: Role;
  secondary: Role[];
  overall: number;
  clubName: string;
}

function prepareLeague(rows: SheetRow[], league: LeagueSeed): PreparedPlayer[] {
  const players: PreparedPlayer[] = [];
  /** Quanti club della stessa era saranno in database: alimenta il moltiplicatore di densità (sez. 2.3). */
  for (const row of rows) {
    if (row.Campionato !== league.sheetLeague) continue;
    const clubName = row["Nome Club"];
    // L'elenco dei club è anche il filtro: tiene fuori i club ucraini sotto "Premier
    // League" e quelli austriaci sotto "Bundesliga".
    if (!clubName || !(clubName in league.clubs)) continue;
    if (!row["Nome Completo"] || !row.Posizione) continue;

    const resolved = rolesFromPositions(row.Posizione);
    if (!resolved) continue;

    const nation = NATION_IT[row.Nazionalità ?? ""] ?? row.Nazionalità ?? "—";
    const age = row["Data di nascita"]
      ? ageAt(excelDate(row["Data di nascita"]), SEASON_REFERENCE)
      : null;

    players.push({
      name: displayName(row["Nome Completo"]),
      nation,
      role: resolved.role,
      secondary: resolved.secondary,
      clubName,
      overall: computeContextPrior({
        age,
        clubPrestige: league.clubs[clubName],
        leaguePrestige: league.prestigeTier,
        nationPrestige: NATION_PRESTIGE[nation] ?? 3,
      }),
    });
  }
  return players;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rows: SheetRow[] = xlsx.utils.sheet_to_json(xlsx.readFile(sheetPath()).Sheets["DB"], {
    defval: null,
  });

  const prepared = BIG5_LEAGUES.map((league) => ({ league, players: prepareLeague(rows, league) }));

  for (const { league, players } of prepared) {
    const clubs = new Set(players.map((p) => p.clubName));
    const overalls = players.map((p) => p.overall);
    console.log(
      `${league.name.padEnd(15)} ${String(players.length).padStart(4)} giocatori, ` +
        `${clubs.size}/${Object.keys(league.clubs).length} club, ` +
        `Overall ${Math.min(...overalls)}-${Math.max(...overalls)}`,
    );
    const missing = Object.keys(league.clubs).filter((c) => !clubs.has(c));
    if (missing.length) console.log(`   club senza giocatori nel foglio: ${missing.join(", ")}`);
  }

  const total = prepared.reduce((sum, p) => sum + p.players.length, 0);
  console.log(`\nTotale da importare: ${total} giocatori`);

  if (!apply) {
    console.log("(dry run — rilancia con --apply per scrivere)");
    return;
  }

  const client = await connectDb();
  try {
    await client.query("begin");

    // Ricrea da zero i quattro campionati: rende lo script rieseguibile senza duplicati.
    // La Serie A non viene toccata (non è nell'elenco).
    const names = BIG5_LEAGUES.map((l) => l.name);
    await client.query(
      `delete from player_pool where club_id in (
         select c.id from clubs c join leagues l on l.id = c.league_id where l.name = any($1))`,
      [names],
    );
    await client.query(
      `delete from clubs where league_id in (select id from leagues where name = any($1))`,
      [names],
    );
    await client.query(`delete from leagues where name = any($1)`, [names]);

    /** Club per era, per il moltiplicatore di densità del valore di mercato (sez. 2.3). */
    const { rows: eraRows } = await client.query<{ n: number }>(
      `select count(*)::int n from clubs where era = $1`,
      [ERA],
    );
    const clubsInSameEra =
      eraRows[0].n + BIG5_LEAGUES.reduce((sum, l) => sum + Object.keys(l.clubs).length, 0);

    for (const { league, players } of prepared) {
      const { rows: leagueRow } = await client.query<{ id: string }>(
        `insert into leagues (name, nation, prestige_tier) values ($1, $2, $3) returning id`,
        [league.name, league.nation, league.prestigeTier],
      );
      const leagueId = leagueRow[0].id;

      const clubIds = new Map<string, string>();
      for (const [clubName, tier] of Object.entries(league.clubs)) {
        const { rows: clubRow } = await client.query<{ id: string }>(
          `insert into clubs (name, league_id, era, prestige_tier) values ($1, $2, $3, $4) returning id`,
          [clubName, leagueId, ERA, tier],
        );
        clubIds.set(clubName, clubRow[0].id);
      }

      for (const player of players) {
        const clubId = clubIds.get(player.clubName);
        if (!clubId) throw new Error(`Club senza id: "${player.clubName}" (${league.name})`);
        const marketValue = computeMarketValue({
          overall: player.overall,
          leaguePrestigeTier: league.prestigeTier,
          clubPrestigeTier: league.clubs[player.clubName],
          nationPrestigeTier: NATION_PRESTIGE[player.nation] ?? 3,
          clubsInSameEra,
        });
        await client.query(
          `insert into player_pool (name, nation, role, secondary_roles, overall, overall_override, market_value, club_id)
           values ($1, $2, $3::player_role, $4::player_role[], $5, $5, $6, $7)`,
          [
            player.name,
            player.nation,
            player.role,
            player.secondary,
            player.overall,
            marketValue,
            clubId,
          ],
        );
      }
      console.log(`${league.name}: importato`);
    }

    await client.query("commit");
  } catch (error: any) {
    await client.query("rollback");
    console.error("FALLITO:", error.message, "|", error.detail ?? "");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
