/**
 * Coppa Tricolore: il formato deve reggere per costruzione, non per fortuna del sorteggio.
 *
 * I numeri sono la parte fragile — 40 squadre, 16 al preliminare, 24 esentate, 32 ai
 * sedicesimi — e un errore di uno si manifesterebbe come un tabellone che si inceppa a metà
 * stagione, quando ormai la carriera è avviata.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
  NATIONAL_CUP_STAGES,
  PRELIMINARY_TEAMS,
  createNationalCupState,
  nationalCupOutcomeOf,
  playNationalCupRound,
  type NationalCupState,
} from "../season/nationalCup";
import type { LeagueTeam } from "../season/leagueState";

const CLUBS_A = Array.from({ length: 20 }, (_, i) => `a-${i}`);
const CLUBS_B = Array.from({ length: 20 }, (_, i) => `b-${i}`);

function teams(): LeagueTeam[] {
  return [
    ...CLUBS_A.map((id, i) => ({
      id,
      name: id,
      rating: 78 - i * 0.4,
      strength: { attack: 78 - i * 0.4, defence: 77 - i * 0.4 },
    })),
    ...CLUBS_B.map((id, i) => ({
      id,
      name: id,
      rating: 66 - i * 0.3,
      strength: { attack: 66 - i * 0.3, defence: 65 - i * 0.3 },
    })),
  ];
}

function nuovaCoppa(seed = 1): NationalCupState {
  return createNationalCupState({
    teams: teams(),
    secondDivisionIds: CLUBS_B,
    random: mulberry32(seed),
  });
}

/** Gioca il torneo fino in fondo e restituisce lo stato finale. */
function giocaTutto(state: NationalCupState, seed = 99): NationalCupState {
  const random = mulberry32(seed);
  let current = state;
  for (let guard = 0; guard < 20; guard++) {
    if (current.winner !== undefined) break;
    current = playNationalCupRound(current, random).state;
  }
  return current;
}

describe("composizione del tabellone", () => {
  it("manda al preliminare sedici squadre, tutte di seconda divisione", () => {
    const coppa = nuovaCoppa();
    expect(coppa.stage).toBe("preliminare");
    expect(coppa.bracket).toHaveLength(PRELIMINARY_TEAMS);
    for (const i of coppa.bracket) {
      expect(CLUBS_B).toContain(coppa.teams[i]!.id);
    }
  });

  it("esenta le altre ventiquattro, le venti di Serie A comprese", () => {
    const coppa = nuovaCoppa();
    expect(coppa.byes).toHaveLength(40 - PRELIMINARY_TEAMS);
    const esentate = coppa.byes.map((i) => coppa.teams[i]!.id);
    for (const id of CLUBS_A) expect(esentate).toContain(id);
  });

  it("al preliminare vanno le più deboli della seconda divisione, non le prime dell'elenco", () => {
    const coppa = nuovaCoppa();
    const alPreliminare = new Set(coppa.bracket.map((i) => coppa.teams[i]!.id));
    // `b-19` è la più debole per costruzione, `b-0` la più forte delle venti.
    expect(alPreliminare.has("b-19")).toBe(true);
    expect(alPreliminare.has("b-0")).toBe(false);
  });

  it("nessuna squadra è insieme in tabellone e fra le esentate", () => {
    const coppa = nuovaCoppa();
    const inCampo = new Set(coppa.bracket);
    expect(coppa.byes.some((i) => inCampo.has(i))).toBe(false);
    expect(new Set([...coppa.bracket, ...coppa.byes]).size).toBe(40);
  });
});

describe("svolgimento del torneo", () => {
  it("dopo il preliminare restano trentadue squadre e nessuna esentata", () => {
    const dopo = playNationalCupRound(nuovaCoppa(), mulberry32(7)).state;
    expect(dopo.stage).toBe("sedicesimi");
    expect(dopo.bracket).toHaveLength(32);
    expect(dopo.byes).toHaveLength(0);
  });

  it("il tabellone si dimezza a ogni turno fino alla finale", () => {
    const random = mulberry32(11);
    let coppa = nuovaCoppa();
    const attese = [16, 32, 16, 8, 4, 2];
    for (const attesa of attese) {
      expect(coppa.bracket).toHaveLength(attesa);
      coppa = playNationalCupRound(coppa, random).state;
    }
    expect(coppa.winner).toBeDefined();
    expect(coppa.bracket).toHaveLength(0);
  });

  it("attraversa tutte e sei le fasi, una sola volta ciascuna", () => {
    const finale = giocaTutto(nuovaCoppa());
    const fasiGiocate = [...new Set(finale.log.map((t) => t.stage))];
    expect(fasiGiocate).toEqual([...NATIONAL_CUP_STAGES]);
  });

  it("produce un solo vincitore, e ha davvero giocato la finale", () => {
    const finale = giocaTutto(nuovaCoppa());
    const ultimaFinale = finale.log.filter((t) => t.stage === "finale");
    expect(ultimaFinale).toHaveLength(1);
    expect(ultimaFinale[0]!.winner).toBe(finale.winner);
  });

  it("una squadra eliminata non ricompare nei turni successivi", () => {
    const random = mulberry32(23);
    let coppa = nuovaCoppa();
    const eliminati = new Set<number>();
    for (let g = 0; g < 6; g++) {
      const { state, results } = playNationalCupRound(coppa, random);
      coppa = state;
      for (const tie of results) {
        const perdente = tie.winner === tie.home ? tie.away : tie.home;
        expect(eliminati.has(perdente)).toBe(false);
        expect(eliminati.has(tie.home)).toBe(false);
        expect(eliminati.has(tie.away)).toBe(false);
        eliminati.add(perdente);
      }
    }
  });

  it("chi vince ai rigori passa comunque il turno", () => {
    // I rigori sono una lotteria dichiarata, ma il vincitore deve essere coerente col tabellone.
    const finale = giocaTutto(nuovaCoppa(), 4);
    const aiRigori = finale.log.filter((t) => t.penalties);
    for (const tie of aiRigori) {
      const vinceCasa = tie.penalties!.home > tie.penalties!.away;
      expect(tie.winner).toBe(vinceCasa ? tie.home : tie.away);
    }
  });
});

describe("riproducibilità e cammino", () => {
  it("lo stesso seme dà lo stesso torneo", () => {
    const uno = giocaTutto(nuovaCoppa(3), 42);
    const due = giocaTutto(nuovaCoppa(3), 42);
    expect(uno.winner).toBe(due.winner);
    expect(uno.log).toEqual(due.log);
  });

  it("dice fin dove è arrivato un club, e riconosce chi ha vinto", () => {
    const finale = giocaTutto(nuovaCoppa());
    const vincitore = finale.teams[finale.winner!]!.id;
    expect(nationalCupOutcomeOf(finale, vincitore)).toBe("vittoria");

    // Chi non partecipa non ha un cammino da raccontare.
    expect(nationalCupOutcomeOf(finale, "club-inesistente")).toBeUndefined();

    // Tutti gli altri si sono fermati in una fase reale del torneo.
    for (const club of [...CLUBS_A, ...CLUBS_B].filter((id) => id !== vincitore)) {
      const esito = nationalCupOutcomeOf(finale, club);
      expect(NATIONAL_CUP_STAGES).toContain(esito as never);
    }
  });
});
