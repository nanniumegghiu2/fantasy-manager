import { useCallback, useEffect, useState } from "react";
import type { Department, PlayerStats } from "@app/shared-types";
import { supabase } from "../../lib/supabaseClient";

export interface AdminPlayer {
  id: string;
  name: string;
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
}

export interface PlayerFormInput {
  name: string;
  department: Department;
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
  department: Department;
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
  clubs: { name: string; era: string; leagues: { name: string } | null } | null;
}

function fromRow(row: PlayerRow): AdminPlayer {
  return {
    id: row.id,
    name: row.name,
    department: row.department,
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
  };
}

export function usePlayers() {
  const [players, setPlayers] = useState<AdminPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("player_pool")
      .select("*, clubs(name, era, leagues(name))")
      .order("name")
      .returns<PlayerRow[]>();
    if (!error) setPlayers((data ?? []).map(fromRow));
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function createPlayer(input: PlayerFormInput) {
    const { error } = await supabase.from("player_pool").insert({
      name: input.name,
      department: input.department,
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
        department: input.department,
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
