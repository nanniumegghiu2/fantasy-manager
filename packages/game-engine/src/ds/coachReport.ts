/**
 * **L'analisi dell'allenatore sulla rosa.**
 *
 * ⚠️ Segnalazione dell'utente: *"il meeting allenatore è troppo irrealistico, non voglio più
 * richieste con Overall. Voglio una sua analisi sulla squadra dove mi dice i punti deboli, gli
 * intoccabili e se ha qualche richiesta di nome nello specifico o richieste particolari come
 * giovani da lanciare o gente esperta da fare da leader nel gruppo. Dal mister voglio anche le
 * sue motivazioni sul perché non si raggiungono gli obiettivi e cosa gli serve per raggiungerli."*
 *
 * Il difetto non era il tono ma **cosa il mister aveva da dire**: il catalogo delle promesse
 * parlava per soglie numeriche — *"acquisto di un Top Player con Overall ≥ 84"* — cioè nel
 * linguaggio del motore, non in quello di un allenatore. Un tecnico vero non chiede un numero:
 * guarda la rosa e dice dov'è corta, chi non tocchi, e chi vorrebbe.
 *
 * Questo modulo produce quel discorso, e lo produce **dai fatti**: la copertura reale delle
 * caselle del suo modulo, il livello di chi le occupa, l'età dello spogliatoio, il cammino della
 * stagione rispetto a quanto promesso alla società. Non aggiunge una meccanica: dà una voce a
 * quelle che ci sono già.
 *
 * Modulo **puro**: nessuna scrittura, nessun import da `career.ts`.
 */
import { ROLE_DEPARTMENT, type Department, type Role } from "@app/shared-types";
import type { Formation } from "@app/shared-types";
import { coverageOfFormation, ROLE_NOME, type RoleCoverage } from "./coachRequests";
import type { PlayerIndex, RosterEntry } from "./types";

/** Un punto debole della rosa, detto come lo direbbe lui. */
export interface WeakSpot {
  role: Role;
  department: Department;
  /** "scoperto" = non ha nemmeno gli uomini; "sotto livello" = ce li ha ma non reggono. */
  kind: "scoperto" | "sotto_livello" | "corto";
  text: string;
}

/** Un nome che il mister fa, in un senso o nell'altro. */
export interface NamedWish {
  playerId: string;
  name: string;
  role?: Role;
  clubName?: string;
  text: string;
}

/** Una richiesta che non riguarda una casella ma il gruppo. */
export type SquadWishKind = "giovane" | "esperto" | "sfoltire" | "secondo_portiere" | "gruppo_ok";

export interface SquadWish {
  kind: SquadWishKind;
  text: string;
}

export interface CoachReport {
  /** Come vede la squadra, in una riga: è l'apertura del discorso. */
  headline: string;
  weakSpots: WeakSpot[];
  /** Chi non gli si tocca, col motivo. */
  untouchables: NamedWish[];
  /** Il nome che vorrebbe dal mercato, se ce n'è uno adatto. */
  wanted?: NamedWish;
  /** Chi vorrebbe fuori, se c'è qualcuno che il suo sistema non usa. */
  unwanted?: NamedWish;
  wishes: SquadWish[];
  /**
   * Perché non si sta arrivando dove ci si era impegnati, e cosa gli servirebbe.
   *
   * Assente quando la stagione non è cominciata o si sta rispettando l'obiettivo: un allenatore
   * non si giustifica di qualcosa che sta andando bene, e farlo parlare comunque renderebbe la
   * sezione rumore invece che una discriminante per decidere se tenerlo.
   */
  objectiveTalk?: { diagnosis: string; needed: string };
}

export interface CoachReportInput {
  coachName: string;
  formation: Formation;
  roster: readonly RosterEntry[];
  players: PlayerIndex;
  ageOf: (playerId: string) => number;
  /** Chi il mister considera intoccabile (`coachSynergy.getCoachUntouchables`). */
  untouchableIds: readonly string[];
  /** Il mister sa lavorare coi giovani? Cambia cosa chiede al gruppo. */
  goodWithYouth: boolean;
  /** Un candidato reale di mercato per la casella più debole, se il mercato ne offre uno. */
  marketCandidate?: { playerId: string; name: string; role: Role; clubName?: string };
  /** Dove siamo rispetto all'obiettivo dichiarato: positivo = sotto le attese. */
  positionsBelowTarget?: number;
  objectiveLabel?: string;
  /** Giornate giocate: sotto una manciata non c'è niente da spiegare. */
  matchday?: number;
  /** Media morale della rosa: una delle spiegazioni possibili di una stagione storta. */
  averageMorale?: number;
  /** Quanti sono ai box adesso: l'altra spiegazione che un allenatore usa davvero. */
  injuredCount?: number;
}

const DEPARTMENT_NOME: Record<Department, string> = {
  POR: "in porta",
  DIF: "in difesa",
  CC: "a centrocampo",
  ATT: "in attacco",
};

/** Sotto questo scarto dal livello dei titolari una casella non è debole, è normale. */
const SCARTO_DEBOLE = 3;

/** Quante giornate servono prima che il mister possa spiegare un andamento. */
const GIORNATE_PER_UN_GIUDIZIO = 5;

export function buildCoachReport(input: CoachReportInput): CoachReport {
  const disponibili = input.roster.filter((e) => !e.loan?.hostClubId);
  const undici = [...disponibili].sort((a, b) => b.overall - a.overall).slice(0, 11);
  const livelloTitolari =
    undici.length > 0 ? undici.reduce((s, e) => s + e.overall, 0) / undici.length : 70;

  const copertura = coverageOfFormation(input.formation, disponibili, input.players);

  /* ------------------------------------------------------------- punti deboli */

  const weakSpots: WeakSpot[] = [];
  for (const c of copertura) {
    if (c.uomini < c.richieste) {
      weakSpots.push({
        role: c.role,
        department: ROLE_DEPARTMENT[c.role],
        kind: "scoperto",
        text: `Non ho un ${ROLE_NOME[c.role]} vero per il ${input.formation.name}: quella casella oggi la copro con un adattato.`,
      });
    } else if (livelloTitolari - c.qualita >= SCARTO_DEBOLE) {
      weakSpots.push({
        role: c.role,
        department: ROLE_DEPARTMENT[c.role],
        kind: "sotto_livello",
        text: `Il ${ROLE_NOME[c.role]} che ho è sotto il livello del resto della squadra. Lì paghiamo dazio ogni domenica.`,
      });
    }
  }
  // I più gravi per primi: chi non c'è viene prima di chi non basta, e fra pari il divario decide.
  weakSpots.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "scoperto" ? -1 : 1;
    const qa = copertura.find((c) => c.role === a.role)?.qualita ?? 0;
    const qb = copertura.find((c) => c.role === b.role)?.qualita ?? 0;
    return qa - qb;
  });
  const principali = weakSpots.slice(0, 3);

  /* ------------------------------------------------------------- intoccabili */

  const untouchables: NamedWish[] = input.untouchableIds
    .map((id): NamedWish | null => {
      const entry = disponibili.find((e) => e.playerId === id);
      const info = input.players[id];
      if (!entry || !info) return null;
      const anni = input.ageOf(id);
      return {
        playerId: id,
        name: info.name,
        role: info.role,
        text:
          entry.overall >= livelloTitolari + 4
            ? `Su ${info.name} non si discute: è il livello di questa squadra.`
            : anni >= 30
              ? `${info.name} tiene insieme lo spogliatoio. Toglietemelo e mi togliete l'ossatura.`
              : `${info.name} è il perno del mio sistema: senza di lui devo rifare tutto.`,
      };
    })
    .filter((x): x is NamedWish => x !== null);

  /* ------------------------------------------------- il nome che vorrebbe    */

  const wanted: NamedWish | undefined = input.marketCandidate
    ? {
        playerId: input.marketCandidate.playerId,
        name: input.marketCandidate.name,
        role: input.marketCandidate.role,
        clubName: input.marketCandidate.clubName,
        text: `Se posso fare un nome: ${input.marketCandidate.name}${
          input.marketCandidate.clubName ? ` del ${input.marketCandidate.clubName}` : ""
        }. È esattamente il ${ROLE_NOME[input.marketCandidate.role]} che mi manca.`,
      }
    : undefined;

  /* ------------------------------------------------- chi non usa mai         */

  const ruoliSchierati = new Set(input.formation.slots.map((s) => s.role));
  const fuoriSistema = disponibili.find((e) => {
    const info = input.players[e.playerId];
    if (!info || input.untouchableIds.includes(e.playerId)) return false;
    return (
      !ruoliSchierati.has(info.role) && !info.secondaryRoles.some((r) => ruoliSchierati.has(r))
    );
  });
  const unwanted: NamedWish | undefined = fuoriSistema
    ? {
        playerId: fuoriSistema.playerId,
        name: input.players[fuoriSistema.playerId]!.name,
        role: input.players[fuoriSistema.playerId]!.role,
        text: `${input.players[fuoriSistema.playerId]!.name} nel mio sistema non ha una casella. Allenare chi non entra mai in campo è tempo perso: per me può partire.`,
      }
    : undefined;

  /* ------------------------------------------------- richieste sul gruppo    */

  const wishes: SquadWish[] = [];
  const giovani = disponibili.filter((e) => input.ageOf(e.playerId) <= 21).length;
  const esperti = disponibili.filter((e) => input.ageOf(e.playerId) >= 30).length;
  const portieri = disponibili.filter(
    (e) => input.players[e.playerId] && ROLE_DEPARTMENT[input.players[e.playerId]!.role] === "POR",
  ).length;

  if (portieri < 2) {
    wishes.push({
      kind: "secondo_portiere",
      text: "Ho un portiere solo. Basta una storta in allenamento e mando fra i pali un difensore.",
    });
  }
  if (input.goodWithYouth && giovani < 3) {
    wishes.push({
      kind: "giovane",
      text: "Datemi un ragazzo su cui lavorare. Non dev'essere pronto: deve avere qualcosa dentro, al resto ci penso io.",
    });
  }
  if (esperti === 0 && disponibili.length >= 14) {
    wishes.push({
      kind: "esperto",
      text: "Qui dentro sono tutti ragazzini. Serve uno che abbia già visto tutto, anche se non gioca ogni domenica: nello spogliatoio pesa più di un gol.",
    });
  }
  if (disponibili.length >= 28) {
    wishes.push({
      kind: "sfoltire",
      text: `Siamo in ${disponibili.length}. Non riesco a dare campo a tutti, e a fine mese ho mezza rosa che non mi parla: sfoltiamo.`,
    });
  }
  if (wishes.length === 0) {
    wishes.push({
      kind: "gruppo_ok",
      text: "Il gruppo sta insieme e non ho emergenze di spogliatoio. È già un lusso.",
    });
  }

  /* ------------------------------------------------- le sue motivazioni      */

  let objectiveTalk: CoachReport["objectiveTalk"];
  const sotto = input.positionsBelowTarget ?? 0;
  if ((input.matchday ?? 0) >= GIORNATE_PER_UN_GIUDIZIO && sotto >= 2) {
    /**
     * Un allenatore spiega con quello che ha davanti, in quest'ordine: il buco in rosa che ha già
     * segnalato, l'infermeria, lo spogliatoio. Non è una scusa a caso — è la stessa diagnosi che
     * il DS può verificare guardando le altre sezioni di questa analisi, ed è ciò che la rende
     * una discriminante per decidere se tenerlo.
     */
    const buco = principali[0];
    const diagnosis = buco
      ? `Siamo ${sotto} ${sotto === 1 ? "posizione" : "posizioni"} sotto ${input.objectiveLabel ? `"${input.objectiveLabel}"` : "l'obiettivo"}, e il motivo lo dico da agosto: ${buco.kind === "scoperto" ? `${ROLE_NOME[buco.role]} non ce l'ho` : `il ${ROLE_NOME[buco.role]} non è all'altezza`}. Le partite si perdono lì.`
      : (input.injuredCount ?? 0) >= 3
        ? `Siamo ${sotto} ${sotto === 1 ? "posizione" : "posizioni"} sotto ${input.objectiveLabel ? `"${input.objectiveLabel}"` : "l'obiettivo"}, ma ho ${input.injuredCount} uomini ai box. Con l'infermeria piena non si costruisce niente.`
        : (input.averageMorale ?? 70) < 55
          ? `Siamo ${sotto} ${sotto === 1 ? "posizione" : "posizioni"} sotto ${input.objectiveLabel ? `"${input.objectiveLabel}"` : "l'obiettivo"}, e il problema non è tecnico: lo spogliatoio è spento. Così non si tira fuori niente.`
          : `Siamo ${sotto} ${sotto === 1 ? "posizione" : "posizioni"} sotto ${input.objectiveLabel ? `"${input.objectiveLabel}"` : "l'obiettivo"}. La rosa c'è, i risultati no: me ne prendo la responsabilità.`;

    const needed = buco
      ? `Mi serve un ${ROLE_NOME[buco.role]} vero. Con quello, ${input.objectiveLabel ?? "l'obiettivo"} lo riprendiamo.`
      : (input.injuredCount ?? 0) >= 3
        ? "Mi serve solo tempo: quando rientrano, questa squadra risale."
        : (input.averageMorale ?? 70) < 55
          ? "Mi serve che lo spogliatoio torni sereno: chi è scontento va accontentato o mandato via."
          : "Mi servono i rinforzi che ho chiesto. Senza, questo è il nostro livello.";

    objectiveTalk = { diagnosis, needed };
  }

  /* ------------------------------------------------- l'apertura              */

  const headline =
    principali.length === 0
      ? `Questa rosa mi va bene: il ${input.formation.name} lo copro tutto, e il gruppo sta insieme.`
      : principali.length === 1
        ? `La squadra c'è. Ho un buco solo, ed è ${DEPARTMENT_NOME[principali[0]!.department]}.`
        : `Ho ${principali.length} zone su cui non sono tranquillo, e sono ${principali
            .map((w) => DEPARTMENT_NOME[w.department])
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(" e ")}.`;

  return { headline, weakSpots: principali, untouchables, wanted, unwanted, wishes, objectiveTalk };
}

/** Riesportata per chi costruisce il report senza importare due moduli. */
export type { RoleCoverage };
