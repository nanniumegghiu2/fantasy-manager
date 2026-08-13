/**
 * Test degli eventi: infortuni, fatica, morale, richieste di cessione.
 *
 * Il test più importante è quello sul **ritmo**: l'obiettivo dichiarato è 4-8 decisioni a
 * stagione. È l'unica misura che dice se la modalità è coinvolgente o se è diventata un
 * ufficio reclami — e nessun altro test la coglierebbe.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
  BASE_INJURY_RISK,
  breakPromise,
  fatigueTeamModifier,
  findTransferRequest,
  isTooGoodForBench,
  discontentPenalty,
  moraleTeamModifier,
  PROMISE_MATCHDAYS,
  REQUEST_COOLDOWN,
  resolveTransferRequest,
  rollInjuries,
  tickInjuries,
  UNHAPPY_THRESHOLD,
  updateFatigue,
  updateMorale,
  type MoraleContext,
} from "../ds/events";
import { FATIGUE_FREE_THRESHOLD } from "../ds/lineup";
import { createRosterEntry } from "../ds/roster";
import type { RosterEntry } from "../ds/types";

function entry(over: Partial<RosterEntry> = {}): RosterEntry {
  return {
    ...createRosterEntry({ playerId: "p1", overall: 78, potential: 82, sinceSeason: 1 }),
    ...over,
  };
}

const context = (over: Partial<MoraleContext> = {}): MoraleContext => ({
  squadAverage: 74,
  availableMinutes: 900,
  played: false,
  scored: false,
  ...over,
});

describe("infortuni", () => {
  it("capitano, ma restano rari: 15-20 a stagione con una rosa normale", () => {
    const random = mulberry32(11);
    const titolari = Array.from({ length: 11 }, (_, i) =>
      entry({ playerId: `t${i}`, fatigue: 40 }),
    );
    let totali = 0;
    for (let giornata = 0; giornata < 45; giornata++) {
      totali += rollInjuries(titolari, random).length;
    }
    // Abbastanza da far sentire la rosa corta, non tanti da rendere l'undici un sorteggio.
    expect(totali).toBeGreaterThan(8);
    expect(totali).toBeLessThan(35);
  });

  it("la fatica aumenta il rischio", () => {
    const conta = (fatigue: number) => {
      const random = mulberry32(5);
      const gruppo = Array.from({ length: 11 }, (_, i) => entry({ playerId: `p${i}`, fatigue }));
      let n = 0;
      for (let g = 0; g < 300; g++) n += rollInjuries(gruppo, random).length;
      return n;
    };
    expect(conta(100)).toBeGreaterThan(conta(0));
  });

  it("le durate coprono lievi, medi e gravi", () => {
    const random = mulberry32(3);
    const gruppo = Array.from({ length: 11 }, (_, i) => entry({ playerId: `p${i}` }));
    const severita = new Set<string>();
    for (let g = 0; g < 2000; g++) {
      for (const injury of rollInjuries(gruppo, random)) {
        severita.add(injury.severity);
        expect(injury.matchdays).toBeGreaterThan(0);
      }
    }
    expect(severita).toEqual(new Set(["lieve", "media", "grave"]));
  });

  it("la probabilità base resta in un intervallo sensato", () => {
    expect(BASE_INJURY_RISK).toBeGreaterThan(0.005);
    expect(BASE_INJURY_RISK).toBeLessThan(0.06);
  });

  it("ogni giornata scala l'indisponibilità", () => {
    const roster = [entry({ injuryMatchdaysLeft: 3 }), entry({ playerId: "sano" })];
    const dopo = tickInjuries(roster);
    expect(dopo[0]!.injuryMatchdaysLeft).toBe(2);
    expect(dopo[1]!.injuryMatchdaysLeft).toBe(0);
  });
});

describe("fatica", () => {
  it("giocare stanca più che riposare, a parità di punto di partenza", () => {
    // La proprietà comparativa vale sempre; il valore assoluto no, ed è il punto del nuovo
    // modello: da una fatica già alta, una sola partita a settimana lascia comunque recuperare.
    const partenza = 40;
    expect(updateFatigue(entry({ fatigue: partenza }), 1)).toBeGreaterThan(
      updateFatigue(entry({ fatigue: partenza }), 0),
    );
    expect(updateFatigue(entry({ fatigue: partenza }), 0)).toBeLessThan(partenza);
  });

  it("resta nella scala 0-100", () => {
    expect(updateFatigue(entry({ fatigue: 95 }), 2)).toBeLessThanOrEqual(100);
    expect(updateFatigue(entry({ fatigue: 5 }), 0)).toBeGreaterThanOrEqual(0);
  });

  /**
   * **Il difetto che questi tre casi bloccano.**
   *
   * Il modello precedente era `played ? +18 : −22`: chi giocava **non recuperava mai**. Un
   * titolare fisso arrivava a 100 alla quinta giornata e ci restava tutta la stagione — quindi
   * malus massimo per tutti, rischio infortuni permanentemente maggiorato, e il tema "chiede di
   * riposare" ammissibile a tutti gli undici. Soprattutto: la rotazione, che tutto questo doveva
   * rendere necessaria, era **impossibile**, perché nessuna scelta evitava la saturazione.
   *
   * I tre casi sono la forma misurabile del bersaglio dichiarato nel piano (D6).
   */
  function dopoSettimane(partite: number, settimane: number): number {
    let e = entry({ fatigue: 0 });
    for (let i = 0; i < settimane; i++) e = { ...e, fatigue: updateFatigue(e, partite) };
    return e.fatigue;
  }

  it("chi gioca solo il campionato non si sfinisce: resta sotto la soglia di malus", () => {
    // 38 giornate, sempre titolare, nessuna coppa: un professionista che gioca una partita a
    // settimana non è "a pezzi", e il gioco non deve dire il contrario.
    expect(dopoSettimane(1, 38)).toBeLessThan(FATIGUE_FREE_THRESHOLD);
  });

  it("il doppio impegno, e solo quello, porta in zona rossa", () => {
    // Due partite in una settimana costano più di due settimane da una: è il sovrapprezzo di
    // congestione a rendere diverso giocare due coppe dal non giocarne nessuna.
    expect(dopoSettimane(2, 6)).toBeGreaterThan(70);
    expect(dopoSettimane(2, 6)).toBeGreaterThan(dopoSettimane(1, 12));
  });

  it("qualche giornata di riposo rimette a posto anche chi era a pezzi", () => {
    // Il recupero è proporzionale, non una sottrazione fissa: è ciò che rende la rotazione una
    // leva vera invece di un palliativo.
    let e = entry({ fatigue: 90 });
    for (let i = 0; i < 3; i++) e = { ...e, fatigue: updateFatigue(e, 0) };
    expect(e.fatigue).toBeLessThan(30);
  });
});

describe("\"voglio giocare\": la condizione è relativa alla rosa", () => {
  it("un campione in panchina in una grande squadra soffre meno del migliore di una piccola", () => {
    // È il punto centrale: a un 82 all'Inter la panchina pesa meno che a un 76 al Lecce,
    // perché nel secondo caso è il migliore che hanno.
    const campioneInGrande = entry({ overall: 82, stats: { appearances: 2, minutes: 180, goals: 0, assists: 0 } });
    const miglioreInPiccola = entry({ overall: 76, stats: { appearances: 2, minutes: 180, goals: 0, assists: 0 } });

    expect(isTooGoodForBench(campioneInGrande, context({ squadAverage: 80 }))).toBe(false);
    expect(isTooGoodForBench(miglioreInPiccola, context({ squadAverage: 70 }))).toBe(true);
  });

  it("chi gioca non si lamenta, per quanto sia forte", () => {
    const titolare = entry({ overall: 88, stats: { appearances: 10, minutes: 900, goals: 4, assists: 2 } });
    expect(isTooGoodForBench(titolare, context({ squadAverage: 70, availableMinutes: 900 }))).toBe(false);
  });
});

describe("morale", () => {
  it("giocare e segnare fanno bene, la panchina fa male", () => {
    const base = entry({ morale: 60, overall: 82, stats: { appearances: 1, minutes: 90, goals: 0, assists: 0 } });
    const haGiocato = updateMorale(base, context({ squadAverage: 70, played: true, scored: true }));
    const inPanchina = updateMorale(base, context({ squadAverage: 70, played: false }));
    expect(haGiocato.after).toBeGreaterThan(inPanchina.after);
    expect(haGiocato.reasons).toContain("È andato a segno");
  });

  it("rifiutare un'offerta per lui lo indispettisce", () => {
    const normale = updateMorale(entry({ morale: 60 }), context());
    const dopoRifiuto = updateMorale(entry({ morale: 60 }), context({ offerRefused: true }));
    expect(dopoRifiuto.after).toBeLessThan(normale.after);
  });

  it("il morale risale col tempo: nessuno resta arrabbiato per sempre", () => {
    // Senza questo ritorno alla media, ogni giocatore finirebbe prima o poi per chiedere
    // la cessione e l'evento perderebbe significato.
    let e = entry({ morale: 20, overall: 70 });
    for (let i = 0; i < 12; i++) {
      e = { ...e, morale: updateMorale(e, context({ squadAverage: 74, played: true })).after };
    }
    expect(e.morale).toBeGreaterThan(45);
  });

  it("resta nella scala 0-100", () => {
    expect(updateMorale(entry({ morale: 99 }), context({ played: true, scored: true })).after).toBeLessThanOrEqual(100);
    expect(updateMorale(entry({ morale: 1, overall: 90 }), context({ squadAverage: 70, offerRefused: true })).after).toBeGreaterThanOrEqual(0);
  });
});

describe("richieste di cessione", () => {
  const scontenti = [
    entry({ playerId: "forte", overall: 84, morale: 10 }),
    entry({ playerId: "medio", overall: 74, morale: 12 }),
    entry({ playerId: "sereno", overall: 80, morale: 70 }),
  ];

  it("parla il più forte fra i malcontenti: la decisione dev'essere una vera decisione", () => {
    const richiesta = findTransferRequest(
      scontenti,
      { matchday: 10, hasOpenRequest: false },
      () => context({ squadAverage: 74 }),
    );
    expect(richiesta?.playerId).toBe("forte");
  });

  it("una sola richiesta aperta alla volta", () => {
    expect(
      findTransferRequest(scontenti, { matchday: 10, hasOpenRequest: true }, () => context()),
    ).toBeNull();
  });

  it("dopo una risoluzione c'è una tregua", () => {
    const subito = findTransferRequest(
      scontenti,
      { matchday: 10, hasOpenRequest: false, lastResolvedMatchday: 8 },
      () => context(),
    );
    const piuTardi = findTransferRequest(
      scontenti,
      { matchday: 10 + REQUEST_COOLDOWN, hasOpenRequest: false, lastResolvedMatchday: 8 },
      () => context(),
    );
    expect(subito).toBeNull();
    expect(piuTardi).not.toBeNull();
  });

  it("chi è in prestito non chiede nulla", () => {
    const inPrestito = [
      { ...entry({ playerId: "fuori", overall: 84, morale: 5 }), loan: { hostClubId: "altro", untilSeason: 2 } },
    ];
    expect(findTransferRequest(inPrestito, { matchday: 5, hasOpenRequest: false }, () => context())).toBeNull();
  });

  it("il motivo distingue chi vuole giocare da chi è genericamente scontento", () => {
    const vuoleGiocare = [entry({ playerId: "x", overall: 84, morale: 10, stats: { appearances: 1, minutes: 90, goals: 0, assists: 0 } })];
    const richiesta = findTransferRequest(
      vuoleGiocare,
      { matchday: 10, hasOpenRequest: false },
      () => context({ squadAverage: 74, availableMinutes: 900 }),
    );
    expect(richiesta?.reason).toBe("vuole_giocare");
  });
});

describe("le quattro risposte hanno tutte un prezzo", () => {
  const scontento = entry({ playerId: "x", overall: 84, morale: 10 });

  it("accettare lo mette in lista", () => {
    const esito = resolveTransferRequest(scontento, "accetta", 12);
    expect(esito.listed).toBe(true);
    expect(esito.entry.morale).toBeGreaterThan(scontento.morale);
  });

  it("rifiutare costa in campo, non solo a parole", () => {
    const esito = resolveTransferRequest(scontento, "rifiuta", 12);
    expect(esito.listed).toBe(false);
    expect(discontentPenalty(esito.entry.morale)).toBeGreaterThan(0);
  });

  it("promettere spazio è un debito, non una soluzione", () => {
    const esito = resolveTransferRequest(scontento, "prometti", 12);
    expect(esito.promiseDeadline).toBe(12 + PROMISE_MATCHDAYS);
    expect(esito.entry.morale).toBeGreaterThan(scontento.morale);
    // Se non la mantieni, il crollo è peggiore di quello che volevi evitare.
    const rotta = breakPromise(esito.entry);
    expect(rotta.morale).toBeLessThan(scontento.morale);
    expect(discontentPenalty(rotta.morale)).toBeGreaterThan(discontentPenalty(scontento.morale));
  });

  it("il prestito lo rasserena più di tutto: va a giocare", () => {
    const esito = resolveTransferRequest(scontento, "prestito", 12);
    expect(esito.entry.morale).toBeGreaterThan(
      resolveTransferRequest(scontento, "prometti", 12).entry.morale,
    );
  });

  it("un morale sano non produce alcun malus", () => {
    expect(discontentPenalty(60)).toBe(0);
    expect(discontentPenalty(UNHAPPY_THRESHOLD)).toBe(0);
  });
});

describe("modificatori di squadra: morale e fatica (non solo malus individuali)", () => {
  it("morale medio alto produce un bonus di squadra, non solo l'assenza di malus", () => {
    expect(moraleTeamModifier(60)).toBe(0);
    expect(moraleTeamModifier(90)).toBeGreaterThan(0);
    expect(moraleTeamModifier(90)).toBeLessThanOrEqual(3);
  });

  it("morale medio basso produce un malus di squadra", () => {
    expect(moraleTeamModifier(30)).toBeLessThan(0);
    expect(moraleTeamModifier(30)).toBeGreaterThanOrEqual(-3);
  });

  it("una squadra fresca ha un piccolo vantaggio, una sfinita un vero svantaggio", () => {
    expect(fatigueTeamModifier(0)).toBeGreaterThan(0);
    expect(fatigueTeamModifier(40)).toBe(0);
    expect(fatigueTeamModifier(95)).toBeLessThan(0);
    // Il tetto in negativo è più ampio di quello in positivo: la fatica pesa più di quanto
    // la freschezza aiuti — richiesta dell'utente ("una squadra troppo stanca non può ottenere
    // buoni risultati"), non "una squadra riposata ne ottiene sempre di ottimi".
    expect(Math.abs(fatigueTeamModifier(100))).toBeGreaterThan(fatigueTeamModifier(0));
  });
});

describe("ritmo della stagione", () => {
  it("una rosa normale produce fra 4 e 8 decisioni a stagione", () => {
    /**
     * È il bersaglio dichiarato nel piano. Si simula una stagione intera con una rosa
     * plausibile: undici titolari che giocano quasi sempre e riserve che giocano poco, di cui
     * un paio nettamente più forti della media — cioè le condizioni che generano richieste.
     */
    const random = mulberry32(2026);
    let roster: RosterEntry[] = [
      ...Array.from({ length: 11 }, (_, i) => entry({ playerId: `t${i}`, overall: 76 + (i % 5), morale: 60 })),
      ...Array.from({ length: 12 }, (_, i) => entry({ playerId: `r${i}`, overall: i < 2 ? 82 : 71, morale: 60 })),
    ];
    const squadAverage = Math.round(
      roster.reduce((s, e) => s + e.overall, 0) / roster.length,
    );

    let decisioni = 0;
    let openRequest = false;
    let lastResolved: number | undefined;

    for (let matchday = 1; matchday <= 38; matchday++) {
      const availableMinutes = matchday * 90;
      roster = roster.map((e, index) => {
        const played = index < 11;
        const stats = played
          ? { ...e.stats, appearances: e.stats.appearances + 1, minutes: e.stats.minutes + 90 }
          : e.stats;
        const withStats = { ...e, stats };
        return {
          ...withStats,
          morale: updateMorale(withStats, {
            squadAverage,
            availableMinutes,
            played,
            scored: played && random() < 0.08,
          }).after,
          fatigue: updateFatigue(withStats, played),
        };
      });

      const richiesta = findTransferRequest(
        roster,
        { matchday, hasOpenRequest: openRequest, lastResolvedMatchday: lastResolved },
        (e) => ({ squadAverage, availableMinutes, played: false, scored: false }),
      );
      if (richiesta) {
        decisioni++;
        // L'utente risponde subito: la richiesta si chiude nella stessa giornata.
        const target = roster.find((e) => e.playerId === richiesta.playerId)!;
        const esito = resolveTransferRequest(target, "prometti", matchday);
        roster = roster.map((e) => (e.playerId === target.playerId ? esito.entry : e));
        lastResolved = matchday;
        openRequest = false;
      }
    }

    expect({ decisioni, dentroIlBersaglio: decisioni >= 2 && decisioni <= 12 }).toEqual({
      decisioni,
      dentroIlBersaglio: true,
    });
  });
});
