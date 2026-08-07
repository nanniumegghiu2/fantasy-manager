/**
 * Test della Corona Continentale e del calendario stagionale.
 *
 * Il rischio che questi test devono escludere è il **vicolo cieco nel sorteggio**: con un
 * sorteggio a tentativi si può arrivare alle ultime squadre senza accoppiamenti validi. Qui
 * la costruzione circolare lo rende impossibile per struttura, e i test lo verificano su
 * mille semi diversi — se un giorno qualcuno sostituisse la costruzione con dei ritentativi,
 * questi test se ne accorgerebbero.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
  createCupState,
  cupOutcomeOf,
  cupStandings,
  GROUP_ROUNDS,
  KNOCKOUT_TEAMS,
  simulateGroupRound,
  simulateKnockoutRound,
  startKnockout,
} from "../season/cup";
import {
  buildSeasonCalendar,
  cupSlotOf,
  hasMarketWindow,
  leagueRoundOf,
  midSeasonRound,
  TOTAL_CUP_ROUNDS,
} from "../season/calendar";
import type { LeagueTeam } from "../season/leagueState";
import { CONTINENTAL_TEAMS, continentalSeedNames, isSeededForContinental } from "../ds/continentalSeed";

const LEAGUES = ["Serie A", "Premier League", "La Liga", "Bundesliga", "Ligue 1"];

/**
 * Le iscritte alla Corona: tre per campionato più le ripescate fino a `CONTINENTAL_TEAMS`, di
 * forza decrescente. Il conteggio segue la costante, così ridurre il tabellone non richiede di
 * riscrivere il test.
 */
function cupTeams(): LeagueTeam[] {
  const tutte = LEAGUES.flatMap((league, l) =>
    Array.from({ length: 4 }, (_, i) => ({
      id: `${l}-${i}`,
      name: `${league} ${i + 1}`,
      rating: 86 - i * 3 - l,
      strength: { attack: 86 - i * 3 - l, defence: 84 - i * 3 - l },
    })),
  );
  return tutte.slice(0, CONTINENTAL_TEAMS);
}

const leagueOf = (team: LeagueTeam) => team.name.replace(/ \d$/, "");

describe("sorteggio del girone", () => {
  it("ogni squadra gioca 6 partite contro 6 avversarie diverse, 3 in casa e 3 fuori", () => {
    for (let seed = 0; seed < 200; seed++) {
      const state = createCupState({ teams: cupTeams(), leagueOf, random: mulberry32(seed) });
      const home = new Array(CONTINENTAL_TEAMS).fill(0);
      const away = new Array(CONTINENTAL_TEAMS).fill(0);
      const opponents = Array.from({ length: CONTINENTAL_TEAMS }, () => new Set<number>());

      expect(state.groupCalendar).toHaveLength(GROUP_ROUNDS);
      for (const round of state.groupCalendar) {
        expect(round).toHaveLength(CONTINENTAL_TEAMS / 2);
        // Una squadra non può giocare due volte nello stesso turno.
        const involved = round.flatMap((f) => [f.home, f.away]);
        expect(new Set(involved).size).toBe(CONTINENTAL_TEAMS);

        for (const { home: h, away: a } of round) {
          home[h]++;
          away[a]++;
          opponents[h]!.add(a);
          opponents[a]!.add(h);
        }
      }

      for (let i = 0; i < CONTINENTAL_TEAMS; i++) {
        expect({ seed, i, home: home[i], away: away[i], opp: opponents[i]!.size }).toEqual({
          seed, i, home: 3, away: 3, opp: 6,
        });
      }
    }
  });

  it("due squadre dello stesso campionato non si incontrano MAI nel girone", () => {
    // Con la costruzione a cerchio è garantito per struttura: i connazionali distano sempre
    // un multiplo di 5 e gli accoppiamenti usano solo le distanze 1, 2 e 3.
    for (let seed = 0; seed < 1000; seed++) {
      const teams = cupTeams();
      const state = createCupState({ teams, leagueOf, random: mulberry32(seed) });
      for (const round of state.groupCalendar) {
        for (const { home, away } of round) {
          if (leagueOf(teams[home]!) === leagueOf(teams[away]!)) {
            throw new Error(`seed ${seed}: derby di ${leagueOf(teams[home]!)} nel girone`);
          }
        }
      }
    }
  });

  it("il sorteggio cambia fra semi diversi", () => {
    const a = createCupState({ teams: cupTeams(), leagueOf, random: mulberry32(1) }).groupCalendar[0];
    const b = createCupState({ teams: cupTeams(), leagueOf, random: mulberry32(2) }).groupCalendar[0];
    expect(a).not.toEqual(b);
  });
});

describe("girone e tabellone", () => {
  function playGroup(seed: number) {
    const state = createCupState({ teams: cupTeams(), leagueOf, random: mulberry32(seed) });
    const random = mulberry32(seed + 500);
    for (let i = 0; i < GROUP_ROUNDS; i++) simulateGroupRound(state, random);
    return { state, random };
  }

  it("dopo sei turni ogni squadra ha giocato sei partite e i gol si bilanciano", () => {
    const { state } = playGroup(3);
    const table = cupStandings(state);
    expect(table.every((r) => r.played === GROUP_ROUNDS)).toBe(true);
    const scored = table.reduce((s, r) => s + r.goalsFor, 0);
    const conceded = table.reduce((s, r) => s + r.goalsAgainst, 0);
    expect(scored).toBe(conceded);
  });

  it("passano esattamente le prime otto", () => {
    const { state } = playGroup(4);
    const table = cupStandings(state);
    expect(table.filter((r) => r.qualified)).toHaveLength(KNOCKOUT_TEAMS);
    expect(table.slice(0, KNOCKOUT_TEAMS).every((r) => r.qualified)).toBe(true);
  });

  it("il tabellone accoppia 1-8, 2-7, 3-6, 4-5", () => {
    const { state } = playGroup(5);
    const table = cupStandings(state);
    startKnockout(state);
    expect(state.bracket).toEqual([
      table[0]!.teamIndex, table[7]!.teamIndex,
      table[1]!.teamIndex, table[6]!.teamIndex,
      table[2]!.teamIndex, table[5]!.teamIndex,
      table[3]!.teamIndex, table[4]!.teamIndex,
    ]);
  });

  it("il tabellone si chiude sempre con un vincitore, senza pareggi irrisolti", () => {
    for (let seed = 0; seed < 100; seed++) {
      const { state, random } = playGroup(seed);
      startKnockout(state);
      simulateKnockoutRound(state, random); // quarti
      simulateKnockoutRound(state, random); // semifinali
      simulateKnockoutRound(state, random); // finale
      expect({ seed, winner: state.winner !== undefined }).toEqual({ seed, winner: true });
      // 4 quarti + 2 semifinali + 1 finale
      expect(state.knockoutLog).toHaveLength(7);
      for (const result of state.knockoutLog) {
        expect([result.home, result.away]).toContain(result.winner);
      }
    }
  });

  it("un pareggio nei 90 minuti si risolve ai supplementari o ai rigori", () => {
    let conSupplementari = 0;
    let conRigori = 0;
    for (let seed = 0; seed < 200; seed++) {
      const { state, random } = playGroup(seed);
      startKnockout(state);
      simulateKnockoutRound(state, random);
      simulateKnockoutRound(state, random);
      simulateKnockoutRound(state, random);
      for (const r of state.knockoutLog) {
        if (r.extraTime) conSupplementari++;
        if (r.penalties) conRigori++;
      }
    }
    expect(conSupplementari).toBeGreaterThan(0);
    expect(conRigori).toBeGreaterThan(0);
  });

  it("il cammino di una squadra è leggibile per il budget di fine stagione", () => {
    const { state, random } = playGroup(7);
    startKnockout(state);
    const eliminataAiQuarti = state.bracket[1]!;
    simulateKnockoutRound(state, random);
    simulateKnockoutRound(state, random);
    simulateKnockoutRound(state, random);

    expect(cupOutcomeOf(state, state.winner!)).toBe("vittoria");
    const fuoriDalGirone = cupStandings(state).find((r) => !r.qualified)!.teamIndex;
    expect(cupOutcomeOf(state, fuoriDalGirone)).toBe("girone");
    expect(["quarti", "semifinale", "finale", "vittoria"]).toContain(
      cupOutcomeOf(state, eliminataAiQuarti),
    );
  });
});

describe("calendario stagionale", () => {
  it("una settimana per giornata di campionato, sia a 38 sia a 34", () => {
    for (const rounds of [38, 34]) {
      const weeks = buildSeasonCalendar({ leagueRounds: rounds, inCup: true });
      expect(weeks).toHaveLength(rounds);
      const giornate = weeks.map(leagueRoundOf).filter((r) => r !== undefined);
      expect(giornate).toEqual(Array.from({ length: rounds }, (_, i) => i));
    }
  });

  it("i nove turni di coppa si collocano tutti, senza sovrapporsi al mercato", () => {
    for (const rounds of [38, 34]) {
      const weeks = buildSeasonCalendar({ leagueRounds: rounds, inCup: true });
      const cupWeeks = weeks.filter((w) => cupSlotOf(w));
      expect({ rounds, turni: cupWeeks.length }).toEqual({ rounds, turni: TOTAL_CUP_ROUNDS });
      // Nessun turno di coppa nella settimana di mercato: due decisioni importanti insieme
      // sarebbero una cattiva esperienza.
      for (const week of weeks) {
        if (hasMarketWindow(week)) expect(cupSlotOf(week)).toBeUndefined();
      }
      // I turni sono in ordine e senza duplicati.
      const ordine = cupWeeks.map((w) => cupSlotOf(w)!.round);
      expect(ordine).toEqual([...ordine].sort((a, b) => a - b));
      expect(new Set(ordine).size).toBe(TOTAL_CUP_ROUNDS);
    }
  });

  it("la finestra di riparazione si apre al giro di boa", () => {
    expect(midSeasonRound(38)).toBe(19);
    expect(midSeasonRound(34)).toBe(17);
    const weeks = buildSeasonCalendar({ leagueRounds: 38, inCup: false });
    expect(hasMarketWindow(weeks[19]!)).toBe(true);
  });

  it("chi non è in coppa ha un calendario di solo campionato", () => {
    const weeks = buildSeasonCalendar({ leagueRounds: 38, inCup: false });
    expect(weeks.some((w) => cupSlotOf(w))).toBe(false);
  });
});

describe("griglia iniziale della Corona", () => {
  it("la griglia iniziale ha esattamente le squadre previste dal formato", () => {
    expect(continentalSeedNames()).toHaveLength(CONTINENTAL_TEAMS);
    expect(new Set(continentalSeedNames()).size).toBe(CONTINENTAL_TEAMS);
  });

  it("riconosce i club ammessi, per poterlo evidenziare alla scelta", () => {
    expect(isSeededForContinental("Inter")).toBe(true);
    expect(isSeededForContinental("Paris Saint-Germain")).toBe(true);
    expect(isSeededForContinental("Hellas Verona")).toBe(false);
  });
});
