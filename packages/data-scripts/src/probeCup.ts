/**
 * Sonda diagnostica sulla **Corona**: una squadra forte fa punti nel girone?
 *
 * Nasce da una segnalazione dell'utente ("la mia squadra fortissima non avanza mai") e serve a
 * misurare invece che ipotizzare: costruisce il torneo esattamente come lo costruisce l'app e
 * stampa la classifica del girone. Sola lettura, non tocca il database.
 */
import {
  bestElevenByDepartment,
  careerOpponentTeam,
  createCupState,
  cupStandings,
  simulateGroupRound,
  mulberry32,
  GROUP_ROUNDS,
  type LeagueTeam,
} from "@app/game-engine";
import { ROLE_DEPARTMENT } from "@app/shared-types";
import type { Player, Role } from "@app/shared-types";
import { connectDb } from "./db";

async function main() {
  const db = await connectDb();
  const { rows } = await db.query<{
    id: string;
    name: string;
    overall: number;
    role: Role;
    secondary_roles: Role[];
    club_id: string;
    nation: string;
    birth_date: string | null;
    market_value: number;
    league_id: string;
    club_name: string;
  }>(`
    select p.id, p.name, coalesce(p.overall_override, p.overall) as overall, p.role,
           p.secondary_roles, p.club_id, p.nation, p.birth_date, p.market_value,
           c.league_id, c.name as club_name
    from player_pool p join clubs c on c.id = p.club_id
  `);
  await db.end();

  const toPlayer = (r: (typeof rows)[number]): Player => ({
    id: r.id,
    name: r.name,
    overall: Number(r.overall),
    marketValue: Number(r.market_value),
    clubId: r.club_id,
    era: "",
    nation: r.nation,
    league: r.league_id,
    role: r.role,
    secondaryRoles: r.secondary_roles ?? [],
    department: ROLE_DEPARTMENT[r.role],
    birthDate: r.birth_date,
  });

  const perClub = new Map<string, Player[]>();
  const legaDi = new Map<string, string>();
  const nomeDi = new Map<string, string>();
  for (const r of rows) {
    const p = toPlayer(r);
    const el = perClub.get(r.club_id);
    if (el) el.push(p);
    else perClub.set(r.club_id, [p]);
    legaDi.set(r.club_id, r.league_id);
    nomeDi.set(r.club_id, r.club_name);
  }

  const forza = (id: string) => {
    const undici = bestElevenByDepartment(perClub.get(id) ?? []);
    return undici.length > 0 ? undici.reduce((s, p) => s + p.overall, 0) / undici.length : 70;
  };

  // Le prime quattro di ogni campionato, come fa `continentalEntrants`.
  const perLega = new Map<string, string[]>();
  for (const [clubId, lega] of legaDi) {
    const el = perLega.get(lega);
    if (el) el.push(clubId);
    else perLega.set(lega, [clubId]);
  }
  const entrants: string[] = [];
  const escluse: string[] = [];
  for (const [, clubs] of perLega) {
    const ord = [...clubs].sort((a, b) => forza(b) - forza(a));
    entrants.push(...ord.slice(0, 3));
    escluse.push(...ord.slice(3));
  }
  escluse.sort((a, b) => forza(b) - forza(a));
  const venti = [...entrants, ...escluse].slice(0, 16);

  const teams: LeagueTeam[] = venti.map((id) =>
    careerOpponentTeam({ id, name: nomeDi.get(id) ?? id, players: perClub.get(id) ?? [] }),
  );

  console.log("Iscritte alla Corona (forza dell'undici · attacco/difesa):");
  for (const t of [...teams].sort((a, b) => b.rating - a.rating)) {
    console.log(
      `  ${t.name.padEnd(24)} ${String(t.rating).padStart(3)}  ` +
        `${t.strength?.attack ?? "?"}/${t.strength?.defence ?? "?"}`,
    );
  }

  /**
   * **La domanda vera**: quante volte una squadra forte supera il girone?
   *
   * Una singola stagione non dice nulla — sei partite sono rumorose per definizione. Su
   * trecento sorteggi si vede invece se il formato premia la forza o la sorteggia.
   */
  const RIPETIZIONI = 300;
  const passaggi = new Map<string, number>();
  for (let r = 0; r < RIPETIZIONI; r++) {
    const st = createCupState({
      teams,
      leagueOf: (t) => legaDi.get(t.id) ?? "?",
      random: mulberry32(1000 + r),
    });
    for (let g = 0; g < GROUP_ROUNDS; g++) simulateGroupRound(st, mulberry32(50000 + r * 10 + g));
    for (const row of cupStandings(st).slice(0, 8)) {
      passaggi.set(row.teamId, (passaggi.get(row.teamId) ?? 0) + 1);
    }
  }

  console.log(
    `\nQualificazione ai quarti su ${RIPETIZIONI} stagioni (${teams.length} iscritte, 8 posti):`,
  );
  for (const t of [...teams].sort((a, b) => b.rating - a.rating)) {
    const quota = Math.round(((passaggi.get(t.id) ?? 0) / RIPETIZIONI) * 100);
    console.log(`  ${t.name.padEnd(24)} forza ${t.rating}  →  ${String(quota).padStart(3)}%`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
