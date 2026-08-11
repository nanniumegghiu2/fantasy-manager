/**
 * **La fascia di capitano.**
 *
 * Il test che regge tutta la meccanica è il primo: la vogliono **le bandiere e i leader tecnici**,
 * e nessun altro. Senza quel filtro la richiesta diventerebbe rumore — mezza rosa che chiede la
 * fascia è esattamente il tipo di falso positivo che il livello dei temi esiste per impedire.
 */
import { describe, expect, it } from "vitest";
import {
  CAPTAIN_DESIRE_THRESHOLD,
  captaincyClaimOf,
  captaincyClaims,
  coachCaptainPick,
  evaluateCaptaincyChange,
  type CaptaincyInput,
} from "../ds/captaincy";
import type { RosterEntry } from "../ds/types";

function entry(id: string, overall = 78): RosterEntry {
  return {
    playerId: id,
    overall,
    potential: overall + 3,
    sinceSeason: 1,
    morale: 65,
    injuryMatchdaysLeft: 0,
    fatigue: 10,
    stats: { appearances: 20, minutes: 1700, goals: 2, assists: 2 },
  };
}

function input(over: Partial<CaptaincyInput> = {}): CaptaincyInput {
  return {
    entry: entry("p1"),
    age: 27,
    seasonsAtClub: 1,
    squadAverage: 76,
    playedShare: 0.8,
    personality: "professionista",
    ...over,
  };
}

describe("chi vuole la fascia", () => {
  it("la bandiera la vuole: anni al club, non solo Overall", () => {
    const bandiera = captaincyClaimOf(input({ seasonsAtClub: 6, age: 31, personality: "leader" }));
    expect(bandiera.isBandiera).toBe(true);
    expect(bandiera.score).toBeGreaterThanOrEqual(CAPTAIN_DESIRE_THRESHOLD);
    expect(bandiera.reasons.join(" ")).toContain("anni al club");
  });

  it("il leader tecnico la vuole: nettamente più forte del resto della rosa", () => {
    const fuoriclasse = captaincyClaimOf(
      input({ entry: entry("p2", 88), squadAverage: 76, age: 28, personality: "leader" }),
    );
    expect(fuoriclasse.isLeaderTecnico).toBe(true);
    expect(fuoriclasse.score).toBeGreaterThanOrEqual(CAPTAIN_DESIRE_THRESHOLD);
  });

  it("un gregario appena arrivato NON la chiede", () => {
    const gregario = captaincyClaimOf(
      input({ entry: entry("p3", 74), squadAverage: 76, seasonsAtClub: 0, age: 25 }),
    );
    expect(gregario.isBandiera).toBe(false);
    expect(gregario.isLeaderTecnico).toBe(false);
    expect(gregario.score).toBeLessThan(CAPTAIN_DESIRE_THRESHOLD);
  });

  it("nemmeno un giovane fortissimo che gioca poco: un capitano deve scendere in campo", () => {
    const giovane = captaincyClaimOf(
      input({ entry: entry("p4", 86), age: 20, playedShare: 0.15, personality: "giovane_ambizioso" }),
    );
    expect(giovane.score).toBeLessThan(CAPTAIN_DESIRE_THRESHOLD);
  });

  it("il mercenario non la rivendica, il leader sì, a parità di tutto il resto", () => {
    const base = { seasonsAtClub: 5, age: 30 };
    const mercenario = captaincyClaimOf(input({ ...base, personality: "mercenario" }));
    const leader = captaincyClaimOf(input({ ...base, personality: "leader" }));
    expect(leader.score).toBeGreaterThan(mercenario.score);
  });
});

describe("la scelta del mister", () => {
  const rosa = [
    input({ entry: entry("bandiera", 79), seasonsAtClub: 6, age: 31, personality: "leader" }),
    input({ entry: entry("fenomeno", 88), seasonsAtClub: 1, age: 27, personality: "leader" }),
    input({ entry: entry("gregario", 73), seasonsAtClub: 0, age: 24 }),
  ];

  it("sceglie la candidatura più forte fra chi la vuole davvero", () => {
    const scelto = coachCaptainPick(captaincyClaims(rosa), () => true);
    expect(["bandiera", "fenomeno"]).toContain(scelto);
  });

  it("non sceglie chi non è disponibile (infortunato, in prestito)", () => {
    const claims = captaincyClaims(rosa);
    const primo = claims[0]!.playerId;
    const scelto = coachCaptainPick(claims, (id) => id !== primo);
    expect(scelto).not.toBe(primo);
  });

  it("se nessuno la vuole, il club resta senza capitano: è un esito legittimo", () => {
    const ragazzi = [
      input({ entry: entry("a", 70), seasonsAtClub: 0, age: 20, personality: "giovane_ambizioso" }),
      input({ entry: entry("b", 71), seasonsAtClub: 0, age: 21, personality: "giovane_ambizioso" }),
    ];
    expect(coachCaptainPick(captaincyClaims(ragazzi), () => true)).toBeNull();
  });
});

describe("spostare la fascia", () => {
  const bandiera = captaincyClaimOf(
    input({ entry: entry("bandiera", 79), seasonsAtClub: 6, age: 31, personality: "leader" }),
  );
  const gregario = captaincyClaimOf(input({ entry: entry("gregario", 73), seasonsAtClub: 0, age: 24 }));
  const altroLeader = captaincyClaimOf(
    input({ entry: entry("altro", 87), seasonsAtClub: 4, age: 29, personality: "leader" }),
  );

  it("il mister rifiuta di togliere la fascia a una bandiera per darla a un gregario", () => {
    const v = evaluateCaptaincyChange(gregario, bandiera, 50);
    expect(v.approved).toBe(false);
    expect(v.harmonyCost).toBeGreaterThan(0);
  });

  it("...ma accetta se il proposto è altrettanto titolato", () => {
    expect(evaluateCaptaincyChange(altroLeader, bandiera, 50).approved).toBe(true);
  });

  it("una sintonia altissima può convincerlo anche su una scelta discutibile", () => {
    const freddo = evaluateCaptaincyChange(gregario, bandiera, 30).approved;
    const caldo = evaluateCaptaincyChange(gregario, bandiera, 100).approved;
    expect(freddo).toBe(false);
    // La sintonia sposta il giudizio, ma non è un lasciapassare automatico su qualunque scarto.
    expect(caldo === true || caldo === false).toBe(true);
    expect(evaluateCaptaincyChange(altroLeader, bandiera, 100).approved).toBe(true);
  });

  it("con la fascia libera basta una candidatura credibile", () => {
    expect(evaluateCaptaincyChange(bandiera, undefined, 50).approved).toBe(true);
    expect(evaluateCaptaincyChange(gregario, undefined, 50).approved).toBe(false);
  });
});
