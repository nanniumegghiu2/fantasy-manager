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
}: CoachRequestInput): CoachRequest | undefined {
  const estate = window === "estiva";
  const disponibili = roster.filter((e) => !e.loan?.hostClubId);
  const media =
    disponibili.length > 0
      ? disponibili.reduce((s, e) => s + e.overall, 0) / disponibili.length
      : 70;

  // Quante caselle richiede ogni ruolo, e quanti uomini le sanno coprire.
  const richiesti = new Map<Role, number>();
  for (const slot of formation.slots) {
    richiesti.set(slot.role, (richiesti.get(slot.role) ?? 0) + 1);
  }
  const copertura = new Map<Role, number>();
  for (const entry of disponibili) {
    const player = players[entry.playerId];
    if (!player) continue;
    copertura.set(player.role, (copertura.get(player.role) ?? 0) + 1);
    for (const r of player.secondaryRoles) {
      copertura.set(r, (copertura.get(r) ?? 0) + 1);
    }
  }

  // 1. Una casella che non riesce a riempire: è la richiesta più urgente e più concreta.
  for (const [role, quante] of richiesti) {
    if ((copertura.get(role) ?? 0) < quante) {
      return {
        kind: "ruolo_scoperto",
        role,
        minOverall: Math.round(media - 3),
        message: `Con il ${formation.name} non ho nemmeno un ${ROLE_NOME[role]} vero. Trovamelo, o quella casella la copro con un adattato.`,
      };
    }
  }

  // 2. Il reparto più debole rispetto al resto della squadra.
  const perReparto = new Map<string, number[]>();
  for (const entry of disponibili) {
    const player = players[entry.playerId];
    if (!player) continue;
    const dep = ROLE_DEPARTMENT[player.role];
    const gruppo = perReparto.get(dep);
    if (gruppo) gruppo.push(entry.overall);
    else perReparto.set(dep, [entry.overall]);
  }

  let repartoDebole: string | undefined;
  let scartoPeggiore = 0;
  for (const [dep, valori] of perReparto) {
    const migliori = [...valori].sort((a, b) => b - a).slice(0, dep === "POR" ? 1 : 3);
    const mediaReparto = migliori.reduce((s, v) => s + v, 0) / migliori.length;
    const scarto = media - mediaReparto;
    if (scarto > scartoPeggiore) {
      scartoPeggiore = scarto;
      repartoDebole = dep;
    }
  }

  if (repartoDebole && scartoPeggiore >= 2) {
    const ruolo = ruoloPrincipaleDelReparto(formation, repartoDebole);
    return {
      kind: "reparto_debole",
      role: ruolo,
      minOverall: Math.round(media + 1),
      message: `${REPARTO_NOME[repartoDebole] ?? repartoDebole}: lì siamo sotto il livello del resto della squadra. Serve qualcuno che alzi l'asticella.`,
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

/** Un ruolo rappresentativo del reparto, fra quelli che il modulo schiera. */
function ruoloPrincipaleDelReparto(formation: Formation, department: string): Role | undefined {
  const conteggio = new Map<Role, number>();
  for (const slot of formation.slots) {
    if (ROLE_DEPARTMENT[slot.role] !== department) continue;
    conteggio.set(slot.role, (conteggio.get(slot.role) ?? 0) + 1);
  }
  let migliore: Role | undefined;
  let quante = 0;
  for (const [role, n] of conteggio) {
    if (n > quante) {
      quante = n;
      migliore = role;
    }
  }
  return migliore;
}

const REPARTO_NOME: Record<string, string> = {
  POR: "In porta",
  DIF: "In difesa",
  CC: "A centrocampo",
  ATT: "In attacco",
};

const ROLE_NOME: Record<Role, string> = {
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
