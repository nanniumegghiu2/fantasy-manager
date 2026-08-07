export type Department = "POR" | "DIF" | "CC" | "ATT";

/**
 * Ruolo del giocatore/casella dello "scacchiere" tattico (CLAUDE.md sez. 3.1).
 * Il campo è un tabellone fisso a 6 linee — portiere (1), difensori (5), mediani/terzini
 * alti (4), centrocampisti centrali+esterni (5), trequartisti laterali+centrali (4),
 * attaccanti (2) — 21 caselle, ma solo **14 ruoli**: tutte le caselle centrali di una
 * stessa linea condividono un unico ruolo (`DC`, `MED`, `CC`, `TRQ`, `ATT`), perché per
 * chi gioca "difensore centrale destro" e "difensore centrale sinistro" non sono ruoli
 * diversi — sono lo stesso ruolo su due caselle. Solo i ruoli laterali (terzini, quinti,
 * esterni, trequartisti larghi) restano distinti destra/sinistra, dove la fascia è una
 * caratteristica reale del giocatore.
 *
 * Un ruolo centrale può quindi comparire più volte nello stesso modulo (vedi
 * `ROLE_MAX_SLOTS`), risolto a caselle fisiche distinte da
 * `packages/game-engine/src/formations.ts` (slot id con suffisso `-1`/`-2`/`-3`) e
 * `apps/web/src/classic/pitchLayouts.ts` (coordinate per numero di occorrenze).
 *
 * Il reparto (Department) resta la raggruppazione larga usata da rating/Overall/valore di
 * mercato; il ruolo è il dettaglio usato dal motore di draft e dalla lavagna tattica.
 */
export type Role =
  // Linea 1 — Portiere (1 casella)
  | "POR"
  // Linea 2 — Difensori (5 caselle: TD + 3 centrali + TS)
  | "TD"
  | "DC"
  | "TS"
  // Linea 3 — Mediani e terzini alti (4 caselle: QD + 2 mediani + QS)
  | "QD"
  | "MED"
  | "QS"
  // Linea 4 — Centrocampisti centrali ed esterni (5 caselle: ED + 3 centrali + ES)
  | "ED"
  | "CC"
  | "ES"
  // Linea 5 — Trequartisti laterali e centrali (4 caselle: TQD + 2 centrali + TQS)
  | "TQD"
  | "TRQ"
  | "TQS"
  // Linea 6 — Attaccanti (2 caselle, un solo ruolo)
  | "ATT";

export const ROLE_LABELS: Record<Role, string> = {
  POR: "Portiere",
  TD: "Terzino Destro",
  DC: "Difensore Centrale",
  TS: "Terzino Sinistro",
  QD: "Quinto Destro",
  MED: "Mediano",
  QS: "Quinto Sinistro",
  ED: "Esterno Destro",
  CC: "Centrocampista Centrale",
  ES: "Esterno Sinistro",
  TQD: "Trequartista Destro",
  TRQ: "Trequartista Centrale",
  TQS: "Trequartista Sinistro",
  ATT: "Attaccante",
};

/**
 * Quante caselle dello stesso ruolo un modulo può schierare al massimo: 1 per i ruoli
 * laterali (una sola casella sulla fascia), più di 1 per i ruoli centrali, che coprono
 * più caselle contigue della stessa linea.
 */
export const ROLE_MAX_SLOTS: Record<Role, number> = {
  POR: 1,
  TD: 1,
  DC: 3,
  TS: 1,
  QD: 1,
  MED: 2,
  QS: 1,
  ED: 1,
  CC: 3,
  ES: 1,
  TQD: 1,
  TRQ: 2,
  TQS: 1,
  ATT: 2,
};

/** Reparto a cui appartiene ciascun ruolo: unica fonte di verita', il DB lo deriva a livello SQL. */
export const ROLE_DEPARTMENT: Record<Role, Department> = {
  POR: "POR",
  TD: "DIF",
  DC: "DIF",
  TS: "DIF",
  QD: "DIF",
  MED: "CC",
  QS: "DIF",
  ED: "CC",
  CC: "CC",
  ES: "CC",
  TQD: "CC",
  TRQ: "CC",
  TQS: "CC",
  ATT: "ATT",
};

/** Ordine "di lettura" del tabellone: linea per linea, da destra a sinistra dentro ogni linea. */
export const ROLES: Role[] = [
  "POR",
  "TD",
  "DC",
  "TS",
  "QD",
  "MED",
  "QS",
  "ED",
  "CC",
  "ES",
  "TQD",
  "TRQ",
  "TQS",
  "ATT",
];

export interface FormationSlot {
  id: string;
  label: string;
  role: Role;
  department: Department;
  order: number;
}

export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
}

export interface League {
  id: string;
  name: string;
  nation: string;
  crestUrl: string;
}

/** Un club rappresenta un'istanza per epoca (stesso club reale puo' avere piu' righe, una per era). */
export interface Club {
  id: string;
  name: string;
  crestUrl: string;
  leagueId: string;
  era: string;
}

/** Vista di gioco risolta: era/league derivano dal Club (leagueId/era), non sono testo libero nel DB. */
export interface Player {
  id: string;
  name: string;
  overall: number;
  marketValue: number;
  clubId: string;
  era: string;
  nation: string;
  league: string;
  role: Role;
  /** Ruoli secondari: altre caselle in cui può giocare, senza penalità sull'Overall (sez. 3.1). */
  secondaryRoles: Role[];
  department: Department;
  /**
   * Data di nascita (`YYYY-MM-DD`), dato fattuale importato dall'anagrafica.
   *
   * Facoltativa perché la Modalità Classica non la usa e i giocatori generati dalla DS mode
   * la ricevono alla creazione. Serve al ciclo di vita di una carriera: crescita fino al
   * picco 24-28, declino, ritiro a 34 (CLAUDE.md sez. DS mode).
   */
  birthDate?: string | null;
}

export type ChemistryColor = "red" | "orange" | "green";

export interface ChemistryLink {
  playerAId: string;
  playerBId: string;
  sharedTraits: number;
  color: ChemistryColor;
}

export interface Squad {
  formationId: string;
  starters: Record<string, string>;
}

export interface DepartmentRating {
  department: Department;
  rating: number;
}

export interface Level {
  id: string;
  name: string;
  order: number;
  pointsThreshold: number;
  baseBudget: number;
}

export type TacticalCardPhase = "draft" | "match";
export type TacticalCardKind = "malus" | "bonus";

export interface TacticalCard {
  id: string;
  name: string;
  phase: TacticalCardPhase;
  kind: TacticalCardKind;
  description: string;
  baseCost: number;
}

export type ChallengeType = "campionato" | "salvezza" | "mercato_gennaio";

export interface PlayerStats {
  appearances: number;
  goals: number;
  assists: number;
  trophies: number;
  caps: number;
}

export interface Profile {
  id: string;
  nickname: string;
  nazione: string;
  avatarUrl: string | null;
  livelloId: string;
  puntiLivello: number;
  puntiGlobali: number;
  puntiMensili: number;
  perfect38Count: number;
  isAdmin: boolean;
}
