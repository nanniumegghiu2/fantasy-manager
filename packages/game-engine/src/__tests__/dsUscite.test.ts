/**
 * **Chi lascia il club se ne va davvero.**
 *
 * Due segnalazioni distinte dell'utente — «un giocatore perso per clausola lo ritrovo nella
 * squadra di origine» e «i venduti si possono ricomprare nella stessa sessione di mercato» —
 * avevano **una sola causa**: nessuna uscita dalla rosa registrava un `WorldTransfer`, quindi
 * `evolveWorld` ricostruiva il mondo dal database e rimetteva il giocatore al suo club di
 * partenza. Non essendo più fra i nostri, tornava anche fra gli acquistabili.
 *
 * I test qui verificano le due proprietà **dal lato di chi gioca**, non l'esistenza dei campi
 * che le rendono possibili: dopo una cessione il giocatore non si può più prendere in questa
 * finestra, e il mondo lo mette nella rosa di chi l'ha comprato. Un campo si può rinominare,
 * queste due regole no.
 */
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
  applyMarketAction,
  emptySquadLists,
  pickPlausibleBuyer,
  type MarketWorld,
} from "../ds/careerMarket";
import { createRosterEntry } from "../ds/roster";
import { evolveWorld, type WorldClub, type WorldPlayer } from "../ds/aiWorld";
import type { PlayerIndex, RosterEntry } from "../ds/types";
import { ROLE_DEPARTMENT, type Role } from "@app/shared-types";

/* -------------------------------------------------------------------------- */
/* Fixture                                                                     */
/* -------------------------------------------------------------------------- */

function marketWorld(): MarketWorld {
  const players: PlayerIndex = {};
  for (let i = 0; i < 25; i++) {
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
      mio: { id: "mio", name: "La mia squadra", leagueId: "l", startingEleven: Array.from({ length: 11 }, () => 78) },
      ricco: { id: "ricco", name: "Club Ricco", leagueId: "l", startingEleven: Array.from({ length: 11 }, () => 86) },
      medio: { id: "medio", name: "Club Medio", leagueId: "l", startingEleven: Array.from({ length: 11 }, () => 78) },
      povero: { id: "povero", name: "Club Povero", leagueId: "l", startingEleven: Array.from({ length: 11 }, () => 62) },
    },
    transferPool: [],
    valuation: {
      leaguePrestigeByClub: { mio: 4, ricco: 5, medio: 3, povero: 2 },
      clubPrestige: { mio: 4, ricco: 5, medio: 3, povero: 2 },
      clubsInSameEra: 96,
    },
    players,
    nameOf: (id) => players[id]?.name ?? id,
    ageOf: () => 26,
    leagueRounds: 38,
  };
}

function rosaDi(quanti: number, overall = 76): RosterEntry[] {
  return Array.from({ length: quanti }, (_, i) =>
    createRosterEntry({ playerId: `p${i}`, overall, potential: overall + 4, sinceSeason: 1 }),
  );
}

function snapshotVuoto() {
  return { window: "estiva" as const, offers: [], shortlist: [], loanOffers: [], aiSellable: [] };
}

/* -------------------------------------------------------------------------- */
/* 1. Ogni forma di cessione dichiara dove va il giocatore                     */
/* -------------------------------------------------------------------------- */

describe("una cessione dichiara sempre la destinazione", () => {
  const world = marketWorld();

  it("accettare un'offerta manda il giocatore al club che ha offerto", () => {
    const esito = applyMarketAction(
      {
        roster: rosaDi(20),
        budget: 0,
        snapshot: {
          ...snapshotVuoto(),
          offers: [
            {
              playerId: "p3",
              playerName: "Giocatore 3",
              fromClubId: "ricco",
              fromClubName: "Club Ricco",
              fee: 20_000_000,
              appetite: 0.8,
            },
          ],
        },
        lists: emptySquadLists(),
        ownClubId: "mio",
      },
      { kind: "accetta_offerta", playerId: "p3" },
      world,
      1,
      "seed",
    );

    expect(esito.rejected).toBeFalsy();
    expect(esito.departure).toEqual({
      playerId: "p3",
      playerName: "Giocatore 3",
      toClubId: "ricco",
      toClubName: "Club Ricco",
      fee: 20_000_000,
    });
  });

  it("la vendita rapida non nomina un compratore, ma una destinazione ce l'ha comunque", () => {
    const esito = applyMarketAction(
      { roster: rosaDi(20), budget: 0, snapshot: snapshotVuoto(), lists: emptySquadLists(), ownClubId: "mio" },
      { kind: "vendi_subito", playerId: "p5" },
      world,
      1,
      "seed",
    );

    expect(esito.rejected).toBeFalsy();
    expect(esito.departure).toBeDefined();
    // Senza questa proprietà il giocatore resterebbe nel limbo del club d'origine, che è
    // esattamente il difetto segnalato.
    expect(esito.departure!.toClubId).not.toBe("mio");
    expect(Object.keys(world.clubs)).toContain(esito.departure!.toClubId);
  });

  it("chi resta in rosa non produce nessuna partenza", () => {
    const esito = applyMarketAction(
      { roster: rosaDi(20), budget: 0, snapshot: snapshotVuoto(), lists: emptySquadLists(), ownClubId: "mio" },
      { kind: "lista_trasferimenti", playerId: "p5", on: true },
      world,
      1,
      "seed",
    );
    expect(esito.departure).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Il compratore è sempre qualcuno, e non siamo noi                         */
/* -------------------------------------------------------------------------- */

describe("chi compra chi non ha un compratore dichiarato", () => {
  const world = marketWorld();

  it("non siamo mai noi a comprarci un nostro giocatore", () => {
    for (let s = 0; s < 30; s++) {
      const club = pickPlausibleBuyer(world, "mio", 80, 30_000_000, mulberry32(s));
      expect(club).toBeDefined();
      expect(club!.id).not.toBe("mio");
    }
  });

  it("se nessuno è alla sua portata la cessione avviene lo stesso, verso il club più forte", () => {
    // Un giocatore fuori scala e una cifra che nessuno può permettersi: senza il ripiego non
    // ci sarebbe destinazione, e il giocatore resterebbe dov'era.
    const club = pickPlausibleBuyer(world, "mio", 99, 900_000_000, mulberry32(1));
    expect(club).toBeDefined();
    expect(club!.id).toBe("ricco");
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Il mondo lo mette davvero nella rosa di chi l'ha comprato                */
/* -------------------------------------------------------------------------- */

describe("il trasferimento è vero anche per il mondo", () => {
  const ROLI: Role[] = ["POR", "DC", "DC", "TD", "TS", "MED", "CC", "CC", "ED", "ES", "ATT"];

  function mondo(): { clubs: WorldClub[]; players: WorldPlayer[] } {
    const clubs: WorldClub[] = [
      { id: "mio", name: "La mia squadra", leagueId: "l", prestigeTier: 4 },
      { id: "ricco", name: "Club Ricco", leagueId: "l", prestigeTier: 5 },
      { id: "medio", name: "Club Medio", leagueId: "l", prestigeTier: 3 },
    ];
    const players: WorldPlayer[] = [];
    for (const clubId of ["mio", "ricco", "medio"]) {
      ROLI.forEach((role, i) => {
        players.push({
          id: `${clubId}-${i}`,
          name: `${clubId} ${i}`,
          nation: "Italia",
          role,
          secondaryRoles: [],
          department: ROLE_DEPARTMENT[role],
          birthDate: "1998-04-02",
          overall: 76,
          clubId,
        });
      });
    }
    return { clubs, players };
  }

  const trasferimento = (playerId: string, toClubId: string) => ({
    playerId,
    playerName: playerId,
    fromClubId: "mio",
    toClubId,
    fee: 15_000_000,
    season: 1,
  });

  /**
   * Il caso della segnalazione: un giocatore **comprato** dal Club Ricco e poi ceduto (venduto o
   * portato via da una clausola). Senza il trasferimento registrato il mondo lo rimette dov'era
   * nel database, cioè al Ricco — «come se il trasferimento non fosse mai successo».
   */
  it("un giocatore comprato altrove e poi ceduto NON torna al club da cui l'avevamo preso", () => {
    const { clubs, players } = mondo();
    const ceduto = "ricco-9";

    const evoluto = evolveWorld({
      clubs,
      players,
      ownClubId: "mio",
      // Non è più nostro: l'abbiamo appena ceduto, quindi il mondo se ne riprende carico.
      ownedByUser: new Set<string>(),
      seed: "seed",
      season: 1,
      transfers: [trasferimento(ceduto, "medio")],
    });

    expect((evoluto.byClub.get("ricco") ?? []).map((p) => p.id)).not.toContain(ceduto);
    expect((evoluto.byClub.get("medio") ?? []).map((p) => p.id)).toContain(ceduto);
    // E resta lo stesso uomo, non un omonimo ricostruito: l'anagrafica lo conosce ancora.
    expect(evoluto.byId.get(ceduto)?.clubId).toBe("medio");
  });

  it("senza il trasferimento registrato torna davvero al vecchio club — cioè il difetto", () => {
    const { clubs, players } = mondo();
    const evoluto = evolveWorld({
      clubs,
      players,
      ownClubId: "mio",
      ownedByUser: new Set<string>(),
      seed: "seed",
      season: 1,
      transfers: [],
    });
    // Questo test esiste per dimostrare che la correzione serve davvero: senza la riga
    // registrata il giocatore è ancora dove stava. Se un giorno fallisse, la causa del difetto
    // segnalato non sarebbe più questa, e conviene saperlo.
    expect((evoluto.byClub.get("ricco") ?? []).map((p) => p.id)).toContain("ricco-9");
  });

  /**
   * Il caso che il primo test non copriva, ed è quello che ha fatto emergere il difetto più
   * profondo: un giocatore **nato in casa nostra**. Il mondo lo escludeva sul club del database,
   * quindi il trasferimento non lo raggiungeva mai e spariva del tutto invece di andare al
   * compratore.
   */
  it("anche un giocatore nato in casa nostra finisce nella rosa di chi lo compra", () => {
    const { clubs, players } = mondo();
    const ceduto = "mio-9";

    const evoluto = evolveWorld({
      clubs,
      players,
      ownClubId: "mio",
      ownedByUser: new Set<string>(),
      seed: "seed",
      season: 1,
      transfers: [trasferimento(ceduto, "ricco")],
    });

    expect((evoluto.byClub.get("ricco") ?? []).map((p) => p.id)).toContain(ceduto);
    expect(evoluto.byId.get(ceduto)?.clubId).toBe("ricco");
  });

  it("chi è ancora in rosa resta fuori dal mondo, trasferimenti o no", () => {
    const { clubs, players } = mondo();
    const evoluto = evolveWorld({
      clubs,
      players,
      ownClubId: "mio",
      ownedByUser: new Set(["ricco-3"]),
      seed: "seed",
      season: 1,
      transfers: [],
    });
    // Un giocatore comprato dal Ricco e ancora nostro non deve comparire da nessuna parte nel
    // mondo, altrimenti sarebbe in due squadre insieme.
    expect(evoluto.byId.has("ricco-3")).toBe(false);
    expect((evoluto.byClub.get("mio") ?? []).length).toBe(0);
  });
});
