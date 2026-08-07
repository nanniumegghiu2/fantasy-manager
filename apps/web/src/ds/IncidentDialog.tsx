import { motion } from "framer-motion";
import { Activity, Flag, Gavel, HeartCrack, Landmark, PiggyBank, ShieldAlert, Users } from "lucide-react";
import type { Incident, IncidentKind } from "@app/game-engine";

/**
 * **L'imprevisto**, annunciato come una notizia.
 *
 * Una carriera fatta solo di mercato e risultati diventa prevedibile; questi popup sono ciò che
 * rompe la routine. Sono deliberatamente **da leggere e chiudere**, non da decidere: una
 * decisione in più a ogni infortunio renderebbe il gioco lento invece che imprevedibile — le
 * decisioni sono il mercato e le richieste dei giocatori.
 */

const STILE: Record<IncidentKind, { colore: string; icona: typeof Activity }> = {
  infortunio_lungo: { colore: "#ff4d4d", icona: Activity },
  infortunio_gravissimo: { colore: "#c0392b", icona: HeartCrack },
  squalifica_doping: { colore: "#c0392b", icona: ShieldAlert },
  condotta_antisportiva: { colore: "#ff8a3d", icona: Gavel },
  rissa_spogliatoio: { colore: "#ff8a3d", icona: Users },
  convocazione_nazionale: { colore: "#3ddc6b", icona: Flag },
  sanzione_federale: { colore: "#ff8a3d", icona: Landmark },
  premio_presidente: { colore: "#3ddc6b", icona: PiggyBank },
};

export function IncidentDialog({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const { colore, icona: Icona } = STILE[incident.kind];

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
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)]"
      >
        <div
          className="flex flex-col items-center gap-2 px-6 py-6 text-center"
          style={{ backgroundColor: `${colore}18` }}
        >
          <motion.span
            initial={{ scale: 0.4, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 16, delay: 0.1 }}
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: `${colore}28`, color: colore }}
          >
            <Icona size={26} />
          </motion.span>
          <p className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            Dallo spogliatoio
          </p>
          <h2 className="text-xl leading-tight font-extrabold" style={{ color: colore }}>
            {incident.title}
          </h2>
        </div>

        <p className="px-6 py-5 text-center text-sm leading-relaxed">{incident.message}</p>

        {incident.budgetDelta !== undefined && incident.budgetDelta !== 0 && (
          <p
            className="mx-6 mb-5 rounded-2xl px-3 py-2 text-center text-sm font-extrabold tabular-nums"
            style={{
              backgroundColor: incident.budgetDelta > 0 ? "#3ddc6b18" : "#ff4d4d18",
              color: incident.budgetDelta > 0 ? "#2a9b4d" : "#ff4d4d",
            }}
          >
            {incident.budgetDelta > 0 ? "+" : ""}
            {incident.budgetDelta.toLocaleString("it-IT")}€ di budget
          </p>
        )}

        <div className="p-4 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-[var(--brand)] py-3.5 text-sm font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-[0.98]"
          >
            Ho capito
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
