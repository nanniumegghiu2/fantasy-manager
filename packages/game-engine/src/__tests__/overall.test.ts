import { describe, expect, it } from "vitest";
import { computeOverallRatings, resolveOverall, type OverallInput } from "../overall";
import type { PlayerStats } from "@app/shared-types";

function stats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return { appearances: 100, goals: 10, assists: 5, trophies: 1, caps: 10, ...overrides };
}

describe("computeOverallRatings", () => {
  it("restituisce array vuoto per pool vuoto", () => {
    expect(computeOverallRatings([])).toEqual([]);
  });

  it("assegna un valore centrale con un solo giocatore nel pool", () => {
    const result = computeOverallRatings([
      { id: "a", department: "ATT", stats: stats() },
    ]);
    expect(result[0].overall).toBeGreaterThanOrEqual(60);
    expect(result[0].overall).toBeLessThanOrEqual(99);
  });

  it("il migliore del pool per statistiche prende un overall piu' alto del peggiore", () => {
    const pool: OverallInput[] = [
      { id: "top", department: "ATT", stats: stats({ goals: 300, assists: 100, appearances: 500, trophies: 10, caps: 100 }) },
      { id: "mid", department: "ATT", stats: stats({ goals: 100, assists: 40, appearances: 250, trophies: 3, caps: 30 }) },
      { id: "low", department: "ATT", stats: stats({ goals: 5, assists: 2, appearances: 50, trophies: 0, caps: 0 }) },
    ];
    const result = computeOverallRatings(pool);
    const byId = Object.fromEntries(result.map((r) => [r.id, r.overall]));
    expect(byId.top).toBeGreaterThan(byId.mid);
    expect(byId.mid).toBeGreaterThan(byId.low);
  });

  it("resta nel range 60-99", () => {
    const pool: OverallInput[] = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      department: "CC" as const,
      stats: stats({ goals: i * 12, assists: i * 8, appearances: i * 40, trophies: i, caps: i * 5 }),
    }));
    for (const { overall } of computeOverallRatings(pool)) {
      expect(overall).toBeGreaterThanOrEqual(60);
      expect(overall).toBeLessThanOrEqual(99);
    }
  });

  it("pesa i gol piu' degli assist per un attaccante", () => {
    const pool: OverallInput[] = [
      { id: "scorer", department: "ATT", stats: stats({ goals: 200, assists: 20 }) },
      { id: "passer", department: "ATT", stats: stats({ goals: 20, assists: 200 }) },
    ];
    const result = computeOverallRatings(pool);
    const byId = Object.fromEntries(result.map((r) => [r.id, r.overall]));
    expect(byId.scorer).toBeGreaterThan(byId.passer);
  });
});

describe("resolveOverall", () => {
  it("usa il calcolato se non c'e' override", () => {
    expect(resolveOverall(75, null)).toBe(75);
    expect(resolveOverall(75, undefined)).toBe(75);
  });

  it("l'override editoriale vince sempre", () => {
    expect(resolveOverall(75, 88)).toBe(88);
  });
});
