/**
 * Valore di mercato (CLAUDE.md sez. 2.2/9.1): guidato principalmente dall'Overall (curva non
 * lineare: i migliori valgono molto piu' che proporzionalmente), poi modulato da prestigio
 * campionato, prestigio club, prestigio della nazionalita' del giocatore (bonus contenuto) e
 * densita' di club presenti nel database per la stessa epoca (piu' club nella stessa epoca =
 * piu' potenziale di chemistry, quindi giocatore piu' "utile"/prezioso in-game).
 */

const BASE_VALUE_AT_MIN_OVERALL = 300_000;
const BASE_VALUE_AT_MAX_OVERALL = 200_000_000;
const MIN_OVERALL = 60;
const MAX_OVERALL = 99;

const LEAGUE_PRESTIGE_MULTIPLIER = [0.8, 0.9, 1.0, 1.15, 1.3];
const CLUB_PRESTIGE_MULTIPLIER = [0.7, 0.85, 1.0, 1.2, 1.5];
const NATION_PRESTIGE_MULTIPLIER = [0.97, 0.99, 1.0, 1.05, 1.1];

const ERA_DENSITY_TARGET_CLUBS = 20;
const ERA_DENSITY_MIN_MULTIPLIER = 0.85;
const ERA_DENSITY_MAX_MULTIPLIER = 1.15;

function tierMultiplier(tier: number, scale: number[]): number {
  const index = Math.min(Math.max(Math.round(tier), 1), scale.length) - 1;
  return scale[index];
}

function baseValueFromOverall(overall: number): number {
  const clamped = Math.min(Math.max(overall, MIN_OVERALL), MAX_OVERALL);
  const progress = (clamped - MIN_OVERALL) / (MAX_OVERALL - MIN_OVERALL);
  const ratio = BASE_VALUE_AT_MAX_OVERALL / BASE_VALUE_AT_MIN_OVERALL;
  return BASE_VALUE_AT_MIN_OVERALL * Math.pow(ratio, progress);
}

function eraDensityMultiplier(clubsInEra: number): number {
  const progress = Math.min(Math.max(clubsInEra, 0) / ERA_DENSITY_TARGET_CLUBS, 1);
  return (
    ERA_DENSITY_MIN_MULTIPLIER + progress * (ERA_DENSITY_MAX_MULTIPLIER - ERA_DENSITY_MIN_MULTIPLIER)
  );
}

export interface MarketValueInput {
  overall: number;
  /** 1 (minimo) - 5 (massimo) */
  leaguePrestigeTier: number;
  /** 1 (minimo) - 5 (massimo) */
  clubPrestigeTier: number;
  /** 1 (minimo) - 5 (massimo) */
  nationPrestigeTier: number;
  /** Quanti club sono presenti nel database per la stessa epoca del giocatore */
  clubsInSameEra: number;
}

/** Valore di mercato in euro, arrotondato a multipli di 50.000 come i valori reali. */
export function computeMarketValue(input: MarketValueInput): number {
  const raw =
    baseValueFromOverall(input.overall) *
    tierMultiplier(input.leaguePrestigeTier, LEAGUE_PRESTIGE_MULTIPLIER) *
    tierMultiplier(input.clubPrestigeTier, CLUB_PRESTIGE_MULTIPLIER) *
    tierMultiplier(input.nationPrestigeTier, NATION_PRESTIGE_MULTIPLIER) *
    eraDensityMultiplier(input.clubsInSameEra);

  return Math.round(raw / 50_000) * 50_000;
}

/**
 * Stima editoriale dichiarata (sez. 2.2) del prestigio calcistico di una nazionalita', 1-5.
 * Default 3 per le nazioni non elencate esplicitamente.
 */
const NATION_PRESTIGE_TIERS: Record<string, number> = {
  Brasile: 5,
  Francia: 5,
  Argentina: 5,
  Germania: 5,
  Spagna: 5,
  Italia: 5,
  Inghilterra: 5,
  Portogallo: 4,
  "Paesi Bassi": 4,
  Olanda: 4,
  Belgio: 4,
  Uruguay: 4,
  Croazia: 4,
  Danimarca: 3,
  Svezia: 3,
  Serbia: 3,
  Polonia: 3,
  "Stati Uniti": 3,
  Marocco: 3,
  Senegal: 3,
  Colombia: 3,
  Messico: 3,
  Giappone: 3,
  "Corea del Sud": 3,
  Nigeria: 3,
  Ghana: 3,
  Austria: 3,
  Svizzera: 3,
  Turchia: 3,
  Algeria: 3,
  Ecuador: 3,
  "Costa d'Avorio": 3,
};

export function nationPrestigeTier(nation: string): number {
  return NATION_PRESTIGE_TIERS[nation] ?? 3;
}
