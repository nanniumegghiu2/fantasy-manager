import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Copy, Pencil, Plus } from "lucide-react";
import { useClubs, type AdminClub, type ClubFormInput } from "../hooks/useClubs";
import { useLeagues } from "../hooks/useLeagues";

type FormState =
  | { mode: "create"; initial: ClubFormInput | null }
  | { mode: "edit"; club: AdminClub };

interface ClubsScreenProps {
  leagueFilter?: string | null;
  onBack?: () => void;
  onOpenPlayers: (clubId: string) => void;
}

export function ClubsScreen({ leagueFilter, onBack, onOpenPlayers }: ClubsScreenProps) {
  const { clubs, loading, createClub, updateClub } = useClubs();
  const { leagues, loading: leaguesLoading } = useLeagues();
  const [formState, setFormState] = useState<FormState | null>(null);

  const filteredClubs = useMemo(
    () => (leagueFilter ? clubs.filter((c) => c.leagueId === leagueFilter) : clubs),
    [clubs, leagueFilter],
  );
  const activeLeague = leagueFilter ? leagues.find((l) => l.id === leagueFilter) : null;

  if (formState) {
    if (leaguesLoading || leagues.length === 0) {
      return (
        <p className="text-sm text-[var(--text-secondary)]">
          Crea prima almeno un campionato nella sezione "Campionati".
        </p>
      );
    }
    const editing = formState.mode === "edit" ? formState.club : null;
    const initial =
      formState.mode === "create" && formState.initial
        ? formState.initial
        : editing
          ? {
              name: editing.name,
              crestUrl: editing.crestUrl,
              leagueId: editing.leagueId,
              era: editing.era,
            }
          : null;

    return (
      <ClubForm
        title={editing ? "Modifica club" : "Nuovo club"}
        leagues={leagues}
        defaultLeagueId={leagueFilter ?? undefined}
        initial={initial}
        onCancel={() => setFormState(null)}
        onSubmit={async (input) => {
          if (editing) await updateClub(editing.id, input);
          else await createClub(input);
          setFormState(null);
        }}
      />
    );
  }

  return (
    <div>
      {activeLeague && (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={14} />
          Tutti i campionati
        </button>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">
            {activeLeague ? `Club — ${activeLeague.name}` : "Club"}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {filteredClubs.length} club — ogni club è un'istanza per epoca: duplica per creare
            la stessa squadra in un'altra epoca. Tocca un club per vedere i suoi giocatori.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormState({ mode: "create", initial: null })}
          className="flex items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-contrast)]"
        >
          <Plus size={16} />
          Nuovo club
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Caricamento...</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClubs.map((club) => (
            <li
              key={club.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4"
            >
              {club.crestUrl ? (
                <img src={club.crestUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-[var(--surface-border)]" />
              )}
              <button
                type="button"
                onClick={() => onOpenPlayers(club.id)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <span className="flex-1">
                  <span className="block font-medium">{club.name}</span>
                  <span className="block text-xs text-[var(--text-secondary)]">
                    {club.leagueName} · {club.era}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-[var(--text-secondary)]" />
              </button>
              <button
                type="button"
                onClick={() => setFormState({ mode: "edit", club })}
                aria-label="Modifica club"
                title="Modifica"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormState({
                    mode: "create",
                    initial: {
                      name: club.name,
                      crestUrl: club.crestUrl,
                      leagueId: club.leagueId,
                      era: club.era,
                    },
                  })
                }
                aria-label="Duplica club"
                title="Duplica (utile per creare la stessa squadra in un'altra epoca)"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
              >
                <Copy size={14} />
              </button>
            </li>
          ))}
          {filteredClubs.length === 0 && (
            <p className="text-sm text-[var(--text-secondary)]">Nessun club creato.</p>
          )}
        </ul>
      )}
    </div>
  );
}

function ClubForm({
  title,
  leagues,
  defaultLeagueId,
  initial,
  onCancel,
  onSubmit,
}: {
  title: string;
  leagues: { id: string; name: string }[];
  defaultLeagueId?: string;
  initial: ClubFormInput | null;
  onCancel: () => void;
  onSubmit: (input: ClubFormInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [crestUrl, setCrestUrl] = useState(initial?.crestUrl ?? "");
  const [leagueId, setLeagueId] = useState(initial?.leagueId ?? defaultLeagueId ?? leagues[0]?.id ?? "");
  const [era, setEra] = useState(initial?.era ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (name.trim().length < 2) {
      setError("Inserisci il nome del club.");
      return;
    }
    if (era.trim().length < 2) {
      setError("Inserisci l'epoca (es. 1990s).");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), crestUrl: crestUrl.trim(), leagueId, era: era.trim() });
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
          Campionato
          <select
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nome club
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Epoca (es. 1990s)
          <input
            value={era}
            onChange={(e) => setEra(e.target.value)}
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
            {submitting ? "Salvataggio..." : "Salva club"}
          </button>
        </div>
      </div>
    </div>
  );
}
