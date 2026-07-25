import { useMemo, useState } from "react";
import type { ChallengeType } from "@app/shared-types";
import { usePlayers } from "../hooks/usePlayers";
import { useClubs } from "../hooks/useClubs";
import { useDailyChallenges } from "../hooks/useDailyChallenges";

const CHALLENGE_TYPES: { id: ChallengeType; label: string }[] = [
  { id: "campionato", label: "Campionato perfetto (38-0-0)" },
  { id: "salvezza", label: "Salvezza" },
  { id: "mercato_gennaio", label: "Mercato di gennaio" },
];

export function ChallengesScreen() {
  const { players, loading: playersLoading } = usePlayers();
  const { clubs, loading: clubsLoading } = useClubs();
  const { challenges, loading: challengesLoading, createChallenge } = useDailyChallenges();

  const [challengeDate, setChallengeDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [challengeType, setChallengeType] = useState<ChallengeType>("campionato");
  const [selectedClubIds, setSelectedClubIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const playerCountByClub = useMemo(() => {
    const map = new Map<string, number>();
    for (const player of players) {
      map.set(player.clubId, (map.get(player.clubId) ?? 0) + 1);
    }
    return map;
  }, [players]);

  const sortedClubs = useMemo(
    () => [...clubs].sort((a, b) => a.name.localeCompare(b.name) || a.era.localeCompare(b.era)),
    [clubs],
  );

  function toggle(clubId: string) {
    setSelectedClubIds((prev) => {
      const next = new Set(prev);
      if (next.has(clubId)) next.delete(clubId);
      else next.add(clubId);
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);
    setSuccessMessage(null);
    const packages = sortedClubs
      .filter((c) => selectedClubIds.has(c.id))
      .map((c) => ({ clubId: c.id, era: c.era }));

    if (packages.length === 0) {
      setError("Seleziona almeno un club (pacchetto) per il seed.");
      return;
    }

    setSubmitting(true);
    try {
      await createChallenge({ challengeDate, challengeType, packages });
      setSuccessMessage(`Sfida del ${challengeDate} creata.`);
      setSelectedClubIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante il salvataggio.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Sfide giornaliere</h1>
      <p className="mb-6 text-sm text-[var(--text-secondary)]">
        Ogni sfida resta disponibile per tutto il mese ed è recuperabile (CLAUDE.md sez. 7.2).
        Ogni club è già un'istanza per epoca, quindi il seed è semplicemente una selezione di
        club.
      </p>

      <div className="grid grid-cols-[1fr_1fr] gap-8">
        <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-6">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Data
              <input
                type="date"
                value={challengeDate}
                onChange={(e) => setChallengeDate(e.target.value)}
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Tipo sfida
              <select
                value={challengeType}
                onChange={(e) => setChallengeType(e.target.value as ChallengeType)}
                className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              >
                {CHALLENGE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <h3 className="mt-6 mb-2 text-sm font-semibold text-[var(--text-secondary)] uppercase">
            Club (pacchetti) nel seed
          </h3>
          {playersLoading || clubsLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">Caricamento...</p>
          ) : sortedClubs.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Nessun club: creane prima nella sezione "Club".
            </p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1 overflow-auto rounded-lg border border-[var(--surface-border)] p-2">
              {sortedClubs.map((club) => (
                <li key={club.id}>
                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--surface)]">
                    <input
                      type="checkbox"
                      checked={selectedClubIds.has(club.id)}
                      onChange={() => toggle(club.id)}
                    />
                    {club.name} — {club.leagueName} {club.era}
                    <span className="text-xs text-[var(--text-secondary)]">
                      ({playerCountByClub.get(club.id) ?? 0} giocatori)
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          {successMessage && (
            <p className="mt-4 text-sm text-[var(--brand)]">{successMessage}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-contrast)] disabled:opacity-60"
          >
            {submitting ? "Creazione..." : "Crea sfida"}
          </button>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-secondary)] uppercase">
            Sfide esistenti
          </h3>
          {challengesLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">Caricamento...</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {challenges.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3 text-sm"
                >
                  <p className="font-semibold">{c.challengeDate}</p>
                  <p className="text-[var(--text-secondary)]">
                    {CHALLENGE_TYPES.find((t) => t.id === c.challengeType)?.label} ·{" "}
                    {c.packages.length} pacchetti
                  </p>
                </li>
              ))}
              {challenges.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)]">Nessuna sfida creata.</p>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
