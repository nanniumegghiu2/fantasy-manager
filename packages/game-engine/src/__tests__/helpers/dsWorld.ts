/**
 * **Il mondo di prova della DS mode**, condiviso dai test d'integrazione della carriera.
 *
 * Viveva dentro `dsCareer.test.ts` ed è stato estratto quando è servito allo stesso modo a
 * `dsSigning.test.ts`: due copie della stessa fixture sarebbero divergute alla prima modifica,
 * e una fixture divergente fa passare o fallire i test per la ragione sbagliata — è già
 * successo in questo progetto (Decision Log 2026-07-31).
 *
 * Spostato **verbatim**: se il comportamento dei test cambiasse, la causa sarebbe qui.
 */
import {
  advanceWeek,
  createCareer,
  type CareerState,
  type CareerWorld,
  type ResolvedPlayer,
} from "../../ds/career";
import { createRosterEntry } from "../../ds/roster";
import type { RosterEntry } from "../../ds/types";
import { ROLE_DEPARTMENT } from "@app/shared-types";
import type { Role } from "@app/shared-types";
import type { LeagueTeam } from "../../season/leagueState";

import type { LeagueTeam } from "../season/leagueState";

export const ROLES: Role[] = [
  "POR", "POR", "POR",
  "TD", "TD", "DC", "DC", "DC", "DC", "TS", "TS",
  "QD", "MED", "MED", "QS",
  "ED", "CC", "CC", "CC", "ES",
  "TQD", "TRQ", "TQS",
  "ATT", "ATT", "ATT",
];

/** Un mondo di prova: 26 giocatori nostri, 19 avversarie, campionato a 20 squadre. */
export function buildWorld(overall = 76): { world: CareerWorld; roster: RosterEntry[] } {
  const players: Record<string, ResolvedPlayer> = {};
  const roster: RosterEntry[] = ROLES.map((role, i) => {
    const id = `p${i}`;
    players[id] = {
      id,
      name: `Giocatore ${i}`,
      nation: i % 4 === 0 ? "Italia" : "Francia",
      role,
      secondaryRoles: [],
      department: ROLE_DEPARTMENT[role],
      // Età scaglionate: qualcuno crescerà, qualcuno si ritirerà durante la carriera.
      birthDate: `${1992 + (i % 14)}-05-10`,
    };
    return createRosterEntry({ playerId: id, overall: overall + (i % 7) - 3, potential: overall + 8, sinceSeason: 1 });
  });

  const opponents: LeagueTeam[] = Array.from({ length: 19 }, (_, i) => ({
    id: `club-${i}`,
    name: `Club ${i}`,
    rating: 70 + (i % 12),
    strength: { attack: 70 + (i % 12), defence: 72 + (i % 10) },
  }));

  return {
    world: { players, opponents, clubName: "La mia squadra", leagueRounds: 38 },
    roster,
  };
}

export function newCareer(seed = "abc123", overall = 76) {
  const { world, roster } = buildWorld(overall);
  const state = createCareer({
    seed,
    clubId: "mio",
    leagueId: "serie-a",
    coachId: "c-10",
    roster,
    budget: 10_000_000,
  });
  return { state, world };
}

/** Avanza finché non arriva una decisione o finisce la stagione. */
/**
 * Un DS **competente**: rinnova chiunque vada in scadenza.
 *
 * Serve nei test che misurano il ciclo di vita (ritiri, regen, budget) e non i contratti: senza
 * rinnovi la rosa si svuota e la carriera finisce per esonero (comportamento voluto, coperto da
 * `dsCareerContracts.test.ts`), il che renderebbe impossibile misurare tutto il resto.
 */
export function rinnovaTutti(state: CareerState): CareerState {
  const overrides = { ...(state.contracts?.overrides ?? {}) };
  for (const e of state.roster) {
    overrides[e.playerId] = { until: state.season + 4, wage: 500_000, signedSeason: state.season };
  }
  return {
    ...state,
    contracts: {
      overrides,
      released: state.contracts?.released ?? [],
      preContracts: state.contracts?.preContracts ?? [],
      renewalRefused: state.contracts?.renewalRefused ?? [],
    },
  };
}

export function playSeason(state: CareerState, world: CareerWorld): CareerState {
  let current = rinnovaTutti(state);
  for (let guard = 0; guard < 200; guard++) {
    const { state: next, report } = advanceWeek(current, world, {
      requestResponse: "prometti",
      closeMarket: true,
    });
    current = next;
    if (report.seasonEnded || report.careerEnded) return rinnovaTutti(current);
  }
  throw new Error("La stagione non è terminata: possibile ciclo infinito");
}

/* -------------------------------------------------------------------------- */
/* Un mondo completo: Corona e mercato accesi                                  */
/* -------------------------------------------------------------------------- */

export const CUP_CLUBS = Array.from({ length: 20 }, (_, i) => (i === 0 ? "mio" : `euro-${i}`));
export const CUP_LEAGUES = CUP_CLUBS.map((_, i) => ["serie-a", "premier", "liga", "bundes", "ligue1"][i % 5]!);

/** Aggiunge Corona e mercato al mondo base, così `advanceWeek` li attraversa davvero. */
export function withCupAndMarket(base: { world: CareerWorld; roster: RosterEntry[] }): CareerWorld {
  const cupTeams: Record<string, LeagueTeam> = {};
  for (const [i, id] of CUP_CLUBS.entries()) {
    cupTeams[id] = {
      id,
      name: id === "mio" ? "La mia squadra" : `Europa ${i}`,
      rating: 78 + (i % 8),
      strength: { attack: 78 + (i % 8), defence: 77 + (i % 7) },
    };
  }

  const clubs = Object.fromEntries(
    CUP_CLUBS.filter((id) => id !== "mio").map((id, i) => [
      id,
      {
        id,
        name: `Europa ${i}`,
        leagueId: CUP_LEAGUES[i]!,
        startingEleven: Array.from({ length: 11 }, () => 74 + (i % 6)),
        lastPosition: 1 + (i % 20),
      },
    ]),
  );

  // Un pool di acquistabili: gente vera, con un'età, così i prezzi hanno senso.
  const RUOLI_MERCATO: Role[] = ["POR", "DC", "CC", "ATT"];
  const transferPool = Array.from({ length: 40 }, (_, i) => ({
    playerId: `mercato-${i}`,
    clubId: CUP_CLUBS[1 + (i % 19)]!,
    overall: 68 + (i % 16),
    potential: 84 + (i % 6),
    // Un terzo sono giovani: servono a coprire i prestiti e i filtri per età.
    age: 18 + (i % 15),
    nation: "Italia",
    department: ROLE_DEPARTMENT[RUOLI_MERCATO[i % 4]!],
    stats: { appearances: 30, minutes: 2700, goals: i % 8, assists: i % 5 },
  }));

  const names: Record<string, string> = {};
  for (const p of transferPool) names[p.playerId] = `Acquisto ${p.playerId}`;

  // L'anagrafica del mercato copre **tutto** il pool, non solo la propria rosa: senza, la
  // ricerca non troverebbe nessuno degli acquistabili (è la forma che ha il mondo reale).
  const anagraficaMercato: Record<string, ResolvedPlayer> = { ...base.world.players };
  for (const [i, p] of transferPool.entries()) {
    const ruolo = RUOLI_MERCATO[i % 4]!;
    anagraficaMercato[p.playerId] = {
      id: p.playerId,
      name: names[p.playerId]!,
      nation: p.nation,
      role: ruolo,
      secondaryRoles: [],
      department: ROLE_DEPARTMENT[ruolo],
      birthDate: `${2025 - p.age}-01-01`,
    };
  }

  return {
    ...base.world,
    cupTeams,
    cupEntrants: { clubIds: CUP_CLUBS, leagues: CUP_LEAGUES },
    market: {
      clubs,
      transferPool,
      valuation: {
        leaguePrestigeByClub: Object.fromEntries(CUP_CLUBS.map((id) => [id, 4])),
        clubPrestige: Object.fromEntries(CUP_CLUBS.map((id) => [id, 4])),
        clubsInSameEra: 20,
      },
      players: anagraficaMercato,
      nameOf: (id) => anagraficaMercato[id]?.name ?? id,
      ageOf: (id) => {
        const nato = anagraficaMercato[id]?.birthDate;
        return nato ? 2025 - Number(nato.slice(0, 4)) : 24;
      },
      leagueRounds: 38,
    },
  };
}


/** Una carriera con Corona e mercato accesi: il mondo completo. */
export function fullCareer(seed = "completo", overall = 80) {
  const base = buildWorld(overall);
  const world = withCupAndMarket(base);
  const state = createCareer({
    seed,
    clubId: "mio",
    leagueId: "serie-a",
    coachId: "c-10",
    roster: base.roster,
    budget: 40_000_000,
    cupEntrants: { clubIds: CUP_CLUBS, leagues: CUP_LEAGUES },
  });
  return { state, world };
}
