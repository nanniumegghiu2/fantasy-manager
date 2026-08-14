import { describe, expect, it } from "vitest";
import {
  cupObjectiveMet,
  objectiveBudgetMultiplier,
  OBJECTIVE_WEIGHTS,
  seasonVerdictScore,
  suggestCupObjectiveTiers,
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

/**
 * **La società si allinea alla propria forza** (richiesta dell'utente, 2026-08-14).
 *
 * Prima le tre scelte erano sempre simmetriche, anche per la squadra più forte della nazione: le
 * si poteva dichiarare "metà classifica" e incassare il giudizio benevolo della dirigenza a fine
 * anno. Non è quello che fa un presidente — chi ha la rosa migliore **deve vincere** — e la
 * prudenza va guadagnata scendendo di livello.
 */
describe("l'ambizione dipende da quanto si è forti, e porta i mezzi con sé", () => {
  it("alla più forte della nazione non si propone alternativa: solo vincere", () => {
    const opp = avversarie(Array.from({ length: 19 }, () => 70));
    const tiers = suggestObjectiveTiers(undici(92), opp, 20);
    expect(tiers).toHaveLength(1);
    expect(tiers[0]!.label).toBe("Titolo");
  });

  it("chi è fra i primi sceglie se puntare al titolo o alla sua lotta, ma non si chiama fuori", () => {
    // Due avversarie più forti: siamo terzi in griglia, quindi Titolo o Europa — non "metà
    // classifica", che per una squadra così sarebbe una resa dichiarata in partenza.
    const opp = avversarie([90, 89, ...Array.from({ length: 17 }, () => 70)]);
    const tiers = suggestObjectiveTiers(undici(85), opp, 20);
    expect(tiers.length).toBeLessThanOrEqual(2);
    expect(tiers.every((t) => t.targetPosition <= 4)).toBe(true);
  });

  it("una squadra di metà classifica mantiene le tre scelte, prudenza compresa", () => {
    const opp = avversarie(Array.from({ length: 19 }, (_, i) => 65 + i));
    expect(suggestObjectiveTiers(undici(75), opp, 20)).toHaveLength(3);
  });

  it("più l'obiettivo è ambizioso, più alto è il fatturato concesso", () => {
    const titolo = objectiveBudgetMultiplier({ targetPosition: 1, label: "Titolo" });
    const europa = objectiveBudgetMultiplier({ targetPosition: 4, label: "Europa" });
    const salvezza = objectiveBudgetMultiplier({ targetPosition: 17, label: "Salvezza" });

    expect(titolo).toBeGreaterThan(europa);
    expect(europa).toBeGreaterThan(salvezza);
    // La prudenza costa davvero: senza un malus, dichiarare poco sarebbe gratis e quindi sempre
    // la scelta razionale.
    expect(salvezza).toBeLessThan(1);
  });

  it("la scala della seconda divisione paga come quella della prima, senza casi speciali", () => {
    // La promozione in Serie B è ambiziosa quanto il titolo in Serie A: il moltiplicatore
    // dipende dalla posizione nella scala, non dall'etichetta.
    expect(objectiveBudgetMultiplier({ targetPosition: 3, label: "Promozione" }, true)).toBe(
      objectiveBudgetMultiplier({ targetPosition: 1, label: "Titolo" }, false),
    );
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

/**
 * **Le coppe sono obiettivi a sé** (soluzione scelta dall'utente), con i pesi dichiarati:
 * Corona › campionato › Coppa Tricolore.
 *
 * La conseguenza che conta non è avere tre traguardi invece di uno, ma che il giudizio smetta di
 * essere binario: un'annata in cui si vince la Corona e si manca il quarto posto **non è un
 * fallimento**, e una in cui si salva solo la Tricolore **non è un successo**.
 */
describe("obiettivi di coppa e giudizio pesato", () => {
  it("la Corona pesa più del campionato, e il campionato più della Tricolore", () => {
    expect(OBJECTIVE_WEIGHTS.continental).toBeGreaterThan(OBJECTIVE_WEIGHTS.league);
    expect(OBJECTIVE_WEIGHTS.league).toBeGreaterThan(OBJECTIVE_WEIGHTS.national);
  });

  it("vincere la Corona compensa un campionato mancato", () => {
    const soloCorona = seasonVerdictScore({ league: false, continental: true });
    const soloCampionato = seasonVerdictScore({ league: true, continental: false });
    expect(soloCorona).toBeGreaterThan(0.5);
    expect(soloCorona).toBeGreaterThan(soloCampionato);
  });

  it("...ma la sola Coppa Tricolore non riscatta l'annata", () => {
    const soloTricolore = seasonVerdictScore({ league: false, continental: false, national: true });
    expect(soloTricolore).toBeLessThan(0.5);
  });

  it("i fronti a cui non si era iscritti non contano come mancati", () => {
    // Chi non gioca le coppe viene giudicato sul solo campionato: giudicarlo per una
    // competizione a cui non partecipava sarebbe una penalità inventata.
    expect(seasonVerdictScore({ league: true })).toBe(1);
    expect(seasonVerdictScore({ league: false })).toBe(0);
  });

  it("alla favorita della coppa si chiede il trofeo, all'outsider no", () => {
    expect(suggestCupObjectiveTiers(1, 16)).toHaveLength(1);
    expect(suggestCupObjectiveTiers(1, 16)[0]!.label).toBe("Vincerla");

    const outsider = suggestCupObjectiveTiers(14, 16);
    expect(outsider.some((t) => t.label === "Vincerla")).toBe(false);
  });

  it("l'obiettivo di coppa si giudica sui turni dal trofeo, non sul nome della fase", () => {
    // I due tabelloni hanno forma diversa: "semifinale" non è la stessa distanza dal trofeo in
    // Corona e in Tricolore, quindi il confronto per nome darebbe verdetti incoerenti.
    const semifinale = { label: "Semifinale" as const, roundsFromWin: 2 };
    expect(cupObjectiveMet(0, semifinale)).toBe(true);
    expect(cupObjectiveMet(2, semifinale)).toBe(true);
    expect(cupObjectiveMet(3, semifinale)).toBe(false);
  });
});
