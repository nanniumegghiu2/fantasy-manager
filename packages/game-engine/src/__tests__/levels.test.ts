import { describe, expect, it } from "vitest";
import { computeLevelPointsDelta, levelForPoints, LEVELS } from "../levels";

describe("levelForPoints", () => {
  it("restituisce il primo livello per punteggio zero", () => {
    expect(levelForPoints(0).id).toBe("pulcini");
  });

  it("promuove al livello corretto superata la soglia", () => {
    expect(levelForPoints(350).id).toBe("dilettanti");
  });
});

describe("computeLevelPointsDelta", () => {
  it("premia molto la vittoria contro un livello superiore", () => {
    const delta = computeLevelPointsDelta({
      won: true,
      basePoints: 20,
      playerLevelOrder: 1,
      opponentLevelOrder: 3,
    });
    expect(delta).toBeGreaterThan(20);
  });

  it("penalizza molto la sconfitta contro un livello inferiore", () => {
    const delta = computeLevelPointsDelta({
      won: false,
      basePoints: 20,
      playerLevelOrder: 3,
      opponentLevelOrder: 1,
    });
    expect(delta).toBeLessThan(-20);
  });

  it("LEVELS e' ordinato e coerente", () => {
    expect(LEVELS.length).toBe(8);
  });
});
