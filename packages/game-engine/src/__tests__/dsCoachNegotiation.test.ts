import { describe, expect, it } from "vitest";
import {
  COACHES,
  computeCoachBuyoutFee,
  derivedRandom,
  evaluateAiCoaches,
  findCoach,
  generateCoachPromises,
  getClubDefaultCoach,
  getCoachGreeting,
  proposePromiseCompromise,
  verifyCoachPromises,
  type CoachPromise,
  type RoleCandidate,
  type SquadAnalysis,
} from "../index";

describe("Real Coaches & Default Club Mapping", () => {
  it("carica oltre 40 allenatori reali tra Serie A, Big 5 e Svincolati", () => {
    expect(COACHES.length).toBeGreaterThanOrEqual(40);
  });

  it("trova l'allenatore reale di default di un club (Inter -> Simone Inzaghi, Real Madrid -> Ancelotti)", () => {
    const inzaghi = getClubDefaultCoach("inter");
    expect(inzaghi).toBeDefined();
    expect(inzaghi?.name).toBe("Simone Inzaghi");
    expect(inzaghi?.formationId).toBe("3-5-2");

    const ancelotti = getClubDefaultCoach("real-madrid");
    expect(ancelotti).toBeDefined();
    expect(ancelotti?.name).toBe("Carlo Ancelotti");
  });

  it("calcola l'indennizzo di riscatto (buyout fee) per il poaching di un mister sotto contratto", () => {
    const coach = findCoach("coach-gasperini")!;
    const buyout = computeCoachBuyoutFee(coach);
    expect(buyout).toBe(Math.round(coach.hireCost * 1.5));
  });
});

describe("Generazione Dinamica Promesse dell'Allenatore", () => {
  it("genera 2-3 promesse dinamiche in base alla rosa ed alla reputazione del mister", () => {
    const coach = findCoach("coach-inzaghi")!;
    const analysis: SquadAnalysis = {
      squadSize: 25,
      avgAge: 24,
      topPlayerOverall: 85,
      under22Count: 2,
      over30Count: 1,
      domesticCount: 3,
      hasSecondKeeper: false,
      missingRolesCount: 1,
    };

    const promises = generateCoachPromises(coach, [], analysis, 1);
    expect(promises.length).toBeGreaterThanOrEqual(2);
    expect(promises.length).toBeLessThanOrEqual(3);
    expect(promises.some((p) => p.kind === "top_player" || p.kind === "formation_fit")).toBe(true);
  });

  /**
   * Bug segnalato dall'utente: un mister che gioca il 3-5-2 (quinti, `QD`/`QS`) chiedeva uno
   * "specialista ES naturale" — un ruolo che quel modulo non schiera affatto (gli esterni di
   * centrocampo puro sono di 4-4-2/4-1-4-1). La richiesta va derivata dallo schema reale.
   */
  it("il ruolo richiesto per lo specialista è una casella che il modulo del mister schiera davvero", () => {
    const inzaghi = findCoach("coach-inzaghi")!; // 3-5-2: quinti, non esterni
    expect(inzaghi.formationId).toBe("3-5-2");

    const analysis: SquadAnalysis = {
      squadSize: 24,
      avgAge: 26,
      topPlayerOverall: 84,
      under22Count: 4,
      over30Count: 3,
      domesticCount: 6,
      hasSecondKeeper: true,
      missingRolesCount: 0,
    };

    const promises = generateCoachPromises(inzaghi, [], analysis, 1);
    const specialista = promises.find((p) => p.kind === "formation_fit");
    expect(specialista).toBeDefined();
    expect(["QD", "QS"]).toContain(specialista!.targetRole);
    expect(specialista!.targetRole).not.toBe("ES");
    expect(specialista!.targetRole).not.toBe("ED");
  });

  /**
   * Bug: `promiseId` e l'ordinamento delle promesse usavano `Math.random()` — violava la
   * promessa di riproducibilità del salvataggio (CLAUDE.md §3.7.13). Passando lo stesso
   * random seedato, la stessa combinazione coach+rosa+stagione deve dare le stesse promesse.
   */
  it("con lo stesso seme le promesse generate sono identiche (riproducibilità da salvataggio)", () => {
    const coach = findCoach("coach-inzaghi")!;
    const analysis: SquadAnalysis = {
      squadSize: 25, avgAge: 24, topPlayerOverall: 85, under22Count: 2, over30Count: 1,
      domesticCount: 3, hasSecondKeeper: false, missingRolesCount: 1,
    };
    const random1 = derivedRandom("carriera-x", "coachPromise", 3, coach.id);
    const random2 = derivedRandom("carriera-x", "coachPromise", 3, coach.id);
    const a = generateCoachPromises(coach, [], analysis, 3, undefined, random1);
    const b = generateCoachPromises(coach, [], analysis, 3, undefined, random2);
    expect(a.map((p) => p.kind)).toEqual(b.map((p) => p.kind));
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
  });

  it("con semi diversi la selezione di promesse varia (non più monotona)", () => {
    const coach = findCoach("coach-inzaghi")!;
    const analysis: SquadAnalysis = {
      squadSize: 25, avgAge: 24, topPlayerOverall: 85, under22Count: 2, over30Count: 1,
      domesticCount: 3, hasSecondKeeper: false, missingRolesCount: 1,
    };
    const combinazioni = new Set(
      Array.from({ length: 12 }, (_, i) => {
        const random = derivedRandom("varieta", "coachPromise", i + 1, coach.id);
        return generateCoachPromises(coach, [], analysis, i + 1, undefined, random)
          .map((p) => p.kind)
          .join(",");
      }),
    );
    expect(combinazioni.size).toBeGreaterThan(1);
  });

  it("uno specialista di ruolo con candidati reali nomina un giocatore, non solo una soglia", () => {
    const coach = findCoach("coach-inzaghi")!; // 3-5-2 → QD/QS
    const analysis: SquadAnalysis = {
      squadSize: 24, avgAge: 26, topPlayerOverall: 84, under22Count: 4, over30Count: 3,
      domesticCount: 6, hasSecondKeeper: true, missingRolesCount: 0,
    };
    const candidati: RoleCandidate[] = [
      { playerId: "c1", playerName: "Quinto Vero", overall: 86, role: "QD" },
      { playerId: "c2", playerName: "Quinto Sinistro", overall: 86, role: "QS" },
      { playerId: "c3", playerName: "Portiere Fuori Ruolo", overall: 90, role: "POR" },
    ];
    const random = derivedRandom("nomina", "coachPromise", 1, coach.id);
    const promises = generateCoachPromises(coach, [], analysis, 1, undefined, random, candidati);
    const specialista = promises.find((p) => p.kind === "formation_fit")!;
    expect(specialista.targetPlayerId).toBeDefined();
    expect(["c1", "c2"]).toContain(specialista.targetPlayerId);
    expect(specialista.description).toContain(specialista.targetPlayerName!);
  });

  it("un giocatore fuori dal sistema di gioco del mister può essere chiesto in cessione (sell_misfit)", () => {
    const coach = findCoach("coach-inzaghi")!; // 3-5-2: niente ED/ES
    const squad = [
      { playerId: "top-1", overall: 88, potential: 88, sinceSeason: 1, morale: 70, injuryMatchdaysLeft: 0, fatigue: 0, stats: { appearances: 0, minutes: 0, goals: 0, assists: 0 } },
      { playerId: "fuori-1", overall: 70, potential: 74, sinceSeason: 1, morale: 70, injuryMatchdaysLeft: 0, fatigue: 0, stats: { appearances: 0, minutes: 0, goals: 0, assists: 0 } },
    ];
    const players = {
      "top-1": { name: "Pilastro", role: "DC" as const },
      "fuori-1": { name: "Esterno Puro", role: "ED" as const },
    };
    const analysis: SquadAnalysis = {
      squadSize: 2, avgAge: 26, topPlayerOverall: 88, under22Count: 0, over30Count: 0,
      domesticCount: 0, hasSecondKeeper: true, missingRolesCount: 0,
    };
    // La selezione finale è a 2 o 3 (seedata) fra imprescindibili e secondarie mescolate:
    // sell_misfit è "negoziabile" e può restare fuori se il conteggio esce a 2. Si prova su
    // più semi e si pretende che compaia almeno una volta, non ogni volta.
    const trovato = Array.from({ length: 20 }, (_, i) => {
      const random = derivedRandom("misfit", "coachPromise", i + 1, coach.id);
      return generateCoachPromises(coach, squad, analysis, i + 1, players, random);
    }).some((promises) => promises.some((p) => p.kind === "sell_misfit" && p.targetPlayerId === "fuori-1"));
    expect(trovato).toBe(true);
  });
});

describe("Mediazione delle promesse: non solo soldi", () => {
  const promiseFormationFit = (): CoachPromise => ({
    id: "p-fit",
    kind: "formation_fit",
    targetRole: "QD",
    targetValue: 80,
    targetPlayerId: "originale",
    targetPlayerName: "Bersaglio Originale",
    description: "Acquisto di Bersaglio Originale (QD, Overall 80)",
    seasonAccepted: 1,
    priority: "imprescindibile",
  });

  it("offer_alternative sostituisce il bersaglio con un candidato reale, senza pagare nulla", () => {
    const state = {
      coachId: "c", coachName: "Mister", patience: 100, hireCost: 1_000_000, buyoutFee: 0,
      promises: [promiseFormationFit()], status: "in_corso" as const, log: [],
    };
    const alternative: RoleCandidate[] = [
      { playerId: "alt-1", playerName: "Alternativa Vera", overall: 81, role: "QD" },
    ];
    const { state: dopo, accepted } = proposePromiseCompromise(state, "p-fit", "offer_alternative", alternative);
    expect(accepted).toBe(true);
    expect(dopo.hireCost).toBe(state.hireCost); // nessun pagamento
    const aggiornata = dopo.promises.find((p) => p.id === "p-fit")!;
    expect(aggiornata.targetPlayerId).toBe("alt-1");
  });

  it("offer_alternative senza un candidato adatto viene rifiutata", () => {
    const state = {
      coachId: "c", coachName: "Mister", patience: 100, hireCost: 1_000_000, buyoutFee: 0,
      promises: [promiseFormationFit()], status: "in_corso" as const, log: [],
    };
    const { accepted } = proposePromiseCompromise(state, "p-fit", "offer_alternative", []);
    expect(accepted).toBe(false);
  });

  it("delay rimanda la verifica alla stagione successiva, senza contarla infranta subito", () => {
    const state = {
      coachId: "c", coachName: "Mister", patience: 100, hireCost: 1_000_000, buyoutFee: 0,
      promises: [promiseFormationFit()], status: "in_corso" as const, log: [],
    };
    const { state: dopo, accepted } = proposePromiseCompromise(state, "p-fit", "delay");
    expect(accepted).toBe(true);
    const rimandata = dopo.promises.find((p) => p.id === "p-fit")!;
    expect(rimandata.deadlineSeason).toBe(2);

    // Verificata alla stagione 1 (non ancora dovuta): resta in sospeso, non infranta.
    const v1 = verifyCoachPromises([rimandata], [], {}, 1, "Italia");
    expect(v1.brokenCount).toBe(0);
    expect(v1.fulfilledCount).toBe(0);

    // Alla stagione 2 (la sua scadenza) torna a essere giudicata normalmente.
    const v2 = verifyCoachPromises([rimandata], [], {}, 2, "Italia");
    expect(v2.brokenCount).toBe(1); // nessuno in rosa soddisfa formation_fit: infranta, ma giudicata
  });
});

describe("Chat Conversazionale e Dialoghi Procedurali", () => {
  it("genera messaggi di benvenuto personalizzati per il mister", () => {
    const guardiola = findCoach("coach-guardiola")!;
    const greeting = getCoachGreeting(guardiola, "Inter");
    expect(greeting).toContain("Pep Guardiola");
    expect(greeting).toContain("Inter");
  });
});

describe("Verifica Promesse e Dimissioni Mister", () => {
  it("aumenta il morale del mister se tutte le promesse sono mantenute", () => {
    const promises: CoachPromise[] = [
      {
        id: "p1",
        kind: "top_player",
        targetValue: 80,
        description: "Top Player",
        seasonAccepted: 1,
      },
    ];

    const roster = [
      {
        playerId: "p-10",
        overall: 85,
        potential: 88,
        sinceSeason: 1,
        morale: 100,
        injuryMatchdaysLeft: 0,
        fatigue: 0,
        stats: { appearances: 0, minutes: 0, goals: 0, assists: 0 },
      },
    ];

    const result = verifyCoachPromises(promises, roster, {}, 1, "Italia");
    expect(result.allFulfilled).toBe(true);
    expect(result.coachResigned).toBe(false);
    expect(result.harmonyDelta).toBeGreaterThan(0);
  });

  /**
   * Bug segnalato dall'utente: la promessa chiedeva budget per "i rinnovi dei titolari" — un
   * sistema di contratti giocatore che il gioco non ha mai avuto. Rinominata `budget_discipline`
   * e resa verificabile per davvero: chiede di non spendere tutto il budget in un colpo solo.
   */
  it("budget_discipline è infranta se il budget scende sotto la soglia, mantenuta altrimenti", () => {
    const promises: CoachPromise[] = [
      { id: "p1", kind: "budget_discipline", description: "Test", seasonAccepted: 1 },
    ];
    const speso = verifyCoachPromises(promises, [], {}, 1, "Italia", undefined, 500_000);
    expect(speso.allFulfilled).toBe(false);

    const prudente = verifyCoachPromises(promises, [], {}, 1, "Italia", undefined, 5_000_000);
    expect(prudente.allFulfilled).toBe(true);
  });

  it("budget_discipline senza informazioni sul budget non si rompe (nessun dato per giudicarla)", () => {
    const promises: CoachPromise[] = [
      { id: "p1", kind: "budget_discipline", description: "Test", seasonAccepted: 1 },
    ];
    const result = verifyCoachPromises(promises, [], {}, 1, "Italia");
    expect(result.allFulfilled).toBe(true);
  });

  it("provoca le dimissioni del mister se 2 o più promesse vengono infrante", () => {
    const promises: CoachPromise[] = [
      {
        id: "p1",
        kind: "top_player",
        targetValue: 95,
        description: "Top Player introvabile",
        seasonAccepted: 1,
      },
      {
        id: "p2",
        kind: "trim_squad",
        targetValue: 1,
        description: "Rosa impossibile",
        seasonAccepted: 1,
      },
    ];

    const roster = [
      {
        playerId: "p-10",
        overall: 70,
        potential: 75,
        sinceSeason: 1,
        morale: 100,
        injuryMatchdaysLeft: 0,
        fatigue: 0,
        stats: { appearances: 0, minutes: 0, goals: 0, assists: 0 },
      },
      {
        playerId: "p-11",
        overall: 70,
        potential: 75,
        sinceSeason: 1,
        morale: 100,
        injuryMatchdaysLeft: 0,
        fatigue: 0,
        stats: { appearances: 0, minutes: 0, goals: 0, assists: 0 },
      },
    ];

    const result = verifyCoachPromises(promises, roster, {}, 1, "Italia");
    expect(result.allFulfilled).toBe(false);
    expect(result.coachResigned).toBe(true);
    expect(result.brokenCount).toBe(2);
  });
});

describe("Valutazione Esoneri IA (Sacking System)", () => {
  it("genera notifiche di esonero per club CPU che deludono gli obiettivi", () => {
    const clubs = [{ id: "real-madrid", name: "Real Madrid", leagueId: "liga", prestigeTier: 5 }];
    const standings = [{ clubId: "real-madrid", rank: 10 }]; // 10° posto per il Real Madrid = delusione grave
    const coachesMap = new Map([["real-madrid", "coach-ancelotti"]]);

    const notices = evaluateAiCoaches(clubs, standings, 1, coachesMap);
    expect(notices.length).toBe(1);
    expect(notices[0]!.kind).toBe("esonero");
    expect(coachesMap.has("real-madrid")).toBe(false);
  });
});
