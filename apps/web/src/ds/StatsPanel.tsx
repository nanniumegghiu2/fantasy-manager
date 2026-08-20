import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Star, Target, Users } from "lucide-react";
import { leaders, type CareerState, type CareerWorld, type CompetitionStats } from "@app/game-engine";
import { NationFlag } from "../classic/NationFlag";

/**
 * **Le classifiche individuali di una competizione.**
 *
 * ⚠️ Richiesta dell'utente: *"voglio poter vedere le statistiche di campionati e coppe, le medie
 * voto per capire i giocatori in crescita; al momento la stagione è solo una fase inutile mentre
 * deve diventare importante tanto quanto la fase mercato"*.
 *
 * Non è una scheda nuova della barra: cinque voci a 360px lasciano 72px l'una, una sesta le porta
 * a 60 e l'etichetta verrebbe troncata (regola § 8.2). Le statistiche entrano come sotto-vista
 * dove appartengono — dentro *Classifica* e dentro *Coppe* — accanto ai numeri di squadra.
 *
 * Il calcolo sta nel motore (`leagueStats.ts`): qui si sceglie soltanto quale classifica
 * guardare.
 */

type Vista = "marcatori" | "assist" | "voti";

const VISTE: { key: Vista; label: string; icona: typeof Target }[] = [
  { key: "marcatori", label: "Marcatori", icona: Target },
  { key: "assist", label: "Assist", icona: Users },
  { key: "voti", label: "Medie voto", icona: Star },
];

export function StatsPanel({
  stats,
  state,
  world,
  /**
   * Solo la propria squadra? È il caso delle coppe: `playCupRound` non espone i marcatori degli
   * altri accoppiamenti del tabellone, quindi la classifica è la nostra — e va detto, invece di
   * far credere che quei nomi siano tutti quelli della competizione.
   */
  soloNostri = false,
}: {
  stats: CompetitionStats | undefined;
  state: CareerState;
  world: CareerWorld;
  soloNostri?: boolean;
}) {
  const [vista, setVista] = useState<Vista>("marcatori");

  const righe = useMemo(
    () => leaders(stats ?? {}, vista === "marcatori" ? "goals" : vista === "assist" ? "assists" : "rating"),
    [stats, vista],
  );

  const nostri = useMemo(
    () => new Set(state.roster.map((e) => e.playerId)),
    [state.roster],
  );

  const anagrafica = world.market?.players ?? world.players;
  const nomeDi = (id: string) => anagrafica[id]?.name ?? "Giocatore";
  const nazioneDi = (id: string) => anagrafica[id]?.nation;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-full bg-[var(--surface-raised)] p-1">
        {VISTE.map(({ key, label, icona: Icona }) => (
          <button
            key={key}
            type="button"
            onClick={() => setVista(key)}
            className={`relative min-h-9 flex-1 rounded-full px-2 py-1.5 text-label font-bold transition-colors ${
              vista === key ? "text-[var(--brand-contrast)]" : "text-[var(--text-secondary)]"
            }`}
          >
            {vista === key && (
              <motion.span
                layoutId="ds-stats-tab"
                className="absolute inset-0 rounded-full bg-[var(--brand)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative flex items-center justify-center gap-1.5">
              <Icona size={13} />
              {label}
            </span>
          </button>
        ))}
      </div>

      {soloNostri && (
        <p className="text-label leading-relaxed text-[var(--text-secondary)]">
          In coppa si contano i marcatori della tua squadra: il tabellone non espone quelli degli
          altri accoppiamenti.
        </p>
      )}

      {righe.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-[var(--surface-border)] px-4 py-10 text-center">
          <BarChart3 size={22} className="text-[var(--text-secondary)]" />
          <p className="text-body font-semibold">Ancora nessun dato</p>
          <p className="max-w-xs text-label leading-relaxed text-[var(--text-secondary)]">
            {vista === "voti"
              ? "Le medie voto compaiono dopo qualche giornata: una media su una partita sola non è una media."
              : "Le classifiche si riempiono man mano che si gioca."}
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-1">
          {righe.map((r, i) => {
            const mio = nostri.has(r.playerId);
            return (
              <li
                key={r.playerId}
                className="flex items-center gap-2.5 rounded-control px-2 py-1.5"
                style={{
                  backgroundColor: mio ? "color-mix(in srgb, var(--brand) 12%, transparent)" : undefined,
                }}
              >
                <span className="num w-5 shrink-0 text-right text-label font-bold text-[var(--text-secondary)]">
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <NationFlag nation={nazioneDi(r.playerId) ?? "Italia"} />
                  <span className={`truncate text-body ${mio ? "font-extrabold" : "font-semibold"}`}>
                    {nomeDi(r.playerId)}
                  </span>
                </span>
                <span className="num shrink-0 text-body font-extrabold">
                  {vista === "marcatori"
                    ? r.goals
                    : vista === "assist"
                      ? r.assists
                      : (r.averageRating ?? 0).toFixed(2)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
