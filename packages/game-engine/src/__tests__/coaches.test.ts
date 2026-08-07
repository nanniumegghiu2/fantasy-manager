/**
 * Bug segnalato dall'utente: la lista mister mostrava lo stesso allenatore due volte.
 * Causa: `COACHES` contiene, oltre al catalogo dettagliato, un blocco di alias `c-01`..`c-24`
 * tenuto apposta per `findCoach` sui salvataggi precedenti — `availableCoaches` (la lista
 * mostrata nel picker) deve dedupare per nome senza che questo rompa la retrocompatibilità.
 */
import { describe, expect, it } from "vitest";
import { availableCoaches, findCoach, COACHES } from "../ds/coaches";

describe("availableCoaches — nessun nome duplicato in lista", () => {
  it("il catalogo grezzo contiene alias duplicati (per costruzione, retrocompatibilità)", () => {
    const nomi = COACHES.map((c) => c.name);
    expect(new Set(nomi).size).toBeLessThan(nomi.length);
  });

  it("l'elenco visibile (availableCoaches) non ha mai due allenatori con lo stesso nome", () => {
    const lista = availableCoaches(5, Infinity);
    const nomi = lista.map((c) => c.name);
    expect(new Set(nomi).size).toBe(nomi.length);
  });

  it("il dedup tiene la voce del catalogo dettagliato, non l'alias", () => {
    const lista = availableCoaches(5, Infinity);
    const conte = lista.find((c) => c.name === "Antonio Conte");
    expect(conte?.id).toBe("coach-conte");
  });

  it("i vecchi id alias restano risolvibili da findCoach (retrocompatibilità salvataggi)", () => {
    expect(findCoach("c-07")?.name).toBe("Antonio Conte");
    expect(findCoach("c-01")?.name).toBe("Simone Inzaghi");
  });
});
