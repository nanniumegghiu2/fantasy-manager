import type { ChemistryColor, ChemistryLink, Player } from "@app/shared-types";

function sharedTraitCount(a: Player, b: Player): number {
  let count = 0;
  if (a.league === b.league) count++;
  if (a.era === b.era) count++;
  if (a.nation === b.nation) count++;
  return count;
}

function colorFromSharedTraits(sharedTraits: number): ChemistryColor {
  if (sharedTraits >= 2) return "green";
  if (sharedTraits === 1) return "orange";
  return "red";
}

export function computeChemistryLink(a: Player, b: Player): ChemistryLink {
  const sharedTraits = sharedTraitCount(a, b);
  return {
    playerAId: a.id,
    playerBId: b.id,
    sharedTraits,
    color: colorFromSharedTraits(sharedTraits),
  };
}

/** Linee solo tra giocatori dello stesso reparto (vicini di reparto), mai tra reparti diversi. */
export function computeDepartmentChemistryLinks(departmentPlayers: Player[]): ChemistryLink[] {
  const links: ChemistryLink[] = [];
  for (let i = 0; i < departmentPlayers.length; i++) {
    for (let j = i + 1; j < departmentPlayers.length; j++) {
      links.push(computeChemistryLink(departmentPlayers[i], departmentPlayers[j]));
    }
  }
  return links;
}

const LINK_WEIGHT: Record<ChemistryColor, number> = {
  green: 1,
  orange: 0.5,
  red: 0,
};

const MAX_CHEMISTRY_BONUS = 10;

/** Bonus rating squadra (0..MAX_CHEMISTRY_BONUS) in base alla qualita' media delle linee di chemistry. */
export function computeChemistryBonus(links: ChemistryLink[]): number {
  if (links.length === 0) return 0;
  const averageWeight =
    links.reduce((sum, link) => sum + LINK_WEIGHT[link.color], 0) / links.length;
  return Math.round(averageWeight * MAX_CHEMISTRY_BONUS);
}
