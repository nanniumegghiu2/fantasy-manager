import { useCallback, useEffect, useState } from "react";
import type { Club } from "@app/shared-types";
import { supabase } from "../lib/supabaseClient";

interface ClubRow {
  id: string;
  name: string;
  crest_url: string | null;
}

function fromRow(row: ClubRow): Club {
  return { id: row.id, name: row.name, crestUrl: row.crest_url ?? "" };
}

export function useClubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clubs")
      .select("*")
      .order("name")
      .returns<ClubRow[]>();
    setClubs((data ?? []).map(fromRow));
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function createClub(input: { name: string; crestUrl: string }) {
    const { error } = await supabase
      .from("clubs")
      .insert({ name: input.name, crest_url: input.crestUrl || null });
    if (error) throw error;
    await refetch();
  }

  async function updateClub(id: string, input: { name: string; crestUrl: string }) {
    const { error } = await supabase
      .from("clubs")
      .update({ name: input.name, crest_url: input.crestUrl || null })
      .eq("id", id);
    if (error) throw error;
    await refetch();
  }

  return { clubs, loading, refetch, createClub, updateClub };
}
