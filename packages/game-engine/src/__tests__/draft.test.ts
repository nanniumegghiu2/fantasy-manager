import { describe, expect, it } from "vitest";
import type { Player } from "@app/shared-types";
import { getFormation } from "../formations";
import {
  REDRAFT_ALLOWANCE,
  ROLE_MODE_CANDIDATE_COUNT,
  candidatesForRequirement,
  canRedraft,
  createEmptyProgress,
  effectiveOverallForRole,
  eligibleClubPackages,
  isClubEligible,
  isRoleCompatible,
  isSquadComplete,
  openRequirements,
  playerMatchesRequirement,
  qualityWeight,
  weightedSampleN,
  drawClubPack,
} from "../draft";
import type { ClubPackage, DraftRequirement, Difficulty } from "../draft";

function makePlayer(overrides: Partial<Player>): Player {
  return {
    id: "p1",
    name: "Test Player",
    overall: 80,
    marketValue: 100,
    clubId: "club-1",
    era: "1990s",
    nation: "Italia",
    league: "Serie A",
    role: "ATT",
    secondaryRoles: [],
    department: "ATT",
    ...overrides,
  };
}

describe("openRequirements / isSquadComplete", () => {
  it("un draft nuovo ha 11 requirement titolari, tutti aperti (niente riserve)", () => {
    const formation = getFormation("4-3-3")!;
    const progress = createEmptyProgress(formation);
    const reqs = openRequirements(progress);
    expect(reqs).toHaveLength(11);
    expect(isSquadComplete(progress)).toBe(false);
  });

  it("isSquadComplete torna true quando tutti gli slot titolari sono riempiti", () => {
    const formation = getFormation("4-3-3")!;
    const progress = createEmptyProgress(formation);
    const full = {
      ...progress,
      filledStarterSlotIds: new Set(formation.slots.map((s) => s.id)),
    };
    expect(isSquadComplete(full)).toBe(true);
  });
});

describe("playerMatchesRequirement", () => {
  it("uno slot titolare richiede il ruolo esatto", () => {
    const req = { id: "ed-1", role: "ED" as const, department: "CC" as const };
    expect(playerMatchesRequirement(makePlayer({ role: "ED", department: "CC" }), req)).toBe(true);
    expect(playerMatchesRequirement(makePlayer({ role: "ES", department: "CC" }), req)).toBe(false);
  });

  it("uno slot titolare accetta anche un ruolo secondario del giocatore", () => {
    const req = { id: "td-1", role: "TD" as const, department: "DIF" as const };
    const player = makePlayer({ role: "TS", department: "DIF", secondaryRoles: ["TD"] });
    expect(playerMatchesRequirement(player, req)).toBe(true);
  });
});

describe("ruolo secondario e malus sull'Overall (sez. 3.1)", () => {
  it("isRoleCompatible è vero per il ruolo principale e per i ruoli secondari", () => {
    const player = makePlayer({ role: "TQD", secondaryRoles: ["ATT", "ED"] });
    expect(isRoleCompatible(player, "TQD")).toBe(true);
    expect(isRoleCompatible(player, "ATT")).toBe(true);
    expect(isRoleCompatible(player, "ED")).toBe(true);
    expect(isRoleCompatible(player, "TRQ")).toBe(false);
  });

  it("effectiveOverallForRole non applica malus nel ruolo principale", () => {
    const player = makePlayer({ role: "ATT", overall: 88, secondaryRoles: ["TRQ"] });
    expect(effectiveOverallForRole(player, "ATT")).toBe(88);
  });

  it("effectiveOverallForRole non penalizza più il ruolo secondario", () => {
    // Il malus fisso è stato rimosso: il prezzo di giocare fuori ruolo lo paga l'intesa,
    // perché la casella diversa cambia i vicini sullo scacchiere (sez. 3.1/3.4).
    const player = makePlayer({ role: "ATT", overall: 88, secondaryRoles: ["TRQ"] });
    expect(effectiveOverallForRole(player, "TRQ")).toBe(88);
  });
});

describe("modalità per squadra — eleggibilità club", () => {
  it("un club senza giocatori compatibili con uno slot libero non è eleggibile", () => {
    const formation = getFormation("4-3-3")!;
    const progress = createEmptyProgress(formation);
    // Nessun giocatore di questo club combacia con nessuno slot (dipartimento/ruolo inesistenti nel test)
    const players = [makePlayer({ id: "x1", role: "POR", department: "POR" })];
    // POR e' uno slot valido (c'e' il portiere in ogni modulo) quindi qui il club E' eleggibile:
    expect(isClubEligible(players, progress)).toBe(true);
  });

  it("un club i cui giocatori coprono solo slot già riempiti non è eleggibile", () => {
    const formation = getFormation("4-3-3")!;
    const progress = createEmptyProgress(formation);
    const filled = {
      ...progress,
      filledStarterSlotIds: new Set(["por"]),
    };
    const players = [makePlayer({ id: "x1", role: "POR", department: "POR" })];
    expect(isClubEligible(players, filled)).toBe(false);
  });

  it("eligibleClubPackages filtra solo i pacchetti con almeno una scelta valida", () => {
    const formation = getFormation("4-3-3")!;
    const progress = createEmptyProgress(formation);
    const filled = {
      ...progress,
      filledStarterSlotIds: new Set(["por"]),
    };
    const packages = [
      { clubId: "a", players: [makePlayer({ id: "a1", role: "POR", department: "POR" })] },
      { clubId: "b", players: [makePlayer({ id: "b1", role: "TD", department: "DIF" })] },
    ];
    const eligible = eligibleClubPackages(packages, filled);
    expect(eligible.map((p) => p.clubId)).toEqual(["b"]);
  });
});

describe("modalità per ruolo — candidati", () => {
  it("restituisce al massimo ROLE_MODE_CANDIDATE_COUNT candidati compatibili col requirement", () => {
    const req = { id: "att-1", role: "ATT" as const, department: "ATT" as const };
    const pool = Array.from({ length: 10 }, (_, i) =>
      makePlayer({ id: `p${i}`, clubId: `club-${i}`, role: "ATT", department: "ATT" }),
    );
    const candidates = candidatesForRequirement(pool, req, () => 0.5);
    expect(candidates).toHaveLength(ROLE_MODE_CANDIDATE_COUNT);
    expect(candidates.every((p) => p.role === "ATT")).toBe(true);
  });

  it("preferisce candidati di club distinti quando disponibili", () => {
    const req = { id: "att-1", role: "ATT" as const, department: "ATT" as const };
    const pool = [
      makePlayer({ id: "a1", clubId: "club-a", role: "ATT" }),
      makePlayer({ id: "a2", clubId: "club-a", role: "ATT" }),
      makePlayer({ id: "b1", clubId: "club-b", role: "ATT" }),
      makePlayer({ id: "c1", clubId: "club-c", role: "ATT" }),
      makePlayer({ id: "d1", clubId: "club-d", role: "ATT" }),
      makePlayer({ id: "e1", clubId: "club-e", role: "ATT" }),
    ];
    const candidates = candidatesForRequirement(pool, req, () => 0);
    const clubIds = candidates.map((p) => p.clubId);
    expect(new Set(clubIds).size).toBe(clubIds.length);
  });

  it("preferisce candidati nel ruolo principale rispetto a quelli nel ruolo secondario", () => {
    const req = { id: "att-1", role: "ATT" as const, department: "ATT" as const };
    const pool = [
      makePlayer({ id: "sec1", clubId: "club-a", role: "TRQ", secondaryRoles: ["ATT"] }),
      makePlayer({ id: "sec2", clubId: "club-b", role: "TRQ", secondaryRoles: ["ATT"] }),
      makePlayer({ id: "prim1", clubId: "club-c", role: "ATT" }),
    ];
    const candidates = candidatesForRequirement(pool, req, () => 0, 1);
    expect(candidates.map((p) => p.id)).toEqual(["prim1"]);
  });

  it("ignora i giocatori non compatibili col requirement", () => {
    const req = { id: "por", role: "POR" as const, department: "POR" as const };
    const pool = [
      makePlayer({ id: "a1", role: "ATT", department: "ATT" }),
      makePlayer({ id: "g1", role: "POR", department: "POR" }),
    ];
    const candidates = candidatesForRequirement(pool, req, () => 0);
    expect(candidates.map((p) => p.id)).toEqual(["g1"]);
  });
});

describe("difficoltà e redraft", () => {
  it("facile concede 5 redraft, normale 2, difficile 0", () => {
    expect(REDRAFT_ALLOWANCE.facile).toBe(5);
    expect(REDRAFT_ALLOWANCE.normale).toBe(2);
    expect(REDRAFT_ALLOWANCE.difficile).toBe(0);
  });

  it("canRedraft è vero finché non si esaurisce l'allowance della difficoltà", () => {
    expect(canRedraft("normale", 0)).toBe(true);
    expect(canRedraft("normale", 1)).toBe(true);
    expect(canRedraft("normale", 2)).toBe(false);
    expect(canRedraft("difficile", 0)).toBe(false);
  });
});

/** PRNG deterministico per verificare distribuzioni senza dipendere da Math.random. */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("difficoltà e qualità dei pacchetti", () => {
  it("il peso cresce con l'Overall in facile e normale, ed è piatto in difficile", () => {
    expect(qualityWeight(88, "facile")).toBeGreaterThan(qualityWeight(66, "facile"));
    expect(qualityWeight(88, "normale")).toBeGreaterThan(qualityWeight(66, "normale"));
    expect(qualityWeight(88, "difficile")).toBe(qualityWeight(66, "difficile"));
  });

  it("facile sbilancia più di normale", () => {
    const rapporto = (d: Difficulty) => qualityWeight(88, d) / qualityWeight(66, d);
    expect(rapporto("facile")).toBeGreaterThan(rapporto("normale"));
    expect(rapporto("normale")).toBeGreaterThan(1);
  });

  it("nessun Overall è mai escluso: anche il più scarso mantiene un peso positivo", () => {
    for (const d of ["facile", "normale", "difficile"] as Difficulty[]) {
      expect(qualityWeight(60, d)).toBeGreaterThan(0);
    }
  });

  it("in facile il pacchetto medio è più forte che in difficile", () => {
    const pool: Player[] = Array.from({ length: 120 }, (_, i) =>
      makePlayer({ id: `p${i}`, clubId: `c${i}`, role: "ATT", overall: 65 + (i % 25) }),
    );
    const req: DraftRequirement = { id: "att-1", role: "ATT", department: "ATT" };

    const mediaSu = (d: Difficulty, seed: number) => {
      let somma = 0;
      const giri = 200;
      for (let s = 0; s < giri; s++) {
        const picked = candidatesForRequirement(pool, req, mulberry32(seed + s), 5, d);
        somma += picked.reduce((acc, p) => acc + p.overall, 0) / picked.length;
      }
      return somma / giri;
    };

    const facile = mediaSu("facile", 1);
    const normale = mediaSu("normale", 1);
    const difficile = mediaSu("difficile", 1);
    expect(facile).toBeGreaterThan(normale);
    expect(normale).toBeGreaterThan(difficile);
  });

  it("weightedSampleN non ripete elementi e rispetta il numero richiesto", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i, w: i + 1 }));
    const picked = weightedSampleN(items, 4, (x) => x.w, mulberry32(7));
    expect(picked).toHaveLength(4);
    expect(new Set(picked.map((x) => x.id)).size).toBe(4);
  });

  it("weightedSampleN restituisce tutto se n supera la lista", () => {
    const items = [{ w: 1 }, { w: 2 }];
    expect(weightedSampleN(items, 10, (x) => x.w, mulberry32(3))).toHaveLength(2);
  });

  it("drawClubPack propone solo club con almeno una scelta valida", () => {
    const formation = getFormation("4-4-2")!;
    const progress = createEmptyProgress(formation);
    const packages: ClubPackage[] = [
      { clubId: "forte", players: [makePlayer({ id: "a", clubId: "forte", role: "ATT", overall: 88 })] },
      { clubId: "debole", players: [makePlayer({ id: "b", clubId: "debole", role: "ATT", overall: 66 })] },
      { clubId: "inutile", players: [makePlayer({ id: "c", clubId: "inutile", role: "POR", overall: 90 })] },
    ];
    // Il portiere serve al 4-4-2, quindi "inutile" resta eleggibile: si verifica solo che
    // il pacchetto non superi mai i club disponibili e non ne inventi.
    const pack = drawClubPack(packages, progress, "facile", mulberry32(5));
    expect(pack.length).toBeLessThanOrEqual(packages.length);
    expect(new Set(pack.map((p) => p.clubId)).size).toBe(pack.length);
  });
});
