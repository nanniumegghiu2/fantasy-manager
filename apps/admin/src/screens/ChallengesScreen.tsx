import { useMemo, useState } from "react";
import type { ChallengeType } from "@app/shared-types";
import { usePlayers } from "../hooks/usePlayers";
import { useDailyChallenges, type ChallengePackage } from "../hooks/useDailyChallenges";

const CHALLENGE_TYPES: { id: ChallengeType; label: string }[] = [
  { id: "campionato", label: "Campionato perfetto (38-0-0)" },
  { id: "salvezza", label: "Salvezza" },
  { id: "mercato_gennaio", label: "Mercato di gennaio" },
];

function packageKey(pkg: ChallengePackage) {
  return `${pkg.clubId}__${pkg.era}`;
}

export function ChallengesScreen() {
  const { players, loading: playersLoading } = usePlayers();
  const { challenges, loading: challengesLoading, createChallenge } = useDailyChallenges();

  const [challengeDate, setChallengeDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [challengeType, setChallengeType] = useState<ChallengeType>("campionato");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const availablePackages = useMemo(() => {
    const map = new Map<string, { clubId: string; clubName: string; era: string; count: number }>();
    for (const player of players) {
      const pkg: ChallengePackage = { clubId: player.clubId, era: player.era };
      const key = packageKey(pkg);
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { clubId: player.clubId, clubName: player.clubName, era: player.era, count: 1 });
    }
    return Array.from(map.values()).sort(
      (a, b) => a.clubName.localeCompare(b.clubName) || a.era.localeCompare(b.era),
    );
  }, [players]);

  function toggle(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);
    setSuccessMessage(null);
    const packages = availablePackages
      .filter((p) => selectedKeys.has(packageKey(p)))
      .map((p) => ({ clubId: p.clubId, era: p.era }));

    if (packages.length === 0) {
      setError("Seleziona almeno un pacchetto club+epoca per il seed.");
      return;
    }

    setSubmitting(true);
    try {
      await createChallenge({ challengeDate, challengeType, packages });
      setSuccessMessage(`Sfida del ${challengeDate} creata.`);
      setSelectedKeys(new Set());
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
            Pacchetti club + epoca nel seed
          </h3>
          {playersLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">Caricamento...</p>
          ) : availablePackages.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Nessun giocatore in pool: aggiungine prima nella sezione "Giocatori".
            </p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1 overflow-auto rounded-lg border border-[var(--surface-border)] p-2">
              {availablePackages.map((pkg) => {
                const key = packageKey(pkg);
                return (
                  <li key={key}>
                    <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--surface)]">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(key)}
                        onChange={() => toggle(key)}
                      />
                      {pkg.clubName} — {pkg.era}
                      <span className="text-xs text-[var(--text-secondary)]">
                        ({pkg.count} giocatori)
                      </span>
                    </label>
                  </li>
                );
              })}
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
