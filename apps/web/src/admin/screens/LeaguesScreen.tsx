import { useState } from "react";
import { Copy, Plus } from "lucide-react";
import type { League } from "@app/shared-types";
import { useLeagues, type LeagueFormInput } from "../hooks/useLeagues";

type FormState = { mode: "create"; initial: LeagueFormInput | null } | { mode: "edit"; league: League };

export function LeaguesScreen() {
  const { leagues, loading, createLeague, updateLeague } = useLeagues();
  const [formState, setFormState] = useState<FormState | null>(null);

  if (formState) {
    const editing = formState.mode === "edit" ? formState.league : null;
    const initial =
      formState.mode === "create" && formState.initial
        ? formState.initial
        : editing
          ? { name: editing.name, nation: editing.nation, crestUrl: editing.crestUrl }
          : null;

    return (
      <LeagueForm
        title={editing ? "Modifica campionato" : "Nuovo campionato"}
        initial={initial}
        onCancel={() => setFormState(null)}
        onSubmit={async (input) => {
          if (editing) await updateLeague(editing.id, input);
          else await createLeague(input);
          setFormState(null);
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Campionati</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {leagues.length} campionati — i club vengono creati all'interno di un campionato
            nella sezione "Club".
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormState({ mode: "create", initial: null })}
          className="flex items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-contrast)]"
        >
          <Plus size={16} />
          Nuovo campionato
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Caricamento...</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((league) => (
            <li
              key={league.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4"
            >
              {league.crestUrl ? (
                <img src={league.crestUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-[var(--surface-border)]" />
              )}
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => setFormState({ mode: "edit", league })}
                  className="text-left font-medium hover:underline"
                >
                  {league.name}
                </button>
                <p className="text-xs text-[var(--text-secondary)]">{league.nation}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormState({
                    mode: "create",
                    initial: { name: league.name, nation: league.nation, crestUrl: league.crestUrl },
                  })
                }
                aria-label="Duplica campionato"
                title="Duplica"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
              >
                <Copy size={14} />
              </button>
            </li>
          ))}
          {leagues.length === 0 && (
            <p className="text-sm text-[var(--text-secondary)]">Nessun campionato creato.</p>
          )}
        </ul>
      )}
    </div>
  );
}

function LeagueForm({
  title,
  initial,
  onCancel,
  onSubmit,
}: {
  title: string;
  initial: LeagueFormInput | null;
  onCancel: () => void;
  onSubmit: (input: LeagueFormInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [nation, setNation] = useState(initial?.nation ?? "");
  const [crestUrl, setCrestUrl] = useState(initial?.crestUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (name.trim().length < 2) {
      setError("Inserisci il nome del campionato.");
      return;
    }
    if (nation.trim().length < 2) {
      setError("Inserisci la nazione del campionato.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), nation: nation.trim(), crestUrl: crestUrl.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante il salvataggio.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nome (es. Serie A)
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nazione
          <input
            value={nation}
            onChange={(e) => setNation(e.target.value)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Stemma (URL immagine originale — mai loghi ufficiali di lega)
          <input
            value={crestUrl}
            onChange={(e) => setCrestUrl(e.target.value)}
            placeholder="https://..."
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
            {submitting ? "Salvataggio..." : "Salva campionato"}
          </button>
        </div>
      </div>
    </div>
  );
}
