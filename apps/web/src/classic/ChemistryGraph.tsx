import { ROLE_LABELS } from "@app/shared-types";
import type { Formation, Player } from "@app/shared-types";
import { Pitch, PitchDot } from "./Pitch";
import { ChemistryLines } from "./ChemistryLines";
import { getSlotPosition } from "./pitchLayouts";

/** Campo della rosa confermata: stessi gettoni e stesse linee della lavagna di draft (sez. CLAUDE.md 3.4/3.5). */
export function ChemistryGraph({
  formation,
  starters,
}: {
  formation: Formation;
  starters: Record<string, Player>;
}) {
  return (
    <Pitch>
      <ChemistryLines formation={formation} assignment={{ starters }} />

      {formation.slots.map((slot) => {
        const pos = getSlotPosition(formation, slot);
        const player = starters[slot.id];
        if (!pos || !player) return null;
        return (
          <PitchDot
            key={slot.id}
            x={pos.x}
            y={pos.y}
            label={ROLE_LABELS[slot.role]}
                shortLabel={slot.role}
            playerName={player.name}
            overall={player.overall}
            state="filled"
          />
        );
      })}
    </Pitch>
  );
}
