import type { Formation, FormationSlot, Role } from "@app/shared-types";

/**
 * Coordinate (percentuali, x: 0=sinistra..100=destra, y: 0=porta avversaria..150=propria
 * porta) delle caselle dello "scacchiere" tattico (sez. CLAUDE.md 3.1). Ogni ruolo ha
 * posizioni fisse condivise da tutti i moduli — non una tabella di coordinate diversa per
 * ogni modulo: un modulo, scegliendo i suoi 11 ruoli
 * (`packages/game-engine/src/formations.ts`), sceglie implicitamente anche le posizioni.
 *
 * I ruoli **centrali** (`DC`, `MED`, `CC`, `TRQ`, `ATT`) occupano più caselle contigue a
 * seconda di quante volte il modulo li schiera (difesa a 2 o a 3, un mediano o due, ...):
 * per questi la posizione non è una sola ma una riga di `CENTRAL_ROLE_POSITIONS`, scelta
 * in base al numero di occorrenze e all'indice dell'occorrenza (0 = più a sinistra,
 * stessa convenzione usata dal grafo di chemistry in `board.ts`).
 */
export interface PitchPosition {
  x: number;
  y: number;
}

export const PITCH_VIEWBOX_WIDTH = 100;
export const PITCH_VIEWBOX_HEIGHT = 150;

/** Posizione dei ruoli laterali/unici, che occupano sempre una sola casella. */
const LATERAL_ROLE_POSITION: Partial<Record<Role, PitchPosition>> = {
  // Linea 1 — Portiere
  POR: { x: 50, y: 134 },
  // Linea 2 — Terzini
  TS: { x: 12, y: 115 },
  TD: { x: 88, y: 115 },
  // Linea 3 — Quinti
  QS: { x: 12, y: 90 },
  QD: { x: 88, y: 90 },
  // Linea 4 — Esterni di centrocampo
  ES: { x: 12, y: 66 },
  ED: { x: 88, y: 66 },
  // Linea 5 — Trequartisti laterali
  TQS: { x: 12, y: 42 },
  TQD: { x: 88, y: 42 },
};

/**
 * Posizioni dei ruoli centrali, indicizzate per numero di occorrenze schierate dal modulo
 * e poi per indice dell'occorrenza (da sinistra a destra). Es. `DC` con 2 occorrenze = la
 * coppia di centrali di una difesa a 4; con 3 = la linea di una difesa a 3.
 */
const CENTRAL_ROLE_POSITIONS: Partial<Record<Role, Record<number, PitchPosition[]>>> = {
  DC: {
    1: [{ x: 50, y: 120 }],
    2: [
      { x: 31, y: 118 },
      { x: 69, y: 118 },
    ],
    3: [
      { x: 31, y: 118 },
      { x: 50, y: 120 },
      { x: 69, y: 118 },
    ],
  },
  MED: {
    1: [{ x: 50, y: 92 }],
    2: [
      { x: 37, y: 94 },
      { x: 63, y: 94 },
    ],
  },
  CC: {
    1: [{ x: 50, y: 72 }],
    2: [
      { x: 31, y: 70 },
      { x: 69, y: 70 },
    ],
    3: [
      { x: 31, y: 70 },
      { x: 50, y: 72 },
      { x: 69, y: 70 },
    ],
  },
  TRQ: {
    1: [{ x: 50, y: 44 }],
    2: [
      { x: 37, y: 46 },
      { x: 63, y: 46 },
    ],
  },
  ATT: {
    1: [{ x: 50, y: 15 }],
    2: [
      { x: 38, y: 18 },
      { x: 62, y: 18 },
    ],
  },
};

/** Risolve la posizione di uno slot, tenendo conto di quante caselle il modulo dà al suo ruolo. */
export function getSlotPosition(formation: Formation, slot: FormationSlot): PitchPosition {
  const central = CENTRAL_ROLE_POSITIONS[slot.role];
  if (central) {
    const sameRole = formation.slots.filter((s) => s.role === slot.role);
    const positions = central[sameRole.length] ?? central[1];
    const index = sameRole.findIndex((s) => s.id === slot.id);
    return positions[index] ?? positions[0];
  }
  return LATERAL_ROLE_POSITION[slot.role] ?? { x: 50, y: 75 };
}
