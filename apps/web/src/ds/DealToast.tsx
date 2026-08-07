import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Plane, TriangleAlert } from "lucide-react";
import { euro } from "./format";

/**
 * La conferma di un'operazione di mercato.
 *
 * Un'operazione da dieci milioni non può risolversi in una riga di testo che scorre via: è la
 * decisione più importante che l'utente prende in tutta la modalità, e deve **avere un momento
 * suo**. Da qui la molla in entrata, la cifra grande e il segno — verde in entrata, arancione
 * in uscita — che dice a colpo d'occhio se il budget è salito o sceso.
 *
 * Vive sopra il pannello di mercato e sparisce da solo: non è una decisione, è un riscontro.
 */

export type DealKind = "acquisto" | "cessione" | "prestito" | "errore";

export interface Deal {
  /** Cambia a ogni operazione: è ciò che fa ripartire l'animazione. */
  id: number;
  kind: DealKind;
  message: string;
  /** Variazione di budget, con segno. Assente per le operazioni che non lo toccano. */
  delta?: number;
}

const STILE: Record<DealKind, { colore: string; icona: typeof ArrowUpRight; titolo: string }> = {
  acquisto: { colore: "#3ddc6b", icona: ArrowDownLeft, titolo: "Acquisto concluso" },
  cessione: { colore: "#ff8a3d", icona: ArrowUpRight, titolo: "Cessione conclusa" },
  prestito: { colore: "#5aa9e6", icona: Plane, titolo: "Prestito concluso" },
  errore: { colore: "#ff4d4d", icona: TriangleAlert, titolo: "Operazione non riuscita" },
};

export function DealToast({ deal }: { deal: Deal | null }) {
  return (
    <AnimatePresence>
      {deal && (
        <motion.div
          key={deal.id}
          initial={{ y: -28, opacity: 0, scale: 0.94 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -16, opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="pointer-events-none absolute inset-x-3 top-3 z-10"
        >
          <div
            className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 shadow-lg backdrop-blur"
            style={{
              borderColor: `${STILE[deal.kind].colore}66`,
              backgroundColor: "var(--surface-raised)",
            }}
          >
            <motion.span
              initial={{ scale: 0.4, rotate: -14 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 460, damping: 16, delay: 0.06 }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: `${STILE[deal.kind].colore}22`,
                color: STILE[deal.kind].colore,
              }}
            >
              {(() => {
                const Icona = STILE[deal.kind].icona;
                return <Icona size={17} />;
              })()}
            </motion.span>

            <div className="min-w-0 flex-1">
              <p
                className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: STILE[deal.kind].colore }}
              >
                {STILE[deal.kind].titolo}
              </p>
              <p className="truncate text-[13px] leading-tight font-semibold">{deal.message}</p>
            </div>

            {deal.delta !== undefined && deal.delta !== 0 && (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.14 }}
                className="shrink-0 text-sm font-extrabold tabular-nums"
                style={{ color: deal.delta > 0 ? "#3ddc6b" : "#ff8a3d" }}
              >
                {deal.delta > 0 ? "+" : "−"}
                {euro(Math.abs(deal.delta))}
              </motion.span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Che tipo di operazione è stata, dal messaggio del motore. */
export function dealKindOf(action: string, rejected: boolean | undefined): DealKind {
  if (rejected) return "errore";
  if (action === "acquista" || action === "compra") return "acquisto";
  if (action === "chiedi_prestito" || action === "manda_in_prestito") return "prestito";
  if (action === "accetta_offerta" || action === "controproposta" || action === "vendi_subito") {
    return "cessione";
  }
  return "acquisto";
}
