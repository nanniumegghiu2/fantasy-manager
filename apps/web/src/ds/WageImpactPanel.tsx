import { useMemo, useState } from "react";
import { ArrowLeftRight, Wallet } from "lucide-react";
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
 * **Quanto pesa davvero questo ingaggio, mentre lo stai decidendo.**
 *
 * Richiesta esplicita dell'utente: al tavolo di un contratto si devono vedere le finanze in
 * tempo reale, e si deve poter spostare denaro dal mercato agli ingaggi *lì*, senza uscire
 * dalla trattativa. Erano due schermate diverse — lo slider viveva solo in `FinancesPanel` — e
 * quindi la domanda vera ("me lo posso permettere, e se no cosa devo rinunciare?") richiedeva di
 * chiudere la trattativa, andare a spostare il bilancio, e tornare a ricominciare.
 *
 * Tre cose sole a schermo, tutte proiettate **dopo la firma** e non prima:
 *  - il monte ingaggi con la barra del tetto, e la fetta che questo contratto si prende;
 *  - il margine che resta, in verde o in rosso;
 *  - lo slider, con lo stesso pavimento invalicabile degli impegni già firmati.
 *
 * Il calcolo del *permesso* resta nel motore (`setWageShare` rifiuta e spiega): qui si mostra
 * soltanto, come vuole la regola di confine fra motore e app (CLAUDE.md sez. 9).
 */
export function WageImpactPanel({
  state,
  world,
  /** L'ingaggio annuo che si sta proponendo. */
  proposedWage,
  /** Quello che il giocatore già percepisce: zero per una nuova firma. */
  currentWage = 0,
  onShift,
}: {
  state: CareerState;
  world: CareerWorld;
  proposedWage: number;
  currentWage?: number;
  onShift?: (share: number) => void;
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
  /**
   * Il tetto **cede davanti al pavimento**, come nel motore (`finances.ts`): con un monte
   * ingaggi oltre il 75% del fatturato — raggiungibile dopo qualche stagione di rinnovi
   * generosi — un massimo fisso in quota risulterebbe *sotto* il minimo, e lo slider non
   * avrebbe una sola posizione valida proprio quando serve di più.
   */
  const maxConsentito = Math.max(
    minConsentito,
    Math.min(
      Math.max(MAX_WAGE_SHARE, vista.minShareForCommitments),
      inverno ? estiva + WINTER_SHIFT_LIMIT : 1,
    ),
  );

  /** La fotografia **a firma avvenuta**: è la sola che aiuti a decidere. */
  const dopo = useMemo(() => {
    const tetto = Math.round(vista.revenue * bozza);
    const aumento = proposedWage - currentWage;
    const impegni = vista.committedWages + aumento;
    return {
      tetto,
      impegni,
      margine: tetto - impegni,
      mercato: vista.revenue - tetto,
      // Quanta parte del monte se la prende questo solo contratto.
      quotaSulTetto: tetto > 0 ? Math.min(1, proposedWage / tetto) : 0,
      quotaSulFatturato: vista.revenue > 0 ? proposedWage / vista.revenue : 0,
      riempimento: tetto > 0 ? Math.min(1, impegni / tetto) : 0,
    };
  }, [bozza, vista, proposedWage, currentWage]);

  const sfora = dopo.margine < 0;

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3">
      <header className="flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
          <Wallet size={11} /> Impatto sul bilancio
        </p>
        <p className="text-[10px] font-bold text-[var(--text-secondary)]">
          fatturato {formatEuro(vista.revenue)}
        </p>
      </header>

      {/* La barra del monte ingaggi: pieno = impegni dopo la firma, tacca = questo contratto. */}
      <div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--surface)]">
          <span
            className="absolute inset-y-0 left-0 rounded-full transition-[width]"
            style={{
              width: `${Math.round(dopo.riempimento * 100)}%`,
              backgroundColor: sfora ? "#ff4d4d" : "#3ddc6b",
            }}
          />
          <span
            aria-hidden
            className="absolute inset-y-0 rounded-full bg-[var(--brand)]/80"
            style={{
              right: `${Math.max(0, 100 - Math.round(dopo.riempimento * 100))}%`,
              width: `${Math.round(dopo.quotaSulTetto * 100)}%`,
            }}
          />
        </div>
        <p className="mt-1 flex items-baseline justify-between text-[10px] font-bold">
          <span className="text-[var(--text-secondary)]">
            monte {formatWage(dopo.impegni)} su {formatWage(dopo.tetto)}
          </span>
          <span style={{ color: sfora ? "#ff4d4d" : "#3ddc6b" }}>
            margine {formatWage(dopo.margine)}
          </span>
        </p>
      </div>

      <p className="text-[11px] leading-snug font-semibold">
        Questo contratto vale{" "}
        <strong>{Math.round(dopo.quotaSulFatturato * 100)}%</strong> del fatturato annuo e{" "}
        <strong>{Math.round(dopo.quotaSulTetto * 100)}%</strong> della cassa ingaggi.
        {sfora && (
          <span className="text-[#ff4d4d]">
            {" "}
            Firmandolo sfori di {formatEuro(-dopo.margine)}: verranno tolti dal fatturato della
            prossima stagione.
          </span>
        )}
      </p>

      {onShift && (
        <div className="border-t border-[var(--surface-border)] pt-2.5">
          <p className="flex items-center justify-between text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
            <span className="flex items-center gap-1.5">
              <ArrowLeftRight size={11} /> Sposta dal mercato agli ingaggi
            </span>
            <span className="tabular-nums">{Math.round(bozza * 100)}%</span>
          </p>
          <input
            type="range"
            /* Il binario parte dal pavimento degli impegni firmati: sotto non c'è dove andare,
               che è più chiaro di un errore dopo il rilascio. */
            min={Math.round(minConsentito * 1000)}
            max={Math.round(maxConsentito * 1000)}
            value={Math.round(Math.min(maxConsentito, Math.max(minConsentito, bozza)) * 1000)}
            aria-label="Sposta risorse fra ingaggi e mercato"
            aria-valuetext={`${formatWage(dopo.tetto)} agli ingaggi, ${formatEuro(dopo.mercato)} al mercato`}
            onChange={(e) => setBozza(Number(e.target.value) / 1000)}
            onPointerUp={() => {
              const limitata = Math.min(maxConsentito, Math.max(minConsentito, bozza));
              setBozza(limitata);
              if (Math.abs(limitata - vista.wageShare) > 0.001) onShift(limitata);
            }}
            className="mt-1 w-full accent-[var(--brand)]"
          />
          <p className="text-[10px] leading-snug text-[var(--text-secondary)]">
            Mercato {formatEuro(dopo.mercato)} · liquidità ora {formatEuro(state.budget)}
            {inverno
              ? ` · a stagione in corso puoi spostare al più ${Math.round(WINTER_SHIFT_LIMIT * 100)} punti`
              : ""}
          </p>
        </div>
      )}
    </section>
  );
}
