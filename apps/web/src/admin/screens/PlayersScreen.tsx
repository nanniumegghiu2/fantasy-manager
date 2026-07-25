import { useMemo, useState } from "react";
import { Copy, Plus, Search } from "lucide-react";
import { usePlayers, type AdminPlayer } from "../hooks/usePlayers";
import { useClubs } from "../hooks/useClubs";
import { PlayerForm, type PlayerFormPrefill } from "./PlayerForm";

type FormState =
  | { mode: "create"; prefill: PlayerFormPrefill | null }
  | { mode: "edit"; player: AdminPlayer };

function toPrefill(player: AdminPlayer): PlayerFormPrefill {
  return {
    name: player.name,
    department: player.department,
    clubId: player.clubId,
    nation: player.nation,
    marketValue: player.marketValue,
    stats: player.stats,
    overallOverride: player.overallOverride,
  };
}

export function PlayersScreen() {
  const { players, loading, createPlayer, updatePlayer } = usePlayers();
  const { clubs, loading: clubsLoading } = useClubs();
  const [query, setQuery] = useState("");
  const [formState, setFormState] = useState<FormState | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) => p.name.toLowerCase().includes(q) || p.clubName.toLowerCase().includes(q),
    );
  }, [players, query]);

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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Giocatori</h1>
          <p className="text-sm text-[var(--text-secondary)]">{players.length} nel pool</p>
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

      <div className="relative mb-4 sm:max-w-sm">
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
                      {player.department}
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
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Campionato</th>
                  <th className="px-4 py-3">Epoca</th>
                  <th className="px-4 py-3">Reparto</th>
                  <th className="px-4 py-3">Overall</th>
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
                    <td className="px-4 py-3">{player.department}</td>
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
