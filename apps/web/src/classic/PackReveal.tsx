import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";

interface PackRevealProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  subtitle: string;
}

/**
 * "Busta" che si apre per rivelare i 5 elementi tra cui scegliere (club o giocatori,
 * sez. CLAUDE.md 3.2) — un tocco per aprire, poi le card entrano a ventaglio con uno
 * scatto elastico in sequenza. Il chiamante deve cambiare la `key` con cui monta questo
 * componente ad ogni nuovo pacchetto, così riparte sempre chiuso.
 */
export function PackReveal<T>({ items, getKey, renderItem, subtitle }: PackRevealProps<T>) {
  const [opened, setOpened] = useState(false);

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-raised)] p-6 text-center text-sm text-[var(--text-secondary)]">
        Nessuna scelta disponibile al momento.
      </div>
    );
  }

  return (
    // `m-auto` sul contenuto invece di `justify-center` sul contenitore: con
    // `justify-center` su un'area scrollabile, quando le 5 card non ci stanno (schermo
    // stretto) le prime finiscono sopra il bordo superiore e diventano irraggiungibili.
    <div className="flex h-full flex-col items-center overflow-y-auto rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4">
      <AnimatePresence mode="wait" initial={false}>
        {!opened ? (
          <motion.button
            key="closed"
            type="button"
            onClick={() => setOpened(true)}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: [1, 1.045, 1], opacity: 1, rotate: [0, -1.5, 1.5, 0] }}
            exit={{ scale: 1.4, opacity: 0, transition: { duration: 0.25 } }}
            transition={{
              opacity: { duration: 0.25 },
              scale: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
              rotate: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
            }}
            whileTap={{ scale: 0.92 }}
            // Colori fissi invece delle variabili di tema: la busta è l'elemento più
            // "da gioco" della schermata e in tema scuro il brand desaturato la rendeva
            // un rettangolo grigio.
            className="relative m-auto flex w-full max-w-sm flex-col items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-pitch-400 via-copper-400 to-copper-500 px-10 py-14 text-white shadow-2xl ring-2 ring-white/25"
          >
            {/* Riflesso che scorre sulla busta, come il luccichio di una carta. */}
            <motion.span
              aria-hidden
              animate={{ x: ["-120%", "220%"] }}
              transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut", repeatDelay: 0.6 }}
              className="absolute inset-y-0 w-1/3 -skew-x-12 bg-white/20 blur-md"
            />
            <motion.span
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5c518]/25 text-[#ffe082] ring-1 ring-white/30"
            >
              <Sparkles size={32} />
            </motion.span>
            <span className="relative text-xl font-extrabold">Apri il pacchetto</span>
            <span className="relative text-xs opacity-90">{subtitle}</span>
          </motion.button>
        ) : (
          <motion.div
            key="opened"
            className="m-auto grid w-full grid-cols-1 gap-2 sm:grid-cols-2"
            initial="hidden"
            animate="show"
          >
            {items.map((item, index) => (
              <motion.div
                key={getKey(item)}
                variants={{
                  hidden: { opacity: 0, scale: 0.4, y: 24, rotate: index % 2 === 0 ? -8 : 8 },
                  show: {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    rotate: 0,
                    transition: { delay: index * 0.09, type: "spring", stiffness: 260, damping: 18 },
                  },
                }}
                initial="hidden"
                animate="show"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.94 }}
              >
                {renderItem(item)}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
