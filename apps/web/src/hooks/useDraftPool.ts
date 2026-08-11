import { useEffect, useState } from "react";
import { ROLE_DEPARTMENT } from "@app/shared-types";
import type { Player, Role } from "@app/shared-types";
import { fetchAllRows } from "../lib/fetchAllRows";
import { supabase } from "../lib/supabaseClient";
import { isClassicEligible, type ClubPackage } from "@app/game-engine";

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

function fromRow(row: PlayerRow): Player {
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
    // Serve alla DS mode (crescita, declino, ritiro); la Classica la ignora.
    birthDate: row.birth_date,
  };
}

/** Pool completo del draft (Modalità Classica Rapida Offline, CLAUDE.md sez. 3.5): tutti i giocatori, raggruppati per club. */
export function useDraftPool() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [packages, setPackages] = useState<ClubPackage[]>([]);
  const [clubNames, setClubNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      let data: PlayerRow[];
      let clubRows: { id: string; name: string }[];
      try {
        // Paginato: senza `fetchAllRows` il server ne restituirebbe solo 1000 in silenzio,
        // e il pool del draft resterebbe mutilato senza alcun segnale (vedi il commento lì).
        [data, clubRows] = await Promise.all([
          fetchAllRows<PlayerRow>((from, to) =>
            supabase
              .from("player_pool")
              .select("*, clubs(name, era, leagues(name))")
              .order("id")
              .range(from, to)
              .returns<PlayerRow[]>(),
          ),
          fetchAllRows<{ id: string; name: string }>((from, to) =>
            supabase
              .from("clubs")
              .select("id, name")
              .order("id")
              .range(from, to)
              .returns<{ id: string; name: string }[]>(),
          ),
        ]);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Errore nel caricamento del pool");
        setLoading(false);
        return;
      }

      if (cancelled) return;

      /**
       * **La Serie B non entra nella Classica** (decisione dell'utente, `docs/piano-serie-b.md`).
       *
       * Il filtro sta qui e non nel selettore per una ragione precisa: da qui escono sia
       * l'elenco delle competizioni (`ClassicMode` lo deriva dai campionati che trova nel
       * pool) sia i giocatori pescabili dall'opzione "tutto il database". Filtrare solo il
       * selettore avrebbe tolto la voce dal menù lasciando i giocatori nei pacchetti.
       */
      const allPlayers = data.map(fromRow).filter((p) => isClassicEligible(p.league));
      const byClub = new Map<string, Player[]>();
      for (const player of allPlayers) {
        const existing = byClub.get(player.clubId);
        if (existing) existing.push(player);
        else byClub.set(player.clubId, [player]);
      }

      setPlayers(allPlayers);
      setPackages([...byClub.entries()].map(([clubId, clubPlayers]) => ({ clubId, players: clubPlayers })));
      setClubNames(Object.fromEntries(clubRows.map((c) => [c.id, c.name])));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { players, packages, clubNames, loading, error };
}
