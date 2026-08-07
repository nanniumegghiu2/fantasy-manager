/**
 * Il faccia a faccia col giocatore: una barra di pazienza che porta o alla riappacificazione o
 * alla rottura totale, sullo stesso principio delle trattative di mercato (`negotiation.ts`).
 */
import { describe, expect, it } from "vitest";
import {
  applyStandoffMove,
  openStandoff,
  relevantMoves,
  verifyPlayerPromises,
  type PlayerStandoff,
  type StandoffReason,
} from "../ds/playerStandoff";
import { createRosterEntry } from "../ds/roster";

function entryWith(morale: number) {
  return { ...createRosterEntry({ playerId: "p1", overall: 78, potential: 80, sinceSeason: 1 }), morale };
}

describe("apertura del faccia a faccia", () => {
  it("la pazienza di partenza segue il morale, entro un margine ragionevole", () => {
    const basso = openStandoff(entryWith(30), "Scontento", "scontento");
    const alto = openStandoff(entryWith(70), "Sereno", "scontento");
    expect(basso.patience).toBeLessThan(alto.patience);
    expect(basso.patience).toBeGreaterThanOrEqual(25); // mai a zero: c'è sempre un margine
  });

  it("un'offerta collegata compare nello stato", () => {
    const s = openStandoff(entryWith(40), "X", "richiamato", { clubId: "c1", clubName: "Club" });
    expect(s.offerFromClubId).toBe("c1");
  });
});

describe("relevantMoves — mosse pertinenti al motivo reale", () => {
  it("ignora è sempre disponibile in ogni conversazione", () => {
    for (const reason of ["vuole_giocare", "scontento", "richiamato", "tradito"] as StandoffReason[]) {
      expect(relevantMoves(reason)).toContain("ignora");
    }
  });

  it("'vuole_giocare' esclude premio in denaro e promesse di gloria: il problema è il minutaggio", () => {
    const mosse = relevantMoves("vuole_giocare");
    expect(mosse).toContain("prometti_spazio");
    expect(mosse).not.toContain("premio_denaro");
    expect(mosse).not.toContain("promessa_trionfo");
    expect(mosse).not.toContain("promessa_rinforzi");
  });

  it("'tradito' esclude ogni nuova promessa: chi ha già subito un tradimento non si fida di parole", () => {
    const mosse = relevantMoves("tradito");
    expect(mosse).not.toContain("prometti_spazio");
    expect(mosse).not.toContain("promessa_rinforzi");
    expect(mosse).not.toContain("promessa_trionfo");
    // Servono fatti immediati.
    expect(mosse).toContain("premio_denaro");
  });

  it("'richiamato' richiede argomenti pesanti: niente 'rassicura' a parole vuote", () => {
    const mosse = relevantMoves("richiamato");
    expect(mosse).not.toContain("rassicura");
    expect(mosse).toContain("accetta_cessione");
  });

  it("'scontento' ammette ogni tipo di argomento: il problema non è circoscritto", () => {
    const mosse = relevantMoves("scontento");
    expect(mosse).toEqual(
      expect.arrayContaining(["rassicura", "premio_denaro", "promessa_rinforzi", "promessa_trionfo", "lista_cessione"]),
    );
  });
});

describe("mosse: riappacificazione o rottura", () => {
  it("rassicurare/promettere spazio ripetutamente porta a una chiusura placata", () => {
    let s: PlayerStandoff = openStandoff(entryWith(40), "X", "scontento");
    let ultimoEsito;
    for (let i = 0; i < 6 && s.status === "aperta"; i++) {
      ultimoEsito = applyStandoffMove(s, { kind: "prometti_spazio" });
      s = ultimoEsito.standoff;
    }
    expect(s.status).toBe("placata");
    expect(ultimoEsito!.moraleDelta).toBeGreaterThan(0);
  });

  it("ignorare ripetutamente porta a una rottura, con un tonfo di morale", () => {
    let s: PlayerStandoff = openStandoff(entryWith(40), "X", "scontento");
    let ultimoEsito;
    for (let i = 0; i < 6 && s.status === "aperta"; i++) {
      ultimoEsito = applyStandoffMove(s, { kind: "ignora" });
      s = ultimoEsito.standoff;
    }
    expect(s.status).toBe("rotta");
    expect(ultimoEsito!.moraleDelta).toBeLessThanOrEqual(-18);
  });

  it("accettare la cessione richiede un'offerta collegata", () => {
    const senzaOfferta = openStandoff(entryWith(40), "X", "scontento");
    const esito = applyStandoffMove(senzaOfferta, { kind: "accetta_cessione" });
    expect(esito.standoff.status).toBe("aperta"); // nessun effetto, non può chiudersi così
    expect(esito.sellNow).toBeUndefined();

    const conOfferta = openStandoff(entryWith(40), "X", "richiamato", { clubId: "c1", clubName: "Club" });
    const esito2 = applyStandoffMove(conOfferta, { kind: "accetta_cessione" });
    expect(esito2.sellNow).toBe(true);
    expect(esito2.standoff.status).toBe("placata");
  });

  it("promettere spazio marca il segnale per la promessa di titolarità", () => {
    const s = openStandoff(entryWith(40), "X", "vuole_giocare");
    const esito = applyStandoffMove(s, { kind: "prometti_spazio" });
    expect(esito.promiseMinutes).toBe(true);
  });

  it("mettere in lista trasferimenti marca il segnale corrispondente", () => {
    const s = openStandoff(entryWith(40), "X", "scontento");
    const esito = applyStandoffMove(s, { kind: "lista_cessione" });
    expect(esito.listForTransfer).toBe(true);
  });

  it("una trattativa già chiusa non produce più effetti", () => {
    let s = openStandoff(entryWith(90), "X", "scontento"); // pazienza alta, chiude presto
    let esito = applyStandoffMove(s, { kind: "lista_cessione" });
    s = esito.standoff;
    // Se non si è ancora chiusa al primo colpo, forziamola con più mosse.
    let guard = 0;
    while (s.status === "aperta" && guard++ < 10) {
      esito = applyStandoffMove(s, { kind: "lista_cessione" });
      s = esito.standoff;
    }
    expect(s.status).not.toBe("aperta");
    const dopoChiusura = applyStandoffMove(s, { kind: "ignora" });
    expect(dopoChiusura.moraleDelta).toBe(0);
    expect(dopoChiusura.standoff).toBe(s);
  });

  it("un premio in denaro è immediato: nessuna promessa da mantenere in futuro", () => {
    const s = openStandoff(entryWith(40), "X", "scontento");
    const esito = applyStandoffMove(s, { kind: "premio_denaro" });
    expect(esito.moneyBonus).toBe(true);
    expect(esito.promise).toBeUndefined();
    expect(esito.moraleDelta).toBeGreaterThan(0);
  });

  it("promettere un rinforzo o un trionfo registra una promessa da verificare in futuro", () => {
    const s1 = openStandoff(entryWith(40), "X", "scontento");
    const esitoRinforzi = applyStandoffMove(s1, { kind: "promessa_rinforzi", department: "ATT" });
    expect(esitoRinforzi.promise).toEqual({ kind: "rinforzi", department: "ATT" });

    const s2 = openStandoff(entryWith(40), "X", "scontento");
    const esitoTrionfo = applyStandoffMove(s2, { kind: "promessa_trionfo" });
    expect(esitoTrionfo.promise).toEqual({ kind: "trionfo" });
  });
});

describe("un vero botta e risposta, non lo stesso bottone premuto finché la barra non arriva a zero", () => {
  it("ripetere di fila la stessa mossa consuma più pazienza della prima volta", () => {
    const s = openStandoff(entryWith(90), "X", "scontento");
    const primoGiro = applyStandoffMove(s, { kind: "rassicura" });
    const secondoGiro = applyStandoffMove(primoGiro.standoff, { kind: "rassicura" });
    const perditaPrimoGiro = s.patience - primoGiro.standoff.patience;
    const perditaSecondoGiro = primoGiro.standoff.patience - secondoGiro.standoff.patience;
    expect(perditaSecondoGiro).toBeGreaterThanOrEqual(perditaPrimoGiro * 2 - 1); // raddoppiata (a meno del clamp a 0)
  });

  it("alternare mosse diverse non subisce la penalità della ripetizione", () => {
    const s = openStandoff(entryWith(90), "X", "scontento");
    const primoGiro = applyStandoffMove(s, { kind: "rassicura" });
    const secondoGiro = applyStandoffMove(primoGiro.standoff, { kind: "premio_denaro" });
    // premio_denaro da solo perde 28: se non fosse raddoppiato, la perdita resta 28.
    expect(primoGiro.standoff.patience - secondoGiro.standoff.patience).toBe(28);
  });

  it("sameMoveStreak conta le ripetizioni consecutive e si azzera cambiando mossa", () => {
    const s0 = openStandoff(entryWith(95), "X", "scontento");
    const s1 = applyStandoffMove(s0, { kind: "rassicura" }).standoff;
    expect(s1.sameMoveStreak).toBe(0);
    const s2 = applyStandoffMove(s1, { kind: "rassicura" }).standoff;
    expect(s2.sameMoveStreak).toBe(1);
    const s3 = applyStandoffMove(s2, { kind: "premio_denaro" }).standoff;
    expect(s3.sameMoveStreak).toBe(0);
  });

  it("il testo del secondo scambio è diverso da quello di apertura, a parità di mossa", () => {
    const s0 = openStandoff(entryWith(95), "X", "scontento");
    const s1 = applyStandoffMove(s0, { kind: "rassicura" }).standoff;
    const primaRisposta = s1.log[s1.log.length - 1]!.text;
    const s2 = applyStandoffMove(s1, { kind: "premio_denaro" }).standoff;
    const secondaRisposta = s2.log[s2.log.length - 1]!.text;
    expect(secondaRisposta).not.toBe(primaRisposta);
  });

  it("ripetere la stessa mossa produce una battuta di rimprovero dedicata", () => {
    const s0 = openStandoff(entryWith(95), "X", "scontento");
    const s1 = applyStandoffMove(s0, { kind: "prometti_spazio" }).standoff;
    const s2 = applyStandoffMove(s1, { kind: "prometti_spazio" }).standoff;
    const rispostaRipetuta = s2.log[s2.log.length - 1]!.text;
    // Diversa sia dalla risposta di apertura sia da quella "a metà" che avrebbe avuto una
    // mossa nuova nello stesso punto della conversazione.
    expect(rispostaRipetuta).toContain("promessa");
  });

  it("un premio in denaro pesa meno sulla pazienza per chi è già corteggiato da una big", () => {
    const scontento = openStandoff(entryWith(90), "X", "scontento");
    const richiamato = openStandoff(entryWith(90), "X", "richiamato", { clubId: "c1", clubName: "Club" });
    const esitoScontento = applyStandoffMove(scontento, { kind: "premio_denaro" });
    const esitoRichiamato = applyStandoffMove(richiamato, { kind: "premio_denaro" });
    const perditaScontento = scontento.patience - esitoScontento.standoff.patience;
    const perditaRichiamato = richiamato.patience - esitoRichiamato.standoff.patience;
    expect(perditaRichiamato).toBeLessThan(perditaScontento);
  });
});

describe("reazione a una fiducia già tradita", () => {
  it("chi ha già subito una promessa infranta parte con pochissima pazienza", () => {
    const normale = openStandoff(entryWith(60), "X", "scontento");
    const tradito = openStandoff(entryWith(60), "X", "tradito");
    expect(tradito.patience).toBeLessThan(normale.patience);
    expect(tradito.patience).toBeLessThanOrEqual(20);
  });
});

describe("verifica delle promesse a fine mercato", () => {
  const players = {
    p1: { name: "Titolare", department: "ATT" as const },
  };

  it("una promessa di rinforzo mantenuta alza il morale e si estingue", () => {
    const roster = [
      { ...createRosterEntry({ playerId: "p1", overall: 78, potential: 80, sinceSeason: 1 }) },
      { ...createRosterEntry({ playerId: "p2", overall: 74, potential: 76, sinceSeason: 3 }) },
    ];
    const playersFull = { ...players, p2: { name: "Nuovo arrivo", department: "ATT" as const } };
    const res = verifyPlayerPromises(
      { p1: { kind: "rinforzi", department: "ATT", madeSeason: 3 } },
      roster,
      playersFull,
      3,
      null,
      20,
    );
    expect(res.moraleDelta.p1).toBeGreaterThan(0);
    expect(res.newlyBroken).toHaveLength(0);
    expect(res.updatedPromises.p1).toBeUndefined();
  });

  it("una promessa di rinforzo non mantenuta rompe la fiducia", () => {
    const roster = [{ ...createRosterEntry({ playerId: "p1", overall: 78, potential: 80, sinceSeason: 1 }) }];
    const res = verifyPlayerPromises(
      { p1: { kind: "rinforzi", department: "DIF", madeSeason: 3 } },
      roster,
      players,
      3,
      null,
      20,
    );
    expect(res.moraleDelta.p1).toBeLessThan(0);
    expect(res.newlyBroken).toEqual(["p1"]);
  });

  it("una promessa di trionfo resta in sospeso finché la stagione non è iniziata", () => {
    const roster = [{ ...createRosterEntry({ playerId: "p1", overall: 78, potential: 80, sinceSeason: 1 }) }];
    const res = verifyPlayerPromises(
      { p1: { kind: "trionfo", madeSeason: 3 } },
      roster,
      players,
      3,
      null,
      20,
    );
    expect(res.moraleDelta.p1).toBeUndefined();
    expect(res.updatedPromises.p1).toEqual({ kind: "trionfo", madeSeason: 3 });
  });

  it("una promessa di trionfo si giudica sulla posizione in classifica", () => {
    const roster = [{ ...createRosterEntry({ playerId: "p1", overall: 78, potential: 80, sinceSeason: 1 }) }];
    const alta = verifyPlayerPromises({ p1: { kind: "trionfo", madeSeason: 3 } }, roster, players, 3, 2, 20);
    expect(alta.moraleDelta.p1).toBeGreaterThan(0);

    const bassa = verifyPlayerPromises({ p1: { kind: "trionfo", madeSeason: 3 } }, roster, players, 3, 18, 20);
    expect(bassa.moraleDelta.p1).toBeLessThan(0);
    expect(bassa.newlyBroken).toEqual(["p1"]);
  });

  it("un giocatore ceduto non genera più verifiche", () => {
    const res = verifyPlayerPromises({ p1: { kind: "trionfo", madeSeason: 3 } }, [], players, 3, 5, 20);
    expect(res.moraleDelta).toEqual({});
    expect(res.newlyBroken).toEqual([]);
  });
});

describe("bivio giocatore-mister — una scelta secca, non negoziabile", () => {
  it("'bivio_mister' offre solo le due scelte nette più ignora", () => {
    expect(relevantMoves("bivio_mister")).toEqual(["scegli_giocatore", "scegli_mister", "ignora"]);
  });

  it("apre con pazienza già bassa, come 'tradito'", () => {
    const s = openStandoff(entryWith(70), "X", "bivio_mister");
    expect(s.patience).toBeLessThanOrEqual(20);
  });

  it("'scegli_giocatore' placa la conversazione e fa dimettere il mister", () => {
    const s = openStandoff(entryWith(40), "X", "bivio_mister");
    const res = applyStandoffMove(s, { kind: "scegli_giocatore" });
    expect(res.standoff.status).toBe("placata");
    expect(res.moraleDelta).toBeGreaterThan(0);
    expect(res.coachResigns).toBe(true);
    expect(res.coachBenches).toBeUndefined();
  });

  it("'scegli_mister' rompe subito il rapporto col giocatore, nessuna dimissione", () => {
    const s = openStandoff(entryWith(40), "X", "bivio_mister");
    const res = applyStandoffMove(s, { kind: "scegli_mister" });
    expect(res.standoff.status).toBe("rotta");
    expect(res.moraleDelta).toBeLessThan(0);
    expect(res.coachResigns).toBeUndefined();
  });

  it("ignorare fino alla rottura mette il giocatore in panchina permanente", () => {
    let s = openStandoff(entryWith(15), "X", "bivio_mister");
    let res = applyStandoffMove(s, { kind: "ignora" });
    // Con pazienza di partenza bassissima, ignorare una volta può già rompere; se non basta,
    // insistiamo finché non si rompe (patience scende sempre con "ignora").
    let tentativi = 0;
    while (res.standoff.status === "aperta" && tentativi < 10) {
      res = applyStandoffMove(res.standoff, { kind: "ignora" });
      tentativi += 1;
    }
    expect(res.standoff.status).toBe("rotta");
    expect(res.coachBenches).toBe(true);
  });

  it("rompersi per una mossa diversa da 'ignora' non manda in panchina il giocatore", () => {
    const s = openStandoff(entryWith(40), "X", "bivio_mister");
    const res = applyStandoffMove(s, { kind: "scegli_mister" });
    expect(res.standoff.status).toBe("rotta");
    expect(res.coachBenches).toBeUndefined();
  });
});
