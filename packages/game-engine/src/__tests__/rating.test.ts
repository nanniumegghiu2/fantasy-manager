import { describe, expect, it } from "vitest";
import { computeDepartmentRating, computeSquadRating } from "../rating";
import type { Player } from "@app/shared-types";

function makePlayer(overall: number): Player {
  return {
    id: crypto.randomUUID(),
    name: "Test",
    overall,
    marketValue: 10,
    clubId: "club-1",
    era: "1990s",
    nation: "Italia",
    league: "Serie A",
    role: "ATT",
    secondaryRoles: [],
    department: "ATT",
  };
}

describe("computeDepartmentRating", () => {
  it("e' la media degli overall dei titolari", () => {
    expect(computeDepartmentRating([makePlayer(80), makePlayer(90)])).toBe(85);
  });

  it("e' zero senza titolari", () => {
    expect(computeDepartmentRating([])).toBe(0);
  });
});

describe("computeSquadRating", () => {
  it("somma la media dei reparti al bonus chemistry", () => {
    const rating = computeSquadRating(
      [
        { department: "POR", rating: 80 },
        { department: "DIF", rating: 80 },
        { department: "CC", rating: 80 },
        { department: "ATT", rating: 80 },
      ],
      5,
    );
    expect(rating).toBe(85);
  });
});
