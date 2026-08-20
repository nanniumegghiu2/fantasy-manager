/**
 * **Le statistiche di tutta la lega**, non solo della nostra rosa.
 *
 * ⚠️ Richiesta dell'utente: *"voglio poter vedere le statistiche di campionati e coppe"* — cioè
 * capocannonieri, assist e medie voto di **tutti**, non solo dei propri. Il pezzo che mancava è
 * che le partite fra squadre del computer (`simulateOpponentMatch`) restituiscono **due numeri e
 * basta**: nessun marcatore, quindi una classifica marcatori di lega era letteralmente
 * impossibile da costruire.
 *
 * ## Il vincolo che decide l'architettura
 *
 * `simulateMatchday` è condivisa con la Modalità Classica e protetta da un characterization test
 * che congela l'esatta sequenza del generatore casuale — su cui poggia la calibrazione del
 * 38-0-0. Attribuire i marcatori **dentro** quella funzione consumerebbe estrazioni e
 * cambierebbe ogni risultato di ogni stagione già calibrata.
 *
 * Quindi si attribuiscono **qui**, a valle: si prendono i gol che la giornata ha già prodotto e
 * si assegnano ai `scorers` che ogni `LeagueTeam` porta già con sé, con un flusso casuale
 * separato (`derivedRandom(seed, "marcatoriIA", ...)`). Zero impatto sul consumo del generatore,
 * characterization test valido senza toccarlo.
 *
 * ## Cosa costa al salvataggio
 *
 * Una mappa `playerId → {g, a, voti, presenze}` per stagione: qualche centinaio di voci, non
 * migliaia — solo chi ha effettivamente segnato o giocato compare. Si azzera a ogni stagione.
 */
import { derivedRandom } from "../random";
import type { LeagueTeam, MatchdayFixtureResult } from "../season/leagueState";
import type { ScorerCandidate } from "../season/matchModel";

/** Il contributo di un giocatore in una competizione, accumulato giornata per giornata. */
export interface PlayerTally {
  goals: number;
  assists: number;
  /** Somma dei voti e su quante gare: la media si ricava da qui, come per la propria rosa. */
  ratingSum: number;
  ratedAppearances: number;
}

/** Le statistiche di una competizione: una voce per giocatore che ha fatto qualcosa. */
export type CompetitionStats = Record<string, PlayerTally>;

function tally(stats: CompetitionStats, id: string): PlayerTally {
  const t = stats[id] ?? { goals: 0, assists: 0, ratingSum: 0, ratedAppearances: 0 };
  stats[id] = t;
  return t;
}

/** Pesca un giocatore dal pool con probabilità proporzionale al peso. */
function pesca(pool: readonly ScorerCandidate[], random: () => number): string | null {
  const totale = pool.reduce((s, c) => s + c.weight, 0);
  if (pool.length === 0 || totale <= 0) return null;
  let roll = random() * totale;
  for (const c of pool) {
    roll -= c.weight;
    if (roll <= 0) return c.id;
  }
  return pool[pool.length - 1]!.id;
}

export interface AccumulateInput {
  stats: CompetitionStats;
  /** I risultati di **tutte** le partite della giornata, non solo la nostra. */
  results: readonly MatchdayFixtureResult[];
  teams: readonly LeagueTeam[];
  /** Indice della nostra squadra: i suoi gol li registra la carriera, non questa funzione. */
  followedIndex: number;
  seed: string;
  season: number;
  round: number;
}

/**
 * Attribuisce i gol delle partite **fra squadre del computer** ai loro marcatori, e li accumula.
 *
 * La nostra partita è esclusa di proposito: i nostri gol hanno già un marcatore vero
 * (`MatchResult.scorerIds`) ed è la carriera a registrarli sulla rosa. Contarli anche qui li
 * raddoppierebbe.
 */
export function accumulateMatchday(input: AccumulateInput): CompetitionStats {
  const { stats, results, teams, followedIndex, seed, season, round } = input;
  const random = derivedRandom(seed, "marcatoriIA", season, round);

  for (const fixture of results) {
    if (fixture.home === followedIndex || fixture.away === followedIndex) continue;

    for (const [indice, gol] of [
      [fixture.home, fixture.goalsHome] as const,
      [fixture.away, fixture.goalsAway] as const,
    ]) {
      const squadra = teams[indice];
      const pool = squadra?.scorers ?? [];
      if (pool.length === 0) continue;
      for (let g = 0; g < gol; g++) {
        const marcatore = pesca(pool, random);
        if (!marcatore) continue;
        tally(stats, marcatore).goals += 1;
        // L'assist: stesso pool, mai lo stesso uomo, e non su ogni gol.
        if (random() < 0.68) {
          const assistman = pesca(
            pool.filter((c) => c.id !== marcatore),
            random,
          );
          if (assistman) tally(stats, assistman).assists += 1;
        }
      }
    }
  }

  return stats;
}

/** Registra un contributo dei nostri: gol, assist e voto finiscono nella stessa classifica. */
export function recordOwn(
  stats: CompetitionStats,
  playerId: string,
  contributo: { goals?: number; assists?: number; rating?: number | null },
): void {
  const t = tally(stats, playerId);
  t.goals += contributo.goals ?? 0;
  t.assists += contributo.assists ?? 0;
  if (contributo.rating !== null && contributo.rating !== undefined) {
    t.ratingSum += contributo.rating;
    t.ratedAppearances += 1;
  }
}

export interface LeaderRow {
  playerId: string;
  goals: number;
  assists: number;
  /** `null` finché non ha una partita valutata: una media su zero gare non esiste. */
  averageRating: number | null;
}

/** La classifica di una statistica, dalla migliore. */
export function leaders(
  stats: CompetitionStats,
  by: "goals" | "assists" | "rating",
  limit = 20,
  /** Per la media voto: sotto queste presenze non si entra in classifica. */
  minRated = 5,
): LeaderRow[] {
  const righe: LeaderRow[] = Object.entries(stats).map(([playerId, t]) => ({
    playerId,
    goals: t.goals,
    assists: t.assists,
    averageRating: t.ratedAppearances > 0 ? t.ratingSum / t.ratedAppearances : null,
  }));

  if (by === "rating") {
    return righe
      .filter((r) => r.averageRating !== null && (stats[r.playerId]?.ratedAppearances ?? 0) >= minRated)
      .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0))
      .slice(0, limit);
  }

  const chiave = by === "goals" ? "goals" : "assists";
  return righe
    .filter((r) => r[chiave] > 0)
    // A parità, davanti chi ha fatto anche l'altra cosa: è il criterio che si usa davvero.
    .sort((a, b) => b[chiave] - a[chiave] || b.goals + b.assists - (a.goals + a.assists))
    .slice(0, limit);
}
