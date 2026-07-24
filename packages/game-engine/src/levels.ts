import type { Level } from "@app/shared-types";

/** Valori placeholder di bilanciamento — da tarare in base ai dati reali di gioco. */
export const LEVELS: Level[] = [
  { id: "pulcini", name: "Pulcini", order: 1, pointsThreshold: 0, baseBudget: 500 },
  { id: "giovanissimi", name: "Giovanissimi", order: 2, pointsThreshold: 100, baseBudget: 750 },
  { id: "dilettanti", name: "Dilettanti", order: 3, pointsThreshold: 300, baseBudget: 1000 },
  {
    id: "semiprofessionisti",
    name: "Semiprofessionisti",
    order: 4,
    pointsThreshold: 600,
    baseBudget: 1500,
  },
  {
    id: "professionisti",
    name: "Professionisti",
    order: 5,
    pointsThreshold: 1000,
    baseBudget: 2000,
  },
  { id: "nazionale", name: "Nazionale", order: 6, pointsThreshold: 1600, baseBudget: 3000 },
  {
    id: "internazionale",
    name: "Internazionale",
    order: 7,
    pointsThreshold: 2500,
    baseBudget: 4500,
  },
  { id: "leggenda", name: "Leggenda", order: 8, pointsThreshold: 4000, baseBudget: 6000 },
];

export function levelForPoints(points: number): Level {
  const sorted = [...LEVELS].sort((a, b) => a.order - b.order);
  let current = sorted[0];
  for (const level of sorted) {
    if (points >= level.pointsThreshold) {
      current = level;
    }
  }
  return current;
}

const UNDERDOG_MULTIPLIER = 2.5;

/**
 * Punti Livello asimmetrici: battere un livello superiore vale molto di piu',
 * perdere contro un livello inferiore costa molto di piu' (CLAUDE.md sez. 5.3).
 */
export function computeLevelPointsDelta(params: {
  won: boolean;
  basePoints: number;
  playerLevelOrder: number;
  opponentLevelOrder: number;
}): number {
  const { won, basePoints, playerLevelOrder, opponentLevelOrder } = params;
  const levelGap = opponentLevelOrder - playerLevelOrder;

  if (won) {
    const multiplier = levelGap > 0 ? UNDERDOG_MULTIPLIER : levelGap < 0 ? 0.5 : 1;
    return Math.round(basePoints * multiplier);
  }

  const multiplier = levelGap < 0 ? UNDERDOG_MULTIPLIER : levelGap > 0 ? 0.5 : 1;
  return -Math.round(basePoints * multiplier);
}
