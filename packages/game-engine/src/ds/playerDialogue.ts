/**
 * **La conversazione col giocatore.**
 *
 * Sostituisce `playerStandoff.ts`. Tre differenze sostanziali, non di forma:
 *
 * 1. **Due risorse invece di una.** La *pazienza* regge la singola conversazione e si azzera alla
 *    fine; la *fiducia* è persistente e decide da dove si parte la volta dopo. Chi ti ha visto
 *    mantenere due promesse ti ascolta; chi è stato tradito apre a dieci e si alza al secondo
 *    giro. Prima ogni chat ripartiva da zero: mentire non costava niente nel tempo lungo.
 *
 * 2. **Le mosse dichiarano il proprio costo** e, se non sono possibili, **dicono perché**. Prima
 *    "Premio in Denaro" diceva solo "Scala dal Budget" e falliva *dopo* il clic se il budget non
 *    bastava.
 *
 * 3. **Nessuna mossa concede ciò che il giocatore ha già.** È la seconda delle due regole
 *    anti-assurdo (la prima sta in `playerTopics.ts`): garantire la titolarità a chi gioca già
 *    sempre è disabilitato *con il motivo scritto*, non evitato dalla prudenza di chi scrive i
 *    testi.
 *
 * Modulo puro: non conosce `CareerState`. Restituisce **effetti dichiarativi** che `career.ts`
 * applica — così la conversazione resta testabile senza montare una carriera.
 */
import type { Department, Role } from "@app/shared-types";
import type { Commitment, CommitmentKind } from "./commitments";
import { makeCommitment } from "./commitments";
import { formatEuro, formatWage } from "./money";
import type { PlayerFacts } from "./playerFacts";
import type { TopicDemand, Topic, TopicId } from "./playerTopics";

/* -------------------------------------------------------------------------- */
/* Stato della conversazione                                                   */
/* -------------------------------------------------------------------------- */

export type DialogueStatus =
  | "aperta"
  /** Ha ottenuto ciò che gli serviva, senza debiti aperti. */
  | "riappacificato"
  /** Chiude bene, ma con un impegno da onorare. */
  | "accordo"
  /** Pazienza finita senza rottura: il problema resta e tornerà. */
  | "stallo"
  /** Frattura conclamata. */
  | "rottura";

export interface DialogueMessage {
  speaker: "giocatore" | "ds";
  text: string;
}

export interface Dialogue {
  playerId: string;
  playerName: string;
  topicId: TopicId;
  topicLabel: string;
  demand: TopicDemand;
  /** 0-100, si consuma in questa conversazione. */
  patience: number;
  patienceStart: number;
  /** 0-100, persistente: è la memoria del rapporto. */
  trust: number;
  status: DialogueStatus;
  log: DialogueMessage[];
  round: number;
  lastMoveKind?: DialogueMoveKind;
  sameMoveStreak: number;
  /** Fatti in evidenza nella scheda "Il suo caso". */
  highlights: string[];
  /** Se il tema è bloccante, la chat non si può chiudere senza risolverla. */
  forced: boolean;
}

export type DialogueMoveKind =
  | "ascolta"
  | "rassicura"
  | "garantisci_titolarita"
  | "prometti_rotazione"
  | "premio_denaro"
  | "adegua_ingaggio"
  | "offri_rinnovo"
  | "clausola_addio"
  | "promessa_rinforzo"
  | "promessa_trionfo"
  | "nomina_capitano"
  | "concedi_riposo"
  | "lista_cessione"
  | "concedi_prestito"
  | "prometti_trattativa_cessione"
  | "accetta_cessione"
  | "multa_disciplina"
  | "scegli_giocatore"
  | "scegli_mister"
  | "ignora";

export interface DialogueMove {
  kind: DialogueMoveKind;
  /** Reparto scelto dall'utente per `promessa_rinforzo`. */
  department?: Department;
}

/** Cosa la UI mostra su una carta-mossa **prima** del clic. */
export interface MoveOption {
  kind: DialogueMoveKind;
  label: string;
  /** Il costo dichiarato: cifra esatta, o condizione. */
  cost: string;
  /** Se disabilitata, il motivo. Mai un bottone morto e muto. */
  disabledReason?: string;
  /** `true` se è esattamente ciò che il giocatore ha chiesto. */
  answersDemand: boolean;
  risk: "nessuno" | "medio" | "rottura";
  /** Se la mossa contrae un impegno verificabile. */
  commits?: CommitmentKind;
}

/* -------------------------------------------------------------------------- */
/* Apertura                                                                    */
/* -------------------------------------------------------------------------- */

/** Pazienza iniziale: metà umore del momento, metà memoria del rapporto. */
export function initialPatience(facts: PlayerFacts): number {
  const base = 0.5 * facts.morale + 0.5 * facts.trust;
  const conFeud = facts.isFeuding ? base * 0.5 : base;
  return Math.round(Math.max(10, Math.min(90, conFeud)));
}

export function openDialogue(facts: PlayerFacts, topic: Topic): Dialogue {
  const patience = initialPatience(facts);
  return {
    playerId: facts.playerId,
    playerName: facts.name,
    topicId: topic.id,
    topicLabel: topic.label,
    demand: topic.demand(facts),
    patience,
    patienceStart: patience,
    trust: facts.trust,
    status: "aperta",
    log: [{ speaker: "giocatore", text: topic.opening(facts) }],
    round: 0,
    sameMoveStreak: 0,
    highlights: buildHighlights(facts),
    forced: topic.blocking === true,
  };
}

/** I fatti che il giocatore porta al tavolo: la UI li mostra come chip sopra la chat. */
function buildHighlights(f: PlayerFacts): string[] {
  const out: string[] = [`${f.appearances} pres.`, `${Math.round(f.playedShare * 100)}% minuti`];
  if (f.goals > 0) out.push(`${f.goals} gol`);
  if (f.assists > 0) out.push(`${f.assists} assist`);
  out.push(`${f.seasonsAtClub === 0 ? "primo anno" : `${f.seasonsAtClub} anni al club`}`);
  if (f.contract) out.push(`contratto ${f.seasonsLeft} ${f.seasonsLeft === 1 ? "anno" : "anni"}`);
  if (f.wage > 0) out.push(formatWage(f.wage));
  return out;
}

/* -------------------------------------------------------------------------- */
/* Mosse disponibili                                                           */
/* -------------------------------------------------------------------------- */

/** Le mosse che hanno senso per ciascun tema. `ignora` è sempre in fondo, e sempre possibile. */
const TOPIC_MOVES: Record<TopicId, DialogueMoveKind[]> = {
  poco_impiego: ["ascolta", "garantisci_titolarita", "prometti_rotazione", "lista_cessione", "concedi_prestito"],
  gerarchia_persa: ["ascolta", "garantisci_titolarita", "prometti_rotazione", "clausola_addio", "lista_cessione"],
  corteggiato: ["ascolta", "adegua_ingaggio", "offri_rinnovo", "promessa_trionfo", "prometti_trattativa_cessione", "accetta_cessione"],
  ambizione_progetto: ["ascolta", "promessa_rinforzo", "promessa_trionfo", "rassicura"],
  riconoscimento: ["ascolta", "adegua_ingaggio", "premio_denaro", "offri_rinnovo", "rassicura"],
  leadership: ["ascolta", "nomina_capitano", "rassicura", "offri_rinnovo"],
  fascia_tolta: ["ascolta", "rassicura", "nomina_capitano", "premio_denaro", "prometti_trattativa_cessione", "lista_cessione"],
  promessa_infranta: ["ascolta", "premio_denaro", "adegua_ingaggio", "prometti_trattativa_cessione", "lista_cessione", "accetta_cessione"],
  bivio_mister: ["scegli_giocatore", "scegli_mister"],
  giovane_crescita: ["ascolta", "garantisci_titolarita", "prometti_rotazione", "concedi_prestito"],
  sovraccarico: ["ascolta", "concedi_riposo", "rassicura"],
  compagno_ceduto: ["ascolta", "promessa_rinforzo", "promessa_trionfo", "rassicura"],
  rinnovo_richiesto: ["ascolta", "offri_rinnovo", "adegua_ingaggio", "rassicura"],
  ultimo_anno: ["ascolta", "offri_rinnovo", "clausola_addio", "lista_cessione"],
  precontratto: ["offri_rinnovo", "adegua_ingaggio", "nomina_capitano", "prometti_trattativa_cessione", "lista_cessione"],
  rifiuto_rinnovo: ["prometti_trattativa_cessione", "lista_cessione", "accetta_cessione", "multa_disciplina"],
  veterano_ultimo_contratto: ["ascolta", "offri_rinnovo", "clausola_addio", "rassicura"],
  squilibrio_ingaggi: ["ascolta", "adegua_ingaggio", "premio_denaro", "offri_rinnovo"],
};

export interface MoveContext {
  /** Liquidità della cassa mercato: serve ai premi una tantum. */
  transferCash: number;
  /** Margine della cassa ingaggi, €/anno: serve agli adeguamenti, che sono ricorrenti. */
  wageRoom: number;
  /** Ruolo della casella su cui si può garantire la titolarità. */
  slotRole?: Role;
  /** Il mister accetterebbe di dargli il posto? (calcolato sul rivale **vero**.) */
  coachWouldApprove: boolean;
  /** C'è già un capitano diverso da lui? */
  hasOtherCaptain: boolean;
  /** Reparto oggettivamente più scoperto, suggerito per la promessa di rinforzo. */
  weakestDepartment?: Department;
  season: number;
  matchday: number;
}

const PREMIO_QUOTA = 0.04;
const PREMIO_MINIMO = 200_000;

/** Il premio una tantum che quel giocatore si aspetta. */
export function bonusAmountFor(facts: PlayerFacts): number {
  return Math.max(PREMIO_MINIMO, Math.round((facts.marketValue * PREMIO_QUOTA) / 50_000) * 50_000);
}

/** L'adeguamento annuo che chiede. */
export function raiseAmountFor(facts: PlayerFacts): number {
  const gap = facts.wageVsPeers < 1 ? 1 / Math.max(0.4, facts.wageVsPeers) - 1 : 0.15;
  return Math.max(50_000, Math.round((facts.wage * Math.min(0.5, gap)) / 10_000) * 10_000);
}

/**
 * Le mosse proponibili, già annotate con costo e motivo dell'eventuale blocco.
 *
 * Il filtro trasversale — quello che impedisce di concedere ciò che il giocatore ha già — vale
 * per **tutte** le mosse, indipendentemente dal tema.
 */
export function availableMoves(
  dialogue: Dialogue,
  facts: PlayerFacts,
  ctx: MoveContext,
): MoveOption[] {
  const richieste = new Set(TOPIC_MOVES[dialogue.topicId] ?? []);
  const opzioni: MoveOption[] = [];
  const risponde = (k: DialogueMoveKind) => answersDemand(k, dialogue.topicId);

  const push = (o: MoveOption) => opzioni.push(o);

  if (richieste.has("ascolta")) {
    push({ kind: "ascolta", label: "Ascoltalo", cost: "Non impegna nulla", answersDemand: false, risk: "nessuno" });
  }

  if (richieste.has("rassicura")) {
    push({ kind: "rassicura", label: "Rassicuralo", cost: "Solo parole", answersDemand: risponde("rassicura"), risk: "nessuno" });
  }

  if (richieste.has("garantisci_titolarita")) {
    const giaTitolare = facts.isGuaranteedStarter
      ? "È già un titolare garantito"
      : facts.playedShare > 0.75
        ? "Gioca già praticamente sempre"
        : undefined;
    push({
      kind: "garantisci_titolarita",
      label: "Garantiscigli il posto",
      cost: ctx.coachWouldApprove ? "Richiede l'OK del mister" : "Il mister è contrario",
      disabledReason: giaTitolare,
      answersDemand: risponde("garantisci_titolarita"),
      risk: ctx.coachWouldApprove ? "medio" : "rottura",
      commits: "minuti",
    });
  }

  if (richieste.has("prometti_rotazione")) {
    push({
      kind: "prometti_rotazione",
      label: "Promettigli spazio",
      cost: "Deve giocare 2 volte entro 5 giornate",
      disabledReason: hasOpen(facts, "minuti") ? "Gliene hai già promessi: mantienili prima" : undefined,
      answersDemand: risponde("prometti_rotazione"),
      risk: "medio",
      commits: "minuti",
    });
  }

  if (richieste.has("premio_denaro")) {
    const importo = bonusAmountFor(facts);
    push({
      kind: "premio_denaro",
      label: "Premio una tantum",
      cost: `${formatEuro(importo)} dalla cassa mercato`,
      disabledReason: ctx.transferCash < importo ? `Liquidità insufficiente (${formatEuro(ctx.transferCash)})` : undefined,
      answersDemand: risponde("premio_denaro"),
      risk: "nessuno",
    });
  }

  if (richieste.has("adegua_ingaggio")) {
    const importo = raiseAmountFor(facts);
    push({
      kind: "adegua_ingaggio",
      label: "Adegua l'ingaggio",
      cost: `+${formatWage(importo)} · margine ${formatEuro(ctx.wageRoom)}`,
      disabledReason:
        !facts.contract
          ? "Non ha un contratto da adeguare"
          : ctx.wageRoom < importo
            ? `Margine insufficiente: sposta le finanze o vendi prima (${formatEuro(ctx.wageRoom)})`
            : undefined,
      answersDemand: risponde("adegua_ingaggio"),
      risk: "nessuno",
    });
  }

  if (richieste.has("offri_rinnovo")) {
    push({
      kind: "offri_rinnovo",
      label: "Apri il tavolo del rinnovo",
      cost: "Si negozia cifra, durata e garanzie",
      disabledReason:
        facts.seasonsLeft >= 3
          ? `Ha ancora ${facts.seasonsLeft} anni: non ha motivo di ridiscuterne`
          : undefined,
      answersDemand: risponde("offri_rinnovo"),
      risk: "medio",
    });
  }

  if (richieste.has("clausola_addio")) {
    push({
      kind: "clausola_addio",
      label: "Promettigli l'addio a fine anno",
      cost: "Resta ora, parte a giugno",
      answersDemand: risponde("clausola_addio"),
      risk: "medio",
      commits: "clausola_addio",
    });
  }

  if (richieste.has("promessa_rinforzo")) {
    push({
      kind: "promessa_rinforzo",
      label: "Prometti un rinforzo",
      cost: "Verificato a fine mercato",
      disabledReason: hasOpen(facts, "rinforzo") ? "Gliene hai già promesso uno" : undefined,
      answersDemand: risponde("promessa_rinforzo"),
      risk: "medio",
      commits: "rinforzo",
    });
  }

  if (richieste.has("promessa_trionfo")) {
    push({
      kind: "promessa_trionfo",
      label: "Prometti una stagione da vertice",
      cost: "Verificata a fine stagione",
      disabledReason: hasOpen(facts, "trionfo") ? "Gliel'hai già promessa" : undefined,
      answersDemand: risponde("promessa_trionfo"),
      risk: "medio",
      commits: "trionfo",
    });
  }

  if (richieste.has("nomina_capitano")) {
    push({
      kind: "nomina_capitano",
      label: "Dagli la fascia",
      cost: ctx.hasOtherCaptain ? "Toglie la fascia all'attuale capitano" : "Nessun costo economico",
      disabledReason: facts.isCaptain ? "È già il capitano" : undefined,
      answersDemand: risponde("nomina_capitano"),
      risk: ctx.hasOtherCaptain ? "medio" : "nessuno",
      commits: "capitano",
    });
  }

  if (richieste.has("concedi_riposo")) {
    push({
      kind: "concedi_riposo",
      label: "Fallo rifiatare",
      cost: "Fuori per 2 giornate",
      answersDemand: risponde("concedi_riposo"),
      risk: "nessuno",
      commits: "riposo",
    });
  }

  if (richieste.has("lista_cessione")) {
    push({
      kind: "lista_cessione",
      label: "Mettilo in lista",
      cost: facts.arrivedThisSeason ? "È appena arrivato: pessimo segnale" : "Perde valore in trattativa",
      disabledReason: facts.isOnTransferList ? "È già in lista trasferimenti" : undefined,
      answersDemand: risponde("lista_cessione"),
      risk: "nessuno",
    });
  }

  if (richieste.has("concedi_prestito")) {
    push({
      kind: "concedi_prestito",
      label: "Mandalo in prestito",
      cost: "Torna a fine stagione, cresciuto",
      disabledReason:
        facts.age > 23 ? "Ha più di 23 anni: nessun club lo prende in prestito" : facts.isOnLoanList ? "È già in lista prestiti" : undefined,
      answersDemand: risponde("concedi_prestito"),
      risk: "nessuno",
    });
  }

  if (richieste.has("prometti_trattativa_cessione")) {
    push({
      kind: "prometti_trattativa_cessione",
      label: "Prometti di trattarne la cessione",
      cost: "Va in lista, ma tratti tu il prezzo",
      answersDemand: risponde("prometti_trattativa_cessione"),
      risk: "nessuno",
    });
  }

  if (richieste.has("accetta_cessione") && facts.incomingOffer) {
    push({
      kind: "accetta_cessione",
      label: `Accetta ${formatEuro(facts.incomingOffer.fee)}`,
      cost: `Cessione al ${facts.incomingOffer.clubName}`,
      answersDemand: true,
      risk: "nessuno",
    });
  }

  if (richieste.has("multa_disciplina")) {
    push({ kind: "multa_disciplina", label: "Multalo", cost: "Morale a picco", answersDemand: false, risk: "rottura" });
  }

  if (richieste.has("scegli_giocatore")) {
    push({ kind: "scegli_giocatore", label: "Scegli il giocatore", cost: "Il mister si dimette", answersDemand: true, risk: "rottura" });
  }
  if (richieste.has("scegli_mister")) {
    push({ kind: "scegli_mister", label: "Scegli il mister", cost: "Rottura col giocatore", answersDemand: false, risk: "rottura" });
  }

  if (dialogue.topicId !== "bivio_mister") {
    push({ kind: "ignora", label: "Ignoralo", cost: "Nessun impegno, ma se lo ricorderà", answersDemand: false, risk: "rottura" });
  }

  return opzioni;
}

function hasOpen(facts: PlayerFacts, kind: CommitmentKind): boolean {
  return facts.openCommitments.some((c) => c.kind === kind);
}

function answersDemand(kind: DialogueMoveKind, topic: TopicId): boolean {
  const risposte: Partial<Record<TopicId, DialogueMoveKind[]>> = {
    poco_impiego: ["garantisci_titolarita", "prometti_rotazione", "concedi_prestito"],
    gerarchia_persa: ["garantisci_titolarita", "prometti_rotazione"],
    corteggiato: ["adegua_ingaggio", "offri_rinnovo", "accetta_cessione"],
    ambizione_progetto: ["promessa_rinforzo", "promessa_trionfo"],
    riconoscimento: ["adegua_ingaggio", "premio_denaro"],
    leadership: ["nomina_capitano"],
    fascia_tolta: ["nomina_capitano"],
    promessa_infranta: ["premio_denaro", "adegua_ingaggio", "prometti_trattativa_cessione", "accetta_cessione"],
    giovane_crescita: ["garantisci_titolarita", "concedi_prestito"],
    sovraccarico: ["concedi_riposo"],
    compagno_ceduto: ["promessa_rinforzo"],
    rinnovo_richiesto: ["offri_rinnovo"],
    ultimo_anno: ["offri_rinnovo", "clausola_addio"],
    precontratto: ["offri_rinnovo", "adegua_ingaggio"],
    rifiuto_rinnovo: ["prometti_trattativa_cessione", "accetta_cessione"],
    veterano_ultimo_contratto: ["offri_rinnovo", "clausola_addio"],
    squilibrio_ingaggi: ["adegua_ingaggio"],
  };
  return (risposte[topic] ?? []).includes(kind);
}

/* -------------------------------------------------------------------------- */
/* Applicazione di una mossa                                                   */
/* -------------------------------------------------------------------------- */

export interface DialogueEffects {
  dialogue: Dialogue;
  moraleDelta: number;
  trustDelta: number;
  /** Variazione della liquidità di mercato (premi, multe). */
  transferCashDelta: number;
  /** Variazione dell'ingaggio **annuo** del giocatore. */
  wageDelta: number;
  commitments: Commitment[];
  listForTransfer?: boolean;
  listForLoan?: boolean;
  sellNow?: boolean;
  /**
   * Gli è stato promesso di lasciarlo partire.
   *
   * Il riduttore lo registra sul rapporto (`salePromisedAtWindow`) e da lì il giocatore **tace
   * fino alla sessione di mercato successiva** — vedi `playerTopics.ts`. Serve un flag distinto
   * da `listForTransfer` perché mettere in lista è anche una decisione unilaterale del DS, presa
   * dalla schermata Rosa, che non comporta nessuna parola data al giocatore.
   */
  salePromised?: boolean;
  setCaptain?: boolean;
  restMatchdays?: number;
  guaranteeRole?: Role;
  /** Apre il tavolo del rinnovo (`negotiation.ts`, tipo "rinnovo"). */
  openRenewal?: boolean;
  coachResigns?: boolean;
  coachBenches?: boolean;
  /** Contagio nello spogliatoio: chi è leader trascina il gruppo. */
  dressingRoomDelta?: { department: Department; delta: number };
  errorMessage?: string;
}

interface MoveProfile {
  cost: number;
  morale: number;
  trust: number;
  dsText: (f: PlayerFacts, ctx: MoveContext) => string;
  reply: { early: string; late: string };
  /** Chiude subito la conversazione con questo esito. */
  closes?: DialogueStatus;
}

const PROFILES: Record<DialogueMoveKind, MoveProfile> = {
  ascolta: {
    cost: -8,
    morale: 2,
    trust: 1,
    dsText: () => "Ti ascolto. Dimmi tutto, con calma.",
    reply: { early: "Almeno qualcuno mi ascolta. Allora glielo dico chiaro...", late: "Le parole le abbiamo finite, Direttore." },
  },
  rassicura: {
    cost: 22,
    morale: 8,
    trust: 2,
    dsText: () => "Hai la mia fiducia. Da adesso qualcosa cambia.",
    reply: { early: "Sentiamo... ma le parole da sole non bastano.", late: "Va bene, mi fido. Ora però voglio i fatti." },
  },
  garantisci_titolarita: {
    cost: 30,
    morale: 18,
    trust: 6,
    dsText: () => "Ho parlato col mister: da ora in avanti la maglia è tua.",
    reply: { early: "Questo sì che è un impegno. Aspetto di vederlo in campo.", late: "Bene. Non deludetemi." },
  },
  prometti_rotazione: {
    cost: 24,
    morale: 11,
    trust: 4,
    dsText: () => "Non ti prometto il posto fisso, ma spazio vero sì: lo vedrai presto.",
    reply: { early: "Accetto. Ma voglio vederlo nelle prossime partite.", late: "Va bene, ci provo ancora una volta." },
  },
  premio_denaro: {
    cost: 20,
    morale: 16,
    trust: 3,
    dsText: (f) => `Ecco un premio di ${formatEuro(bonusAmountFor(f))}: la società riconosce il tuo valore.`,
    reply: { early: "Un gesto concreto. Apprezzo.", late: "Va bene, Direttore. Ma i soldi non risolvono tutto." },
  },
  adegua_ingaggio: {
    cost: 26,
    morale: 20,
    trust: 10,
    dsText: (f) => `Ti adeguo l'ingaggio di ${formatWage(raiseAmountFor(f))}: era giusto così.`,
    reply: { early: "Era ciò che chiedevo. Grazie, Direttore.", late: "Bene. Adesso ci siamo." },
  },
  offri_rinnovo: {
    cost: 18,
    morale: 6,
    trust: 2,
    dsText: () => "Sediamoci e parliamo di un nuovo contratto: cifra, durata, garanzie.",
    reply: { early: "Va bene, sentiamo cosa avete da propormi.", late: "Finalmente. Vediamo se fate sul serio." },
  },
  clausola_addio: {
    cost: 32,
    morale: 14,
    trust: 8,
    dsText: () => "Restiamo insieme fino a giugno, poi ti lascio andare. Hai la mia parola.",
    reply: { early: "Ci sto. Chiudiamo insieme questa stagione.", late: "Accetto. Ma la parola è parola." },
  },
  promessa_rinforzo: {
    cost: 28,
    morale: 12,
    trust: 3,
    dsText: (_f, ctx) =>
      `Ti prometto un rinforzo vero ${reparto(ctx.weakestDepartment)}: alzeremo il livello.`,
    reply: { early: "Bello a dirsi. Vediamo se arriva.", late: "Aspetto di vederlo entro fine mercato." },
  },
  promessa_trionfo: {
    cost: 26,
    morale: 12,
    trust: 3,
    dsText: () => "Ti prometto che quest'anno lottiamo per il vertice. Fidati del progetto.",
    reply: { early: "Belle parole. Le prendo, con gli occhi aperti.", late: "Va bene, ci sto. Ma me lo ricorderò." },
  },
  nomina_capitano: {
    cost: 30,
    morale: 22,
    trust: 12,
    dsText: () => "La fascia è tua. Questo spogliatoio ha bisogno della tua voce.",
    reply: { early: "È un onore, Direttore. Non ve ne pentirete.", late: "Grazie. Me ne prendo la responsabilità." },
  },
  concedi_riposo: {
    cost: 25,
    morale: 12,
    trust: 4,
    dsText: () => "Ti fermo due giornate: torna quando sei di nuovo tu.",
    reply: { early: "Grazie, ne avevo bisogno davvero.", late: "Bene. Rientro più fresco." },
  },
  lista_cessione: {
    cost: 40,
    morale: 10,
    trust: 0,
    dsText: () => "Ti metto in lista: se arriva l'offerta giusta, non ti trattengo.",
    reply: { early: "Era quello che volevo sentire.", late: "Va bene così. Meglio la chiarezza." },
    closes: "accordo",
  },
  concedi_prestito: {
    cost: 40,
    morale: 20,
    trust: 6,
    dsText: () => "Ti mando a giocare altrove: torna con più partite nelle gambe.",
    reply: { early: "Finalmente il campo vero. Grazie.", late: "Accetto. Ci vediamo l'anno prossimo." },
    closes: "accordo",
  },
  prometti_trattativa_cessione: {
    cost: 40,
    morale: 12,
    trust: 5,
    dsText: () => "Accetto la tua volontà: tratterò la cessione alle condizioni migliori possibili.",
    reply: { early: "Mi fido. Ma non tirate troppo la corda.", late: "Va bene, Direttore." },
    closes: "accordo",
  },
  accetta_cessione: {
    cost: 100,
    morale: 20,
    trust: 0,
    dsText: (f) =>
      `Accetto l'offerta del ${f.incomingOffer?.clubName ?? "club"}: sei libero di andare.`,
    reply: { early: "Grazie di tutto, Direttore.", late: "Grazie di tutto." },
    closes: "riappacificato",
  },
  multa_disciplina: {
    cost: 100,
    morale: -25,
    trust: -20,
    dsText: () => "Questo atteggiamento è inaccettabile: ti multo.",
    reply: { early: "Con me avete chiuso, Direttore.", late: "Con me avete chiuso." },
    closes: "rottura",
  },
  scegli_giocatore: {
    cost: 100,
    morale: 25,
    trust: 20,
    dsText: () => "Ho deciso: resti tu. Il mister lascia il club.",
    reply: { early: "Grazie per aver creduto in me.", late: "Grazie, Direttore." },
    closes: "riappacificato",
  },
  scegli_mister: {
    cost: 100,
    morale: -30,
    trust: -25,
    dsText: () => "Il progetto va avanti col mister. Mi dispiace.",
    reply: { early: "Capisco. Ma non aspettatevi lo stesso da me.", late: "Capisco." },
    closes: "rottura",
  },
  ignora: {
    cost: 45,
    morale: -14,
    trust: -8,
    dsText: () => "Per ora resti così: non ho risposte da darti.",
    reply: { early: "Non è la risposta che aspettavo.", late: "Con me hai chiuso, Direttore." },
  },
};

function reparto(dep?: Department): string {
  const it: Record<Department, string> = { POR: "in porta", DIF: "in difesa", CC: "a centrocampo", ATT: "in attacco" };
  return dep ? it[dep] : "in rosa";
}

/**
 * Applica una mossa e restituisce gli **effetti dichiarativi**.
 *
 * Chi chiama (`career.ts`) li traduce in cambiamenti di stato: qui non si tocca nulla, ed è ciò
 * che rende la conversazione testabile senza montare una carriera.
 */
export function applyDialogueMove(
  dialogue: Dialogue,
  facts: PlayerFacts,
  move: DialogueMove,
  ctx: MoveContext,
): DialogueEffects {
  const vuoto: DialogueEffects = {
    dialogue,
    moraleDelta: 0,
    trustDelta: 0,
    transferCashDelta: 0,
    wageDelta: 0,
    commitments: [],
  };
  if (dialogue.status !== "aperta") return vuoto;

  const opzione = availableMoves(dialogue, facts, ctx).find((o) => o.kind === move.kind);
  if (!opzione) return { ...vuoto, errorMessage: "Mossa non disponibile in questa conversazione." };
  if (opzione.disabledReason) return { ...vuoto, errorMessage: opzione.disabledReason };

  const profilo = PROFILES[move.kind];
  const ripetuta = dialogue.lastMoveKind === move.kind;
  // Ripetere la stessa proposta consuma il doppio: è il modo in cui la conversazione punisce chi
  // gira a vuoto invece di rispondere alla richiesta.
  const costo = ripetuta ? profilo.cost * 2 : profilo.cost;

  let moraleDelta = profilo.morale;
  let trustDelta = profilo.trust;
  const effetti: DialogueEffects = { ...vuoto, commitments: [] };

  // Il mister può rifiutare la titolarità: la promessa fallisce e la frattura è immediata.
  const titolaritaNegata = move.kind === "garantisci_titolarita" && !ctx.coachWouldApprove;

  switch (move.kind) {
    case "premio_denaro":
      effetti.transferCashDelta = -bonusAmountFor(facts);
      break;
    case "multa_disciplina":
      effetti.transferCashDelta = 100_000;
      break;
    case "adegua_ingaggio":
      effetti.wageDelta = raiseAmountFor(facts);
      break;
    case "garantisci_titolarita":
      if (!titolaritaNegata) {
        effetti.guaranteeRole = ctx.slotRole ?? facts.role;
        effetti.commitments.push(
          impegno("minuti", facts, ctx, { minStarts: 3 }, ctx.matchday + 5, "matchday", "Titolare garantito"),
        );
      }
      break;
    case "prometti_rotazione":
      effetti.commitments.push(
        impegno("minuti", facts, ctx, { minStarts: 2 }, ctx.matchday + 5, "matchday", "Spazio promesso"),
      );
      break;
    case "promessa_rinforzo":
      effetti.commitments.push(
        impegno(
          "rinforzo",
          facts,
          ctx,
          { department: move.department ?? ctx.weakestDepartment ?? facts.department },
          ctx.season,
          "window",
          `Rinforzo promesso ${reparto(move.department ?? ctx.weakestDepartment)}`,
        ),
      );
      break;
    case "promessa_trionfo":
      effetti.commitments.push(
        impegno("trionfo", facts, ctx, {}, ctx.season, "season", "Stagione da vertice promessa"),
      );
      break;
    case "clausola_addio":
      effetti.commitments.push(
        impegno("clausola_addio", facts, ctx, { targetPlayerId: facts.playerId }, ctx.season, "season", "Addio concordato a fine stagione"),
      );
      effetti.listForTransfer = true;
      effetti.salePromised = true;
      break;
    case "nomina_capitano":
      effetti.setCaptain = true;
      effetti.commitments.push(
        impegno("capitano", facts, ctx, {}, ctx.season, "season", "Fascia da capitano"),
      );
      break;
    case "concedi_riposo":
      effetti.restMatchdays = 2;
      break;
    case "lista_cessione":
    case "prometti_trattativa_cessione":
      effetti.listForTransfer = true;
      effetti.salePromised = true;
      break;
    case "concedi_prestito":
      effetti.listForLoan = true;
      effetti.salePromised = true;
      break;
    case "accetta_cessione":
      effetti.sellNow = true;
      break;
    case "offri_rinnovo":
      effetti.openRenewal = true;
      break;
    case "scegli_giocatore":
      effetti.coachResigns = true;
      break;
    default:
      break;
  }

  if (titolaritaNegata) {
    moraleDelta = -20;
    trustDelta = -10;
  }

  const patience = profilo.closes || titolaritaNegata ? 0 : Math.max(0, dialogue.patience - costo);

  let status: DialogueStatus = "aperta";
  if (titolaritaNegata) status = "rottura";
  else if (profilo.closes) status = profilo.closes;
  else if (patience <= 0) {
    if (move.kind === "ignora") status = "rottura";
    else if (opzione.answersDemand) status = opzione.commits ? "accordo" : "riappacificato";
    else status = "stallo";
  } else if (opzione.answersDemand && opzione.commits === undefined && move.kind !== "ascolta") {
    // Ha ottenuto esattamente ciò che chiedeva, senza debiti: la conversazione può chiudersi bene
    // subito, senza costringere l'utente a premere altri due bottoni per arrivarci.
    status = "riappacificato";
  } else if (opzione.answersDemand && opzione.commits) {
    status = "accordo";
  }

  if (status === "rottura") {
    moraleDelta = Math.min(moraleDelta, -18);
    trustDelta = Math.min(trustDelta, -30);
  }
  if (status === "stallo") {
    moraleDelta -= 5;
    trustDelta -= 5;
  }

  // Il contagio: un senatore che si riappacifica solleva il reparto, uno che rompe lo trascina giù.
  if (facts.personality === "leader" && (status === "rottura" || status === "riappacificato")) {
    effetti.dressingRoomDelta = { department: facts.department, delta: status === "rottura" ? -4 : 3 };
  }
  if (status === "rottura" && dialogue.topicId === "bivio_mister" && move.kind === "ignora") {
    effetti.coachBenches = true;
  }

  const testoRisposta = titolaritaNegata
    ? "Quindi il mister decide e voi non contate niente? Con me avete chiuso."
    : patience <= 0
      ? profilo.reply.late
      : profilo.reply.early;

  return {
    ...effetti,
    dialogue: {
      ...dialogue,
      patience,
      status,
      round: dialogue.round + 1,
      lastMoveKind: move.kind,
      sameMoveStreak: ripetuta ? dialogue.sameMoveStreak + 1 : 0,
      trust: Math.max(0, Math.min(100, dialogue.trust + trustDelta)),
      log: [
        ...dialogue.log,
        { speaker: "ds", text: profilo.dsText(facts, ctx) },
        { speaker: "giocatore", text: testoRisposta },
      ],
    },
    moraleDelta,
    trustDelta,
  };
}

function impegno(
  kind: CommitmentKind,
  facts: PlayerFacts,
  ctx: MoveContext,
  payload: Commitment["payload"],
  deadline: number,
  verifyAt: Commitment["verifyAt"],
  description: string,
): Commitment {
  return makeCommitment(kind, {
    playerId: facts.playerId,
    verifyAt,
    deadline,
    payload,
    madeSeason: ctx.season,
    madeWeek: ctx.matchday,
    description,
  });
}

/** Riassunto delle conseguenze, per la schermata d'esito. */
export function outcomeSummary(status: DialogueStatus): { title: string; tone: "verde" | "ambra" | "rosso" } {
  switch (status) {
    case "riappacificato":
      return { title: "Riappacificato", tone: "verde" };
    case "accordo":
      return { title: "Accordo trovato", tone: "ambra" };
    case "stallo":
      return { title: "Nessun accordo", tone: "ambra" };
    case "rottura":
      return { title: "Rapporto rotto", tone: "rosso" };
    default:
      return { title: "Conversazione in corso", tone: "ambra" };
  }
}
