import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Flag,
  Gavel,
  HeartCrack,
  Landmark,
  Newspaper,
  MessageSquareWarning,
  PiggyBank,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { Incident, IncidentKind } from "@app/game-engine";

/**
 * **L'imprevisto**, annunciato come una notizia.
 *
 * Una carriera fatta solo di mercato e risultati diventa prevedibile; questi popup sono ciò che
 * rompe la routine. La maggior parte è deliberatamente **da leggere e chiudere**, non da
 * decidere: una decisione in più a ogni infortunio renderebbe il gioco lento invece che
 * imprevedibile — le decisioni sono il mercato e le richieste dei giocatori.
 *
 * Due imprevisti fanno eccezione (`incident.requiresDecision`): una notizia di colore
 * (`nottata_brava`) o un'intervista contro lo spogliatoio (`intervista_contro`) chiedono davvero
 * una scelta al DS — ignorare (costa un po' di sintonia col mister, che non gradisce la mano
 * leggera) o punire con qualche giorno di stop (costa morale al giocatore, di più quanto più
 * lunga è la punizione).
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
  nottata_brava: { colore: "#ff8a3d", icona: Newspaper },
  intervista_contro: { colore: "#ff8a3d", icona: MessageSquareWarning },
  rottura_tra_giocatori: { colore: "#c0392b", icona: Users },
  cambio_proprieta: { colore: "#5aa9e6", icona: Landmark },
};

const GIORNI_PUNIZIONE = [1, 2, 3, 4];

export function IncidentDialog({
  incident,
  nomePrimo,
  nomeSecondo,
  onClose,
  onDecide,
}: {
  incident: Incident;
  /** I due protagonisti di una rottura, per nome: senza, la scelta sarebbe fra due anonimi. */
  nomePrimo?: string;
  nomeSecondo?: string;
  onClose: () => void;
  /**
   * Solo per `incident.requiresDecision`: chiamato con la scelta del DS ("ignora" o
   * "punizione", con i giorni scelti) — l'effetto vero si applica lì (`resolveIncidentDecision`),
   * non da questo componente.
   */
  onDecide?: (scelta: "ignora" | "punizione" | "tieni_primo" | "tieni_secondo", giorni?: number) => void;
}) {
  const { colore, icona: Icona } = STILE[incident.kind];
  const [sceltaPunizione, setSceltaPunizione] = useState(false);

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
          <p className="text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            Dallo spogliatoio
          </p>
          <h2 className="text-title leading-tight font-extrabold" style={{ color: colore }}>
            {incident.title}
          </h2>
        </div>

        <p className="px-6 py-5 text-center text-body leading-relaxed">{incident.message}</p>

        {incident.budgetDelta !== undefined && incident.budgetDelta !== 0 && (
          <p
            className="mx-6 mb-5 rounded-card px-3 py-2 text-center text-body font-extrabold tabular-nums"
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
          {incident.kind === "rottura_tra_giocatori" && incident.secondPlayerId ? (
            /**
             * **Chi tenere.** Non c e un opzione indolore: chi resta si sente sostenuto, chi e
             * scaricato finisce in lista trasferimenti col morale a terra. E il gruppo paga
             * comunque un po di veleno — una rissa non si chiude senza lasciare traccia.
             */
            <div className="flex flex-col gap-2">
              <p className="px-1 text-label font-bold text-[var(--text-secondary)]">
                Chi tieni? L altro finisce sul mercato.
              </p>
              <button
                type="button"
                onClick={() => { onDecide?.("tieni_primo"); onClose(); }}
                className="min-h-12 w-full rounded-card border border-[var(--brand)]/50 bg-[var(--brand)]/10 text-body font-extrabold text-[var(--brand)] transition-transform active:scale-[0.98]"
              >
                Tengo {nomePrimo ?? "il primo"}
              </button>
              <button
                type="button"
                onClick={() => { onDecide?.("tieni_secondo"); onClose(); }}
                className="min-h-12 w-full rounded-card border border-[var(--brand)]/50 bg-[var(--brand)]/10 text-body font-extrabold text-[var(--brand)] transition-transform active:scale-[0.98]"
              >
                Tengo {nomeSecondo ?? "il secondo"}
              </button>
            </div>
          ) : !incident.requiresDecision ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-card bg-[var(--brand)] py-3.5 text-body font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-[0.98]"
            >
              Ho capito
            </button>
          ) : sceltaPunizione ? (
            <div className="flex flex-col gap-2">
              <p className="px-1 text-label font-bold text-[var(--text-secondary)]">
                Per quanti giorni lo fermi?
              </p>
              <div className="grid grid-cols-4 gap-2">
                {GIORNI_PUNIZIONE.map((giorni) => (
                  <button
                    key={giorni}
                    type="button"
                    onClick={() => {
                      onDecide?.("punizione", giorni);
                      onClose();
                    }}
                    className="rounded-card border border-[#ff8a3d]/50 py-2.5 text-body font-extrabold text-[#ff8a3d] transition-transform active:scale-95"
                  >
                    {giorni}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSceltaPunizione(false)}
                className="w-full rounded-card border border-[var(--surface-border)] px-3 py-2 text-label font-bold text-[var(--text-secondary)]"
              >
                Annulla
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onDecide?.("ignora");
                  onClose();
                }}
                className="w-full rounded-card border border-[var(--surface-border)] py-3 text-body font-extrabold text-[var(--text-secondary)] transition-transform active:scale-[0.98]"
              >
                Non fare nulla
              </button>
              <button
                type="button"
                onClick={() => setSceltaPunizione(true)}
                className="w-full rounded-card bg-[#ff8a3d] py-3 text-body font-extrabold text-white transition-transform active:scale-[0.98]"
              >
                Punizione
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
