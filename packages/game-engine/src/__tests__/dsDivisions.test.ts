/**
 * Promozioni e retrocessioni fra Serie A e Serie B dentro una carriera.
 *
 * Le proprietà che contano davvero, e che un difetto qui romperebbe in silenzio:
 *  - retrocedere dalla Serie A **non** chiude più la carriera, retrocedere dalla B sì;
 *  - le due leghe restano a venti squadre per costruzione, stagione dopo stagione;
 *  - in Serie B la Corona non si gioca, nemmeno arrivando primi;
 *  - un campionato senza seconda divisione si comporta esattamente come prima.
 */
import { describe, expect, it } from "vitest";
import { ROLE_DEPARTMENT } from "@app/shared-types";
import type { Role } from "@app/shared-types";
import {
  advanceWeek,
  createCareer,
  type CareerState,
  type CareerWorld,
  type DivisionWorld,
  type ResolvedPlayer,
} from "../ds/career";
import { nextSeasonBudget } from "../ds/budget";
import { createRosterEntry } from "../ds/roster";
import type { RosterEntry } from "../ds/types";
import type { LeagueTeam } from "../season/leagueState";

const ROLES: Role[] = [
  "POR", "POR", "POR",
  "TD", "TD", "DC", "DC", "DC", "DC", "TS", "TS",
  "QD", "MED", "MED", "QS",
  "ED", "CC", "CC", "CC", "ES",
  "TQD", "TRQ", "TQS",
  "ATT", "ATT", "ATT",
];

const SERIE_A = "lega-serie-a";
const SERIE_B = "lega-serie-b";

function rosterOf(overall: number): { roster: RosterEntry[]; players: Record<string, ResolvedPlayer> } {
  const players: Record<string, ResolvedPlayer> = {};
  const roster = ROLES.map((role, i) => {
    const id = `p${i}`;
    players[id] = {
      id,
      name: `Giocatore ${i}`,
      nation: "Italia",
      role,
      secondaryRoles: [],
      department: ROLE_DEPARTMENT[role],
      birthDate: `${1996 + (i % 8)}-05-10`,
    };
    return createRosterEntry({
      playerId: id,
      overall: overall + (i % 5) - 2,
      potential: overall + 6,
      sinceSeason: 1,
    });
  });
  return { roster, players };
}

function team(id: string, rating: number): LeagueTeam {
  return { id, name: id, rating, strength: { attack: rating, defence: rating } };
}

/**
 * Un mondo con le due divisioni collegate.
 *
 * `nostraLega` decide dove partiamo; le avversarie sono le altre 19 di quella lega, mentre
 * `divisions` conosce **entrambe** le leghe perché a fine stagione va simulata anche quella in
 * cui non giochiamo.
 */
function worldWithDivisions(opts: {
  nostraLega: string;
  /** Forza delle nostre avversarie di lega. */
  ratingAvversarie: number;
  /** Forza dei club dell'altra lega. */
  ratingGemella: number;
  overall?: number;
}): { world: CareerWorld; roster: RosterEntry[] } {
  const { roster, players } = rosterOf(opts.overall ?? 76);

  const clubsA = ["mio", ...Array.from({ length: 19 }, (_, i) => `a-${i}`)];
  const clubsB = Array.from({ length: 20 }, (_, i) => `b-${i}`);
  const nostroInA = opts.nostraLega === SERIE_A;

  // Il nostro club sta nella lega scelta; l'altra è composta solo da squadre del computer.
  const clubsByLeague: Record<string, string[]> = nostroInA
    ? { [SERIE_A]: clubsA, [SERIE_B]: clubsB }
    : { [SERIE_A]: clubsA.filter((c) => c !== "mio"), [SERIE_B]: ["mio", ...clubsB.slice(0, 19)] };

  const teams: Record<string, LeagueTeam> = {};
  for (const id of clubsByLeague[SERIE_A]!) teams[id] = team(id, nostroInA ? opts.ratingAvversarie : opts.ratingGemella);
  for (const id of clubsByLeague[SERIE_B]!) teams[id] = team(id, nostroInA ? opts.ratingGemella : opts.ratingAvversarie);

  const divisions: DivisionWorld = {
    topLeagueId: SERIE_A,
    secondLeagueId: SERIE_B,
    topLeagueName: "Serie A",
    secondLeagueName: "Serie B",
    clubsByLeague,
    teams,
  };

  const opponents = (clubsByLeague[opts.nostraLega] ?? [])
    .filter((id) => id !== "mio")
    .map((id) => teams[id]!);

  return {
    world: {
      players,
      opponents,
      clubName: "La mia squadra",
      leagueRounds: 38,
      divisions,
    },
    roster,
  };
}

function newCareer(leagueId: string, world: CareerWorld, roster: RosterEntry[], seed = "div-1"): CareerState {
  return createCareer({ seed, clubId: "mio", leagueId, coachId: "c-10", roster, budget: 10_000_000 });
}

/** Rinnova tutti: senza, la rosa si svuota e la carriera finisce per esonero (altro test). */
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
    if (report.seasonEnded || report.careerEnded) return current;
  }
  throw new Error("La stagione non è terminata");
}

describe("retrocessione dalla Serie A: la carriera continua", () => {
  it("una rosa nettamente inferiore retrocede ma non chiude la carriera", () => {
    // Avversarie di Serie A molto più forti: la retrocessione è pressoché certa.
    const { world, roster } = worldWithDivisions({
      nostraLega: SERIE_A,
      ratingAvversarie: 84,
      ratingGemella: 66,
      overall: 62,
    });
    const dopo = playSeason(newCareer(SERIE_A, world, roster), world);

    expect(dopo.history).toHaveLength(1);
    expect(dopo.history[0]!.divisionOutcome).toBe("retrocesso");
    // La carriera prosegue: fase non conclusa, e si gioca in Serie B.
    expect(dopo.ending).toBeUndefined();
    expect(dopo.phase).not.toBe("conclusa");
    expect(dopo.leagueId).toBe(SERIE_B);
  });

  it("registra il movimento con tre promosse e tre retrocesse", () => {
    const { world, roster } = worldWithDivisions({
      nostraLega: SERIE_A,
      ratingAvversarie: 84,
      ratingGemella: 66,
      overall: 62,
    });
    const dopo = playSeason(newCareer(SERIE_A, world, roster), world);

    expect(dopo.divisionMoves).toHaveLength(1);
    const move = dopo.divisionMoves![0]!;
    expect(move.season).toBe(1);
    expect(move.promoted).toHaveLength(3);
    expect(move.relegated).toHaveLength(3);
    // Chi sale viene sempre dalla seconda divisione, chi scende sempre dalla prima.
    for (const id of move.promoted) expect(id.startsWith("b-")).toBe(true);
    for (const id of move.relegated) expect(id === "mio" || id.startsWith("a-")).toBe(true);
    // Nessuno può salire e scendere nella stessa stagione.
    expect(move.promoted.some((id) => move.relegated.includes(id))).toBe(false);
  });
});

describe("promozione dalla Serie B", () => {
  it("dominando la Serie B si sale in Serie A", () => {
    const { world, roster } = worldWithDivisions({
      nostraLega: SERIE_B,
      ratingAvversarie: 62,
      ratingGemella: 80,
      overall: 82,
    });
    const dopo = playSeason(newCareer(SERIE_B, world, roster), world);

    expect(dopo.history[0]!.divisionOutcome).toBe("promosso");
    expect(dopo.leagueId).toBe(SERIE_A);
    expect(dopo.divisionMoves![0]!.promoted).toContain("mio");
  });

  it("in Serie B la Corona non si gioca nemmeno arrivando primi", () => {
    const { world, roster } = worldWithDivisions({
      nostraLega: SERIE_B,
      ratingAvversarie: 62,
      ratingGemella: 80,
      overall: 82,
    });
    // Iscritte alla Corona presenti nel mondo: senza il controllo sulla divisione, arrivare
    // primi basterebbe a qualificarsi.
    const cupEntrants = {
      clubIds: ["mio", ...Array.from({ length: 15 }, (_, i) => `euro-${i}`)],
      leagues: Array.from({ length: 16 }, (_, i) => ["a", "b", "c", "d", "e"][i % 5]!),
    };
    const cupTeams: Record<string, LeagueTeam> = {};
    for (const id of cupEntrants.clubIds) cupTeams[id] = team(id, 80);

    const dopo = playSeason(
      newCareer(SERIE_B, { ...world, cupEntrants, cupTeams }, roster),
      { ...world, cupEntrants, cupTeams },
    );

    // Siamo saliti in Serie A, quindi la stagione dopo la Corona potrà arrivare — ma il pass
    // non si eredita dal campionato di seconda divisione appena vinto.
    expect(dopo.history[0]!.divisionOutcome).toBe("promosso");
    expect(dopo.cup).toBeUndefined();
  });

  it("arrivare ultimi in Serie B chiude la carriera", () => {
    const { world, roster } = worldWithDivisions({
      nostraLega: SERIE_B,
      ratingAvversarie: 82,
      ratingGemella: 84,
      overall: 60,
    });
    const dopo = playSeason(newCareer(SERIE_B, world, roster), world);

    expect(dopo.phase).toBe("conclusa");
    expect(dopo.ending).toBe("retrocessione");
    expect(dopo.history[0]!.divisionOutcome).toBe("retrocesso");
  });
});

describe("campionati senza seconda divisione", () => {
  it("continuano a chiudere la carriera alla retrocessione, come prima", () => {
    // Stesso scenario disperato, ma senza `divisions` nel mondo: è il caso di Premier, Liga,
    // Bundesliga e Ligue 1, e dei salvataggi precedenti a questo sistema.
    const { world, roster } = worldWithDivisions({
      nostraLega: SERIE_A,
      ratingAvversarie: 84,
      ratingGemella: 66,
      overall: 62,
    });
    const senzaDivisioni: CareerWorld = { ...world, divisions: undefined };
    const dopo = playSeason(newCareer(SERIE_A, senzaDivisioni, roster), senzaDivisioni);

    expect(dopo.phase).toBe("conclusa");
    expect(dopo.ending).toBe("retrocessione");
    expect(dopo.history[0]!.divisionOutcome).toBeUndefined();
    expect(dopo.divisionMoves).toBeUndefined();
  });
});

describe("Coppa Tricolore dentro la carriera", () => {
  it("si compone da sola alla prima settimana, con tutte e quaranta le squadre", () => {
    const { world, roster } = worldWithDivisions({
      nostraLega: SERIE_A,
      ratingAvversarie: 74,
      ratingGemella: 66,
    });
    const { state } = advanceWeek(rinnovaTutti(newCareer(SERIE_A, world, roster)), world, {});

    expect(state.nationalCup).toBeDefined();
    expect(state.nationalCup!.entrants).toHaveLength(40);
    expect(state.nationalCup!.entrants).toContain("mio");
  });

  it("una carriera già in corso non viene iscritta a stagione avviata", () => {
    /**
     * Il difetto che questo test blocca: iscrivere un club a stagione in corso gli faceva
     * saltare in silenzio tutti i turni la cui settimana era già passata — il preliminare sta
     * al 3% della stagione — perché il calendario si ricalcola da `!!state.nationalCup` e
     * prenota per frazione. Entrava e usciva dalla coppa senza aver giocato.
     *
     * Si simula il salvataggio "vecchio" com'era davvero: una carriera a metà stagione senza
     * coppa. Deve restare senza per quest'anno, e riceverla completa alla successiva.
     */
    const { world, roster } = worldWithDivisions({
      nostraLega: SERIE_A,
      ratingAvversarie: 74,
      ratingGemella: 66,
    });
    let state = rinnovaTutti(newCareer(SERIE_A, world, roster));
    // Sei giornate giocate e nessuna coppa in stato: è la fotografia del salvataggio precedente.
    for (let i = 0; i < 8; i++) state = advanceWeek(state, world, {}).state;
    expect(state.league.round).toBeGreaterThan(0);

    const comeVecchioSalvataggio: typeof state = { ...state, nationalCup: undefined };
    const { state: dopo } = advanceWeek(comeVecchioSalvataggio, world, {});
    expect(dopo.nationalCup).toBeUndefined();
  });

  it("un campionato senza seconda divisione non ha coppa nazionale", () => {
    const { world, roster } = worldWithDivisions({
      nostraLega: SERIE_A,
      ratingAvversarie: 74,
      ratingGemella: 66,
    });
    const senza: CareerWorld = { ...world, divisions: undefined };
    const { state } = advanceWeek(rinnovaTutti(newCareer(SERIE_A, senza, roster)), senza, {});
    expect(state.nationalCup).toBeUndefined();
  });

  it("la coppa si gioca davvero e produce un esito a fine stagione", () => {
    const { world, roster } = worldWithDivisions({
      nostraLega: SERIE_A,
      ratingAvversarie: 70,
      ratingGemella: 64,
      overall: 84,
    });
    const dopo = playSeason(newCareer(SERIE_A, world, roster, "coppa-1"), world);

    // Il tabellone è avanzato: o l'abbiamo vinta, o ci siamo fermati in una fase precisa.
    expect(dopo.history[0]!.nationalCupOutcome).toBeDefined();
    expect(dopo.history[0]!.trophies).toBeDefined();
  });

  it("il triplete richiede tutti e tre i trofei, e in Serie B è impossibile", () => {
    // In seconda divisione la Corona non si gioca: `continental` non può mai essere vero,
    // quindi `treble` nemmeno. È una conseguenza della regola, non un controllo a parte.
    const { world, roster } = worldWithDivisions({
      nostraLega: SERIE_B,
      ratingAvversarie: 62,
      ratingGemella: 80,
      overall: 84,
    });
    const dopo = playSeason(newCareer(SERIE_B, world, roster, "triplete-b"), world);

    expect(dopo.history[0]!.trophies!.continental).toBe(false);
    expect(dopo.history[0]!.treble).toBe(false);
  });
});

describe("il budget sente il cambio di categoria", () => {
  const base = {
    averageOverall: 70,
    position: 10,
    teamsInLeague: 20,
    leftover: 0,
    difficulty: "normale" as const,
  };

  it("retrocedere taglia i mezzi, promuovere li aumenta", () => {
    const resta = nextSeasonBudget({ ...base, divisionOutcome: "resta" });
    const su = nextSeasonBudget({ ...base, divisionOutcome: "promosso" });
    const giu = nextSeasonBudget({ ...base, divisionOutcome: "retrocesso" });

    expect(giu).toBeLessThan(resta);
    expect(su).toBeGreaterThan(resta);
    // Deve essere un salto di scala, non un ritocco: sotto il 25% di scarto la differenza
    // sparirebbe nel rumore del piazzamento e la categoria non conterebbe nulla.
    expect(resta / giu).toBeGreaterThan(1.25);
    expect(su / resta).toBeGreaterThan(1.25);
  });

  it("senza seconda divisione il budget è identico a prima", () => {
    // Il campo è opzionale: i campionati senza promozioni e i salvataggi vecchi non devono
    // vedere alcuna differenza.
    expect(nextSeasonBudget(base)).toBe(nextSeasonBudget({ ...base, divisionOutcome: "resta" }));
  });
});

describe("riproducibilità", () => {
  it("la stessa carriera ripetuta produce gli stessi movimenti", () => {
    // I movimenti dipendono anche dalla lega gemella, che viene **simulata** a fine stagione:
    // se quel generatore non fosse derivato dal seme, due esecuzioni identiche darebbero
    // promozioni diverse e un salvataggio ricaricato non riprodurrebbe la stessa carriera.
    const a = worldWithDivisions({ nostraLega: SERIE_A, ratingAvversarie: 76, ratingGemella: 68 });
    const b = worldWithDivisions({ nostraLega: SERIE_A, ratingAvversarie: 76, ratingGemella: 68 });

    const uno = playSeason(newCareer(SERIE_A, a.world, a.roster, "stesso-seme"), a.world);
    const due = playSeason(newCareer(SERIE_A, b.world, b.roster, "stesso-seme"), b.world);

    expect(uno.divisionMoves).toEqual(due.divisionMoves);
    expect(uno.leagueId).toBe(due.leagueId);
  });
});
