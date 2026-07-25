import type { Department, PlayerStats } from "@app/shared-types";

type StatKey = keyof PlayerStats;

const STAT_KEYS: StatKey[] = ["appearances", "goals", "assists", "trophies", "caps"];

/** Pesi per reparto (CLAUDE.md sez. 2.2) — ogni riga somma a 1. */
const DEPARTMENT_WEIGHTS: Record<Department, Record<StatKey, number>> = {
  ATT: { goals: 0.35, assists: 0.2, appearances: 0.15, trophies: 0.15, caps: 0.15 },
  CC: { goals: 0.1, assists: 0.3, appearances: 0.2, trophies: 0.2, caps: 0.2 },
  DIF: { goals: 0.05, assists: 0.1, appearances: 0.3, trophies: 0.3, caps: 0.25 },
  POR: { goals: 0, assists: 0, appearances: 0.35, trophies: 0.35, caps: 0.3 },
};

const MIN_OVERALL = 60;
const MAX_OVERALL = 99;

export interface OverallInput {
  id: string;
  department: Department;
  stats: PlayerStats;
}

export interface OverallResult {
  id: string;
  overall: number;
}

/**
 * Calcola l'Overall (60-99) di un intero pool di giocatori: normalizza ogni statistica
 * min-max sul pool, applica i pesi di reparto, poi mappa il percentile del punteggio
 * composito sul range 60-99. Il percentile e' relativo al pool passato: ricalcolare con
 * lo stesso pool da' sempre lo stesso risultato, un pool diverso puo' spostare i valori.
 */
export function computeOverallRatings(players: OverallInput[]): OverallResult[] {
  if (players.length === 0) return [];

  if (players.length === 1) {
    const player = players[0];
    return [{ id: player.id, overall: Math.round((MIN_OVERALL + MAX_OVERALL) / 2) }];
  }

  const ranges = STAT_KEYS.reduce(
    (acc, key) => {
      const values = players.map((p) => p.stats[key]);
      acc[key] = { min: Math.min(...values), max: Math.max(...values) };
      return acc;
    },
    {} as Record<StatKey, { min: number; max: number }>,
  );

  function normalizedStat(value: number, key: StatKey): number {
    const { min, max } = ranges[key];
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  }

  const composites = players.map((player) => {
    const weights = DEPARTMENT_WEIGHTS[player.department];
    const score = STAT_KEYS.reduce(
      (sum, key) => sum + weights[key] * normalizedStat(player.stats[key], key),
      0,
    );
    return { id: player.id, score };
  });

  const sortedScores = [...composites].map((c) => c.score).sort((a, b) => a - b);

  function percentileOf(score: number): number {
    const index = sortedScores.findIndex((s) => s === score);
    return index / (sortedScores.length - 1);
  }

  return composites.map(({ id, score }) => {
    const percentile = percentileOf(score);
    const overall = Math.round(MIN_OVERALL + percentile * (MAX_OVERALL - MIN_OVERALL));
    return { id, overall };
  });
}

/** Overall finale da salvare: l'override editoriale (sez. 2.2) vince sempre se presente. */
export function resolveOverall(computed: number, override: number | null | undefined): number {
  return override ?? computed;
}
