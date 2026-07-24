import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@app/shared-types";
import { supabase } from "../lib/supabaseClient";

interface ProfileRow {
  id: string;
  nickname: string;
  nazione: string;
  avatar_url: string | null;
  livello_id: string;
  punti_livello: number;
  punti_globali: number;
  punti_mensili: number;
  perfect_38_count: number;
  is_admin: boolean;
}

function fromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    nickname: row.nickname,
    nazione: row.nazione,
    avatarUrl: row.avatar_url,
    livelloId: row.livello_id,
    puntiLivello: row.punti_livello,
    puntiGlobali: row.punti_globali,
    puntiMensili: row.punti_mensili,
    perfect38Count: row.perfect_38_count,
    isAdmin: row.is_admin,
  };
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle<ProfileRow>();
    setProfile(data ? fromRow(data) : null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { profile, loading, refetch };
}
