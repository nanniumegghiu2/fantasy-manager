/**
 * **I temi**: di cosa un giocatore può davvero parlare, adesso.
 *
 * Il cuore della riscrittura. Ogni tema dichiara le proprie **precondizioni sui fatti**
 * (`playerFacts.ts`), e valgono due regole che rendono il caso assurdo impossibile *per
 * costruzione* invece che evitato da un testo più prudente:
 *
 *  1. **se nessun tema è ammissibile, la conversazione non si apre.** Non esiste un tema generico
 *     di ripiego — è sparita la categoria residuale `"scontento"`, il buco da cui usciva il
 *     titolare inamovibile che chiedeva di essere confermato titolare;
 *  2. **nessuna mossa può concedere ciò che il giocatore ha già** (filtro in `playerDialogue.ts`).
 *
 * Il catalogo è una tabella: aggiungere un argomento è una riga, non un ramo nel motore.
 */
import type { Department } from "@app/shared-types";
import type { PlayerFacts } from "./playerFacts";
import { formatEuro } from "./money";

export type TopicId =
  /* — campo — */
  | "poco_impiego"
  | "gerarchia_persa"
  | "corteggiato"
  | "ambizione_progetto"
  | "riconoscimento"
  | "leadership"
  | "fascia_tolta"
  | "promessa_infranta"
  | "bivio_mister"
  | "giovane_crescita"
  | "sovraccarico"
  | "compagno_ceduto"
  /* — contratto — */
  | "rinnovo_richiesto"
  | "ultimo_anno"
  | "precontratto"
  | "rifiuto_rinnovo"
  | "veterano_ultimo_contratto"
  | "squilibrio_ingaggi";

export interface TopicDemand {
  /** Cosa serve, in una riga, mostrata in cima alla chat. */
  description: string;
  /** Il reparto coinvolto, quando la richiesta è un rinforzo. */
  department?: Department;
  /** La cifra in gioco, quando la richiesta è economica. */
  amount?: number;
}

export interface Topic {
  id: TopicId;
  /** Etichetta breve per la lista dello Spogliatoio. */
  label: string;
  /** Se `false` il tema **non può aprirsi**. */
  eligible: (f: PlayerFacts) => boolean;
  /** 0-100: fra gli ammissibili parla il più urgente. */
  urgency: (f: PlayerFacts) => number;
  demand: (f: PlayerFacts) => TopicDemand;
  /** La battuta d'apertura, coi numeri veri dentro. */
  opening: (f: PlayerFacts) => string;
  /** Se il tema è così grave da fermare la corsa delle giornate. */
  blocking?: boolean;
}

/** Giornate di tregua personale dopo una conversazione chiusa bene. */
export const TALK_COOLDOWN = 8;

/**
 * Quanti casi lo Spogliatoio tiene aperti insieme (oltre a quelli **bloccanti**, che passano
 * sempre).
 *
 * Non è una comodità di interfaccia, è la regola di prodotto: in un club vero non ci sono
 * quattordici casi contemporaneamente sul tavolo del direttore sportivo. Senza tetto, a gennaio
 * ogni riserva con pochi minuti apriva la sua pratica e l'elenco diventava un ufficio reclami —
 * segnalato dall'utente con quattordici richieste di cessione nella stessa finestra. Chi resta
 * fuori non è "risolto": è meno urgente, e tornerà quando lo diventerà.
 */
export const MAX_OPEN_CASES = 4;
/** Minimo di giornate disponibili prima che un discorso sul minutaggio abbia senso. */
const MIN_MATCHDAYS_FOR_MINUTES = 6;

/**
 * Le fasce di urgenza, e perché sono un tetto e non un suggerimento.
 *
 * Le formule di urgenza sommano scarti (minuti mancanti, punti sotto l'obiettivo…) e senza un
 * limite una lamentela ordinaria molto acuta può scavalcare un'emergenza. Il caso concreto che
 * ha imposto la regola: un giocatore con zero minuti superava il **precontratto** di un rivale,
 * cioè il DS si trovava davanti "vuole giocare" mentre stava per perdere un big a parametro zero.
 * Le emergenze hanno una fascia riservata sopra tutto il resto.
 */
const URGENZA_ORDINARIA = 85;
const URGENZA_EMERGENZA = { promessaInfranta: 90, precontratto: 94, bivio: 98 } as const;

const ordinaria = (v: number) => Math.max(0, Math.min(URGENZA_ORDINARIA, Math.round(v)));

const percentuale = (v: number) => `${Math.round(v * 100)}%`;

/** Sopra questo morale un giocatore accetta il suo ruolo: non è contento, è **sereno**. */
const MORALE_SERENO = 62;

/**
 * **Ha davvero titolo per lamentarsi della panchina?**
 *
 * La condizione che mancava, ed è la causa delle richieste di massa: `playedShare < 0.3` è vera
 * per *metà rosa* a gennaio — undici giocano, quattordici no. Ma stare in panchina è una
 * lamentela solo per chi può ragionevolmente pretendere il posto: chi vale quanto la squadra, o
 * chi è alla pari del compagno che gli sta davanti nella sua casella. Un rincalzo sei punti
 * sotto la media della rosa la panchina se l'aspetta.
 *
 * `bestRivalOverallInRole` vale `-1` quando **nessun altro** copre quel ruolo: lì il titolo a
 * giocare è ovvio, e la condizione passa da sola.
 */
function pretendeIlPosto(f: PlayerFacts): boolean {
  return f.overall >= f.squadAverage - 1 || f.overall >= f.bestRivalOverallInRole - 2;
}

export const TOPICS: Topic[] = [
  /* ------------------------------------------------------------------ campo */
  {
    id: "poco_impiego",
    label: "Vuole più spazio",
    eligible: (f) =>
      f.playedShare < 0.3 &&
      f.matchdaysAvailable >= MIN_MATCHDAYS_FOR_MINUTES &&
      f.injuryMatchdaysLeft === 0 &&
      !f.arrivedThisSeason &&
      !f.onLoanOut &&
      f.morale < MORALE_SERENO &&
      pretendeIlPosto(f),
    urgency: (f) => ordinaria(55 + (0.3 - f.playedShare) * 100 + (f.overall - f.squadAverage) * 2),
    demand: () => ({ description: "Pretende spazio da titolare, o valuterà di andarsene." }),
    opening: (f) =>
      f.appearances > 0
        ? `Direttore, ${f.appearances} presenze e il ${percentuale(f.playedShare)} dei minuti. Così non va: o gioco, o è meglio che io vada altrove.`
        : `Non ho ancora messo piede in campo, Direttore. Le sembra normale?`,
  },
  {
    id: "gerarchia_persa",
    label: "Ha perso il posto",
    eligible: (f) =>
      (f.lastSeasonPlayedShare ?? 0) >= 0.6 &&
      f.playedShare < 0.45 &&
      f.matchdaysAvailable >= MIN_MATCHDAYS_FOR_MINUTES &&
      f.injuryMatchdaysLeft === 0 &&
      !f.onLoanOut &&
      f.morale < MORALE_SERENO + 6,
    urgency: (f) => ordinaria(60 + ((f.lastSeasonPlayedShare ?? 0) - f.playedShare) * 60),
    demand: () => ({ description: "Vuole capire perché è passato da titolare a comprimario." }),
    opening: (f) =>
      `L'anno scorso giocavo sempre, quest'anno sono al ${percentuale(f.playedShare)} dei minuti. Cos'è cambiato, Direttore?`,
  },
  {
    id: "corteggiato",
    label: "Corteggiato da un club",
    /**
     * Un'offerta sul tavolo non basta: la porta al DS solo chi ne è **tentato** — perché chiama
     * un club più blasonato, perché qui gioca poco, o perché sta già male. Chi è titolare
     * sereno in un club all'altezza lascia che siano le società a parlarsi, e infatti nella
     * realtà non è lui a bussare.
     */
    eligible: (f) =>
      !!f.incomingOffer &&
      !f.onLoanOut &&
      ((f.incomingOffer?.prestige ?? 3) >= 4 ||
        f.playedShare < 0.45 ||
        f.morale < MORALE_SERENO ||
        f.isOnTransferList),
    urgency: (f) => ordinaria(70 + (f.incomingOffer?.prestige ?? 3) * 4),
    demand: (f) => ({
      description: f.incomingOffer
        ? `Pretende che valutiate l'offerta del ${f.incomingOffer.clubName}.`
        : "Pretende che valutiate l'offerta ricevuta.",
      amount: f.incomingOffer?.fee,
    }),
    opening: (f) =>
      f.incomingOffer
        ? `Il ${f.incomingOffer.clubName} ha presentato ${formatEuro(f.incomingOffer.fee)} per me. Per la mia carriera è un'occasione: ditemi perché dovrei restare.`
        : `C'è un club che mi vuole davvero. Voi cosa avete da dirmi?`,
  },
  {
    id: "ambizione_progetto",
    label: "Dubita del progetto",
    eligible: (f) =>
      f.playedShare >= 0.55 &&
      !f.onLoanOut &&
      (f.positionsBelowTarget >= 4 || f.overall >= f.squadAverage + 6),
    urgency: (f) => ordinaria(40 + f.positionsBelowTarget * 3 + Math.max(0, f.overall - f.squadAverage)),
    demand: () => ({
      description: "Chiede rinforzi veri: non gli basta giocare, vuole vincere.",
    }),
    opening: (f) =>
      f.positionsBelowTarget >= 4
        ? `Siamo molto sotto quello che ci eravamo detti a inizio anno. Io ci metto tutto, ma da soli non ce la facciamo: servono rinforzi.`
        : `Direttore, io qui ci sto bene. Ma se vogliamo davvero puntare in alto questa rosa va alzata.`,
  },
  {
    id: "riconoscimento",
    label: "Vuole essere riconosciuto",
    eligible: (f) =>
      f.overUnderPerformance > 0 && f.seasonsAtClub >= 2 && f.playedShare >= 0.5 && f.wageVsPeers < 1,
    urgency: (f) => ordinaria(35 + f.overUnderPerformance * 2 + (1 - f.wageVsPeers) * 30),
    demand: (f) => ({
      description: "Chiede un adeguamento: rende più di quanto il suo contratto dica.",
      amount: Math.round(f.wage * 0.25),
    }),
    opening: (f) =>
      `${f.goals + f.assists > 0 ? `${f.goals} gol e ${f.assists} assist` : "Il mio rendimento"}, e sono il più sottopagato del reparto. Non le sembra il momento di parlarne?`,
  },
  {
    id: "leadership",
    label: "Vuole la fascia",
    /**
     * **La chiedono in due, e solo in due**: le bandiere e chi è nettamente più forte del resto
     * della rosa (`captaincy.ts`). Prima bastava essere di personalità "leader" da tre anni, e
     * la richiesta arrivava anche da chi nello spogliatoio non contava nulla.
     */
    eligible: (f) => f.wantsCaptaincy && !f.isCaptain && f.playedShare >= 0.4,
    urgency: (f) => ordinaria(35 + (f.captaincy.score - 55)),
    demand: () => ({ description: "Chiede la fascia da capitano e un peso vero nello spogliatoio." }),
    opening: (f) =>
      f.captaincy.isBandiera
        ? `Sono qui da ${f.seasonsAtClub} anni, Direttore: se c'è uno che questa maglia la rappresenta, sono io. Voglio la fascia.`
        : `Sono il migliore di questa squadra e me ne prendo la responsabilità. Datemi la fascia e vi porto il gruppo.`,
  },
  {
    id: "fascia_tolta",
    label: "Gli hai tolto la fascia",
    /**
     * L'innesco più duro che ci sia: non è una richiesta, è un torto subito. Bloccante, perché
     * lasciarlo in sospeso mentre le giornate scorrono sarebbe la cosa peggiore da fare.
     */
    eligible: (f) => f.lostCaptaincy && !f.isCaptain,
    urgency: () => URGENZA_EMERGENZA.precontratto - 2,
    demand: () => ({ description: "Pretende una spiegazione: la fascia gli è stata tolta." }),
    opening: (f) =>
      f.captaincy.isBandiera
        ? `${f.seasonsAtClub} anni qui dentro, e mi togliete la fascia senza dirmi niente. Vi rendete conto?`
        : `Mi avete tolto la fascia. Se non era per me, non dovevate darmela: adesso spiegatemi.`,
    blocking: true,
  },
  {
    id: "promessa_infranta",
    label: "Fiducia tradita",
    eligible: (f) => f.brokenCommitments > 0 || f.isFeuding,
    urgency: (f) => Math.min(URGENZA_EMERGENZA.precontratto - 1, URGENZA_EMERGENZA.promessaInfranta + f.brokenCommitments * 2),
    demand: () => ({ description: "Non accetta più parole: o un fatto concreto, o se ne va." }),
    opening: (f) =>
      f.brokenCommitments > 1
        ? `Mi avete promesso delle cose ${f.brokenCommitments} volte e non ne è arrivata una. Perché dovrei ancora ascoltarvi?`
        : `Mi avevate promesso una cosa precisa e non l'avete mantenuta. La fiducia, adesso, dovete ricostruirla voi.`,
    blocking: true,
  },
  {
    id: "bivio_mister",
    label: "Ultimatum sul mister",
    eligible: (f) =>
      (f.isGuaranteedStarter || f.isCoachUntouchable || f.isCoachBenched) &&
      f.coachHarmony < 45 &&
      f.morale < 45,
    urgency: () => URGENZA_EMERGENZA.bivio,
    demand: () => ({ description: "O lui o il mister: pretende che il club scelga." }),
    opening: () =>
      `Direttore, con il mister non funziona più. È lui o sono io: non potete tenerci entrambi.`,
    blocking: true,
  },
  {
    id: "giovane_crescita",
    label: "Giovane in cerca di campo",
    // Il minutaggio conta solo dopo che si è giocato: senza questa condizione un ragazzo
    // chiedeva più campo alla prima giornata, quando nessuno aveva ancora giocato niente.
    eligible: (f) =>
      f.age <= 21 &&
      f.potential - f.overall >= 6 &&
      f.matchdaysAvailable >= MIN_MATCHDAYS_FOR_MINUTES &&
      f.playedShare < 0.35 &&
      !f.onLoanOut,
    urgency: (f) => ordinaria(45 + (f.potential - f.overall) * 2),
    demand: () => ({ description: "Vuole giocare: qui o, se serve, in prestito altrove." }),
    opening: () =>
      `Ho bisogno di giocare per crescere, Direttore. Se qui non c'è spazio, mandatemi da qualche parte dove ce n'è.`,
  },
  {
    id: "sovraccarico",
    label: "È sfinito",
    eligible: (f) => f.fatigue >= 78 && f.playedShare >= 0.8,
    urgency: (f) => ordinaria(30 + (f.fatigue - 78)),
    demand: () => ({ description: "Chiede di rifiatare: ha giocato tutto." }),
    opening: () => `Sono a pezzi, Direttore. Ho giocato tutte le partite: mi serve respirare.`,
  },
  {
    id: "compagno_ceduto",
    label: "Scosso da una cessione",
    eligible: (f) => !!f.keyTeammateSold,
    urgency: () => 40,
    demand: () => ({ description: "Vuole garanzie che il club non stia ridimensionando." }),
    opening: (f) =>
      `Avete lasciato partire ${f.keyTeammateSold?.name}. Che segnale è, Direttore? Dovrei preoccuparmi anche io?`,
  },

  /* ------------------------------------------------------------- contratto */
  {
    id: "rinnovo_richiesto",
    label: "Chiede il rinnovo",
    eligible: (f) =>
      f.seasonsLeft === 2 && f.overUnderPerformance >= 0 && f.playedShare >= 0.4 && !f.renewalRefused,
    urgency: (f) => ordinaria(50 + Math.max(0, f.overUnderPerformance) * 2),
    demand: (f) => ({
      description: "Vuole prolungare e adeguare l'ingaggio prima di andare in scadenza.",
      amount: Math.round(f.wage * 1.25),
    }),
    opening: () =>
      `Mi restano due anni, Direttore. Se il club crede in me, questo è il momento di parlarne — non fra dodici mesi.`,
  },
  {
    id: "ultimo_anno",
    label: "In scadenza",
    eligible: (f) => f.seasonsLeft === 1 && f.contractStatus === "in_scadenza" && !f.renewalRefused,
    urgency: (f) => ordinaria(72 + Math.max(0, f.overall - f.squadAverage)),
    demand: () => ({ description: "Vuole chiarezza sul suo futuro: rinnovo o addio." }),
    opening: () =>
      `Il mio contratto scade a giugno e non ho ancora sentito nessuno. Devo iniziare a guardarmi intorno?`,
  },
  {
    id: "precontratto",
    label: "Ha un precontratto pronto",
    eligible: (f) => !!f.preContractSuitor,
    urgency: () => URGENZA_EMERGENZA.precontratto,
    demand: (f) => ({
      description: f.preContractSuitor
        ? `Ha un accordo pronto col ${f.preContractSuitor.clubName}: convincerlo adesso o perderlo a zero.`
        : "Ha un accordo pronto altrove.",
    }),
    opening: (f) =>
      `Direttore, il ${f.preContractSuitor?.clubName ?? "un club"} mi ha messo davanti un contratto da firmare subito. Da gennaio posso farlo. Ditemi voi.`,
    blocking: true,
  },
  {
    id: "rifiuto_rinnovo",
    label: "Ha rifiutato il rinnovo",
    eligible: (f) => f.renewalRefused && f.seasonsLeft <= 1,
    urgency: () => ordinaria(80),
    demand: () => ({ description: "Ha già deciso di andarsene a zero: o lo vendete, o lo perdete." }),
    opening: () =>
      `Vi ho già detto di no una volta. Non cambio idea: a giugno vado, e a titolo gratuito.`,
  },
  {
    id: "veterano_ultimo_contratto",
    label: "L'ultimo contratto",
    eligible: (f) => f.age >= 33 && f.seasonsLeft <= 1,
    urgency: (f) => ordinaria(45 + (f.age - 33) * 5),
    demand: () => ({ description: "Vuole sapere se sarà l'ultimo anno, e con quale ruolo." }),
    opening: (f) =>
      `Ho ${f.age} anni, Direttore. Non chiedo un contratto lungo: chiedo di sapere che ruolo avrò in quest'ultimo pezzo di carriera.`,
  },
  {
    id: "squilibrio_ingaggi",
    label: "Si sente sottopagato",
    eligible: (f) => f.wageVsPeers < 0.7 && f.seasonsAtClub >= 1 && f.playedShare >= 0.45,
    urgency: (f) => ordinaria(40 + (0.7 - f.wageVsPeers) * 60),
    demand: (f) => ({
      description: "Ha scoperto quanto guadagnano i compagni del suo livello. Vuole parità.",
      amount: Math.round(f.wage * (1 / Math.max(0.4, f.wageVsPeers) - 1)),
    }),
    opening: () =>
      `Nello spogliatoio si parla, Direttore. Faccio lo stesso lavoro di altri che guadagnano molto più di me.`,
  },
];

const BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

export function topicById(id: TopicId): Topic | undefined {
  return BY_ID.get(id);
}

/**
 * I temi che un giocatore può davvero aprire adesso.
 *
 * Nessun ripiego: se torna vuoto, **non c'è niente di cui parlare**. Un giocatore sereno, o
 * scontento per motivi che il club non può toccare, non deve produrre una conversazione finta.
 */
export function eligibleTopics(f: PlayerFacts, options: { ignoreTregua?: boolean } = {}): Topic[] {
  if (f.onLoanOut) return [];
  return TOPICS.filter((t) => t.eligible(f) && (options.ignoreTregua || !inTregua(f, t))).sort(
    (a, b) => b.urgency(f) - a.urgency(f),
  );
}

/**
 * **L'argomento di cui abbiamo appena parlato è chiuso, per un po'.**
 *
 * Era il difetto più visibile dello Spogliatoio: si affrontava un caso, si chiudeva la chat, e
 * il giocatore ricompariva subito nell'elenco. La ragione è che i fatti non cambiano premendo
 * "chiudi" — un morale basso resta basso, e un rapporto rotto (`isFeuding`) resta rotto **per
 * sempre**, quindi `promessa_infranta` sarebbe stato ammissibile a vita. La tregua non finge che
 * il problema sia risolto: dice che *di quello* si è già parlato, e che il giocatore aspetta di
 * vedere i fatti prima di ripresentarsi.
 *
 * Vale per **quel** tema, non per il giocatore: se nel frattempo nasce un caso nuovo e più
 * grave — un precontratto, la fascia tolta — quello passa comunque.
 */
function inTregua(f: PlayerFacts, topic: Topic): boolean {
  return f.lastTopicId === topic.id && f.weeksSinceLastTalk < TALK_COOLDOWN;
}

/**
 * Il tema di cui parlerebbe adesso: il più urgente fra gli ammissibili.
 *
 * `ignoreTregua` serve alla **richiesta forzata**, quella che ferma la corsa delle giornate: lì
 * è il giocatore a essersi presentato dal DS, quindi la tregua — che esiste per non riproporre
 * un caso di cui si è appena parlato — non ha voce in capitolo. Senza questa deroga la
 * conversazione poteva non aprirsi affatto e la settimana sarebbe rimasta bloccata su una
 * richiesta senza schermata.
 */
export function pickTopic(f: PlayerFacts, options: { ignoreTregua?: boolean } = {}): Topic | null {
  return eligibleTopics(f, options)[0] ?? null;
}

/** C'è un argomento abbastanza grave da fermare la corsa delle giornate? */
export function blockingTopic(f: PlayerFacts): Topic | null {
  return eligibleTopics(f).find((t) => t.blocking === true) ?? null;
}

/**
 * Quanto è urgente parlargli, 0-100, per ordinare la lista dello Spogliatoio.
 *
 * Chi è già stato sentito da poco scende: la tregua evita che lo stesso caso resti in cima
 * finestra dopo finestra.
 */
export function talkUrgency(f: PlayerFacts): number {
  const topic = pickTopic(f);
  if (!topic) return 0;
  const tregua = f.weeksSinceLastTalk < TALK_COOLDOWN ? 25 : 0;
  return Math.max(0, Math.round(topic.urgency(f) - tregua));
}
