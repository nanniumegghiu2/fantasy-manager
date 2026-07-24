import type { Department, DepartmentRating, Player } from "@app/shared-types";

export function computeDepartmentRating(starters: Player[]): number {
  if (starters.length === 0) return 0;
  const total = starters.reduce((sum, p) => sum + p.overall, 0);
  return Math.round(total / starters.length);
}

export function computeAllDepartmentRatings(
  startersByDepartment: Record<Department, Player[]>,
): DepartmentRating[] {
  return (Object.keys(startersByDepartment) as Department[]).map((department) => ({
    department,
    rating: computeDepartmentRating(startersByDepartment[department]),
  }));
}

export function computeSquadRating(
  departmentRatings: DepartmentRating[],
  chemistryBonus: number,
): number {
  if (departmentRatings.length === 0) return 0;
  const average =
    departmentRatings.reduce((sum, d) => sum + d.rating, 0) / departmentRatings.length;
  return Math.round(average + chemistryBonus);
}
