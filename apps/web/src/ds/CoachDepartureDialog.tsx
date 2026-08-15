import { motion } from "framer-motion";
import { UserX } from "lucide-react";

/**
 * **Anche il nostro mister può essere corteggiato via**, se la sintonia è scesa troppo e non lo
 * si convince a restare al rinnovo di stagione (`career.ts`, `maybePoachOurCoach`). Stesso
 * trattamento delle altre notizie da leggere e chiudere (`IncidentDialog`): non è una
 * decisione, la panchina è già persa — la decisione vera è la prossima, scegliere chi ingaggiare.
 */
export function CoachDepartureDialog({
  coachName,
  clubName,
  onClose,
}: {
  coachName: string;
  clubName: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 26 }}
        className="w-full max-w-sm overflow-hidden rounded-card border border-[var(--surface-border)] bg-[var(--surface)]"
      >
        <div className="flex flex-col items-center gap-2 px-6 py-6 text-center" style={{ backgroundColor: "#ff4d4d18" }}>
          <motion.span
            initial={{ scale: 0.4, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 16, delay: 0.1 }}
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "#ff4d4d28", color: "#ff4d4d" }}
          >
            <UserX size={26} />
          </motion.span>
          <p className="text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            Panchina persa
          </p>
          <h2 className="text-title leading-tight font-extrabold" style={{ color: "#ff4d4d" }}>
            Il mister se n'è andato
          </h2>
        </div>

        <p className="px-6 py-5 text-center text-body leading-relaxed">
          Il rapporto con {coachName} si era rotto: il {clubName} lo ha convinto a firmare per loro.
          Serve un nuovo allenatore prima di riaprire il mercato.
        </p>

        <div className="p-4 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-card bg-[var(--brand)] py-3.5 text-body font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-[0.98]"
          >
            Cerchiamo un sostituto
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
