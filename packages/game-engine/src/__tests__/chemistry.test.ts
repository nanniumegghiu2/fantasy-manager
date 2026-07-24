import { describe, expect, it } from "vitest";
import { computeChemistryBonus, computeChemistryLink } from "../chemistry";
import type { Player } from "@app/shared-types";

function makePlayer(overrides: Partial<Player>): Player {
  return {
    id: "p1",
    name: "Test Player",
    overall: 80,
    marketValue: 100,
    clubId: "club-1",
    era: "1990s",
    nation: "Italia",
    league: "Serie A",
    department: "CC",
    ...overrides,
  };
}

describe("computeChemistryLink", () => {
  it("e' rosso se non c'e' nulla in comune", () => {
    const a = makePlayer({ id: "a", league: "Serie A", era: "1990s", nation: "Italia" });
    const b = makePlayer({ id: "b", league: "La Liga", era: "2010s", nation: "Spagna" });
    expect(computeChemistryLink(a, b).color).toBe("red");
  });

  it("e' arancione se condividono una sola caratteristica", () => {
    const a = makePlayer({ id: "a", league: "Serie A", era: "1990s", nation: "Italia" });
    const b = makePlayer({ id: "b", league: "Serie A", era: "2010s", nation: "Spagna" });
    expect(computeChemistryLink(a, b).color).toBe("orange");
  });

  it("e' arancione anche se condividono solo l'anno", () => {
    const a = makePlayer({ id: "a", league: "Serie A", era: "1990s", nation: "Italia" });
    const b = makePlayer({ id: "b", league: "La Liga", era: "1990s", nation: "Spagna" });
    expect(computeChemistryLink(a, b).color).toBe("orange");
  });

  it("e' verde se condividono due o piu' caratteristiche", () => {
    const a = makePlayer({ id: "a", league: "Serie A", era: "1990s", nation: "Italia" });
    const b = makePlayer({ id: "b", league: "Serie A", era: "1990s", nation: "Spagna" });
    expect(computeChemistryLink(a, b).color).toBe("green");
  });
});

describe("computeChemistryBonus", () => {
  it("e' zero senza collegamenti", () => {
    expect(computeChemistryBonus([])).toBe(0);
  });

  it("e' massimo quando tutte le linee sono verdi", () => {
    const link = { playerAId: "a", playerBId: "b", sharedTraits: 2, color: "green" as const };
    expect(computeChemistryBonus([link, link])).toBe(10);
  });
});
