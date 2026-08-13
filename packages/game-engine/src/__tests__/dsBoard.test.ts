import { describe, expect, it } from "vitest";
import {
  BOARD_CONFIDENCE_FLOOR,
  boardMidSeasonWarning,
  boardSeasonVerdict,
  defaultBoard,
  resolveSackDemand,
  type BoardState,
} from "../ds/board";

/**
 * **La dirigenza** (richiesta esplicita dell'utente: *"un obiettivo non raggiunto deve portare
 * la dirigenza a chiedere l'esonero del mister"*).
 *
 * I test guardano le tre proprietà che rendono il sistema una decisione e non un avviso:
 * mancare l'obiettivo apre la richiesta, difendere il mister costa, e la fiducia che finisce
 * chiude la carriera.
 */

const base = (over: Partial<BoardState> = {}): BoardState => ({ ...defaultBoard(), ...over });

const stagione = (over: Partial<Parameters<typeof boardSeasonVerdict>[0]> = {}) =>
  boardSeasonVerdict({
    board: base(),
    season: 1,
    objective: { label: "Titolo", targetPosition: 1 },
    finalPosition: 1,
    teamsInLeague: 20,
    trophies: 0,
    coachName: "Il mister",
    hasCoach: true,
    ...over,
  });

describe("giudizio di fine stagione", () => {
  it("obiettivo centrato: la fiducia sale e non si chiede nessun esonero", () => {
    const v = stagione();
    expect(v.board.confidence).toBeGreaterThan(defaultBoard().confidence);
    expect(v.board.sackDemand).toBeUndefined();
    expect(v.dsSacked).toBe(false);
  });

  it("obiettivo mancato di parecchio: la fiducia scende e parte la richiesta di esonero", () => {
    const v = stagione({ finalPosition: 12 });
    expect(v.board.confidence).toBeLessThan(defaultBoard().confidence);
    expect(v.board.sackDemand).toBeDefined();
    expect(v.board.sackDemand?.coachName).toBe("Il mister");
    expect(v.board.sackDemand?.severity).toBe("richiesta");
  });

  it("senza un mister in panchina non si può chiedere l'esonero di nessuno", () => {
    const v = stagione({ finalPosition: 12, hasCoach: false, coachName: undefined });
    expect(v.board.sackDemand).toBeUndefined();
  });

  /**
   * La regola che tiene insieme il sistema: un trofeo compra tempo. Chi vince una coppa e manca
   * il campionato non si sente chiedere la testa del mister, ed è così anche nel calcio vero.
   */
  it("un trofeo vinto salva il mister anche se l'obiettivo di campionato è mancato", () => {
    const v = stagione({ finalPosition: 8, trophies: 1 });
    expect(v.board.sackDemand).toBeUndefined();
  });

  it("alla seconda insistenza la richiesta diventa un ultimatum", () => {
    const v = boardSeasonVerdict({
      board: base({ defiances: 1 }),
      season: 3,
      objective: { label: "Europa", targetPosition: 4 },
      finalPosition: 14,
      teamsInLeague: 20,
      trophies: 0,
      coachName: "Il mister",
      hasCoach: true,
    });
    expect(v.board.sackDemand?.severity).toBe("ultimatum");
  });

  it("la promozione mette al riparo, la retrocessione è il colpo più duro", () => {
    const su = stagione({ divisionOutcome: "promosso", finalPosition: 2, objective: { label: "Playoff", targetPosition: 8 } });
    const giu = stagione({ divisionOutcome: "retrocesso", finalPosition: 19 });
    expect(su.board.confidence).toBeGreaterThan(defaultBoard().confidence);
    expect(su.board.sackDemand).toBeUndefined();
    expect(giu.board.confidence).toBeLessThan(defaultBoard().confidence - 20);
  });

  it("la fiducia esaurita esonera il direttore sportivo", () => {
    const v = boardSeasonVerdict({
      board: base({ confidence: 30 }),
      season: 4,
      objective: { label: "Titolo", targetPosition: 1 },
      finalPosition: 18,
      teamsInLeague: 20,
      trophies: 0,
      hasCoach: true,
    });
    expect(v.board.confidence).toBeLessThan(BOARD_CONFIDENCE_FLOOR);
    expect(v.dsSacked).toBe(true);
  });
});

describe("risposta alla richiesta di esonero", () => {
  const conRichiesta = base({
    confidence: 50,
    sackDemand: {
      season: 2,
      objectiveLabel: "Europa",
      targetPosition: 4,
      finalPosition: 11,
      coachName: "Il mister",
      severity: "richiesta",
    },
  });

  it("assecondare la dirigenza libera la panchina e ricompone il rapporto", () => {
    const e = resolveSackDemand(conRichiesta, "esonera");
    expect(e.fireCoach).toBe(true);
    expect(e.board.confidence).toBeGreaterThan(conRichiesta.confidence);
    expect(e.board.sackDemand).toBeUndefined();
  });

  it("difendere il mister costa fiducia e lo lega a te", () => {
    const e = resolveSackDemand(conRichiesta, "difendi");
    expect(e.fireCoach).toBe(false);
    expect(e.board.confidence).toBeLessThan(conRichiesta.confidence);
    expect(e.coachHarmonyDelta).toBeGreaterThan(0);
    expect(e.board.defiances).toBe(1);
  });

  it("difendere il mister su un ultimatum costa il doppio e può finire la carriera", () => {
    const ultimatum = base({
      confidence: 40,
      defiances: 1,
      sackDemand: { ...conRichiesta.sackDemand!, severity: "ultimatum" },
    });
    const e = resolveSackDemand(ultimatum, "difendi");
    expect(e.board.confidence).toBeLessThan(BOARD_CONFIDENCE_FLOOR);
    expect(e.dsSacked).toBe(true);
  });
});

describe("richiamo di metà stagione", () => {
  const arg = {
    board: base(),
    season: 1,
    matchday: 25,
    totalMatchdays: 38,
    positionsBelowTarget: 8,
    objectiveLabel: "Europa",
  };

  it("arriva quando si è nettamente sotto, a campionato inoltrato", () => {
    const r = boardMidSeasonWarning(arg);
    expect(r).not.toBeNull();
    expect(r!.board.confidence).toBeLessThan(defaultBoard().confidence);
  });

  it("non arriva alla prima giornata, né se si è in linea con l'obiettivo", () => {
    expect(boardMidSeasonWarning({ ...arg, matchday: 3 })).toBeNull();
    expect(boardMidSeasonWarning({ ...arg, positionsBelowTarget: 1 })).toBeNull();
  });

  it("arriva una volta sola per stagione", () => {
    const primo = boardMidSeasonWarning(arg)!;
    expect(boardMidSeasonWarning({ ...arg, board: primo.board, matchday: 30 })).toBeNull();
  });
});
