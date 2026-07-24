import type { Department, Formation, FormationSlot } from "@app/shared-types";

const DEPARTMENT_LABEL: Record<Department, string> = {
  POR: "Portiere",
  DIF: "Difensore",
  CC: "Centrocampista",
  ATT: "Attaccante",
};

function buildSlots(defenders: number, midfielders: number, forwards: number): FormationSlot[] {
  const slots: FormationSlot[] = [
    { id: "por-1", label: DEPARTMENT_LABEL.POR, department: "POR", order: 0 },
  ];

  const counts: [Department, number][] = [
    ["DIF", defenders],
    ["CC", midfielders],
    ["ATT", forwards],
  ];

  let order = 1;
  for (const [department, count] of counts) {
    for (let i = 1; i <= count; i++) {
      slots.push({
        id: `${department.toLowerCase()}-${i}`,
        label: `${DEPARTMENT_LABEL[department]} ${i}`,
        department,
        order: order++,
      });
    }
  }

  return slots;
}

function formationFromCode(code: string, id: string): Formation {
  const numbers = code.split("-").map(Number);
  const defenders = numbers[0];
  const forwards = numbers[numbers.length - 1];
  const midfielders = numbers.slice(1, -1).reduce((sum, n) => sum + n, 0);

  return {
    id,
    name: code,
    slots: buildSlots(defenders, midfielders, forwards),
  };
}

export const FORMATION_CODES = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "4-1-4-1",
  "3-5-2",
  "3-4-3",
  "4-4-1-1",
  "5-3-2",
  "4-2-4",
  "3-4-2-1",
  "4-3-1-2",
] as const;

export const FORMATIONS: Formation[] = FORMATION_CODES.map((code) =>
  formationFromCode(code, code),
);

export function getFormation(id: string): Formation | undefined {
  return FORMATIONS.find((f) => f.id === id);
}
