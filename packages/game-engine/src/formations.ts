import { ROLE_DEPARTMENT, ROLE_LABELS } from "@app/shared-types";
import type { Formation, FormationSlot, Role } from "@app/shared-types";

/**
 * Layout di ruoli per ciascun modulo, scelti tra le caselle dello "scacchiere"
 * tattico (sez. 3.1 CLAUDE.md — 1 portiere, 5 difensori, 4 mediani/terzini alti, 5
 * centrocampisti centrali+esterni, 4 trequartisti laterali+centrali, 2 attaccanti).
 * Ogni modulo usa 11 caselle: i ruoli laterali compaiono al più una volta, mentre i
 * ruoli **centrali** (`DC`, `MED`, `CC`, `TRQ`, `ATT`) possono ripetersi fino al limite
 * di `ROLE_MAX_SLOTS` — è lo stesso ruolo su caselle contigue (es. una difesa a 3 =
 * `DC` tre volte), non tre ruoli diversi. Dove un modulo classico ha un fronte a 3/4 con
 * ali larghe (es. 4-3-3, 4-2-4), l'ampiezza arriva dai **trequartisti laterali**
 * (TQD/TQS, linea 5, tatticamente più larghi) e non dalla linea attaccanti.
 *
 * Le occorrenze ripetute vanno elencate consecutivamente: il loro ordine è l'ordine da
 * sinistra a destra sul campo, usato sia da `board.ts` (chemistry) sia da
 * `pitchLayouts.ts` (coordinate).
 */
const FORMATION_ROLE_LAYOUTS: Record<string, Role[]> = {
  "4-4-2": ["POR", "TD", "DC", "DC", "TS", "ED", "CC", "CC", "ES", "ATT", "ATT"],
  "4-3-3": ["POR", "TD", "DC", "DC", "TS", "MED", "CC", "CC", "TQD", "ATT", "TQS"],
  "4-2-3-1": ["POR", "TD", "DC", "DC", "TS", "MED", "MED", "TQD", "TRQ", "TQS", "ATT"],
  "4-1-4-1": ["POR", "TD", "DC", "DC", "TS", "MED", "ED", "CC", "CC", "ES", "ATT"],
  "3-5-2": ["POR", "DC", "DC", "DC", "QD", "QS", "MED", "MED", "CC", "ATT", "ATT"],
  "3-4-3": ["POR", "DC", "DC", "DC", "QD", "MED", "MED", "QS", "TQD", "ATT", "TQS"],
  "4-4-1-1": ["POR", "TD", "DC", "DC", "TS", "ED", "CC", "CC", "ES", "TRQ", "ATT"],
  "5-3-2": ["POR", "TD", "DC", "DC", "DC", "TS", "MED", "MED", "CC", "ATT", "ATT"],
  "4-2-4": ["POR", "TD", "DC", "DC", "TS", "MED", "MED", "TQD", "ATT", "ATT", "TQS"],
  "3-4-2-1": ["POR", "DC", "DC", "DC", "QD", "MED", "MED", "QS", "TRQ", "TRQ", "ATT"],
  "4-3-1-2": ["POR", "TD", "DC", "DC", "TS", "MED", "MED", "CC", "TRQ", "ATT", "ATT"],
};

/** Id slot: `role.toLowerCase()`, con suffisso `-1`/`-2`/`-3` per i ruoli che il modulo ripete. */
function buildSlots(roles: Role[]): FormationSlot[] {
  const totalCount: Partial<Record<Role, number>> = {};
  for (const role of roles) totalCount[role] = (totalCount[role] ?? 0) + 1;
  const seenCount: Partial<Record<Role, number>> = {};

  return roles.map((role, index) => {
    const occurrence = (seenCount[role] ?? 0) + 1;
    seenCount[role] = occurrence;
    const id =
      (totalCount[role] ?? 0) > 1 ? `${role.toLowerCase()}-${occurrence}` : role.toLowerCase();
    return {
      id,
      label: ROLE_LABELS[role],
      role,
      department: ROLE_DEPARTMENT[role],
      order: index,
    };
  });
}

function formationFromCode(code: string, id: string): Formation {
  const roles = FORMATION_ROLE_LAYOUTS[code];
  if (!roles) throw new Error(`Nessun layout di ruoli definito per il modulo ${code}`);
  return {
    id,
    name: code,
    slots: buildSlots(roles),
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
