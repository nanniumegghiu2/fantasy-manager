/**
 * Il mercato dei parametri zero.
 *
 * I due test che contano: **carriere diverse hanno svincolati diversi** (regola di prodotto
 * dichiarata dall'utente) e **una piccola può battere una grande** offrendo il campo invece dei
 * soldi — che è il motivo per cui questo mercato esiste.
 */
import { describe, expect, it } from "vitest";
import { ROLE_DEPARTMENT, type Role } from "@app/shared-types";
import {
  DECAY_PER_WINDOW,
  FREE_AGENT_MIN_OVERALL,
  MAX_DECAY,
  buildFreeAgentPool,
  freeAgentBidScore,
  resolveFreeAgentBids,
  rivalBidsFor,
  type FreeAgent,
  type FreeAgentBid,
} from "../ds/freeAgents";
import type { WorldPlayer } from "../ds/aiWorld";

const RUOLI: Role[] = ["POR", "DC", "TD", "MED", "CC", "ED", "TRQ", "ATT"];

function mondo(n = 400): WorldPlayer[] {
  return Array.from({ length: n }, (_, i) => {
    const role = RUOLI[i % RUOLI.length]!;
    const eta = 20 + (i % 15);
    return {
      id: `w-${i}`,
      name: `Giocatore ${i}`,
      nation: "Italia",
      role,
      secondaryRoles: [],
      department: ROLE_DEPARTMENT[role],
      birthDate: `${2025 - eta}-05-10`,
      overall: 66 + (i % 22),
      clubId: `club-${i % 20}`,
    } satisfies WorldPlayer;
  });
}

describe("il pool degli svincolati", () => {
  const players = mondo();

  it("carriere diverse producono svincolati diversi", () => {
    const nomi = (seed: string) =>
      new Set(buildFreeAgentPool({ worldPlayers: players, seed, season: 3, regenCount: 0 }).map((a) => a.id));

    const a = nomi("carriera-alfa");
    const b = nomi("carriera-beta");
    expect(a.size).toBeGreaterThan(5);
    expect(b.size).toBeGreaterThan(5);

    const comuni = [...a].filter((id) => b.has(id)).length;
    expect(comuni / Math.max(a.size, b.size)).toBeLessThan(0.8);
  });

  it("è stabile a parità di seme: ricaricare una carriera non cambia la vetrina", () => {
    const uno = buildFreeAgentPool({ worldPlayers: players, seed: "stabile", season: 4, regenCount: 3 });
    const due = buildFreeAgentPool({ worldPlayers: players, seed: "stabile", season: 4, regenCount: 3 });
    expect(uno.map((a) => a.id)).toEqual(due.map((a) => a.id));
    expect(uno.map((a) => a.askingWage)).toEqual(due.map((a) => a.askingWage));
  });

  it("chi ha firmato altrove sparisce, chi è stato svincolato compare subito", () => {
    const base = buildFreeAgentPool({ worldPlayers: players, seed: "s", season: 3, regenCount: 0 });
    expect(base.length).toBeGreaterThan(0);

    const primo = base[0]!.id;
    const dopoFirma = buildFreeAgentPool({
      worldPlayers: players,
      seed: "s",
      season: 3,
      regenCount: 0,
      signed: new Set([primo]),
    });
    expect(dopoFirma.some((a) => a.id === primo)).toBe(false);

    const rescisso = players.find((p) => !base.some((a) => a.id === p.id))!;
    const conRescissione = buildFreeAgentPool({
      worldPlayers: players,
      seed: "s",
      season: 3,
      regenCount: 0,
      released: [rescisso.id],
    });
    expect(conRescissione.some((a) => a.id === rescisso.id)).toBe(true);
  });

  it("chi resta libero decade, ma non oltre il tetto — e chi decade abbassa le pretese", () => {
    const subito = buildFreeAgentPool({ worldPlayers: players, seed: "s", season: 3, regenCount: 0 });
    const piuTardi = buildFreeAgentPool({ worldPlayers: players, seed: "s", season: 6, regenCount: 0 });

    const stesso = subito.find((a) => piuTardi.some((b) => b.id === a.id));
    if (stesso) {
      const dopo = piuTardi.find((b) => b.id === stesso.id)!;
      expect(dopo.baseOverall - dopo.overall).toBeLessThanOrEqual(MAX_DECAY);
      expect(dopo.windowsFree).toBeGreaterThan(stesso.windowsFree);
    }

    const conDecadimento = piuTardi.filter((a) => a.windowsFree > 0);
    for (const a of conDecadimento) {
      expect(a.baseOverall - a.overall).toBe(Math.min(MAX_DECAY, a.windowsFree * DECAY_PER_WINDOW));
    }
  });

  it("nessuno sotto la soglia entra in vetrina, e i giovani senza squadra ci sono", () => {
    const pool = buildFreeAgentPool({ worldPlayers: players, seed: "s", season: 3, regenCount: 5 });
    expect(pool.every((a) => a.overall >= FREE_AGENT_MIN_OVERALL)).toBe(true);
    expect(pool.filter((a) => a.origin === "regen")).toHaveLength(5);
    // Nomi unici anche fra i generati.
    expect(new Set(pool.map((a) => a.name)).size).toBe(pool.length);
  });
});

describe("la trattativa a cinque assi", () => {
  function agente(over: Partial<FreeAgent> = {}): FreeAgent {
    return {
      id: "fa-1",
      name: "Marco Verratti",
      nation: "Italia",
      role: "CC",
      secondaryRoles: [],
      department: "CC",
      birthDate: "1992-11-05",
      age: 33,
      overall: 83,
      baseOverall: 83,
      origin: "scaduto",
      windowsFree: 0,
      nextDecay: 1,
      personality: "giovane_ambizioso",
      askingWage: 4_000_000,
      askingSeasons: 2,
      wantsStarter: true,
      suitors: 0,
      ...over,
    };
  }

  const grande: FreeAgentBid = {
    clubId: "real",
    clubName: "Real Madrid",
    prestige: 5,
    wage: 9_000_000,
    seasons: 2,
    guaranteedStarter: false,
    captain: false,
    ambitionTarget: 1,
  };
  const piccola: FreeAgentBid = {
    clubId: "noi",
    clubName: "Il tuo club",
    prestige: 2,
    wage: 4_000_000,
    seasons: 2,
    guaranteedStarter: true,
    captain: true,
    ambitionTarget: 8,
  };

  it("una piccola batte una grande offrendo il campo, se il giocatore vuole giocare", () => {
    const a = agente({ personality: "giovane_ambizioso" });
    expect(freeAgentBidScore(a, piccola)).toBeGreaterThan(freeAgentBidScore(a, grande));
  });

  it("...ma con un mercenario vince il portafoglio", () => {
    const a = agente({ personality: "mercenario" });
    expect(freeAgentBidScore(a, grande)).toBeGreaterThan(freeAgentBidScore(a, piccola));
  });

  it("se una rivale offre di più sulla sua scala, la firma sfuma e lo si viene a sapere", () => {
    const a = agente({ personality: "mercenario" });
    const esito = resolveFreeAgentBids(a, piccola, [grande], "seme", 3);
    expect(esito.accepted).toBe(false);
    expect(esito.rivalClubName).toBe("Real Madrid");
    expect(esito.message).toContain("Real Madrid");
  });

  it("un'offerta troppo bassa non la accetta nessuno, anche senza concorrenza", () => {
    const a = agente();
    const miseria: FreeAgentBid = { ...piccola, wage: 200_000, guaranteedStarter: false, captain: false };
    expect(resolveFreeAgentBids(a, miseria, [], "seme", 3).accepted).toBe(false);
  });

  it("l'esito è stabile a parità di offerta: ricaricare non cambia il verdetto", () => {
    const a = agente();
    const uno = resolveFreeAgentBids(a, piccola, [grande], "seme", 3);
    const due = resolveFreeAgentBids(a, piccola, [grande], "seme", 3);
    expect(uno).toEqual(due);
  });
});

describe("la concorrenza dell'IA", () => {
  const agente: FreeAgent = {
    id: "fa-2",
    name: "Kevin Danso",
    nation: "Austria",
    role: "DC",
    secondaryRoles: [],
    department: "DIF",
    birthDate: "1998-09-19",
    age: 27,
    overall: 76,
    baseOverall: 76,
    origin: "scaduto",
    windowsFree: 0,
    nextDecay: 1,
    personality: "professionista",
    askingWage: 2_200_000,
    askingSeasons: 3,
    wantsStarter: false,
    suitors: 0,
  };

  it("offre solo chi ha bisogno di quel reparto, ha spazio a bilancio ed è alla sua portata", () => {
    const bids = rivalBidsFor(
      agente,
      [
        { clubId: "a", clubName: "Serve un difensore", prestige: 3, wageRoom: 5_000_000, needs: ["DIF"], elevenAverage: 74 },
        { clubId: "b", clubName: "Non serve", prestige: 3, wageRoom: 5_000_000, needs: ["ATT"], elevenAverage: 74 },
        { clubId: "c", clubName: "Senza soldi", prestige: 3, wageRoom: 100_000, needs: ["DIF"], elevenAverage: 74 },
        { clubId: "d", clubName: "Troppo forte", prestige: 5, wageRoom: 50_000_000, needs: ["DIF"], elevenAverage: 88 },
      ],
      "seme",
      3,
    );
    const clubOfferenti = bids.map((b) => b.clubId);
    expect(clubOfferenti).not.toContain("b");
    expect(clubOfferenti).not.toContain("c");
    expect(clubOfferenti).not.toContain("d");
  });

  it("nessuna offerta rivale supera mai il margine di bilancio di chi la fa", () => {
    const bids = rivalBidsFor(
      agente,
      Array.from({ length: 12 }, (_, i) => ({
        clubId: `c-${i}`,
        clubName: `Club ${i}`,
        prestige: 3,
        wageRoom: 2_500_000,
        needs: ["DIF" as const],
        elevenAverage: 75,
      })),
      "seme",
      3,
    );
    expect(bids.length).toBeGreaterThan(0);
    expect(bids.every((b) => b.wage <= 2_500_000)).toBe(true);
  });
});
