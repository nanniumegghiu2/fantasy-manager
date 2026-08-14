/**
 * Il mercato dei parametri zero.
 *
 * I due test che contano: **carriere diverse hanno svincolati diversi** (regola di prodotto
 * dichiarata dall'utente) e **una piccola può battere una grande** offrendo il campo invece dei
 * soldi — che è il motivo per cui questo mercato esiste.
 */
import { describe, expect, it } from "vitest";
import { ROLE_DEPARTMENT, type Role } from "@app/shared-types";
import {
  DECAY_PER_WINDOW,
  FREE_AGENT_MIN_OVERALL,
  MAX_DECAY,
  buildFreeAgentPool,
  aiClaimsFreeAgent,
  clubWouldRenew,
  freeAgentBidScore,
  resolveFreeAgentBids,
  rivalBidsFor,
  type FreeAgent,
  type FreeAgentBid,
} from "../ds/freeAgents";
import type { WorldPlayer } from "../ds/aiWorld";

const RUOLI: Role[] = ["POR", "DC", "TD", "MED", "CC", "ED", "TRQ", "ATT"];

function mondo(n = 400): WorldPlayer[] {
  return Array.from({ length: n }, (_, i) => {
    const role = RUOLI[i % RUOLI.length]!;
    const eta = 20 + (i % 15);
    return {
      id: `w-${i}`,
      name: `Giocatore ${i}`,
      nation: "Italia",
      role,
      secondaryRoles: [],
      department: ROLE_DEPARTMENT[role],
      birthDate: `${2025 - eta}-05-10`,
      overall: 66 + (i % 22),
      clubId: `club-${i % 20}`,
    } satisfies WorldPlayer;
  });
}

describe("il pool degli svincolati", () => {
  const players = mondo();

  it("carriere diverse producono svincolati diversi", () => {
    const nomi = (seed: string) =>
      new Set(buildFreeAgentPool({ worldPlayers: players, seed, season: 3, regenCount: 0 }).map((a) => a.id));

    const a = nomi("carriera-alfa");
    const b = nomi("carriera-beta");
    expect(a.size).toBeGreaterThan(5);
    expect(b.size).toBeGreaterThan(5);

    const comuni = [...a].filter((id) => b.has(id)).length;
    expect(comuni / Math.max(a.size, b.size)).toBeLessThan(0.8);
  });

  /**
   * **Gli svincoli non sono fissi: cambiano da carriera a carriera** (richiesta dell'utente).
   *
   * La proprietà nasce da **due** derivazioni indipendenti, entrambe legate al seme di carriera:
   * *quando* scade un contratto (`contractExpiryOf`) e *se il club rinnova* (`clubWouldRenew`).
   * La seconda è quella nuova, e va verificata a parte: se un giorno qualcuno la rendesse
   * deterministica sul solo giocatore — sembra innocuo — il mercato tornerebbe a proporre gli
   * stessi nomi in ogni partita, e il primo test qui sopra continuerebbe a passare grazie alle
   * sole scadenze.
   */
  it("il rinnovo dei club è deciso dal seme: due carriere lasciano liberi giocatori diversi", () => {
    const giovani = mondoGiovane(200);
    const liberi = (seed: string) =>
      new Set(giovani.filter((p) => !clubWouldRenew(p, seed, 5)).map((p) => p.id));

    const alfa = liberi("carriera-alfa");
    const beta = liberi("carriera-beta");
    expect(alfa.size).toBeGreaterThan(10);

    const comuni = [...alfa].filter((id) => beta.has(id)).length;
    expect(comuni / Math.max(alfa.size, beta.size)).toBeLessThan(0.6);
  });

  it("e cambiano anche di stagione in stagione, dentro la stessa carriera", () => {
    // Un club che non rinnova quest'anno può rinnovare l'anno prossimo: la vetrina si rinnova
    // invece di essere la stessa lista che invecchia.
    const giovani = mondoGiovane(200);
    const liberi = (season: number) =>
      new Set(giovani.filter((p) => !clubWouldRenew(p, "stessa-carriera", season)).map((p) => p.id));

    const quinta = liberi(5);
    const sesta = liberi(6);
    const comuni = [...quinta].filter((id) => sesta.has(id)).length;
    expect(comuni / Math.max(quinta.size, sesta.size)).toBeLessThan(0.7);
  });

  /**
   * ⚠️ **La segnalazione principale dell'utente**: *"col passare delle stagioni si trovano nella
   * lista svincolati tutti i più forti giocatori del gioco"*.
   *
   * La causa non era una soglia ma un'assenza: le scadenze si derivano dal seme per tutti i
   * giocatori del mondo, e **nessun club IA rinnovava mai**. Ogni contratto scaduto finiva sul
   * mercato e non ne usciva più, quindi il pool cresceva monotonicamente fino a contenere mezzo
   * database. `clubWouldRenew` è la regola che mancava.
   *
   * I due casi qui sotto misurano le due proprietà che rendono la vetrina plausibile: **non
   * esplode** col passare delle stagioni, e **non è fatta di fuoriclasse**.
   */
  /**
   * ⚠️ **Fixture apposita, e la ragione va detta**: il mondo di prova sopra ha giocatori di 20-34
   * anni, che alla decima stagione sono in gran parte **ritirati** — il pool resta piccolo da
   * solo, e un test scritto su quel mondo passa anche togliendo la regola. Verificato
   * disattivando `clubWouldRenew`: 766 verdi lo stesso, cioè non misurava nulla.
   *
   * Qui i giocatori sono giovani abbastanza da essere ancora in attività alla stagione 8, così
   * l'unica cosa che può tenere piccola la vetrina è il rinnovo dei club.
   */
  function mondoGiovane(n = 300): WorldPlayer[] {
    return Array.from({ length: n }, (_, i) => {
      const role = RUOLI[i % RUOLI.length]!;
      const eta = 20 + (i % 6); // 20-25: alla stagione 8 hanno 27-32, nessuno ritirato
      return {
        id: `g-${i}`,
        name: `Giovane ${i}`,
        nation: "Italia",
        role,
        secondaryRoles: [],
        department: ROLE_DEPARTMENT[role],
        birthDate: `${2025 - eta}-05-10`,
        overall: 70 + (i % 20),
        clubId: `club-${i % 20}`,
      } satisfies WorldPlayer;
    });
  }

  it("la vetrina non esplode col passare delle stagioni", () => {
    const giovani = mondoGiovane();
    const pool = buildFreeAgentPool({
      worldPlayers: giovani,
      seed: "accumulo",
      season: 8,
      regenCount: 0,
    });

    // Senza rinnovi il pool conterrebbe **quasi tutti** i contratti scaduti almeno una volta,
    // cioè la stragrande maggioranza del mondo.
    expect(pool.length).toBeLessThan(giovani.length * 0.35);
  });

  it("i fuoriclasse restano un'eccezione, non l'ordinaria amministrazione", () => {
    const giovani = mondoGiovane();
    const pool = buildFreeAgentPool({
      worldPlayers: giovani,
      seed: "fuoriclasse",
      season: 8,
      regenCount: 0,
    });
    expect(pool.length).toBeGreaterThan(5);

    const top = pool.filter((a) => a.overall >= 84).length;
    expect(top / pool.length).toBeLessThan(0.15);
  });

  /**
   * **Il mondo si muove anche senza di noi** (richiesta dell'utente).
   *
   * Prima `freeAgentsSigned` registrava soltanto le *nostre* firme: nessuno usciva mai dalla
   * vetrina se non per mano nostra, e un ottimo parametro zero poteva restare lì per stagioni.
   * Le offerte rivali esistevano solo *mentre* trattavamo, cioè erano una resistenza al momento
   * della firma e non un mercato che si muove da sé.
   */
  it("i club IA firmano anche loro: la vetrina si consuma fra una finestra e l'altra", () => {
    const giovani = mondoGiovane(300);
    const estate = buildFreeAgentPool({
      worldPlayers: giovani,
      seed: "mondo-vivo",
      season: 6,
      regenCount: 0,
    });
    const inverno = buildFreeAgentPool({
      worldPlayers: giovani,
      seed: "mondo-vivo",
      season: 6,
      winter: true,
      regenCount: 0,
    });

    expect(estate.length).toBeGreaterThan(5);
    const rimasti = new Set(inverno.map((a) => a.id));
    const spariti = estate.filter((a) => !rimasti.has(a.id)).length;
    expect(spariti, "nessuno è stato firmato dall'IA: la vetrina è un negozio sempre aperto").toBeGreaterThan(0);
  });

  it("e chi è forte sparisce più in fretta di chi è mediocre", () => {
    // È la regola che rende sensato arrivare presto: se sparissero tutti allo stesso ritmo,
    // aspettare non costerebbe nulla.
    const libero = (id: string, overall: number): FreeAgent => ({
      id,
      name: id,
      nation: "Italia",
      role: "CC",
      secondaryRoles: [],
      department: "CC",
      birthDate: "1998-01-01",
      age: 27,
      overall,
      baseOverall: overall,
      origin: "scaduto",
      windowsFree: 1,
      nextDecay: 1,
      personality: "professionista",
      askingWage: 1_000_000,
      askingSeasons: 3,
      wantsStarter: false,
      suitors: 0,
    });

    const quanti = (a: FreeAgent) => {
      let n = 0;
      for (let s = 1; s <= 60; s++) if (aiClaimsFreeAgent(a, `seme-${s}`, s, false)) n++;
      return n;
    };
    expect(quanti(libero("top", 85))).toBeGreaterThan(quanti(libero("mid", 68)));
  });

  it("è stabile a parità di seme: ricaricare una carriera non cambia la vetrina", () => {
    const uno = buildFreeAgentPool({ worldPlayers: players, seed: "stabile", season: 4, regenCount: 3 });
    const due = buildFreeAgentPool({ worldPlayers: players, seed: "stabile", season: 4, regenCount: 3 });
    expect(uno.map((a) => a.id)).toEqual(due.map((a) => a.id));
    expect(uno.map((a) => a.askingWage)).toEqual(due.map((a) => a.askingWage));
  });

  it("chi ha firmato altrove sparisce, chi è stato svincolato compare subito", () => {
    const base = buildFreeAgentPool({ worldPlayers: players, seed: "s", season: 3, regenCount: 0 });
    expect(base.length).toBeGreaterThan(0);

    const primo = base[0]!.id;
    const dopoFirma = buildFreeAgentPool({
      worldPlayers: players,
      seed: "s",
      season: 3,
      regenCount: 0,
      signed: new Set([primo]),
    });
    expect(dopoFirma.some((a) => a.id === primo)).toBe(false);

    const rescisso = players.find((p) => !base.some((a) => a.id === p.id))!;
    const conRescissione = buildFreeAgentPool({
      worldPlayers: players,
      seed: "s",
      season: 3,
      regenCount: 0,
      released: [rescisso.id],
    });
    expect(conRescissione.some((a) => a.id === rescisso.id)).toBe(true);
  });

  it("chi resta libero decade, ma non oltre il tetto — e chi decade abbassa le pretese", () => {
    const subito = buildFreeAgentPool({ worldPlayers: players, seed: "s", season: 3, regenCount: 0 });
    const piuTardi = buildFreeAgentPool({ worldPlayers: players, seed: "s", season: 6, regenCount: 0 });

    const stesso = subito.find((a) => piuTardi.some((b) => b.id === a.id));
    if (stesso) {
      const dopo = piuTardi.find((b) => b.id === stesso.id)!;
      expect(dopo.baseOverall - dopo.overall).toBeLessThanOrEqual(MAX_DECAY);
      expect(dopo.windowsFree).toBeGreaterThan(stesso.windowsFree);
    }

    const conDecadimento = piuTardi.filter((a) => a.windowsFree > 0);
    for (const a of conDecadimento) {
      expect(a.baseOverall - a.overall).toBe(Math.min(MAX_DECAY, a.windowsFree * DECAY_PER_WINDOW));
    }
  });

  it("nessuno sotto la soglia entra in vetrina, e i giovani senza squadra ci sono", () => {
    const pool = buildFreeAgentPool({ worldPlayers: players, seed: "s", season: 3, regenCount: 5 });
    expect(pool.every((a) => a.overall >= FREE_AGENT_MIN_OVERALL)).toBe(true);
    expect(pool.filter((a) => a.origin === "regen")).toHaveLength(5);
    // Nomi unici anche fra i generati.
    expect(new Set(pool.map((a) => a.name)).size).toBe(pool.length);
  });
});

describe("la trattativa a cinque assi", () => {
  function agente(over: Partial<FreeAgent> = {}): FreeAgent {
    return {
      id: "fa-1",
      name: "Marco Verratti",
      nation: "Italia",
      role: "CC",
      secondaryRoles: [],
      department: "CC",
      birthDate: "1992-11-05",
      age: 33,
      overall: 83,
      baseOverall: 83,
      origin: "scaduto",
      windowsFree: 0,
      nextDecay: 1,
      personality: "giovane_ambizioso",
      askingWage: 4_000_000,
      askingSeasons: 2,
      wantsStarter: true,
      suitors: 0,
      ...over,
    };
  }

  const grande: FreeAgentBid = {
    clubId: "real",
    clubName: "Real Madrid",
    prestige: 5,
    wage: 9_000_000,
    seasons: 2,
    guaranteedStarter: false,
    captain: false,
    ambitionTarget: 1,
  };
  const piccola: FreeAgentBid = {
    clubId: "noi",
    clubName: "Il tuo club",
    prestige: 2,
    wage: 4_000_000,
    seasons: 2,
    guaranteedStarter: true,
    captain: true,
    ambitionTarget: 8,
  };

  it("una piccola batte una grande offrendo il campo, se il giocatore vuole giocare", () => {
    const a = agente({ personality: "giovane_ambizioso" });
    expect(freeAgentBidScore(a, piccola)).toBeGreaterThan(freeAgentBidScore(a, grande));
  });

  it("...ma con un mercenario vince il portafoglio", () => {
    const a = agente({ personality: "mercenario" });
    expect(freeAgentBidScore(a, grande)).toBeGreaterThan(freeAgentBidScore(a, piccola));
  });

  it("se una rivale offre di più sulla sua scala, la firma sfuma e lo si viene a sapere", () => {
    // Ventiquattrenne: a quest'età l'ambizione pesa piena, quindi il Real vince senza ambiguità.
    // Con l'agente a 33 anni del fixture la piccola è ormai competitiva — comportamento voluto
    // (vedi il test sull'età più sotto), non un caso da usare qui.
    const a = agente({ personality: "mercenario", age: 24 });
    const esito = resolveFreeAgentBids(a, piccola, [grande], "seme", 3);
    expect(esito.accepted).toBe(false);
    expect(esito.rivalClubName).toBe("Real Madrid");
    expect(esito.message).toContain("Real Madrid");
  });

  /**
   * **La segnalazione: "nove volte su dieci ha già accettato un'altra offerta".**
   *
   * Non era la frequenza a essere sbagliata — la concorrenza deve esistere — ma il fatto che il
   * no fosse definitivo e muto: si scopriva di aver perso senza sapere di quanto, quindi
   * rilanciare era tirare a indovinare e la vetrina diventava inutile.
   */
  it("perdere la corsa non chiude la porta: dice cosa serve per vincerla", () => {
    const a = agente({ personality: "mercenario", age: 24 });
    const esito = resolveFreeAgentBids(a, piccola, [grande], "seme", 3);

    expect(esito.accepted).toBe(false);
    expect(esito.counter, "senza controproposta la lista svincolati resta un vicolo cieco").toBeDefined();
    expect(esito.counter!.wage).toBeGreaterThan(piccola.wage);
  });

  it("e la controproposta è davvero sufficiente: offrendo quella cifra, firma", () => {
    // È la proprietà che conta: un consiglio che non porta alla firma sarebbe peggio del
    // silenzio, perché costa soldi e non risolve.
    const a = agente({ personality: "mercenario", age: 24 });
    const esito = resolveFreeAgentBids(a, piccola, [grande], "seme", 3);
    if (!esito.counter) return;

    const rilancio: FreeAgentBid = {
      ...piccola,
      wage: esito.counter.wage,
      guaranteedStarter: esito.counter.needsStarter,
      seasons: esito.counter.seasons ?? piccola.seasons,
    };
    expect(resolveFreeAgentBids(a, rilancio, [grande], "seme", 3).accepted).toBe(true);
  });

  it("chi è avanti con l'età accetta più facilmente un club di livello inferiore", () => {
    // Richiesta esplicita dell'utente. A parità di offerta, il blasone della piccola pesa meno
    // per un trentaquattrenne che per un ventiduenne: è la differenza fra "dove posso arrivare"
    // e "dove posso giocare".
    const giovane = agente({ personality: "professionista", age: 22 });
    const veterano = agente({ personality: "professionista", age: 34 });

    const scartoGiovane = freeAgentBidScore(giovane, grande) - freeAgentBidScore(giovane, piccola);
    const scartoVeterano = freeAgentBidScore(veterano, grande) - freeAgentBidScore(veterano, piccola);
    expect(scartoVeterano).toBeLessThan(scartoGiovane);
  });

  it("un'offerta troppo bassa non la accetta nessuno, anche senza concorrenza", () => {
    const a = agente();
    const miseria: FreeAgentBid = { ...piccola, wage: 200_000, guaranteedStarter: false, captain: false };
    expect(resolveFreeAgentBids(a, miseria, [], "seme", 3).accepted).toBe(false);
  });

  it("l'esito è stabile a parità di offerta: ricaricare non cambia il verdetto", () => {
    const a = agente();
    const uno = resolveFreeAgentBids(a, piccola, [grande], "seme", 3);
    const due = resolveFreeAgentBids(a, piccola, [grande], "seme", 3);
    expect(uno).toEqual(due);
  });
});

describe("la concorrenza dell'IA", () => {
  const agente: FreeAgent = {
    id: "fa-2",
    name: "Kevin Danso",
    nation: "Austria",
    role: "DC",
    secondaryRoles: [],
    department: "DIF",
    birthDate: "1998-09-19",
    age: 27,
    overall: 76,
    baseOverall: 76,
    origin: "scaduto",
    windowsFree: 0,
    nextDecay: 1,
    personality: "professionista",
    askingWage: 2_200_000,
    askingSeasons: 3,
    wantsStarter: false,
    suitors: 0,
  };

  it("offre solo chi ha bisogno di quel reparto, ha spazio a bilancio ed è alla sua portata", () => {
    const bids = rivalBidsFor(
      agente,
      [
        { clubId: "a", clubName: "Serve un difensore", prestige: 3, wageRoom: 5_000_000, needs: ["DIF"], elevenAverage: 74 },
        { clubId: "b", clubName: "Non serve", prestige: 3, wageRoom: 5_000_000, needs: ["ATT"], elevenAverage: 74 },
        { clubId: "c", clubName: "Senza soldi", prestige: 3, wageRoom: 100_000, needs: ["DIF"], elevenAverage: 74 },
        { clubId: "d", clubName: "Troppo forte", prestige: 5, wageRoom: 50_000_000, needs: ["DIF"], elevenAverage: 88 },
      ],
      "seme",
      3,
    );
    const clubOfferenti = bids.map((b) => b.clubId);
    expect(clubOfferenti).not.toContain("b");
    expect(clubOfferenti).not.toContain("c");
    expect(clubOfferenti).not.toContain("d");
  });

  it("nessuna offerta rivale supera mai il margine di bilancio di chi la fa", () => {
    const bids = rivalBidsFor(
      agente,
      Array.from({ length: 12 }, (_, i) => ({
        clubId: `c-${i}`,
        clubName: `Club ${i}`,
        prestige: 3,
        wageRoom: 2_500_000,
        needs: ["DIF" as const],
        elevenAverage: 75,
      })),
      "seme",
      3,
    );
    expect(bids.length).toBeGreaterThan(0);
    expect(bids.every((b) => b.wage <= 2_500_000)).toBe(true);
  });
});
