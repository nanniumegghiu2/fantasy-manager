/**
 * **I fatti**: cosa è vero, adesso, di un giocatore.
 *
 * È il livello che prima non esisteva, ed è la ragione per cui il sistema conversazioni sbagliava
 * argomento. `openPlayerStandoff` sceglieva il motivo con tre `if` e un fallback generico
 * (`"scontento"`), e per quel motivo la richiesta di default era *"conferma il mio ruolo da
 * titolare"*: un titolare inamovibile con il morale basso per la classifica apriva la chat
 * chiedendo di giocare. Il difetto non era il testo — era che **nessuno guardava quanto giocasse
 * prima di decidere di cosa parlare**.
 *
 * Da qui in poi ogni conversazione parte da questa struttura, e un tema che non trova i suoi
 * fatti non può aprirsi (`playerTopics.ts`).
 *
 * Modulo **puro**: nessun import da `career.ts` (che invece importa questo), nessuna scrittura.
 */
import { ROLE_DEPARTMENT, type Department, type Role } from "@app/shared-types";
import type { Commitment } from "./commitments";
import type { Contract, ContractStatus } from "./contracts";
import { contractStatus, seasonsLeftOf } from "./contracts";
import { captaincyClaimOf, CAPTAIN_DESIRE_THRESHOLD, type CaptaincyClaim } from "./captaincy";
import type { PlayerPersonality, RosterEntry } from "./types";
import { derivePlayerPersonality } from "./types";

export interface RelationshipState {
  /** 0-100: quanto crede alla nostra parola. Persiste **fra** le conversazioni. */
  trust: number;
  /** Rapporto rotto e non ricomposto. */
  feud?: true;
  brokenCount?: number;
  keptCount?: number;
  lastTalkedWeek?: number;
  /**
   * La stagione in cui è avvenuta l'ultima conversazione.
   *
   * Senza, la tregua si rompeva da sola al cambio di stagione: `league.round` riparte da zero,
   * quindi `round - lastTalkedWeek` diventava negativo e, azzerato dal `Math.max(0, …)`, faceva
   * sembrare che avessimo parlato *proprio adesso* con tutta la rosa. Con la soppressione del
   * tema (sotto) quel difetto latente sarebbe diventato "nessuno parla più per un'intera
   * stagione": la stagione va confrontata, non dedotta.
   */
  lastTalkedSeason?: number;
  /**
   * Di **cosa** si è parlato l'ultima volta.
   *
   * È la chiave della tregua: un argomento già affrontato non si riapre subito, mentre un
   * argomento nuovo e più grave (un precontratto comparso ieri) deve poter passare comunque.
   */
  lastTopicId?: string;
}

export const DEFAULT_TRUST = 50;

export interface PlayerFacts {
  playerId: string;
  name: string;
  role: Role;
  secondaryRoles: Role[];
  department: Department;
  age: number;
  overall: number;
  potential: number;
  marketValue: number;

  /* — impiego — */
  /** Minuti giocati sui minuti **realmente disponibili** (al netto degli infortuni). */
  playedShare: number;
  appearances: number;
  matchdaysAvailable: number;
  lastSeasonPlayedShare?: number;
  isGuaranteedStarter: boolean;
  isCoachBenched: boolean;
  isCoachUntouchable: boolean;
  isCaptain: boolean;
  /** Quanto aspira alla fascia, e perché (bandiera o leader tecnico). */
  captaincy: CaptaincyClaim;
  /** Sopra la soglia: la vuole, e se non ce l'ha se ne lamenta. */
  wantsCaptaincy: boolean;
  /** Gliel'hanno tolta: è l'innesco del faccia a faccia più duro che ci sia. */
  lostCaptaincy: boolean;
  /** Il miglior compagno che gli contende la casella. `-1` se non ne ha. */
  bestRivalOverallInRole: number;
  /** Quanti compagni sani coprono il suo ruolo, lui escluso. */
  depthInRole: number;

  /* — rendimento — */
  goals: number;
  assists: number;
  per90: number;
  /** Rendimento rispetto a quanto ci si aspetterebbe dal suo livello, in punti. */
  overUnderPerformance: number;

  /* — squadra — */
  squadAverage: number;
  positionsBelowTarget: number;

  /* — carriera — */
  seasonsAtClub: number;
  arrivedThisSeason: boolean;

  /* — stato — */
  morale: number;
  fatigue: number;
  injuryMatchdaysLeft: number;
  onLoanOut: boolean;

  /* — mercato — */
  incomingOffer?: { clubId: string; clubName: string; fee: number; prestige: number; kind: "trasferimento" | "prestito" };
  isOnTransferList: boolean;
  isOnLoanList: boolean;
  keyTeammateSold?: { playerId: string; name: string };

  /* — contratto — */
  contract: Contract | null;
  contractStatus: ContractStatus;
  seasonsLeft: number;
  wage: number;
  /** Rapporto fra il suo ingaggio e quello mediano di chi in rosa ha il suo livello. <1 = sottopagato. */
  wageVsPeers: number;
  /** Margine della cassa ingaggi: decide **quali mosse economiche sono possibili**. */
  wageRoomLeft: number;
  preContractSuitor?: { clubId: string; clubName: string; prestige: number };
  renewalRefused: boolean;

  /* — rapporto — */
  trust: number;
  isFeuding: boolean;
  brokenCommitments: number;
  keptCommitments: number;
  openCommitments: Commitment[];
  lastTalkedWeek?: number;
  weeksSinceLastTalk: number;
  /** Il tema dell'ultima conversazione chiusa, per la tregua di `playerTopics.ts`. */
  lastTopicId?: string;

  /* — mister — */
  coachHarmony: number;
  personality: PlayerPersonality;
}

export interface PlayerFactsInput {
  entry: RosterEntry;
  player: {
    id: string;
    name: string;
    role: Role;
    secondaryRoles: Role[];
    birthDate?: string | null;
  };
  age: number;
  season: number;
  /** Giornate di campionato già giocate. */
  matchday: number;
  squadAverage: number;
  marketValue: number;
  roster: readonly RosterEntry[];
  /** Ruolo e ruoli secondari dei compagni, per calcolare concorrenza e profondità. */
  roleOf: (playerId: string) => { role: Role; secondaryRoles: Role[] } | undefined;

  contract: Contract | null;
  wageVsPeers: number;
  wageRoomLeft: number;
  preContractSuitor?: PlayerFacts["preContractSuitor"];
  renewalRefused?: boolean;
  winterWindowOpen?: boolean;

  guaranteedStarters?: Record<string, string>;
  coachBenched?: Record<string, true>;
  coachUntouchables?: readonly string[];
  captainId?: string;
  coachHarmony?: number;
  positionsBelowTarget?: number;

  incomingOffer?: PlayerFacts["incomingOffer"];
  isOnTransferList?: boolean;
  isOnLoanList?: boolean;
  keyTeammateSold?: PlayerFacts["keyTeammateSold"];

  relationship?: RelationshipState;
  /** Gli è stata tolta la fascia di recente (career.ts la registra alla revoca). */
  lostCaptaincy?: boolean;
  openCommitments?: readonly Commitment[];
  currentWeek?: number;
}

/**
 * Costruisce i fatti di un giocatore.
 *
 * Due scelte non ovvie, entrambe pensate contro un falso positivo preciso:
 *
 *  - **i minuti si normalizzano per gli infortuni**. Chi è stato fuori dieci giornate non ha
 *    "giocato poco per scelta del mister": senza questa correzione ogni infortunato lungo
 *    aprirebbe un caso di minutaggio, che è il rumore peggiore possibile in uno spogliatoio;
 *  - **il rivale nel ruolo è quello vero**, calcolato sulla rosa. Il vecchio sistema passava
 *    `starterOverallInRole: 76`, una costante scritta a mano (`career.ts`), quindi il mister
 *    accettava o rifiutava la titolarità senza guardare chi avesse davvero in quella casella.
 */
export function buildPlayerFacts(input: PlayerFactsInput): PlayerFacts {
  const { entry, player, roster, roleOf } = input;

  /**
   * ⚠️ **Le giornate disponibili si contano da quando è arrivato, non dall'inizio della
   * stagione.**
   *
   * Il difetto segnalato dall'utente: un giocatore appena comprato apriva subito una
   * conversazione per chiedere minutaggio, *senza aver giocato un solo minuto con la squadra*.
   * La causa è aritmetica — chi arriva nel mercato di riparazione trova `matchday` già a
   * diciannove, quindi la soglia "ha avuto abbastanza occasioni" risultava superata il giorno
   * stesso della firma, e la sua quota di minuti era zero perché il campionato era cominciato
   * senza di lui.
   *
   * `arrivedThisSeason` copriva un solo tema (`poco_impiego`) e comunque non bastava: un
   * acquisto estivo alla seconda giornata ha davvero giocato poco, ma non ha ancora avuto
   * nessuna occasione. La correzione va qui, nei **fatti**, così vale per ogni tema che li legge
   * senza doversene ricordare uno per uno.
   *
   * Le giornate da cui si conta sono quelle dopo l'arrivo: chi è nella squadra da inizio anno
   * non cambia di nulla, chi è arrivato a gennaio parte da zero e matura il diritto di
   * lamentarsi giocando — o non giocando — le giornate successive.
   */
  const giornateDallArrivo = entry.sinceSeason === input.season
    ? Math.max(0, input.matchday - (entry.joinedAtMatchday ?? 0))
    : input.matchday;
  const giornateSaltate = Math.min(giornateDallArrivo, entry.injuryMatchdaysLeft);
  const matchdaysAvailable = Math.max(0, giornateDallArrivo - giornateSaltate);
  const minutiDisponibili = matchdaysAvailable * 90;
  const playedShare = minutiDisponibili > 0 ? Math.min(1, entry.stats.minutes / minutiDisponibili) : 0;

  const lastSeasonPlayedShare = entry.lastSeasonStats
    ? Math.min(1, entry.lastSeasonStats.minutes / (38 * 90))
    : undefined;

  const copronoIlRuolo = roster.filter((altro) => {
    if (altro.playerId === entry.playerId) return false;
    if (altro.loan?.hostClubId) return false;
    if (altro.injuryMatchdaysLeft > 0) return false;
    const r = roleOf(altro.playerId);
    if (!r) return false;
    return r.role === player.role || r.secondaryRoles.includes(player.role);
  });

  const bestRivalOverallInRole = copronoIlRuolo.reduce((max, e) => Math.max(max, e.overall), -1);

  const per90 =
    entry.stats.minutes > 0 ? ((entry.stats.goals + entry.stats.assists) * 90) / entry.stats.minutes : 0;
  // Attesa grezza per il suo livello: un 85 deve incidere più di un 70. Serve solo a dire "sta
  // rendendo sopra o sotto", non a valutarlo in assoluto.
  const attesa = Math.max(0, (entry.overall - 68) / 55);
  const overUnderPerformance = entry.stats.minutes >= 270 ? Math.round((per90 - attesa) * 40) : 0;

  const personality = derivePlayerPersonality(
    entry.playerId,
    input.age,
    entry.overall,
    entry.sinceSeason,
    input.season,
  );
  const captaincy = captaincyClaimOf({
    entry,
    age: input.age,
    seasonsAtClub: Math.max(0, input.season - entry.sinceSeason),
    squadAverage: input.squadAverage,
    playedShare,
    personality,
  });

  const rapporto = input.relationship;
  const settimana = input.currentWeek ?? input.matchday;

  const contract = input.contract;

  return {
    playerId: entry.playerId,
    name: player.name,
    role: player.role,
    secondaryRoles: player.secondaryRoles,
    department: ROLE_DEPARTMENT[player.role],
    age: input.age,
    overall: entry.overall,
    potential: entry.potential,
    marketValue: input.marketValue,

    playedShare,
    appearances: entry.stats.appearances,
    matchdaysAvailable,
    lastSeasonPlayedShare,
    isGuaranteedStarter: Object.values(input.guaranteedStarters ?? {}).includes(entry.playerId),
    isCoachBenched: input.coachBenched?.[entry.playerId] === true,
    isCoachUntouchable: (input.coachUntouchables ?? []).includes(entry.playerId),
    isCaptain: input.captainId === entry.playerId,
    captaincy,
    wantsCaptaincy: captaincy.score >= CAPTAIN_DESIRE_THRESHOLD && input.captainId !== entry.playerId,
    lostCaptaincy: input.lostCaptaincy ?? false,
    bestRivalOverallInRole,
    depthInRole: copronoIlRuolo.length,

    goals: entry.stats.goals,
    assists: entry.stats.assists,
    per90,
    overUnderPerformance,

    squadAverage: input.squadAverage,
    positionsBelowTarget: input.positionsBelowTarget ?? 0,

    seasonsAtClub: Math.max(0, input.season - entry.sinceSeason),
    arrivedThisSeason: entry.sinceSeason === input.season,

    morale: entry.morale,
    fatigue: entry.fatigue,
    injuryMatchdaysLeft: entry.injuryMatchdaysLeft,
    onLoanOut: !!entry.loan?.hostClubId,

    incomingOffer: input.incomingOffer,
    isOnTransferList: input.isOnTransferList ?? false,
    isOnLoanList: input.isOnLoanList ?? false,
    keyTeammateSold: input.keyTeammateSold,

    contract,
    contractStatus: contractStatus(contract, input.season, input.winterWindowOpen),
    seasonsLeft: seasonsLeftOf(contract, input.season),
    wage: contract?.wage ?? 0,
    wageVsPeers: input.wageVsPeers,
    wageRoomLeft: input.wageRoomLeft,
    preContractSuitor: input.preContractSuitor,
    renewalRefused: input.renewalRefused ?? false,

    trust: rapporto?.trust ?? DEFAULT_TRUST,
    isFeuding: rapporto?.feud === true,
    brokenCommitments: rapporto?.brokenCount ?? 0,
    keptCommitments: rapporto?.keptCount ?? 0,
    openCommitments: [...(input.openCommitments ?? [])],
    lastTalkedWeek: rapporto?.lastTalkedWeek,
    // Una conversazione di **un'altra stagione** è acqua passata: confrontare i soli numeri di
    // giornata direbbe "ne abbiamo appena parlato" a ogni inizio d'anno.
    weeksSinceLastTalk:
      rapporto?.lastTalkedWeek === undefined ||
      (rapporto.lastTalkedSeason !== undefined && rapporto.lastTalkedSeason !== input.season)
        ? Infinity
        : Math.max(0, settimana - rapporto.lastTalkedWeek),
    lastTopicId: rapporto?.lastTopicId,

    coachHarmony: input.coachHarmony ?? 50,
    personality,
  };
}
