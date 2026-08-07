import { ROLE_MAX_SLOTS } from "@app/shared-types";
import type { Formation, FormationSlot, Role } from "@app/shared-types";

/**
 * Adiacenza fisica sullo "scacchiere" tattico (sez. 3.1 CLAUDE.md), su due livelli.
 *
 * 1. `BOARD_EDGES` — adiacenza tra RUOLI (14 nodi): ogni ruolo è collegato ai vicini
 *    nella stessa linea e ai vicini nelle linee immediatamente sopra/sotto. Usata per le
 *    linee di chemistry (sez. 3.4): due giocatori sono collegabili solo se i loro ruoli
 *    sono adiacenti qui, **indipendentemente dal reparto** — le linee attraversano anche
 *    reparti diversi (es. difensore centrale ↔ mediano) e, dove serve, saltano una linea
 *    vuota. Garanzia verificata da un test: in ogni modulo il grafo è **connesso**, cioè
 *    non esiste nessuna casella (portiere compreso) tagliata fuori dal resto della squadra.
 *
 * 2. `formationBoardEdges` — adiacenza tra SLOT di un modulo concreto: i ruoli centrali
 *    occupano più caselle contigue (`ROLE_MAX_SLOTS`), quindi un singolo arco ruolo→ruolo
 *    va distribuito sulle occorrenze reali. Es. `DC`↔`MED` in un 3-5-2 (3 difensori
 *    centrali, 2 mediani) non significa 6 linee incrociate ma 4, tra le caselle
 *    effettivamente vicine — vedi `ROLE_SPAN` e la regola di sovrapposizione sotto.
 *
 * Grafo non orientato, scritto a mano come lista di archi e poi reso simmetrico.
 */
const BOARD_EDGES: [Role, Role][] = [
  // Linea 2 (difensori) — vicini nella stessa linea
  ["TS", "DC"],
  ["DC", "TD"],
  // Linea 2 -> Linea 3 (mediani/terzini alti)
  ["TS", "QS"],
  ["DC", "MED"],
  ["TD", "QD"],
  // Linea 3 — vicini nella stessa linea
  ["QS", "MED"],
  ["MED", "QD"],
  // Linea 3 -> Linea 4 (centrocampo)
  ["QS", "ES"],
  ["MED", "CC"],
  ["QD", "ED"],
  // Linea 4 — vicini nella stessa linea
  ["ES", "CC"],
  ["CC", "ED"],
  // Linea 4 -> Linea 5 (trequartisti)
  ["ES", "TQS"],
  ["CC", "TRQ"],
  ["ED", "TQD"],
  // I trequartisti LARGHI arrivano anche sul centrocampista centrale della loro fascia
  // (quello più vicino, scelto dalla regola di sovrapposizione): in un fronte a 3 sono
  // loro a dare l'ampiezza e a legarsi al centrocampo, non solo agli esterni.
  ["TQS", "CC"],
  ["CC", "TQD"],
  // Linea 5 — vicini nella stessa linea
  ["TQS", "TRQ"],
  ["TRQ", "TQD"],
  // Linea 5 -> Linea 6 (attacco): il trequartista centrale e, quando è schierato, anche
  // il trequartista largo della stessa fascia — il fronte offensivo resta collegato anche
  // nei moduli senza TRQ (es. 4-3-3, 3-4-3, 4-2-4).
  ["TRQ", "ATT"],
  ["TQS", "ATT"],
  ["TQD", "ATT"],

  /* ---------------------------------------------------------------------- */
  /* Collegamenti fra reparti non contigui                                    */
  /*                                                                          */
  /* Gli archi sopra collegano solo linee consecutive, e questo lasciava buchi */
  /* enormi ogni volta che un modulo **salta** una linea: nel 4-4-2 e nel      */
  /* 4-4-1-1 la linea 3 è vuota, quindi la difesa non aveva NESSUN legame col  */
  /* centrocampo; nel 4-2-4 è vuota la linea 4 e la squadra si spezzava in due */
  /* tronconi separati. Gli archi qui sotto scavalcano la linea mancante e     */
  /* tengono insieme il reparto, esattamente come chiesto ("collegare i vari   */
  /* reparti tra loro").                                                       */
  /* ---------------------------------------------------------------------- */

  // Il portiere non è più isolato: fa parte della linea difensiva e la costruzione parte
  // da lui. Con una difesa a 3 la regola di fascia lo lega al centrale puro, con una a 4
  // a entrambi i centrali.
  ["POR", "TS"],
  ["POR", "DC"],
  ["POR", "TD"],
  // Terzino e esterno di centrocampo della **stessa fascia**: la catena di banda.
  ["TS", "ES"],
  ["TD", "ED"],
  // Colonna centrale difesa ↔ centrocampo: indispensabile quando la linea dei mediani
  // non è schierata, utile come legame di "spina dorsale" quando lo è.
  ["DC", "CC"],
  // Colonna centrale mediano ↔ trequartista.
  ["MED", "TRQ"],
  // Mediano ↔ trequartisti larghi: unico ponte verso il fronte nei moduli senza linea di
  // centrocampo (4-2-4). La regola di fascia manda ciascun mediano sul suo lato.
  ["MED", "TQS"],
  ["MED", "TQD"],
  // Quinto e trequartista largo della stessa fascia: la catena di banda alta.
  ["QS", "TQS"],
  ["QD", "TQD"],
  // Centrocampista centrale ↔ attaccante: il rifornimento della punta.
  ["CC", "ATT"],
];

function buildAdjacency(edges: [Role, Role][]): Record<Role, Role[]> {
  const adjacency = { POR: [] } as unknown as Record<Role, Role[]>;
  for (const [a, b] of edges) {
    (adjacency[a] ??= []).push(b);
    (adjacency[b] ??= []).push(a);
  }
  return adjacency;
}

/** Ruoli vicini per ciascun ruolo sullo scacchiere. */
export const ROLE_ADJACENCY: Record<Role, Role[]> = buildAdjacency(BOARD_EDGES);

export function areRolesAdjacent(a: Role, b: Role): boolean {
  return ROLE_ADJACENCY[a]?.includes(b) ?? false;
}

/**
 * Fascia orizzontale occupata da ciascun ruolo sulla sua linea (0 = fascia sinistra,
 * 1 = fascia destra). I ruoli centrali occupano la fascia centrale e la suddividono in
 * parti uguali tra le loro occorrenze effettive nel modulo; i ruoli laterali occupano
 * solo la loro fascia. Serve a decidere QUALI occorrenze si collegano tra loro.
 */
const ROLE_SPAN: Record<Role, [number, number]> = {
  POR: [0.4, 0.6],
  TS: [0, 0.2],
  DC: [0.2, 0.8],
  TD: [0.8, 1],
  QS: [0, 0.25],
  MED: [0.25, 0.75],
  QD: [0.75, 1],
  ES: [0, 0.2],
  CC: [0.2, 0.8],
  ED: [0.8, 1],
  TQS: [0, 0.25],
  TRQ: [0.25, 0.75],
  TQD: [0.75, 1],
  ATT: [0.25, 0.75],
};

const SPAN_EPSILON = 1e-6;

/** Sotto-fasce delle `count` occorrenze di un ruolo, da sinistra a destra. */
function occurrenceSpans(role: Role, count: number): [number, number][] {
  const [from, to] = ROLE_SPAN[role];
  const width = (to - from) / count;
  return Array.from(
    { length: count },
    (_, i) => [from + i * width, from + (i + 1) * width] as [number, number],
  );
}

function spansOverlap(a: [number, number], b: [number, number]): boolean {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > SPAN_EPSILON;
}

function spanCenter(span: [number, number]): number {
  return (span[0] + span[1]) / 2;
}

export interface BoardSlotEdge {
  slotAId: string;
  slotBId: string;
}

/**
 * Occorrenze di ciascun ruolo nel modulo, nell'ordine in cui compaiono in
 * `formation.slots` — che per convenzione è l'ordine da SINISTRA a DESTRA sul campo
 * (stessa convenzione usata da `pitchLayouts.ts` per assegnare le coordinate, così le
 * linee disegnate coincidono con quelle calcolate).
 */
function slotsByRole(formation: Formation): Map<Role, FormationSlot[]> {
  const map = new Map<Role, FormationSlot[]>();
  for (const slot of formation.slots) {
    const list = map.get(slot.role) ?? [];
    list.push(slot);
    map.set(slot.role, list);
  }
  return map;
}

/**
 * Coppie di caselle adiacenti in un modulo concreto — unica fonte di verità sia per le
 * linee di chemistry disegnate sia per il bonus numerico (sez. 3.4).
 *
 * Per ogni arco ruolo→ruolo del tabellone, le occorrenze dei due ruoli vengono collegate
 * per **sovrapposizione di fascia**; se un'occorrenza del ruolo meno numeroso non si
 * sovrappone a nessuna (tipico dei laterali, che stanno fuori dalla fascia centrale) si
 * collega solo alla più vicina. In più, le occorrenze contigue dello stesso ruolo
 * centrale (es. i 3 difensori centrali di una difesa a 3) sono sempre collegate tra loro.
 */
export function formationBoardEdges(formation: Formation): BoardSlotEdge[] {
  const byRole = slotsByRole(formation);
  const edges: BoardSlotEdge[] = [];
  const seen = new Set<string>();

  function addEdge(a: FormationSlot, b: FormationSlot) {
    const key = [a.id, b.id].sort().join("|");
    if (a.id === b.id || seen.has(key)) return;
    seen.add(key);
    edges.push({ slotAId: a.id, slotBId: b.id });
  }

  // Caselle contigue dello stesso ruolo centrale: sempre vicine tra loro.
  for (const [role, slots] of byRole) {
    if (ROLE_MAX_SLOTS[role] < 2) continue;
    for (let i = 0; i + 1 < slots.length; i++) addEdge(slots[i], slots[i + 1]);
  }

  for (const [roleA, roleB] of BOARD_EDGES) {
    const slotsA = byRole.get(roleA) ?? [];
    const slotsB = byRole.get(roleB) ?? [];
    if (slotsA.length === 0 || slotsB.length === 0) continue;

    // Si itera dal ruolo con meno caselle: quando le fasce si sovrappongono le due
    // direzioni danno lo stesso risultato, ma il ripiego "collegati alla piu' vicina"
    // sarebbe sbagliato dal lato piu' numeroso (collegherebbe TUTTI i centrali al
    // terzino invece del solo centrale di fascia).
    const [few, many] =
      slotsA.length <= slotsB.length ? [slotsA, slotsB] : [slotsB, slotsA];
    const fewSpans = occurrenceSpans(few[0].role, few.length);
    const manySpans = occurrenceSpans(many[0].role, many.length);

    few.forEach((slot, i) => {
      const overlapping = many.filter((_, j) => spansOverlap(fewSpans[i], manySpans[j]));
      if (overlapping.length > 0) {
        for (const other of overlapping) addEdge(slot, other);
        return;
      }
      const center = spanCenter(fewSpans[i]);
      let nearest = 0;
      for (let j = 1; j < many.length; j++) {
        if (Math.abs(spanCenter(manySpans[j]) - center) < Math.abs(spanCenter(manySpans[nearest]) - center)) {
          nearest = j;
        }
      }
      addEdge(slot, many[nearest]);
    });
  }

  return edges;
}
