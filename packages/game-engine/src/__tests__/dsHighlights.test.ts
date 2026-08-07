/**
 * Le **azioni salienti** di una partita e la scelta di quali partite meritano di essere viste.
 *
 * La proprietà che tiene in piedi tutto: la cronaca **non inventa il risultato**. I gol sono
 * quelli del motore, ai minuti del motore; attorno si aggiunge solo il racconto. Se non fosse
 * vero, guardare una partita darebbe un esito diverso dal saltarla.
 */
import { describe, expect, it } from "vitest";
import {
  buildHighlights,
  buildShootout,
  isKeyMatch,
  keyMatchReason,
  layoutEleven,
  type MatchTheatreContext,
} from "../ds/highlights";
import type { MatchResult } from "../season/matchModel";

function undici(prefix: string): MatchTheatreContext["ourEleven"] {
  return [
    { playerId: `${prefix}-por`, department: "POR" },
    { playerId: `${prefix}-d1`, department: "DIF" },
    { playerId: `${prefix}-d2`, department: "DIF" },
    { playerId: `${prefix}-d3`, department: "DIF" },
    { playerId: `${prefix}-d4`, department: "DIF" },
    { playerId: `${prefix}-c1`, department: "CC" },
    { playerId: `${prefix}-c2`, department: "CC" },
    { playerId: `${prefix}-c3`, department: "CC" },
    { playerId: `${prefix}-a1`, department: "ATT" },
    { playerId: `${prefix}-a2`, department: "ATT" },
    { playerId: `${prefix}-a3`, department: "ATT" },
  ];
}

function partita(gf: number, ga: number): MatchResult {
  const events = [
    ...Array.from({ length: gf }, (_, i) => ({
      minute: 10 + i * 17,
      team: "for" as const,
      kind: i === 1 ? ("penalty" as const) : ("goal" as const),
      scorerId: `mio-${i}`,
    })),
    ...Array.from({ length: ga }, (_, i) => ({
      minute: 20 + i * 19,
      team: "against" as const,
      kind: "goal" as const,
      scorerId: `loro-${i}`,
    })),
  ].sort((a, b) => a.minute - b.minute);

  return {
    outcome: gf > ga ? "win" : gf === ga ? "draw" : "loss",
    goalsFor: gf,
    goalsAgainst: ga,
    scorerIds: events.filter((e) => e.team === "for").map((e) => e.scorerId),
    events,
  };
}

const nomeDi = (id: string | null) => (id ? `Tizio ${id}` : "Qualcuno");

describe("cronaca di una partita", () => {
  it("i gol della cronaca sono esattamente quelli del tabellino", () => {
    const result = partita(3, 1);
    const azioni = buildHighlights(result, "seme", nomeDi);
    const reti = azioni.filter((a) => a.kind === "gol" || a.kind === "rigore");
    expect(reti).toHaveLength(4);
    expect(reti.filter((a) => a.team === "for")).toHaveLength(3);
    expect(reti.filter((a) => a.team === "against")).toHaveLength(1);
    // Stessi minuti, nessuno inventato.
    expect(reti.map((a) => a.minute).sort((x, y) => x - y)).toEqual(
      result.events.map((e) => e.minute).sort((x, y) => x - y),
    );
  });

  it("il rigore è raccontato come tale", () => {
    const azioni = buildHighlights(partita(3, 0), "seme", nomeDi);
    const rigore = azioni.find((a) => a.kind === "rigore");
    expect(rigore).toBeDefined();
    expect(rigore!.text).toMatch(/[Rr]igore/);
  });

  it("attorno ai gol c'è del racconto, altrimenti non ci sarebbe niente da guardare", () => {
    const azioni = buildHighlights(partita(1, 0), "seme", nomeDi);
    const nonGol = azioni.filter((a) => a.kind !== "gol" && a.kind !== "rigore");
    expect(nonGol.length).toBeGreaterThanOrEqual(5);
  });

  it("le azioni sono in ordine di minuto e dentro i 90", () => {
    const azioni = buildHighlights(partita(2, 2), "seme", nomeDi);
    for (let i = 1; i < azioni.length; i++) {
      expect(azioni[i]!.minute).toBeGreaterThanOrEqual(azioni[i - 1]!.minute);
    }
    for (const a of azioni) {
      expect(a.minute).toBeGreaterThan(0);
      expect(a.minute).toBeLessThanOrEqual(90);
    }
  });

  it("ogni azione ha un punto sul campo, dalla parte giusta", () => {
    const azioni = buildHighlights(partita(2, 2), "seme", nomeDi);
    for (const a of azioni) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(100);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(100);
      // Le nostre azioni finiscono verso la loro porta, le loro verso la nostra.
      if (a.kind === "gol" || a.kind === "rigore") {
        if (a.team === "for") expect(a.x).toBeGreaterThan(60);
        else expect(a.x).toBeLessThan(40);
      }
    }
  });

  it("è deterministica: rivedere la stessa partita mostra le stesse azioni", () => {
    const result = partita(2, 1);
    expect(buildHighlights(result, "x", nomeDi)).toEqual(buildHighlights(result, "x", nomeDi));
  });

  it("semi diversi raccontano partite diverse, a parità di risultato", () => {
    const result = partita(2, 1);
    expect(buildHighlights(result, "a", nomeDi)).not.toEqual(buildHighlights(result, "b", nomeDi));
  });

  it("regge una partita senza gol", () => {
    const azioni = buildHighlights(partita(0, 0), "seme", nomeDi);
    expect(azioni.length).toBeGreaterThan(0);
    expect(azioni.every((a) => a.kind !== "gol")).toBe(true);
  });

  it("ogni azione possiede una sequenza di micro-fasi (steps) valida per la vista 2D", () => {
    const azioni = buildHighlights(partita(1, 1), "seme", nomeDi);
    for (const a of azioni) {
      expect(a.steps).toBeDefined();
      expect(a.steps.length).toBeGreaterThanOrEqual(2);
      for (const step of a.steps) {
        expect(step.durationMs).toBeGreaterThan(0);
        expect(step.trajectory).toBeDefined();
      }
    }
  });
});

describe("formazioni vere nel Match Theatre", () => {
  const context: MatchTheatreContext = { ourEleven: undici("noi"), opponentEleven: undici("loro") };

  it("ogni titolare ha una posizione, dentro i bordi del campo", () => {
    const pos = layoutEleven(context.ourEleven, "for");
    expect(pos.size).toBe(11);
    for (const { x, y } of pos.values()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it("le due squadre si schierano specchiate: il portiere di 'for' è dalla parte opposta di 'against'", () => {
    const nostra = layoutEleven(context.ourEleven, "for");
    const loro = layoutEleven(context.opponentEleven, "against");
    const nostroPor = nostra.get("noi-por")!;
    const loroPor = loro.get("loro-por")!;
    expect(nostroPor.x).toBeLessThan(50);
    expect(loroPor.x).toBeGreaterThan(50);
  });

  it("i gol coinvolgono giocatori veri della formazione, non ruoli generici", () => {
    const result = partita(2, 1);
    const azioni = buildHighlights(result, "seme-formazioni", nomeDi, context);
    const gol = azioni.filter((a) => a.kind === "gol" || a.kind === "rigore");
    for (const g of gol) {
      // Lo scorer (playerId) è sempre quello vero del tabellino, mai sostituito.
      expect(g.playerId).toMatch(/^(mio|loro)-/);
      expect(g.involvedPlayerIds).toBeDefined();
    }
  });

  it("resta deterministico anche con le formazioni vere", () => {
    const result = partita(1, 1);
    const a = buildHighlights(result, "stesso-seme", nomeDi, context);
    const b = buildHighlights(result, "stesso-seme", nomeDi, context);
    expect(a).toEqual(b);
  });

  it("senza formazioni il comportamento resta quello di sempre (nessuna rottura)", () => {
    const result = partita(2, 0);
    const azioni = buildHighlights(result, "senza-contesto", nomeDi);
    expect(azioni.length).toBeGreaterThan(0);
    // Le occasioni (non gol) non hanno un giocatore noto senza formazioni: non si inventa nessuno.
    const occasioni = azioni.filter((a) => a.kind !== "gol" && a.kind !== "rigore");
    expect(occasioni.every((a) => (a.involvedPlayerIds ?? []).length === 0)).toBe(true);
  });

  /**
   * Sez. 9c del pacchetto "motore 2D più vivo": la costruzione di un gol/occasione si allunga
   * a 2-3 passaggi reali (chi la recupera, chi la rifinisce, chi conclude) invece del singolo
   * passaggio passatore→tiratore di prima — con un pool ricco come `undici()` (4 DIF, 3 CC),
   * i tre ruoli devono essere tre giocatori realmente distinti.
   */
  /** Solo gol "normali" (niente rigori: sul dischetto è sempre e solo il tiratore, di proposito). */
  function partitaSenzaRigori(gf: number): MatchResult {
    const events = Array.from({ length: gf }, (_, i) => ({
      minute: 10 + i * 17,
      team: "for" as const,
      kind: "goal" as const,
      scorerId: `mio-${i}`,
    }));
    return {
      outcome: "win",
      goalsFor: gf,
      goalsAgainst: 0,
      scorerIds: events.map((e) => e.scorerId),
      events,
    };
  }

  it("un'azione da gol con formazioni ricche costruisce almeno 3 passaggi reali", () => {
    const result = partitaSenzaRigori(3);
    const azioni = buildHighlights(result, "catena-lunga", nomeDi, context);
    const gol = azioni.filter((a) => a.kind === "gol");
    expect(gol.length).toBe(3);
    for (const g of gol) {
      // Almeno tre step con un fromPlayerId noto: il recupero, la costruzione/cross, il tiro.
      const conMittente = g.steps.filter((s) => !!s.fromPlayerId);
      expect(conMittente.length).toBeGreaterThanOrEqual(3);
      // Il primo tocco (chi recupera palla) è un giocatore diverso da chi rifinisce/tira: è
      // proprio il passaggio in più che allunga la catena rispetto a prima.
      const mittenti = new Set(conMittente.map((s) => s.fromPlayerId));
      expect(mittenti.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("guardare o saltare l'azione non cambia nulla del risultato: la catena è solo racconto", () => {
    // Stesso principio già garantito per il resto della cronaca: allungare la costruzione non
    // tocca `MatchResult`, quindi non c'è nulla da ri-verificare sul risultato — qui si
    // verifica solo che la proprietà "il gol resta quello vero" tenga anche con la catena.
    const result = partitaSenzaRigori(2);
    const azioni = buildHighlights(result, "catena-esito", nomeDi, context);
    const gol = azioni.filter((a) => a.kind === "gol");
    expect(gol.map((g) => g.playerId).sort()).toEqual(result.scorerIds.slice().sort());
  });
});

describe("rigori: la sequenza racconta un esito già deciso", () => {
  it("chi vince fa tutti e cinque i tiri", () => {
    const kicks = buildShootout(true, "seme-vinto");
    const nostri = kicks.filter((k) => k.team === "for");
    expect(nostri).toHaveLength(5);
    expect(nostri.every((k) => k.scored)).toBe(true);
    const loro = kicks.filter((k) => k.team === "against");
    expect(loro.filter((k) => k.scored)).toHaveLength(4);
  });

  it("chi perde ne sbaglia esattamente uno", () => {
    const kicks = buildShootout(false, "seme-perso");
    const nostri = kicks.filter((k) => k.team === "for");
    expect(nostri.filter((k) => k.scored)).toHaveLength(4);
    const loro = kicks.filter((k) => k.team === "against");
    expect(loro.every((k) => k.scored)).toBe(true);
  });

  it("è deterministico per lo stesso seme, ma varia da un seme all'altro", () => {
    const a = buildShootout(false, "seme-x");
    const b = buildShootout(false, "seme-x");
    expect(a).toEqual(b);
    const c = buildShootout(false, "seme-y");
    expect(a).not.toEqual(c);
  });

  it("l'ordine dei tiri alterna le due squadre, 10 tiri in tutto", () => {
    const kicks = buildShootout(true, "seme-ordine");
    expect(kicks).toHaveLength(10);
    for (let i = 0; i < kicks.length; i += 2) {
      expect(kicks[i]!.team).toBe("for");
      expect(kicks[i + 1]!.team).toBe("against");
    }
  });
});

describe("quali partite meritano di essere viste", () => {
  it("tutto il tabellone di Corona conta: ogni gara è un'eliminazione", () => {
    for (const stage of ["quarti", "semifinali", "finale"]) {
      expect(isKeyMatch({ cupStage: stage, totalRounds: 38 })).toBe(true);
    }
  });

  it("il girone di Corona no: sono sei partite, non un'eliminazione", () => {
    expect(isKeyMatch({ cupStage: "girone", totalRounds: 38 })).toBe(false);
  });

  it("in campionato conta solo la volata, e solo se siamo in corsa", () => {
    // Ultima giornata, primi: conta.
    expect(isKeyMatch({ leagueRound: 36, totalRounds: 38, position: 1 })).toBe(true);
    // Ultima giornata, decimi e lontani: non conta.
    expect(
      isKeyMatch({ leagueRound: 36, totalRounds: 38, position: 10, gapFromFirst: 30 }),
    ).toBe(false);
    // Metà stagione, primi: non conta ancora.
    expect(isKeyMatch({ leagueRound: 12, totalRounds: 38, position: 1 })).toBe(false);
  });

  it("chi insegue a pochi punti è in corsa quanto chi guida", () => {
    expect(
      isKeyMatch({ leagueRound: 35, totalRounds: 38, position: 4, gapFromFirst: 3 }),
    ).toBe(true);
  });

  it("scontro diretto fra le prime quattro: conta a prescindere dalla giornata", () => {
    expect(
      isKeyMatch({ leagueRound: 10, totalRounds: 38, position: 3, opponentPosition: 2 }),
    ).toBe(true);
  });

  it("non è uno scontro diretto se l'avversaria è fuori dal vertice", () => {
    expect(
      isKeyMatch({ leagueRound: 10, totalRounds: 38, position: 2, opponentPosition: 12 }),
    ).toBe(false);
  });

  it("il motivo distingue lo scontro diretto dalla volata", () => {
    expect(
      keyMatchReason({ leagueRound: 10, totalRounds: 38, position: 1, opponentPosition: 3 }),
    ).toMatch(/[Ss]contro diretto/);
  });

  it("il motivo è scritto e comprensibile", () => {
    expect(keyMatchReason({ cupStage: "finale", totalRounds: 38 })).toMatch(/[Ff]inale/);
    expect(keyMatchReason({ leagueRound: 36, totalRounds: 38, position: 1 })).toMatch(/titolo/i);
  });
});
