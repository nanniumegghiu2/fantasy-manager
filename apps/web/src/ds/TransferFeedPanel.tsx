import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Flame,
  Newspaper,
  Radio,
  Repeat2,
  Tag,
  TrendingDown,
} from "lucide-react";
import type {
  AiSellableListing,
  CareerState,
  CareerWorld,
  WorldTransfer,
} from "@app/game-engine";
import { euro } from "./format";
import type { DsWorldData } from "./useDsWorld";

/**
 * **Il notiziario di calciomercato.**
 *
 * Sostituisce la scheda "Mondo", che era una tabella di righe tutte uguali: nome, freccia,
 * cifra. Corretta ma muta — non diceva *cosa significa* un'operazione, e quindi non si leggeva.
 * Richiesta esplicita dell'utente: un **feed in stile social**, dove i colpi di mercato si
 * scorrono come notizie e si vede anche **chi è sul mercato adesso**.
 *
 * Tre scelte che lo rendono un notiziario e non un elenco:
 *
 * 1. **Ogni operazione ha un titolo**, derivato dal tipo che il motore ora dichiara
 *    (`WorldTransfer.kind`): un colpo, una sostituzione di chi è appena partito, uno smaltimento
 *    di esubero. È l'informazione che rende leggibile il mercato IA riscritto — vedere che un
 *    club che ha ceduto il suo attaccante ne ha subito preso un altro è esattamente ciò che
 *    prima mancava, e non si poteva dedurre da due righe scollegate.
 * 2. **Le catene stanno insieme.** Una cessione e il suo rimpiazzo sono una notizia sola con due
 *    righe, non due notizie a caso di distanza l'una dall'altra.
 * 3. **In cima, il mercato di adesso**: chi hai messo in lista tu e chi le altre squadre stanno
 *    offrendo. È la parte "in diretta" del feed — le altre sono notizie già date.
 *
 * Non calcola nulla: legge `state.worldTransfers`, le liste e i cedibili che il motore produce
 * già (CLAUDE.md sez. 9).
 */

interface TransferFeedPanelProps {
  state: CareerState;
  world: CareerWorld;
  dsWorld: DsWorldData;
  /** I cedibili delle squadre IA nella finestra aperta, se ce n'è una. */
  aiSellable?: readonly AiSellableListing[];
}

/** Una notizia: l'operazione principale più, se esiste, il rimpiazzo che l'ha resa possibile. */
interface Notizia {
  key: string;
  principale: WorldTransfer;
  rimpiazzo?: WorldTransfer;
}

const STILE: Record<
  NonNullable<WorldTransfer["kind"]> | "colpo",
  { etichetta: string; icona: typeof Flame; tono: string }
> = {
  colpo: { etichetta: "Colpo di mercato", icona: Flame, tono: "#ff8a3d" },
  sostituzione: { etichetta: "Il sostituto", icona: Repeat2, tono: "#5aa9e6" },
  esubero: { etichetta: "Esubero sistemato", icona: Tag, tono: "#8fd4a4" },
};

export function TransferFeedPanel({ state, world, dsWorld, aiSellable }: TransferFeedPanelProps) {
  const [filtro, setFiltro] = useState<"tutto" | "colpi">("tutto");
  const transfers = state.worldTransfers ?? [];
  const nomeClub = (id: string) => dsWorld.clubsById.get(id)?.name ?? "Club";

  /**
   * Le notizie, dalla più recente. Una cessione e il suo rimpiazzo si fondono in un'unica voce:
   * separati direbbero metà della storia ciascuno, ed è proprio la storia intera il punto.
   */
  const notizie = useMemo(() => {
    const usati = new Set<number>();
    const out: Notizia[] = [];

    transfers.forEach((t, i) => {
      if (usati.has(i) || t.kind === "sostituzione") return;
      const rimpiazzoIdx = transfers.findIndex(
        (r, j) =>
          j !== i &&
          !usati.has(j) &&
          r.kind === "sostituzione" &&
          r.season === t.season &&
          r.toClubId === t.fromClubId &&
          r.replacesPlayerName === t.playerName,
      );
      if (rimpiazzoIdx >= 0) usati.add(rimpiazzoIdx);
      usati.add(i);
      out.push({
        key: `${t.season}-${i}-${t.playerId}`,
        principale: t,
        rimpiazzo: rimpiazzoIdx >= 0 ? transfers[rimpiazzoIdx] : undefined,
      });
    });

    // Le sostituzioni rimaste orfane (salvataggi vecchi, o catene spezzate) restano notizie a sé.
    transfers.forEach((t, i) => {
      if (usati.has(i)) return;
      out.push({ key: `${t.season}-${i}-${t.playerId}`, principale: t });
    });

    return out.sort((a, b) => b.principale.season - a.principale.season);
  }, [transfers]);

  const visibili = useMemo(
    () => (filtro === "colpi" ? notizie.filter((n) => n.principale.kind !== "esubero") : notizie),
    [notizie, filtro],
  );

  const perStagione = useMemo(() => {
    const gruppi = new Map<number, Notizia[]>();
    for (const n of visibili) {
      const elenco = gruppi.get(n.principale.season);
      if (elenco) elenco.push(n);
      else gruppi.set(n.principale.season, [n]);
    }
    return [...gruppi.entries()].sort((a, b) => b[0] - a[0]);
  }, [visibili]);

  const nostreListe = useMemo(() => {
    const nomeDi = (id: string) =>
      world.market?.nameOf(id) ?? state.generated.find((g) => g.id === id)?.name ?? "Giocatore";
    const voce = (id: string, tipo: "vendita" | "prestito") => ({ id, name: nomeDi(id), tipo });
    return [
      ...(state.lists?.transferList ?? []).map((id) => voce(id, "vendita")),
      ...(state.lists?.loanList ?? []).map((id) => voce(id, "prestito")),
    ];
  }, [state, world]);

  const finestraAperta = !!state.market;

  return (
    <div className="flex flex-col gap-3">
      {/* ---------------------------------------------------------- in diretta */}
      {finestraAperta && (nostreListe.length > 0 || (aiSellable?.length ?? 0) > 0) && (
        <section className="overflow-hidden rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/6">
          <header className="flex items-center gap-2 border-b border-[var(--accent)]/20 px-3 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
            </span>
            <p className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-[var(--accent)] uppercase">
              <Radio size={11} /> Sul mercato adesso
            </p>
          </header>

          <div className="flex flex-col gap-2 p-3">
            {nostreListe.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
                  Le tue liste
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {nostreListe.map((g) => (
                    <li
                      key={`${g.tipo}-${g.id}`}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-bold"
                    >
                      {g.name}
                      <span className="text-[9px] font-extrabold text-[var(--text-secondary)] uppercase">
                        {g.tipo === "vendita" ? "cedibile" : "prestito"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(aiSellable?.length ?? 0) > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
                  Liste trasferimenti delle altre
                </p>
                <ul className="flex flex-col gap-1">
                  {aiSellable!.slice(0, 8).map((a) => (
                    <li
                      key={a.playerId}
                      className="flex items-center gap-2 rounded-lg bg-[var(--surface)] px-2 py-1.5"
                    >
                      <span className="w-7 shrink-0 text-center text-[11px] font-black text-[var(--brand)]">
                        {a.overall}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] leading-tight font-bold">
                          {a.playerName}
                        </span>
                        <span className="block truncate text-[10px] text-[var(--text-secondary)]">
                          {a.clubName} · {a.department}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] font-extrabold tabular-nums">
                        {euro(a.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- notizie */}
      {notizie.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--surface-border)] px-4 py-8 text-center">
          <Newspaper size={20} className="text-[var(--text-secondary)]" />
          <p className="text-sm font-semibold">Nessuna notizia, per ora</p>
          <p className="max-w-xs text-xs leading-relaxed text-[var(--text-secondary)]">
            Quando le altre squadre si muoveranno, le loro operazioni compariranno qui come un
            notiziario.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-extrabold">
              <Newspaper size={15} className="text-[var(--brand)]" /> Calciomercato
            </h3>
            <div className="flex gap-1">
              {(["tutto", "colpi"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltro(f)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase transition-colors ${
                    filtro === f
                      ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                      : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
                  }`}
                >
                  {f === "tutto" ? "Tutto" : "Solo colpi"}
                </button>
              ))}
            </div>
          </div>

          {perStagione.map(([stagione, elenco]) => (
            <section key={stagione} className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 px-1 text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                Stagione {stagione}
                {stagione === state.season && (
                  <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[9px] text-[var(--accent)]">
                    in corso
                  </span>
                )}
              </p>

              <AnimatePresence initial={stagione === state.season}>
                {elenco.map((n, i) => (
                  <Post
                    key={n.key}
                    notizia={n}
                    indice={i}
                    nomeClub={nomeClub}
                  />
                ))}
              </AnimatePresence>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function Post({
  notizia,
  indice,
  nomeClub,
}: {
  notizia: Notizia;
  indice: number;
  nomeClub: (id: string) => string;
}) {
  const t = notizia.principale;
  const stile = STILE[t.kind ?? "colpo"] ?? STILE.colpo;
  const Icona = stile.icona;
  const club = nomeClub(t.toClubId);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(indice, 10) * 0.04, duration: 0.26, ease: "easeOut" }}
      className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)]"
    >
      <header className="flex items-center gap-2 px-3 pt-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
          style={{ backgroundColor: `${stile.tono}22`, color: stile.tono }}
        >
          {club.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] leading-tight font-extrabold">{club}</span>
          <span
            className="flex items-center gap-1 text-[10px] font-bold"
            style={{ color: stile.tono }}
          >
            <Icona size={10} /> {stile.etichetta}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-extrabold tabular-nums">{euro(t.fee)}</span>
      </header>

      <div className="px-3 pt-2 pb-3">
        <p className="text-[13px] leading-snug font-bold">
          {t.playerName}
          {t.department && (
            <span className="ml-1.5 rounded bg-[var(--surface)] px-1.5 py-0.5 text-[9px] font-extrabold text-[var(--text-secondary)]">
              {t.department}
            </span>
          )}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
          <span className="truncate">{nomeClub(t.fromClubId)}</span>
          <ArrowRight size={10} className="shrink-0 text-[var(--accent)]" />
          <span className="truncate font-semibold text-[var(--text-primary)]">{club}</span>
        </p>

        {/* La seconda riga della catena: senza, la notizia direbbe metà della storia. */}
        {notizia.rimpiazzo && (
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-2">
            <Repeat2 size={12} className="mt-0.5 shrink-0 text-[#5aa9e6]" />
            <p className="min-w-0 flex-1 text-[11px] leading-snug">
              <strong>{nomeClub(notizia.rimpiazzo.toClubId)}</strong> non resta scoperto: arriva{" "}
              <strong>{notizia.rimpiazzo.playerName}</strong> da{" "}
              {nomeClub(notizia.rimpiazzo.fromClubId)} per {euro(notizia.rimpiazzo.fee)}.
            </p>
          </div>
        )}

        {t.kind === "esubero" && (
          <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">
            <TrendingDown size={11} /> Era in eccedenza nel suo reparto.
          </p>
        )}
        {t.kind === "colpo" && !notizia.rimpiazzo && (
          <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)]">
            <BadgeCheck size={11} /> Operazione chiusa.
          </p>
        )}
      </div>
    </motion.article>
  );
}
