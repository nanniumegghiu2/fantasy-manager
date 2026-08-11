/**
 * La **Coppa Tricolore dentro una carriera**: come si salva, come si ricostruisce, come si
 * gioca un turno. Gemello di `careerCup.ts`, che fa lo stesso per la Corona.
 *
 * ## Perché qui il tabellone si salva e nella Corona no
 *
 * La Corona deriva tutto dal seme: il girone è una struttura circolare fissa e il tabellone
 * discende dalla classifica, quindi ricostruirlo dà sempre lo stesso torneo. Qui no — il
 * sorteggio è **libero a ogni turno**, quindi gli accoppiamenti dipendono da una sequenza di
 * estrazioni che si sono già consumate. Rideriverli richiederebbe di rigiocare tutti i turni
 * precedenti a ogni ricostruzione: si salvano invece `bracket` e `byes`, che sono due elenchi
 * di numeri.
 *
 * Resta comunque tutto riproducibile: ogni turno usa `derivedRandom(seme, ..., stagione,
 * turno)`, quindi ricaricare un salvataggio e rigiocare dà lo stesso esito.
 */
import { derivedRandom } from "../random";
import { narrateGoals, type MatchResult, type ScorerCandidate } from "../season/matchModel";
import type { LeagueTeam } from "../season/leagueState";
import {
  createNationalCupState,
  nationalCupOutcomeOf,
  playNationalCupRound,
  type NationalCupStage,
  type NationalCupState,
  type NationalCupTie,
} from "../season/nationalCup";

/** Quel che della Coppa Tricolore finisce nel salvataggio. */
export interface NationalCupSave {
  /** Id dei quaranta partecipanti, nell'ordine con cui sono stati iscritti. */
  entrants: string[];
  /** Indici ancora in corsa, accoppiati a due a due. */
  bracket: number[];
  /** Indici in attesa di entrare (solo durante il preliminare). */
  byes: number[];
  stage: NationalCupStage;
  log: NationalCupTie[];
  winner?: number;
}

/** Compone il tabellone di una nuova edizione. */
export function createNationalCupSave(input: {
  clubIds: readonly string[];
  teamsById: Record<string, LeagueTeam>;
  secondDivisionIds: readonly string[];
  seed: string;
  season: number;
}): NationalCupSave {
  const entrants = [...input.clubIds];
  const state = createNationalCupState({
    teams: entrants.map((id, i) => input.teamsById[id] ?? { id, name: `Club ${i}`, rating: 65 }),
    secondDivisionIds: input.secondDivisionIds,
    random: derivedRandom(input.seed, "coppaTricolore", input.season),
  });
  return {
    entrants,
    bracket: state.bracket,
    byes: state.byes,
    stage: state.stage,
    log: [],
  };
}

/**
 * Ricostruisce lo stato dal salvataggio.
 *
 * Le forze si rileggono dal mondo (un club cresciuto è più forte di un anno fa), ma **chi
 * partecipa no**: quello resta fissato dal salvataggio, così un ricalcolo degli Overall nel
 * database non riscrive in silenzio il tabellone di una coppa già cominciata.
 */
export function rebuildNationalCupState(
  save: NationalCupSave,
  teamsById: Record<string, LeagueTeam>,
): NationalCupState {
  return {
    teams: save.entrants.map((id, i) => teamsById[id] ?? { id, name: `Club ${i}`, rating: 65 }),
    // Copie, non riferimenti: `playNationalCupRound` spinge nel log e riscrive il tabellone in
    // posto, quindi passare gli array del salvataggio li muterebbe. È lo stesso difetto già
    // corretto una volta su campionato e Corona.
    bracket: [...save.bracket],
    byes: [...save.byes],
    stage: save.stage,
    log: save.log.map((t) => ({ ...t })),
    winner: save.winner,
  };
}

export function toNationalCupSave(state: NationalCupState, save: NationalCupSave): NationalCupSave {
  return {
    ...save,
    bracket: state.bracket,
    byes: state.byes,
    stage: state.stage,
    log: state.log,
    winner: state.winner,
  };
}

export interface NationalCupRoundOutcome {
  save: NationalCupSave;
  /** La nostra partita in dettaglio, se in questo turno abbiamo giocato. */
  ownMatch?: {
    result: MatchResult;
    opponent: string;
    stage: NationalCupStage;
    wentToPenalties?: boolean;
    weWonPenalties?: boolean;
  };
  eliminated: boolean;
  won: boolean;
}

/**
 * Gioca un turno.
 *
 * Chi è già uscito non gioca: il suo calendario prosegue col solo campionato, e questa
 * funzione non fa nulla se non restituire il salvataggio invariato.
 *
 * **Il tabellino che l'utente vede racconta l'esito già deciso**, non un secondo risultato
 * indipendente. È la stessa invariante di `careerCup.ts`, dove disattenderla aveva prodotto un
 * difetto grave: un "90°" che non pareggiava mentre il vero esito era finito ai rigori, quindi
 * la sezione rigori non scattava mai. Qui `narrateGoals` riceve il punteggio aggregato **vero**
 * (tempi regolamentari più supplementari) e ci costruisce attorno solo marcatori e minuti.
 */
export function playNationalCupWeek(
  save: NationalCupSave,
  teamsById: Record<string, LeagueTeam>,
  ownClubId: string,
  ownScorers: ScorerCandidate[],
  seed: string,
  season: number,
  roundIndex: number,
): NationalCupRoundOutcome {
  const state = rebuildNationalCupState(save, teamsById);
  const ownIndex = save.entrants.indexOf(ownClubId);
  const eravamoInCorsa = state.bracket.includes(ownIndex) || state.byes.includes(ownIndex);

  const { results } = playNationalCupRound(
    state,
    derivedRandom(seed, "coppaTricoloreTurno", season, roundIndex),
  );

  let ownMatch: NationalCupRoundOutcome["ownMatch"];
  const nostra = results.find((r) => r.home === ownIndex || r.away === ownIndex);
  if (nostra && ownIndex >= 0) {
    const opponentIndex = nostra.home === ownIndex ? nostra.away : nostra.home;
    const opponent = state.teams[opponentIndex]!;
    const siamoInCasa = nostra.home === ownIndex;
    const nostriGol =
      (siamoInCasa ? nostra.goalsHome : nostra.goalsAway) +
      (siamoInCasa ? (nostra.extraTime?.goalsHome ?? 0) : (nostra.extraTime?.goalsAway ?? 0));
    const loroGol =
      (siamoInCasa ? nostra.goalsAway : nostra.goalsHome) +
      (siamoInCasa ? (nostra.extraTime?.goalsAway ?? 0) : (nostra.extraTime?.goalsHome ?? 0));

    ownMatch = {
      result: narrateGoals(
        nostriGol,
        loroGol,
        ownScorers,
        derivedRandom(seed, "coppaTricoloreNostra", season, roundIndex),
        opponent.scorers ?? [],
      ),
      opponent: opponent.name,
      stage: nostra.stage,
      wentToPenalties: !!nostra.penalties,
      weWonPenalties: nostra.penalties ? nostra.winner === ownIndex : undefined,
    };
  }

  const ancoraInCorsa = state.bracket.includes(ownIndex) || state.winner === ownIndex;
  return {
    save: toNationalCupSave(state, save),
    ownMatch,
    eliminated: eravamoInCorsa && !ancoraInCorsa,
    won: state.winner === ownIndex,
  };
}

/** Il nostro cammino nella coppa, per il resoconto e il budget di fine stagione. */
export function ownNationalCupOutcome(
  save: NationalCupSave,
  teamsById: Record<string, LeagueTeam>,
  ownClubId: string,
): NationalCupStage | "vittoria" | "assente" {
  if (!save.entrants.includes(ownClubId)) return "assente";
  return nationalCupOutcomeOf(rebuildNationalCupState(save, teamsById), ownClubId) ?? "assente";
}

/** La forza del club, quando serve sostituire la nostra fotografia con la rosa vera. */
export function withOwnStrength(
  teamsById: Record<string, LeagueTeam>,
  ownClubId: string,
  ownName: string,
  strength: { attack: number; defence: number },
): Record<string, LeagueTeam> {
  return {
    ...teamsById,
    [ownClubId]: {
      ...(teamsById[ownClubId] ?? { id: ownClubId, name: ownName, rating: 70 }),
      rating: Math.round((strength.attack + strength.defence) / 2),
      strength,
    },
  };
}

