/**
 * Il **mondo che vive**: le squadre del computer invecchiano, si ritirano, si rinnovano e
 * fanno mercato.
 *
 * Le proprietà verificate qui sono quelle che l'utente ha segnalato come mancanti giocando:
 * niente quarantenni in campo dopo qualche stagione, forze delle avversarie che si muovono, e
 * un mercato che non sia solo il suo.
 */
import { describe, expect, it } from "vitest";
import {
  aiOverallInSeason,
  eccedenzaReparto,
  evolveWorld,
  FABBISOGNO_PER_REPARTO,
  isRetiredBySeason,
  planWorldTransfers,
  WORLD_TRANSFERS_PER_SEASON,
  type WorldClub,
  type WorldPlayer,
  type WorldTransfer,
} from "../ds/aiWorld";
import { ageInSeason } from "../ds/aging";
import { ROLE_DEPARTMENT, type Role } from "@app/shared-types";

const RUOLI: Role[] = ["POR", "DC", "TD", "TS", "MED", "CC", "ED", "ES", "TRQ", "ATT"];

/** Un mondo di prova: 12 club di forza diversa, 24 giocatori l'uno, età scaglionate. */
function mondo(): { clubs: WorldClub[]; players: WorldPlayer[] } {
  const clubs: WorldClub[] = Array.from({ length: 12 }, (_, i) => ({
    id: `c${i}`,
    name: `Club ${i}`,
    leagueId: i < 6 ? "serie-a" : "premier",
    prestigeTier: 1 + (i % 5),
  }));

  const players: WorldPlayer[] = [];
  for (const [ci, club] of clubs.entries()) {
    for (let p = 0; p < 24; p++) {
      const role = RUOLI[p % RUOLI.length]!;
      // Età da 18 a 36: qualcuno cresce, qualcuno si ritira quasi subito.
      const eta = 18 + ((p * 3 + ci) % 19);
      players.push({
        id: `c${ci}-p${p}`,
        name: `Giocatore ${ci}-${p}`,
        nation: p % 3 === 0 ? "Italia" : "Francia",
        role,
        secondaryRoles: [],
        department: ROLE_DEPARTMENT[role],
        birthDate: `${2025 - eta}-03-15`,
        // La forza dipende **dal club**, non solo dal giocatore: senza un dislivello reale fra
        // le squadre non ci sarebbe alcun mercato da osservare (i giocatori si muovono verso
        // l'alto, quindi servono un alto e un basso). Il `7` è primo rispetto ai 10 ruoli, così
        // l'Overall non risulta correlato al ruolo — altrimenti un reparto sarebbe sempre il
        // più debole per costruzione e il test non misurerebbe nulla. I ruoli ciclano su 10 e
        // l'Overall su 13: essendo coprimi, ogni ruolo riceve valori diversi.
        overall: 60 + ci * 2 + (p % 13),
        clubId: club.id,
      });
    }
  }
  return { clubs, players };
}

function evolvi(season: number, transfers: WorldTransfer[] = []) {
  const { clubs, players } = mondo();
  return {
    clubs,
    players,
    evoluto: evolveWorld({
      clubs,
      players,
      ownClubId: "c0",
      ownedByUser: new Set(),
      seed: "mondo",
      season,
      transfers,
    }),
  };
}

describe("invecchiamento delle squadre del computer", () => {
  it("un giovane cresce, un trentaduenne cala", () => {
    const giovane = { overall: 70, nato: `${2025 - 19}-01-01` };
    const anziano = { overall: 80, nato: `${2025 - 31}-01-01` };
    expect(aiOverallInSeason(giovane.overall, giovane.nato, 4)).toBeGreaterThan(giovane.overall);
    expect(aiOverallInSeason(anziano.overall, anziano.nato, 3)).toBeLessThan(anziano.overall);
  });

  it("alla prima stagione nessuno è ancora cambiato", () => {
    expect(aiOverallInSeason(78, "2000-01-01", 1)).toBe(78);
  });

  it("nel picco l'Overall resta fermo: non si cresce per aver compiuto gli anni", () => {
    /**
     * Fra i 24 e i 28 anni `ageMargin` vale 1, ma quel punto è oscillazione legata al
     * rendimento — che per l'IA non esiste. Applicarlo comunque farebbe salire di cinque punti
     * ogni giocatore del mondo, e in dieci stagioni i campionati si gonfierebbero da soli.
     */
    const nato = `${2025 - 19}-01-01`;
    expect(aiOverallInSeason(70, nato, 10)).toBe(aiOverallInSeason(70, nato, 6));
  });

  it("la crescita non supera mai il potenziale stimato", () => {
    const nato = `${2025 - 18}-01-01`;
    // Da 70 a 18 anni il tetto è attorno a 83: nessuno diventa un fenomeno per inerzia.
    expect(aiOverallInSeason(70, nato, 8)).toBeLessThanOrEqual(84);
  });

  it("è puro: ricalcolarlo dà sempre lo stesso valore", () => {
    const a = aiOverallInSeason(76, "1998-06-02", 5);
    const b = aiOverallInSeason(76, "1998-06-02", 5);
    expect(a).toBe(b);
  });

  it("le forze dei club si muovono di stagione in stagione", () => {
    // Su tutti i club, non su uno solo: per un singolo club una coincidenza fra due stagioni è
    // possibile, e renderebbe il test instabile senza dire nulla sul mondo.
    const forze = (season: number) => {
      const { evoluto } = evolvi(season);
      return [...evoluto.byClub.entries()].map(([, rosa]) => {
        const undici = [...rosa].sort((x, y) => y.overall - x.overall).slice(0, 11);
        return undici.length > 0
          ? undici.reduce((s, p) => s + p.overall, 0) / undici.length
          : 0;
      });
    };
    expect(forze(5)).not.toEqual(forze(1));
  });
});

describe("ritiri nel mondo", () => {
  it("chi ha 34 anni si ritira, chi ne ha 25 no", () => {
    expect(isRetiredBySeason(`${2025 - 34}-01-01`, 3)).toBe(true);
    expect(isRetiredBySeason(`${2025 - 25}-01-01`, 3)).toBe(false);
  });

  it("dopo qualche stagione non ci sono più over 36 in giro", () => {
    /**
     * È il difetto segnalato dall'utente: senza ritiri nel mondo si incontravano giocatori
     * over 40 nel corso della carriera.
     */
    const { evoluto } = evolvi(6);
    const eta = [...evoluto.byId.values()]
      .map((p) => ageInSeason(p.birthDate, 6))
      .filter((e): e is number => e !== null);
    expect(eta.length).toBeGreaterThan(0);
    expect(Math.max(...eta)).toBeLessThanOrEqual(34);
  });

  it("ogni ritirato è rimpiazzato: il mondo non si assottiglia (ma il club non è più garantito)", () => {
    /**
     * Il regen nasce ora in un club a caso, non più in quello del ritirato (sez. "niente trucco
     * compra-e-aspetta-il-ritiro" — packages/game-engine/src/ds/career.ts): la conservazione
     * vale sul **totale** del mondo, non più club per club, quindi il conteggio si somma su
     * tutte le squadre invece di confrontare un singolo club fra due stagioni.
     */
    const prima = evolvi(1).evoluto;
    const dopo = evolvi(6).evoluto;
    const totale = (m: typeof prima) => [...m.byClub.values()].reduce((s, r) => s + r.length, 0);
    expect(totale(dopo)).toBe(totale(prima));
  });

  it("i regen dell'IA nascono in club diversi, non sempre in quello del ritirato", () => {
    const { evoluto } = evolvi(8);
    const regen = [...evoluto.byId.values()].filter((p) => p.regen);
    expect(regen.length).toBeGreaterThan(0);
    // L'id resta ancorato al ritirato (`airegen-<id>`): il club vero è quello scritto in
    // `clubId`, che per costruzione del vecchio id non coincide più sempre col nome che lo
    // precede — qui si verifica solo che non finiscano tutti nello stesso club, cioè che il
    // sorteggio distribuisca davvero.
    const clubDiversi = new Set(regen.map((p) => p.clubId));
    expect(clubDiversi.size).toBeGreaterThan(1);
  });

  it("i rimpiazzi sono ragazzi con un nome vero, e crescono negli anni", () => {
    const { evoluto } = evolvi(6);
    const regen = [...evoluto.byId.values()].filter((p) => p.regen);
    expect(regen.length).toBeGreaterThan(0);
    for (const p of regen) {
      expect(p.name).not.toMatch(/^Giocatore /);
      expect(p.name.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);
      // Nasce a 17-19 anni; alla sesta stagione i più vecchi ne hanno qualcuno in più, perché
      // invecchiano come tutti — ma restano giovani. Il 16 è l'effetto di chi compie gli anni
      // dopo il 1º settembre, data a cui il motore misura l'età.
      const eta = ageInSeason(p.birthDate, 6)!;
      expect(eta).toBeGreaterThanOrEqual(16);
      expect(eta).toBeLessThanOrEqual(24);
    }
  });

  it("un regen resta sé stesso di stagione in stagione", () => {
    /**
     * Difetto grave e invisibile a prima vista: numerando i regen con la stagione corrente, lo
     * stesso ragazzo cambiava id ogni anno. Un regen scoutizzato nella stagione 4 spariva nella
     * 5, e uno **comprato** restava in rosa senza anagrafica, cioè col nome "Giocatore".
     */
    const idsDi = (season: number) =>
      [...evolvi(season).evoluto.byId.values()].filter((p) => p.regen).map((p) => p.id);
    const s4 = new Set(idsDi(4));
    const s5 = idsDi(5);
    expect(s4.size).toBeGreaterThan(0);
    // Tutti quelli nati entro la stagione 4 esistono ancora nella 5, con lo stesso id.
    for (const id of s4) expect(s5).toContain(id);
  });

  it("un regen tiene nome e nazionalità fra una stagione e l'altra", () => {
    const perId = (season: number) =>
      new Map([...evolvi(season).evoluto.byId.values()].filter((p) => p.regen).map((p) => [p.id, p]));
    const s4 = perId(4);
    const s6 = perId(6);
    for (const [id, prima] of s4) {
      const dopo = s6.get(id);
      expect(dopo, `il regen ${id} è sparito`).toBeDefined();
      expect(dopo!.name).toBe(prima.name);
      expect(dopo!.nation).toBe(prima.nation);
      expect(dopo!.birthDate).toBe(prima.birthDate);
    }
  });

  it("la rosa dell'utente non viene toccata dal mondo", () => {
    const { evoluto } = evolvi(6);
    expect(evoluto.byClub.get("c0")).toHaveLength(0);
  });

  it("un regen comprato lascia la sua squadra ma resta in anagrafica", () => {
    /**
     * Due difetti opposti, entrambi visti in gioco, e la distinzione fra i due **è** la
     * correzione:
     *  - generare il regen e basta lo lasciava anche nel club d'origine, che continuava a
     *    schierarlo contro di noi — due copie della stessa persona;
     *  - saltarlo del tutto lo cancellava dall'anagrafica, e comprandolo compariva in rosa
     *    come "Giocatore", senza nome né ruolo.
     *
     * `byId` risponde a "chi è", `byClub` a "dove gioca": sono domande diverse.
     */
    const { clubs, players } = mondo();
    const nati = evolveWorld({
      clubs,
      players,
      ownClubId: "c0",
      ownedByUser: new Set(),
      seed: "mondo",
      season: 5,
      transfers: [],
    });
    const unRegen = [...nati.byId.values()].find((p) => p.regen);
    expect(unRegen).toBeDefined();

    const dopoAcquisto = evolveWorld({
      clubs,
      players,
      ownClubId: "c0",
      ownedByUser: new Set([unRegen!.id]),
      seed: "mondo",
      season: 5,
      transfers: [],
    });

    // Chi è: sempre risolvibile, con lo stesso nome e lo stesso ruolo.
    const inAnagrafica = dopoAcquisto.byId.get(unRegen!.id);
    expect(inAnagrafica).toBeDefined();
    expect(inAnagrafica!.name).toBe(unRegen!.name);
    expect(inAnagrafica!.role).toBe(unRegen!.role);

    // Dove gioca: in nessuna squadra del mondo, perché ora è nostro.
    for (const [, rosa] of dopoAcquisto.byClub) {
      expect(rosa.some((p) => p.id === unRegen!.id)).toBe(false);
    }
  });

  it("un regen nato da un nostro ritirato ma atterrato altrove compare nel club di destinazione", () => {
    /**
     * Il rimpiazzo di un nostro ritirato non nasce più garantito nella nostra rosa (sez.
     * "niente trucco compra-e-aspetta-il-ritiro", packages/game-engine/src/ds/career.ts): se
     * l'estrazione lo manda in un club IA, quel club deve vederlo in campo e il mercato deve
     * poterlo vendere — altrimenti sarebbe generato ma invisibile al mondo.
     */
    const { clubs, players } = mondo();
    const evoluto = evolveWorld({
      clubs,
      players,
      ownClubId: "c0",
      ownedByUser: new Set(),
      seed: "esterno",
      season: 5,
      externalRegens: [
        {
          destinationClubId: "c4",
          player: {
            id: "regen-nostro-1",
            name: "Nato Altrove",
            nation: "Italia",
            role: "CC",
            secondaryRoles: [],
            birthDate: "2007-01-01",
            overall: 68,
          },
        },
      ],
      transfers: [],
    });

    const inAnagrafica = evoluto.byId.get("regen-nostro-1");
    expect(inAnagrafica).toBeDefined();
    expect(inAnagrafica!.clubId).toBe("c4");
    expect(inAnagrafica!.regen).toBe(true);
    expect(evoluto.byClub.get("c4")!.some((p) => p.id === "regen-nostro-1")).toBe(true);
    // Non deve comparire in nessun altro club.
    for (const [clubId, rosa] of evoluto.byClub) {
      if (clubId === "c4") continue;
      expect(rosa.some((p) => p.id === "regen-nostro-1")).toBe(false);
    }
  });

  it("chi hai comprato tu sparisce dal mondo", () => {
    const { clubs, players } = mondo();
    const comprato = players.find((p) => p.clubId === "c4")!;
    const evoluto = evolveWorld({
      clubs,
      players,
      ownClubId: "c0",
      ownedByUser: new Set([comprato.id]),
      seed: "mondo",
      season: 2,
      transfers: [],
    });
    expect(evoluto.byId.has(comprato.id)).toBe(false);
  });
});

describe("mercato fra squadre del computer", () => {
  it("produce trasferimenti plausibili e in numero contenuto", () => {
    const { clubs, evoluto } = evolvi(2);
    const transfers = planWorldTransfers({
      clubs,
      byClub: evoluto.byClub,
      ownClubId: "c0",
      seed: "mondo",
      season: 2,
    });
    expect(transfers.length).toBeGreaterThan(0);
    expect(transfers.length).toBeLessThanOrEqual(WORLD_TRANSFERS_PER_SEASON);
    for (const t of transfers) {
      expect(t.fromClubId).not.toBe(t.toClubId);
      expect(t.fee).toBeGreaterThan(0);
      expect(t.playerName.length).toBeGreaterThan(0);
    }
  });

  it("il club dell'utente non compra né vende per conto suo", () => {
    const { clubs, evoluto } = evolvi(2);
    const transfers = planWorldTransfers({
      clubs,
      byClub: evoluto.byClub,
      ownClubId: "c0",
      seed: "mondo",
      season: 2,
    });
    expect(transfers.every((t) => t.fromClubId !== "c0" && t.toClubId !== "c0")).toBe(true);
  });

  it("i giocatori si muovono verso l'alto, non a caso", () => {
    /**
     * Senza questa regola, dieci stagioni di mercato rimescolerebbero le rose a sorte e la
     * gerarchia dei campionati sparirebbe.
     */
    const { clubs, evoluto } = evolvi(2);
    const forza = (id: string) => {
      const rosa = evoluto.byClub.get(id) ?? [];
      const undici = [...rosa].sort((x, y) => y.overall - x.overall).slice(0, 11);
      return undici.reduce((s, p) => s + p.overall, 0) / undici.length;
    };
    const transfers = planWorldTransfers({
      clubs,
      byClub: evoluto.byClub,
      ownClubId: "c0",
      seed: "mondo",
      season: 2,
    });
    for (const t of transfers) {
      expect(forza(t.toClubId)).toBeGreaterThan(forza(t.fromClubId));
    }
  });

  it("il mercato non è fatto di soli portieri", () => {
    /**
     * Difetto trovato guardando il pannello: confrontando i **primi tre** di ogni reparto la
     * porta risultava il punto debole di ogni club, perché il secondo e il terzo portiere sono
     * sempre molto sotto il titolare. Il mondo comprava solo portieri.
     */
    const { clubs, evoluto } = evolvi(2);
    const transfers = planWorldTransfers({
      clubs,
      byClub: evoluto.byClub,
      ownClubId: "c0",
      seed: "mondo",
      season: 2,
    });
    const reparti = transfers.map((t) => evoluto.byId.get(t.playerId)?.department);
    expect(new Set(reparti).size).toBeGreaterThan(1);
    const portieri = reparti.filter((d) => d === "POR").length;
    expect(portieri).toBeLessThan(transfers.length);
  });

  it("nessun giocatore viene ceduto due volte nella stessa sessione", () => {
    const { clubs, evoluto } = evolvi(2);
    const transfers = planWorldTransfers({
      clubs,
      byClub: evoluto.byClub,
      ownClubId: "c0",
      seed: "mondo",
      season: 2,
    });
    const ids = transfers.map((t) => t.playerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("il fabbisogno di un reparto è titolari+panchina, non solo gli undici nudi", () => {
    // Richiesta esplicita dell'utente: una rosa non è solo gli 11 titolari.
    expect(FABBISOGNO_PER_REPARTO.DIF).toBeGreaterThan(4);
    expect(FABBISOGNO_PER_REPARTO.CC).toBeGreaterThan(4);
  });

  it("eccedenzaReparto è zero finché non si supera titolari+panchina", () => {
    const rosaDC = (n: number): WorldPlayer[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `dc-${i}`, name: `Difensore ${i}`, nation: "Italia", role: "DC" as const,
        secondaryRoles: [], department: "DIF" as const, birthDate: "2000-01-01",
        overall: 75, clubId: "c",
      }));
    expect(eccedenzaReparto(rosaDC(FABBISOGNO_PER_REPARTO.DIF), "DIF")).toBe(0);
    expect(eccedenzaReparto(rosaDC(FABBISOGNO_PER_REPARTO.DIF + 2), "DIF")).toBe(2);
  });

  it("è riproducibile: stesso seme e stessa stagione, stesso mercato", () => {
    const uno = evolvi(3);
    const due = evolvi(3);
    const a = planWorldTransfers({ clubs: uno.clubs, byClub: uno.evoluto.byClub, ownClubId: "c0", seed: "mondo", season: 3 });
    const b = planWorldTransfers({ clubs: due.clubs, byClub: due.evoluto.byClub, ownClubId: "c0", seed: "mondo", season: 3 });
    expect(a).toEqual(b);
  });

  it("un trasferimento sposta davvero il giocatore di squadra", () => {
    const { clubs, players } = mondo();
    const chi = players.find((p) => p.clubId === "c9")!;
    const evoluto = evolveWorld({
      clubs,
      players,
      ownClubId: "c0",
      ownedByUser: new Set(),
      seed: "mondo",
      season: 3,
      transfers: [
        {
          playerId: chi.id,
          playerName: chi.name,
          fromClubId: "c9",
          toClubId: "c2",
          fee: 5_000_000,
          season: 2,
        },
      ],
    });
    expect(evoluto.byId.get(chi.id)?.clubId).toBe("c2");
    expect(evoluto.byClub.get("c2")!.some((p) => p.id === chi.id)).toBe(true);
    expect(evoluto.byClub.get("c9")!.some((p) => p.id === chi.id)).toBe(false);
  });

  it("un trasferimento avvenuto nella stagione corrente sposta subito il giocatore nel nuovo club", () => {
    const { clubs, players } = mondo();
    const chi = players.find((p) => p.clubId === "c9")!;
    const evoluto = evolveWorld({
      clubs,
      players,
      ownClubId: "c0",
      ownedByUser: new Set(),
      seed: "mondo",
      season: 2,
      transfers: [
        {
          playerId: chi.id,
          playerName: chi.name,
          fromClubId: "c9",
          toClubId: "c2",
          fee: 5_000_000,
          season: 2, // Trasferimento avvenuto durante la finestra della stagione 2
        },
      ],
    });
    expect(evoluto.byId.get(chi.id)?.clubId).toBe("c2");
    expect(evoluto.byClub.get("c2")!.some((p) => p.id === chi.id)).toBe(true);
    expect(evoluto.byClub.get("c9")!.some((p) => p.id === chi.id)).toBe(false);
  });
});
