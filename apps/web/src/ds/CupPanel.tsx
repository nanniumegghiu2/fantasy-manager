import { motion } from "framer-motion";
import { Crown, Swords } from "lucide-react";
import { GROUP_ROUNDS, KNOCKOUT_TEAMS, cupTable } from "@app/game-engine";
import type { CareerState, CareerWorld } from "@app/game-engine";
import { CUP_STAGE_LABEL } from "./format";

/**
 * La Corona Continentale.
 *
 * Girone unico su sei turni, poi metà del gruppo al tabellone. Sei partite per ordinare un
 * girone restano **statisticamente poche**, e una grande può uscire più spesso di quanto
 * l'intuito suggerisca: è una conseguenza voluta del formato, non un difetto, e va detta in
 * chiaro invece di lasciarla scoprire come un'ingiustizia.
 */
export function CupPanel({ state, world }: { state: CareerState; world: CareerWorld }) {
  if (!state.cup || !world.cupTeams) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-[var(--surface-border)] px-4 py-10 text-center">
        <Crown size={22} className="text-[var(--text-secondary)]" />
        <p className="text-body font-semibold">Quest'anno niente Corona</p>
        <p className="max-w-xs text-label leading-relaxed text-[var(--text-secondary)]">
          Ci si qualifica arrivando fra le prime quattro del campionato.
        </p>
      </div>
    );
  }

  const table = cupTable(state.cup, world.cupTeams, state.seed, state.season);
  const nostroIndice = state.cup.entrants.indexOf(state.clubId);
  const nelTabellone = state.cup.stage !== "girone";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-card border border-[#f5c518]/30 bg-[#f5c518]/5 p-3">
        <Crown size={18} className="shrink-0 text-[#c9a10b]" />
        <div className="min-w-0">
          <p className="text-body leading-tight font-extrabold">Corona Continentale</p>
          <p className="text-label text-[var(--text-secondary)]">
            {nelTabellone
              ? `Fase a eliminazione · ${CUP_STAGE_LABEL[state.cup.stage] ?? state.cup.stage}`
              : `Girone unico · turno ${Math.min(state.cup.groupRound + 1, GROUP_ROUNDS)} di ${GROUP_ROUNDS}`}
          </p>
        </div>
      </div>

      {!nelTabellone && (
        <p className="px-1 text-label leading-relaxed text-[var(--text-secondary)]">
          Le prime {KNOCKOUT_TEAMS} passano al tabellone. Sei partite restano poche per mettere
          in fila un girone: qui anche una corazzata può restare fuori.
        </p>
      )}

      <div className="overflow-hidden rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)]">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="text-micro font-bold tracking-wide text-[var(--text-secondary)] uppercase">
              <th className="py-2 pr-1 pl-3 text-left">#</th>
              <th className="py-2 text-left">Squadra</th>
              <th className="px-1.5 py-2 text-center">PG</th>
              <th className="hidden px-1.5 py-2 text-center sm:table-cell">DR</th>
              <th className="py-2 pr-3 pl-1.5 text-right">Punti</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row, index) => {
              const nostra = row.teamIndex === nostroIndice;
              return (
                <motion.tr
                  key={row.teamId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index, 20) * 0.02, duration: 0.22 }}
                  className={`border-t border-[var(--surface-border)] ${
                    nostra ? "bg-[var(--brand)]/10 font-extrabold" : ""
                  }`}
                >
                  <td className="relative py-2 pr-1 pl-3 tabular-nums">
                    <span
                      className="absolute top-1 bottom-1 left-0 w-0.5 rounded-full"
                      style={{
                        backgroundColor: row.position <= KNOCKOUT_TEAMS ? "#f5c518" : "transparent",
                      }}
                    />
                    {row.position}
                  </td>
                  <td className="py-2 pr-2 leading-tight text-balance">{row.name}</td>
                  <td className="px-1.5 py-2 text-center tabular-nums">{row.played}</td>
                  <td className="hidden px-1.5 py-2 text-center tabular-nums sm:table-cell">
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </td>
                  <td className="py-2 pr-3 pl-1.5 text-right font-extrabold tabular-nums">
                    {row.points}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {state.cup.knockoutLog.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 px-1 text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            <Swords size={12} />
            Tabellone
          </p>
          <ul className="flex flex-col gap-1">
            {state.cup.knockoutLog.map((match, i) => {
              const casa = state.cup!.entrants[match.home];
              const fuori = state.cup!.entrants[match.away];
              const nostra = match.home === nostroIndice || match.away === nostroIndice;
              return (
                <li
                  key={i}
                  className={`flex items-center gap-2 rounded-control border px-3 py-2 text-label ${
                    nostra
                      ? "border-[var(--brand)]/40 bg-[var(--brand)]/5 font-bold"
                      : "border-[var(--surface-border)]"
                  }`}
                >
                  <span className="w-16 shrink-0 text-micro font-bold tracking-wide text-[var(--text-secondary)] uppercase">
                    {CUP_STAGE_LABEL[match.stage] ?? match.stage}
                  </span>
                  <span className="min-w-0 flex-1 text-right leading-tight text-balance">
                    {world.cupTeams?.[casa ?? ""]?.name ?? "—"}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {match.goalsHome}-{match.goalsAway}
                    {match.penalties && (
                      <span className="ml-1 text-label text-[var(--text-secondary)]">
                        ({match.penalties.home}-{match.penalties.away} d.c.r.)
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight text-balance">
                    {world.cupTeams?.[fuori ?? ""]?.name ?? "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
