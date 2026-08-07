import type { DraftMode, Difficulty } from "@app/game-engine";
import type { Player } from "@app/shared-types";

/**
 * Competizione scelta in setup (sez. CLAUDE.md 3.5): decide **sia** da quale pool si pesca
 * nel draft **sia** contro chi si gioca il campionato. `null` = Superlega, cioè pool aperto
 * a tutti i Big 5 e avversarie i 19 club più forti d'Europa.
 */
export type LeagueChoice = string | null;

/**
 * Da dove si pesca nel draft, indipendentemente dalla competizione che si gioca:
 * `campionato` = solo giocatori del campionato scelto, `tutti` = intero database.
 *
 * Sono due cose separate di proposito: si può voler giocare la Serie A pescando però da
 * tutta Europa (rosa da sogno in un campionato reale) oppure restare fedeli al campionato.
 * Con la Superlega la distinzione non esiste — il pool è già tutto — quindi vale `tutti`.
 */
export type DraftPoolChoice = "campionato" | "tutti";

export interface SetupConfig {
  formationId: string;
  mode: DraftMode;
  difficulty: Difficulty;
  league: LeagueChoice;
  draftPool: DraftPoolChoice;
}

export interface SquadAssignment {
  starters: Record<string, Player>;
}

export const EMPTY_ASSIGNMENT: SquadAssignment = { starters: {} };
