import { useMemo, useState } from "react";
import { AlertTriangle, Landmark, Users, Wallet } from "lucide-react";
import {
  MAX_WAGE_SHARE,
  MIN_WAGE_SHARE,
  WINTER_SHIFT_LIMIT,
  financesOf,
  formatEuro,
  formatWage,
  type CareerState,
  type CareerWorld,
} from "@app/game-engine";

/**
 * **Le finanze in due numeri.**
 *
 * Riscritto su richiesta esplicita dell'utente (2026-08-13): il pannello parlava di quote,
 * ripartizioni e percentuali, e la domanda vera — *quanto posso spendere sul mercato, e quanto
 * mi costano gli stipendi* — andava ricostruita mentalmente ogni volta.
 *
 * Adesso ci sono **due sole cifre**, e lo slider sposta euro fra loro:
 *
 *  - **Costo annuale ingaggi** — quanto costano i contratti già firmati. È il **pavimento**: la
 *    manopola si ferma lì, e non perché un errore lo dica dopo il rilascio, ma perché a sinistra
 *    non c'è più binario. La percentuale resta nel motore, dov'è la logica; qui non compare.
 *  - **Budget mercato disponibile** — la liquidità con cui si compra.
 *
 * Lo sforamento non è vietato ma **dichiarato**: si può firmare oltre il tetto, e la differenza
 * si sconta dal fatturato dell'anno prossimo.
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

  /**
   * Gli estremi in **quota**, che è la lingua del motore. In interfaccia non si vedono mai:
   * lo slider li traduce in euro prima di mostrarli.
   */
  const minConsentito = Math.max(
    MIN_WAGE_SHARE,
    vista.minShareForCommitments,
    inverno ? estiva - WINTER_SHIFT_LIMIT : 0,
  );
  const maxConsentito = Math.max(
    minConsentito,
    Math.min(
      Math.max(MAX_WAGE_SHARE, vista.minShareForCommitments),
      inverno ? estiva + WINTER_SHIFT_LIMIT : 1,
    ),
  );

  const anteprima = useMemo(() => {
    const tetto = Math.round(vista.revenue * bozza);
    const delta = tetto - vista.wageBudget;
    return {
      tetto,
      margine: tetto - vista.committedWages,
      // La liquidità che resta davvero da spendere, non la dotazione teorica: spostare verso gli
      // ingaggi toglie cassa al mercato, ed è quel numero a decidere se un colpo è possibile.
      mercato: Math.max(0, state.budget - delta),
      delta,
    };
  }, [bozza, vista, state.budget]);

  const passo = (valore: number) => Math.round((valore / vista.revenue) * 1000) / 1000;
  const applica = (nuova: number) => {
    const limitata = Math.min(maxConsentito, Math.max(minConsentito, nuova));
    setBozza(limitata);
    if (Math.abs(limitata - vista.wageShare) > 0.001) onShift(limitata);
  };

  return (
    <section className="flex flex-col gap-3 rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4">
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-body font-extrabold">
          <Landmark size={15} className="text-[var(--brand)]" /> Finanze della stagione
        </h3>
        <span className="text-right">
          <span className="block text-body font-extrabold tabular-nums">
            {formatEuro(vista.revenue)}
          </span>
          <span className="block text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            fatturato
          </span>
        </span>
      </header>

      {/* I due numeri, e nient'altro. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-control bg-[var(--surface)] p-3">
          <p className="flex items-center gap-1.5 text-micro font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
            <Wallet size={11} /> Mercato
          </p>
          <p className="mt-1 text-title leading-none font-extrabold tabular-nums">
            {formatEuro(anteprima.mercato)}
          </p>
          <p className="mt-1 text-label text-[var(--text-secondary)]">disponibile ora</p>
        </div>
        <div className="rounded-control bg-[var(--surface)] p-3">
          <p className="flex items-center gap-1.5 text-micro font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
            <Users size={11} /> Ingaggi
          </p>
          <p className="mt-1 text-title leading-none font-extrabold tabular-nums">
            {formatWage(anteprima.tetto)}
          </p>
          <p className="mt-1 text-label text-[var(--text-secondary)]">
            di cui {formatWage(vista.committedWages)} già firmati
          </p>
        </div>
      </div>

      {/* Il binario parte dal pavimento: a sinistra degli impegni firmati non si va, e non
          perché un messaggio lo dica dopo — semplicemente non c'è dove andare. */}
      <div className="flex flex-col gap-1.5 pt-1">
        <input
          type="range"
          min={Math.round(minConsentito * 1000)}
          max={Math.round(maxConsentito * 1000)}
          value={Math.round(Math.min(maxConsentito, Math.max(minConsentito, bozza)) * 1000)}
          aria-label="Sposta risorse fra ingaggi e mercato"
          aria-valuetext={`${formatWage(anteprima.tetto)} agli ingaggi, ${formatEuro(anteprima.mercato)} al mercato`}
          onChange={(e) => setBozza(Number(e.target.value) / 1000)}
          onPointerUp={() => applica(bozza)}
          onKeyUp={() => applica(bozza)}
          className="w-full accent-[var(--brand)]"
        />
        <div className="flex items-center justify-between text-label font-bold text-[var(--text-secondary)]">
          <span>min {formatWage(vista.committedWages)}</span>
          <span>max {formatWage(Math.round(vista.revenue * maxConsentito))}</span>
        </div>
      </div>

      {/* Scorciatoie a passo fisso: su mobile trascinare con precisione un cursore è la parte
          scomoda, e la decisione vera è quasi sempre "spostane cinque milioni". */}
      <div className="flex gap-1.5">
        {[5_000_000, 10_000_000].map((importo) => (
          <button
            key={`giu-${importo}`}
            type="button"
            onClick={() => applica(bozza - passo(importo))}
            className="min-h-9 flex-1 rounded-control border border-[var(--surface-border)] text-label font-bold text-[var(--text-secondary)] active:scale-95"
          >
            −{formatEuro(importo)}
          </button>
        ))}
        {[5_000_000, 10_000_000].map((importo) => (
          <button
            key={`su-${importo}`}
            type="button"
            onClick={() => applica(bozza + passo(importo))}
            className="min-h-9 flex-1 rounded-control border border-[var(--brand)]/40 bg-[var(--brand)]/10 text-label font-bold text-[var(--brand)] active:scale-95"
          >
            +{formatEuro(importo)}
          </button>
        ))}
      </div>

      <p className="text-label leading-snug font-semibold text-[var(--text-secondary)]">
        Sposta verso gli ingaggi per firmare rinnovi e svincolati; verso il mercato per i
        cartellini. Sotto {formatWage(vista.committedWages)} non si scende: sono contratti già
        firmati
        {inverno
          ? ` · a stagione in corso puoi spostare al più ${Math.round(WINTER_SHIFT_LIMIT * 100)} punti rispetto all'estate`
          : ""}
        .
      </p>

      {anteprima.margine !== 0 && (
        <p className="rounded-control border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-label font-bold">
          Margine per nuove firme:{" "}
          <span className={anteprima.margine < 0 ? "text-[#ff4d4d]" : "text-[#3ddc6b]"}>
            {formatWage(anteprima.margine)}
          </span>
          {anteprima.delta !== 0 && (
            <span className="font-semibold text-[var(--text-secondary)]">
              {" "}
              · sposti {formatEuro(Math.abs(anteprima.delta))}{" "}
              {anteprima.delta > 0 ? "sugli ingaggi" : "sul mercato"}
            </span>
          )}
        </p>
      )}

      {vista.overrunNow > 0 && (
        <p className="flex items-start gap-2 rounded-control bg-[#ff4d4d]/15 px-3 py-2 text-label font-bold text-[#ff4d4d]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Stai sforando di {formatEuro(vista.overrunNow)}: verranno tolti dal fatturato della
          prossima stagione.
        </p>
      )}
    </section>
  );
}
