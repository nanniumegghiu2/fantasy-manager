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

/* -------------------------------------------------------------------------- */
/* Il colloquio di inizio stagione                                             */
/* -------------------------------------------------------------------------- */

/**
 * **La dirigenza non manda più un avviso: ti riceve.**
 *
 * ⚠️ Segnalazione dell'utente: *"il meeting società è ancora troppo scarno, deve essere un
 * colloquio dove loro mi espongono il loro obiettivo minimo e si trova un accordo di obiettivi e
 * budget, e se mantenere o meno il mister"*. Prima esistevano **due cose separate** e nessuna
 * era un colloquio: una richiesta di esonero che compariva solo dopo una stagione storta, e una
 * schermata dell'obiettivo in cui il DS sceglieva da solo, senza che nessuno dall'altra parte
 * dicesse cosa si aspettava. Il presidente non aveva mai una posizione propria da cui trattare.
 *
 * Adesso il colloquio si apre **ogni stagione** e ha tre argomenti in un tavolo solo: cosa
 * pretendono, quanto mettono, e che ne è del mister. Il DS può alzare l'asticella per avere più
 * mezzi, o abbassarla e pagarla in fiducia — ma non può ignorare la richiesta minima senza che
 * costi qualcosa, che è ciò che rende l'obiettivo un accordo invece di una dichiarazione.
 */
export interface BoardObjectiveOption {
  label: string;
  targetPosition: number;
  /** Rispetto al minimo preteso: più ambizioso, uguale, o più prudente. */
  stance: "sopra" | "minimo" | "sotto";
  /** Come cambia il fatturato accettando questo obiettivo. */
  budgetMultiplier: number;
  /** Variazione di fiducia all'accordo: l'ambizione piace, la prudenza no. */
  confidenceDelta: number;
  /** La battuta del presidente su questa proposta. */
  reply: string;
}

export interface BoardMeeting {
  season: number;
  /** L'obiettivo **minimo** che la società pretende: la loro posizione di partenza. */
  minimum: { label: string; targetPosition: number };
  /** Il giudizio sull'annata appena chiusa, quando ce n'è una. */
  review?: string;
  /** Cosa si aspettano, detto da loro. */
  speech: string;
  /** Il fatturato prima di qualunque accordo. */
  baseRevenue: number;
  /** Le fasce proponibili, già annotate con l'effetto sul bilancio e la reazione. */
  options: BoardObjectiveOption[];
  /** Quanto extra si può chiedere sul mercato, e a quale prezzo in fiducia. */
  extraBudget: { max: number; confidenceCostPerStep: number; step: number };
  /** La questione panchina, se aperta. */
  coachIssue?: {
    coachName: string;
    severity: "richiesta" | "ultimatum";
    /** Perché la società la pensa così, in chiaro. */
    reason: string;
  };
}

export interface BoardMeetingInput {
  board: BoardState | undefined;
  season: number;
  /** Le fasce che la rosa può ragionevolmente puntare (`suggestObjectiveTiers`), dalla più ambiziosa. */
  tiers: readonly { label: string; targetPosition: number }[];
  /** La fascia che il motore stima realistica per questa rosa. */
  realistic: { label: string; targetPosition: number };
  /** Quanto vale ciascuna fascia sul fatturato (`objectiveBudgetMultiplier`). */
  budgetMultiplierOf: (tier: { label: string; targetPosition: number }) => number;
  baseRevenue: number;
  /** L'esito della stagione precedente, se ce n'è stata una. */
  lastSeason?: { objectiveLabel?: string; finalPosition: number; trophies: number; met: boolean };
  coachName?: string;
  hasCoach: boolean;
}

/** Quanto extra si può strappare al presidente, come frazione del fatturato. */
export const BOARD_EXTRA_BUDGET_SHARE = 0.22;
/** Quanti scalini ha la richiesta di extra budget. */
export const BOARD_EXTRA_BUDGET_STEPS = 4;

/**
 * Il colloquio di inizio stagione: cosa pretendono, cosa offrono, cosa pensano del mister.
 *
 * **Il minimo non è la fascia realistica.** Un presidente non chiede quel che la rosa vale: chiede
 * quel che la rosa vale *più la sua impazienza*. Con la fiducia alta si accontenta di una fascia
 * sotto la stima — si fida, e ti lascia margine; con la fiducia bassa pretende esattamente la
 * stima o meglio, perché non ha più voglia di aspettare. È questo a rendere il colloquio diverso
 * di stagione in stagione senza inventare nulla di nuovo.
 */
export function boardSeasonMeeting(input: BoardMeetingInput): BoardMeeting {
  const attuale = input.board ?? defaultBoard();
  const scala = [...input.tiers];
  const indiceRealistico = Math.max(
    0,
    scala.findIndex((t) => t.label === input.realistic.label),
  );

  /**
   * Lo scostamento del presidente dalla stima. `scala` va dalla più ambiziosa alla più prudente,
   * quindi **indice minore = più esigente**.
   *
   * ⚠️ Il segno era invertito rispetto a questo commento, e l'ha colto il test: chi aveva perso
   * fiducia chiedeva *meno*. È il contrario di come si comporta una società — un consiglio che
   * non crede più nel direttore sportivo vuole risultati **adesso**, e uno che si fida lascia
   * margine. Vale anche come regola di gioco: la stagione dopo un'annata storta dev'essere più
   * dura, non più comoda.
   */
  const scostamento = attuale.confidence >= 72 ? -1 : attuale.confidence < 45 ? 1 : 0;

  /**
   * ⚠️ **Chi ha appena vinto non si sente chiedere di meno** (segnalazione dell'utente: *"ho
   * vinto nettamente il campionato e sono la squadra dominante, ma nei meeting mi suggeriscono
   * sempre salvezza"*).
   *
   * Due regole, e la seconda è quella che mancava del tutto:
   *  - lo scostamento non può portare il minimo **sotto la stima** di più di un gradino, e con
   *    una rosa dominante (una sola fascia proponibile) non c'è nulla da abbassare;
   *  - il **risultato dell'anno scorso è un pavimento**: se si è chiuso primi, o si è centrato
   *    l'obiettivo, la società non riparte da un'asticella più bassa di quella già raggiunta.
   *    Un presidente non chiede la salvezza a chi gli ha appena portato lo scudetto, ed è
   *    esattamente ciò che rendeva irreale il colloquio.
   */
  let indiceMinimo = Math.max(0, Math.min(scala.length - 1, indiceRealistico - scostamento));

  const ultima = input.lastSeason;
  if (ultima) {
    const fascaRaggiunta = scala.findIndex((t) => ultima.finalPosition <= t.targetPosition);
    // `findIndex` torna −1 se nemmeno la fascia più prudente copre quel piazzamento: lì non
    // c'è nessun pavimento da imporre, ed è giusto — è stata un'annata sotto ogni aspettativa.
    if (fascaRaggiunta >= 0 && (ultima.met || ultima.finalPosition === 1)) {
      indiceMinimo = Math.min(indiceMinimo, fascaRaggiunta);
    }
  }

  const minimo = scala[indiceMinimo] ?? input.realistic;

  const options: BoardObjectiveOption[] = scala.map((tier, i) => {
    const stance: BoardObjectiveOption["stance"] =
      i < indiceMinimo ? "sopra" : i === indiceMinimo ? "minimo" : "sotto";
    const distanza = Math.abs(i - indiceMinimo);
    return {
      label: tier.label,
      targetPosition: tier.targetPosition,
      stance,
      budgetMultiplier: input.budgetMultiplierOf(tier),
      // Alzare l'asticella piace e viene ricompensato subito; abbassarla la irrita, e il conto
      // arriva già adesso invece che a fine stagione — è il prezzo del ribasso.
      confidenceDelta: stance === "sopra" ? 3 * distanza : stance === "minimo" ? 0 : -7 * distanza,
      reply:
        stance === "sopra"
          ? `«${tier.label}? Questo sì che è parlare. Se ci credi tu, ci mettiamo i mezzi.»`
          : stance === "minimo"
            ? `«${tier.label}: è esattamente quello che ci aspettiamo. Siamo d'accordo.»`
            : `«${tier.label}, dopo che ti abbiamo chiesto ${minimo.label}? Prendiamo nota, e non ce ne dimenticheremo.»`,
    };
  });

  const review = input.lastSeason
    ? input.lastSeason.trophies > 0
      ? `L'anno scorso avete portato ${input.lastSeason.trophies === 1 ? "un trofeo" : `${input.lastSeason.trophies} trofei`} in bacheca. Da qui si riparte, e non per restare fermi.`
      : input.lastSeason.met
        ? `${input.lastSeason.objectiveLabel ? `"${input.lastSeason.objectiveLabel}"` : "L'obiettivo"} l'avete centrato, chiudendo ${input.lastSeason.finalPosition}º. Bene: adesso il metro si alza.`
        : `${input.lastSeason.objectiveLabel ? `"${input.lastSeason.objectiveLabel}"` : "L'obiettivo"} non è arrivato: ${input.lastSeason.finalPosition}º posto. Non ce lo siamo dimenticati.`
    : undefined;

  const speech =
    attuale.confidence >= 72
      ? `Le abbiamo dato una squadra e le diamo fiducia. Il minimo che chiediamo è ${minimo.label}: sotto quello, avremmo sbagliato entrambi.`
      : attuale.confidence < 45
        ? `Siamo stati pazienti abbastanza. Il minimo, quest'anno, è ${minimo.label}. Non ci sono altri modi di dirlo.`
        : `Il consiglio si aspetta ${minimo.label}. Se lei crede di poter fare di più, ci dica come — e vedremo di sostenerla.`;

  return {
    season: input.season,
    minimum: { label: minimo.label, targetPosition: minimo.targetPosition },
    review,
    speech,
    baseRevenue: input.baseRevenue,
    options,
    extraBudget: {
      max: Math.round((input.baseRevenue * BOARD_EXTRA_BUDGET_SHARE) / 500_000) * 500_000,
      confidenceCostPerStep: 3,
      step: BOARD_EXTRA_BUDGET_STEPS,
    },
    coachIssue: attuale.sackDemand && input.hasCoach
      ? {
          coachName: attuale.sackDemand.coachName,
          severity: attuale.sackDemand.severity,
          reason: `Avevamo dichiarato "${attuale.sackDemand.objectiveLabel}" — entro la ${attuale.sackDemand.targetPosition}ª — e abbiamo chiuso ${attuale.sackDemand.finalPosition}º.`,
        }
      : input.hasCoach && input.coachName
        ? undefined
        : undefined,
  };
}

/**
 * L'esito dell'accordo: quanto budget, quanta fiducia, e cosa risponde il presidente.
 *
 * ⚠️ **L'extra budget non è gratis e non è illimitato.** Chiederlo consuma fiducia a scalini, e
 * il presidente concede solo in proporzione a quanto in alto si è puntato: chi promette la
 * salvezza e chiede i soldi del titolo si sente dire di no. Senza questo legame la leva sarebbe
 * un pulsante "più soldi" da premere sempre, cioè non una decisione.
 */
export interface BoardAgreement {
  board: BoardState;
  /** Moltiplicatore da applicare al fatturato per l'obiettivo concordato. */
  budgetMultiplier: number;
  /** Extra concesso in euro, oltre al moltiplicatore. */
  extraGranted: number;
  /** Quanto era stato chiesto: se maggiore del concesso, il presidente ha limato. */
  extraRequested: number;
  message: string;
}

export function agreeWithBoard(
  board: BoardState | undefined,
  meeting: BoardMeeting,
  chosenLabel: string,
  extraSteps = 0,
): BoardAgreement {
  const attuale = board ?? defaultBoard();
  const opzione =
    meeting.options.find((o) => o.label === chosenLabel) ??
    meeting.options.find((o) => o.stance === "minimo")!;

  const passi = Math.max(0, Math.min(meeting.extraBudget.step, Math.round(extraSteps)));
  const chiesto = Math.round((meeting.extraBudget.max / meeting.extraBudget.step) * passi);

  /**
   * Quanto sono disposti a concedere: l'ambizione dichiarata apre il portafoglio, la fiducia lo
   * tiene aperto. Chi punta sotto il minimo non ottiene nulla in più, e non è una punizione: è
   * che non c'è niente da finanziare.
   */
  const aperturaAmbizione = opzione.stance === "sopra" ? 1 : opzione.stance === "minimo" ? 0.6 : 0;
  const aperturaFiducia = Math.max(0, Math.min(1, (attuale.confidence - 30) / 55));
  const concesso =
    Math.round((chiesto * aperturaAmbizione * aperturaFiducia) / 500_000) * 500_000;

  const costoFiducia = passi * meeting.extraBudget.confidenceCostPerStep;
  const confidence = Math.max(
    0,
    Math.min(100, attuale.confidence + opzione.confidenceDelta - costoFiducia),
  );

  let message = opzione.reply;
  if (chiesto > 0) {
    message +=
      concesso >= chiesto
        ? ` «E i fondi in più li avrà: ci fidiamo del progetto.»`
        : concesso > 0
          ? ` «Sui fondi in più arriviamo fin qui, non oltre. Il resto se lo guadagni sul campo.»`
          : ` «Fondi in più, con questi presupposti, non se ne parla.»`;
  }

  return {
    board: { ...attuale, confidence },
    budgetMultiplier: opzione.budgetMultiplier,
    extraGranted: concesso,
    extraRequested: chiesto,
    message,
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
