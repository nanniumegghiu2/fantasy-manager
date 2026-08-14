/**
 * **La dirigenza: qualcuno sopra il direttore sportivo.**
 *
 * Fino a qui il DS rispondeva solo a se stesso. L'obiettivo stagionale (`seasonObjectives.ts`)
 * si dichiarava, si mancava, e non succedeva niente oltre a qualche punto di sintonia col
 * mister: un obiettivo senza conseguenze è una decorazione, non una decisione. Questo modulo
 * mette dall'altra parte del tavolo un presidente che quell'obiettivo se lo ricorda.
 *
 * ## Le tre regole
 *
 * 1. **La fiducia è una sola risorsa**, 0-100, che sale coi risultati e scende con le stagioni
 *    mancate. Sotto il pavimento, la carriera finisce (`ending: "esonero"`) — la stessa fine che
 *    il gioco già prevede quando la rosa non arriva a undici.
 * 2. **Mancare l'obiettivo apre una richiesta di esonero del mister**, non un licenziamento
 *    d'ufficio. Chi decide resta il DS: la dirigenza chiede, e la scelta è sua.
 * 3. **Difendere il mister costa.** È l'unica cosa che rende la richiesta una decisione invece
 *    di un pulsante: proteggerlo lo lega a te (la sintonia sale) ma consuma fiducia, e alla
 *    seconda o terza volta il conto arriva.
 *
 * Modulo **puro**: nessuna scrittura, nessun import da `career.ts` (che invece importa questo).
 */

export interface BoardState {
  /** 0-100: quanto la dirigenza crede nel direttore sportivo. */
  confidence: number;
  /** La richiesta di esonero aperta, da risolvere prima di ripartire. */
  sackDemand?: BoardSackDemand;
  /** Quante volte il DS ha difeso il mister contro il parere della dirigenza. */
  defiances?: number;
  /** Stagione dell'ultimo richiamo di metà stagione, per non ripeterlo ogni giornata. */
  lastWarningSeason?: number;
}

export interface BoardSackDemand {
  season: number;
  /** L'obiettivo dichiarato che è stato mancato. */
  objectiveLabel: string;
  targetPosition: number;
  /**
   * Giudizio pesato su **tutti** gli obiettivi dichiarati (0-1), quando ce n e piu di uno.
   * Assente = si giudica il solo campionato, com era prima.
   */
  seasonScore?: number;
  finalPosition: number;
  /** Il nome del mister di cui si chiede la testa, per il dialogo. */
  coachName: string;
  /** Quanto è dura la richiesta: alla seconda insistenza non è più un consiglio. */
  severity: "richiesta" | "ultimatum";
}

/** Sotto questa fiducia la società esonera **il direttore sportivo**: carriera finita. */
export const BOARD_CONFIDENCE_FLOOR = 22;

/** Fiducia di partenza: un presidente che ti ha appena assunto crede in te, ma non alla cieca. */
export const BOARD_INITIAL_CONFIDENCE = 65;

/** Quanto costa difendere il mister contro il parere della dirigenza. */
export const DEFY_BOARD_COST = 18;

export function defaultBoard(): BoardState {
  return { confidence: BOARD_INITIAL_CONFIDENCE, defiances: 0 };
}

export interface BoardSeasonInput {
  board: BoardState | undefined;
  season: number;
  /** L'obiettivo dichiarato a inizio anno; assente = nessun impegno preso. */
  objective?: { label: string; targetPosition: number };
  /**
   * Giudizio pesato su **tutti** gli obiettivi dichiarati (0-1), campionato e coppe.
   *
   * Assente = si giudica il solo campionato, com'era prima. Presente = corregge quel verdetto,
   * senza sostituirlo: è così che la Corona vinta compensa un quarto posto mancato e la sola
   * Coppa Tricolore non riscatta l'annata (`OBJECTIVE_WEIGHTS`).
   */
  seasonScore?: number;
  finalPosition: number;
  teamsInLeague: number;
  /** Trofei vinti nella stagione: perdonano molto. */
  trophies: number;
  /** Promossi o retrocessi di categoria, quando il campionato ne fa parte. */
  divisionOutcome?: "promosso" | "retrocesso";
  coachName?: string;
  /** C'è un mister in panchina di cui si possa chiedere l'esonero. */
  hasCoach: boolean;
}

export interface BoardVerdict {
  board: BoardState;
  /** Da mostrare fra le notizie di fine stagione. */
  message: string;
  /** La fiducia è scesa sotto il pavimento: la carriera finisce qui. */
  dsSacked: boolean;
}

/**
 * Il giudizio della dirigenza a fine stagione.
 *
 * Il metro è **lo scarto dall'obiettivo dichiarato**, non la posizione in sé: chiudere noni
 * avendo promesso la salvezza è un successo, chiuderli avendo promesso il titolo è un disastro.
 * Un trofeo vale più di qualunque piazzamento — è la cosa che un presidente mette in bacheca — e
 * una promozione mette al riparo comunque, perché è il risultato per cui esiste la Serie B.
 */
export function boardSeasonVerdict(input: BoardSeasonInput): BoardVerdict {
  const attuale = input.board ?? defaultBoard();
  const obiettivo = input.objective;

  let delta = 0;
  let motivo: string;

  if (input.divisionOutcome === "promosso") {
    delta = 25;
    motivo = "La promozione mette d'accordo tutti: la dirigenza è entusiasta.";
  } else if (input.divisionOutcome === "retrocesso") {
    delta = -35;
    motivo = "La retrocessione pesa come un macigno sul giudizio della dirigenza.";
  } else if (!obiettivo) {
    delta = 0;
    motivo = "Nessun obiettivo dichiarato: la dirigenza sospende il giudizio.";
  } else {
    const scarto = input.finalPosition - obiettivo.targetPosition;
    if (scarto <= 0) {
      // Superarlo di parecchio vale più che centrarlo per un soffio.
      delta = 12 + Math.min(10, -scarto * 2);
      motivo = `Obiettivo "${obiettivo.label}" centrato: la dirigenza è soddisfatta.`;
    } else {
      // Ogni posizione sotto l'obiettivo pesa, ma il tetto evita che una stagione storta di un
      // club piccolo (dove le posizioni sotto possono essere molte) chiuda la carriera da sola.
      delta = -Math.min(34, 8 + scarto * 3);
      motivo = `Obiettivo "${obiettivo.label}" mancato di ${scarto} ${scarto === 1 ? "posizione" : "posizioni"}: la dirigenza chiede conto.`;
    }

    /**
     * **Il campionato non e piu l unico fronte.**
     *
     * Con gli obiettivi di coppa dichiarati (richiesta dell utente) il giudizio si pesa su tutti
     * quelli su cui ci si era impegnati — Corona, campionato, Tricolore, in quest ordine di
     * importanza. Il punteggio 0-1 sposta il verdetto del campionato verso l alto o verso il
     * basso invece di sostituirlo: chi vince la Corona e manca il quarto posto non ha fallito la
     * stagione, e chi salva solo la Tricolore non l ha riscattata.
     */
    if (input.seasonScore !== undefined) {
      const correzione = Math.round((input.seasonScore - 0.5) * 24);
      delta += correzione;
      if (correzione > 4) motivo += " Le coppe raddrizzano il bilancio dell annata.";
      else if (correzione < -4) motivo += " E nemmeno le coppe hanno portato qualcosa.";
    }
  }

  // I trofei perdonano: chi porta una coppa a casa ha comprato tempo, sempre.
  if (input.trophies > 0) {
    delta += 14 * input.trophies;
    motivo += ` ${input.trophies === 1 ? "Il trofeo vinto" : "I trofei vinti"} pesano in tuo favore.`;
  }

  const confidence = Math.max(0, Math.min(100, attuale.confidence + delta));
  const mancato = !!obiettivo && input.finalPosition > obiettivo.targetPosition;

  /**
   * **Quando la dirigenza chiede la testa del mister.**
   *
   * Solo se l'obiettivo è stato mancato *e* la fiducia si è incrinata. Due scudi espliciti, non
   * ricavati dai numeri: **un trofeo** e **una promozione**. Se fossero solo un bonus di fiducia,
   * una coppa vinta in una stagione altrimenti storta non basterebbe comunque a fermare la
   * richiesta — e chiedere la testa di un mister che ha appena portato un trofeo in bacheca non
   * è ciò che fa un presidente. Chi ha già difeso il mister una volta se la sente chiedere come
   * **ultimatum**, non più come consiglio.
   */
  const chiede =
    mancato &&
    input.hasCoach &&
    input.trophies === 0 &&
    input.divisionOutcome !== "promosso" &&
    confidence < 62;

  const sackDemand: BoardSackDemand | undefined =
    chiede && obiettivo
      ? {
          season: input.season,
          objectiveLabel: obiettivo.label,
          targetPosition: obiettivo.targetPosition,
          finalPosition: input.finalPosition,
          coachName: input.coachName ?? "l'allenatore",
          severity: (attuale.defiances ?? 0) >= 1 ? "ultimatum" : "richiesta",
        }
      : undefined;

  return {
    board: { ...attuale, confidence, sackDemand },
    message: motivo,
    dsSacked: confidence < BOARD_CONFIDENCE_FLOOR,
  };
}

export type SackDemandChoice = "esonera" | "difendi";

export interface SackDemandOutcome {
  board: BoardState;
  /** Il mister va mandato via. */
  fireCoach: boolean;
  /** Variazione della sintonia col mister: difenderlo lo lega a te. */
  coachHarmonyDelta: number;
  message: string;
  /** Difendere il mister ha esaurito la pazienza della dirigenza: carriera finita. */
  dsSacked: boolean;
}

/**
 * La risposta del DS alla richiesta della dirigenza.
 *
 * Assecondarla non è gratis nemmeno lei — cambiare mister costa comunque la buonuscita e
 * l'ingaggio del nuovo (`career.ts`, `hireCoach`) — ma è la scelta che ricompone il rapporto col
 * presidente. Difenderlo è la scelta interessante: consuma fiducia, e su un **ultimatum** ne
 * consuma il doppio, cioè può finire la carriera lì.
 */
export function resolveSackDemand(
  board: BoardState | undefined,
  choice: SackDemandChoice,
): SackDemandOutcome {
  const attuale = board ?? defaultBoard();
  const demand = attuale.sackDemand;

  if (choice === "esonera") {
    const confidence = Math.min(100, attuale.confidence + 10);
    return {
      board: { ...attuale, confidence, sackDemand: undefined },
      fireCoach: true,
      coachHarmonyDelta: 0,
      message: `La dirigenza approva: ${demand?.coachName ?? "l'allenatore"} è stato sollevato dall'incarico.`,
      dsSacked: false,
    };
  }

  const costo = demand?.severity === "ultimatum" ? DEFY_BOARD_COST * 2 : DEFY_BOARD_COST;
  const confidence = Math.max(0, attuale.confidence - costo);
  return {
    board: {
      ...attuale,
      confidence,
      sackDemand: undefined,
      defiances: (attuale.defiances ?? 0) + 1,
    },
    fireCoach: false,
    // Il mister lo sa, che l'hai difeso: è il ritorno della scommessa.
    coachHarmonyDelta: 14,
    message: `Hai difeso ${demand?.coachName ?? "il mister"} davanti alla dirigenza. Lui non lo dimenticherà, il presidente nemmeno.`,
    dsSacked: confidence < BOARD_CONFIDENCE_FLOOR,
  };
}

/**
 * Il richiamo di metà stagione: la dirigenza si fa sentire **mentre** le cose vanno male, non
 * solo a bocce ferme.
 *
 * Una volta per stagione e non prima che il campionato dica qualcosa: senza le due condizioni
 * sarebbe un messaggio a ogni giornata storta, cioè rumore.
 */
export function boardMidSeasonWarning(input: {
  board: BoardState | undefined;
  season: number;
  matchday: number;
  totalMatchdays: number;
  positionsBelowTarget: number;
  objectiveLabel?: string;
}): { board: BoardState; message: string } | null {
  const attuale = input.board ?? defaultBoard();
  if (attuale.lastWarningSeason === input.season) return null;
  if (input.matchday < Math.round(input.totalMatchdays * 0.45)) return null;
  if (input.positionsBelowTarget < 5) return null;

  return {
    board: {
      ...attuale,
      confidence: Math.max(0, attuale.confidence - 6),
      lastWarningSeason: input.season,
    },
    message: `La dirigenza convoca il direttore sportivo: siamo ${input.positionsBelowTarget} posizioni sotto l'obiettivo "${input.objectiveLabel ?? "dichiarato"}". Servono risposte, in fretta.`,
  };
}

/** Etichetta e tono della fiducia, per la barra in interfaccia. */
export function boardConfidenceLabel(confidence: number): { label: string; tone: string } {
  if (confidence >= 80) return { label: "Fiducia piena", tone: "#3ddc6b" };
  if (confidence >= 60) return { label: "Fiducia solida", tone: "#8fd4a4" };
  if (confidence >= 40) return { label: "Sotto osservazione", tone: "#ffc107" };
  if (confidence >= BOARD_CONFIDENCE_FLOOR) return { label: "In bilico", tone: "#ff8a3d" };
  return { label: "Esonero imminente", tone: "#ff4d4d" };
}
