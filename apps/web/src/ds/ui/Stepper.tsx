import { motion } from "framer-motion";
import { Check } from "lucide-react";

/**
 * La sequenza a passi.
 *
 * È il componente che risponde alla causa diretta del fallimento dei test coi
 * giocatori nuovi, e alla richiesta dell'utente: *«deve essere una sequenza di
 * azioni, prima le richieste, poi ingaggio e durata di contratto»*.
 *
 * Il difetto delle schede parallele non è come sono disegnate: è che
 * presentano come **paralleli e opzionali** due passi che sono **sequenziali e
 * obbligatori**. Una barra a schede dice "guarda dove vuoi"; la verità di quei
 * cancelli è "prima questo, poi quello, e senza il secondo non si chiude". Lo
 * stepper dice tre cose che le schede non dicevano: dove sei, quanto manca, e
 * che l'ordine conta.
 *
 * Si può **tornare indietro** su un passo già fatto — cambiare idea è legittimo
 * — ma non saltare avanti a uno non ancora sbloccato: sarebbe di nuovo la barra
 * a schede, con lo stesso difetto.
 */

export interface Step {
  key: string;
  label: string;
}

interface StepperProps {
  steps: Step[];
  /** Indice del passo corrente (0-based). */
  current: number;
  /** Fin dove ci si può tornare: i passi ≤ a questo sono già stati completati. */
  furthest: number;
  onGoTo: (index: number) => void;
}

export function Stepper({ steps, current, furthest, onGoTo }: StepperProps) {
  return (
    <nav aria-label="Passi" className="flex items-center gap-1.5 px-1">
      {steps.map((step, i) => {
        const fatto = i < furthest;
        const attivo = i === current;
        const raggiungibile = i <= furthest;

        return (
          <div key={step.key} className="flex min-w-0 flex-1 items-center gap-1.5">
            <button
              type="button"
              disabled={!raggiungibile}
              onClick={() => raggiungibile && onGoTo(i)}
              aria-current={attivo ? "step" : undefined}
              className="flex min-h-tap min-w-0 flex-1 flex-col items-start justify-center gap-1.5 disabled:cursor-not-allowed"
            >
              <span className="relative flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-border)]">
                {(fatto || attivo) && (
                  <motion.span
                    layoutId={`step-${step.key}`}
                    className="absolute inset-0 rounded-full bg-[var(--brand)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </span>

              <span
                className={`flex w-full min-w-0 items-center gap-1 text-micro uppercase ${
                  attivo
                    ? "text-[var(--text-primary)]"
                    : fatto
                      ? "text-[var(--brand)]"
                      : "text-[var(--text-secondary)]"
                }`}
              >
                {fatto && <Check size={11} className="shrink-0" />}
                <span className="truncate">{step.label}</span>
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
