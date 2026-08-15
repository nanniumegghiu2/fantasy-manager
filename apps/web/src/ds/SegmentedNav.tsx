import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

/**
 * **La navigazione del mercato, un componente solo.**
 *
 * Prima ogni livello aveva la sua barra scritta a mano: la nav principale con le pillole, la
 * sotto-nav della Rosa con dei bottoni squadrati, i chip "Ricerca libera / Cedibili IA" con un
 * terzo stile ancora. Tre grammatiche diverse per la stessa azione — scegliere dove sei — ed è
 * la ragione per cui muoversi nel mercato sembrava macchinoso: ogni volta bisognava capire *dove
 * guardare*.
 *
 * Qui c'è una forma sola, declinata in due misure (`size`): la barra principale e le sotto-barre
 * si riconoscono come parenti, e il cursore che scivola (`layoutId`) dice sempre da dove a dove
 * ci si è spostati. Il `badge` è parte del contratto del componente, non un pezzo appiccicato:
 * un conteggio è un'informazione di navigazione, deve stare dov'è la scelta.
 */

export interface SegmentedItem<T extends string> {
  key: T;
  label: string;
  icon: LucideIcon;
  /** Conteggio neutro (offerte, risultati): informativo. */
  count?: number;
  /** Conteggio che chiede attenzione: rosso e pulsante. */
  badge?: number;
}

interface SegmentedNavProps<T extends string> {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Deve essere unico per ogni barra sulla stessa schermata. */
  layoutId: string;
  size?: "md" | "sm";
  className?: string;
}

export function SegmentedNav<T extends string>({
  items,
  value,
  onChange,
  layoutId,
  size = "md",
  className = "",
}: SegmentedNavProps<T>) {
  const grande = size === "md";

  return (
    <nav
      role="tablist"
      className={`flex gap-1 rounded-card bg-[var(--surface-raised)] p-1 ${
        grande ? "" : "text-label"
      } ${className}`}
    >
      {items.map(({ key, label, icon: Icon, count, badge }) => {
        const attivo = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={attivo}
            onClick={() => onChange(key)}
            className={`relative min-w-0 flex-1 rounded-control font-extrabold transition-colors ${
              grande ? "min-h-tap px-1 py-1.5" : "px-2 py-1.5 text-label"
            } ${attivo ? "text-[var(--brand-contrast)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {attivo && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-control bg-[var(--brand)] shadow-sm"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            {/* ⚠️ **Icona sopra, etichetta sotto** nella misura grande.

                Affiancate, cinque voci `flex-1` su 360px lasciavano 26px per la parola e quattro
                etichette su cinque risultavano illeggibili («Fi…», «M…», «N…», e *Offerte* con
                3px su 40 necessari). Scendere a quattro voci non è bastato: la misura di
                controllo trovava ancora «Offerte» a 24px su 47. Impilate, l'etichetta si prende
                tutta la larghezza della voce (~86px) e ci sta per intero — e la voce arriva a
                44px di altezza, che è anche la soglia sotto cui il dito sbaglia. */}
            <span
              className={`relative flex min-w-0 items-center justify-center ${
                grande ? "flex-col gap-0.5" : "gap-1.5"
              }`}
            >
              <span className="flex items-center gap-1">
                <Icon size={grande ? 15 : 12} className="shrink-0" />

                {count !== undefined && count > 0 && (
                  <span
                    className={`num shrink-0 rounded-full px-1.5 text-micro tracking-normal ${
                      attivo ? "bg-black/20" : "bg-[var(--surface)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {count}
                  </span>
                )}

                {badge !== undefined && badge > 0 && (
                  <motion.span
                    // Pulsa finché non la si guarda: è una richiesta in attesa, non una statistica.
                    animate={{ scale: [1, 1.14, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className="num flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-micro tracking-normal text-white shadow-sm"
                  >
                    {badge}
                  </motion.span>
                )}
              </span>

              <span className={grande ? "text-micro tracking-normal" : "truncate"}>{label}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
