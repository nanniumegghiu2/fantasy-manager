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
  PROMOTION_SLOTS,
  isSecondDivision,
  promotionAndRelegation,
  type DivisionMove,
} from "../divisions";
import { orderedClubIds, simulateSiblingSeason } from "./siblingLeague";
import {
  createNationalCupSave,
  ownNationalCupOutcome,
  playNationalCupWeek,
  withOwnStrength,
  type NationalCupSave,
} from "./careerNationalCup";
import {
  buildSeasonCalendar,
  cupSlotOf,
  nationalCupSlotOf,
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
import {
  availableCoaches,
  canonicalCoachId,
  coachSeasonsLeft,
  computeCoachBuyoutFee,
  makeCoachContract,
  severanceCost,
  type CoachContract,
} from "./coaches";
import {
  contractOf,
  renewalOfferScore,
  renewalTerms,
  seasonsLeftOf,
  RENEWAL_ACCEPT_SCORE,
  type Contract,
  type ContractOverrides,
} from "./contracts";
import { formatContractTotal, formatEuro, formatWage } from "./money";
import {
  DEFAULT_WAGE_SHARE,
  defaultFinances,
  financesView,
  shiftWageShare,
  type FinancesState,
  type FinancesView,
} from "./finances";
import {
  buildFreeAgentPool,
  resolveFreeAgentBids,
  rivalBidsFor,
  type FreeAgent,
  type FreeAgentBid,
  type RivalClubInfo,
} from "./freeAgents";
import {
  commitmentsFor,
  makeCommitment,
  verifyCommitments,
  type Commitment,
  type CommitmentWhen,
} from "./commitments";
import {
  buildPlayerFacts,
  DEFAULT_TRUST,
  type PlayerFacts,
  type RelationshipState,
} from "./playerFacts";
import { MAX_OPEN_CASES, blockingTopic, pickTopic, talkUrgency } from "./playerTopics";
import {
  boardMidSeasonWarning,
  boardSeasonVerdict,
  defaultBoard,
  resolveSackDemand,
  type BoardState,
  type SackDemandChoice,
} from "./board";
import {
  captaincyClaims,
  coachCaptainPick,
  evaluateCaptaincyChange,
  CAPTAIN_GAINED_MORALE,
  CAPTAIN_LOST_MORALE,
  type CaptaincyClaim,
} from "./captaincy";
import {
  applyDialogueMove,
  openDialogue,
  type Dialogue,
  type DialogueMove,
  type DialogueStatus,
  type MoveContext,
} from "./playerDialogue";

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
  type SeasonPlayerReport,
  type SessionDeal,
  emptySeasonStats,
  derivePlayerPersonality,
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

/**
 * Le due divisioni collegate, come le vede il riduttore.
 *
 * Contiene solo ciò che serve a **chiudere una stagione**: chi sta in quale lega adesso, e
 * quanto vale ogni club, per poter simulare il campionato in cui non giochiamo
 * (`siblingLeague.ts`). Il resto — nomi, rose, prestigi — resta nell'app.
 */
export interface DivisionWorld {
  /** Id della lega di prima divisione (Serie A). */
  topLeagueId: string;
  /** Id della lega di seconda divisione (Serie B). */
  secondLeagueId: string;
  /** Nomi delle due leghe, per i messaggi ("Promossi in Serie A!"). */
  topLeagueName: string;
  secondLeagueName: string;
  /**
   * Chi milita in ciascuna delle due leghe **in questa stagione**, movimenti già applicati.
   * La chiave è l'id della lega; i valori sono id di club, il nostro compreso.
   */
  clubsByLeague: Record<string, string[]>;
  /** Forza di ogni club delle due divisioni, per simulare la lega gemella. */
  teams: Record<string, LeagueTeam>;
}

export interface CareerWorld {
  players: Record<string, ResolvedPlayer>;
  /** Le 19 avversarie del campionato dell'utente, già pronte. */
  opponents: LeagueTeam[];
  /** Nome del club dell'utente, per il referto. */
  clubName: string;
  /** Nome del campionato in cui si gioca ora, per il referto e la card del trionfo. */
  leagueName?: string;
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
  /**
   * Le due divisioni collegate da promozione/retrocessione, quando il nostro campionato ne fa
   * parte (oggi solo Serie A ↔ Serie B).
   *
   * Assente = campionato **senza** seconda divisione, cioè il comportamento di sempre: nessun
   * movimento, e la retrocessione resta la fine della carriera. È così che i salvataggi
   * precedenti e i test che guardano solo il campo continuano a funzionare senza modifiche.
   */
  divisions?: DivisionWorld;
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
  /** Report individuale di ciascun calciatore della rosa per la scheda di fine anno. */
  playerReports?: SeasonPlayerReport[];
  /**
   * Come è finita rispetto alle due divisioni, quando il campionato ne fa parte.
   *
   * Assente per i campionati senza seconda divisione (Premier, Liga, Bundesliga, Ligue 1) e
   * per i salvataggi precedenti: in entrambi i casi non c'è nulla da dire.
   */
  divisionOutcome?: "promosso" | "retrocesso" | "resta";
  /** Fin dove siamo arrivati in Coppa Tricolore, se l'abbiamo giocata. */
  nationalCupOutcome?: string;
  /**
   * I tre trofei della stagione, come un unico fatto.
   *
   * Tre booleani in un campo solo e non tre campi sparsi: il triplete si deriva da qui
   * (`treble`), quindi non può esistere uno stato in cui i flag dicono una cosa e il triplete
   * un'altra. È lo stesso motivo per cui `SquadLists` sta in un posto solo.
   */
  trophies?: { league: boolean; continental: boolean; national: boolean };
  /**
   * Campionato + Corona + Coppa Tricolore nella stessa stagione.
   *
   * **Irraggiungibile dalla Serie B**, dove la Corona non si gioca: è una conseguenza della
   * regola, non un controllo a parte.
   */
  treble?: boolean;
  /**
   * Il campionato in cui la stagione **è stata giocata**.
   *
   * Registrato qui e non ricavato dallo stato perché a fine stagione `leagueId` può essere già
   * quello dell'anno prossimo: una squadra promossa mostrerebbe altrimenti "Serie A" su una
   * stagione vinta in Serie B.
   */
  leagueName?: string;
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
  /**
   * La Coppa Tricolore di questa stagione.
   *
   * A differenza della Corona **non si vince l'accesso**: ci sono dentro tutti i club di Serie
   * A e Serie B, ogni anno. Assente = campionato senza coppa nazionale (gli esteri) o
   * salvataggio precedente all'introduzione.
   */
  nationalCup?: NationalCupSave;
  /** Difficoltà scelta in avvio: agisce sul budget di mercato. */
  difficulty: DsDifficulty;
  /**
   * Promozioni e retrocessioni avvenute finora, stagione per stagione.
   *
   * Si salva **solo lo scostamento** dall'appartenenza del database: sessanta id in dieci
   * stagioni invece di quaranta club per dieci anni (stesso principio di `worldTransfers` e
   * dei contratti). Assente = carriera senza seconda divisione, o salvataggio precedente
   * all'introduzione del sistema.
   */
  divisionMoves?: DivisionMove[];
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
  /**
   * **La dirigenza** (`board.ts`): fiducia nel DS e richiesta di esonero del mister pendente.
   *
   * Assente nei salvataggi precedenti a questa versione: ogni lettura passa da `defaultBoard()`,
   * quindi una carriera già avviata riparte con la fiducia iniziale invece di rompersi.
   */
  board?: BoardState;
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
  guaranteedStarters?: Record<string, string>;
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
  ending?: "completata" | "retrocessione" | "esonero";
  /** Se la trattativa stagionale col mister è stata completata per questa stagione. */
  seasonNegotiationDone?: boolean;

  /* ---------------------------------------------------------------------- */
  /* Contratti, finanze e spogliatoio (sez. docs/piano-spogliatoio-contratti) */
  /* ---------------------------------------------------------------------- */

  /**
   * Il **fatturato** della stagione: `budget` non è più "il budget di mercato" ma la liquidità
   * residua della sola cassa mercato. Assente nei salvataggi vecchi, dove si ricava dal budget.
   */
  seasonRevenue?: number;
  /** Come il DS ha ripartito il fatturato fra mercato e ingaggi. */
  finances?: FinancesState;
  /**
   * **Solo i contratti che qualcuno ha cambiato.** Gli altri si derivano dal seme
   * (`contracts.ts`): tenere 2.586 record renderebbe il salvataggio impossibile.
   */
  contracts?: {
    overrides: ContractOverrides;
    /** Chi è stato svincolato: non è derivabile, dipende da una decisione. */
    released: string[];
    /** Precontratti firmati da club altrui sui nostri in scadenza. */
    preContracts: { playerId: string; toClubId: string; clubName: string; season: number }[];
    /** Chi ha rifiutato il rinnovo: da qui in poi parla da uno che se ne va a zero. */
    renewalRefused: string[];
  };
  /** Il contratto del mister: durata in stagioni, ingaggio annuo dentro il monte. */
  coachContract?: CoachContract;
  /** La memoria del rapporto con ciascun giocatore. Solo le voci diverse dal default. */
  relationships?: Record<string, RelationshipState>;
  /** Il registro unico degli impegni presi (sostituisce i tre canali separati). */
  commitments?: Commitment[];
  /** Il capitano, uno solo. Lo sceglie il mister; il DS può discuterne (`proposeCaptain`). */
  captainId?: string;
  /** Chi si è visto togliere la fascia e non è ancora stato sentito: apre un tema bloccante. */
  captaincyLost?: string[];
  /** Gli svincolati che abbiamo tesserato: escono dal pool derivato. */
  freeAgentsSigned?: string[];
  /** Chi il DS ha mandato a riposo, e per quante giornate ancora. */
  resting?: Record<string, number>;
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
  /** Durata in stagioni del contratto firmato col mister alla firma iniziale. */
  coachSeasons?: number;
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
    // Canonicalizzato all'ingresso: un salvataggio vecchio può portare un alias (`c-10`), e da
    // lì in poi `coach.id` e `state.coachId` sarebbero due stringhe diverse per la stessa persona.
    coachId: input.coachId ? canonicalCoachId(input.coachId) : input.coachId,
    coachContract: input.coachId
      ? makeCoachContract(findCoach(canonicalCoachId(input.coachId))!, input.coachSeasons ?? 2, 1)
      : undefined,
    finances: defaultFinances(),
    contracts: { overrides: {}, released: [], preContracts: [], renewalRefused: [] },
    commitments: [],
    relationships: {},
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
    board: defaultBoard(),
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
  return buildSeasonCalendar({
    leagueRounds: world.leagueRounds,
    inCup: !!state.cup,
    inNationalCup: !!state.nationalCup,
  });
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
export function setGuaranteedStarter(
  state: CareerState,
  role: Role,
  playerId: string,
  slotId?: string,
): CareerState {
  const attuali = state.guaranteedStarters ?? {};
  const key = slotId ?? role;
  const senzaAltrove = Object.fromEntries(
    Object.entries(attuali).filter(([k, id]) => k === key || id !== playerId),
  ) as Record<string, string>;
  return { ...state, guaranteedStarters: { ...senzaAltrove, [key]: playerId } };
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
  /** La partita di Coppa Tricolore, se questa settimana c'è un turno e siamo ancora in corsa. */
  nationalCupMatch?: {
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

  /**
   * **La Coppa Tricolore si compone qui, ma solo a stagione non ancora cominciata.**
   *
   * `createCareer` non ha il mondo fra le mani — riceve solo la rosa e il budget — mentre il
   * tabellone ha bisogno delle forze di tutti e quaranta i club. Comporla alla prima settimana
   * risolve la dipendenza, e il calendario si costruisce più sotto leggendo `next.nationalCup`:
   * comporla dopo significherebbe una stagione senza turni prenotati.
   *
   * ⚠️ **La condizione sulla giornata non è una cautela, è la correzione di un difetto.** Prima
   * qui bastava `!next.nationalCup`, con l'intento di retrofittare i salvataggi già avviati. Ma
   * il calendario si ricalcola da `!!state.nationalCup` **ogni volta**, e i turni si prenotano
   * per frazione di stagione (il preliminare al 3%): iscrivere un club a febbraio gli faceva
   * saltare in silenzio tutti i turni la cui settimana era già passata, cioè lo faceva entrare e
   * uscire dalla coppa senza aver giocato. Chi riprende una carriera a metà stagione la trova
   * quindi **dalla stagione successiva**, dove `closeSeason` la compone con il preliminare al
   * posto giusto — decisione esplicita dell'utente (piano DS, D1).
   */
  const stagioneNonCominciata = next.league.round === 0 && next.week === 0;
  if (!next.nationalCup && world.divisions && next.phase !== "conclusa" && stagioneNonCominciata) {
    const nuova = buildNationalCup(next, world, next.season);
    if (nuova) next = { ...next, nationalCup: nuova };
  }

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
    /**
     * **Chiudere il mercato senza una rosa schierabile costa la panchina.**
     *
     * Decisione esplicita dell'utente: niente rinnovi d'ufficio, niente giocatori regalati dalla
     * società. Se alla chiusura della finestra non ci sono nemmeno undici giocatori, la carriera
     * finisce qui — è il mestiere del direttore sportivo, e questo è il modo in cui il gioco lo
     * dice. Il controllo sta **alla chiusura** e non a ogni istante proprio perché durante il
     * mercato la rosa può legittimamente scendere: si vende prima e si compra dopo.
     */
    if (next.roster.length < MIN_SQUAD_SIZE) {
      return {
        state: { ...next, phase: "conclusa", ending: "esonero", market: null },
        report: emptyReport(next, {
          careerEnded: true,
          messages: [
            `La società ti solleva dall'incarico: hai chiuso il mercato con ${next.roster.length} giocatori in rosa, sotto i ${MIN_SQUAD_SIZE} necessari per scendere in campo.`,
          ],
        }),
      };
    }
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

    // Gli impegni presi in conversazione che si verificano a chiusura finestra (rinforzi
    // promessi, clausole): un solo registro per tutte le promesse, invece dei canali separati.
    {
      const esito = settleCommitments(next, world, "window", new Set());
      next = esito.state;
      messages.push(...esito.messages);
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

      /**
       * **La dirigenza si fa sentire mentre le cose vanno male**, non solo a bocce ferme
       * (`board.ts`). Una volta per stagione e non prima che il campionato dica qualcosa:
       * altrimenti sarebbe un messaggio a ogni giornata storta, cioè rumore.
       */
      const richiamo = boardMidSeasonWarning({
        board: next.board,
        season: next.season,
        matchday: round + 1,
        totalMatchdays: world.leagueRounds,
        positionsBelowTarget: posizioneSottoObiettivo,
        objectiveLabel: next.seasonObjective.label,
      });
      if (richiamo) {
        next = { ...next, board: richiamo.board };
        messages.push(richiamo.message);
      }
    }

    next = applyMatchdayToRoster(next, lineup, followedResult, injuries, round, posizioneSottoObiettivo);
    next.league = { round: league.round, tallies: league.tallies };

    // Chi era a riposo per decisione del DS torna disponibile una giornata alla volta.
    if (next.resting && Object.keys(next.resting).length > 0) {
      const rimasti: Record<string, number> = {};
      for (const [id, giornate] of Object.entries(next.resting)) {
        if (giornate > 1) rimasti[id] = giornate - 1;
      }
      next = { ...next, resting: Object.keys(rimasti).length > 0 ? rimasti : undefined };
    }

    // Gli impegni che si verificano **a giornata** (minuti promessi, titolarità sottoscritta):
    // qui si sa chi è davvero sceso in campo, ed è l'unico punto in cui la promessa si può
    // giudicare senza inventare nulla.
    {
      const esito = settleCommitments(next, world, "matchday", new Set(Object.values(lineup.starters)));
      next = esito.state;
      messages.push(...esito.messages);
    }
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

  /**
   * Turno di **Coppa Tricolore**, con la stessa regola della Corona: si scende in campo con la
   * rosa vera (`squadStrengthOf`), non con la fotografia del database, altrimenti il mercato
   * fatto durante la carriera non conterebbe nulla in coppa.
   */
  let nationalCupMatch: WeekReport["nationalCupMatch"];
  const nazionaleSlot = nationalCupSlotOf(week);
  if (nazionaleSlot && next.nationalCup && world.divisions) {
    const squadre = withOwnStrength(
      world.divisions.teams,
      next.clubId,
      world.clubName,
      squadStrengthOf(next, world),
    );
    const esito = playNationalCupWeek(
      next.nationalCup,
      squadre,
      next.clubId,
      scorerPoolOf(next, currentLineup(next, world), world),
      next.seed,
      next.season,
      nazionaleSlot.round,
    );
    next = { ...next, nationalCup: esito.save };
    if (esito.ownMatch) nationalCupMatch = esito.ownMatch;
    if (esito.eliminated) messages.push("Eliminati dalla Coppa Tricolore.");
    if (esito.won) messages.push("Abbiamo vinto la Coppa Tricolore!");
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
      nationalCupMatch,
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
      (report.nationalCupMatch &&
        isKeyMatch({
          nationalCupStage: report.nationalCupMatch.stage,
          totalRounds: world.leagueRounds,
        })) ||
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

  const val = playerValue(state, world, playerId);
  const playerObj = careerPlayers(state, world)[playerId];
  const eta = ageInSeason(playerObj?.birthDate, state.season) ?? 25;

  return openStandoff(
    entry,
    name,
    reason,
    spinge && offer
      ? {
          clubId: offer.fromClubId,
          clubName: offer.fromClubName,
          amount: offer.fee,
          kind: "trasferimento",
        }
      : undefined,
    {
      age: eta,
      currentSeason: state.season,
      marketValue: val,
    },
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
  const val = standoff.marketValue ?? playerValue(state, world, standoff.playerId);

  const moveCtx = {
    currentBudget: state.budget,
    marketValue: val,
    coachApprovalCtx: {
      playerOverall: standoff.overall ?? 75,
      starterOverallInRole: 76,
      coachHarmony: state.coachHarmony ?? 50,
    },
  };

  const {
    standoff: dopo,
    moraleDelta,
    listForTransfer,
    listForLoan,
    promiseMinutes,
    moneyBonus,
    moneyBonusAmount,
    moneyEarnedAmount,
    promise,
    sellNow,
    coachResigns,
    coachBenches,
  } = applyStandoffMove(standoff, move, moveCtx);

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
    const importo = moneyBonusAmount ?? Math.max(200_000, Math.round(val * 0.04));
    next = { ...next, budget: next.budget - importo };
  }
  if (moneyEarnedAmount) {
    next = { ...next, budget: next.budget + moneyEarnedAmount };
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
  return openStandoff(entry, pending.playerName, pending.reason, undefined, { currentSeason: state.season });
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

/**
 * **La forza dei nostri undici migliori**, nella stessa unità di misura del `rating` di ogni
 * avversaria (`aiClub.ts`): media degli Overall della formazione che scenderebbe in campo.
 *
 * È la grandezza con cui si stima dove finiremo. La media dell'**intera rosa** — quella che si
 * usava prima — misura una cosa diversa: una rosa lunga con dodici riserve risulta più debole di
 * una corta con gli stessi titolari, e siccome le avversarie sono sempre valutate sui loro
 * undici, il paragone ci sottostimava sistematicamente. Con la squadra più forte del campionato
 * ne usciva "Europa" come massima ambizione, che è il difetto segnalato dall'utente.
 */
export function bestElevenRating(state: CareerState, world: CareerWorld): number {
  const lineup = currentLineup(state, world);
  const overalls: number[] = [];
  for (const playerId of Object.values(lineup.starters)) {
    const entry = state.roster.find((e) => e.playerId === playerId);
    if (entry) overalls.push(entry.overall);
  }
  // Senza formazione risolvibile (rosa incompleta, test del solo campo) restano gli undici
  // Overall più alti: sempre gli undici, mai la rosa intera.
  if (overalls.length === 0) {
    const migliori = [...state.roster]
      .filter((e) => !e.loan?.hostClubId)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 11);
    if (migliori.length === 0) return 70;
    return migliori.reduce((s, e) => s + e.overall, 0) / migliori.length;
  }
  return overalls.reduce((s, v) => s + v, 0) / overalls.length;
}

/** Il campionato in cui giochiamo adesso è una seconda divisione? */
export function inSecondDivision(state: CareerState, world: CareerWorld): boolean {
  const nome = world.divisions
    ? state.leagueId === world.divisions.secondLeagueId
      ? world.divisions.secondLeagueName
      : world.leagueName
    : world.leagueName;
  return nome ? isSecondDivision(nome) : false;
}

/** Le tre fasce fra cui il DS può scegliere l'obiettivo di questa stagione. */
export function seasonObjectiveChoices(state: CareerState, world: CareerWorld): ObjectiveTier[] {
  return suggestObjectiveTiers(
    bestElevenRating(state, world),
    world.opponents,
    world.opponents.length + 1,
    inSecondDivision(state, world),
  );
}

/**
 * **La risposta alla dirigenza che chiede l'esonero del mister.**
 *
 * Assecondarla libera la panchina — si passa dal flusso di ingaggio già esistente, quindi il
 * nuovo mister costa comunque il suo ingaggio — e ricompone il rapporto col presidente.
 * Difenderlo lega il mister a te ma consuma fiducia, e su un **ultimatum** può finire lì la
 * carriera: è ciò che rende la richiesta una decisione invece di un avviso da chiudere.
 */
export function answerBoardSackDemand(
  state: CareerState,
  choice: SackDemandChoice,
): { state: CareerState; message: string } {
  const esito = resolveSackDemand(state.board, choice);

  let next: CareerState = { ...state, board: esito.board };

  if (esito.fireCoach) {
    // Stesso trattamento delle dimissioni: la panchina resta vuota e il DS deve sceglierne uno.
    next = {
      ...next,
      coachId: null,
      coachPromises: [],
      coachContract: undefined,
      guaranteedStarters: {},
      coachBenched: {},
      coachHarmony: 50,
    };
  } else if (esito.coachHarmonyDelta !== 0) {
    next = {
      ...next,
      coachHarmony: Math.max(0, Math.min(100, (next.coachHarmony ?? 75) + esito.coachHarmonyDelta)),
    };
  }

  if (esito.dsSacked) {
    next = { ...next, phase: "conclusa", ending: "esonero" };
    return {
      state: next,
      message: `${esito.message} La società non ha retto un'altra sfida: il direttore sportivo è stato esonerato.`,
    };
  }

  return { state: next, message: esito.message };
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
  richiesto: string,
  promises?: CoachPromise[],
  costOverride?: number,
): { state: CareerState; message: string; rejected?: boolean } {
  const coachId = canonicalCoachId(richiesto);
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

  let roster = state.roster.map((e) =>
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
/**
 * Compone la Coppa Tricolore di una stagione: tutti i club delle due divisioni.
 *
 * Restituisce `undefined` quando il mondo non ha due divisioni collegate — carriere estere e
 * salvataggi precedenti, che continuano a non avere coppa nazionale.
 *
 * **Le divisioni si leggono dal mondo, che è già aggiornato ai movimenti**: `buildCareerWorld`
 * ricostruisce `clubsByLeague` applicando `divisionMoves` a ogni stagione, quindi una
 * neopromossa entra in coppa dalla parte giusta senza che qui serva saperne nulla.
 */
function buildNationalCup(
  state: CareerState,
  world: CareerWorld,
  season: number,
): NationalCupSave | undefined {
  const div = world.divisions;
  if (!div) return undefined;

  const inA = div.clubsByLeague[div.topLeagueId] ?? [];
  const inB = div.clubsByLeague[div.secondLeagueId] ?? [];
  if (inA.length + inB.length < 4) return undefined;

  return createNationalCupSave({
    clubIds: [...inA, ...inB],
    teamsById: div.teams,
    secondDivisionIds: inB,
    seed: state.seed,
    season,
  });
}

/** Come si è chiusa la stagione rispetto alle due divisioni collegate. */
interface DivisionOutcome {
  move: DivisionMove;
  /** La lega in cui giocheremo la prossima stagione. */
  newLeagueId: string;
  newLeagueName: string;
  ourFate: "promosso" | "retrocesso" | "resta";
  /** Retrocessi dalla seconda divisione: sotto non c'è nulla, la carriera finisce. */
  careerOver: boolean;
}

/**
 * Chi sale e chi scende, a fine stagione.
 *
 * ## Le due classifiche non arrivano dalla stessa parte
 *
 * Del **nostro** campionato la classifica c'è già: l'abbiamo giocata giornata per giornata.
 * Dell'altro no — è il campionato in cui non militiamo, e nessuno l'ha mai simulato. Si gioca
 * quindi lì e ora (`simulateSiblingSeason`), una volta sola, col seme di carriera.
 *
 * Da questa asimmetria discende tutto il resto: **chi sale viene sempre dalla seconda
 * divisione e chi scende sempre dalla prima**, quindi a seconda di dove stiamo una delle due
 * metà del movimento la leggiamo dalla nostra classifica e l'altra da quella simulata.
 *
 * ## Perché la Serie B non retrocede nessuno
 *
 * Il mondo non ha una terza serie, e non serve: la Serie A perde tre squadre e ne riceve tre,
 * la Serie B specularmente — entrambe restano a venti **per costruzione**, senza dover
 * inventare una Serie C solo per far quadrare i conti. Le ultime tre di Serie B semplicemente
 * restano dove sono.
 *
 * L'unica eccezione è **noi**: se finiamo negli ultimi tre posti della Serie B la carriera
 * chiude. Non è il club a sparire, è il nostro incarico a finire — ed è ciò che dà un fondo
 * alla discesa, altrimenti si potrebbe galleggiare in basso per dieci stagioni senza rischio.
 */
function resolveDivisions(
  state: CareerState,
  world: CareerWorld,
  standings: StandingRow[],
): DivisionOutcome | null {
  const div = world.divisions;
  if (!div) return null;

  const inTop = state.leagueId === div.topLeagueId;
  const inSecond = state.leagueId === div.secondLeagueId;
  // Un campionato che non fa parte della coppia non ha promozioni: regola di sempre.
  if (!inTop && !inSecond) return null;

  const nostra = promotionAndRelegation(standings.map((r) => r.teamId));

  const siblingId = inTop ? div.secondLeagueId : div.topLeagueId;
  const siblingTeams = (div.clubsByLeague[siblingId] ?? [])
    .map((id) => div.teams[id])
    .filter((t): t is LeagueTeam => !!t);
  const gemella = promotionAndRelegation(
    orderedClubIds(
      simulateSiblingSeason(
        siblingTeams,
        derivedRandom(state.seed, "sibling", siblingId, state.season),
      ),
    ),
  );

  const promoted = inTop ? gemella.promoted : nostra.promoted;
  const relegated = inTop ? nostra.relegated : gemella.relegated;
  const move: DivisionMove = { season: state.season, promoted, relegated };

  if (inSecond) {
    // In seconda divisione ci interessa una cosa sola oltre alla promozione: essere fra le
    // ultime tre, che qui non significa scendere ancora ma essere sollevati dall'incarico.
    const ultimiTre = standings
      .slice(Math.max(0, standings.length - PROMOTION_SLOTS))
      .some((r) => r.teamId === state.clubId);
    if (ultimiTre) {
      return {
        move,
        newLeagueId: div.secondLeagueId,
        newLeagueName: div.secondLeagueName,
        ourFate: "retrocesso",
        careerOver: true,
      };
    }
    const saliti = promoted.includes(state.clubId);
    return {
      move,
      newLeagueId: saliti ? div.topLeagueId : div.secondLeagueId,
      newLeagueName: saliti ? div.topLeagueName : div.secondLeagueName,
      ourFate: saliti ? "promosso" : "resta",
      careerOver: false,
    };
  }

  const scesi = relegated.includes(state.clubId);
  return {
    move,
    newLeagueId: scesi ? div.secondLeagueId : div.topLeagueId,
    newLeagueName: scesi ? div.secondLeagueName : div.topLeagueName,
    ourFate: scesi ? "retrocesso" : "resta",
    careerOver: false,
  };
}

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

  const nationalOutcome =
    state.nationalCup && world.divisions
      ? ownNationalCupOutcome(state.nationalCup, world.divisions.teams, state.clubId)
      : undefined;

  /**
   * I tre trofei della stagione.
   *
   * `league` è il primo posto, non "la zona alta": in Serie B vale la promozione come titolo di
   * categoria, ma il campionato vinto resta il campionato vinto — è la stessa riga per entrambe
   * le divisioni, senza casi speciali.
   */
  const trophies = {
    league: row.position === 1,
    continental: cupOutcome === "vittoria",
    national: nationalOutcome === "vittoria",
  };
  const treble = trophies.league && trophies.continental && trophies.national;

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
    nationalCupOutcome:
      nationalOutcome && nationalOutcome !== "assente" ? nationalOutcome : undefined,
    trophies,
    treble,
    leagueName: world.leagueName,
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

  /**
   * **Promozioni e retrocessioni** (`docs/piano-serie-b.md`).
   *
   * Senza una seconda divisione collegata resta la regola di sempre: gli ultimi tre posti
   * chiudono la carriera. È il caso di Premier, Liga, Bundesliga e Ligue 1, che nel database
   * non hanno un campionato sotto.
   */
  const divisioni = resolveDivisions(state, world, standings);
  /**
   * La lega in cui la stagione **è stata giocata**, catturata prima che una promozione o una
   * retrocessione riscriva `state.leagueId`. Serve alla qualificazione in Corona, che premia il
   * piazzamento ottenuto in un certo campionato e non quello in cui si andrà a giocare.
   */
  const legaGiocata = state.leagueId;

  if (!divisioni) {
    if (row.position > teamsInLeague - PROMOTION_SLOTS) {
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
  } else {
    /**
     * **Scendere dalla seconda divisione chiude comunque la carriera.**
     *
     * Non perché il club sparisca — il mondo non modella una terza serie — ma perché sotto la
     * Serie B non c'è nulla che valga la pena giocare: è il pavimento, e toccarlo è il modo in
     * cui questa modalità ti dice che hai fallito. Sopra, invece, si continua: la retrocessione
     * dalla Serie A ora è un capitolo della carriera, non la sua fine.
     */
    if (divisioni.careerOver) {
      return {
        state: {
          ...state,
          phase: "conclusa",
          ending: "retrocessione",
          history: [...state.history, { ...summary, divisionOutcome: "retrocesso" }],
        },
        messages: [...messages, "Retrocessi dalla Serie B: la carriera finisce qui."],
      };
    }

    summary.divisionOutcome = divisioni.ourFate;
    if (divisioni.ourFate === "promosso") {
      messages.push(`Promossi in ${divisioni.newLeagueName}!`);
    } else if (divisioni.ourFate === "retrocesso") {
      messages.push(`Retrocessi in ${divisioni.newLeagueName}: si riparte da lì.`);
    }

    state = {
      ...state,
      leagueId: divisioni.newLeagueId,
      divisionMoves: [...(state.divisionMoves ?? []), divisioni.move],
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

  const returningSet = new Set(settled.returning.map((r) => r.playerId));
  const playerReports: SeasonPlayerReport[] = rientrati.map((entry) => {
    const change = byId.get(entry.playerId);
    const resolved = players[entry.playerId];
    const age = ageInSeason(resolved?.birthDate, state.season) ?? 25;
    const retiredFlag = age !== null && shouldRetire(age + 1, state.season + 1);
    const overallAfter = change?.after ?? entry.overall;
    const potentialDelta = change?.potentialDelta ?? 0;
    return {
      playerId: entry.playerId,
      name: resolved?.name ?? "Giocatore",
      role: resolved?.role ?? "CC",
      age,
      overallBefore: entry.overall,
      overallAfter,
      overallDelta: overallAfter - entry.overall,
      potentialBefore: entry.potential,
      potentialAfter: entry.potential + potentialDelta,
      potentialDelta,
      meritDelta: change?.meritDelta ?? 0,
      margin: change?.margin ?? 0,
      retired: retiredFlag,
      morale: entry.morale,
      unhappy: entry.morale < STANDOFF_MORALE_THRESHOLD,
      stats: { ...entry.stats },
      loanReturn: returningSet.has(entry.playerId),
    };
  });
  summary.playerReports = playerReports;

  const retired: { entry: RosterEntry; peakOverall: number }[] = [];
  let roster = rientrati
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

  /**
   * **I contratti presentano il conto.**
   *
   * Chi non è stato rinnovato lascia il club a parametro zero: è la conseguenza che dà senso a
   * tutte le conversazioni dell'anno, ed è anche ciò che alimenta il pool svincolati della
   * stagione dopo (`freeAgents.ts`, che lo deriva dalle scadenze).
   */
  const conRosaFinale: CareerState = { ...state, roster };
  const scadenze = expireContracts(conRosaFinale, world);
  const impegniStagione = settleCommitments(scadenze.state, world, "season", new Set());
  messages.push(...scadenze.messages, ...impegniStagione.messages);
  const dopoContratti = impegniStagione.state;
  roster = dopoContratti.roster;

  const sforamentoPrecedente = financesOf(dopoContratti, world).overrunNow;
  if (sforamentoPrecedente > 0) {
    messages.push(
      `Il monte ingaggi ha sforato il tetto: ${formatEuro(sforamentoPrecedente)} in meno sul fatturato di quest'anno.`,
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
    // Salire o scendere di categoria è il fatto economico dell'anno, non un premio fra gli altri.
    divisionOutcome: divisioni?.ourFate,
  });

  // Qualificazione alla Corona: le prime quattro del campionato **appena giocato**, non di
  // quello in cui militeremo l'anno prossimo (vedi `nextSeasonCup`).
  const cup = nextSeasonCup(state, world, row.position, legaGiocata);
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

  /**
   * **Il giudizio della dirigenza** (`board.ts`), che è la parte che mancava: fino a qui un
   * obiettivo mancato costava sei punti di sintonia col mister e nient'altro. Ora c'è un
   * presidente che tiene il conto, e che se la stagione è andata male chiede la testa
   * dell'allenatore — una richiesta che il DS dovrà accogliere o respingere prima di ripartire.
   */
  const verdetto = boardSeasonVerdict({
    board: state.board,
    season: state.season,
    objective: state.seasonObjective
      ? { label: state.seasonObjective.label, targetPosition: state.seasonObjective.targetPosition }
      : undefined,
    finalPosition: row.position,
    teamsInLeague,
    trophies: Number(trophies.league) + Number(trophies.continental) + Number(trophies.national),
    divisionOutcome: divisioni?.ourFate === "resta" ? undefined : divisioni?.ourFate,
    coachName: state.coachId ? findCoach(state.coachId)?.name : undefined,
    hasCoach: !!state.coachId,
  });
  messages.push(verdetto.message);

  if (verdetto.dsSacked) {
    return {
      state: {
        ...state,
        phase: "conclusa",
        ending: "esonero",
        board: verdetto.board,
        history: [...state.history, summary],
      },
      messages: [
        ...messages,
        "La società ha esonerato il direttore sportivo: la fiducia era finita da un pezzo.",
      ],
    };
  }

  return {
    state: {
      ...state,
      coachHarmony,
      board: verdetto.board,
      season,
      week: 0,
      phase: "mercato_estivo",
      budget: Math.round(
        Math.max(0, budget - sforamentoPrecedente) *
          (1 - (state.finances?.wageShare ?? DEFAULT_WAGE_SHARE)),
      ),
      roster,
      league: { round: 0, tallies: [] },
      cup,
      // Nuova edizione della Coppa Tricolore: ci sono dentro tutti, ogni anno, quindi non c'è
      // nulla da qualificare — si ricompone il tabellone con le due divisioni aggiornate dai
      // movimenti appena registrati.
      nationalCup: buildNationalCup(state, world, season),
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
      // Contratti, impegni e rapporti sopravvivono alla stagione: sono la memoria della carriera.
      contracts: dopoContratti.contracts,
      commitments: dopoContratti.commitments,
      relationships: dopoContratti.relationships,
      captainId: roster.some((e) => e.playerId === state.captainId) ? state.captainId : undefined,
      resting: undefined,
      // Il fatturato si ricalcola ogni anno; la **ripartizione** decisa dal DS resta la sua, meno
      // l'eventuale sforamento dell'anno scorso, che si sconta una volta sola.
      seasonRevenue: Math.max(0, budget - sforamentoPrecedente),
      finances: {
        wageShare: state.finances?.wageShare ?? DEFAULT_WAGE_SHARE,
        summerShare: state.finances?.wageShare ?? DEFAULT_WAGE_SHARE,
      },
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
  /** La lega in cui la stagione è stata giocata; per default quella corrente dello stato. */
  playedLeagueId: string = state.leagueId,
): CupSave | undefined {
  const pool = world.cupEntrants;
  if (!pool || position > CUP_QUALIFY_POSITION) return undefined;

  /**
   * **In seconda divisione la Corona non si gioca**, a prescindere dal piazzamento
   * (`divisions.ts`, decisione dell'utente).
   *
   * Il campionato da guardare è **quello in cui la stagione è stata giocata**, non quello in
   * cui militeremo: a questo punto `state.leagueId` è già stato riscritto dall'eventuale
   * promozione. Guardando il campo dello stato, vincere la Serie B qualificava alla Corona —
   * perché nel frattempo eravamo già "di Serie A". Trovato da un test, non ipotizzato.
   *
   * Ne discende anche il caso simmetrico: chi retrocede dalla Serie A arrivando comunque fra
   * le prime quattro (possibile solo in scenari di prova) non porta il pass in Serie B, perché
   * lì la Corona non esiste — se ne riparla risalendo.
   */
  if (world.divisions && playedLeagueId === world.divisions.secondLeagueId) return undefined;

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

/* ========================================================================== */
/* CONTRATTI, FINANZE E SPOGLIATOIO                                           */
/* ========================================================================== */

/**
 * Il fatturato della stagione.
 *
 * Nei salvataggi precedenti non esisteva: `budget` era tutto il denaro disponibile. Lì si
 * ricostruisce come "liquidità di mercato più il monte ingaggi implicito", così una carriera già
 * avviata non si ritrova improvvisamente senza cassa ingaggi.
 */
export function revenueOf(state: CareerState, world: CareerWorld): number {
  if (state.seasonRevenue !== undefined) return state.seasonRevenue;
  return Math.round(state.budget + playerWageBill(state, world) + (state.coachContract?.wage ?? 0));
}

/** Il contesto con cui si derivano i contratti dei nostri giocatori. */
export function contractContextOf(state: CareerState, world: CareerWorld) {
  return {
    seed: state.seed,
    season: state.season,
    overrides: state.contracts?.overrides,
    released: state.contracts?.released,
    clubPrestige: world.market?.valuation.clubPrestige[state.clubId] ?? 3,
  };
}

/** Il contratto di un nostro giocatore: dall'override se c'è, altrimenti derivato dal seme. */
export function contractFor(
  state: CareerState,
  world: CareerWorld,
  playerId: string,
): Contract | null {
  const entry = state.roster.find((e) => e.playerId === playerId);
  if (!entry) return null;
  const info = careerPlayers(state, world)[playerId];
  return contractOf(
    { id: playerId, birthDate: info?.birthDate, overall: entry.overall },
    { ...contractContextOf(state, world), sinceSeason: Math.max(1, entry.sinceSeason) },
  );
}

/** Somma degli ingaggi dei giocatori in rosa. */
function playerWageBill(state: CareerState, world: CareerWorld): number {
  return state.roster.reduce(
    (somma, e) => somma + (contractFor(state, world, e.playerId)?.wage ?? 0),
    0,
  );
}

/**
 * Il monte ingaggi: giocatori **più l'allenatore**.
 *
 * Includere il mister è una richiesta esplicita dell'utente, ed è anche ciò che rende una scelta
 * il contratto lungo a un tecnico costoso: quei milioni non sono un costo una tantum, tolgono
 * spazio ai rinnovi per tutti gli anni che restano.
 */
export function wageBillOf(state: CareerState, world: CareerWorld): number {
  return playerWageBill(state, world) + (state.coachContract?.wage ?? 0);
}

/** La fotografia delle finanze: due casse, un pavimento, un eventuale sforamento. */
export function financesOf(state: CareerState, world: CareerWorld): FinancesView {
  return financesView(
    revenueOf(state, world),
    state.finances ?? defaultFinances(),
    wageBillOf(state, world),
  );
}

/**
 * Sposta la ripartizione fra cassa mercato e cassa ingaggi.
 *
 * Spostare verso gli ingaggi **toglie liquidità** al mercato e viceversa: è la stessa cassa, ed è
 * il punto in cui la scelta si sente. Il pavimento degli impegni già firmati è invalicabile.
 */
export function setWageShare(
  state: CareerState,
  world: CareerWorld,
  newShare: number,
): { state: CareerState; ok: boolean; message?: string } {
  const revenue = revenueOf(state, world);
  const esito = shiftWageShare({
    revenue,
    finances: state.finances ?? defaultFinances(),
    transferCash: state.budget,
    committedWages: wageBillOf(state, world),
    newShare,
    winter: state.market?.window === "riparazione",
  });
  if (!esito.ok) return { state, ok: false, message: esito.reason };
  return {
    state: { ...state, finances: esito.finances, budget: esito.transferCash, seasonRevenue: revenue },
    ok: true,
  };
}

/* -------------------------------------------------------------------------- */
/* I fatti di un giocatore                                                     */
/* -------------------------------------------------------------------------- */

/** L'ingaggio mediano di chi in rosa ha un livello confrontabile: il metro del "sottopagato". */
function peerWage(state: CareerState, world: CareerWorld, entry: RosterEntry): number {
  const pari = state.roster
    .filter((e) => Math.abs(e.overall - entry.overall) <= 3 && e.playerId !== entry.playerId)
    .map((e) => contractFor(state, world, e.playerId)?.wage ?? 0)
    .filter((w) => w > 0)
    .sort((a, b) => a - b);
  if (pari.length === 0) return 0;
  return pari[Math.floor(pari.length / 2)]!;
}

/** Di quante posizioni siamo sotto l'obiettivo dichiarato: alimenta morale e temi. */
function positionsBelowTargetOf(state: CareerState, world: CareerWorld): number {
  const obiettivo = state.seasonObjective?.targetPosition;
  if (!obiettivo || state.league.round === 0) return 0;
  const nostra = buildStandings(rebuildLeagueState(state, world), 0).find((r) => r.isUser)?.position;
  return nostra ? Math.max(0, nostra - obiettivo) : 0;
}

/** Costruisce i fatti di un giocatore, assemblando ciò che vive sparso nello stato. */
export function playerFactsOf(
  state: CareerState,
  world: CareerWorld,
  playerId: string,
): PlayerFacts | null {
  const entry = state.roster.find((e) => e.playerId === playerId);
  if (!entry) return null;
  const anagrafica = careerPlayers(state, world);
  const info = anagrafica[playerId];
  if (!info) return null;

  const contratto = contractFor(state, world, playerId);
  const mediano = peerWage(state, world, entry);
  const finanze = financesOf(state, world);
  const offerta = state.market?.offers.find((o) => o.playerId === playerId);
  const pre = state.contracts?.preContracts.find((p) => p.playerId === playerId);

  return buildPlayerFacts({
    entry,
    player: {
      id: playerId,
      name: info.name,
      role: info.role,
      secondaryRoles: info.secondaryRoles,
      birthDate: info.birthDate,
    },
    age: ageInSeason(info.birthDate, state.season) ?? 26,
    season: state.season,
    matchday: state.league.round,
    squadAverage: averageOverall(state.roster),
    marketValue: playerValue(state, world, playerId),
    roster: state.roster,
    roleOf: (id) => {
      const p = anagrafica[id];
      return p ? { role: p.role, secondaryRoles: p.secondaryRoles } : undefined;
    },
    contract: contratto,
    wageVsPeers: mediano > 0 && contratto ? contratto.wage / mediano : 1,
    wageRoomLeft: finanze.wageRoom,
    preContractSuitor: pre
      ? {
          clubId: pre.toClubId,
          clubName: pre.clubName,
          prestige: world.market?.valuation.clubPrestige[pre.toClubId] ?? 3,
        }
      : undefined,
    renewalRefused: state.contracts?.renewalRefused.includes(playerId) ?? false,
    winterWindowOpen: state.market?.window === "riparazione",
    guaranteedStarters: state.guaranteedStarters,
    coachBenched: state.coachBenched,
    coachUntouchables: getCoachUntouchables(state.roster, state.coachId, anagrafica),
    captainId: state.captainId ?? undefined,
    lostCaptaincy: (state.captaincyLost ?? []).includes(playerId),
    coachHarmony: state.coachHarmony,
    positionsBelowTarget: positionsBelowTargetOf(state, world),
    incomingOffer: offerta
      ? {
          clubId: offerta.fromClubId,
          clubName: offerta.fromClubName,
          fee: offerta.fee,
          prestige: world.market?.valuation.clubPrestige[offerta.fromClubId] ?? 3,
          kind: "trasferimento",
        }
      : undefined,
    isOnTransferList: (state.lists?.transferList ?? []).includes(playerId),
    isOnLoanList: (state.lists?.loanList ?? []).includes(playerId),
    relationship: state.relationships?.[playerId],
    openCommitments: commitmentsFor(state.commitments, playerId),
    currentWeek: state.league.round,
  });
}

/* -------------------------------------------------------------------------- */
/* Lo Spogliatoio                                                              */
/* -------------------------------------------------------------------------- */

export interface DressingRoomEntry {
  playerId: string;
  name: string;
  topicId: string;
  topicLabel: string;
  demand: string;
  urgency: number;
  morale: number;
  trust: number;
  feud: boolean;
  contractSeasonsLeft: number;
  blocking: boolean;
}

/**
 * Chi ha davvero qualcosa da dire, ordinato per urgenza.
 *
 * Chi non trova un tema ammissibile **non compare**: è la differenza fra uno spogliatoio e un
 * ufficio reclami. Prima l'elenco era "chi ha il morale sotto 55", quindi ci finiva dentro anche
 * chi non aveva nulla che il club potesse concedergli.
 */
export function dressingRoom(state: CareerState, world: CareerWorld): DressingRoomEntry[] {
  const out: DressingRoomEntry[] = [];
  for (const entry of state.roster) {
    const facts = playerFactsOf(state, world, entry.playerId);
    if (!facts) continue;
    const topic = pickTopic(facts);
    if (!topic) continue;
    out.push({
      playerId: facts.playerId,
      name: facts.name,
      topicId: topic.id,
      topicLabel: topic.label,
      demand: topic.demand(facts).description,
      urgency: talkUrgency(facts),
      morale: facts.morale,
      trust: facts.trust,
      feud: facts.isFeuding,
      contractSeasonsLeft: facts.seasonsLeft,
      blocking: blockingTopic(facts) !== null,
    });
  }
  out.sort((a, b) => b.urgency - a.urgency);

  // **Il tetto ai casi aperti.** I bloccanti passano tutti — sono emergenze, e nasconderne una
  // sarebbe peggio di mostrarne troppe — gli altri si fermano ai più urgenti. Chi resta fuori
  // non è risolto: tornerà quando sarà lui il caso più caldo.
  const bloccanti = out.filter((v) => v.blocking);
  const ordinari = out.filter((v) => !v.blocking).slice(0, MAX_OPEN_CASES);
  return [...bloccanti, ...ordinari].sort((a, b) => b.urgency - a.urgency);
}

/** Il contesto con cui si valutano le mosse: liquidità, margine ingaggi, parere del mister. */
export function moveContextOf(
  state: CareerState,
  world: CareerWorld,
  facts: PlayerFacts,
): MoveContext {
  const finanze = financesOf(state, world);
  // Il mister guarda **il rivale vero** nella casella, non una soglia scritta a mano.
  const rivale = facts.bestRivalOverallInRole;
  const sintonia = ((state.coachHarmony ?? 50) - 50) / 10;
  const coachWouldApprove = rivale < 0 || facts.overall - rivale + sintonia >= -2;

  const conteggio: Record<Department, number> = { POR: 0, DIF: 0, CC: 0, ATT: 0 };
  const anagrafica = careerPlayers(state, world);
  for (const e of state.roster) {
    const dep = anagrafica[e.playerId]?.department;
    if (dep) conteggio[dep] += 1;
  }
  const ordine: Department[] = ["POR", "DIF", "CC", "ATT"];
  const weakestDepartment = [...ordine].sort((a, b) => conteggio[a] - conteggio[b])[0];

  return {
    transferCash: state.budget,
    wageRoom: finanze.wageRoom,
    slotRole: facts.role,
    coachWouldApprove,
    hasOtherCaptain: !!state.captainId && state.captainId !== facts.playerId,
    weakestDepartment,
    season: state.season,
    matchday: state.league.round,
  };
}

/** Apre la conversazione col tema più urgente fra quelli **ammissibili**. */
export function openPlayerDialogue(
  state: CareerState,
  world: CareerWorld,
  playerId: string,
): Dialogue | null {
  const facts = playerFactsOf(state, world, playerId);
  if (!facts) return null;
  const topic = pickTopic(facts);
  if (!topic) return null;
  return openDialogue(facts, topic);
}

function clampMorale(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function withMorale(state: CareerState, playerId: string, delta: number): CareerState {
  return {
    ...state,
    roster: state.roster.map((e) =>
      e.playerId === playerId ? { ...e, morale: clampMorale(e.morale + delta) } : e,
    ),
  };
}

function withTrust(
  state: CareerState,
  playerId: string,
  delta: number,
  status?: DialogueStatus,
): CareerState {
  const attuale = state.relationships?.[playerId] ?? { trust: DEFAULT_TRUST };
  return {
    ...state,
    relationships: {
      ...(state.relationships ?? {}),
      [playerId]: {
        ...attuale,
        trust: Math.max(0, Math.min(100, attuale.trust + delta)),
        feud: status === "rottura" ? true : attuale.feud,
      },
    },
  };
}

function withList(
  state: CareerState,
  playerId: string,
  lista: "transferList" | "loanList",
): CareerState {
  const attuale = state.lists?.[lista] ?? [];
  if (attuale.includes(playerId)) return state;
  return {
    ...state,
    lists: {
      transferList:
        lista === "transferList" ? [...attuale, playerId] : (state.lists?.transferList ?? []),
      loanList: lista === "loanList" ? [...attuale, playerId] : (state.lists?.loanList ?? []),
    },
  };
}

function emptyContracts(state: CareerState): NonNullable<CareerState["contracts"]> {
  return {
    overrides: state.contracts?.overrides ?? {},
    released: state.contracts?.released ?? [],
    preContracts: state.contracts?.preContracts ?? [],
    renewalRefused: state.contracts?.renewalRefused ?? [],
  };
}

function withContractOverride(
  state: CareerState,
  playerId: string,
  contract: Contract,
): CareerState {
  const base = emptyContracts(state);
  return {
    ...state,
    contracts: {
      ...base,
      overrides: {
        ...base.overrides,
        [playerId]: {
          until: contract.until,
          wage: contract.wage,
          signedSeason: contract.signedSeason,
          clause: contract.releaseClause,
        },
      },
    },
  };
}

/** Esegue la cessione collegata all'offerta ricevuta: stessa operazione della scheda Offerte. */
function executeIncomingOffer(state: CareerState, playerId: string): CareerState {
  const offer = state.market?.offers.find((o) => o.playerId === playerId);
  if (!offer || !state.market) return state;
  return {
    ...state,
    roster: state.roster.filter((e) => e.playerId !== playerId),
    budget: state.budget + offer.fee,
    market: {
      ...state.market,
      offers: state.market.offers.filter((o) => o.playerId !== playerId),
      loanOffers: state.market.loanOffers.filter((l) => l.playerId !== playerId),
    },
    lists: {
      transferList: (state.lists?.transferList ?? []).filter((id) => id !== playerId),
      loanList: (state.lists?.loanList ?? []).filter((id) => id !== playerId),
    },
    sessionDeals: [
      ...(state.sessionDeals ?? []),
      { playerId, playerName: offer.playerName, kind: "cessione" as const, amount: offer.fee },
    ],
  };
}

/** Applica una mossa della conversazione allo stato della carriera. */
export function applyPlayerDialogue(
  state: CareerState,
  world: CareerWorld,
  dialogue: Dialogue,
  move: DialogueMove,
): { state: CareerState; dialogue: Dialogue; message?: string } {
  const facts = playerFactsOf(state, world, dialogue.playerId);
  if (!facts) return { state, dialogue };
  let messaggio: string | undefined;

  const effetti = applyDialogueMove(dialogue, facts, move, moveContextOf(state, world, facts));
  if (effetti.errorMessage) {
    return { state, dialogue: effetti.dialogue, message: effetti.errorMessage };
  }

  let next = state;
  const id = dialogue.playerId;

  if (effetti.transferCashDelta !== 0) {
    next = { ...next, budget: next.budget + effetti.transferCashDelta };
  }

  if (effetti.wageDelta !== 0) {
    const attuale = contractFor(next, world, id);
    if (attuale) {
      next = withContractOverride(next, id, { ...attuale, wage: attuale.wage + effetti.wageDelta });
    }
  }

  if (effetti.moraleDelta !== 0) next = withMorale(next, id, effetti.moraleDelta);
  if (effetti.trustDelta !== 0) next = withTrust(next, id, effetti.trustDelta, effetti.dialogue.status);

  if (effetti.commitments.length > 0) {
    next = { ...next, commitments: [...(next.commitments ?? []), ...effetti.commitments] };
  }
  if (effetti.guaranteeRole) next = setGuaranteedStarter(next, effetti.guaranteeRole, id);
  if (effetti.setCaptain) {
    // Anche in chat la fascia la concede il **mister**: promettere quello che non si può dare
    // sarebbe la premessa di una promessa infranta.
    const esito = proposeCaptain(next, world, id);
    next = esito.state;
    if (!esito.ok) messaggio = esito.message;
  }
  if (effetti.restMatchdays) {
    next = { ...next, resting: { ...(next.resting ?? {}), [id]: effetti.restMatchdays } };
  }
  if (effetti.listForTransfer) next = withList(next, id, "transferList");
  if (effetti.listForLoan) next = withList(next, id, "loanList");
  if (effetti.sellNow) next = executeIncomingOffer(next, id);
  if (effetti.coachResigns) {
    next = { ...next, coachId: null, coachPromises: [], coachHarmony: 40, coachContract: undefined };
  }
  if (effetti.coachBenches) {
    next = { ...next, coachBenched: { ...(next.coachBenched ?? {}), [id]: true } };
  }

  if (effetti.dressingRoomDelta) {
    const anagrafica = careerPlayers(next, world);
    const { department, delta } = effetti.dressingRoomDelta;
    next = {
      ...next,
      roster: next.roster.map((e) =>
        e.playerId !== id && anagrafica[e.playerId]?.department === department
          ? { ...e, morale: clampMorale(e.morale + delta) }
          : e,
      ),
    };
  }

  if (effetti.dialogue.status !== "aperta") {
    next = {
      ...next,
      relationships: {
        ...(next.relationships ?? {}),
        [id]: {
          ...(next.relationships?.[id] ?? { trust: DEFAULT_TRUST }),
          trust: effetti.dialogue.trust,
          feud: effetti.dialogue.status === "rottura" ? true : next.relationships?.[id]?.feud,
          lastTalkedWeek: next.league.round,
          // Stagione e argomento sono ciò che rende la tregua verificabile: senza il primo si
          // azzererebbe da sola al cambio d'anno, senza il secondo silenzierebbe il giocatore
          // anche su un caso nuovo e più grave (`playerTopics.ts`, `inTregua`).
          lastTalkedSeason: next.season,
          lastTopicId: effetti.dialogue.topicId,
        },
      },
    };
    // Una conversazione chiusa, qualunque sia l'esito, chiude anche la richiesta forzata: è lo
    // stesso gate di sempre (`pendingRequest`), cambia solo *come* si risolve.
    if (next.pendingRequest?.playerId === id) {
      next = { ...next, pendingRequest: null, lastResolvedMatchday: next.league.round };
    }
  }

  // Il caso "fascia tolta" si chiude quando lo si è affrontato, comunque sia andata: altrimenti
  // il tema bloccante ricomparirebbe a ogni giornata anche dopo averlo risolto.
  if (effetti.dialogue.status !== "aperta") next = clearCaptaincyGrudge(next, id);

  return { state: next, dialogue: effetti.dialogue, message: messaggio };
}

/* -------------------------------------------------------------------------- */
/* Rinnovi e svincoli                                                          */
/* -------------------------------------------------------------------------- */

export interface RenewalOffer {
  wage: number;
  seasons: number;
  clause?: number;
  guaranteedStarter?: boolean;
  captain?: boolean;
}

/** Che cosa chiede questo giocatore per rinnovare: nasce dai fatti, non da una percentuale. */
export function renewalDemandOf(state: CareerState, world: CareerWorld, playerId: string) {
  const facts = playerFactsOf(state, world, playerId);
  if (!facts) return null;
  return renewalTerms({
    age: facts.age,
    overall: facts.overall,
    marketValue: facts.marketValue,
    currentWage: facts.wage,
    wageVsPeers: facts.wageVsPeers,
    overUnderPerformance: facts.overUnderPerformance,
    clubPrestige: world.market?.valuation.clubPrestige[state.clubId] ?? 3,
    personality: facts.personality,
    playedShare: facts.playedShare,
  });
}

/**
 * Firma il rinnovo alle condizioni proposte.
 *
 * Non c'è una soglia sola: il giocatore giudica il **pacchetto** con la sua scala (personalità),
 * quindi la stessa cifra convince un mercenario e offende un giovane che voleva giocare.
 */
export function renewContract(
  state: CareerState,
  world: CareerWorld,
  playerId: string,
  offer: RenewalOffer,
): { state: CareerState; ok: boolean; message: string } {
  const facts = playerFactsOf(state, world, playerId);
  const terms = renewalDemandOf(state, world, playerId);
  if (!facts || !terms) return { state, ok: false, message: "Giocatore non in rosa." };

  const finanze = financesOf(state, world);
  const aumento = offer.wage - facts.wage;
  if (aumento > finanze.wageRoom) {
    return {
      state,
      ok: false,
      message: `Margine ingaggi insufficiente: servono ${formatEuro(aumento)}/anno, ne restano ${formatEuro(finanze.wageRoom)}.`,
    };
  }

  const punteggio = renewalOfferScore(
    {
      wage: offer.wage,
      seasons: offer.seasons,
      clause: offer.clause ?? 0,
      starter: offer.guaranteedStarter ?? false,
      captain: offer.captain ?? false,
    },
    terms,
    facts.personality,
  );

  if (punteggio < RENEWAL_ACCEPT_SCORE) {
    const base = emptyContracts(state);
    return {
      state: {
        ...state,
        contracts: {
          ...base,
          renewalRefused: base.renewalRefused.includes(playerId)
            ? base.renewalRefused
            : [...base.renewalRefused, playerId],
        },
      },
      ok: false,
      message: `${facts.name} rifiuta: la proposta non regge il confronto con quello che si aspetta.`,
    };
  }

  let next = withContractOverride(state, playerId, {
    until: state.season + offer.seasons - 1,
    wage: offer.wage,
    signedSeason: state.season,
    releaseClause: offer.clause,
  });
  next = withMorale(next, playerId, 20);
  next = withTrust(next, playerId, 15);
  // Rinnovare toglie di mezzo il precontratto altrui e l'eventuale rifiuto precedente.
  const base = emptyContracts(next);
  next = {
    ...next,
    contracts: {
      ...base,
      preContracts: base.preContracts.filter((p) => p.playerId !== playerId),
      renewalRefused: base.renewalRefused.filter((id) => id !== playerId),
    },
  };
  if (offer.captain) next = { ...next, captainId: playerId };
  if (offer.guaranteedStarter) next = setGuaranteedStarter(next, facts.role, playerId);

  return {
    state: next,
    ok: true,
    message: `${facts.name} ha rinnovato: ${formatWage(offer.wage)} fino al ${state.season + offer.seasons - 1}.`,
  };
}

/** Rescinde il contratto: il giocatore lascia la rosa e finisce fra gli svincolati del mondo. */
export function releasePlayer(
  state: CareerState,
  world: CareerWorld,
  playerId: string,
): { state: CareerState; ok: boolean; message: string } {
  const entry = state.roster.find((e) => e.playerId === playerId);
  if (!entry) return { state, ok: false, message: "Non fa parte della rosa." };
  if (state.roster.length <= MIN_SQUAD_SIZE) {
    return { state, ok: false, message: "Non puoi scendere sotto gli undici schierabili." };
  }
  const nome = careerPlayers(state, world)[playerId]?.name ?? "Il giocatore";
  const contratto = contractFor(state, world, playerId);
  const buonuscita = Math.round(
    (contratto?.wage ?? 0) * seasonsLeftOf(contratto, state.season) * 0.4,
  );
  const base = emptyContracts(state);

  return {
    state: {
      ...state,
      roster: state.roster.filter((e) => e.playerId !== playerId),
      budget: state.budget - buonuscita,
      contracts: {
        ...base,
        released: [...base.released, playerId],
        preContracts: base.preContracts.filter((p) => p.playerId !== playerId),
        renewalRefused: base.renewalRefused.filter((id) => id !== playerId),
      },
    },
    ok: true,
    message: `${nome} è stato svincolato${buonuscita > 0 ? ` (buonuscita ${formatEuro(buonuscita)})` : ""}.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Il mercato dei parametri zero                                               */
/* -------------------------------------------------------------------------- */

/** Gli svincolati disponibili adesso: derivati, quindi zero byte di salvataggio. */
export function freeAgentMarket(state: CareerState, world: CareerWorld): FreeAgent[] {
  if (!world.market) return [];
  const mondo = Object.values(world.market.players).map((p) => ({
    id: p.id,
    name: p.name,
    nation: p.nation,
    role: p.role,
    secondaryRoles: p.secondaryRoles,
    department: ROLE_DEPARTMENT[p.role],
    birthDate: (p as { birthDate?: string | null }).birthDate ?? null,
    overall: world.market?.clubs[state.clubId]?.startingEleven ? 0 : 0,
    clubId: state.clubId,
  }));
  // La vetrina si costruisce dal pool acquistabile, che porta con sé Overall e club correnti.
  const acquistabili = world.market.transferPool.map((p) => ({
    id: p.playerId,
    name: world.market!.nameOf(p.playerId),
    nation: world.market!.players[p.playerId]?.nation ?? "Italia",
    role: world.market!.players[p.playerId]?.role ?? "CC",
    secondaryRoles: world.market!.players[p.playerId]?.secondaryRoles ?? [],
    department: ROLE_DEPARTMENT[world.market!.players[p.playerId]?.role ?? "CC"],
    birthDate: birthDateFromAge(world.market!.ageOf(p.playerId), state.season),
    overall: p.overall,
    clubId: p.clubId,
  }));
  void mondo;

  return buildFreeAgentPool({
    worldPlayers: acquistabili,
    seed: state.seed,
    season: state.season,
    winter: state.market?.window === "riparazione",
    overrides: state.contracts?.overrides,
    released: state.contracts?.released,
    signed: new Set([...(state.freeAgentsSigned ?? []), ...state.roster.map((e) => e.playerId)]),
    clubPrestige: world.market.valuation.clubPrestige,
  });
}

/** Data di nascita coerente con un'età: il pool del mercato espone l'età, non la data. */
function birthDateFromAge(age: number, season: number): string {
  return `${2025 + season - 1 - Math.max(15, Math.round(age))}-06-15`;
}

/** Le squadre che possono contendercelo, con i loro veri vincoli di bilancio. */
function rivalClubsFor(state: CareerState, world: CareerWorld): RivalClubInfo[] {
  if (!world.market) return [];
  return Object.values(world.market.clubs)
    .filter((c) => c.id !== state.clubId)
    .slice(0, 24)
    .map((club) => {
      const undici = club.startingEleven ?? [];
      const media = undici.length > 0 ? undici.reduce((s, o) => s + o, 0) / undici.length : 72;
      const prestigio = world.market?.valuation.clubPrestige[club.id] ?? 3;
      return {
        clubId: club.id,
        clubName: club.name,
        prestige: prestigio,
        // Il margine di un club IA scala col prestigio: chi è grande può offrire di più.
        wageRoom: Math.round(600_000 * prestigio * (0.8 + media / 100)),
        // `MarketClub` non espone la composizione per reparto: si usa il segnale che ha, cioè
        // quanto è corto il suo undici, e si considerano scoperti i reparti di movimento.
        needs:
          undici.length < 11
            ? (["POR", "DIF", "CC", "ATT"] as Department[])
            : (["DIF", "CC", "ATT"] as Department[]),
        elevenAverage: media,
      } satisfies RivalClubInfo;
    });
}

export interface FreeAgentSigningResult {
  state: CareerState;
  ok: boolean;
  message: string;
  rivalClubName?: string;
}

/**
 * Prova a tesserare uno svincolato.
 *
 * Non basta offrire: il giocatore confronta la nostra proposta con quelle dei club rivali **sulla
 * sua scala di priorità**, ed è qui che una piccola può battere una grande offrendo il campo
 * invece dei soldi. La titolarità promessa diventa subito un impegno verificato: il colpo a zero
 * è anche un debito.
 */
export function signFreeAgent(
  state: CareerState,
  world: CareerWorld,
  agentId: string,
  offer: { wage: number; seasons: number; guaranteedStarter?: boolean; captain?: boolean },
): FreeAgentSigningResult {
  const agente = freeAgentMarket(state, world).find((a) => a.id === agentId);
  if (!agente) return { state, ok: false, message: "Non è più disponibile." };

  const finanze = financesOf(state, world);
  if (offer.wage > finanze.wageRoom) {
    return {
      state,
      ok: false,
      message: `Margine ingaggi insufficiente: ${formatWage(offer.wage)} contro ${formatEuro(finanze.wageRoom)} disponibili.`,
    };
  }

  const nostra: FreeAgentBid = {
    clubId: state.clubId,
    clubName: world.clubName,
    prestige: world.market?.valuation.clubPrestige[state.clubId] ?? 3,
    wage: offer.wage,
    seasons: offer.seasons,
    guaranteedStarter: offer.guaranteedStarter ?? false,
    captain: offer.captain ?? false,
    ambitionTarget: state.seasonObjective?.targetPosition,
  };
  const rivali = rivalBidsFor(agente, rivalClubsFor(state, world), state.seed, state.season);
  const verdetto = resolveFreeAgentBids(agente, nostra, rivali, state.seed, state.season);

  if (!verdetto.accepted) {
    return { state, ok: false, message: verdetto.message, rivalClubName: verdetto.rivalClubName };
  }

  const entry: RosterEntry = {
    playerId: agente.id,
    overall: agente.overall,
    potential: Math.max(agente.overall, agente.baseOverall + (agente.age <= 22 ? 8 : 2)),
    sinceSeason: state.season,
    morale: 72,
    injuryMatchdaysLeft: 0,
    fatigue: 0,
    stats: emptySeasonStats(),
  };

  let next: CareerState = {
    ...state,
    roster: [...state.roster, entry],
    freeAgentsSigned: [...(state.freeAgentsSigned ?? []), agente.id],
    sessionDeals: [
      ...(state.sessionDeals ?? []),
      { playerId: agente.id, playerName: agente.name, kind: "acquisto" as const, amount: 0 },
    ],
  };
  next = withContractOverride(next, agente.id, {
    until: state.season + offer.seasons - 1,
    wage: offer.wage,
    signedSeason: state.season,
  });
  // Se il regen non esiste nel pool reale, va conservato: è l'unica cosa non derivabile.
  if (agente.origin === "regen" && !next.generated.some((g) => g.id === agente.id)) {
    next = {
      ...next,
      generated: [
        ...next.generated,
        {
          id: agente.id,
          name: agente.name,
          nation: agente.nation,
          role: agente.role,
          secondaryRoles: agente.secondaryRoles,
          birthDate: agente.birthDate ?? birthDateFromAge(agente.age, state.season),
          overall: agente.overall,
          potential: entry.potential,
          origin: "regen",
        },
      ],
    };
  }
  if (offer.guaranteedStarter) {
    next = setGuaranteedStarter(next, agente.role, agente.id);
    next = {
      ...next,
      commitments: [
        ...(next.commitments ?? []),
        makeCommitment("clausola_titolarita", {
          playerId: agente.id,
          verifyAt: "matchday",
          deadline: state.league.round + 6,
          payload: { minStarts: 3 },
          madeSeason: state.season,
          madeWeek: state.league.round,
          description: `Titolarità sottoscritta alla firma di ${agente.name}`,
        }),
      ],
    };
  }
  if (offer.captain) next = { ...next, captainId: agente.id };

  return {
    state: next,
    ok: true,
    message: `${agente.name} firma a parametro zero: ${formatWage(offer.wage)} per ${offer.seasons} ${offer.seasons === 1 ? "anno" : "anni"}.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Il contratto dell'allenatore                                                */
/* -------------------------------------------------------------------------- */

/** Stagioni residue del contratto del mister, contando quella in corso. */
export function coachContractSeasonsLeft(state: CareerState): number {
  return coachSeasonsLeft(state.coachContract, state.season);
}

/** Quanto costa oggi liberarsi del mister: cala man mano che il contratto si consuma. */
export function coachSeveranceNow(state: CareerState, world: CareerWorld): number {
  const coach = state.coachId ? findCoach(state.coachId) : undefined;
  if (!coach) return 0;
  return severanceCost(coach, state.league.round, world.leagueRounds, state.coachContract, state.season);
}

/**
 * Firma il contratto col mister: durata in stagioni, ingaggio annuo dentro il monte.
 *
 * Il costo che si paga **subito** dalla cassa mercato è la sola buonuscita del predecessore; lo
 * stipendio del nuovo pesa sulla cassa ingaggi, anno dopo anno. È la distinzione che rende un
 * contratto lungo una scelta e non un dettaglio: costa meno all'anno, ma ti lega.
 */
export function signCoachContract(
  state: CareerState,
  world: CareerWorld,
  coachId: string,
  seasons: number,
  promises?: CoachPromise[],
): { state: CareerState; ok: boolean; message: string } {
  const coach = findCoach(coachId);
  if (!coach) return { state, ok: false, message: "Allenatore non disponibile." };

  const contratto = makeCoachContract(coach, seasons, state.season);
  const finanze = financesOf(state, world);
  const spazio = finanze.wageRoom + (state.coachContract?.wage ?? 0);
  if (contratto.wage > spazio) {
    return {
      state,
      ok: false,
      message: `Il monte ingaggi non regge ${formatWage(contratto.wage)}: ne restano ${formatEuro(spazio)}.`,
    };
  }

  const uscente = state.coachId ? findCoach(state.coachId) : undefined;
  const buonuscita =
    uscente && uscente.id !== coach.id ? coachSeveranceNow(state, world) : 0;
  const penale =
    uscente?.id === coach.id
      ? 0
      : coach.isFreeAgent
        ? 0
        : computeCoachBuyoutFee(coach, 2);

  if (buonuscita + penale > state.budget) {
    return {
      state,
      ok: false,
      message: `Servono ${formatEuro(buonuscita + penale)} fra buonuscita e penale: la cassa mercato non basta.`,
    };
  }

  const cambio = state.coachId !== coach.id;
  return {
    state: {
      ...state,
      coachId: coach.id,
      coachContract: contratto,
      budget: state.budget - buonuscita - penale,
      coachPromises: promises ?? (cambio ? [] : state.coachPromises),
      coachHarmony: cambio ? 80 : (state.coachHarmony ?? 80),
      guaranteedStarters: cambio ? {} : state.guaranteedStarters,
      coachBenched: cambio ? {} : state.coachBenched,
    },
    ok: true,
    message: `${coach.name}: ${formatContractTotal(contratto.wage, seasons)}${penale > 0 ? ` · penale ${formatEuro(penale)}` : ""}.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Verifica degli impegni                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Verifica gli impegni scaduti e applica le conseguenze.
 *
 * Un solo punto per tutte le promesse — minuti, rinforzi, trionfi, clausole, impegni col mister —
 * invece dei tre canali separati di prima.
 */
export function settleCommitments(
  state: CareerState,
  world: CareerWorld,
  when: CommitmentWhen,
  startersIds: ReadonlySet<string>,
): { state: CareerState; messages: string[] } {
  const impegni = state.commitments ?? [];
  if (impegni.length === 0) return { state, messages: [] };

  const anagrafica = careerPlayers(state, world);
  const posizione =
    state.league.round > 0
      ? (buildStandings(rebuildLeagueState(state, world), 0).find((r) => r.isUser)?.position ?? null)
      : null;

  const esito = verifyCommitments(impegni, when, {
    season: state.season,
    matchday: state.league.round,
    roster: state.roster,
    startersIds,
    departmentOf: (id) => anagrafica[id]?.department,
    nameOf: (id) => anagrafica[id]?.name ?? "Il giocatore",
    leaguePosition: posizione,
    leagueSize: world.opponents.length + 1,
    captainId: state.captainId,
  });

  let next: CareerState = { ...state, commitments: esito.open };

  if (Object.keys(esito.moraleDelta).length > 0) {
    next = {
      ...next,
      roster: next.roster.map((e) =>
        esito.moraleDelta[e.playerId] !== undefined
          ? { ...e, morale: clampMorale(e.morale + esito.moraleDelta[e.playerId]!) }
          : e,
      ),
    };
  }

  for (const [id, delta] of Object.entries(esito.trustDelta)) {
    next = withTrust(next, id, delta);
  }
  for (const rotto of esito.broken) {
    if (!rotto.playerId) continue;
    const attuale = next.relationships?.[rotto.playerId] ?? { trust: DEFAULT_TRUST };
    next = {
      ...next,
      relationships: {
        ...(next.relationships ?? {}),
        [rotto.playerId]: { ...attuale, brokenCount: (attuale.brokenCount ?? 0) + 1 },
      },
    };
  }
  for (const tenuto of esito.kept) {
    if (!tenuto.playerId) continue;
    const attuale = next.relationships?.[tenuto.playerId] ?? { trust: DEFAULT_TRUST };
    next = {
      ...next,
      relationships: {
        ...(next.relationships ?? {}),
        [tenuto.playerId]: { ...attuale, keptCount: (attuale.keptCount ?? 0) + 1 },
      },
    };
  }
  if (esito.harmonyDelta !== 0) {
    next = { ...next, coachHarmony: Math.max(0, Math.min(100, (next.coachHarmony ?? 50) + esito.harmonyDelta)) };
  }

  return { state: next, messages: esito.messages };
}

/**
 * Fine stagione: i contratti scadono, i precontratti si eseguono, il mister può restare senza.
 *
 * È il momento in cui il sistema contratti presenta il conto: chi non è stato rinnovato **se ne va
 * a parametro zero**, ed è la punizione che dà senso a tutte le conversazioni dell'anno.
 */
export function expireContracts(
  state: CareerState,
  world: CareerWorld,
): { state: CareerState; messages: string[]; departed: string[] } {
  const messages: string[] = [];
  const departed: string[] = [];
  const anagrafica = careerPlayers(state, world);
  const base = emptyContracts(state);

  const rimasti: RosterEntry[] = [];
  const inScadenza: RosterEntry[] = [];
  for (const entry of state.roster) {
    const contratto = contractFor(state, world, entry.playerId);
    if (seasonsLeftOf(contratto, state.season) > 1) {
      rimasti.push(entry);
      continue;
    }
    inScadenza.push(entry);
  }

  /**
   * **Nessuna rete di sicurezza** (decisione esplicita dell'utente).
   *
   * Chi non è stato rinnovato se ne va, punto: la società non rinnova d'ufficio per salvare un
   * direttore sportivo distratto. Se le uscite lasciano la rosa sotto gli undici schierabili, la
   * conseguenza non è un rattoppo ma **l'esonero** alla chiusura del mercato successivo
   * (`checkSquadViability`). Tenere una rosa in piedi è il mestiere, non un servizio del club.
   */
  for (const entry of inScadenza) {
    const nome = anagrafica[entry.playerId]?.name ?? "Un giocatore";
    const pre = base.preContracts.find((p) => p.playerId === entry.playerId);
    departed.push(entry.playerId);
    messages.push(
      pre
        ? `${nome} lascia il club a parametro zero: va al ${pre.clubName}.`
        : `${nome} lascia il club a parametro zero: contratto scaduto e non rinnovato.`,
    );
  }

  let next: CareerState = {
    ...state,
    roster: rimasti,
    contracts: { ...base, preContracts: [], renewalRefused: [] },
  };

  // Il mister a contratto scaduto se ne va: perdere un buon tecnico per distrazione dev'essere
  // possibile quanto perdere un giocatore.
  if (state.coachContract && coachSeasonsLeft(state.coachContract, state.season) <= 1) {
    const coach = state.coachId ? findCoach(state.coachId) : undefined;
    if (coach) messages.push(`${coach.name} è a fine contratto: va rinnovato o lascia la panchina.`);
    next = { ...next, seasonNegotiationDone: false };
  }

  return { state: next, messages, departed };
}

/* -------------------------------------------------------------------------- */
/* La fascia di capitano                                                       */
/* -------------------------------------------------------------------------- */

/** Le candidature alla fascia, dalla più forte alla più debole. */
export function squadCaptaincyClaims(state: CareerState, world: CareerWorld): CaptaincyClaim[] {
  const anagrafica = careerPlayers(state, world);
  const media = averageOverall(state.roster);
  const giornate = Math.max(1, state.league.round);

  return captaincyClaims(
    state.roster
      .filter((e) => !e.loan?.hostClubId)
      .map((entry) => {
        const info = anagrafica[entry.playerId];
        const eta = ageInSeason(info?.birthDate, state.season) ?? 26;
        const disponibili = Math.max(0, giornate - Math.min(giornate, entry.injuryMatchdaysLeft)) * 90;
        return {
          entry,
          age: eta,
          seasonsAtClub: Math.max(0, state.season - entry.sinceSeason),
          squadAverage: media,
          playedShare: disponibili > 0 ? Math.min(1, entry.stats.minutes / disponibili) : 0,
          personality: derivePlayerPersonality(
            entry.playerId,
            eta,
            entry.overall,
            entry.sinceSeason,
            state.season,
          ),
        };
      }),
  );
}

/**
 * Il capitano attuale.
 *
 * **La sceglie il mister**, e se nessuno l'ha ancora scelta la funzione la deriva: così un
 * salvataggio vecchio (o una carriera appena iniziata) ha comunque un capitano credibile senza
 * bisogno di una migrazione. Se il designato non è più in rosa, la fascia torna libera.
 */
export function captainOf(state: CareerState, world: CareerWorld): string | null {
  if (state.captainId && state.roster.some((e) => e.playerId === state.captainId)) {
    return state.captainId;
  }
  const inRosa = new Set(
    state.roster.filter((e) => !e.loan?.hostClubId && e.injuryMatchdaysLeft === 0).map((e) => e.playerId),
  );
  return coachCaptainPick(squadCaptaincyClaims(state, world), (id) => inRosa.has(id));
}

/** Assegna la fascia derivata dal mister, se manca: si chiama all'apertura di una finestra. */
export function ensureCaptain(state: CareerState, world: CareerWorld): CareerState {
  if (state.captainId && state.roster.some((e) => e.playerId === state.captainId)) return state;
  const scelto = captainOf(state, world);
  return scelto ? { ...state, captainId: scelto } : state;
}

export interface CaptaincyProposalResult {
  state: CareerState;
  ok: boolean;
  /** La risposta del **mister**, non un messaggio di sistema. */
  message: string;
  /** Chi ha perso la fascia: va sentito, e può finire male. */
  ousted?: string;
}

/**
 * Il DS propone al mister di spostare la fascia.
 *
 * Tre conseguenze, tutte volute:
 *  - il mister può **dire di no**, e insistere non è possibile: la fascia è roba sua;
 *  - chi la riceve guadagna morale, e se gliel'avevamo promessa l'impegno si chiude;
 *  - chi la perde **crolla** ed entra in `captaincyLost`, che apre il tema più duro del catalogo
 *    (`fascia_tolta`, bloccante): può finire in rottura totale.
 */
export function proposeCaptain(
  state: CareerState,
  world: CareerWorld,
  playerId: string,
): CaptaincyProposalResult {
  const entry = state.roster.find((e) => e.playerId === playerId);
  if (!entry) return { state, ok: false, message: "Non fa parte della rosa." };

  const attuale = captainOf(state, world);
  if (attuale === playerId) return { state, ok: false, message: "Porta già lui la fascia." };

  const claims = squadCaptaincyClaims(state, world);
  const verdetto = evaluateCaptaincyChange(
    claims.find((c) => c.playerId === playerId),
    attuale ? claims.find((c) => c.playerId === attuale) : undefined,
    state.coachHarmony ?? 50,
  );

  if (!verdetto.approved) {
    return {
      state:
        verdetto.harmonyCost > 0
          ? { ...state, coachHarmony: Math.max(0, (state.coachHarmony ?? 50) - verdetto.harmonyCost) }
          : state,
      ok: false,
      message: verdetto.message,
    };
  }

  let next: CareerState = { ...state, captainId: playerId };
  next = withMorale(next, playerId, CAPTAIN_GAINED_MORALE);
  next = withTrust(next, playerId, 8);

  if (attuale) {
    next = withMorale(next, attuale, CAPTAIN_LOST_MORALE);
    next = withTrust(next, attuale, -20);
    next = { ...next, captaincyLost: [...(next.captaincyLost ?? []), attuale] };
  }

  return { state: next, ok: true, message: verdetto.message, ousted: attuale ?? undefined };
}

/**
 * Chiude il caso di chi si è visto togliere la fascia.
 *
 * Il flag resta finché quel giocatore non è stato **sentito**: senza, il tema bloccante
 * ricomparirebbe a ogni giornata anche dopo averlo affrontato.
 */
export function clearCaptaincyGrudge(state: CareerState, playerId: string): CareerState {
  const elenco = state.captaincyLost ?? [];
  if (!elenco.includes(playerId)) return state;
  return { ...state, captaincyLost: elenco.filter((id) => id !== playerId) };
}
