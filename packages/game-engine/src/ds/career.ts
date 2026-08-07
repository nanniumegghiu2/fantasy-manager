/**
 * Il **riduttore della carriera**: `advanceWeek(stato, decisioni) → (nuovo stato, referto)`.
 *
 * È il punto in cui tutti i moduli `ds/*` si incastrano, ed è volutamente l'unico posto in cui
 * questo accade. La regola di confine del progetto vale soprattutto qui: **la UI non calcola
 * mai nulla**, chiama `advanceWeek` e mostra il referto che riceve. Se domani si volesse una
 * modalità "simula tutta la stagione", basterebbe chiamare questa funzione in un ciclo.
 *
 * Lo stato è **interamente serializzabile** e non contiene oggetti `Player`: solo id e numeri.
 * L'anagrafica si risolve a runtime dal pool (`CareerWorld`), così un salvataggio resta
 * compatto e non si porta dietro una fotografia stantia del database.
 */
import { derivedRandom } from "../random";
import {
  buildStandings,
  createLeagueState,
  simulateMatchday,
  type LeagueState,
  type LeagueTeam,
  type StandingRow,
} from "../season/leagueState";
import type { MatchResult } from "../season/matchModel";
import { computeSquadStrength } from "../squadStrength";
import {
  buildSeasonCalendar,
  cupSlotOf,
  hasMarketWindow,
  leagueRoundOf,
  type SeasonWeek,
} from "../season/calendar";
import { getFormation } from "../formations";
import { advanceSeasonOveralls, ageInSeason, shouldRetire } from "./aging";
import { computeCohesion } from "./cohesion";
import { findCoach } from "./coaches";
import { emptyCupSave, ownCupOutcome, playCupRound, type CupSave } from "./careerCup";
import { isKeyMatch } from "./highlights";
import {
  applyMarketAction,
  emptySquadLists,
  openMarketWindow,
  type IncomingOffer,
  type MarketAction,
  type MarketActionResult,
  type MarketSnapshot,
  type MarketWindow,
  type MarketWorld,
  type SquadLists,
} from "./careerMarket";
import { availableCoaches, severanceCost } from "./coaches";
import {
  searchPlayers,
  type SearchCriteria,
  type SearchablePlayer,
  type SearchResult,
} from "./scouting";
import { nextSeasonBudget, type DsDifficulty } from "./budget";
import {
  coachRequest as buildCoachRequest,
  isReductionRequest,
  requestSatisfiedBy,
  PATIENCE_WINDOWS,
  REQUEST_FULFILLED_COHESION,
  type CoachRequest,
} from "./coachRequests";
import {
  verifyCoachPromises,
  promiseSatisfiedNow,
  proposePromiseCompromise,
  type CoachNegotiationState,
} from "./coachNegotiation";
import type { RoleCandidate } from "./coachRequestsCatalog";
import { applyIncident, rollIncident, type Incident } from "./incidents";
import type { WorldTransfer } from "./aiWorld";
import {
  assignInitialCoaches,
  evolveCoaches,
  type AiClubSeasonInfo,
  type AiCoachAssignment,
} from "./aiCoaches";
import {
  objectiveMet,
  positionsBelowTarget,
  suggestObjectiveTiers,
  type ObjectiveLabel,
  type ObjectiveTier,
} from "./seasonObjectives";
import { computeHarmonyModifier, getCoachUntouchables, harmonyLabel } from "./coachSynergy";
export { computeHarmonyModifier, getCoachUntouchables, harmonyLabel };
import {
  applyNegotiationMove,
  endingLabel,
  openNegotiation,
  type Negotiation,
  type NegotiationMove,
} from "./negotiation";
import { canBuy, canSell, MIN_SQUAD_SIZE } from "./roster";
import { currentValue } from "./market";
import { canLoanOut, openLoan, settleLoans } from "./loans";
import { createRegenBatch } from "./regen";
import {
  discontentPenalty,
  fatigueTeamModifier,
  findTransferRequest,
  isTooGoodForBench,
  MORALE_BASELINE,
  moraleTeamModifier,
  rollInjuries,
  tickInjuries,
  updateFatigue,
  updateMorale,
  type Injury,
  type MoraleContext,
  type RequestResponse,
  type TransferRequest,
} from "./events";
import {
  applyStandoffMove,
  openStandoff,
  STANDOFF_MORALE_THRESHOLD,
  verifyPlayerPromises,
  type PlayerPromiseRecord,
  type PlayerStandoff,
  type StandoffMove,
  type StandoffReason,
} from "./playerStandoff";
import { pickStartingEleven } from "./lineup";
import { availableEntries, averageOverall, createRosterEntry } from "./roster";
import {
  CAREER_SEASONS,
  type CoachPromise,
  type GeneratedPlayer,
  type Lineup,
  type RosterEntry,
  type SessionDeal,
} from "./types";
import { ROLE_DEPARTMENT, type Department, type Player, type Role } from "@app/shared-types";

/* -------------------------------------------------------------------------- */
/* Il mondo: ciò che si risolve dal database e non entra nel salvataggio        */
/* -------------------------------------------------------------------------- */

/** Un giocatore risolto: quel che serve al motore, preso dal pool o generato in carriera. */
export interface ResolvedPlayer {
  id: string;
  name: string;
  nation: string;
  role: Role;
  secondaryRoles: Role[];
  department: Department;
  birthDate?: string | null;
}

export interface CareerWorld {
  players: Record<string, ResolvedPlayer>;
  /** Le 19 avversarie del campionato dell'utente, già pronte. */
  opponents: LeagueTeam[];
  /** Nome del club dell'utente, per il referto. */
  clubName: string;
  /** Quante giornate ha il campionato: 38 a 20 squadre, 34 a 18. */
  leagueRounds: number;
  /**
   * Le venti squadre della Corona Continentale, per id.
   *
   * Serve solo se il nostro club è qualificato: chi non lo è non paga nulla per la loro
   * esistenza, e il calendario non prevede nemmeno i turni infrasettimanali.
   */
  cupTeams?: Record<string, LeagueTeam>;
  /** Le venti iscritte alla Corona: servono a ricostruire il torneo a ogni qualificazione. */
  cupEntrants?: { clubIds: string[]; leagues: string[] };
  /** Il mondo del mercato. Assente = finestre disattivate (utile nei test del solo campo). */
  market?: MarketWorld;
  /**
   * Genera i trasferimenti che le squadre del computer fanno in una stagione.
   *
   * Arriva come funzione invece che come dato perché richiede l'intero pool di 2.586 giocatori
   * già invecchiato, che vive nell'app e non ha ragione di entrare nello stato del riduttore.
   * Assente = mondo immobile, che è il comportamento dei test che guardano solo il campo.
   */
  planTransfers?: (season: number) => WorldTransfer[];
}

/* -------------------------------------------------------------------------- */
/* Lo stato salvato                                                            */
/* -------------------------------------------------------------------------- */

export interface SeasonSummary {
  season: number;
  position: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  cupOutcome?: string;
  /** L'obiettivo dichiarato per questa stagione e se è stato raggiunto, se ne era stato scelto uno. */
  objective?: { label: ObjectiveLabel; targetPosition: number; met: boolean };
  /** Morale medio della rosa a fine stagione: il punto da cui riparte quella nuova. */
  avgMorale: number;
  /** Quanti titolari erano sotto la soglia di scontentezza a fine stagione. */
  unhappyCount: number;
  /** Chi, a fine stagione, sta ancora spingendo per andarsene (riusa `standoffCandidates`). */
  standoffQueue: { playerId: string; name: string }[];
  /** Variazione di sintonia col mister durante la stagione appena chiusa. */
  coachHarmonyDelta: number;
  /** Entrate meno uscite di mercato nell'intera stagione (entrambe le finestre). */
  netBudget: number;
}

export interface PendingRequest extends TransferRequest {
  /** Nome del giocatore, perché il referto sia leggibile senza risolvere il pool. */
  playerName: string;
}

export interface CareerState {
  version: number;
  seed: string;
  clubId: string;
  leagueId: string;
  season: number;
  /** Settimana corrente, indice nel calendario della stagione. */
  week: number;
  phase: "mercato_estivo" | "stagione" | "fine_stagione" | "conclusa";
  coachId: string | null;
  budget: number;
  roster: RosterEntry[];
  /** Solo i totali: le squadre e il calendario si ricostruiscono dal seme. */
  league: { round: number; tallies: LeagueState["tallies"] };
  /** La Corona di questa stagione, se ci siamo qualificati. */
  cup?: CupSave;
  /** Difficoltà scelta in avvio: agisce sul budget di mercato. */
  difficulty: DsDifficulty;
  /** La finestra di mercato aperta in questo momento, se ce n'è una. */
  market?: MarketSnapshot | null;
  /**
   * I trasferimenti fatti dalle squadre del computer, stagione per stagione.
   *
   * Sono l'unica cosa del mondo che si salva: invecchiamento, ritiri e regen dell'IA si
   * **derivano** (vedi `aiWorld.ts`), i trasferimenti no, perché dipendono anche da chi hai
   * comprato tu. Servono comunque alla schermata "Mercato dal mondo".
   */
  worldTransfers: WorldTransfer[];
  /**
   * Chi allena chi, fra i club di cui il motore calcola un segnale vero (sez. `aiCoaches.ts`).
   * Come `worldTransfers`, è storia e non si può derivare: si salva.
   */
  aiCoaches?: Record<string, AiCoachAssignment>;
  /**
   * Posizione finale della **stagione appena chiusa**, per le 19 avversarie della propria lega
   * (non per noi: la nostra sta già in `history`). Serve solo a `evolveCoaches` per giudicare un
   * allenatore IA sui risultati veri — un dato altrimenti introvabile, perché `league.tallies` si
   * azzera a ogni nuova stagione.
   */
  lastSeasonStandings?: Record<string, number>;
  /** Il nostro mister è stato appena portato via da un altro club: la UI lo annuncia e poi lo azzera. */
  coachDeparture?: { coachName: string; clubName: string } | null;
  /** L'obiettivo dichiarato per la stagione in corso, scelto dal DS nel dossier iniziale. */
  seasonObjective?: { targetPosition: number; label: ObjectiveLabel; setSeason: number };
  /** Se l'obiettivo di questa stagione è già stato scelto: azzerato a ogni nuova stagione. */
  seasonObjectiveSet?: boolean;
  /** Budget al calcio d'inizio della stagione in corso: la base per il saldo di mercato annuale. */
  seasonStartBudget?: number;
  /** Sintonia col mister al calcio d'inizio della stagione, per misurarne la variazione. */
  seasonStartCoachHarmony?: number;
  /** La richiesta dell'allenatore per la finestra aperta, e se è stata accontentata. */
  coachRequest?: { request: CoachRequest; fulfilled: boolean } | null;
  /** Quante sessioni di mercato di fila l'allenatore è stato ignorato. */
  coachIgnored?: number;
  /** Le promesse vincolanti fatte al mister. */
  coachPromises?: CoachPromise[];
  /**
   * Titolarità garantita dalla direttiva DS-Mister, **una per casella**: la chiave è il ruolo
   * (coerente con lo scacchiere unificato, sez. 3.1 CLAUDE.md — un ruolo può avere più caselle
   * fisiche ma è la stessa casella concettuale), il valore l'id del giocatore garantito per
   * quella casella. Sostituire il valore di una chiave **revoca** il titolare precedente per
   * quel ruolo, invece di limitarsi ad aggiungersi a fianco: prima era un `string[]` a cui si
   * poteva solo aggiungere, quindi "sostituiscilo" non toglieva mai lo status al primo scelto.
   */
  guaranteedStarters?: Partial<Record<Role, string>>;
  /**
   * Chi il mister ha smesso di schierare per decisione propria — bivio giocatore-mister
   * (`playerStandoff.ts`, `StandoffReason: "bivio_mister"`) ignorato fino alla rottura: tenere
   * entrambi ha un costo vero, non solo narrativo. Si toglie solo cambiando mister (`hireCoach`,
   * stesso reset di `guaranteedStarters`) o vendendo il giocatore.
   */
  coachBenched?: Record<string, true>;
  /**
   * Quante volte, in tutta la carriera, un giocatore è stato protagonista di un imprevisto
   * "con decisione" (nottata prima di una partita, intervista contro mister/società) — non un
   * conteggio stagionale: alla **seconda** occasione di qualunque giocatore, `resolveIncidentDecision`
   * forza una richiesta di cessione a prescindere dal morale residuo, perché un DS che perdona
   * due volte la stessa mancanza non ha più credibilità da spendere.
   */
  disciplineHistory?: Record<string, number>;
  /**
   * Promesse di più spazio fatte a giocatori scontenti (sez. 2, chat coi giocatori), in attesa
   * di verifica. Chi è qui ha lo stesso bonus di selezione di `guaranteedStarters` (è la
   * "promessa" resa meccanica, non solo narrativa) — vedi `currentLineup`.
   */
  minutesPromises?: Record<string, { roundsWaited: number }>;
  /**
   * Promesse fatte in chat a un giocatore (rinforzo in un reparto, stagione ambiziosa),
   * verificate a **fine finestra di mercato** (non a giornata come `minutesPromises`, perché
   * "rinforzi" e "trionfo" sono per natura impegni sulla finestra/stagione, non sulla singola
   * partita). Se infranta: morale al minimo e il giocatore entra in `brokenTrust`.
   */
  playerPromises?: Record<string, PlayerPromiseRecord>;
  /**
   * Chi ha già subito una promessa infranta: la prossima chat con lui parte da un rapporto già
   * compromesso (`StandoffReason: "tradito"`), non da una scontentezza qualunque — coerente con
   * "alla prossima sessione sarà in rottura totale con il club".
   */
  brokenTrust?: Record<string, true>;
  /** Le operazioni concluse nella sessione di mercato corrente. */
  sessionDeals?: SessionDeal[];
  /** Armonia/morale del mister (0-100). */
  coachHarmony?: number;
  /** Ultimatum in sospeso da un giocatore o dal mister. */
  pendingUltimatum?: any;
  /** L'imprevisto appena capitato: la UI lo mostra e poi lo azzera. */
  incident?: Incident | null;
  /** Giornata dell'ultimo imprevisto, per la tregua. */
  lastIncidentMatchday?: number;
  /** La trattativa aperta in questo momento, se ce n'è una. */
  negotiation?: Negotiation | null;
  /**
   * Giocatori per cui la trattativa è già saltata **in questa finestra**.
   *
   * Senza, bastava riaprire e ritentare finché non usciva il risultato voluto: la pazienza
   * dell'interlocutore, che è la risorsa su cui si regge tutta la meccanica, non sarebbe
   * costata nulla. Si azzera a ogni nuova finestra di mercato.
   */
  negotiationBlocked?: string[];
  /**
   * Chi hai messo in vendita e chi in lista prestito.
   *
   * Vivono nello stato e non nella finestra perché **sopravvivono alla chiusura del mercato**:
   * un giocatore dichiarato cedibile in estate lo è ancora a gennaio, ed è così che la scelta
   * diventa una strategia invece di un clic da rifare ogni volta.
   */
  lists: SquadLists;
  /**
   * I giocatori **inventati** dalla carriera (regen dei ritirati).
   *
   * Vivono nel salvataggio e non nel database, perché non esistono nel pool reale: è l'unica
   * eccezione alla regola "nello stato solo id", e vale la pena perché senza di loro il mondo
   * si svuoterebbe di metà pool in dieci stagioni.
   */
  generated: GeneratedPlayer[];
  history: SeasonSummary[];
  pendingRequest: PendingRequest | null;
  lastResolvedMatchday?: number;
  /** Motivo per cui la carriera è finita, se è finita. */
  ending?: "completata" | "retrocessione";
  /** Se la trattativa stagionale col mister è stata completata per questa stagione. */
  seasonNegotiationDone?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Creazione                                                                   */
/* -------------------------------------------------------------------------- */

export interface CreateCareerInput {
  seed: string;
  clubId: string;
  leagueId: string;
  coachId: string | null;
  roster: RosterEntry[];
  budget: number;
  /** Partecipanti alla Corona della prima stagione, se il club è fra i qualificati. */
  cupEntrants?: { clubIds: string[]; leagues: string[] };
  difficulty?: DsDifficulty;
}

export function createCareer(input: CreateCareerInput): CareerState {
  return {
    version: 1,
    seed: input.seed,
    clubId: input.clubId,
    leagueId: input.leagueId,
    season: 1,
    week: 0,
    phase: "mercato_estivo",
    coachId: input.coachId,
    budget: input.budget,
    roster: input.roster,
    league: { round: 0, tallies: [] },
    cup:
      input.cupEntrants && input.cupEntrants.clubIds.includes(input.clubId)
        ? emptyCupSave(input.cupEntrants.clubIds, input.cupEntrants.leagues)
        : undefined,
    difficulty: input.difficulty ?? "normale",
    market: null,
    worldTransfers: [],
    coachRequest: null,
    lists: emptySquadLists(),
    generated: [],
    history: [],
    pendingRequest: null,
    seasonNegotiationDone: true,
    seasonObjectiveSet: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Ricostruzione dello stato di campionato                                     */
/* -------------------------------------------------------------------------- */

/**
 * Ricostruisce il campionato dal seme.
 *
 * Il calendario **non si salva**: dipende solo da seme e stagione, quindi ricrearlo dà sempre
 * lo stesso sorteggio. Si salvano invece i totali, perché quelli dipendono da come sono andate
 * le partite e non sono derivabili.
 */
export function rebuildLeagueState(state: CareerState, world: CareerWorld): LeagueState {
  const strength = squadStrengthOf(state, world);
  const teams: LeagueTeam[] = [
    { id: state.clubId, name: world.clubName, rating: Math.round((strength.attack + strength.defence) / 2), strength },
    ...world.opponents,
  ];
  const league = createLeagueState(
    teams,
    derivedRandom(state.seed, "league", state.leagueId, state.season),
  );
  league.round = state.league.round;
  // **Copia**, non riferimento: `simulateMatchday` accumula in posto sui totali, quindi passare
  // l'array del salvataggio lo farebbe mutare — e due stati che dovrebbero essere distinti
  // finirebbero a condividere lo stesso oggetto. È un difetto che non si vede finché non si
  // parte due volte dallo stesso stato, ed è esattamente ciò che fa un test di ripresa.
  if (state.league.tallies.length === teams.length) {
    league.tallies = state.league.tallies.map((t) => ({ ...t }));
  }
  return league;
}

/** Il calendario della stagione corrente. */
export function seasonCalendar(state: CareerState, world: CareerWorld): SeasonWeek[] {
  // Chi non è in Corona ha una stagione senza turni infrasettimanali: meno partite, meno
  // rotazione necessaria, ed è una differenza che si sente in campo.
  return buildSeasonCalendar({ leagueRounds: world.leagueRounds, inCup: !!state.cup });
}

/* -------------------------------------------------------------------------- */
/* Undici e forza                                                              */
/* -------------------------------------------------------------------------- */

/**
 * L'anagrafica effettiva della carriera: il pool del database **più** i giocatori inventati.
 *
 * I regen non esistono nel database, quindi senza questa fusione sparirebbero dall'undici il
 * giorno dopo essere nati. Si costruisce qui, una sola volta per chiamata, invece di chiedere
 * al chiamante di ricordarsene.
 */
export function careerPlayers(
  state: CareerState,
  world: CareerWorld,
): Record<string, ResolvedPlayer> {
  if (state.generated.length === 0) return world.players;
  const index: Record<string, ResolvedPlayer> = { ...world.players };
  for (const player of state.generated) {
    index[player.id] = {
      id: player.id,
      name: player.name,
      nation: player.nation,
      role: player.role,
      secondaryRoles: player.secondaryRoles,
      department: ROLE_DEPARTMENT[player.role],
      birthDate: player.birthDate,
    };
  }
  return index;
}

/**
 * Le promesse fatte al mister, con lo stato **live** di ognuna dato lo stato attuale della
 * rosa — non solo quello congelato all'ultima verifica di fine mercato.
 *
 * Prima il pannello mostrava sempre `promise.fulfilled` così com'era all'accettazione (o
 * all'ultima chiusura finestra): comprare il rinforzo giusto a metà mercato non cambiava il
 * pallino finché non si chiudeva la finestra. `promiseSatisfiedNow` è la stessa identica
 * regola usata da `verifyCoachPromises`, solo di sola lettura — il risultato non tocca lo
 * stato, quindi si può richiamare a ogni transazione senza effetti collaterali.
 */
export function livePromiseStatus(
  state: CareerState,
  world: CareerWorld,
): (CoachPromise & { liveFulfilled: boolean })[] {
  const promises = state.coachPromises ?? [];
  if (promises.length === 0) return [];
  const anagrafica = careerPlayers(state, world);
  return promises.map((promise) => ({
    ...promise,
    liveFulfilled: promiseSatisfiedNow(
      promise,
      state.roster,
      anagrafica,
      state.season,
      "Italia",
      undefined,
      state.budget,
    ),
  }));
}

/**
 * Garantisce la titolarità di `playerId` per `role`, **sovrascrivendo** l'eventuale titolare
 * precedente per quella casella (già così) **e** togliendo `playerId` da qualunque altra
 * chiave lo contenesse — un giocatore è garantito in **un solo ruolo alla volta**, mai due:
 * chiederla per un nuovo ruolo sposta la garanzia, non la duplica.
 */
export function setGuaranteedStarter(state: CareerState, role: Role, playerId: string): CareerState {
  const attuali = state.guaranteedStarters ?? {};
  const senzaAltrove = Object.fromEntries(
    Object.entries(attuali).filter(([r, id]) => r === role || id !== playerId),
  ) as Partial<Record<Role, string>>;
  return { ...state, guaranteedStarters: { ...senzaAltrove, [role]: playerId } };
}

/** L'undici che l'allenatore schiererebbe oggi, dati infortuni, fatica e morale. */
export function currentLineup(state: CareerState, world: CareerWorld): Lineup {
  const coach = state.coachId ? findCoach(state.coachId) : undefined;
  const formation = getFormation(coach?.formationId ?? "4-3-3")!;
  // Chi il mister ha smesso di schierare (bivio giocatore-mister ignorato) non è disponibile
  // per lui, esattamente come un infortunato o uno in prestito altrove — stesso hard filter di
  // `availableEntries`, non un semplice malus di punteggio.
  const disponibili = state.coachBenched
    ? availableEntries(state.roster).filter((e) => !state.coachBenched?.[e.playerId])
    : availableEntries(state.roster);
  // Una promessa di più spazio (sez. 2) pesa nella scelta come un bonus di selezione, ma per
  // **qualunque** ruolo compatibile — è una promessa di minutaggio, non di una casella
  // specifica come la titolarità garantita dalla direttiva DS-Mister.
  return pickStartingEleven(
    formation,
    disponibili,
    careerPlayers(state, world),
    {
      guaranteedStarters: state.guaranteedStarters ?? {},
      anyRoleBoost: Object.keys(state.minutesPromises ?? {}),
    },
  );
}

/** Forza offensiva e difensiva della squadra, con affiatamento e stile dell'allenatore. */
export function squadStrengthOf(state: CareerState, world: CareerWorld) {
  const coach = state.coachId ? findCoach(state.coachId) : undefined;
  const formation = getFormation(coach?.formationId ?? "4-3-3")!;
  const lineup = currentLineup(state, world);
  // `world.players` non copre i nostri regen: senza l'anagrafica fusa, un regen titolare
  // veniva scartato in silenzio dal calcolo di forza — una casella coperta che il motore
  // trattava come vuota.
  const anagrafica = careerPlayers(state, world);

  const starters: Record<string, Player> = {};
  const penalties: Record<string, number> = {};
  const titolari: RosterEntry[] = [];
  for (const [slotId, playerId] of Object.entries(lineup.starters)) {
    const resolved = anagrafica[playerId];
    const entry = state.roster.find((e) => e.playerId === playerId);
    if (!resolved || !entry) continue;
    starters[slotId] = {
      ...resolved,
      overall: entry.overall,
      marketValue: 0,
      clubId: state.clubId,
      era: "",
      league: state.leagueId,
    } as Player;
    // Chi è in rotta con la società rende meno: è il prezzo del "rifiuta".
    penalties[slotId] = discontentPenalty(entry.morale);
    titolari.push(entry);
  }

  // Modificatori di **squadra**, non individuali: uno spogliatoio sereno e fresco gioca meglio
  // nel suo insieme, uno scontento e sfinito peggio — simmetrico al malus individuale sopra,
  // che da solo copriva solo metà della richiesta dell'utente (morale alto = bonus, squadra
  // stanca = malus, nessuno dei due esisteva come effetto di squadra prima d'ora).
  const media = (valori: number[]) =>
    valori.length > 0 ? valori.reduce((s, v) => s + v, 0) / valori.length : MORALE_BASELINE;
  const moraleMod = moraleTeamModifier(media(titolari.map((e) => e.morale)));
  const fatigueMod = fatigueTeamModifier(
    titolari.length > 0 ? titolari.reduce((s, e) => s + e.fatigue, 0) / titolari.length : 0,
  );

  const cohesion = computeCohesion({
    formation,
    lineup,
    entries: state.roster,
    players: careerPlayers(state, world),
    season: state.season,
    matchdaysWithFormation: state.league.round,
  });

  // Accontentare l'allenatore vale un punto di affiatamento: piccolo di proposito, perché il
  // direttore sportivo resta il giocatore — la richiesta è un consiglio, non un ordine.
  const bonusMister = state.coachRequest?.fulfilled ? REQUEST_FULFILLED_COHESION : 0;

  return computeSquadStrength(formation, starters, {
    cohesionBonus: cohesion.bonus + bonusMister + moraleMod + fatigueMod,
    coachModifier: coach?.style,
    penalties,
  });
}

/* -------------------------------------------------------------------------- */
/* Avanzamento                                                                 */
/* -------------------------------------------------------------------------- */

export interface WeekReport {
  week: number;
  season: number;
  /** La partita di campionato, se questa settimana se ne gioca una. */
  match?: { result: MatchResult; opponent: string };
  /** La partita di Corona, se questa settimana c'è un turno e siamo ancora in corsa. */
  cupMatch?: {
    result: MatchResult;
    opponent: string;
    stage: string;
    wentToPenalties?: boolean;
    weWonPenalties?: boolean;
  };
  standings?: StandingRow[];
  injuries: Injury[];
  /** Richiesta di cessione appena aperta: è una decisione, la UI deve fermarsi. */
  request?: PendingRequest;
  /** L'imprevisto di questa settimana, se ce n'è stato uno. */
  incident?: Incident;
  /** L'allenatore si è dimesso: va scelto un sostituto. */
  coachResigned?: boolean;
  marketWindow: boolean;
  /** La finestra di mercato aperta adesso: la UI ci costruisce sopra la schermata. */
  market?: MarketSnapshot | null;
  seasonEnded: boolean;
  careerEnded: boolean;
  messages: string[];
}

export interface WeekDecisions {
  /** Risposta a una richiesta di cessione aperta. */
  requestResponse?: RequestResponse;
  /**
   * Chiude la finestra di mercato aperta.
   *
   * Finché una finestra è aperta la settimana **non avanza**: è una decisione come la richiesta
   * di cessione, e trattarla diversamente significherebbe far scorrere il calendario mentre
   * l'utente sta ancora trattando.
   */
  closeMarket?: boolean;
}

/**
 * I club di cui il mondo IA degli allenatori tiene traccia (sez. `aiCoaches.ts`): le 19
 * avversarie di lega (segnale vero: posizione dell'anno appena chiuso) più i club qualificati
 * alla Corona (nessuna posizione — è un tabellone, non un campionato — solo lo scarto fra
 * prestigio e rosa attuale). Unione deduplicata: diversi grandi club sono in entrambi gli elenchi.
 */
function buildAiClubInfos(state: CareerState, world: CareerWorld): AiClubSeasonInfo[] {
  const prestigeOf = (id: string) => world.market?.valuation.clubPrestige[id] ?? 3;
  const squadAverageOf = (id: string) => {
    const eleven = world.market?.clubs[id]?.startingEleven ?? [];
    return eleven.length > 0 ? eleven.reduce((s, o) => s + o, 0) / eleven.length : 70;
  };
  const leagueSize = world.opponents.length + 1;

  const byId = new Map<string, AiClubSeasonInfo>();
  for (const team of world.opponents) {
    byId.set(team.id, {
      id: team.id,
      name: team.name,
      prestige: prestigeOf(team.id),
      squadAverage: squadAverageOf(team.id),
      leaguePosition: state.lastSeasonStandings?.[team.id],
      leagueSize,
    });
  }
  for (const [id, team] of Object.entries(world.cupTeams ?? {})) {
    if (byId.has(id)) continue; // già coperto (con posizione vera) come avversaria di lega
    byId.set(id, {
      id,
      name: team.name,
      prestige: prestigeOf(id),
      squadAverage: squadAverageOf(id),
    });
  }
  return [...byId.values()];
}

/**
 * Avanza di **una settimana**: gioca la giornata di campionato, applica infortuni, fatica e
 * morale, ed eventualmente apre una decisione.
 *
 * Ordine deliberato: prima si gioca, poi si aggiorna lo stato dei giocatori. Gli infortuni
 * si estraggono a **fine partita** e il loro effetto parte dalla giornata dopo — il motore non
 * ha il concetto di sostituzione a gara in corso, e introdurlo per un guadagno solo narrativo
 * costerebbe caro.
 */
export function advanceWeek(
  state: CareerState,
  world: CareerWorld,
  decisions: WeekDecisions = {},
): { state: CareerState; report: WeekReport } {
  const messages: string[] = [];
  let next: CareerState = { ...state, roster: [...state.roster] };

  if (next.phase === "conclusa") {
    return {
      state: next,
      report: emptyReport(next, { careerEnded: true, messages: ["La carriera è conclusa."] }),
    };
  }

  // Una decisione in sospeso blocca l'avanzamento: è il punto in cui il gioco aspetta l'utente.
  if (next.pendingRequest && !decisions.requestResponse) {
    return {
      state: next,
      report: emptyReport(next, {
        request: next.pendingRequest,
        messages: ["Un giocatore aspetta una risposta."],
      }),
    };
  }
  if (next.pendingRequest && decisions.requestResponse) {
    next = applyRequestResponse(next, decisions.requestResponse);
    messages.push("Richiesta risolta.");
  }

  // Una finestra di mercato aperta blocca il calendario, esattamente come una richiesta: far
  // scorrere le giornate mentre l'utente sta trattando renderebbe il mercato una decorazione.
  if (next.market && !decisions.closeMarket) {
    return {
      state: next,
      report: emptyReport(next, {
        market: next.market,
        marketWindow: true,
        messages: ["Finestra di mercato aperta."],
      }),
    };
  }
  let coachResigned = false;
  if (next.market && decisions.closeMarket) {
    const eraEstiva = next.phase === "mercato_estivo";

    /**
     * **Chiudere il mercato senza aver accontentato l'allenatore ha un costo.**
     *
     * Se ignorarlo non costasse nulla, la sua richiesta sarebbe un suggerimento decorativo. Il
     * margine è di due sessioni: la prima si può non poterla accontentare per mancanza di
     * fondi, la seconda è una scelta — e alla terza lui se ne va.
     */
    // Verifica delle promesse vincolanti concordate in trattativa col mister
    if (next.coachPromises && next.coachPromises.length > 0) {
      const vResult = verifyCoachPromises(
        next.coachPromises,
        next.roster,
        world.players,
        next.season,
        "Italia",
        undefined,
        next.budget,
      );
      next = {
        ...next,
        coachPromises: vResult.updatedPromises,
        coachHarmony: Math.max(0, Math.min(100, (next.coachHarmony ?? 75) + vResult.harmonyDelta)),
      };
      if (vResult.coachResigned) {
        const uscente = next.coachId ? findCoach(next.coachId) : undefined;
        next = { ...next, coachId: null, coachPromises: [], coachHarmony: 40 };
        coachResigned = true;
        messages.push(
          `${uscente?.name ?? "L'allenatore"} si è DIMESSO per mancato rispetto delle promesse contrattuali concordate!`,
        );
      } else {
        messages.push(vResult.summaryMessage);
      }
    } else {
      const richiesta = next.coachRequest;
      let ignorato = next.coachIgnored ?? 0;
      if (richiesta && !richiesta.fulfilled) {
        ignorato += 1;
        if (ignorato > PATIENCE_WINDOWS) {
          const uscente = next.coachId ? findCoach(next.coachId) : undefined;
          next = { ...next, coachId: null, coachIgnored: 0 };
          coachResigned = true;
          messages.push(
            `${uscente?.name ?? "L'allenatore"} si è dimesso: chiedeva rinforzi da tre sessioni e non li ha avuti.`,
          );
        } else {
          next = { ...next, coachIgnored: ignorato };
          messages.push("L'allenatore non ha avuto quel che chiedeva. Non l'ha presa bene.");
        }
      } else if (richiesta?.fulfilled) {
        next = { ...next, coachIgnored: 0 };
      }
    }

    // Verifica delle promesse fatte in chat ai giocatori (sez. chat, playerStandoff.ts): stesso
    // trattamento delle promesse al mister, un'infrazione qui non è un vago "meno morale" ma un
    // crollo netto più l'ingresso in `brokenTrust` — la prossima chat parte già compromessa.
    if (next.playerPromises && Object.keys(next.playerPromises).length > 0) {
      const posizioneAttuale = next.league.round > 0 ? buildStandings(rebuildLeagueState(next, world), 0).find((r) => r.isUser)?.position ?? null : null;
      const pResult = verifyPlayerPromises(
        next.playerPromises,
        next.roster,
        world.players,
        next.season,
        posizioneAttuale,
        world.opponents.length + 1,
      );
      if (Object.keys(pResult.moraleDelta).length > 0) {
        next = {
          ...next,
          playerPromises: pResult.updatedPromises,
          roster: next.roster.map((e) =>
            pResult.moraleDelta[e.playerId] !== undefined
              ? { ...e, morale: Math.max(0, Math.min(100, e.morale + pResult.moraleDelta[e.playerId])) }
              : e,
          ),
          brokenTrust:
            pResult.newlyBroken.length > 0
              ? { ...(next.brokenTrust ?? {}), ...Object.fromEntries(pResult.newlyBroken.map((id) => [id, true as const])) }
              : next.brokenTrust,
        };
        messages.push(...pResult.messages);
      }
    }

    // **L'allenatore dimesso lascia la squadra senza guida**: il mercato non si chiude, resta
    // aperto esattamente dov'era, perché il direttore sportivo deve poter scegliere subito un
    // sostituto — non aspettare la prossima finestra, che può essere lontana mesi. Senza questo
    // ritorno anticipato il calendario ripartiva con `coachId: null` e la scheda Allenatore
    // restava raggiungibile solo alla finestra successiva.
    if (coachResigned) {
      next = { ...next, coachRequest: null };
      return {
        state: next,
        report: emptyReport(next, {
          market: next.market,
          marketWindow: true,
          coachResigned: true,
          messages,
        }),
      };
    }

    next = { ...next, market: null, coachRequest: null };
    messages.push("Mercato chiuso.");
    // Chiudere il mercato estivo è ciò che fa partire la stagione: da qui si misura il saldo
    // di mercato dell'intera annata (sez. resoconto di fine stagione), visto che le due
    // finestre non condividono un ledger comune (`sessionDeals` si azzera a ogni apertura).
    if (eraEstiva)
      next = {
        ...next,
        phase: "stagione",
        week: 0,
        league: { round: 0, tallies: [] },
        seasonStartBudget: next.budget,
        seasonStartCoachHarmony: next.coachHarmony ?? 75,
      };
  }

  if (next.phase === "mercato_estivo") {
    const snapshot = openWindow(next, world, "estiva");
    if (snapshot) {
      // Il mondo fa il suo mercato **insieme al tuo**: è l'estate in cui si muovono tutti, e
      // vederlo succedere mentre decidi è ciò che lo fa sembrare vivo invece che di sfondo.
      //
      // Si genera **una volta per stagione**: riaprire la finestra non deve raddoppiare le
      // notizie, che oltre a essere sbagliato produrrebbe due voci identiche nell'elenco.
      const giaFatto = (next.worldTransfers ?? []).some((t) => t.season === next.season);
      const nuovi = giaFatto ? [] : (world.planTransfers?.(next.season) ?? []);

      // Stesso principio, stesso guardrail "una volta per stagione", per il mondo IA degli
      // allenatori (sez. aiCoaches.ts): la prima volta assegna, le successive esonerano/assumono.
      let aiCoaches = next.aiCoaches;
      const coachMoveMessages: string[] = [];
      if (!giaFatto) {
        const clubsInfo = buildAiClubInfos(next, world);
        if (!aiCoaches || Object.keys(aiCoaches).length === 0) {
          aiCoaches = assignInitialCoaches(clubsInfo, next.seed, next.season);
        } else {
          const evoluzione = evolveCoaches(aiCoaches, clubsInfo, next.season, next.seed);
          aiCoaches = evoluzione.assignments;
          for (const m of evoluzione.moves) {
            coachMoveMessages.push(`${m.clubName} esonera ${m.firedCoachName}: arriva ${m.hiredCoachName}.`);
          }
        }
      }

      next = {
        ...next,
        market: snapshot,
        worldTransfers: [...(next.worldTransfers ?? []), ...nuovi],
        aiCoaches,
        coachRequest: apriRichiestaAllenatore(next, world, "estiva"),
        // Ogni finestra riparte pulita: chi è saltato in estate si può ritrattare a gennaio.
        negotiationBlocked: [],
        // Operazioni della sessione partono da zero.
        sessionDeals: [],
      };
      return {
        state: next,
        report: emptyReport(next, {
          market: snapshot,
          marketWindow: true,
          messages: [...messages, "Mercato estivo aperto.", ...coachMoveMessages],
        }),
      };
    }
    next = { ...next, phase: "stagione", week: 0, league: { round: 0, tallies: [] } };
  }

  const calendar = seasonCalendar(next, world);
  const week = calendar[next.week];
  if (!week) {
    return { state: next, report: emptyReport(next, { messages: ["Stagione terminata."] }) };
  }

  const league = rebuildLeagueState(next, world);
  const round = leagueRoundOf(week);
  let match: WeekReport["match"];
  const injuries: Injury[] = [];

  if (round !== undefined) {
    const random = derivedRandom(next.seed, "md", next.leagueId, next.season, round);
    const lineup = currentLineup(next, world);
    const { followedResult, followedOpponent } = simulateMatchday(league, random, {
      followedIndex: 0,
      followedScorers: scorerPoolOf(next, lineup, world),
    });
    if (followedResult) match = { result: followedResult, opponent: followedOpponent ?? "" };

    // L'obiettivo stagionale (sez. seasonObjectives.ts) finalmente popola
    // `MoraleContext.positionsBelowTarget`, un campo che il tipo aveva già ma che nessun codice
    // scriveva mai.
    const posizioneSottoObiettivo = next.seasonObjective
      ? positionsBelowTarget(
          buildStandings(league, 0).find((r) => r.isUser)?.position ?? next.seasonObjective.targetPosition,
          next.seasonObjective.targetPosition,
        )
      : undefined;

    // Notizie di giornata: derivate da dati già calcolati qui, nessuno stato in più. Solo
    // nelle ultime giornate — prima non direbbero nulla che l'utente non sappia già — e solo
    // quando lo scarto è netto, altrimenti diventerebbe rumore ogni settimana.
    if (posizioneSottoObiettivo !== undefined && next.seasonObjective) {
      const mancano = world.leagueRounds - (round + 1);
      if (mancano >= 0 && mancano <= 5) {
        if (posizioneSottoObiettivo >= 4) {
          messages.push(
            `La pressione sale in città: siamo lontani dall'obiettivo "${next.seasonObjective.label}" a poche giornate dalla fine.`,
          );
        } else if (posizioneSottoObiettivo <= -4) {
          messages.push(
            `Entusiasmo alle stelle: stiamo facendo molto meglio dell'obiettivo "${next.seasonObjective.label}" dichiarato.`,
          );
        }
      }
    }

    next = applyMatchdayToRoster(next, lineup, followedResult, injuries, round, posizioneSottoObiettivo);
    next.league = { round: league.round, tallies: league.tallies };
  }

  // Turno di Corona infrasettimanale. Si gioca **dopo** la giornata di campionato della stessa
  // settimana, così la fatica accumulata in campionato pesa sulla partita europea e non il
  // contrario — è l'ordine reale del calendario.
  let cupMatch: WeekReport["cupMatch"];
  const cupSlot = cupSlotOf(week);
  if (cupSlot && next.cup && world.cupTeams) {
    // In Corona si scende in campo con la **rosa vera**, non con la fotografia del database:
    // altrimenti tutto il mercato fatto durante la carriera non conterebbe nulla in Europa.
    const forzaNostra = squadStrengthOf(next, world);
    const squadreCoppa: Record<string, LeagueTeam> = {
      ...world.cupTeams,
      [next.clubId]: {
        ...(world.cupTeams[next.clubId] ?? { id: next.clubId, name: world.clubName, rating: 70 }),
        rating: Math.round((forzaNostra.attack + forzaNostra.defence) / 2),
        strength: forzaNostra,
      },
    };

    const outcome = playCupRound(
      next.cup,
      squadreCoppa,
      next.clubId,
      scorerPoolOf(next, currentLineup(next, world), world),
      next.seed,
      next.season,
      cupSlot.round,
    );
    next = { ...next, cup: outcome.save };
    if (outcome.ownMatch) cupMatch = { ...outcome.ownMatch, stage: cupSlot.stage };
    if (outcome.eliminated) messages.push("Eliminati dalla Corona Continentale.");
    if (outcome.won) messages.push("Abbiamo vinto la Corona Continentale!");
  }

  // Finestra di riparazione: si apre a fine settimana e blocca l'avanzamento successivo.
  if (hasMarketWindow(week)) {
    const snapshot = openWindow(next, world, "riparazione");
    if (snapshot) {
      next = {
        ...next,
        market: snapshot,
        coachRequest: apriRichiestaAllenatore(next, world, "riparazione"),
        negotiationBlocked: [],
        // Come per l'estiva: senza azzerarlo, le operazioni fatte in estate restavano nel
        // recap del meeting di gennaio, mescolate a quelle nuove — il bug del "recap
        // sbagliato" segnalato dall'utente.
        sessionDeals: [],
      };
      messages.push("Si è aperta la finestra di riparazione.");
    }
  }

  // Un imprevisto: infortunio serio, squalifica, guaio nello spogliatoio. Uno alla volta e con
  // una tregua, altrimenti diventa rumore invece che notizia.
  let incident: Incident | undefined;
  if (round !== undefined) {
    const anagrafica = careerPlayers(next, world);
    // Il "premio del presidente" scatta solo dopo una vittoria vera a sorpresa: quanto
    // l'avversario era più forte di noi in quella partita, secondo lo stesso rating usato per
    // simularla.
    let lastMatch: { won: boolean; opponentGapFavorevole: number } | undefined;
    if (match) {
      const nostraForza = squadStrengthOf(next, world);
      const ourRating = Math.round((nostraForza.attack + nostraForza.defence) / 2);
      const opponentTeam = league.teams.find((t) => t.name === match!.opponent);
      lastMatch = {
        won: match.result.goalsFor > match.result.goalsAgainst,
        opponentGapFavorevole: opponentTeam ? opponentTeam.rating - ourRating : 0,
      };
    }
    incident = rollIncident({
      roster: next.roster,
      nameOf: (id) => anagrafica[id]?.name ?? "Un giocatore",
      matchday: round,
      lastIncidentMatchday: next.lastIncidentMatchday,
      random: derivedRandom(next.seed, "incident", next.season, round),
      lastMatch,
      // Chi non ha ricambi sani nel suo ruolo rischia di più (depthRisk, incidents.ts).
      playerRoles: anagrafica,
    });
    if (incident) {
      next = {
        ...next,
        roster: applyIncident(next.roster, incident),
        budget: next.budget + (incident.budgetDelta ?? 0),
        incident,
        lastIncidentMatchday: round,
      };
      messages.push(incident.title);
    }
  }

  // Apertura di una eventuale richiesta di cessione.
  const request = maybeOpenRequest(next, world, round ?? next.league.round);
  if (request) {
    next = { ...next, pendingRequest: request };
    messages.push(`${request.playerName} chiede la cessione.`);
  }

  // L'imprevisto si consuma nel referto: la UI lo mostra una volta e lo stato torna pulito.
  const daMostrare = incident;
  if (daMostrare) next = { ...next, incident: null };

  next = { ...next, week: next.week + 1 };
  const seasonEnded = next.week >= calendar.length;
  let careerEnded = false;

  if (seasonEnded) {
    const closed = closeSeason(next, world, buildStandings(league, 0));
    next = closed.state;
    messages.push(...closed.messages);
    careerEnded = next.phase === "conclusa";
  }

  return {
    state: next,
    report: {
      week: week.index,
      season: state.season,
      match,
      cupMatch,
      incident: daMostrare,
      standings: buildStandings(league, 0),
      injuries,
      request: request ?? undefined,
      coachResigned: coachResigned || undefined,
      marketWindow: hasMarketWindow(week),
      market: next.market ?? null,
      seasonEnded,
      careerEnded,
      messages,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Avanzamento rapido                                                          */
/* -------------------------------------------------------------------------- */

/** Perché la corsa si è fermata: è ciò che la UI deve mostrare dopo. */
export type StopReason =
  | "mercato"
  | "richiesta"
  | "imprevisto"
  | "partita_chiave"
  | "fine_stagione"
  | "fine_carriera"
  | "calendario";

export interface FastForward {
  state: CareerState;
  /** Un referto per settimana giocata, in ordine: la UI li fa scorrere. */
  reports: WeekReport[];
  reason: StopReason;
}

/**
 * Corre **fino alla prossima decisione**: mercato, richiesta di un giocatore, partita decisiva o fine stagione.
 *
 * È il ritmo giusto per una modalità in cui il momento importante è il mercato: fra una
 * finestra e l'altra ci sono diciassette giornate che l'utente vuole *vedere scorrere*, non
 * cliccare una alla volta. Restituendo tutti i referti insieme, la UI può animarli alla
 * velocità che preferisce senza che il motore sappia nulla di tempi e animazioni.
 *
 * Il limite di sicurezza esiste perché una condizione di stop che non arriva mai è un bug che
 * qui si manifesterebbe come blocco del browser, non come errore.
 */
export function advanceToNextStop(
  state: CareerState,
  world: CareerWorld,
  maxWeeks = 60,
): FastForward {
  let current = state;
  const reports: WeekReport[] = [];

  for (let i = 0; i < maxWeeks; i++) {
    const { state: next, report } = advanceWeek(current, world);
    // Una decisione già in sospeso fa tornare `advanceWeek` senza avanzare: fermarsi qui evita
    // di accumulare referti vuoti identici.
    const bloccato = next.week === current.week && !report.match;
    current = next;
    if (!bloccato) reports.push(report);

    if (report.careerEnded) return { state: current, reports, reason: "fine_carriera" };
    if (report.seasonEnded) return { state: current, reports, reason: "fine_stagione" };
    if (current.market) return { state: current, reports, reason: "mercato" };
    if (current.pendingRequest) return { state: current, reports, reason: "richiesta" };
    /**
     * **Un imprevisto ferma la corsa.**
     *
     * Continuare significherebbe accumulare notizie dietro il popup, e leggerle una dopo
     * l'altra a giochi fatti: un infortunio di tre mesi va saputo **prima** di far giocare le
     * giornate successive, non dopo, perché è un'informazione su cui si decide.
     */
    if (report.incident) return { state: current, reports, reason: "imprevisto" };

    /**
     * **Una partita decisiva (coppa o volata titolo) ferma la corsa.**
     *
     * Permette all'utente di scegliere se guardare la gara saliente in 2D (Match Theatre)
     * prima di proseguire con le giornate successive.
     */
    const nostra = report.standings?.find((r) => r.isUser);
    const primo = report.standings?.[0];
    const ePartitaChiave =
      (report.cupMatch && isKeyMatch({ cupStage: report.cupMatch.stage, totalRounds: world.leagueRounds })) ||
      (report.match &&
        nostra &&
        isKeyMatch({
          leagueRound: report.week,
          totalRounds: world.leagueRounds,
          position: nostra.position,
          gapFromFirst: (primo?.points ?? nostra.points) - nostra.points,
        }));

    if (ePartitaChiave) return { state: current, reports, reason: "partita_chiave" };
  }

  return { state: current, reports, reason: "calendario" };
}

/* -------------------------------------------------------------------------- */
/* Mercato                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Apre una finestra, se c'è un mondo di mercato.
 *
 * Restituisce `undefined` quando il mercato non è configurato: i test che verificano solo il
 * campo non devono essere costretti a costruire 96 rose per far girare una stagione.
 */
function openWindow(
  state: CareerState,
  world: CareerWorld,
  window: MarketWindow,
): MarketSnapshot | undefined {
  if (!world.market) return undefined;
  return openMarketWindow(
    state.roster,
    world.market,
    state.clubId,
    state.leagueId,
    state.budget,
    window,
    state.seed,
    state.season,
    state.lists ?? emptySquadLists(),
  );
}

/**
 * Quanto vale un nostro giocatore, oggi.
 *
 * Serve a decidere se una cifra è giusta: senza un riferimento, accettare un'offerta è un atto
 * di fede. Si ricalcola dal valore corrente, quindi tiene conto di età, rendimento e crescita —
 * non è il prezzo pagato all'acquisto.
 */
export function playerValue(state: CareerState, world: CareerWorld, playerId: string): number {
  const entry = state.roster.find((e) => e.playerId === playerId);
  if (!entry || !world.market) return 0;
  const info = careerPlayers(state, world)[playerId];
  return currentValue(
    {
      playerId,
      clubId: state.clubId,
      overall: entry.overall,
      potential: entry.potential,
      age: world.market.ageOf(playerId),
      nation: info?.nation ?? "Italia",
      department: info ? ROLE_DEPARTMENT[info.role] : "CC",
      stats: entry.stats,
    },
    world.market.valuation,
  );
}

/** Cosa chiede l'allenatore in questa sessione, se ha qualcosa da chiedere. */
function apriRichiestaAllenatore(
  state: CareerState,
  world: CareerWorld,
  window: MarketWindow,
): { request: CoachRequest; fulfilled: boolean } | null {
  const coach = state.coachId ? findCoach(state.coachId) : undefined;
  if (!coach) return null;
  const formation = getFormation(coach.formationId) ?? getFormation("4-3-3")!;
  const players = careerPlayers(state, world);
  const request = buildCoachRequest({
    coach,
    formation,
    roster: state.roster,
    players,
    ageOf: (id) => ageInSeason(players[id]?.birthDate, state.season) ?? 25,
    window,
  });
  return request ? { request, fulfilled: false } : null;
}

/**
 * Esegue un'azione di mercato sulla finestra aperta.
 *
 * È l'unico ingresso che la UI usa per comprare, vendere e prestare: `advanceWeek` resta il
 * riduttore del *tempo*, questo è il riduttore delle *trattative*. Tenerli separati evita che
 * un acquisto faccia scorrere una giornata per sbaglio.
 */
export function applyMarket(
  state: CareerState,
  world: CareerWorld,
  action: MarketAction,
): { state: CareerState; result: MarketActionResult } {
  const lists = state.lists ?? emptySquadLists();
  const fallback: MarketActionResult = {
    roster: [...state.roster],
    budget: state.budget,
    snapshot: state.market ?? { window: "estiva", offers: [], shortlist: [], loanOffers: [], aiSellable: [] },
    lists,
    message: "Nessuna finestra di mercato aperta.",
    rejected: true,
  };
  /**
   * Dichiarare chi è cedibile si può fare **sempre**, non solo a mercato aperto.
   *
   * È una decisione sulla propria rosa, non una trattativa: guardando la squadra a novembre si
   * deve poter dire "questo lo cedo a gennaio". Costringere ad aspettare la finestra
   * trasformerebbe una scelta di programmazione in un adempimento.
   */
  const dichiarazione = action.kind === "lista_trasferimenti" || action.kind === "lista_prestiti";
  if (!world.market || (!state.market && !dichiarazione)) return { state, result: fallback };

  const result = applyMarketAction(
    {
      roster: [...state.roster],
      budget: state.budget,
      snapshot: state.market ?? { window: "estiva", offers: [], shortlist: [], loanOffers: [], aiSellable: [] },
      lists,
    },
    action,
    world.market,
    state.season,
    state.seed,
  );

  // Rifiutare un'offerta ha un costo: chi si vedeva già altrove la prende male. È il pendant
  // economico del "rifiuta" nella richiesta di cessione, e rende la scelta non gratuita.
  const roster =
    action.kind === "rifiuta_offerta"
      ? result.roster.map((entry) =>
          entry.playerId === action.playerId
            ? { ...entry, morale: Math.max(0, entry.morale - 12) }
            : entry,
        )
      : result.roster;

  // L'allenatore si accorge se gli hai preso quello che chiedeva.
  let coachRequest = state.coachRequest ?? null;
  if (coachRequest && !coachRequest.fulfilled && !result.rejected) {
    if (isReductionRequest(coachRequest.request)) {
      // "Sfoltiamo" si accontenta **cedendo**, non comprando: è l'unica richiesta al contrario.
      if (roster.length < state.roster.length && roster.length < 28) {
        coachRequest = { ...coachRequest, fulfilled: true };
      }
    } else if (action.kind === "acquista") {
      const t = action.target;
      if (
        requestSatisfiedBy(coachRequest.request, {
          overall: t.overall,
          age: t.age,
          role: t.role,
          secondaryRoles: t.secondaryRoles,
        })
      ) {
        coachRequest = { ...coachRequest, fulfilled: true };
      }
    }
  }

  /**
   * **Chi metti in vendita adesso riceve offerte adesso.**
   *
   * Prima la lista contava solo alla finestra *successiva*: dichiarare un giocatore cedibile in
   * estate produceva effetti a gennaio, e nel frattempo sembrava che non fosse successo nulla.
   * È l'opposto di ciò che ci si aspetta da un mercato — si mette in vendita per vendere ora.
   */
  let snapshot = state.market ? result.snapshot : state.market;
  if (
    snapshot &&
    world.market &&
    action.kind === "lista_trasferimenti" &&
    action.on &&
    !result.rejected &&
    !snapshot.offers.some((o) => o.playerId === action.playerId)
  ) {
    const fresche = openMarketWindow(
      roster,
      world.market,
      state.clubId,
      state.leagueId,
      result.budget,
      snapshot.window,
      state.seed,
      state.season,
      { transferList: [action.playerId], loanList: [] },
    ).offers.filter((o) => o.playerId === action.playerId);

    if (fresche.length > 0) {
      snapshot = { ...snapshot, offers: [...fresche, ...snapshot.offers] };
    }
  }

  // Stessa identica garanzia, ma per i prestiti: mettere un giocatore in lista prestiti fa
  // arrivare subito una destinazione, non aspetta la finestra successiva (sez. 3.7.5).
  if (
    snapshot &&
    world.market &&
    action.kind === "lista_prestiti" &&
    action.on &&
    !result.rejected &&
    !snapshot.loanOffers.some((l) => l.playerId === action.playerId)
  ) {
    const fresche = openMarketWindow(
      roster,
      world.market,
      state.clubId,
      state.leagueId,
      result.budget,
      snapshot.window,
      state.seed,
      state.season,
      { transferList: [], loanList: [action.playerId] },
    ).loanOffers.filter((l) => l.playerId === action.playerId);

    if (fresche.length > 0) {
      snapshot = { ...snapshot, loanOffers: [...fresche, ...snapshot.loanOffers] };
    }
  }

  // Gestione intoccabili e sintonia mister
  const intoccabili = getCoachUntouchables(state.roster, state.coachId, careerPlayers(state, world));
  const cedutoId = "playerId" in action ? action.playerId : undefined;
  let coachHarmony = state.coachHarmony ?? 75;
  let resultMsg = result.message;

  if (cedutoId && intoccabili.includes(cedutoId) && roster.length < state.roster.length && !result.rejected) {
    coachHarmony = Math.max(0, coachHarmony - 25);
    resultMsg += " ⚡ Il mister è furioso per la cessione di un suo intoccabile! Sintonia in calo.";
  }

  if (coachRequest?.fulfilled && (!state.coachRequest || !state.coachRequest.fulfilled)) {
    coachHarmony = Math.min(100, coachHarmony + 12);
  }

  /**
   * **Chi non è più in rosa sparisce dalle proposte.**
   *
   * Venduto un giocatore restavano visibili le proposte di prestito che lo riguardavano, e
   * cliccarle non faceva nulla: una riga morta che sembra un bug perché lo è.
   */
  if (snapshot) {
    const inRosa = new Set(roster.map((e) => e.playerId));
    const ripulite = snapshot.loanOffers.filter((l) => inRosa.has(l.playerId));
    const offerteValide = snapshot.offers.filter((o) => inRosa.has(o.playerId));
    if (ripulite.length !== snapshot.loanOffers.length || offerteValide.length !== snapshot.offers.length) {
      snapshot = { ...snapshot, loanOffers: ripulite, offers: offerteValide };
    }
  }

  let sessionDeals = [...(state.sessionDeals ?? [])];
  if (!result.rejected) {
    // `world.players` non copre i nostri regen nati in carriera (`state.generated`): per un
    // giocatore nostro venduto/prestato serve sempre l'anagrafica fusa, altrimenti il recap
    // di fine mercato lo chiama "Giocatore" o, peggio, lo salta del tutto.
    const anagrafica = careerPlayers(state, world);
    if (action.kind === "acquista") {
      sessionDeals.push({
        playerId: action.target.playerId,
        playerName: action.target.name,
        kind: "acquisto",
        amount: action.target.price,
      });
    } else if (action.kind === "compra") {
      const entry = state.market?.shortlist.find((s) => s.playerId === action.playerId);
      const player = anagrafica[action.playerId];
      if (player) {
        sessionDeals.push({
          playerId: action.playerId,
          playerName: player.name,
          kind: "acquisto",
          amount: entry?.price ?? playerValue(state, world, action.playerId),
        });
      }
    } else if (action.kind === "accetta_offerta") {
      const offer = state.market?.offers.find((o) => o.playerId === action.playerId);
      const player = anagrafica[action.playerId];
      if (player) {
        sessionDeals.push({
          playerId: action.playerId,
          playerName: player.name,
          kind: "cessione",
          amount: offer?.fee ?? playerValue(state, world, action.playerId),
        });
      }
    } else if (action.kind === "vendi_subito") {
      const player = anagrafica[action.playerId];
      if (player) {
        sessionDeals.push({
          playerId: action.playerId,
          playerName: player.name,
          kind: "cessione",
          amount: Math.round(playerValue(state, world, action.playerId) * 0.8),
        });
      }
    } else if (action.kind === "manda_in_prestito") {
      const player = anagrafica[action.playerId];
      if (player) {
        sessionDeals.push({
          playerId: action.playerId,
          playerName: player.name,
          kind: "prestito",
          amount: 0,
        });
      }
    } else if (action.kind === "chiedi_prestito") {
      const player = anagrafica[action.target.playerId];
      if (player) {
        sessionDeals.push({
          playerId: action.target.playerId,
          playerName: player.name,
          kind: "prestito",
          amount: action.target.loanFee ?? 0,
        });
      }
    } else if (action.kind === "controproposta") {
      // Mancava dal recap: era l'unica azione di risposta a un'offerta non coperta da questo
      // switch, quindi una cessione chiusa così spariva dal meeting di fine mercato.
      const player = anagrafica[action.playerId];
      if (player) {
        sessionDeals.push({
          playerId: action.playerId,
          playerName: player.name,
          kind: "cessione",
          amount: Math.max(0, result.budget - state.budget),
        });
      }
    }
  }

  return {
    state: {
      ...state,
      roster,
      budget: result.budget,
      // Fuori dalla finestra non esiste una fotografia da aggiornare: si tocca solo la lista.
      market: snapshot,
      coachRequest,
      coachHarmony,
      lists: result.lists,
      sessionDeals,
    },
    result: {
      ...result,
      roster,
      message: resultMsg,
    },
  };
}

/**
 * Cerca giocatori sul mercato.
 *
 * Unisce qui il pool di valutazione (`transferPool`) e l'anagrafica (`players`) perché sono due
 * viste dello stesso giocatore che il mondo tiene separate: chiedere alla UI di ricomporle
 * significherebbe rifare il join a ogni tasto premuto nella casella di ricerca.
 */
export function searchMarket(
  state: CareerState,
  world: CareerWorld,
  criteria: SearchCriteria,
): SearchResult[] {
  if (!world.market) return [];
  const anagrafica = world.market.players;

  const players: SearchablePlayer[] = [];
  for (const player of world.market.transferPool) {
    const info = anagrafica[player.playerId];
    if (!info) continue;
    players.push({
      ...player,
      name: info.name,
      role: info.role,
      secondaryRoles: info.secondaryRoles,
    });
  }

  return searchPlayers({
    players,
    clubs: world.market.clubs,
    valuation: world.market.valuation,
    ownClubId: state.clubId,
    seed: state.seed,
    season: state.season,
    criteria,
  });
}

/* -------------------------------------------------------------------------- */
/* Trattative                                                                  */
/* -------------------------------------------------------------------------- */

/** La trattativa per questo giocatore è già saltata in questa finestra? */
export function isNegotiationBlocked(state: CareerState, playerId: string): boolean {
  return (state.negotiationBlocked ?? []).includes(playerId);
}

/** Quanto scarto stagionale imprimere al tetto nascosto di una trattativa: sempre lo stesso
 * calcolo, da entrambi i lati (sez. "esito non fisso a parità di offerta"). */
function ceilingNoise(state: CareerState, playerId: string): number {
  return derivedRandom(state.seed, "ceiling", state.season, playerId)() * 0.08 - 0.04;
}

/** Apre una trattativa per **cedere** un proprio giocatore, partendo da un'offerta ricevuta. */
export function negotiateOffer(state: CareerState, playerId: string): CareerState {
  const offer = state.market?.offers.find((o) => o.playerId === playerId);
  if (!offer || isNegotiationBlocked(state, playerId)) return state;
  return {
    ...state,
    negotiation: openNegotiation({
      kind: "cessione",
      playerId: offer.playerId,
      playerName: offer.playerName,
      clubId: offer.fromClubId,
      clubName: offer.fromClubName,
      amount: offer.fee,
      appetite: offer.appetite,
      noise: ceilingNoise(state, playerId),
    }),
  };
}

/**
 * Apre una trattativa per mandare un giocatore **in prestito**, partendo da una destinazione
 * proposta. Stessa infrastruttura della cessione (`negotiation.ts`, `kind: "prestito"`), ma qui
 * si negoziano i **minuti garantiti**, non un prezzo — coerente col fatto che un prestito in
 * uscita non porta soldi, porta campo per il giocatore (sez. 3.7.5).
 */
export function negotiateLoanOffer(state: CareerState, playerId: string): CareerState {
  const loan = state.market?.loanOffers.find((l) => l.playerId === playerId);
  if (!loan || isNegotiationBlocked(state, playerId)) return state;
  // Nessun segnale di "quanto ci tengono" come per le offerte di acquisto (`offer.appetite`):
  // si stima dai minuti già proposti — chi apre offrendo più campo ci tiene di più.
  const appetite = Math.max(0, Math.min(1, loan.expectedMinutes / 2700));
  return {
    ...state,
    negotiation: openNegotiation({
      kind: "prestito",
      playerId: loan.playerId,
      playerName: loan.playerName,
      clubId: loan.clubId,
      clubName: loan.clubName,
      amount: loan.expectedMinutes,
      appetite,
      noise: ceilingNoise(state, playerId),
    }),
  };
}

/**
 * Soglia di prestigio oltre la quale un club resiste davvero a vendere i suoi migliori.
 * Sotto questa soglia i gioielli si trattano come chiunque altro.
 */
const TOP_CLUB_PRESTIGE = 4;

/**
 * Apre una trattativa per **comprare** un giocatore trovato con la ricerca.
 *
 * L'appetito qui è quello del **venditore** a tenerselo, quindi è alto per i suoi migliori: si
 * strappa uno sconto su chi non è indispensabile, non sul fuoriclasse.
 *
 * **I top club non vendono facilmente i loro top player.** Se il bersaglio è fra i primi due
 * per Overall di un club di prestigio alto, i soldi non bastano: la richiesta di apertura sale
 * ben oltre il valore di mercato (bisogna sfondare, non solo pareggiare), e c'è una probabilità
 * concreta — decisa una volta sola all'apertura, non ritentabile abbandonando e riaprendo nella
 * stessa finestra — che il club rifiuti categoricamente, punto, senza margine di trattativa.
 * Segnalato dall'utente: "i soldi non sono garanzia di acquisto".
 */
export function negotiatePurchase(
  state: CareerState,
  world: CareerWorld,
  target: SearchResult,
): CareerState {
  if (isNegotiationBlocked(state, target.playerId)) return state;
  const attaccamento = Math.max(0, Math.min(1, (target.overall - 68) / 22));

  const club = world.market?.clubs[target.clubId];
  const prestigio = world.market?.valuation.clubPrestige[target.clubId] ?? 0;
  const undiciOrdinato = [...(club?.startingEleven ?? [])].sort((a, b) => b - a);
  const gioiello =
    prestigio >= TOP_CLUB_PRESTIGE &&
    undiciOrdinato.length >= 2 &&
    target.overall >= undiciOrdinato[1]!;

  // Seedato e non `Math.random()`: stesso principio di tutto il motore, una trattativa riaperta
  // da un salvataggio deve proporre lo stesso esito, non uno nuovo a ogni caricamento.
  const random = derivedRandom(state.seed, "gioiello", state.season, target.playerId);
  const inflazione = 2.2 + random() * 0.3;

  if (gioiello) {
    // Il rifiuto si decide una volta sola, non a ogni mossa: altrimenti basterebbe abbandonare
    // e riaprire finché non esce il tiro buono, e il "no" non costerebbe nulla a nessuno.
    if (random() < 0.15) {
      return {
        ...state,
        negotiation: {
          kind: "acquisto",
          playerId: target.playerId,
          playerName: target.name,
          clubId: target.clubId,
          clubName: target.clubName,
          amount: target.price,
          ceiling: target.price,
          patience: 0,
          round: 0,
          status: "arenata",
          ending: "rottura",
          log: [
            {
              speaker: "loro",
              text: `${target.name} non è in vendita, punto. Non ne parliamo nemmeno per cifre folli.`,
              amount: target.price,
            },
          ],
        },
      };
    }
  }

  return {
    ...state,
    negotiation: openNegotiation({
      kind: "acquisto",
      playerId: target.playerId,
      playerName: target.name,
      clubId: target.clubId,
      clubName: target.clubName,
      // Un gioiello si apre ben sopra il valore: bisogna sfondare, non pareggiare.
      amount: gioiello ? Math.round(target.price * inflazione) : target.price,
      appetite: gioiello ? Math.max(attaccamento, 0.92) : attaccamento,
      noise: ceilingNoise(state, target.playerId),
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Il faccia a faccia col giocatore                                           */
/* -------------------------------------------------------------------------- */

/**
 * Quanto è probabile che un giocatore, di fronte a un'offerta ricevuta, spinga per la
 * cessione — non tutte le offerte devono generare una chat, non tutti i giocatori vogliono
 * andare via (richiesta esplicita dell'utente). Sale con: chi lo cerca è un club di prestigio
 * (un top club pesa, non una squadra qualunque), quanto poco gioca nel proprio club (chi è
 * ai margini ha più ragioni per ascoltare un'offerta), e il proprio malcontento di fondo.
 */
export function offerPushProbability(state: CareerState, world: CareerWorld, entry: RosterEntry, offer: IncomingOffer): number {
  const prestigio = world.market?.valuation.clubPrestige[offer.fromClubId] ?? 3;
  const availableMinutes = Math.max(1, state.league.round * 90);
  const playedShare = Math.min(entry.stats.minutes / availableMinutes, 1);

  // Poco realistico, segnalato dall'utente: un titolare preso quest'anno che gioca con
  // continuità non deve spingere per andarsene di sua iniziativa nella stessa stagione
  // dell'arrivo — la base 10% (che altrimenti si applica sempre, a prescindere da quanto gioca)
  // scende a zero solo per questo profilo specifico. Dalla stagione successiva torna al
  // comportamento normale.
  if (
    entry.sinceSeason === state.season &&
    playedShare >= 0.5 &&
    entry.morale >= STANDOFF_MORALE_THRESHOLD
  ) {
    return 0;
  }

  let prob = 0.1;
  if (prestigio >= 4) prob += 0.35; // un top club chiama, e si sente
  if (playedShare < 0.35) prob += 0.35; // gioca poco: un'occasione da ascoltare
  if (entry.morale < STANDOFF_MORALE_THRESHOLD) prob += 0.2; // già scontento di suo
  return Math.min(0.9, prob);
}

/** Seedato per (stagione, settimana, giocatore): stabile finché la finestra resta la stessa. */
function pushesForSale(state: CareerState, world: CareerWorld, entry: RosterEntry, offer: IncomingOffer): boolean {
  const random = derivedRandom(state.seed, "standoffPush", state.season, state.week, entry.playerId);
  return random() < offerPushProbability(state, world, entry, offer);
}

/**
 * Chi merita un faccia a faccia adesso: sotto soglia di morale, o (con probabilità realistica,
 * non sempre) spinto a farsi sentire da un'offerta di mercato sul tavolo. È l'elenco della
 * scheda Chat dentro Rosa — un tab che sostituisce l'attesa passiva della richiesta throttled
 * del motore con un elenco su cui il direttore sportivo può agire quando vuole.
 */
export function standoffCandidates(
  state: CareerState,
  world: CareerWorld,
): { playerId: string; name: string; morale: number; hasOffer: boolean }[] {
  const offerById = new Map((state.market?.offers ?? []).map((o) => [o.playerId, o]));
  const anagrafica = careerPlayers(state, world);
  return state.roster
    .filter((e) => !e.loan?.hostClubId)
    .map((e) => {
      const offer = offerById.get(e.playerId);
      const spinge = offer ? pushesForSale(state, world, e, offer) : false;
      return { entry: e, unhappy: e.morale < STANDOFF_MORALE_THRESHOLD, spinge };
    })
    .filter((x) => x.unhappy || x.spinge)
    .map((x) => ({
      playerId: x.entry.playerId,
      name: anagrafica[x.entry.playerId]?.name ?? "Giocatore",
      morale: x.entry.morale,
      hasOffer: x.spinge,
    }))
    .sort((a, b) => a.morale - b.morale);
}

/** Apre il faccia a faccia con un giocatore, con la sua offerta collegata solo se è lei a spingerlo a parlare. */
export function openPlayerStandoff(
  state: CareerState,
  world: CareerWorld,
  playerId: string,
): PlayerStandoff | null {
  const entry = state.roster.find((e) => e.playerId === playerId);
  if (!entry) return null;
  const name = careerPlayers(state, world)[playerId]?.name ?? "Giocatore";
  const offer = state.market?.offers.find((o) => o.playerId === playerId);
  const spinge = offer ? pushesForSale(state, world, entry, offer) : false;

  const squadAverage = averageOverall(state.roster);
  const availableMinutes = Math.max(1, state.league.round * 90);
  const context: MoraleContext = { squadAverage, availableMinutes, played: false, scored: false };

  // Chi ha già subito una promessa infranta parla da un rapporto rotto, qualunque sia il motivo
  // per cui lo stiamo contattando adesso: la fiducia tradita viene prima di tutto il resto.
  const reason: StandoffReason = state.brokenTrust?.[playerId]
    ? "tradito"
    : spinge
      ? "richiamato"
      : isTooGoodForBench(entry, context)
        ? "vuole_giocare"
        : "scontento";

  return openStandoff(
    entry,
    name,
    reason,
    spinge && offer ? { clubId: offer.fromClubId, clubName: offer.fromClubName } : undefined,
  );
}

/**
 * Applica una mossa del faccia a faccia allo stato della carriera: morale, liste, promessa di
 * spazio (stesso canale di `applyPlayerTalk`/`minutesPromises`) e, se si accetta la cessione
 * collegata, l'operazione vera e propria — stesso trattamento di `accetta_offerta`
 * (`applyMarket`), perché per l'utente è la stessa identica operazione, solo raggiunta da un'altra porta.
 */
export function applyPlayerStandoff(
  state: CareerState,
  world: CareerWorld,
  standoff: PlayerStandoff,
  move: StandoffMove,
): { state: CareerState; standoff: PlayerStandoff } {
  const {
    standoff: dopo,
    moraleDelta,
    listForTransfer,
    listForLoan,
    promiseMinutes,
    moneyBonus,
    promise,
    sellNow,
    coachResigns,
    coachBenches,
  } = applyStandoffMove(standoff, move);

  let next = state;
  // Bivio giocatore-mister, lato mister: schierarsi col giocatore costa la panchina — stesso
  // trattamento delle dimissioni per promesse infrante, nessun indennizzo (è una scelta sua).
  if (coachResigns) {
    next = { ...next, coachId: null, coachPromises: [], coachHarmony: 40 };
  }
  // "Tenerli entrambi" fino alla rottura: il mister smette di schierarlo, per davvero
  // (`currentLineup` lo esclude), non solo sulla carta.
  if (coachBenches) {
    next = { ...next, coachBenched: { ...(next.coachBenched ?? {}), [standoff.playerId]: true } };
  }
  if (moneyBonus) {
    // Premio subito: una percentuale del valore attuale, con un minimo che lo renda un gesto
    // vero anche per un giocatore che vale poco — non una mancia simbolica.
    const importo = Math.max(200_000, Math.round(playerValue(state, world, standoff.playerId) * 0.04));
    next = { ...next, budget: next.budget - importo };
  }
  if (promise) {
    next = {
      ...next,
      playerPromises: {
        ...(next.playerPromises ?? {}),
        [standoff.playerId]: { kind: promise.kind, department: promise.department, madeSeason: state.season },
      },
    };
  }
  if (moraleDelta !== 0) {
    next = {
      ...next,
      roster: next.roster.map((e) =>
        e.playerId === standoff.playerId
          ? { ...e, morale: Math.max(0, Math.min(100, e.morale + moraleDelta)) }
          : e,
      ),
    };
  }
  if (listForTransfer) {
    const lista = next.lists?.transferList ?? [];
    if (!lista.includes(standoff.playerId)) {
      next = {
        ...next,
        lists: { transferList: [...lista, standoff.playerId], loanList: next.lists?.loanList ?? [] },
      };
    }
  }
  if (listForLoan) {
    const lista = next.lists?.loanList ?? [];
    if (!lista.includes(standoff.playerId)) {
      next = {
        ...next,
        lists: { transferList: next.lists?.transferList ?? [], loanList: [...lista, standoff.playerId] },
      };
    }
    // Stessa garanzia del mercato prestiti (sez. 3.7.5): concedere il prestito in chat non deve
    // aspettare la prossima finestra per proporre una destinazione.
    if (next.market && world.market && !next.market.loanOffers.some((l) => l.playerId === standoff.playerId)) {
      const fresche = openMarketWindow(
        next.roster,
        world.market,
        next.clubId,
        next.leagueId,
        next.budget,
        next.market.window,
        next.seed,
        next.season,
        { transferList: [], loanList: [standoff.playerId] },
      ).loanOffers.filter((l) => l.playerId === standoff.playerId);
      if (fresche.length > 0) {
        next = { ...next, market: { ...next.market, loanOffers: [...fresche, ...next.market.loanOffers] } };
      }
    }
  }
  if (promiseMinutes && !next.minutesPromises?.[standoff.playerId]) {
    next = {
      ...next,
      minutesPromises: { ...(next.minutesPromises ?? {}), [standoff.playerId]: { roundsWaited: 0 } },
    };
  }
  if (sellNow && next.market) {
    const offer = next.market.offers.find((o) => o.playerId === standoff.playerId);
    if (offer) {
      next = {
        ...next,
        roster: next.roster.filter((e) => e.playerId !== standoff.playerId),
        budget: next.budget + offer.fee,
        market: {
          ...next.market,
          offers: next.market.offers.filter((o) => o.playerId !== standoff.playerId),
          loanOffers: next.market.loanOffers.filter((l) => l.playerId !== standoff.playerId),
        },
        lists: {
          transferList: (next.lists?.transferList ?? []).filter((id) => id !== standoff.playerId),
          loanList: (next.lists?.loanList ?? []).filter((id) => id !== standoff.playerId),
        },
        sessionDeals: [
          ...(next.sessionDeals ?? []),
          { playerId: offer.playerId, playerName: offer.playerName, kind: "cessione", amount: offer.fee },
        ],
      };
    }
  }
  // La conversazione sulla fiducia tradita si è svolta, quale che sia stato l'esito: il prossimo
  // standoff riparte da un motivo ordinario, non trascina "tradito" all'infinito.
  if (dopo.status !== "aperta" && next.brokenTrust?.[standoff.playerId]) {
    const { [standoff.playerId]: _rimosso, ...restoBrokenTrust } = next.brokenTrust;
    next = { ...next, brokenTrust: restoBrokenTrust };
  }

  // Rottura vera col club: la titolarità garantita si perde per davvero, non prima. Un giocatore
  // con cui non si arriva mai alla rottura non deve subire questa conseguenza — solo qui, non al
  // primo malumore risolto bene.
  if (dopo.status === "rotta" && next.guaranteedStarters) {
    const rimasti = Object.fromEntries(
      Object.entries(next.guaranteedStarters).filter(([, playerId]) => playerId !== standoff.playerId),
    ) as typeof next.guaranteedStarters;
    if (Object.keys(rimasti!).length !== Object.keys(next.guaranteedStarters).length) {
      next = { ...next, guaranteedStarters: rimasti };
    }
  }

  return { state: next, standoff: dopo };
}

/**
 * **Un solo canale per le richieste di cessione.**
 *
 * Prima esistevano due sistemi paralleli per lo stesso concetto: un popup forzato a 4 bottoni
 * (`events.ts`, `TransferRequest`/`pendingRequest` — bloccava la settimana, ma la sua
 * `resolveTransferRequest` non era nemmeno collegata: `applyRequestResponse` la duplicava con
 * una versione più povera che spostava solo il morale, senza nemmeno iscrivere in lista
 * trasferimenti chi veniva "accettato") e la chat ricca volontaria (`playerStandoff.ts`). Da qui
 * in poi la richiesta forzata **apre la stessa chat**, solo senza la possibilità di chiuderla
 * senza risolverla (`WeekDecisions.requestResponse` blocca ancora la settimana, `findTransferRequest`
 * e il suo cooldown restano gli stessi di sempre — cambia solo *come* si risolve).
 */
export function openForcedStandoff(state: CareerState): PlayerStandoff | null {
  const pending = state.pendingRequest;
  if (!pending) return null;
  const entry = state.roster.find((e) => e.playerId === pending.playerId);
  if (!entry) return null;
  return openStandoff(entry, pending.playerName, pending.reason);
}

/**
 * Risolve la richiesta forzata: applica la mossa come una chat qualunque (`applyPlayerStandoff`)
 * e, quando la conversazione smette di essere aperta, libera la settimana esattamente come
 * faceva `applyRequestResponse` — `pendingRequest` si svuota e `lastResolvedMatchday` si
 * aggiorna per il cooldown già esistente in `findTransferRequest`.
 */
export function resolveForcedStandoff(
  state: CareerState,
  world: CareerWorld,
  standoff: PlayerStandoff,
  move: StandoffMove,
): { state: CareerState; standoff: PlayerStandoff } {
  const { state: dopo, standoff: standoffDopo } = applyPlayerStandoff(state, world, standoff, move);
  if (standoffDopo.status === "aperta") {
    return { state: dopo, standoff: standoffDopo };
  }
  return {
    state: { ...dopo, pendingRequest: null, lastResolvedMatchday: dopo.league.round },
    standoff: standoffDopo,
  };
}

/* -------------------------------------------------------------------------- */
/* Rinnovo del rapporto col mister a ogni stagione                            */
/* -------------------------------------------------------------------------- */

/**
 * **Il mister fa nuove richieste ogni stagione, non solo alla prima.**
 *
 * `coachPromises` veniva scritto solo all'ingaggio: dalla seconda stagione in poi non c'era mai
 * un nuovo meeting, e `seasonNegotiationDone` (azzerato a ogni `closeSeason`) restava scritto
 * ma mai letto da nessuno — un cancello senza porta. La UI (`CareerScreen`) mostra ora un
 * incontro col mister a inizio stagione finché `seasonNegotiationDone` è `false`, e questa
 * funzione ne registra l'esito: accettare le nuove richieste le rende vincolanti (si verificano
 * a fine finestra come sempre, `verifyCoachPromises`) e dà un piccolo credito di sintonia; farlo
 * arenare (mancata trattativa) costa sintonia, perché ignorare la conversazione non può essere
 * gratis quanto affrontarla.
 */
export function confirmCoachSeasonPromises(
  state: CareerState,
  world: CareerWorld,
  promises: CoachPromise[],
  salaryBump = 0,
): CareerState {
  return maybePoachOurCoach(
    {
      ...state,
      coachPromises: promises,
      seasonNegotiationDone: true,
      coachHarmony: Math.min(100, (state.coachHarmony ?? 75) + 5),
      // Un adeguamento d'ingaggio concordato in trattativa (mediazione "boost_salary") è un
      // costo vero, non solo narrativo — stesso principio del cambio allenatore a pagamento.
      budget: state.budget - Math.max(0, salaryBump),
    },
    world,
  );
}

/** Il meeting di inizio stagione è saltato/arenato: il mister la prende male. */
export function declineCoachSeasonMeeting(state: CareerState, world: CareerWorld): CareerState {
  return maybePoachOurCoach(
    {
      ...state,
      seasonNegotiationDone: true,
      coachHarmony: Math.max(0, (state.coachHarmony ?? 75) - 15),
    },
    world,
  );
}

/**
 * **Proponi un'alternativa a una promessa del mister, a mercato aperto — scelta dal database,
 * non auto-selezionata.**
 *
 * `proposePromiseCompromise` (coachNegotiation.ts) esisteva già per l'azione
 * `"offer_alternative"`, ma finora era raggiungibile solo dalla chat di rinnovo (inizio
 * carriera/stagione), mai durante una finestra di mercato già aperta — e sceglieva il primo
 * candidato di una lista invece di lasciar scegliere l'utente. Qui il candidato arriva già
 * scelto (dalla ricerca del mercato, sez. "Ricerca" del pannello): non serve una trattativa
 * multi-turno con barra di pazienza propria, basta **una** chiamata alla stessa funzione pura
 * già esistente, su uno stato di negoziazione costruito al volo dalle promesse correnti — la
 * risposta del mister torna come messaggio, da mostrare come un piccolo avviso nella stessa
 * scheda (non un nuovo meeting a schermo intero).
 */
export function proposePromiseAlternative(
  state: CareerState,
  promiseId: string,
  candidate: RoleCandidate,
): { state: CareerState; message: string; accepted: boolean } {
  const coach = state.coachId ? findCoach(state.coachId) : undefined;
  const negState: CoachNegotiationState = {
    coachId: state.coachId ?? "",
    coachName: coach?.name ?? "Mister",
    patience: 100,
    hireCost: 0,
    buyoutFee: 0,
    promises: state.coachPromises ?? [],
    status: "in_corso",
    log: [],
  };
  const { state: newNegState, accepted, message } = proposePromiseCompromise(
    negState,
    promiseId,
    "offer_alternative",
    [candidate],
  );
  return {
    state: { ...state, coachPromises: newNegState.promises },
    message,
    accepted,
  };
}

/** Sotto quale sintonia il nostro mister ascolta le sirene di un altro club. */
export const COACH_POACH_HARMONY_THRESHOLD = 40;
/** Probabilità **condizionata** a quella sintonia bassa: non un tiro a vuoto ogni stagione. */
export const COACH_POACH_ODDS = 0.25;

/**
 * **Anche il nostro mister può essere corteggiato via**, se il rapporto è scarso e non lo
 * convinciamo a restare — richiesta esplicita dell'utente. Si valuta solo al rinnovo di
 * stagione (`confirmCoachSeasonPromises`/`declineCoachSeasonMeeting`), non a sorpresa a
 * stagione in corso: è lì che la sintonia si è appena aggiornata, ed è il momento in cui il
 * giocatore si aspetta una notizia sul futuro del mister.
 *
 * Solo un club **di prestigio superiore al nostro**, fra quelli con un'identità assegnata
 * (sez. `aiCoaches.ts`), se lo porta via — un club minore non ha argomenti per convincerlo.
 */
function maybePoachOurCoach(state: CareerState, world: CareerWorld): CareerState {
  if (!state.coachId) return state;
  const harmony = state.coachHarmony ?? 75;
  if (harmony >= COACH_POACH_HARMONY_THRESHOLD) return state;

  const random = derivedRandom(state.seed, "coachPoach", state.season);
  if (random() >= COACH_POACH_ODDS) return state;

  const coach = findCoach(state.coachId);
  if (!coach) return state;

  const nostroPrestigio = world.market?.valuation.clubPrestige[state.clubId] ?? 3;
  const pretendenti = buildAiClubInfos(state, world).filter((c) => c.prestige > nostroPrestigio);
  if (pretendenti.length === 0) return state;
  const club = pretendenti[Math.floor(random() * pretendenti.length)]!;

  return {
    ...state,
    coachId: null,
    aiCoaches: { ...(state.aiCoaches ?? {}), [club.id]: { coachId: coach.id, sinceSeason: state.season } },
    coachDeparture: { coachName: coach.name, clubName: club.name },
  };
}

/** Le tre fasce fra cui il DS può scegliere l'obiettivo di questa stagione. */
export function seasonObjectiveChoices(state: CareerState, world: CareerWorld): ObjectiveTier[] {
  return suggestObjectiveTiers(state.roster, world.opponents, world.opponents.length + 1);
}

/** Dichiara l'obiettivo: chiude il gate di inizio stagione, come il rinnovo col mister. */
export function setSeasonObjective(state: CareerState, tier: ObjectiveTier): CareerState {
  return {
    ...state,
    seasonObjective: { targetPosition: tier.targetPosition, label: tier.label, setSeason: state.season },
    seasonObjectiveSet: true,
  };
}

export interface NegotiationOutcome {
  state: CareerState;
  /** Messaggio da mostrare a trattativa conclusa o arenata; assente se prosegue. */
  message?: string;
  /** L'affare è andato in porto. */
  closed?: boolean;
  /** La trattativa si è arenata. */
  stalled?: boolean;
}

/**
 * Fa una mossa nella trattativa aperta, ed **esegue l'operazione** quando si chiude.
 *
 * L'esecuzione sta qui e non nel modulo della trattativa perché quel modulo non deve sapere
 * nulla di rose e vincoli: sa negoziare una cifra, punto. Qui invece si controlla che la rosa
 * regga davvero l'operazione — e se non regge, l'accordo salta con un motivo dichiarato invece
 * di produrre uno stato incoerente.
 */
export function playNegotiation(
  state: CareerState,
  world: CareerWorld,
  move: NegotiationMove,
): NegotiationOutcome {
  const corrente = state.negotiation;
  if (!corrente || corrente.status !== "aperta") return { state };

  const random = derivedRandom(state.seed, "tratt", state.season, corrente.playerId, corrente.round);
  const dopo = applyNegotiationMove(corrente, move, random);

  if (dopo.status === "arenata") {
    /**
     * **Se te l'hanno soffiato, se ne va davvero.**
     *
     * Registrare il trasferimento fra le operazioni del mondo non è un dettaglio narrativo: è
     * ciò che rende vera la notizia. Il giocatore cambia squadra, sparisce da chi lo aveva
     * prima e — la prossima volta che lo cerchi — lo trovi dove è andato. Senza, "un'altra
     * squadra l'ha chiuso stamattina" resterebbe una frase, e riaprendo la ricerca sarebbe
     * ancora lì al suo posto.
     */
    let worldTransfers = state.worldTransfers ?? [];
    if (dopo.ending === "soffiato" && world.market) {
      const suo = world.market.clubs[dopo.clubId];
      const rivale = scegliRivale(state, world, dopo.playerId, dopo.clubId);
      if (rivale && suo) {
        worldTransfers = [
          ...worldTransfers,
          {
            playerId: dopo.playerId,
            playerName: dopo.playerName,
            fromClubId: dopo.clubId,
            toClubId: rivale,
            fee: Math.round(dopo.amount * 1.15),
            season: state.season,
          },
        ];
      }
    }

    return {
      state: {
        ...state,
        negotiation: dopo,
        worldTransfers,
        // Non si ritratta lo stesso giocatore in questa finestra: altrimenti basterebbe
        // riaprire finché non esce il risultato voluto, e la pazienza non costerebbe nulla.
        negotiationBlocked: [...(state.negotiationBlocked ?? []), dopo.playerId],
        // L'offerta sfuma: chi si è alzato dal tavolo non torna in questa finestra.
        market: state.market
          ? { ...state.market, offers: state.market.offers.filter((o) => o.playerId !== dopo.playerId) }
          : state.market,
      },
      message: `${endingLabel(dopo)}: ${dopo.playerName}.`,
      stalled: true,
    };
  }

  if (dopo.status !== "conclusa") return { state: { ...state, negotiation: dopo } };

  if (dopo.kind === "prestito") {
    const entry = state.roster.find((e) => e.playerId === dopo.playerId);
    const check = entry
      ? canLoanOut(state.roster, {
          playerId: entry.playerId,
          age: world.market?.ageOf(entry.playerId) ?? 25,
          overall: entry.overall,
          potential: entry.potential,
        })
      : { ok: false, reason: "Non è un tuo giocatore." };
    if (!entry || !check.ok) {
      return {
        state: { ...state, negotiation: { ...dopo, status: "arenata" } },
        message: check.reason ?? "Prestito non possibile.",
        stalled: true,
      };
    }
    return {
      state: {
        ...state,
        negotiation: dopo,
        roster: state.roster.map((e) =>
          e.playerId === dopo.playerId
            ? openLoan(
                e,
                { playerId: e.playerId, clubId: dopo.clubId, direction: "uscita", fee: 0, expectedMinutes: dopo.amount },
                state.season,
              )
            : e,
        ),
        lists: {
          transferList: (state.lists?.transferList ?? []).filter((id) => id !== dopo.playerId),
          loanList: (state.lists?.loanList ?? []).filter((id) => id !== dopo.playerId),
        },
        market: state.market
          ? { ...state.market, loanOffers: state.market.loanOffers.filter((l) => l.playerId !== dopo.playerId) }
          : state.market,
        sessionDeals: [
          ...(state.sessionDeals ?? []),
          { playerId: dopo.playerId, playerName: dopo.playerName, kind: "prestito", amount: 0 },
        ],
      },
      message: `${dopo.playerName} va in prestito al ${dopo.clubName}: circa ${Math.round(dopo.amount / 90)} partite garantite.`,
      closed: true,
    };
  }

  if (dopo.kind === "cessione") {
    const check = canSell(state.roster, dopo.playerId, careerPlayers(state, world));
    if (!check.ok) {
      return {
        state: { ...state, negotiation: { ...dopo, status: "arenata" } },
        message: check.reason ?? "Non puoi venderlo.",
        stalled: true,
      };
    }
    return {
      state: {
        ...state,
        negotiation: dopo,
        roster: state.roster.filter((e) => e.playerId !== dopo.playerId),
        budget: state.budget + dopo.amount,
        lists: {
          transferList: (state.lists?.transferList ?? []).filter((id) => id !== dopo.playerId),
          loanList: (state.lists?.loanList ?? []).filter((id) => id !== dopo.playerId),
        },
        // Chi se ne va sparisce anche dalle proposte di prestito: erano righe morte.
        market: state.market
          ? {
              ...state.market,
              offers: state.market.offers.filter((o) => o.playerId !== dopo.playerId),
              loanOffers: state.market.loanOffers.filter((l) => l.playerId !== dopo.playerId),
            }
          : state.market,
        // Il bug del recap: chiudere una trattativa in chat non finiva mai qui, quindi era
        // invisibile nel meeting di fine mercato — il flusso centrale del mercato (sez.
        // 3.7.5) non compariva mai nel suo stesso resoconto.
        sessionDeals: [
          ...(state.sessionDeals ?? []),
          { playerId: dopo.playerId, playerName: dopo.playerName, kind: "cessione", amount: dopo.amount },
        ],
      },
      message: `${dopo.playerName} ceduto per ${formatEuro(dopo.amount)} (${dopo.clubName}).`,
      closed: true,
    };
  }

  // Acquisto.
  const check = canBuy(state.roster);
  if (!check.ok) {
    return {
      state: { ...state, negotiation: { ...dopo, status: "arenata" } },
      message: check.reason ?? "Rosa al completo.",
      stalled: true,
    };
  }
  if (dopo.amount > state.budget) {
    return {
      state: { ...state, negotiation: { ...dopo, status: "arenata" } },
      message: "Budget insufficiente per chiudere.",
      stalled: true,
    };
  }

  const anagrafica = careerPlayers(state, world);
  const info = anagrafica[dopo.playerId];
  const eta = ageInSeason(info?.birthDate, state.season) ?? 25;
  const overall =
    world.market?.transferPool.find((p) => p.playerId === dopo.playerId)?.overall ?? 70;

  const nuovo: RosterEntry = createRosterEntry({
    playerId: dopo.playerId,
    overall,
    potential: overall + Math.max(0, 24 - eta),
    // Arriva adesso: l'affiatamento se lo deve guadagnare.
    sinceSeason: state.season,
  });

  // L'allenatore si accorge se gli hai preso quello che chiedeva, anche via trattativa.
  let coachRequest = state.coachRequest ?? null;
  if (coachRequest && !coachRequest.fulfilled && info) {
    if (
      requestSatisfiedBy(coachRequest.request, {
        overall,
        age: eta,
        role: info.role,
        secondaryRoles: info.secondaryRoles,
      })
    ) {
      coachRequest = { ...coachRequest, fulfilled: true };
    }
  }

  return {
    state: {
      ...state,
      negotiation: dopo,
      roster: [...state.roster, nuovo],
      budget: state.budget - dopo.amount,
      coachRequest,
      sessionDeals: [
        ...(state.sessionDeals ?? []),
        { playerId: dopo.playerId, playerName: dopo.playerName, kind: "acquisto", amount: dopo.amount },
      ],
    },
    message: `${dopo.playerName} acquistato per ${formatEuro(dopo.amount)} (${dopo.clubName}).`,
    closed: true,
  };
}

/**
 * Chi ti ha soffiato il giocatore.
 *
 * Un club credibile per quel livello e diverso dal venditore: la notizia dev'essere
 * plausibile, altrimenti si legge come un sorteggio.
 */
function scegliRivale(
  state: CareerState,
  world: CareerWorld,
  playerId: string,
  venditore: string,
): string | undefined {
  if (!world.market) return undefined;
  const livello = world.market.transferPool.find((p) => p.playerId === playerId)?.overall ?? 75;
  const plausibili = Object.values(world.market.clubs).filter((club) => {
    if (club.id === venditore || club.id === state.clubId) return false;
    const undici = club.startingEleven;
    if (undici.length === 0) return false;
    return undici.reduce((s, o) => s + o, 0) / undici.length >= livello - 4;
  });
  if (plausibili.length === 0) return undefined;
  const random = derivedRandom(state.seed, "soffiato", state.season, playerId);
  return plausibili[Math.floor(random() * plausibili.length)]?.id;
}

/** Chiude la finestra della trattativa senza toccare nient'altro. */
export function closeNegotiation(state: CareerState): CareerState {
  return { ...state, negotiation: null };
}

function formatEuro(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M€`;
  return `${Math.round(value / 1000)}k€`;
}

/* -------------------------------------------------------------------------- */
/* Allenatore                                                                  */
/* -------------------------------------------------------------------------- */

export interface CoachChoice {
  coachId: string;
  /** Costo totale dell'operazione: ingaggio del nuovo più buonuscita a chi va via. */
  cost: number;
  /** Perché non si può, se non si può. */
  blocked?: string;
}

/**
 * Quanto costa cambiare allenatore adesso.
 *
 * L'estate è il momento naturale: il contratto è scaduto e si paga solo il nuovo ingaggio. A
 * stagione in corso si aggiunge la **buonuscita** di chi va via, calante man mano che il
 * contratto si consuma — mandarlo via a marzo costa molto meno che a settembre. Senza questo
 * costo la scelta iniziale non conterebbe nulla e si cambierebbe mister a ogni sconfitta.
 */
export function coachChoices(state: CareerState, world: CareerWorld): CoachChoice[] {
  const attuale = state.coachId ? findCoach(state.coachId) : undefined;
  const inCorso = state.phase === "stagione" || state.league.round > 0;
  const buonuscita =
    attuale && inCorso ? severanceCost(attuale, state.league.round, world.leagueRounds) : 0;

  const club = state.clubId;
  void club;
  return availableCoaches(coachTierOf(state))
    .filter((coach) => coach.id !== state.coachId)
    .map((coach) => {
      const cost = coach.hireCost + buonuscita;
      return {
        coachId: coach.id,
        cost,
        blocked: cost > state.budget ? "Budget insufficiente" : undefined,
      };
    });
}

/**
 * Che levatura di allenatori accetterebbe di allenarti.
 *
 * Si deriva dal **livello della rosa** e non dal prestigio del club salvato da qualche parte:
 * così una squadra che si è costruita nel tempo attira anche tecnici migliori, e una che si è
 * svenduta ne perde. È la progressione che rende sensato riproporre la scelta ogni anno.
 */
export function coachTierOf(state: CareerState): number {
  const media = averageOverall(state.roster);
  if (media >= 84) return 5;
  if (media >= 79) return 4;
  if (media >= 74) return 3;
  if (media >= 69) return 2;
  return 1;
}

/** Ingaggia un allenatore, pagando ingaggio, riscatto ed eventuali bonus negoziati. */
export function hireCoach(
  state: CareerState,
  world: CareerWorld,
  coachId: string,
  promises?: CoachPromise[],
  costOverride?: number,
): { state: CareerState; message: string; rejected?: boolean } {
  if (coachId === state.coachId) return { state, message: "È già il tuo allenatore." };
  const scelta = coachChoices(state, world).find((c) => c.coachId === coachId);
  const coach = findCoach(coachId);
  if (!scelta || !coach) return { state, message: "Allenatore non disponibile.", rejected: true };
  if (scelta.blocked) return { state, message: scelta.blocked, rejected: true };

  const effectiveCost = typeof costOverride === "number" ? costOverride : scelta.cost;

  return {
    state: {
      ...state,
      coachId,
      budget: state.budget - effectiveCost,
      coachPromises: promises ?? [],
      coachHarmony: 80,
      // Le garanzie di titolarità erano una direttiva concordata col mister precedente: un
      // nuovo mister ha un suo modulo e le sue idee, non eredita gli impegni del predecessore.
      // Stesso discorso per chi il vecchio mister aveva escluso: il nuovo parte senza pregiudizi.
      // Solo qui — il rinnovo con lo stesso mister (sopra, `coachId === state.coachId`) non
      // tocca queste righe.
      guaranteedStarters: {},
      coachBenched: {},
    },
    message: `${coach.name} è il nuovo allenatore: modulo ${coach.formationId}. (Costo totale: €${effectiveCost.toLocaleString("it-IT")})`,
  };
}

/* -------------------------------------------------------------------------- */
/* Pezzi interni                                                               */
/* -------------------------------------------------------------------------- */

function emptyReport(state: CareerState, over: Partial<WeekReport> = {}): WeekReport {
  return {
    week: state.week,
    season: state.season,
    injuries: [],
    marketWindow: false,
    seasonEnded: false,
    careerEnded: false,
    messages: [],
    ...over,
  };
}

/**
 * Peso di ciascun titolare nel segnare, così i marcatori sono i propri giocatori.
 *
 * Il peso è ruolo × Overall, come nella Modalità Classica: senza il fattore di reparto un
 * portiere segnerebbe quanto una punta, e la classifica marcatori di fine stagione non direbbe
 * nulla sulla squadra che si è costruita.
 */
function scorerPoolOf(state: CareerState, lineup: Lineup, world: CareerWorld) {
  const weightByDepartment: Record<Department, number> = { ATT: 3, CC: 1.5, DIF: 0.5, POR: 0.05 };
  const players = careerPlayers(state, world);
  return Object.values(lineup.starters).map((playerId) => {
    const entry = state.roster.find((e) => e.playerId === playerId);
    const role = players[playerId]?.role;
    const department = role ? ROLE_DEPARTMENT[role] : "CC";
    return { id: playerId, weight: (entry?.overall ?? 70) * weightByDepartment[department] };
  });
}

/** Aggiorna minuti, gol, fatica, morale e infortuni dopo una giornata. */
function applyMatchdayToRoster(
  state: CareerState,
  lineup: Lineup,
  result: MatchResult | undefined,
  injuriesOut: Injury[],
  round: number,
  positionsBelowTarget?: number,
): CareerState {
  const startersIds = new Set(Object.values(lineup.starters));
  const scorers = new Set(result?.scorerIds ?? []);
  const squadAverage = averageOverall(state.roster);
  const availableMinutes = (round + 1) * 90;

  let roster = state.roster.map((entry) => {
    const played = startersIds.has(entry.playerId);
    const stats = played
      ? {
          ...entry.stats,
          appearances: entry.stats.appearances + 1,
          minutes: entry.stats.minutes + 90,
          goals: entry.stats.goals + (result?.scorerIds.filter((id) => id === entry.playerId).length ?? 0),
        }
      : entry.stats;

    const withStats = { ...entry, stats };
    const context: MoraleContext = {
      squadAverage,
      availableMinutes,
      played,
      scored: scorers.has(entry.playerId),
      positionsBelowTarget,
    };
    return {
      ...withStats,
      morale: updateMorale(withStats, context).after,
      fatigue: updateFatigue(withStats, played),
    };
  });

  // Gli infortuni si estraggono fra chi ha giocato, e valgono dalla giornata successiva.
  const injuryRandom = derivedRandom(state.seed, "inj", state.season, round);
  const played = roster.filter((e) => startersIds.has(e.playerId));
  const injuries = rollInjuries(played, injuryRandom);
  injuriesOut.push(...injuries);

  const byId = new Map(injuries.map((i) => [i.playerId, i]));
  roster = tickInjuries(roster).map((entry) => {
    const injury = byId.get(entry.playerId);
    return injury ? { ...entry, injuryMatchdaysLeft: injury.matchdays } : entry;
  });

  /**
   * **Promessa di più spazio, verificata giornata per giornata.**
   *
   * Nata dalla chat coi giocatori scontenti (`applyPlayerTalk`, sez. 2): appena il promesso
   * scende titolare la promessa è mantenuta (piccolo bonus, si chiude). Se passano tre giornate
   * senza che scenda mai in campo, è infranta — malus concreto, altrimenti la promessa sarebbe
   * solo narrativa e non costerebbe nulla al direttore sportivo che non la mantiene.
   */
  let minutesPromises = state.minutesPromises;
  if (minutesPromises && Object.keys(minutesPromises).length > 0) {
    const aggiornate = { ...minutesPromises };
    roster = roster.map((entry) => {
      const promessa = aggiornate[entry.playerId];
      if (!promessa) return entry;
      if (startersIds.has(entry.playerId)) {
        delete aggiornate[entry.playerId];
        return { ...entry, morale: Math.min(100, entry.morale + 5) };
      }
      const attesa = promessa.roundsWaited + 1;
      if (attesa >= 3) {
        delete aggiornate[entry.playerId];
        return { ...entry, morale: Math.max(0, entry.morale - 15) };
      }
      aggiornate[entry.playerId] = { roundsWaited: attesa };
      return entry;
    });
    minutesPromises = aggiornate;
  }

  return { ...state, roster, minutesPromises };
}

function maybeOpenRequest(
  state: CareerState,
  world: CareerWorld,
  matchday: number,
): PendingRequest | null {
  if (state.pendingRequest) return null;
  const squadAverage = averageOverall(state.roster);
  const availableMinutes = Math.max(1, matchday * 90);

  const request = findTransferRequest(
    state.roster,
    {
      matchday,
      hasOpenRequest: false,
      lastResolvedMatchday: state.lastResolvedMatchday,
      // Serve alla richiesta a sorpresa: un big che chiede di andarsene pur stando bene.
      random: derivedRandom(state.seed, "richiesta", state.season, matchday),
      currentSeason: state.season,
      guaranteedStarterIds: new Set(Object.values(state.guaranteedStarters ?? {})),
      coachHarmony: state.coachHarmony,
    },
    () => ({ squadAverage, availableMinutes, played: false, scored: false }),
  );
  if (!request) return null;
  return {
    ...request,
    playerName: careerPlayers(state, world)[request.playerId]?.name ?? "Un giocatore",
  };
}

function applyRequestResponse(state: CareerState, response: RequestResponse): CareerState {
  const pending = state.pendingRequest!;
  const entry = state.roster.find((e) => e.playerId === pending.playerId);
  if (!entry) return { ...state, pendingRequest: null };

  const morale =
    response === "accetta" ? entry.morale + 20
    : response === "rifiuta" ? 15
    : response === "prometti" ? entry.morale + 15
    : entry.morale + 25;

  return {
    ...state,
    roster: state.roster.map((e) =>
      e.playerId === entry.playerId ? { ...e, morale: Math.min(100, Math.max(0, morale)) } : e,
    ),
    pendingRequest: null,
    lastResolvedMatchday: state.league.round,
  };
}

/**
 * Risolve un imprevisto "con decisione" (`nottata_brava`/`intervista_contro`): a differenza
 * degli altri imprevisti, l'effetto non è già scritto nell'oggetto — arriva solo da qui, quando
 * l'utente ha scelto.
 *
 * - **Ignora**: nessuna conseguenza per il giocatore, ma il mister non l'accetta di buon grado
 *   — un episodio lasciato correre logora la sua fiducia nella disciplina interna quanto la
 *   logorerebbe in una squadra vera.
 * - **Punizione** (1-4 giorni, scelti dal DS): il morale del giocatore scala con la durata — una
 *   punizione simbolica pesa poco, una lunga pesa molto. Se il morale risultante crolla sotto una
 *   soglia severa, o se è già la **seconda** volta che questo giocatore finisce in un imprevisto
 *   così (`disciplineHistory`, career-wide, non stagionale), si apre una vera richiesta di
 *   cessione — stessa strada già percorsa da ogni altra richiesta (`pendingRequest`), non un
 *   sistema a parte: un giocatore recidivo o già sull'orlo del morale minimo non perdona un
 *   secondo giro di ramanzine.
 */
export function resolveIncidentDecision(
  state: CareerState,
  world: CareerWorld,
  incident: Incident,
  scelta: "ignora" | "punizione",
  giorni?: number,
): CareerState {
  if (scelta === "ignora") {
    return { ...state, coachHarmony: Math.max(0, Math.min(100, (state.coachHarmony ?? 75) - 10)) };
  }

  const playerId = incident.playerId;
  if (!playerId) return state;
  const giorniEffettivi = Math.min(4, Math.max(1, giorni ?? 1));
  const moraleDelta = -6 * giorniEffettivi;

  const roster = state.roster.map((e) =>
    e.playerId === playerId ? { ...e, morale: Math.max(0, Math.min(100, e.morale + moraleDelta)) } : e,
  );
  const entry = roster.find((e) => e.playerId === playerId);
  const contatore = (state.disciplineHistory?.[playerId] ?? 0) + 1;
  const disciplineHistory = { ...(state.disciplineHistory ?? {}), [playerId]: contatore };

  let next: CareerState = { ...state, roster, disciplineHistory };

  const recidivoOSevero = contatore >= 2 || (entry?.morale ?? 100) < 15;
  if (recidivoOSevero && !next.pendingRequest && entry) {
    next = {
      ...next,
      pendingRequest: {
        playerId,
        reason: "scontento",
        openedAtMatchday: next.league.round,
        playerName: careerPlayers(next, world)[playerId]?.name ?? "Un giocatore",
      },
    };
  }

  return next;
}

/**
 * Chiude la stagione: classifica, ciclo di vita, retrocessione.
 *
 * La retrocessione **chiude la carriera**, come deciso dall'utente: è la scelta che dà peso
 * ad ogni stagione, soprattutto scegliendo un club piccolo.
 */
function closeSeason(
  state: CareerState,
  world: CareerWorld,
  standings: StandingRow[],
): { state: CareerState; messages: string[] } {
  // Salvata qui perché `league.tallies` si azzera alla stagione successiva: senza, il turno di
  // esoneri IA (sez. aiCoaches.ts) non avrebbe mai un segnale vero su come sono andate le
  // avversarie di lega.
  state = {
    ...state,
    lastSeasonStandings: Object.fromEntries(
      standings.filter((r) => !r.isUser).map((r) => [r.teamId, r.position]),
    ),
  };

  const messages: string[] = [];
  const row = standings.find((r) => r.isUser)!;
  const teamsInLeague = standings.length;

  const cupOutcome =
    state.cup && world.cupTeams
      ? ownCupOutcome(state.cup, world.cupTeams, state.clubId, state.seed, state.season)
      : undefined;

  const rosaAttuale = state.roster;
  const avgMorale = rosaAttuale.length > 0 ? rosaAttuale.reduce((s, e) => s + e.morale, 0) / rosaAttuale.length : 0;
  const unhappyCount = rosaAttuale.filter((e) => e.morale < STANDOFF_MORALE_THRESHOLD).length;
  const standoffQueue = standoffCandidates(state, world).map((c) => ({ playerId: c.playerId, name: c.name }));

  const summary: SeasonSummary = {
    season: state.season,
    position: row.position,
    points: row.points,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    cupOutcome: cupOutcome && cupOutcome !== "assente" ? cupOutcome : undefined,
    objective: state.seasonObjective
      ? {
          label: state.seasonObjective.label,
          targetPosition: state.seasonObjective.targetPosition,
          met: objectiveMet(row.position, state.seasonObjective.targetPosition),
        }
      : undefined,
    avgMorale: Math.round(avgMorale),
    unhappyCount,
    standoffQueue,
    coachHarmonyDelta: (state.coachHarmony ?? 75) - (state.seasonStartCoachHarmony ?? 75),
    netBudget: state.budget - (state.seasonStartBudget ?? state.budget),
  };
  messages.push(`Stagione ${state.season}: ${row.position}º posto con ${row.points} punti.`);
  if (summary.cupOutcome) messages.push(`Corona Continentale: ${summary.cupOutcome}.`);

  // Retrocessione: ultimi tre posti.
  if (row.position > teamsInLeague - 3) {
    return {
      state: {
        ...state,
        phase: "conclusa",
        ending: "retrocessione",
        history: [...state.history, summary],
      },
      messages: [...messages, "Retrocessione: la carriera finisce qui."],
    };
  }

  // I prestiti si chiudono **prima** del ciclo di vita: chi rientra porta con sé i minuti
  // giocati altrove, ed è quello che gli fa guadagnare la crescita. Invertire l'ordine
  // significherebbe farlo invecchiare come se fosse rimasto in panchina tutto l'anno.
  const settled = settleLoans(state.roster, state.season);
  const rientrati = [...settled.remaining, ...settled.returning];
  if (settled.returning.length > 0) {
    messages.push(`${settled.returning.length} giocatori rientrano dal prestito.`);
  }
  if (settled.leaving.length > 0) {
    messages.push(`${settled.leaving.length} prestiti tornano al club proprietario.`);
  }

  const players = careerPlayers(state, world);

  // Ciclo di vita: crescita, declino, ritiri.
  const aged = advanceSeasonOveralls(
    rientrati.map((entry) => {
      const resolved = players[entry.playerId];
      return {
        entry,
        role: resolved?.role ?? "CC",
        age: ageInSeason(resolved?.birthDate, state.season) ?? 26,
      };
    }),
    state.season,
  );
  const byId = new Map(aged.map((a) => [a.playerId, a]));

  const retired: { entry: RosterEntry; peakOverall: number }[] = [];
  const roster = rientrati
    .map((entry) => {
      const change = byId.get(entry.playerId);
      const resolved = players[entry.playerId];
      const age = ageInSeason(resolved?.birthDate, state.season);
      if (age !== null && shouldRetire(age + 1, state.season + 1)) {
        // Il metro del rimpiazzo è il picco storico, non l'Overall del giorno del ritiro: a 34
        // anni il declino l'ha già eroso, e clonare quel valore farebbe scivolare il pool verso
        // il basso di stagione in stagione.
        retired.push({ entry, peakOverall: Math.max(entry.overall, entry.potential) });
        return null;
      }
      return {
        ...entry,
        overall: change?.after ?? entry.overall,
        // Il tetto stesso può salire (sez. 10, `growPotential`): un giovane che gioca molto e
        // rende sopra attese non si limita ad avvicinarsi al suo potenziale di partenza, quello
        // può crescere con lui — piccoli passi a stagione, non un salto.
        potential: entry.potential + (change?.potentialDelta ?? 0),
        fatigue: 0,
        injuryMatchdaysLeft: 0,
        stats: { appearances: 0, minutes: 0, goals: 0, assists: 0 },
      };
    })
    .filter((e): e is RosterEntry => e !== null);

  // Rimpiazzo 1:1 dei ritirati, così la rosa non si assottiglia di stagione in stagione.
  const usedNames = new Set<string>([
    ...Object.values(players).map((p) => p.name),
    ...state.generated.map((p) => p.name),
  ]);
  const regens = createRegenBatch(
    retired.map(({ entry, peakOverall }) => {
      const resolved = players[entry.playerId];
      return {
        id: entry.playerId,
        nation: resolved?.nation ?? "Italia",
        role: resolved?.role ?? "CC",
        secondaryRoles: resolved?.secondaryRoles ?? [],
        peakOverall,
      };
    }),
    usedNames,
    state.season + 1,
    derivedRandom(state.seed, "regen", state.season),
  );

  /**
   * **Il regen non nasce più garantito nella nostra rosa.**
   *
   * Prima era un rimpiazzo 1:1 sempre nel proprio club: comprare un giocatore vicino al ritiro
   * garantiva un regen gratis in squadra, un trucco segnalato dall'utente. Ora si tira
   * un'estrazione seedata fra **tutti** i club conosciuti dal mondo (il nostro non ha più
   * corsia preferenziale) — se esce un club diverso dal nostro, il regen non entra in
   * `roster`: resta solo in `generated`, taggato con `destinationClubId`, così il mondo (che
   * si ricostruisce dal seme a ogni stagione, mai salvato) lo innesta nel club giusto.
   *
   * Senza mercato configurato (alcuni scenari di test) non c'è un universo di club fra cui
   * estrarre: si ripiega sul comportamento di sempre, sempre in casa propria.
   */
  const clubUniverse = world.market ? Object.keys(world.market.clubs) : [state.clubId];
  const altriClub = clubUniverse.filter((id) => id !== state.clubId);
  const destRandom = derivedRandom(state.seed, "regenDest", state.season);
  const assegnati = regens.map((regen) => {
    if (altriClub.length === 0) return { regen, destinationClubId: state.clubId };
    const scelto = destRandom() < 1 / clubUniverse.length
      ? state.clubId
      : altriClub[Math.floor(destRandom() * altriClub.length)]!;
    return { regen, destinationClubId: scelto };
  });

  // Argine di giocabilità: l'estrazione toglie la garanzia, non deve rendere la modalità
  // ingiocabile per sfortuna del sorteggio. Se la rosa superstite (prima dei regen) è già
  // sotto MIN_SQUAD_SIZE+2, i regen "persi" all'estero rientrano in casa finché non si
  // raggiunge il cuscinetto minimo.
  const basePop = roster.length;
  let inCasa = assegnati.filter((a) => a.destinationClubId === state.clubId).length;
  for (const a of assegnati) {
    if (basePop + inCasa >= MIN_SQUAD_SIZE + 2) break;
    if (a.destinationClubId !== state.clubId) {
      a.destinationClubId = state.clubId;
      inCasa++;
    }
  }

  for (const { regen, destinationClubId } of assegnati) {
    if (destinationClubId === state.clubId) {
      roster.push(
        createRosterEntry({
          playerId: regen.id,
          overall: regen.overall,
          potential: regen.potential,
          sinceSeason: state.season + 1,
        }),
      );
    }
  }
  // `generated` ricorda comunque tutti i regen (anche quelli altrove): serve all'anagrafica
  // ovunque il nome vada risolto, e al mondo per innestarli nel club giusto.
  const generatedWithDestination = assegnati.map(({ regen, destinationClubId }) =>
    destinationClubId === state.clubId ? regen : { ...regen, destinationClubId },
  );

  if (retired.length > 0) {
    const nostri = assegnati.filter((a) => a.destinationClubId === state.clubId).length;
    messages.push(
      `${retired.length} giocatori si sono ritirati; ${nostri} giovani prendono il loro posto in rosa (${regens.length - nostri} nati altrove).`,
    );
  }

  const season = state.season + 1;
  if (season > CAREER_SEASONS) {
    return {
      state: { ...state, phase: "conclusa", ending: "completata", history: [...state.history, summary] },
      messages: [...messages, "Dieci stagioni completate."],
    };
  }

  // Budget della stagione successiva: livello della rosa, piazzamento, cammino in Corona e
  // quanto è avanzato dall'anno prima.
  const budget = nextSeasonBudget({
    averageOverall: averageOverall(roster),
    position: row.position,
    teamsInLeague,
    cupOutcome: cupOutcome === "assente" ? undefined : cupOutcome,
    leftover: state.budget,
    // Migliorare paga: è la leva che permette a una piccola di scalare invece di ripetere
    // dieci volte la stessa stagione.
    previousPosition: state.history[state.history.length - 1]?.position,
    difficulty: state.difficulty ?? "normale",
  });

  // Qualificazione alla Corona: le prime quattro del campionato.
  const cup = nextSeasonCup(state, world, row.position);
  if (cup && !state.cup) messages.push("Ci siamo qualificati per la Corona Continentale.");
  if (!cup && state.cup) messages.push("Niente Corona Continentale la prossima stagione.");

  // L'esito dell'obiettivo appena chiuso pesa sul mister: superarlo lo rende più esigente
  // l'anno dopo, mancarlo più accomodante — lo stesso genere di input contestuale che già
  // decide `coachTierOf`/`generateCoachPromises`, non un sistema a parte.
  let coachHarmony = state.coachHarmony;
  if (state.seasonObjective) {
    const raggiunto = objectiveMet(row.position, state.seasonObjective.targetPosition);
    coachHarmony = Math.max(0, Math.min(100, (state.coachHarmony ?? 75) + (raggiunto ? 4 : -6)));
    messages.push(
      raggiunto
        ? `Obiettivo "${state.seasonObjective.label}" raggiunto: il mister se lo aspettava, ora ne vuole di più.`
        : `Obiettivo "${state.seasonObjective.label}" mancato: il mister si accontenterà di meno, per ora.`,
    );
  }

  return {
    state: {
      ...state,
      coachHarmony,
      season,
      week: 0,
      phase: "mercato_estivo",
      budget,
      roster,
      league: { round: 0, tallies: [] },
      cup,
      market: null,
      coachRequest: null,
      // Le liste sopravvivono alla stagione, ma non possono contenere chi non è più in rosa:
      // resterebbero offerte per giocatori ritirati o rientrati al club proprietario.
      lists: potaListe(state.lists ?? emptySquadLists(), roster),
      generated: [...state.generated, ...generatedWithDestination],
      history: [...state.history, summary],
      pendingRequest: null,
      lastResolvedMatchday: undefined,
      // Nuova stagione → nuove promesse: le vecchie sono archiviate nel summary e non servono
      // più — **tranne** quelle rimandate (`deadlineSeason` nel futuro, mediazione "delay"):
      // altrimenti rimandare una promessa la farebbe sparire nel nulla al cambio di stagione
      // invece di essere verificata quando promesso.
      coachPromises: (state.coachPromises ?? []).filter(
        (p) => p.deadlineSeason !== undefined && p.deadlineSeason > state.season,
      ),
      sessionDeals: [],
      seasonNegotiationDone: false,
      seasonObjective: undefined,
      seasonObjectiveSet: false,
    },
    messages,
  };
}

/** Toglie dalle liste chi non è più in rosa. */
function potaListe(lists: SquadLists, roster: readonly RosterEntry[]): SquadLists {
  const presenti = new Set(roster.map((e) => e.playerId));
  return {
    transferList: lists.transferList.filter((id) => presenti.has(id)),
    loanList: lists.loanList.filter((id) => presenti.has(id)),
  };
}

/** Posizione entro cui ci si qualifica alla Corona Continentale. */
export const CUP_QUALIFY_POSITION = 4;

/**
 * La Corona della prossima stagione, se ci siamo qualificati.
 *
 * **Semplificazione dichiarata**: le altre diciannove partecipanti restano l'élite fissa del
 * mondo (`CareerWorld.cupEntrants`). Ricalcolarle davvero richiederebbe di simulare i cinque
 * campionati nel dettaglio ogni anno, per un effetto che l'utente percepirebbe solo come nomi
 * leggermente diversi nel girone — e a un costo che si pagherebbe a ogni clic.
 */
function nextSeasonCup(
  state: CareerState,
  world: CareerWorld,
  position: number,
): CupSave | undefined {
  const pool = world.cupEntrants;
  if (!pool || position > CUP_QUALIFY_POSITION) return undefined;

  const clubIds = [...pool.clubIds];
  const leagues = [...pool.leagues];
  const mine = clubIds.indexOf(state.clubId);
  if (mine < 0) {
    // Prendiamo il posto dell'ultima iscritta: il torneo resta a venti squadre.
    clubIds[clubIds.length - 1] = state.clubId;
    leagues[leagues.length - 1] = state.leagueId;
  }
  return emptyCupSave(clubIds, leagues);
}
