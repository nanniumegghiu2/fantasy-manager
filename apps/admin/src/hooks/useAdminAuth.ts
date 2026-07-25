import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
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

export function useAdminAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);

      if (data.session) {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.session.user.id)
          .maybeSingle<ProfileRow>();
        if (!cancelled) setProfile(profileRow ? fromRow(profileRow) : null);
      }
      if (!cancelled) setLoading(false);
    }

    load();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) setProfile(null);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, profile, loading };
}
