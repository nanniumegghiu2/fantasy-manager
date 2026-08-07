import { motion } from "framer-motion";
import type { Formation } from "@app/shared-types";
import { getSlotPosition, PITCH_VIEWBOX_HEIGHT, PITCH_VIEWBOX_WIDTH } from "./pitchLayouts";
import { squadLines } from "./engineHelpers";
import type { SquadAssignment } from "./types";
import { CHEMISTRY_LINE_COLOR } from "./theme";

/**
 * Linee di intesa sul campo (sez. CLAUDE.md 3.4), disegnate una volta sola e riusate sia
 * dalla lavagna del draft sia dal campo della rosa confermata — prima erano due copie
 * quasi identiche che potevano divergere.
 *
 * Ogni linea accesa è composta da due tratti sovrapposti: un alone largo e trasparente che
 * la stacca dall'erba, e il tratto pieno sopra. Le linee ancora spente sono tratteggiate e
 * chiare invece che nere piene: si leggono come "collegamento possibile, non ancora
 * attivo" senza sporcare il campo.
 */
export function ChemistryLines({
  formation,
  assignment,
}: {
  formation: Formation;
  assignment: SquadAssignment;
}) {
  const positionBySlotId = new Map(
    formation.slots.map((slot) => [slot.id, getSlotPosition(formation, slot)]),
  );
  const lines = squadLines(formation, assignment);

  return (
    <svg
      viewBox={`0 0 ${PITCH_VIEWBOX_WIDTH} ${PITCH_VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {lines.map((line) => {
        const a = positionBySlotId.get(line.slotAId);
        const b = positionBySlotId.get(line.slotBId);
        if (!a || !b) return null;

        const color = CHEMISTRY_LINE_COLOR[line.state];
        const key = `${line.slotAId}-${line.slotBId}`;

        if (line.state === "off") {
          return (
            <line
              key={key}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={color}
              strokeWidth={0.45}
              strokeDasharray="1.6 1.6"
              strokeLinecap="round"
            />
          );
        }

        return (
          <g key={key}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.22}
            />
            <motion.line
              // La chiave include lo stato: se l'intesa cambia colore, il tratto si
              // ridisegna invece di cambiare tinta di scatto.
              key={`${key}-${line.state}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={color}
              strokeWidth={1.1}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
          </g>
        );
      })}
    </svg>
  );
}
