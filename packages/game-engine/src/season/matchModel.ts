/**
 * Il modello di una singola partita: **gol attesi** dal confronto attacco-contro-difesa,
 * poi estrazione di Poisson.
 *
 * Estratto da `championship.ts` perché serve sia al campionato (`season/leagueState.ts`) sia
 * alle funzioni di stagione, e tenerlo in mezzo avrebbe creato una dipendenza circolare fra i
 * due. Le costanti restano quelle calibrate con `pnpm calibrate`: qui non cambia nulla, si
 * sposta soltanto.
 */
function randomInRange(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}


export interface ScorerCandidate {
  id: string;
  weight: number;
}


const PENALTY_PROBABILITY = 0.18;

export interface MatchEvent {
  minute: number;
  team: "for" | "against";
  kind: "goal" | "penalty";
  /**
   * Id del marcatore, pescato dal pool pesato della squadra che ha segnato: i propri
   * titolari per i gol fatti, i giocatori reali dell'avversaria di giornata per quelli
   * subiti. Null solo se la squadra che segna non ha un pool di marcatori (es.
   * `simulateSeasonMatches` senza campionato attorno).
   */
  scorerId: string | null;
}

export interface MatchResult {
  outcome: "win" | "draw" | "loss";
  goalsFor: number;
  goalsAgainst: number;
  /** Un id per gol segnato dalla propria squadra, pescato dal pool pesato. */
  scorerIds: string[];
  /** Gli stessi gol, in ordine cronologico, con minuto e tipo (gol/rigore) per la visualizzazione live. */
  events: MatchEvent[];
}

function pickScorerId(pool: ScorerCandidate[], random: () => number): string | null {
  const totalWeight = pool.reduce((sum, c) => sum + c.weight, 0);
  if (pool.length === 0 || totalWeight <= 0) return null;
  let roll = random() * totalWeight;
  for (const candidate of pool) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate.id;
  }
  // Ripiego per gli errori di arrotondamento in virgola mobile: il pool non è vuoto
  // (controllato sopra), quindi l'ultimo elemento esiste sempre.
  return pool[pool.length - 1]!.id;
}

/* -------------------------------------------------------------------------- */

/**
 * Forza offensiva e difensiva di una squadra, sulla stessa scala degli Overall.
 *
 * Perché due numeri invece di uno: con un rating unico una squadra con attacco 95 e difesa
 * 65 era indistinguibile da una equilibrata a 80, mentre nella realtà la prima segna tanto
 * **e** subisce tanto. Separando i due lati, la fisionomia della rosa costruita nel draft
 * si vede nei risultati.
 */
export interface TeamStrength {
  attack: number;
  defence: number;
}

/**
 * Gol attesi per squadra in una partita equilibrata: 1.2 per lato, cioè ~2.4 a partita.
 * Tarato insieme al tetto per tenere le goleade (4+ gol di una squadra) attorno al 7-8%
 * delle partite, come nei campionati veri — erano il difetto piu visibile del motore.
 */
export const BASE_EXPECTED_GOALS = 1.2;

/**
 * Quanti punti di scarto attacco-difesa servono per moltiplicare per `e` i gol attesi.
 * Valore basso = il campionato premia molto le differenze di forza; alto = più livellato.
 *
 * Insieme a `MAX_EXPECTED_GOALS` è la coppia che decide **due** proprietà in una volta sola:
 * quanto la classifica finale segue l'Overall della rosa, e quanto vale il 38-0-0. Tarata
 * con `pnpm calibrate` (`packages/data-scripts`) sul database reale, vedi sez. 3.5 di
 * CLAUDE.md. È anche la manopola che decide quanto sono frequenti le **goleade**: a 12 una
 * squadra da titolo faceva 110 gol in stagione con il 34% di partite sopra i 4 gol, a 15 fa
 * 92 gol e il 23%, a 18 scende a 81 e 18%. Il prezzo è sul 38-0-0 (4.2% a 12, 1.1% a 15,
 * 0.15% a 18), quindi le due cose si scelgono insieme.
 */
export const GOAL_SCALE = 15;

/**
 * Estremi dei gol attesi: sotto lo 0.15 nessuno segnerebbe mai, sopra i 4.75 i punteggi
 * diventano assurdi.
 *
 * Il tetto non è solo una protezione estetica: è la costante che morde nelle partite contro
 * le squadre più deboli, cioè proprio quelle che una rosa fortissima deve vincere **tutte**,
 * quindi pesa moltissimo sulla probabilità di stagione perfetta.
 */
export const MIN_EXPECTED_GOALS = 0.15;
export const MAX_EXPECTED_GOALS = 4.75;

/** Tetto di sicurezza sui gol di una singola squadra in una partita. */
const MAX_GOALS_PER_MATCH = 7;

/** Gol attesi di chi attacca con `attack` contro chi difende con `defence`. */
export function expectedGoals(attack: number, defence: number): number {
  const raw = BASE_EXPECTED_GOALS * Math.exp((attack - defence) / GOAL_SCALE);
  return Math.min(Math.max(raw, MIN_EXPECTED_GOALS), MAX_EXPECTED_GOALS);
}

/**
 * Estrazione da una distribuzione di Poisson (algoritmo di Knuth): è il modello standard
 * per i gol nel calcio, e porta con sé la dose di casualità che serve — una squadra
 * fortissima resta favorita ogni domenica ma può sempre inciampare in uno 0-0, ed è
 * esattamente questo a rendere il 38-0-0 difficilissimo ma non impossibile (sez. 3.5).
 */
function poissonSample(lambda: number, random: () => number): number {
  const limit = Math.exp(-lambda);
  let count = 0;
  let product = 1;
  do {
    count++;
    product *= random();
  } while (product > limit && count <= MAX_GOALS_PER_MATCH);
  return Math.min(count - 1, MAX_GOALS_PER_MATCH);
}

/**
 * Racconta un numero di gol **già dato** con marcatori e minuti: la parte di `simulateMatch`
 * che non decide nulla, solo narra. Estratta a parte perché serve anche a chi il numero di gol
 * lo conosce già da un'altra fonte (`careerCup.ts`, sez. rigori — il tabellino mostrato nel
 * Match Theatre deve raccontare lo stesso risultato che il tabellone ha già deciso, non uno
 * nuovo e indipendente).
 */
export function narrateGoals(
  goalsFor: number,
  goalsAgainst: number,
  scorerPool: ScorerCandidate[],
  random: () => number,
  opponentScorerPool: ScorerCandidate[] = [],
): MatchResult {
  const outcome: MatchResult["outcome"] =
    goalsFor > goalsAgainst ? "win" : goalsFor === goalsAgainst ? "draw" : "loss";

  const scorerIds: string[] = [];
  const events: MatchEvent[] = [];

  for (let i = 0; i < goalsFor; i++) {
    const scorerId = pickScorerId(scorerPool, random);
    if (scorerId) scorerIds.push(scorerId);
    events.push({
      minute: randomInRange(random, 1, 90),
      team: "for",
      kind: random() < PENALTY_PROBABILITY ? "penalty" : "goal",
      scorerId,
    });
  }

  for (let i = 0; i < goalsAgainst; i++) {
    events.push({
      minute: randomInRange(random, 1, 90),
      team: "against",
      kind: random() < PENALTY_PROBABILITY ? "penalty" : "goal",
      scorerId: pickScorerId(opponentScorerPool, random),
    });
  }

  events.sort((a, b) => a.minute - b.minute);

  return { outcome, goalsFor, goalsAgainst, scorerIds, events };
}

export function simulateMatch(
  strength: TeamStrength,
  opponent: TeamStrength,
  scorerPool: ScorerCandidate[],
  random: () => number,
  /**
   * Marcatori dell'avversaria di giornata: quando c'è, anche i gol subiti hanno un nome.
   * Vuoto di default — con un pool vuoto `pickScorerId` esce prima di consumare numeri
   * casuali.
   */
  opponentScorerPool: ScorerCandidate[] = [],
): MatchResult {
  const goalsFor = poissonSample(expectedGoals(strength.attack, opponent.defence), random);
  const goalsAgainst = poissonSample(expectedGoals(opponent.attack, strength.defence), random);
  return narrateGoals(goalsFor, goalsAgainst, scorerPool, random, opponentScorerPool);
}

/**
 * Attacco e difesa a partire da un solo Overall di squadra: usata quando non si hanno i
 * rating di reparto (es. test di calibrazione). Una squadra "media" ha i due lati uguali.
 */
export function balancedStrength(rating: number): TeamStrength {
  return { attack: rating, defence: rating };
}



/**
 * Partita tra due avversarie (non la propria squadra): **stesso identico modello** usato
 * per le nostre partite — gol attesi da attacco contro difesa, poi Poisson. Prima le due
 * cose erano scollegate (noi su una curva calibrata, loro su una sigmoide di differenza
 * rating), il che rendeva impossibile confrontare i risultati; ora la classifica è prodotta
 * da un'unica regola per tutti.
 */
export function simulateOpponentMatch(
  a: TeamStrength,
  b: TeamStrength,
  random: () => number,
): { goalsA: number; goalsB: number } {
  return {
    goalsA: poissonSample(expectedGoals(a.attack, b.defence), random),
    goalsB: poissonSample(expectedGoals(b.attack, a.defence), random),
  };
}
