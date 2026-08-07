import { describe, expect, it } from "vitest";
import { ROLES, ROLE_DEPARTMENT, ROLE_MAX_SLOTS } from "@app/shared-types";
import { FORMATION_CODES, FORMATIONS, getFormation } from "../formations";

describe("FORMATIONS", () => {
  it("genera un modulo per ogni codice con esattamente 11 slot", () => {
    expect(FORMATIONS).toHaveLength(FORMATION_CODES.length);
    for (const formation of FORMATIONS) {
      expect(formation.slots).toHaveLength(11);
    }
  });

  it("ogni modulo ha esattamente un portiere", () => {
    for (const formation of FORMATIONS) {
      const goalkeepers = formation.slots.filter((s) => s.role === "POR");
      expect(goalkeepers).toHaveLength(1);
    }
  });

  it("il reparto di ogni slot e' coerente con la mappa ruolo->reparto", () => {
    for (const formation of FORMATIONS) {
      for (const slot of formation.slots) {
        expect(slot.department).toBe(ROLE_DEPARTMENT[slot.role]);
      }
    }
  });

  it("gli id degli slot sono unici all'interno del modulo", () => {
    for (const formation of FORMATIONS) {
      const ids = formation.slots.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("nessun modulo supera il numero di caselle disponibili per un ruolo", () => {
    for (const formation of FORMATIONS) {
      for (const role of ROLES) {
        const count = formation.slots.filter((s) => s.role === role).length;
        expect(count).toBeLessThanOrEqual(ROLE_MAX_SLOTS[role]);
      }
    }
  });

  it("i ruoli laterali non si ripetono mai (una sola casella sulla fascia)", () => {
    for (const formation of FORMATIONS) {
      const lateralRoles = formation.slots.map((s) => s.role).filter((r) => ROLE_MAX_SLOTS[r] === 1);
      expect(new Set(lateralRoles).size).toBe(lateralRoles.length);
    }
  });

  it("le occorrenze ripetute di un ruolo sono elencate consecutivamente (ordine = sinistra->destra)", () => {
    for (const formation of FORMATIONS) {
      const roles = formation.slots.map((s) => s.role);
      const firstIndex = new Map<string, number>();
      roles.forEach((role, i) => {
        if (!firstIndex.has(role)) firstIndex.set(role, i);
      });
      for (const [role, start] of firstIndex) {
        const count = roles.filter((r) => r === role).length;
        expect(roles.slice(start, start + count).every((r) => r === role)).toBe(true);
      }
    }
  });

  it("4-3-3 ha il layout di ruoli atteso (ampiezza dai trequartisti laterali, non dalla linea attaccanti)", () => {
    const formation = getFormation("4-3-3");
    expect(formation?.slots.map((s) => s.role)).toEqual([
      "POR",
      "TD",
      "DC",
      "DC",
      "TS",
      "MED",
      "CC",
      "CC",
      "TQD",
      "ATT",
      "TQS",
    ]);
  });

  it("i ruoli ripetuti ricevono slot id numerati (es. la coppia di centrali)", () => {
    const formation = getFormation("4-4-2");
    expect(formation?.slots.map((s) => s.id)).toEqual([
      "por",
      "td",
      "dc-1",
      "dc-2",
      "ts",
      "ed",
      "cc-1",
      "cc-2",
      "es",
      "att-1",
      "att-2",
    ]);
  });

  it("getFormation restituisce undefined per un id sconosciuto", () => {
    expect(getFormation("9-9-9")).toBeUndefined();
  });
});
