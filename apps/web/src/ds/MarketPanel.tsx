import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  Banknote,
  Check,
  ClipboardList,
  Globe,
  LayoutGrid,
  MessagesSquare,
  Plane,
  Search,
  SlidersHorizontal,
  Smile,
  Star,
  Tag,
  TriangleAlert,
  UserCog,
  Wallet,
  X,
} from "lucide-react";
import type { Department, Role } from "@app/shared-types";
import { ROLE_LABELS } from "@app/shared-types";
import {
  MAX_SQUAD_SIZE,
  computeAvgRating,
  currentLineup,
  findCoach,
  getFormation,
  livePromiseStatus,
  playerValue,
  standoffCandidates,
  STANDOFF_MORALE_THRESHOLD,
  type AiSellableListing,
  type CareerState,
  type CareerWorld,
  type Coach,
  type CoachChoice,
  type MarketAction,
  type MarketSnapshot,
  type RoleCandidate,
  type SearchCriteria,
  type SearchResult,
  type StandingRow,
} from "@app/game-engine";
import { Pitch, PitchDot } from "../classic/Pitch";
import { getSlotPosition } from "../classic/pitchLayouts";
import { NationFlag } from "../classic/NationFlag";
import { overallTier } from "../classic/theme";
import { DealToast, type Deal } from "./DealToast";
import { MarketBriefing } from "./MarketBriefing";
import { WorldMarketPanel } from "./WorldMarketPanel";
import { CoachPromisesPanel, type LiveCoachPromise } from "./CoachPromisesPanel";
import { CoachNegotiationChat } from "./CoachNegotiationChat";
import type { CoachPromise } from "@app/game-engine";
import type { DsWorldData } from "./useDsWorld";
import { DEPARTMENT_LABEL, RoleChips } from "./RoleChips";
import { euro, moraleLabel } from "./format";

/**
 * **La finestra di mercato: il cuore della modalità.**
 *
 * Quattro schede, e l'ordine non è casuale — è il giro che un direttore sportivo fa davvero:
 * chi mi cerca (*Offerte*), chi voglio (*Ricerca*), chi lascio andare (*La mia rosa*), con chi
 * gioco (*Allenatore*). Il pannello blocca il calendario finché non lo si chiude: trattare
 * mentre le giornate scorrono renderebbe il mercato una decorazione.
 *
 * La differenza rispetto alla prima versione sta nella scheda *Ricerca*: gli acquisti non sono
 * più otto nomi decisi dal sistema ma **tutto il database**, filtrabile e comprabile al valore
 * di mercato. È questo a trasformare il mercato da vetrina in caccia.
 */

type Tab = "offerte" | "ricerca" | "rosa" | "mister" | "mondo";

const TAB: { key: Tab; label: string; icon: typeof Search }[] = [
  { key: "offerte", label: "Offerte", icon: ArrowUpRight },
  { key: "ricerca", label: "Ricerca", icon: Search },
  { key: "rosa", label: "Rosa", icon: ClipboardList },
  { key: "mister", label: "Mister", icon: UserCog },
  { key: "mondo", label: "Mondo", icon: Globe },
];

const DEPARTMENTS: Department[] = ["POR", "DIF", "CC", "ATT"];

function Badge({ overall }: { overall: number }) {
  const tier = overallTier(overall);
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold"
      style={{ backgroundColor: tier.dot, color: tier.dotText }}
    >
      {overall}
    </span>
  );
}

function Vuoto({ testo }: { testo: string }) {
  return <p className="py-10 text-center text-sm text-[var(--text-secondary)]">{testo}</p>;
}

interface MarketPanelProps {
  state: CareerState;
  world: CareerWorld;
  /** Il catalogo di club e campionati: serve solo a dare un nome ai club nel mercato del mondo. */
  dsWorld: DsWorldData;
  snapshot: MarketSnapshot;
  standings: StandingRow[];
  deal: Deal | null;
  coachChoices: CoachChoice[];
  onAction: (action: MarketAction) => void;
  onHireCoach: (coachId: string, promises?: CoachPromise[], totalCost?: number) => void;
  onSearch: (criteria: SearchCriteria) => SearchResult[];
  /** Apre la trattativa per un'offerta ricevuta. */
  onNegotiateOffer: (playerId: string) => void;
  /** Apre la trattativa per comprare un giocatore trovato con la ricerca. */
  onNegotiatePurchase: (target: SearchResult) => void;
  /** Apre la trattativa per una destinazione di prestito proposta (minuti garantiti, non prezzo). */
  onNegotiateLoan: (playerId: string) => void;
  /** Apre il faccia a faccia con un giocatore (scheda Rosa → Chat). */
  onOpenStandoff: (playerId: string) => void;
  /** Chi ha già chiuso la sua chat in questa finestra: non deve restare nel badge/nell'elenco. */
  standoffChiuse: ReadonlySet<string>;
  /**
   * Propone al mister un'alternativa **scelta dall'utente** per una promessa nominata, a
   * mercato aperto — non aspetta la prossima negoziazione stagionale. Torna la risposta vera
   * del mister (accettata o no), da mostrare così com'è invece di un messaggio generico.
   */
  onProposePromiseAlternative: (
    promise: CoachPromise,
    candidate: RoleCandidate,
  ) => { accepted: boolean; message: string };
  onClose: () => void;
}

export function MarketPanel({
  state,
  world,
  dsWorld,
  snapshot,
  standings,
  deal,
  coachChoices,
  onAction,
  onHireCoach,
  onSearch,
  onOpenStandoff,
  standoffChiuse,
  onProposePromiseAlternative,
  onNegotiateOffer,
  onNegotiatePurchase,
  onNegotiateLoan,
  onClose,
}: MarketPanelProps) {
  /**
   * Si apre sulla **strategia**, cioè sulla propria rosa.
   *
   * Richiesta esplicita dell'utente: aprendo il mercato — a inizio stagione come a metà — la
   * prima cosa da fare è decidere chi cedere, e trovarsi davanti le offerte altrui significa
   * cominciare reagendo invece che programmando.
   */
  const [tab, setTab] = useState<Tab>("rosa");
  const budget = state.budget;

  /** Badge di notifica sul tab Rosa: quanti giocatori aspettano un faccia a faccia. */
  const chatInSospeso = useMemo(
    () => standoffCandidates(state, world).filter((c) => !standoffChiuse.has(c.playerId)).length,
    [state, world, standoffChiuse],
  );

  /** Il valore corrente di ogni nostro giocatore: lo usano sia le offerte sia la rosa. */
  const valoriRosa = useMemo(() => {
    const mappa = new Map<string, number>();
    for (const entry of state.roster) {
      mappa.set(entry.playerId, playerValue(state, world, entry.playerId));
    }
    return mappa;
  }, [state, world]);

  /**
   * Lo stato **live** delle promesse: si ricalcola a ogni transazione (`state` cambia ad ogni
   * azione di mercato), non solo alla chiusura della finestra.
   */
  const promesseLive: LiveCoachPromise[] = useMemo(
    () => livePromiseStatus(state, world),
    [state, world],
  );

  /** La promessa per cui si sta scegliendo un'alternativa dal database, se aperta. */
  const [alternativaPer, setAlternativaPer] = useState<LiveCoachPromise | null>(null);
  /** L'ultima risposta del mister a una proposta di alternativa: un avviso breve, non un meeting. */
  const [rispostaAlternativa, setRispostaAlternativa] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="relative flex h-[92svh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] sm:h-[86svh] sm:rounded-3xl"
      >
        <DealToast deal={deal} />

        <header className="flex items-center gap-3 border-b border-[var(--surface-border)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-widest text-[var(--accent)] uppercase">
              Mercato {snapshot.window === "estiva" ? "estivo" : "di riparazione"}
            </p>
            {/* Il budget "salta" a ogni variazione: è il numero che l'utente sta guardando
                mentre decide, e vederlo cambiare chiude il cerchio con la conferma. */}
            <motion.p
              key={budget}
              initial={{ scale: 1.14 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
              className="flex items-center gap-1.5 text-lg leading-tight font-extrabold"
            >
              <Wallet size={17} />
              {euro(budget)}
            </motion.p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-95"
          >
            Chiudi il mercato
          </button>
        </header>

        {/* Dove sei, prima di decidere: nella finestra invernale è il contesto che dice se
            comprare per vincere o per salvarsi. */}
        <MarketBriefing state={state} world={world} standings={standings} />

        <nav className="flex gap-1 border-b border-[var(--surface-border)] px-2 py-2">
          {TAB.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative min-w-0 flex-1 rounded-full px-2 py-2 text-[11px] font-bold transition-colors ${
                tab === key ? "text-[var(--brand-contrast)]" : "text-[var(--text-secondary)]"
              }`}
            >
              {tab === key && (
                <motion.span
                  layoutId="ds-market-tab"
                  className="absolute inset-0 rounded-full bg-[var(--brand)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative flex items-center justify-center gap-1">
                <Icon size={12} />
                <span className="truncate">{label}</span>
                {key === "offerte" && snapshot.offers.length + snapshot.loanOffers.length > 0 && (
                  <span className="opacity-70">{snapshot.offers.length + snapshot.loanOffers.length}</span>
                )}
                {key === "rosa" && chatInSospeso > 0 && (
                  <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#ff4d4d] px-1 text-[9px] font-extrabold text-white">
                    {chatInSospeso}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>

        {/* Il riscontro dell'operazione è il `DealToast` in cima: una seconda riga di testo qui
            sotto direbbe la stessa cosa due volte. */}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {promesseLive.length > 0 && (
            <>
              <CoachPromisesPanel
                promises={promesseLive}
                coachName={findCoach(state.coachId ?? "")?.name ?? "Mister"}
                onProposeAlternative={(promise) => {
                  setRispostaAlternativa(null);
                  setAlternativaPer(promise);
                }}
              />
              {rispostaAlternativa && (
                <p className="rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand)]/8 px-3 py-2.5 text-xs leading-relaxed">
                  «{rispostaAlternativa}»
                </p>
              )}
            </>
          )}
          {tab === "offerte" && (
            <SchedaOfferte
              snapshot={snapshot}
              world={world}
              bloccati={new Set(state.negotiationBlocked ?? [])}
              valori={valoriRosa}
              onAction={onAction}
              onNegotiate={onNegotiateOffer}
              onNegotiateLoan={onNegotiateLoan}
            />
          )}
          {tab === "ricerca" && (
            <SchedaRicerca
              budget={budget}
              world={world}
              rosaPiena={state.roster.length >= MAX_SQUAD_SIZE}
              bloccati={new Set(state.negotiationBlocked ?? [])}
              aiSellable={snapshot.aiSellable}
              onSearch={onSearch}
              onAction={onAction}
              onNegotiate={onNegotiatePurchase}
            />
          )}
          {tab === "rosa" && (
            <SchedaRosa
              state={state}
              world={world}
              valori={valoriRosa}
              onAction={onAction}
              onOpenStandoff={onOpenStandoff}
              standoffChiuse={standoffChiuse}
            />
          )}
          {tab === "mister" && (
            <SchedaMister state={state} world={world} choices={coachChoices} onHire={onHireCoach} />
          )}
          {tab === "mondo" && (
            <WorldMarketPanel
              transfers={state.worldTransfers ?? []}
              world={dsWorld}
              season={state.season}
            />
          )}
        </div>
      </motion.div>

      {alternativaPer && (
        <PromiseAlternativePicker
          promise={alternativaPer}
          world={world}
          onSearch={onSearch}
          onPick={(candidate) => {
            const esito = onProposePromiseAlternative(alternativaPer, candidate);
            setAlternativaPer(null);
            setRispostaAlternativa(esito.message);
          }}
          onClose={() => setAlternativaPer(null)}
        />
      )}
    </motion.div>
  );
}

/**
 * Scelta di un'alternativa **dal database**, per una promessa nominata al mister: riusa la
 * stessa ricerca del mercato (`onSearch`, già filtrata per soglia di budget nella scheda
 * Ricerca) filtrata al ruolo della promessa, così l'utente sceglie un giocatore vero invece che
 * il motore ne auto-selezioni uno.
 */
function PromiseAlternativePicker({
  promise,
  world,
  onSearch,
  onPick,
  onClose,
}: {
  promise: LiveCoachPromise;
  world: CareerWorld;
  onSearch: (c: SearchCriteria) => SearchResult[];
  onPick: (candidate: RoleCandidate) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const risultati = useMemo(
    () => onSearch({ query, roles: promise.targetRole ? [promise.targetRole] : undefined, sort: "overall" }).slice(0, 20),
    [onSearch, query, promise.targetRole],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 330, damping: 32 }}
        className="flex h-[75svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] sm:h-[68svh] sm:rounded-3xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-[var(--surface-border)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-widest text-[var(--brand)] uppercase">
              Alternativa dal database
            </p>
            <p className="truncate text-xs text-[var(--text-secondary)]">{promise.description}</p>
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

        <label className="relative block px-4 pt-3">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-7 -translate-y-1/2 text-[var(--text-secondary)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome o club..."
            className="w-full rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] py-2.5 pr-4 pl-9 text-sm outline-none focus:border-[var(--brand)]"
          />
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {risultati.length === 0 ? (
            <Vuoto testo="Nessun giocatore trovato per questo ruolo." />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {risultati.map((r) => (
                <li
                  key={r.playerId}
                  className="flex items-center gap-2.5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-2.5"
                >
                  <Badge overall={r.overall} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm leading-tight font-bold">
                      <NationFlag nation={world.players[r.playerId]?.nation ?? ""} />
                      <span className="truncate">{r.name}</span>
                    </p>
                    <p className="truncate text-[11px] text-[var(--text-secondary)]">{r.clubName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onPick({
                        playerId: r.playerId,
                        playerName: r.name,
                        overall: r.overall,
                        // La casella è quella della promessa, non necessariamente il ruolo
                        // primario del candidato: la ricerca ammette anche chi lo sa coprire
                        // da secondario, ed è per quella casella che lo si sta proponendo.
                        role: promise.targetRole ?? r.role,
                      })
                    }
                    className="shrink-0 rounded-full bg-[var(--brand)] px-3 py-2 text-xs font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-95"
                  >
                    Proponi
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Offerte per i nostri                                                        */
/* -------------------------------------------------------------------------- */

function SchedaOfferte({
  snapshot,
  world,
  bloccati,
  valori,
  onAction,
  onNegotiate,
  onNegotiateLoan,
}: {
  snapshot: MarketSnapshot;
  world: CareerWorld;
  /** Giocatori per cui la trattativa è già saltata in questa finestra. */
  bloccati: ReadonlySet<string>;
  /** Valore corrente dei propri giocatori: dice se l'offerta è buona. */
  valori: ReadonlyMap<string, number>;
  onAction: (a: MarketAction) => void;
  onNegotiate: (playerId: string) => void;
  onNegotiateLoan: (playerId: string) => void;
}) {
  if (snapshot.offers.length === 0 && snapshot.loanOffers.length === 0) {
    return (
      <Vuoto testo="Nessuno ti ha chiesto un giocatore. Mettine qualcuno in lista trasferimenti o prestiti per farne arrivare." />
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {/*
       * Le destinazioni di prestito, alla pari delle offerte di trasferimento: stessa card,
       * stesse tre azioni (Accetta/Tratta/Rifiuta) — qui però si negoziano i **minuti
       * garantiti**, non un prezzo, coerente con `negotiateLoanOffer` (career.ts).
       */}
      {snapshot.loanOffers.map((loan) => (
        <li
          key={`loan-${loan.playerId}`}
          className="flex flex-col gap-2.5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3"
        >
          <div className="flex items-center gap-2.5">
            <Plane size={15} className="shrink-0 text-[#5aa9e6]" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm leading-tight font-bold">
                <NationFlag nation={world.players[loan.playerId]?.nation ?? ""} />
                <span className="truncate">{loan.playerName}</span>
              </p>
              <p className="truncate text-[11px] text-[var(--text-secondary)]">
                Destinazione: {loan.clubName}
              </p>
            </div>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-extrabold">
                {Math.round(loan.expectedMinutes / 90)} partite
              </span>
              <span className="block text-[10px] font-bold text-[var(--text-secondary)]">garantite</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAction({ kind: "manda_in_prestito", playerId: loan.playerId, clubId: loan.clubId })}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#3ddc6b]/15 py-2 text-xs font-bold text-[#2a9b4d]"
            >
              <Check size={13} />
              Accetta
            </button>
            <button
              type="button"
              disabled={bloccati.has(loan.playerId)}
              onClick={() => onNegotiateLoan(loan.playerId)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold ${
                bloccati.has(loan.playerId)
                  ? "cursor-not-allowed border border-[var(--surface-border)] text-[var(--text-secondary)]"
                  : "border border-[var(--accent)]/50 text-[var(--accent)]"
              }`}
            >
              <MessagesSquare size={13} />
              {bloccati.has(loan.playerId) ? "Trattativa chiusa" : "Tratta"}
            </button>
            <button
              type="button"
              onClick={() => onAction({ kind: "rifiuta_prestito", playerId: loan.playerId })}
              aria-label="Rifiuta la destinazione"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)]"
            >
              <X size={15} />
            </button>
          </div>
        </li>
      ))}
      {snapshot.offers.map((offer) => (
        <li
          key={offer.playerId}
          className="flex flex-col gap-2.5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3"
        >
          <div className="flex items-center gap-2.5">
            <ArrowUpRight size={15} className="shrink-0 text-[#ff8a3d]" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm leading-tight font-bold">
                <NationFlag nation={world.players[offer.playerId]?.nation ?? ""} />
                <span className="truncate">{offer.playerName}</span>
              </p>
              <p className="truncate text-[11px] text-[var(--text-secondary)]">
                Offerta del {offer.fromClubName}
                {valori.has(offer.playerId) && ` · vale ${euro(valori.get(offer.playerId)!)}`}
              </p>
            </div>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-extrabold">{euro(offer.fee)}</span>
              {/* Sopra o sotto il valore: è l'unica informazione che rende l'offerta
                  valutabile in un colpo d'occhio invece che a memoria. */}
              {valori.has(offer.playerId) && (
                <span
                  className="block text-[10px] font-bold tabular-nums"
                  style={{
                    color: offer.fee >= valori.get(offer.playerId)! ? "#3ddc6b" : "#ff8a3d",
                  }}
                >
                  {offer.fee >= valori.get(offer.playerId)! ? "+" : ""}
                  {Math.round((offer.fee / Math.max(1, valori.get(offer.playerId)!) - 1) * 100)}%
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAction({ kind: "accetta_offerta", playerId: offer.playerId })}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#3ddc6b]/15 py-2 text-xs font-bold text-[#2a9b4d]"
            >
              <Check size={13} />
              Accetta
            </button>
            {/* Trattare invece di rilanciare a percentuale fissa: la cifra si costruisce
                parlando, e tirare troppo la corda fa arenare l'affare. */}
            <button
              type="button"
              disabled={bloccati.has(offer.playerId)}
              onClick={() => onNegotiate(offer.playerId)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold ${
                bloccati.has(offer.playerId)
                  ? "cursor-not-allowed border border-[var(--surface-border)] text-[var(--text-secondary)]"
                  : "border border-[var(--accent)]/50 text-[var(--accent)]"
              }`}
            >
              <MessagesSquare size={13} />
              {bloccati.has(offer.playerId) ? "Trattativa chiusa" : "Tratta"}
            </button>
            <button
              type="button"
              onClick={() => onAction({ kind: "rifiuta_offerta", playerId: offer.playerId })}
              aria-label="Rifiuta l'offerta"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)]"
            >
              <X size={15} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Ricerca libera                                                              */
/* -------------------------------------------------------------------------- */

function SchedaRicerca({
  budget,
  world,
  rosaPiena,
  bloccati,
  aiSellable,
  onSearch,
  onAction,
  onNegotiate,
}: {
  budget: number;
  world: CareerWorld;
  rosaPiena: boolean;
  bloccati: ReadonlySet<string>;
  aiSellable: AiSellableListing[];
  onSearch: (c: SearchCriteria) => SearchResult[];
  onAction: (a: MarketAction) => void;
  onNegotiate: (target: SearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<Department | undefined>();
  // Multi-selezione: più ruoli insieme ("DC o CC") per ricerche più dettagliate — richiesta
  // esplicita dell'utente, prima si poteva scegliere un solo ruolo alla volta.
  const [roles, setRoles] = useState<Set<Role>>(new Set());
  const [sort, setSort] = useState<SearchCriteria["sort"]>("overall");
  const [soloAllaPortata, setSoloAllaPortata] = useState(true);
  const [soloPrestiti, setSoloPrestiti] = useState(false);
  const [filtriAperti, setFiltriAperti] = useState(false);
  const [soloCedibiliIA, setSoloCedibiliIA] = useState(false);
  const [etaMin, setEtaMin] = useState("");
  const [etaMax, setEtaMax] = useState("");
  const [overallMin, setOverallMin] = useState("");
  const [overallMax, setOverallMax] = useState("");

  /**
   * "Cedibili IA": non la ricerca libera, ma chi un club ha davvero in eccedenza (titolari e
   * panchina già coperti — sez. 15, CLAUDE.md §3.7.10). Convertiti nella stessa forma della
   * ricerca (`SearchResult`) così riusano identiche card e la stessa trattativa.
   */
  const cedibiliIA: SearchResult[] = useMemo(
    () =>
      aiSellable
        .map((c) => {
          const info = world.players[c.playerId];
          if (!info) return null;
          const risultato: SearchResult = {
            playerId: c.playerId,
            name: c.playerName,
            clubId: c.clubId,
            clubName: c.clubName,
            overall: c.overall,
            age: world.market?.ageOf(c.playerId) ?? 25,
            role: info.role,
            secondaryRoles: info.secondaryRoles,
            department: c.department,
            price: c.price,
            loanable: false,
            loanFee: 0,
          };
          return risultato;
        })
        .filter((r): r is SearchResult => r !== null),
    [aiSellable, world],
  );

  const ragioneCedibile = useMemo(
    () => new Map(aiSellable.map((c) => [c.playerId, c.reason])),
    [aiSellable],
  );

  const risultatiRicerca = useMemo(
    () =>
      onSearch({
        query,
        department,
        roles: roles.size > 0 ? [...roles] : undefined,
        sort,
        maxPrice: soloAllaPortata ? budget : undefined,
        onlyLoanable: soloPrestiti || undefined,
        minAge: etaMin ? Number(etaMin) : undefined,
        maxAge: etaMax ? Number(etaMax) : undefined,
        minOverall: overallMin ? Number(overallMin) : undefined,
        maxOverall: overallMax ? Number(overallMax) : undefined,
      }),
    [onSearch, query, department, roles, sort, soloAllaPortata, soloPrestiti, budget, etaMin, etaMax, overallMin, overallMax],
  );

  const risultati = soloCedibiliIA ? cedibiliIA : risultatiRicerca;

  /** I ruoli del reparto scelto: filtrare per ruolo senza reparto sarebbe un elenco di 14 voci. */
  const ruoliDelReparto = useMemo(() => {
    if (!department) return [];
    const visti = new Set<Role>();
    for (const p of Object.values(world.players)) {
      if (p.department === department) visti.add(p.role);
    }
    return [...visti];
  }, [world.players, department]);

  return (
    <div className="flex flex-col gap-3">
      {/* Con la rosa al massimo si può ancora **cercare** (serve a farsi un'idea) ma non
          comprare: dirlo qui evita di scoprirlo premendo un pulsante che sembrava attivo. */}
      {rosaPiena && (
        <p className="flex items-center gap-2 rounded-2xl border border-[#ffab2e]/40 bg-[#ffab2e]/8 p-3 text-[11px] leading-relaxed font-semibold text-[#c9821b]">
          <TriangleAlert size={15} className="shrink-0" />
          Rosa al completo ({MAX_SQUAD_SIZE} giocatori): per comprare devi prima cedere
          qualcuno dalla scheda "La mia rosa".
        </p>
      )}

      {/* "Cedibili IA": non ricerca libera, sono i giocatori che un club ha davvero in
          eccedenza (titolari+panchina già coperti) — il mercato IA che sopperisce da solo alle
          proprie sovrabbondanze, sez. 15. */}
      <div className="flex gap-1.5">
        <Chip attivo={!soloCedibiliIA} onClick={() => setSoloCedibiliIA(false)}>
          Ricerca libera
        </Chip>
        <Chip attivo={soloCedibiliIA} onClick={() => setSoloCedibiliIA(true)}>
          Cedibili IA {aiSellable.length > 0 ? `(${aiSellable.length})` : ""}
        </Chip>
      </div>

      {!soloCedibiliIA && (
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-secondary)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome o club..."
            className="w-full rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] py-2.5 pr-11 pl-9 text-sm outline-none focus:border-[var(--brand)]"
          />
          <button
            type="button"
            onClick={() => setFiltriAperti((v) => !v)}
            aria-label="Filtri"
            className={`absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full ${
              filtriAperti ? "bg-[var(--brand)] text-[var(--brand-contrast)]" : "text-[var(--text-secondary)]"
            }`}
          >
            <SlidersHorizontal size={15} />
          </button>
        </label>
      )}

      <AnimatePresence initial={false}>
        {filtriAperti && !soloCedibiliIA && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3">
              <div className="flex flex-wrap gap-1.5">
                {DEPARTMENTS.map((d) => (
                  <Chip
                    key={d}
                    attivo={department === d}
                    onClick={() => {
                      setDepartment(department === d ? undefined : d);
                      setRoles(new Set());
                    }}
                  >
                    {DEPARTMENT_LABEL[d]}
                  </Chip>
                ))}
              </div>

              {ruoliDelReparto.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ruoliDelReparto.map((r) => (
                    <Chip
                      key={r}
                      attivo={roles.has(r)}
                      onClick={() =>
                        setRoles((prev) => {
                          const next = new Set(prev);
                          if (next.has(r)) next.delete(r);
                          else next.add(r);
                          return next;
                        })
                      }
                    >
                      {r}
                    </Chip>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                <Chip attivo={soloAllaPortata} onClick={() => setSoloAllaPortata((v) => !v)}>
                  Alla mia portata
                </Chip>
                <Chip attivo={soloPrestiti} onClick={() => setSoloPrestiti((v) => !v)}>
                  Solo prestiti
                </Chip>
              </div>

              {/* Intervalli età/Overall: ricerche più mirate di un semplice tetto. */}
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                  Età
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Min"
                  value={etaMin}
                  onChange={(e) => setEtaMin(e.target.value)}
                  className="w-0 min-w-0 flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-semibold outline-none focus:border-[var(--brand)]"
                />
                <span className="text-[10px] text-[var(--text-secondary)]">–</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Max"
                  value={etaMax}
                  onChange={(e) => setEtaMax(e.target.value)}
                  className="w-0 min-w-0 flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-semibold outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                  Overall
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Min"
                  value={overallMin}
                  onChange={(e) => setOverallMin(e.target.value)}
                  className="w-0 min-w-0 flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-semibold outline-none focus:border-[var(--brand)]"
                />
                <span className="text-[10px] text-[var(--text-secondary)]">–</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Max"
                  value={overallMax}
                  onChange={(e) => setOverallMax(e.target.value)}
                  className="w-0 min-w-0 flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-semibold outline-none focus:border-[var(--brand)]"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(["overall", "prezzo", "eta", "potenziale"] as const).map((s) => (
                  <Chip key={s} attivo={sort === s} onClick={() => setSort(s)}>
                    {s === "overall" ? "Più forti" : s === "prezzo" ? "Più economici" : s === "eta" ? "Più giovani" : "Prospetti"}
                  </Chip>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {risultati.length === 0 ? (
        <Vuoto
          testo={
            soloCedibiliIA
              ? "Nessun club ha davvero un'eccedenza in questa finestra: torna a mercato riaperto."
              : "Nessun giocatore corrisponde alla ricerca."
          }
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {risultati.map((r) => {
            return (
              <li
                key={r.playerId}
                className="flex flex-col gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <Badge overall={r.overall} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm leading-tight font-bold">
                      <NationFlag nation={world.players[r.playerId]?.nation ?? ""} />
                      <span className="truncate">{r.name}</span>
                    </p>
                    <p className="truncate text-[11px] text-[var(--text-secondary)]">
                      {r.clubName} · <span className="tabular-nums">{r.age} anni</span> ·{" "}
                      <span className="font-semibold text-[var(--accent)] tabular-nums">
                        {euro(r.price)}
                      </span>
                    </p>
                    <div className="mt-1">
                      <RoleChips role={r.role} secondary={r.secondaryRoles} />
                    </div>
                  </div>
                </div>

                {soloCedibiliIA && ragioneCedibile.has(r.playerId) && (
                  <p className="rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                    {ragioneCedibile.get(r.playerId)}
                  </p>
                )}

                <div className="flex gap-2">
                  {/*
                   * **Il fulcro del mercato è la trattativa, non un tasto "compra subito".**
                   * Prima esisteva anche un acquisto rapido al prezzo pieno, che bypassava del
                   * tutto la trattativa — e con essa la resistenza dei top club a vendere i
                   * loro gioielli (sez. 13): un giocatore presentato come "incedibile" nella
                   * chat si comprava comunque cliccando qui, un bug segnalato dall'utente.
                   * Rimosso: l'unica via per acquistare è trattare.
                   */}
                  <button
                    type="button"
                    disabled={rosaPiena || bloccati.has(r.playerId)}
                    onClick={() => onNegotiate(r)}
                    // L'etichetta segue lo stato: con un'etichetta fissa chi usa uno screen
                    // reader sentirebbe "tratta" su un pulsante che non tratta più.
                    aria-label={
                      bloccati.has(r.playerId)
                        ? `Trattativa già saltata per ${r.name}`
                        : `Tratta per ${r.name}`
                    }
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold ${
                      rosaPiena || bloccati.has(r.playerId)
                        ? "cursor-not-allowed bg-[var(--surface)] text-[var(--text-secondary)]"
                        : "bg-[var(--brand)] text-[var(--brand-contrast)]"
                    }`}
                  >
                    <MessagesSquare size={13} />
                    {rosaPiena
                      ? "Rosa piena"
                      : bloccati.has(r.playerId)
                        ? "Saltata"
                        : `Tratta · ${euro(r.price)}`}
                  </button>
                  {r.loanable && (
                    <button
                      type="button"
                      disabled={rosaPiena}
                      onClick={() => onAction({ kind: "chiedi_prestito", target: r })}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold ${
                        rosaPiena
                          ? "cursor-not-allowed bg-[var(--surface)] text-[var(--text-secondary)]"
                          : "bg-[#5aa9e6]/15 text-[#2f7fbd]"
                      }`}
                    >
                      <Plane size={13} />
                      Prestito · {euro(r.loanFee)}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({
  attivo,
  onClick,
  children,
}: {
  attivo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
        attivo
          ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
          : "border border-[var(--surface-border)] text-[var(--text-secondary)]"
      }`}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* La propria rosa: chi vendere, chi mandare a giocare                         */
/* -------------------------------------------------------------------------- */

/**
 * La propria rosa, **in ottica mercato**.
 *
 * La versione precedente era un elenco piatto di 27 righe alte, ciascuna con tre pulsanti a
 * tutta larghezza: per trovare il difensore da cedere bisognava scorrere tutto. Qui la rosa è
 * **raggruppata per reparto** — che è il modo in cui si ragiona quando si fa mercato ("in
 * difesa sono lungo, in attacco corto") — le righe sono compatte e le azioni sono tre icone
 * con lo stato leggibile a colpo d'occhio.
 */
function SchedaRosa({
  state,
  world,
  valori,
  onAction,
  onOpenStandoff,
  standoffChiuse,
}: {
  state: CareerState;
  world: CareerWorld;
  valori: ReadonlyMap<string, number>;
  onAction: (a: MarketAction) => void;
  onOpenStandoff: (playerId: string) => void;
  standoffChiuse: ReadonlySet<string>;
}) {
  const inVendita = new Set(state.lists?.transferList ?? []);
  const inPrestito = new Set(state.lists?.loanList ?? []);
  const capienza = state.roster.length;
  const piena = capienza >= MAX_SQUAD_SIZE;

  const candidatiChat = useMemo(
    () => standoffCandidates(state, world).filter((c) => !standoffChiuse.has(c.playerId)),
    [state, world, standoffChiuse],
  );

  const [subView, setSubView] = useState<"tattica" | "elenco" | "chat">("tattica");

  const coach = useMemo(() => (state.coachId ? findCoach(state.coachId) : undefined), [state.coachId]);
  const formation = useMemo(() => {
    return getFormation(coach?.formationId ?? "4-3-3") ?? getFormation("4-3-3")!;
  }, [coach]);

  const lineup = useMemo(() => currentLineup(state, world), [state, world]);

  const perReparto = useMemo(() => {
    const gruppi = new Map<Department, typeof state.roster>();
    for (const dep of DEPARTMENTS) gruppi.set(dep, []);
    for (const entry of state.roster) {
      const player = world.players[entry.playerId];
      const dep = player ? player.department : "CC";
      gruppi.get(dep)!.push(entry);
    }
    for (const gruppo of gruppi.values()) gruppo.sort((a, b) => b.overall - a.overall);
    return gruppi;
  }, [state.roster, world.players]);

  return (
    <div className="flex flex-col gap-3">
      {/* Selettore Sub-View Rosa */}
      <div className="flex items-center gap-2">
        <div className="flex overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-0.5">
          <button
            type="button"
            onClick={() => setSubView("tattica")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors ${
              subView === "tattica"
                ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <LayoutGrid size={13} /> Lavagna Tattica
          </button>
          <button
            type="button"
            onClick={() => setSubView("elenco")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors ${
              subView === "elenco"
                ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <ClipboardList size={13} /> Elenco per Reparto
          </button>
          <button
            type="button"
            onClick={() => setSubView("chat")}
            className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors ${
              subView === "chat"
                ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <MessagesSquare size={13} /> Chat
            {candidatiChat.length > 0 && (
              <span className="ml-0.5 rounded-full bg-[#ff4d4d] px-1.5 py-px text-[9px] font-extrabold text-white">
                {candidatiChat.length}
              </span>
            )}
          </button>
        </div>
        <span className="ml-auto hidden text-[11px] font-bold text-[var(--text-secondary)] sm:inline">
          {formation.name} · {coach?.name ?? "Mister"}
        </span>
      </div>

      <div
        className={`flex items-center justify-between rounded-2xl border px-3 py-2.5 ${
          piena
            ? "border-[#ffab2e]/40 bg-[#ffab2e]/8"
            : "border-[var(--surface-border)] bg-[var(--surface-raised)]"
        }`}
      >
        <span className="text-[11px] font-bold tracking-wide text-[var(--text-secondary)] uppercase">
          Capienza Rosa
        </span>
        <span className="text-sm font-extrabold tabular-nums">
          {capienza}
          <span className="font-semibold text-[var(--text-secondary)]"> / {MAX_SQUAD_SIZE}</span>
        </span>
      </div>

      {subView === "tattica" && (
        <div className="flex flex-col gap-3">
          {/* Pitch 2D con titolari */}
          <div className="mx-auto w-full max-w-md">
            <Pitch>
              {formation.slots.map((slot) => {
                const playerId = lineup.starters[slot.id];
                const entry = state.roster.find((e) => e.playerId === playerId);
                const player = playerId ? world.players[playerId] : undefined;
                const { x, y } = getSlotPosition(formation, slot);
                const guaranteed =
                  !!playerId &&
                  (state.guaranteedStarters?.[slot.id] === playerId ||
                    state.guaranteedStarters?.[slot.role] === playerId);
                return (
                  <PitchDot
                    key={slot.id}
                    x={x}
                    y={y}
                    label={ROLE_LABELS[slot.role]}
                    shortLabel={slot.role}
                    playerName={player?.name}
                    overall={entry?.overall}
                    nation={player?.nation}
                    state={playerId ? "filled" : "empty"}
                    guaranteed={guaranteed}
                  />
                );
              })}
            </Pitch>
          </div>

          {/* Elenco dettagliato dei ruoli con Titolare vs Riserva Diretta */}
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3">
            <h3 className="mb-2 text-[11px] font-extrabold uppercase text-[var(--text-secondary)] tracking-wider">
              Titolari & Sostituti Diretti per il Modulo {formation.name}
            </h3>
            <div className="flex flex-col gap-2">
              {formation.slots.map((slot) => {
                const starterId = lineup.starters[slot.id];
                const starterEntry = state.roster.find((e) => e.playerId === starterId);
                const starterPlayer = starterId ? world.players[starterId] : undefined;

                // Trova la miglior riserva non titolare per questo ruolo
                const startersSet = new Set(Object.values(lineup.starters));
                const backupEntry = state.roster
                  .filter((e) => !startersSet.has(e.playerId))
                  .filter((e) => {
                    const p = world.players[e.playerId];
                    return p && (p.role === slot.role || p.secondaryRoles.includes(slot.role));
                  })
                  .sort((a, b) => b.overall - a.overall)[0];

                const backupPlayer = backupEntry ? world.players[backupEntry.playerId] : undefined;

                return (
                  <div
                    key={slot.id}
                    className="flex flex-col gap-1.5 rounded-xl border border-[var(--surface-border)]/60 bg-[var(--surface)] p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5 text-[var(--brand)]">
                        <span className="rounded bg-[var(--brand)]/15 px-1.5 py-0.5 text-[10px] font-extrabold">
                          {slot.role}
                        </span>
                        {ROLE_LABELS[slot.role]}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--surface-border)]/40">
                      {/* Titolare */}
                      <div>
                        <span className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase">
                          Titolare
                        </span>
                        {starterPlayer && starterEntry ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-extrabold text-[var(--brand)]">
                              [{starterEntry.overall}]
                            </span>
                            <span className="truncate font-bold">{starterPlayer.name}</span>
                            {(state.guaranteedStarters?.[slot.id] === starterId ||
                              state.guaranteedStarters?.[slot.role] === starterId) && (
                              <Star
                                size={11}
                                fill="#f5c518"
                                strokeWidth={0}
                                aria-label="Titolare garantito dal mister"
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-red-400 font-semibold">❌ Scoperto</span>
                        )}
                      </div>

                      {/* Riserva Diretta */}
                      <div>
                        <span className="block text-[9px] font-bold text-[var(--text-secondary)] uppercase">
                          Diretta Riserva
                        </span>
                        {backupPlayer && backupEntry ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-extrabold text-[var(--text-secondary)]">
                              [{backupEntry.overall}]
                            </span>
                            <span className="truncate text-[var(--text-secondary)]">
                              {backupPlayer.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-semibold">
                            ⚠️ Nessun rincalzo naturale
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {subView === "elenco" && (
        <>
          <div className="flex items-center gap-3 px-1 text-[10px] font-semibold text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <Tag size={11} className="text-[#ff8a3d]" /> in vendita
            </span>
            <span className="flex items-center gap-1">
              <Plane size={11} className="text-[#5aa9e6]" /> lista prestiti
            </span>
            <span className="flex items-center gap-1">
              <Banknote size={11} /> vendi subito
            </span>
          </div>

      {DEPARTMENTS.map((dep) => {
        const gruppo = perReparto.get(dep) ?? [];
        if (gruppo.length === 0) return null;
        return (
          <section key={dep}>
            <h3 className="mb-1.5 flex items-baseline justify-between px-1">
              <span className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                {DEPARTMENT_LABEL[dep]}
              </span>
              <span className="text-[10px] font-semibold text-[var(--text-secondary)] tabular-nums">
                {gruppo.length} · media{" "}
                {Math.round(gruppo.reduce((s, e) => s + e.overall, 0) / gruppo.length)}
              </span>
            </h3>

            <ul className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
              {gruppo.map((entry) => {
                const player = world.players[entry.playerId];
                const vendita = inVendita.has(entry.playerId);
                const prestito = inPrestito.has(entry.playerId);
                return (
                  <li
                    key={entry.playerId}
                    className={`flex items-center gap-2 border-b border-[var(--surface-border)] px-2.5 py-2 last:border-b-0 ${
                      vendita ? "bg-[#ff8a3d]/8" : "bg-[var(--surface-raised)]"
                    }`}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-extrabold"
                      style={{
                        backgroundColor: overallTier(entry.overall).dot,
                        color: overallTier(entry.overall).dotText,
                      }}
                    >
                      {entry.overall}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[13px] leading-tight font-bold">
                        {player?.nation && <NationFlag nation={player.nation} />}
                        <span className="truncate">{player?.name ?? "Giocatore"}</span>
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {player && <RoleChips role={player.role} secondary={player.secondaryRoles} />}
                        <span className="text-[10px] text-[var(--text-secondary)] tabular-nums">
                          {world.market?.ageOf(entry.playerId) ?? "?"} anni
                        </span>
                        <span className="text-[10px] font-semibold text-[var(--accent)] tabular-nums">
                          {euro(valori.get(entry.playerId) ?? 0)}
                        </span>
                        {/* Morale: visibile qui per capire chi vuole andare via senza dover
                            aprire la scheda Chat — cliccabile se sotto soglia, stessa apertura
                            del faccia a faccia. */}
                        {(() => {
                          const { label, color } = moraleLabel(entry.morale);
                          const scontento = entry.morale < STANDOFF_MORALE_THRESHOLD;
                          return (
                            <button
                              type="button"
                              disabled={!scontento}
                              onClick={() => onOpenStandoff(entry.playerId)}
                              className={`flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-bold ${
                                scontento ? "cursor-pointer" : "cursor-default"
                              }`}
                              style={{ backgroundColor: `${color}1f`, color }}
                            >
                              <Smile size={10} />
                              {label}
                            </button>
                          );
                        })()}
                        {/* Infortunio: giorni rimanenti, per capire se serve intervenire sul
                            mercato — un infortunato non genera offerte né si può vendere. */}
                        {entry.injuryMatchdaysLeft > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-[#ff4d4d]/12 px-1.5 py-px text-[10px] font-bold text-[#ff4d4d]">
                            <Activity size={10} />
                            Infortunato · {entry.injuryMatchdaysLeft}{" "}
                            {entry.injuryMatchdaysLeft === 1 ? "giornata" : "giornate"}
                          </span>
                        )}
                      </div>

                      {/* Statistiche di Prestazione: Presenze, Gol, Assist, Media Voto */}
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-semibold text-[var(--text-secondary)] border-t border-[var(--surface-border)]/40 pt-1">
                        {entry.stats.appearances > 0 ? (
                          <>
                            <span className="tabular-nums">
                              P: <strong className="font-extrabold text-[var(--text-primary)]">{entry.stats.appearances}</strong>
                            </span>
                            {entry.stats.goals > 0 && (
                              <span className="tabular-nums font-extrabold text-emerald-400">
                                ⚽ {entry.stats.goals}
                              </span>
                            )}
                            {entry.stats.assists > 0 && (
                              <span className="tabular-nums font-extrabold text-blue-400">
                                🅰️ {entry.stats.assists}
                              </span>
                            )}
                            {(() => {
                              const mv = computeAvgRating(entry);
                              const tone =
                                mv >= 7.0
                                  ? "#3ddc6b"
                                  : mv >= 6.0
                                    ? "var(--text-primary)"
                                    : mv > 0
                                      ? "#ff4d4d"
                                      : "var(--text-secondary)";
                              return (
                                <span className="tabular-nums font-extrabold" style={{ color: tone }}>
                                  MV: {mv > 0 ? mv.toFixed(1) : "--"}
                                </span>
                              );
                            })()}
                          </>
                        ) : entry.lastSeasonStats && entry.lastSeasonStats.appearances > 0 ? (
                          <>
                            <span className="text-[9px] font-extrabold text-[var(--brand)] uppercase tracking-wider">
                              Stag. Conclusa:
                            </span>
                            <span className="tabular-nums">
                              P: <strong className="font-extrabold text-[var(--text-primary)]">{entry.lastSeasonStats.appearances}</strong>
                            </span>
                            {entry.lastSeasonStats.goals > 0 && (
                              <span className="tabular-nums font-extrabold text-emerald-400">
                                ⚽ {entry.lastSeasonStats.goals}
                              </span>
                            )}
                            {(() => {
                              const mv = computeAvgRating({ ...entry, stats: entry.lastSeasonStats! });
                              return (
                                <span className="tabular-nums font-extrabold text-[var(--brand)]">
                                  MV: {mv > 0 ? mv.toFixed(1) : "--"}
                                </span>
                              );
                            })()}
                          </>
                        ) : (
                          <span className="italic text-[10px] text-[var(--text-secondary)]">
                            Nessuna presenza ancora in stagione
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <AzioneIcona
                        attiva={vendita}
                        colore="#ff8a3d"
                        etichetta={vendita ? "Togli dalla lista trasferimenti" : "Metti in vendita"}
                        onClick={() =>
                          onAction({
                            kind: "lista_trasferimenti",
                            playerId: entry.playerId,
                            on: !vendita,
                          })
                        }
                      >
                        <Tag size={14} />
                      </AzioneIcona>
                      <AzioneIcona
                        attiva={prestito}
                        colore="#5aa9e6"
                        etichetta={prestito ? "Togli dalla lista prestiti" : "Metti in lista prestiti"}
                        onClick={() =>
                          onAction({
                            kind: "lista_prestiti",
                            playerId: entry.playerId,
                            on: !prestito,
                          })
                        }
                      >
                        <Plane size={14} />
                      </AzioneIcona>
                      <AzioneIcona
                        attiva={false}
                        colore="#ff4d4d"
                        etichetta="Vendi subito, a prezzo ridotto"
                        onClick={() => onAction({ kind: "vendi_subito", playerId: entry.playerId })}
                      >
                        <Banknote size={14} />
                      </AzioneIcona>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* Le destinazioni di prestito proposte vivono ora nella scheda Offerte, alla pari delle
          offerte di trasferimento (Accetta/Tratta/Rifiuta) — non più una sezione a parte qui. */}
        </>
      )}

      {subView === "chat" && (
        <div className="flex flex-col gap-2">
          <p className="rounded-2xl border border-dashed border-[var(--surface-border)] p-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
            Chi è scontento per il suo impiego, o chi ha un'offerta di mercato e spinge per la
            cessione. Ignorare o non accontentare le richieste porta il morale al minimo, e un
            giocatore in rotta rende meno in campo qualunque sia il suo Overall.
          </p>
          {candidatiChat.length === 0 ? (
            <Vuoto testo="Nessuno spinge per una conversazione, per ora." />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {candidatiChat.map((c) => {
                const tono = c.morale < 25 ? "#ff4d4d" : c.morale < STANDOFF_MORALE_THRESHOLD ? "#ff8a3d" : "var(--text-secondary)";
                return (
                  <li key={c.playerId}>
                    <button
                      type="button"
                      onClick={() => onOpenStandoff(c.playerId)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3 text-left transition-colors hover:border-[var(--brand)]"
                    >
                      <MessagesSquare size={16} className="shrink-0" style={{ color: tono }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{c.name}</p>
                        <p className="text-[11px] font-semibold" style={{ color: tono }}>
                          Morale {c.morale}
                          {c.hasOffer ? " · offerta in arrivo" : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Un'azione compatta con lo stato acceso/spento leggibile senza testo. */
function AzioneIcona({
  attiva,
  colore,
  etichetta,
  onClick,
  children,
}: {
  attiva: boolean;
  colore: string;
  etichetta: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={etichetta}
      aria-label={etichetta}
      aria-pressed={attiva}
      className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors"
      style={{
        borderColor: attiva ? colore : "var(--surface-border)",
        backgroundColor: attiva ? `${colore}22` : "transparent",
        color: attiva ? colore : "var(--text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

function SchedaMister({
  state,
  world,
  choices,
  onHire,
}: {
  state: CareerState;
  world: CareerWorld;
  choices: CoachChoice[];
  onHire: (coachId: string, promises?: CoachPromise[], totalCost?: number) => void;
}) {
  const [chatCoach, setChatCoach] = useState<Coach | null>(null);
  const attuale = state.coachId ? findCoach(state.coachId) : undefined;

  if (chatCoach) {
    // Candidati reali per la richiesta "specialista nominato" (sez. 6/7 mercato): stesso pool
    // che la ricerca usa, ridotto ai soli campi che al catalogo servono.
    const marketCandidates = (world.market?.transferPool ?? [])
      .map((p) => {
        const role = world.market!.players[p.playerId]?.role;
        return role
          ? { playerId: p.playerId, playerName: world.market!.nameOf(p.playerId), overall: p.overall, role }
          : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
    return (
      <CoachNegotiationChat
        coach={chatCoach}
        clubName="Il tuo club"
        clubNation="Italia"
        budget={state.budget}
        roster={state.roster}
        season={state.season}
        players={world.players}
        isDefaultCoach={false}
        buyoutFee={0}
        seed={state.seed}
        marketCandidates={marketCandidates}
        onAgree={(c, promises, cost) => {
          onHire(c.id, promises, cost);
          setChatCoach(null);
        }}
        onCancel={() => setChatCoach(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {attuale && (
        <div className="rounded-2xl border border-[var(--brand)]/40 bg-[var(--brand)]/8 p-3.5">
          <p className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            In panchina adesso
          </p>
          <p className="mt-1 text-base leading-tight font-extrabold">{attuale.name}</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            {getFormation(attuale.formationId)?.name ?? attuale.formationId} · attacco{" "}
            {attuale.style.attack > 0 ? `+${attuale.style.attack}` : attuale.style.attack} · difesa{" "}
            {attuale.style.defence > 0 ? `+${attuale.style.defence}` : attuale.style.defence}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
            Confermarlo non costa nulla. Cambiarlo cambia il <strong>modulo</strong> con cui
            scende in campo la squadra: guarda i ruoli della rosa prima di decidere.
          </p>
        </div>
      )}

      <h3 className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
        Chi accetterebbe la panchina
      </h3>

      <ul className="flex flex-col gap-1.5">
        {choices.map((scelta) => {
          const coach = findCoach(scelta.coachId);
          if (!coach) return null;
          return (
            <li
              key={scelta.coachId}
              className="flex items-center gap-2.5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-2.5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[11px] font-extrabold">
                {getFormation(coach.formationId)?.name ?? coach.formationId}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm leading-tight font-bold">
                  <NationFlag nation={coach.nation} />
                  <span className="truncate">{coach.name}</span>
                </p>
                <p className="truncate text-[11px] text-[var(--text-secondary)]">
                  {coach.development >= 1.4
                    ? "Eccellente coi giovani"
                    : coach.development >= 1.15
                      ? "Bravo coi giovani"
                      : "Preferisce i pronti"}{" "}
                  · att {coach.style.attack > 0 ? `+${coach.style.attack}` : coach.style.attack} · dif{" "}
                  {coach.style.defence > 0 ? `+${coach.style.defence}` : coach.style.defence}
                </p>
              </div>
              <button
                type="button"
                disabled={!!scelta.blocked}
                onClick={() => setChatCoach(coach)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-extrabold ${
                  scelta.blocked
                    ? "cursor-not-allowed bg-[var(--surface)] text-[var(--text-secondary)]"
                    : "bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90"
                }`}
              >
                Tratta ({euro(scelta.cost)})
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
