import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * I numeri, che nell'editoriale sportivo sono i protagonisti (decisione D3).
 *
 * `StatRow` sostituisce il difetto misurato nel dossier del club: budget,
 * giocatori in rosa e prestigio occupavano **tre schede impilate da ~150px
 * l'una**, quindi la prima schermata del dossier mostrava tre numeri e la rosa
 * — che è la ragione per cui il dossier esiste — restava molto sotto la piega
 * senza che niente dicesse che c'era.
 *
 * Tre numeri affiancati occupano una riga e si confrontano con un colpo
 * d'occhio, che è il modo in cui i numeri si leggono davvero.
 */

interface StatProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  /** Colore del valore: un margine ingaggi negativo va visto subito. */
  tone?: "default" | "win" | "loss" | "gold";
  /** Riga sotto il valore: la variazione, il contesto. */
  hint?: ReactNode;
}

const TONE: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "text-[var(--text-primary)]",
  win: "text-[var(--win)]",
  loss: "text-[var(--loss)]",
  gold: "text-[var(--gold)]",
};

export function Stat({ label, value, icon: Icon, tone = "default", hint }: StatProps) {
  return (
    <div className="min-w-0 flex-1">
      <p className="flex items-center gap-1 text-micro text-[var(--text-secondary)] uppercase">
        {Icon && <Icon size={11} className="shrink-0" />}
        <span className="truncate">{label}</span>
      </p>
      <p className={`num mt-0.5 truncate text-title ${TONE[tone]}`}>{value}</p>
      {hint && <p className="truncate text-label text-[var(--text-secondary)]">{hint}</p>}
    </div>
  );
}

/** Due o tre `Stat` affiancate, separate da una linea sottile. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3.5 py-3 [&>*+*]:border-l [&>*+*]:border-[var(--surface-border)] [&>*+*]:pl-3">
      {children}
    </div>
  );
}
