import { describe, expect, it } from "vitest";
import type { Role } from "@app/shared-types";
import {
  applySeasonAdjustment,
  computeOverallV2,
  ROLE_PROFILE,
  type OverallV2Input,
} from "../overallV2";

const FULL_SEASON = 34 * 90;

function player(
  id: string,
  role: Role,
  stats: Partial<OverallV2Input["stats"]> = {},
  leaguePrestige?: number,
): OverallV2Input {
  return {
    id,
    role,
    leaguePrestige,
    stats: { minutes: FULL_SEASON, goals: 0, assists: 0, ...stats },
  };
}

function overallOf(results: { id: string; overall: number }[], id: string): number {
  return results.find((r) => r.id === id)!.overall;
}

describe("computeOverallV2", () => {
  it("resta sempre nel range 60-99", () => {
    const results = computeOverallV2([
      player("scarso", "ATT", { minutes: 90, goals: 0, assists: 0, averageRating: 4 }),
      player("mostro", "ATT", { goals: 40, assists: 20, averageRating: 9 }),
    ]);
    for (const r of results) {
      expect(r.overall).toBeGreaterThanOrEqual(60);
      expect(r.overall).toBeLessThanOrEqual(99);
    }
  });

  /** Pool di riempimento realistico: i prior di ruolo su due soli giocatori sarebbero assurdi. */
  const league = Array.from({ length: 40 }, (_, i) =>
    player(`lega${i}`, "ATT", { minutes: 1800, goals: 4, assists: 3, averageRating: 6.1 }),
  );

  it("un bomber di stagione intera vale più di uno con gli stessi gol in pochi minuti", () => {
    const results = computeOverallV2([
      player("stagione", "ATT", { minutes: FULL_SEASON, goals: 12 }),
      player("spezzone", "ATT", { minutes: 200, goals: 12 }),
      ...league,
    ]);
    expect(overallOf(results, "stagione")).toBeGreaterThan(overallOf(results, "spezzone"));
  });

  it("con pochi minuti l'Overall tende al neutro, non al fuoriclasse", () => {
    const results = computeOverallV2([
      player("meteora", "ATT", { minutes: 180, goals: 3 }),
      player("titolare", "ATT", { minutes: FULL_SEASON, goals: 18 }),
      ...league,
    ]);
    // 3 gol in 2 partite sarebbero 1.5 gol/90: senza confidenza da minutaggio batterebbe chiunque.
    expect(overallOf(results, "meteora")).toBeLessThan(overallOf(results, "titolare"));
  });

  it("i trofei non esistono più: due compagni di squadra con numeri diversi hanno Overall diversi", () => {
    const results = computeOverallV2([
      player("goleador", "ATT", { goals: 17, assists: 5, averageRating: 7 }),
      player("panchinaro", "ATT", { minutes: 300, goals: 0, assists: 0, averageRating: 5.8 }),
    ]);
    expect(overallOf(results, "goleador")).toBeGreaterThan(overallOf(results, "panchinaro") + 10);
  });

  it("la scala è assoluta: lo stesso giocatore vale uguale in un pool piccolo o grande", () => {
    const target = player("target", "ATT", { goals: 14, assists: 6, averageRating: 6.9 });
    const filler = Array.from({ length: 60 }, (_, i) =>
      player(`f${i}`, "ATT", { minutes: 1500, goals: 2, assists: 2, averageRating: 6.1 }),
    );
    const small = computeOverallV2([target, filler[0]]);
    const large = computeOverallV2([target, ...filler]);
    // I prior di ruolo cambiano leggermente col pool, ma non la mappatura punteggio→Overall.
    expect(Math.abs(overallOf(small, "target") - overallOf(large, "target"))).toBeLessThanOrEqual(3);
  });

  it("un difensore è valutato su media voto e minutaggio, non sui gol", () => {
    const results = computeOverallV2([
      player("centrale", "DC", { goals: 1, assists: 1, averageRating: 7 }),
      player("centrale-scarso", "DC", { minutes: 600, goals: 1, assists: 1, averageRating: 5.6 }),
    ]);
    expect(overallOf(results, "centrale")).toBeGreaterThan(overallOf(results, "centrale-scarso"));
  });

  it("il portiere usa i clean sheet al posto della produzione offensiva", () => {
    const results = computeOverallV2([
      player("muro", "POR", { averageRating: 6.8, cleanSheets: 16 }),
      player("colabrodo", "POR", { averageRating: 5.8, cleanSheets: 2 }),
    ]);
    expect(overallOf(results, "muro")).toBeGreaterThan(overallOf(results, "colabrodo"));
    const muro = results.find((r) => r.id === "muro")!;
    expect(muro.breakdown.cleanSheet).not.toBeNull();
    expect(muro.breakdown.production).toBe(0);
  });

  it("senza media voto il peso si ridistribuisce invece di azzerare tutti", () => {
    const conRating = computeOverallV2([player("x", "ATT", { goals: 15, averageRating: 7 })]);
    const senzaRating = computeOverallV2([player("x", "ATT", { goals: 15 })]);
    expect(senzaRating[0].breakdown.quality).toBeNull();
    // Senza il voto resta comunque un Overall alto, retto da produzione e minutaggio.
    expect(senzaRating[0].overall).toBeGreaterThan(75);
    expect(Math.abs(senzaRating[0].overall - conRating[0].overall)).toBeLessThan(15);
  });

  it("il prestigio del campionato sposta di pochi punti, non ribalta la classifica", () => {
    const results = computeOverallV2([
      player("serieA", "ATT", { goals: 10, averageRating: 6.5 }, 5),
      player("legaMinore", "ATT", { goals: 10, averageRating: 6.5 }, 1),
    ]);
    const delta = overallOf(results, "serieA") - overallOf(results, "legaMinore");
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(7);
  });

  it("copre tutti i 14 ruoli del tabellone", () => {
    const roles = Object.keys(ROLE_PROFILE) as Role[];
    expect(roles).toHaveLength(14);
    const results = computeOverallV2(roles.map((role) => player(role, role, { averageRating: 6.3 })));
    expect(results).toHaveLength(14);
    for (const r of results) expect(Number.isFinite(r.overall)).toBe(true);
  });

  it("un pool vuoto non esplode", () => {
    expect(computeOverallV2([])).toEqual([]);
  });
});

describe("applySeasonAdjustment", () => {
  const base = (id: string, role: Role, baseOverall: number, stats: Partial<OverallV2Input["stats"]> = {}) => ({
    ...player(id, role, stats),
    baseOverall,
  });

  it("premia chi rende più del suo valore di partenza e penalizza chi rende meno", () => {
    const results = applySeasonAdjustment([
      base("sorpresa", "ATT", 72, { goals: 18, assists: 6, averageRating: 7.1 }),
      base("deludente", "ATT", 90, { goals: 1, assists: 0, averageRating: 5.6 }),
    ]);
    expect(results.find((r) => r.id === "sorpresa")!.adjustment).toBeGreaterThan(0);
    expect(results.find((r) => r.id === "deludente")!.adjustment).toBeLessThan(0);
  });

  it("lo scostamento non supera mai il tetto: la base resta dominante", () => {
    const results = applySeasonAdjustment([
      base("mostro", "ATT", 60, { goals: 45, assists: 25, averageRating: 9 }),
      base("disastro", "ATT", 99, { goals: 0, assists: 0, averageRating: 4 }),
    ]);
    for (const r of results) expect(Math.abs(r.adjustment)).toBeLessThanOrEqual(8);
    // Un 60 che segna 45 gol non diventa un 99 in una stagione sola.
    expect(results.find((r) => r.id === "mostro")!.overall).toBeLessThanOrEqual(68);
  });

  it("il tetto è configurabile", () => {
    const [r] = applySeasonAdjustment(
      [base("x", "ATT", 70, { goals: 30, averageRating: 8 })],
      3,
    );
    expect(Math.abs(r.adjustment)).toBeLessThanOrEqual(3);
  });

  it("con pochi minuti l'aggiustamento è quasi nullo: non sappiamo abbastanza", () => {
    const results = applySeasonAdjustment([
      base("spezzone", "ATT", 85, { minutes: 180, goals: 4, averageRating: 7.5 }),
      base("titolare", "ATT", 85, { minutes: FULL_SEASON, goals: 20, averageRating: 7.5 }),
    ]);
    const spezzone = Math.abs(results.find((r) => r.id === "spezzone")!.adjustment);
    const titolare = Math.abs(results.find((r) => r.id === "titolare")!.adjustment);
    expect(spezzone).toBeLessThan(titolare);
    expect(spezzone).toBeLessThanOrEqual(2);
  });

  it("il confronto è col rendimento atteso per quel livello, non con la media", () => {
    // Stessa identica stagione, basi diverse: il più quotato prende meno bonus (o un malus).
    const stats = { goals: 8, assists: 4, averageRating: 6.4 };
    const results = applySeasonAdjustment([
      base("modesto", "ATT", 68, stats),
      base("stella", "ATT", 92, stats),
    ]);
    const modesto = results.find((r) => r.id === "modesto")!.adjustment;
    const stella = results.find((r) => r.id === "stella")!.adjustment;
    expect(modesto).toBeGreaterThan(stella);
  });

  it("l'Overall risultante resta nel range 60-99", () => {
    const results = applySeasonAdjustment([
      base("basso", "DC", 61, { minutes: 200, averageRating: 4.5 }),
      base("alto", "ATT", 98, { goals: 35, assists: 15, averageRating: 8.5 }),
    ]);
    for (const r of results) {
      expect(r.overall).toBeGreaterThanOrEqual(60);
      expect(r.overall).toBeLessThanOrEqual(99);
    }
  });
});
