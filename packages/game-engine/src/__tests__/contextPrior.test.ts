import { describe, expect, it } from "vitest";
import { ageAt, computeContextPrior } from "../contextPrior";

describe("computeContextPrior", () => {
  it("resta sempre nel range 60-99", () => {
    const massimo = computeContextPrior({ age: 27, clubPrestige: 5, leaguePrestige: 5, nationPrestige: 5 });
    const minimo = computeContextPrior({ age: 38, clubPrestige: 1, leaguePrestige: 1, nationPrestige: 1 });
    // Banda stretta di proposito: una base da solo contesto non merita gli estremi.
    expect(massimo).toBeLessThanOrEqual(92);
    expect(minimo).toBeGreaterThanOrEqual(62);
    expect(massimo).toBeGreaterThan(minimo);
  });

  it("il club pesa più del campionato, e il campionato più della nazionalità", () => {
    const neutro = { age: 27, clubPrestige: 3, leaguePrestige: 3, nationPrestige: 3 };
    const perClub = computeContextPrior({ ...neutro, clubPrestige: 5 }) - computeContextPrior(neutro);
    const perLega = computeContextPrior({ ...neutro, leaguePrestige: 5 }) - computeContextPrior(neutro);
    const perNazione = computeContextPrior({ ...neutro, nationPrestige: 5 }) - computeContextPrior(neutro);
    expect(perClub).toBeGreaterThan(perLega);
    expect(perLega).toBeGreaterThan(perNazione);
  });

  it("la curva d'età premia il picco e penalizza i due estremi", () => {
    const at = (age: number) => computeContextPrior({ age, clubPrestige: 4, leaguePrestige: 5, nationPrestige: 4 });
    expect(at(27)).toBeGreaterThan(at(19));
    expect(at(27)).toBeGreaterThan(at(36));
    // Coda più lunga verso il basso: a parità di distanza dal picco il giovane è penalizzato meno.
    expect(at(20)).toBeGreaterThan(at(34));
  });

  it("i campi mancanti non fanno esplodere il calcolo: valgono il tier neutro", () => {
    const vuoto = computeContextPrior({});
    expect(vuoto).toBeGreaterThanOrEqual(62);
    expect(vuoto).toBeLessThanOrEqual(92);
    expect(vuoto).toBe(computeContextPrior({ age: 27, clubPrestige: 3, leaguePrestige: 3, nationPrestige: 3 }));
  });

  it("è deterministica: stessi fatti, stesso valore", () => {
    const input = { age: 25, clubPrestige: 4, leaguePrestige: 5, nationPrestige: 5 };
    expect(computeContextPrior(input)).toBe(computeContextPrior(input));
  });
});

describe("ageAt", () => {
  it("calcola l'età compiuta, non quella dell'anno solare", () => {
    expect(ageAt(new Date("1998-08-10"), new Date("2025-08-09"))).toBe(26);
    expect(ageAt(new Date("1998-08-10"), new Date("2025-08-10"))).toBe(27);
  });
});
