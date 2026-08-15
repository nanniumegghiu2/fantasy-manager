/**
 * **Le nove migliorie manageriali** chieste dall'utente dopo una sessione di gioco.
 *
 * Quasi tutte hanno la stessa forma: una regola che c'era ma era tarata sul metro sbagliato —
 * la media della **rosa intera** invece del titolare di quella casella, il *reparto* invece della
 * casella, l'esito "notevole" invece del solo gol. I test qui misurano la regola nuova, non il
 * numero: se un domani si ritoccasse una soglia, devono restare veri.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
  agreeWithBoard,
  boardSeasonMeeting,
  defaultBoard,
  type BoardMeetingInput,
} from "../ds/board";
import { buildCoachReport } from "../ds/coachReport";
import { renewalTerms, type RenewalContext } from "../ds/contracts";
import { freeAgentBidScore, type FreeAgent, type FreeAgentBid } from "../ds/freeAgents";
import { aiSellableListings, type MarketWorld } from "../ds/careerMarket";
import { attaccatoAllaMaglia } from "../ds/playerTopics";
import { buildPlayerFacts, type PlayerFactsInput } from "../ds/playerFacts";
import { createRosterEntry } from "../ds/roster";
import { getFormation } from "../formations";
import { FABBISOGNO_PER_REPARTO } from "../ds/aiWorld";
import type { PlayerIndex, RosterEntry } from "../ds/types";
import type { Department, Role } from "@app/shared-types";

/* -------------------------------------------------------------------------- */
/* 1. Il colloquio con la dirigenza                                            */
/* -------------------------------------------------------------------------- */

describe("il colloquio con la società", () => {
  const scala = [
    { label: "Titolo", targetPosition: 1 },
    { label: "Europa", targetPosition: 4 },
    { label: "Metà classifica", targetPosition: 9 },
    { label: "Parte bassa", targetPosition: 13 },
    { label: "Salvezza", targetPosition: 17 },
  ];

  function meetingCon(confidence: number): BoardMeetingInput {
    return {
      board: { ...defaultBoard(), confidence },
      season: 3,
      tiers: scala,
      realistic: scala[2]!,
      budgetMultiplierOf: (t) =>
        ({ Titolo: 1.35, Europa: 1.18, "Metà classifica": 1, "Parte bassa": 0.88, Salvezza: 0.8 })[
          t.label
        ] ?? 1,
      baseRevenue: 100_000_000,
      hasCoach: true,
      coachName: "Il Mister",
    };
  }

  it("la società dichiara un minimo: prima non lo diceva nessuno", () => {
    const m = boardSeasonMeeting(meetingCon(65));
    expect(m.minimum.label).toBeTruthy();
    expect(m.speech).toContain(m.minimum.label);
    expect(m.options.some((o) => o.stance === "minimo")).toBe(true);
  });

  it("un presidente che si fida chiede meno, uno stanco chiede di più", () => {
    const indice = (c: number) => {
      const m = boardSeasonMeeting(meetingCon(c));
      return scala.findIndex((t) => t.label === m.minimum.label);
    };
    // Indice minore = più ambizioso. Chi ha poca fiducia pretende almeno quanto chi ne ha molta.
    expect(indice(30)).toBeLessThan(indice(85));
  });

  it("alzare l'asticella porta mezzi, abbassarla costa fiducia", () => {
    const m = boardSeasonMeeting(meetingCon(65));
    const sopra = m.options.find((o) => o.stance === "sopra")!;
    const sotto = m.options.find((o) => o.stance === "sotto")!;

    expect(sopra.budgetMultiplier).toBeGreaterThan(sotto.budgetMultiplier);
    expect(sopra.confidenceDelta).toBeGreaterThan(0);
    expect(sotto.confidenceDelta).toBeLessThan(0);
  });

  it("i fondi in più si concedono in proporzione all'ambizione, non a richiesta", () => {
    const m = boardSeasonMeeting(meetingCon(80));
    const sopra = m.options.find((o) => o.stance === "sopra")!;
    const sotto = m.options.find((o) => o.stance === "sotto")!;

    const ambizioso = agreeWithBoard(m.options ? { ...defaultBoard(), confidence: 80 } : undefined, m, sopra.label, 4);
    const prudente = agreeWithBoard({ ...defaultBoard(), confidence: 80 }, m, sotto.label, 4);

    expect(ambizioso.extraGranted).toBeGreaterThan(0);
    // Chi punta sotto il minimo non ha niente da farsi finanziare.
    expect(prudente.extraGranted).toBe(0);
  });

  it("chiedere fondi costa fiducia, anche quando li concedono", () => {
    const m = boardSeasonMeeting(meetingCon(80));
    const sopra = m.options.find((o) => o.stance === "sopra")!;
    const senza = agreeWithBoard({ ...defaultBoard(), confidence: 80 }, m, sopra.label, 0);
    const con = agreeWithBoard({ ...defaultBoard(), confidence: 80 }, m, sopra.label, 4);
    expect(con.board.confidence).toBeLessThan(senza.board.confidence);
  });

  it("la questione panchina entra nello stesso colloquio, quando è aperta", () => {
    const conRichiesta = boardSeasonMeeting({
      ...meetingCon(50),
      board: {
        ...defaultBoard(),
        confidence: 50,
        sackDemand: {
          season: 3,
          objectiveLabel: "Europa",
          targetPosition: 4,
          finalPosition: 11,
          coachName: "Il Mister",
          severity: "richiesta",
        },
      },
    });
    expect(conRichiesta.coachIssue?.coachName).toBe("Il Mister");
    // Senza richiesta aperta non se ne parla: non è un argomento da tirare fuori ogni anno.
    expect(boardSeasonMeeting(meetingCon(80)).coachIssue).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* 2. L'analisi del mister                                                     */
/* -------------------------------------------------------------------------- */

describe("l'analisi del mister sulla rosa", () => {
  const formation = getFormation("4-4-2")!;

  function rosa(livelli: Partial<Record<Role, number>> = {}, base = 76, perCasella = 2) {
    const caselle: Role[] = ["POR", "TD", "DC", "DC", "TS", "ED", "CC", "CC", "ES", "ATT", "ATT"];
    const players: PlayerIndex = {};
    const roster: RosterEntry[] = [];
    caselle.forEach((role, i) => {
      for (const s of ["a", "b", "c"].slice(0, perCasella)) {
        const id = `${role}-${i}-${s}`;
        players[id] = { id, name: `Tale ${id}`, nation: "Italia", role, secondaryRoles: [] };
        roster.push(
          createRosterEntry({ playerId: id, overall: livelli[role] ?? base, potential: 80, sinceSeason: 1 }),
        );
      }
    });
    return { players, roster };
  }

  const base = {
    coachName: "Il Mister",
    formation,
    ageOf: () => 26,
    untouchableIds: [],
    goodWithYouth: false,
  };

  it("**non parla mai di Overall**: è la richiesta esplicita dell'utente", () => {
    const { players, roster } = rosa({ TS: 62 });
    const r = buildCoachReport({ ...base, players, roster });
    const tutto = [
      r.headline,
      ...r.weakSpots.map((w) => w.text),
      ...r.wishes.map((w) => w.text),
      r.wanted?.text ?? "",
      r.unwanted?.text ?? "",
      r.objectiveTalk?.diagnosis ?? "",
      r.objectiveTalk?.needed ?? "",
    ].join(" ");
    expect(tutto.toLowerCase()).not.toContain("overall");
    expect(tutto).not.toMatch(/≥\s*\d/);
  });

  it("nomina la casella debole, non il reparto", () => {
    const { players, roster } = rosa({ DC: 84, TS: 62 });
    const r = buildCoachReport({ ...base, players, roster });
    expect(r.weakSpots[0]?.role).toBe("TS");
  });

  it("gli intoccabili li dice per nome, col motivo", () => {
    const { players, roster } = rosa();
    const id = roster[0]!.playerId;
    const r = buildCoachReport({ ...base, players, roster, untouchableIds: [id] });
    expect(r.untouchables).toHaveLength(1);
    expect(r.untouchables[0]!.text).toContain(players[id]!.name);
  });

  it("fa un nome dal mercato, quando gliene si passa uno", () => {
    const { players, roster } = rosa({ TS: 62 });
    const r = buildCoachReport({
      ...base,
      players,
      roster,
      marketCandidate: { playerId: "m1", name: "Tizio Caio", role: "TS", clubName: "Altro Club" },
    });
    expect(r.wanted?.text).toContain("Tizio Caio");
    expect(r.wanted?.text).toContain("Altro Club");
  });

  it("spiega perché non si arriva all'obiettivo, e cosa gli serve", () => {
    const { players, roster } = rosa({ TS: 60 });
    const r = buildCoachReport({
      ...base,
      players,
      roster,
      positionsBelowTarget: 6,
      objectiveLabel: "Europa",
      matchday: 20,
    });
    expect(r.objectiveTalk).toBeDefined();
    expect(r.objectiveTalk!.diagnosis).toContain("Europa");
    expect(r.objectiveTalk!.needed.length).toBeGreaterThan(0);
  });

  it("…ma non si giustifica se la stagione sta andando bene", () => {
    const { players, roster } = rosa();
    const r = buildCoachReport({
      ...base,
      players,
      roster,
      positionsBelowTarget: 0,
      matchday: 20,
    });
    expect(r.objectiveTalk).toBeUndefined();
  });

  it("chiede un giovane solo se sa lavorarci, e un veterano se lo spogliatoio è di ragazzi", () => {
    const { players, roster } = rosa();
    const giovani = buildCoachReport({ ...base, players, roster, goodWithYouth: true, ageOf: () => 20 });
    expect(giovani.wishes.some((w) => w.kind === "esperto")).toBe(true);

    const maturi = buildCoachReport({ ...base, players, roster, goodWithYouth: false, ageOf: () => 30 });
    expect(maturi.wishes.some((w) => w.kind === "giovane")).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Cedibili IA: le occasioni                                                */
/* -------------------------------------------------------------------------- */

describe("i cedibili dell'IA", () => {
  /** Un club con un reparto in eccedenza *e* un titolare forte chiuso da uno più forte. */
  function mondo(): MarketWorld {
    const pool = [
      // La gerarchia del reparto: il primo gioca, il secondo è forte ma chiuso.
      { overall: 86 },
      { overall: 82 },
      ...Array.from({ length: FABBISOGNO_PER_REPARTO.DIF }, () => ({ overall: 68 })),
    ].map((p, i) => ({
      playerId: `p${i}`,
      clubId: "club",
      overall: p.overall,
      potential: p.overall,
      age: 26,
      nation: "Italia",
      department: "DIF" as Department,
      stats: { appearances: 20, minutes: 1800, goals: 0, assists: 0 },
    }));

    return {
      clubs: { club: { id: "club", name: "Club", leagueId: "l", startingEleven: [] } },
      transferPool: pool,
      valuation: { leaguePrestigeByClub: { club: 4 }, clubPrestige: { club: 4 }, clubsInSameEra: 96 },
      players: {},
      nameOf: (id) => `Giocatore ${id}`,
      ageOf: () => 26,
      leagueRounds: 38,
    };
  }

  it("compare anche il forte chiuso da uno più forte, non solo il fondo rosa", () => {
    const listings = aiSellableListings(mondo(), mulberry32(5));
    expect(listings.some((l) => l.overall >= 76)).toBe(true);
  });

  it("l'occasione sta in cima, non sepolta fra venti esuberi", () => {
    const listings = aiSellableListings(mondo(), mulberry32(5));
    expect(listings[0]!.overall).toBeGreaterThanOrEqual(76);
  });

  it("il chiuso fuori non è scontato: non è un esubero da smaltire", () => {
    const listings = aiSellableListings(mondo(), mulberry32(5));
    const occasione = listings.find((l) => l.overall >= 76)!;
    const esubero = listings.find((l) => l.overall < 76)!;
    // Il rapporto prezzo/valore è più alto per chi il club non ha fretta di cedere: qui basta
    // che il motivo dichiarato sia diverso, perché è quello che l'utente legge.
    expect(occasione.reason).not.toBe(esubero.reason);
    expect(occasione.reason).toMatch(/titolare|davanti/i);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Titolarità: più rara e legata alla rosa                                  */
/* -------------------------------------------------------------------------- */

describe("la richiesta di titolarità nei contratti", () => {
  const base: RenewalContext = {
    age: 25,
    overall: 78,
    marketValue: 20_000_000,
    currentWage: 1_000_000,
    wageVsPeers: 1,
    overUnderPerformance: 0,
    clubPrestige: 4,
    personality: "professionista",
    playedShare: 1,
  };

  it("chi scalzerebbe il titolare la chiede", () => {
    expect(renewalTerms({ ...base, playedShare: 1 }).wantsStarter).toBe(true);
  });

  it("chi arriva per fare il ricambio no", () => {
    expect(renewalTerms({ ...base, playedShare: 0.4 }).wantsStarter).toBe(false);
  });

  it("⚠️ nemmeno il giovane ambizioso la pretende a prescindere", () => {
    // Era la clausola `|| personality === "giovane_ambizioso"`: la chiedeva **sempre**, ed era
    // metà della segnalazione "nove acquisti su dieci vogliono la titolarità".
    expect(renewalTerms({ ...base, personality: "giovane_ambizioso", playedShare: 0.4 }).wantsStarter).toBe(
      false,
    );
    // Resta comunque il più esigente: gli basta un po' meno degli altri.
    expect(renewalTerms({ ...base, personality: "giovane_ambizioso", playedShare: 0.47 }).wantsStarter).toBe(
      true,
    );
    expect(renewalTerms({ ...base, personality: "professionista", playedShare: 0.47 }).wantsStarter).toBe(
      false,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Svincolati: negare il posto non è più una condanna                       */
/* -------------------------------------------------------------------------- */

describe("gli svincolati", () => {
  const agente: FreeAgent = {
    id: "fa",
    name: "Tale",
    nation: "Italia",
    role: "CC",
    secondaryRoles: [],
    department: "CC",
    birthDate: "1999-01-01",
    age: 26,
    overall: 80,
    baseOverall: 80,
    origin: "scaduto",
    windowsFree: 0,
    nextDecay: 1,
    personality: "professionista",
    askingWage: 3_000_000,
    askingSeasons: 3,
    wantsStarter: true,
    suitors: 0,
  };

  const grande: FreeAgentBid = {
    clubId: "noi",
    clubName: "Il tuo club",
    prestige: 5,
    wage: 3_000_000,
    seasons: 3,
    guaranteedStarter: false,
    captain: false,
    ambitionTarget: 1,
  };

  it("un club forte che non garantisce il posto resta comunque una proposta seria", () => {
    // La soglia di firma è 46: prima, senza garanzia, il punteggio crollava sotto e la vetrina
    // sembrava rifiutare chiunque — la segnalazione dell'utente.
    expect(freeAgentBidScore(agente, grande)).toBeGreaterThan(46);
  });

  it("ma garantirlo resta la leva più forte", () => {
    const conPosto = { ...grande, guaranteedStarter: true };
    expect(freeAgentBidScore(agente, conPosto)).toBeGreaterThan(freeAgentBidScore(agente, grande));
  });

  it("⚠️ sotto metà dell'ingaggio richiesto nessun altro asse compensa", () => {
    // È il caso che ha rotto un test esistente quando si è alzato il peso del campo: durata,
    // ambizione e ruolo sommati portavano sopra soglia un'offerta da un ventesimo del dovuto.
    const miseria = { ...grande, wage: 150_000, guaranteedStarter: true, captain: true };
    expect(freeAgentBidScore(agente, miseria)).toBeLessThan(46);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. L'attaccamento alla maglia                                               */
/* -------------------------------------------------------------------------- */

describe("l'attaccamento alla maglia", () => {
  function fatti(input: Partial<PlayerFactsInput> = {}) {
    const entry: RosterEntry = {
      ...createRosterEntry({ playerId: "x", overall: 84, potential: 86, sinceSeason: 1 }),
      morale: 75,
      stats: { appearances: 20, minutes: 1800, goals: 4, assists: 3 },
    };
    return buildPlayerFacts({
      entry,
      player: { id: "x", name: "La Bandiera", role: "CC", secondaryRoles: [] },
      age: 29,
      season: 6,
      matchday: 20,
      squadAverage: 78,
      marketValue: 30_000_000,
      roster: [entry],
      roleOf: () => ({ role: "CC" as Role, secondaryRoles: [] }),
      contract: { until: 9, wage: 2_000_000, signedSeason: 4 },
      wageVsPeers: 1,
      wageRoomLeft: 5_000_000,
      currentWeek: 20,
      incomingOffer: {
        clubId: "big",
        clubName: "Un Top Club",
        fee: 60_000_000,
        prestige: 5,
        kind: "trasferimento",
      },
      ...input,
    });
  }

  it("chi è al club da anni, gioca e sta bene non chiede di andarsene", () => {
    expect(attaccatoAllaMaglia(fatti())).toBe(true);
  });

  it("chi è appena arrivato invece ascolta eccome", () => {
    const entry: RosterEntry = {
      ...createRosterEntry({ playerId: "x", overall: 84, potential: 86, sinceSeason: 6 }),
      morale: 75,
      stats: { appearances: 20, minutes: 1800, goals: 4, assists: 3 },
    };
    expect(attaccatoAllaMaglia(fatti({ entry, roster: [entry] }))).toBe(false);
  });

  it("se lo hai messo in lista, il legame non lo trattiene più", () => {
    expect(attaccatoAllaMaglia(fatti({ isOnTransferList: true }))).toBe(false);
  });

  it("e nemmeno se gli hai già rotto una promessa", () => {
    expect(
      attaccatoAllaMaglia(fatti({ relationship: { trust: 20, brokenCount: 1, feud: true } })),
    ).toBe(false);
  });

  it("chi gioca poco non è una bandiera, per quanti anni abbia", () => {
    const entry: RosterEntry = {
      ...createRosterEntry({ playerId: "x", overall: 84, potential: 86, sinceSeason: 1 }),
      morale: 75,
      stats: { appearances: 2, minutes: 90, goals: 0, assists: 0 },
    };
    expect(attaccatoAllaMaglia(fatti({ entry, roster: [entry] }))).toBe(false);
  });
});
