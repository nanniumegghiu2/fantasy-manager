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

/** Che genere di imprevisto è capitato. */
export type IncidentKind =
  | "infortunio_lungo"
  | "infortunio_gravissimo"
  | "squalifica_doping"
  | "condotta_antisportiva"
  | "rissa_spogliatoio"
  | "convocazione_nazionale"
  | "sanzione_federale"
  | "premio_presidente";

/** I due imprevisti economici non toccano un giocatore: colpiscono solo il budget. */
export const FINANCIAL_INCIDENT_KINDS: readonly IncidentKind[] = [
  "sanzione_federale",
  "premio_presidente",
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
  // Non "per giornata" come gli altri: scatta solo se `lastMatch` segnala una vittoria a
  // sorpresa vera (vedi `rollIncident`), quindi la probabilità è alta **condizionata** a
  // quell'evento raro, non sciolta su tutte le 38 giornate.
  premio_presidente: 0.15,
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

    if (kind === "sanzione_federale" || kind === "premio_presidente") {
      return costruisci(kind, undefined, "", random);
    }

    if (disponibili.length === 0) continue;
    const vittima = scegliVittima(kind, disponibili, random);
    if (!vittima) continue;
    const nome = nameOf(vittima.playerId);
    return costruisci(kind, vittima, nome, random);
  }

  return undefined;
}

/**
 * Chi tocca.
 *
 * Non è indifferente: un infortunio lungo a una riserva non è una notizia, mentre lo stesso
 * infortunio a un titolare cambia la stagione. Si pesca quindi **fra i migliori** per gli
 * imprevisti che devono far male, e fra tutti per quelli che sono solo colore.
 */
function scegliVittima(
  kind: IncidentKind,
  disponibili: readonly RosterEntry[],
  random: () => number,
): RosterEntry | undefined {
  if (kind === "convocazione_nazionale" || kind === "squalifica_doping") {
    // Chi va in nazionale (o chi viene controllato) è uno che gioca.
    const migliori = [...disponibili].sort((a, b) => b.overall - a.overall).slice(0, 11);
    return migliori[Math.floor(random() * migliori.length)];
  }
  if (kind === "rissa_spogliatoio") {
    // Chi è già scontento è il candidato naturale.
    const nervosi = disponibili.filter((e) => e.morale < 55);
    const pool = nervosi.length > 0 ? nervosi : disponibili;
    return pool[Math.floor(random() * pool.length)];
  }
  const pesati = [...disponibili].sort((a, b) => b.overall - a.overall).slice(0, 16);
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

/** Applica l'imprevisto alla rosa: indisponibilità e morale. */
export function applyIncident(
  roster: readonly RosterEntry[],
  incident: Incident,
): RosterEntry[] {
  return roster.map((entry) =>
    entry.playerId === incident.playerId
      ? {
          ...entry,
          injuryMatchdaysLeft: Math.max(entry.injuryMatchdaysLeft, incident.matchdays),
          morale: Math.max(0, Math.min(100, entry.morale + incident.moraleDelta)),
        }
      : entry,
  );
}
