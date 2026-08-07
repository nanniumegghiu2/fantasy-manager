import { describe, expect, it } from "vitest";
import { ROLES } from "@app/shared-types";
import { ROLE_ADJACENCY, areRolesAdjacent, formationBoardEdges } from "../board";
import { FORMATIONS, getFormation } from "../formations";

describe("ROLE_ADJACENCY", () => {
  it("copre tutti i 14 ruoli", () => {
    for (const role of ROLES) {
      expect(ROLE_ADJACENCY[role]).toBeDefined();
    }
  });

  it("il portiere è vicino solo della linea difensiva", () => {
    expect([...ROLE_ADJACENCY.POR].sort()).toEqual(["DC", "TD", "TS"]);
  });

  it("il grafo è simmetrico: se A è vicino di B, B è vicino di A", () => {
    for (const role of ROLES) {
      for (const neighbor of ROLE_ADJACENCY[role]) {
        expect(ROLE_ADJACENCY[neighbor]).toContain(role);
      }
    }
  });

  it("nessun ruolo (tranne il portiere) è isolato", () => {
    for (const role of ROLES) {
      if (role === "POR") continue;
      expect(ROLE_ADJACENCY[role].length).toBeGreaterThan(0);
    }
  });

  it("collega ruoli di reparti diversi (es. difensore centrale e mediano)", () => {
    expect(areRolesAdjacent("DC", "MED")).toBe(true);
    expect(areRolesAdjacent("MED", "CC")).toBe(true);
  });

  it("areRolesAdjacent è simmetrica e falsa per coppie lontane", () => {
    expect(areRolesAdjacent("TD", "QD")).toBe(true);
    expect(areRolesAdjacent("QD", "TD")).toBe(true);
    expect(areRolesAdjacent("TS", "ATT")).toBe(false);
    expect(areRolesAdjacent("POR", "TRQ")).toBe(false);
  });
});

describe("formationBoardEdges", () => {
  it("non produce archi duplicati né cappi, e usa solo slot del modulo", () => {
    for (const formation of FORMATIONS) {
      const slotIds = new Set(formation.slots.map((s) => s.id));
      const edges = formationBoardEdges(formation);
      const keys = edges.map((e) => [e.slotAId, e.slotBId].sort().join("|"));
      expect(new Set(keys).size).toBe(keys.length);
      for (const edge of edges) {
        expect(edge.slotAId).not.toBe(edge.slotBId);
        expect(slotIds.has(edge.slotAId)).toBe(true);
        expect(slotIds.has(edge.slotBId)).toBe(true);
      }
    }
  });

  it("il portiere compare in almeno un arco in ogni modulo", () => {
    for (const formation of FORMATIONS) {
      const goalkeeper = formation.slots.find((s) => s.role === "POR")!;
      const edges = formationBoardEdges(formation);
      expect(edges.some((e) => e.slotAId === goalkeeper.id || e.slotBId === goalkeeper.id)).toBe(
        true,
      );
    }
  });

  it("collega tra loro le caselle contigue di un ruolo centrale ripetuto (difesa a 3)", () => {
    const edges = formationBoardEdges(getFormation("3-5-2")!);
    const keys = new Set(edges.map((e) => [e.slotAId, e.slotBId].sort().join("|")));
    expect(keys.has("dc-1|dc-2")).toBe(true);
    expect(keys.has("dc-2|dc-3")).toBe(true);
    // I due centrali estremi non sono contigui: nessun arco diretto tra loro.
    expect(keys.has("dc-1|dc-3")).toBe(false);
  });

  it("un terzino si collega solo al centrale della sua fascia, non a tutti", () => {
    const edges = formationBoardEdges(getFormation("5-3-2")!);
    const neighborsOfTs = edges
      .filter((e) => e.slotAId === "ts" || e.slotBId === "ts")
      .map((e) => (e.slotAId === "ts" ? e.slotBId : e.slotAId));
    expect(neighborsOfTs.filter((id) => id.startsWith("dc"))).toEqual(["dc-1"]);
  });

  it("i trequartisti larghi si collegano al centrocampista centrale della loro fascia e alla punta", () => {
    const edges = formationBoardEdges(getFormation("4-3-3")!);
    const keys = new Set(edges.map((e) => [e.slotAId, e.slotBId].sort().join("|")));
    expect(keys.has("cc-1|tqs")).toBe(true);
    expect(keys.has("cc-2|tqd")).toBe(true);
    // ...e mai a quello della fascia opposta.
    expect(keys.has("cc-2|tqs")).toBe(false);
    expect(keys.has("cc-1|tqd")).toBe(false);
    expect(keys.has("att|tqs")).toBe(true);
    expect(keys.has("att|tqd")).toBe(true);
  });

  it("con due punte ogni trequartista largo si collega solo a quella della sua fascia", () => {
    const edges = formationBoardEdges(getFormation("4-2-4")!);
    const keys = new Set(edges.map((e) => [e.slotAId, e.slotBId].sort().join("|")));
    expect(keys.has("att-1|tqs")).toBe(true);
    expect(keys.has("att-2|tqd")).toBe(true);
    expect(keys.has("att-2|tqs")).toBe(false);
    expect(keys.has("att-1|tqd")).toBe(false);
  });

  it("distribuisce l'arco DC-MED sulle caselle vicine (3 centrali x 2 mediani = 4 linee, non 6)", () => {
    const edges = formationBoardEdges(getFormation("3-5-2")!);
    const pairs = edges
      .map((e) => [e.slotAId, e.slotBId].sort().join("|"))
      .filter((key) => key.includes("dc-") && key.includes("med-"));
    expect(pairs.sort()).toEqual(["dc-1|med-1", "dc-2|med-1", "dc-2|med-2", "dc-3|med-2"]);
  });

  it("nessuna casella resta senza vicini, in nessun modulo — portiere compreso", () => {
    for (const formation of FORMATIONS) {
      const edges = formationBoardEdges(formation);
      const connected = new Set(edges.flatMap((e) => [e.slotAId, e.slotBId]));
      const isolated = formation.slots.filter((s) => !connected.has(s.id)).map((s) => s.id);
      expect({ modulo: formation.name, isolated }).toEqual({ modulo: formation.name, isolated: [] });
    }
  });

  /**
   * Garanzia più forte del semplice "nessuna casella isolata": il grafo dev'essere **connesso**,
   * cioè da qualunque casella si deve poter raggiungere qualunque altra seguendo le linee.
   * Senza questo controllo restavano buchi invisibili — nel 4-2-4 la squadra si spezzava in
   * due tronconi (difesa+mediani da una parte, fronte offensivo dall'altra) pur non avendo
   * nessuna casella isolata.
   */
  it("il grafo delle linee è connesso in ogni modulo: nessun troncone separato", () => {
    for (const formation of FORMATIONS) {
      const adjacency = new Map(formation.slots.map((s) => [s.id, [] as string[]]));
      for (const edge of formationBoardEdges(formation)) {
        adjacency.get(edge.slotAId)!.push(edge.slotBId);
        adjacency.get(edge.slotBId)!.push(edge.slotAId);
      }
      const reached = new Set([formation.slots[0]!.id]);
      const stack = [formation.slots[0]!.id];
      while (stack.length > 0) {
        for (const next of adjacency.get(stack.pop()!)!) {
          if (!reached.has(next)) {
            reached.add(next);
            stack.push(next);
          }
        }
      }
      expect({ modulo: formation.name, raggiunte: reached.size }).toEqual({
        modulo: formation.name,
        raggiunte: formation.slots.length,
      });
    }
  });

  it("le catene di banda non attraversano il campo", () => {
    // Un terzino sinistro non può essere vicino di un esterno destro, e viceversa: la
    // fascia è una caratteristica reale del giocatore, non un dettaglio grafico.
    expect(areRolesAdjacent("TS", "ED")).toBe(false);
    expect(areRolesAdjacent("TD", "ES")).toBe(false);
    expect(areRolesAdjacent("QS", "TQD")).toBe(false);
    expect(areRolesAdjacent("QD", "TQS")).toBe(false);
    // Mentre la catena della propria fascia esiste.
    expect(areRolesAdjacent("TS", "ES")).toBe(true);
    expect(areRolesAdjacent("TD", "ED")).toBe(true);
    expect(areRolesAdjacent("QS", "TQS")).toBe(true);
    expect(areRolesAdjacent("QD", "TQD")).toBe(true);
  });

  it("il portiere è collegato alla propria linea difensiva", () => {
    expect(areRolesAdjacent("POR", "DC")).toBe(true);
    expect(areRolesAdjacent("POR", "TD")).toBe(true);
    expect(areRolesAdjacent("POR", "TS")).toBe(true);
    // ...ma non salta oltre la difesa.
    expect(areRolesAdjacent("POR", "CC")).toBe(false);
    expect(areRolesAdjacent("POR", "ATT")).toBe(false);
  });
});
