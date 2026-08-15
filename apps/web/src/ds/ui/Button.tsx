import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Il bottone della DS mode.
 *
 * Sostituisce ~200 bottoni scritti a mano, ognuno con la sua altezza, il suo
 * raggio e la sua misura di testo. Due proprietà che i predecessori non
 * avevano, e che sono la ragione per cui esiste:
 *
 * 1. **`--tap` è garantito**: 44px di altezza minima, sempre. Erano stati
 *    misurati 58 bersagli sotto la soglia nella sola scheda Mercato, e le
 *    mosse della trattativa col mister — le decisioni più importanti di quella
 *    schermata — erano alte 29px.
 *
 * 2. **Uno stato disabilitato che dice cosa fare, non cosa manca.** È la regola
 *    che nasce dal difetto peggiore trovato nell'analisi: il primo cancello
 *    della carriera aveva come azione primaria un bottone spento che recitava
 *    «Manca il rinnovo». Non è una chiamata all'azione, è un messaggio d'errore
 *    vestito da bottone — e l'unica cosa vistosa e premibile accanto era
 *    «Rifiuta Condizioni», cioè l'uscita. Qui `blockedReason` non spegne il
 *    bottone in silenzio: lo lascia leggibile e gli mette accanto la frase che
 *    dice **dove andare**, e se `onBlockedClick` è passato il tocco ci porta.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  /** Occupa tutta la larghezza: la forma normale di un'azione primaria su telefono. */
  block?: boolean;
  /**
   * Perché l'azione non è disponibile, **espresso come cosa fare**: "Scegli la
   * durata del contratto", non "Manca il rinnovo". Rende il bottone inerte ma
   * non muto.
   */
  blockedReason?: string;
  /** Dove porta il tocco quando è bloccato: il passo che sblocca l'azione. */
  onBlockedClick?: () => void;
  children: ReactNode;
  className?: string;
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-[var(--brand)] text-[var(--brand-contrast)] shadow-[var(--elev-card)]",
  secondary: "border border-[var(--surface-border)] bg-[var(--surface-raised)] text-[var(--text-primary)]",
  ghost: "text-[var(--text-secondary)]",
  danger: "border border-[var(--danger)]/40 text-[var(--danger)]",
};

const SIZE: Record<Size, string> = {
  md: "min-h-tap px-4 text-label",
  lg: "min-h-[3.25rem] px-5 text-body",
};

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  block = false,
  blockedReason,
  onBlockedClick,
  children,
  className = "",
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  const bloccato = !!blockedReason;
  // Un bottone bloccato che sa dove mandarti resta premibile: è il tocco che
  // porta al passo mancante. Senza destinazione resta inerte ma leggibile.
  const inerte = disabled || (bloccato && !onBlockedClick);

  return (
    <span className={block ? "flex w-full flex-col gap-1.5" : "inline-flex flex-col gap-1.5"}>
      <button
        type="button"
        disabled={inerte}
        onClick={bloccato ? onBlockedClick : onClick}
        aria-describedby={undefined}
        className={`flex items-center justify-center gap-2 rounded-control font-extrabold transition-[transform,opacity] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${
          VARIANT[variant]
        } ${SIZE[size]} ${block ? "w-full" : ""} ${bloccato ? "opacity-60" : ""} ${className}`}
        {...rest}
      >
        {Icon && <Icon size={size === "lg" ? 19 : 16} className="shrink-0" />}
        <span className="truncate">{children}</span>
      </button>

      {blockedReason && (
        <span className="text-center text-label leading-snug text-[var(--text-secondary)]">
          {blockedReason}
        </span>
      )}
    </span>
  );
}
