import { describe, expect, it } from "vitest";
import { agreeWithBoard, boardSeasonMeeting } from "../ds/board";
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

/* -------------------------------------------------------------------------- */
/* Un tavolo solo: campionato e coppe                                          */
/* -------------------------------------------------------------------------- */

/**
 * ⚠️ Segnalazione dell'utente: *"nel meeting con la società devo decidere tutti gli obiettivi,
 * campionati e coppe, cosa che al momento si fa inutilmente in due fasi diverse"*.
 *
 * Prima il colloquio riguardava solo il campionato, e le coppe si dichiaravano in una schermata
 * successiva dove il presidente **non c'era**: una dichiarazione unilaterale, non un accordo. I
 * test qui verificano che la società abbia una posizione anche sulle coppe e che l'accordo sia
 * uno solo.
 */
describe("il colloquio copre anche le coppe", () => {
  const coppe = [
    {
      key: "continental" as const,
      competition: "Corona Continentale",
      tiers: [
        { label: "Semifinale", roundsFromWin: 2 },
        { label: "Quarti", roundsFromWin: 3 },
      ],
    },
  ];

  const base = {
    board: undefined,
    season: 2,
    tiers: [
      { label: "Titolo" as const, targetPosition: 1 },
      { label: "Europa" as const, targetPosition: 4 },
      { label: "Metà classifica" as const, targetPosition: 9 },
    ],
    realistic: { label: "Europa" as const, targetPosition: 4 },
    budgetMultiplierOf: () => 1,
    baseRevenue: 100_000_000,
    hasCoach: true,
  };

  it("la società dichiara un minimo anche in coppa", () => {
    const meeting = boardSeasonMeeting({ ...base, cups: coppe });
    expect(meeting.cups).toHaveLength(1);
    expect(meeting.cups[0]!.competition).toBe("Corona Continentale");
    expect(meeting.cups[0]!.minimum.label).toBeTruthy();
    // E lo dice: senza una frase, il minimo è un numero che nessuno legge.
    expect(meeting.cups[0]!.speech.length).toBeGreaterThan(10);
  });

  it("senza coppe il tavolo non ne parla, invece di mostrarne una vuota", () => {
    expect(boardSeasonMeeting(base).cups).toEqual([]);
  });

  it("puntare più in alto in coppa piace, puntare più in basso no", () => {
    const meeting = boardSeasonMeeting({ ...base, cups: coppe });
    const minimo = meeting.cups[0]!.minimum.label;
    const ambiziosa = meeting.cups[0]!.options.find((o) => o.label !== minimo)!;

    const alMinimo = agreeWithBoard(undefined, meeting, meeting.minimum.label, 0, {
      continental: minimo,
    });
    const piuSu = agreeWithBoard(undefined, meeting, meeting.minimum.label, 0, {
      continental: ambiziosa.label,
    });

    // Fra le due opzioni una è più ambiziosa dell'altra: quella deve muovere la fiducia nella
    // direzione giusta, qualunque delle due sia il minimo preteso.
    const piuAmbiziosa = ambiziosa.roundsFromWin < meeting.cups[0]!.minimum.roundsFromWin;
    if (piuAmbiziosa) expect(piuSu.board.confidence).toBeGreaterThan(alMinimo.board.confidence);
    else expect(piuSu.board.confidence).toBeLessThan(alMinimo.board.confidence);
  });

  it("chi non sceglie accetta il minimo: non è uno stato senza obiettivo", () => {
    const meeting = boardSeasonMeeting({ ...base, cups: coppe });
    const senzaScelta = agreeWithBoard(undefined, meeting, meeting.minimum.label, 0);
    const colMinimo = agreeWithBoard(undefined, meeting, meeting.minimum.label, 0, {
      continental: meeting.cups[0]!.minimum.label,
    });
    expect(senzaScelta.board.confidence).toBe(colMinimo.board.confidence);
  });
});
