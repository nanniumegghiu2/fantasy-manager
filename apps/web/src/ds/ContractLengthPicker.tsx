import { Minus, Plus } from "lucide-react";
import { COACH_CONTRACT_LENGTHS, coachWageFor, formatContractTotal, type Coach } from "@app/game-engine";

/**
 * **La durata del contratto è una scelta a due facce, non un numero.**
 *
 * Lungo: l'ingaggio annuo scende (il tecnico compra sicurezza) ma la buonuscita diventa pesante e
 * ti leghi. Corto: costa di più all'anno, lo mandi via quasi gratis, ma a scadenza rischi che te
 * lo portino via a zero. Il riquadro mostra **entrambe** le facce insieme all'annuale e al totale,
 * perché è il confronto a rendere la scelta leggibile.
 */
export function ContractLengthPicker({
  coach,
  seasons,
  onChange,
}: {
  coach: Coach;
  seasons: number;
  onChange: (seasons: number) => void;
}) {
  const min = COACH_CONTRACT_LENGTHS[0]!;
  const max = COACH_CONTRACT_LENGTHS[COACH_CONTRACT_LENGTHS.length - 1]!;
  const annuo = coachWageFor(coach, seasons);

  return (
    <div className="rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3">
      <div className="flex items-center justify-between">
        <p className="text-micro font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
          Durata del contratto
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Riduci la durata"
            disabled={seasons <= min}
            onClick={() => onChange(Math.max(min, seasons - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-control border border-[var(--surface-border)] disabled:opacity-40"
          >
            <Minus size={13} />
          </button>
          <span className="w-16 text-center text-body font-extrabold tabular-nums">
            {seasons} {seasons === 1 ? "anno" : "anni"}
          </span>
          <button
            type="button"
            aria-label="Aumenta la durata"
            disabled={seasons >= max}
            onClick={() => onChange(Math.min(max, seasons + 1))}
            className="flex h-7 w-7 items-center justify-center rounded-control border border-[var(--surface-border)] disabled:opacity-40"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      <p className="mt-2 text-label font-bold text-[var(--brand)]">
        {formatContractTotal(annuo, seasons)}
      </p>
      <p className="mt-1 text-label leading-snug text-[var(--text-secondary)]">
        {seasons >= 4
          ? "Contratto lungo: si accontenta di meno all'anno, ma esonerarlo costerà caro e nessuno potrà portartelo via."
          : seasons <= 1
            ? "Contratto corto: costa di più all'anno e a giugno può andarsene a zero — ma mandarlo via è quasi gratis."
            : "Durata di equilibrio fra costo annuo e libertà di cambiare."}
      </p>
    </div>
  );
}
