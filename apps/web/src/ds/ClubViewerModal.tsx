import { useMemo } from "react";
import { motion } from "framer-motion";
import { UserCog, X } from "lucide-react";
import { findCoach, searchMarket, type CareerState, type CareerWorld } from "@app/game-engine";
import { ROLE_LABELS } from "@app/shared-types";
import { overallTier } from "../classic/theme";

/**
 * **Ispeziona qualunque club del mondo.**
 *
 * Prima le squadre IA erano solo un nome e un rating: qui si vede la rosa vera (la stessa fonte
 * della ricerca di mercato, `searchMarket`, filtrata al club) e — quando esiste — l'allenatore
 * vero (`aiCoaches.ts`). I club fuori dal perimetro con identità assegnata (sez. 6) mostrano
 * "Staff tecnico": non si inventa un nome dove non c'è.
 */

export function ClubViewerModal({
  clubId,
  clubName,
  state,
  world,
  onClose,
}: {
  clubId: string;
  clubName: string;
  state: CareerState;
  world: CareerWorld;
  onClose: () => void;
}) {
  const roster = useMemo(
    () =>
      searchMarket(state, world, { query: clubName })
        .filter((r) => r.clubId === clubId)
        .sort((a, b) => b.overall - a.overall),
    [state, world, clubId, clubName],
  );

  const assegnazione = state.aiCoaches?.[clubId];
  const coach = assegnazione ? findCoach(assegnazione.coachId) : undefined;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 330, damping: 32 }}
        className="flex h-[85svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] sm:h-[78svh] sm:rounded-3xl"
      >
        <header className="flex items-center gap-3 border-b border-[var(--surface-border)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight font-extrabold">{clubName}</p>
            <p className="truncate text-[11px] text-[var(--text-secondary)]">{roster.length} giocatori</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)]"
          >
            <X size={15} />
          </button>
        </header>

        {/* Scheda allenatore: vera se il club ha un'identità assegnata, altrimenti generica. */}
        <div className="flex items-center gap-3 border-b border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/15 text-[var(--brand)]">
            <UserCog size={18} />
          </span>
          {coach ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{coach.name}</p>
              <p className="truncate text-[11px] text-[var(--text-secondary)]">
                Modulo {coach.formationId}
                {coach.tacticalPhilosophy ? ` · ${coach.tacticalPhilosophy}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Staff tecnico</p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {roster.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-secondary)]">
              Rosa non disponibile per questo club.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {roster.map((r) => {
                const tier = overallTier(r.overall);
                return (
                  <li
                    key={r.playerId}
                    className="flex items-center gap-2.5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-2.5"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold"
                      style={{ backgroundColor: tier.dot, color: tier.dotText }}
                    >
                      {r.overall}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{r.name}</p>
                      <p className="truncate text-[11px] text-[var(--text-secondary)]">
                        {ROLE_LABELS[r.role]} · {r.age} anni
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
