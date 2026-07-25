import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export interface AdminClub {
  id: string;
  name: string;
  crestUrl: string;
  leagueId: string;
  leagueName: string;
  era: string;
}

export interface ClubFormInput {
  name: string;
  crestUrl: string;
  leagueId: string;
  era: string;
}

interface ClubRow {
  id: string;
  name: string;
  crest_url: string | null;
  league_id: string;
  era: string;
  leagues: { name: string } | null;
}

function fromRow(row: ClubRow): AdminClub {
  return {
    id: row.id,
    name: row.name,
    crestUrl: row.crest_url ?? "",
    leagueId: row.league_id,
    leagueName: row.leagues?.name ?? "—",
    era: row.era,
  };
}

export function useClubs() {
  const [clubs, setClubs] = useState<AdminClub[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clubs")
      .select("*, leagues(name)")
      .order("name")
      .returns<ClubRow[]>();
    setClubs((data ?? []).map(fromRow));
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function createClub(input: ClubFormInput) {
    const { error } = await supabase.from("clubs").insert({
      name: input.name,
      crest_url: input.crestUrl || null,
      league_id: input.leagueId,
      era: input.era,
    });
    if (error) throw error;
    await refetch();
  }

  async function updateClub(id: string, input: ClubFormInput) {
    const { error } = await supabase
      .from("clubs")
      .update({
        name: input.name,
        crest_url: input.crestUrl || null,
        league_id: input.leagueId,
        era: input.era,
      })
      .eq("id", id);
    if (error) throw error;
    await refetch();
  }

  return { clubs, loading, refetch, createClub, updateClub };
}
