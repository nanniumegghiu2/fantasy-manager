import type { Role } from "@app/shared-types";

/**
 * Overall 2.0 (CLAUDE.md sez. 2.2): misura **quanto un giocatore ha inciso per 90 minuti
 * nella stagione**, rispetto a un riferimento fisso del suo ruolo.
 *
 * Le tre differenze rispetto alla prima versione, ognuna nata da un difetto osservato sul
 * pool reale della Serie A 2025/26:
 *
 * 1. **Niente trofei nel punteggio individuale.** Erano una statistica di *squadra* con
 *    peso 15-35%: siccome l'Inter aveva vinto, ogni suo giocatore prendeva lo stesso bonus
 *    e finiva a 99 (Sommer 99 senza gol, Zieliński 99 con 6 gol, Pulisic 98 con 10 gol e 6
 *    assist). Misurava la maglia, non il giocatore.
 * 2. **Scala assoluta al posto del percentile.** Il percentile fabbricava la scala: 580
 *    giocatori producevano solo 33 Overall distinti, 153 esatti a 60, e aggiungere una lega
 *    avrebbe riscritto tutti gli Overall esistenti. Qui la mappatura punteggio→Overall è
 *    fissa: un campionato debole resta debole e il pool può crescere senza effetti
 *    retroattivi.
 * 3. **Tutto per 90 minuti, con regressione verso la media di ruolo.** Un attaccante con 3
 *    gol in 200 minuti non vale più di uno con 12 in una stagione intera: lo shrinkage
 *    bayesiano riporta verso la media chi ha un campione piccolo. È questo a dare un valore
 *    di partenza sensato a chi ha pochi dati — il ruolo che altrimenti servirebbe un
 *    database di terzi come àncora.
 *
 * Tutte le costanti sono placeholder di bilanciamento dichiarati, come le curve del motore
 * di campionato: si tarano osservando i risultati, non sono verità.
 */

const MIN_OVERALL = 60;
const MAX_OVERALL = 99;

/** 38 giornate da 90 minuti: il massimo teorico di minuti stagionali. */
const SEASON_MINUTES = 38 * 90;

/**
 * Quante "partite equivalenti" di prior pesare contro il campione reale del giocatore.
 * Con k=8, chi ha giocato 8 partite vale metà i suoi numeri e metà la media del ruolo;
 * chi ne ha giocate 34 è quasi interamente giudicato sui propri.
 */
const SHRINKAGE_MATCHES = 8;

/**
 * Minuti oltre i quali ci si fida pienamente dei rapporti per-90 di un giocatore (10
 * partite intere). Sotto questa soglia la regressione verso la media di ruolo **non basta**:
 * un attaccante con 12 gol in 200 minuti resta a 5 gol/90 anche dopo lo shrinkage e satura
 * comunque la produzione. Le componenti "a rapporto" vengono quindi miscelate con un valore
 * neutro in proporzione ai minuti giocati: con pochi dati la risposta corretta non è
 * "fuoriclasse", è "non lo sappiamo".
 */
const QUALIFYING_MINUTES = 10 * 90;

/** Valore neutro delle componenti a rapporto: il rendimento di un giocatore nella media. */
const NEUTRAL_RATE_SCORE = 0.35;

/** Curva finale leggermente concava: comprime la fascia alta, così il 99 resta raro. */
const SCALE_EXPONENT = 0.85;

/** Punti di Overall aggiunti/tolti per tier di prestigio del campionato, rispetto al tier 3. */
const LEAGUE_PRESTIGE_STEP = 1.5;

/**
 * Scostamento massimo che una singola stagione può produrre sull'Overall di partenza.
 * Volutamente contenuto: una stagione è un campione piccolo, non un verdetto — un
 * fuoriclasse con un anno storto resta un fuoriclasse, e viceversa.
 */
const DEFAULT_MAX_SWING = 8;

export type OverallProfile = "attacco" | "centrocampo" | "difesa" | "portiere";

/** Profilo di valutazione di ogni casella dello scacchiere (sez. 3.1). */
export const ROLE_PROFILE: Record<Role, OverallProfile> = {
  POR: "portiere",
  TD: "difesa",
  DC: "difesa",
  TS: "difesa",
  QD: "difesa",
  QS: "difesa",
  MED: "centrocampo",
  CC: "centrocampo",
  ED: "centrocampo",
  ES: "centrocampo",
  TQD: "attacco",
  TRQ: "attacco",
  TQS: "attacco",
  ATT: "attacco",
};

/** Componenti del punteggio: quanto pesa ciascuna per profilo (ogni riga somma a 1). */
const PROFILE_WEIGHTS: Record<
  OverallProfile,
  { production: number; quality: number; availability: number; cleanSheet: number }
> = {
  attacco: { production: 0.5, quality: 0.3, availability: 0.2, cleanSheet: 0 },
  centrocampo: { production: 0.35, quality: 0.4, availability: 0.25, cleanSheet: 0 },
  difesa: { production: 0.1, quality: 0.5, availability: 0.4, cleanSheet: 0 },
  portiere: { production: 0, quality: 0.45, availability: 0.3, cleanSheet: 0.25 },
};

/** Quanto contano gol e assist dentro la componente "produzione", per profilo. */
const PRODUCTION_MIX: Record<OverallProfile, { goals: number; assists: number }> = {
  attacco: { goals: 0.7, assists: 0.3 },
  centrocampo: { goals: 0.35, assists: 0.65 },
  difesa: { goals: 0.4, assists: 0.6 },
  portiere: { goals: 0, assists: 0 },
};

/**
 * Produzione per 90 minuti considerata "da 99" per profilo: è il riferimento FISSO che
 * sostituisce il percentile. Un attaccante che produce 0.85 tra gol e assist ogni 90'
 * satura la componente; sotto, scala proporzionalmente.
 */
const PRODUCTION_REFERENCE: Record<OverallProfile, number> = {
  attacco: 0.85,
  centrocampo: 0.45,
  difesa: 0.22,
  portiere: 1,
};

/** Banda di media voto mappata su 0-1: sotto 5.5 vale 0, da 7.2 in su vale 1. */
const RATING_FLOOR = 5.5;
const RATING_CEILING = 7.2;

/** Quota di clean sheet per 90 considerata "da 99" per un portiere. */
const CLEAN_SHEET_REFERENCE = 0.45;

export interface SeasonStatLine {
  /** Minuti giocati in stagione: base di ogni rapporto per-90. */
  minutes: number;
  goals: number;
  assists: number;
  /** Media voto stagionale (es. 6.42). Assente → il peso viene ridistribuito sulle altre componenti. */
  averageRating?: number | null;
  /** Solo portieri: partite senza subire gol. Assente → peso ridistribuito. */
  cleanSheets?: number | null;
}

export interface OverallV2Input {
  id: string;
  role: Role;
  stats: SeasonStatLine;
  /** `leagues.prestige_tier` (1-5): sposta l'Overall di ±3 punti tra campionati diversi. */
  leaguePrestige?: number | null;
}

export interface OverallV2Result {
  id: string;
  overall: number;
  /** Componenti normalizzate 0-1, utili per spiegare un valore nel pannello admin. */
  breakdown: {
    production: number;
    quality: number | null;
    availability: number;
    cleanSheet: number | null;
  };
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function nineties(minutes: number): number {
  return minutes / 90;
}

/** Media di lega per 90 di una statistica, per profilo: è il prior dello shrinkage. */
function profilePriors(players: OverallV2Input[]): Record<OverallProfile, { goals: number; assists: number }> {
  const totals: Record<string, { goals: number; assists: number; nineties: number }> = {};

  for (const player of players) {
    const profile = ROLE_PROFILE[player.role];
    const bucket = (totals[profile] ??= { goals: 0, assists: 0, nineties: 0 });
    bucket.goals += player.stats.goals;
    bucket.assists += player.stats.assists;
    bucket.nineties += nineties(player.stats.minutes);
  }

  const priors = {} as Record<OverallProfile, { goals: number; assists: number }>;
  for (const profile of ["attacco", "centrocampo", "difesa", "portiere"] as OverallProfile[]) {
    const bucket = totals[profile];
    priors[profile] =
      bucket && bucket.nineties > 0
        ? { goals: bucket.goals / bucket.nineties, assists: bucket.assists / bucket.nineties }
        : { goals: 0, assists: 0 };
  }
  return priors;
}

/**
 * Rapporto per 90 regolarizzato: `(totale + k·prior) / (novantesimi + k)`. Con pochi minuti
 * il risultato resta vicino al prior del ruolo, con una stagione intera coincide col dato
 * reale del giocatore.
 */
function shrunkPer90(total: number, playedNineties: number, prior: number): number {
  return (total + SHRINKAGE_MATCHES * prior) / (playedNineties + SHRINKAGE_MATCHES);
}

/**
 * Somma pesata in cui una componente senza dato vale **neutro**, non "zero" e nemmeno
 * "ignorata".
 *
 * Il primo tentativo ridistribuiva il peso delle componenti mancanti sulle altre, ed è
 * fallito sul pool reale in modo istruttivo: i portieri non hanno produzione offensiva, e
 * senza media voto né clean sheet restavano valutati al 100% sul minutaggio — nove portieri
 * nei primi dodici Overall del campionato. Chi ha più dati mancanti non deve diventare più
 * facile da valutare bene: l'assenza di informazione tira verso la media.
 */
function weightedWithNeutral(parts: { value: number | null; weight: number }[]): number {
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) return 0;
  return (
    parts.reduce((sum, p) => sum + p.weight * (p.value ?? NEUTRAL_RATE_SCORE), 0) / totalWeight
  );
}

/** Punteggio di rendimento stagionale 0-1 di un giocatore, con quanto ci si può fidare. */
export interface SeasonPerformance {
  id: string;
  /** 0-1: quanto ha reso nella stagione, sulla scala assoluta del suo profilo. */
  score: number;
  /** 0-1: quanto pesa il campione (minuti giocati rispetto alle 10 partite di qualificazione). */
  confidence: number;
  breakdown: OverallV2Result["breakdown"];
}

/**
 * Rendimento stagionale puro, senza mapparlo su una scala di Overall. È il mattone
 * condiviso da `computeOverallV2` (che lo usa come Overall assoluto) e da
 * `applySeasonAdjustment` (che lo confronta con un Overall di partenza).
 */
export function computeSeasonPerformance(players: OverallV2Input[]): SeasonPerformance[] {
  const priors = profilePriors(players);
  return players.map((player) => performanceOf(player, priors));
}

/**
 * Aggiorna un Overall di partenza con il rendimento della stagione: **bonus** se il
 * giocatore ha reso più di quanto il suo valore lasciasse prevedere, **malus** se ha reso
 * meno. La base resta dominante — lo scostamento è limitato a ±`maxSwing` punti — perché una
 * sola stagione è un campione piccolo, non un verdetto sul giocatore.
 *
 * Due proprietà volute:
 * - **L'aggiustamento è proporzionale ai minuti giocati.** Chi ha giocato 200 minuti muove
 *   di pochissimo: non sappiamo abbastanza per premiarlo o punirlo.
 * - **Il confronto è col rendimento *atteso* per quel livello**, non con la media del
 *   campionato. Un giocatore da 90 che rende da 85 prende malus anche se resta sopra la
 *   media; uno da 70 che rende da 75 prende bonus anche se resta sotto.
 */
export function applySeasonAdjustment(
  players: (OverallV2Input & { baseOverall: number })[],
  maxSwing = DEFAULT_MAX_SWING,
): (OverallV2Result & { baseOverall: number; adjustment: number })[] {
  const priors = profilePriors(players);

  return players.map((player) => {
    const performance = performanceOf(player, priors);

    // Rendimento che ci si aspetterebbe da quel valore di partenza: è l'inversa esatta
    // della curva usata da `computeOverallV2`, così base e rendimento parlano la stessa lingua.
    const clampedBase = Math.min(Math.max(player.baseOverall, MIN_OVERALL), MAX_OVERALL);
    const expected = Math.pow(
      (clampedBase - MIN_OVERALL) / (MAX_OVERALL - MIN_OVERALL),
      1 / SCALE_EXPONENT,
    );

    const delta = performance.score - expected;
    const adjustment = Math.round(
      Math.min(Math.max(delta * maxSwing * 2, -maxSwing), maxSwing) * performance.confidence,
    );

    return {
      id: player.id,
      baseOverall: clampedBase,
      adjustment,
      overall: Math.min(Math.max(clampedBase + adjustment, MIN_OVERALL), MAX_OVERALL),
      breakdown: performance.breakdown,
    };
  });
}

/**
 * Overall 60-99 per un intero pool. Il pool serve solo a calcolare i prior di ruolo dello
 * shrinkage: la mappatura punteggio→Overall è assoluta, quindi due giocatori con gli stessi
 * numeri ottengono lo stesso Overall anche in pool di dimensioni diverse.
 */
export function computeOverallV2(players: OverallV2Input[]): OverallV2Result[] {
  const priors = profilePriors(players);

  return players.map((player) => {
    const { score, breakdown } = performanceOf(player, priors);
    const prestige = player.leaguePrestige ?? 3;
    const raw =
      MIN_OVERALL +
      (MAX_OVERALL - MIN_OVERALL) * Math.pow(clamp01(score), SCALE_EXPONENT) +
      (prestige - 3) * LEAGUE_PRESTIGE_STEP;

    return {
      id: player.id,
      overall: Math.round(Math.min(Math.max(raw, MIN_OVERALL), MAX_OVERALL)),
      breakdown,
    };
  });
}

/** Calcolo delle tre (o quattro) componenti di rendimento per un singolo giocatore. */
function performanceOf(
  player: OverallV2Input,
  priors: Record<OverallProfile, { goals: number; assists: number }>,
): SeasonPerformance {
  const profile = ROLE_PROFILE[player.role];
  const weights = PROFILE_WEIGHTS[profile];
  const mix = PRODUCTION_MIX[profile];
  const played = nineties(player.stats.minutes);

  /** Quanto ci si può fidare dei rapporti per-90 di questo giocatore (0-1). */
  const confidence = clamp01(player.stats.minutes / QUALIFYING_MINUTES);
  const toNeutral = (value: number) => confidence * value + (1 - confidence) * NEUTRAL_RATE_SCORE;

  const goalsPer90 = shrunkPer90(player.stats.goals, played, priors[profile].goals);
  const assistsPer90 = shrunkPer90(player.stats.assists, played, priors[profile].assists);
  const production = toNeutral(
    clamp01((goalsPer90 * mix.goals + assistsPer90 * mix.assists) / PRODUCTION_REFERENCE[profile]),
  );

  // L'unica componente NON miscelata: i minuti sono il dato stesso, non una sua stima.
  const availability = clamp01(Math.sqrt(player.stats.minutes / SEASON_MINUTES));

  const rating = player.stats.averageRating;
  const quality =
    rating == null
      ? null
      : toNeutral(clamp01((rating - RATING_FLOOR) / (RATING_CEILING - RATING_FLOOR)));

  const cleanSheets = player.stats.cleanSheets;
  const cleanSheet =
    profile !== "portiere" || cleanSheets == null || played <= 0
      ? null
      : toNeutral(clamp01(cleanSheets / played / CLEAN_SHEET_REFERENCE));

  const score = weightedWithNeutral([
    { value: production, weight: weights.production },
    { value: quality, weight: weights.quality },
    { value: availability, weight: weights.availability },
    { value: cleanSheet, weight: weights.cleanSheet },
  ]);

  return {
    id: player.id,
    score,
    confidence,
    breakdown: { production, quality, availability, cleanSheet },
  };
}
