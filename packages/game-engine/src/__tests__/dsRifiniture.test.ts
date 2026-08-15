/**
 * **Le correzioni nate da una sessione di gioco reale.**
 *
 * Sette segnalazioni dell'utente, e quasi tutte avevano in comune la stessa forma di difetto: un
 * dato che il motore *conosceva* e che nessuno leggeva al momento di decidere — il prestito in
 * entrata quando si compila la lista trasferimenti, la clausola rescissoria quando si apre una
 * finestra, la promessa di cessione quando si sceglie di cosa lamentarsi, la descrizione
 * dell'impegno quando lo si rinfaccia.
 *
 * I test qui verificano il comportamento *dal lato di chi gioca* (l'azione viene rifiutata, il
 * giocatore tace, il mister cambia richiesta), non l'esistenza dei campi che lo rendono
 * possibile: un campo si può rinominare, la regola no.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
  applyMarketAction,
  buildClauseSales,
  emptySquadLists,
  type MarketWorld,
} from "../ds/careerMarket";
import { createRosterEntry } from "../ds/roster";
import { buildFreeAgentPool } from "../ds/freeAgents";
import { buildPlayerFacts, type PlayerFactsInput } from "../ds/playerFacts";
import { eligibleTopics, pickTopic } from "../ds/playerTopics";
import { coachRequest } from "../ds/coachRequests";
import { getFormation } from "../formations";
import { findCoach } from "../ds/coaches";
import type { PlayerIndex, RosterEntry } from "../ds/types";
import { ROLE_DEPARTMENT, type Role } from "@app/shared-types";

/* -------------------------------------------------------------------------- */
/* Un mondo di mercato minimo, condiviso                                       */
/* -------------------------------------------------------------------------- */

function marketWorld(overrides: Partial<MarketWorld> = {}): MarketWorld {
  const players: PlayerIndex = {};
  for (let i = 0; i < 20; i++) {
    players[`p${i}`] = {
      id: `p${i}`,
      name: `Giocatore ${i}`,
      nation: "Italia",
      role: "CC",
      secondaryRoles: [],
    };
  }
  return {
    clubs: {
      ricco: {
        id: "ricco",
        name: "Club Ricco",
        leagueId: "l",
        startingEleven: Array.from({ length: 11 }, () => 85),
      },
      povero: {
        id: "povero",
        name: "Club Povero",
        leagueId: "l",
        startingEleven: Array.from({ length: 11 }, () => 64),
      },
    },
    transferPool: [],
    valuation: {
      leaguePrestigeByClub: { ricco: 5, povero: 2, mio: 4 },
      clubPrestige: { ricco: 5, povero: 2, mio: 4 },
      clubsInSameEra: 96,
    },
    players,
    nameOf: (id) => players[id]?.name ?? id,
    ageOf: () => 26,
    leagueRounds: 38,
    ...overrides,
  };
}

function rosaDi(quanti: number, overall = 76): RosterEntry[] {
  return Array.from({ length: quanti }, (_, i) =>
    createRosterEntry({ playerId: `p${i}`, overall, potential: overall + 4, sinceSeason: 1 }),
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Il prestito in entrata non si mette in vendita                           */
/* -------------------------------------------------------------------------- */

describe("chi è in prestito da un altro club non si può cedere", () => {
  const world = marketWorld();

  it("la lista trasferimenti rifiuta un prestito in entrata, e dice perché", () => {
    const roster = rosaDi(20);
    roster[0] = { ...roster[0]!, loan: { ownerClubId: "ricco", untilSeason: 1 } };

    const esito = applyMarketAction(
      { roster, budget: 10_000_000, snapshot: { window: "estiva", offers: [], shortlist: [], loanOffers: [], aiSellable: [] }, lists: emptySquadLists() },
      { kind: "lista_trasferimenti", playerId: "p0", on: true },
      world,
      1,
      "seed",
    );

    expect(esito.rejected).toBe(true);
    expect(esito.lists.transferList).not.toContain("p0");
    expect(esito.message).toMatch(/prestito/i);
  });

  it("chi è nostro si mette in vendita come sempre", () => {
    const esito = applyMarketAction(
      { roster: rosaDi(20), budget: 10_000_000, snapshot: { window: "estiva", offers: [], shortlist: [], loanOffers: [], aiSellable: [] }, lists: emptySquadLists() },
      { kind: "lista_trasferimenti", playerId: "p0", on: true },
      world,
      1,
      "seed",
    );

    expect(esito.rejected).toBeFalsy();
    expect(esito.lists.transferList).toContain("p0");
  });

  it("nemmeno chi è in prestito **altrove**: è nostro, ma non è qui", () => {
    const roster = rosaDi(20);
    roster[0] = { ...roster[0]!, loan: { hostClubId: "povero", untilSeason: 1 } };

    const esito = applyMarketAction(
      { roster, budget: 10_000_000, snapshot: { window: "estiva", offers: [], shortlist: [], loanOffers: [], aiSellable: [] }, lists: emptySquadLists() },
      { kind: "lista_trasferimenti", playerId: "p0", on: true },
      world,
      1,
      "seed",
    );

    expect(esito.rejected).toBe(true);
    expect(esito.lists.transferList).not.toContain("p0");
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Le clausole rescissorie sono vere                                        */
/* -------------------------------------------------------------------------- */

describe("clausole rescissorie", () => {
  const world = marketWorld();
  /** Una rosa di gente forte: solo così i club credibili esistono davvero. */
  const roster = rosaDi(22, 84);

  it("un club credibile e ricco paga una clausola conveniente e si prende il giocatore", () => {
    // Clausola volutamente bassa rispetto al valore: per chi compra è un affare.
    const vendite = buildClauseSales(
      roster,
      world,
      "mio",
      (id) => (id === "p0" ? 5_000_000 : undefined),
      mulberry32(7),
    );

    expect(vendite).toHaveLength(1);
    expect(vendite[0]!.playerId).toBe("p0");
    expect(vendite[0]!.fee).toBe(5_000_000);
    // Chi paga dev'essere all'altezza: il club da 64 di media non compra un 84.
    expect(vendite[0]!.toClubId).toBe("ricco");
  });

  /**
   * Le due leve che tengono a bada la clausola sono distinte, e vanno misurate separate: la
   * cifra dev'essere **alla portata** di chi compra, e dev'essere **conveniente**. Un solo test
   * a cifra enorme le confonde, e verificherebbe solo la prima — verificato forzando la
   * probabilità a 1 e vedendo il test passare lo stesso.
   */
  it("una clausola fuori dalla portata di chiunque non si esercita: nessuno può pagarla", () => {
    const vendite = buildClauseSales(
      roster,
      world,
      "mio",
      (id) => (id === "p0" ? 900_000_000 : undefined),
      mulberry32(7),
    );
    expect(vendite).toHaveLength(0);
  });

  it("una clausola pagabile ma molto sopra il valore resta lettera morta: non conviene", () => {
    // ~100M contro un valore di mercato attorno ai 24M: il Club Ricco potrebbe permettersela.
    const vendite = buildClauseSales(
      roster,
      world,
      "mio",
      (id) => (id === "p0" ? 100_000_000 : undefined),
      mulberry32(7),
    );
    expect(vendite).toHaveLength(0);
  });

  it("senza clausola firmata non succede niente: è ciò che rende la firma una decisione", () => {
    const vendite = buildClauseSales(roster, world, "mio", () => undefined, mulberry32(7));
    expect(vendite).toHaveLength(0);
  });

  it("al massimo una per finestra, anche se mezza rosa ha la clausola", () => {
    const vendite = buildClauseSales(roster, world, "mio", () => 5_000_000, mulberry32(3));
    expect(vendite.length).toBeLessThanOrEqual(1);
  });

  it("con una rosa al minimo non si scende sotto gli undici schierabili", () => {
    const vendite = buildClauseSales(rosaDi(11, 84), world, "mio", () => 1_000_000, mulberry32(3));
    expect(vendite).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Lo svincolato firmato e poi ceduto non torna in vetrina                  */
/* -------------------------------------------------------------------------- */

describe("il pool degli svincolati", () => {
  /**
   * ⚠️ Il difetto segnalato: preso uno svincolato alla prima stagione, venduto a gennaio, lo si
   * ritrovava di nuovo fra gli svincolati. La causa non era il decadimento né i contratti: i
   * ragazzi senza squadra si generavano **dopo** il filtro `signed`, quindi quel filtro non li
   * toccava. E siccome il loro id è derivato da `(seme, stagione, indice)`, la vetrina li
   * ricreava identici alla finestra dopo.
   */
  it("chi abbiamo già tesserato non ricompare, nemmeno se è un ragazzo senza squadra", () => {
    const primo = buildFreeAgentPool({ worldPlayers: [], seed: "s", season: 1, regenCount: 6 });
    expect(primo.length).toBeGreaterThan(0);

    const preso = primo[0]!;
    const dopo = buildFreeAgentPool({
      worldPlayers: [],
      seed: "s",
      season: 1,
      regenCount: 6,
      signed: new Set([preso.id]),
    });

    expect(dopo.map((a) => a.id)).not.toContain(preso.id);
  });

  it("gli altri restano quelli di prima: il filtro non riscrive la vetrina", () => {
    const primo = buildFreeAgentPool({ worldPlayers: [], seed: "s", season: 1, regenCount: 6 });
    const preso = primo[0]!;
    const dopo = buildFreeAgentPool({
      worldPlayers: [],
      seed: "s",
      season: 1,
      regenCount: 6,
      signed: new Set([preso.id]),
    });

    expect(dopo.map((a) => a.id)).toEqual(primo.filter((a) => a.id !== preso.id).map((a) => a.id));
  });
});

/* -------------------------------------------------------------------------- */
/* 4-5. Promessa di cessione e promessa infranta                               */
/* -------------------------------------------------------------------------- */

function fattiDi(input: Partial<PlayerFactsInput> = {}) {
  const entry = createRosterEntry({
    playerId: "x",
    overall: 82,
    potential: 84,
    sinceSeason: 1,
  });
  const conStato: RosterEntry = { ...entry, morale: 40, stats: { appearances: 2, minutes: 90, goals: 0, assists: 0 } };

  return buildPlayerFacts({
    entry: conStato,
    player: { id: "x", name: "Il Giocatore", role: "ATT", secondaryRoles: [] },
    age: 27,
    season: 2,
    matchday: 20,
    squadAverage: 74,
    marketValue: 20_000_000,
    roster: [conStato],
    roleOf: () => ({ role: "ATT" as Role, secondaryRoles: [] }),
    contract: { until: 5, wage: 1_000_000, signedSeason: 1 },
    wageVsPeers: 1,
    wageRoomLeft: 5_000_000,
    currentWeek: 20,
    ...input,
  });
}

describe("a chi è stata promessa la cessione non si deve altro, fino al mercato dopo", () => {
  it("senza promessa ha eccome di che lamentarsi", () => {
    const fatti = fattiDi({ isOnTransferList: true, incomingOffer: { clubId: "ricco", clubName: "Club Ricco", fee: 25_000_000, prestige: 5, kind: "trasferimento" } });
    expect(eligibleTopics(fatti).length).toBeGreaterThan(0);
  });

  it("con la promessa in piedi tace su tutto, non solo sull'argomento di cui si è parlato", () => {
    const fatti = fattiDi({
      isOnTransferList: true,
      incomingOffer: { clubId: "ricco", clubName: "Club Ricco", fee: 25_000_000, prestige: 5, kind: "trasferimento" },
      relationship: { trust: 50, salePromisedAtWindow: 3 },
      marketWindowsOpened: 3,
    });
    expect(eligibleTopics(fatti)).toHaveLength(0);
    expect(pickTopic(fatti)).toBeNull();
  });

  it("alla finestra successiva torna a parlare: lì la promessa è stata mantenuta o no", () => {
    const fatti = fattiDi({
      isOnTransferList: true,
      incomingOffer: { clubId: "ricco", clubName: "Club Ricco", fee: 25_000_000, prestige: 5, kind: "trasferimento" },
      relationship: { trust: 50, salePromisedAtWindow: 3 },
      marketWindowsOpened: 4,
    });
    expect(eligibleTopics(fatti).length).toBeGreaterThan(0);
  });

  it("una richiesta forzata passa comunque: è lui a essersi presentato", () => {
    const fatti = fattiDi({
      isOnTransferList: true,
      incomingOffer: { clubId: "ricco", clubName: "Club Ricco", fee: 25_000_000, prestige: 5, kind: "trasferimento" },
      relationship: { trust: 50, salePromisedAtWindow: 3 },
      marketWindowsOpened: 3,
    });
    expect(eligibleTopics(fatti, { ignoreTregua: true }).length).toBeGreaterThan(0);
  });
});

describe("chi rinfaccia una promessa infranta la nomina", () => {
  it("il testo di apertura e la richiesta contengono la promessa vera", () => {
    const fatti = fattiDi({
      relationship: {
        trust: 20,
        brokenCount: 1,
        brokenPromises: ["Rinforzo promesso in attacco"],
      },
    });

    const tema = pickTopic(fatti);
    expect(tema?.id).toBe("promessa_infranta");
    expect(tema!.opening(fatti)).toContain("Rinforzo promesso in attacco");
    expect(tema!.demand(fatti).description).toContain("Rinforzo promesso in attacco");
  });

  it("con più promesse mancate le rinfaccia entrambe, dalla più recente", () => {
    const fatti = fattiDi({
      relationship: {
        trust: 10,
        brokenCount: 2,
        brokenPromises: ["Titolare garantito", "Rinforzo promesso in difesa"],
      },
    });

    const testo = pickTopic(fatti)!.opening(fatti);
    expect(testo.indexOf("Titolare garantito")).toBeLessThan(testo.indexOf("Rinforzo promesso in difesa"));
  });

  it("un salvataggio precedente, senza le descrizioni, non si rompe", () => {
    const fatti = fattiDi({ relationship: { trust: 20, brokenCount: 1 } });
    const tema = pickTopic(fatti);
    expect(tema?.id).toBe("promessa_infranta");
    expect(tema!.opening(fatti).length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Il mister guarda la rosa prima di chiedere                               */
/* -------------------------------------------------------------------------- */

describe("le richieste del mister nascono dalla rosa vera", () => {
  const coach = findCoach("c-10")!;
  const formation = getFormation("4-4-2")!;

  /** Una rosa che copre il 4-4-2, `perCasella` uomini per slot, tutti al livello indicato. */
  function rosaPer442(
    livelli: Partial<Record<Role, number>> = {},
    base = 76,
    perCasella = 2,
  ) {
    const caselle: Role[] = ["POR", "TD", "DC", "DC", "TS", "ED", "CC", "CC", "ES", "ATT", "ATT"];
    const players: PlayerIndex = {};
    const roster: RosterEntry[] = [];
    caselle.forEach((role, i) => {
      // Titolare e cambio, così nessun ruolo risulta scoperto per semplice mancanza di corpi.
      for (const suffisso of ["a", "b", "c"].slice(0, perCasella)) {
        const id = `${role}-${i}-${suffisso}`;
        players[id] = { id, name: `Tale ${id}`, nation: "Italia", role, secondaryRoles: [] };
        roster.push(
          createRosterEntry({
            playerId: id,
            overall: livelli[role] ?? base,
            potential: (livelli[role] ?? base) + 3,
            sinceSeason: 1,
          }),
        );
      }
    });
    return { players, roster };
  }

  it("una casella davvero scoperta viene chiesta per nome", () => {
    const { players, roster } = rosaPer442();
    // Via i due esterni destri: nessuno, nemmeno da secondario, sa fare quella casella.
    const senzaED = roster.filter((e) => !e.playerId.startsWith("ED-"));

    const richiesta = coachRequest({ coach, formation, roster: senzaED, players, ageOf: () => 26 });
    expect(richiesta?.kind).toBe("ruolo_scoperto");
    expect(richiesta?.role).toBe("ED");
  });

  it("**non** chiede un ruolo dove la rosa è già al livello del resto della squadra", () => {
    const { players, roster } = rosaPer442();
    const richiesta = coachRequest({ coach, formation, roster, players, ageOf: () => 26 });
    // Tutte le caselle sono uguali: qualunque cosa chieda, non può essere "quel ruolo è debole".
    expect(richiesta?.kind).not.toBe("reparto_debole");
  });

  it("nomina la casella debole, non quella con più slot nel modulo", () => {
    /**
     * ⚠️ È il difetto segnalato: prima si sceglieva il reparto più debole e poi, di quello, il
     * ruolo con **più caselle** nel modulo — in difesa usciva sempre `DC`. Qui i centrali sono i
     * più forti della squadra e il buco vero è il terzino sinistro: se la richiesta dicesse `DC`
     * starebbe guardando il modulo invece della rosa.
     */
    const { players, roster } = rosaPer442({ DC: 84, TS: 62 });
    const richiesta = coachRequest({ coach, formation, roster, players, ageOf: () => 26 });
    expect(richiesta?.kind).toBe("reparto_debole");
    expect(richiesta?.role).toBe("TS");
  });

  it("non ripete la richiesta dell'anno prima se un'altra casella è messa quasi uguale", () => {
    /**
     * ⚠️ I due livelli non sono identici **di proposito**: con un pareggio esatto l'ordine
     * naturale delle caselle nel modulo metterebbe comunque `TD` per primo, e il test passerebbe
     * anche senza la memoria della richiesta precedente — verificato disabilitandola. Qui `TS` è
     * il peggiore, quindi la scelta ovvia sarebbe ripetersi: solo la memoria (e il fatto che il
     * margine sia sotto `MARGINE_RIPETIZIONE`) sposta la richiesta sull'altro terzino.
     */
    const { players, roster } = rosaPer442({ TS: 63, TD: 64 });
    const richiesta = coachRequest({
      coach,
      formation,
      roster,
      players,
      ageOf: () => 26,
      previous: { kind: "reparto_debole", role: "TS" },
    });
    expect(richiesta?.role).toBe("TD");
  });

  it("…ma la ripete se quella casella è **nettamente** la peggiore: mentire sarebbe peggio", () => {
    const { players, roster } = rosaPer442({ TS: 60, TD: 72 });
    const richiesta = coachRequest({
      coach,
      formation,
      roster,
      players,
      ageOf: () => 26,
      previous: { kind: "reparto_debole", role: "TS" },
    });
    expect(richiesta?.role).toBe("TS");
  });

  it("un jolly non copre due caselle insieme: in campo può stare in una sola", () => {
    /**
     * ⚠️ È l'altra metà della segnalazione. La copertura si contava sommando ruolo principale e
     * secondari **per giocatore**, quindi un difensore che sapeva fare anche il terzino copriva
     * due caselle contemporaneamente — cosa che in campo non può fare — e la rosa risultava più
     * completa del vero.
     *
     * Qui c'è **un uomo per casella**, si tolgono i terzini destri e si dà il ruolo secondario
     * `TD` a un centrale. Con il vecchio conteggio nessuna casella risultava scoperta; con
     * l'assegnazione esclusiva il jolly va a destra e in mezzo resta un buco.
     */
    const { players, roster } = rosaPer442({}, 76, 1);
    const senzaTD = roster.filter((e) => !e.playerId.startsWith("TD-"));
    const jolly = senzaTD.find((e) => e.playerId.startsWith("DC-"))!;
    const conJolly: PlayerIndex = {
      ...players,
      [jolly.playerId]: { ...players[jolly.playerId]!, secondaryRoles: ["TD"] },
    };

    const richiesta = coachRequest({
      coach,
      formation,
      roster: senzaTD,
      players: conJolly,
      ageOf: () => 26,
    });
    expect(richiesta?.kind).toBe("ruolo_scoperto");
    expect(["TD", "DC"]).toContain(richiesta?.role);
  });
});

/* -------------------------------------------------------------------------- */
/* Coerenza: i reparti derivati restano quelli dichiarati                      */
/* -------------------------------------------------------------------------- */

it("il reparto di un ruolo resta quello del tabellone (guardia contro rimappature)", () => {
  expect(ROLE_DEPARTMENT.TS).toBe("DIF");
  expect(ROLE_DEPARTMENT.ED).toBe("CC");
});
