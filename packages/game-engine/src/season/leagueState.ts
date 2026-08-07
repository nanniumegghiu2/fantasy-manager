/**
 * Campionato come **stato che avanza una giornata alla volta**, invece che come una singola
 * chiamata che simula l'intera stagione.
 *
 * La Modalità Classica poteva permettersi di calcolare tutte le 38 giornate in un colpo solo
 * e rivelarle in sequenza: nulla cambia fra una giornata e l'altra. La DS mode no — fra una
 * giornata e la successiva arrivano infortuni, cala il morale, e a metà stagione si apre una
 * finestra di mercato che cambia la forza della squadra. Pre-simulare tutto sarebbe una
 * bugia: i risultati di aprile sarebbero già decisi prima del mercato di gennaio.
 *
 * `simulateLeagueSeason` resta e continua a funzionare come prima: è diventata un wrapper
 * sopra questi pezzi. Il **consumo del generatore casuale è identico** a quello di prima
 * (stesso ordine: sorteggio del calendario, poi le partite di ogni giornata nell'ordine degli
 * accoppiamenti), e un characterization test congela l'output esatto per dimostrarlo.
 */
import { shuffle } from "../random";
import {
  simulateMatch,
  simulateOpponentMatch,
  type MatchResult,
  type ScorerCandidate,
  type TeamStrength,
} from "./matchModel";

/** Numero di squadre del campionato della Modalità Classica: la propria più 19 avversarie. */
export const LEAGUE_SIZE = 20;

export const USER_TEAM_ID = "__user__";

/** Avversaria del campionato: un club reale del pool, con la forza della sua rosa migliore. */
export interface LeagueTeam {
  id: string;
  name: string;
  rating: number;
  /**
   * Attacco e difesa separati, per far pesare la fisionomia della squadra sui risultati.
   * Se mancano si usa `rating` su entrambi i lati (squadra equilibrata).
   */
  strength?: TeamStrength;
  /** Marcatori reali del club: danno un nome ai gol che questa squadra segna contro di noi. */
  scorers?: ScorerCandidate[];
}

export interface StandingRow {
  position: number;
  teamId: string;
  name: string;
  /** Vero solo per la riga della squadra del giocatore, da evidenziare in classifica. */
  isUser: boolean;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface LeagueSeason {
  /** Le partite della propria squadra, giornata per giornata. */
  userMatches: MatchResult[];
  /** Nome dell'avversaria di ciascuna giornata, stesso indice di `userMatches`. */
  userOpponents: string[];
  standings: StandingRow[];
}

/** Un accoppiamento di giornata, come coppia di indici in `LeagueState.teams`. */
export interface LeagueFixture {
  home: number;
  away: number;
}

export interface Tally {
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

/**
 * Lo stato di un campionato in corso. È volutamente **serializzabile**: contiene solo numeri
 * e riferimenti, così una carriera può essere salvata a metà stagione e ripresa senza dover
 * conservare lo stato interno di un generatore casuale.
 */
export interface LeagueState {
  teams: LeagueTeam[];
  calendar: LeagueFixture[][];
  /** Giornate già giocate. */
  round: number;
  tallies: Tally[];
}

function emptyTally(): Tally {
  return { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
}

function record(tally: Tally, goalsFor: number, goalsAgainst: number) {
  tally.goalsFor += goalsFor;
  tally.goalsAgainst += goalsAgainst;
  if (goalsFor > goalsAgainst) tally.wins++;
  else if (goalsFor === goalsAgainst) tally.draws++;
  else tally.losses++;
}

/** Forza di una squadra del campionato, con `rating` su entrambi i lati se non specificata. */
export function strengthOf(team: LeagueTeam): TeamStrength {
  return team.strength ?? { attack: team.rating, defence: team.rating };
}

/**
 * Calendario all'italiana con il metodo del cerchio: `size - 1` giornate di andata in cui
 * ogni squadra incontra tutte le altre una volta, poi il ritorno con gli stessi
 * accoppiamenti. Con 20 squadre fa 38 giornate, con 18 ne fa 34.
 *
 * **Sorteggiato, non fisso.** Il metodo del cerchio da solo produce sempre la stessa sequenza
 * di avversari. Si sorteggiano quindi la posizione delle squadre nel cerchio (`seating`) e
 * l'ordine delle giornate, andata e ritorno separatamente. Gli accoppiamenti restano corretti
 * — ogni squadra incontra ogni altra esattamente due volte — cambia solo *quando*.
 */
function roundRobinRounds(size: number, random: () => number): [number, number][][] {
  const seating = shuffle(
    Array.from({ length: size }, (_, i) => i),
    random,
  );
  const fixed = 0;
  let rotating = Array.from({ length: size - 1 }, (_, i) => i + 1);
  const rounds: [number, number][][] = [];

  for (let round = 0; round < size - 1; round++) {
    const pairs: [number, number][] = [[seating[fixed]!, seating[rotating[0]!]!]];
    for (let i = 1; i < size / 2; i++) {
      pairs.push([seating[rotating[i]!]!, seating[rotating[rotating.length - i]!]!]);
    }
    rounds.push(pairs);
    rotating = [rotating[rotating.length - 1]!, ...rotating.slice(0, -1)];
  }

  return [...shuffle(rounds, random), ...shuffle(rounds, random)];
}

/**
 * Prepara un campionato: sorteggia il calendario e azzera la classifica.
 *
 * Il numero di squadre è quello ricevuto, non una costante: i campionati veri non hanno tutti
 * la stessa taglia (Bundesliga e Ligue 1 ne hanno 18, quindi 34 giornate). Deve però essere
 * **pari**, altrimenti il metodo del cerchio lascerebbe una squadra senza avversario a ogni
 * giornata.
 */
export function createLeagueState(teams: LeagueTeam[], random: () => number): LeagueState {
  if (teams.length % 2 !== 0) {
    throw new Error(`Un campionato deve avere un numero pari di squadre, ricevute ${teams.length}`);
  }
  return {
    teams,
    calendar: roundRobinRounds(teams.length, random).map((round) =>
      round.map(([home, away]) => ({ home, away })),
    ),
    round: 0,
    tallies: teams.map(() => emptyTally()),
  };
}

/** Numero totale di giornate del campionato. */
export function totalRounds(state: LeagueState): number {
  return state.calendar.length;
}

/** Il risultato di una singola partita di giornata. */
export interface MatchdayFixtureResult {
  home: number;
  away: number;
  goalsHome: number;
  goalsAway: number;
  /**
   * Dettaglio completo (marcatori, minuti, eventi) presente **solo** per la partita della
   * squadra seguita. Le altre 9 partite di giornata servono solo alla classifica, e
   * generarne gli eventi costerebbe estrazioni casuali per informazioni che nessuno legge.
   */
  detail?: MatchResult;
}

export interface MatchdayOptions {
  /**
   * Indice della squadra "seguita": la sua partita viene simulata in dettaglio e restituita
   * come `MatchResult` dal suo punto di vista. Di default è la squadra 0.
   */
  followedIndex?: number;
  /** Pool di marcatori della squadra seguita. */
  followedScorers?: ScorerCandidate[];
}

/**
 * Gioca **una** giornata e restituisce lo stato aggiornato.
 *
 * Lo stato viene modificato in posto (le `tallies` sono accumulatori) e restituito, così chi
 * chiama può ignorare la distinzione: è comunque lo stesso oggetto.
 */
export function simulateMatchday(
  state: LeagueState,
  random: () => number,
  options: MatchdayOptions = {},
): { state: LeagueState; results: MatchdayFixtureResult[]; followedResult?: MatchResult; followedOpponent?: string } {
  const round = state.calendar[state.round];
  if (!round) return { state, results: [] };

  const followedIndex = options.followedIndex ?? 0;
  const followedScorers = options.followedScorers ?? [];
  const results: MatchdayFixtureResult[] = [];
  let followedResult: MatchResult | undefined;
  let followedOpponent: string | undefined;

  for (const { home, away } of round) {
    if (home === followedIndex || away === followedIndex) {
      const opponentIndex = home === followedIndex ? away : home;
      const opponent = state.teams[opponentIndex]!;
      const match = simulateMatch(
        strengthOf(state.teams[followedIndex]!),
        strengthOf(opponent),
        followedScorers,
        random,
        opponent.scorers ?? [],
      );
      followedResult = match;
      followedOpponent = opponent.name;
      record(state.tallies[followedIndex]!, match.goalsFor, match.goalsAgainst);
      record(state.tallies[opponentIndex]!, match.goalsAgainst, match.goalsFor);
      results.push({
        home,
        away,
        goalsHome: home === followedIndex ? match.goalsFor : match.goalsAgainst,
        goalsAway: away === followedIndex ? match.goalsFor : match.goalsAgainst,
        detail: match,
      });
      continue;
    }

    const { goalsA, goalsB } = simulateOpponentMatch(
      strengthOf(state.teams[home]!),
      strengthOf(state.teams[away]!),
      random,
    );
    record(state.tallies[home]!, goalsA, goalsB);
    record(state.tallies[away]!, goalsB, goalsA);
    results.push({ home, away, goalsHome: goalsA, goalsAway: goalsB });
  }

  state.round += 1;
  return { state, results, followedResult, followedOpponent };
}

/** La classifica attuale, ordinata per punti → differenza reti → gol fatti → nome. */
export function buildStandings(state: LeagueState, userIndex = 0): StandingRow[] {
  return state.teams
    .map((team, index) => {
      const tally = state.tallies[index]!;
      return {
        position: 0,
        teamId: team.id,
        name: team.name,
        isUser: index === userIndex,
        played: tally.wins + tally.draws + tally.losses,
        wins: tally.wins,
        draws: tally.draws,
        losses: tally.losses,
        goalsFor: tally.goalsFor,
        goalsAgainst: tally.goalsAgainst,
        goalDifference: tally.goalsFor - tally.goalsAgainst,
        points: tally.wins * 3 + tally.draws,
      };
    })
    .sort(
      (x, y) =>
        y.points - x.points ||
        y.goalDifference - x.goalDifference ||
        y.goalsFor - x.goalsFor ||
        x.name.localeCompare(y.name),
    )
    .map((row, index) => ({ ...row, position: index + 1 }));
}

/**
 * Porta le avversarie a esattamente `LEAGUE_SIZE - 1`, tagliando quelle in eccesso o
 * aggiungendo squadre di riempimento se il pool ha meno club del necessario.
 *
 * Serve **solo alla Modalità Classica**, dove il campionato è sempre a 20 squadre e 38
 * giornate (obiettivo 38-0-0, barra di avanzamento, `isPerfectRecord`). La DS mode usa
 * invece la taglia reale del campionato scelto e non riempie nulla: la Bundesliga ha 18
 * squadre vere, non 19 più una "Avversaria 20".
 */
export function fillLeague(opponents: LeagueTeam[]): LeagueTeam[] {
  const needed = LEAGUE_SIZE - 1;
  if (opponents.length >= needed) return opponents.slice(0, needed);

  const averageRating =
    opponents.length > 0 ? opponents.reduce((sum, t) => sum + t.rating, 0) / opponents.length : 75;

  return [
    ...opponents,
    ...Array.from({ length: needed - opponents.length }, (_, i) => ({
      id: `filler-${i}`,
      name: `Avversaria ${opponents.length + i + 1}`,
      rating: Math.round(averageRating),
    })),
  ];
}
