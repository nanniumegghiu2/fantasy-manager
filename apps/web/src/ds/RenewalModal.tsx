import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Minus, Plus, Star, X } from "lucide-react";
import {
  contractFor,
  financesOf,
  formatContractTotal,
  formatEuro,
  formatWage,
  playerFactsOf,
  renewalDemandOf,
  type CareerState,
  type CareerWorld,
} from "@app/game-engine";

/**
 * **Il tavolo del rinnovo.**
 *
 * Non si negozia una cifra ma un **pacchetto**: ingaggio annuo, durata, titolarità, fascia. Il
 * giocatore lo giudica con la *sua* scala (la personalità), quindi la stessa proposta convince un
 * mercenario e offende un giovane che voleva giocare — ed è la ragione per cui qui si vede sempre
 * *cosa chiede*, non solo quanto costa.
 *
 * Il margine della cassa ingaggi è mostrato accanto alla cifra: senza, l'utente scopriva di non
 * potersi permettere il rinnovo solo dopo aver premuto.
 */
export function RenewalModal({
  state,
  world,
  playerId,
  onRenew,
  onClose,
}: {
  state: CareerState;
  world: CareerWorld;
  playerId: string;
  onRenew: (offer: {
    wage: number;
    seasons: number;
    guaranteedStarter?: boolean;
    captain?: boolean;
  }) => { ok: boolean; message: string };
  onClose: () => void;
}) {
  const facts = useMemo(() => playerFactsOf(state, world, playerId), [state, world, playerId]);
  const terms = useMemo(() => renewalDemandOf(state, world, playerId), [state, world, playerId]);
  const contratto = useMemo(() => contractFor(state, world, playerId), [state, world, playerId]);
  const margine = useMemo(() => financesOf(state, world).wageRoom, [state, world]);

  const [ingaggio, setIngaggio] = useState(terms?.wage ?? contratto?.wage ?? 500_000);
  const [anni, setAnni] = useState(terms?.seasons ?? 2);
  const [titolare, setTitolare] = useState(terms?.wantsStarter ?? false);
  const [capitano, setCapitano] = useState(terms?.wantsCaptaincy ?? false);
  const [esito, setEsito] = useState<{ ok: boolean; message: string } | null>(null);

  if (!facts || !terms) return null;

  const aumento = ingaggio - facts.wage;
  const fuoriMargine = aumento > margine;

  const passo = ingaggio >= 2_000_000 ? 250_000 : 50_000;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 330, damping: 32 }}
        className="flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--surface-border)] p-4">
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold">{facts.name}</p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {contratto
                ? `Scade nel ${contratto.until} · ${formatWage(contratto.wage)}`
                : "Senza contratto"}
            </p>
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

        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5">
          <p className="text-[10px] font-extrabold tracking-wider text-amber-300 uppercase">Chiede</p>
          <p className="mt-0.5 text-xs leading-snug font-medium text-amber-100/90">
            {formatWage(terms.wage)} · {terms.seasons} {terms.seasons === 1 ? "anno" : "anni"}
            {terms.wantsStarter && " · un posto da titolare"}
            {terms.wantsCaptaincy && " · la fascia"}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <label className="flex items-center justify-between rounded-xl bg-[var(--surface-raised)] px-3 py-2.5 text-xs font-bold">
            Ingaggio annuo
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Riduci ingaggio"
                onClick={() => setIngaggio((v) => Math.max(60_000, v - passo))}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--surface-border)]"
              >
                <Minus size={12} />
              </button>
              <span className={`w-24 text-right tabular-nums ${fuoriMargine ? "text-[#ff4d4d]" : ""}`}>
                {formatWage(ingaggio)}
              </span>
              <button
                type="button"
                aria-label="Aumenta ingaggio"
                onClick={() => setIngaggio((v) => v + passo)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--surface-border)]"
              >
                <Plus size={12} />
              </button>
            </span>
          </label>

          <label className="flex items-center justify-between rounded-xl bg-[var(--surface-raised)] px-3 py-2.5 text-xs font-bold">
            Durata
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Riduci durata"
                onClick={() => setAnni((v) => Math.max(1, v - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--surface-border)]"
              >
                <Minus size={12} />
              </button>
              <span className="w-24 text-right tabular-nums">
                {anni} {anni === 1 ? "anno" : "anni"}
              </span>
              <button
                type="button"
                aria-label="Aumenta durata"
                onClick={() => setAnni((v) => Math.min(5, v + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--surface-border)]"
              >
                <Plus size={12} />
              </button>
            </span>
          </label>

          <p className="px-1 text-[11px] font-bold text-[var(--brand)]">
            {formatContractTotal(ingaggio, anni)}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTitolare((v) => !v)}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-bold transition-colors ${
                titolare
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
              }`}
            >
              <Check size={12} /> Titolarità
            </button>
            <button
              type="button"
              onClick={() => setCapitano((v) => !v)}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-bold transition-colors ${
                capitano
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
              }`}
            >
              <Star size={12} /> Fascia
            </button>
          </div>

          <p
            className={`text-[11px] font-semibold ${
              fuoriMargine ? "text-[#ff4d4d]" : "text-[var(--text-secondary)]"
            }`}
          >
            {aumento > 0
              ? `L'aumento pesa ${formatWage(aumento)} sul monte · margine ${formatEuro(margine)}`
              : `Margine cassa ingaggi: ${formatEuro(margine)}`}
          </p>

          {esito && (
            <p
              className="rounded-xl px-3 py-2.5 text-[11px] font-bold"
              style={{
                backgroundColor: esito.ok ? "#3ddc6b22" : "#ff4d4d22",
                color: esito.ok ? "#2a9b4d" : "#ff4d4d",
              }}
            >
              {esito.message}
            </p>
          )}
        </div>

        <footer className="border-t border-[var(--surface-border)] p-3">
          <button
            type="button"
            disabled={fuoriMargine || esito?.ok === true}
            onClick={() => {
              const r = onRenew({
                wage: ingaggio,
                seasons: anni,
                guaranteedStarter: titolare,
                captain: capitano,
              });
              setEsito(r);
            }}
            className="w-full rounded-2xl bg-[var(--brand)] py-3 text-sm font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-98 disabled:opacity-40"
          >
            {esito?.ok ? "Rinnovo firmato" : "Presenta la proposta"}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
