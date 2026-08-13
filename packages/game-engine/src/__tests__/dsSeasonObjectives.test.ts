import { describe, expect, it } from "vitest";
import {
  objectiveMet,
  OBJECTIVE_THRESHOLDS,
  SECOND_DIVISION_THRESHOLDS,
  positionsBelowTarget,
  suggestObjectiveTiers,
  tierFor,
} from "../ds/seasonObjectives";
import type { LeagueTeam } from "../season/leagueState";

/**
 * La forza dei **nostri undici migliori**: è l'unità di misura con cui `suggestObjectiveTiers`
 * confronta la squadra con le avversarie, la stessa con cui è costruito il loro `rating`. Prima
 * arrivava qui la rosa intera, riserve comprese, e il paragone ci sottostimava sempre.
 */
const undici = (overall: number) => overall;

function avversarie(ratings: number[]): LeagueTeam[] {
  return ratings.map((rating, i) => ({ id: `c${i}`, name: `Club ${i}`, rating }));
}

describe("suggestObjectiveTiers", () => {
  it("propone tre fasce distinte, ordinate dalla più ambiziosa alla più conservativa", () => {
    const opp = avversarie(Array.from({ length: 19 }, (_, i) => 65 + i));
    const tiers = suggestObjectiveTiers(undici(75), opp, 20);
    expect(tiers).toHaveLength(3);
    const posizioni = tiers.map((t) => t.targetPosition);
    expect(new Set(posizioni).size).toBe(3);
    expect(posizioni[0]!).toBeLessThan(posizioni[2]!);
  });

  it("una rosa fortissima riceve un obiettivo ambizioso, non la salvezza", () => {
    const opp = avversarie(Array.from({ length: 19 }, () => 70));
    const tiers = suggestObjectiveTiers(undici(92), opp, 20);
    expect(Math.min(...tiers.map((t) => t.targetPosition))).toBeLessThanOrEqual(3);
  });

  it("una rosa modesta non riceve mai il titolo come fascia realistica/conservativa", () => {
    const opp = avversarie(Array.from({ length: 19 }, () => 85));
    const tiers = suggestObjectiveTiers(undici(62), opp, 20);
    expect(Math.max(...tiers.map((t) => t.targetPosition))).toBeGreaterThan(10);
  });

  it("resta dentro i confini della lega (1..teamsInLeague)", () => {
    const opp = avversarie(Array.from({ length: 19 }, () => 75));
    const tiers = suggestObjectiveTiers(undici(75), opp, 20);
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
      const tiers = suggestObjectiveTiers(undici(overall), opp, 20);
      for (const t of tiers) expect(soglieValide.has(t.targetPosition)).toBe(true);
    }
  });

  it("una rosa già da titolo propone al più due fasce (non esiste nulla di più ambizioso)", () => {
    const opp = avversarie(Array.from({ length: 19 }, () => 60));
    const tiers = suggestObjectiveTiers(undici(99), opp, 20);
    expect(tiers.some((t) => t.label === "Titolo")).toBe(true);
    expect(tiers.length).toBeLessThanOrEqual(2);
  });
});

/**
 * Segnalazione dell'utente: in Serie B gli obiettivi proponevano "Europa", che in quel
 * campionato non vuol dire niente. La scala deve adattarsi alla divisione — promozione,
 * playoff, salvezza — e la promozione è la **3ª** perché sono tre i posti che salgono.
 */
describe("scala della seconda divisione", () => {
  it("non nomina mai Europa o Titolo", () => {
    const etichette = SECOND_DIVISION_THRESHOLDS.map((t) => t.label);
    expect(etichette).not.toContain("Europa");
    expect(etichette).not.toContain("Titolo");
    expect(etichette[0]).toBe("Promozione");
  });

  it("la promozione è la terza posizione, quante ne salgono davvero", () => {
    expect(SECOND_DIVISION_THRESHOLDS[0]!.targetPosition).toBe(3);
    expect(tierFor(3, true).label).toBe("Promozione");
    expect(tierFor(4, true).label).toBe("Playoff");
    expect(tierFor(20, true).label).toBe("Salvezza");
  });

  it("una squadra forte di Serie B punta alla promozione, non all'Europa", () => {
    const opp = avversarie(Array.from({ length: 19 }, () => 66));
    const tiers = suggestObjectiveTiers(undici(74), opp, 20, true);
    expect(tiers.some((t) => t.label === "Promozione")).toBe(true);
    for (const t of tiers) {
      expect(["Promozione", "Playoff", "Metà classifica", "Salvezza"]).toContain(t.label);
    }
  });
});

/**
 * Il difetto che ha imposto la correzione: con la squadra più forte del campionato l'obiettivo
 * massimo proposto era l'Europa. La causa era il paragone fra due grandezze diverse — la media
 * della **rosa intera** contro il rating degli **undici** avversari.
 */
describe("la stima usa gli undici migliori", () => {
  it("chi è più forte di tutte le avversarie si vede proporre il titolo", () => {
    const opp = avversarie(Array.from({ length: 19 }, (_, i) => 70 + i * 0.5));
    const tiers = suggestObjectiveTiers(undici(85), opp, 20);
    expect(tiers.some((t) => t.label === "Titolo")).toBe(true);
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
