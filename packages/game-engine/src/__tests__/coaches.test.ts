/**
 * Bug segnalato dall'utente (due volte): la lista mister mostrava lo stesso allenatore due volte.
 *
 * La prima correzione deduplicava per nome dentro `availableCoaches`, ma lasciava gli alias
 * `c-01`..`c-24` dentro `COACHES`: chiunque leggesse il catalogo grezzo — ed è ciò che faceva
 * `CoachPickerScreen` per la scheda Svincolati — tornava a vedere i doppioni. Ora gli alias
 * vivono fuori dal catalogo (`LEGACY_COACH_IDS`, consultata solo da `findCoach`), quindi la
 * duplicazione è impossibile per costruzione e questi test la bloccano **sul catalogo**, non
 * sulla singola funzione che lo consuma.
 */
import { describe, expect, it } from "vitest";
import {
  COACHES,
  COACH_CONTRACT_LENGTHS,
  availableCoaches,
  coachSeasonsLeft,
  coachWageFor,
  computeCoachBuyoutFee,
  findCoach,
  getClubDefaultCoach,
  makeCoachContract,
  searchCoaches,
  severanceCost,
} from "../ds/coaches";
import { FORMATION_CODES } from "../formations";

describe("catalogo allenatori", () => {
  it("non contiene nomi duplicati, nemmeno nel catalogo grezzo", () => {
    const nomi = COACHES.map((c) => c.name);
    expect(new Set(nomi).size).toBe(nomi.length);
  });

  it("non contiene id duplicati", () => {
    const ids = COACHES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("l'elenco visibile non ha mai due allenatori con lo stesso nome", () => {
    const nomi = availableCoaches(5, Infinity).map((c) => c.name);
    expect(new Set(nomi).size).toBe(nomi.length);
  });

  it("i vecchi id alias restano risolvibili da findCoach (retrocompatibilità salvataggi)", () => {
    expect(findCoach("c-07")?.name).toBe("Antonio Conte");
    expect(findCoach("c-01")?.name).toBe("Simone Inzaghi");
    expect(findCoach("c-24")?.name).toBe("Maurizio Sarri");
    expect(findCoach("coach-conte")?.id).toBe("coach-conte");
  });

  it("è ampio e variegato: molti tecnici, tutti i moduli rappresentati, ogni fascia coperta", () => {
    expect(COACHES.length).toBeGreaterThanOrEqual(70);

    const moduli = new Set(COACHES.map((c) => c.formationId));
    for (const codice of FORMATION_CODES) {
      expect(moduli.has(codice), `nessun allenatore gioca ${codice}`).toBe(true);
    }

    for (const reputazione of [1, 2, 3, 4, 5]) {
      const quanti = COACHES.filter((c) => c.reputation === reputazione).length;
      expect(quanti, `nessun tecnico di reputazione ${reputazione}`).toBeGreaterThan(0);
    }

    expect(new Set(COACHES.map((c) => c.nation)).size).toBeGreaterThanOrEqual(10);
    expect(COACHES.filter((c) => c.isFreeAgent).length).toBeGreaterThanOrEqual(15);
  });

  it("ogni modulo dichiarato esiste davvero fra i moduli del gioco", () => {
    const validi = new Set<string>(FORMATION_CODES);
    for (const coach of COACHES) {
      expect(validi.has(coach.formationId), `${coach.name}: modulo ${coach.formationId}`).toBe(true);
    }
  });
});

describe("abbinamento club → allenatore di default", () => {
  it("distingue club che condividono una parola nel nome", () => {
    expect(getClubDefaultCoach("x", "Real Madrid")?.name).toBe("Carlo Ancelotti");
    expect(getClubDefaultCoach("x", "Real Sociedad")?.name).toBe("Imanol Alguacil");
  });

  it("non assegna un allenatore a un club che non ne ha uno", () => {
    expect(getClubDefaultCoach("x", "Squadra Inventata")).toBeUndefined();
  });
});

describe("contratto dell'allenatore", () => {
  it("un contratto lungo costa meno all'anno di uno corto", () => {
    const coach = findCoach("coach-conte")!;
    expect(coachWageFor(coach, 1)).toBeGreaterThan(coachWageFor(coach, 3));
    expect(coachWageFor(coach, 3)).toBeGreaterThan(coachWageFor(coach, 5));
  });

  it("le durate proponibili sono stagioni intere da 1 a 5", () => {
    expect([...COACH_CONTRACT_LENGTHS]).toEqual([1, 2, 3, 4, 5]);
  });

  it("la buonuscita cresce con le stagioni residue e cala a stagione avanzata", () => {
    const coach = findCoach("coach-conte")!;
    const lungo = makeCoachContract(coach, 4, 1);
    const corto = makeCoachContract(coach, 1, 1);

    expect(coachSeasonsLeft(lungo, 1)).toBe(4);
    expect(coachSeasonsLeft(corto, 1)).toBe(1);

    const conLungo = severanceCost(coach, 5, 38, lungo, 1);
    const conCorto = severanceCost(coach, 5, 38, corto, 1);
    expect(conLungo).toBeGreaterThan(conCorto);

    const aFineStagione = severanceCost(coach, 36, 38, corto, 1);
    expect(aFineStagione).toBeLessThan(conCorto);
  });

  it("la penale per strapparlo cresce con le stagioni che gli restano, ed è nulla a contratto finito", () => {
    const coach = findCoach("coach-conte")!;
    expect(computeCoachBuyoutFee(coach, 0)).toBe(0);
    expect(computeCoachBuyoutFee(coach, 3)).toBeGreaterThan(computeCoachBuyoutFee(coach, 1));
  });
});

describe("ricerca allenatori", () => {
  const base = { clubPrestigeTier: 5 };

  it("filtra per modulo", () => {
    const risultati = searchCoaches({ ...base, formations: ["3-5-2"] });
    expect(risultati.length).toBeGreaterThan(0);
    expect(risultati.every((r) => r.coach.formationId === "3-5-2")).toBe(true);
  });

  it("filtra per stato: gli svincolati non hanno penale, chi è sotto contratto sì", () => {
    const liberi = searchCoaches({ ...base, status: "svincolati" });
    expect(liberi.length).toBeGreaterThan(0);
    expect(liberi.every((r) => r.status === "libero" && r.buyoutFee === 0)).toBe(true);

    const legati = searchCoaches({ ...base, status: "sotto_contratto" });
    expect(legati.length).toBeGreaterThan(0);
    expect(legati.every((r) => r.status === "sotto_contratto" && r.buyoutFee > 0)).toBe(true);
  });

  it("la penale dichiarata segue le stagioni residue del contratto altrui", () => {
    const conte = findCoach("coach-conte")!;
    const [corto] = searchCoaches({
      ...base,
      text: "Conte",
      occupied: { [conte.id]: { clubId: "napoli", clubName: "Napoli", seasonsLeft: 1 } },
    });
    const [lungo] = searchCoaches({
      ...base,
      text: "Conte",
      occupied: { [conte.id]: { clubId: "napoli", clubName: "Napoli", seasonsLeft: 4 } },
    });
    expect(lungo!.buyoutFee).toBeGreaterThan(corto!.buyoutFee);
  });

  it("filtra per reputazione e per attitudine ai giovani", () => {
    const top = searchCoaches({ ...base, minReputation: 5 });
    expect(top.every((r) => r.coach.reputation === 5)).toBe(true);

    const giovani = searchCoaches({ ...base, youthOnly: true });
    expect(giovani.length).toBeGreaterThan(0);
    expect(giovani.every((r) => r.coach.development >= 1.45)).toBe(true);
  });

  it("filtra per stile di gioco", () => {
    const offensivi = searchCoaches({ ...base, style: "offensivo" });
    expect(offensivi.every((r) => r.coach.style.attack - r.coach.style.defence >= 1)).toBe(true);

    const difensivi = searchCoaches({ ...base, style: "difensivo" });
    expect(difensivi.every((r) => r.coach.style.attack - r.coach.style.defence <= -1)).toBe(true);
  });

  it("un club di basso prestigio non vede i tecnici d'élite", () => {
    const piccola = searchCoaches({ clubPrestigeTier: 1 });
    expect(piccola.every((r) => r.coach.reputation <= 2)).toBe(true);
    expect(piccola.length).toBeGreaterThan(0);
  });

  it("chi è già in carica da noi è marcato come tale e non ha penale", () => {
    const risultati = searchCoaches({ ...base, currentCoachId: "coach-conte", text: "Conte" });
    expect(risultati[0]!.status).toBe("in_carica");
    expect(risultati[0]!.buyoutFee).toBe(0);
  });
});
