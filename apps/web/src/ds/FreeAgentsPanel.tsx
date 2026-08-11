import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Star, TrendingDown, UserPlus } from "lucide-react";
import {
  ROLE_LABELS,
  type Department,
} from "@app/shared-types";
import {
  financesOf,
  formatEuro,
  formatWage,
  freeAgentMarket,
  type CareerState,
  type CareerWorld,
  type FreeAgent,
} from "@app/game-engine";
import { NationFlag } from "../classic/NationFlag";

/**
 * **La vetrina dei parametri zero.**
 *
 * Non costano cartellino, quindi non è il portafoglio a decidere: contano ingaggio, durata,
 * **minuti garantiti**, ambizione e ruolo, pesati dalla personalità del giocatore. È il posto in
 * cui una piccola può battere una grande offrendo il campo — e infatti l'offerta si compone qui,
 * non si preme un tasto "compra".
 *
 * Due cose che la lista deve dire a colpo d'occhio, perché sono ciò che rende la scelta a tempo:
 * quanto **decade** chi resta libero, e quanti club lo stanno già seguendo.
 */
const REPARTI: { id: Department | "tutti"; label: string }[] = [
  { id: "tutti", label: "Tutti" },
  { id: "POR", label: "POR" },
  { id: "DIF", label: "DIF" },
  { id: "CC", label: "CC" },
  { id: "ATT", label: "ATT" },
];

function Card({
  agente,
  margine,
  onFirma,
}: {
  agente: FreeAgent;
  margine: number;
  onFirma: (offer: { wage: number; seasons: number; guaranteedStarter: boolean }) => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [ingaggio, setIngaggio] = useState(agente.askingWage);
  const [anni, setAnni] = useState(agente.askingSeasons);
  const [titolare, setTitolare] = useState(agente.wantsStarter);

  const fuoriBudget = ingaggio > margine;

  return (
    <motion.div
      layout
      className="flex flex-col gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3"
    >
      <div className="flex items-start gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/15 text-xs font-black text-[var(--brand)]">
          {agente.overall}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{agente.name}</p>
          <p className="flex items-center gap-1.5 truncate text-[10px] text-[var(--text-secondary)]">
            <NationFlag nation={agente.nation} />
            {ROLE_LABELS[agente.role]} · {agente.age} anni
            {agente.origin === "regen" && " · giovane senza squadra"}
          </p>
        </div>
        {agente.windowsFree > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-lg bg-[#ff8a3d]/15 px-1.5 py-0.5 text-[9px] font-extrabold text-[#ff8a3d]">
            <TrendingDown size={10} /> −{agente.baseOverall - agente.overall}
          </span>
        )}
      </div>

      <p className="text-[11px] text-[var(--text-secondary)]">
        Chiede {formatWage(agente.askingWage)} · {agente.askingSeasons}{" "}
        {agente.askingSeasons === 1 ? "anno" : "anni"}
        {agente.wantsStarter && " · vuole giocare"}
      </p>

      {!aperto ? (
        <button
          type="button"
          onClick={() => setAperto(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] py-2 text-[11px] font-extrabold text-[var(--brand-contrast)]"
        >
          <UserPlus size={12} /> Fai un'offerta
        </button>
      ) : (
        <div className="flex flex-col gap-2 border-t border-[var(--surface-border)] pt-2">
          <label className="flex items-center justify-between text-[11px] font-bold">
            Ingaggio
            <span className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Riduci ingaggio"
                onClick={() => setIngaggio((v) => Math.max(60_000, v - 100_000))}
                className="h-6 w-6 rounded-lg border border-[var(--surface-border)] text-xs"
              >
                −
              </button>
              <span className={`w-24 text-right tabular-nums ${fuoriBudget ? "text-[#ff4d4d]" : ""}`}>
                {formatWage(ingaggio)}
              </span>
              <button
                type="button"
                aria-label="Aumenta ingaggio"
                onClick={() => setIngaggio((v) => v + 100_000)}
                className="h-6 w-6 rounded-lg border border-[var(--surface-border)] text-xs"
              >
                +
              </button>
            </span>
          </label>

          <label className="flex items-center justify-between text-[11px] font-bold">
            Durata
            <span className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Riduci durata"
                onClick={() => setAnni((v) => Math.max(1, v - 1))}
                className="h-6 w-6 rounded-lg border border-[var(--surface-border)] text-xs"
              >
                −
              </button>
              <span className="w-16 text-right tabular-nums">
                {anni} {anni === 1 ? "anno" : "anni"}
              </span>
              <button
                type="button"
                aria-label="Aumenta durata"
                onClick={() => setAnni((v) => Math.min(5, v + 1))}
                className="h-6 w-6 rounded-lg border border-[var(--surface-border)] text-xs"
              >
                +
              </button>
            </span>
          </label>

          <button
            type="button"
            onClick={() => setTitolare((v) => !v)}
            className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-[11px] font-bold transition-colors ${
              titolare ? "bg-emerald-500/20 text-emerald-300" : "bg-[var(--surface)] text-[var(--text-secondary)]"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Star size={11} /> Titolarità garantita
            </span>
            <span className="text-[9px]">{titolare ? "impegno verificato" : "no"}</span>
          </button>

          {fuoriBudget && (
            <p className="text-[10px] font-bold text-[#ff4d4d]">
              Oltre il margine ingaggi ({formatEuro(margine)}): sposta le finanze o vendi prima.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={fuoriBudget}
              onClick={() => onFirma({ wage: ingaggio, seasons: anni, guaranteedStarter: titolare })}
              className="flex-1 rounded-xl bg-[var(--brand)] py-2 text-[11px] font-extrabold text-[var(--brand-contrast)] disabled:opacity-40"
            >
              Presenta l'offerta
            </button>
            <button
              type="button"
              onClick={() => setAperto(false)}
              className="rounded-xl border border-[var(--surface-border)] px-3 text-[11px] font-bold text-[var(--text-secondary)]"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function FreeAgentsPanel({
  state,
  world,
  onSign,
}: {
  state: CareerState;
  world: CareerWorld;
  onSign: (agentId: string, offer: { wage: number; seasons: number; guaranteedStarter: boolean }) => void;
}) {
  const [reparto, setReparto] = useState<Department | "tutti">("tutti");
  const pool = useMemo(() => freeAgentMarket(state, world), [state, world]);
  const margine = useMemo(() => financesOf(state, world).wageRoom, [state, world]);

  const visibili = useMemo(
    () => (reparto === "tutti" ? pool : pool.filter((a) => a.department === reparto)).slice(0, 40),
    [pool, reparto],
  );

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">Svincolati</h3>
        <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--text-secondary)]">
          <Clock size={11} /> margine {formatEuro(margine)}
        </span>
      </header>

      <div className="flex gap-1.5">
        {REPARTI.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReparto(r.id)}
            className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors ${
              reparto === r.id
                ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {visibili.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--surface-border)] p-5 text-center text-xs text-[var(--text-secondary)]">
          Nessuno svincolato interessante in questo reparto.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {visibili.map((a) => (
            <Card key={a.id} agente={a} margine={margine} onFirma={(o) => onSign(a.id, o)} />
          ))}
        </div>
      )}
    </div>
  );
}
