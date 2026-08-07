/**
 * Simulazione del campionato "38-0-0" per la Modalità Classica Rapida Offline
 * (CLAUDE.md sez. 3.5).
 *
 * Il modello è **a gol attesi**: ogni partita confronta l'attacco di una squadra con la
 * difesa dell'altra (`expectedGoals`) e ne estrae i gol da una Poisson. Vale per tutte le
 * partite del campionato, la propria compresa — non esiste una curva privilegiata per il
 * giocatore. Ne discendono, senza regole ad hoc, le tre proprietà volute: una rosa scarsa
 * retrocede davvero, una con attacco forte e difesa fragile segna e subisce tanto, e una
 * rosa fortissima vince quasi sempre ma mai per certo, il che tiene il 38-0-0
 * difficilissimo e non impossibile.
 *
 * **Dove vive cosa.** Questo file è diventato uno strato sottile sopra due moduli, per poter
 * servire anche la DS mode senza duplicare il modello:
 *  - `season/matchModel.ts` — la singola partita (gol attesi, Poisson, marcatori, eventi);
 *  - `season/leagueState.ts` — il campionato come stato che avanza **una giornata alla
 *    volta**, indispensabile a una carriera in cui fra una giornata e l'altra cambiano
 *    infortuni, morale e mercato.
 *
 * Le costanti restano quelle tarate sui test statistici in fondo a
 * `__tests__/championship.test.ts` e con `pnpm calibrate`.
 */
import type { Difficulty } from "./draft";
import {
  balancedStrength,
  simulateMatch,
  type MatchResult,
  type ScorerCandidate,
  type TeamStrength,
} from "./season/matchModel";
import {
  buildStandings,
  createLeagueState,
  fillLeague,
  simulateMatchday,
  USER_TEAM_ID,
  type LeagueSeason,
  type LeagueTeam,
} from "./season/leagueState";

export * from "./season/matchModel";
export * from "./season/leagueState";

const TOTAL_MATCHES = 38;

export interface ChampionshipResult {
  wins: number;
  draws: number;
  losses: number;
}

/**
 * Forza di riferimento dell'avversario medio: è il livello attorno a cui ruota la
 * calibrazione, e corrisponde grossomodo alla media dei club dei Big 5 in database.
 */
export const AVERAGE_LEAGUE_STRENGTH = 78;

/**
 * Quanto la difficoltà scelta in setup sposta la forza delle **avversarie**, in punti di
 * Overall su attacco e difesa.
 *
 * Prima la difficoltà agiva solo sul draft (numero di redraft e qualità dei pacchetti,
 * sez. 3.2), quindi il campionato era identico a tutti e tre i livelli: in Superlega anche
 * a "facile" si affrontavano i 19 club più forti d'Europa e vincere era un'impresa. Con
 * questo modificatore la difficoltà governa anche l'avversario, che è ciò che il giocatore
 * si aspetta scegliendola.
 *
 * Valori tarati con `pnpm calibrate-difficolta` (`packages/data-scripts`) sui tre obiettivi
 * dichiarati dall'utente: a facile vincere il campionato dev'essere la norma ed è il livello
 * in cui il 38-0-0 è più abbordabile; a normale una via di mezzo; a difficile vincere è già
 * impegnativo e il 38-0-0 un'impresa.
 */
export const DIFFICULTY_OPPONENT_MODIFIER: Record<Difficulty, number> = {
  facile: -11,
  normale: -1,
  difficile: 2,
};

/** Le 38 partite del campionato, una per una (risultato + marcatori), non solo l'aggregato. */
export function simulateSeasonMatches(
  strength: TeamStrength | number,
  scorerPool: ScorerCandidate[],
  random: () => number = Math.random,
  /** Forza dell'avversario tipo: di default una squadra di metà classifica. */
  opponent: TeamStrength = balancedStrength(AVERAGE_LEAGUE_STRENGTH),
): MatchResult[] {
  const own = typeof strength === "number" ? balancedStrength(strength) : strength;
  return Array.from({ length: TOTAL_MATCHES }, () =>
    simulateMatch(own, opponent, scorerPool, random),
  );
}

export function aggregateRecord(matches: MatchResult[]): ChampionshipResult {
  return {
    wins: matches.filter((m) => m.outcome === "win").length,
    draws: matches.filter((m) => m.outcome === "draw").length,
    losses: matches.filter((m) => m.outcome === "loss").length,
  };
}

export function simulateChampionship(
  strength: TeamStrength | number,
  random: () => number = Math.random,
): ChampionshipResult {
  return aggregateRecord(simulateSeasonMatches(strength, [], random));
}

export function isPerfectRecord(result: ChampionshipResult): boolean {
  return result.wins === TOTAL_MATCHES && result.draws === 0 && result.losses === 0;
}

/**
 * Simula l'intero campionato: le 38 partite della propria squadra **più** quelle di tutte le
 * altre, per poter mostrare una classifica completa a fine stagione.
 *
 * **Una sola regola per tutti**: ogni partita, la propria e quelle fra avversarie, nasce dal
 * confronto attacco-contro-difesa e da un'estrazione di Poisson. Se la rosa che hai costruito
 * è scarsa retrocedi davvero; se ha un attacco stellare e una difesa fragile segni e subisci
 * tanto; e se è fortissima vinci quasi sempre, ma **quasi** — la casualità di Poisson non
 * garantisce mai il 38-0-0, che resta il traguardo raro descritto in sez. 3.5.
 *
 * È ora un wrapper su `createLeagueState` + `simulateMatchday`, che è la forma di cui la DS
 * mode ha bisogno per avanzare una giornata alla volta. Il consumo del generatore casuale è
 * rimasto identico, e un characterization test congela l'output esatto per dimostrarlo.
 */
export function simulateLeagueSeason(
  squadStrength: TeamStrength | number,
  scorerPool: ScorerCandidate[],
  opponents: LeagueTeam[] = [],
  random: () => number = Math.random,
): LeagueSeason {
  const own = typeof squadStrength === "number" ? balancedStrength(squadStrength) : squadStrength;
  const teams: LeagueTeam[] = [
    {
      id: USER_TEAM_ID,
      name: "La tua squadra",
      rating: Math.round((own.attack + own.defence) / 2),
      strength: own,
    },
    ...fillLeague(opponents ?? []),
  ];

  const state = createLeagueState(teams, random);
  const userMatches: MatchResult[] = [];
  const userOpponents: string[] = [];

  while (state.round < state.calendar.length) {
    const { followedResult, followedOpponent } = simulateMatchday(state, random, {
      followedIndex: 0,
      followedScorers: scorerPool,
    });
    if (followedResult) {
      userMatches.push(followedResult);
      userOpponents.push(followedOpponent ?? "");
    }
  }

  return { userMatches, userOpponents, standings: buildStandings(state, 0) };
}
