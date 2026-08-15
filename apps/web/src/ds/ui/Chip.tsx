import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * La pastiglia: ruoli, stati, filtri.
 *
 * Ne esistevano quattro stili diversi, e la regola che li sostituisce nasce
 * dalla misura della barra del mercato: **se l'etichetta non ci sta, non è una
 * barra a segmenti**. Cinque voci `flex-1` su 360px lasciavano 26px per la
 * parola, e quattro etichette su cinque risultavano illeggibili (`Fi…`, `M…`,
 * `N…`, e *Offerte* con 3px disponibili su 40 necessari).
 *
 * `ChipBar` è la risposta: le pastiglie tengono la **loro** larghezza naturale
 * e scorrono, invece di comprimersi fino a sparire. La sfumatura sul bordo
 * destro dice che c'è dell'altro — senza, una fila che scorre sembra una fila
 * che finisce lì (è il difetto per cui «Storico» era invisibile nella barra
 * della carriera).
 */

interface ChipProps {
  children: ReactNode;
  icon?: LucideIcon;
  selected?: boolean;
  /** Conteggio informativo, dentro la pastiglia. */
  count?: number;
  tone?: "neutral" | "accent" | "danger" | "gold";
  onClick?: () => void;
}

const TONE: Record<NonNullable<ChipProps["tone"]>, string> = {
  neutral: "border-[var(--surface-border)] text-[var(--text-secondary)]",
  accent: "border-[var(--accent)]/45 text-[var(--accent)]",
  danger: "border-[var(--danger)]/45 text-[var(--danger)]",
  gold: "border-[var(--gold)]/45 text-[var(--gold)]",
};

export function Chip({
  children,
  icon: Icon,
  selected = false,
  count,
  tone = "neutral",
  onClick,
}: ChipProps) {
  const classi = `flex shrink-0 items-center gap-1.5 rounded-full border px-3 text-label font-bold whitespace-nowrap transition-colors ${
    selected
      ? "border-transparent bg-[var(--brand)] text-[var(--brand-contrast)]"
      : `bg-transparent ${TONE[tone]}`
  }`;

  if (!onClick) {
    return (
      <span className={`${classi} py-1`}>
        {Icon && <Icon size={12} className="shrink-0" />}
        {children}
      </span>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`${classi} min-h-tap`}>
      {Icon && <Icon size={14} className="shrink-0" />}
      {children}
      {count !== undefined && count > 0 && (
        <span
          className={`num rounded-full px-1.5 text-micro ${
            selected ? "bg-black/20" : "bg-[var(--surface-raised)]"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Fila di pastiglie che scorre, con la sfumatura che dichiara il fuori campo.
 * `-mx-4 px-4` fa scorrere la fila da bordo a bordo dello schermo mentre il
 * contenuto resta allineato al resto della pagina.
 */
export function ChipBar({ children }: { children: ReactNode }) {
  return (
    <div className="relative -mx-4">
      <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--surface)] to-transparent"
      />
    </div>
  );
}
