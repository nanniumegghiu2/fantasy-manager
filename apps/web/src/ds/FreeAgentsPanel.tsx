import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Search, SlidersHorizontal, TrendingDown, UserPlus, Users, X } from "lucide-react";
import { ROLE_LABELS, type Department } from "@app/shared-types";
import {
  financesOf,
  formatEuro,
  formatWage,
  freeAgentMarket,
  matchesCriteria,
  type CareerState,
  type CareerWorld,
  type FreeAgent,
  type SearchCriteria,
} from "@app/game-engine";
import { ContractOfferForm, type ContractOffer } from "./ContractOfferForm";
import { NationFlag } from "../classic/NationFlag";

/**
 * **La vetrina dei parametri zero.**
 *
 * Non costano cartellino, quindi non è il portafoglio a decidere: contano ingaggio, durata,
 * **minuti garantiti**, ambizione e ruolo, pesati dalla personalità del giocatore. È il posto in
 * cui una piccola può battere una grande offrendo il campo — e infatti l'offerta si compone al
 * **tavolo del contratto**, lo stesso di rinnovi e acquisti, non con un modulo a parte:
 * richiesta esplicita dell'utente, e ha una ragione oltre la coerenza visiva — è la stessa
 * decisione, quindi deve avere la stessa forma e le stesse informazioni sotto gli occhi.
 *
 * I **filtri** sono quelli della ricerca globale (`matchesCriteria`, nel motore). Prima qui si
 * poteva stringere solo per reparto, e con qualche decina di svincolati l'unico modo di trovare
 * il terzino destro under 24 era scorrere tutto.
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

function Card({ agente, onApri }: { agente: FreeAgent; onApri: () => void }) {
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
          <span
            className="flex shrink-0 items-center gap-1 rounded-lg bg-[#ff8a3d]/15 px-1.5 py-0.5 text-[9px] font-extrabold text-[#ff8a3d]"
            title="Chi resta libero perde smalto a ogni finestra"
          >
            <TrendingDown size={10} /> −{agente.baseOverall - agente.overall}
          </span>
        )}
      </div>

      <p className="text-[11px] text-[var(--text-secondary)]">
        Chiede {formatWage(agente.askingWage)} · {agente.askingSeasons}{" "}
        {agente.askingSeasons === 1 ? "anno" : "anni"}
        {agente.wantsStarter && " · vuole giocare"}
      </p>

      <button
        type="button"
        onClick={onApri}
        className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] text-[11px] font-extrabold text-[var(--brand-contrast)] active:scale-98"
      >
        <UserPlus size={12} /> Tratta il contratto
      </button>
    </motion.div>
  );
}

export function FreeAgentsPanel({
  state,
  world,
  onSign,
  onShiftFinances,
}: {
  state: CareerState;
  world: CareerWorld;
  onSign: (
    agentId: string,
    offer: { wage: number; seasons: number; guaranteedStarter: boolean },
  ) => { ok: boolean; message: string } | void;
  /** Riequilibra il bilancio senza uscire dalla scheda. */
  onShiftFinances?: (share: number) => void;
}) {
  const [reparto, setReparto] = useState<Department | "tutti">("tutti");
  const [query, setQuery] = useState("");
  const [filtriAperti, setFiltriAperti] = useState(false);
  const [etaMax, setEtaMax] = useState("");
  const [overallMin, setOverallMin] = useState("");
  /** Lo svincolato al tavolo, se aperto. */
  const [trattativa, setTrattativa] = useState<FreeAgent | null>(null);

  const pool = useMemo(() => freeAgentMarket(state, world), [state, world]);
  const margine = useMemo(() => financesOf(state, world).wageRoom, [state, world]);

  const visibili = useMemo(() => {
    const criteri: SearchCriteria = {
      query,
      department: reparto === "tutti" ? undefined : reparto,
      maxAge: etaMax ? Number(etaMax) : undefined,
      minOverall: overallMin ? Number(overallMin) : undefined,
    };
    return pool.filter((a) => matchesCriteria(a, criteri)).slice(0, 40);
  }, [pool, reparto, query, etaMax, overallMin]);

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">Svincolati</h3>
        <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--text-secondary)]">
          <Clock size={11} /> margine {formatEuro(margine)}
        </span>
      </header>

      <label className="relative block">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-secondary)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nome..."
          className="w-full rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] py-2.5 pr-11 pl-9 text-sm outline-none focus:border-[var(--brand)]"
        />
        <button
          type="button"
          onClick={() => setFiltriAperti((v) => !v)}
          aria-label="Filtri"
          className={`absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full ${
            filtriAperti
              ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
              : "text-[var(--text-secondary)]"
          }`}
        >
          <SlidersHorizontal size={15} />
        </button>
      </label>

      <div className="flex gap-1.5">
        {REPARTI.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReparto(r.id)}
            className={`min-h-9 flex-1 rounded-lg text-[11px] font-bold transition-colors ${
              reparto === r.id
                ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {filtriAperti && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3">
              <label className="flex-1 text-[10px] font-bold text-[var(--text-secondary)]">
                Età massima
                <input
                  value={etaMax}
                  onChange={(e) => setEtaMax(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="—"
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
                />
              </label>
              <label className="flex-1 text-[10px] font-bold text-[var(--text-secondary)]">
                Overall minimo
                <input
                  value={overallMin}
                  onChange={(e) => setOverallMin(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="—"
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
                />
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {visibili.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--surface-border)] p-5 text-center text-xs text-[var(--text-secondary)]">
          Nessuno svincolato con questi criteri.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {visibili.map((a) => (
            <Card key={a.id} agente={a} onApri={() => setTrattativa(a)} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {trattativa && (
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
                  <p className="truncate text-base font-extrabold">{trattativa.name}</p>
                  <p className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    Parametro zero · {trattativa.age} anni · {ROLE_LABELS[trattativa.role]}
                    {trattativa.suitors > 0 && (
                      <span className="flex items-center gap-1 font-bold text-[#ff8a3d]">
                        <Users size={11} /> {trattativa.suitors}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTrattativa(null)}
                  aria-label="Chiudi"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)]"
                >
                  <X size={15} />
                </button>
              </header>

              <ContractOfferForm
                state={state}
                world={world}
                demand={{
                  wage: trattativa.askingWage,
                  seasons: trattativa.askingSeasons,
                  clause: 0,
                  wantsStarter: trattativa.wantsStarter,
                  wantsCaptaincy: false,
                }}
                /* Non guadagna nulla da noi: l'intero ingaggio è nuovo sul monte. */
                currentWage={0}
                submitLabel="Presenta l'offerta"
                onSubmit={(offer: ContractOffer) =>
                  onSign(trattativa.id, {
                    wage: offer.wage,
                    seasons: offer.seasons,
                    guaranteedStarter: offer.guaranteedStarter ?? false,
                  }) ?? { ok: true, message: "Offerta presentata." }
                }
                onShiftFinances={onShiftFinances}
                onCancel={() => setTrattativa(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
