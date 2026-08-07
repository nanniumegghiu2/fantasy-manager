import { useEffect, useState } from "react";
import { ROLE_DEPARTMENT } from "@app/shared-types";
import type { Player, Role } from "@app/shared-types";
import { fetchAllRows } from "../lib/fetchAllRows";
import { supabase } from "../lib/supabaseClient";

/**
 * Il **mondo della DS Mode**: giocatori, club e campionati, letti una volta sola e poi tenuti
 * in memoria per tutta la carriera.
 *
 * Perché non riusa `useDraftPool`: la Classica ha bisogno del nome del campionato per la
 * chemistry, questa modalità ha bisogno anche di `league_id` e dei **tier di prestigio** di
 * club e campionato, che servono al mercato per valutare i giocatori e agli allenatori per
 * decidere chi accetterebbe di allenarti. Sono due query diverse, non una vista della stessa.
 *
 * Nota permanente (CLAUDE.md sez. 9): ogni `select` è **paginato**. `player_pool` ha 2.586
 * righe e PostgREST ne restituirebbe 1000 in silenzio, senza errore.
 */

export interface DsClub {
  id: string;
  name: string;
  leagueId: string;
  leagueName: string;
  era: string;
  prestigeTier: number;
}

export interface DsLeague {
  id: string;
  name: string;
  nation: string;
  prestigeTier: number;
}

export interface DsWorldData {
  players: Player[];
  playersByClub: Map<string, Player[]>;
  clubs: DsClub[];
  clubsById: Map<string, DsClub>;
  leagues: DsLeague[];
  leaguesById: Map<string, DsLeague>;
}

interface PlayerRow {
  id: string;
  name: string;
  overall: number;
  market_value: number;
  club_id: string;
  nation: string;
  role: Role;
  secondary_roles: Role[];
  birth_date: string | null;
  clubs: { name: string; era: string; leagues: { name: string } | null } | null;
}

interface ClubRow {
  id: string;
  name: string;
  league_id: string;
  era: string;
  prestige_tier: number | null;
  leagues: { name: string } | null;
}

interface LeagueRow {
  id: string;
  name: string;
  nation: string;
  prestige_tier: number | null;
}

function toPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    overall: row.overall,
    marketValue: row.market_value,
    clubId: row.club_id,
    era: row.clubs?.era ?? "—",
    nation: row.nation,
    league: row.clubs?.leagues?.name ?? "—",
    role: row.role,
    secondaryRoles: row.secondary_roles ?? [],
    department: ROLE_DEPARTMENT[row.role],
    birthDate: row.birth_date,
  };
}

export function useDsWorld() {
  const [data, setData] = useState<DsWorldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [playerRows, clubRows, leagueRows] = await Promise.all([
          fetchAllRows<PlayerRow>((from, to) =>
            supabase
              .from("player_pool")
              .select("*, clubs(name, era, leagues(name))")
              .order("id")
              .range(from, to)
              .returns<PlayerRow[]>(),
          ),
          fetchAllRows<ClubRow>((from, to) =>
            supabase
              .from("clubs")
              .select("id, name, league_id, era, prestige_tier, leagues(name)")
              .order("id")
              .range(from, to)
              .returns<ClubRow[]>(),
          ),
          fetchAllRows<LeagueRow>((from, to) =>
            supabase
              .from("leagues")
              .select("id, name, nation, prestige_tier")
              .order("id")
              .range(from, to)
              .returns<LeagueRow[]>(),
          ),
        ]);
        if (cancelled) return;

        const players = playerRows.map(toPlayer);
        const playersByClub = new Map<string, Player[]>();
        for (const player of players) {
          const existing = playersByClub.get(player.clubId);
          if (existing) existing.push(player);
          else playersByClub.set(player.clubId, [player]);
        }

        const clubs: DsClub[] = clubRows.map((row) => ({
          id: row.id,
          name: row.name,
          leagueId: row.league_id,
          leagueName: row.leagues?.name ?? "—",
          era: row.era,
          prestigeTier: row.prestige_tier ?? 3,
        }));
        const leagues: DsLeague[] = leagueRows.map((row) => ({
          id: row.id,
          name: row.name,
          nation: row.nation,
          prestigeTier: row.prestige_tier ?? 3,
        }));

        setData({
          players,
          playersByClub,
          clubs,
          clubsById: new Map(clubs.map((c) => [c.id, c])),
          leagues,
          leaguesById: new Map(leagues.map((l) => [l.id, l])),
        });
        setLoading(false);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Errore nel caricamento del mondo");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
