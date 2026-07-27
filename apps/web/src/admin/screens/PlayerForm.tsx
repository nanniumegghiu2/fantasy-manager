import { useMemo, useState } from "react";
import { computeOverallRatings } from "@app/game-engine";
import type { Department } from "@app/shared-types";
import type { AdminClub } from "../hooks/useClubs";
import type { AdminPlayer, PlayerFormInput } from "../hooks/usePlayers";

const DEPARTMENTS: Department[] = ["POR", "DIF", "CC", "ATT"];

export interface PlayerFormPrefill {
  name: string;
  department: Department;
  clubId: string;
  nation: string;
  marketValue: number;
  stats: PlayerFormInput["stats"];
  overallOverride: number | null;
}

interface PlayerFormProps {
  clubs: AdminClub[];
  existingPlayers: AdminPlayer[];
  editingPlayer: AdminPlayer | null;
  prefill: PlayerFormPrefill | null;
  defaultClubId?: string;
  onCancel: () => void;
  onSubmit: (input: PlayerFormInput) => Promise<void>;
}

export function PlayerForm({
  clubs,
  existingPlayers,
  editingPlayer,
  prefill,
  defaultClubId,
  onCancel,
  onSubmit,
}: PlayerFormProps) {
  const base = editingPlayer ?? prefill;
  const [name, setName] = useState(base?.name ?? "");
  const [department, setDepartment] = useState<Department>(base?.department ?? "ATT");
  const [clubId, setClubId] = useState(base?.clubId ?? defaultClubId ?? clubs[0]?.id ?? "");
  const [nation, setNation] = useState(base?.nation ?? "");
  const [marketValue, setMarketValue] = useState(base?.marketValue ?? 0);
  const [appearances, setAppearances] = useState(base?.stats.appearances ?? 0);
  const [goals, setGoals] = useState(base?.stats.goals ?? 0);
  const [assists, setAssists] = useState(base?.stats.assists ?? 0);
  const [trophies, setTrophies] = useState(base?.stats.trophies ?? 0);
  const [caps, setCaps] = useState(base?.stats.caps ?? 0);
  const [overrideEnabled, setOverrideEnabled] = useState(base?.overallOverride != null);
  const [overrideValue, setOverrideValue] = useState(base?.overallOverride ?? 75);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computedOverall = useMemo(() => {
    const candidateId = editingPlayer?.id ?? "__candidate__";
    const pool = existingPlayers
      .filter((p) => p.department === department && p.id !== candidateId)
      .map((p) => ({ id: p.id, department: p.department, stats: p.stats }));
    pool.push({
      id: candidateId,
      department,
      stats: { appearances, goals, assists, trophies, caps },
    });
    const results = computeOverallRatings(pool);
    return results.find((r) => r.id === candidateId)?.overall ?? 60;
  }, [department, appearances, goals, assists, trophies, caps, existingPlayers, editingPlayer]);

  const finalOverall = overrideEnabled ? overrideValue : computedOverall;

  async function handleSubmit() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Inserisci il nome del giocatore.");
      return;
    }
    if (!clubId) {
      setError("Seleziona un club.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        department,
        clubId,
        nation: nation.trim(),
        marketValue,
        stats: { appearances, goals, assists, trophies, caps },
        overall: finalOverall,
        overallOverride: overrideEnabled ? overrideValue : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante il salvataggio.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-6">
      <h2 className="mb-4 text-lg font-semibold">
        {editingPlayer ? "Modifica giocatore" : "Nuovo giocatore"}
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Reparto
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value as Department)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="col-span-2 flex flex-col gap-1 text-sm font-medium">
          Club (definisce campionato ed epoca del giocatore)
          <select
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
          >
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.leagueName} {c.era}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Nazionalità del giocatore
          <input
            value={nation}
            onChange={(e) => setNation(e.target.value)}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Valore di mercato
          <input
            type="number"
            min={0}
            value={marketValue}
            onChange={(e) => setMarketValue(Number(e.target.value))}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
      </div>

      <h3 className="mt-6 mb-2 text-sm font-semibold text-[var(--text-secondary)] uppercase">
        Statistiche (per l'algoritmo Overall)
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Presenze
          <input
            type="number"
            min={0}
            value={appearances}
            onChange={(e) => setAppearances(Number(e.target.value))}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Gol
          <input
            type="number"
            min={0}
            value={goals}
            onChange={(e) => setGoals(Number(e.target.value))}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Assist
          <input
            type="number"
            min={0}
            value={assists}
            onChange={(e) => setAssists(Number(e.target.value))}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Trofei
          <input
            type="number"
            min={0}
            value={trophies}
            onChange={(e) => setTrophies(Number(e.target.value))}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Caps
          <input
            type="number"
            min={0}
            value={caps}
            onChange={(e) => setCaps(Number(e.target.value))}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5"
          />
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-xs text-[var(--text-secondary)] uppercase">
            Overall calcolato (rispetto al pool {department} attuale)
          </p>
          <p className="text-2xl font-extrabold">{computedOverall}</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={overrideEnabled}
              onChange={(e) => setOverrideEnabled(e.target.checked)}
            />
            Override manuale
          </label>
          <input
            type="number"
            min={60}
            max={99}
            disabled={!overrideEnabled}
            value={overrideValue}
            onChange={(e) => setOverrideValue(Number(e.target.value))}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2 disabled:opacity-50"
          />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[var(--surface-border)] px-5 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--brand)] sm:w-auto"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-contrast)] disabled:opacity-60 sm:w-auto"
        >
          {submitting ? "Salvataggio..." : "Salva giocatore"}
        </button>
      </div>
    </div>
  );
}
