/**
 * Test di rosa, undici e affiatamento della DS Mode.
 *
 * Il punto che questi test devono davvero dimostrare è che **l'undici si deriva** invece di
 * essere memorizzato: quando un titolare si infortuna nessuno lo "sostituisce" con del codice
 * apposta, semplicemente esce dai disponibili e la formazione si rifà da sola.
 */
import { describe, expect, it } from "vitest";
import { FORMATIONS, getFormation } from "../formations";
import { computeCohesion, cohesionLabel } from "../ds/cohesion";
import {
  GUARANTEED_STARTER_BONUS,
  isLineupComplete,
  pickStartingEleven,
  playerSlotScore,
  positionalPenalty,
} from "../ds/lineup";
import { canBuy, canSell, createRosterEntry, MAX_SQUAD_SIZE, MIN_SQUAD_SIZE } from "../ds/roster";
import type { PlayerIndex, PlayerRef, RosterEntry } from "../ds/types";
import type { Role } from "@app/shared-types";

/** Una rosa completa e sensata: due per ogni casella dei 14 ruoli, più qualche jolly. */
function buildSquad(): { entries: RosterEntry[]; players: PlayerIndex } {
  const roles: Role[] = [
    "POR", "POR", "POR",
    "TD", "TD", "DC", "DC", "DC", "DC", "TS", "TS",
    "QD", "MED", "MED", "QS",
    "ED", "CC", "CC", "CC", "ES",
    "TQD", "TRQ", "TQS",
    "ATT", "ATT", "ATT",
  ];
  const players: PlayerIndex = {};
  const entries: RosterEntry[] = roles.map((role, i) => {
    const id = `p${i}`;
    players[id] = {
      id,
      name: `Giocatore ${i}`,
      nation: i % 3 === 0 ? "Italia" : i % 3 === 1 ? "Francia" : "Brasile",
      role,
      secondaryRoles: [],
    };
    return createRosterEntry({ playerId: id, overall: 70 + (i % 15), potential: 85, sinceSeason: 1 });
  });
  return { entries, players };
}

describe("pickStartingEleven", () => {
  it("riempie tutte le caselle di ognuno degli 11 moduli", () => {
    const { entries, players } = buildSquad();
    for (const formation of FORMATIONS) {
      const lineup = pickStartingEleven(formation, entries, players);
      expect({ modulo: formation.name, completo: isLineupComplete(formation, lineup) }).toEqual({
        modulo: formation.name,
        completo: true,
      });
      // Nessun giocatore schierato due volte.
      const ids = Object.values(lineup.starters);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("è deterministica: due chiamate identiche danno lo stesso undici", () => {
    // Il passo di miglioramento locale può trovare configurazioni di pari punteggio: senza un
    // tie-break stabile l'undici "ballerebbe" fra due render della UI.
    const { entries, players } = buildSquad();
    const formation = getFormation("4-3-3")!;
    const a = pickStartingEleven(formation, entries, players);
    const b = pickStartingEleven(formation, entries, players);
    expect(a.starters).toEqual(b.starters);
  });

  it("con cinque infortunati la formazione si rifà da sola, senza codice di sostituzione", () => {
    const { entries, players } = buildSquad();
    const formation = getFormation("4-3-3")!;
    const pieno = pickStartingEleven(formation, entries, players);

    const infortunati = new Set(Object.values(pieno.starters).slice(0, 5));
    const ridotta = entries.filter((e) => !infortunati.has(e.playerId));

    const rifatto = pickStartingEleven(formation, ridotta, players);
    expect(isLineupComplete(formation, rifatto)).toBe(true);
    for (const id of Object.values(rifatto.starters)) {
      expect(infortunati.has(id)).toBe(false);
    }
  });

  it("senza portieri di ruolo schiera comunque qualcuno, segnalandolo come fuori ruolo", () => {
    const { entries, players } = buildSquad();
    const formation = getFormation("4-4-2")!;
    const senzaPortieri = entries.filter((e) => players[e.playerId]!.role !== "POR");

    const lineup = pickStartingEleven(formation, senzaPortieri, players);
    expect(isLineupComplete(formation, lineup)).toBe(true);
    expect(lineup.outOfPosition.length).toBeGreaterThan(0);
  });

  it("non lascia scoperto un ruolo raro per darlo a uno abbondante", () => {
    // Il rischio concreto: il 3-5-2 chiede due quinti, ruolo scarso. Se l'assegnazione non
    // partisse dalle caselle con meno candidati, i migliori finirebbero al centro e i quinti
    // resterebbero a chi capita.
    const { entries, players } = buildSquad();
    const formation = getFormation("3-5-2")!;
    const lineup = pickStartingEleven(formation, entries, players);

    const quintoDestro = lineup.starters["qd"];
    const quintoSinistro = lineup.starters["qs"];
    expect(players[quintoDestro!]!.role).toBe("QD");
    expect(players[quintoSinistro!]!.role).toBe("QS");
  });
});

describe("guaranteedStarters — esclusiva per casella", () => {
  /**
   * Bug segnalato dall'utente: chiedere la titolarità di un giocatore per un ruolo, e poi
   * sostituirlo con un altro per lo stesso ruolo, si limitava ad **aggiungere** il secondo alla
   * lista — il primo restava garantito. Con la chiave per ruolo, sovrascrivere la entry revoca
   * davvero il primo.
   */
  it("il bonus vale solo per la casella richiesta, non per qualunque ruolo compatibile", () => {
    const { players } = buildSquad();
    const entry = createRosterEntry({ playerId: "p5", overall: 70, potential: 80, sinceSeason: 1 });
    const player = players["p5"]!; // ruolo DC (indice 5 nella rosa di prova)
    expect(player.role).toBe("DC");

    const scoreSullaCasellaGarantita = playerSlotScore(entry, player, "DC", {
      guaranteedStarters: { DC: "p5" },
    });
    const scoreSenzaGaranzia = playerSlotScore(entry, player, "DC", {});
    expect(scoreSullaCasellaGarantita).toBe(scoreSenzaGaranzia + GUARANTEED_STARTER_BONUS);

    // Garantito per un ALTRO ruolo (es. CC): qui non vale, anche se DC è compatibile per
    // reparto — la titolarità è per una casella specifica, non un lasciapassare generale.
    const scoreSuAltraCasella = playerSlotScore(entry, player, "DC", {
      guaranteedStarters: { CC: "p5" },
    });
    expect(scoreSuAltraCasella).toBe(scoreSenzaGaranzia);
  });

  it("sostituire il titolare garantito per un ruolo revoca il primo (sovrascrittura, non aggiunta)", () => {
    const { entries, players } = buildSquad();
    const formation = getFormation("4-3-3")!;
    // Due candidati DC di forza vicina: senza garanzia il migliore vincerebbe la casella.
    const primo = "p5"; // DC
    const secondo = "p6"; // DC
    expect(players[primo]!.role).toBe("DC");
    expect(players[secondo]!.role).toBe("DC");

    const conPrimoGarantito = pickStartingEleven(formation, entries, players, {
      guaranteedStarters: { DC: primo },
    });
    expect(Object.values(conPrimoGarantito.starters)).toContain(primo);

    // Il mister acconsente a sostituirlo: la chiave DC viene sovrascritta col secondo.
    const conSecondoGarantito = pickStartingEleven(formation, entries, players, {
      guaranteedStarters: { DC: secondo },
    });
    expect(Object.values(conSecondoGarantito.starters)).toContain(secondo);

    // Il bonus di selezione del primo è sparito: `playerSlotScore` non lo premia più.
    const scorePrimoDopo = playerSlotScore(
      entries.find((e) => e.playerId === primo)!,
      players[primo]!,
      "DC",
      { guaranteedStarters: { DC: secondo } },
    );
    const scorePrimoSenzaGaranzia = playerSlotScore(
      entries.find((e) => e.playerId === primo)!,
      players[primo]!,
      "DC",
      {},
    );
    expect(scorePrimoDopo).toBe(scorePrimoSenzaGaranzia);
  });

  /**
   * **La titolarità garantita è una preferenza, non un ordine.**
   *
   * Valeva +100 su una scala di Overall 60-99, cioè un bonus incompensabile: il garantito
   * giocava sfinito, giocava demotivato, giocava al posto di un compagno più forte di venti
   * punti. La semantica dichiarata dall'utente è un'altra — *"a parità di condizione ottimale
   * deve giocare il prescelto"* — e questi due casi sono la sua forma misurabile: uno dice che
   * la promessa conta, l'altro che non è un lasciapassare.
   */
  it("a parità di condizioni il garantito vince il ballottaggio", () => {
    const { entries, players } = buildSquad();
    const formation = getFormation("4-3-3")!;
    const primo = "p5";
    const secondo = "p6";
    // Stessa forza, stesso ruolo: senza garanzia deciderebbe il criterio di parità del motore.
    const pari = entries.map((e) =>
      e.playerId === primo || e.playerId === secondo ? { ...e, overall: 75 } : e,
    );

    const conGaranzia = pickStartingEleven(formation, pari, players, {
      guaranteedStarters: { DC: secondo },
    });
    expect(Object.values(conGaranzia.starters)).toContain(secondo);
  });

  it("ma non scavalca un divario reale, né manda in campo chi è a pezzi", () => {
    const { entries, players } = buildSquad();
    const formation = getFormation("4-3-3")!;
    const garantito = "p5";
    const moltoMeglio = "p6";

    const squilibrato = entries.map((e) => {
      if (e.playerId === garantito) return { ...e, overall: 62, fatigue: 95 };
      if (e.playerId === moltoMeglio) return { ...e, overall: 84 };
      return e;
    });

    const undici = pickStartingEleven(formation, squilibrato, players, {
      guaranteedStarters: { DC: garantito },
    });
    expect(Object.values(undici.starters)).toContain(moltoMeglio);
    expect(Object.values(undici.starters)).not.toContain(garantito);
  });

  it("anyRoleBoost premia qualunque ruolo compatibile, a differenza di guaranteedStarters", () => {
    const entry = createRosterEntry({ playerId: "jolly", overall: 70, potential: 80, sinceSeason: 1 });
    const player: PlayerRef = { id: "jolly", name: "Jolly", nation: "Italia", role: "DC", secondaryRoles: ["MED"] };
    const conRuoloSecondario = playerSlotScore(entry, player, "MED", { anyRoleBoost: ["jolly"] });
    const senzaBoost = playerSlotScore(entry, player, "MED", {});
    expect(conRuoloSecondario).toBe(senzaBoost + GUARANTEED_STARTER_BONUS);
  });

  it("supporta la garanzia di più titolari per ruoli con slot multipli (es. 2x DC) tramite slot.id", () => {
    const { entries, players } = buildSquad();
    const formation = getFormation("4-4-2")!;
    const dcSlots = formation.slots.filter((s) => s.role === "DC");
    expect(dcSlots.length).toBe(2);

    const primoDC = "p5";
    const secondoDC = "p6";

    // Garantiamo sia il primo DC che il secondo DC sui rispettivi slot.id
    const lineup = pickStartingEleven(formation, entries, players, {
      guaranteedStarters: {
        [dcSlots[0]!.id]: primoDC,
        [dcSlots[1]!.id]: secondoDC,
      },
    });

    const schierati = Object.values(lineup.starters);
    expect(schierati).toContain(primoDC);
    expect(schierati).toContain(secondoDC);
  });
});

describe("positionalPenalty", () => {
  it("non penalizza il ruolo naturale né uno secondario", () => {
    const player: PlayerRef = {
      id: "x", name: "X", nation: "Italia", role: "DC", secondaryRoles: ["TD"],
    };
    expect(positionalPenalty(player, "DC")).toBe(0);
    // Il malus dai ruoli secondari è stato rimosso dal progetto: qui non va reintrodotto.
    expect(positionalPenalty(player, "TD")).toBe(0);
  });

  it("penalizza di più man mano che ci si allontana dal ruolo", () => {
    const difensore: PlayerRef = {
      id: "d", name: "D", nation: "Italia", role: "DC", secondaryRoles: [],
    };
    const stessoReparto = positionalPenalty(difensore, "TS");
    const altroReparto = positionalPenalty(difensore, "ATT");
    const inPorta = positionalPenalty(difensore, "POR");
    expect(stessoReparto).toBeGreaterThan(0);
    expect(altroReparto).toBeGreaterThan(stessoReparto);
    expect(inPorta).toBeGreaterThan(altroReparto);
  });
});

describe("libertà di rosa", () => {
  /**
   * La banda 21-27 e le soglie di reparto sono state **rimosse** su richiesta dell'utente: il
   * direttore sportivo dev'essere libero di svuotare la rosa e ricostruirla. Erano anche la
   * causa per cui dalla seconda stagione non arrivavano più offerte — con la rosa vicina al
   * minimo, `canSell` negava quasi tutti e il mercato non aveva nessuno da chiedere.
   */
  it("si può vendere liberamente, anche una rosa lunga fino a ridurla", () => {
    const { entries, players } = buildSquad();
    expect(canSell(entries, entries[0]!.playerId, players).ok).toBe(true);
    const corta = entries.slice(0, MIN_SQUAD_SIZE + 1);
    expect(canSell(corta, corta[0]!.playerId, players).ok).toBe(true);
  });

  it("si può restare senza secondo portiere: è una scelta, non un divieto", () => {
    const { entries, players } = buildSquad();
    const portieri = entries.filter((e) => players[e.playerId]!.role === "POR");
    const conDuePortieri = [
      ...entries.filter((e) => players[e.playerId]!.role !== "POR"),
      ...portieri.slice(0, 2),
    ];
    expect(canSell(conDuePortieri, portieri[0]!.playerId, players).ok).toBe(true);
  });

  it("resta l'unico limite che non è di prodotto: gli undici che scendono in campo", () => {
    const { entries, players } = buildSquad();
    const undici = entries.slice(0, MIN_SQUAD_SIZE);
    expect(canSell(undici, undici[0]!.playerId, players).ok).toBe(false);
  });

  /**
   * Richiesta esplicita dell'utente: un infortunato non attira offerte, "neanche mettendolo in
   * lista trasferimenti o dal tasto cessione rapida" — bloccato alla radice in `canSell`, che
   * governa sia `buildOffers` (offerte in entrata) sia l'azione "vendi subito".
   */
  it("un infortunato non si può vendere, né subito né tramite un'offerta", () => {
    const { entries, players } = buildSquad();
    const infortunato = { ...entries[0]!, injuryMatchdaysLeft: 8 };
    const conInfortunato = [infortunato, ...entries.slice(1)];
    const esito = canSell(conInfortunato, infortunato.playerId, players);
    expect(esito.ok).toBe(false);
    expect(esito.reason).toBe("injured");
  });

  it("si compra fino a un tetto alto, che nell'uso reale non si tocca", () => {
    const { entries } = buildSquad();
    expect(canBuy(entries).ok).toBe(true);
    const enorme = Array.from({ length: MAX_SQUAD_SIZE }, (_, i) =>
      createRosterEntry({ playerId: `x${i}`, overall: 70, potential: 80, sinceSeason: 1 }),
    );
    expect(canBuy(enorme).ok).toBe(false);
  });
});

describe("affiatamento", () => {
  const formation = getFormation("4-3-3")!;

  function cohesionFor(sinceSeason: number, season: number, nation = "Italia") {
    const { entries, players } = buildSquad();
    for (const id of Object.keys(players)) players[id]!.nation = nation;
    const conStorico = entries.map((e) => ({ ...e, sinceSeason }));
    const lineup = pickStartingEleven(formation, conStorico, players);
    return computeCohesion({
      formation,
      lineup,
      entries: conStorico,
      players,
      season,
      matchdaysWithFormation: 8,
    });
  }

  it("un gruppo che gioca insieme da anni vale più di uno appena assemblato", () => {
    const rodata = cohesionFor(1, 5);
    const nuova = cohesionFor(5, 5);
    expect(rodata.bonus).toBeGreaterThan(nuova.bonus);
    expect(rodata.continuity).toBeGreaterThan(nuova.continuity);
  });

  it("un acquisto straniero NON abbassa l'affiatamento come faceva l'intesa classica", () => {
    // È il difetto che ha motivato la sostituzione: con l'intesa classica comprare fuori dal
    // proprio campionato peggiorava la squadra oltre al costo del cartellino.
    const { entries, players } = buildSquad();
    const conStorico = entries.map((e) => ({ ...e, sinceSeason: 1 }));
    const base = computeCohesion({
      formation,
      lineup: pickStartingEleven(formation, conStorico, players),
      entries: conStorico,
      players,
      season: 5,
    });

    // Stessa rosa, ma il portiere è un neoacquisto straniero fortissimo.
    const conAcquisto = conStorico.map((e) =>
      e.playerId === "p0" ? { ...e, sinceSeason: 5, overall: 90 } : e,
    );
    const playersConAcquisto: PlayerIndex = {
      ...players,
      p0: { ...players.p0!, nation: "Norvegia" },
    };
    const dopo = computeCohesion({
      formation,
      lineup: pickStartingEleven(formation, conAcquisto, playersConAcquisto),
      entries: conAcquisto,
      players: playersConAcquisto,
      season: 5,
    });

    // L'affiatamento cala di poco (il nuovo arrivato deve ancora integrarsi) ma resta alto:
    // il colpo è un investimento che matura, non una penalità immediata.
    expect(dopo.bonus).toBeGreaterThanOrEqual(base.bonus - 2);
  });

  it("resta dentro la scala 0-10 della Modalità Classica", () => {
    const massimo = cohesionFor(1, 10);
    expect(massimo.bonus).toBeLessThanOrEqual(10);
    expect(massimo.bonus).toBeGreaterThanOrEqual(0);
  });

  it("un undici incompleto non regala affiatamento", () => {
    const { entries, players } = buildSquad();
    const vuoto = { starters: {}, bench: [], outOfPosition: [] };
    const result = computeCohesion({ formation, lineup: vuoto, entries, players, season: 3 });
    expect(result).toMatchObject({ bonus: 0, pairs: 0 });
  });

  it("l'etichetta segue il livello", () => {
    expect(cohesionLabel(9)).toBe("Rodata");
    expect(cohesionLabel(5)).toBe("In crescita");
    expect(cohesionLabel(1)).toBe("Da assemblare");
  });
});
