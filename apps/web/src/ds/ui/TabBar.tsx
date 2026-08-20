import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

/**
 * La navigazione della carriera: una barra inferiore, dove sta il pollice.
 *
 * Prima era una fila di pillole in **cima** allo schermo che scorreva in
 * orizzontale, e le misure dicevano tre cose insieme:
 *
 * - i bersagli erano alti **28px** (Stagione 96×28, Rosa 74×28, …), molto sotto
 *   i 44 sotto cui il dito sbaglia;
 * - «Coppe» arrivava tagliata al bordo e **«Storico» non era visibile affatto**,
 *   senza alcun segnale che la fila continuasse;
 * - stava in cima, cioè il posto più lontano dal pollice su un telefono
 *   moderno, mentre è la navigazione che si usa più spesso.
 *
 * Qui: 56px di altezza più la safe area, icona sopra ed etichetta sotto, tutte
 * e cinque le voci visibili senza scorrimento. È la forma che ogni giocatore ha
 * già nel pollice da qualunque altra app, il che è metà del lavoro contro lo
 * spaesamento: non c'è niente da imparare.
 */

export interface TabItem<T extends string> {
  key: T;
  label: string;
  icon: LucideIcon;
  /** Pallino rosso con conteggio: qualcosa aspetta una risposta. */
  badge?: number;
}

interface TabBarProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Azione contestuale sopra la barra ("Gioca fino al mercato"). */
  action?: React.ReactNode;
  /**
   * Navigazione sospesa: c'è qualcosa da decidere prima.
   *
   * Serve al velo che copre la carriera mentre si decide se guardare una partita chiave: lo
   * stato dietro contiene già l'esito, quindi cambiare scheda sarebbe un modo per sbirciarlo.
   */
  disabled?: boolean;
}

export function TabBar<T extends string>({ items, value, onChange, action, disabled }: TabBarProps<T>) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--surface-border)] bg-[var(--surface)]/95 backdrop-blur">
      {action && (
        <div className="mx-auto w-full max-w-3xl border-b border-[var(--surface-border)] px-4 py-2.5">
          {action}
        </div>
      )}

      <nav className="mx-auto flex w-full max-w-3xl pb-safe" role="tablist">
        {items.map(({ key, label, icon: Icon, badge }) => {
          const attivo = value === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={attivo}
              disabled={disabled}
              onClick={() => onChange(key)}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                attivo ? "text-[var(--brand)]" : "text-[var(--text-secondary)]"
              } ${disabled ? "pointer-events-none opacity-40" : ""}`}
            >
              {attivo && (
                <motion.span
                  layoutId="ds-tabbar"
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-[var(--brand)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}

              <span className="relative">
                <Icon size={21} strokeWidth={attivo ? 2.4 : 2} />
                {badge !== undefined && badge > 0 && (
                  <span className="num absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-micro text-white">
                    {badge}
                  </span>
                )}
              </span>

              <span className={`text-micro tracking-normal ${attivo ? "font-extrabold" : "font-bold"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
