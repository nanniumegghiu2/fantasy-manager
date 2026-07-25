import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { usePlayers, type AdminPlayer } from "../hooks/usePlayers";
import { useClubs } from "../hooks/useClubs";
import { PlayerForm } from "./PlayerForm";

export function PlayersScreen() {
  const { players, loading, createPlayer, updatePlayer } = usePlayers();
  const { clubs, loading: clubsLoading } = useClubs();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<AdminPlayer | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) => p.name.toLowerCase().includes(q) || p.clubName.toLowerCase().includes(q),
    );
  }, [players, query]);

  function openCreate() {
    setEditingPlayer(null);
    setFormOpen(true);
  }

  function openEdit(player: AdminPlayer) {
    setEditingPlayer(player);
    setFormOpen(true);
  }

  if (formOpen) {
    if (clubsLoading || clubs.length === 0) {
      return (
        <p className="text-sm text-[var(--text-secondary)]">
          Crea prima almeno un club nella sezione "Club".
        </p>
      );
    }
    return (
      <PlayerForm
        clubs={clubs}
        existingPlayers={players}
        editingPlayer={editingPlayer}
        onCancel={() => setFormOpen(false)}
        onSubmit={async (input) => {
          if (editingPlayer) await updatePlayer(editingPlayer.id, input);
          else await createPlayer(input);
          setFormOpen(false);
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Giocatori</h1>
          <p className="text-sm text-[var(--text-secondary)]">{players.length} nel pool</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-contrast)]"
        >
          <Plus size={16} />
          Nuovo giocatore
        </button>
      </div>

      <div className="relative mb-4 max-w-sm">
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
        <div className="overflow-hidden rounded-xl border border-[var(--surface-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-raised)] text-xs text-[var(--text-secondary)] uppercase">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3">Reparto</th>
                <th className="px-4 py-3">Epoca</th>
                <th className="px-4 py-3">Overall</th>
                <th className="px-4 py-3">Valore</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((player) => (
                <tr
                  key={player.id}
                  onClick={() => openEdit(player)}
                  className="cursor-pointer border-t border-[var(--surface-border)] hover:bg-[var(--surface-raised)]"
                >
                  <td className="px-4 py-3 font-medium">{player.name}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{player.clubName}</td>
                  <td className="px-4 py-3">{player.department}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{player.era}</td>
                  <td className="px-4 py-3 font-bold">
                    {player.overall}
                    {player.overallOverride != null && (
                      <span className="ml-1 text-xs font-normal text-[var(--accent)]">
                        (override)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {player.marketValue}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-[var(--text-secondary)]"
                  >
                    Nessun giocatore trovato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
