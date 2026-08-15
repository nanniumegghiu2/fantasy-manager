import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Il foglio: **una** sovraimpressione per tutta la DS mode.
 *
 * Ne erano state scritte a mano diciannove, e le misure lo dicevano meglio di
 * qualunque giudizio estetico: **nove altezze diverse** (68, 72, 75, 78, 80,
 * 85, 86, 90, 92 svh). Aprendo il mercato, poi una trattativa, poi un rinnovo,
 * il foglio cambiava dimensione tre volte. Non è un difetto che si sa nominare
 * guardandolo — si sente come sciatteria generale, ed è esattamente ciò che
 * l'utente descriveva con «grafiche non ottimizzate».
 *
 * Tre cose vivono qui dentro e non vanno più ricordate altrove:
 *
 * - **la safe area**, che era gestita in 1 overlay su 19 (tutti gli altri
 *   finivano sotto la barra gestuale di iPhone);
 * - **l'altezza**, una sola, in due taglie dichiarate;
 * - **l'azione di chiusura**, sempre nello stesso posto e sempre da 44px.
 *
 * `footer` è separato dal corpo perché è la posizione fissa dell'azione
 * primaria: su un foglio che scorre, un pulsante in fondo al contenuto si
 * trova solo scrollando, e la fase 2 del piano si regge sul fatto che l'azione
 * di ogni passo stia **sempre nello stesso punto**.
 */

interface SheetProps {
  /** Titolo breve: è l'unica cosa che dice dove si è. */
  title: string;
  /** Riga sopra il titolo, in maiuscoletto: il contesto ("Mercato estivo"). */
  eyebrow?: string;
  /** Contenuto della testata a destra del titolo (un numero, un budget). */
  headerRight?: ReactNode;
  /** Barra fissa in fondo: l'azione primaria del passo. */
  footer?: ReactNode;
  /**
   * `tall` è il foglio da lavoro (mercato, rosa); `compact` è quello da
   * decisione (un imprevisto, una conferma), che non deve prendersi tutto lo
   * schermo per dire una cosa sola.
   */
  size?: "tall" | "compact";
  /** Assente = il foglio non si può chiudere: è un bivio, non una finestra. */
  onClose?: () => void;
  children: ReactNode;
}

export function Sheet({
  title,
  eyebrow,
  headerRight,
  footer,
  size = "tall",
  onClose,
  children,
}: SheetProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className={`relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--elev-sheet)] sm:rounded-[1.75rem] ${
          size === "tall" ? "h-[90svh]" : "max-h-[75svh]"
        }`}
      >
        {/* La maniglia dice "questo si trascina" senza scriverlo, ed è il
            segnale che su telefono ci si aspetta in cima a un foglio. */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-9 rounded-full bg-[var(--surface-border)]" />
        </div>

        <header className="flex items-center gap-3 border-b border-[var(--surface-border)] px-4 pb-3">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-micro text-[var(--accent)] uppercase">{eyebrow}</p>
            )}
            <h2 className="truncate text-title">{title}</h2>
          </div>

          {headerRight}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              className="flex h-tap w-tap shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
            >
              <X size={20} />
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">{children}</div>

        {footer && (
          <div className="border-t border-[var(--surface-border)] bg-[var(--surface)] px-4 pt-3 pb-safe-4">
            {footer}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
