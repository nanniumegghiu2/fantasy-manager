/**
 * Test d'integrazione della carriera: è il punto in cui tutti i moduli `ds/*` devono
 * funzionare **insieme**, non singolarmente.
 *
 * Due proprietà valgono più di tutte le altre:
 *  - una carriera da dieci stagioni si completa senza incepparsi;
 *  - **interrompere e riprendere da un salvataggio dà la stessa carriera**, che è la promessa
 *    su cui si regge il salvataggio su Supabase.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import { findTransferRequest } from "../ds/events";
import {
  advanceToNextStop,
  advanceWeek,
  applyMarket,
  careerPlayers,
  coachChoices,
  coachTierOf,
  createCareer,
  closeNegotiation,
  currentLineup,
  hireCoach,
  setGuaranteedStarter,
  isNegotiationBlocked,
  negotiateLoanOffer,
  negotiateOffer,
  negotiatePurchase,
  openForcedStandoff,
  resolveForcedStandoff,
  answerBoardSackDemand,
  seasonObjectiveChoices,
  setSeasonObjective,
  playNegotiation,
  resolveIncidentDecision,
  searchMarket,
  seasonCalendar,
  getCoachUntouchables,
  squadStrengthOf,
  CUP_QUALIFY_POSITION,
  type CareerState,
  type CareerWorld,
  type ResolvedPlayer,
} from "../ds/career";
import type { Incident } from "../ds/incidents";
import { findCoach } from "../ds/coaches";
import { emptySquadLists, openMarketWindow } from "../ds/careerMarket";
import {
  applyPlayerStandoff,
  confirmCoachSeasonPromises,
  livePromiseStatus,
  proposePromiseAlternative,
  declineCoachSeasonMeeting,
  offerPushProbability,
  openPlayerStandoff,
  standoffCandidates,
} from "../ds/career";
import { defaultBoard } from "../ds/board";
import { createRosterEntry, MIN_SQUAD_SIZE } from "../ds/roster";
import { openStandoff } from "../ds/playerStandoff";
import { AI_CLUB_COHESION, careerOpponentTeam } from "../ds/aiClub";
import { INHERITED_SINCE_SEASON } from "../ds/cohesion";
import { CAREER_SEASONS, type RosterEntry } from "../ds/types";
import { cupSlotOf, TOTAL_CUP_ROUNDS } from "../season/calendar";
import { ROLE_DEPARTMENT } from "@app/shared-types";
import type { Player, Role } from "@app/shared-types";
import type { LeagueTeam } from "../season/leagueState";

const ROLES: Role[] = [
  "POR", "POR", "POR",
  "TD", "TD", "DC", "DC", "DC", "DC", "TS", "TS",
  "QD", "MED", "MED", "QS",
  "ED", "CC", "CC", "CC", "ES",
  "TQD", "TRQ", "TQS",
  "ATT", "ATT", "ATT",
];

/** Un mondo di prova: 26 giocatori nostri, 19 avversarie, campionato a 20 squadre. */
function buildWorld(overall = 76): { world: CareerWorld; roster: RosterEntry[] } {
  const players: Record<string, ResolvedPlayer> = {};
  const roster: RosterEntry[] = ROLES.map((role, i) => {
    const id = `p${i}`;
    players[id] = {
      id,
      name: `Giocatore ${i}`,
      nation: i % 4 === 0 ? "Italia" : "Francia",
      role,
      secondaryRoles: [],
      department: ROLE_DEPARTMENT[role],
      // Età scaglionate: qualcuno crescerà, qualcuno si ritirerà durante la carriera.
      birthDate: `${1992 + (i % 14)}-05-10`,
    };
    return createRosterEntry({ playerId: id, overall: overall + (i % 7) - 3, potential: overall + 8, sinceSeason: 1 });
  });

  const opponents: LeagueTeam[] = Array.from({ length: 19 }, (_, i) => ({
    id: `club-${i}`,
    name: `Club ${i}`,
    rating: 70 + (i % 12),
    strength: { attack: 70 + (i % 12), defence: 72 + (i % 10) },
  }));

  return {
    world: { players, opponents, clubName: "La mia squadra", leagueRounds: 38 },
    roster,
  };
}

function newCareer(seed = "abc123", overall = 76) {
  const { world, roster } = buildWorld(overall);
  const state = createCareer({
    seed,
    clubId: "mio",
    leagueId: "serie-a",
    coachId: "c-10",
    roster,
    budget: 10_000_000,
  });
  return { state, world };
}

/** Avanza finché non arriva una decisione o finisce la stagione. */
/**
 * Un DS **competente**: rinnova chiunque vada in scadenza.
 *
 * Serve nei test che misurano il ciclo di vita (ritiri, regen, budget) e non i contratti: senza
 * rinnovi la rosa si svuota e la carriera finisce per esonero (comportamento voluto, coperto da
 * `dsCareerContracts.test.ts`), il che renderebbe impossibile misurare tutto il resto.
 */
function rinnovaTutti(state: CareerState): CareerState {
  const overrides = { ...(state.contracts?.overrides ?? {}) };
  for (const e of state.roster) {
    overrides[e.playerId] = { until: state.season + 4, wage: 500_000, signedSeason: state.season };
  }
  return {
    ...state,
    contracts: {
      overrides,
      released: state.contracts?.released ?? [],
      preContracts: state.contracts?.preContracts ?? [],
      renewalRefused: state.contracts?.renewalRefused ?? [],
    },
  };
}

function playSeason(state: CareerState, world: CareerWorld): CareerState {
  let current = rinnovaTutti(state);
  for (let guard = 0; guard < 200; guard++) {
    const { state: next, report } = advanceWeek(current, world, {
      requestResponse: "prometti",
      closeMarket: true,
    });
    current = next;
    if (report.seasonEnded || report.careerEnded) return rinnovaTutti(current);
  }
  throw new Error("La stagione non è terminata: possibile ciclo infinito");
}

/* -------------------------------------------------------------------------- */
/* Un mondo completo: Corona e mercato accesi                                  */
/* -------------------------------------------------------------------------- */

const CUP_CLUBS = Array.from({ length: 20 }, (_, i) => (i === 0 ? "mio" : `euro-${i}`));
const CUP_LEAGUES = CUP_CLUBS.map((_, i) => ["serie-a", "premier", "liga", "bundes", "ligue1"][i % 5]!);

/** Aggiunge Corona e mercato al mondo base, così `advanceWeek` li attraversa davvero. */
function withCupAndMarket(base: { world: CareerWorld; roster: RosterEntry[] }): CareerWorld {
  const cupTeams: Record<string, LeagueTeam> = {};
  for (const [i, id] of CUP_CLUBS.entries()) {
    cupTeams[id] = {
      id,
      name: id === "mio" ? "La mia squadra" : `Europa ${i}`,
      rating: 78 + (i % 8),
      strength: { attack: 78 + (i % 8), defence: 77 + (i % 7) },
    };
  }

  const clubs = Object.fromEntries(
    CUP_CLUBS.filter((id) => id !== "mio").map((id, i) => [
      id,
      {
        id,
        name: `Europa ${i}`,
        leagueId: CUP_LEAGUES[i]!,
        startingEleven: Array.from({ length: 11 }, () => 74 + (i % 6)),
        lastPosition: 1 + (i % 20),
      },
    ]),
  );

  // Un pool di acquistabili: gente vera, con un'età, così i prezzi hanno senso.
  const RUOLI_MERCATO: Role[] = ["POR", "DC", "CC", "ATT"];
  const transferPool = Array.from({ length: 40 }, (_, i) => ({
    playerId: `mercato-${i}`,
    clubId: CUP_CLUBS[1 + (i % 19)]!,
    overall: 68 + (i % 16),
    potential: 84 + (i % 6),
    // Un terzo sono giovani: servono a coprire i prestiti e i filtri per età.
    age: 18 + (i % 15),
    nation: "Italia",
    department: ROLE_DEPARTMENT[RUOLI_MERCATO[i % 4]!],
    stats: { appearances: 30, minutes: 2700, goals: i % 8, assists: i % 5 },
  }));

  const names: Record<string, string> = {};
  for (const p of transferPool) names[p.playerId] = `Acquisto ${p.playerId}`;

  // L'anagrafica del mercato copre **tutto** il pool, non solo la propria rosa: senza, la
  // ricerca non troverebbe nessuno degli acquistabili (è la forma che ha il mondo reale).
  const anagraficaMercato: Record<string, ResolvedPlayer> = { ...base.world.players };
  for (const [i, p] of transferPool.entries()) {
    const ruolo = RUOLI_MERCATO[i % 4]!;
    anagraficaMercato[p.playerId] = {
      id: p.playerId,
      name: names[p.playerId]!,
      nation: p.nation,
      role: ruolo,
      secondaryRoles: [],
      department: ROLE_DEPARTMENT[ruolo],
      birthDate: `${2025 - p.age}-01-01`,
    };
  }

  return {
    ...base.world,
    cupTeams,
    cupEntrants: { clubIds: CUP_CLUBS, leagues: CUP_LEAGUES },
    market: {
      clubs,
      transferPool,
      valuation: {
        leaguePrestigeByClub: Object.fromEntries(CUP_CLUBS.map((id) => [id, 4])),
        clubPrestige: Object.fromEntries(CUP_CLUBS.map((id) => [id, 4])),
        clubsInSameEra: 20,
      },
      players: anagraficaMercato,
      nameOf: (id) => anagraficaMercato[id]?.name ?? id,
      ageOf: (id) => {
        const nato = anagraficaMercato[id]?.birthDate;
        return nato ? 2025 - Number(nato.slice(0, 4)) : 24;
      },
      leagueRounds: 38,
    },
  };
}

function fullCareer(seed = "completo", overall = 80) {
  const base = buildWorld(overall);
  const world = withCupAndMarket(base);
  const state = createCareer({
    seed,
    clubId: "mio",
    leagueId: "serie-a",
    coachId: "c-10",
    roster: base.roster,
    budget: 40_000_000,
    cupEntrants: { clubIds: CUP_CLUBS, leagues: CUP_LEAGUES },
  });
  return { state, world };
}

describe("simmetria fra noi e le avversarie", () => {
  /**
   * Il difetto che questo blocco impedisce di ripetere: la forza dell'utente esce da
   * `computeSquadStrength`, che pesa i reparti e somma l'affiatamento, mentre un'avversaria
   * costruita con la media piatta dei suoi undici risulta più debole **a parità di giocatori**.
   * Nella Modalità Classica lo stesso squilibrio portava una rosa da 70 a giocarsela da 80.
   */
  it("la stessa rosa, letta come avversaria, ha una forza confrontabile con la nostra", () => {
    const { world } = buildWorld(78);
    const { state } = newCareer("simmetria", 78);
    const nostra = squadStrengthOf(state, world);

    const players: Player[] = state.roster.map((entry) => {
      const risolto = world.players[entry.playerId]!;
      return {
        ...risolto,
        overall: entry.overall,
        marketValue: 0,
        clubId: "mio",
        era: "",
        league: "serie-a",
      } as Player;
    });
    const avversaria = careerOpponentTeam({ id: "mio", name: "Copia", players });

    // Non identiche — l'utente ha l'allenatore e l'affiatamento che si costruisce — ma nello
    // stesso intorno: sopra i 6 punti di scarto il campionato smetterebbe di essere una gara.
    expect(Math.abs(nostra.attack - avversaria.strength!.attack)).toBeLessThanOrEqual(6);
    expect(Math.abs(nostra.defence - avversaria.strength!.defence)).toBeLessThanOrEqual(6);
  });

  it("un'avversaria riceve l'affiatamento, non zero", () => {
    const { world } = buildWorld(80);
    const players = Object.values(world.players).map(
      (p) => ({ ...p, overall: 80, marketValue: 0, clubId: "c", era: "", league: "l" }) as Player,
    );
    const team = careerOpponentTeam({ id: "c", name: "Club", players });
    // Con tutti gli Overall a 80 i pesi di reparto danno 80: quel che eccede è l'affiatamento.
    expect(team.strength!.attack).toBe(80 + AI_CLUB_COHESION);
    expect(team.strength!.defence).toBe(80 + AI_CLUB_COHESION);
  });

  it("la rosa ereditata parte rodata, e un acquisto la diluisce", () => {
    const { world, roster } = buildWorld(78);
    const ereditata = roster.map((e) => ({ ...e, sinceSeason: INHERITED_SINCE_SEASON }));
    const base = createCareer({
      seed: "rodata",
      clubId: "mio",
      leagueId: "serie-a",
      coachId: "c-10",
      roster: ereditata,
      budget: 0,
    });
    const forteInsieme = squadStrengthOf(base, world);

    // Mezza squadra rifatta adesso: gli stessi Overall, ma il gruppo non si conosce.
    const rifatta = {
      ...base,
      roster: ereditata.map((e, i) => (i % 2 === 0 ? { ...e, sinceSeason: 1 } : e)),
    };
    expect(squadStrengthOf(rifatta, world).attack).toBeLessThan(forteInsieme.attack);
  });
});

describe("undici e forza", () => {
  it("l'undici si deriva dalla rosa e la squadra ha una forza sensata", () => {
    const { state, world } = newCareer();
    const lineup = currentLineup(state, world);
    expect(Object.keys(lineup.starters)).toHaveLength(11);

    const strength = squadStrengthOf(state, world);
    expect(strength.attack).toBeGreaterThan(60);
    expect(strength.defence).toBeGreaterThan(60);
  });

  it("una rosa più forte produce una squadra più forte", () => {
    const debole = newCareer("x", 70);
    const forte = newCareer("x", 84);
    expect(squadStrengthOf(forte.state, forte.world).attack).toBeGreaterThan(
      squadStrengthOf(debole.state, debole.world).attack,
    );
  });
});

describe("avanzamento settimanale", () => {
  it("una settimana gioca una giornata e aggiorna la classifica", () => {
    const { state, world } = newCareer();
    const { state: dopo, report } = advanceWeek(state, world);
    expect(report.match).toBeDefined();
    expect(report.standings).toHaveLength(20);
    expect(dopo.league.round).toBe(1);
  });

  it("i minuti si accumulano solo per chi gioca", () => {
    const { state, world } = newCareer();
    const lineup = currentLineup(state, world);
    const titolare = Object.values(lineup.starters)[0]!;
    const { state: dopo } = advanceWeek(state, world);

    const giocato = dopo.roster.find((e) => e.playerId === titolare)!;
    expect(giocato.stats.minutes).toBe(90);
    const panchinari = dopo.roster.filter((e) => !Object.values(lineup.starters).includes(e.playerId));
    expect(panchinari.every((e) => e.stats.minutes === 0)).toBe(true);
  });

  it("una decisione in sospeso ferma il gioco finché non si risponde", () => {
    const { state, world } = newCareer();
    // Si forza una richiesta mettendo un giocatore forte e infelice.
    const conScontento: CareerState = {
      ...state,
      phase: "stagione",
      roster: state.roster.map((e, i) => (i === 25 ? { ...e, overall: 90, morale: 5 } : e)),
    };
    const { state: dopo, report } = advanceWeek(conScontento, world);
    expect(report.request).toBeDefined();

    // Senza risposta non si avanza: la settimana resta la stessa.
    const bloccato = advanceWeek(dopo, world);
    expect(bloccato.state.week).toBe(dopo.week);
    expect(bloccato.report.request).toBeDefined();

    // Con la risposta si riparte.
    const sbloccato = advanceWeek(dopo, world, { requestResponse: "prometti" });
    expect(sbloccato.state.pendingRequest).toBeNull();
  });

  it("la richiesta forzata si risolve con la stessa chat dello standoff volontario", () => {
    const { state, world } = newCareer();
    const conScontento: CareerState = {
      ...state,
      phase: "stagione",
      roster: state.roster.map((e, i) => (i === 25 ? { ...e, overall: 90, morale: 5 } : e)),
    };
    const { state: dopo } = advanceWeek(conScontento, world);
    expect(dopo.pendingRequest).toBeTruthy();

    const standoff = openForcedStandoff(dopo);
    expect(standoff).not.toBeNull();
    expect(standoff!.playerId).toBe(dopo.pendingRequest!.playerId);

    // Una mossa sola non basta sempre a chiudere: si ripete finché non si risolve, come in
    // qualunque standoff — qui però ogni mossa deve anche tenere sincronizzato `pendingRequest`.
    let corrente = dopo;
    let s = standoff!;
    let guard = 0;
    while (s.status === "aperta" && guard++ < 10) {
      const esito = resolveForcedStandoff(corrente, world, s, { kind: "concedi_prestito" });
      corrente = esito.state;
      s = esito.standoff;
    }
    expect(s.status).not.toBe("aperta");
    expect(corrente.pendingRequest).toBeNull();
    expect(corrente.lastResolvedMatchday).toBe(corrente.league.round);
    expect(corrente.lists.loanList).toContain(standoff!.playerId);
  });
});

describe("obiettivo stagionale", () => {
  it("propone tre fasce e dichiararle chiude il gate di inizio stagione", () => {
    const { state, world } = fullCareer("obiettivo-scelta");
    const scelte = seasonObjectiveChoices(state, world);
    expect(scelte.length).toBeGreaterThan(0);

    const dopo = setSeasonObjective(state, scelte[0]!);
    expect(dopo.seasonObjectiveSet).toBe(true);
    expect(dopo.seasonObjective?.targetPosition).toBe(scelte[0]!.targetPosition);
  });

  it("l'esito dell'obiettivo a fine stagione muove la sintonia col mister nella direzione giusta", () => {
    const { state, world } = fullCareer("obiettivo-esito", 78);
    let conObiettivo = setSeasonObjective(state, { targetPosition: 1, label: "Titolo" });
    conObiettivo = { ...conObiettivo, coachHarmony: 75 };
    const dopo = playSeason(conObiettivo, world);
    if (dopo.phase === "conclusa" && dopo.ending === "retrocessione") return; // altro esito

    const finale = dopo.history[dopo.history.length - 1]!;
    const raggiunto = finale.position <= 1;
    if (raggiunto) {
      expect(dopo.coachHarmony ?? 75).toBeGreaterThan(75);
    } else {
      expect(dopo.coachHarmony ?? 75).toBeLessThan(75);
    }
  });
});

/**
 * **La dirigenza dentro la carriera** (`board.ts`). Richiesta esplicita dell'utente: *"un
 * obiettivo non raggiunto deve portare la dirigenza a chiedere l'esonero del mister"*. Qui si
 * verifica che il collegamento esista davvero a fine stagione, non solo nel modulo isolato.
 */
describe("la dirigenza a fine stagione", () => {
  it("promettere il titolo con una rosa media apre la richiesta di esonero del mister", () => {
    const { state, world } = fullCareer("dirigenza-esonero", 73);
    const conObiettivo = setSeasonObjective(state, { targetPosition: 1, label: "Titolo" });
    const dopo = playSeason(conObiettivo, world);
    if (dopo.phase === "conclusa" && dopo.ending === "retrocessione") return; // altro esito

    const finale = dopo.history[dopo.history.length - 1]!;
    if (finale.position === 1) return; // titolo vinto: non c'è nulla da contestare

    const trofei = finale.trophies
      ? Number(finale.trophies.league) +
        Number(finale.trophies.continental) +
        Number(finale.trophies.national)
      : 0;
    if (trofei > 0) return; // un trofeo mette il mister al riparo, per costruzione

    expect(dopo.board?.sackDemand).toBeDefined();
    expect(dopo.board!.confidence).toBeLessThan(defaultBoard().confidence);
  });

  it("difendere il mister costa fiducia; assecondare la dirigenza libera la panchina", () => {
    const { state } = fullCareer("dirigenza-risposta");
    const conRichiesta: typeof state = {
      ...state,
      coachHarmony: 50,
      board: {
        confidence: 50,
        sackDemand: {
          season: 1,
          objectiveLabel: "Titolo",
          targetPosition: 1,
          finalPosition: 9,
          coachName: "Il mister",
          severity: "richiesta",
        },
      },
    };

    const difeso = answerBoardSackDemand(conRichiesta, "difendi").state;
    expect(difeso.coachId).toBe(state.coachId);
    expect(difeso.board!.confidence).toBeLessThan(50);
    expect(difeso.coachHarmony!).toBeGreaterThan(50);
    expect(difeso.board!.sackDemand).toBeUndefined();

    const esonerato = answerBoardSackDemand(conRichiesta, "esonera").state;
    expect(esonerato.coachId).toBeNull();
    expect(esonerato.board!.confidence).toBeGreaterThan(50);
  });
});

describe("notizie di giornata", () => {
  it("con l'obiettivo massimo e una rosa debole, almeno una giornata fra le ultime cinque segnala la pressione", () => {
    const { state, world } = fullCareer("notizia-pressione", 65);
    const conObiettivo = setSeasonObjective(state, { targetPosition: 1, label: "Titolo" });
    let corrente = conObiettivo;
    const viste: string[] = [];
    for (let g = 0; g < 60; g++) {
      const { state: next, report } = advanceWeek(corrente, world, {
        requestResponse: "prometti",
        closeMarket: true,
      });
      corrente = next;
      viste.push(...report.messages);
      if (report.seasonEnded || report.careerEnded) break;
    }
    expect(viste.some((m) => m.includes("pressione") || m.includes("stelle"))).toBe(true);
  });
});

describe("resoconto di fine stagione, esteso", () => {
  it("il riepilogo porta morale, coda standoff, saldo di mercato e l'esito dell'obiettivo", () => {
    const { state, world } = fullCareer("resoconto-esteso", 78);
    const scelte = seasonObjectiveChoices(state, world);
    const conObiettivo = setSeasonObjective(state, scelte[0]!);
    const dopo = playSeason(conObiettivo, world);
    if (dopo.phase === "conclusa" && dopo.ending === "retrocessione") return;

    const summary = dopo.history[dopo.history.length - 1]!;
    expect(summary.avgMorale).toBeGreaterThanOrEqual(0);
    expect(summary.unhappyCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(summary.standoffQueue)).toBe(true);
    expect(typeof summary.coachHarmonyDelta).toBe("number");
    expect(typeof summary.netBudget).toBe("number");
    expect(summary.objective?.targetPosition).toBe(scelte[0]!.targetPosition);
    expect(summary.objective?.met).toBe(summary.position <= scelte[0]!.targetPosition);
  });

  it("senza un obiettivo dichiarato, il riepilogo non ne mostra uno", () => {
    const { state, world } = fullCareer("resoconto-senza-obiettivo", 78);
    const dopo = playSeason(state, world);
    if (dopo.phase === "conclusa" && dopo.ending === "retrocessione") return;
    const summary = dopo.history[dopo.history.length - 1]!;
    expect(summary.objective).toBeUndefined();
  });
});

describe("mondo IA degli allenatori", () => {
  it("all'apertura del primo mercato estivo, i club con un segnale vero ricevono un allenatore", () => {
    const { state, world } = fullCareer("aicoach-init");
    const { state: aperto } = advanceWeek(state, world);
    expect(aperto.aiCoaches).toBeDefined();
    expect(Object.keys(aperto.aiCoaches!).length).toBeGreaterThan(0);
    for (const assegnazione of Object.values(aperto.aiCoaches!)) {
      expect(findCoach(assegnazione.coachId)).toBeDefined();
    }
  });

  it("riaprire la stessa finestra non riassegna da capo (nessuna news duplicata)", () => {
    const { state, world } = fullCareer("aicoach-stabile");
    const { state: aperto } = advanceWeek(state, world);
    const { state: riaperto } = advanceWeek(aperto, world);
    expect(riaperto.aiCoaches).toEqual(aperto.aiCoaches);
  });

  it("resta popolato attraverso più stagioni", () => {
    let { state, world } = fullCareer("aicoach-lungo", 78);
    for (let s = 0; s < 3; s++) {
      const { state: aperto } = advanceWeek(state, world);
      state = playSeason(aperto, world);
      if (state.phase === "conclusa") return;
    }
    expect(Object.keys(state.aiCoaches ?? {}).length).toBeGreaterThan(0);
  });
});

describe("fine stagione", () => {
  it("una stagione si completa e produce un riepilogo", () => {
    const { state, world } = newCareer();
    const dopo = playSeason(state, world);
    expect(dopo.history).toHaveLength(1);
    const summary = dopo.history[0]!;
    expect(summary.season).toBe(1);
    expect(summary.position).toBeGreaterThanOrEqual(1);
    expect(summary.position).toBeLessThanOrEqual(20);
  });

  it("le statistiche si azzerano e la fatica si smaltisce fra una stagione e l'altra", () => {
    const { state, world } = newCareer();
    const dopo = playSeason(state, world);
    if (dopo.phase === "conclusa") return; // retrocesso: caso coperto altrove
    expect(dopo.roster.every((e) => e.stats.minutes === 0)).toBe(true);
    expect(dopo.roster.every((e) => e.fatigue === 0)).toBe(true);
    expect(dopo.roster.every((e) => e.injuryMatchdaysLeft === 0)).toBe(true);
  });

  it("una rosa scarsa retrocede e la carriera finisce lì", () => {
    // È la scelta dell'utente: la retrocessione chiude la partita, ed è ciò che dà peso a
    // ogni stagione quando si sceglie un club piccolo.
    const { state, world } = newCareer("retro", 62);
    const dopo = playSeason(state, world);
    expect(dopo.phase).toBe("conclusa");
    expect(dopo.ending).toBe("retrocessione");
  });

  it("con una grande squadra si arriva in fondo alle dieci stagioni", () => {
    let { state, world } = newCareer("lungo", 88);
    for (let s = 0; s < CAREER_SEASONS; s++) {
      state = playSeason(state, world);
      if (state.phase === "conclusa") break;
    }
    expect(state.phase).toBe("conclusa");
    expect(state.ending).toBe("completata");
    expect(state.history).toHaveLength(CAREER_SEASONS);
  });
});

describe("ciclo di vita lungo una carriera", () => {
  it("qualcuno si ritira, un regen ne prende il posto, e le scadenze non svuotano la rosa", () => {
    /**
     * **L'invariante è cambiata con l'arrivo dei contratti, e il test lo dice.**
     *
     * Prima l'unica uscita erano i ritiri, quindi la rosa restava della stessa dimensione grazie
     * al rimpiazzo 1:1. Ora esce anche chi va in scadenza senza essere rinnovato — che è il punto
     * del sistema contratti — e in una simulazione automatica *nessuno rinnova mai*. Ciò che deve
     * restare vero è: i regen ci sono, e la rosa non scende comunque sotto il minimo di sicurezza,
     * perché la società rinnova d'ufficio prima di ritrovarsi senza squadra (`expireContracts`).
     */
    let { state, world } = newCareer("vita", 80);
    const rosaIniziale = new Set(state.roster.map((e) => e.playerId));

    for (let s = 0; s < 4 && state.phase !== "conclusa"; s++) {
      state = playSeason(state, world);
    }

    const rosaDopo = state.roster.map((e) => e.playerId);
    const usciti = [...rosaIniziale].filter((id) => !rosaDopo.includes(id));
    expect(usciti.length).toBeGreaterThan(0);
    expect(state.generated.length).toBeGreaterThan(0);
    expect(state.roster.length).toBeGreaterThanOrEqual(MIN_SQUAD_SIZE + 2);
  });

  it("i regen hanno nomi sempre diversi e sono marcati come inventati", () => {
    let { state, world } = newCareer("nomi", 80);
    for (let s = 0; s < 5 && state.phase !== "conclusa"; s++) {
      state = playSeason(state, world);
    }
    const nomi = state.generated.map((p) => p.name);
    expect(new Set(nomi).size).toBe(nomi.length);
    expect(state.generated.every((p) => p.origin === "regen")).toBe(true);
    // Sono ragazzi, non pronti-uso.
    expect(state.generated.every((p) => p.overall < p.potential)).toBe(true);
  });

  it("ogni giocatore in rosa ha un nome risolvibile, regen compresi", () => {
    /**
     * L'invariante che la UI deve poter dare per scontato. I regen non esistono nel database,
     * quindi chi legge `world.players` direttamente non li trova: `careerPlayers` è il punto in
     * cui il pool e i giocatori inventati si fondono, ed è l'unico modo corretto di risolvere
     * l'anagrafica di una carriera.
     */
    let { state, world } = newCareer("anagrafica", 80);
    for (let s = 0; s < 3 && state.phase !== "conclusa"; s++) {
      state = playSeason(state, world);
    }
    expect(state.generated.length).toBeGreaterThan(0);

    const anagrafica = careerPlayers(state, world);
    for (const entry of state.roster) {
      const player = anagrafica[entry.playerId];
      expect(player, `manca l'anagrafica di ${entry.playerId}`).toBeDefined();
      expect(player!.name.length).toBeGreaterThan(0);
      expect(player!.nation.length).toBeGreaterThan(0);
      expect(player!.role).toBeDefined();
    }
    // E il pool grezzo, da solo, **non** basta: è esattamente il difetto da cui nasce il test.
    const soloPool = state.roster.filter((e) => !world.players[e.playerId]);
    expect(soloPool.length).toBeGreaterThan(0);
  });

  it("un regen eredita nazionalità e ruolo di chi si è ritirato", () => {
    let { state, world } = newCareer("eredita", 80);
    state = playSeason(state, world);
    for (const regen of state.generated) {
      // L'id del regen conserva quello del predecessore: `regen-<id>-<stagione>`.
      const predecessore = regen.id.replace(/^regen-/, "").replace(/-\d+$/, "");
      const originale = world.players[predecessore]!;
      expect(regen.nation).toBe(originale.nation);
      expect(regen.role).toBe(originale.role);
    }
  });
});

describe("regen in club casuali (niente trucco compra-e-aspetta-il-ritiro)", () => {
  /**
   * Bug segnalato dall'utente: il regen di un proprio ritirato nasceva **sempre** nella
   * propria rosa, quindi comprare un giocatore vicino al ritiro garantiva un regen gratis in
   * squadra. Con un mondo/mercato vero (`fullCareer`, 20 club) il rimpiazzo ora nasce in un
   * club scelto a caso — la propria rosa non ha più corsia preferenziale.
   */
  it("con un mercato vero non tutti i regen finiscono nella nostra rosa", () => {
    let { state, world } = fullCareer("regenCasuale", 80);
    for (let s = 0; s < 6 && state.phase !== "conclusa"; s++) {
      state = playSeason(state, world);
    }
    expect(state.generated.length).toBeGreaterThan(0);
    const altrove = state.generated.filter((p) => p.destinationClubId && p.destinationClubId !== state.clubId);
    expect(altrove.length, "nessun regen è mai nato fuori dal nostro club: il sorteggio non sta girando").toBeGreaterThan(0);
    // E chi nasce fuori non entra nella nostra rosa.
    const idsAltrove = new Set(altrove.map((p) => p.id));
    expect(state.roster.some((e) => idsAltrove.has(e.playerId))).toBe(false);
  });

  it("l'argine di giocabilità non lascia mai la rosa sotto il minimo di sicurezza", () => {
    let { state, world } = fullCareer("regenArgine", 80);
    for (let s = 0; s < 8 && state.phase !== "conclusa"; s++) {
      state = playSeason(state, world);
      expect(state.roster.length).toBeGreaterThanOrEqual(MIN_SQUAD_SIZE + 2);
    }
  });

  it("senza un mondo/mercato configurato il regen resta in casa come prima (nessuna rottura dei test esistenti)", () => {
    let { state, world } = newCareer("nomercato", 80);
    for (let s = 0; s < 4 && state.phase !== "conclusa"; s++) {
      state = playSeason(state, world);
    }
    expect(state.generated.every((p) => !p.destinationClubId)).toBe(true);
  });
});

describe("Corona Continentale dentro la carriera", () => {
  it("chi è qualificato gioca nove turni in più, chi non lo è nessuno", () => {
    const conCoppa = fullCareer("coppa");
    const senzaCoppa = newCareer("coppa", 80);
    expect(seasonCalendar(conCoppa.state, conCoppa.world).length).toBe(
      seasonCalendar(senzaCoppa.state, senzaCoppa.world).length,
    );
    // Stesso numero di settimane, ma nove contengono anche un turno di coppa.
    const turni = seasonCalendar(conCoppa.state, conCoppa.world).filter(cupSlotOf).length;
    expect(turni).toBe(TOTAL_CUP_ROUNDS);
    expect(seasonCalendar(senzaCoppa.state, senzaCoppa.world).filter(cupSlotOf)).toHaveLength(0);
  });

  it("una stagione produce le nostre partite di coppa e un esito", () => {
    let { state, world } = fullCareer("coppa2");
    const partite: string[] = [];
    for (let i = 0; i < 200; i++) {
      const { state: next, report } = advanceWeek(state, world, {
        requestResponse: "prometti",
        closeMarket: true,
      });
      state = next;
      if (report.cupMatch) partite.push(report.cupMatch.stage);
      if (report.seasonEnded || report.careerEnded) break;
    }
    // Almeno le sei del girone: oltre dipende da quanto lontano si arriva.
    expect(partite.length).toBeGreaterThanOrEqual(6);
    expect(partite.slice(0, 6).every((s) => s === "girone")).toBe(true);

    const summary = state.history[0];
    if (summary) expect(summary.cupOutcome).toBeDefined();
  });

  it("in Corona si gioca con la rosa vera: una squadra forte fa più punti di una debole", () => {
    /**
     * Difetto segnalato dall'utente — "la mia squadra fortissima non avanza mai" — e la causa
     * era più insidiosa del sintomo: il mondo esclude i nostri giocatori (li gestisce la
     * carriera), quindi la squadra iscritta alla Corona veniva costruita da una rosa **vuota**
     * e scendeva in campo con forza 70, la più debole del torneo. Succedeva proprio ai club
     * qualificati, cioè ai più forti.
     */
    const puntiGirone = (overall: number) => {
      let { state, world } = fullCareer(`corona-${overall}`, overall);
      for (let i = 0; i < 60; i++) {
        const { state: next } = advanceWeek(state, world, {
          requestResponse: "prometti",
          closeMarket: true,
        });
        state = next;
        if (!state.cup || state.cup.groupRound >= 6) break;
      }
      const indice = state.cup!.entrants.indexOf(state.clubId);
      const t = state.cup!.tallies[indice]!;
      return t.wins * 3 + t.draws;
    };

    expect(puntiGirone(88)).toBeGreaterThan(puntiGirone(68));
  });

  it("la coppa si ricostruisce dal seme: salvare e ricaricare non la cambia", () => {
    const { state, world } = fullCareer("coppa3");
    const filato = (() => {
      let s = state;
      for (let i = 0; i < 12; i++) {
        s = advanceWeek(s, world, { requestResponse: "prometti", closeMarket: true }).state;
      }
      return s;
    })();

    let conPausa = state;
    for (let i = 0; i < 6; i++) {
      conPausa = advanceWeek(conPausa, world, { requestResponse: "prometti", closeMarket: true }).state;
    }
    let ripreso: CareerState = JSON.parse(JSON.stringify(conPausa));
    for (let i = 6; i < 12; i++) {
      ripreso = advanceWeek(ripreso, world, { requestResponse: "prometti", closeMarket: true }).state;
    }
    expect(ripreso.cup).toEqual(filato.cup);
  });
});

describe("mercato dentro la carriera", () => {
  it("il mercato estivo si apre prima della stagione e blocca il calendario", () => {
    const { state, world } = fullCareer("mercato");
    const { state: dopo, report } = advanceWeek(state, world);
    expect(report.marketWindow).toBe(true);
    expect(report.market?.window).toBe("estiva");
    // Finché è aperto non si gioca: la settimana non avanza.
    expect(dopo.week).toBe(0);
    expect(advanceWeek(dopo, world).report.match).toBeUndefined();

    // Chiudendolo parte la stagione.
    const { report: dopoChiusura } = advanceWeek(dopo, world, { closeMarket: true });
    expect(dopoChiusura.match).toBeDefined();
  });

  it("si apre anche la finestra di riparazione, a metà stagione", () => {
    let { state, world } = fullCareer("riparazione");
    const finestre: string[] = [];
    for (let i = 0; i < 200; i++) {
      const { state: next, report } = advanceWeek(state, world, {
        requestResponse: "prometti",
        closeMarket: true,
      });
      state = next;
      if (report.market) finestre.push(report.market.window);
      if (report.seasonEnded || report.careerEnded) break;
    }
    expect(finestre).toContain("estiva");
    expect(finestre).toContain("riparazione");
  });

  it("comprare toglie soldi e aggiunge un giocatore che deve guadagnarsi l'affiatamento", () => {
    const { state, world } = fullCareer("compra");
    const { state: aperto } = advanceWeek(state, world);
    const target = aperto.market!.shortlist[0];
    if (!target) return; // rosa già piena: caso legittimo, coperto da `canBuy`

    const { state: dopo, result } = applyMarket(aperto, world, {
      kind: "compra",
      playerId: target.playerId,
    });
    expect(dopo.roster).toHaveLength(aperto.roster.length + 1);
    expect(dopo.budget).toBe(aperto.budget - target.price);
    const nuovo = dopo.roster.find((e) => e.playerId === target.playerId)!;
    expect(nuovo.sinceSeason).toBe(aperto.season);
    expect(result.message).toContain(target.playerName);
  });

  it("non si può comprare oltre il budget", () => {
    const { state, world } = fullCareer("povero");
    const { state: aperto } = advanceWeek({ ...state, budget: 1000 }, world);
    const target = aperto.market!.shortlist[0];
    if (!target) return;
    const { state: dopo, result } = applyMarket(aperto, world, {
      kind: "compra",
      playerId: target.playerId,
    });
    expect(dopo.roster).toHaveLength(aperto.roster.length);
    expect(result.message).toMatch(/[Bb]udget/);
  });

  it("rifiutare un'offerta costa morale: la scelta non è gratuita", () => {
    const { state, world } = fullCareer("rifiuto");
    const { state: aperto } = advanceWeek(state, world);
    const offerta = aperto.market!.offers[0];
    if (!offerta) return;
    const prima = aperto.roster.find((e) => e.playerId === offerta.playerId)!.morale;
    const { state: dopo } = applyMarket(aperto, world, {
      kind: "rifiuta_offerta",
      playerId: offerta.playerId,
    });
    expect(dopo.roster.find((e) => e.playerId === offerta.playerId)!.morale).toBeLessThan(prima);
  });

  it("una finestra riaperta dopo un ricaricamento propone le stesse operazioni", () => {
    const { state, world } = fullCareer("stabile-mercato");
    const primo = advanceWeek(state, world).report.market;
    const ricaricato: CareerState = JSON.parse(JSON.stringify(state));
    const secondo = advanceWeek(ricaricato, world).report.market;
    expect(secondo).toEqual(primo);
  });
});

describe("il mercato come cuore della modalità", () => {
  /** Apre la finestra estiva e restituisce lo stato con il mercato aperto. */
  function conMercatoAperto(seed = "mkt") {
    const { state, world } = fullCareer(seed);
    return { state: advanceWeek(state, world).state, world };
  }

  it("si può cercare qualunque giocatore, non solo le proposte del sistema", () => {
    const { state, world } = conMercatoAperto("ricerca");
    const tutti = searchMarket(state, world, {});
    expect(tutti.length).toBeGreaterThan(0);
    // Nessuno dei nostri fra gli acquistabili.
    const nostri = new Set(state.roster.map((e) => e.playerId));
    expect(tutti.every((r) => !nostri.has(r.playerId))).toBe(true);
    // Il prezzo è il valore di mercato, non zero.
    expect(tutti.every((r) => r.price > 0)).toBe(true);
  });

  it("i filtri della ricerca stringono davvero", () => {
    const { state, world } = conMercatoAperto("filtri");
    const tutti = searchMarket(state, world, {});
    const soloAttaccanti = searchMarket(state, world, { department: "ATT" });
    expect(soloAttaccanti.every((r) => r.department === "ATT")).toBe(true);
    expect(soloAttaccanti.length).toBeLessThan(tutti.length);

    const economici = searchMarket(state, world, { maxPrice: 5_000_000 });
    expect(economici.every((r) => r.price <= 5_000_000)).toBe(true);

    const giovani = searchMarket(state, world, { maxAge: 23 });
    expect(giovani.every((r) => r.age <= 23)).toBe(true);
  });

  it("la ricerca è stabile: stessi criteri, stessi risultati", () => {
    const { state, world } = conMercatoAperto("stabile-ricerca");
    expect(searchMarket(state, world, { query: "Acquisto" })).toEqual(
      searchMarket(state, world, { query: "Acquisto" }),
    );
  });

  it("la ricerca non propone sempre gli stessi nomi da una stagione all'altra", () => {
    /**
     * Bug segnalato dall'utente: `Array.sort` è deterministico, quindi a parità di filtri il
     * "migliore" restava sempre lo stesso. La stagione fa parte del seme di mescolamento: la
     * stessa ricerca in stagioni diverse deve poter restituire un ordine diverso, pur restando
     * stabile **entro** la stessa stagione (verificato dal test sopra).
     */
    const { state, world } = conMercatoAperto("varieta-ricerca");
    const s1 = searchMarket(state, world, { sort: "overall" }).map((r) => r.playerId);
    const s2 = searchMarket({ ...state, season: state.season + 1 }, world, { sort: "overall" }).map(
      (r) => r.playerId,
    );
    expect(s1).not.toEqual(s2);
    // Ma il primo migliore resta comunque fra i primi (il mescolamento è a piccoli gruppi, non
    // ribalta la classifica): non deve mai sparire in fondo.
    expect(s2.indexOf(s1[0]!)).toBeLessThan(10);
  });

  it("un giocatore cercato si compra al suo valore", () => {
    const { state, world } = conMercatoAperto("compra-ricerca");
    const target = searchMarket(state, world, { sort: "prezzo" })[0];
    if (!target) return;

    const { state: dopo, result } = applyMarket(state, world, { kind: "acquista", target });
    expect(result.rejected).toBeFalsy();
    expect(dopo.roster.some((e) => e.playerId === target.playerId)).toBe(true);
    expect(dopo.budget).toBe(state.budget - target.price);
    // Arrivato adesso: l'affiatamento se lo deve guadagnare.
    expect(dopo.roster.find((e) => e.playerId === target.playerId)!.sinceSeason).toBe(dopo.season);
  });

  it("non si compra due volte lo stesso giocatore", () => {
    const { state, world } = conMercatoAperto("doppione");
    const target = searchMarket(state, world, { sort: "prezzo" })[0];
    if (!target) return;
    const { state: dopo } = applyMarket(state, world, { kind: "acquista", target });
    const { state: ancora, result } = applyMarket(dopo, world, { kind: "acquista", target });
    expect(result.rejected).toBe(true);
    expect(ancora.roster).toHaveLength(dopo.roster.length);
  });

  it("mettere un giocatore in lista trasferimenti gli fa arrivare offerte", () => {
    /**
     * È il meccanismo che trasforma il mercato da vetrina in trattativa: dichiarare qualcuno
     * cedibile deve produrre un effetto, altrimenti l'utente può solo subire le offerte.
     */
    const { state, world } = fullCareer("lista");
    const cedibile = [...state.roster].sort((a, b) => a.overall - b.overall)[3]!;
    const conLista: CareerState = {
      ...state,
      lists: { transferList: [cedibile.playerId], loanList: [] },
    };
    const { state: aperto } = advanceWeek(conLista, world);
    expect(aperto.market!.offers.some((o) => o.playerId === cedibile.playerId)).toBe(true);
  });

  it("il mercato estivo non si apre mai senza nemmeno un'offerta", () => {
    /**
     * Difetto segnalato dall'utente: aprendo il mercato non arrivava **nessuna** offerta, e
     * senza offerte la metà interessante della finestra non c'è — si può solo comprare, e il
     * mercato smette di essere una trattativa a due.
     */
    for (const seme of ["a", "b", "c", "d", "e", "f"]) {
      const { state, world } = fullCareer(`offerte-${seme}`);
      const { state: aperto } = advanceWeek(state, world);
      expect(aperto.market!.window).toBe("estiva");
      expect(aperto.market!.offers.length, `nessuna offerta col seme ${seme}`).toBeGreaterThan(0);
    }
  });

  it("le offerte continuano ad arrivare anche nelle stagioni successive alla prima", () => {
    /**
     * Difetto segnalato dall'utente: le offerte erano poche e **si azzeravano dopo la seconda
     * stagione**. La causa era strutturale — con la rosa vicina al minimo consentito, `canSell`
     * negava quasi tutti e il mercato non aveva più nessuno da chiedere. Rimossa la banda di
     * rosa, il problema non può ripresentarsi, e questo test lo verifica dove si vedeva.
     */
    let { state, world } = fullCareer("offerte-negli-anni", 80);
    const perStagione: number[] = [];

    for (let s = 0; s < 3; s++) {
      // Apre il mercato estivo della stagione corrente.
      const { state: aperto } = advanceWeek(state, world);
      if (!aperto.market) break;
      perStagione.push(aperto.market.offers.length);
      state = playSeason(aperto, world);
      if (state.phase === "conclusa") break;
    }

    expect(perStagione.length).toBeGreaterThanOrEqual(3);
    for (const [i, quante] of perStagione.entries()) {
      // Non "almeno una": il mercato estivo dev'essere **vivo**, cioè proporre più di una
      // decisione. Una sola offerta a stagione era il difetto, non la soluzione.
      expect(quante, `troppe poche offerte alla stagione ${i + 1}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("mettere un giocatore forte in lista trasferimenti alla 3a/4a stagione genera comunque offerte", () => {
    let { state, world } = fullCareer("lista-stagione3", 82);
    // Avanziamo fino alla stagione 3
    for (let s = 1; s < 3; s++) {
      const { state: aperto } = advanceWeek(state, world);
      state = playSeason(aperto, world);
      if (state.phase === "conclusa") return;
    }

    // Apriamo mercato stagione 3
    const { state: apertoStagione3 } = advanceWeek(state, world);
    if (!apertoStagione3.market) return;

    // Prendiamo un nostro giocatore forte (es. Overall 85+)
    const giocatoreForte = apertoStagione3.roster.find((e) => e.overall >= 84) ?? apertoStagione3.roster[0]!;

    const { state: dopoLista, result } = applyMarket(apertoStagione3, world, {
      kind: "lista_trasferimenti",
      playerId: giocatoreForte.playerId,
      on: true,
    });

    const offertaArrivata = dopoLista.market?.offers.some((o) => o.playerId === giocatoreForte.playerId);
    expect(offertaArrivata, `Nessuna offerta per ${giocatoreForte.playerId} (overall ${giocatoreForte.overall}) in stagione 3`).toBe(true);
  });

  /** Un giocatore under 24 della rosa: solo loro sono ammessi al prestito (`MAX_LOAN_AGE`). */
  function trovaGiovaneCandidabile(state: CareerState, world: CareerWorld) {
    return state.roster.find((e) => (world.market?.ageOf(e.playerId) ?? 99) <= 23);
  }

  it("mettere un giocatore in lista prestiti genera subito una destinazione, come per i trasferimenti", () => {
    const { state, world } = conMercatoAperto("prestiti-subito");
    const giovane = trovaGiovaneCandidabile(state, world);
    expect(giovane, "nessun under 24 in questa rosa di prova: il test non verifica nulla").toBeDefined();

    const { state: dopoLista } = applyMarket(state, world, {
      kind: "lista_prestiti",
      playerId: giovane!.playerId,
      on: true,
    });

    const destinazioneArrivata = dopoLista.market?.loanOffers.some((l) => l.playerId === giovane!.playerId);
    expect(destinazioneArrivata).toBe(true);
  });

  it("una trattativa di prestito conclusa manda davvero il giocatore altrove, per i minuti pattuiti", () => {
    const { state, world } = conMercatoAperto("prestito-trattato");
    const chiunque = trovaGiovaneCandidabile(state, world);
    expect(chiunque, "nessun under 24 in questa rosa di prova: il test non verifica nulla").toBeDefined();

    const { state: conLista } = applyMarket(state, world, {
      kind: "lista_prestiti",
      playerId: chiunque!.playerId,
      on: true,
    });
    const loan = conLista.market?.loanOffers.find((l) => l.playerId === chiunque!.playerId);
    expect(loan, "nessuna destinazione trovata: la garanzia di offerta immediata non regge").toBeDefined();

    const aperta = negotiateLoanOffer(conLista, chiunque!.playerId);
    expect(aperta.negotiation?.kind).toBe("prestito");

    const { state: conclusa } = playNegotiation(aperta, world, { kind: "accetta" });
    expect(conclusa.negotiation?.status).toBe("conclusa");

    const entry = conclusa.roster.find((e) => e.playerId === chiunque!.playerId);
    expect(entry?.loan?.hostClubId).toBe(loan!.clubId);
    expect(entry?.loan?.expectedMinutes).toBe(loan!.expectedMinutes);
  });

  it("gli intoccabili del mister sono identificati e cederne uno fa calare la sintonia", () => {
    const { state, world } = conMercatoAperto("intoccabili");
    const intoccabili = getCoachUntouchables(state.roster, state.coachId, world.players);
    expect(intoccabili.length).toBeGreaterThan(0);

    const intoccabileId = intoccabili[0]!;
    const primaSintonia = state.coachHarmony ?? 75;

    const { state: dopo, result } = applyMarket(state, world, {
      kind: "vendi_subito",
      playerId: intoccabileId,
    });

    expect(result.rejected).toBeFalsy();
    expect(dopo.coachHarmony ?? 75).toBeLessThan(primaSintonia);
    expect(result.message).toMatch(/intoccabile/i);
  });

  it("si può svuotare la rosa e ricostruirla: nessun vincolo di dimensione", () => {
    // Richiesta esplicita dell'utente: vendere rapidamente chi si vuole e poi riempire.
    const { state, world } = conMercatoAperto("libera");
    let current = state;
    for (let i = 0; i < 12; i++) {
      const chi = current.roster[current.roster.length - 1];
      if (!chi) break;
      const { state: dopo, result } = applyMarket(current, world, {
        kind: "vendi_subito",
        playerId: chi.playerId,
      });
      if (result.rejected) break;
      current = dopo;
    }
    expect(current.roster.length).toBeLessThan(state.roster.length - 8);
    expect(current.budget).toBeGreaterThan(state.budget);

    // E si può ricomprare per riempire gli spazi.
    const target = searchMarket(current, world, { sort: "prezzo" })[0];
    if (target) {
      const { result } = applyMarket(current, world, { kind: "acquista", target });
      expect(result.rejected).toBeFalsy();
    }
  });

  it("un club di bassa classifica non offre per il tuo fuoriclasse", () => {
    // L'offerta che non prenderesti mai sul serio non è una decisione: è rumore.
    const { state, world } = fullCareer("credibilita", 88);
    const { state: aperto } = advanceWeek(state, world);
    const livelloDi = (clubId: string) => {
      const undici = world.market!.clubs[clubId]?.startingEleven ?? [];
      return undici.length > 0 ? undici.reduce((s, o) => s + o, 0) / undici.length : 70;
    };
    for (const offerta of aperto.market!.offers) {
      const suo = aperto.roster.find((e) => e.playerId === offerta.playerId)!;
      expect(livelloDi(offerta.fromClubId)).toBeGreaterThanOrEqual(suo.overall - 4);
    }
  });

  it("dalla terza stagione le cessioni non listate non si inaridiscono più", () => {
    /**
     * Bug segnalato due volte dall'utente: con una rosa nettamente sopra il livello del mondo
     * IA (che cresce più lentamente, sez. CLAUDE.md §3.7.10), il filtro di credibilità
     * (`MAX_BUYER_GAP`) lasciava senza offerte anche i giocatori **non** messi in lista — il
     * fallback esisteva solo per chi era dichiarato cedibile. Stesso mondo, stessa rosa: a
     * stagione 1 zero offerte (nessun acquirente è credibile), da stagione 3 in poi il mercato
     * torna a proporre qualcosa anche senza dichiarare nessuno cedibile.
     */
    const { state, world } = fullCareer("stagione3", 92);
    expect(world.market).toBeDefined();
    const lista = emptySquadLists();
    const s1 = openMarketWindow(
      state.roster, world.market!, state.clubId, state.leagueId, state.budget, "estiva", state.seed, 1, lista,
    );
    const s3 = openMarketWindow(
      state.roster, world.market!, state.clubId, state.leagueId, state.budget, "estiva", state.seed, 3, lista,
    );
    expect(s1.offers.length).toBe(0);
    expect(s3.offers.length).toBeGreaterThan(0);
  });

  it("le liste sopravvivono alla chiusura del mercato", () => {
    const { state, world } = conMercatoAperto("persistenza-liste");
    const chiunque = state.roster[5]!.playerId;
    const { state: inLista } = applyMarket(state, world, {
      kind: "lista_trasferimenti",
      playerId: chiunque,
      on: true,
    });
    const { state: chiuso } = advanceWeek(inLista, world, { closeMarket: true });
    expect(chiuso.lists.transferList).toContain(chiunque);
  });

  it("vendere subito rende meno che aspettare un'offerta", () => {
    const { state, world } = conMercatoAperto("vendi-subito");
    const cedibile = [...state.roster].sort((a, b) => b.overall - a.overall)[6]!;
    const { state: dopo, result } = applyMarket(state, world, {
      kind: "vendi_subito",
      playerId: cedibile.playerId,
    });
    expect(result.rejected).toBeFalsy();
    expect(dopo.roster.some((e) => e.playerId === cedibile.playerId)).toBe(false);
    expect(dopo.budget).toBeGreaterThan(state.budget);
    expect(result.message).toMatch(/fretta/);
  });

  it("la rosa non può scendere sotto il minimo, nemmeno vendendo subito", () => {
    const { state, world } = conMercatoAperto("minimo");
    let current = state;
    for (let i = 0; i < 30; i++) {
      const cedibile = current.roster[0];
      if (!cedibile) break;
      current = applyMarket(current, world, {
        kind: "vendi_subito",
        playerId: cedibile.playerId,
      }).state;
    }
    expect(current.roster.length).toBeGreaterThanOrEqual(MIN_SQUAD_SIZE);
  });

  it("un giovane in lista prestito altrui si può chiedere in prestito, e a fine stagione se ne va", () => {
    const { state, world } = conMercatoAperto("prestito-in");
    const prestabile = searchMarket(state, world, { onlyLoanable: true })[0];
    if (!prestabile) return;

    const { state: dopo, result } = applyMarket(state, world, {
      kind: "chiedi_prestito",
      target: prestabile,
    });
    expect(result.rejected).toBeFalsy();
    const arrivato = dopo.roster.find((e) => e.playerId === prestabile.playerId)!;
    // Non è nostro: a fine stagione torna al proprietario.
    expect(arrivato.loan?.ownerClubId).toBe(prestabile.clubId);
    // Costa meno del cartellino: è un aiuto immediato, non un patrimonio.
    expect(prestabile.loanFee).toBeLessThan(prestabile.price);
  });

  it("chi non è in lista prestito non si può chiedere in prestito", () => {
    const { state, world } = conMercatoAperto("prestito-no");
    const nonPrestabile = searchMarket(state, world, {}).find((r) => !r.loanable);
    if (!nonPrestabile) return;
    const { result } = applyMarket(state, world, {
      kind: "chiedi_prestito",
      target: nonPrestabile,
    });
    expect(result.rejected).toBe(true);
  });
});

describe("il faccia a faccia dentro il mercato (scheda Chat)", () => {
  it("offerPushProbability cresce con il prestigio del club, la panchina e il malcontento", () => {
    const { state, world } = fullCareer("prob-offerta");
    const entry = state.roster[0]!;
    const offerBase = {
      playerId: entry.playerId,
      playerName: "X",
      fromClubId: "clubTest",
      fromClubName: "Club Test",
      fee: 1_000_000,
      appetite: 0.5,
    };
    const mondoConPrestigio = (tier: number) => ({
      ...world,
      market: {
        ...world.market!,
        valuation: { ...world.market!.valuation, clubPrestige: { ...world.market!.valuation.clubPrestige, clubTest: tier } },
      },
    });

    const bassoPrestigio = offerPushProbability(state, mondoConPrestigio(1), entry, offerBase);
    const altoPrestigio = offerPushProbability(state, mondoConPrestigio(5), entry, offerBase);
    expect(altoPrestigio).toBeGreaterThan(bassoPrestigio);

    const titolare = { ...entry, stats: { ...entry.stats, minutes: 2700 } };
    const riserva = { ...entry, stats: { ...entry.stats, minutes: 0 } };
    const provaTitolare = offerPushProbability({ ...state, league: { round: 30, tallies: [] } }, mondoConPrestigio(3), titolare, offerBase);
    const provaRiserva = offerPushProbability({ ...state, league: { round: 30, tallies: [] } }, mondoConPrestigio(3), riserva, offerBase);
    expect(provaRiserva).toBeGreaterThan(provaTitolare);

    const sereno = { ...entry, morale: 90 };
    const scontento = { ...entry, morale: 20 };
    expect(offerPushProbability(state, mondoConPrestigio(3), scontento, offerBase)).toBeGreaterThan(
      offerPushProbability(state, mondoConPrestigio(3), sereno, offerBase),
    );

    // Non supera mai il tetto dichiarato.
    const tuttoAlMassimo = offerPushProbability(
      { ...state, league: { round: 30, tallies: [] } },
      mondoConPrestigio(5),
      { ...riserva, morale: 10 },
      offerBase,
    );
    expect(tuttoAlMassimo).toBeLessThanOrEqual(0.9);
  });

  /**
   * Segnalazione dell'utente: riceveva richieste di cessione da giocatori appena acquistati e
   * titolari fissi — poco realistico. Il blocco vale **solo per la stagione dell'arrivo**: dalla
   * stagione successiva il giocatore torna corteggiabile come chiunque altro.
   */
  it("offerPushProbability è zero per un titolare sereno preso quest'anno, torna normale l'anno dopo", () => {
    const { state, world } = fullCareer("prob-offerta-nuovo", 80);
    const entry = state.roster[0]!;
    const offerBase = {
      playerId: entry.playerId, playerName: "X", fromClubId: "clubTest", fromClubName: "Club Test",
      fee: 1_000_000, appetite: 0.5,
    };
    const mondoTop = {
      ...world,
      market: {
        ...world.market!,
        valuation: { ...world.market!.valuation, clubPrestige: { ...world.market!.valuation.clubPrestige, clubTest: 5 } },
      },
    };

    const conStato = { ...state, league: { round: 30, tallies: [] } };
    const presoOraTitolareSereno = {
      ...entry,
      sinceSeason: conStato.season,
      morale: 80,
      stats: { ...entry.stats, minutes: 2700 }, // 30 giornate × 90, titolare fisso
    };
    expect(offerPushProbability(conStato, mondoTop, presoOraTitolareSereno, offerBase)).toBe(0);

    // La stagione successiva: stesso profilo, ma arrivato l'anno prima → torna al comportamento normale.
    const conStatoAnnoDopo = { ...conStato, season: conStato.season + 1 };
    const stessoProfiloAnnoDopo = { ...presoOraTitolareSereno, sinceSeason: conStato.season };
    expect(offerPushProbability(conStatoAnnoDopo, mondoTop, stessoProfiloAnnoDopo, offerBase)).toBeGreaterThan(0);
  });

  it("findTransferRequest a sorpresa non pesca mai un titolare sereno preso quest'anno", () => {
    const { state } = fullCareer("sorpresa-nuovo-acquisto", 80);
    const titolare = createRosterEntry({
      playerId: "nuovo-acquisto", overall: 92, potential: 92, sinceSeason: state.season, morale: 85,
    });
    const roster = [{ ...titolare, stats: { ...titolare.stats, minutes: 2700 } }, ...state.roster.slice(0, 3)];

    for (let tentativo = 0; tentativo < 200; tentativo++) {
      const random = mulberry32(tentativo + 1);
      const request = findTransferRequest(
        roster,
        { matchday: 30, hasOpenRequest: false, random, currentSeason: state.season },
        () => ({ squadAverage: 80, availableMinutes: 2700, played: false, scored: false }),
      );
      expect(request?.playerId).not.toBe("nuovo-acquisto");
    }
  });

  /**
   * Titolarità garantita legata alla rottura: solo una rottura vera la toglie, non un
   * malumore risolto bene.
   */
  it("una standoff che si rompe toglie la titolarità garantita del giocatore", () => {
    const { state, world } = fullCareer("rottura-titolarita", 80);
    const playerId = state.roster[0]!.playerId;
    const conGaranzia = { ...state, roster: state.roster.map((e) => (e.playerId === playerId ? { ...e, morale: 40 } : e)), guaranteedStarters: { DC: playerId } };
    let s = openPlayerStandoff(conGaranzia, world, playerId)!;
    let corrente = conGaranzia;
    for (let i = 0; i < 6 && s.status === "aperta"; i++) {
      const esito = applyPlayerStandoff(corrente, world, s, { kind: "ignora" });
      corrente = esito.state;
      s = esito.standoff;
    }
    expect(s.status).toBe("rotta");
    expect(corrente.guaranteedStarters?.DC).toBeUndefined();
  });

  it("una standoff che si placa NON tocca la titolarità garantita", () => {
    const { state, world } = fullCareer("standoff-placata-titolarita", 80);
    const playerId = state.roster[0]!.playerId;
    const conGaranzia = { ...state, roster: state.roster.map((e) => (e.playerId === playerId ? { ...e, morale: 40 } : e)), guaranteedStarters: { DC: playerId } };
    let s = openPlayerStandoff(conGaranzia, world, playerId)!;
    let corrente = conGaranzia;
    for (let i = 0; i < 6 && s.status === "aperta"; i++) {
      const esito = applyPlayerStandoff(corrente, world, s, { kind: "prometti_spazio" });
      corrente = esito.state;
      s = esito.standoff;
    }
    expect(s.status).toBe("placata");
    expect(corrente.guaranteedStarters?.DC).toBe(playerId);
  });

  describe("setGuaranteedStarter — un solo ruolo a testa, reset a cambio mister", () => {
    it("garantire lo stesso giocatore per un nuovo ruolo sposta la garanzia, non la duplica", () => {
      const { state } = fullCareer("un-solo-ruolo", 80);
      const playerId = state.roster[0]!.playerId;
      const conDC = setGuaranteedStarter(state, "DC", playerId);
      expect(conDC.guaranteedStarters).toEqual({ DC: playerId });

      const conMED = setGuaranteedStarter(conDC, "MED", playerId);
      expect(conMED.guaranteedStarters).toEqual({ MED: playerId });
      expect(conMED.guaranteedStarters?.DC).toBeUndefined();
    });

    it("garantire un giocatore diverso per lo stesso ruolo sostituisce, come già prima", () => {
      const { state } = fullCareer("sostituzione-stesso-ruolo", 80);
      const primo = state.roster[0]!.playerId;
      const secondo = state.roster[1]!.playerId;
      const conPrimo = setGuaranteedStarter(state, "DC", primo);
      const conSecondo = setGuaranteedStarter(conPrimo, "DC", secondo);
      expect(conSecondo.guaranteedStarters).toEqual({ DC: secondo });
    });

    it("garanzie su ruoli diversi per giocatori diversi convivono senza interferire", () => {
      const { state } = fullCareer("garanzie-multiple", 80);
      const a = state.roster[0]!.playerId;
      const b = state.roster[1]!.playerId;
      const conEntrambi = setGuaranteedStarter(setGuaranteedStarter(state, "DC", a), "MED", b);
      expect(conEntrambi.guaranteedStarters).toEqual({ DC: a, MED: b });
    });

    it("cambiare mister azzera le titolarità garantite; riconfermare lo stesso mister no", () => {
      const { state, world } = fullCareer("reset-cambio-mister", 80);
      const playerId = state.roster[0]!.playerId;
      const conGaranzia = setGuaranteedStarter(state, "DC", playerId);
      expect(conGaranzia.guaranteedStarters?.DC).toBe(playerId);

      // Riconferma dello stesso mister: hireCoach esce subito senza toccare lo stato.
      const stessoCoach = hireCoach(conGaranzia, world, conGaranzia.coachId!);
      expect(stessoCoach.state.guaranteedStarters?.DC).toBe(playerId);

      // Cambio vero di mister: le garanzie si azzerano.
      const scelte = coachChoices(conGaranzia, world);
      const altro = scelte.find((c) => c.coachId !== conGaranzia.coachId && !c.blocked);
      expect(altro, "serve almeno un altro mister ingaggiabile per il test").toBeDefined();
      const cambiato = hireCoach({ ...conGaranzia, budget: 999_000_000 }, world, altro!.coachId);
      expect(cambiato.rejected).toBeFalsy();
      expect(cambiato.state.guaranteedStarters).toEqual({});
    });

    it("cambiare mister azzera anche la panchina forzata dal bivio giocatore-mister", () => {
      const { state, world } = fullCareer("reset-coach-benched", 80);
      const playerId = state.roster[0]!.playerId;
      const conPanchina = { ...state, coachBenched: { [playerId]: true as const } };

      const scelte = coachChoices(conPanchina, world);
      const altro = scelte.find((c) => c.coachId !== conPanchina.coachId && !c.blocked);
      expect(altro, "serve almeno un altro mister ingaggiabile per il test").toBeDefined();
      const cambiato = hireCoach({ ...conPanchina, budget: 999_000_000 }, world, altro!.coachId);
      expect(cambiato.state.coachBenched).toEqual({});
    });
  });

  describe("bivio giocatore-mister — findTransferRequest lo apre solo nel caso più estremo", () => {
    it("un titolare garantito scontento con sintonia col mister ai minimi apre 'bivio_mister'", () => {
      const { state } = fullCareer("bivio-mister-trigger", 80);
      const scontento = state.roster[0]!.playerId;
      const roster = state.roster.map((e) => (e.playerId === scontento ? { ...e, morale: 20 } : e));
      const request = findTransferRequest(
        roster,
        {
          matchday: 10,
          hasOpenRequest: false,
          currentSeason: state.season,
          guaranteedStarterIds: new Set([scontento]),
          coachHarmony: 20,
        },
        () => ({ squadAverage: 80, availableMinutes: 900, played: false, scored: false }),
      );
      expect(request?.playerId).toBe(scontento);
      expect(request?.reason).toBe("bivio_mister");
    });

    it("senza titolarità garantita, lo stesso scontento resta una richiesta normale", () => {
      const { state } = fullCareer("bivio-mister-no-garanzia", 80);
      const scontento = state.roster[0]!.playerId;
      const roster = state.roster.map((e) => (e.playerId === scontento ? { ...e, morale: 20 } : e));
      const request = findTransferRequest(
        roster,
        { matchday: 10, hasOpenRequest: false, currentSeason: state.season, coachHarmony: 20 },
        () => ({ squadAverage: 80, availableMinutes: 900, played: false, scored: false }),
      );
      expect(request?.playerId).toBe(scontento);
      expect(request?.reason).not.toBe("bivio_mister");
    });

    it("con la sintonia col mister ancora buona, un titolare garantito scontento NON arriva al bivio", () => {
      const { state } = fullCareer("bivio-mister-sintonia-buona", 80);
      const scontento = state.roster[0]!.playerId;
      const roster = state.roster.map((e) => (e.playerId === scontento ? { ...e, morale: 20 } : e));
      const request = findTransferRequest(
        roster,
        {
          matchday: 10,
          hasOpenRequest: false,
          currentSeason: state.season,
          guaranteedStarterIds: new Set([scontento]),
          coachHarmony: 80,
        },
        () => ({ squadAverage: 80, availableMinutes: 900, played: false, scored: false }),
      );
      expect(request?.reason).not.toBe("bivio_mister");
    });
  });

  describe("bivio giocatore-mister — effetti su coachId e currentLineup", () => {
    it("'scegli_giocatore' fa dimettere il mister: coachId torna null", () => {
      const { state, world } = fullCareer("bivio-dimissioni", 80);
      const entry = state.roster[0]!;
      const s = openStandoff(entry, "Il Bivio", "bivio_mister");
      const { state: dopo } = applyPlayerStandoff(state, world, s, { kind: "scegli_giocatore" });
      expect(dopo.coachId).toBeNull();
    });

    it("ignorare il bivio fino alla rottura esclude il giocatore da currentLineup per sempre", () => {
      const { state, world } = fullCareer("bivio-panchina-lineup", 80);
      const playerId = state.roster[0]!.playerId;
      const entry = state.roster[0]!;
      let s = openStandoff(entry, "Il Bivio", "bivio_mister");
      let corrente = state;
      for (let i = 0; i < 8 && s.status === "aperta"; i++) {
        const esito = applyPlayerStandoff(corrente, world, s, { kind: "ignora" });
        corrente = esito.state;
        s = esito.standoff;
      }
      expect(s.status).toBe("rotta");
      expect(corrente.coachBenched?.[playerId]).toBe(true);

      const lineup = currentLineup(corrente, world);
      const inCampo = Object.values(lineup.starters).includes(playerId) || lineup.bench.includes(playerId);
      expect(inCampo).toBe(false);
    });
  });

  it("standoffCandidates elenca gli scontenti anche senza offerta", () => {
    const { state, world } = fullCareer("standoff-elenco");
    const aperto = advanceWeek(state, world).state;
    const scontento = aperto.roster[0]!.playerId;
    const conScontento = {
      ...aperto,
      roster: aperto.roster.map((e) => (e.playerId === scontento ? { ...e, morale: 20 } : e)),
    };
    const elenco = standoffCandidates(conScontento, world);
    expect(elenco.some((c) => c.playerId === scontento)).toBe(true);
  });

  /**
   * Bug segnalato dall'utente: un regen nostro (nato in carriera, non nel database) appariva
   * come "Giocatore" nelle conversazioni/richieste/tabellino. `standoffCandidates`,
   * `openPlayerStandoff` e il resolver di `PendingRequest` leggevano `world.players`
   * direttamente, che non copre `state.generated` — corretto usando `careerPlayers`
   * internamente, quindi il nome è giusto anche passando il `world` **grezzo** (non premerso
   * dalla UI).
   */
  it("un regen scontento è riconoscibile per nome vero, non 'Giocatore'", () => {
    let { state, world } = newCareer("regen-standoff", 80);
    for (let s = 0; s < 3 && state.phase !== "conclusa" && state.generated.length === 0; s++) {
      state = playSeason(state, world);
    }
    expect(state.generated.length).toBeGreaterThan(0);
    const regen = state.generated[0]!;

    // Se il regen non è (più) in rosa, forziamo comunque un entry per lui: quel che conta qui
    // è la risoluzione del nome, non la logistica del ciclo di vita.
    const inRosa = state.roster.some((e) => e.playerId === regen.id);
    const conRegenScontento = {
      ...state,
      roster: inRosa
        ? state.roster.map((e) => (e.playerId === regen.id ? { ...e, morale: 20 } : e))
        : [...state.roster, createRosterEntry({ playerId: regen.id, overall: 70, potential: 75, sinceSeason: state.season })].map(
            (e) => (e.playerId === regen.id ? { ...e, morale: 20 } : e),
          ),
    };

    const elenco = standoffCandidates(conRegenScontento, world);
    const voce = elenco.find((c) => c.playerId === regen.id);
    expect(voce).toBeDefined();
    expect(voce!.name).toBe(regen.name);
    expect(voce!.name).not.toBe("Giocatore");

    const standoff = openPlayerStandoff(conRegenScontento, world, regen.id);
    expect(standoff).not.toBeNull();
    expect(standoff!.playerName).toBe(regen.name);
  });

  /**
   * Segnalazione dell'utente: "Giocatore" ancora nelle **offerte di prestito** nelle stagioni
   * successive alla prima. Verificato di persona che il punto di fusione principale
   * (`DsMode.tsx`, `careerPlayers` applicato a `world.players`) e `buildMarketWorld` (anagrafica
   * del mercato) sono già corretti — qui si verifica il lato **consumo** (`buildLoanOffers`/
   * `buildOffers` dentro `openMarketWindow`): dato un `MarketWorld` la cui anagrafica include
   * correttamente un regen (esattamente come la produce `buildMarketWorld` in produzione), le
   * proposte di prestito e le offerte in entrata devono risolvere il suo nome vero, mai il
   * fallback "Giocatore".
   */
  it("un regen in lista prestiti/trasferimenti, in una stagione avanzata, ha il nome vero nelle offerte", () => {
    let { state, world } = fullCareer("prestiti-nome-vero", 80);
    for (let s = 0; s < 3 && state.phase !== "conclusa" && state.generated.length === 0; s++) {
      state = playSeason(state, world);
    }
    expect(state.generated.length).toBeGreaterThan(0);
    // Dal 2026-08-06 il regen nasce in un club sorteggiato, non più garantito il nostro: qui
    // conta solo la risoluzione del nome, quindi forziamo un entry in rosa per lui invece di
    // sperare che il sorteggio l'abbia messo da noi entro la terza stagione.
    const regen = state.generated[0]!;
    if (!state.roster.some((e) => e.playerId === regen.id)) {
      state = {
        ...state,
        roster: [
          ...state.roster,
          createRosterEntry({ playerId: regen.id, overall: 74, potential: 78, sinceSeason: state.season }),
        ],
      };
    }

    // Anagrafica di mercato "fresca", fusa con `state.generated` esattamente come fa
    // `buildMarketWorld` in produzione (ricostruita a ogni stagione, non congelata alla prima).
    const marketWorld = {
      ...world.market!,
      players: { ...world.market!.players, ...Object.fromEntries(state.generated.map((p) => [p.id, {
        id: p.id, name: p.name, nation: p.nation, role: p.role, secondaryRoles: p.secondaryRoles,
      }])) },
      nameOf: (id: string) =>
        state.generated.find((p) => p.id === id)?.name ?? world.market!.nameOf(id),
    };

    const snapshot = openMarketWindow(
      state.roster,
      marketWorld,
      state.clubId,
      state.leagueId,
      state.budget,
      "estiva",
      state.seed,
      state.season,
      { transferList: [regen!.id], loanList: [regen!.id] },
    );

    const offertaTrasferimento = snapshot.offers.find((o) => o.playerId === regen!.id);
    const offertaPrestito = snapshot.loanOffers.find((o) => o.playerId === regen!.id);
    if (offertaTrasferimento) expect(offertaTrasferimento.playerName).toBe(regen!.name);
    if (offertaPrestito) expect(offertaPrestito.playerName).toBe(regen!.name);
    // Almeno una delle due deve essersi generata, altrimenti il test non verifica nulla.
    expect(offertaTrasferimento || offertaPrestito).toBeDefined();
    expect((offertaTrasferimento ?? offertaPrestito)!.playerName).not.toBe("Giocatore");
  });

  /**
   * "Non tutte le offerte devono generare una chat, non tutti i giocatori vogliono andare
   * via" — richiesta esplicita dell'utente. Forziamo le condizioni che alzano la probabilità
   * al massimo (top club, gioca pochissimo, già scontento) e proviamo su più finestre finché
   * non uscirà almeno un giocatore che spinge davvero: con probabilità 0.9 a tentativo,
   * fallire su 20 prove è statisticamente trascurabile.
   */
  /** Il prestigio del club offerente vive in `world.market.valuation`, non in `state.market`. */
  function mondoConPrestigioClub(world: CareerWorld, clubId: string, tier: number): CareerWorld {
    return {
      ...world,
      market: {
        ...world.market!,
        valuation: { ...world.market!.valuation, clubPrestige: { ...world.market!.valuation.clubPrestige, [clubId]: tier } },
      },
    };
  }

  function conOffertaForzata(seed: string) {
    const { state, world } = fullCareer(seed);
    const aperto = advanceWeek(state, world).state;
    const offerta = aperto.market?.offers[0];
    if (!offerta) return null;
    const forzato = {
      ...aperto,
      roster: aperto.roster.map((e) =>
        e.playerId === offerta.playerId
          ? { ...e, morale: 30, stats: { ...e.stats, minutes: 0 } }
          : e,
      ),
    };
    return { state: forzato, world: mondoConPrestigioClub(world, offerta.fromClubId, 5), offerta };
  }

  function trovaCasoConSpinta() {
    for (let i = 0; i < 20; i++) {
      const caso = conOffertaForzata(`standoff-forza-${i}`);
      if (!caso) continue;
      const provato = { ...caso.state, week: caso.state.week + i };
      const s = openPlayerStandoff(provato, caso.world, caso.offerta.playerId)!;
      if (s.offerFromClubId) return { ...caso, state: provato, s };
    }
    return null;
  }

  it("apre con il motivo giusto quando l'offerta è ciò che lo spinge a parlare", () => {
    const caso = trovaCasoConSpinta();
    expect(caso, "nessun caso su 20 tentativi ha spinto per l'offerta").not.toBeNull();
    expect(caso!.s.reason).toBe("richiamato");
    expect(caso!.s.offerFromClubId).toBe(caso!.offerta.fromClubId);
    // E compare nell'elenco della scheda Chat con l'offerta segnalata.
    const elenco = standoffCandidates(caso!.state, caso!.world);
    expect(elenco.find((c) => c.playerId === caso!.offerta.playerId)?.hasOffer).toBe(true);
  });

  it("accettare la cessione dal faccia a faccia esegue davvero la vendita", () => {
    const caso = trovaCasoConSpinta();
    expect(caso, "nessun caso su 20 tentativi ha spinto per l'offerta").not.toBeNull();
    const { state: aperto, world, offerta, s } = caso!;
    const { state: dopo } = applyPlayerStandoff(aperto, world, s, { kind: "accetta_cessione" });
    expect(dopo.roster.some((e) => e.playerId === offerta.playerId)).toBe(false);
    expect(dopo.budget).toBe(aperto.budget + offerta.fee);
    expect(dopo.sessionDeals?.some((d) => d.playerId === offerta.playerId)).toBe(true);
  });

  it("un giocatore titolare e sereno, con un club modesto, spinge molto più raramente di uno scontento cercato da un top club", () => {
    // Statistico, non un singolo tentativo: la base è 10%, non zero, quindi un solo tiro
    // potrebbe uscire "vero" per puro caso e rendere il test inutilmente instabile.
    const { state, world } = fullCareer("standoff-quieto");
    const aperto = advanceWeek(state, world).state;
    const offerta = aperto.market?.offers[0];
    if (!offerta) return;

    const mondoModesto = mondoConPrestigioClub(world, offerta.fromClubId, 1);
    const mondoTop = mondoConPrestigioClub(world, offerta.fromClubId, 5);

    let spinteQuieto = 0;
    let spinteForzato = 0;
    const TENTATIVI = 40;
    for (let i = 0; i < TENTATIVI; i++) {
      const quieto = {
        ...aperto,
        week: aperto.week + i,
        league: { round: 30, tallies: aperto.league.tallies },
        roster: aperto.roster.map((e) =>
          e.playerId === offerta.playerId
            ? { ...e, morale: 75, stats: { ...e.stats, minutes: 2700 } }
            : e,
        ),
      };
      if (standoffCandidates(quieto, mondoModesto).find((c) => c.playerId === offerta.playerId)?.hasOffer) {
        spinteQuieto++;
      }

      const forzato = {
        ...aperto,
        week: aperto.week + i,
        roster: aperto.roster.map((e) =>
          e.playerId === offerta.playerId
            ? { ...e, morale: 30, stats: { ...e.stats, minutes: 0 } }
            : e,
        ),
      };
      if (standoffCandidates(forzato, mondoTop).find((c) => c.playerId === offerta.playerId)?.hasOffer) {
        spinteForzato++;
      }
    }

    expect(spinteForzato).toBeGreaterThan(spinteQuieto);
    expect(spinteQuieto / TENTATIVI).toBeLessThan(0.3);
  });

  it("ignorare ripetutamente nel faccia a faccia fa crollare il morale, non solo simbolicamente", () => {
    const { state, world } = newCareer("standoff-ignora", 78);
    const aperto = { ...state, roster: state.roster.map((e) => ({ ...e, morale: 40 })) };
    const playerId = aperto.roster[0]!.playerId;
    let s = openPlayerStandoff(aperto, world, playerId)!;
    let corrente = aperto;
    for (let i = 0; i < 6 && s.status === "aperta"; i++) {
      const esito = applyPlayerStandoff(corrente, world, s, { kind: "ignora" });
      corrente = esito.state;
      s = esito.standoff;
    }
    expect(s.status).toBe("rotta");
    const entry = corrente.roster.find((e) => e.playerId === playerId)!;
    // Parte da 40: la rottura vale almeno -18, un tonfo vero e non simbolico.
    expect(entry.morale).toBeLessThanOrEqual(22);
  });
});

describe("il mister rinnova il rapporto a ogni stagione", () => {
  it("accettare le nuove richieste le rende vincolanti e dà un piccolo credito di sintonia", () => {
    const { state, world } = fullCareer("rinnovo-ok");
    const promesse = [
      {
        id: "p1",
        kind: "budget_discipline" as const,
        description: "Test",
        seasonAccepted: state.season,
      },
    ];
    const dopo = confirmCoachSeasonPromises(state, world, promesse);
    expect(dopo.coachPromises).toEqual(promesse);
    expect(dopo.seasonNegotiationDone).toBe(true);
    expect(dopo.coachHarmony ?? 75).toBeGreaterThan(state.coachHarmony ?? 75);
  });

  /**
   * Bug segnalato dall'utente: durante il mercato aperto il pallino della promessa restava
   * fermo allo stato con cui era stata accettata, aggiornandosi solo alla chiusura finestra.
   * `livePromiseStatus` deve rispecchiare la rosa **corrente**, non l'ultima verifica salvata.
   */
  it("livePromiseStatus si aggiorna subito quando la rosa cambia, senza aspettare la chiusura del mercato", () => {
    const { state, world } = fullCareer("promessa-live", 78);
    const promessa = {
      id: "p-live",
      kind: "top_player" as const,
      description: "Un titolare da 85+",
      targetValue: 85,
      seasonAccepted: state.season,
    };
    const conPromessa = { ...state, coachPromises: [promessa] };

    // Nessuno in rosa arriva a 85: la promessa non è (ancora) soddisfatta.
    expect(conPromessa.roster.every((e) => e.overall < 85)).toBe(true);
    const primaStatus = livePromiseStatus(conPromessa, world);
    expect(primaStatus).toHaveLength(1);
    expect(primaStatus[0]!.liveFulfilled).toBe(false);
    // E lo stato salvato (`fulfilled`) non è stato toccato: è di sola lettura.
    expect(primaStatus[0]!.fulfilled).toBeUndefined();

    // Un giocatore arriva a 90: la promessa risulta soddisfatta **subito**, senza chiudere
    // la finestra né richiamare `verifyCoachPromises`.
    const conFuoriclasse = {
      ...conPromessa,
      roster: [
        ...conPromessa.roster,
        createRosterEntry({ playerId: "fuoriclasse", overall: 90, potential: 90, sinceSeason: state.season }),
      ],
    };
    const dopoStatus = livePromiseStatus(conFuoriclasse, world);
    expect(dopoStatus[0]!.liveFulfilled).toBe(true);
  });

  /**
   * Richiesta esplicita dell'utente: l'alternativa a una promessa del mister va scelta
   * dall'utente (dal database, via ricerca), non auto-selezionata — e dev'essere proponibile
   * **a mercato aperto**, non solo alla prossima negoziazione stagionale.
   */
  it("proposePromiseAlternative sostituisce il bersaglio nominato con quello scelto dall'utente", () => {
    const { state, world } = fullCareer("alternativa-promessa", 78);
    const promessa = {
      id: "p-alt",
      kind: "formation_fit" as const,
      description: "Prendi un terzino destro",
      targetRole: "TD" as const,
      targetValue: 78,
      seasonAccepted: state.season,
    };
    const conPromessa = { ...state, coachPromises: [promessa] };

    const candidatoScelto = {
      playerId: "candidato-vero",
      playerName: "Mario Rossi",
      overall: 79,
      role: "TD" as const,
    };
    const esito = proposePromiseAlternative(conPromessa, "p-alt", candidatoScelto);
    expect(esito.accepted).toBe(true);
    expect(esito.message.length).toBeGreaterThan(0);

    const aggiornata = esito.state.coachPromises!.find((p) => p.id === "p-alt")!;
    expect(aggiornata.targetPlayerId).toBe("candidato-vero");
    expect(aggiornata.targetPlayerName).toBe("Mario Rossi");

    // Il resto dello stato (rosa, budget) non è toccato: qui si negozia solo la promessa.
    expect(esito.state.roster).toBe(conPromessa.roster);
    expect(esito.state.budget).toBe(conPromessa.budget);
  });

  it("livePromiseStatus non rompe nulla senza promesse in sospeso", () => {
    const { state, world } = fullCareer("promessa-live-vuota", 78);
    expect(livePromiseStatus({ ...state, coachPromises: [] }, world)).toEqual([]);
    expect(livePromiseStatus({ ...state, coachPromises: undefined }, world)).toEqual([]);
  });

  it("saltare il meeting costa sintonia col mister", () => {
    const { state, world } = fullCareer("rinnovo-salta");
    const dopo = declineCoachSeasonMeeting(state, world);
    expect(dopo.seasonNegotiationDone).toBe(true);
    expect(dopo.coachHarmony ?? 75).toBeLessThan(state.coachHarmony ?? 75);
  });

  it("con sintonia alta il mister non viene mai corteggiato via", () => {
    const { state, world } = fullCareer("poach-mai", 88);
    let corrente = { ...state, coachHarmony: 90 };
    for (let s = 0; s < 30; s++) {
      corrente = { ...declineCoachSeasonMeeting({ ...corrente, season: s, coachHarmony: 90 }, world), coachHarmony: 90 };
      expect(corrente.coachId).not.toBeNull();
    }
  });

  it("con sintonia sotto soglia, su molte stagioni il mister viene corteggiato via da un club più prestigioso", () => {
    const { state, world: baseWorld } = fullCareer("poach-succede", 78);
    // Il mondo di prova ha tutti i club (noi compresi) a prestigio 4: senza un pretendente più
    // blasonato di noi il corteggiamento non può mai scattare, per costruzione.
    const world: CareerWorld = {
      ...baseWorld,
      market: baseWorld.market && {
        ...baseWorld.market,
        valuation: {
          ...baseWorld.market.valuation,
          clubPrestige: { ...baseWorld.market.valuation.clubPrestige, "euro-1": 5 },
        },
      },
    };
    let successi = 0;
    for (let s = 1; s < 60; s++) {
      const basso = { ...state, season: s, coachHarmony: 10 };
      const dopo = declineCoachSeasonMeeting(basso, world);
      if (dopo.coachId === null) {
        successi++;
        expect(dopo.coachDeparture).toBeDefined();
        expect(dopo.aiCoaches?.[Object.keys(dopo.aiCoaches!).find((id) => dopo.aiCoaches![id]!.coachId === state.coachId) ?? ""]).toBeDefined();
      }
    }
    expect(successi).toBeGreaterThan(0);
  });

  it("una nuova stagione riapre la necessità del meeting (seasonNegotiationDone torna false)", () => {
    const { state, world } = fullCareer("rinnovo-stagione", 88);
    const dopo = playSeason(state, world);
    if (dopo.phase === "conclusa") return;
    expect(dopo.seasonNegotiationDone).toBe(false);
  });
});

describe("regole della trattativa dentro la carriera", () => {
  function conMercato(seed = "tratt") {
    const { state, world } = fullCareer(seed);
    return { state: advanceWeek(state, world).state, world };
  }

  /**
   * "I soldi non sono garanzia di acquisto, i top club non vendono facilmente i loro top
   * player" — richiesta esplicita dell'utente. Un club di prestigio basso vende il suo
   * migliore al prezzo pieno; un club di prestigio alto o alza l'asta ben oltre il valore, o
   * rifiuta subito senza margine di trattativa.
   */
  it("un top club resiste a vendere il suo gioiello: prezzo gonfiato o rifiuto secco", () => {
    const { state, world } = conMercato("gioiello");
    const clubId = Object.keys(world.market!.clubs)[1]!; // non il nostro (index 0)
    const bersaglio = {
      playerId: "gioiello-1",
      name: "Fenomeno",
      clubId,
      clubName: world.market!.clubs[clubId]!.name,
      overall: 90,
      age: 25,
      role: "CC" as const,
      secondaryRoles: [],
      department: "CC" as const,
      price: 40_000_000,
      loanable: false,
      loanFee: 0,
    };

    // Prestigio alto: il club resiste.
    const worldAlto = {
      ...world,
      market: {
        ...world.market!,
        valuation: { ...world.market!.valuation, clubPrestige: { ...world.market!.valuation.clubPrestige, [clubId]: 5 } },
      },
    };
    const dopoAlto = negotiatePurchase(state, worldAlto, bersaglio);
    if (dopoAlto.negotiation!.status === "arenata") {
      expect(dopoAlto.negotiation!.ending).toBe("rottura");
    } else {
      expect(dopoAlto.negotiation!.amount).toBeGreaterThan(bersaglio.price * 2);
    }

    // Prestigio basso: si tratta come chiunque altro, al prezzo pieno.
    const worldBasso = {
      ...world,
      market: {
        ...world.market!,
        valuation: { ...world.market!.valuation, clubPrestige: { ...world.market!.valuation.clubPrestige, [clubId]: 1 } },
      },
    };
    const dopoBasso = negotiatePurchase(state, worldBasso, bersaglio);
    expect(dopoBasso.negotiation!.amount).toBe(bersaglio.price);
    expect(dopoBasso.negotiation!.status).toBe("aperta");
  });

  it("il tetto nascosto di una trattativa varia leggermente da una stagione all'altra", () => {
    const { state, world } = conMercato("noise-tetto");
    const offerta = state.market!.offers[0];
    if (!offerta) return;
    const s1 = negotiateOffer(state, offerta.playerId).negotiation!.ceiling;
    const s2 = negotiateOffer({ ...state, season: state.season + 3 }, offerta.playerId).negotiation!.ceiling;
    expect(s1).not.toBe(s2);
  });

  it("una trattativa saltata non si può riaprire nella stessa finestra", () => {
    /**
     * Senza questo blocco bastava riaprire e ritentare finché non usciva il risultato voluto:
     * la pazienza dell'interlocutore, che è la risorsa su cui si regge tutta la meccanica, non
     * sarebbe costata nulla.
     */
    const { state, world } = conMercato("blocco");
    const offerta = state.market!.offers[0];
    if (!offerta) return;

    let corrente = negotiateOffer(state, offerta.playerId);
    expect(corrente.negotiation).toBeDefined();
    // Si abbandona: la trattativa salta.
    corrente = playNegotiation(corrente, world, { kind: "abbandona" }).state;
    expect(corrente.negotiation!.status).toBe("arenata");
    expect(isNegotiationBlocked(corrente, offerta.playerId)).toBe(true);

    // Riaprirla non fa nulla.
    const chiusa = closeNegotiation(corrente);
    expect(negotiateOffer(chiusa, offerta.playerId).negotiation).toBeNull();
  });

  it("il blocco vale per la finestra, non per sempre", () => {
    const { state, world } = conMercato("blocco-finestra");
    const offerta = state.market!.offers[0];
    if (!offerta) return;
    let corrente = playNegotiation(
      negotiateOffer(state, offerta.playerId),
      world,
      { kind: "abbandona" },
    ).state;
    corrente = closeNegotiation(corrente);
    // Chiudendo il mercato e arrivando alla finestra successiva la lista si azzera.
    corrente = advanceWeek(corrente, world, { closeMarket: true }).state;
    for (let i = 0; i < 60 && !corrente.market; i++) {
      corrente = advanceWeek(corrente, world, { requestResponse: "prometti" }).state;
    }
    if (corrente.market) expect(corrente.negotiationBlocked ?? []).toHaveLength(0);
  });

  it("chiudere una trattativa in chat entra nel recap di fine mercato (sessionDeals)", () => {
    /**
     * Bug segnalato dall'utente: il recap del meeting mostrava dati parziali. Causa principale
     * — `playNegotiation` non scriveva mai su `sessionDeals`, quindi ogni cessione/acquisto
     * chiuso in chat (il flusso centrale del mercato, sez. 3.7.5) era invisibile nel recap.
     */
    const { state, world } = conMercato("recap-cessione");
    const offerta = state.market!.offers[0];
    if (!offerta) return;
    const { state: chiusa, message } = playNegotiation(
      negotiateOffer(state, offerta.playerId),
      world,
      { kind: "accetta" },
    );
    expect(message).toContain(offerta.playerName);
    const deal = (chiusa.sessionDeals ?? []).find((d) => d.playerId === offerta.playerId);
    expect(deal, "la cessione chiusa in chat non è finita in sessionDeals").toBeDefined();
    expect(deal!.kind).toBe("cessione");
  });

  it("l'azione controproposta entra nel recap di fine mercato", () => {
    const { state, world } = conMercato("recap-controp");
    const offerta = state.market!.offers[0];
    if (!offerta) return;
    const { state: dopo, result } = applyMarket(state, world, {
      kind: "controproposta",
      playerId: offerta.playerId,
      fee: offerta.fee,
    });
    if (result.rejected) return; // può rifiutare: non è quello che si sta verificando qui
    const deal = (dopo.sessionDeals ?? []).find((d) => d.playerId === offerta.playerId);
    expect(deal, "la controproposta accettata non è finita in sessionDeals").toBeDefined();
    expect(deal!.kind).toBe("cessione");
  });

  it("la finestra di riparazione riparte con un recap vuoto, non con quello dell'estate", () => {
    const { state, world } = conMercato("recap-riparazione");
    const offerta = state.market!.offers[0];
    if (!offerta) return;
    const { state: dopoVendita } = applyMarket(state, world, {
      kind: "accetta_offerta",
      playerId: offerta.playerId,
    });
    expect(dopoVendita.sessionDeals?.length).toBeGreaterThan(0);

    // Chiude l'estiva e corre fino alla finestra di riparazione.
    let corrente = advanceWeek(dopoVendita, world, { closeMarket: true }).state;
    for (let i = 0; i < 60 && !corrente.market && corrente.phase !== "conclusa"; i++) {
      corrente = advanceWeek(corrente, world, { requestResponse: "prometti" }).state;
    }
    if (!corrente.market) return; // il mondo di prova potrebbe non aprirla: non è questo il test
    expect(corrente.sessionDeals ?? []).toHaveLength(0);
  });

  it("se te lo soffiano, il giocatore cambia davvero squadra", () => {
    /**
     * "Un'altra offerta l'ha chiuso stamattina" dev'essere una notizia vera: se il giocatore
     * restasse dov'era, riaprendo la ricerca lo si troverebbe ancora lì.
     */
    const { state, world } = conMercato("soffiato");
    const target = searchMarket(state, world, { sort: "prezzo" })[0];
    if (!target) return;

    let corrente = negotiatePurchase(state, world, target);
    let esito = playNegotiation(corrente, world, { kind: "prendi_tempo" });
    // Si insiste finché non si arena in un modo o nell'altro.
    for (let i = 0; i < 6 && esito.state.negotiation?.status === "aperta"; i++) {
      esito = playNegotiation(esito.state, world, { kind: "prendi_tempo" });
    }
    corrente = esito.state;

    if (corrente.negotiation?.ending === "soffiato") {
      const trasferimento = (corrente.worldTransfers ?? []).find(
        (t) => t.playerId === target.playerId,
      );
      expect(trasferimento, "il trasferimento non è stato registrato").toBeDefined();
      expect(trasferimento!.fromClubId).toBe(target.clubId);
      expect(trasferimento!.toClubId).not.toBe(target.clubId);
      expect(trasferimento!.toClubId).not.toBe(corrente.clubId);
    }
  });

  it("venduto un giocatore, sparisce dalle proposte di prestito", () => {
    const { state, world } = conMercato("prestiti-puliti");
    const proposta = state.market!.loanOffers[0];
    if (!proposta) return;
    const { state: dopo } = applyMarket(state, world, {
      kind: "vendi_subito",
      playerId: proposta.playerId,
    });
    expect(dopo.roster.some((e) => e.playerId === proposta.playerId)).toBe(false);
    expect(dopo.market!.loanOffers.some((l) => l.playerId === proposta.playerId)).toBe(false);
  });
});

describe("scelta dell'allenatore a ogni mercato", () => {
  it("cambiare mister costa e cambia il modulo", () => {
    const { state, world } = fullCareer("mister");
    const scelte = coachChoices(state, world);
    expect(scelte.length).toBeGreaterThan(0);
    expect(scelte.every((c) => c.coachId !== state.coachId)).toBe(true);

    const nuovo = scelte.find((c) => !c.blocked);
    if (!nuovo) return;
    const moduloPrima = findCoach(state.coachId!)?.formationId;
    const { state: dopo, rejected } = hireCoach(state, world, nuovo.coachId);
    expect(rejected).toBeFalsy();
    expect(dopo.coachId).toBe(nuovo.coachId);
    expect(dopo.budget).toBe(state.budget - nuovo.cost);

    const moduloDopo = findCoach(dopo.coachId!)?.formationId;
    // Non è detto che due allenatori diversi abbiano moduli diversi, ma il modulo in uso deve
    // seguire il mister: è il senso di poterlo cambiare.
    expect(moduloDopo).toBe(findCoach(nuovo.coachId)!.formationId);
    void moduloPrima;
  });

  it("a stagione in corso si paga anche la buonuscita", () => {
    const { state, world } = fullCareer("buonuscita");
    const primaDellaStagione = coachChoices(state, world)[0]!;

    let inCorso = state;
    for (let i = 0; i < 6; i++) {
      inCorso = advanceWeek(inCorso, world, { closeMarket: true, requestResponse: "prometti" }).state;
    }
    const durante = coachChoices(inCorso, world).find((c) => c.coachId === primaDellaStagione.coachId)!;
    expect(durante.cost).toBeGreaterThan(primaDellaStagione.cost);
  });

  it("una rosa più forte attira allenatori di levatura maggiore", () => {
    const debole = newCareer("tier-basso", 66).state;
    const forte = newCareer("tier-alto", 86).state;
    expect(coachTierOf(forte)).toBeGreaterThan(coachTierOf(debole));
  });

  /**
   * Bug segnalato dall'utente: dimesso il mister, la squadra restava senza guida fino alla
   * prossima finestra — il mercato si chiudeva comunque e la scheda Allenatore tornava
   * raggiungibile solo mesi dopo. Il direttore sportivo deve poter rimediare **subito**.
   */
  it("dimesso il mister, il mercato resta aperto e si può ingaggiarne subito un altro", () => {
    const { state, world } = fullCareer("dimissioni");
    // Prima finestra: la si apre davvero, così il mercato di prova è un `MarketSnapshot` vero.
    const aperto = advanceWeek(state, world).state;
    expect(aperto.market, "il mondo di prova non ha aperto un mercato vero").not.toBeNull();

    // Simula l'esito di due sessioni ignorate di fila: alla terza il mister si dimette.
    expect(aperto.coachRequest, "il mister di prova non ha aperto una richiesta vera").toBeTruthy();
    const inResa: CareerState = {
      ...aperto,
      coachRequest: { ...aperto.coachRequest!, fulfilled: false },
      coachIgnored: 2,
    };

    const { state: dopo, report } = advanceWeek(inResa, world, { closeMarket: true });

    expect(report.coachResigned).toBe(true);
    expect(dopo.coachId).toBeNull();
    // Il punto del fix: niente "Mercato chiuso" — resta aperto, stessa finestra.
    expect(dopo.market).not.toBeNull();
    expect(report.marketWindow).toBe(true);
    expect(report.market).not.toBeNull();

    // E si può assumere subito un sostituto, senza aspettare la prossima finestra.
    const sostituto = coachChoices(dopo, world).find((c) => !c.blocked);
    expect(sostituto, "nessun allenatore disponibile per la prova").toBeDefined();
    const { state: rimediato, rejected } = hireCoach(dopo, world, sostituto!.coachId);
    expect(rejected).toBeFalsy();
    expect(rimediato.coachId).toBe(sostituto!.coachId);
  });
});

describe("avanzamento rapido fino alla prossima decisione", () => {
  it("corre fino al mercato e restituisce un referto per giornata", () => {
    const { state, world } = fullCareer("corsa");
    // Prima chiamata: si apre il mercato estivo, quindi si ferma subito.
    const estate = advanceToNextStop(state, world);
    expect(estate.reason).toBe("mercato");

    const dopoChiusura = advanceWeek(estate.state, world, { closeMarket: true }).state;
    const corsa = advanceToNextStop(dopoChiusura, world);
    expect(["mercato", "richiesta", "fine_stagione"]).toContain(corsa.reason);
    /**
     * Almeno un referto, **a meno che una decisione fosse già in sospeso**: in quel caso la
     * corsa non parte nemmeno, ed è giusto così — c'è qualcosa che aspetta una risposta prima
     * che il calendario possa muoversi.
     */
    if (dopoChiusura.pendingRequest) {
      expect(corsa.reason).toBe("richiesta");
    } else {
      expect(corsa.reports.length).toBeGreaterThanOrEqual(1);
    }
    // Ogni referto è una settimana diversa: nessuna ripetizione a vuoto.
    const settimane = corsa.reports.map((r) => r.week);
    expect(new Set(settimane).size).toBe(settimane.length);
  });

  it("un imprevisto ferma la corsa: va saputo prima di giocare le giornate dopo", () => {
    /**
     * Continuare significherebbe accumulare notizie dietro il popup e leggerle a giochi fatti.
     * Un infortunio di tre mesi è un'informazione su cui si decide, non un resoconto.
     */
    let { state, world } = fullCareer("stop-imprevisto", 80);
    state = advanceWeek(state, world, { closeMarket: true }).state;

    let vistoStop = false;
    for (let i = 0; i < 40; i++) {
      const corsa = advanceToNextStop(state, world);
      state = corsa.state;
      if (corsa.reason === "imprevisto") {
        vistoStop = true;
        // L'ultimo referto è proprio quello con la notizia: la corsa si è fermata lì.
        expect(corsa.reports[corsa.reports.length - 1]!.incident).toBeDefined();
        break;
      }
      if (corsa.reason === "fine_stagione" || corsa.reason === "fine_carriera") break;
      if (state.market) state = advanceWeek(state, world, { closeMarket: true }).state;
      else if (state.pendingRequest) {
        state = advanceWeek(state, world, { requestResponse: "prometti" }).state;
      }
    }
    expect(vistoStop, "nessun imprevisto in una stagione intera").toBe(true);
  });

  it("una stagione intera si completa a corse successive", () => {
    let { state, world } = fullCareer("corsa-lunga");
    for (let i = 0; i < 20; i++) {
      const corsa = advanceToNextStop(state, world);
      state = corsa.state;
      if (corsa.reason === "fine_stagione" || corsa.reason === "fine_carriera") break;
      if (state.market) state = advanceWeek(state, world, { closeMarket: true }).state;
      else if (state.pendingRequest) {
        state = advanceWeek(state, world, { requestResponse: "prometti" }).state;
      }
    }
    expect(state.history.length).toBeGreaterThanOrEqual(1);
  });
});

describe("prestiti", () => {
  it("un giovane in prestito torna a fine stagione con i minuti giocati altrove", () => {
    const { state, world } = fullCareer("prestito");
    const { state: aperto } = advanceWeek(state, world);
    const proposta = aperto.market!.loanOffers[0];
    if (!proposta) return; // nessun under 24 in rosa in questo seme

    const { state: prestato } = applyMarket(aperto, world, {
      kind: "manda_in_prestito",
      playerId: proposta.playerId,
      clubId: proposta.clubId,
    });
    const inPrestito = prestato.roster.find((e) => e.playerId === proposta.playerId)!;
    expect(inPrestito.loan?.hostClubId).toBe(proposta.clubId);
    // Fuori dalla rosa utilizzabile: non lo si può schierare.
    const lineup = currentLineup(prestato, world);
    expect(Object.values(lineup.starters)).not.toContain(proposta.playerId);

    const dopoStagione = playSeason(prestato, world);
    if (dopoStagione.phase === "conclusa") return;
    const rientrato = dopoStagione.roster.find((e) => e.playerId === proposta.playerId);
    // Rientra libero da vincoli (o si è ritirato, se era anziano — ma è un under 24).
    expect(rientrato?.loan).toBeUndefined();
  });

  it("giocare in prestito fa crescere più della panchina, a parità di tutto il resto", () => {
    /**
     * È il criterio che dice se il prestito serve davvero a qualcosa: se le due curve non
     * divergono, la meccanica è solo dichiarata.
     */
    const cresciuto = (conPrestito: boolean) => {
      const base = buildWorld(76);
      const world = withCupAndMarket(base);
      // Un ragazzo con margine, che in squadra non gioca mai.
      const giovane = "p2";
      base.world.players[giovane]!.birthDate = "2006-03-01";
      const roster = base.roster.map((e) =>
        e.playerId === giovane ? { ...e, overall: 66, potential: 88 } : e,
      );
      let state = createCareer({
        seed: "crescita",
        clubId: "mio",
        leagueId: "serie-a",
        coachId: "c-10",
        roster,
        budget: 20_000_000,
      });
      if (conPrestito) {
        state = {
          ...state,
          roster: state.roster.map((e) =>
            e.playerId === giovane
              ? { ...e, loan: { hostClubId: "euro-1", untilSeason: 1, expectedMinutes: 3060 } }
              : e,
          ),
        };
      }
      const dopo = playSeason(state, world);
      return dopo.roster.find((e) => e.playerId === giovane)?.overall ?? 0;
    };

    expect(cresciuto(true)).toBeGreaterThan(cresciuto(false));
  });
});

describe("budget e qualificazione fra una stagione e l'altra", () => {
  it("il budget si ricalcola a fine stagione invece di restare fermo", () => {
    const { state, world } = fullCareer("budget", 88);
    const dopo = playSeason(state, world);
    if (dopo.phase === "conclusa") return;
    expect(dopo.budget).not.toBe(state.budget);
    expect(dopo.budget).toBeGreaterThan(0);
  });

  it("chi non è in Corona può qualificarsi arrivando in alto", () => {
    /**
     * Bug segnalato dall'utente: le iscritte venivano allegate al mondo **solo** se si era già
     * in coppa, quindi chi non c'era non aveva con chi costruirla e `nextSeasonCup` rispondeva
     * sempre "niente Corona". Qualificarsi era letteralmente impossibile, e chi ne usciva una
     * volta non poteva più rientrare.
     */
    const base = buildWorld(88);
    const world = withCupAndMarket(base);
    // Si parte **senza** coppa, pur avendo una rosa da primo posto.
    let state = createCareer({
      seed: "qualificazione",
      clubId: "mio",
      leagueId: "serie-a",
      coachId: "c-10",
      roster: base.roster,
      budget: 20_000_000,
    });
    expect(state.cup).toBeUndefined();

    state = playSeason(state, world);
    if (state.phase === "conclusa") return;
    // La rosa è da primo posto: se non arrivasse in alto il test non verificherebbe nulla,
    // quindi il piazzamento va **preteso**, non dato per scontato.
    const posizione = state.history[0]!.position;
    expect(posizione).toBeLessThanOrEqual(CUP_QUALIFY_POSITION);
    expect(state.cup, "qualificati ma senza Corona").toBeDefined();
    expect(state.cup!.entrants).toContain(state.clubId);
  });

  it("chi arriva in fondo alla classifica perde la Corona", () => {
    // Rosa scarsa ma non da retrocessione: fuori dalle prime quattro, fuori dalla coppa.
    const base = buildWorld(69);
    const world = withCupAndMarket(base);
    const state = createCareer({
      seed: "fuori",
      clubId: "mio",
      leagueId: "serie-a",
      coachId: "c-10",
      roster: base.roster,
      budget: 5_000_000,
      cupEntrants: { clubIds: CUP_CLUBS, leagues: CUP_LEAGUES },
    });
    expect(state.cup).toBeDefined();

    const dopo = playSeason(state, world);
    if (dopo.phase === "conclusa") return; // retrocesso: la carriera finisce, caso a parte
    const posizione = dopo.history[0]!.position;
    expect(dopo.cup === undefined).toBe(posizione > CUP_QUALIFY_POSITION);
  });
});

describe("salvataggio e ripresa", () => {
  it("interrompere a metà stagione e riprendere dà la stessa carriera", () => {
    /**
     * È la promessa su cui si regge il salvataggio: lo stato è serializzabile e il generatore
     * casuale si ricava dal seme, quindi chiudere il gioco non cambia il futuro.
     */
    const { state, world } = newCareer("ripresa", 78);

    let filato = state;
    for (let i = 0; i < 38; i++) {
      filato = advanceWeek(filato, world, { requestResponse: "prometti" }).state;
    }

    let conPausa = state;
    for (let i = 0; i < 19; i++) {
      conPausa = advanceWeek(conPausa, world, { requestResponse: "prometti" }).state;
    }
    // ...l'utente chiude il gioco: lo stato passa da JSON e torna indietro...
    const ricaricato: CareerState = JSON.parse(JSON.stringify(conPausa));
    let ripreso = ricaricato;
    for (let i = 19; i < 38; i++) {
      ripreso = advanceWeek(ripreso, world, { requestResponse: "prometti" }).state;
    }

    expect(ripreso.history).toEqual(filato.history);
    expect(ripreso.league.tallies).toEqual(filato.league.tallies);
  });

  it("avanzare non modifica lo stato di partenza", () => {
    /**
     * Il riduttore deve essere puro: `simulateMatchday` e la coppa accumulano i totali **in
     * posto**, quindi passare gli array del salvataggio invece di copiarli farebbe mutare uno
     * stato che il chiamante crede immutabile. Il sintomo, in gioco, sarebbe una classifica che
     * cambia da sola dopo un "torna indietro" o un ricaricamento.
     */
    const { state, world } = fullCareer("purezza");
    const partenza = JSON.stringify(state);
    let corrente = state;
    for (let i = 0; i < 8; i++) {
      corrente = advanceWeek(corrente, world, { requestResponse: "prometti", closeMarket: true }).state;
    }
    expect(JSON.stringify(state)).toBe(partenza);
    expect(corrente).not.toBe(state);
  });

  it("lo stato salvato non contiene oggetti giocatore, solo id e numeri", () => {
    // Se ci finissero i `Player` il salvataggio crescerebbe di ordini di grandezza e si
    // porterebbe dietro una fotografia stantia del database.
    const { state, world } = newCareer();
    const dopo = advanceWeek(state, world).state;
    const json = JSON.stringify(dopo);
    expect(json).not.toContain("secondaryRoles");
    expect(json).not.toContain("department");
    // E resta piccolo.
    expect(json.length).toBeLessThan(40_000);
  });

  it("due carriere con semi diversi hanno calendari diversi", () => {
    // Si confronta l'intero calendario, non la prima avversaria: con 19 club una coincidenza
    // sulla singola giornata capita nel 5% dei casi e renderebbe il test instabile.
    const avversarieDi = (seed: string) => {
      const { state, world } = newCareer(seed, 78);
      let current = state;
      const sequenza: string[] = [];
      for (let i = 0; i < 10; i++) {
        const { state: next, report } = advanceWeek(current, world, { requestResponse: "prometti" });
        current = next;
        if (report.match) sequenza.push(report.match.opponent);
      }
      return sequenza;
    };
    expect(avversarieDi("seme-a")).not.toEqual(avversarieDi("seme-b"));
  });

  it("la stessa carriera, rigiocata, dà lo stesso calendario", () => {
    const primo = (() => {
      const { state, world } = newCareer("stabile", 78);
      return advanceWeek(state, world).report.match?.opponent;
    })();
    const secondo = (() => {
      const { state, world } = newCareer("stabile", 78);
      return advanceWeek(state, world).report.match?.opponent;
    })();
    expect(primo).toBe(secondo);
  });
});

describe("resolveIncidentDecision — 'nottata_brava'/'intervista_contro'", () => {
  function decisionIncident(playerId: string): Incident {
    return {
      kind: "nottata_brava",
      playerId,
      matchdays: 0,
      moraleDelta: 0,
      requiresDecision: true,
      title: "Notte fuori prima della partita",
      message: "x",
    };
  }

  it("'ignora' non tocca il giocatore ma costa sintonia col mister", () => {
    const { state, world } = fullCareer("incident-ignora", 80);
    const playerId = state.roster[0]!.playerId;
    const moralePrima = state.roster[0]!.morale;
    const armoniaPrima = state.coachHarmony ?? 75;
    const dopo = resolveIncidentDecision(state, world, decisionIncident(playerId), "ignora");
    expect(dopo.roster.find((e) => e.playerId === playerId)!.morale).toBe(moralePrima);
    expect(dopo.coachHarmony).toBeLessThan(armoniaPrima);
  });

  it("'punizione' abbassa il morale del giocatore, di più con più giorni", () => {
    const { state, world } = fullCareer("incident-punizione", 80);
    const playerId = state.roster[0]!.playerId;
    const moralePrima = state.roster[0]!.morale;

    const unGiorno = resolveIncidentDecision(state, world, decisionIncident(playerId), "punizione", 1);
    const quattroGiorni = resolveIncidentDecision(state, world, decisionIncident(playerId), "punizione", 4);

    const moraleUnGiorno = unGiorno.roster.find((e) => e.playerId === playerId)!.morale;
    const moraleQuattroGiorni = quattroGiorni.roster.find((e) => e.playerId === playerId)!.morale;
    expect(moraleUnGiorno).toBeLessThan(moralePrima);
    expect(moraleQuattroGiorni).toBeLessThan(moraleUnGiorno);
  });

  it("la seconda occasione dello stesso giocatore apre una richiesta di cessione, a prescindere dal morale residuo", () => {
    const { state, world } = fullCareer("incident-recidivo", 80);
    const playerId = state.roster[0]!.playerId;
    // Morale alto: una singola punizione non basterebbe a farlo scendere sotto la soglia
    // generica di scontentezza — è la recidiva, non il morale, a dover forzare la richiesta.
    const roster = state.roster.map((e) => (e.playerId === playerId ? { ...e, morale: 90 } : e));
    const conMoraleAlto = { ...state, roster };

    const primaVolta = resolveIncidentDecision(conMoraleAlto, world, decisionIncident(playerId), "punizione", 1);
    expect(primaVolta.pendingRequest).toBeFalsy();
    expect(primaVolta.disciplineHistory?.[playerId]).toBe(1);

    const secondaVolta = resolveIncidentDecision(primaVolta, world, decisionIncident(playerId), "punizione", 1);
    expect(secondaVolta.disciplineHistory?.[playerId]).toBe(2);
    expect(secondaVolta.pendingRequest?.playerId).toBe(playerId);
  });

  it("non sovrascrive una richiesta di cessione già in sospeso per un altro giocatore", () => {
    const { state, world } = fullCareer("incident-non-sovrascrive", 80);
    const altro = state.roster[1]!.playerId;
    const conRichiestaAperta: CareerState = {
      ...state,
      pendingRequest: { playerId: altro, reason: "scontento", openedAtMatchday: 1, playerName: "Altro" },
    };
    const playerId = state.roster[0]!.playerId;
    const conStorico = { ...conRichiestaAperta, disciplineHistory: { [playerId]: 1 } };
    const dopo = resolveIncidentDecision(conStorico, world, decisionIncident(playerId), "punizione", 4);
    expect(dopo.pendingRequest?.playerId).toBe(altro);
  });
});
