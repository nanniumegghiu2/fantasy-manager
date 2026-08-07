import { useCallback, useEffect, useState } from "react";
import { ROLE_DEPARTMENT } from "@app/shared-types";
import type { Department, PlayerStats, Role } from "@app/shared-types";
import { fetchAllRows } from "../../lib/fetchAllRows";
import { supabase } from "../../lib/supabaseClient";

export interface AdminPlayer {
  id: string;
  name: string;
  role: Role;
  secondaryRoles: Role[];
  department: Department;
  clubId: string;
  clubName: string;
  era: string;
  leagueName: string;
  nation: string;
  marketValue: number;
  stats: PlayerStats;
  overall: number;
  overallOverride: number | null;
  /** Data di nascita: dato fattuale, sola lettura nel pannello (si popola con `pnpm import-birthdates`). */
  birthDate: string | null;
}

export interface PlayerFormInput {
  name: string;
  role: Role;
  secondaryRoles: Role[];
  clubId: string;
  nation: string;
  marketValue: number;
  stats: PlayerStats;
  overall: number;
  overallOverride: number | null;
}

interface PlayerRow {
  id: string;
  name: string;
  role: Role;
  secondary_roles: Role[];
  club_id: string;
  nation: string;
  market_value: number;
  appearances: number;
  goals: number;
  assists: number;
  trophies: number;
  caps: number;
  overall: number;
  overall_override: number | null;
  birth_date: string | null;
  clubs: { name: string; era: string; leagues: { name: string } | null } | null;
}

function fromRow(row: PlayerRow): AdminPlayer {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    secondaryRoles: row.secondary_roles ?? [],
    department: ROLE_DEPARTMENT[row.role],
    clubId: row.club_id,
    clubName: row.clubs?.name ?? "—",
    era: row.clubs?.era ?? "—",
    leagueName: row.clubs?.leagues?.name ?? "—",
    nation: row.nation,
    marketValue: row.market_value,
    stats: {
      appearances: row.appearances,
      goals: row.goals,
      assists: row.assists,
      trophies: row.trophies,
      caps: row.caps,
    },
    overall: row.overall,
    overallOverride: row.overall_override,
    birthDate: row.birth_date,
  };
}

export function usePlayers() {
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      // Paginato per lo stesso motivo del pool di gioco: oltre le 1000 righe il server
      // tronca senza dirlo, e il pannello mostrerebbe una frazione del database.
      const data = await fetchAllRows<PlayerRow>((from, to) =>
        supabase
          .from("player_pool")
          .select("*, clubs(name, era, leagues(name))")
          .order("name")
          .order("id")
          .range(from, to)
          .returns<PlayerRow[]>(),
      );
      setPlayers(data.map(fromRow));
    } catch {
      // La lista resta quella precedente: meglio dati vecchi che una lista tronca.
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function createPlayer(input: PlayerFormInput) {
    const { error } = await supabase.from("player_pool").insert({
      name: input.name,
      role: input.role,
      secondary_roles: input.secondaryRoles,
      club_id: input.clubId,
      nation: input.nation,
      market_value: input.marketValue,
      appearances: input.stats.appearances,
      goals: input.stats.goals,
      assists: input.stats.assists,
      trophies: input.stats.trophies,
      caps: input.stats.caps,
      overall: input.overall,
      overall_override: input.overallOverride,
    });
    if (error) throw error;
    await refetch();
  }

  async function updatePlayer(id: string, input: PlayerFormInput) {
    const { error } = await supabase
      .from("player_pool")
      .update({
        name: input.name,
        role: input.role,
        secondary_roles: input.secondaryRoles,
        club_id: input.clubId,
        nation: input.nation,
        market_value: input.marketValue,
        appearances: input.stats.appearances,
        goals: input.stats.goals,
        assists: input.stats.assists,
        trophies: input.stats.trophies,
        caps: input.stats.caps,
        overall: input.overall,
        overall_override: input.overallOverride,
      })
      .eq("id", id);
    if (error) throw error;
    await refetch();
  }

  return { players, loading, refetch, createPlayer, updatePlayer };
}
