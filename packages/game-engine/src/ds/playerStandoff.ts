/**
 * **Il faccia a faccia col giocatore.**
 *
 * Prima l'unico modo di intervenire sul malcontento era una scelta secca a un turno solo
 * (`playerTalks.ts`) o aspettare la richiesta throttled del motore (`events.ts`,
 * `pendingRequest`). Richiesta esplicita dell'utente: una vera trattativa, con la **stessa
 * tensione** delle trattative di mercato (`negotiation.ts`) — una barra di pazienza che si
 * consuma, e che porta o alla riappacificazione o alla rottura totale.
 */
import type { Department } from "@app/shared-types";
import type { PlayerPersonality, RosterEntry, SeasonStats } from "./types";
import { derivePlayerPersonality } from "./types";

export type StandoffReason = "vuole_giocare" | "scontento" | "richiamato" | "tradito" | "bivio_mister";

/** Sotto questa soglia di morale un giocatore è candidato al faccia a faccia. */
export const STANDOFF_MORALE_THRESHOLD = 55;

/** Cosa si è promesso, oltre alla titolarità (`minutesPromises`, già gestita altrove). */
export type PlayerPromiseKind = "rinforzi" | "trionfo";

/** Una promessa in sospeso fatta a un giocatore: verificata a fine mercato (career.ts). */
export interface PlayerPromiseRecord {
  kind: PlayerPromiseKind;
  /** Solo per "rinforzi": in che reparto si è promesso un innesto. */
  department?: Department;
  madeSeason: number;
}

export interface StandoffMessage {
  speaker: "giocatore" | "ds";
  text: string;
}

/** Dettagli dell'offerta di mercato quando il calciatore è tentato da un altro club. */
export interface PlayerStandoffOfferDetails {
  clubId: string;
  clubName: string;
  amount: number;
  kind: "trasferimento" | "prestito";
}

/** Richiesta esplicita formulata dal calciatore per convincerlo a restare. */
export type PlayerDemandKind =
  | "adeguamento_economico"
  | "garanzia_titolarita"
  | "promessa_rinforzo"
  | "cessione_irrevocabile";

export interface PlayerDemand {
  kind: PlayerDemandKind;
  description: string;
  department?: Department;
  amount?: number;
}

export interface PlayerStandoff {
  playerId: string;
  playerName: string;
  reason: StandoffReason;
  /** 0-100: quanto regge ancora questa conversazione prima di rompersi o chiudersi bene. */
  patience: number;
  status: "aperta" | "placata" | "rotta";
  log: StandoffMessage[];
  /** Se c'è un'offerta di mercato per lui, il club offerente. */
  offerFromClubId?: string;
  offerFromClubName?: string;
  offerDetails?: PlayerStandoffOfferDetails;
  personality?: PlayerPersonality;
  demand?: PlayerDemand;
  overall?: number;
  marketValue?: number;
  round: number;
  /** L'ultima mossa scelta: serve a riconoscere chi ripete la stessa proposta di fila. */
  lastMoveKind?: StandoffMove["kind"];
  /** Quante volte di fila è stata scelta la stessa mossa (0 = l'ultima è stata diversa). */
  sameMoveStreak: number;
}

export type StandoffMove =
  | { kind: "rassicura" }
  | { kind: "prometti_spazio" }
  | { kind: "premio_denaro" }
  | { kind: "promessa_rinforzi"; department: Department }
  | { kind: "promessa_trionfo" }
  | { kind: "lista_cessione" }
  | { kind: "accetta_cessione" }
  | { kind: "concedi_prestito" }
  | { kind: "prometti_trattativa_cessione" }
  | { kind: "scegli_giocatore" }
  | { kind: "scegli_mister" }
  | { kind: "multa_disciplina" }
  | { kind: "ignora" };

const REASON_OPEN: Record<StandoffReason, string> = {
  vuole_giocare: "Non se ne parla più: o gioco con continuità, o è meglio che io vada altrove.",
  scontento: "Qui dentro non sto bene, Direttore. Ho bisogno di sapere cosa pensate di fare con me.",
  richiamato: "C'è un club che mi vuole davvero. Voi cosa avete da dirmi per farmi restare?",
  tradito: "Mi avevate promesso una cosa precisa e non l'avete mantenuta. Perché dovrei ancora fidarmi di voi?",
  bivio_mister:
    "Direttore, non funziona più fra me e il mister. È lui o sono io: dovete scegliere, non potete tenerci entrambi contenti.",
};

const DEPARTMENT_IT: Record<Department, string> = {
  POR: "in porta",
  DIF: "in difesa",
  CC: "a centrocampo",
  ATT: "in attacco",
};

/** Formatta una cifra in euro per i dialoghi e i riquadri offerta. */
export function formatEuroAmount(amount: number): string {
  if (amount >= 1_000_000) {
    const mill = (amount / 1_000_000).toFixed(1).replace(".0", "");
    return `€ ${mill}M`;
  }
  return `€ ${Math.round(amount / 1_000).toLocaleString("it-IT")}k`;
}

export function derivePlayerDemand(
  reason: StandoffReason,
  entry: RosterEntry,
  personality: PlayerPersonality,
  marketValue: number,
  offer?: PlayerStandoffOfferDetails,
): PlayerDemand {
  if (reason === "bivio_mister" || reason === "tradito") {
    return {
      kind: "cessione_irrevocabile",
      description: "Non accetta compromessi: pretende la cessione o il licenziamento del mister.",
    };
  }

  if (reason === "richiamato") {
    if (personality === "mercenario") {
      const bonus = Math.max(300_000, Math.round(marketValue * 0.04));
      return {
        kind: "adeguamento_economico",
        amount: bonus,
        description: `Richiede un adeguamento economico di ${formatEuroAmount(bonus)} per rifiutare l'offerta del ${offer?.clubName ?? "club"}.`,
      };
    }
    if (personality === "giovane_ambizioso" || entry.morale < 35) {
      return {
        kind: "cessione_irrevocabile",
        description: `Pretende di essere ceduto al ${offer?.clubName ?? "club offerente"}. Accetta di attendere che trattiate la vendita sul mercato.`,
      };
    }
    return {
      kind: "garanzia_titolarita",
      description: "Pretende garanzie di titolarità dall'allenatore per restare al club.",
    };
  }

  if (reason === "vuole_giocare") {
    return {
      kind: "garanzia_titolarita",
      description: "Pretende lo spazio da titolare col mister o la cessione.",
    };
  }

  if (personality === "mercenario") {
    const bonus = Math.max(300_000, Math.round(marketValue * 0.04));
    return {
      kind: "adeguamento_economico",
      amount: bonus,
      description: `Richiede un premio/adeguamento di ${formatEuroAmount(bonus)} per ritrovare motivazioni.`,
    };
  }
  if (personality === "leader") {
    return {
      kind: "promessa_rinforzo",
      department: "ATT",
      description: "Richiede l'acquisto di un rinforzo nel reparto per alzare le ambizioni del club.",
    };
  }

  return {
    kind: "garanzia_titolarita",
    description: "Richiede la conferma del suo ruolo principale da titolare.",
  };
}

/** Genera la battuta d'apertura dinamica basata su dati reali del calciatore e dell'offerta. */
export function buildOpeningText(
  reason: StandoffReason,
  _playerName: string,
  offerDetails?: PlayerStandoffOfferDetails,
  personality?: PlayerPersonality,
  stats?: SeasonStats,
): string {
  if (reason === "richiamato" && offerDetails) {
    const importoStr = offerDetails.amount > 0 ? ` da ${formatEuroAmount(offerDetails.amount)}` : "";
    const operazioneStr = offerDetails.kind === "prestito" ? "in prestito" : "a titolo definitivo";
    return `Direttore, il ${offerDetails.clubName} ha presentato un'offerta ufficiale${importoStr} per prendermi ${operazioneStr}. Per la mia carriera è un'opportunità enorme, pretendete che la valutiate seriamente!`;
  }
  if (reason === "vuole_giocare" && stats) {
    if (stats.goals > 0) {
      return `Direttore, ho segnato ${stats.goals} gol in ${stats.appearances} presenze e continuo a marcire in panchina! O gioco o me ne vado.`;
    }
    if (stats.appearances > 0) {
      return `Ho solo ${stats.appearances} presenze in questa stagione. Ho bisogno di giocare con continuità o preferisco cambiare aria.`;
    }
  }
  if (reason === "scontento" && personality) {
    if (personality === "leader") {
      return `Sono uno dei senatori di questo gruppo, ma sento che la società non mi sta dando la considerazione che merito.`;
    }
    if (personality === "mercenario") {
      return `Il mio rendimento merita un adempimento economico adeguato. Altri compagni guadagnano più di me facendo meno.`;
    }
    if (personality === "giovane_ambizioso") {
      return `Ho bisogno di garanzie di crescita per il mio futuro. Qui rischia di fermarsi la mia carriera.`;
    }
  }
  return REASON_OPEN[reason];
}

/** Quali mosse hanno senso in questa conversazione per il motivo reale. */
export function relevantMoves(reason: StandoffReason): StandoffMove["kind"][] {
  switch (reason) {
    case "vuole_giocare":
      return ["rassicura", "prometti_spazio", "prometti_trattativa_cessione", "lista_cessione", "concedi_prestito", "multa_disciplina", "ignora"];
    case "scontento":
      return [
        "rassicura",
        "premio_denaro",
        "promessa_rinforzi",
        "promessa_trionfo",
        "prometti_trattativa_cessione",
        "lista_cessione",
        "multa_disciplina",
        "ignora",
      ];
    case "richiamato":
      return [
        "premio_denaro",
        "promessa_rinforzi",
        "promessa_trionfo",
        "prometti_trattativa_cessione",
        "accetta_cessione",
        "lista_cessione",
        "ignora",
      ];
    case "tradito":
      return ["premio_denaro", "rassicura", "prometti_trattativa_cessione", "lista_cessione", "concedi_prestito", "accetta_cessione", "multa_disciplina", "ignora"];
    case "bivio_mister":
      return ["scegli_giocatore", "scegli_mister", "ignora"];
  }
}

export function openStandoff(
  entry: RosterEntry,
  playerName: string,
  reason: StandoffReason,
  offer?: PlayerStandoffOfferDetails | { clubId: string; clubName: string },
  context?: {
    age?: number;
    currentSeason?: number;
    marketValue?: number;
  },
): PlayerStandoff {
  const fullOffer: PlayerStandoffOfferDetails | undefined =
    offer && "amount" in offer
      ? (offer as PlayerStandoffOfferDetails)
      : offer
        ? { clubId: offer.clubId, clubName: offer.clubName, amount: 0, kind: "trasferimento" }
        : undefined;

  const age = context?.age ?? 25;
  const currentSeason = context?.currentSeason ?? entry.sinceSeason;
  const personality = derivePlayerPersonality(entry.playerId, age, entry.overall, entry.sinceSeason, currentSeason);
  const marketVal = context?.marketValue ?? 5_000_000;

  const initialText = buildOpeningText(reason, playerName, fullOffer, personality, entry.stats);
  const demand = derivePlayerDemand(reason, entry, personality, marketVal, fullOffer);

  return {
    playerId: entry.playerId,
    playerName,
    reason,
    patience:
      reason === "tradito" || reason === "bivio_mister"
        ? Math.max(8, Math.min(20, entry.morale))
        : Math.max(25, Math.min(80, entry.morale)),
    status: "aperta",
    log: [{ speaker: "giocatore", text: initialText }],
    offerFromClubId: fullOffer?.clubId,
    offerFromClubName: fullOffer?.clubName,
    offerDetails: fullOffer,
    personality,
    demand,
    overall: entry.overall,
    marketValue: marketVal,
    round: 0,
    sameMoveStreak: 0,
  };
}

export interface CoachApprovalContext {
  coachHarmony?: number;
  starterOverallInRole?: number;
  playerOverall: number;
}

export function evaluateCoachApprovalForStarter(ctx: CoachApprovalContext): { approved: boolean; reason: string } {
  const diff = ctx.playerOverall - (ctx.starterOverallInRole ?? 75);
  const harmonyBonus = ((ctx.coachHarmony ?? 50) - 50) / 10;
  const score = diff + harmonyBonus;

  if (score >= -2) {
    return {
      approved: true,
      reason: "Il mister ha accettato: il calciatore entrerà tra i titolari garantiti.",
    };
  }
  return {
    approved: false,
    reason: "Il mister si oppone: per lui l'attuale titolare garantisce maggiore equilibrio tattico.",
  };
}

export interface StandoffMoveContext {
  currentBudget?: number;
  marketValue?: number;
  coachApprovalCtx?: CoachApprovalContext;
}

export interface StandoffOutcome {
  standoff: PlayerStandoff;
  moraleDelta: number;
  listForTransfer?: boolean;
  listForLoan?: boolean;
  promiseMinutes?: boolean;
  moneyBonus?: boolean;
  moneyBonusAmount?: number;
  moneyEarnedAmount?: number;
  coachApproved?: boolean;
  promise?: { kind: PlayerPromiseKind; department?: Department };
  sellNow?: boolean;
  coachResigns?: boolean;
  coachBenches?: boolean;
  errorMessage?: string;
}

export function applyStandoffMove(
  standoff: PlayerStandoff,
  move: StandoffMove,
  moveCtx?: StandoffMoveContext,
): StandoffOutcome {
  if (standoff.status !== "aperta") {
    return { standoff, moraleDelta: 0 };
  }

  const ripetuta = standoff.lastMoveKind === move.kind;
  const scambioInCorso = standoff.round >= 1;

  let perdita = 0;
  let moraleDelta = 0;
  let listForTransfer: boolean | undefined;
  let listForLoan: boolean | undefined;
  let promiseMinutes: boolean | undefined;
  let moneyBonus: boolean | undefined;
  let moneyBonusAmount: number | undefined;
  let moneyEarnedAmount: number | undefined;
  let coachApproved: boolean | undefined;
  let promise: StandoffOutcome["promise"];
  let sellNow: boolean | undefined;
  let dsText = "";
  let early = "";
  let mid = "";
  let closing = "";
  let rispostaSecca = "";
  let rispostaRipetuta = "";

  switch (move.kind) {
    case "rassicura":
      perdita = 22;
      moraleDelta = 10;
      dsText = "Ti meriti più fiducia da parte mia: da adesso qualcosa cambia.";
      early = "Sentiamo... ma le parole da sole non bastano ancora.";
      mid = "Ci credo un po' di più, Direttore, ma servono ancora fatti, non solo frasi.";
      closing = "Va bene, mi fido. Adesso voglio vederlo nei fatti.";
      rispostaRipetuta = "Me lo avete già detto, Direttore. Ripeterlo non lo rende più vero.";
      break;

    case "prometti_spazio": {
      const playerOv = standoff.overall ?? 75;
      const approval = evaluateCoachApprovalForStarter(
        moveCtx?.coachApprovalCtx ?? { playerOverall: playerOv, starterOverallInRole: 77, coachHarmony: 50 },
      );
      coachApproved = approval.approved;

      if (coachApproved) {
        perdita = 34;
        moraleDelta = 16;
        promiseMinutes = true;
        dsText = "Ho parlato col mister: ti garantiamo lo spazio da titolare d'ora in avanti.";
        early = "Un passo nella direzione giusta, ma voglio vederlo scritto nei fatti.";
        mid = "La promessa resta lì, Direttore. Aspetto ancora di vederla mantenuta in campo.";
        closing = "Questo sì che è un impegno vero. Aspetto di vederlo in campo.";
        rispostaRipetuta = "Un'altra promessa di minuti, la stessa di prima? Vediamo se stavolta conta.";
      } else {
        perdita = 45;
        moraleDelta = -20;
        promiseMinutes = false;
        dsText = "Ho chiesto al mister di darti spazio da titolare, ma non accetta ingerenze tattiche...";
        rispostaSecca = "Quindi il mister vi sbarra la strada e voi non contate niente? Non ho più nulla da dirvi!";
      }
      break;
    }

    case "premio_denaro": {
      const marketValue = standoff.marketValue ?? 5_000_000;
      const calculatedBonus = standoff.demand?.amount ?? Math.max(300_000, Math.round(marketValue * 0.04));

      if (moveCtx?.currentBudget !== undefined && moveCtx.currentBudget < calculatedBonus) {
        return {
          standoff: {
            ...standoff,
            log: [
              ...standoff.log,
              { speaker: "ds", text: "Volevo offrirti un premio in denaro, ma la società non ha abbastanza liquidità al momento." },
              { speaker: "giocatore", text: "Non ci sono neanche le risorse? La situazione è peggio del previsto." },
            ],
          },
          moraleDelta: -5,
          errorMessage: "Budget insufficiente per offrire questo premio.",
        };
      }

      perdita = standoff.reason === "richiamato" ? 18 : 28;
      moraleDelta = 20;
      moneyBonus = true;
      moneyBonusAmount = calculatedBonus;
      dsText = `Ecco un premio di ${formatEuroAmount(calculatedBonus)} per te subito: la società riconosce il tuo valore.`;
      early = "Un gesto concreto. Ma i soldi non risolvono tutto lo sapete.";
      mid = "Apprezzo l'adeguamento, Direttore. È un segnale importante.";
      closing = "Va bene, Direttore. Dimostrate che la società ci tiene.";
      rispostaRipetuta = "Un altro premio? Non sono in vendita a rate, Direttore: qui serve altro.";
      break;
    }

    case "promessa_rinforzi":
      perdita = 30;
      moraleDelta = 14;
      promise = { kind: "rinforzi", department: move.department };
      dsText = `Ti prometto un rinforzo vero ${DEPARTMENT_IT[move.department]}: alzeremo il livello del reparto.`;
      early = "Bello a dirsi. Vediamo se succede per davvero.";
      mid = "Ancora nessun rinforzo, Direttore. La promessa resta tutta da mantenere.";
      closing = "Bene. Aspetto di vederlo arrivare entro la fine del mercato.";
      rispostaRipetuta = "Mi avete già promesso un rinforzo. Ripeterlo non lo fa arrivare prima.";
      break;

    case "promessa_trionfo":
      perdita = 26;
      moraleDelta = 12;
      promise = { kind: "trionfo" };
      dsText = "Ti prometto che lotteremo per le posizioni di vertice quest'anno: fidati del progetto.";
      early = "Belle parole. Le prendo, ma resto con gli occhi aperti.";
      mid = "Continuate a dirmelo, Direttore. Sul campo però si vede ancora poco.";
      closing = "Va bene, ci sto. But non deludetemi: me lo ricorderò.";
      rispostaRipetuta = "Lo stesso discorso di prima, Direttore. Le parole le ho già sentite.";
      break;

    case "lista_cessione":
      perdita = 40;
      moraleDelta = 14;
      listForTransfer = true;
      dsText = "Ti metto in lista trasferimenti: se arriva l'offerta giusta, ti lascio andare.";
      rispostaSecca = "Era quello che volevo sentire. Grazie, Direttore.";
      break;

    case "concedi_prestito":
      perdita = 40;
      moraleDelta = 25;
      listForLoan = true;
      dsText = "Ti mando in prestito: andrai a giocare con continuità altrove.";
      rispostaSecca = "Finalmente il campo vero. Grazie per avermi ascoltato, Direttore.";
      break;

    case "prometti_trattativa_cessione":
      perdita = 40;
      moraleDelta = 12;
      listForTransfer = true;
      sellNow = false;
      dsText = "Accetto la tua volontà di partire: ti prometto che tratterò la tua vendita col club offerente per spuntare le condizioni migliori.";
      rispostaSecca = "Va bene Direttore, mi fido. Trattate la mia vendita ma non tirate troppo la corda.";
      break;

    case "accetta_cessione":
      if (!standoff.offerFromClubId) return { standoff, moraleDelta: 0 };
      sellNow = true;
      {
        const importoTxt =
          standoff.offerDetails && standoff.offerDetails.amount > 0
            ? ` a ${formatEuroAmount(standoff.offerDetails.amount)}`
            : "";
        dsText = `Accetto l'offerta del ${standoff.offerFromClubName ?? "club"}${importoTxt}: sei libero di andare.`;
      }
      rispostaSecca = "Finalmente. Grazie per avermi ascoltato.";
      break;

    case "multa_disciplina":
      perdita = 50;
      moraleDelta = -25;
      moneyEarnedAmount = 100_000;
      dsText = "Questo comportamento è inaccettabile. Ti notifico una multa disciplinare per insubordinazione!";
      rispostaSecca = "Una multa? Con me avete chiuso definitivamente, Direttore!";
      break;

    case "scegli_giocatore":
      moraleDelta = 25;
      dsText = "Ho deciso: resti tu. Il mister lascia il club, la scelta è fatta.";
      rispostaSecca = "Grazie per aver creduto in me, Direttore. Non ve ne pentirete.";
      break;

    case "scegli_mister":
      moraleDelta = -30;
      dsText = "Ho deciso: il progetto va avanti col mister. Mi dispiace, ma la scelta è questa.";
      rispostaSecca = "Capisco, Direttore. Ma non mi aspetti lo stesso da me in campo, adesso.";
      break;

    case "ignora":
      perdita = 45;
      moraleDelta = -18;
      dsText = "Per ora resti così: non ho risposte da darti.";
      early = "Non è la risposta che aspettavo. La mia pazienza sta finendo.";
      mid = "Ancora silenzio, Direttore? La mia pazienza si sta esaurendo per davvero.";
      closing = "Con me hai chiuso, Direttore. Non mi vedrai rendere come prima.";
      rispostaRipetuta = "Di nuovo nessuna risposta. Con me avete chiuso, Direttore.";
      break;
  }

  if (ripetuta && move.kind !== "accetta_cessione" && move.kind !== "prometti_trattativa_cessione") perdita *= 2;

  const mosseSecchePatienzaZero: StandoffMove["kind"][] = [
    "accetta_cessione",
    "prometti_trattativa_cessione",
    "scegli_giocatore",
    "scegli_mister",
    "multa_disciplina",
  ];
  let patience = mosseSecchePatienzaZero.includes(move.kind)
    ? 0
    : Math.max(0, standoff.patience - perdita);

  const replyText = rispostaSecca
    ? rispostaSecca
    : ripetuta && rispostaRipetuta
      ? rispostaRipetuta
      : patience <= 0
        ? closing
        : scambioInCorso
          ? mid
          : early;

  let status: PlayerStandoff["status"] = "aperta";
  if (
    move.kind === "accetta_cessione" ||
    move.kind === "prometti_trattativa_cessione" ||
    move.kind === "scegli_giocatore"
  )
    status = "placata";
  else if (move.kind === "scegli_mister" || move.kind === "multa_disciplina" || (move.kind === "prometti_spazio" && !coachApproved))
    status = "rotta";
  else if (patience <= 0) status = move.kind === "ignora" ? "rotta" : "placata";

  if (status === "rotta" && move.kind !== "scegli_mister" && move.kind !== "multa_disciplina") moraleDelta = Math.min(moraleDelta, -18);

  const coachResigns = move.kind === "scegli_giocatore";
  const coachBenches = standoff.reason === "bivio_mister" && status === "rotta" && move.kind === "ignora";

  const log: StandoffMessage[] = [
    ...standoff.log,
    { speaker: "ds", text: dsText },
    { speaker: "giocatore", text: replyText },
  ];

  return {
    standoff: {
      ...standoff,
      patience,
      status,
      log,
      round: standoff.round + 1,
      lastMoveKind: move.kind,
      sameMoveStreak: ripetuta ? standoff.sameMoveStreak + 1 : 0,
    },
    moraleDelta,
    listForTransfer,
    listForLoan,
    promiseMinutes: promiseMinutes && coachApproved,
    moneyBonus,
    moneyBonusAmount,
    moneyEarnedAmount,
    coachApproved,
    promise,
    sellNow,
    coachResigns: coachResigns || undefined,
    coachBenches: coachBenches || undefined,
  };
}

export interface PlayerPromiseVerification {
  updatedPromises: Record<string, PlayerPromiseRecord>;
  moraleDelta: Record<string, number>;
  newlyBroken: string[];
  messages: string[];
}

export function verifyPlayerPromises(
  promises: Record<string, PlayerPromiseRecord>,
  roster: RosterEntry[],
  players: Record<string, { name: string; department: Department }>,
  season: number,
  leaguePosition: number | null,
  leagueSize: number,
): PlayerPromiseVerification {
  const updatedPromises: Record<string, PlayerPromiseRecord> = {};
  const moraleDelta: Record<string, number> = {};
  const newlyBroken: string[] = [];
  const messages: string[] = [];

  for (const [playerId, promise] of Object.entries(promises)) {
    if (!roster.some((e) => e.playerId === playerId)) continue;
    const name = players[playerId]?.name ?? "Un giocatore";

    if (promise.kind === "trionfo") {
      if (leaguePosition === null) {
        updatedPromises[playerId] = promise;
        continue;
      }
      const fulfilled = leaguePosition <= Math.max(1, Math.ceil(leagueSize / 2));
      if (fulfilled) {
        moraleDelta[playerId] = (moraleDelta[playerId] ?? 0) + 8;
        messages.push(`${name}: la squadra sta lottando per davvero, la promessa di trionfo tiene.`);
      } else {
        moraleDelta[playerId] = (moraleDelta[playerId] ?? 0) - 30;
        newlyBroken.push(playerId);
        messages.push(`${name} si sente tradito: la stagione da protagonisti promessa non si è vista.`);
      }
      continue;
    }

    const fulfilled = roster.some(
      (e) => e.playerId !== playerId && e.sinceSeason === season && players[e.playerId]?.department === promise.department,
    );
    if (fulfilled) {
      moraleDelta[playerId] = (moraleDelta[playerId] ?? 0) + 8;
      messages.push(`${name} ha visto arrivare il rinforzo promesso: la fiducia cresce.`);
    } else {
      moraleDelta[playerId] = (moraleDelta[playerId] ?? 0) - 30;
      newlyBroken.push(playerId);
      messages.push(`${name} aspettava un rinforzo mai arrivato: si sente preso in giro.`);
    }
  }

  return { updatedPromises, moraleDelta, newlyBroken, messages };
}
