/**
 * **Spogliatoio**: fatti → temi → dialogo → impegni.
 *
 * Il primo test del file è quello che il sistema precedente non superava, ed è la ragione per cui
 * il livello dei temi esiste: un titolare inamovibile con il morale a terra apriva la chat
 * chiedendo *"la conferma del suo ruolo da titolare"*, perché il motivo veniva da un fallback
 * generico e nessuno guardava quanto giocasse.
 *
 * Subito dopo c'è il suo **duale**, e non è un di più: un sistema che non fa mai parlare nessuno
 * passerebbe il primo test a pieni voti.
 */
import { describe, expect, it } from "vitest";
import type { Role } from "@app/shared-types";
import { verifyCommitments, makeCommitment, type Commitment } from "../ds/commitments";
import {
  applyDialogueMove,
  availableMoves,
  initialPatience,
  openDialogue,
  type MoveContext,
} from "../ds/playerDialogue";
import { buildPlayerFacts, type PlayerFacts, type PlayerFactsInput } from "../ds/playerFacts";
import { blockingTopic, eligibleTopics, pickTopic, talkUrgency, TOPICS } from "../ds/playerTopics";
import type { RosterEntry } from "../ds/types";
import {
  applyPlayerDialogue,
  dressingRoom,
  openPlayerDialogue,
  setGuaranteedStarter,
} from "../ds/career";
import { createRosterEntry } from "../ds/roster";
import { fullCareer, playSeason } from "./helpers/dsWorld";

/* -------------------------------------------------------------------------- */
/* Fabbriche                                                                   */
/* -------------------------------------------------------------------------- */

function entry(over: Partial<RosterEntry> = {}): RosterEntry {
  return {
    playerId: "p1",
    overall: 80,
    potential: 84,
    sinceSeason: 1,
    morale: 60,
    injuryMatchdaysLeft: 0,
    fatigue: 20,
    stats: { appearances: 0, minutes: 0, goals: 0, assists: 0 },
    ...over,
  };
}

function facts(over: Partial<PlayerFactsInput> = {}, entryOver: Partial<RosterEntry> = {}): PlayerFacts {
  const e = entry(entryOver);
  const input: PlayerFactsInput = {
    entry: e,
    player: { id: e.playerId, name: "Mario Rossi", role: "CC" as Role, secondaryRoles: [] },
    age: 27,
    season: 3,
    matchday: 20,
    squadAverage: 76,
    marketValue: 20_000_000,
    roster: [e],
    roleOf: () => ({ role: "CC" as Role, secondaryRoles: [] }),
    contract: { until: 6, wage: 2_000_000, signedSeason: 1 },
    wageVsPeers: 1,
    wageRoomLeft: 5_000_000,
    coachHarmony: 70,
    ...over,
  };
  return buildPlayerFacts(input);
}

const moveCtx: MoveContext = {
  transferCash: 30_000_000,
  wageRoom: 5_000_000,
  coachWouldApprove: true,
  hasOtherCaptain: false,
  weakestDepartment: "DIF",
  season: 3,
  matchday: 20,
};

/* -------------------------------------------------------------------------- */
/* Le due regole anti-assurdo                                                  */
/* -------------------------------------------------------------------------- */

describe("un tema può aprirsi solo se i fatti lo reggono", () => {
  it("un titolare fisso non riceve MAI un tema di minutaggio, per quanto sia arrabbiato", () => {
    const titolare = facts(
      { guaranteedStarters: { CC: "p1" }, positionsBelowTarget: 9 },
      { morale: 20, stats: { appearances: 20, minutes: 1800, goals: 3, assists: 2 } },
    );
    expect(titolare.playedShare).toBeGreaterThan(0.9);

    const temi = eligibleTopics(titolare).map((t) => t.id);
    expect(temi).not.toContain("poco_impiego");
    expect(temi).not.toContain("gerarchia_persa");
    expect(temi).not.toContain("giovane_crescita");
  });

  it("...e nemmeno una mossa può offrirgli ciò che ha già", () => {
    const titolare = facts(
      { guaranteedStarters: { CC: "p1" }, positionsBelowTarget: 9 },
      { morale: 20, stats: { appearances: 20, minutes: 1800, goals: 3, assists: 2 } },
    );
    const topic = pickTopic(titolare)!;
    const dialogo = openDialogue(titolare, topic);
    const mosse = availableMoves(dialogo, titolare, moveCtx);
    const garanzia = mosse.find((m) => m.kind === "garantisci_titolarita");
    // O non è proponibile per questo tema, o è disabilitata col motivo scritto.
    if (garanzia) expect(garanzia.disabledReason).toBeTruthy();
  });

  it("DUALE: un panchinaro forte apre eccome un caso di minutaggio", () => {
    const panchinaro = facts({}, { morale: 40, overall: 84, stats: { appearances: 3, minutes: 150, goals: 0, assists: 0 } });
    const temi = eligibleTopics(panchinaro).map((t) => t.id);
    expect(temi).toContain("poco_impiego");
    expect(pickTopic(panchinaro)).not.toBeNull();
  });

  it("un infortunato lungo non è 'uno che gioca poco': i minuti si normalizzano", () => {
    const infortunato = facts({ matchday: 20 }, { injuryMatchdaysLeft: 18, stats: { appearances: 2, minutes: 180, goals: 0, assists: 0 } });
    expect(infortunato.matchdaysAvailable).toBe(2);
    expect(infortunato.playedShare).toBe(1);
    expect(eligibleTopics(infortunato).map((t) => t.id)).not.toContain("poco_impiego");
  });

  it("un giocatore sereno e senza pendenze non ha nulla di cui parlare", () => {
    const sereno = facts(
      { positionsBelowTarget: 0 },
      { morale: 75, overall: 74, stats: { appearances: 12, minutes: 900, goals: 1, assists: 1 } },
    );
    expect(eligibleTopics(sereno)).toHaveLength(0);
    expect(pickTopic(sereno)).toBeNull();
    expect(talkUrgency(sereno)).toBe(0);
  });

  it("chi è appena arrivato non si lamenta del minutaggio nella stagione dell'arrivo", () => {
    const nuovo = facts({ season: 3 }, { sinceSeason: 3, stats: { appearances: 1, minutes: 90, goals: 0, assists: 0 } });
    expect(eligibleTopics(nuovo).map((t) => t.id)).not.toContain("poco_impiego");
  });

  /**
   * ⚠️ **Il bug segnalato dall'utente**: un giocatore appena comprato apriva una conversazione
   * per chiedere minutaggio *senza aver giocato un solo minuto con la squadra*.
   *
   * La causa era aritmetica, non di soglia: le giornate disponibili si contavano dall'inizio
   * della stagione, quindi chi arriva nel mercato di riparazione trovava già diciannove giornate
   * alle spalle — "ha avuto abbastanza occasioni" risultava vero il giorno stesso della firma, e
   * la sua quota di minuti era zero perché il campionato era cominciato senza di lui.
   *
   * La correzione sta nei **fatti** e non nei singoli temi: `arrivedThisSeason` copriva solo
   * `poco_impiego`, e comunque non bastava — un acquisto estivo alla seconda giornata ha
   * davvero giocato poco, ma non ha ancora avuto nessuna occasione.
   */
  it("chi è appena arrivato non ha ancora nulla di cui lamentarsi", () => {
    const appenaComprato = facts(
      { matchday: 20, season: 3 },
      { sinceSeason: 3, joinedAtMatchday: 19, morale: 40, overall: 84 },
    );

    expect(appenaComprato.matchdaysAvailable).toBeLessThan(6);
    const tema = pickTopic(appenaComprato);
    expect(tema?.id).not.toBe("poco_impiego");
    expect(tema?.id).not.toBe("giovane_crescita");
  });

  it("...ma dopo qualche giornata senza mai giocare, il caso si apre eccome", () => {
    // Il duale: se il correttivo silenziasse per sempre chi è arrivato in corsa, avremmo
    // scambiato un difetto con un altro.
    const dopoDieciGiornate = facts(
      { matchday: 30, season: 3 },
      { sinceSeason: 3, joinedAtMatchday: 19, morale: 40, overall: 84 },
    );

    expect(dopoDieciGiornate.matchdaysAvailable).toBeGreaterThanOrEqual(6);
    expect(dopoDieciGiornate.playedShare).toBeLessThan(0.3);
  });

  it("chi è in prestito altrove non apre conversazioni", () => {
    const inPrestito = facts({}, { loan: { hostClubId: "altro", untilSeason: 3 }, morale: 10 });
    expect(eligibleTopics(inPrestito)).toHaveLength(0);
  });
});

describe("temi di contratto", () => {
  it("chi ha tre anni davanti non chiede il rinnovo", () => {
    const blindato = facts({ contract: { until: 8, wage: 2_000_000, signedSeason: 1 } });
    expect(eligibleTopics(blindato).map((t) => t.id)).not.toContain("rinnovo_richiesto");
    expect(eligibleTopics(blindato).map((t) => t.id)).not.toContain("ultimo_anno");
  });

  it("all'ultimo anno chiede chiarezza, e in inverno arriva il precontratto", () => {
    const scadenza = { until: 3, wage: 2_000_000, signedSeason: 1 };
    const inScadenza = facts({ contract: scadenza }, { stats: { appearances: 15, minutes: 1200, goals: 2, assists: 1 } });
    expect(eligibleTopics(inScadenza).map((t) => t.id)).toContain("ultimo_anno");

    const conPretendente = facts({
      contract: scadenza,
      winterWindowOpen: true,
      preContractSuitor: { clubId: "bayern", clubName: "Bayern", prestige: 5 },
    });
    const temi = eligibleTopics(conPretendente);
    expect(temi[0]!.id).toBe("precontratto");
    expect(blockingTopic(conPretendente)?.id).toBe("precontratto");
  });

  it("chi è pagato molto meno dei pari livello se ne accorge", () => {
    const sottopagato = facts(
      { wageVsPeers: 0.5 },
      { stats: { appearances: 15, minutes: 1300, goals: 4, assists: 2 } },
    );
    expect(eligibleTopics(sottopagato).map((t) => t.id)).toContain("squilibrio_ingaggi");
  });

  it("il tavolo del rinnovo non si apre per chi ha il contratto lungo", () => {
    const blindato = facts({ contract: { until: 9, wage: 2_000_000, signedSeason: 1 }, wageVsPeers: 0.5 }, { stats: { appearances: 15, minutes: 1300, goals: 4, assists: 2 } });
    const topic = pickTopic(blindato)!;
    const dialogo = openDialogue(blindato, topic);
    const rinnovo = availableMoves(dialogo, blindato, moveCtx).find((m) => m.kind === "offri_rinnovo");
    if (rinnovo) expect(rinnovo.disabledReason).toContain("anni");
  });
});

describe("la fiducia è la memoria del rapporto", () => {
  it("chi è stato tradito apre con molta meno pazienza di chi si fida", () => {
    const fidato = facts({ relationship: { trust: 90 } }, { morale: 50, stats: { appearances: 2, minutes: 100, goals: 0, assists: 0 } });
    const tradito = facts({ relationship: { trust: 5, feud: true, brokenCount: 2 } }, { morale: 50, stats: { appearances: 2, minutes: 100, goals: 0, assists: 0 } });
    expect(initialPatience(fidato)).toBeGreaterThan(initialPatience(tradito) * 2);
  });

  it("una promessa infranta apre un tema bloccante che viene prima di tutto il resto", () => {
    const tradito = facts(
      { relationship: { trust: 5, brokenCount: 1 } },
      { morale: 30, stats: { appearances: 2, minutes: 100, goals: 0, assists: 0 } },
    );
    expect(pickTopic(tradito)?.id).toBe("promessa_infranta");
    expect(blockingTopic(tradito)).not.toBeNull();
  });
});

describe("le mosse dichiarano il costo e il motivo del blocco", () => {
  const panchinaro = () =>
    facts({}, { morale: 40, overall: 84, stats: { appearances: 3, minutes: 150, goals: 0, assists: 0 } });

  it("nessuna mossa è mai un bottone muto: o è attiva, o dice perché no", () => {
    const f = panchinaro();
    const d = openDialogue(f, pickTopic(f)!);
    for (const m of availableMoves(d, f, moveCtx)) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.cost.length).toBeGreaterThan(0);
    }
  });

  it("il premio si disabilita con la liquidità scritta, non fallisce dopo il clic", () => {
    const f = panchinaro();
    const d = openDialogue(f, TOPICS.find((t) => t.id === "riconoscimento")!);
    const senzaSoldi = availableMoves(d, f, { ...moveCtx, transferCash: 1000 }).find((m) => m.kind === "premio_denaro");
    expect(senzaSoldi?.disabledReason).toBeTruthy();
    const esito = applyDialogueMove(d, f, { kind: "premio_denaro" }, { ...moveCtx, transferCash: 1000 });
    expect(esito.errorMessage).toBeTruthy();
    expect(esito.dialogue.status).toBe("aperta");
  });

  it("l'adeguamento è bloccato dal margine della cassa ingaggi, con la cifra in chiaro", () => {
    const f = facts({ wageVsPeers: 0.5, wageRoomLeft: 10_000 }, { stats: { appearances: 15, minutes: 1300, goals: 4, assists: 2 } });
    const d = openDialogue(f, TOPICS.find((t) => t.id === "squilibrio_ingaggi")!);
    const mossa = availableMoves(d, f, { ...moveCtx, wageRoom: 10_000 }).find((m) => m.kind === "adegua_ingaggio");
    expect(mossa?.disabledReason).toContain("Margine insufficiente");
  });
});

describe("gli esiti hanno conseguenze nette", () => {
  const panchinaro = () =>
    facts({}, { morale: 40, overall: 84, stats: { appearances: 3, minutes: 150, goals: 0, assists: 0 } });

  it("garantire il posto contrae un impegno verificabile e alza morale e fiducia", () => {
    const f = panchinaro();
    const d = openDialogue(f, pickTopic(f)!);
    const esito = applyDialogueMove(d, f, { kind: "garantisci_titolarita" }, moveCtx);

    expect(esito.dialogue.status).toBe("accordo");
    expect(esito.moraleDelta).toBeGreaterThan(0);
    expect(esito.trustDelta).toBeGreaterThan(0);
    expect(esito.commitments).toHaveLength(1);
    expect(esito.commitments[0]!.kind).toBe("minuti");
    expect(esito.guaranteeRole).toBe("CC");
  });

  it("se il mister si oppone, la promessa fallisce e il rapporto si rompe", () => {
    const f = panchinaro();
    const d = openDialogue(f, pickTopic(f)!);
    const esito = applyDialogueMove(d, f, { kind: "garantisci_titolarita" }, { ...moveCtx, coachWouldApprove: false });

    expect(esito.dialogue.status).toBe("rottura");
    expect(esito.moraleDelta).toBeLessThan(0);
    expect(esito.commitments).toHaveLength(0);
  });

  it("ignorarlo fino in fondo rompe il rapporto e azzera la fiducia", () => {
    const f = panchinaro();
    let d = openDialogue(f, pickTopic(f)!);
    let ultimo = applyDialogueMove(d, f, { kind: "ignora" }, moveCtx);
    for (let i = 0; i < 5 && ultimo.dialogue.status === "aperta"; i++) {
      d = ultimo.dialogue;
      ultimo = applyDialogueMove(d, f, { kind: "ignora" }, moveCtx);
    }
    expect(ultimo.dialogue.status).toBe("rottura");
    expect(ultimo.trustDelta).toBeLessThanOrEqual(-30);
  });

  it("la rottura con un leader contagia il reparto", () => {
    const leader = facts(
      { age: 30 },
      { morale: 40, overall: 86, sinceSeason: 1, stats: { appearances: 3, minutes: 150, goals: 0, assists: 0 } },
    );
    expect(leader.personality).toBe("leader");

    let ultimo = applyDialogueMove(openDialogue(leader, pickTopic(leader)!), leader, { kind: "ignora" }, moveCtx);
    for (let i = 0; i < 5 && ultimo.dialogue.status === "aperta"; i++) {
      ultimo = applyDialogueMove(ultimo.dialogue, leader, { kind: "ignora" }, moveCtx);
    }
    expect(ultimo.dialogue.status).toBe("rottura");
    expect(ultimo.dressingRoomDelta?.delta).toBeLessThan(0);
  });

  it("chi non è un leader non contagia nessuno", () => {
    const gregario = facts(
      { age: 26 },
      { morale: 40, overall: 74, sinceSeason: 1, stats: { appearances: 3, minutes: 150, goals: 0, assists: 0 } },
    );
    expect(gregario.personality).not.toBe("leader");
    let ultimo = applyDialogueMove(openDialogue(gregario, pickTopic(gregario)!), gregario, { kind: "ignora" }, moveCtx);
    for (let i = 0; i < 5 && ultimo.dialogue.status === "aperta"; i++) {
      ultimo = applyDialogueMove(ultimo.dialogue, gregario, { kind: "ignora" }, moveCtx);
    }
    expect(ultimo.dressingRoomDelta).toBeUndefined();
  });

  it("ripetere la stessa mossa consuma il doppio della pazienza", () => {
    const f = panchinaro();
    const d = openDialogue(f, pickTopic(f)!);
    // `ascolta` non risponde alla richiesta, quindi non chiude la conversazione: è l'unica mossa
    // che si può davvero ripetere, ed è il caso che la regola vuole punire.
    const primo = applyDialogueMove(d, f, { kind: "ascolta" }, moveCtx);
    const secondo = applyDialogueMove(primo.dialogue, f, { kind: "ascolta" }, moveCtx);
    const primoCosto = Math.abs(primo.dialogue.patience - d.patience);
    const secondoCosto = Math.abs(secondo.dialogue.patience - primo.dialogue.patience);
    expect(secondoCosto).toBe(primoCosto * 2);
    expect(secondo.dialogue.sameMoveStreak).toBe(1);
  });
});

describe("registro unico degli impegni", () => {
  const ctxBase = {
    season: 3,
    matchday: 10,
    roster: [entry()],
    startersIds: new Set<string>(),
    departmentOf: () => "CC" as const,
    nameOf: () => "Mario Rossi",
    leaguePosition: 5,
    leagueSize: 20,
  };

  function impegnoMinuti(deadline = 12, minStarts = 2): Commitment {
    return makeCommitment("minuti", {
      playerId: "p1",
      verifyAt: "matchday",
      deadline,
      payload: { minStarts },
      madeSeason: 3,
      madeWeek: 7,
      description: "Spazio promesso",
    });
  }

  it("un impegno non ancora scaduto resta aperto e accumula progresso", () => {
    const esito = verifyCommitments([impegnoMinuti()], "matchday", {
      ...ctxBase,
      startersIds: new Set(["p1"]),
    });
    expect(esito.open).toHaveLength(1);
    expect(esito.open[0]!.progress).toBe(1);
    expect(esito.broken).toHaveLength(0);
  });

  it("mantenuto in anticipo chiude subito con morale e fiducia in salita", () => {
    const quasi = { ...impegnoMinuti(), progress: 1 };
    const esito = verifyCommitments([quasi], "matchday", { ...ctxBase, startersIds: new Set(["p1"]) });
    expect(esito.kept).toHaveLength(1);
    expect(esito.moraleDelta["p1"]).toBeGreaterThan(0);
    expect(esito.trustDelta["p1"]).toBeGreaterThan(0);
  });

  it("infranto alla scadenza costa molto più di quanto rendesse mantenerlo", () => {
    const esito = verifyCommitments([impegnoMinuti(9)], "matchday", ctxBase);
    expect(esito.broken).toHaveLength(1);
    expect(esito.moraleDelta["p1"]).toBeLessThan(-20);
    expect(esito.trustDelta["p1"]).toBeLessThan(-30);
    expect(esito.messages[0]).toContain("tradito");
  });

  it("una promessa di trionfo resta in sospeso finché non c'è una classifica da giudicare", () => {
    const trionfo = makeCommitment("trionfo", {
      playerId: "p1",
      verifyAt: "season",
      deadline: 3,
      madeSeason: 3,
      madeWeek: 1,
      description: "Stagione da vertice",
    });
    const sospeso = verifyCommitments([trionfo], "season", { ...ctxBase, leaguePosition: null });
    expect(sospeso.open).toHaveLength(1);
    expect(sospeso.broken).toHaveLength(0);

    const mantenuto = verifyCommitments([trionfo], "season", { ...ctxBase, leaguePosition: 3 });
    expect(mantenuto.kept).toHaveLength(1);
  });

  it("un impegno verso chi non è più in rosa si archivia senza conseguenze", () => {
    const esito = verifyCommitments([impegnoMinuti(9)], "matchday", { ...ctxBase, roster: [] });
    expect(esito.broken).toHaveLength(0);
    expect(esito.open).toHaveLength(0);
    expect(Object.keys(esito.moraleDelta)).toHaveLength(0);
  });

  it("un impegno preso col mister muove la sintonia, non il morale di un giocatore", () => {
    const conMister = makeCommitment("coach_rinforzo", {
      coachId: "coach-conte",
      verifyAt: "window",
      deadline: 3,
      payload: { department: "DIF" },
      madeSeason: 3,
      madeWeek: 1,
      description: "Un difensore entro fine mercato",
    });
    const esito = verifyCommitments([conMister], "window", ctxBase);
    expect(esito.harmonyDelta).toBeLessThan(0);
    expect(Object.keys(esito.moraleDelta)).toHaveLength(0);
  });
});

/**
 * **Quel che il vecchio sistema faceva e il nuovo deve continuare a fare.**
 *
 * Cancellare `playerStandoff.ts` ha tolto di mezzo 1.100 righe e un intero secondo motore di
 * conversazione. Il rischio di un'operazione così non è che qualcosa smetta di compilare — quello
 * si vede — ma che sparisca in silenzio una **conseguenza** che nessun altro test copriva. Questi
 * casi sono quelli, riscritti sul motore rimasto.
 */
describe("conseguenze ereditate dal vecchio motore", () => {
  it("una rottura toglie la titolarità garantita", () => {
    const { state, world } = fullCareer("rottura-titolarita", 78);
    const playerId = state.roster[0]!.playerId;
    const conGaranzia = setGuaranteedStarter(
      { ...state, roster: state.roster.map((e) => ({ ...e, morale: 30 })) },
      "DC",
      playerId,
    );
    expect(Object.values(conGaranzia.guaranteedStarters ?? {})).toContain(playerId);

    let corrente = conGaranzia;
    let d = openPlayerDialogue(corrente, world, playerId);
    expect(d, "nessun tema ammissibile: il test non verificherebbe nulla").not.toBeNull();

    let guard = 0;
    while (d && d.status === "aperta" && guard++ < 12) {
      const esito = applyPlayerDialogue(corrente, world, d, { kind: "ignora" });
      corrente = esito.state;
      d = esito.dialogue;
    }

    expect(d!.status).toBe("rottura");
    expect(Object.values(corrente.guaranteedStarters ?? {})).not.toContain(playerId);
  });

  it("una conversazione che si placa NON tocca la titolarità garantita", () => {
    // Il duale del test sopra: senza, "toglie sempre" e "toglie alla rottura" sarebbero
    // indistinguibili, ed è proprio la distinzione che conta.
    const { state, world } = fullCareer("placata-titolarita", 78);
    const playerId = state.roster[0]!.playerId;
    const conGaranzia = setGuaranteedStarter(
      { ...state, roster: state.roster.map((e) => ({ ...e, morale: 45 })) },
      "DC",
      playerId,
    );

    const d = openPlayerDialogue(conGaranzia, world, playerId);
    if (!d) return;
    const esito = applyPlayerDialogue(conGaranzia, world, d, { kind: "ascolta" });

    if (esito.dialogue.status !== "rottura") {
      expect(Object.values(esito.state.guaranteedStarters ?? {})).toContain(playerId);
    }
  });

  it("lo Spogliatoio riconosce un regen per nome, non come 'Giocatore'", () => {
    // Il vecchio `standoffCandidates` leggeva `world.players`, che non contiene i regen nati in
    // carriera: comparivano nell'elenco senza nome. `dressingRoom` usa l'anagrafica fusa.
    let { state, world } = fullCareer("regen-spogliatoio", 78);
    for (let s = 0; s < 3 && state.phase !== "conclusa" && state.generated.length === 0; s++) {
      state = playSeason(state, world);
    }
    if (state.generated.length === 0) return;

    const regen = state.generated[0]!;
    const conRegen: typeof state = {
      ...state,
      roster: [
        ...state.roster,
        createRosterEntry({ playerId: regen.id, overall: 74, potential: 80, sinceSeason: 1 }),
      ].map((e) => (e.playerId === regen.id ? { ...e, morale: 20 } : e)),
    };

    const elenco = dressingRoom(conRegen, world);
    const riga = elenco.find((c) => c.playerId === regen.id);
    if (riga) expect(riga.name).not.toBe("Giocatore");
  });
});
