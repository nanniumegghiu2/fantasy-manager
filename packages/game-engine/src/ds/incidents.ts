/**
 * **Gli imprevisti di una stagione**: quello che succede senza che tu l'abbia deciso.
 *
 * Perché servono. Una carriera fatta solo di mercato e risultati diventa prevedibile: dopo tre
 * stagioni sai già come andrà la quarta, e il gioco annoia — è la segnalazione dell'utente.
 * Gli imprevisti rompono la routine con notizie che **cambiano i piani**: un titolare fuori tre
 * mesi obbliga a rifare l'undici, una squalifica per doping toglie un uomo proprio mentre serve.
 *
 * Tre regole di disegno, tutte per evitare che diventino rumore:
 *  - **uno alla volta**, con una tregua dopo ciascuno: due notizie insieme si annullano;
 *  - **niente che l'utente non possa capire**: ogni imprevisto dice chi, cosa e per quanto;
 *  - **rari sul serio**. Il doping deve restare una cosa che capita una volta ogni tante
 *    carriere: se capitasse ogni anno smetterebbe di essere una notizia e diventerebbe una
 *    tassa.
 */
import type { RosterEntry } from "./types";
import type { Role } from "@app/shared-types";

/** Che genere di imprevisto è capitato. */
export type IncidentKind =
  | "infortunio_lungo"
  | "infortunio_gravissimo"
  | "squalifica_doping"
  | "condotta_antisportiva"
  | "rissa_spogliatoio"
  | "convocazione_nazionale"
  | "sanzione_federale"
  | "premio_presidente"
  | "nottata_brava"
  | "intervista_contro"
  | "rottura_tra_giocatori"
  | "cambio_proprieta";

/**
 * I due imprevisti "con decisione": a differenza di tutti gli altri, non si auto-risolvono —
 * `costruisci` li restituisce con `matchdays: 0`/`moraleDelta: 0` (quindi `applyIncident` è già
 * un no-op su di loro, nessun effetto entra in rosa finché il DS non sceglie), e il verdetto
 * vero arriva solo da `resolveIncidentDecision` (`career.ts`), chiamata quando l'utente risponde
 * al popup a due bottoni invece del solito "Ho capito".
 */
export const DECISION_INCIDENT_KINDS: readonly IncidentKind[] = [
  "nottata_brava",
  "intervista_contro",
  "rottura_tra_giocatori",
];

/** I due imprevisti economici non toccano un giocatore: colpiscono solo il budget. */
export const FINANCIAL_INCIDENT_KINDS: readonly IncidentKind[] = [
  "sanzione_federale",
  "premio_presidente",
  "cambio_proprieta",
];

export interface Incident {
  kind: IncidentKind;
  /** Assente per gli imprevisti economici, che non hanno un diretto interessato. */
  playerId?: string;
  /** Giornate di indisponibilità che comporta (0 per gli imprevisti economici). */
  matchdays: number;
  /** Variazione di morale del diretto interessato. */
  moraleDelta: number;
  /** Variazione di budget, solo per gli imprevisti economici. */
  budgetDelta?: number;
  /** Titolo e testo già pronti: la UI non deve comporre frasi. */
  title: string;
  message: string;
  /** Il secondo protagonista, solo per `rottura_tra_giocatori`: e fra questi due che si sceglie. */
  secondPlayerId?: string;
  /**
   * Vero solo per `nottata_brava`/`intervista_contro`: il popup mostra due bottoni (ignora /
   * punizione) invece del solito "Ho capito", e il verdetto vero arriva da
   * `resolveIncidentDecision`, non da questo oggetto — che infatti ha già `matchdays`/
   * `moraleDelta` a zero, quindi applicarlo così com'è (`applyIncident`) non cambia nulla.
   */
  requiresDecision?: true;
}

/**
 * Probabilità **per giornata** di ciascun imprevisto.
 *
 * Placeholder di bilanciamento dichiarati, scelti per una stagione da 38 giornate: con questi
 * numeri ci si aspetta circa un infortunio lungo a stagione, una condotta antisportiva ogni due,
 * e un caso di doping ogni quindici — cioè una volta e mezza in una carriera da dieci anni.
 */
export const INCIDENT_ODDS: Record<IncidentKind, number> = {
  infortunio_lungo: 0.028,
  condotta_antisportiva: 0.016,
  rissa_spogliatoio: 0.011,
  convocazione_nazionale: 0.02,
  squalifica_doping: 0.0018,
  // Carriera a rischio: molto più raro dell'infortunio lungo, coerente con la rarità già
  // scelta per il doping — un crociato a un titolare cambia una stagione, deve restare
  // eccezionale.
  infortunio_gravissimo: 0.004,
  sanzione_federale: 0.006,
  // Notizie di colore che chiedono una vera decisione al DS, non solo da leggere: restano rare
  // quanto una condotta antisportiva, altrimenti ogni due settimane ci sarebbe un giocatore da
  // richiamare all'ordine.
  nottata_brava: 0.014,
  intervista_contro: 0.01,
  // Non "per giornata" come gli altri: scatta solo se `lastMatch` segnala una vittoria a
  // sorpresa vera (vedi `rollIncident`), quindi la probabilità è alta **condizionata** a
  // quell'evento raro, non sciolta su tutte le 38 giornate.
  premio_presidente: 0.15,
  /**
   * **La rottura fra due compagni**: rara, perche costringe a una scelta vera — chi tenere e
   * chi mandare via — e una decisione del genere ogni mese sarebbe un ufficio reclami.
   */
  rottura_tra_giocatori: 0.008,
  /**
   * **Il cambio di proprieta**: una volta ogni tre o quattro carriere, non una volta l anno.
   * E l unico imprevisto che cambia i mezzi in modo strutturale invece che una tantum, quindi
   * deve restare un evento che si ricorda.
   */
  cambio_proprieta: 0.0012,
};

/** Giornate di tregua dopo un imprevisto: due notizie ravvicinate si annullano a vicenda. */
export const INCIDENT_COOLDOWN = 4;

export interface IncidentContext {
  roster: readonly RosterEntry[];
  nameOf: (playerId: string) => string;
  /** Giornata corrente, per la tregua. */
  matchday: number;
  lastIncidentMatchday?: number;
  random: () => number;
  /**
   * L'ultima partita giocata, se ce n'è stata una questa settimana: serve solo a
   * `premio_presidente`, che scatta dopo una vittoria a sorpresa vera e non a caso.
   */
  lastMatch?: { won: boolean; opponentGapFavorevole: number };
  /**
   * Ruolo (principale e secondari) di ogni giocatore in rosa: serve a `depthRisk`, il rischio
   * di infortunio più alto per chi non ha ricambi sani nel suo ruolo. Opzionale e retrocompatibile:
   * senza, il rischio resta piatto come prima (nessun candidato-chiamante lo forniva finora).
   */
  playerRoles?: Record<string, { role: Role; secondaryRoles: Role[] }>;
}

/** Da quanto lo scarto di forza a nostro sfavore conta come "vittoria a sorpresa" per il premio. */
const SURPRISE_WIN_GAP = 6;

/**
 * Tira i dadi per un imprevisto.
 *
 * Restituisce `undefined` quasi sempre: è il comportamento voluto. Un imprevisto che capita
 * spesso non è un imprevisto.
 */
export function rollIncident({
  roster,
  nameOf,
  matchday,
  lastIncidentMatchday,
  random,
  lastMatch,
  playerRoles,
}: IncidentContext): Incident | undefined {
  if (lastIncidentMatchday !== undefined && matchday - lastIncidentMatchday < INCIDENT_COOLDOWN) {
    return undefined;
  }

  const disponibili = roster.filter((e) => !e.loan?.hostClubId && e.injuryMatchdaysLeft === 0);

  for (const kind of Object.keys(INCIDENT_ODDS) as IncidentKind[]) {
    // `premio_presidente` non è "per giornata" come gli altri: ha senso solo dopo una vittoria
    // a sorpresa vera, quindi senza quella precondizione non si tira nemmeno il dado.
    if (kind === "premio_presidente") {
      const sorpresa = (lastMatch?.won ?? false) && (lastMatch?.opponentGapFavorevole ?? 0) >= SURPRISE_WIN_GAP;
      if (!sorpresa) continue;
    }

    if (random() >= INCIDENT_ODDS[kind]) continue;

    if (FINANCIAL_INCIDENT_KINDS.includes(kind)) {
      return costruisci(kind, undefined, "", random);
    }

    if (disponibili.length === 0) continue;
    const vittima = scegliVittima(kind, disponibili, random, playerRoles);
    if (!vittima) continue;
    const nome = nameOf(vittima.playerId);

    /**
     * La rottura ha **due** protagonisti: senza il secondo non c'è nulla da arbitrare, e l'unica
     * risposta onesta è non farla capitare affatto (rosa di un solo uomo disponibile).
     */
    if (kind === "rottura_tra_giocatori") {
      const altri = disponibili.filter((e) => e.playerId !== vittima.playerId);
      if (altri.length === 0) continue;
      const secondo = altri[Math.floor(random() * altri.length)]!;
      const incidente = costruisci(kind, vittima, nome, random);
      return {
        ...incidente,
        secondPlayerId: secondo.playerId,
        message: `${nome} e ${nameOf(secondo.playerId)} sono arrivati alle mani in allenamento. Lo spogliatoio si è spaccato: uno dei due deve andarsene.`,
      };
    }

    return costruisci(kind, vittima, nome, random);
  }

  return undefined;
}

/**
 * Quanti compagni sani coprono lo stesso ruolo di `entry` (principale o secondario) —
 * l'alternativa reale se si fermasse. Pochi ricambi = rischio più alto: una squadra senza
 * cambio in un ruolo forza chi c'è a giocare sempre, più stanco e più esposto.
 */
function depthRisk(
  entry: RosterEntry,
  disponibili: readonly RosterEntry[],
  playerRoles: Record<string, { role: Role; secondaryRoles: Role[] }>,
): number {
  const ruolo = playerRoles[entry.playerId]?.role;
  if (!ruolo) return 1;
  const alternative = disponibili.filter((altro) => {
    if (altro.playerId === entry.playerId) return false;
    const p = playerRoles[altro.playerId];
    return p && (p.role === ruolo || p.secondaryRoles.includes(ruolo));
  }).length;
  if (alternative <= 1) return 1.6;
  if (alternative === 2) return 1.3;
  return 1;
}

/** Pesca pesata: un elemento con peso doppio ha il doppio delle probabilità degli altri. */
function pescaPesata<T>(items: readonly T[], pesi: readonly number[], random: () => number): T | undefined {
  const totale = pesi.reduce((s, p) => s + p, 0);
  if (items.length === 0 || totale <= 0) return items[0];
  let tiro = random() * totale;
  for (let i = 0; i < items.length; i++) {
    tiro -= pesi[i]!;
    if (tiro <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Chi tocca.
 *
 * Non è indifferente: un infortunio lungo a una riserva non è una notizia, mentre lo stesso
 * infortunio a un titolare cambia la stagione. Si pesca quindi **fra i migliori** per gli
 * imprevisti che devono far male, e fra tutti per quelli che sono solo colore. Per i due
 * infortuni (non per squalifiche/liti, che non dipendono dalla profondità di rosa), il pool dei
 * migliori 16 è pesato per `depthRisk`: chi non ha ricambi nel suo ruolo rischia di più.
 */
function scegliVittima(
  kind: IncidentKind,
  disponibili: readonly RosterEntry[],
  random: () => number,
  playerRoles?: Record<string, { role: Role; secondaryRoles: Role[] }>,
): RosterEntry | undefined {
  if (
    kind === "convocazione_nazionale" ||
    kind === "squalifica_doping" ||
    kind === "nottata_brava" ||
    kind === "intervista_contro"
  ) {
    // Chi va in nazionale, chi viene controllato, chi finisce sui giornali: sempre uno che
    // gioca, mai una riserva che nessuno noterebbe.
    const migliori = [...disponibili].sort((a, b) => b.overall - a.overall).slice(0, 11);
    return migliori[Math.floor(random() * migliori.length)];
  }
  if (kind === "rissa_spogliatoio" || kind === "rottura_tra_giocatori") {
    // Chi è già scontento è il candidato naturale.
    const nervosi = disponibili.filter((e) => e.morale < 55);
    const pool = nervosi.length > 0 ? nervosi : disponibili;
    return pool[Math.floor(random() * pool.length)];
  }
  const pesati = [...disponibili].sort((a, b) => b.overall - a.overall).slice(0, 16);
  if ((kind === "infortunio_lungo" || kind === "infortunio_gravissimo") && playerRoles) {
    const pesi = pesati.map((e) => depthRisk(e, disponibili, playerRoles));
    return pescaPesata(pesati, pesi, random);
  }
  return pesati[Math.floor(random() * pesati.length)];
}

function costruisci(
  kind: IncidentKind,
  entry: RosterEntry | undefined,
  nome: string,
  random: () => number,
): Incident {
  switch (kind) {
    case "sanzione_federale": {
      const budgetDelta = -Math.round(300_000 + random() * 900_000);
      return {
        kind,
        matchdays: 0,
        moraleDelta: 0,
        budgetDelta,
        title: "Sanzione della federazione",
        message: `Multa dalla federazione per un'irregolarità amministrativa: il budget scende di ${Math.abs(budgetDelta).toLocaleString("it-IT")}€.`,
      };
    }
    case "premio_presidente": {
      const budgetDelta = Math.round(200_000 + random() * 600_000);
      return {
        kind,
        matchdays: 0,
        moraleDelta: 0,
        budgetDelta,
        title: "Premio del presidente",
        message: `Il presidente premia la vittoria a sorpresa: ${budgetDelta.toLocaleString("it-IT")}€ in più sul budget di mercato.`,
      };
    }
    /**
     * **Il cambio di proprietà**: l'unico imprevisto che cambia i mezzi in modo strutturale
     * invece che una tantum, e per questo il più raro di tutti.
     *
     * Può andare in entrambe le direzioni, e la simmetria è voluta: un fondo che entra porta
     * soldi veri, una proprietà che si ritira lascia un club da ricostruire. Un evento che
     * fosse solo positivo sarebbe un regalo, non una notizia.
     */
    case "cambio_proprieta": {
      const inBene = random() < 0.55;
      const budgetDelta = inBene
        ? Math.round(8_000_000 + random() * 22_000_000)
        : -Math.round(4_000_000 + random() * 12_000_000);
      return {
        kind,
        matchdays: 0,
        moraleDelta: inBene ? 6 : -6,
        budgetDelta,
        title: inBene ? "Nuova proprietà ambiziosa" : "La proprietà si ritira",
        message: inBene
          ? `Il club è stato rilevato da un gruppo con grandi ambizioni: ${budgetDelta.toLocaleString("it-IT")}€ in più sul mercato, e l'obbligo morale di spenderli bene.`
          : `La proprietà ha ridotto l'impegno: ${Math.abs(budgetDelta).toLocaleString("it-IT")}€ in meno sul mercato. Servirà fare di più con meno.`,
      };
    }
    /**
     * **La rottura fra due compagni**, e stavolta tocca al DS arbitrare.
     *
     * `rissa_spogliatoio` esisteva già ma si limitava a scalare il morale di uno: una notizia da
     * leggere, non una decisione. Qui i giocatori sono **due**, il gruppo si è spaccato, e la
     * scelta è quella vera di uno spogliatoio — chi tenere e chi lasciar andare. Non c'è
     * un'opzione indolore: tenerli entrambi lascia il veleno in circolo.
     */
    case "rottura_tra_giocatori": {
      return {
        kind,
        matchdays: 0,
        moraleDelta: 0,
        title: "Rottura nello spogliatoio",
        message: `${nome} è arrivato alle mani con un compagno. Lo spogliatoio si è spaccato in due: qualcuno deve andarsene.`,
        requiresDecision: true,
      };
    }
    case "infortunio_gravissimo": {
      // Da cinque a otto mesi: la stagione, di fatto, finisce qui per lui.
      const matchdays = 20 + Math.floor(random() * 13);
      return {
        kind,
        playerId: entry!.playerId,
        matchdays,
        moraleDelta: -20,
        title: "Infortunio gravissimo",
        message: `${nome} si è procurato un infortunio molto serio (crociato/tendine): fuori per circa ${matchdays} giornate, la stagione è compromessa.`,
      };
    }
    case "infortunio_lungo": {
      // Da due a quattro mesi: è il tipo di infortunio che costringe a rifare i piani.
      const matchdays = 8 + Math.floor(random() * 9);
      return {
        kind,
        playerId: entry!.playerId,
        matchdays,
        moraleDelta: -12,
        title: "Infortunio serio",
        message: `${nome} si è fatto male seriamente in allenamento. Lo perdiamo per circa ${matchdays} giornate.`,
      };
    }
    case "squalifica_doping": {
      const matchdays = 12 + Math.floor(random() * 13);
      return {
        kind,
        playerId: entry!.playerId,
        matchdays,
        moraleDelta: -25,
        title: "Positivo a un controllo",
        message: `${nome} è risultato positivo a un controllo antidoping. Squalificato per ${matchdays} giornate: la società prende le distanze, lui giura di essere innocente.`,
      };
    }
    case "condotta_antisportiva": {
      const matchdays = 2 + Math.floor(random() * 4);
      return {
        kind,
        playerId: entry!.playerId,
        matchdays,
        moraleDelta: -8,
        title: "Condotta antisportiva",
        message: `${nome} ha perso la testa a fine partita. Il giudice sportivo lo ferma per ${matchdays} giornate.`,
      };
    }
    case "rissa_spogliatoio": {
      const matchdays = 1 + Math.floor(random() * 3);
      return {
        kind,
        playerId: entry!.playerId,
        matchdays,
        moraleDelta: -15,
        title: "Scintille nello spogliatoio",
        message: `Discussione accesa dopo l'allenamento: ${nome} è finito nel mirino del gruppo. Fuori per ${matchdays} giornate, e il clima non è dei migliori.`,
      };
    }
    case "nottata_brava": {
      // Niente effetto automatico: matchdays/moraleDelta restano a zero finché il DS non
      // decide (`resolveIncidentDecision`) — vedi `requiresDecision`.
      return {
        kind,
        playerId: entry!.playerId,
        matchdays: 0,
        moraleDelta: 0,
        requiresDecision: true,
        title: "Notte fuori prima della partita",
        message: `Un giornale ha pubblicato foto di ${nome} in un locale fino a tardi, la sera prima della gara. Come reagisce la società?`,
      };
    }
    case "intervista_contro": {
      return {
        kind,
        playerId: entry!.playerId,
        matchdays: 0,
        moraleDelta: 0,
        requiresDecision: true,
        title: "Intervista contro lo spogliatoio",
        message: `${nome} ha rilasciato un'intervista dura, puntando il dito contro il mister e la società. Come rispondete?`,
      };
    }
    case "convocazione_nazionale": {
      const matchdays = 1 + Math.floor(random() * 2);
      return {
        kind,
        playerId: entry!.playerId,
        matchdays,
        // L'unica notizia che fa piacere: il morale sale, ma il giocatore non c'è.
        moraleDelta: +10,
        title: "Chiamata dalla nazionale",
        message: `${nome} è stato convocato dalla sua nazionale. Orgoglio per il club, ma per ${matchdays} ${matchdays === 1 ? "giornata" : "giornate"} dobbiamo farne a meno.`,
      };
    }
  }
}

/**
 * Quanto perde di Overall un infortunio lungo, applicato **una sola volta** all'evento (non
 * recupera da solo col rientro): un lungo stop pesa sulla condizione e sul valore di mercato,
 * coerente con "un lungo infortunio farà calare il suo valore" — il prezzo deriva già
 * dall'Overall (`currentValue`), quindi basta toccare questo per farlo scendere davvero.
 */
const OVERALL_DECAY: Partial<Record<IncidentKind, number>> = {
  infortunio_lungo: 2,
  infortunio_gravissimo: 4,
};

/** Applica l'imprevisto alla rosa: indisponibilità, morale ed eventuale calo di Overall. */
export function applyIncident(
  roster: readonly RosterEntry[],
  incident: Incident,
): RosterEntry[] {
  const decay = OVERALL_DECAY[incident.kind] ?? 0;
  return roster.map((entry) =>
    entry.playerId === incident.playerId
      ? {
          ...entry,
          injuryMatchdaysLeft: Math.max(entry.injuryMatchdaysLeft, incident.matchdays),
          morale: Math.max(0, Math.min(100, entry.morale + incident.moraleDelta)),
          overall: Math.max(50, entry.overall - decay),
        }
      : entry,
  );
}
