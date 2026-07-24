export type Department = "POR" | "DIF" | "CC" | "ATT";

export interface FormationSlot {
  id: string;
  label: string;
  department: Department;
  order: number;
}

export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
}

export interface Club {
  id: string;
  name: string;
  crestUrl: string;
}

export interface Player {
  id: string;
  name: string;
  overall: number;
  marketValue: number;
  clubId: string;
  era: string;
  nation: string;
  league: string;
  department: Department;
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
  reserves: Partial<Record<Department, string>>;
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
