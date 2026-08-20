/**
 * **L'annata accanto al numero di stagione** (richiesta dell'utente: *"oltre al numero di
 * stagione voglio anche l'annata, partendo dall'attuale 2026/27, e prosegui sempre di una"*).
 *
 * Una funzione sola nel motore, cosi i nove punti dell'interfaccia che stampano il numero di
 * stagione non possono divergere fra loro.
 */
import { describe, expect, it } from "vitest";
import { FIRST_SEASON_YEAR, seasonLabel, seasonYearLabel } from "../ds/types";

describe("annata di carriera", () => {
  it("la prima stagione e 2026/27, come richiesto", () => {
    expect(seasonYearLabel(1)).toBe("2026/27");
    expect(FIRST_SEASON_YEAR).toBe(2026);
  });

  it("avanza di un anno a ogni stagione, fino alla decima", () => {
    expect(seasonYearLabel(2)).toBe("2027/28");
    expect(seasonYearLabel(5)).toBe("2030/31");
    expect(seasonYearLabel(10)).toBe("2035/36");
  });

  it("il cambio di secolo non produce un anno a una cifra", () => {
    // 2099/00, non 2099/0: e il genere di dettaglio che si nota solo quando capita.
    expect(seasonYearLabel(74)).toBe("2099/00");
    expect(seasonYearLabel(75)).toBe("2100/01");
  });

  it("la forma completa tiene insieme numero e annata", () => {
    expect(seasonLabel(3)).toBe("Stagione 3 \u00b7 2028/29");
  });

  it("una stagione non valida non produce un'annata assurda", () => {
    expect(seasonYearLabel(0)).toBe("2026/27");
    expect(seasonYearLabel(-4)).toBe("2026/27");
  });
});
