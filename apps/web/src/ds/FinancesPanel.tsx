import { useMemo, useState } from "react";
import { AlertTriangle, Landmark, Users, Wallet } from "lucide-react";
import {
  MAX_WAGE_SHARE,
  MIN_WAGE_SHARE,
  WINTER_SHIFT_LIMIT,
  contractFor,
  financesOf,
  formatEuro,
  formatWage,
  type CareerState,
  type CareerWorld,
} from "@app/game-engine";

/**
 * **Lo slider delle finanze: il DS è padrone del proprio bilancio.**
 *
 * Il fatturato è uno solo e va diviso fra cartellini e stipendi. Tre accorgimenti perché lo
 * strumento sia usabile e non frustrante:
 *  1. il **pavimento degli impegni firmati** è disegnato *sul binario* (la tacca), non nascosto in
 *     un errore che compare dopo aver rilasciato il cursore;
 *  2. mentre si trascina, sotto si legge **cosa quella cifra permette davvero** — un numero
 *     astratto non aiuta a decidere, "ti basta per due rinnovi" sì;
 *  3. lo sforamento non è vietato ma **dichiarato**: si vede subito quanto costerà l'anno prossimo.
 */
export function FinancesPanel({
  state,
  world,
  onShift,
}: {
  state: CareerState;
  world: CareerWorld;
  onShift: (share: number) => void;
}) {
  const vista = useMemo(() => financesOf(state, world), [state, world]);
  const [bozza, setBozza] = useState(vista.wageShare);
  const inverno = state.market?.window === "riparazione";
  const estiva = state.finances?.summerShare ?? vista.wageShare;

  const minConsentito = Math.max(
    MIN_WAGE_SHARE,
    vista.minShareForCommitments,
    inverno ? estiva - WINTER_SHIFT_LIMIT : 0,
  );
  const maxConsentito = Math.min(MAX_WAGE_SHARE, inverno ? estiva + WINTER_SHIFT_LIMIT : MAX_WAGE_SHARE);

  const anteprima = useMemo(() => {
    const tetto = Math.round(vista.revenue * bozza);
    const margine = tetto - vista.committedWages;
    const mercato = vista.revenue - tetto;
    return { tetto, margine, mercato, delta: tetto - vista.wageBudget };
  }, [bozza, vista]);

  /** Quanti rinnovi in sospeso copre quel margine: è la traduzione concreta del numero. */
  const cosaPermette = useMemo(() => {
    const inScadenza = state.roster
      .map((e) => contractFor(state, world, e.playerId))
      .filter((c) => c && c.until - state.season + 1 <= 1)
      .map((c) => Math.round((c!.wage ?? 0) * 0.25));
    let residuo = anteprima.margine;
    let quanti = 0;
    for (const costo of inScadenza.sort((a, b) => a - b)) {
      if (residuo < costo) break;
      residuo -= costo;
      quanti += 1;
    }
    return { rinnovi: quanti, inScadenza: inScadenza.length };
  }, [anteprima.margine, state, world]);

  const posizionePavimento = Math.min(
    100,
    Math.max(0, ((minConsentito - MIN_WAGE_SHARE) / (MAX_WAGE_SHARE - MIN_WAGE_SHARE)) * 100),
  );

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4">
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-extrabold">
          <Landmark size={15} className="text-[var(--brand)]" /> Finanze della stagione
        </h3>
        <span className="text-right">
          <span className="block text-sm font-extrabold tabular-nums">{formatEuro(vista.revenue)}</span>
          <span className="block text-[9px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            fatturato
          </span>
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[var(--surface)] p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
            <Wallet size={11} /> Mercato
          </p>
          <p className="mt-1 text-base font-extrabold tabular-nums">{formatEuro(anteprima.mercato)}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">
            liquidità ora: {formatEuro(state.budget)}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--surface)] p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
            <Users size={11} /> Ingaggi
          </p>
          <p className="mt-1 text-base font-extrabold tabular-nums">{formatWage(anteprima.tetto)}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">
            impegni: {formatEuro(vista.committedWages)}
          </p>
        </div>
      </div>

      <div className="relative pt-1">
        <input
          type="range"
          min={MIN_WAGE_SHARE * 100}
          max={MAX_WAGE_SHARE * 100}
          value={Math.round(bozza * 100)}
          aria-label="Ripartizione fra cassa mercato e cassa ingaggi"
          onChange={(e) => setBozza(Number(e.target.value) / 100)}
          onPointerUp={() => {
            const limitata = Math.min(maxConsentito, Math.max(minConsentito, bozza));
            setBozza(limitata);
            if (Math.abs(limitata - vista.wageShare) > 0.001) onShift(limitata);
          }}
          className="w-full accent-[var(--brand)]"
        />
        {/* Il pavimento degli impegni, disegnato sul binario. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 h-5 w-0.5 bg-[#ff4d4d]"
          style={{ left: `${posizionePavimento}%` }}
        />
      </div>

      <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
        Non puoi scendere sotto <strong>{formatWage(vista.committedWages)}</strong> di impegni già
        firmati{inverno ? ` · a stagione in corso puoi spostare al più ${Math.round(WINTER_SHIFT_LIMIT * 100)} punti` : ""}.
      </p>

      <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3">
        <p className="text-[11px] font-bold">
          Margine ingaggi:{" "}
          <span className={anteprima.margine < 0 ? "text-[#ff4d4d]" : "text-[#3ddc6b]"}>
            {formatWage(anteprima.margine)}
          </span>
        </p>
        <p className="mt-1 text-[11px] leading-snug text-[var(--text-secondary)]">
          {cosaPermette.inScadenza === 0
            ? "Nessun contratto in scadenza da coprire quest'anno."
            : `Copre ${cosaPermette.rinnovi} dei ${cosaPermette.inScadenza} rinnovi in scadenza.`}
          {anteprima.delta !== 0 &&
            ` Sposti ${formatEuro(Math.abs(anteprima.delta))} ${anteprima.delta > 0 ? "sugli ingaggi" : "sul mercato"}.`}
        </p>
      </div>

      {vista.overrunNow > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-[#ff4d4d]/15 px-3 py-2 text-[11px] font-bold text-[#ff4d4d]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Stai sforando di {formatEuro(vista.overrunNow)}: verranno tolti dal fatturato della
          prossima stagione.
        </p>
      )}
    </section>
  );
}
