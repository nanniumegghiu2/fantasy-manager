/**
 * La **Corona Continentale dentro una carriera**: come si salva, come si ricostruisce, come
 * si gioca un turno.
 *
 * Vale lo stesso principio del campionato: del torneo si salva **solo ciò che non è
 * derivabile** — i totali del girone e chi è ancora in corsa nel tabellone. Il sorteggio si
 * ricava dal seme della carriera più la stagione, quindi ricostruirlo dà sempre lo stesso
 * tabellone senza doverlo serializzare.
 *
 * L'unica differenza rispetto al campionato è che qui **serve il dettaglio della propria
 * partita**: le altre nove del turno servono solo alla classifica, ma la nostra l'utente la
 * vuole vedere, con marcatori e minuti.
 */
import { derivedRandom } from "../random";
import {
  createCupState,
  cupOutcomeOf,
  cupStandings,
  simulateGroupRound,
  simulateKnockoutRound,
  startKnockout,
  GROUP_ROUNDS,
  type CupOutcome,
  type CupState,
} from "../season/cup";
import {
  simulateMatch,
  narrateGoals,
  type MatchResult,
  type ScorerCandidate,
} from "../season/matchModel";
import { strengthOf, type LeagueTeam } from "../season/leagueState";

/** Quel che della coppa finisce nel salvataggio. */
export interface CupSave {
  /** Id dei club partecipanti, nell'ordine con cui sono stati iscritti. */
  entrants: string[];
  /** Campionato di ciascun partecipante, per il vincolo del sorteggio. */
  leagues: string[];
  groupRound: number;
  tallies: CupState["tallies"];
  bracket: number[];
  stage: CupState["stage"];
  knockoutLog: CupState["knockoutLog"];
  winner?: number;
}

export function emptyCupSave(entrants: string[], leagues: string[]): CupSave {
  return {
    entrants,
    leagues,
    groupRound: 0,
    tallies: entrants.map(() => ({ wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 })),
    bracket: [],
    stage: "girone",
    knockoutLog: [],
  };
}

/**
 * Ricostruisce lo stato della coppa dal salvataggio.
 *
 * Le squadre arrivano dal mondo risolto: il salvataggio conserva solo i loro id, così un
 * ricalcolo degli Overall nel database non riscrive in silenzio la coppa di una carriera già
 * iniziata — la forza si rilegge, ma chi partecipa no.
 */
export function rebuildCupState(
  save: CupSave,
  teamsById: Record<string, LeagueTeam>,
  seed: string,
  season: number,
): CupState {
  const teams = save.entrants.map(
    (id, i) => teamsById[id] ?? { id, name: `Club ${i}`, rating: 75 },
  );
  const leagueByIndex = new Map(save.entrants.map((id, i) => [id, save.leagues[i] ?? "?"]));

  const state = createCupState({
    teams,
    leagueOf: (team) => leagueByIndex.get(team.id) ?? "?",
    random: derivedRandom(seed, "cup", season),
  });

  state.groupRound = save.groupRound;
  // **Copie**, non riferimenti: la simulazione accumula in posto sui totali e spinge nel
  // tabellone, quindi passare gli array del salvataggio li muterebbe. Senza queste copie due
  // stati che dovrebbero essere indipendenti condividerebbero gli stessi oggetti, e riprendere
  // una carriera salvata darebbe una coppa diversa da quella giocata di fila.
  if (save.tallies.length === teams.length) state.tallies = save.tallies.map((t) => ({ ...t }));
  state.bracket = [...save.bracket];
  state.stage = save.stage;
  state.knockoutLog = [...save.knockoutLog];
  state.winner = save.winner;
  return state;
}

export function toCupSave(state: CupState, save: CupSave): CupSave {
  return {
    ...save,
    groupRound: state.groupRound,
    tallies: state.tallies,
    bracket: state.bracket,
    stage: state.stage,
    knockoutLog: state.knockoutLog,
    winner: state.winner,
  };
}

export interface CupRoundOutcome {
  save: CupSave;
  /**
   * La nostra partita in dettaglio, se in questo turno abbiamo giocato. `result` è un
   * dettaglio ricalcolato apposta per marcatori e minuti (sez. intestazione file); `wentTo
   * Penalties`/`weWonPenalties` vengono invece dal **vero** esito del tabellone
   * (`simulateKnockoutRound`), l'unico che decide chi passa il turno — servono solo a
   * raccontare i rigori nel Match Theatre, non cambiano chi è stato eliminato.
   */
  ownMatch?: {
    result: MatchResult;
    opponent: string;
    wentToPenalties?: boolean;
    weWonPenalties?: boolean;
  };
  /** Siamo stati eliminati in questo turno? */
  eliminated: boolean;
  /** Abbiamo vinto la coppa? */
  won: boolean;
}

/**
 * Gioca un turno di coppa.
 *
 * Nel girone si gioca sempre; nel tabellone si gioca solo se si è ancora in corsa — chi è
 * uscito guarda gli altri, e il suo calendario continua col solo campionato.
 */
export function playCupRound(
  save: CupSave,
  teamsById: Record<string, LeagueTeam>,
  ownClubId: string,
  ownScorers: ScorerCandidate[],
  seed: string,
  season: number,
  roundIndex: number,
): CupRoundOutcome {
  const state = rebuildCupState(save, teamsById, seed, season);
  const random = derivedRandom(seed, "cupround", season, roundIndex);
  const ownIndex = save.entrants.indexOf(ownClubId);

  if (state.groupRound < GROUP_ROUNDS) {
    // Il turno di girone si gioca in blocco, poi si rigioca la **nostra** partita in dettaglio.
    const fixture = state.groupCalendar[state.groupRound]?.find(
      (f) => f.home === ownIndex || f.away === ownIndex,
    );
    simulateGroupRound(state, random);

    let ownMatch: CupRoundOutcome["ownMatch"];
    if (fixture && ownIndex >= 0) {
      const opponentIndex = fixture.home === ownIndex ? fixture.away : fixture.home;
      const opponent = state.teams[opponentIndex]!;
      // Si ricalcola con un generatore dedicato: serve il dettaglio (marcatori, minuti) che
      // la simulazione di girone non produce, ed è più onesto che inventarlo dopo.
      const detail = simulateMatch(
        strengthOf(state.teams[ownIndex]!),
        strengthOf(opponent),
        ownScorers,
        derivedRandom(seed, "cupown", season, roundIndex),
        opponent.scorers ?? [],
      );
      ownMatch = { result: detail, opponent: opponent.name };
    }

    if (state.groupRound >= GROUP_ROUNDS) {
      startKnockout(state);
      const passa = state.bracket.includes(ownIndex);
      return {
        save: toCupSave(state, save),
        ownMatch,
        eliminated: ownIndex >= 0 && !passa,
        won: false,
      };
    }
    return { save: toCupSave(state, save), ownMatch, eliminated: false, won: false };
  }

  // Tabellone.
  const eravamoInCorsa = state.bracket.includes(ownIndex);
  const { results } = simulateKnockoutRound(state, random);
  const nostra = results.find((r) => r.home === ownIndex || r.away === ownIndex);

  let ownMatch: CupRoundOutcome["ownMatch"];
  if (nostra && ownIndex >= 0) {
    const opponentIndex = nostra.home === ownIndex ? nostra.away : nostra.home;
    const opponent = state.teams[opponentIndex]!;
    // Il tabellino mostrato deve raccontare lo stesso esito già deciso dal tabellone
    // (`nostra`), non uno nuovo e indipendente — altrimenti il "90°" visivo può non
    // pareggiare quando il vero risultato è finito ai rigori, e la sezione rigori non
    // scatterebbe mai. Punteggio aggregato reale (tempi regolamentari + supplementari),
    // orientato per noi a seconda che si sia stati home o away nel fixture.
    const siamoInCasa = nostra.home === ownIndex;
    const nostriGol =
      (siamoInCasa ? nostra.goalsHome : nostra.goalsAway) +
      (siamoInCasa ? (nostra.extraTime?.goalsHome ?? 0) : (nostra.extraTime?.goalsAway ?? 0));
    const loroGol =
      (siamoInCasa ? nostra.goalsAway : nostra.goalsHome) +
      (siamoInCasa ? (nostra.extraTime?.goalsAway ?? 0) : (nostra.extraTime?.goalsHome ?? 0));
    const detail = narrateGoals(
      nostriGol,
      loroGol,
      ownScorers,
      derivedRandom(seed, "cupown", season, roundIndex),
      opponent.scorers ?? [],
    );
    ownMatch = {
      result: detail,
      opponent: opponent.name,
      wentToPenalties: !!nostra.penalties,
      weWonPenalties: nostra.penalties ? nostra.winner === ownIndex : undefined,
    };
  }

  const ancoraInCorsa = state.bracket.includes(ownIndex) || state.winner === ownIndex;
  return {
    save: toCupSave(state, save),
    ownMatch,
    eliminated: eravamoInCorsa && !ancoraInCorsa,
    won: state.winner === ownIndex,
  };
}

/** Il cammino della nostra squadra, per il budget di fine stagione e il resoconto. */
export function ownCupOutcome(
  save: CupSave,
  teamsById: Record<string, LeagueTeam>,
  ownClubId: string,
  seed: string,
  season: number,
): CupOutcome {
  const index = save.entrants.indexOf(ownClubId);
  if (index < 0) return "assente";
  return cupOutcomeOf(rebuildCupState(save, teamsById, seed, season), index);
}

/** La classifica del girone, per la schermata della coppa. */
export function cupTable(
  save: CupSave,
  teamsById: Record<string, LeagueTeam>,
  seed: string,
  season: number,
) {
  return cupStandings(rebuildCupState(save, teamsById, seed, season));
}
