import { useState } from "react";
import { Check, Minus, Plus, Star } from "lucide-react";
import { formatContractTotal, formatWage, type CareerState, type CareerWorld } from "@app/game-engine";
import { WageImpactPanel } from "./WageImpactPanel";

/**
 * **Il tavolo del contratto**, uno solo per tre trattative.
 *
 * Rinnovo, acquisto e parametro zero negoziano lo **stesso pacchetto** — ingaggio annuo, durata,
 * titolarità, fascia — e lo fanno valutare dalla stessa funzione del motore
 * (`renewalOfferScore`), pesata sulla personalità. Averne tre copie divergenti sarebbe stato il
 * modo più veloce per farle rispondere in modo diverso alla stessa offerta.
 *
 * Fino a ieri l'acquisto **non aveva** un tavolo: il giocatore entrava in rosa con un ingaggio
 * che nessuno aveva accettato. Era l'asimmetria più vistosa del sistema contratti.
 *
 * ## Perché si vede sempre "cosa chiede"
 *
 * Senza la richiesta in chiaro, proporre sarebbe tirare a indovinare e il rifiuto sembrerebbe
 * arbitrario. Il gioco non sta nel *sapere* cosa vuole ma nel decidere **quanto concederglielo**,
 * col margine ingaggi che stringe da un lato e il rischio di perderlo dall'altro.
 *
 * Mobile-first: controlli a passo (niente campi numerici da digitare col pollice), bersagli da
 * 44px, e le finanze proiettate qui dentro — riequilibrare il bilancio non deve costare l'uscita
 * dalla trattativa.
 */

export interface ContractDemand {
  wage: number;
  seasons: number;
  clause: number;
  wantsStarter: boolean;
  wantsCaptaincy: boolean;
}

export interface ContractOffer {
  wage: number;
  seasons: number;
  clause?: number;
  guaranteedStarter?: boolean;
  captain?: boolean;
}

export function ContractOfferForm({
  state,
  world,
  demand,
  currentWage,
  submitLabel,
  onSubmit,
  onShiftFinances,
  onCancel,
  cancelLabel,
}: {
  state: CareerState;
  world: CareerWorld;
  /** Che cosa chiede: si scopre al tavolo, e resta sempre a vista mentre si compone l'offerta. */
  demand: ContractDemand;
  /**
   * Quanto guadagna **oggi** da noi.
   *
   * Per un rinnovo è il suo ingaggio attuale, e conta solo l'aumento; per chi arriva da fuori è
   * zero, perché l'intero ingaggio è nuovo. Sbagliare questo numero significa proiettare un
   * impatto sul monte che non corrisponde a quello che il motore poi verifica.
   */
  currentWage: number;
  submitLabel: string;
  onSubmit: (offer: ContractOffer) => { ok: boolean; message: string };
  onShiftFinances?: (share: number) => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [ingaggio, setIngaggio] = useState(demand.wage);
  const [anni, setAnni] = useState(demand.seasons);
  const [clausola, setClausola] = useState(demand.clause);
  const [titolare, setTitolare] = useState(demand.wantsStarter);
  const [capitano, setCapitano] = useState(demand.wantsCaptaincy);
  const [esito, setEsito] = useState<{ ok: boolean; message: string } | null>(null);

  const passo = ingaggio >= 2_000_000 ? 250_000 : 50_000;
  const passoClausola = 5_000_000;

  /**
   * Quanto la proposta si discosta da ciò che chiede, come barra.
   *
   * Non è il punteggio del motore — quello resta nascosto, ed è giusto così: intuirlo è il
   * gioco. È una lettura onesta e verificabile del solo asse economico, che è quello su cui
   * l'utente ha bisogno di un riferimento immediato mentre muove i passi.
   */
  const rapportoIngaggio = Math.min(1.4, ingaggio / Math.max(1, demand.wage));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5">
        <p className="text-[10px] font-extrabold tracking-wider text-amber-300 uppercase">Chiede</p>
        <p className="mt-0.5 text-xs leading-snug font-medium text-amber-100/90">
          {formatWage(demand.wage)} · {demand.seasons} {demand.seasons === 1 ? "anno" : "anni"}
          {demand.clause > 0 && ` · clausola ${formatWage(demand.clause)}`}
          {demand.wantsStarter && " · un posto da titolare"}
          {demand.wantsCaptaincy && " · la fascia"}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Passo
          label="Ingaggio annuo"
          valore={formatWage(ingaggio)}
          onMeno={() => setIngaggio((v) => Math.max(60_000, v - passo))}
          onPiu={() => setIngaggio((v) => v + passo)}
        />

        {/* La distanza dalla richiesta, come barra: dice *quanto* si sta tirando, che è la
            domanda vera mentre si muovono i passi. */}
        <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-raised)]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, (rapportoIngaggio / 1.4) * 100)}%`,
              backgroundColor:
                rapportoIngaggio >= 1 ? "#3ddc6b" : rapportoIngaggio >= 0.85 ? "#ffab2e" : "#ff4d4d",
            }}
          />
        </div>

        <Passo
          label="Durata"
          valore={`${anni} ${anni === 1 ? "anno" : "anni"}`}
          onMeno={() => setAnni((v) => Math.max(1, v - 1))}
          onPiu={() => setAnni((v) => Math.min(5, v + 1))}
        />

        {demand.clause > 0 && (
          <Passo
            label="Clausola"
            valore={clausola > 0 ? formatWage(clausola) : "nessuna"}
            onMeno={() => setClausola((v) => Math.max(0, v - passoClausola))}
            onPiu={() => setClausola((v) => v + passoClausola)}
          />
        )}

        <p className="px-1 text-[11px] font-bold text-[var(--brand)]">
          {formatContractTotal(ingaggio, anni)}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Interruttore
            attivo={titolare}
            onClick={() => setTitolare((v) => !v)}
            colore="#3ddc6b"
            icona={<Check size={12} />}
            label="Titolarità"
          />
          <Interruttore
            attivo={capitano}
            onClick={() => setCapitano((v) => !v)}
            colore="#f5c518"
            icona={<Star size={12} />}
            label="Fascia"
          />
        </div>

        <WageImpactPanel
          state={state}
          world={world}
          proposedWage={ingaggio}
          currentWage={currentWage}
          onShift={onShiftFinances}
        />

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

      <footer className="flex gap-2 border-t border-[var(--surface-border)] p-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-2xl border border-[var(--surface-border)] px-4 text-xs font-bold text-[var(--text-secondary)]"
          >
            {cancelLabel ?? "Annulla"}
          </button>
        )}
        <button
          type="button"
          disabled={esito?.ok === true}
          onClick={() =>
            setEsito(
              onSubmit({
                wage: ingaggio,
                seasons: anni,
                clause: clausola,
                guaranteedStarter: titolare,
                captain: capitano,
              }),
            )
          }
          className="min-h-11 flex-1 rounded-2xl bg-[var(--brand)] py-3 text-sm font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-98 disabled:opacity-40"
        >
          {esito?.ok ? "Fatto" : submitLabel}
        </button>
      </footer>
    </div>
  );
}

function Passo({
  label,
  valore,
  onMeno,
  onPiu,
}: {
  label: string;
  valore: string;
  onMeno: () => void;
  onPiu: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[var(--surface-raised)] px-3 py-2 text-xs font-bold">
      {label}
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Riduci ${label.toLowerCase()}`}
          onClick={onMeno}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--surface-border)] active:scale-95"
        >
          <Minus size={13} />
        </button>
        <span className="w-24 text-right tabular-nums">{valore}</span>
        <button
          type="button"
          aria-label={`Aumenta ${label.toLowerCase()}`}
          onClick={onPiu}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--surface-border)] active:scale-95"
        >
          <Plus size={13} />
        </button>
      </span>
    </div>
  );
}

function Interruttore({
  attivo,
  onClick,
  colore,
  icona,
  label,
}: {
  attivo: boolean;
  onClick: () => void;
  colore: string;
  icona: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={attivo}
      onClick={onClick}
      className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-[11px] font-bold transition-colors"
      style={{
        backgroundColor: attivo ? `${colore}33` : "var(--surface-raised)",
        color: attivo ? colore : "var(--text-secondary)",
      }}
    >
      {icona} {label}
    </button>
  );
}
