/**
 * **Coppa Tricolore**: la coppa nazionale fra Serie A e Serie B.
 *
 * Nome originale, come impone CLAUDE.md sez. 2 — mai "Coppa Italia", che è un marchio.
 *
 * ## Formato: quaranta squadre, con preliminare
 *
 * Entrano **tutte** e quaranta, decisione dell'utente. Il tabellone si stringe così:
 *
 * | Turno | In campo | Chi entra |
 * |---|---|---|
 * | preliminare | 16 (8 sfide) | le 16 più deboli della seconda divisione |
 * | sedicesimi | 32 | 8 qualificate + 4 di B esentate + le 20 di A |
 * | ottavi | 16 | |
 * | quarti | 8 | |
 * | semifinale | 4 | |
 * | finale | 2 | |
 *
 * Cinque turni per un club di Serie A, sei per uno partito dal preliminare. I numeri tornano
 * per costruzione: 40 − 16 = 24 esentate, più le 8 che superano il preliminare, fa 32.
 *
 * ## Perché il sorteggio è libero
 *
 * Nessuna testa di serie, a nessun turno. È la scelta che rende la coppa interessante per chi
 * milita in Serie B: senza, le grandi si incontrerebbero solo in fondo e una piccola non
 * avrebbe mai la sua serata. La sorpresa non è un effetto collaterale del formato, è il
 * formato.
 *
 * ## Cosa distingue questo modulo dalla Corona
 *
 * La Corona (`cup.ts`) ha un girone, un vincolo di nazionalità nel sorteggio e tre soli turni
 * a eliminazione. Qui non serve nulla di tutto ciò — è tutta la stessa nazione e si va a
 * eliminazione dal primo minuto — ma la **singola sfida** è identica, e infatti si riusa
 * `resolveKnockoutTie`: novanta minuti, supplementari a intensità ridotta, rigori 50/50.
 */
import { shuffle } from "../random";
import { strengthOf, type LeagueTeam } from "./leagueState";
import { resolveKnockoutTie } from "./cup";

/** Le sei fasi della Coppa Tricolore, in ordine. */
export const NATIONAL_CUP_STAGES = [
  "preliminare",
  "sedicesimi",
  "ottavi",
  "quarti",
  "semifinale",
  "finale",
] as const;

export type NationalCupStage = (typeof NATIONAL_CUP_STAGES)[number];

/** Quanti turni ha il formato: serve al calendario per prenotare le settimane. */
export const TOTAL_NATIONAL_CUP_ROUNDS = NATIONAL_CUP_STAGES.length;

/** Quante squadre giocano il turno preliminare (le più deboli della seconda divisione). */
export const PRELIMINARY_TEAMS = 16;

export interface NationalCupTie {
  stage: NationalCupStage;
  /** Indici in `NationalCupState.teams`. */
  home: number;
  away: number;
  goalsHome: number;
  goalsAway: number;
  extraTime?: { goalsHome: number; goalsAway: number };
  penalties?: { home: number; away: number };
  winner: number;
}

export interface NationalCupState {
  teams: LeagueTeam[];
  /** Indici accoppiati a due a due: `[0,1]` giocano fra loro, `[2,3]` fra loro, e così via. */
  bracket: number[];
  /**
   * Chi salta il turno corrente ed entra al successivo.
   *
   * Serve **solo** al preliminare: le 24 esentate aspettano lì e si uniscono alle 8 qualificate
   * ai sedicesimi. Da lì in poi è sempre vuoto, perché il tabellone è una potenza di due.
   */
  byes: number[];
  stage: NationalCupStage;
  log: NationalCupTie[];
  winner?: number;
}

/**
 * Compone il tabellone iniziale.
 *
 * `secondDivisionIds` decide chi rischia il preliminare: si prendono le **più deboli** della
 * seconda divisione, che è il criterio più vicino a "le peggio classificate" senza dover
 * conservare la classifica dell'anno prima — un dato che alla prima stagione non esiste
 * nemmeno. È una stima dichiarata, come la griglia iniziale della Corona.
 */
export function createNationalCupState(input: {
  teams: LeagueTeam[];
  /** Id dei club di seconda divisione: solo fra loro si pesca chi gioca il preliminare. */
  secondDivisionIds: readonly string[];
  random: () => number;
}): NationalCupState {
  const { teams, secondDivisionIds, random } = input;
  const secondSet = new Set(secondDivisionIds);

  const indici = teams.map((_, i) => i);
  const diB = indici.filter((i) => secondSet.has(teams[i]!.id));
  const diA = indici.filter((i) => !secondSet.has(teams[i]!.id));

  // Le più deboli della seconda divisione al preliminare. `rating` è il metro con cui tutto il
  // motore misura un club, quindi qui non se ne introduce uno nuovo.
  const ordinateB = [...diB].sort((a, b) => teams[a]!.rating - teams[b]!.rating);
  const preliminare = ordinateB.slice(0, Math.min(PRELIMINARY_TEAMS, ordinateB.length));
  const esentate = [...ordinateB.slice(preliminare.length), ...diA];

  return {
    teams,
    bracket: shuffle(preliminare, random),
    byes: shuffle(esentate, random),
    stage: preliminare.length >= 2 ? "preliminare" : "sedicesimi",
    log: [],
  };
}

/**
 * Il turno successivo a quello dato.
 *
 * La finale non ha un dopo: restituirla come proprio successore è più sicuro che inventare
 * uno stato "finita", che poi andrebbe gestito da ogni chiamante — chi ha finito lo capisce
 * da `winner`, che è l'unica verità.
 */
export function nextNationalStage(stage: NationalCupStage): NationalCupStage {
  const i = NATIONAL_CUP_STAGES.indexOf(stage);
  return NATIONAL_CUP_STAGES[Math.min(i + 1, NATIONAL_CUP_STAGES.length - 1)]!;
}

/**
 * Gioca un turno intero e riaccoppia i sopravvissuti.
 *
 * Il sorteggio del turno successivo avviene **qui**, subito dopo aver conosciuto le vincenti:
 * è ciò che rende ogni turno un sorteggio libero invece di un tabellone deciso all'inizio.
 */
export function playNationalCupRound(
  state: NationalCupState,
  random: () => number,
): { state: NationalCupState; results: NationalCupTie[] } {
  if (state.winner !== undefined || state.bracket.length < 2) return { state, results: [] };

  const results: NationalCupTie[] = [];
  const vincenti: number[] = [];

  for (let i = 0; i + 1 < state.bracket.length; i += 2) {
    const home = state.bracket[i]!;
    const away = state.bracket[i + 1]!;
    const tie = resolveKnockoutTie(
      strengthOf(state.teams[home]!),
      strengthOf(state.teams[away]!),
      random,
    );

    const risultato: NationalCupTie = {
      stage: state.stage,
      home,
      away,
      goalsHome: tie.goalsHome,
      goalsAway: tie.goalsAway,
      winner: tie.homeAdvances ? home : away,
    };
    if (tie.extraTime) risultato.extraTime = tie.extraTime;
    if (tie.penalties) risultato.penalties = tie.penalties;

    results.push(risultato);
    vincenti.push(risultato.winner);
  }

  state.log.push(...results);

  if (state.stage === "finale") {
    state.winner = vincenti[0];
    state.bracket = [];
    return { state, results };
  }

  // Le esentate entrano ora (succede solo dopo il preliminare) e si mescolano alle qualificate:
  // il sorteggio è libero, quindi una neopromossa può pescare subito la corazzata.
  const prossime = shuffle([...vincenti, ...state.byes], random);
  state.byes = [];
  state.bracket = prossime;
  state.stage = nextNationalStage(state.stage);
  return { state, results };
}

/** Fin dove è arrivato un club: `undefined` se non partecipava. */
export function nationalCupOutcomeOf(
  state: NationalCupState,
  clubId: string,
): NationalCupStage | "vittoria" | undefined {
  const index = state.teams.findIndex((t) => t.id === clubId);
  if (index < 0) return undefined;
  if (state.winner === index) return "vittoria";

  // L'ultima sfida giocata da questo club dice dove si è fermato.
  for (let i = state.log.length - 1; i >= 0; i--) {
    const tie = state.log[i]!;
    if (tie.home === index || tie.away === index) {
      return tie.winner === index ? undefined : tie.stage;
    }
  }
  return undefined;
}

/**
 * Come è finita, con chi ci ha eliminati e il punteggio — stessa forma di `cupExitOf` per la
 * Corona, così il riepilogo di fine stagione legge le due coppe con lo stesso codice.
 */
export interface NationalCupExit {
  stage: NationalCupStage | "vittoria";
  eliminatedBy?: string;
  score?: { us: number; them: number };
  onPenalties?: boolean;
  afterExtraTime?: boolean;
}

export function nationalCupExitOf(
  state: NationalCupState,
  clubId: string,
): NationalCupExit | undefined {
  const index = state.teams.findIndex((t) => t.id === clubId);
  if (index < 0) return undefined;
  if (state.winner === index) return { stage: "vittoria" };

  for (let i = state.log.length - 1; i >= 0; i--) {
    const tie = state.log[i]!;
    if (tie.home !== index && tie.away !== index) continue;
    if (tie.winner === index) return undefined; // ancora in corsa
    const inCasa = tie.home === index;
    const avversaria = state.teams[inCasa ? tie.away : tie.home];
    return {
      stage: tie.stage,
      eliminatedBy: avversaria?.name,
      score: {
        us: inCasa ? tie.goalsHome : tie.goalsAway,
        them: inCasa ? tie.goalsAway : tie.goalsHome,
      },
      onPenalties: !!tie.penalties,
      afterExtraTime: !!tie.extraTime,
    };
  }
  return undefined;
}
