import { useMemo, useState } from "react";
import { ArrowLeft, ArrowUpDown, ChevronDown, ChevronUp, Copy, Plus, Search } from "lucide-react";
import { ROLE_LABELS, ROLES } from "@app/shared-types";
import type { Role } from "@app/shared-types";
import { usePlayers, type AdminPlayer } from "../hooks/usePlayers";
import { useClubs } from "../hooks/useClubs";
import { PlayerForm, type PlayerFormPrefill } from "./PlayerForm";

type FormState =
  | { mode: "create"; prefill: PlayerFormPrefill | null }
  | { mode: "edit"; player: AdminPlayer };

type SortKey = "name" | "clubName" | "leagueName" | "era" | "role" | "overall";
type SortDirection = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Nome",
  clubName: "Club",
  leagueName: "Campionato",
  era: "Epoca",
  role: "Ruolo",
  overall: "Overall",
};

const ROLE_ORDER: Record<Role, number> = Object.fromEntries(
  ROLES.map((r, i) => [r, i]),
) as Record<Role, number>;

function toPrefill(player: AdminPlayer): PlayerFormPrefill {
  return {
    name: player.name,
    role: player.role,
    secondaryRoles: player.secondaryRoles,
    clubId: player.clubId,
    nation: player.nation,
    marketValue: player.marketValue,
    stats: player.stats,
    overallOverride: player.overallOverride,
  };
}

function compareBy(key: SortKey, a: AdminPlayer, b: AdminPlayer): number {
  if (key === "overall") return a.overall - b.overall;
  if (key === "role") return ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
  return a[key].localeCompare(b[key]);
}

interface PlayersScreenProps {
  clubFilter?: string | null;
  onBack?: () => void;
}

export function PlayersScreen({ clubFilter, onBack }: PlayersScreenProps) {
  const { players, loading, createPlayer, updatePlayer } = usePlayers();
  const { clubs, loading: clubsLoading } = useClubs();
  const [query, setQuery] = useState("");
  const [formState, setFormState] = useState<FormState | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const activeClub = clubFilter ? clubs.find((c) => c.id === clubFilter) : null;

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  const filtered = useMemo(() => {
    let list = clubFilter ? players.filter((p) => p.clubId === clubFilter) : players;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.clubName.toLowerCase().includes(q),
      );
    }
    const sign = sortDirection === "asc" ? 1 : -1;
    return [...list].sort((a, b) => sign * compareBy(sortKey, a, b));
  }, [players, clubFilter, query, sortKey, sortDirection]);

  if (formState) {
    if (clubsLoading || clubs.length === 0) {
      return (
        <p className="text-sm text-[var(--text-secondary)]">
          Crea prima almeno un club nella sezione "Club".
        </p>
      );
    }
    const editing = formState.mode === "edit" ? formState.player : null;
    return (
      <PlayerForm
        clubs={clubs}
        existingPlayers={players}
        editingPlayer={editing}
        prefill={formState.mode === "create" ? formState.prefill : null}
        defaultClubId={clubFilter ?? undefined}
        onCancel={() => setFormState(null)}
        onSubmit={async (input) => {
          if (editing) await updatePlayer(editing.id, input);
          else await createPlayer(input);
          setFormState(null);
        }}
      />
    );
  }

  return (
    <div>
      {activeClub && (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={14} />
          Tutti i club
        </button>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">
            {activeClub ? `Giocatori — ${activeClub.name}` : "Giocatori"}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{filtered.length} nel pool</p>
        </div>
        <button
          type="button"
          onClick={() => setFormState({ mode: "create", prefill: null })}
          className="flex items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-contrast)]"
        >
          <Plus size={16} />
          Nuovo giocatore
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-sm sm:flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-secondary)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome o club..."
            className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-raised)] py-2 pr-3 pl-9 text-sm outline-none focus:border-[var(--brand)]"
          />
        </div>

        {/* Selettore ordinamento, mobile (le intestazioni di colonna non sono visibili sotto md) */}
        <div className="flex items-center gap-2 md:hidden">
          <ArrowUpDown size={15} className="shrink-0 text-[var(--text-secondary)]" />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
          >
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                Ordina per {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label="Inverti ordinamento"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--surface-border)]"
          >
            {sortDirection === "asc" ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Caricamento...</p>
      ) : (
        <>
          {/* Lista a card, mobile */}
          <ul className="flex flex-col gap-2 md:hidden">
            {filtered.map((player) => (
              <li
                key={player.id}
                className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setFormState({ mode: "edit", player })}
                    className="flex-1 text-left"
                  >
                    <p className="font-semibold">{player.name}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {player.clubName} · {player.leagueName} {player.era}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {ROLE_LABELS[player.role]}
                    </p>
                  </button>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-lg font-extrabold">{player.overall}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setFormState({ mode: "create", prefill: toPrefill(player) })
                      }
                      aria-label="Duplica giocatore"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-border)]"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
                Nessun giocatore trovato.
              </p>
            )}
          </ul>

          {/* Tabella, tablet/desktop */}
          <div className="hidden overflow-hidden rounded-xl border border-[var(--surface-border)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-raised)] text-xs text-[var(--text-secondary)] uppercase">
                <tr>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                    <th key={key} className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className="flex items-center gap-1 hover:text-[var(--text-primary)]"
                      >
                        {SORT_LABELS[key]}
                        {sortKey === key &&
                          (sortDirection === "asc" ? (
                            <ChevronUp size={13} />
                          ) : (
                            <ChevronDown size={13} />
                          ))}
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((player) => (
                  <tr
                    key={player.id}
                    className="border-t border-[var(--surface-border)] hover:bg-[var(--surface-raised)]"
                  >
                    <td
                      className="cursor-pointer px-4 py-3 font-medium"
                      onClick={() => setFormState({ mode: "edit", player })}
                    >
                      {player.name}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{player.clubName}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {player.leagueName}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{player.era}</td>
                    <td className="px-4 py-3">
                      {ROLE_LABELS[player.role]}
                    </td>
                    <td className="px-4 py-3 font-bold">
                      {player.overall}
                      {player.overallOverride != null && (
                        <span className="ml-1 text-xs font-normal text-[var(--accent)]">
                          (override)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setFormState({ mode: "create", prefill: toPrefill(player) })
                        }
                        aria-label="Duplica giocatore"
                        title="Duplica (utile per creare lo stesso giocatore in un'altra epoca/club)"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
                      >
                        <Copy size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      Nessun giocatore trovato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
