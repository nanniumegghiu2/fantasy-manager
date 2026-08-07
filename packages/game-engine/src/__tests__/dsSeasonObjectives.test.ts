import { describe, expect, it } from "vitest";
import {
  objectiveMet,
  positionsBelowTarget,
  suggestObjectiveTiers,
} from "../ds/seasonObjectives";
import { createRosterEntry } from "../ds/roster";
import type { LeagueTeam } from "../season/leagueState";
import type { RosterEntry } from "../ds/types";

function rosa(overall: number, n = 20): RosterEntry[] {
  return Array.from({ length: n }, (_, i) =>
    createRosterEntry({ playerId: `p${i}`, overall, potential: overall + 2, sinceSeason: 1 }),
  );
}

function avversarie(ratings: number[]): LeagueTeam[] {
  return ratings.map((rating, i) => ({ id: `c${i}`, name: `Club ${i}`, rating }));
}

describe("suggestObjectiveTiers", () => {
  it("propone tre fasce distinte, ordinate dalla più ambiziosa alla più conservativa", () => {
    const opp = avversarie(Array.from({ length: 19 }, (_, i) => 65 + i));
    const tiers = suggestObjectiveTiers(rosa(75), opp, 20);
    expect(tiers).toHaveLength(3);
    const posizioni = tiers.map((t) => t.targetPosition);
    expect(new Set(posizioni).size).toBe(3);
    expect(posizioni[0]!).toBeLessThan(posizioni[2]!);
  });

  it("una rosa fortissima riceve un obiettivo ambizioso, non la salvezza", () => {
    const opp = avversarie(Array.from({ length: 19 }, () => 70));
    const tiers = suggestObjectiveTiers(rosa(92), opp, 20);
    expect(Math.min(...tiers.map((t) => t.targetPosition))).toBeLessThanOrEqual(3);
  });

  it("una rosa modesta non riceve mai il titolo come fascia realistica/conservativa", () => {
    const opp = avversarie(Array.from({ length: 19 }, () => 85));
    const tiers = suggestObjectiveTiers(rosa(62), opp, 20);
    expect(Math.max(...tiers.map((t) => t.targetPosition))).toBeGreaterThan(10);
  });

  it("resta dentro i confini della lega (1..teamsInLeague)", () => {
    const opp = avversarie(Array.from({ length: 19 }, () => 75));
    const tiers = suggestObjectiveTiers(rosa(75), opp, 20);
    for (const t of tiers) {
      expect(t.targetPosition).toBeGreaterThanOrEqual(1);
      expect(t.targetPosition).toBeLessThanOrEqual(20);
    }
  });
});

describe("positionsBelowTarget / objectiveMet", () => {
  it("positivo quando si è sotto l'obiettivo, negativo quando si è sopra", () => {
    expect(positionsBelowTarget(10, 5)).toBe(5);
    expect(positionsBelowTarget(3, 5)).toBe(-2);
  });

  it("l'obiettivo è raggiunto se la posizione finale è pari o migliore del target", () => {
    expect(objectiveMet(5, 5)).toBe(true);
    expect(objectiveMet(4, 5)).toBe(true);
    expect(objectiveMet(6, 5)).toBe(false);
  });
});
