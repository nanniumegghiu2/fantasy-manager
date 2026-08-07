/**
 * Test del ciclo di vita: crescita, declino, ritiro, rimpiazzi, nomi.
 *
 * Il test che conta davvero è il primo del blocco "crescita": **le due curve devono
 * divergere**. Se un giovane in panchina cresce quanto uno che gioca trenta partite, il
 * meccanismo non sta funzionando e con esso cade la strategia della squadra piccola che
 * compra giovani e li valorizza — che è la ragione per cui l'utente ha chiesto questa
 * meccanica.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
  advanceSeasonOveralls,
  ageMargin,
  estimatePotential,
  growPotential,
  isAtPeak,
  POTENTIAL_ABSOLUTE_CAP,
  shouldRetire,
  type AgingInput,
} from "../ds/aging";
import { createRegen, createRegenBatch, POTENTIAL_SPREAD } from "../ds/regen";
import { curatedNations, generateName, poolCapacity } from "../ds/names";
import { createRosterEntry } from "../ds/roster";
import type { RosterEntry } from "../ds/types";
import type { Role } from "@app/shared-types";

function entryWith(overall: number, potential: number, minutes: number, goals = 0): RosterEntry {
  const entry = createRosterEntry({ playerId: `p-${overall}-${minutes}`, overall, potential, sinceSeason: 1 });
  return { ...entry, stats: { appearances: Math.round(minutes / 90), minutes, goals, assists: 0 } };
}

/** Un contorno di pari ruolo: `applySeasonAdjustment` normalizza il rendimento sui pari. */
function peers(role: Role): AgingInput[] {
  return Array.from({ length: 8 }, (_, i) => ({
    entry: entryWith(74 + i, 80, 2000, 5),
    role,
    age: 26,
  }));
}

describe("margine per età", () => {
  it("cresce da giovane, si azzera al picco, poi diventa declino", () => {
    expect(ageMargin(19)).toBeGreaterThan(0);
    expect(ageMargin(22)).toBeGreaterThan(0);
    expect(ageMargin(19)).toBeGreaterThan(ageMargin(22));
    expect(ageMargin(30)).toBeLessThan(0);
    expect(ageMargin(33)).toBeLessThan(ageMargin(30));
  });

  it("il picco è fra i 24 e i 28 anni", () => {
    expect(isAtPeak(23)).toBe(false);
    expect(isAtPeak(24)).toBe(true);
    expect(isAtPeak(28)).toBe(true);
    expect(isAtPeak(29)).toBe(false);
  });
});

describe("crescita: l'età dà il tetto, il campo lo riempie", () => {
  it("un giovane che gioca cresce, lo stesso giovane in panchina no", () => {
    const role: Role = "ATT";
    const gioca = entryWith(68, 85, 2700, 12);
    const panchina = { ...entryWith(68, 85, 200, 1), playerId: "panchina" };

    const [risultatoGioca] = advanceSeasonOveralls(
      [{ entry: gioca, role, age: 19 }, ...peers(role)],
      1,
    );
    const [risultatoPanchina] = advanceSeasonOveralls(
      [{ entry: panchina, role, age: 19 }, ...peers(role)],
      1,
    );

    const crescitaGioca = risultatoGioca!.after - risultatoGioca!.before;
    const crescitaPanchina = risultatoPanchina!.after - risultatoPanchina!.before;

    expect(crescitaGioca).toBeGreaterThan(0);
    expect(crescitaGioca).toBeGreaterThan(crescitaPanchina);
    // Le due curve devono divergere nettamente, non per un decimale.
    expect(crescitaGioca - crescitaPanchina).toBeGreaterThanOrEqual(2);
  });

  it("seguendo una carriera, un giovane che gioca arriva al picco intorno ai 24", () => {
    const role: Role = "CC";
    let entry = entryWith(66, 84, 2700, 6);
    const storia: { age: number; overall: number }[] = [];

    for (let age = 18; age <= 30; age++) {
      storia.push({ age, overall: entry.overall });
      const [result] = advanceSeasonOveralls(
        [{ entry, role, age }, ...peers(role)],
        age - 17,
      );
      entry = {
        ...entry,
        overall: result!.after,
        stats: { appearances: 30, minutes: 2700, goals: 6, assists: 4 },
      };
    }

    const a24 = storia.find((s) => s.age === 24)!.overall;
    const a18 = storia.find((s) => s.age === 18)!.overall;
    const a28 = storia.find((s) => s.age === 28)!.overall;
    const a30 = storia.find((s) => s.age === 30)!.overall;

    expect(a24).toBeGreaterThan(a18 + 8); // è cresciuto davvero
    expect(a28).toBeGreaterThanOrEqual(a24 - 1); // il picco tiene
    expect(a30).toBeLessThan(a28); // poi cala
  });

  it("non si supera mai il proprio potenziale", () => {
    const role: Role = "ATT";
    const entry = entryWith(79, 80, 2700, 25);
    const [result] = advanceSeasonOveralls([{ entry, role, age: 20 }, ...peers(role)], 1);
    expect(result!.after).toBeLessThanOrEqual(80);
  });

  it("una grande stagione a 33 anni rallenta il declino ma non lo inverte", () => {
    const role: Role = "ATT";
    const entry = entryWith(84, 90, 2700, 22);
    const [result] = advanceSeasonOveralls([{ entry, role, age: 33 }, ...peers(role)], 3);
    expect(result!.after).toBeLessThanOrEqual(result!.before);
  });

  it("un allenatore bravo coi giovani accelera la crescita", () => {
    const role: Role = "TRQ";
    const entry = entryWith(68, 85, 2700, 8);
    const [normale] = advanceSeasonOveralls([{ entry, role, age: 19 }, ...peers(role)], 1);
    const [bravo] = advanceSeasonOveralls(
      [{ entry, role, age: 19, development: 1.7 }, ...peers(role)],
      1,
    );
    expect(bravo!.after).toBeGreaterThanOrEqual(normale!.after);
  });
});

describe("il potenziale stesso può crescere, non solo l'Overall avvicinarvisi", () => {
  it("nessuna crescita senza giocare abbastanza, anche se giovanissimo", () => {
    expect(growPotential(78, 19, 0.2, 5)).toBe(0);
  });

  it("nessuna crescita oltre l'età limite, anche giocando e rendendo benissimo", () => {
    expect(growPotential(78, 24, 0.9, 8)).toBe(0);
  });

  it("nessuna crescita se il rendimento non è sopra attese, anche giocando molto", () => {
    expect(growPotential(78, 19, 0.9, 0)).toBe(0);
    expect(growPotential(78, 19, 0.9, -2)).toBe(0);
  });

  it("titolare fisso e rendimento sopra attese: il potenziale sale", () => {
    expect(growPotential(78, 19, 0.9, 6)).toBeGreaterThan(0);
  });

  it("mai oltre il tetto assoluto", () => {
    expect(growPotential(POTENTIAL_ABSOLUTE_CAP, 19, 0.9, 6)).toBe(0);
    expect(growPotential(POTENTIAL_ABSOLUTE_CAP - 1, 19, 0.9, 6)).toBeLessThanOrEqual(1);
  });

  it("in una stagione simulata, solo il titolare che rende bene vede salire il potenziale", () => {
    const role: Role = "ATT";
    const titolare = entryWith(70, 78, 2700, 15); // 30 partite, 15 gol: ben sopra i pari
    const riserva = entryWith(70, 78, 300, 1); // gioca pochissimo
    const [esitoTitolare, esitoRiserva] = advanceSeasonOveralls(
      [
        { entry: titolare, role, age: 19 },
        { entry: riserva, role, age: 19 },
        ...peers(role),
      ],
      1,
    );
    expect(esitoTitolare!.potentialDelta).toBeGreaterThan(0);
    expect(esitoRiserva!.potentialDelta).toBe(0);
  });
});

describe("ritiro", () => {
  it("si ritira a 34 anni", () => {
    expect(shouldRetire(33, 5)).toBe(false);
    expect(shouldRetire(34, 5)).toBe(true);
    expect(shouldRetire(36, 5)).toBe(true);
  });

  it("chi è già over 34 alla prima stagione resta fino alla fine della seconda", () => {
    // Senza questa clausola la prima finestra di mercato sarebbe un'emergenza: il database
    // reale ha 123 giocatori già over 34.
    expect(shouldRetire(36, 1)).toBe(false);
    expect(shouldRetire(36, 2)).toBe(true);
  });
});

describe("stima del potenziale", () => {
  it("un giovane ha molto margine, un maturo quasi nessuno", () => {
    const giovane = estimatePotential(78, 20);
    const maturo = estimatePotential(78, 29);
    expect(giovane).toBeGreaterThan(78);
    expect(maturo).toBeLessThanOrEqual(80);
    expect(giovane).toBeGreaterThan(maturo);
  });

  it("due coetanei con lo stesso Overall possono avere futuri diversi", () => {
    // Se lo scouting non avesse nulla da scoprire, cercare talenti sarebbe inutile.
    expect(estimatePotential(70, 19, 0.05)).not.toBe(estimatePotential(70, 19, 0.95));
  });

  it("resta dentro la scala 60-99", () => {
    expect(estimatePotential(97, 17, 1)).toBeLessThanOrEqual(99);
    expect(estimatePotential(60, 33, 0)).toBeGreaterThanOrEqual(60);
  });
});

describe("regen", () => {
  const retiring = {
    id: "vecchio",
    nation: "Italia",
    role: "DC" as Role,
    secondaryRoles: ["TD"] as Role[],
    peakOverall: 82,
  };

  it("eredita nazionalità e ruolo, così le rose non si deformano", () => {
    const regen = createRegen({ retiring, usedNames: new Set(), season: 3, random: mulberry32(1) });
    expect(regen.nation).toBe("Italia");
    expect(regen.role).toBe("DC");
    expect(regen.origin).toBe("regen");
  });

  it("nasce giovane e molto sotto il proprio potenziale", () => {
    const regen = createRegen({ retiring, usedNames: new Set(), season: 3, random: mulberry32(7) });
    const age = 2025 + 3 - 1 - Number(regen.birthDate.slice(0, 4));
    expect(age).toBeGreaterThanOrEqual(17);
    expect(age).toBeLessThanOrEqual(19);
    expect(regen.overall).toBeLessThan(regen.potential);
  });

  it("i potenziali sono DISPERSI: ogni tanto nasce un fenomeno o un flop", () => {
    const random = mulberry32(99);
    const potenziali = Array.from({ length: 400 }, (_, i) =>
      createRegen({
        retiring: { ...retiring, id: `r${i}` },
        usedNames: new Set(),
        season: 2,
        random,
      }).potential,
    );
    const distinti = new Set(potenziali).size;
    const min = Math.min(...potenziali);
    const max = Math.max(...potenziali);

    // Se fossero tutti uguali al predecessore il gioco sarebbe monotono: è la richiesta
    // esplicita dell'utente.
    expect(distinti).toBeGreaterThan(8);
    expect(max - min).toBeGreaterThan(POTENTIAL_SPREAD);
    // ...ma la maggior parte deve restare "simile", non essere un'estrazione uniforme.
    const vicini = potenziali.filter((p) => Math.abs(p - retiring.peakOverall) <= 4).length;
    expect(vicini / potenziali.length).toBeGreaterThan(0.5);
  });

  it("è riproducibile: stesso seme, stesso ragazzo", () => {
    const a = createRegen({ retiring, usedNames: new Set(), season: 4, random: mulberry32(5) });
    const b = createRegen({ retiring, usedNames: new Set(), season: 4, random: mulberry32(5) });
    expect(a).toEqual(b);
  });
});

describe("nomi", () => {
  it("i bacini curati coprono le nazionalità più frequenti del database", () => {
    for (const nation of ["Italia", "Spagna", "Francia", "Germania", "Inghilterra", "Brasile"]) {
      expect(curatedNations()).toContain(nation);
    }
  });

  it("ogni bacino regge dieci stagioni di ritiri con largo margine", () => {
    /**
     * Il margine va rapportato alla **domanda reale** di quella nazionalità, non a una soglia
     * unica: la Spagna ha 385 giocatori in database e ne consumerà ~230 in dieci stagioni,
     * il Senegal ne ha 46 e ne consumerà ~28. Una soglia piatta o è troppo severa per i
     * piccoli o troppo blanda per i grandi.
     *
     * Quote approssimative dal database reale (i cinque grandi coprono metà del pool).
     * Si richiede almeno **4×** la domanda decennale: sotto quel rapporto il paradosso dei
     * compleanni fa scattare le collisioni molto prima di esaurire lo spazio, e i nomi
     * cominciano a sembrare ripetitivi anche se formalmente unici.
     */
    const playersByNation: Record<string, number> = {
      Spagna: 385, Francia: 314, Germania: 257, Inghilterra: 194, Italia: 164,
      Brasile: 78, "Paesi Bassi": 71, Argentina: 69, Belgio: 55, Portogallo: 52,
      Danimarca: 49, Senegal: 46, Marocco: 43, Svizzera: 41, "Costa d'Avorio": 38,
      Svezia: 33, Austria: 32, Croazia: 32, Nigeria: 31, Norvegia: 27,
      "Stati Uniti": 27, Ghana: 26, Serbia: 25, Polonia: 22, Turchia: 20,
    };
    const RETIREMENT_RATE_PER_SEASON = 0.06;
    const SEASONS = 10;

    for (const nation of curatedNations()) {
      const demand = (playersByNation[nation] ?? 20) * RETIREMENT_RATE_PER_SEASON * SEASONS;
      const ratio = poolCapacity(nation) / Math.max(demand, 1);
      expect({ nation, sufficiente: ratio >= 4 }).toEqual({ nation, sufficiente: true });
    }
  });

  it("dieci stagioni di ritiri non producono nemmeno un nome duplicato", () => {
    const random = mulberry32(2026);
    const used = new Set<string>();
    let duplicati = 0;

    for (let season = 1; season <= 10; season++) {
      const retirees = Array.from({ length: 180 }, (_, i) => ({
        id: `r-${season}-${i}`,
        nation: ["Italia", "Spagna", "Francia", "Germania", "Inghilterra"][i % 5]!,
        role: "CC" as Role,
        secondaryRoles: [] as Role[],
        peakOverall: 75,
      }));
      for (const regen of createRegenBatch(retirees, used, season, random)) {
        if (used.has(regen.name)) duplicati++;
        used.add(regen.name);
      }
    }

    expect({ generati: used.size, duplicati }).toEqual({ generati: 1800, duplicati: 0 });
  });

  it("una nazionalità senza bacino dedicato riceve comunque un nome", () => {
    const nome = generateName("Nuova Zelanda", new Set(), mulberry32(3));
    expect(nome).toMatch(/^\S+ \S+/);
  });
});
