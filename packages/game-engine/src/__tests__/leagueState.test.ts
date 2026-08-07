/**
 * Test della simulazione **incrementale** del campionato, la forma di cui ha bisogno la DS
 * mode per avanzare una giornata alla volta con lo stato che evolve nel mezzo.
 *
 * L'equivalenza col comportamento storico è già dimostrata da `championshipCharacterization`;
 * qui si verificano le proprietà nuove: taglia di campionato variabile, avanzamento parziale,
 * classifica coerente in ogni momento.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
  buildStandings,
  createLeagueState,
  simulateMatchday,
  totalRounds,
  type LeagueTeam,
} from "../season/leagueState";
import { simulateLeagueSeason } from "../championship";

function teams(count: number): LeagueTeam[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    name: `Squadra ${i}`,
    rating: 70 + (i % 15),
    strength: { attack: 70 + (i % 15), defence: 72 + (i % 12) },
  }));
}

describe("createLeagueState", () => {
  it("con 20 squadre produce 38 giornate, con 18 ne produce 34", () => {
    expect(totalRounds(createLeagueState(teams(20), mulberry32(1)))).toBe(38);
    expect(totalRounds(createLeagueState(teams(18), mulberry32(1)))).toBe(34);
  });

  it("rifiuta un numero dispari di squadre invece di produrre un calendario rotto", () => {
    // Con un numero dispari il metodo del cerchio lascerebbe una squadra senza avversario a
    // ogni giornata, e le giornate non sarebbero più quelle attese.
    expect(() => createLeagueState(teams(19), mulberry32(1))).toThrow(/numero pari/);
  });

  it("ogni squadra incontra ogni altra esattamente due volte", () => {
    const state = createLeagueState(teams(18), mulberry32(5));
    const counts = new Map<string, number>();
    for (const round of state.calendar) {
      for (const { home, away } of round) {
        const key = [home, away].sort((a, b) => a - b).join("-");
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe((18 * 17) / 2);
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
  });

  it("ogni squadra gioca una sola partita per giornata", () => {
    const state = createLeagueState(teams(20), mulberry32(8));
    for (const round of state.calendar) {
      const involved = round.flatMap((f) => [f.home, f.away]);
      expect(new Set(involved).size).toBe(20);
    }
  });

  it("il calendario è sorteggiato: semi diversi danno tabelloni diversi", () => {
    const a = createLeagueState(teams(20), mulberry32(1)).calendar[0];
    const b = createLeagueState(teams(20), mulberry32(2)).calendar[0];
    expect(a).not.toEqual(b);
  });
});

describe("simulateMatchday", () => {
  it("avanza di una giornata alla volta e si ferma quando il calendario finisce", () => {
    const state = createLeagueState(teams(18), mulberry32(3));
    for (let i = 0; i < 34; i++) simulateMatchday(state, mulberry32(100 + i));
    expect(state.round).toBe(34);
    const { results } = simulateMatchday(state, mulberry32(999));
    expect(results).toEqual([]);
    expect(state.round).toBe(34);
  });

  it("restituisce il dettaglio solo per la squadra seguita", () => {
    const state = createLeagueState(teams(20), mulberry32(4));
    const { results, followedResult, followedOpponent } = simulateMatchday(state, mulberry32(7), {
      followedIndex: 0,
      followedScorers: [{ id: "p1", weight: 1 }],
    });
    expect(results).toHaveLength(10);
    expect(results.filter((r) => r.detail)).toHaveLength(1);
    expect(followedResult).toBeDefined();
    expect(followedOpponent).toBeTruthy();
    // Il dettaglio è dal punto di vista della squadra seguita.
    expect(followedResult!.scorerIds).toHaveLength(followedResult!.goalsFor);
  });

  it("la classifica è coerente in ogni momento, non solo a fine stagione", () => {
    const state = createLeagueState(teams(20), mulberry32(11));
    for (let round = 1; round <= 5; round++) {
      simulateMatchday(state, mulberry32(200 + round));
      const standings = buildStandings(state);
      // Ogni squadra ha giocato esattamente `round` partite...
      expect(standings.every((r) => r.played === round)).toBe(true);
      // ...e i gol fatti nel campionato bilanciano quelli subiti.
      const scored = standings.reduce((s, r) => s + r.goalsFor, 0);
      const conceded = standings.reduce((s, r) => s + r.goalsAgainst, 0);
      expect(scored).toBe(conceded);
      expect(standings.every((r) => r.points === r.wins * 3 + r.draws)).toBe(true);
    }
  });

  it("le posizioni sono ordinate per punti, differenza reti e gol fatti", () => {
    const state = createLeagueState(teams(20), mulberry32(13));
    for (let i = 0; i < 38; i++) simulateMatchday(state, mulberry32(300 + i));
    const standings = buildStandings(state);
    for (let i = 1; i < standings.length; i++) {
      const prev = standings[i - 1]!;
      const curr = standings[i]!;
      expect(prev.position).toBe(i);
      const better =
        prev.points > curr.points ||
        (prev.points === curr.points && prev.goalDifference > curr.goalDifference) ||
        (prev.points === curr.points &&
          prev.goalDifference === curr.goalDifference &&
          prev.goalsFor >= curr.goalsFor);
      expect(better).toBe(true);
    }
  });
});

describe("interruzione e ripresa", () => {
  /**
   * È la proprietà su cui si regge il salvataggio della DS mode: una carriera si può chiudere
   * a metà stagione e riprendere, e il campionato deve proseguire identico. Qui si simula
   * interrompendo a metà e continuando con gli stessi semi per giornata.
   */
  it("interrompere a metà e riprendere dà la stessa stagione", () => {
    const seedFor = (round: number) => mulberry32(1000 + round);

    const tuttoDiFilato = createLeagueState(teams(20), mulberry32(42));
    for (let r = 0; r < 38; r++) simulateMatchday(tuttoDiFilato, seedFor(r));

    const conPausa = createLeagueState(teams(20), mulberry32(42));
    for (let r = 0; r < 19; r++) simulateMatchday(conPausa, seedFor(r));
    // ...qui l'utente chiude il gioco e riapre più tardi...
    for (let r = 19; r < 38; r++) simulateMatchday(conPausa, seedFor(r));

    expect(buildStandings(conPausa)).toEqual(buildStandings(tuttoDiFilato));
  });
});

describe("simulateLeagueSeason resta il wrapper della Modalità Classica", () => {
  it("produce sempre 38 giornate anche con poche avversarie, riempiendo il campionato", () => {
    const season = simulateLeagueSeason(80, [], teams(5), mulberry32(2));
    expect(season.userMatches).toHaveLength(38);
    expect(season.standings).toHaveLength(20);
  });
});
