/**
 * **Cosa chiede l'allenatore** a ogni sessione di mercato.
 *
 * Serve a dare una voce alla panchina. Senza, l'allenatore è un modulo e due numeri: si sceglie
 * una volta e poi non esiste più. Con una richiesta esplicita diventa qualcuno con cui si ha un
 * rapporto — e soprattutto **un consiglio leggibile** su cosa manca, che è utile davvero a chi
 * non ha voglia di studiarsi la copertura per ruolo.
 *
 * La richiesta non è un capriccio generato a caso: nasce dalla rosa vera, confrontata con il
 * modulo che quell'allenatore vuole giocare. Accontentarlo dà un vantaggio concreto e piccolo;
 * ignorarlo non è punito, perché il direttore sportivo è il giocatore, non il mister.
 */
import type { Formation, Role } from "@app/shared-types";
import { ROLE_DEPARTMENT } from "@app/shared-types";
import type { Coach, PlayerIndex, RosterEntry } from "./types";

/** Bonus di affiatamento se l'allenatore ottiene quel che ha chiesto. */
export const REQUEST_FULFILLED_COHESION = 1;

export type RequestKind =
  | "ruolo_scoperto"
  | "reparto_debole"
  | "un_giovane"
  | "un_titolare"
  | "un_esperto"
  | "un_portiere"
  | "sfoltire"
  | "un_connazionale";

/**
 * Dopo quante sessioni di mercato ignorate l'allenatore se ne va.
 *
 * Non è un capriccio: è ciò che dà **peso** alle sue richieste. Se ignorarlo non costasse
 * nulla, la richiesta sarebbe un suggerimento decorativo — e l'utente ha chiesto proprio più
 * rapporto con la panchina. Due sessioni sono un margine onesto: la prima si può non poterla
 * accontentare per mancanza di soldi, la seconda è una scelta.
 */
export const PATIENCE_WINDOWS = 2;

export interface CoachRequest {
  kind: RequestKind;
  /** Il ruolo su cui insiste, se la richiesta è puntuale. */
  role?: Role;
  /** Overall minimo perché la richiesta si consideri soddisfatta. */
  minOverall: number;
  /** Età massima, per la richiesta di un giovane. */
  maxAge?: number;
  /** Il testo che l'allenatore dice, già pronto per la UI. */
  message: string;
}

export interface CoachRequestInput {
  coach: Coach;
  formation: Formation;
  roster: readonly RosterEntry[];
  players: PlayerIndex;
  /** Età di un giocatore nella stagione corrente. */
  ageOf: (playerId: string) => number;
  /**
   * Quale finestra è aperta.
   *
   * Cambia **cosa ha senso chiedere**: il colpo che decide le partite si costruisce d'estate,
   * quando c'è tempo per inserirlo; a gennaio un allenatore chiede quel che serve *adesso* —
   * turare una falla, non rifondare. Chiedere il fuoriclasse a riparazione era una richiesta
   * che l'utente non poteva prendere sul serio.
   */
  window?: "estiva" | "riparazione";
  /**
   * Cosa aveva chiesto l'ultima volta.
   *
   * Non serve a variare per il gusto di variare: serve a rompere i pareggi. Quando due caselle
   * sono ugualmente scoperte, riproporre esattamente la stessa dell'anno prima fa sembrare che
   * il mister non abbia guardato la rosa — che è la segnalazione dell'utente. Se invece quella
   * casella è **davvero** la peggiore e con un margine chiaro, la richiesta si ripete: mentire
   * sarebbe peggio che ripetersi.
   */
  previous?: { kind: RequestKind; role?: Role };
}

/**
 * Quanto deve essere peggiore una casella perché il mister la richieda **di nuovo** dopo averla
 * già chiesta: sotto questo margine si preferisce la seconda peggiore.
 */
const MARGINE_RIPETIZIONE = 2;

/** Sotto questo scarto dal livello della rosa una casella non è "debole", è normale. */
const SCARTO_MINIMO_RUOLO = 3;

/**
 * **La copertura vera di ogni casella del modulo.**
 *
 * ⚠️ La versione precedente contava, per ogni ruolo, quante volte compariva come ruolo
 * principale o secondario in rosa. Due difetti, ed erano la causa diretta della segnalazione
 * *"mi chiede un ruolo dove sono già coperto"*:
 *
 *  1. **lo stesso uomo veniva contato su tutte le sue caselle**. Un difensore che sa fare il
 *     centrale e i due terzini copriva tre ruoli contemporaneamente, cosa che in campo non può
 *     fare: la copertura risultava molto più alta del vero;
 *  2. **si guardava solo il numero, mai il livello**. Un ruolo con due uomini da 62 in una rosa
 *     da 78 risultava "coperto" quanto uno con due titolari da 80.
 *
 * Qui la copertura è **esclusiva**: si assegna prima chi ha quel ruolo come principale, poi si
 * riempie con chi lo sa fare da secondario e non è già stato usato altrove — un corpo, una
 * casella. E accanto al conteggio si porta la **qualità** di chi la occuperebbe davvero, che è
 * l'informazione con cui un allenatore vero decide dove serve rinforzare.
 */
export interface RoleCoverage {
  role: Role;
  /** Quante caselle il modulo chiede per questo ruolo. */
  richieste: number;
  /** Quanti uomini distinti la coprono davvero, dopo l'assegnazione esclusiva. */
  uomini: number;
  /** Media degli Overall di chi la occuperebbe; 0 se non la copre nessuno. */
  qualita: number;
}

export function coverageOfFormation(
  formation: Formation,
  disponibili: readonly RosterEntry[],
  players: PlayerIndex,
): RoleCoverage[] {
  const richieste = new Map<Role, number>();
  for (const slot of formation.slots) {
    richieste.set(slot.role, (richieste.get(slot.role) ?? 0) + 1);
  }

  /**
   * L'ordine di assegnazione conta: si servono prima i ruoli **più rari** in rosa, altrimenti un
   * jolly finisce speso su una casella che aveva già i suoi titolari e ne lascia scoperta una
   * che solo lui sapeva fare.
   */
  const nativi = new Map<Role, RosterEntry[]>();
  const adattabili = new Map<Role, RosterEntry[]>();
  for (const role of richieste.keys()) {
    nativi.set(role, []);
    adattabili.set(role, []);
  }
  for (const entry of disponibili) {
    const player = players[entry.playerId];
    if (!player) continue;
    if (nativi.has(player.role)) nativi.get(player.role)!.push(entry);
    for (const r of player.secondaryRoles) {
      if (r !== player.role && adattabili.has(r)) adattabili.get(r)!.push(entry);
    }
  }

  const ordine = [...richieste.keys()].sort(
    (a, b) =>
      (nativi.get(a)!.length + adattabili.get(a)!.length) -
      (nativi.get(b)!.length + adattabili.get(b)!.length),
  );

  const usati = new Set<string>();
  const risultato = new Map<Role, RoleCoverage>();

  for (const role of ordine) {
    const quante = richieste.get(role) ?? 0;
    const scelti: RosterEntry[] = [];
    // Prima i nativi, dal più forte: sono quelli che quella casella la occupano davvero.
    for (const gruppo of [nativi.get(role)!, adattabili.get(role)!]) {
      for (const entry of [...gruppo].sort((a, b) => b.overall - a.overall)) {
        if (scelti.length >= quante) break;
        if (usati.has(entry.playerId)) continue;
        usati.add(entry.playerId);
        scelti.push(entry);
      }
    }
    risultato.set(role, {
      role,
      richieste: quante,
      uomini: scelti.length,
      qualita:
        scelti.length > 0 ? scelti.reduce((s, e) => s + e.overall, 0) / scelti.length : 0,
    });
  }

  // Restituita nell'ordine del modulo, non in quello di assegnazione: è come si legge il campo.
  return [...richieste.keys()].map((role) => risultato.get(role)!);
}

/**
 * Fra più caselle candidate sceglie quella su cui insistere, rispettando la richiesta
 * precedente: si ripete solo chi è peggiore delle altre con un margine chiaro.
 */
function scegliCasella(
  candidati: { role: Role; deficit: number }[],
  previous?: { kind: RequestKind; role?: Role },
): { role: Role; deficit: number } | undefined {
  if (candidati.length === 0) return undefined;
  const ordinati = [...candidati].sort((a, b) => b.deficit - a.deficit);
  const peggiore = ordinati[0]!;
  if (!previous?.role || previous.role !== peggiore.role) return peggiore;

  const alternativa = ordinati.find((c) => c.role !== peggiore.role);
  if (!alternativa) return peggiore;
  return peggiore.deficit - alternativa.deficit >= MARGINE_RIPETIZIONE ? peggiore : alternativa;
}

/**
 * La richiesta dell'allenatore per questa sessione.
 *
 * L'ordine di priorità è quello di un allenatore vero: prima le caselle che non sa coprire,
 * poi il reparto più debole, poi il lusso. `undefined` significa che la rosa gli va bene —
 * ed è un'informazione anche quella.
 */
export function coachRequest({
  coach,
  formation,
  roster,
  players,
  ageOf,
  window = "estiva",
  previous,
}: CoachRequestInput): CoachRequest | undefined {
  const estate = window === "estiva";
  const disponibili = roster.filter((e) => !e.loan?.hostClubId);
  const media =
    disponibili.length > 0
      ? disponibili.reduce((s, e) => s + e.overall, 0) / disponibili.length
      : 70;

  /**
   * Il metro di paragone non è la media della rosa ma **il livello di chi gioca**: con
   * venticinque giocatori la media è abbassata dal fondo rosa, e confrontarci una casella
   * titolare farebbe risultare forte anche un reparto mediocre.
   */
  const undici = [...disponibili].sort((a, b) => b.overall - a.overall).slice(0, 11);
  const livelloTitolari =
    undici.length > 0 ? undici.reduce((s, e) => s + e.overall, 0) / undici.length : media;

  const copertura = coverageOfFormation(formation, disponibili, players);

  // 1. Le caselle che non riesce a riempire: nessuno le sa fare, o non abbastanza gente.
  const scoperte = copertura
    .filter((c) => c.uomini < c.richieste)
    .map((c) => ({ role: c.role, deficit: (c.richieste - c.uomini) * 10 }));
  const scoperta = scegliCasella(scoperte, previous);
  if (scoperta) {
    return {
      kind: "ruolo_scoperto",
      role: scoperta.role,
      minOverall: Math.round(media - 3),
      message: `Con il ${formation.name} non ho nemmeno un ${ROLE_NOME[scoperta.role]} vero. Trovamelo, o quella casella la copro con un adattato.`,
    };
  }

  /**
   * 2. La casella **coperta ma non all'altezza**.
   *
   * Prima si individuava il reparto più debole e poi si chiedeva, di quel reparto, il ruolo con
   * più caselle nel modulo — quindi in difesa usciva `DC` ogni singola volta, anche dopo averne
   * comprati due, mentre il terzino che era il vero problema non veniva mai nominato. È
   * letteralmente la segnalazione dell'utente: *"mi chiede sempre lo stesso ruolo ogni anno
   * nonostante sia già coperto"*.
   *
   * Adesso il confronto è **per casella**: chi la occuperebbe, contro il livello di chi gioca.
   */
  const deboli = copertura
    .map((c) => ({ role: c.role, deficit: livelloTitolari - c.qualita }))
    .filter((c) => c.deficit >= SCARTO_MINIMO_RUOLO);
  const debole = scegliCasella(deboli, previous);
  if (debole) {
    const reparto = ROLE_DEPARTMENT[debole.role];
    return {
      kind: "reparto_debole",
      role: debole.role,
      // Deve alzare il livello di quella casella, non semplicemente occuparla: la soglia è
      // quella dei titolari, non la media della rosa.
      minOverall: Math.round(livelloTitolari),
      message: `${REPARTO_NOME[reparto] ?? reparto}: il ${ROLE_NOME[debole.role]} che ho è sotto il livello di chi gioca nelle altre zone. Serve qualcuno che alzi l'asticella lì.`,
    };
  }

  // 3. Un portiere vero: senza secondo portiere si gioca, ma il mister non è tranquillo.
  const portieri = disponibili.filter((e) => {
    const p = players[e.playerId];
    return p && ROLE_DEPARTMENT[p.role] === "POR";
  });
  if (portieri.length < 2) {
    return {
      kind: "un_portiere",
      role: "POR",
      minOverall: Math.round(media - 6),
      message:
        "Un solo portiere in rosa. Basta una storta in allenamento e mando in porta un difensore: prendimene un altro.",
    };
  }

  // 4. Un allenatore bravo coi giovani chiede materiale su cui lavorare — ma d'estate: a
  // gennaio un ragazzo da far crescere non risolve la stagione in corso.
  const giovani = disponibili.filter((e) => ageOf(e.playerId) <= 21).length;
  if (estate && coach.development >= 1.3 && giovani < 3) {
    return {
      kind: "un_giovane",
      minOverall: Math.round(media - 8),
      maxAge: 21,
      message:
        "Dammi un ragazzo su cui lavorare. Non deve essere pronto: deve avere qualcosa dentro, al resto ci penso io.",
    };
  }

  // 5. Uno spogliatoio di soli ragazzi ha bisogno di qualcuno che abbia già visto tutto.
  const esperti = disponibili.filter((e) => ageOf(e.playerId) >= 29).length;
  if (esperti === 0 && disponibili.length >= 14) {
    return {
      kind: "un_esperto",
      minOverall: Math.round(media),
      message:
        "Qui dentro sono tutti ragazzini. Serve uno che nello spogliatoio abbia già visto tutto, anche se non gioca ogni domenica.",
    };
  }

  // 6. Rosa gonfia: allenare trenta giocatori significa scontentarne quindici.
  if (disponibili.length >= 28) {
    return {
      kind: "sfoltire",
      minOverall: 0,
      message: `Siamo in ${disponibili.length}. Non riesco a dare campo a tutti e a fine mese ho mezza rosa che non mi parla: sfoltiamo.`,
    };
  }

  /**
   * 7. Rosa a posto: **d'estate** chiede il colpo, il fuoriclasse che decide le partite.
   *
   * Solo d'estate, ed è la correzione di una richiesta che non stava in piedi: a gennaio non si
   * costruisce una squadra attorno a un nuovo fuoriclasse, non c'è il tempo di inserirlo, e
   * l'utente si trovava davanti una richiesta che non poteva prendere sul serio.
   */
  const migliore = Math.max(...disponibili.map((e) => e.overall), 0);
  if (estate && migliore < media + 8) {
    return {
      kind: "un_titolare",
      minOverall: Math.round(media + 5),
      message:
        "La squadra è equilibrata ma non ha un giocatore che decide le partite da solo. Adesso c'è il tempo per inserirlo: se ci sono i soldi, prendiamolo.",
    };
  }

  // 8. A gennaio si chiede quel che serve subito: un giocatore pronto, non un progetto.
  if (!estate) {
    return {
      kind: "un_connazionale",
      minOverall: Math.round(media + 1),
      message:
        "Non rifondiamo a metà stagione. Se arriva uno pronto, che possa giocare da subito, lo prendo volentieri: altrimenti tiriamo avanti così.",
    };
  }

  // 9. Nulla di urgente: chiede comunque un rinforzo mirato, perché un allenatore chiede sempre.
  return {
    kind: "un_connazionale",
    minOverall: Math.round(media + 2),
    message:
      "Non abbiamo emergenze, e questo è già un lusso. Se però ti capita l'occasione giusta, io un rinforzo lo prendo sempre.",
  };
}

/** La richiesta è del tipo che si soddisfa **cedendo** invece che comprando? */
export function isReductionRequest(request: CoachRequest): boolean {
  return request.kind === "sfoltire";
}

/** La richiesta è stata soddisfatta da questo acquisto? */
export function requestSatisfiedBy(
  request: CoachRequest,
  acquisto: { overall: number; age: number; role: Role; secondaryRoles: Role[] },
): boolean {
  if (acquisto.overall < request.minOverall) return false;
  if (request.maxAge !== undefined && acquisto.age > request.maxAge) return false;
  if (request.role) {
    const copre = acquisto.role === request.role || acquisto.secondaryRoles.includes(request.role);
    if (!copre) return false;
  }
  return true;
}

const REPARTO_NOME: Record<string, string> = {
  POR: "In porta",
  DIF: "In difesa",
  CC: "A centrocampo",
  ATT: "In attacco",
};

export const ROLE_NOME: Record<Role, string> = {
  POR: "portiere",
  TD: "terzino destro",
  DC: "difensore centrale",
  TS: "terzino sinistro",
  QD: "quinto destro",
  MED: "mediano",
  QS: "quinto sinistro",
  ED: "esterno destro",
  CC: "centrocampista centrale",
  ES: "esterno sinistro",
  TQD: "trequartista destro",
  TRQ: "trequartista centrale",
  TQS: "trequartista sinistro",
  ATT: "attaccante",
};
