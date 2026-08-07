import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { effectiveOverallForRole, isRoleCompatible } from "@app/game-engine";
import type { DraftRequirement } from "@app/game-engine";
import { ROLE_LABELS } from "@app/shared-types";
import type { Formation, Player } from "@app/shared-types";
import { Pitch, PitchDot } from "./Pitch";
import { ChemistryLines } from "./ChemistryLines";
import { getSlotPosition } from "./pitchLayouts";
import type { SquadAssignment } from "./types";

interface TacticalBoardProps {
  formation: Formation;
  assignment: SquadAssignment;
  /** Giocatore selezionato dall'elenco (pacchetto club o candidati): se impostato, gli slot compatibili si "illuminano" mostrando l'overall per quel ruolo. */
  selectedPlayer?: Player | null;
  /** Tocco su uno slot libero e compatibile mentre un giocatore è selezionato: conferma l'assegnazione. */
  onPickForSelectedPlayer?: (req: DraftRequirement) => void;
  /** Modalità "per ruolo": tocco su uno slot libero (senza giocatore selezionato) per vedere i candidati. */
  onSelectEmptySlot?: (req: DraftRequirement) => void;
  /**
   * Casella da cui si sta spostando un giocatore già schierato. Toccare un titolare lo
   * "solleva": si accendono le caselle dove sa giocare (vuote o occupate da un compagno con
   * cui lo scambio è possibile), così si può riordinare la squadra per migliorare l'intesa.
   */
  movingSlotId?: string | null;
  onStartMove?: (slotId: string) => void;
  onMoveTo?: (slotId: string) => void;
  /** Annulla lo spostamento (trascinamento rilasciato fuori da una casella valida). */
  onCancelMove?: () => void;
}

/**
 * Dove può andare il giocatore sollevato da `fromSlotId`. Una casella vuota va bene se il
 * ruolo è nelle sue corde; una occupata va bene solo se lo **scambio** funziona in entrambe
 * le direzioni, altrimenti si romperebbe la formazione spostando un compagno in un ruolo che
 * non sa fare.
 */
function canMoveTo(
  formation: Formation,
  assignment: SquadAssignment,
  fromSlotId: string,
  toSlotId: string,
): boolean {
  if (fromSlotId === toSlotId) return false;
  const from = formation.slots.find((s) => s.id === fromSlotId);
  const to = formation.slots.find((s) => s.id === toSlotId);
  const mover = assignment.starters[fromSlotId];
  if (!from || !to || !mover) return false;
  if (!isRoleCompatible(mover, to.role)) return false;
  const occupant = assignment.starters[toSlotId];
  return !occupant || isRoleCompatible(occupant, from.role);
}

export function TacticalBoard({
  formation,
  assignment,
  selectedPlayer,
  onPickForSelectedPlayer,
  onSelectEmptySlot,
  movingSlotId,
  onStartMove,
  onMoveTo,
  onCancelMove,
}: TacticalBoardProps) {
  /**
   * Trascinamento con **pointer event**, non con il drag-and-drop HTML5: quest'ultimo non
   * esiste sui browser mobile, e l'app è mobile-first. Il movimento diventa un trascinamento
   * solo dopo una soglia di qualche pixel, altrimenti un semplice tocco verrebbe interpretato
   * come drag e romperebbe la selezione a click che resta il modo principale di giocare.
   */
  const press = useRef<{ slotId: string; x: number; y: number; dragging: boolean } | null>(null);

  function handlePointerDownOnSlot(slotId: string, e: ReactPointerEvent<HTMLElement>) {
    if (selectedPlayer) return;
    press.current = { slotId, x: e.clientX, y: e.clientY, dragging: false };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const start = press.current;
    if (!start || start.dragging) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
    start.dragging = true;
    onStartMove?.(start.slotId);
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const start = press.current;
    press.current = null;
    if (!start?.dragging) return; // tocco secco: se ne occupa onClick
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const target = element?.closest<HTMLElement>("[data-slot-id]");
    if (target?.dataset.droppable === "true" && target.dataset.slotId) {
      onMoveTo?.(target.dataset.slotId);
    } else {
      onCancelMove?.();
    }
  }

  return (
    <div className="flex h-full min-h-0 justify-center">
      <Pitch onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        <ChemistryLines formation={formation} assignment={assignment} />

        {formation.slots.map((slot) => {
          const pos = getSlotPosition(formation, slot);
          if (!pos) return null;
          const player = assignment.starters[slot.id];
          const req: DraftRequirement = {
            id: slot.id,
            role: slot.role,
            department: slot.department,
          };

          // Spostamento in corso: si accendono le destinazioni valide, il resto si spegne.
          if (movingSlotId) {
            const isSource = slot.id === movingSlotId;
            const valid = canMoveTo(formation, assignment, movingSlotId, slot.id);
            return (
              <PitchDot
                key={slot.id}
                x={pos.x}
                y={pos.y}
                label={ROLE_LABELS[slot.role]}
                shortLabel={slot.role}
                playerName={player?.name}
                overall={player?.overall}
                nation={player?.nation}
                league={player?.league}
                state={isSource || valid ? "lit" : "dim"}
                slotId={slot.id}
                dragging={isSource}
                droppable={valid}
                onClick={
                  isSource
                    ? () => onMoveTo?.(movingSlotId)
                    : valid
                      ? () => onMoveTo?.(slot.id)
                      : undefined
                }
              />
            );
          }

          if (player) {
            return (
              <PitchDot
                key={slot.id}
                x={pos.x}
                y={pos.y}
                label={ROLE_LABELS[slot.role]}
                shortLabel={slot.role}
                playerName={player.name}
                overall={player.overall}
                nation={player.nation}
                league={player.league}
                state="filled"
                slotId={slot.id}
                onClick={
                  !selectedPlayer && onStartMove ? () => onStartMove(slot.id) : undefined
                }
                onPointerDown={
                  !selectedPlayer && onStartMove
                    ? (e) => handlePointerDownOnSlot(slot.id, e)
                    : undefined
                }
              />
            );
          }

          if (selectedPlayer) {
            const compatible = isRoleCompatible(selectedPlayer, slot.role);
            return (
              <PitchDot
                key={slot.id}
                x={pos.x}
                y={pos.y}
                label={ROLE_LABELS[slot.role]}
                shortLabel={slot.role}
                overall={compatible ? effectiveOverallForRole(selectedPlayer, slot.role) : undefined}
                state={compatible ? "lit" : "dim"}
                onClick={compatible ? () => onPickForSelectedPlayer?.(req) : undefined}
              />
            );
          }

          return (
            <PitchDot
              key={slot.id}
              x={pos.x}
              y={pos.y}
              label={ROLE_LABELS[slot.role]}
                shortLabel={slot.role}
              state="empty"
              onClick={onSelectEmptySlot ? () => onSelectEmptySlot(req) : undefined}
            />
          );
        })}
      </Pitch>
    </div>
  );
}
