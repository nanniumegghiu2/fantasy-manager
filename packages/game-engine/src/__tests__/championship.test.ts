import { describe, expect, it } from "vitest";
import {
  aggregateRecord,
  AVERAGE_LEAGUE_STRENGTH,
  balancedStrength,
  expectedGoals,
  isPerfectRecord,
  DIFFICULTY_OPPONENT_MODIFIER,
  LEAGUE_SIZE,
  MAX_EXPECTED_GOALS,
  MIN_EXPECTED_GOALS,
  simulateChampionship,
  simulateLeagueSeason,
  simulateSeasonMatches,
} from "../championship";
import type { LeagueTeam, TeamStrength } from "../championship";

/** PRNG deterministico (mulberry32) per test statistici riproducibili, senza Math.random. */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AVERAGE = balancedStrength(AVERAGE_LEAGUE_STRENGTH);

/** Media di più stagioni: legge una tendenza invece di un caso singolo. */
function averageSeason(strength: TeamStrength, seasons = 300) {
  let wins = 0;
  let draws = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (let seed = 0; seed < seasons; seed++) {
    const matches = simulateSeasonMatches(strength, [], mulberry32(seed), AVERAGE);
    const record = aggregateRecord(matches);
    wins += record.wins;
    draws += record.draws;
    goalsFor += matches.reduce((sum, m) => sum + m.goalsFor, 0);
    goalsAgainst += matches.reduce((sum, m) => sum + m.goalsAgainst, 0);
  }
  return {
    wins: wins / seasons,
    draws: draws / seasons,
    goalsFor: goalsFor / seasons,
    goalsAgainst: goalsAgainst / seasons,
    points: (wins * 3 + draws) / seasons,
  };
}

describe("expectedGoals", () => {
  it("cresce con l'attacco e cala con la difesa avversaria", () => {
    expect(expectedGoals(90, 70)).toBeGreaterThan(expectedGoals(80, 70));
    expect(expectedGoals(80, 90)).toBeLessThan(expectedGoals(80, 70));
  });

  it("una partita equilibrata vale circa 1.2 gol attesi per squadra (~2.4 a partita)", () => {
    expect(expectedGoals(80, 80)).toBeCloseTo(1.2, 2);
  });

  it("resta dentro estremi credibili anche con scarti assurdi", () => {
    expect(expectedGoals(99, 40)).toBeLessThanOrEqual(MAX_EXPECTED_GOALS);
    expect(expectedGoals(40, 99)).toBeGreaterThanOrEqual(MIN_EXPECTED_GOALS);
  });

  it("il tetto resta in un intervallo sensato di gol per partita", () => {
    // Il tetto è tarato sul 38-0-0 (vedi `pnpm calibrate`), ma non deve mai scivolare in
    // valori da pallamano né scendere così tanto da rendere impossibile una goleada.
    expect(MAX_EXPECTED_GOALS).toBeGreaterThanOrEqual(3);
    expect(MAX_EXPECTED_GOALS).toBeLessThanOrEqual(6);
  });
});

describe("l'Overall determina il posto in classifica", () => {
  it("una rosa scarsa lotta per non retrocedere, una fortissima domina", () => {
    const scarsa = averageSeason(balancedStrength(66));
    const media = averageSeason(AVERAGE);
    const forte = averageSeason(balancedStrength(92));

    expect(scarsa.points).toBeLessThan(media.points);
    expect(media.points).toBeLessThan(forte.points);
    expect(scarsa.points).toBeLessThan(35);
    expect(forte.points).toBeGreaterThan(80);
  });

  it("i punti crescono in modo monotono con la forza della rosa", () => {
    const punti = [66, 72, 78, 84, 90].map((r) => averageSeason(balancedStrength(r), 150).points);
    for (let i = 1; i < punti.length; i++) {
      expect(punti[i]!).toBeGreaterThan(punti[i - 1]!);
    }
  });
});

describe("i rating di reparto plasmano i risultati", () => {
  it("attacco forte e difesa fragile: segna molto E subisce molto", () => {
    const sbilanciata = averageSeason({ attack: 92, defence: 66 });
    const equilibrata = averageSeason(balancedStrength(79));
    expect(sbilanciata.goalsFor).toBeGreaterThan(equilibrata.goalsFor);
    expect(sbilanciata.goalsAgainst).toBeGreaterThan(equilibrata.goalsAgainst);
  });

  it("difesa forte e attacco spuntato: subisce poco ma segna poco", () => {
    const catenaccio = averageSeason({ attack: 66, defence: 92 });
    const equilibrata = averageSeason(balancedStrength(79));
    expect(catenaccio.goalsAgainst).toBeLessThan(equilibrata.goalsAgainst);
    expect(catenaccio.goalsFor).toBeLessThan(equilibrata.goalsFor);
  });
});

describe("difficoltà del 38-0-0 (sez. CLAUDE.md 3.5)", () => {
  /**
   * La rosa più forte **realmente costruibile** dal database, misurata con `pnpm calibrate`
   * in `packages/data-scripts`: il miglior giocatore disponibile per ognuna delle 11 caselle,
   * più l'intesa che quella rosa ottiene davvero. Prima qui c'era `{99, 99}`, che non
   * corrisponde a nessuna rosa possibile — nessun giocatore del pool arriva a 99 e un'intesa
   * piena richiederebbe 11 compagni di club, quindi Overall molto più bassi.
   */
  const perfetta: TeamStrength = { attack: 100, defence: 95 };

  /**
   * Un campionato con una distribuzione di forze realistica: una corazzata, qualche squadra
   * da Europa, il grosso a metà classifica e alcune materiali da retrocessione. Serve perché
   * il 38-0-0 dipende quasi tutto dalle **avversarie più forti** — misurarlo contro 19 copie
   * della squadra media (com'era prima) dava un numero che non corrisponde a nessuna
   * competizione vera e che si scollava dalla calibrazione reale (`pnpm calibrate`).
   */
  const CAMPIONATO: LeagueTeam[] = [96, 90, 88, 86, 85, 84, 83, 82, 82, 81, 81, 80, 80, 79, 78, 77, 76, 75, 74].map(
    (rating, i) => ({ id: `t${i}`, name: `Squadra ${i}`, rating, strength: balancedStrength(rating) }),
  );

  function perfectRate(strength: TeamStrength, seasons: number, seed = 1): number {
    const random = mulberry32(seed);
    let perfect = 0;
    for (let i = 0; i < seasons; i++) {
      const season = simulateLeagueSeason(strength, [], CAMPIONATO, random);
      if (isPerfectRecord(aggregateRecord(season.userMatches))) perfect++;
    }
    return perfect / seasons;
  }

  it("a rosa massima il record perfetto è raro ma reale", () => {
    // Sez. 3.5: ~1% con la rosa più forte davvero costruibile, nella competizione più
    // abbordabile — raro ma reale. La banda è larga perché il campionato di prova è
    // sintetico; il numero preciso lo fissa `pnpm calibrate` sul database vero.
    const rate = perfectRate(perfetta, 4000);
    expect(rate).toBeGreaterThan(0.002);
    expect(rate).toBeLessThan(0.1);
  });

  it("bastano pochi punti di Overall in meno perché il 38-0-0 svanisca", () => {
    const massima = perfectRate(perfetta, 3000);
    const menoQuattro = perfectRate(
      { attack: perfetta.attack - 4, defence: perfetta.defence - 4 },
      3000,
      2,
    );
    expect(menoQuattro).toBeLessThan(massima / 3);
  });

  it("con una rosa normale il 38-0-0 non capita mai", () => {
    let perfect = 0;
    for (let seed = 0; seed < 500; seed++) {
      const record = aggregateRecord(simulateSeasonMatches(AVERAGE, [], mulberry32(seed), AVERAGE));
      if (isPerfectRecord(record)) perfect++;
    }
    expect(perfect).toBe(0);
  });

  it("anche a rosa massima si perde qualche partita: nessuna vittoria è garantita", () => {
    const stagione = averageSeason(perfetta, 200);
    expect(stagione.wins).toBeLessThan(38);
  });
});

describe("simulateChampionship", () => {
  it("gioca sempre esattamente 38 partite", () => {
    const result = simulateChampionship(80, mulberry32(1));
    expect(result.wins + result.draws + result.losses).toBe(38);
  });

  it("accetta sia un rating singolo sia attacco/difesa separati", () => {
    expect(simulateChampionship(80, mulberry32(2))).toBeDefined();
    expect(simulateChampionship({ attack: 85, defence: 70 }, mulberry32(2))).toBeDefined();
  });
});

describe("isPerfectRecord", () => {
  it("è vero solo per 38-0-0", () => {
    expect(isPerfectRecord({ wins: 38, draws: 0, losses: 0 })).toBe(true);
    expect(isPerfectRecord({ wins: 37, draws: 1, losses: 0 })).toBe(false);
    expect(isPerfectRecord({ wins: 38, draws: 0, losses: 1 })).toBe(false);
  });
});

describe("simulateSeasonMatches", () => {
  it("produce 38 partite con gol coerenti con marcatori ed eventi", () => {
    const matches = simulateSeasonMatches(
      balancedStrength(85),
      [{ id: "a", weight: 1 }],
      mulberry32(9),
    );
    expect(matches).toHaveLength(38);
    for (const match of matches) {
      expect(match.goalsFor).toBeGreaterThanOrEqual(0);
      expect(match.scorerIds).toHaveLength(match.goalsFor);
      expect(match.events.filter((e) => e.team === "for")).toHaveLength(match.goalsFor);
      expect(match.events.filter((e) => e.team === "against")).toHaveLength(match.goalsAgainst);
    }
  });

  it("l'esito è sempre coerente con il punteggio", () => {
    for (const match of simulateSeasonMatches(balancedStrength(80), [], mulberry32(11))) {
      const atteso =
        match.goalsFor > match.goalsAgainst
          ? "win"
          : match.goalsFor === match.goalsAgainst
            ? "draw"
            : "loss";
      expect(match.outcome).toBe(atteso);
    }
  });

  it("gli eventi sono ordinati per minuto, tra 1 e 90", () => {
    for (const match of simulateSeasonMatches(balancedStrength(88), [], mulberry32(13))) {
      const minuti = match.events.map((e) => e.minute);
      expect([...minuti].sort((a, b) => a - b)).toEqual(minuti);
      for (const m of minuti) {
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(90);
      }
    }
  });
});

describe("simulateLeagueSeason", () => {
  const opponents: LeagueTeam[] = Array.from({ length: 19 }, (_, i) => ({
    id: `club-${i}`,
    name: `Club ${i}`,
    rating: 70 + i,
  }));

  it("produce una classifica di 20 squadre, ognuna con 38 partite giocate", () => {
    const season = simulateLeagueSeason(balancedStrength(85), [], opponents, mulberry32(1));
    expect(season.standings).toHaveLength(LEAGUE_SIZE);
    for (const row of season.standings) expect(row.played).toBe(38);
  });

  it("il calendario è sorteggiato: due stagioni non hanno lo stesso ordine di avversarie", () => {
    const prima = simulateLeagueSeason(balancedStrength(85), [], opponents, mulberry32(1));
    const seconda = simulateLeagueSeason(balancedStrength(85), [], opponents, mulberry32(2));
    expect(seconda.userOpponents).not.toEqual(prima.userOpponents);
  });

  it("...ma resta un calendario valido: ogni avversaria affrontata esattamente due volte", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const season = simulateLeagueSeason(balancedStrength(85), [], opponents, mulberry32(seed));
      expect(season.userOpponents).toHaveLength(38);
      const counts = new Map<string, number>();
      for (const name of season.userOpponents) counts.set(name, (counts.get(name) ?? 0) + 1);
      expect(counts.size).toBe(19);
      expect([...counts.values()].every((n) => n === 2)).toBe(true);
    }
  });

  it("le 38 partite hanno un'avversaria diversa a ogni giornata di andata", () => {
    const season = simulateLeagueSeason(balancedStrength(85), [], opponents, mulberry32(2));
    expect(season.userMatches).toHaveLength(38);
    expect(new Set(season.userOpponents.slice(0, 19)).size).toBe(19);
    expect(new Set(season.userOpponents).size).toBe(19);
  });

  it("gol fatti e subiti del campionato si bilanciano", () => {
    const season = simulateLeagueSeason(balancedStrength(80), [], opponents, mulberry32(3));
    const scored = season.standings.reduce((sum, r) => sum + r.goalsFor, 0);
    const conceded = season.standings.reduce((sum, r) => sum + r.goalsAgainst, 0);
    expect(scored).toBe(conceded);
  });

  it("la classifica è ordinata per punti, poi differenza reti, poi gol fatti", () => {
    const season = simulateLeagueSeason(balancedStrength(80), [], opponents, mulberry32(4));
    for (let i = 1; i < season.standings.length; i++) {
      const above = season.standings[i - 1]!;
      const below = season.standings[i]!;
      expect(above.position).toBe(i);
      expect(
        above.points > below.points ||
          (above.points === below.points && above.goalDifference > below.goalDifference) ||
          (above.points === below.points &&
            above.goalDifference === below.goalDifference &&
            above.goalsFor >= below.goalsFor),
      ).toBe(true);
    }
  });

  it("i punti di ogni riga corrispondono a 3 per vittoria + 1 per pareggio", () => {
    const season = simulateLeagueSeason(balancedStrength(85), [], opponents, mulberry32(5));
    for (const row of season.standings) {
      expect(row.points).toBe(row.wins * 3 + row.draws);
      expect(row.goalDifference).toBe(row.goalsFor - row.goalsAgainst);
    }
  });

  it("una rosa fortissima vince il campionato, una scarsa finisce in fondo", () => {
    const strong = simulateLeagueSeason(balancedStrength(96), [], opponents, mulberry32(6));
    const weak = simulateLeagueSeason(balancedStrength(62), [], opponents, mulberry32(6));
    expect(strong.standings.find((r) => r.isUser)!.position).toBe(1);
    expect(weak.standings.find((r) => r.isUser)!.position).toBeGreaterThan(15);
  });

  it("la forza dell'avversaria conta: contro le più deboli si segna di più", () => {
    const deboli: LeagueTeam[] = Array.from({ length: 19 }, (_, i) => ({
      id: `d${i}`,
      name: `D${i}`,
      rating: 64,
    }));
    const forti: LeagueTeam[] = Array.from({ length: 19 }, (_, i) => ({
      id: `f${i}`,
      name: `F${i}`,
      rating: 90,
    }));
    const golDi = (teams: LeagueTeam[]) =>
      simulateLeagueSeason(balancedStrength(80), [], teams, mulberry32(21)).standings.find(
        (r) => r.isUser,
      )!.goalsFor;
    expect(golDi(deboli)).toBeGreaterThan(golDi(forti));
  });
});

describe("simulateLeagueSeason — campionato sempre a 20 squadre", () => {
  it("non esplode e resta a 38 giornate senza avversarie", () => {
    const season = simulateLeagueSeason(balancedStrength(90), [], [], mulberry32(11));
    expect(season.standings).toHaveLength(LEAGUE_SIZE);
    expect(season.userMatches).toHaveLength(38);
    for (const row of season.standings) expect(row.played).toBe(38);
  });

  it("completa il campionato se il pool ha meno club del necessario", () => {
    const few: LeagueTeam[] = [
      { id: "a", name: "A", rating: 80 },
      { id: "b", name: "B", rating: 84 },
      { id: "c", name: "C", rating: 76 },
    ];
    const season = simulateLeagueSeason(balancedStrength(92), [], few, mulberry32(12));
    expect(season.standings).toHaveLength(LEAGUE_SIZE);
    expect(season.userMatches).toHaveLength(38);
    expect(season.standings.map((r) => r.name)).toEqual(expect.arrayContaining(["A", "B", "C"]));
  });

  it("ignora le avversarie in eccesso oltre le 19", () => {
    const many: LeagueTeam[] = Array.from({ length: 40 }, (_, i) => ({
      id: `c${i}`,
      name: `C${i}`,
      rating: 70 + (i % 20),
    }));
    const season = simulateLeagueSeason(balancedStrength(90), [], many, mulberry32(13));
    expect(season.standings).toHaveLength(LEAGUE_SIZE);
    expect(season.userMatches).toHaveLength(38);
  });
});

describe("marcatori dell'avversaria", () => {
  const withScorers: LeagueTeam[] = Array.from({ length: 19 }, (_, i) => ({
    id: `club-${i}`,
    name: `Club ${i}`,
    rating: 70 + i,
    scorers: [
      { id: `p${i}-a`, weight: 3 },
      { id: `p${i}-b`, weight: 1 },
    ],
  }));

  it("ogni gol subito ha un marcatore reale dell'avversaria di quella giornata", () => {
    const season = simulateLeagueSeason(balancedStrength(72), [], withScorers, mulberry32(21));
    let conceded = 0;
    season.userMatches.forEach((match, day) => {
      const index = Number(season.userOpponents[day]!.replace("Club ", ""));
      for (const event of match.events) {
        if (event.team !== "against") continue;
        conceded++;
        expect(event.scorerId).not.toBeNull();
        expect(event.scorerId!.startsWith(`p${index}-`)).toBe(true);
      }
    });
    expect(conceded).toBeGreaterThan(0);
  });

  it("senza marcatori dell'avversaria i gol subiti restano senza nome", () => {
    const noScorers: LeagueTeam[] = withScorers.map(({ scorers: _drop, ...rest }) => rest);
    const season = simulateLeagueSeason(balancedStrength(72), [], noScorers, mulberry32(21));
    const against = season.userMatches.flatMap((m) => m.events.filter((e) => e.team === "against"));
    expect(against.length).toBeGreaterThan(0);
    for (const event of against) expect(event.scorerId).toBeNull();
  });
});

describe("difficoltà del campionato", () => {
  it("il modificatore delle avversarie cresce con la difficoltà", () => {
    expect(DIFFICULTY_OPPONENT_MODIFIER.facile).toBeLessThan(DIFFICULTY_OPPONENT_MODIFIER.normale);
    expect(DIFFICULTY_OPPONENT_MODIFIER.normale).toBeLessThan(DIFFICULTY_OPPONENT_MODIFIER.difficile);
  });

  it("a facile si fanno più punti che a difficile, a parità di rosa", () => {
    // La difficoltà deve pesare sul CAMPIONATO, non solo sul draft: prima le avversarie
    // erano identiche ai tre livelli e in Superlega anche a "facile" si affrontavano i 19
    // club più forti d'Europa.
    const squad: TeamStrength = { attack: 84, defence: 84 };
    const points = (difficulty: "facile" | "normale" | "difficile") => {
      const modifier = DIFFICULTY_OPPONENT_MODIFIER[difficulty];
      const opponents: LeagueTeam[] = Array.from({ length: 19 }, (_, i) => ({
        id: `c${i}`,
        name: `Club ${i}`,
        rating: 80,
        strength: balancedStrength(80 + modifier),
      }));
      let total = 0;
      const random = mulberry32(4);
      for (let i = 0; i < 120; i++) {
        const row = simulateLeagueSeason(squad, [], opponents, random).standings.find((r) => r.isUser)!;
        total += row.points;
      }
      return total / 120;
    };
    const facile = points("facile");
    const normale = points("normale");
    const difficile = points("difficile");
    expect(facile).toBeGreaterThan(normale);
    expect(normale).toBeGreaterThan(difficile);
  });
});
