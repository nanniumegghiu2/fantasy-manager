/**
 * Calibrazione del 38-0-0 (CLAUDE.md sez. 3.5).
 *
 * Serve a rispondere a una domanda che non si può stimare a mente: *qual è la rosa più forte
 * che il database consente davvero di costruire, e che probabilità ha di fare la stagione
 * perfetta?* Il vecchio riferimento era un "rating massimo teorico ~109" (Overall 99 ovunque
 * più bonus intesa pieno) che **non esiste**: nessun giocatore reale è a 99, e una rosa con
 * intesa piena richiederebbe 11 giocatori dello stesso club, quindi con Overall molto più
 * bassi. Calibrare su quel numero significava calibrare sul nulla.
 *
 * Cosa fa:
 *  1. carica il pool reale dal database;
 *  2. per ogni modulo costruisce la **rosa massima**: il miglior giocatore disponibile per
  *     ogni casella (fra tutte quelle in cui può giocare, ruoli secondari compresi), poi
 *     misura l'intesa che quella rosa ottiene davvero;
 *  3. simula N stagioni contro le avversarie reali e misura la frequenza del 38-0-0, sia per
 *     la rosa massima sia per rose via via più deboli.
 *
 * È uno strumento di misura, non di scrittura: non tocca il database.
 */
import {
  BASE_EXPECTED_GOALS,
  GOAL_SCALE,
  MAX_EXPECTED_GOALS,
  MIN_EXPECTED_GOALS,
  FORMATIONS,
  LEAGUE_SIZE,
  aggregateRecord,
  computeChemistryBonus,
  computeChemistryLink,
  computeDepartmentChemistryLinks,
  computeDepartmentRating,
  formationBoardEdges,
  isPerfectRecord,
  simulateLeagueSeason,
} from "@app/game-engine";
import type { LeagueTeam, TeamStrength } from "@app/game-engine";
import type { Department, Formation, Player } from "@app/shared-types";
import { connectDb } from "./db";

const DEPARTMENTS: Department[] = ["POR", "DIF", "CC", "ATT"];

/**
 * Stessi pesi di `apps/web/src/classic/engineHelpers.ts`. Sono duplicati qui di proposito:
 * questo pacchetto non dipende da `apps/web`, e la calibrazione deve poter girare da sola.
 * Se cambiano lì vanno aggiornati anche qui — la sola alternativa sarebbe spostarli nel
 * game-engine, cosa che ha senso fare se un terzo chiamante dovesse averne bisogno.
 */
const ATTACK_MIX: Record<Department, number> = { ATT: 0.62, CC: 0.38, DIF: 0, POR: 0 };
const DEFENCE_MIX: Record<Department, number> = { DIF: 0.55, POR: 0.28, CC: 0.17, ATT: 0 };

/** PRNG deterministico (mulberry32): la calibrazione dev'essere riproducibile. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Overall del giocatore in quella casella (null se non può giocarci). Niente più malus da ruolo secondario. */
function effectiveOverall(player: Player, role: string): number | null {
  const canPlay = player.role === role || player.secondaryRoles.includes(role as Player["role"]);
  return canPlay ? player.overall : null;
}

/**
 * La rosa più forte costruibile con questo modulo: per ogni casella il miglior giocatore
 * ancora libero, a Overall effettivo. Le caselle vengono riempite partendo dalla più
 * **scarsa di alternative** (meno candidati nel pool), così i ruoli rari non si ritrovano
 * svuotati dai ruoli abbondanti che hanno già preso i giocatori migliori.
 */
function bestSquad(formation: Formation, pool: Player[]): Record<string, Player> {
  const candidates = new Map<string, { player: Player; value: number }[]>();
  for (const slot of formation.slots) {
    const list = pool
      .map((player) => ({ player, value: effectiveOverall(player, slot.role) }))
      .filter((c): c is { player: Player; value: number } => c.value !== null)
      .sort((a, b) => b.value - a.value);
    candidates.set(slot.id, list);
  }

  const order = [...formation.slots].sort(
    (a, b) => candidates.get(a.id)!.length - candidates.get(b.id)!.length,
  );

  const taken = new Set<string>();
  const squad: Record<string, Player> = {};
  for (const slot of order) {
    const pick = candidates.get(slot.id)!.find((c) => !taken.has(c.player.id));
    if (!pick) continue;
    taken.add(pick.player.id);
    squad[slot.id] = pick.player;
  }
  return squad;
}

/** Forza offensiva/difensiva della rosa, stessa formula della UI (vedi nota sui mix sopra). */
function squadStrength(
  formation: Formation,
  squad: Record<string, Player>,
): { strength: TeamStrength; chemistry: number; departments: Record<Department, number> } {
  const links = formationBoardEdges(formation)
    .map((edge) => [squad[edge.slotAId], squad[edge.slotBId]] as const)
    .filter(([a, b]) => !!a && !!b)
    .map(([a, b]) => computeChemistryLink(a, b));
  const chemistry = computeChemistryBonus(links);

  const departments = {} as Record<Department, number>;
  for (const department of DEPARTMENTS) {
    const players = Object.values(squad).filter((p) => p.department === department);
    departments[department] = players.length > 0 ? computeDepartmentRating(players) : 60;
  }

  const side = (mix: Record<Department, number>) =>
    Math.round(
      DEPARTMENTS.reduce((sum, d) => sum + mix[d] * departments[d], 0) + chemistry,
    );

  return {
    strength: { attack: side(ATTACK_MIX), defence: side(DEFENCE_MIX) },
    chemistry,
    departments,
  };
}

/** Le 19 avversarie: stessa costruzione di `buildLeagueOpponents` nella UI. */
function buildOpponents(
  pool: Player[],
  clubNames: Map<string, string>,
  /** `null` = Superlega (i 19 club più forti dei Big 5), altrimenti solo quel campionato. */
  league: string | null = null,
): LeagueTeam[] {
  const byClub = new Map<string, Player[]>();
  for (const player of pool.filter((p) => league === null || p.league === league)) {
    const list = byClub.get(player.clubId);
    if (list) list.push(player);
    else byClub.set(player.clubId, [player]);
  }

  const teams: LeagueTeam[] = [...byClub.entries()]
    .map(([clubId, players]) => {
      // L'undici che il club schiererebbe, per reparto — non gli 11 col Overall più alto.
      // Stessa forma di `bestElevenByDepartment` in `engineHelpers.ts`, vedi la nota lì sul
      // portiere fantasma che il vecchio criterio inventava ai grandi club.
      const shape: Record<Department, number> = { POR: 1, DIF: 4, CC: 4, ATT: 2 };
      const best = DEPARTMENTS.flatMap((d) =>
        players.filter((p) => p.department === d).sort((a, b) => b.overall - a.overall).slice(0, shape[d]),
      );
      const rating = best.reduce((s, p) => s + p.overall, 0) / best.length;
      const byDepartment = (department: Department) => {
        const group = best.filter((p) => p.department === department);
        return group.length > 0 ? group.reduce((s, p) => s + p.overall, 0) / group.length : rating;
      };
      // L'intesa vale anche per le avversarie: sono compagni di squadra veri (vedi la nota
      // in `buildLeagueOpponents`), quindi se la meritano piena.
      const chemistry = computeChemistryBonus(computeDepartmentChemistryLinks(best));
      return {
        id: clubId,
        name: clubNames.get(clubId) ?? "Club",
        rating: Math.round(rating),
        strength: {
          attack: Math.round(0.62 * byDepartment("ATT") + 0.38 * byDepartment("CC") + chemistry),
          defence: Math.round(
            0.55 * byDepartment("DIF") + 0.28 * byDepartment("POR") + 0.17 * byDepartment("CC") + chemistry,
          ),
        },
      };
    })
    .sort((a, b) => b.rating - a.rating)
    .slice(0, LEAGUE_SIZE - 1);

  // Stesso riempimento di `fillLeague` nel motore: i campionati a 18 club (Bundesliga,
  // Ligue 1) non basterebbero a fare 38 giornate, quindi il motore aggiunge squadre di
  // riempimento con la forza media. Senza replicarlo qui il conto esatto perderebbe due
  // partite e sovrastimerebbe il 38-0-0.
  const needed = LEAGUE_SIZE - 1;
  if (teams.length < needed && teams.length > 0) {
    const averageRating = Math.round(
      teams.reduce((sum, t) => sum + t.rating, 0) / teams.length,
    );
    for (let i = teams.length; i < needed; i++) {
      teams.push({ id: `filler-${i}`, name: `Avversaria ${i + 1}`, rating: averageRating });
    }
  }
  return teams;
}

/* -------------------------------------------------------------------------- */
/* Probabilità esatta del 38-0-0, senza simulare                               */
/* -------------------------------------------------------------------------- */

/**
 * Il 38-0-0 è un evento troppo raro per misurarlo a Monte Carlo: al bersaglio del 6.6%
 * servirebbero decine di migliaia di stagioni per ogni combinazione di costanti provata.
 * Ma la probabilità si calcola in forma chiusa — i gol delle due squadre sono due Poisson
 * indipendenti, quindi P(vittoria) in una partita è una somma finita, e le 38 partite sono
 * indipendenti. Qui si calcola esattamente, e la simulazione resta solo come verifica finale.
 */
const poissonPmf = (lambda: number, k: number) =>
  Math.exp(-lambda + k * Math.log(lambda) - logFactorial(k));

function logFactorial(k: number): number {
  let sum = 0;
  for (let i = 2; i <= k; i++) sum += Math.log(i);
  return sum;
}

/**
 * Distribuzione dei gol di una squadra, **saturata** a `MAX_GOALS_PER_MATCH` esattamente come
 * fa `poissonSample` nel motore: tutta la coda oltre il tetto si accumula sull'ultimo valore,
 * non sparisce. Scartarla invece di accumularla falsava il conto — faceva sembrare che un
 * tetto più basso aumentasse le probabilità di vittoria, che è l'opposto del vero.
 */
function goalDistribution(lambda: number): number[] {
  const pmf = Array.from({ length: MAX_GOALS_PER_MATCH + 1 }, (_, k) => poissonPmf(lambda, k));
  const tail = 1 - pmf.reduce((sum, p) => sum + p, 0);
  pmf[MAX_GOALS_PER_MATCH] += Math.max(tail, 0);
  return pmf;
}

/** P(segniamo più di loro) con gol attesi `lambdaFor` contro `lambdaAgainst`. */
function winProbability(lambdaFor: number, lambdaAgainst: number): number {
  const forPmf = goalDistribution(lambdaFor);
  const againstPmf = goalDistribution(lambdaAgainst);
  let win = 0;
  for (let against = 0; against <= MAX_GOALS_PER_MATCH; against++) {
    for (let forGoals = against + 1; forGoals <= MAX_GOALS_PER_MATCH; forGoals++) {
      win += againstPmf[against] * forPmf[forGoals];
    }
  }
  return win;
}

/** Stesso tetto di `championship.ts`: oltre non si contano gol. */
const MAX_GOALS_PER_MATCH = 7;

interface GoalModel {
  base: number;
  scale: number;
  min: number;
  max: number;
}

const expectedGoalsWith = (model: GoalModel, attack: number, defence: number) =>
  Math.min(Math.max(model.base * Math.exp((attack - defence) / model.scale), model.min), model.max);

/**
 * Quanto spesso il campionato produce **goleade**, cioè partite in cui una squadra segna 4+
 * gol. È il secondo vincolo della taratura: i risultati tennistici erano il difetto più
 * visibile del motore, quindi non basta centrare il 38-0-0 — vanno guardati insieme.
 *
 * Si misura su TUTTE le partite del campionato (le proprie e quelle fra avversarie), perché
 * l'utente le vede tutte in classifica.
 */
function leagueGoalProfile(
  model: GoalModel,
  own: TeamStrength,
  opponents: LeagueTeam[],
): { blowoutRate: number; goalsPerMatch: number } {
  const teams = [own, ...opponents.map((o) => o.strength ?? { attack: o.rating, defence: o.rating })];
  let matches = 0;
  let blowouts = 0;
  let goals = 0;
  for (let i = 0; i < teams.length; i++) {
    for (let j = 0; j < teams.length; j++) {
      if (i === j) continue; // ogni coppia due volte: andata e ritorno
      const lambda = expectedGoalsWith(model, teams[i]!.attack, teams[j]!.defence);
      const pmf = goalDistribution(lambda);
      const pFourPlus = pmf.slice(4).reduce((s, p) => s + p, 0);
      // P(almeno una delle due segni 4+) su una partita: qui si accumula per singolo lato e
      // si divide per due alla fine, perché ogni partita è contata una volta per lato.
      blowouts += pFourPlus;
      goals += lambda;
      matches++;
    }
  }
  return { blowoutRate: blowouts / matches, goalsPerMatch: goals / matches };
}

/**
 * P(38-0-0) esatta: il prodotto delle probabilità di vittoria in tutte le 38 partite
 * (ogni avversaria affrontata due volte, andata e ritorno).
 */
function exactPerfectProbability(
  model: GoalModel,
  own: TeamStrength,
  opponents: LeagueTeam[],
): number {
  let logProduct = 0;
  for (const opponent of opponents) {
    const other = opponent.strength ?? { attack: opponent.rating, defence: opponent.rating };
    const p = winProbability(
      expectedGoalsWith(model, own.attack, other.defence),
      expectedGoalsWith(model, other.attack, own.defence),
    );
    logProduct += 2 * Math.log(p);
  }
  return Math.exp(logProduct);
}

/** Frequenza del 38-0-0 su `seasons` stagioni simulate contro le avversarie reali. */
function perfectRate(
  strength: TeamStrength,
  opponents: LeagueTeam[],
  seasons: number,
  seed: number,
): { perfect: number; nearPerfect: number; averagePoints: number } {
  const random = mulberry32(seed);
  let perfect = 0;
  let nearPerfect = 0;
  let points = 0;
  for (let i = 0; i < seasons; i++) {
    const season = simulateLeagueSeason(strength, [], opponents, random);
    const record = aggregateRecord(season.userMatches);
    if (isPerfectRecord(record)) perfect++;
    else if (record.wins === 37) nearPerfect++;
    points += record.wins * 3 + record.draws;
  }
  return {
    perfect: perfect / seasons,
    nearPerfect: nearPerfect / seasons,
    averagePoints: points / seasons,
  };
}

async function main() {
  const seasons = Number(process.argv.find((a) => a.startsWith("--seasons="))?.split("=")[1] ?? 2000);
  const client = await connectDb();
  const { rows } = await client.query<{
    id: string;
    name: string;
    overall: number;
    club_id: string;
    club: string;
    league: string;
    era: string;
    nation: string;
    role: string;
    secondary_roles: string[];
    department: string;
  }>(
    `select p.id, p.name, p.overall, p.club_id, c.name as club, l.name as league,
            c.era, p.nation, p.role::text as role,
            coalesce(p.secondary_roles::text[], '{}') as secondary_roles,
            p.department
     from player_pool p
     join clubs c on c.id = p.club_id
     join leagues l on l.id = c.league_id`,
  );
  await client.end();

  const clubNames = new Map(rows.map((r) => [r.club_id, r.club]));
  const pool: Player[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    overall: r.overall,
    marketValue: 0,
    clubId: r.club_id,
    era: r.era,
    nation: r.nation,
    league: r.league,
    role: r.role as Player["role"],
    secondaryRoles: r.secondary_roles as Player["secondaryRoles"],
    department: r.department as Department,
  }));

  console.log(`Pool: ${pool.length} giocatori, ${clubNames.size} club\n`);

  /** La rosa più forte costruibile da un dato pool, provando tutti i moduli. */
  const pickBest = (from: Player[]) =>
    FORMATIONS.map((formation) => {
      const squad = bestSquad(formation, from);
      const { strength, chemistry, departments } = squadStrength(formation, squad);
      return { formation, squad, strength, chemistry, departments };
    }).sort(
      (a, b) => b.strength.attack + b.strength.defence - (a.strength.attack + a.strength.defence),
    );

  // 1. La rosa massima, modulo per modulo.
  console.log("== Rosa massima costruibile, per modulo ==");
  const built = pickBest(pool);

  console.table(
    built.map((b) => ({
      modulo: b.formation.name,
      att: b.strength.attack,
      dif: b.strength.defence,
      intesa: b.chemistry,
      POR: b.departments.POR,
      DIF: b.departments.DIF,
      CC: b.departments.CC,
      ATT: b.departments.ATT,
    })),
  );

  const best = built[0];
  console.log(`\nRosa massima: ${best.formation.name} — attacco ${best.strength.attack}, difesa ${best.strength.defence}, intesa ${best.chemistry}`);
  console.table(
    best.formation.slots.map((slot) => {
      const player = best.squad[slot.id];
      return {
        casella: slot.role,
        giocatore: player?.name ?? "—",
        club: player ? clubNames.get(player.clubId) : "—",
        overall: player?.overall ?? 0,
        effettivo: player ? effectiveOverall(player, slot.role) : 0,
      };
    }),
  );

  // 2. La probabilità di 38-0-0, dalla rosa massima a scendere.
  const opponents = buildOpponents(pool, clubNames);
  console.log(`\nAvversarie: ${opponents.length} (dalla più forte: ${opponents.slice(0, 3).map((o) => `${o.name} ${o.rating}`).join(", ")})`);

  // 3. Ricerca congiunta di scala e tetto sui gol attesi.
  //
  // La scala da sola non basta: abbassandola i gol fatti sbattono contro `MAX_EXPECTED_GOALS`
  // e la probabilità satura molto sotto il bersaglio. Il tetto va quindi tarato insieme alla
  // scala, non tenuto fisso.
  const TARGET = 0.066;
  const base = Number(process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? 1.35);
  const competitions: { label: string; teams: LeagueTeam[] }[] = [
    { label: "Superlega", teams: opponents },
    ...[...new Set(pool.map((p) => p.league))].sort().map((league) => ({
      label: league,
      teams: buildOpponents(pool, clubNames, league),
    })),
  ];

  /**
   * Lo scenario migliore che un giocatore può davvero costruire, competizione per
   * competizione. Le due opzioni di `SetupConfig.draftPool` non sono equivalenti e vanno
   * misurate entrambe: pescare da **tutto il database** dà i giocatori più forti ma
   * un'intesa parziale (leghe diverse), pescare dal **solo campionato** dà giocatori più
   * deboli ma intesa piena (stessa lega, stessa epoca). Quale delle due vinca non è ovvio a
   * priori — dipende da quanto vale il bonus intesa rispetto alla differenza di Overall.
   */
  const scenarios = competitions.flatMap((c) => {
    const localPool = c.label === "Superlega" ? pool : pool.filter((p) => p.league === c.label);
    return [
      { competition: c, pool: "tutto il database", ...pickBest(pool)[0]! },
      { competition: c, pool: "solo il campionato", ...pickBest(localPool)[0]! },
    ];
  });

  console.log(`\n== Miglior rosa costruibile, per competizione e pool di draft ==`);
  console.table(
    scenarios.map((s) => ({
      competizione: s.competition.label,
      "pool del draft": s.pool,
      att: s.strength.attack,
      dif: s.strength.defence,
      intesa: s.chemistry,
    })),
  );

  console.log(`\n== Ricerca di scala e tetto (bersaglio ${(TARGET * 100).toFixed(1)}% nella competizione più facile) ==`);
  let bestModel: GoalModel = { base, scale: 20, min: 0.15, max: 4.5 };
  let bestGap = Infinity;
  /**
   * Tetto sulle goleade: nei campionati veri le partite in cui una squadra segna 4+ gol sono
   * circa il 6-9% del totale. Sopra questa soglia i "risultati tennistici" smettono di essere
   * un evento memorabile e diventano la norma — che è esattamente il difetto segnalato.
   */
  const MAX_BLOWOUT_RATE = 0.09;

  /** Rendimento di un modello: 38-0-0 nello scenario migliore + quanto è "tennistico" il campionato. */
  const evaluate = (model: GoalModel) => {
    const perfect = Math.max(
      ...scenarios.map((s) => exactPerfectProbability(model, s.strength, s.competition.teams)),
    );
    // Le goleade si misurano su una rosa normale, non sulla corazzata: è la partita che
    // l'utente medio vede.
    const profiles = competitions.map((c) =>
      leagueGoalProfile(model, { attack: 78, defence: 78 }, c.teams),
    );
    return {
      perfect,
      blowoutRate: profiles.reduce((s, p) => s + p.blowoutRate, 0) / profiles.length,
      goalsPerMatch: profiles.reduce((s, p) => s + p.goalsPerMatch, 0) / profiles.length,
    };
  };

  const grid: Record<string, string | number>[] = [];
  for (let modelBase = 1.0; modelBase <= 1.4; modelBase += 0.05) {
    for (let scale = 8; scale <= 20; scale += 0.5) {
      for (let max = 2.5; max <= 5; max += 0.25) {
        const model: GoalModel = { base: modelBase, scale, min: 0.15, max };
        const { perfect, blowoutRate } = evaluate(model);
        // Vincolo duro sulle goleade, poi si sceglie chi si avvicina di più al bersaglio.
        if (blowoutRate > MAX_BLOWOUT_RATE) continue;
        const gap = Math.abs(perfect - TARGET);
        if (gap < bestGap) {
          bestGap = gap;
          bestModel = model;
        }
      }
    }
  }
  // Griglia leggibile attorno al modello scelto, per far vedere il compromesso.
  for (const modelBase of [1.0, 1.1, 1.2, 1.3, 1.35]) {
    for (const [scale, max] of [
      [10, 4.75],
      [11, 4.75],
      [12, 4.75],
      [11, 4],
      [12, 4],
    ] as [number, number][]) {
      const model: GoalModel = { base: modelBase, scale, min: 0.15, max };
      const { perfect, blowoutRate, goalsPerMatch } = evaluate(model);
      grid.push({
        base: modelBase.toFixed(2),
        scale,
        tetto: max,
        "38-0-0": `${(perfect * 100).toFixed(2)}%`,
        "goleade (4+ gol)": `${(blowoutRate * 100).toFixed(1)}%`,
        "gol/partita": goalsPerMatch.toFixed(2),
      });
    }
  }
  console.table(grid);
  {
    const { perfect, blowoutRate, goalsPerMatch } = evaluate(bestModel);
    console.log(
      `Scelto: base ${bestModel.base.toFixed(2)}, scala ${bestModel.scale}, tetto ${bestModel.max} → 38-0-0 ${(perfect * 100).toFixed(2)}%, goleade ${(blowoutRate * 100).toFixed(1)}%, ${goalsPerMatch.toFixed(2)} gol/partita`,
    );
  }
  console.log(
    `\nModello scelto: scala ${bestModel.scale}, tetto ${bestModel.max} (scarto dal bersaglio ${(bestGap * 100).toFixed(2)} punti)`,
  );

  console.log(`\n== 38-0-0 per competizione, con la miglior rosa possibile in ciascuna ==`);
  console.table(
    competitions.map((c) => {
      const own = scenarios
        .filter((s) => s.competition === c)
        .map((s) => ({ s, p: exactPerfectProbability(bestModel, s.strength, c.teams) }))
        .sort((a, b) => b.p - a.p)[0]!;
      return {
        competizione: c.label,
        "avversaria più forte": c.teams[0]?.name ?? "—",
        "pool migliore": own.s.pool,
        "38-0-0": `${(own.p * 100).toFixed(2)}%`,
      };
    }),
  );

  /**
   * **Il modello davvero in uso nel motore.** La ricerca qui sopra è un'esplorazione
   * ("quali costanti centrerebbero il bersaglio?"), ma il decadimento e la verifica devono
   * misurare ciò che il gioco fa davvero: confrontare il modello *cercato* con la simulazione
   * del motore *reale* significa mettere a confronto due cose diverse, ed è esattamente
   * l'errore di lettura che questo commento serve a impedire.
   */
  const engineModel: GoalModel = {
    base: BASE_EXPECTED_GOALS,
    scale: GOAL_SCALE,
    min: MIN_EXPECTED_GOALS,
    max: MAX_EXPECTED_GOALS,
  };
  {
    const attuale = evaluate(engineModel);
    console.log(
      `\nMotore attuale: base ${engineModel.base}, scala ${engineModel.scale}, tetto ${engineModel.max} → 38-0-0 ${(attuale.perfect * 100).toFixed(2)}%, goleade ${(attuale.blowoutRate * 100).toFixed(1)}%, ${attuale.goalsPerMatch.toFixed(2)} gol/partita`,
    );
  }

  // 4. Come decade la probabilità al calare della rosa, con le costanti REALI del motore.
  const model = engineModel;
  const bestScale = engineModel.scale;
  console.log(`\n== Decadimento del 38-0-0 al calare della rosa (scala ${bestScale}) ==`);
  const easiest = scenarios.reduce((a, b) =>
    exactPerfectProbability(model, b.strength, b.competition.teams) >
    exactPerfectProbability(model, a.strength, a.competition.teams)
      ? b
      : a,
  );
  const steps = [0, -1, -2, -3, -4, -5, -6, -8, -10, -13, -16, -20];
  console.table(
    steps.map((delta) => {
      const strength: TeamStrength = {
        attack: easiest.strength.attack + delta,
        defence: easiest.strength.defence + delta,
      };
      const show = (teams: LeagueTeam[]) => {
        const p = exactPerfectProbability(model, strength, teams);
        return p < 0.00005 ? "~0%" : `${(p * 100).toFixed(3)}%`;
      };
      return {
        scarto: delta,
        att: strength.attack,
        dif: strength.defence,
        [easiest.competition.label]: show(easiest.competition.teams),
        Superlega: show(opponents),
      };
    }),
  );

  // 5. Verifica a simulazione col motore reale: il calcolo esatto e la simulazione devono
  //    dire la stessa cosa, altrimenti una delle due è sbagliata.
  console.log(
    `\n== Verifica col motore reale — ${easiest.competition.label}, draft da "${easiest.pool}" (${seasons} stagioni) ==`,
  );
  console.table(
    [0, -2, -4, -8, -16].map((delta, i) => {
      const strength: TeamStrength = {
        attack: easiest.strength.attack + delta,
        defence: easiest.strength.defence + delta,
      };
      const { perfect, nearPerfect, averagePoints } = perfectRate(
        strength,
        easiest.competition.teams,
        seasons,
        1000 + i,
      );
      return {
        scarto: delta,
        "38-0-0 simulato": `${(perfect * 100).toFixed(2)}%`,
        "38-0-0 esatto": `${(exactPerfectProbability(model, strength, easiest.competition.teams) * 100).toFixed(2)}%`,
        "37 vittorie": `${(nearPerfect * 100).toFixed(2)}%`,
        "punti medi": averagePoints.toFixed(1),
      };
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
