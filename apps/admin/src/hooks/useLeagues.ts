import { useCallback, useEffect, useState } from "react";
import type { League } from "@app/shared-types";
import { supabase } from "../lib/supabaseClient";

interface LeagueRow {
  id: string;
  name: string;
  nation: string;
  crest_url: string | null;
}

function fromRow(row: LeagueRow): League {
  return { id: row.id, name: row.name, nation: row.nation, crestUrl: row.crest_url ?? "" };
}

export interface LeagueFormInput {
  name: string;
  nation: string;
  crestUrl: string;
}

export function useLeagues() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("leagues")
      .select("*")
      .order("name")
      .returns<LeagueRow[]>();
    setLeagues((data ?? []).map(fromRow));
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function createLeague(input: LeagueFormInput) {
    const { error } = await supabase
      .from("leagues")
      .insert({ name: input.name, nation: input.nation, crest_url: input.crestUrl || null });
    if (error) throw error;
    await refetch();
  }

  async function updateLeague(id: string, input: LeagueFormInput) {
    const { error } = await supabase
      .from("leagues")
      .update({ name: input.name, nation: input.nation, crest_url: input.crestUrl || null })
      .eq("id", id);
    if (error) throw error;
    await refetch();
  }

  return { leagues, loading, refetch, createLeague, updateLeague };
}
