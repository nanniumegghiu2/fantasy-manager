/**
 * Filtri di ricerca giocatori: richiesta esplicita dell'utente di renderli più dettagliati —
 * ruolo multi-selezione (invece di uno solo alla volta) e intervalli età/Overall (invece di
 * un solo tetto).
 */
import { describe, expect, it } from "vitest";
import { searchPlayers, type SearchableClub, type SearchablePlayer } from "../ds/scouting";
import { ROLE_DEPARTMENT, type Role } from "@app/shared-types";

function player(overrides: Partial<SearchablePlayer> & { playerId: string }): SearchablePlayer {
  const role: Role = overrides.role ?? "CC";
  return {
    playerId: overrides.playerId,
    clubId: overrides.clubId ?? "altro-club",
    overall: overrides.overall ?? 75,
    potential: overrides.potential ?? 80,
    age: overrides.age ?? 25,
    nation: overrides.nation ?? "Italia",
    department: ROLE_DEPARTMENT[role],
    stats: overrides.stats ?? { appearances: 20, minutes: 1800, goals: 2, assists: 2 },
    name: overrides.name ?? overrides.playerId,
    role,
    secondaryRoles: overrides.secondaryRoles ?? [],
  };
}

const CLUBS: Record<string, SearchableClub> = {
  "altro-club": { id: "altro-club", name: "Altro Club", startingEleven: Array.from({ length: 11 }, () => 78) },
};

const VALUATION = { leaguePrestigeByClub: {}, clubPrestige: {}, clubsInSameEra: 20 };

function cerca(players: SearchablePlayer[], criteria: Parameters<typeof searchPlayers>[0]["criteria"]) {
  return searchPlayers({
    players,
    clubs: CLUBS,
    valuation: VALUATION,
    ownClubId: "mio",
    seed: "test-ricerca",
    season: 1,
    criteria,
  });
}

describe("searchPlayers — ruolo multi-selezione", () => {
  const players = [
    player({ playerId: "dc1", role: "DC" }),
    player({ playerId: "cc1", role: "CC" }),
    player({ playerId: "att1", role: "ATT" }),
    player({ playerId: "td1", role: "TD", secondaryRoles: ["QD"] }),
  ];

  it("senza ruoli selezionati non filtra nulla", () => {
    expect(cerca(players, {})).toHaveLength(4);
  });

  it("con un ruolo solo si comporta come la vecchia ricerca a singola selezione", () => {
    const risultati = cerca(players, { roles: ["DC"] });
    expect(risultati.map((r) => r.playerId)).toEqual(["dc1"]);
  });

  it("con più ruoli selezionati trova chi copre uno qualunque dei due", () => {
    const risultati = cerca(players, { roles: ["DC", "ATT"] });
    expect(new Set(risultati.map((r) => r.playerId))).toEqual(new Set(["dc1", "att1"]));
  });

  it("un ruolo secondario conta quanto il principale, anche in multi-selezione", () => {
    const risultati = cerca(players, { roles: ["QD", "ATT"] });
    expect(new Set(risultati.map((r) => r.playerId))).toEqual(new Set(["td1", "att1"]));
  });
});

describe("searchPlayers — intervalli età e Overall", () => {
  const players = [
    player({ playerId: "giovane-scarso", age: 19, overall: 65 }),
    player({ playerId: "giovane-forte", age: 20, overall: 88 }),
    player({ playerId: "veterano-forte", age: 33, overall: 86 }),
    player({ playerId: "medio", age: 27, overall: 75 }),
  ];

  it("minAge esclude chi è più giovane della soglia", () => {
    const risultati = cerca(players, { minAge: 25 });
    expect(risultati.map((r) => r.playerId).sort()).toEqual(["medio", "veterano-forte"].sort());
  });

  it("minAge e maxAge insieme delimitano un intervallo", () => {
    const risultati = cerca(players, { minAge: 20, maxAge: 27 });
    expect(risultati.map((r) => r.playerId).sort()).toEqual(["giovane-forte", "medio"].sort());
  });

  it("maxOverall esclude chi supera la soglia, minOverall chi sta sotto", () => {
    const risultati = cerca(players, { minOverall: 80, maxOverall: 90 });
    expect(risultati.map((r) => r.playerId).sort()).toEqual(["giovane-forte", "veterano-forte"].sort());
  });

  it("i quattro filtri combinati insieme restringono correttamente", () => {
    const risultati = cerca(players, { minAge: 18, maxAge: 22, minOverall: 80, maxOverall: 99 });
    expect(risultati.map((r) => r.playerId)).toEqual(["giovane-forte"]);
  });
});
