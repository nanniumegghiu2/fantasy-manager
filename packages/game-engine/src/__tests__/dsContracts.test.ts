/**
 * I contratti e le finanze a due casse.
 *
 * Il test che conta più di tutti è quello sull'**unicità della carriera**: le scadenze si
 * derivano dal seme, quindi due carriere sullo stesso database devono produrre svincolati
 * diversi. Se un giorno qualcuno "semplificasse" togliendo il seme dalla derivazione, il gioco
 * tornerebbe a proporre sempre gli stessi nomi e nessun altro test se ne accorgerebbe.
 */
import { describe, expect, it } from "vitest";
import {
  baseContractLength,
  baseWageOf,
  contractExpiryOf,
  contractOf,
  contractStatus,
  contractTotalCost,
  renewalOfferScore,
  renewalTerms,
  seasonsLeftOf,
} from "../ds/contracts";
import {
  DEFAULT_WAGE_SHARE,
  MIN_WAGE_SHARE,
  WINTER_SHIFT_LIMIT,
  defaultFinances,
  financesView,
  shiftWageShare,
} from "../ds/finances";
import { mulberry32 } from "../random";

function soggetto(id: string, age: number, overall: number) {
  return { id, birthDate: `${2025 - age}-06-15`, overall };
}

describe("durata dei contratti", () => {
  it("è sempre un numero intero di stagioni fra 1 e 5", () => {
    const random = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const durata = baseContractLength(18 + Math.floor(random() * 20), 60 + Math.floor(random() * 39), random);
      expect(Number.isInteger(durata)).toBe(true);
      expect(durata).toBeGreaterThanOrEqual(1);
      expect(durata).toBeLessThanOrEqual(5);
    }
  });

  it("i veterani firmano corto, i giovani e i fuoriclasse nel pieno firmano lungo", () => {
    const media = (age: number, overall: number) => {
      const random = mulberry32(99);
      let somma = 0;
      for (let i = 0; i < 400; i++) somma += baseContractLength(age, overall, random);
      return somma / 400;
    };
    expect(media(34, 78)).toBeLessThan(media(26, 78));
    expect(media(26, 86)).toBeGreaterThan(media(26, 74));
    expect(media(20, 72)).toBeGreaterThan(media(31, 72));
  });
});

describe("ogni carriera è unica", () => {
  const rosa = Array.from({ length: 300 }, (_, i) =>
    soggetto(`p-${i}`, 20 + (i % 15), 65 + (i % 25)),
  );

  it("semi diversi mandano in scadenza giocatori diversi", () => {
    const inScadenza = (seed: string, season: number) =>
      new Set(rosa.filter((p) => contractExpiryOf(p, seed) < season).map((p) => p.id));

    const carrieraA = inScadenza("carriera-A", 3);
    const carrieraB = inScadenza("carriera-B", 3);

    expect(carrieraA.size).toBeGreaterThan(10);
    expect(carrieraB.size).toBeGreaterThan(10);

    const comuni = [...carrieraA].filter((id) => carrieraB.has(id)).length;
    const sovrapposizione = comuni / Math.max(carrieraA.size, carrieraB.size);
    expect(sovrapposizione).toBeLessThan(0.75);
  });

  it("lo stesso seme dà sempre la stessa scadenza (una carriera ricaricata non cambia)", () => {
    for (const p of rosa.slice(0, 30)) {
      expect(contractExpiryOf(p, "stabile")).toBe(contractExpiryOf(p, "stabile"));
    }
  });
});

describe("stato del contratto", () => {
  const ctx = { seed: "s", season: 3 };

  it("distingue lungo, in scadenza, precontratto e svincolato", () => {
    const lungo = { until: 6, wage: 1_000_000, signedSeason: 1 };
    const ultimo = { until: 3, wage: 1_000_000, signedSeason: 1 };
    const finito = { until: 2, wage: 1_000_000, signedSeason: 1 };

    expect(contractStatus(lungo, ctx.season)).toBe("lungo");
    expect(contractStatus(ultimo, ctx.season)).toBe("in_scadenza");
    expect(contractStatus(ultimo, ctx.season, true)).toBe("precontratto");
    expect(contractStatus(finito, ctx.season)).toBe("svincolato");
    expect(contractStatus(null, ctx.season)).toBe("svincolato");
  });

  it("chi è stato svincolato non ha più contratto, quale che fosse la scadenza derivata", () => {
    const p = soggetto("libero", 28, 80);
    expect(contractOf(p, { seed: "s", season: 2 })).not.toBeNull();
    expect(contractOf(p, { seed: "s", season: 2, released: ["libero"] })).toBeNull();
  });

  it("un override sovrascrive la derivazione", () => {
    const p = soggetto("rinnovato", 27, 82);
    const c = contractOf(p, {
      seed: "s",
      season: 2,
      overrides: { rinnovato: { until: 9, wage: 4_000_000, signedSeason: 2 } },
    })!;
    expect(c.until).toBe(9);
    expect(seasonsLeftOf(c, 2)).toBe(8);
  });
});

describe("ingaggi", () => {
  it("crescono in modo esponenziale con l'Overall", () => {
    const a = baseWageOf(70, 26, 3);
    const b = baseWageOf(80, 26, 3);
    const c = baseWageOf(90, 26, 3);
    expect(b / a).toBeGreaterThan(1.8);
    expect(c / b).toBeGreaterThan(b / a - 0.4);
  });

  it("un giovane costa meno di un affermato a parità di Overall, un club blasonato paga di più", () => {
    expect(baseWageOf(78, 20, 3)).toBeLessThan(baseWageOf(78, 27, 3));
    expect(baseWageOf(78, 27, 5)).toBeGreaterThan(baseWageOf(78, 27, 2));
  });

  it("il costo complessivo è l'ingaggio per la durata: è quello a dare peso agli anni", () => {
    expect(contractTotalCost(2_000_000, 4)).toBe(8_000_000);
  });

  it("una rosa vera resta intorno al 40-50% di un fatturato plausibile", () => {
    // 24 giocatori di un club forte: media 79, punte a 88.
    const rosa = Array.from({ length: 24 }, (_, i) => 88 - i * 0.8);
    const monte = rosa.reduce((s, ovr) => s + baseWageOf(Math.round(ovr), 27, 5), 0);
    const fatturato = 85_000_000;
    const quota = monte / fatturato;
    expect(quota).toBeGreaterThan(0.2);
    expect(quota).toBeLessThan(0.75);
  });
});

describe("rinnovo: si negozia un pacchetto, non una cifra", () => {
  const base = {
    age: 27,
    overall: 84,
    marketValue: 40_000_000,
    currentWage: 2_000_000,
    wageVsPeers: 0.7,
    overUnderPerformance: 6,
    clubPrestige: 4,
    playedShare: 0.8,
  } as const;

  it("chi è sottopagato e rende sopra le attese chiede di più", () => {
    const sottopagato = renewalTerms({ ...base, personality: "professionista" });
    const inLinea = renewalTerms({ ...base, wageVsPeers: 1, overUnderPerformance: 0, personality: "professionista" });
    expect(sottopagato.wage).toBeGreaterThan(inLinea.wage);
  });

  it("i veterani chiedono contratti corti, i giovani lunghi", () => {
    expect(renewalTerms({ ...base, age: 34, personality: "professionista" }).seasons).toBe(1);
    expect(renewalTerms({ ...base, age: 22, personality: "professionista" }).seasons).toBeGreaterThan(2);
  });

  it("la stessa offerta convince un mercenario e offende un giovane ambizioso", () => {
    const terms = renewalTerms({ ...base, age: 22, personality: "giovane_ambizioso" });
    const soloSoldi = { wage: terms.wage * 1.2, seasons: terms.seasons, clause: 0, starter: false, captain: false };

    const perMercenario = renewalOfferScore(soloSoldi, terms, "mercenario");
    const perAmbizioso = renewalOfferScore(soloSoldi, terms, "giovane_ambizioso");
    expect(perMercenario).toBeGreaterThan(perAmbizioso);

    // Allo stesso ambizioso, i minuti valgono più dei soldi.
    const conCampo = { ...soloSoldi, wage: terms.wage * 0.9, starter: true };
    expect(renewalOfferScore(conCampo, terms, "giovane_ambizioso")).toBeGreaterThan(perAmbizioso);
  });
});

describe("finanze: un'unica cassa, due destinazioni", () => {
  const revenue = 100_000_000;

  it("la ripartizione di default divide fatturato in mercato e ingaggi", () => {
    const v = financesView(revenue, defaultFinances(), 30_000_000);
    expect(v.wageBudget).toBe(revenue * DEFAULT_WAGE_SHARE);
    expect(v.transferBudget).toBe(revenue - v.wageBudget);
    expect(v.wageRoom).toBe(v.wageBudget - 30_000_000);
  });

  it("non si può scendere sotto gli impegni già firmati", () => {
    const esito = shiftWageShare({
      revenue,
      finances: defaultFinances(),
      transferCash: 55_000_000,
      committedWages: 40_000_000,
      newShare: MIN_WAGE_SHARE,
    });
    expect(esito.ok).toBe(false);
    expect(esito.reason).toContain("impegni");
  });

  it("spostare verso gli ingaggi toglie liquidità al mercato, e viceversa", () => {
    const suGliIngaggi = shiftWageShare({
      revenue,
      finances: defaultFinances(),
      transferCash: 55_000_000,
      committedWages: 20_000_000,
      newShare: 0.55,
    });
    expect(suGliIngaggi.ok).toBe(true);
    expect(suGliIngaggi.transferCash).toBe(45_000_000);
    expect(suGliIngaggi.view.wageBudget).toBe(55_000_000);

    const sulMercato = shiftWageShare({
      revenue,
      finances: suGliIngaggi.finances,
      transferCash: suGliIngaggi.transferCash,
      committedWages: 20_000_000,
      newShare: 0.35,
    });
    expect(sulMercato.ok).toBe(true);
    expect(sulMercato.transferCash).toBe(65_000_000);
  });

  it("non si può spostare liquidità già spesa", () => {
    const esito = shiftWageShare({
      revenue,
      finances: defaultFinances(),
      transferCash: 1_000_000,
      committedWages: 20_000_000,
      newShare: 0.6,
    });
    expect(esito.ok).toBe(false);
    expect(esito.reason).toContain("liquidità");
  });

  it("a gennaio lo scostamento dal bilancio estivo è limitato", () => {
    const estate = { wageShare: 0.4, summerShare: 0.4 };
    const troppo = shiftWageShare({
      revenue,
      finances: estate,
      transferCash: 60_000_000,
      committedWages: 20_000_000,
      newShare: 0.4 + WINTER_SHIFT_LIMIT + 0.05,
      winter: true,
    });
    expect(troppo.ok).toBe(false);

    const consentito = shiftWageShare({
      revenue,
      finances: estate,
      transferCash: 60_000_000,
      committedWages: 20_000_000,
      newShare: 0.4 + WINTER_SHIFT_LIMIT - 0.05,
      winter: true,
    });
    expect(consentito.ok).toBe(true);
    // La ripartizione estiva resta il riferimento anche dopo un aggiustamento invernale.
    expect(consentito.finances.summerShare).toBe(0.4);
  });

  it("sforare il tetto è permesso, e si misura", () => {
    const v = financesView(revenue, { wageShare: 0.3 }, 35_000_000);
    expect(v.overrunNow).toBe(5_000_000);
    expect(v.wageRoom).toBeLessThan(0);
  });
});
