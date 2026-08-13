import { describe, expect, it } from "vitest";
import {
  PROMOTION_SLOTS,
  SHOWCASE_LEAGUES,
  isClassicEligible,
  isContinentalEligible,
  isPlayableLeague,
  isSecondDivision,
  isShowcaseLeague,
  leagueOfClub,
  promotionAndRelegation,
  siblingDivisionOf,
} from "../divisions";

describe("divisioni: politica", () => {
  it("riconosce la Serie B come seconda divisione e la Serie A no", () => {
    expect(isSecondDivision("Serie B")).toBe(true);
    expect(isSecondDivision("Serie A")).toBe(false);
    expect(isSecondDivision("Premier League")).toBe(false);
  });

  it("esclude la Serie B da Corona e Classica, e non tocca gli altri campionati", () => {
    expect(isContinentalEligible("Serie B")).toBe(false);
    expect(isClassicEligible("Serie B")).toBe(false);

    for (const lega of ["Serie A", "Premier League", "La Liga", "Bundesliga", "Ligue 1"]) {
      expect(isContinentalEligible(lega)).toBe(true);
      expect(isClassicEligible(lega)).toBe(true);
    }
  });

  it("collega le due divisioni italiane in entrambi i versi", () => {
    expect(siblingDivisionOf("Serie A")).toBe("Serie B");
    expect(siblingDivisionOf("Serie B")).toBe("Serie A");
    // Un campionato senza seconda divisione non ha gemello: non deve inventarne uno.
    expect(siblingDivisionOf("Premier League")).toBeUndefined();
  });
});

describe("divisioni: promosse e retrocesse", () => {
  const classifica = Array.from({ length: 20 }, (_, i) => `club-${i + 1}`);

  it("prende le prime tre e le ultime tre della classifica ricevuta", () => {
    const { promoted, relegated } = promotionAndRelegation(classifica);
    expect(promoted).toEqual(["club-1", "club-2", "club-3"]);
    expect(relegated).toEqual(["club-18", "club-19", "club-20"]);
    expect(promoted).toHaveLength(PROMOTION_SLOTS);
    expect(relegated).toHaveLength(PROMOTION_SLOTS);
  });

  it("non riordina la classifica ricevuta", () => {
    // La classifica arriva già ordinata coi suoi criteri (punti, differenza reti, gol fatti).
    // Riordinarla qui su un criterio diverso produrrebbe due verità in disaccordo.
    const disordinata = ["z", "a", "m", "b"];
    expect(promotionAndRelegation(disordinata).promoted).toEqual(["z", "a", "m"]);
  });

  it("non fa uscire promosse e retrocesse dallo stesso gruppo quando la lega è cortissima", () => {
    // Caso limite da scenari di test: con 4 squadre le due fette si sovrappongono, ma nessuna
    // delle due deve andare fuori dai limiti dell'array.
    const { promoted, relegated } = promotionAndRelegation(["a", "b", "c", "d"]);
    expect(promoted).toEqual(["a", "b", "c"]);
    expect(relegated).toEqual(["b", "c", "d"]);
  });
});

describe("divisioni: dove si trova un club dopo N stagioni", () => {
  const A = "lega-a";
  const B = "lega-b";

  it("lascia dov'era chi non si è mai mosso", () => {
    expect(leagueOfClub("x", A, [], A, B)).toBe(A);
    expect(leagueOfClub("x", B, [], A, B)).toBe(B);
  });

  it("porta in Serie A chi è stato promosso", () => {
    const moves = [{ season: 1, promoted: ["x"], relegated: ["y"] }];
    expect(leagueOfClub("x", B, moves, A, B)).toBe(A);
    expect(leagueOfClub("y", A, moves, A, B)).toBe(B);
  });

  it("applica i movimenti in ordine di stagione: l'ultimo che tocca il club vince", () => {
    // Sale nella 2, riscende nella 5: deve risultare in Serie B, e il risultato non deve
    // dipendere dall'ordine in cui i movimenti sono elencati nel salvataggio.
    const moves = [
      { season: 5, promoted: [], relegated: ["x"] },
      { season: 2, promoted: ["x"], relegated: [] },
    ];
    expect(leagueOfClub("x", B, moves, A, B)).toBe(B);

    const risalito = [
      { season: 2, promoted: [], relegated: ["x"] },
      { season: 5, promoted: ["x"], relegated: [] },
    ];
    expect(leagueOfClub("x", A, risalito, A, B)).toBe(A);
  });

  it("ignora i movimenti che riguardano altri club", () => {
    const moves = [{ season: 1, promoted: ["altro"], relegated: ["terzo"] }];
    expect(leagueOfClub("x", A, moves, A, B)).toBe(A);
  });
});

/**
 * **Le leghe vetrina** (2026-08-13): in database per popolare il mercato, mai per farci una
 * carriera. L'esclusione dev'essere **attiva**, non per omissione: il selettore del club, le
 * iscritte alla Corona e il selettore della Classica leggono tutti "le leghe del database", e
 * senza questi predicati si sarebbero autopopolati il giorno stesso dell'import — è esattamente
 * la regressione già capitata con la Serie B.
 */
describe("leghe vetrina", () => {
  it("riconosce le vetrine e non tocca i campionati giocabili", () => {
    expect(isShowcaseLeague("Brasileirão")).toBe(true);
    expect(isShowcaseLeague("Saudi Pro League")).toBe(true);
    expect(isShowcaseLeague("Serie A")).toBe(false);
    expect(isShowcaseLeague("Serie B")).toBe(false);
    expect(isShowcaseLeague("Premier League")).toBe(false);
  });

  it("non ci si può fare carriera, mentre in Serie B sì", () => {
    for (const lega of SHOWCASE_LEAGUES) expect(isPlayableLeague(lega)).toBe(false);
    expect(isPlayableLeague("Serie B")).toBe(true);
    expect(isPlayableLeague("Ligue 1")).toBe(true);
  });

  it("nessuna vetrina entra in Corona Continentale né nella Modalità Classica", () => {
    for (const lega of SHOWCASE_LEAGUES) {
      expect(isContinentalEligible(lega)).toBe(false);
      expect(isClassicEligible(lega)).toBe(false);
    }
  });

  it("i Big 5 restano dentro a Corona e Classica", () => {
    for (const lega of ["Serie A", "Premier League", "La Liga", "Bundesliga", "Ligue 1"]) {
      expect(isContinentalEligible(lega)).toBe(true);
      expect(isClassicEligible(lega)).toBe(true);
      expect(isPlayableLeague(lega)).toBe(true);
    }
  });

  it("una vetrina non è una seconda divisione: sono due politiche diverse", () => {
    expect(isSecondDivision("Brasileirão")).toBe(false);
    expect(siblingDivisionOf("Brasileirão")).toBeUndefined();
  });
});
