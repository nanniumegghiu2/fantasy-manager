/**
 * Il mondo IA degli allenatori: chi allena chi fra le squadre con un segnale vero, e come
 * cambia — esoneri e assunzioni — quando quel segnale è cattivo.
 */
import { describe, expect, it } from "vitest";
import { assignInitialCoaches, evolveCoaches, type AiClubSeasonInfo } from "../ds/aiCoaches";
import { findCoach } from "../ds/coaches";

function club(id: string, prestige: number, extra: Partial<AiClubSeasonInfo> = {}): AiClubSeasonInfo {
  return { id, name: `Club ${id}`, prestige, squadAverage: 60 + prestige * 6, ...extra };
}

describe("assegnazione iniziale", () => {
  it("assegna un allenatore diverso a ogni club, mai duplicato", () => {
    const clubs = Array.from({ length: 20 }, (_, i) => club(`c${i}`, 1 + (i % 5)));
    const assegnati = assignInitialCoaches(clubs, "seed-1", 1);
    const ids = Object.values(assegnati).map((a) => a.coachId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("è deterministico per lo stesso seme", () => {
    const clubs = Array.from({ length: 10 }, (_, i) => club(`c${i}`, 1 + (i % 5)));
    const a = assignInitialCoaches(clubs, "seed-x", 1);
    const b = assignInitialCoaches(clubs, "seed-x", 1);
    expect(a).toEqual(b);
  });

  it("un club senza candidati liberi resta senza allenatore, non ne inventa uno", () => {
    // Un solo club di prestigio bassissimo, cataloghi già esauriti da club precedenti: non deve
    // esplodere né assegnare un id inventato.
    const clubs = Array.from({ length: 30 }, (_, i) => club(`c${i}`, 1));
    const assegnati = assignInitialCoaches(clubs, "seed-scarso", 1);
    for (const a of Object.values(assegnati)) {
      expect(findCoach(a.coachId)).toBeDefined();
    }
  });
});

describe("evoluzione: esoneri e assunzioni", () => {
  it("un club forte, in linea con le attese, non rischia l'esonero", () => {
    const clubs = [club("top", 5, { leaguePosition: 2, leagueSize: 20, squadAverage: 88 })];
    const iniziali = assignInitialCoaches(clubs, "seed-top", 1);
    let mosseTotali = 0;
    for (let s = 2; s < 30; s++) {
      const { moves } = evolveCoaches(iniziali, clubs, s, "seed-top");
      mosseTotali += moves.length;
    }
    expect(mosseTotali).toBe(0);
  });

  it("un club forte ma in fondo alla classifica rischia davvero l'esonero, su molte stagioni", () => {
    const clubs = [club("deluso", 5, { leaguePosition: 19, leagueSize: 20, squadAverage: 88 })];
    const iniziali = assignInitialCoaches(clubs, "seed-deluso", 1);
    let esoneri = 0;
    let correnti = iniziali;
    for (let s = 2; s < 40; s++) {
      const { assignments, moves } = evolveCoaches(correnti, clubs, s, "seed-deluso");
      correnti = assignments;
      esoneri += moves.length;
    }
    expect(esoneri).toBeGreaterThan(0);
  });

  it("un esonero libera l'allenatore, che il club stesso non può subito riassumere identico", () => {
    const clubs = [club("deluso2", 5, { leaguePosition: 20, leagueSize: 20, squadAverage: 88 })];
    let correnti = assignInitialCoaches(clubs, "seed-libera", 1);
    for (let s = 2; s < 20; s++) {
      const prima = correnti[clubs[0]!.id]?.coachId;
      const { assignments, moves } = evolveCoaches(correnti, clubs, s, "seed-libera");
      correnti = assignments;
      if (moves.length > 0) {
        expect(moves[0]!.firedCoachId).toBe(prima);
        expect(moves[0]!.hiredCoachId).not.toBe(prima);
        return;
      }
    }
  });

  it("senza classifica vera, il segnale è lo scarto fra prestigio e rosa attuale", () => {
    // Prestigio alto ma rosa modestissima: nessuna posizione (club di Corona, non della lega).
    const clubs = [club("coronaDebole", 5, { squadAverage: 62 })];
    const iniziali = assignInitialCoaches(clubs, "seed-corona", 1);
    let mosse = 0;
    let correnti = iniziali;
    for (let s = 2; s < 30; s++) {
      const { assignments, moves } = evolveCoaches(correnti, clubs, s, "seed-corona");
      correnti = assignments;
      mosse += moves.length;
    }
    expect(mosse).toBeGreaterThan(0);
  });

  it("è deterministico per lo stesso seme", () => {
    const clubs = [club("det", 3, { leaguePosition: 18, leagueSize: 20, squadAverage: 70 })];
    const iniziali = assignInitialCoaches(clubs, "seed-det", 1);
    const a = evolveCoaches(iniziali, clubs, 2, "seed-det");
    const b = evolveCoaches(iniziali, clubs, 2, "seed-det");
    expect(a).toEqual(b);
  });
});
