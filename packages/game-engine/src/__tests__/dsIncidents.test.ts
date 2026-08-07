/**
 * Gli **imprevisti**: quello che succede senza che l'utente l'abbia deciso.
 *
 * Le due proprietà che contano sono opposte fra loro, ed è la tensione fra le due a definire il
 * bilanciamento: devono capitare **abbastanza** da rompere la routine di una carriera lunga, e
 * **abbastanza di rado** da restare notizie invece di diventare una tassa.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
  applyIncident,
  rollIncident,
  FINANCIAL_INCIDENT_KINDS,
  INCIDENT_COOLDOWN,
  INCIDENT_ODDS,
  type IncidentKind,
} from "../ds/incidents";
import { createRosterEntry } from "../ds/roster";
import type { RosterEntry } from "../ds/types";

function rosa(n = 24): RosterEntry[] {
  return Array.from({ length: n }, (_, i) =>
    createRosterEntry({ playerId: `p${i}`, overall: 65 + (i % 20), potential: 80, sinceSeason: 1 }),
  );
}

const nomeDi = (id: string) => `Giocatore ${id}`;

/** Quanti imprevisti capitano in una stagione da 38 giornate, in media su molte stagioni. */
function perStagione(stagioni: number): { totale: number; perTipo: Map<IncidentKind, number> } {
  const perTipo = new Map<IncidentKind, number>();
  let totale = 0;
  for (let s = 0; s < stagioni; s++) {
    let ultimo: number | undefined;
    for (let g = 0; g < 38; g++) {
      const inc = rollIncident({
        roster: rosa(),
        nameOf: nomeDi,
        matchday: g,
        lastIncidentMatchday: ultimo,
        random: mulberry32(s * 1000 + g),
        // Una vittoria a sorpresa ogni tanto, altrimenti "premio_presidente" non avrebbe mai
        // la sua precondizione soddisfatta in questo campione.
        lastMatch: { won: g % 3 === 0, opponentGapFavorevole: 10 },
      });
      if (!inc) continue;
      totale++;
      ultimo = g;
      perTipo.set(inc.kind, (perTipo.get(inc.kind) ?? 0) + 1);
    }
  }
  return { totale, perTipo };
}

describe("frequenza degli imprevisti", () => {
  it("capitano abbastanza da rompere la routine, ma restano notizie", () => {
    const { totale } = perStagione(40);
    const media = totale / 40;
    // Fra uno e sei a stagione: sotto non si nota niente, sopra diventa una tassa.
    expect(media).toBeGreaterThan(1);
    expect(media).toBeLessThan(6);
  });

  it("il doping resta l'evento raro che deve essere", () => {
    const { perTipo } = perStagione(40);
    const doping = perTipo.get("squalifica_doping") ?? 0;
    // Meno di uno ogni cinque stagioni: una volta e mezza in una carriera da dieci anni.
    expect(doping).toBeLessThan(8);
  });

  it("tutti i tipi previsti possono capitare", () => {
    const { perTipo } = perStagione(120);
    for (const kind of Object.keys(INCIDENT_ODDS) as IncidentKind[]) {
      expect(perTipo.get(kind) ?? 0, `mai visto: ${kind}`).toBeGreaterThan(0);
    }
  });
});

describe("regole di ingaggio", () => {
  it("dopo un imprevisto c'è una tregua: due notizie ravvicinate si annullano", () => {
    const subito = rollIncident({
      roster: rosa(),
      nameOf: nomeDi,
      matchday: 10,
      lastIncidentMatchday: 10 - (INCIDENT_COOLDOWN - 1),
      random: mulberry32(1),
    });
    expect(subito).toBeUndefined();
  });

  it("non colpisce chi è già fuori o in prestito (a parte gli imprevisti economici, che non toccano un giocatore)", () => {
    const tutti = rosa().map((e) => ({ ...e, injuryMatchdaysLeft: 3 }));
    for (let s = 0; s < 50; s++) {
      const inc = rollIncident({
        roster: tutti,
        nameOf: nomeDi,
        matchday: 20,
        random: mulberry32(s),
      });
      if (!inc) continue;
      expect(FINANCIAL_INCIDENT_KINDS).toContain(inc.kind);
      expect(inc.playerId).toBeUndefined();
    }
  });

  it("ogni imprevisto a un giocatore dice chi, cosa e per quanto; quelli economici toccano solo il budget", () => {
    for (let s = 0; s < 400; s++) {
      const inc = rollIncident({
        roster: rosa(),
        nameOf: nomeDi,
        matchday: 5,
        random: mulberry32(s),
        lastMatch: { won: true, opponentGapFavorevole: 10 },
      });
      if (!inc) continue;
      expect(inc.title.length).toBeGreaterThan(3);
      if (FINANCIAL_INCIDENT_KINDS.includes(inc.kind)) {
        expect(inc.playerId).toBeUndefined();
        expect(inc.matchdays).toBe(0);
        expect(inc.budgetDelta).toBeDefined();
      } else {
        expect(inc.message).toContain("Giocatore");
        expect(inc.matchdays).toBeGreaterThan(0);
      }
    }
  });
});

describe("imprevisti economici e infortunio gravissimo", () => {
  it("premio_presidente non scatta mai senza una vittoria a sorpresa", () => {
    for (let s = 0; s < 300; s++) {
      const inc = rollIncident({
        roster: rosa(),
        nameOf: nomeDi,
        matchday: 5,
        random: mulberry32(s),
        // Nessuna vittoria a sorpresa questa settimana.
        lastMatch: { won: false, opponentGapFavorevole: 10 },
      });
      if (inc) expect(inc.kind).not.toBe("premio_presidente");
    }
  });

  it("infortunio_gravissimo mette fuori per una fascia molto più lunga dell'infortunio lungo", () => {
    for (let s = 0; s < 2000; s++) {
      const inc = rollIncident({ roster: rosa(), nameOf: nomeDi, matchday: 5, random: mulberry32(s) });
      if (inc?.kind === "infortunio_gravissimo") {
        expect(inc.matchdays).toBeGreaterThanOrEqual(20);
        expect(inc.matchdays).toBeLessThanOrEqual(32);
      }
    }
  });
});

describe("effetto sulla rosa", () => {
  it("mette fuori il giocatore e ne muove il morale", () => {
    const iniziale = rosa();
    const incident = {
      kind: "infortunio_lungo" as const,
      playerId: "p3",
      matchdays: 10,
      moraleDelta: -12,
      title: "Infortunio serio",
      message: "…",
    };
    const dopo = applyIncident(iniziale, incident);
    const colpito = dopo.find((e) => e.playerId === "p3")!;
    expect(colpito.injuryMatchdaysLeft).toBe(10);
    expect(colpito.morale).toBeLessThan(iniziale.find((e) => e.playerId === "p3")!.morale);
    // Gli altri non si toccano.
    expect(dopo.filter((e) => e.injuryMatchdaysLeft > 0)).toHaveLength(1);
  });

  it("la convocazione in nazionale è l'unica che fa piacere", () => {
    const dopo = applyIncident(rosa(), {
      kind: "convocazione_nazionale",
      playerId: "p1",
      matchdays: 1,
      moraleDelta: 10,
      title: "Chiamata dalla nazionale",
      message: "…",
    });
    const chiamato = dopo.find((e) => e.playerId === "p1")!;
    expect(chiamato.morale).toBeGreaterThan(70);
    // Ma comunque non c'è.
    expect(chiamato.injuryMatchdaysLeft).toBe(1);
  });

  it("non peggiora un infortunio già più lungo", () => {
    const conInfortunio = rosa().map((e) =>
      e.playerId === "p2" ? { ...e, injuryMatchdaysLeft: 20 } : e,
    );
    const dopo = applyIncident(conInfortunio, {
      kind: "condotta_antisportiva",
      playerId: "p2",
      matchdays: 3,
      moraleDelta: -8,
      title: "…",
      message: "…",
    });
    expect(dopo.find((e) => e.playerId === "p2")!.injuryMatchdaysLeft).toBe(20);
  });
});
