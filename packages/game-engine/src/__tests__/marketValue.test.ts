import { describe, expect, it } from "vitest";
import { computeMarketValue, nationPrestigeTier } from "../marketValue";

const baseInput = {
  leaguePrestigeTier: 3,
  clubPrestigeTier: 3,
  nationPrestigeTier: 3,
  clubsInSameEra: 10,
};

describe("computeMarketValue", () => {
  it("cresce in modo non lineare con l'overall (i migliori valgono molto piu' che proporzionalmente)", () => {
    const low = computeMarketValue({ ...baseInput, overall: 65 });
    const mid = computeMarketValue({ ...baseInput, overall: 80 });
    const high = computeMarketValue({ ...baseInput, overall: 95 });

    const gapLowMid = mid - low;
    const gapMidHigh = high - mid;
    expect(gapMidHigh).toBeGreaterThan(gapLowMid);
  });

  it("un club/campionato piu' prestigioso aumenta il valore a parita' di overall", () => {
    const normal = computeMarketValue({ ...baseInput, overall: 85 });
    const prestigious = computeMarketValue({
      ...baseInput,
      overall: 85,
      leaguePrestigeTier: 5,
      clubPrestigeTier: 5,
    });
    expect(prestigious).toBeGreaterThan(normal);
  });

  it("una nazionalita' piu' blasonata da' un bonus contenuto, non dominante", () => {
    const base = computeMarketValue({ ...baseInput, overall: 85 });
    const prestigiousNation = computeMarketValue({ ...baseInput, overall: 85, nationPrestigeTier: 5 });
    const ratio = prestigiousNation / base;
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(1.2);
  });

  it("piu' club nella stessa epoca aumentano il valore (piu' potenziale chemistry)", () => {
    const sparseEra = computeMarketValue({ ...baseInput, overall: 85, clubsInSameEra: 1 });
    const richEra = computeMarketValue({ ...baseInput, overall: 85, clubsInSameEra: 20 });
    expect(richEra).toBeGreaterThan(sparseEra);
  });

  it("arrotonda a multipli di 50.000", () => {
    const value = computeMarketValue({ ...baseInput, overall: 77 });
    expect(value % 50_000).toBe(0);
  });
});

describe("nationPrestigeTier", () => {
  it("restituisce un tier alto per nazioni calcisticamente blasonate", () => {
    expect(nationPrestigeTier("Brasile")).toBe(5);
    expect(nationPrestigeTier("Italia")).toBe(5);
  });

  it("restituisce il default 3 per nazioni non elencate", () => {
    expect(nationPrestigeTier("Islanda")).toBe(3);
  });
});
