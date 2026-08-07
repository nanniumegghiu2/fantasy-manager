/**
 * **Il faccia a faccia col giocatore.**
 *
 * Prima l'unico modo di intervenire sul malcontento era una scelta secca a un turno solo
 * (`playerTalks.ts`) o aspettare la richiesta throttled del motore (`events.ts`,
 * `pendingRequest`). Richiesta esplicita dell'utente: una vera trattativa, con la **stessa
 * tensione** delle trattative di mercato (`negotiation.ts`) — una barra di pazienza che si
 * consuma, e che porta o alla riappacificazione o alla rottura totale. Qui la posta non è un
 * prezzo ma il rapporto col giocatore: rassicurarlo, promettergli spazio o accontentarlo lo
 * chiude bene; ignorarlo lo esaurisce, e quando la pazienza finisce così il morale crolla al
 * minimo — un costo vero, non solo narrativo, perché `discontentPenalty`/`moraleTeamModifier`
 * (career.ts) lo fanno rendere meno in campo indipendentemente dal suo Overall.
 */
import type { Department } from "@app/shared-types";
import type { RosterEntry } from "./types";

/**
 * `"tradito"` non nasce da morale/offerta come gli altri: è lo stato di chi ha già subito una
 * promessa infranta (`playerPromises`, career.ts) — una conversazione che parte già compromessa,
 * non una scontentezza qualunque.
 */
export type StandoffReason = "vuole_giocare" | "scontento" | "richiamato" | "tradito";

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

export interface PlayerStandoff {
  playerId: string;
  playerName: string;
  reason: StandoffReason;
  /** 0-100: quanto regge ancora questa conversazione prima di rompersi o chiudersi bene. */
  patience: number;
  status: "aperta" | "placata" | "rotta";
  log: StandoffMessage[];
  /** Se c'è un'offerta di mercato per lui, il club offerente: si può accettarla da qui. */
  offerFromClubId?: string;
  offerFromClubName?: string;
  round: number;
}

export type StandoffMove =
  | { kind: "rassicura" }
  | { kind: "prometti_spazio" }
  | { kind: "premio_denaro" }
  | { kind: "promessa_rinforzi"; department: Department }
  | { kind: "promessa_trionfo" }
  | { kind: "lista_cessione" }
  | { kind: "accetta_cessione" }
  /**
   * Concede un prestito: lo iscrive alla lista prestiti (`CareerState.lists.loanList`), che
   * grazie alla garanzia di offerta immediata (sez. mercato prestiti) gli trova subito una
   * destinazione — non è più una cessione istantanea a un club anonimo come nel vecchio popup
   * a 4 bottoni, è l'ingresso nello stesso canale di mercato dei prestiti volontari.
   */
  | { kind: "concedi_prestito" }
  | { kind: "ignora" };

const REASON_OPEN: Record<StandoffReason, string> = {
  vuole_giocare: "Non se ne parla più: o gioco con continuità, o è meglio che io vada altrove.",
  scontento: "Qui dentro non sto bene, Direttore. Ho bisogno di sapere cosa pensate di fare con me.",
  richiamato: "C'è un club che mi vuole davvero. Voi cosa avete da dirmi per farmi restare?",
  tradito: "Mi avevate promesso una cosa precisa e non l'avete mantenuta. Perché dovrei ancora fidarmi di voi?",
};

const DEPARTMENT_IT: Record<Department, string> = {
  POR: "in porta",
  DIF: "in difesa",
  CC: "a centrocampo",
  ATT: "in attacco",
};

/**
 * Quali mosse hanno senso in questa conversazione, dato **il vero motivo** per cui il
 * giocatore ha aperto bocca — richiesta esplicita dell'utente: prima il pannello mostrava
 * sempre lo stesso ventaglio di mosse, a prescindere che il problema fosse "voglio giocare" o
 * "mi hanno tradito", e conversazioni così diverse non possono avere le stesse risposte
 * sensate. `ignora` resta sempre disponibile: si può sempre scegliere di non rispondere.
 */
export function relevantMoves(reason: StandoffReason): StandoffMove["kind"][] {
  switch (reason) {
    case "vuole_giocare":
      // Il problema è il minutaggio, non i soldi o un trionfo promesso: motivarlo con un
      // premio o una promessa di gloria non risponde a quello che sta davvero chiedendo.
      return ["rassicura", "prometti_spazio", "lista_cessione", "concedi_prestito", "ignora"];
    case "scontento":
      // Malessere generico: qui ogni tipo di argomento è pertinente, il problema non è
      // circoscritto.
      return [
        "rassicura",
        "premio_denaro",
        "promessa_rinforzi",
        "promessa_trionfo",
        "lista_cessione",
        "ignora",
      ];
    case "richiamato":
      // Lo cerca una big: convincerlo a restare richiede argomenti pesanti, non una semplice
      // rassicurazione a parole.
      return [
        "premio_denaro",
        "promessa_rinforzi",
        "promessa_trionfo",
        "accetta_cessione",
        "lista_cessione",
        "ignora",
      ];
    case "tradito":
      // Chi ha già subito una promessa infranta non si fida di un'altra promessa: niente
      // `promessa_rinforzi`/`promessa_trionfo`/`prometti_spazio` qui, servono fatti immediati.
      return ["premio_denaro", "rassicura", "lista_cessione", "concedi_prestito", "accetta_cessione", "ignora"];
  }
}

export function openStandoff(
  entry: RosterEntry,
  playerName: string,
  reason: StandoffReason,
  offer?: { clubId: string; clubName: string },
): PlayerStandoff {
  return {
    playerId: entry.playerId,
    playerName,
    reason,
    // Chi ha già poca pazienza (morale basso) regge meno battute prima di rompersi o placarsi.
    // Chi è già stato tradito parte quasi rotto: non basta una parola per rimediare a una
    // promessa infranta, serve un gesto concreto (premio in denaro) e anche così è in salita.
    patience: reason === "tradito" ? Math.max(8, Math.min(20, entry.morale)) : Math.max(25, Math.min(80, entry.morale)),
    status: "aperta",
    log: [{ speaker: "giocatore", text: REASON_OPEN[reason] }],
    offerFromClubId: offer?.clubId,
    offerFromClubName: offer?.clubName,
    round: 0,
  };
}

export interface StandoffOutcome {
  standoff: PlayerStandoff;
  moraleDelta: number;
  /** Va messo in lista trasferimenti. */
  listForTransfer?: boolean;
  /** Va messo in lista prestiti (mossa `concedi_prestito`). */
  listForLoan?: boolean;
  /** Va promessa più titolarità (stesso canale di `playerTalks.ts`/`minutesPromises`). */
  promiseMinutes?: boolean;
  /** Un premio in denaro **subito**: career.ts calcola l'importo vero e lo scala dal budget. */
  moneyBonus?: boolean;
  /** Una promessa futura, verificata a fine mercato: se infranta, il rapporto si rompe (career.ts). */
  promise?: { kind: PlayerPromiseKind; department?: Department };
  /** Esegui subito la cessione tramite l'offerta collegata. */
  sellNow?: boolean;
}

/**
 * Applica una mossa alla trattativa. Puro e deterministico: la stessa mossa sullo stesso stato
 * dà sempre lo stesso esito (nessuna casualità qui — è la lettura della situazione a essere il
 * gioco, non un tiro di dado).
 */
export function applyStandoffMove(standoff: PlayerStandoff, move: StandoffMove): StandoffOutcome {
  if (standoff.status !== "aperta") {
    return { standoff, moraleDelta: 0 };
  }

  let patience = standoff.patience;
  let moraleDelta = 0;
  let listForTransfer: boolean | undefined;
  let listForLoan: boolean | undefined;
  let promiseMinutes: boolean | undefined;
  let moneyBonus: boolean | undefined;
  let promise: StandoffOutcome["promise"];
  let sellNow: boolean | undefined;
  let dsText = "";
  let replyText = "";

  switch (move.kind) {
    case "rassicura":
      patience -= 22;
      moraleDelta = 10;
      dsText = "Ti meriti più fiducia da parte mia: da adesso qualcosa cambia.";
      replyText =
        patience <= 0
          ? "Va bene, mi fido. Adesso voglio vederlo nei fatti."
          : "Sentiamo... ma le parole da sole non bastano ancora.";
      break;
    case "prometti_spazio":
      patience -= 34;
      moraleDelta = 16;
      promiseMinutes = true;
      dsText = "Ti prometto più minuti: da qui alle prossime giornate sei tu la scelta.";
      replyText =
        patience <= 0
          ? "Questo sì che è un impegno vero. Aspetto di vederlo in campo."
          : "Un passo nella direzione giusta, ma voglio vederlo scritto nei fatti.";
      break;
    case "premio_denaro":
      // Tangibile e immediato: non è una promessa, è già successo — nessun rischio di
      // infrangerla in futuro, ma per lo stesso motivo pesa meno di un vero impegno preso.
      patience -= 28;
      moraleDelta = 20;
      moneyBonus = true;
      dsText = "Ecco un premio per te, subito: lo riconosco, meriti di più.";
      replyText =
        patience <= 0
          ? "Apprezzo il gesto, Direttore. Si vede che ci tenete davvero."
          : "Un bel gesto. Ma non è tutto qui che vale, lo sapete.";
      break;
    case "promessa_rinforzi":
      patience -= 30;
      moraleDelta = 14;
      promise = { kind: "rinforzi", department: move.department };
      dsText = `Ti prometto un rinforzo vero ${DEPARTMENT_IT[move.department]}: la squadra si alza con te, non nonostante te.`;
      replyText =
        patience <= 0
          ? "Bene. Aspetto di vederlo arrivare entro la fine del mercato."
          : "Bello a dirsi. Vediamo se succede per davvero.";
      break;
    case "promessa_trionfo":
      patience -= 26;
      moraleDelta = 12;
      promise = { kind: "trionfo" };
      dsText = "Ti prometto che lotteremo per qualcosa di grande quest'anno: fidati del progetto.";
      replyText =
        patience <= 0
          ? "Va bene, ci sto. Ma non deludetemi: me lo ricorderò."
          : "Belle parole. Le prendo, ma resto con gli occhi aperti.";
      break;
    case "lista_cessione":
      patience -= 40;
      moraleDelta = 14;
      listForTransfer = true;
      dsText = "Ti metto in lista trasferimenti: se arriva l'offerta giusta, ti lascio andare.";
      replyText = "Era quello che volevo sentire. Grazie, Direttore.";
      break;
    case "concedi_prestito":
      patience -= 40;
      moraleDelta = 25;
      listForLoan = true;
      dsText = "Ti mando in prestito: andrai a giocare con continuità altrove.";
      replyText = "Finalmente il campo vero. Grazie per avermi ascoltato, Direttore.";
      break;
    case "accetta_cessione":
      if (!standoff.offerFromClubId) return { standoff, moraleDelta: 0 };
      sellNow = true;
      patience = 0;
      dsText = "Accetto l'offerta: sei libero di andare.";
      replyText = "Finalmente. Grazie per avermi ascoltato.";
      break;
    case "ignora":
      patience -= 45;
      moraleDelta = -18;
      dsText = "Per ora resti così: non ho risposte da darti.";
      replyText =
        patience > 0
          ? "Non è la risposta che aspettavo. La mia pazienza sta finendo."
          : "Con me hai chiuso, Direttore. Non mi vedrai rendere come prima.";
      break;
  }

  patience = Math.max(0, patience);

  let status: PlayerStandoff["status"] = "aperta";
  if (move.kind === "accetta_cessione") status = "placata";
  else if (patience <= 0) status = move.kind === "ignora" ? "rotta" : "placata";

  // Una rottura è sempre un colpo pesante, qualunque fosse il calcolo della singola mossa: è il
  // punto in cui il rapporto si spezza per davvero, non solo un brutto momento.
  if (status === "rotta") moraleDelta = Math.min(moraleDelta, -18);

  const log: StandoffMessage[] = [
    ...standoff.log,
    { speaker: "ds", text: dsText },
    { speaker: "giocatore", text: replyText },
  ];

  return {
    standoff: { ...standoff, patience, status, log, round: standoff.round + 1 },
    moraleDelta,
    listForTransfer,
    listForLoan,
    promiseMinutes,
    moneyBonus,
    promise,
    sellNow,
  };
}

export interface PlayerPromiseVerification {
  updatedPromises: Record<string, PlayerPromiseRecord>;
  moraleDelta: Record<string, number>;
  /** Chi ha appena subito la promessa infranta: entra in `CareerState.brokenTrust`. */
  newlyBroken: string[];
  messages: string[];
}

/**
 * Verifica le promesse fatte in chat, **a fine finestra di mercato** (career.ts la chiama nello
 * stesso punto in cui già verifica quelle del mister). Una promessa infranta non è un piccolo
 * malus: crolla il morale al minimo e il giocatore finisce in `brokenTrust` — la prossima
 * conversazione con lui parte da un rapporto già rotto (`StandoffReason: "tradito"`).
 *
 * "trionfo" richiede una classifica leggibile: a mercato estivo appena aperto (`leaguePosition
 * === null`, nessuna giornata ancora giocata) non c'è nulla da giudicare — resta in sospeso fino
 * alla prossima verifica, non si estingue né si considera automaticamente infranta.
 */
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
    // Ceduto o andato via: la promessa non ha più un destinatario, si estingue senza strascichi.
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

    // "rinforzi": soddisfatta se in questa stessa stagione è arrivato qualcun altro nel reparto
    // promesso — arrivato, non semplicemente presente: altrimenti la promessa sarebbe già sempre
    // vera per qualunque rosa con più di un giocatore in quel reparto.
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
