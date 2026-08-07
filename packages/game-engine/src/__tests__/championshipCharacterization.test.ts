/**
 * **Rete di sicurezza per il rifacimento del motore** (DS mode, fase 0).
 *
 * `championship.ts` sta per essere rifattorizzato in simulazione **incrementale**
 * (`createLeagueState` / `simulateMatchday` / `buildStandings`) perché la DS mode deve
 * avanzare una giornata alla volta, con lo stato che evolve fra una giornata e l'altra.
 * `simulateLeagueSeason` diventerà un wrapper sopra i nuovi pezzi.
 *
 * Il problema: **gli altri test di `championship.test.ts` non basterebbero ad accorgersi di
 * una regressione.** Sono statistici ("una rosa scarsa fa meno punti di una forte") o
 * strutturali ("38 partite, 20 squadre"), quindi passerebbero anche se il rifacimento
 * cambiasse *tutti* i risultati — e con essi la calibrazione di `pnpm calibrate`, che è la
 * cosa più costosa da ricostruire del progetto.
 *
 * Questo test invece **congela l'output esatto** di una stagione con seed fisso: ogni
 * risultato, ogni marcatore, ogni minuto, ogni riga di classifica. Se dopo il rifacimento il
 * digest non combacia, il motore non è più lo stesso e va indagato prima di proseguire.
 *
 * ⚠️ **Non aggiornare i valori attesi per far passare il test.** Se cambiano, o il rifacimento
 * ha alterato il comportamento (da correggere), oppure si è deliberatamente cambiata una
 * costante di bilanciamento — e in quel caso il valore va rigenerato *insieme* a una voce nel
 * Decision Log che spieghi perché.
 */
import { describe, expect, it } from "vitest";
import { simulateLeagueSeason } from "../championship";
import type { LeagueTeam } from "../championship";

/** PRNG deterministico, identico a quello usato dagli altri test del motore. */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Scenario volutamente "scomodo": 19 avversarie tutte di forza diversa, attacco e difesa
 * asimmetrici, e pool marcatori non uniformi. Una stagione con squadre tutte uguali
 * nasconderebbe proprio gli errori che questo test deve intercettare (accoppiamenti
 * sbagliati, casa/trasferta invertite, marcatori pescati dal pool sbagliato).
 */
const OPPONENTS: LeagueTeam[] = Array.from({ length: 19 }, (_, i) => ({
  id: `club-${i}`,
  name: `Club ${i}`,
  rating: 68 + i,
  strength: { attack: 68 + i, defence: 70 + i },
  scorers: [
    { id: `p-${i}-a`, weight: 3 },
    { id: `p-${i}-b`, weight: 1.5 },
  ],
}));

const OWN_SCORERS = [
  { id: "own-1", weight: 3 },
  { id: "own-2", weight: 2 },
  { id: "own-3", weight: 1 },
];

const SEED = 20260730;

/** Serializza l'intera stagione in una stringa stabile: nulla dell'output resta fuori. */
function serializeSeason(season: ReturnType<typeof simulateLeagueSeason>): string {
  const matches = season.userMatches
    .map(
      (m) =>
        `${m.goalsFor}-${m.goalsAgainst}${m.outcome[0]}|${m.scorerIds.join(",")}|${m.events
          .map((e) => `${e.minute}${e.team[0]}${e.kind[0]}${e.scorerId ?? "-"}`)
          .join(";")}`,
    )
    .join("\n");
  const table = season.standings
    .map(
      (r) =>
        `${r.position} ${r.teamId} ${r.played} ${r.wins}/${r.draws}/${r.losses} ${r.goalsFor}:${r.goalsAgainst} ${r.points}`,
    )
    .join("\n");
  return [matches, season.userOpponents.join(","), table].join("\n===\n");
}

/** FNV-1a a 32 bit: stabile fra versioni di Node, a differenza di un hash di libreria. */
function digest(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function runReferenceSeason() {
  return simulateLeagueSeason(
    { attack: 84, defence: 81 },
    OWN_SCORERS,
    OPPONENTS,
    mulberry32(SEED),
  );
}

describe("championship — comportamento congelato (rete di sicurezza per il refactor)", () => {
  it("l'intera stagione ha lo stesso digest di prima del refactor", () => {
    const serialized = serializeSeason(runReferenceSeason());
    // Se questo fallisce, gli assert leggibili qui sotto dicono *cosa* è cambiato.
    expect({ digest: digest(serialized), length: serialized.length }).toEqual({
      digest: "445a7ec5",
      length: 2660,
    });
  });

  it("la stagione della propria squadra è quella attesa", () => {
    const user = runReferenceSeason().standings.find((row) => row.isUser)!;
    expect({
      position: user.position,
      wins: user.wins,
      draws: user.draws,
      losses: user.losses,
      goalsFor: user.goalsFor,
      goalsAgainst: user.goalsAgainst,
      points: user.points,
    }).toEqual({
      position: 5,
      wins: 20,
      draws: 9,
      losses: 9,
      goalsFor: 71,
      goalsAgainst: 42,
      points: 69,
    });
  });

  it("la classifica e il calendario sono quelli attesi", () => {
    const season = runReferenceSeason();
    expect(season.standings.slice(0, 3).map((r) => `${r.teamId}:${r.points}`)).toEqual([
      "club-14:88",
      "club-17:87",
      "club-18:85",
    ]);
    // Il calendario è sorteggiato: congelarne l'inizio verifica che il consumo del PRNG da
    // parte del sorteggio non sia cambiato, cosa che sposterebbe *tutti* i risultati.
    expect(season.userOpponents.slice(0, 5)).toEqual([
      "Club 4",
      "Club 11",
      "Club 1",
      "Club 14",
      "Club 7",
    ]);
  });

  it("la prima partita è identica fin nei minuti e nei marcatori", () => {
    const first = runReferenceSeason().userMatches[0]!;
    expect(first).toEqual({
      outcome: "win",
      goalsFor: 4,
      goalsAgainst: 0,
      // `scorerIds` resta in ordine di generazione, `events` viene riordinato per minuto:
      // è il comportamento attuale, e va preservato dal refactor.
      scorerIds: ["own-1", "own-3", "own-2", "own-2"],
      events: [
        { minute: 35, team: "for", kind: "goal", scorerId: "own-3" },
        { minute: 55, team: "for", kind: "goal", scorerId: "own-2" },
        { minute: 78, team: "for", kind: "goal", scorerId: "own-1" },
        { minute: 86, team: "for", kind: "goal", scorerId: "own-2" },
      ],
    });
  });

  it("è riproducibile: due esecuzioni con lo stesso seed danno lo stesso risultato", () => {
    expect(serializeSeason(runReferenceSeason())).toBe(serializeSeason(runReferenceSeason()));
  });
});
