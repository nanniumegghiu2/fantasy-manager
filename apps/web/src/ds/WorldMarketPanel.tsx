import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Globe } from "lucide-react";
import type { WorldTransfer } from "@app/game-engine";
import { euro } from "./format";
import type { DsWorldData } from "./useDsWorld";

/**
 * **Mercato dal mondo**: cosa hanno combinato le altre squadre.
 *
 * Serve a una cosa sola, ma importante: far sentire che **non sei l'unico a fare mercato**. Un
 * mondo in cui solo tu compri e vendi non è un mondo, è un catalogo — e la sensazione di
 * competere sparisce. Qui i trasferimenti dell'IA scorrono uno dopo l'altro come una lista di
 * notizie, con un ingresso sfalsato che li fa leggere come un notiziario invece che come una
 * tabella.
 *
 * I dati arrivano dal salvataggio (`CareerState.worldTransfers`), quindi restano consultabili
 * anche riaprendo la carriera più avanti.
 */

interface WorldMarketPanelProps {
  transfers: readonly WorldTransfer[];
  world: DsWorldData;
  season: number;
  /** Compatta: dentro la finestra di mercato lo spazio è poco. */
  compact?: boolean;
}

export function WorldMarketPanel({ transfers, world, season, compact }: WorldMarketPanelProps) {
  const perStagione = useMemo(() => {
    const gruppi = new Map<number, WorldTransfer[]>();
    for (const t of transfers) {
      const elenco = gruppi.get(t.season);
      if (elenco) elenco.push(t);
      else gruppi.set(t.season, [t]);
    }
    // Dalla più recente: la notizia di quest'anno viene prima di quella di tre anni fa.
    return [...gruppi.entries()].sort((a, b) => b[0] - a[0]);
  }, [transfers]);

  const nomeClub = (id: string) => world.clubsById.get(id)?.name ?? "Club";

  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--surface-border)] px-4 py-8 text-center">
        <Globe size={20} className="text-[var(--text-secondary)]" />
        <p className="text-sm font-semibold">Il mercato non è ancora aperto</p>
        <p className="max-w-xs text-xs leading-relaxed text-[var(--text-secondary)]">
          Quando le altre squadre si muoveranno, le loro operazioni compariranno qui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {perStagione.map(([stagione, elenco]) => (
        <section key={stagione}>
          <h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            <Globe size={11} />
            Stagione {stagione}
            {stagione === season && (
              <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[9px] text-[var(--accent)]">
                in corso
              </span>
            )}
          </h3>

          <ul className="flex flex-col gap-1">
            <AnimatePresence initial={stagione === season}>
              {elenco.map((t, i) => (
                <motion.li
                  key={`${t.season}-${i}-${t.playerId}`}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.045, duration: 0.28, ease: "easeOut" }}
                  className="flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] leading-tight font-bold">{t.playerName}</p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-[var(--text-secondary)]">
                      <span className="truncate">{nomeClub(t.fromClubId)}</span>
                      <ArrowRight size={10} className="shrink-0 text-[var(--accent)]" />
                      <span className="truncate font-semibold text-[var(--text-primary)]">
                        {nomeClub(t.toClubId)}
                      </span>
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-extrabold tabular-nums">
                    {euro(t.fee)}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ))}

      {compact && perStagione.length > 1 && (
        <p className="px-1 text-[11px] text-[var(--text-secondary)]">
          Lo storico completo è nella scheda "Mondo".
        </p>
      )}
    </div>
  );
}
