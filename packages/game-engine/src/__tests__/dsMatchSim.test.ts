/**
 * **Il motore 2D della partita.**
 *
 * La proprietà più importante, e la ragione per cui questi test esistono: il flusso di gioco
 * **non decide nulla**. I gol sono quelli del tabellino, ai minuti del tabellino, e nessun altro
 * possesso può finire in rete — non perché lo si controlli a valle, ma perché "gol" non compare
 * fra gli esiti pescabili. Se questa proprietà cadesse, guardare una partita darebbe un
 * risultato diverso dal saltarla, e la scelta offerta da `KeyMatchPrompt` sarebbe una trappola.
 */
import { describe, expect, it } from "vitest";
import {
  MATCH_SECONDS,
  ballAt,
  buildPitchPlayers,
  layoutEleven,
  phaseIndexAt,
  simulateMatchFlow,
  tacticalPosition,
  type MatchTheatreContext,
  type PitchPlayer,
} from "../ds/matchSim";
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
    { playerId: `${prefix}-c4`, department: "CC" },
    { playerId: `${prefix}-a1`, department: "ATT" },
    { playerId: `${prefix}-a2`, department: "ATT" },
  ];
}

const context: MatchTheatreContext = { ourEleven: undici("noi"), opponentEleven: undici("loro") };
const nomeDi = (id: string | null) => (id ? `Tizio ${id}` : "Qualcuno");

function partita(gf: number, ga: number): MatchResult {
  const events = [
    ...Array.from({ length: gf }, (_, i) => ({
      minute: 10 + i * 17,
      team: "for" as const,
      kind: i === 1 ? ("penalty" as const) : ("goal" as const),
      scorerId: `noi-a${(i % 2) + 1}`,
    })),
    ...Array.from({ length: ga }, (_, i) => ({
      minute: 20 + i * 19,
      team: "against" as const,
      kind: "goal" as const,
      scorerId: `loro-a${(i % 2) + 1}`,
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

describe("il flusso della partita non decide il risultato", () => {
  it("le reti del flusso sono esattamente quelle del tabellino, marcatori compresi", () => {
    const result = partita(3, 2);
    const flow = simulateMatchFlow(result, "seme", nomeDi, context);
    const reti = flow.phases.filter((p) => p.outcome === "gol");
    expect(reti).toHaveLength(5);
    expect(reti.filter((p) => p.team === "for")).toHaveLength(3);
    expect(reti.filter((p) => p.team === "against")).toHaveLength(2);
    expect(reti.map((p) => p.scorerId)).toEqual(result.events.map((e) => e.scorerId));
  });

  it("nessuna fase diversa da quelle programmate arriva in rete", () => {
    // Su molti semi: è la proprietà strutturale, non deve reggere "quasi sempre".
    for (let s = 0; s < 40; s++) {
      const result = partita(1, 1);
      const flow = simulateMatchFlow(result, `seme-${s}`, nomeDi, context);
      expect(flow.phases.filter((p) => p.outcome === "gol")).toHaveLength(2);
      expect(flow.stats.for.goals).toBe(1);
      expect(flow.stats.against.goals).toBe(1);
      // Nessun tocco "rete" fuori da una fase da gol.
      for (const fase of flow.phases) {
        if (fase.outcome === "gol") continue;
        expect(fase.touches.some((t) => t.kind === "rete")).toBe(false);
      }
    }
  });

  it("una partita senza gol resta senza gol, ma non senza gioco", () => {
    const flow = simulateMatchFlow(partita(0, 0), "zero", nomeDi, context);
    expect(flow.phases.every((p) => p.outcome !== "gol")).toBe(true);
    expect(flow.phases.length).toBeGreaterThan(50);
  });

  it("i gol cadono al minuto giusto del tabellino", () => {
    const result = partita(2, 1);
    const flow = simulateMatchFlow(result, "minuti", nomeDi, context);
    const reti = flow.phases.filter((p) => p.outcome === "gol");
    reti.forEach((fase, i) => {
      const atteso = result.events[i]!.minute;
      const minutoMostrato = Math.floor(fase.endSecond / 60) + 1;
      // Il secondo esatto è sparso dentro il minuto: si accetta lo scarto di un minuto.
      expect(Math.abs(minutoMostrato - atteso)).toBeLessThanOrEqual(1);
    });
  });
});

describe("il flusso copre la partita, non solo sei clip", () => {
  it("il gioco è continuo: ogni fase riparte dove è finita la precedente", () => {
    const flow = simulateMatchFlow(partita(1, 2), "continuo", nomeDi, context);
    for (let i = 1; i < flow.phases.length; i++) {
      expect(flow.phases[i]!.startSecond).toBeGreaterThanOrEqual(flow.phases[i - 1]!.endSecond);
    }
    expect(flow.phases[0]!.startSecond).toBe(0);
    expect(flow.phases[flow.phases.length - 1]!.endSecond).toBeGreaterThan(MATCH_SECONDS * 0.9);
  });

  it("sono decine di possessi, non una manciata di azioni salienti", () => {
    const flow = simulateMatchFlow(partita(2, 1), "quanti", nomeDi, context);
    expect(flow.phases.length).toBeGreaterThan(120);
    // Ma solo una parte merita il rallentatore: è ciò che rende guardabile una partita intera.
    const notevoli = flow.phases.filter((p) => p.notable);
    expect(notevoli.length).toBeGreaterThanOrEqual(4);
    expect(notevoli.length).toBeLessThan(flow.phases.length / 4);
  });

  it("ogni tocco sta dentro il campo e in ordine di tempo", () => {
    const flow = simulateMatchFlow(partita(3, 3), "bordi", nomeDi, context);
    for (const fase of flow.phases) {
      expect(fase.touches.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < fase.touches.length; i++) {
        const t = fase.touches[i]!;
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x).toBeLessThanOrEqual(100);
        expect(t.y).toBeGreaterThanOrEqual(0);
        expect(t.y).toBeLessThanOrEqual(100);
        if (i > 0) expect(t.t).toBeGreaterThanOrEqual(fase.touches[i - 1]!.t);
      }
    }
  });

  it("le reti finiscono dentro la porta giusta", () => {
    const flow = simulateMatchFlow(partita(3, 3), "porte", nomeDi, context);
    for (const fase of flow.phases.filter((p) => p.outcome === "gol")) {
      const rete = fase.touches[fase.touches.length - 1]!;
      expect(rete.kind).toBe("rete");
      if (fase.team === "for") expect(rete.x).toBeGreaterThan(90);
      else expect(rete.x).toBeLessThan(10);
    }
  });

  it("la palla passa fra giocatori veri delle due formazioni", () => {
    const flow = simulateMatchFlow(partita(1, 1), "veri", nomeDi, context);
    const idNoti = new Set(flow.players.map((p) => p.id));
    for (const fase of flow.phases) {
      for (const t of fase.touches) {
        if (t.playerId === null) continue;
        expect(idNoti.has(t.playerId)).toBe(true);
      }
    }
  });

  it("è deterministico per seme, e due semi raccontano partite diverse", () => {
    const result = partita(2, 1);
    expect(simulateMatchFlow(result, "x", nomeDi, context).phases).toEqual(
      simulateMatchFlow(result, "x", nomeDi, context).phases,
    );
    expect(simulateMatchFlow(result, "a", nomeDi, context).phases).not.toEqual(
      simulateMatchFlow(result, "b", nomeDi, context).phases,
    );
  });

  it("regge senza formazioni vere: due undici anonimi, stesso flusso", () => {
    const flow = simulateMatchFlow(partita(2, 0), "senza-contesto", nomeDi);
    expect(flow.players).toHaveLength(22);
    expect(flow.phases.filter((p) => p.outcome === "gol")).toHaveLength(2);
  });
});

describe("le statistiche escono da ciò che si è visto", () => {
  it("i tiri contano almeno le reti, e il possesso somma a cento", () => {
    const flow = simulateMatchFlow(partita(2, 1), "stat", nomeDi, context);
    expect(flow.stats.for.shots).toBeGreaterThanOrEqual(2);
    expect(flow.stats.against.shots).toBeGreaterThanOrEqual(1);
    expect(flow.stats.for.onTarget).toBeGreaterThanOrEqual(flow.stats.for.goals);
    expect(flow.stats.for.possession + flow.stats.against.possession).toBe(100);
  });

  it("una parata da una parte è un tiro in porta dall'altra", () => {
    const flow = simulateMatchFlow(partita(1, 1), "parate", nomeDi, context);
    const parateSubite = flow.phases.filter((p) => p.outcome === "parata" && p.team === "for").length;
    expect(flow.stats.against.saves).toBe(parateSubite);
  });

  it("i numeri restano nell'ordine di grandezza di una partita vera", () => {
    const flow = simulateMatchFlow(partita(2, 2), "realismo", nomeDi, context);
    const tiri = flow.stats.for.shots + flow.stats.against.shots;
    expect(tiri).toBeGreaterThan(6);
    expect(tiri).toBeLessThan(45);
  });
});

describe("la forma di squadra", () => {
  it("ogni titolare ha una posizione dentro i bordi del campo", () => {
    const pos = layoutEleven(context.ourEleven, "for");
    expect(pos.size).toBe(11);
    for (const { x, y } of pos.values()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it("le due squadre si schierano specchiate", () => {
    const nostra = layoutEleven(context.ourEleven, "for");
    const loro = layoutEleven(context.opponentEleven, "against");
    expect(nostra.get("noi-por")!.x).toBeLessThan(50);
    expect(loro.get("loro-por")!.x).toBeGreaterThan(50);
  });

  it("i due centrocampi non si sovrappongono: erano un grumo illeggibile", () => {
    const nostro = layoutEleven(context.ourEleven, "for").get("noi-c1")!;
    const loro = layoutEleven(context.opponentEleven, "against").get("loro-c1")!;
    expect(Math.abs(nostro.x - loro.x)).toBeGreaterThan(5);
  });

  it("i ventidue hanno numeri di maglia e fasi di oscillazione distinte", () => {
    const players = buildPitchPlayers(context);
    expect(players).toHaveLength(22);
    const portieri = players.filter((p) => p.department === "POR");
    expect(portieri.every((p) => p.shirt === 1)).toBe(true);
    // Se due compagni oscillassero in fase, il campo sembrerebbe una tabella animata.
    const fasi = new Set(players.map((p) => p.wobble));
    expect(fasi.size).toBeGreaterThan(18);
  });

  it("il blocco sale col possesso e rientra senza", () => {
    const players = buildPitchPlayers(context);
    const difensore = players.find((p) => p.side === "for" && p.department === "DIF")!;
    const conPalla = tacticalPosition(difensore, { ball: { x: 50, y: 50 }, possession: "for", intensity: 0.5 }, 0);
    const senzaPalla = tacticalPosition(
      difensore,
      { ball: { x: 50, y: 50 }, possession: "against", intensity: 0.5 },
      0,
    );
    expect(conPalla.x).toBeGreaterThan(senzaPalla.x);
  });

  it("la linea difensiva segue il pallone in profondità", () => {
    const players = buildPitchPlayers(context);
    const difensore = players.find((p) => p.side === "for" && p.department === "DIF")!;
    const pallaAvanti = tacticalPosition(
      difensore,
      { ball: { x: 85, y: 50 }, possession: "for", intensity: 0.5 },
      0,
    );
    const pallaIndietro = tacticalPosition(
      difensore,
      { ball: { x: 20, y: 50 }, possession: "for", intensity: 0.5 },
      0,
    );
    expect(pallaAvanti.x).toBeGreaterThan(pallaIndietro.x);
  });

  it("il portiere resta sui pali e scivola con la palla, senza mai uscire dall'area", () => {
    const players = buildPitchPlayers(context);
    const portiere = players.find((p) => p.side === "for" && p.department === "POR")!;
    for (const bx of [5, 30, 60, 95]) {
      for (const by of [5, 50, 95]) {
        const pos = tacticalPosition(portiere, { ball: { x: bx, y: by }, possession: "against", intensity: 1 }, 3);
        expect(pos.x).toBeLessThan(16);
        expect(pos.y).toBeGreaterThan(20);
        expect(pos.y).toBeLessThan(80);
      }
    }
    const vicino = tacticalPosition(portiere, { ball: { x: 8, y: 50 }, possession: "against", intensity: 1 }, 0);
    const lontano = tacticalPosition(portiere, { ball: { x: 90, y: 50 }, possession: "for", intensity: 0 }, 0);
    expect(vicino.x).toBeGreaterThan(lontano.x);
  });

  it("nessuno finisce mai fuori dal campo, per nessuna posizione del pallone", () => {
    const players = buildPitchPlayers(context);
    for (const p of players) {
      for (const bx of [0, 25, 50, 75, 100]) {
        for (const by of [0, 50, 100]) {
          for (const possession of ["for", "against"] as const) {
            const pos = tacticalPosition(p, { ball: { x: bx, y: by }, possession, intensity: 1 }, 7.3);
            expect(pos.x).toBeGreaterThanOrEqual(0);
            expect(pos.x).toBeLessThanOrEqual(100);
            expect(pos.y).toBeGreaterThanOrEqual(0);
            expect(pos.y).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });

  it("i giocatori si muovono davvero nel tempo, non restano incollati alla posizione base", () => {
    const players = buildPitchPlayers(context);
    const tizio: PitchPlayer = players.find((p) => p.department === "CC")!;
    const a = tacticalPosition(tizio, { ball: { x: 20, y: 20 }, possession: "against", intensity: 1 }, 0);
    const b = tacticalPosition(tizio, { ball: { x: 80, y: 80 }, possession: "for", intensity: 1 }, 12);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(10);
  });
});

describe("lettura del flusso a un dato istante", () => {
  it("il pallone segue la catena di passaggi, dal primo tocco all'ultimo", () => {
    const flow = simulateMatchFlow(partita(1, 0), "palla", nomeDi, context);
    const fase = flow.phases.find((p) => p.outcome === "gol")!;
    const inizio = ballAt(fase, fase.startSecond);
    const fine = ballAt(fase, fase.endSecond + 5);
    expect(inizio.x).toBeCloseTo(fase.touches[0]!.x, 1);
    expect(fine.x).toBeCloseTo(fase.touches[fase.touches.length - 1]!.x, 1);
    // A metà strada il pallone sta fra i due estremi, non teletrasportato.
    const meta = ballAt(fase, (fase.startSecond + fase.endSecond) / 2);
    expect(meta.progress).toBeGreaterThanOrEqual(0);
    expect(meta.progress).toBeLessThanOrEqual(1);
  });

  it("un lancio alto stacca il pallone da terra, un passaggio raso no", () => {
    const flow = simulateMatchFlow(partita(2, 2), "quote", nomeDi, context);
    let vistoAlto = false;
    for (const fase of flow.phases) {
      for (let s = fase.startSecond; s < fase.endSecond; s += 0.25) {
        const b = ballAt(fase, s);
        expect(b.height).toBeGreaterThanOrEqual(0);
        expect(b.height).toBeLessThanOrEqual(1.001);
        if (b.height > 0.5) vistoAlto = true;
      }
    }
    expect(vistoAlto).toBe(true);
  });

  it("l'indice della fase in corso è monotono e non esce dall'elenco", () => {
    const flow = simulateMatchFlow(partita(1, 1), "indice", nomeDi, context);
    let precedente = -1;
    for (let s = 0; s <= MATCH_SECONDS; s += 37) {
      const i = phaseIndexAt(flow.phases, s);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(flow.phases.length);
      expect(i).toBeGreaterThanOrEqual(precedente);
      precedente = i;
    }
  });
});
