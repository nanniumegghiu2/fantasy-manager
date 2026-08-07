/**
 * **Corona Continentale**: la competizione europea della DS Mode.
 *
 * Nome originale, come impone CLAUDE.md sez. 2 — vietati i marchi reali, e sono da evitare
 * anche le denominazioni storiche autentiche, che non sarebbero più originali del nome
 * corrente.
 *
 * Formato: **20 squadre** (le prime quattro di ciascuno dei cinque campionati), girone unico
 * su **6 turni**, poi le prime otto ai quarti e tabellone secco fino alla finale. Nove turni
 * in tutto, che intrecciati con le 34-38 giornate di campionato portano chi arriva in fondo a
 * giocare ~47 partite: è questo numero a dare senso a una rosa da 25 e alla rotazione.
 *
 * ## Il sorteggio non può fallire, per costruzione
 *
 * Il vincolo "mai due squadre dello stesso campionato nel girone" con un sorteggio a
 * tentativi rischia il vicolo cieco: si arriva alle ultime squadre e non resta alcun
 * accoppiamento valido. Invece di backtracking e ritentativi, qui si usa una **struttura
 * circolare**: le venti squadre si dispongono in cerchio **alternando i campionati**
 * (posizione `i` ospita il campionato `i mod 5`), e ciascuna affronta le sei più vicine —
 * distanze 1, 2 e 3 in entrambi i sensi.
 *
 * Ne discendono gratuitamente tutte le proprietà volute: ogni squadra gioca esattamente 6
 * partite contro 6 avversarie diverse, **3 in casa e 3 fuori**, e poiché le distanze usate
 * (1, 2, 3) non sono multipli di 5, due squadre dello stesso campionato non si incontrano
 * **mai**. Nessun tentativo, nessun vicolo cieco, nessun caso limite da gestire.
 */
import { shuffle } from "../random";
import { simulateOpponentMatch, type TeamStrength } from "./matchModel";
import { strengthOf, type LeagueTeam } from "./leagueState";

/** Turni del girone unico. */
export const GROUP_ROUNDS = 6;
/** Quante squadre passano dal girone al tabellone. */
export const KNOCKOUT_TEAMS = 8;
/** Distanze sul cerchio che definiscono gli avversari del girone. */
const GROUP_DISTANCES = [1, 2, 3] as const;

export type CupStage = "girone" | "quarti" | "semifinali" | "finale";

export interface CupFixture {
  home: number;
  away: number;
}

export interface CupTally {
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface CupState {
  teams: LeagueTeam[];
  /** I 6 turni del girone, ciascuno con 10 partite. */
  groupCalendar: CupFixture[][];
  groupRound: number;
  tallies: CupTally[];
  /** Indici delle squadre ancora in corsa nel tabellone, in ordine di accoppiamento. */
  bracket: number[];
  stage: CupStage;
  /** Risultati del tabellone, per la schermata della coppa. */
  knockoutLog: KnockoutResult[];
  winner?: number;
}

export interface KnockoutResult {
  stage: CupStage;
  home: number;
  away: number;
  goalsHome: number;
  goalsAway: number;
  /** Valorizzati solo se si è andati oltre i tempi regolamentari. */
  extraTime?: { goalsHome: number; goalsAway: number };
  penalties?: { home: number; away: number };
  winner: number;
}

function emptyTally(): CupTally {
  return { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
}

function record(tally: CupTally, goalsFor: number, goalsAgainst: number) {
  tally.goalsFor += goalsFor;
  tally.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) tally.wins++;
  else if (goalsFor === goalsAgainst) tally.draws++;
  else tally.losses++;
}

/**
 * Dispone le squadre in cerchio alternando i campionati.
 *
 * È il passaggio che rende il vincolo di nazionalità automatico: con 5 campionati da 4
 * squadre, mettere in posizione `i` una squadra del campionato `i mod 5` garantisce che due
 * connazionali distino sempre un multiplo di 5, mentre gli accoppiamenti usano solo le
 * distanze 1, 2 e 3.
 */
function seatByLeague(teams: LeagueTeam[], leagueOf: (team: LeagueTeam) => string, random: () => number): number[] {
  const byLeague = new Map<string, number[]>();
  teams.forEach((team, index) => {
    const league = leagueOf(team);
    const list = byLeague.get(league);
    if (list) list.push(index);
    else byLeague.set(league, [index]);
  });

  // Ordine dei campionati e squadre dentro ciascuno: entrambi sorteggiati, così due carriere
  // (e due stagioni) non hanno mai lo stesso tabellone.
  const leagues = shuffle([...byLeague.keys()], random);
  const pools = leagues.map((league) => shuffle(byLeague.get(league)!, random));

  const seating: number[] = [];
  const maxDepth = Math.max(...pools.map((p) => p.length));
  for (let depth = 0; depth < maxDepth; depth++) {
    for (const pool of pools) {
      const index = pool[depth];
      if (index !== undefined) seating.push(index);
    }
  }
  return seating;
}

/**
 * Divide un ciclo in due accoppiamenti perfetti prendendo gli archi alternati.
 *
 * Un ciclo di lunghezza pari si scompone sempre in due accoppiamenti: è ciò che permette di
 * distribuire i 20 archi di ciascuna distanza su esattamente 2 turni da 10 partite.
 */
function cycleToMatchings(cycle: number[]): [number, number][][] {
  const even: [number, number][] = [];
  const odd: [number, number][] = [];
  for (let i = 0; i < cycle.length; i++) {
    const pair: [number, number] = [cycle[i]!, cycle[(i + 1) % cycle.length]!];
    (i % 2 === 0 ? even : odd).push(pair);
  }
  return [even, odd];
}

/** I turni del girone: per ogni distanza, i suoi archi divisi in due giornate. */
function buildGroupCalendar(seating: number[]): CupFixture[][] {
  const size = seating.length;
  const rounds: CupFixture[][] = [];

  for (const distance of GROUP_DISTANCES) {
    const visited = new Set<number>();
    const matchings: [number, number][][] = [[], []];

    for (let start = 0; start < size; start++) {
      if (visited.has(start)) continue;
      // Il ciclo generato da questa distanza a partire da `start`.
      const cycle: number[] = [];
      let current = start;
      do {
        cycle.push(current);
        visited.add(current);
        current = (current + distance) % size;
      } while (current !== start);

      const [a, b] = cycleToMatchings(cycle);
      matchings[0]!.push(...a!);
      matchings[1]!.push(...b!);
    }

    for (const matching of matchings) {
      rounds.push(
        matching.map(([from, to]) => ({ home: seating[from]!, away: seating[to]! })),
      );
    }
  }

  return rounds;
}

export interface CupSetup {
  teams: LeagueTeam[];
  /** Campionato di provenienza di ciascuna squadra, per alternarli nel cerchio. */
  leagueOf: (team: LeagueTeam) => string;
  random: () => number;
}

export function createCupState({ teams, leagueOf, random }: CupSetup): CupState {
  if (teams.length % 2 !== 0) {
    throw new Error(`La Corona richiede un numero pari di squadre, ricevute ${teams.length}`);
  }
  const seating = seatByLeague(teams, leagueOf, random);
  return {
    teams,
    groupCalendar: buildGroupCalendar(seating),
    groupRound: 0,
    tallies: teams.map(() => emptyTally()),
    bracket: [],
    stage: "girone",
    knockoutLog: [],
  };
}

/** Gioca un turno del girone. */
export function simulateGroupRound(
  state: CupState,
  random: () => number,
): { state: CupState; results: (CupFixture & { goalsHome: number; goalsAway: number })[] } {
  const round = state.groupCalendar[state.groupRound];
  if (!round) return { state, results: [] };

  const results = round.map(({ home, away }) => {
    const { goalsA, goalsB } = simulateOpponentMatch(
      strengthOf(state.teams[home]!),
      strengthOf(state.teams[away]!),
      random,
    );
    record(state.tallies[home]!, goalsA, goalsB);
    record(state.tallies[away]!, goalsB, goalsA);
    return { home, away, goalsHome: goalsA, goalsAway: goalsB };
  });

  state.groupRound += 1;
  return { state, results };
}

export interface CupStandingRow {
  position: number;
  teamIndex: number;
  teamId: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Passa il turno? Vero per le prime `KNOCKOUT_TEAMS`. */
  qualified: boolean;
}

export function cupStandings(state: CupState): CupStandingRow[] {
  return state.teams
    .map((team, teamIndex) => {
      const tally = state.tallies[teamIndex]!;
      return {
        position: 0,
        teamIndex,
        teamId: team.id,
        name: team.name,
        played: tally.wins + tally.draws + tally.losses,
        wins: tally.wins,
        draws: tally.draws,
        losses: tally.losses,
        goalsFor: tally.goalsFor,
        goalsAgainst: tally.goalsAgainst,
        goalDifference: tally.goalsFor - tally.goalsAgainst,
        points: tally.wins * 3 + tally.draws,
        qualified: false,
      };
    })
    .sort(
      (x, y) =>
        y.points - x.points ||
        y.goalDifference - x.goalDifference ||
        y.goalsFor - x.goalsFor ||
        x.name.localeCompare(y.name),
    )
    .map((row, index) => ({ ...row, position: index + 1, qualified: index < KNOCKOUT_TEAMS }));
}

/**
 * Chiude il girone e forma il tabellone: 1-8, 2-7, 3-6, 4-5.
 *
 * Chi si è classificato meglio gioca in casa: è l'unico vantaggio che il girone concede, e
 * serve a dare un senso sportivo alle sei partite iniziali oltre alla qualificazione.
 */
export function startKnockout(state: CupState): CupState {
  const qualified = cupStandings(state).filter((row) => row.qualified);
  const bracket: number[] = [];
  for (let i = 0; i < qualified.length / 2; i++) {
    bracket.push(qualified[i]!.teamIndex, qualified[qualified.length - 1 - i]!.teamIndex);
  }
  state.bracket = bracket;
  state.stage = "quarti";
  return state;
}

/** Il turno successivo del tabellone. */
function nextStage(stage: CupStage): CupStage {
  if (stage === "quarti") return "semifinali";
  if (stage === "semifinali") return "finale";
  return "finale";
}

/**
 * Nei supplementari i gol attesi si riducono di un terzo: sono trenta minuti, non novanta, e
 * si giocano con due squadre stanche e prudenti.
 */
const EXTRA_TIME_FACTOR = 1 / 3;

function scaleStrength(strength: TeamStrength, factor: number): TeamStrength {
  // Ridurre i gol attesi passa dall'abbassare l'attacco: la scala del motore è esponenziale,
  // quindi `ln(factor) * GOAL_SCALE` è lo spostamento equivalente. Si usa un'approssimazione
  // volutamente semplice — sono trenta minuti di supplementari, non il cuore del bilanciamento.
  return { attack: strength.attack + Math.log(factor) * 15, defence: strength.defence };
}

/**
 * Gioca un turno del tabellone (secco). Pareggio → supplementari → rigori.
 *
 * I rigori sono **50/50**, dichiaratamente una lotteria: far vincere il più forte anche dal
 * dischetto toglierebbe alla coppa proprio ciò che la rende memorabile.
 */
export function simulateKnockoutRound(
  state: CupState,
  random: () => number,
): { state: CupState; results: KnockoutResult[] } {
  if (state.stage === "girone" || state.bracket.length === 0) return { state, results: [] };

  const results: KnockoutResult[] = [];
  const winners: number[] = [];

  for (let i = 0; i < state.bracket.length; i += 2) {
    const home = state.bracket[i]!;
    const away = state.bracket[i + 1]!;
    const homeStrength = strengthOf(state.teams[home]!);
    const awayStrength = strengthOf(state.teams[away]!);

    const { goalsA, goalsB } = simulateOpponentMatch(homeStrength, awayStrength, random);
    const result: KnockoutResult = {
      stage: state.stage,
      home,
      away,
      goalsHome: goalsA,
      goalsAway: goalsB,
      winner: goalsA > goalsB ? home : away,
    };

    if (goalsA === goalsB) {
      const extra = simulateOpponentMatch(
        scaleStrength(homeStrength, EXTRA_TIME_FACTOR),
        scaleStrength(awayStrength, EXTRA_TIME_FACTOR),
        random,
      );
      result.extraTime = { goalsHome: extra.goalsA, goalsAway: extra.goalsB };
      if (extra.goalsA !== extra.goalsB) {
        result.winner = extra.goalsA > extra.goalsB ? home : away;
      } else {
        const homeWins = random() < 0.5;
        result.penalties = homeWins ? { home: 5, away: 4 } : { home: 4, away: 5 };
        result.winner = homeWins ? home : away;
      }
    }

    results.push(result);
    winners.push(result.winner);
  }

  state.knockoutLog.push(...results);

  if (state.stage === "finale") {
    state.winner = winners[0];
    state.bracket = [];
  } else {
    state.bracket = winners;
    state.stage = nextStage(state.stage);
  }

  return { state, results };
}

/** A che punto è arrivata una squadra: serve al budget di fine stagione e al resoconto. */
export type CupOutcome = "vittoria" | "finale" | "semifinale" | "quarti" | "girone" | "assente";

export function cupOutcomeOf(state: CupState, teamIndex: number): CupOutcome {
  if (!state.teams[teamIndex]) return "assente";
  if (state.winner === teamIndex) return "vittoria";

  const stages = state.knockoutLog.filter((r) => r.home === teamIndex || r.away === teamIndex);
  if (stages.length === 0) return "girone";
  const last = stages[stages.length - 1]!;
  if (last.stage === "finale") return "finale";
  if (last.stage === "semifinali") return "semifinale";
  return "quarti";
}
