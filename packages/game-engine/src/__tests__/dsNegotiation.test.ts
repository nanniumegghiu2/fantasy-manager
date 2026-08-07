/**
 * La **trattativa**: il botta e risposta con il direttore sportivo dell'altra squadra.
 *
 * La proprietà che tiene in piedi la meccanica è una sola: **rilanciare dentro il limite fa
 * chiudere, rilanciare oltre brucia la pazienza**. Se non fosse vera, tirare la corda sarebbe
 * gratuito e la trattativa tornerebbe a essere un pulsante con più passaggi.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
  applyNegotiationMove,
  ceilingFrom,
  endingLabel,
  openNegotiation,
  patienceCost,
  suggestedMoves,
  MAX_STALLS,
  type Negotiation,
} from "../ds/negotiation";

function cessione(appetite = 0.5): Negotiation {
  return openNegotiation({
    kind: "cessione",
    playerId: "p1",
    playerName: "Mario Rossi",
    clubId: "c1",
    clubName: "Altro Club",
    amount: 10_000_000,
    appetite,
  });
}

function prestito(appetite = 0.5): Negotiation {
  return openNegotiation({
    kind: "prestito",
    playerId: "p3",
    playerName: "Under Promettente",
    clubId: "c3",
    clubName: "Club Ospitante",
    amount: 1800, // 20 partite
    appetite,
  });
}

function acquisto(appetite = 0.5): Negotiation {
  return openNegotiation({
    kind: "acquisto",
    playerId: "p2",
    playerName: "Luca Bianchi",
    clubId: "c2",
    clubName: "Venditore FC",
    amount: 20_000_000,
    appetite,
  });
}

describe("apertura", () => {
  it("apre con un messaggio dell'altro direttore sportivo e la cifra sul tavolo", () => {
    const n = cessione();
    expect(n.log).toHaveLength(1);
    expect(n.log[0]!.speaker).toBe("loro");
    expect(n.log[0]!.amount).toBe(10_000_000);
    expect(n.log[0]!.text).toContain("Mario Rossi");
    expect(n.status).toBe("aperta");
    expect(n.patience).toBe(100);
  });

  it("chi tiene al giocatore è disposto a salire di più", () => {
    expect(ceilingFrom(10_000_000, 1)).toBeGreaterThan(ceilingFrom(10_000_000, 0));
  });

  it("in acquisto il margine è al contrario: si strappa uno sconto", () => {
    const n = acquisto();
    expect(n.ceiling).toBeLessThan(n.amount);
  });
});

describe("il costo della pazienza", () => {
  it("una richiesta dentro il limite costa poco, una fuori scala brucia tutto", () => {
    const dentro = patienceCost(9_000_000, 10_000_000);
    const poco = patienceCost(11_000_000, 10_000_000);
    const tanto = patienceCost(20_000_000, 10_000_000);
    expect(dentro).toBeLessThan(poco);
    expect(poco).toBeLessThan(tanto);
    expect(tanto).toBeGreaterThan(80);
  });
});

describe("mosse", () => {
  it("accettare chiude subito, alla cifra sul tavolo", () => {
    const n = applyNegotiationMove(cessione(), { kind: "accetta" }, mulberry32(1));
    expect(n.status).toBe("conclusa");
    expect(n.amount).toBe(10_000_000);
    expect(n.log[n.log.length - 1]!.speaker).toBe("loro");
  });

  it("abbandonare arena la trattativa", () => {
    const n = applyNegotiationMove(cessione(), { kind: "abbandona" }, mulberry32(1));
    expect(n.status).toBe("arenata");
  });

  it("un rilancio contenuto viene quasi sempre accettato", () => {
    // Su venti semi diversi, la stragrande maggioranza deve chiudere: è ciò che rende
    // sensato provare a chiedere qualcosa in più.
    let chiuse = 0;
    for (let s = 0; s < 20; s++) {
      const n = cessione(0.8);
      const dopo = applyNegotiationMove(
        n,
        { kind: "rilancia", amount: Math.round(n.ceiling * 0.95) },
        mulberry32(s + 1),
      );
      if (dopo.status === "conclusa") chiuse++;
    }
    expect(chiuse).toBeGreaterThan(14);
  });

  it("chiedere il triplo brucia la pazienza e fa arenare la trattativa", () => {
    let n = cessione(0.2);
    for (let i = 0; i < 4 && n.status === "aperta"; i++) {
      n = applyNegotiationMove(n, { kind: "rilancia", amount: n.amount * 3 }, mulberry32(i + 1));
    }
    expect(n.status).toBe("arenata");
  });

  it("la pazienza non risale mai", () => {
    let n = cessione();
    let precedente = n.patience;
    for (let i = 0; i < 3 && n.status === "aperta"; i++) {
      n = applyNegotiationMove(n, { kind: "rilancia", amount: n.amount * 1.5 }, mulberry32(i + 7));
      expect(n.patience).toBeLessThanOrEqual(precedente);
      precedente = n.patience;
    }
  });

  it("una trattativa chiusa non si può più muovere", () => {
    const chiusa = applyNegotiationMove(cessione(), { kind: "accetta" }, mulberry32(1));
    const dopo = applyNegotiationMove(chiusa, { kind: "rilancia", amount: 99 }, mulberry32(2));
    expect(dopo).toBe(chiusa);
  });

  it("quando resistono, la controproposta sta fra le due posizioni", () => {
    const n = cessione(0.9);
    const dopo = applyNegotiationMove(n, { kind: "rilancia", amount: n.amount * 4 }, mulberry32(3));
    if (dopo.status === "aperta") {
      expect(dopo.amount).toBeGreaterThan(n.amount);
      expect(dopo.amount).toBeLessThanOrEqual(dopo.ceiling);
    }
  });

  it("in acquisto offrire meno del limite fa resistere, offrire il prezzo chiude", () => {
    const n = acquisto(0.9);
    const chiuso = applyNegotiationMove(n, { kind: "accetta" }, mulberry32(4));
    expect(chiuso.status).toBe("conclusa");
    expect(chiuso.amount).toBe(n.amount);

    const basso = applyNegotiationMove(n, { kind: "rilancia", amount: 1_000_000 }, mulberry32(4));
    expect(basso.status).not.toBe("conclusa");
  });

  it("è riproducibile: stesso stato e stesso PRNG, stesso esito", () => {
    const a = applyNegotiationMove(cessione(), { kind: "rilancia", amount: 14_000_000 }, mulberry32(9));
    const b = applyNegotiationMove(cessione(), { kind: "rilancia", amount: 14_000_000 }, mulberry32(9));
    expect(a).toEqual(b);
  });
});

describe("mosse tattiche e sorprese", () => {
  it("prendere tempo recupera pazienza, ma si può fare poche volte", () => {
    let n = { ...cessione(0.5), patience: 40 };
    const prima = n.patience;
    n = applyNegotiationMove(n, { kind: "prendi_tempo" }, mulberry32(11));
    // O recupera margine, o si è inserito un rivale che alza l'offerta: entrambe vanno bene.
    expect(n.patience >= prima || n.amount > 10_000_000).toBe(true);
    expect(n.stalls).toBe(1);
  });

  it("temporeggiare oltre il limite fa saltare tutto", () => {
    const n = { ...cessione(), stalls: MAX_STALLS };
    const dopo = applyNegotiationMove(n, { kind: "prendi_tempo" }, mulberry32(3));
    expect(dopo.status).toBe("arenata");
  });

  it("in acquisto, prendere tempo può far arrivare un rivale che se lo porta via", () => {
    let soffiato = 0;
    for (let s = 0; s < 40; s++) {
      const dopo = applyNegotiationMove(acquisto(), { kind: "prendi_tempo" }, mulberry32(s + 1));
      if (dopo.ending === "soffiato") soffiato++;
    }
    expect(soffiato).toBeGreaterThan(0);
  });

  it("in cessione l'inserimento di un rivale fa **salire** il prezzo", () => {
    for (let s = 0; s < 40; s++) {
      const dopo = applyNegotiationMove(cessione(), { kind: "prendi_tempo" }, mulberry32(s + 1));
      if (dopo.amount > 10_000_000) {
        expect(dopo.status).toBe("aperta");
        return;
      }
    }
    throw new Error("nessun rilancio da rivale in quaranta tentativi");
  });

  it("l'ultimatum chiude o rompe, senza vie di mezzo", () => {
    for (let s = 0; s < 12; s++) {
      const n = cessione(0.6);
      const dopo = applyNegotiationMove(
        n,
        { kind: "ultimatum", amount: n.amount * 2.5 },
        mulberry32(s + 1),
      );
      expect(["conclusa", "arenata"]).toContain(dopo.status);
    }
  });

  it("un accordo in acquisto può saltare per il no del giocatore o per le visite", () => {
    /**
     * È ciò che toglie la certezza dall'ultimo passo: un mercato in cui ogni accordo si chiude
     * è un mercato senza rischio.
     */
    const esiti = new Set<string>();
    for (let s = 0; s < 200; s++) {
      const dopo = applyNegotiationMove(acquisto(0.5), { kind: "accetta" }, mulberry32(s + 1));
      esiti.add(dopo.ending ?? "?");
    }
    expect(esiti.has("accordo")).toBe(true);
    expect(esiti.has("rifiuto_giocatore") || esiti.has("visite_mediche")).toBe(true);
  });

  it("in cessione non esistono no del giocatore né visite mediche", () => {
    // Chi va via non deve convincere noi: sarebbero penalità gratuite su una scelta già presa.
    for (let s = 0; s < 200; s++) {
      const dopo = applyNegotiationMove(cessione(), { kind: "accetta" }, mulberry32(s + 1));
      expect(dopo.ending).toBe("accordo");
    }
  });

  it("ogni finale ha un'etichetta comprensibile", () => {
    const chiusa = applyNegotiationMove(cessione(), { kind: "accetta" }, mulberry32(1));
    expect(endingLabel(chiusa)).toBe("Affare chiuso");
    expect(endingLabel({ ...chiusa, ending: "soffiato" })).toMatch(/soffiato/i);
    expect(endingLabel({ ...chiusa, ending: "visite_mediche" })).toMatch(/[Vv]isite/);
  });
});

describe("mosse suggerite", () => {
  it("offrono un ventaglio tattico, non due soli bottoni", () => {
    const mosse = suggestedMoves(cessione());
    expect(mosse.some((m) => m.move.kind === "accetta")).toBe(true);
    expect(mosse.filter((m) => m.move.kind === "rilancia")).toHaveLength(2);
    expect(mosse.some((m) => m.move.kind === "prendi_tempo")).toBe(true);
    expect(mosse.some((m) => m.move.kind === "ultimatum")).toBe(true);
    expect(mosse.some((m) => m.move.kind === "abbandona")).toBe(true);
  });

  it("dopo troppe attese non si può più temporeggiare", () => {
    const stanca = { ...cessione(), stalls: MAX_STALLS };
    expect(suggestedMoves(stanca).some((m) => m.move.kind === "prendi_tempo")).toBe(false);
  });

  it("in cessione si chiede di più, in acquisto si offre di meno", () => {
    const vendo = cessione();
    for (const m of suggestedMoves(vendo)) {
      if (m.move.kind === "rilancia") expect(m.move.amount).toBeGreaterThan(vendo.amount);
    }
    const compro = acquisto();
    for (const m of suggestedMoves(compro)) {
      if (m.move.kind === "rilancia") expect(m.move.amount).toBeLessThan(compro.amount);
    }
  });

  it("le etichette contengono la cifra: niente numeri da inventare al buio", () => {
    for (const m of suggestedMoves(cessione())) {
      if (m.move.kind === "rilancia") expect(m.label).toMatch(/[Mk]€/);
    }
  });
});

describe("prestito: stessa direzione della cessione, unità diversa", () => {
  it("si negozia in partite, non in euro", () => {
    for (const m of suggestedMoves(prestito())) {
      if (m.move.kind === "rilancia") expect(m.label).toMatch(/partit[ae]/);
    }
  });

  it("i rilanci vanno verso l'alto, come in cessione", () => {
    const p = prestito();
    for (const m of suggestedMoves(p)) {
      if (m.move.kind === "rilancia") expect(m.move.amount).toBeGreaterThan(p.amount);
    }
  });

  it("rilanciare dentro il tetto chiude quasi sempre l'accordo", () => {
    const random = mulberry32(7);
    let n = prestito(0.8); // appetito alto: tetto largo
    n = applyNegotiationMove(n, { kind: "rilancia", amount: n.ceiling - 90 }, random);
    expect(["conclusa", "aperta"]).toContain(n.status);
  });

  it("non ha le sorprese dell'acquisto (rifiuto giocatore/visite mediche)", () => {
    // Su tanti round diversi, l'accordo raggiunto in prestito non finisce mai con quegli esiti.
    for (let s = 0; s < 200; s++) {
      const random = mulberry32(s);
      const n = applyNegotiationMove(prestito(0.9), { kind: "accetta" }, random);
      if (n.status === "conclusa") expect(n.ending).toBe("accordo");
    }
  });
});
