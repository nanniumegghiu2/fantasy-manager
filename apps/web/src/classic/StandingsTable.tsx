import { motion } from "framer-motion";
import type { StandingRow } from "@app/game-engine";

/**
 * Zone della classifica, con la stessa lettura di un campionato vero: le prime posizioni
 * valgono l'Europa, le ultime la retrocessione. Sono soglie da Serie A a 20 squadre —
 * placeholder di prodotto come le altre curve del motore, non una regola di gioco.
 */
const CHAMPIONS_SPOTS = 4;
const EUROPE_SPOTS = 6;
/** Quante squadre retrocedono: le ultime tre, come nella regola del motore. */
const RELEGATED = 3;

/**
 * La zona retrocessione si calcola dalla **dimensione del campionato**, non da un numero fisso.
 * Con 18 squadre (Bundesliga, Ligue 1) un tetto fissato a 18 avrebbe marcato solo l'ultima,
 * mentre il motore ne fa retrocedere tre — la tabella avrebbe raccontato una regola diversa da
 * quella applicata.
 */
function zoneColor(position: number, teams: number): string {
  if (position <= CHAMPIONS_SPOTS) return "#3ddc6b";
  if (position <= EUROPE_SPOTS) return "#ffab2e";
  if (position > teams - RELEGATED) return "#ff4d4d";
  return "transparent";
}

export function StandingsTable({
  standings,
  /** In DS mode la classifica si guarda **durante** la stagione: "finale" sarebbe una bugia. */
  title = "Classifica finale",
  /** Se presente, il nome di ogni club avversario apre la sua scheda (`ClubViewerModal`). */
  onOpenClub,
}: {
  standings: StandingRow[];
  title?: string;
  onOpenClub?: (teamId: string, name: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)]">
      <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-4 py-3">
        <p className="text-xs font-bold tracking-wide text-[var(--text-secondary)] uppercase">
          {title}
        </p>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-[var(--text-secondary)]">
          <Legend color="#3ddc6b" label="Champions" />
          <Legend color="#ffab2e" label="Europa" />
          <Legend color="#ff4d4d" label="Retrocessione" />
        </div>
      </div>

      <div className="overflow-x-auto">
        {/* Su schermo stretto restano solo le colonne indispensabili (#, squadra, V/N/P,
            punti): partite giocate, gol e differenza reti compaiono da sm in su. Senza
            questo taglio la colonna PUNTI — la più importante — finiva fuori schermo. */}
        <table className="w-full border-collapse text-sm sm:min-w-[520px]">
          <thead>
            <tr className="text-[10px] font-bold tracking-wide text-[var(--text-secondary)] uppercase">
              <th className="py-2 pr-1 pl-3 text-left">#</th>
              <th className="py-2 text-left">Squadra</th>
              <th className="hidden px-1.5 py-2 text-center sm:table-cell">PG</th>
              <th className="px-1.5 py-2 text-center">V</th>
              <th className="px-1.5 py-2 text-center">N</th>
              <th className="px-1.5 py-2 text-center">P</th>
              <th className="hidden px-1.5 py-2 text-center sm:table-cell">GF</th>
              <th className="hidden px-1.5 py-2 text-center sm:table-cell">GS</th>
              <th className="hidden px-1.5 py-2 text-center sm:table-cell">DR</th>
              <th className="py-2 pr-3 pl-1.5 text-right">Punti</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, index) => (
              <motion.tr
                key={row.teamId}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index, 20) * 0.025, duration: 0.25 }}
                className={`border-t border-[var(--surface-border)] ${
                  row.isUser
                    ? "bg-[var(--brand)]/15 font-extrabold"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                <td className="relative py-2 pr-1 pl-3 tabular-nums">
                  <span
                    aria-hidden
                    className="absolute top-1 bottom-1 left-0 w-1 rounded-full"
                    style={{ backgroundColor: zoneColor(row.position, standings.length) }}
                  />
                  {row.position}
                </td>
                <td
                  className={`max-w-[9rem] truncate py-2 ${row.isUser ? "text-[var(--text-primary)]" : "font-semibold"}`}
                >
                  {!row.isUser && onOpenClub ? (
                    <button
                      type="button"
                      onClick={() => onOpenClub(row.teamId, row.name)}
                      className="truncate underline decoration-dotted underline-offset-2"
                    >
                      {row.name}
                    </button>
                  ) : (
                    row.name
                  )}
                </td>
                <td className="hidden px-1.5 py-2 text-center tabular-nums sm:table-cell">{row.played}</td>
                <td className="px-1.5 py-2 text-center tabular-nums">{row.wins}</td>
                <td className="px-1.5 py-2 text-center tabular-nums">{row.draws}</td>
                <td className="px-1.5 py-2 text-center tabular-nums">{row.losses}</td>
                <td className="hidden px-1.5 py-2 text-center tabular-nums sm:table-cell">
                  {row.goalsFor}
                </td>
                <td className="hidden px-1.5 py-2 text-center tabular-nums sm:table-cell">
                  {row.goalsAgainst}
                </td>
                <td className="hidden px-1.5 py-2 text-center tabular-nums sm:table-cell">
                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                </td>
                <td
                  className={`py-2 pr-3 pl-1.5 text-right tabular-nums ${row.isUser ? "" : "font-extrabold text-[var(--text-primary)]"}`}
                >
                  {row.points}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="hidden items-center gap-1 sm:flex">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
