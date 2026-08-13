/**
 * Contratti, finanze e Spogliatoio **dentro la carriera**.
 *
 * I moduli sono già coperti singolarmente; qui si verifica che stiano insieme: che il monte
 * ingaggi comprenda il mister, che lo slider sposti liquidità vera, che una scadenza non
 * rinnovata faccia perdere davvero il giocatore, e che la rosa non si svuoti per abbandono.
 */
import { describe, expect, it } from "vitest";
import {
  advanceWeek,
  coachContractSeasonsLeft,
  contractFor,
  createCareer,
  dressingRoom,
  expireContracts,
  financesOf,
  openPlayerDialogue,
  applyPlayerDialogue,
  releasePlayer,
  renewContract,
  renewalDemandOf,
  setWageShare,
  signCoachContract,
  wageBillOf,
  type CareerState,
  type CareerWorld,
} from "../ds/career";
import { MIN_SQUAD_SIZE } from "../ds/roster";
import { ROLE_DEPARTMENT, type Role } from "@app/shared-types";
import type { LeagueTeam } from "../season/leagueState";
import type { RosterEntry } from "../ds/types";

const RUOLI: Role[] = [
  "POR", "POR", "TD", "DC", "DC", "TS", "DC", "MED", "MED", "CC", "CC",
  "ED", "ES", "TRQ", "TQD", "TQS", "ATT", "ATT", "ATT", "CC", "DC", "TD",
];

function mondo(overall = 80): { state: CareerState; world: CareerWorld } {
  const players: CareerWorld["players"] = {};
  const roster: RosterEntry[] = [];

  RUOLI.forEach((role, i) => {
    const id = `p${i}`;
    players[id] = {
      id,
      name: `Giocatore ${i}`,
      nation: "Italia",
      role,
      secondaryRoles: [],
      department: ROLE_DEPARTMENT[role],
      birthDate: `${1995 + (i % 10)}-04-11`,
      overall: overall - (i % 7),
      potential: overall + 3,
    } as CareerWorld["players"][string];
    roster.push({
      playerId: id,
      overall: overall - (i % 7),
      potential: overall + 3,
      sinceSeason: 1,
      morale: 62,
      injuryMatchdaysLeft: 0,
      fatigue: 0,
      stats: { appearances: 0, minutes: 0, goals: 0, assists: 0 },
    });
  });

  const opponents: LeagueTeam[] = Array.from({ length: 19 }, (_, i) => ({
    id: `av-${i}`,
    name: `Avversaria ${i}`,
    rating: 74,
    strength: { attack: 74, defence: 74 },
  }));

  const world: CareerWorld = {
    players,
    opponents,
    clubName: "Il tuo club",
    leagueRounds: 38,
  } as CareerWorld;

  const state = createCareer({
    seed: "contratti",
    clubId: "mio",
    leagueId: "serie-a",
    coachId: "coach-conte",
    roster,
    budget: 60_000_000,
  });

  return { state, world };
}

describe("le due casse dentro la carriera", () => {
  it("il monte ingaggi comprende l'allenatore", () => {
    const { state, world } = mondo();
    const soloGiocatori = wageBillOf({ ...state, coachContract: undefined }, world);
    const conMister = wageBillOf(state, world);
    expect(state.coachContract).toBeDefined();
    expect(conMister - soloGiocatori).toBe(state.coachContract!.wage);
  });

  it("spostare la ripartizione muove davvero la liquidità di mercato", () => {
    const { state, world } = mondo();
    const prima = financesOf(state, world);
    const dopo = setWageShare(state, world, prima.wageShare + 0.1);
    expect(dopo.ok).toBe(true);
    expect(dopo.state.budget).toBeLessThan(state.budget);
    expect(financesOf(dopo.state, world).wageBudget).toBeGreaterThan(prima.wageBudget);
  });

  it("non si può definanziare ciò che è già firmato", () => {
    const { state, world } = mondo();
    const esito = setWageShare(state, world, 0.2);
    if (!esito.ok) {
      expect(esito.message).toBeTruthy();
    } else {
      // Se la quota minima basta a coprire gli impegni, il pavimento non è stato violato.
      expect(financesOf(esito.state, world).wageRoom).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("contratti in carriera", () => {
  it("ogni giocatore ha un contratto derivato, con durata fra 1 e 5 stagioni", () => {
    const { state, world } = mondo();
    for (const e of state.roster) {
      const c = contractFor(state, world, e.playerId)!;
      expect(c).not.toBeNull();
      expect(c.until).toBeGreaterThanOrEqual(1);
      expect(c.until).toBeLessThanOrEqual(5);
      expect(c.wage).toBeGreaterThan(0);
    }
  });

  it("un rinnovo accettato allunga il contratto e aggiorna il monte ingaggi", () => {
    const { state, world } = mondo();
    const id = state.roster[5]!.playerId;
    const terms = renewalDemandOf(state, world, id)!;

    const esito = renewContract(state, world, id, {
      wage: Math.round(terms.wage * 1.05),
      seasons: terms.seasons,
      guaranteedStarter: terms.wantsStarter,
      captain: terms.wantsCaptaincy,
    });

    expect(esito.ok).toBe(true);
    const dopo = contractFor(esito.state, world, id)!;
    expect(dopo.until).toBe(state.season + terms.seasons - 1);
    expect(wageBillOf(esito.state, world)).toBeGreaterThan(wageBillOf(state, world));
  });

  it("un'offerta al ribasso viene rifiutata, e il rifiuto resta segnato", () => {
    const { state, world } = mondo();
    const id = state.roster[3]!.playerId;
    const terms = renewalDemandOf(state, world, id)!;
    const esito = renewContract(state, world, id, {
      wage: Math.round(terms.wage * 0.3),
      seasons: 1,
    });
    expect(esito.ok).toBe(false);
    expect(esito.state.contracts?.renewalRefused).toContain(id);
  });

  it("chi va in scadenza e non viene rinnovato lascia il club a zero", () => {
    const { state, world } = mondo();
    const id = state.roster[0]!.playerId;
    // Contratto che scade a fine stagione corrente.
    const conScadenza: CareerState = {
      ...state,
      contracts: {
        overrides: { [id]: { until: state.season, wage: 1_000_000, signedSeason: 1 } },
        released: [],
        preContracts: [],
        renewalRefused: [],
      },
    };
    const esito = expireContracts(conScadenza, world);
    expect(esito.departed).toContain(id);
    expect(esito.messages.some((m) => m.includes("parametro zero"))).toBe(true);
  });

  it("nessuna rete di sicurezza: se scadono tutti, la rosa resta vuota", () => {
    const { state, world } = mondo();
    // Decisione esplicita dell'utente: la società **non** rinnova d'ufficio per salvare il DS.
    const overrides: Record<string, { until: number; wage: number; signedSeason: number }> = {};
    for (const e of state.roster) overrides[e.playerId] = { until: state.season, wage: 500_000, signedSeason: 1 };

    const esito = expireContracts(
      { ...state, contracts: { overrides, released: [], preContracts: [], renewalRefused: [] } },
      world,
    );
    expect(esito.state.roster).toHaveLength(0);
    expect(esito.messages.every((m) => !m.includes("d'ufficio"))).toBe(true);
  });

  it("chiudere il mercato senza undici giocatori costa la panchina: carriera finita", () => {
    const { state, world } = mondo();
    const rosaCorta: CareerState = {
      ...state,
      roster: state.roster.slice(0, MIN_SQUAD_SIZE - 1),
      market: {
        window: "estiva",
        offers: [],
        loanOffers: [],
        shortlist: [],
      } as unknown as NonNullable<CareerState["market"]>,
    };

    const { state: dopo, report } = advanceWeek(rosaCorta, world, { closeMarket: true });
    expect(dopo.phase).toBe("conclusa");
    expect(dopo.ending).toBe("esonero");
    expect(report.careerEnded).toBe(true);
    expect(report.messages.join(" ")).toContain("solleva dall'incarico");
  });

  it("svincolare un giocatore lo toglie dalla rosa e costa una buonuscita", () => {
    const { state, world } = mondo();
    const id = state.roster[10]!.playerId;
    const esito = releasePlayer(state, world, id);
    expect(esito.ok).toBe(true);
    expect(esito.state.roster.some((e) => e.playerId === id)).toBe(false);
    expect(esito.state.contracts?.released).toContain(id);
    expect(esito.state.budget).toBeLessThanOrEqual(state.budget);
  });
});

describe("contratto dell'allenatore", () => {
  it("nasce con la carriera e ha una durata in stagioni", () => {
    const { state } = mondo();
    expect(coachContractSeasonsLeft(state)).toBeGreaterThan(0);
  });

  it("a contratto scaduto e non rinnovato lascia davvero la panchina", () => {
    /**
     * Il difetto che questo test blocca: `expireContracts` scriveva *"va rinnovato o lascia la
     * panchina"* e non faceva nessuna delle due cose. Il mister restava in carica col contratto
     * scaduto, il suo ingaggio continuava a pesare sul monte e la buonuscita valeva zero — cioè
     * cambiarlo diventava **gratis** proprio quando non doveva.
     */
    const { state, world } = mondo();
    const scaduto: CareerState = {
      ...state,
      // Contratto finito con la stagione precedente: siamo oltre.
      coachContract: { ...state.coachContract!, until: state.season - 1 },
    };

    const esito = expireContracts(scaduto, world);

    expect(esito.state.coachId).toBeNull();
    expect(esito.state.coachContract).toBeUndefined();
    expect(esito.messages.join(" ")).toMatch(/lascia la panchina/i);
    // Senza mister il monte ingaggi perde il suo stipendio: è la conseguenza economica.
    expect(wageBillOf(esito.state, world)).toBeLessThan(wageBillOf(scaduto, world));
  });

  it("all'ultima stagione di contratto il meeting si riapre, ma il mister resta", () => {
    // La distinzione conta: a una stagione dalla fine si negozia il rinnovo (è *una delle sue
    // richieste*); a scadenza consumata non c'è più nulla da negoziare.
    const { state, world } = mondo();
    const ultimaStagione: CareerState = {
      ...state,
      coachContract: { ...state.coachContract!, until: state.season },
    };

    const esito = expireContracts(ultimaStagione, world);

    expect(esito.state.coachId).toBe(state.coachId);
    expect(esito.state.seasonNegotiationDone).toBe(false);
    expect(esito.messages.join(" ")).toMatch(/va rinnovato/i);
  });

  it("un contratto più lungo costa meno all'anno ma pesa di più sul totale", () => {
    const { state, world } = mondo();
    const corto = signCoachContract(state, world, "coach-gasperini", 1);
    const lungo = signCoachContract(state, world, "coach-gasperini", 4);
    expect(corto.ok && lungo.ok).toBe(true);
    expect(lungo.state.coachContract!.wage).toBeLessThan(corto.state.coachContract!.wage);
    expect(lungo.state.coachContract!.until).toBeGreaterThan(corto.state.coachContract!.until);
  });

  it("lo stipendio del nuovo mister entra nel monte ingaggi", () => {
    const { state, world } = mondo();
    const esito = signCoachContract(state, world, "coach-guardiola", 3);
    if (esito.ok) {
      expect(wageBillOf(esito.state, world)).toBeGreaterThan(wageBillOf(state, world));
    } else {
      // Rifiutato perché il monte non lo regge: è esattamente il vincolo che vogliamo esista.
      expect(esito.message).toContain("monte ingaggi");
    }
  });
});

describe("lo Spogliatoio dentro la carriera", () => {
  it("a inizio stagione si parla solo di contratti, mai di minutaggio", () => {
    /**
     * Prima dei contratti, a bocce ferme lo spogliatoio era muto. Ora può non esserlo — chi è
     * all'ultimo anno vuole sapere il suo futuro fin da agosto, ed è giusto così. Ciò che **non**
     * deve mai comparire prima che si giochi una partita è un discorso sul minutaggio: nessuno
     * può lamentarsi di non giocare alla prima giornata.
     */
    const { state, world } = mondo();
    const temi = dressingRoom(state, world).map((e) => e.topicId);
    expect(temi).not.toContain("poco_impiego");
    expect(temi).not.toContain("gerarchia_persa");
    expect(temi).not.toContain("giovane_crescita");
    expect(temi).not.toContain("sovraccarico");
    for (const t of temi) {
      expect(["ultimo_anno", "rinnovo_richiesto", "veterano_ultimo_contratto", "leadership"]).toContain(t);
    }
  });

  it("chi non gioca dopo qualche giornata compare, e la conversazione parte dal suo caso", () => {
    let { state, world } = mondo();
    for (let i = 0; i < 12 && !state.market; i++) {
      state = advanceWeek(state, world, { closeMarket: true }).state;
    }

    const elenco = dressingRoom(state, world);
    expect(elenco.length).toBeGreaterThan(0);

    const primo = elenco[0]!;
    const dialogo = openPlayerDialogue(state, world, primo.playerId)!;
    expect(dialogo).not.toBeNull();
    expect(dialogo.log[0]!.speaker).toBe("giocatore");
    expect(dialogo.highlights.length).toBeGreaterThan(0);
  });

  it("una mossa della chat cambia lo stato della carriera, non solo il testo", () => {
    let { state, world } = mondo();
    for (let i = 0; i < 12 && !state.market; i++) {
      state = advanceWeek(state, world, { closeMarket: true }).state;
    }
    const elenco = dressingRoom(state, world);
    const bersaglio = elenco.find((e) => e.topicId === "poco_impiego");
    if (!bersaglio) return; // in questo seme può non esserci: il duale è coperto altrove

    const dialogo = openPlayerDialogue(state, world, bersaglio.playerId)!;
    const prima = state.roster.find((e) => e.playerId === bersaglio.playerId)!.morale;
    const esito = applyPlayerDialogue(state, world, dialogo, { kind: "prometti_rotazione" });

    const dopo = esito.state.roster.find((e) => e.playerId === bersaglio.playerId)!.morale;
    expect(dopo).toBeGreaterThan(prima);
    expect((esito.state.commitments ?? []).some((c) => c.playerId === bersaglio.playerId)).toBe(true);
  });

  /**
   * **Il difetto segnalato dall'utente**: si affrontava un caso, si chiudeva la conversazione, e
   * il giocatore restava nell'elenco. La ragione è che i fatti non cambiano premendo "chiudi" —
   * un morale basso resta basso — quindi il tema tornava ammissibile all'istante.
   */
  it("chi ha appena parlato esce dall'elenco: di quell'argomento si è già discusso", () => {
    let { state, world } = mondo();
    for (let i = 0; i < 12 && !state.market; i++) {
      state = advanceWeek(state, world, { closeMarket: true }).state;
    }

    const elenco = dressingRoom(state, world);
    const primo = elenco[0];
    if (!primo) return; // nessun caso aperto in questo seme: l'invariante non ha nulla da dire

    // "Ignora" non chiude al primo colpo: consuma pazienza, e la rottura arriva quando finisce.
    let dialogo = openPlayerDialogue(state, world, primo.playerId)!;
    let corrente = state;
    for (let i = 0; i < 12 && dialogo.status === "aperta"; i++) {
      const passo = applyPlayerDialogue(corrente, world, dialogo, { kind: "ignora" });
      corrente = passo.state;
      dialogo = passo.dialogue;
    }
    expect(dialogo.status).not.toBe("aperta");

    const dopo = dressingRoom(corrente, world);
    expect(dopo.some((e) => e.playerId === primo.playerId && e.topicId === primo.topicId)).toBe(false);
  });

  /**
   * L'altra metà della stessa segnalazione: quattordici richieste di cessione a gennaio. In una
   * rosa da venticinque, metà squadra gioca meno del 30% dei minuti — è la normalità, non una
   * pratica da aprire. Il tetto ai casi ordinari è la regola di prodotto che lo dice.
   */
  it("l'elenco non diventa mai un ufficio reclami, nemmeno a metà stagione", () => {
    let { state, world } = mondo();
    for (let i = 0; i < 30; i++) {
      state = advanceWeek(state, world, { closeMarket: true }).state;
    }
    const ordinari = dressingRoom(state, world).filter((e) => !e.blocking);
    expect(ordinari.length).toBeLessThanOrEqual(4);
  });
});
