import { useState } from "react";
import { Plus } from "lucide-react";
import type { Club } from "@app/shared-types";
import { useClubs } from "../hooks/useClubs";

export function ClubsScreen() {
  const { clubs, loading, createClub, updateClub } = useClubs();
  const [editing, setEditing] = useState<Club | null | undefined>(undefined);

  if (editing !== undefined) {
    return (
      <ClubForm
        club={editing}
        onCancel={() => setEditing(undefined)}
        onSubmit={async (input) => {
          if (editing) await updateClub(editing.id, input);
          else await createClub(input);
          setEditing(undefined);
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Club</h1>
          <p className="text-sm text-[var(--text-secondary)]">{clubs.length} club</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="flex items-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-contrast)]"
        >
          <Plus size={16} />
          Nuovo club
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Caricamento...</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3">
          {clubs.map((club) => (
            <li key={club.id}>
              <button
                type="button"
                onClick={() => setEditing(club)}
                className="flex w-full items-center gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4 text-left transition-colors hover:border-[var(--brand)]"
              >
                {club.crestUrl ? (
                  <img src={club.crestUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-[var(--surface-border)]" />
                )}
                <span className="font-medium">{club.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClubForm({
  club,
  onCancel,
  onSubmit,
}: {
  club: Club | null;
  onCancel: () => void;
  onSubmit: (input: { name: string; crestUrl: string }) => Promise<void>;
}) {
  const [name, setName] = useState(club?.name ?? "");
  const [crestUrl, setCrestUrl] = useState(club?.crestUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (name.trim().length < 2) {
      setError("Inserisci il nome del club.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), crestUrl: crestUrl.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante il salvataggio.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-6">
      <h2 className="mb-4 text-lg font-semibold">{club ? "Modifica club" : "Nuovo club"}</h2>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Stemma (URL immagine originale — mai stemmi ufficiali)
          <input
            value={crestUrl}
            onChange={(e) => setCrestUrl(e.target.value)}
            placeholder="https://..."
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[var(--surface-border)] px-5 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--brand)]"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-contrast)] disabled:opacity-60"
          >
            {submitting ? "Salvataggio..." : "Salva club"}
          </button>
        </div>
      </div>
    </div>
  );
}
