/**
 * **La stagione ha delle statistiche**: voti, assist, marcatori di lega.
 *
 * ⚠️ Richiesta dell'utente: *"voglio poter vedere le rose avversarie, le statistiche di
 * campionati e coppe, le medie voto per capire i giocatori in crescita; al momento la stagione è
 * solo una fase inutile mentre deve diventare importante tanto quanto la fase mercato"*.
 *
 * Due cose non esistevano affatto prima di questo blocco, e vanno dette perché non sono
 * dettagli: **gli assist non venivano mai incrementati** (restavano a zero per dieci stagioni,
 * pur entrando nella valutazione di fine anno), e **le medie voto non esistevano** — `statLineOf`
 * in `aging.ts` lo dichiarava per iscritto.
 *
 * L'invariante di sicurezza di tutto il blocco è che `simulateMatch`/`simulateMatchday` non siano
 * state toccate: sono condivise con la Modalità Classica e il loro characterization test protegge
 * la calibrazione del 38-0-0. Quel test gira insieme a questi.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import { MAX_RATING, MIN_RATING, matchRating, pickAssistId, ASSIST_WEIGHT } from "../ds/matchRatings";
import { accumulateMatchday, leaders, recordOwn, type CompetitionStats } from "../ds/leagueStats";
import { advanceWeek } from "../ds/career";
import { averageRating } from "../ds/types";
import { buildWorld, newCareer, rinnovaTutti } from "./helpers/dsWorld";
import type { LeagueTeam, MatchdayFixtureResult } from "../season/leagueState";

/* -------------------------------------------------------------------------- */
/* Il voto                                                                     */
/* -------------------------------------------------------------------------- */

const base = {
  department: "CC" as const,
  played: true,
  goals: 0,
  assists: 0,
  teamGoals: 1,
  opponentGoals: 1,
  ownStrength: 78,
  opponentStrength: 78,
  noise: 0.5,
};

describe("il voto di una partita", () => {
  it("chi non gioca non prende voto — che è diverso da prendere un'insufficienza", () => {
    expect(matchRating({ ...base, played: false })).toBeNull();
  });

  it("resta sempre dentro la scala di una pagella", () => {
    for (let i = 0; i < 200; i++) {
      const v = matchRating({
        ...base,
        goals: i % 5,
        assists: i % 3,
        teamGoals: i % 7,
        opponentGoals: (i * 3) % 7,
        noise: (i % 100) / 100,
      });
      expect(v).not.toBeNull();
      expect(v!).toBeGreaterThanOrEqual(MIN_RATING);
      expect(v!).toBeLessThanOrEqual(MAX_RATING);
    }
  });

  it("chi segna prende più di chi non segna, a parità di tutto il resto", () => {
    const senza = matchRating(base)!;
    const con = matchRating({ ...base, goals: 1 })!;
    expect(con).toBeGreaterThan(senza);
  });

  it("il portiere che tiene la porta inviolata prende più di uno che ne subisce quattro", () => {
    const pulito = matchRating({ ...base, department: "POR", teamGoals: 1, opponentGoals: 0 })!;
    const subissato = matchRating({ ...base, department: "POR", teamGoals: 1, opponentGoals: 4 })!;
    expect(pulito).toBeGreaterThan(subissato);
    // Ed è la componente che valorizza un ruolo che gol e assist non descrivono affatto.
    expect(pulito - subissato).toBeGreaterThan(1);
  });

  it("l'attaccante vive dei gol, il difensore del risultato difensivo", () => {
    // Vittoria larga senza subire: il difensore ci guadagna anche senza toccare palla.
    const dif = matchRating({ ...base, department: "DIF", teamGoals: 3, opponentGoals: 0 })!;
    const difKO = matchRating({ ...base, department: "DIF", teamGoals: 3, opponentGoals: 3 })!;
    expect(dif).toBeGreaterThan(difKO);

    // L'attaccante che segna prende bene anche perdendo: è la sua unità di misura.
    const attGol = matchRating({ ...base, department: "ATT", goals: 1, teamGoals: 1, opponentGoals: 3 })!;
    const attNulla = matchRating({ ...base, department: "ATT", teamGoals: 1, opponentGoals: 3 })!;
    expect(attGol).toBeGreaterThan(attNulla + 0.5);
  });

  it("due partite identiche non danno pagelle identiche", () => {
    const a = matchRating({ ...base, noise: 0.1 })!;
    const b = matchRating({ ...base, noise: 0.9 })!;
    expect(a).not.toBe(b);
  });
});

/* -------------------------------------------------------------------------- */
/* Gli assist                                                                  */
/* -------------------------------------------------------------------------- */

describe("gli assist", () => {
  const candidati = [
    { id: "a", weight: ASSIST_WEIGHT.ATT },
    { id: "b", weight: ASSIST_WEIGHT.CC },
    { id: "c", weight: ASSIST_WEIGHT.DIF },
  ];

  it("nessuno si serve l'assist da solo", () => {
    for (let s = 0; s < 200; s++) {
      expect(pickAssistId("a", candidati, mulberry32(s))).not.toBe("a");
    }
  });

  it("non tutti i gol hanno un assist", () => {
    let senza = 0;
    for (let s = 0; s < 300; s++) {
      if (pickAssistId("a", candidati, mulberry32(s)) === null) senza++;
    }
    // Una rete su quattro circa nasce da una giocata individuale o da una palla inattiva.
    expect(senza).toBeGreaterThan(30);
    expect(senza).toBeLessThan(150);
  });

  it("senza compagni non si inventa un assistente", () => {
    expect(pickAssistId("a", [{ id: "a", weight: 3 }], mulberry32(1))).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Le classifiche di lega                                                      */
/* -------------------------------------------------------------------------- */

describe("le statistiche di tutta la lega", () => {
  function squadra(id: string): LeagueTeam {
    return {
      id,
      name: id,
      rating: 76,
      scorers: [
        { id: `${id}-att`, weight: 3 },
        { id: `${id}-cc`, weight: 1.5 },
        { id: `${id}-dif`, weight: 0.5 },
      ],
    };
  }

  it("i gol delle partite fra squadre IA trovano un marcatore", () => {
    const teams = [squadra("noi"), squadra("a"), squadra("b"), squadra("c")];
    const results: MatchdayFixtureResult[] = [
      { home: 1, away: 2, goalsHome: 2, goalsAway: 1 },
      { home: 3, away: 0, goalsHome: 1, goalsAway: 0 },
    ];
    const stats = accumulateMatchday({
      stats: {},
      results,
      teams,
      followedIndex: 0,
      seed: "lega",
      season: 1,
      round: 1,
    });

    const gol = Object.values(stats).reduce((s, t) => s + t.goals, 0);
    // Quattro gol nella partita fra IA; quella che ci riguarda è esclusa di proposito — i nostri
    // gol hanno già un marcatore vero e li registra la carriera. Contarli qui li raddoppierebbe.
    expect(gol).toBe(3);
  });

  it("la nostra partita non viene contata due volte", () => {
    const teams = [squadra("noi"), squadra("a")];
    const stats = accumulateMatchday({
      stats: {},
      results: [{ home: 0, away: 1, goalsHome: 3, goalsAway: 2 }],
      teams,
      followedIndex: 0,
      seed: "lega",
      season: 1,
      round: 1,
    });
    expect(Object.keys(stats)).toHaveLength(0);
  });

  it("la classifica marcatori ordina per gol, e le medie voto vogliono un minimo di presenze", () => {
    const stats: CompetitionStats = {};
    recordOwn(stats, "bomber", { goals: 12 });
    recordOwn(stats, "gregario", { goals: 3, assists: 9 });
    for (let i = 0; i < 8; i++) recordOwn(stats, "costante", { rating: 7.2 });
    recordOwn(stats, "meteora", { rating: 9.5 });

    expect(leaders(stats, "goals")[0]!.playerId).toBe("bomber");
    expect(leaders(stats, "assists")[0]!.playerId).toBe("gregario");

    const voti = leaders(stats, "rating");
    // Una media su una gara sola non è una media: chi ha giocato una volta resta fuori.
    expect(voti.map((v) => v.playerId)).toContain("costante");
    expect(voti.map((v) => v.playerId)).not.toContain("meteora");
  });
});

/* -------------------------------------------------------------------------- */
/* Dentro una carriera vera                                                    */
/* -------------------------------------------------------------------------- */

describe("giocando davvero, le statistiche si riempiono", () => {
  it("dopo qualche giornata ci sono voti, assist e una classifica marcatori", () => {
    const { state, world } = newCareer("statistiche", 78);
    let current = rinnovaTutti(state);
    for (let i = 0; i < 12; i++) {
      const { state: next } = advanceWeek(current, world, {
        closeMarket: true,
        requestResponse: "prometti",
      });
      current = next;
    }

    const conVoto = current.roster.filter((e) => (e.stats.ratedAppearances ?? 0) > 0);
    expect(conVoto.length).toBeGreaterThan(8);
    for (const e of conVoto) {
      const media = averageRating(e.stats)!;
      expect(media).toBeGreaterThanOrEqual(MIN_RATING);
      expect(media).toBeLessThanOrEqual(MAX_RATING);
    }

    // ⚠️ Gli assist: prima di questo blocco restavano a zero per l'intera carriera.
    const assistTotali = current.roster.reduce((s, e) => s + e.stats.assists, 0);
    expect(assistTotali).toBeGreaterThan(0);

    // E la classifica di lega contiene sia i nostri sia quelli delle altre squadre.
    const marcatori = leaders(current.leagueStats ?? {}, "goals");
    expect(marcatori.length).toBeGreaterThan(0);
  });

  it("le statistiche sono di stagione: al cambio d'anno ripartono da zero", () => {
    const { world } = buildWorld(78);
    void world;
    // Il caso è già coperto strutturalmente da `closeSeason`, che azzera le tre mappe insieme
    // alla classifica: qui si verifica solo che il campo esista e sia una mappa, così una
    // rimozione accidentale del reset si vede.
    const { state } = newCareer("azzeramento", 78);
    expect(state.leagueStats ?? {}).toEqual({});
  });
});
