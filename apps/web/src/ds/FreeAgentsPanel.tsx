import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Search, SlidersHorizontal, TrendingDown, UserPlus, Users, X } from "lucide-react";
import { ROLES, ROLE_DEPARTMENT, ROLE_LABELS, type Department, type Role } from "@app/shared-types";
import {
  financesOf,
  formatEuro,
  formatWage,
  freeAgentMarket,
  matchesCriteria,
  type CareerState,
  type CareerWorld,
  type FreeAgent,
  type FreeAgentCounter,
  type FreeAgentOutcome,
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

/** Un filtro a intervallo (min-max): due caselle affiancate, come nella ricerca globale. */
function Intervallo({
  label,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  const campo =
    "w-full rounded-control border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-body text-[var(--text-primary)] outline-none focus:border-[var(--brand)]";
  return (
    <div className="text-label font-bold text-[var(--text-secondary)]">
      {label}
      <div className="mt-1 flex items-center gap-1">
        <input
          value={min}
          onChange={(e) => onMin(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="min"
          aria-label={`${label} minimo`}
          className={campo}
        />
        <input
          value={max}
          onChange={(e) => onMax(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="max"
          aria-label={`${label} massimo`}
          className={campo}
        />
      </div>
    </div>
  );
}

function Card({ agente, onApri }: { agente: FreeAgent; onApri: () => void }) {
  return (
    <motion.div
      layout
      className="flex flex-col gap-2 rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3"
    >
      <div className="flex items-start gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[var(--brand)]/15 text-label font-black text-[var(--brand)]">
          {agente.overall}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-extrabold">{agente.name}</p>
          <p className="flex items-center gap-1.5 truncate text-label text-[var(--text-secondary)]">
            <NationFlag nation={agente.nation} />
            {ROLE_LABELS[agente.role]} · {agente.age} anni
            {agente.origin === "regen" && " · giovane senza squadra"}
          </p>
        </div>
        {agente.windowsFree > 0 && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-control bg-[#ff8a3d]/15 px-1.5 py-0.5 text-label font-extrabold text-[#ff8a3d]"
            title="Chi resta libero perde smalto a ogni finestra"
          >
            <TrendingDown size={10} /> −{agente.baseOverall - agente.overall}
          </span>
        )}
      </div>

      <p className="text-label text-[var(--text-secondary)]">
        Chiede {formatWage(agente.askingWage)} · {agente.askingSeasons}{" "}
        {agente.askingSeasons === 1 ? "anno" : "anni"}
        {agente.wantsStarter && " · vuole giocare"}
      </p>

      <button
        type="button"
        onClick={onApri}
        className="flex min-h-10 items-center justify-center gap-1.5 rounded-control bg-[var(--brand)] text-label font-extrabold text-[var(--brand-contrast)] active:scale-98"
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
  ) => {
    ok: boolean;
    message: string;
    counter?: FreeAgentCounter;
    outcome?: FreeAgentOutcome;
    rivalClubName?: string;
  } | void;
  /** Riequilibra il bilancio senza uscire dalla scheda. */
  onShiftFinances?: (share: number) => void;
}) {
  const [reparto, setReparto] = useState<Department | "tutti">("tutti");
  const [query, setQuery] = useState("");
  const [filtriAperti, setFiltriAperti] = useState(false);
  /** Filtri alla pari della ricerca globale: intervalli su entrambi gli assi, ruoli multipli. */
  const [ruoli, setRuoli] = useState<Set<Role>>(new Set());
  const [etaMin, setEtaMin] = useState("");
  const [etaMax, setEtaMax] = useState("");
  const [overallMin, setOverallMin] = useState("");
  const [overallMax, setOverallMax] = useState("");
  const [ordine, setOrdine] = useState<"overall" | "eta" | "ingaggio">("overall");
  /** Lo svincolato al tavolo, se aperto. */
  const [trattativa, setTrattativa] = useState<FreeAgent | null>(null);
  /** L'esito dell'ultima offerta: se c'è una controproposta, si vede al tavolo. */
  const [contro, setContro] = useState<{
    id: string;
    messaggio: string;
    counter?: FreeAgentCounter;
    outcome?: FreeAgentOutcome;
    rivalClubName?: string;
  } | null>(null);

  const pool = useMemo(() => freeAgentMarket(state, world), [state, world]);
  const margine = useMemo(() => financesOf(state, world).wageRoom, [state, world]);

  /**
   * Chi è già nostro non è più uno svincolato.
   *
   * Il motore lo sa (`freeAgentMarket` filtra su `freeAgentsSigned` e sulla rosa), ma il filtro
   * qui è la rete di sicurezza contro il difetto segnalato dall'utente — un giocatore appena
   * firmato che resta in lista e si può ritrattare. Costa un confronto e chiude la porta a
   * qualunque disallineamento futuro fra le due letture.
   */
  const inRosa = useMemo(() => new Set(state.roster.map((e) => e.playerId)), [state.roster]);

  const visibili = useMemo(() => {
    const criteri: SearchCriteria = {
      query,
      department: reparto === "tutti" ? undefined : reparto,
      roles: ruoli.size > 0 ? [...ruoli] : undefined,
      minAge: etaMin ? Number(etaMin) : undefined,
      maxAge: etaMax ? Number(etaMax) : undefined,
      minOverall: overallMin ? Number(overallMin) : undefined,
      maxOverall: overallMax ? Number(overallMax) : undefined,
    };
    const filtrati = pool.filter((a) => !inRosa.has(a.id) && matchesCriteria(a, criteri));
    const ordinati = [...filtrati].sort((a, b) => {
      if (ordine === "eta") return a.age - b.age;
      if (ordine === "ingaggio") return a.askingWage - b.askingWage;
      return b.overall - a.overall;
    });
    return ordinati.slice(0, 40);
  }, [pool, inRosa, reparto, ruoli, query, etaMin, etaMax, overallMin, overallMax, ordine]);

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-body font-extrabold">Svincolati</h3>
        <span className="flex items-center gap-1 text-label font-bold text-[var(--text-secondary)]">
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
          className="w-full rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] py-2.5 pr-11 pl-9 text-body outline-none focus:border-[var(--brand)]"
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
            className={`min-h-9 flex-1 rounded-control text-label font-bold transition-colors ${
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
            <div className="flex flex-col gap-2.5 rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3">
              {/* Ruoli puntuali del reparto scelto: senza reparto sarebbe un elenco di 14 voci. */}
              {reparto !== "tutti" && (
                <div className="flex flex-wrap gap-1">
                  {ROLES.filter((r) => ROLE_DEPARTMENT[r] === reparto).map((r) => {
                    const attivo = ruoli.has(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setRuoli((prev) => {
                            const next = new Set(prev);
                            if (next.has(r)) next.delete(r);
                            else next.add(r);
                            return next;
                          })
                        }
                        className={`min-h-8 rounded-control px-2.5 text-label font-bold transition-colors ${
                          attivo
                            ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                            : "bg-[var(--surface)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Intervallo label="Età" min={etaMin} max={etaMax} onMin={setEtaMin} onMax={setEtaMax} />
                <Intervallo
                  label="Overall"
                  min={overallMin}
                  max={overallMax}
                  onMin={setOverallMin}
                  onMax={setOverallMax}
                />
              </div>

              <div className="flex gap-1.5">
                {(
                  [
                    ["overall", "Overall"],
                    ["eta", "Età"],
                    ["ingaggio", "Ingaggio"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOrdine(key)}
                    className={`min-h-9 flex-1 rounded-control text-label font-bold transition-colors ${
                      ordine === key
                        ? "bg-[var(--accent)] text-[var(--brand-contrast)]"
                        : "bg-[var(--surface)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {visibili.length === 0 ? (
        <p className="rounded-card border border-dashed border-[var(--surface-border)] p-5 text-center text-label text-[var(--text-secondary)]">
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
              className="flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] sm:rounded-card"
            >
              <header className="flex items-start justify-between gap-3 border-b border-[var(--surface-border)] p-4">
                <div className="min-w-0">
                  <p className="truncate text-body font-extrabold">{trattativa.name}</p>
                  <p className="flex items-center gap-2 text-label text-[var(--text-secondary)]">
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

              {/**
               * **La controproposta dell'agente.**
               *
               * Prima un no era definitivo e muto ("ho accettato la proposta del…"): si scopriva
               * di aver perso senza sapere di quanto, quindi rilanciare era tirare a indovinare e
               * la vetrina diventava un vicolo cieco. Qui si legge **cosa serve** per superare la
               * concorrenza, e il tasto la applica al tavolo senza doverla ricomporre a mano.
               */}
              {contro?.id === trattativa.id && (
                <div
                  className="border-b px-4 py-2.5"
                  style={{
                    borderColor: contro.outcome === "disinteressato" ? "#ff4d4d33" : "#ff8a3d33",
                    backgroundColor: contro.outcome === "disinteressato" ? "#ff4d4d12" : "#ff8a3d12",
                  }}
                >
                  <p className="text-label leading-snug font-medium">{contro.messaggio}</p>
                  {contro.counter && (
                    <p className="mt-1.5 text-label font-bold text-[#ff8a3d]">
                      Serve {formatWage(contro.counter.wage)}
                      {contro.counter.needsStarter && " + un posto da titolare garantito"}
                      {contro.counter.seasons && ` · ${contro.counter.seasons} anni`}
                    </p>
                  )}
                </div>
              )}

              {/**
               * **Il disinteresse chiude la trattativa** (specifica dell'utente).
               *
               * Prima ogni no aveva la stessa forma, e non si capiva se valesse la pena
               * rilanciare: si chiudeva la scheda in entrambi i casi. Qui il tavolo sparisce
               * insieme alle sue leve — lasciare i controlli attivi sotto un "non se ne fa nulla"
               * inviterebbe a insistere contro un muro. Se c'era un club rivale, a quel punto il
               * giocatore è **davvero** andato lì: il motore lo toglie dalla vetrina.
               */}
              {contro?.id === trattativa.id && contro.outcome === "disinteressato" ? (
                <div className="flex flex-col gap-3 p-4">
                  <p className="text-label leading-relaxed text-[var(--text-secondary)]">
                    {contro.rivalClubName
                      ? `Ha firmato altrove: non è più sul mercato.`
                      : `Non c'è una cifra che lo convinca: meglio cercare altrove.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setContro(null);
                      setTrattativa(null);
                    }}
                    className="min-h-11 w-full rounded-card bg-[var(--brand)] text-body font-extrabold text-[var(--brand-contrast)] active:scale-98"
                  >
                    Chiudi la trattativa
                  </button>
                </div>
              ) : (

              <ContractOfferForm
                key={`${trattativa.id}-${contro?.counter?.wage ?? 0}`}
                state={state}
                world={world}
                demand={{
                  /* La controproposta diventa la nuova richiesta sul tavolo: applicarla è un
                     gesto solo, non una ricostruzione a mano dei tre campi. */
                  wage: contro?.counter?.wage ?? trattativa.askingWage,
                  seasons: contro?.counter?.seasons ?? trattativa.askingSeasons,
                  clause: 0,
                  wantsStarter: contro?.counter?.needsStarter ?? trattativa.wantsStarter,
                  wantsCaptaincy: false,
                }}
                /* Non guadagna nulla da noi: l'intero ingaggio è nuovo sul monte. */
                currentWage={0}
                submitLabel="Presenta l'offerta"
                onSubmit={(offer: ContractOffer) => {
                  const esito = onSign(trattativa.id, {
                    wage: offer.wage,
                    seasons: offer.seasons,
                    guaranteedStarter: offer.guaranteedStarter ?? false,
                  });
                  if (!esito) return { ok: true, message: "Offerta presentata." };
                  if (esito.ok) {
                    // Firmato: il tavolo si chiude da solo. Lasciarlo aperto permetteva di
                    // ripresentare un'offerta per un giocatore ormai nostro.
                    setContro(null);
                    setTrattativa(null);
                  } else {
                    setContro({
                      id: trattativa.id,
                      messaggio: esito.message,
                      counter: esito.counter,
                      outcome: esito.outcome,
                      rivalClubName: esito.rivalClubName,
                    });
                  }
                  return esito;
                }}
                onShiftFinances={onShiftFinances}
                onCancel={() => {
                  setContro(null);
                  setTrattativa(null);
                }}
              />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
