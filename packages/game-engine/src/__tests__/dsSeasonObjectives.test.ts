import { describe, expect, it } from "vitest";
import {
  objectiveMet,
  OBJECTIVE_THRESHOLDS,
  positionsBelowTarget,
  suggestObjectiveTiers,
  tierFor,
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

/**
 * Richiesta esplicita dell'utente: soglie **fisse**, non più un offset di ±4 posizioni attorno
 * a una stima. Salvezza entro la 17ª, parte bassa entro la 13ª, metà classifica entro la 9ª,
 * Europa fra le prime 4, titolo il 1º posto.
 */
describe("soglie fisse dell'obiettivo stagionale", () => {
  it("le cinque soglie dichiarate sono esattamente 17/13/9/4/1", () => {
    expect(OBJECTIVE_THRESHOLDS.map((t) => t.targetPosition)).toEqual([1, 4, 9, 13, 17]);
    expect(OBJECTIVE_THRESHOLDS.map((t) => t.label)).toEqual([
      "Titolo", "Europa", "Metà classifica", "Parte bassa", "Salvezza",
    ]);
  });

  it("tierFor assegna lo scaglione più ambizioso ancora raggiunto dalla posizione", () => {
    expect(tierFor(1).label).toBe("Titolo");
    expect(tierFor(3).label).toBe("Europa");
    expect(tierFor(4).label).toBe("Europa");
    expect(tierFor(5).label).toBe("Metà classifica");
    expect(tierFor(9).label).toBe("Metà classifica");
    expect(tierFor(10).label).toBe("Parte bassa");
    expect(tierFor(13).label).toBe("Parte bassa");
    expect(tierFor(14).label).toBe("Salvezza");
    expect(tierFor(17).label).toBe("Salvezza");
    // Zona retrocessione (18-20): resta Salvezza, non esiste uno scaglione più permissivo.
    expect(tierFor(20).label).toBe("Salvezza");
  });

  it("ogni fascia proposta da suggestObjectiveTiers è sempre una delle 5 soglie fisse", () => {
    const opp = avversarie(Array.from({ length: 19 }, (_, i) => 65 + i));
    const soglieValide = new Set(OBJECTIVE_THRESHOLDS.map((t) => t.targetPosition));
    for (const overall of [60, 68, 75, 82, 90, 98]) {
      const tiers = suggestObjectiveTiers(rosa(overall), opp, 20);
      for (const t of tiers) expect(soglieValide.has(t.targetPosition)).toBe(true);
    }
  });

  it("una rosa già da titolo propone al più due fasce (non esiste nulla di più ambizioso)", () => {
    const opp = avversarie(Array.from({ length: 19 }, () => 60));
    const tiers = suggestObjectiveTiers(rosa(99), opp, 20);
    expect(tiers.some((t) => t.label === "Titolo")).toBe(true);
    expect(tiers.length).toBeLessThanOrEqual(2);
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
