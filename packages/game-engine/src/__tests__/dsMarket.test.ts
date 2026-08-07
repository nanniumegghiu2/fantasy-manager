/**
 * Test di budget, mercato e prestiti.
 *
 * I test che contano davvero sono due, e riguardano entrambi la giocabilità più che la
 * correttezza formale: che **valorizzare un giovane e rivenderlo sia profittevole** (è la
 * strategia con cui un club piccolo può finanziarsi) e che i **vincoli anti-deriva** reggano,
 * perché senza di essi dieci stagioni di mercato producono club con quindici fuoriclasse.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
  cupMultiplier,
  initialBudget,
  nextSeasonBudget,
  positionMultiplier,
  MIN_BUDGET,
} from "../ds/budget";
import {
  ageFactor,
  appetite,
  askingPrice,
  currentValue,
  departmentNeed,
  formFactor,
  respondToCounterOffer,
  STAR_THRESHOLD,
  type MarketPlayer,
  type ValuationContext,
} from "../ds/market";
import {
  canLoanIn,
  canLoanOut,
  estimateLoanMinutes,
  isGoodLoanDestination,
  loanFee,
  MAX_LOANS_OUT,
  openLoan,
  settleLoans,
} from "../ds/loans";
import { createRosterEntry } from "../ds/roster";
import { aiSellableListings, type MarketWorld } from "../ds/careerMarket";
import { FABBISOGNO_PER_REPARTO } from "../ds/aiWorld";
import type { Department } from "@app/shared-types";

const CONTEXT: ValuationContext = {
  leaguePrestigeByClub: { big: 5, piccolo: 2 },
  clubPrestige: { big: 5, piccolo: 2 },
  clubsInSameEra: 96,
};

function player(over: Partial<MarketPlayer> = {}): MarketPlayer {
  return {
    playerId: "p1",
    clubId: "big",
    overall: 78,
    potential: 80,
    age: 26,
    nation: "Italia",
    department: "ATT" as Department,
    stats: { appearances: 30, minutes: 2700, goals: 12, assists: 5 },
    ...over,
  };
}

describe("budget", () => {
  it("cresce con la qualità della rosa, ma senza schiacciare le piccole", () => {
    const piccola = initialBudget(72);
    const media = initialBudget(78);
    const grande = initialBudget(84);
    expect(media).toBeGreaterThan(piccola);
    expect(grande).toBeGreaterThan(media);
    // Resta una differenza di categoria, non del 17%...
    expect(grande / piccola).toBeGreaterThan(2.5);
    // ...ma non tale da rendere la piccola ingiocabile: era il difetto segnalato dall'utente,
    // con la retrocessione quasi certa perché non c'erano i mezzi per comprare nessuno.
    expect(grande / piccola).toBeLessThan(6);
  });

  it("esiste un pavimento: anche la rosa peggiore può fare due scommesse", () => {
    expect(initialBudget(60)).toBeGreaterThanOrEqual(MIN_BUDGET);
    expect(initialBudget(64)).toBe(initialBudget(60));
  });

  it("la difficoltà agisce sul budget, e 'difficile' è lo stato di riferimento", () => {
    const base = initialBudget(75, "difficile");
    expect(initialBudget(75, "normale") / base).toBeCloseTo(1.3, 1);
    expect(initialBudget(75, "facile") / base).toBeCloseTo(1.7, 1);
  });

  it("migliorare il piazzamento finanzia il mercato successivo", () => {
    // È la leva della scalata: senza, chi parte in basso resta in basso e le dieci stagioni
    // diventano dieci ripetizioni della prima.
    const scalata = nextSeasonBudget({
      averageOverall: 74,
      position: 8,
      teamsInLeague: 20,
      leftover: 0,
      previousPosition: 17,
    });
    const fermo = nextSeasonBudget({
      averageOverall: 74,
      position: 8,
      teamsInLeague: 20,
      leftover: 0,
      previousPosition: 8,
    });
    expect(scalata).toBeGreaterThan(fermo);
  });

  it("salvarsi non innesca una spirale: il budget non viene tagliato", () => {
    expect(positionMultiplier(17, 20)).toBeGreaterThanOrEqual(0.9);
  });

  it("vincere il campionato vale più che salvarsi, e retrocedere costa", () => {
    expect(positionMultiplier(1, 20)).toBeGreaterThan(positionMultiplier(5, 20));
    expect(positionMultiplier(5, 20)).toBeGreaterThan(positionMultiplier(15, 20));
    expect(positionMultiplier(19, 20)).toBeLessThan(1);
  });

  it("arrivare in fondo alla Corona vale più che qualificarsi soltanto", () => {
    expect(cupMultiplier("vittoria")).toBeGreaterThan(cupMultiplier("quarti"));
    expect(cupMultiplier("quarti")).toBeGreaterThan(cupMultiplier("girone"));
    expect(cupMultiplier(undefined)).toBe(1);
  });

  it("accumulare è possibile ma costoso: si riporta solo il 30% dell'avanzo", () => {
    const senzaAvanzo = nextSeasonBudget({
      averageOverall: 78, position: 5, teamsInLeague: 20, leftover: 0,
    });
    const conAvanzo = nextSeasonBudget({
      averageOverall: 78, position: 5, teamsInLeague: 20, leftover: 10_000_000,
    });
    expect(conAvanzo - senzaAvanzo).toBeGreaterThan(2_000_000);
    expect(conAvanzo - senzaAvanzo).toBeLessThan(4_000_000);
  });
});

describe("valore di mercato", () => {
  it("chi non gioca vale meno di chi produce", () => {
    const titolare = formFactor(player());
    const panchinaro = formFactor(player({ stats: { appearances: 3, minutes: 200, goals: 0, assists: 0 } }));
    expect(titolare).toBeGreaterThan(panchinaro);
  });

  it("a parità di Overall un giovane in ascesa vale più di un veterano in calo", () => {
    const giovane = ageFactor(player({ age: 20, overall: 74, potential: 86 }));
    const maturo = ageFactor(player({ age: 27, overall: 74, potential: 74 }));
    const veterano = ageFactor(player({ age: 33, overall: 74, potential: 74 }));
    expect(giovane).toBeGreaterThan(maturo);
    expect(maturo).toBeGreaterThan(veterano);
  });

  it("valorizzare un giovane e rivenderlo è profittevole", () => {
    // È la strategia che l'utente ha chiesto di rendere praticabile per una squadra piccola.
    const acquisto = player({ playerId: "gio", clubId: "piccolo", age: 19, overall: 66, potential: 84,
      stats: { appearances: 5, minutes: 300, goals: 0, assists: 0 } });
    const prezzoAcquisto = currentValue(acquisto, CONTEXT);

    // Quattro stagioni dopo: è cresciuto giocando.
    const cresciuto = player({ playerId: "gio", clubId: "piccolo", age: 23, overall: 80, potential: 84,
      stats: { appearances: 34, minutes: 3000, goals: 14, assists: 8 } });
    const prezzoVendita = currentValue(cresciuto, CONTEXT);

    expect(prezzoVendita).toBeGreaterThan(prezzoAcquisto * 3);
  });

  it("lo stesso giocatore vale meno in un club piccolo", () => {
    const inGrande = currentValue(player({ clubId: "big" }), CONTEXT);
    const inPiccolo = currentValue(player({ clubId: "piccolo" }), CONTEXT);
    expect(inPiccolo).toBeLessThan(inGrande);
  });
});

describe("prezzo richiesto", () => {
  it("chi è insostituibile costa di più", () => {
    const base = askingPrice({ player: player(), value: 10_000_000, strengthLoss: 0 });
    const pilastro = askingPrice({ player: player(), value: 10_000_000, strengthLoss: 4 });
    expect(pilastro).toBeGreaterThan(base);
  });

  it("un rivale di campionato paga il sovrapprezzo", () => {
    const estero = askingPrice({ player: player(), value: 10_000_000, strengthLoss: 1 });
    const rivale = askingPrice({ player: player(), value: 10_000_000, strengthLoss: 1, rival: true });
    expect(rivale).toBeGreaterThan(estero * 1.4);
  });

  it("chi ha chiesto la cessione si vende a meno", () => {
    const normale = askingPrice({ player: player(), value: 10_000_000, strengthLoss: 1 });
    const scontento = askingPrice({ player: player(), value: 10_000_000, strengthLoss: 1, wantsOut: true });
    expect(scontento).toBeLessThan(normale);
  });
});

describe("vincoli anti-deriva", () => {
  function squadWith(stars: number): MarketPlayer[] {
    return [
      ...Array.from({ length: stars }, (_, i) =>
        player({ playerId: `star${i}`, overall: STAR_THRESHOLD + 1, department: "ATT" as Department }),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        player({ playerId: `n${i}`, overall: 74, department: "CC" as Department }),
      ),
    ];
  }

  it("più fuoriclasse hai, meno ne vuoi: il tetto morbido sulle stelle", () => {
    const target = player({ playerId: "top", overall: 90, department: "ATT" as Department });
    const conUno = appetite(target, squadWith(1), 1);
    const conQuattro = appetite(target, squadWith(4), 1);
    expect(conUno).toBeGreaterThan(0);
    expect(conQuattro).toBeLessThan(conUno / 4);
  });

  it("non si accumulano quattro pari-ruolo dello stesso livello", () => {
    const squad = Array.from({ length: 3 }, (_, i) =>
      player({ playerId: `dc${i}`, overall: 78, department: "DIF" as Department }),
    );
    const target = player({ playerId: "altro", overall: 78, department: "DIF" as Department });
    expect(appetite(target, squad, 1)).toBe(0);
  });

  it("un reparto già coperto e di qualità non genera appetito", () => {
    // Il reparto deve essere completo: con meno giocatori del minimo la funzione segnala
    // giustamente un'emergenza, che è un bisogno diverso dalla ricerca di qualità.
    const squad = [
      player({ playerId: "a1", overall: 88, department: "ATT" as Department }),
      player({ playerId: "a2", overall: 84, department: "ATT" as Department }),
      player({ playerId: "a3", overall: 80, department: "ATT" as Department }),
    ];
    expect(departmentNeed(squad, "ATT", 80)).toBe(0);
    expect(appetite(player({ playerId: "x", overall: 80 }), squad, 0)).toBe(0);
  });

  it("un reparto sotto la soglia minima è un'emergenza", () => {
    expect(departmentNeed([], "POR", 70)).toBe(1);
  });
});

describe("controproposta", () => {
  it("chi ha davvero bisogno del giocatore paga il sovrapprezzo, chi tentava si ritira", () => {
    const offerta = { playerId: "p", fromClubId: "a", toClubId: "b", fee: 10_000_000, appetite: 0 };
    const molto = { ...offerta, appetite: 1 };

    let accettateBasse = 0;
    let accettateAlte = 0;
    for (let seed = 0; seed < 400; seed++) {
      const random = mulberry32(seed);
      if (respondToCounterOffer(offerta, 12_500_000, random).accepted) accettateBasse++;
      if (respondToCounterOffer(molto, 12_500_000, mulberry32(seed)).accepted) accettateAlte++;
    }
    expect(accettateAlte).toBeGreaterThan(accettateBasse);
  });

  it("una controproposta al ribasso viene sempre accettata", () => {
    const offerta = { playerId: "p", fromClubId: "a", toClubId: "b", fee: 10_000_000, appetite: 0.5 };
    expect(respondToCounterOffer(offerta, 9_000_000, mulberry32(1)).accepted).toBe(true);
  });
});

describe("prestiti", () => {
  const roster = Array.from({ length: 24 }, (_, i) =>
    createRosterEntry({ playerId: `p${i}`, overall: 70, potential: 82, sinceSeason: 1 }),
  );

  it("solo i giovani vanno in prestito", () => {
    expect(canLoanOut(roster, { playerId: "p0", age: 21, overall: 70, potential: 84 }).ok).toBe(true);
    expect(canLoanOut(roster, { playerId: "p0", age: 27, overall: 70, potential: 70 }).ok).toBe(false);
  });

  it("un infortunato non è una destinazione prestito proponibile", () => {
    const conInfortunato = roster.map((e) => (e.playerId === "p0" ? { ...e, injuryMatchdaysLeft: 6 } : e));
    const esito = canLoanOut(conInfortunato, { playerId: "p0", age: 21, overall: 70, potential: 84 });
    expect(esito.ok).toBe(false);
  });

  it("c'è un tetto ai prestiti aperti, così non diventano la scorciatoia universale", () => {
    let conPrestiti = [...roster];
    for (let i = 0; i < MAX_LOANS_OUT; i++) {
      conPrestiti = conPrestiti.map((e) =>
        e.playerId === `p${i}`
          ? openLoan(e, { playerId: e.playerId, clubId: "host", direction: "uscita", fee: 0, expectedMinutes: 0 }, 1)
          : e,
      );
    }
    expect(canLoanOut(conPrestiti, { playerId: "p20", age: 20, overall: 70, potential: 84 }).ok).toBe(false);
    expect(canLoanIn(conPrestiti).ok).toBe(true); // i tetti sono separati per direzione
  });

  it("chi va dove giocherebbe titolare accumula molti più minuti", () => {
    const undiciDeboli = [66, 67, 68, 68, 69, 69, 70, 70, 71, 71, 72];
    const undiciForti = [84, 84, 85, 85, 86, 86, 87, 87, 88, 88, 90];
    const titolare = estimateLoanMinutes(74, undiciDeboli, 38);
    const riserva = estimateLoanMinutes(74, undiciForti, 38);
    expect(titolare).toBeGreaterThan(riserva * 2);
  });

  it("una destinazione dove non giocherebbe non viene proposta", () => {
    expect(isGoodLoanDestination(74, [66, 67, 68, 68, 69, 69, 70, 70, 71, 71, 72])).toBe(true);
    expect(isGoodLoanDestination(74, [84, 84, 85, 85, 86, 86, 87, 87, 88, 88, 90])).toBe(false);
  });

  it("a fine stagione i nostri rientrano e quelli altrui se ne vanno", () => {
    const misto = [
      openLoan(roster[0]!, { playerId: "p0", clubId: "host", direction: "uscita", fee: 0, expectedMinutes: 0 }, 1),
      openLoan(roster[1]!, { playerId: "p1", clubId: "owner", direction: "entrata", fee: 0, expectedMinutes: 0 }, 1),
      roster[2]!,
    ];
    const { returning, leaving, remaining } = settleLoans(misto, 2);
    expect(returning.map((e) => e.playerId)).toEqual(["p0"]);
    expect(returning[0]!.loan).toBeUndefined();
    expect(leaving.map((e) => e.playerId)).toEqual(["p1"]);
    expect(remaining.map((e) => e.playerId)).toEqual(["p2"]);
  });

  it("il prestito in entrata costa una frazione del cartellino", () => {
    expect(loanFee(20_000_000)).toBeLessThan(20_000_000 * 0.15);
    expect(loanFee(20_000_000)).toBeGreaterThan(0);
  });
});

describe("mercato IA vivo: cedibili per sovrabbondanza reale (titolari+panchina)", () => {
  function worldWith(dcCount: number): MarketWorld {
    const transferPool = Array.from({ length: dcCount }, (_, i) => ({
      playerId: `dc-${i}`,
      clubId: "sovraccarico",
      overall: 70 + i,
      potential: 75,
      age: 26,
      nation: "Italia",
      department: "DIF" as Department,
      stats: { appearances: 20, minutes: 1800, goals: 0, assists: 0 },
    }));
    return {
      clubs: { sovraccarico: { id: "sovraccarico", name: "Club Sovraccarico", leagueId: "l", startingEleven: [] } },
      transferPool,
      valuation: { leaguePrestigeByClub: { sovraccarico: 3 }, clubPrestige: { sovraccarico: 3 }, clubsInSameEra: 96 },
      players: {},
      nameOf: (id) => `Giocatore ${id}`,
      ageOf: () => 26,
      leagueRounds: 38,
    };
  }

  it("nessun cedibile finché il reparto non supera titolari+panchina", () => {
    const world = worldWith(FABBISOGNO_PER_REPARTO.DIF);
    const listings = aiSellableListings(world, mulberry32(1));
    expect(listings).toHaveLength(0);
  });

  it("chi supera titolari+panchina compare come cedibile, e sono i più deboli del gruppo", () => {
    const world = worldWith(FABBISOGNO_PER_REPARTO.DIF + 3);
    const listings = aiSellableListings(world, mulberry32(1));
    expect(listings).toHaveLength(3);
    // I tre più deboli del gruppo (overall 70,71,72 su una scala 70..70+n-1), non i migliori.
    const overallCeduti = listings.map((l) => l.overall).sort((a, b) => a - b);
    expect(overallCeduti).toEqual([70, 71, 72]);
    expect(listings.every((l) => l.reason.length > 0)).toBe(true);
  });
});
