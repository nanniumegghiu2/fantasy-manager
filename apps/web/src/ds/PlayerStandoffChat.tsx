import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Check, Coins, Hourglass, Plane, ShieldAlert, Sparkles, Tag, Trophy, User, X } from "lucide-react";
import type { Department } from "@app/shared-types";
import { relevantMoves, type PlayerStandoff, type StandoffMove } from "@app/game-engine";

/**
 * **Il faccia a faccia col giocatore, come una vera trattativa.**
 *
 * Stessa tensione di `NegotiationChat.tsx` (le trattative di mercato): una barra di pazienza
 * che si consuma, non un prezzo ma il rapporto col giocatore. Rassicurarlo, promettergli
 * spazio o accontentarlo la chiude bene; ignorarlo lo esaurisce — e quando la pazienza finisce
 * così, il morale crolla per davvero, non solo sulla carta.
 *
 * Oltre alle parole, tre motivazioni vere: un premio in denaro (subito, nessun rischio), la
 * promessa di un rinforzo in un reparto o di una stagione da protagonisti (entrambe verificate
 * a fine mercato — se infrante, il morale crolla e la fiducia si rompe per davvero).
 */

const REPARTI: { department: Department; label: string }[] = [
  { department: "POR", label: "Portiere" },
  { department: "DIF", label: "Difesa" },
  { department: "CC", label: "Centrocampo" },
  { department: "ATT", label: "Attacco" },
];

interface PlayerStandoffChatProps {
  standoff: PlayerStandoff;
  onMove: (move: StandoffMove) => void;
  onClose: () => void;
  /**
   * Vero per le richieste di cessione forzate (ex popup a 4 bottoni): la settimana resta
   * bloccata finché la conversazione non si risolve, quindi finché è `"aperta"` non c'è modo
   * di chiuderla a mano — niente X in alto, niente scorciatoia per rimandare la decisione.
   */
  forced?: boolean;
}

export function PlayerStandoffChat({ standoff, onMove, onClose, forced }: PlayerStandoffChatProps) {
  const fondo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fondo.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [standoff.log.length]);

  // Scegliere "promessa rinforzi" apre prima un secondo passo (quale reparto), non spara subito
  // la mossa: senza il reparto la promessa non avrebbe nulla da verificare a fine mercato.
  const [scegliReparto, setScegliReparto] = useState(false);
  useEffect(() => {
    setScegliReparto(false);
  }, [standoff.round]);

  const chiusa = standoff.status !== "aperta";
  // Solo le mosse pertinenti al motivo reale: proporre un premio in denaro a chi vuole solo
  // più minuti, o una nuova promessa a chi si sente già tradito, sarebbe una risposta a caso.
  const mosse = new Set(relevantMoves(standoff.reason));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 330, damping: 32 }}
        className="flex h-[80svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] sm:h-[72svh] sm:rounded-3xl"
      >
        <header className="flex items-center gap-3 border-b border-[var(--surface-border)] px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-raised)] text-[var(--text-secondary)]">
            <User size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight font-extrabold">{standoff.playerName}</p>
            <p className="truncate text-[11px] text-[var(--text-secondary)]">
              {standoff.reason === "vuole_giocare"
                ? "Vuole più spazio"
                : standoff.reason === "richiamato"
                  ? "Lo cerca un'altra squadra"
                  : standoff.reason === "tradito"
                    ? "Si sente tradito da una promessa infranta"
                    : standoff.reason === "bivio_mister"
                      ? "Chiede di scegliere fra lui e il mister"
                      : "È scontento"}
              {standoff.offerFromClubName ? ` · offerta dal ${standoff.offerFromClubName}` : ""}
            </p>
          </div>
          {(!forced || chiusa) && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)]"
          >
            <X size={15} />
          </button>
          )}
        </header>

        {/* Pazienza: quanto ancora regge la conversazione prima di rompersi o chiudersi bene. */}
        <div className="flex items-center gap-2 border-b border-[var(--surface-border)] px-4 py-2">
          <span className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            Pazienza
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-raised)]">
            <motion.span
              className="block h-full rounded-full"
              animate={{
                width: `${standoff.patience}%`,
                backgroundColor:
                  standoff.patience > 55 ? "#3ddc6b" : standoff.patience > 25 ? "#ffab2e" : "#ff4d4d",
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          <AnimatePresence initial={false}>
            {standoff.log.map((messaggio, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className={`flex ${messaggio.speaker === "ds" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    messaggio.speaker === "ds"
                      ? "rounded-br-md bg-[var(--brand)] text-[var(--brand-contrast)]"
                      : "rounded-bl-md bg-[var(--surface-raised)]"
                  }`}
                >
                  {messaggio.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={fondo} />
        </div>

        <footer className="border-t border-[var(--surface-border)] p-3">
          {chiusa ? (
            <div className="flex flex-col gap-2">
              <p
                className="flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-extrabold"
                style={{
                  backgroundColor: standoff.status === "placata" ? "#3ddc6b22" : "#ff4d4d22",
                  color: standoff.status === "placata" ? "#2a9b4d" : "#ff4d4d",
                }}
              >
                {standoff.status === "placata" ? <Check size={16} /> : <ShieldAlert size={16} />}
                {standoff.status === "placata" ? "Riappacificati" : "Rapporto rotto"}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl bg-[var(--brand)] py-3 text-sm font-extrabold text-[var(--brand-contrast)]"
              >
                Torna alla rosa
              </button>
            </div>
          ) : scegliReparto ? (
            <div className="flex flex-col gap-2">
              <p className="px-1 text-[11px] font-bold text-[var(--text-secondary)]">
                In quale reparto prometti il rinforzo?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {REPARTI.map((r) => (
                  <button
                    key={r.department}
                    type="button"
                    onClick={() => {
                      setScegliReparto(false);
                      onMove({ kind: "promessa_rinforzi", department: r.department });
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-[var(--brand)] px-3 py-2.5 text-xs font-bold text-[var(--brand-contrast)] transition-transform active:scale-95"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setScegliReparto(false)}
                className="w-full rounded-2xl border border-[var(--surface-border)] px-3 py-2 text-[11px] font-bold text-[var(--text-secondary)]"
              >
                Annulla
              </button>
            </div>
          ) : standoff.reason === "bivio_mister" ? (
            <div className="flex flex-col gap-2">
              <p className="px-1 text-[11px] font-bold text-[var(--text-secondary)]">
                Una scelta netta: chi resta, il giocatore o il mister?
              </p>
              <button
                type="button"
                onClick={() => onMove({ kind: "scegli_giocatore" })}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-500 px-3 py-3 text-xs font-extrabold text-white transition-transform active:scale-95"
              >
                <User size={14} /> Scegli il giocatore — il mister lascia
              </button>
              <button
                type="button"
                onClick={() => onMove({ kind: "scegli_mister" })}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-[#ff4d4d]/50 px-3 py-3 text-xs font-extrabold text-[#ff4d4d] transition-transform active:scale-95"
              >
                <ShieldAlert size={14} /> Scegli il mister — il giocatore si rompe
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {mosse.has("rassicura") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "rassicura" })}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--accent)]/50 px-3 py-2.5 text-xs font-bold text-[var(--accent)] transition-transform active:scale-95"
                  >
                    Rassicuralo
                  </button>
                )}
                {mosse.has("prometti_spazio") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "prometti_spazio" })}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-[var(--brand)] px-3 py-2.5 text-xs font-bold text-[var(--brand-contrast)] transition-transform active:scale-95"
                  >
                    <Hourglass size={13} /> Promettigli spazio
                  </button>
                )}
                {mosse.has("premio_denaro") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "premio_denaro" })}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-amber-500/50 px-3 py-2.5 text-xs font-bold text-amber-400 transition-transform active:scale-95"
                  >
                    <Coins size={13} /> Premio in denaro
                  </button>
                )}
                {mosse.has("promessa_rinforzi") && (
                  <button
                    type="button"
                    onClick={() => setScegliReparto(true)}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--brand)]/50 px-3 py-2.5 text-xs font-bold text-[var(--brand)] transition-transform active:scale-95"
                  >
                    <Sparkles size={13} /> Promessa: rinforzo
                  </button>
                )}
                {mosse.has("promessa_trionfo") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "promessa_trionfo" })}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-violet-500/50 px-3 py-2.5 text-xs font-bold text-violet-400 transition-transform active:scale-95"
                  >
                    <Trophy size={13} /> Promessa: trionfo
                  </button>
                )}
                {mosse.has("lista_cessione") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "lista_cessione" })}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#ff8a3d]/50 px-3 py-2.5 text-xs font-bold text-[#ff8a3d] transition-transform active:scale-95"
                  >
                    <Tag size={13} /> Lista trasferimenti
                  </button>
                )}
                {mosse.has("concedi_prestito") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "concedi_prestito" })}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#5aa9e6]/50 px-3 py-2.5 text-xs font-bold text-[#5aa9e6] transition-transform active:scale-95"
                  >
                    <Plane size={13} /> Concedi il prestito
                  </button>
                )}
              </div>
              {mosse.has("accetta_cessione") && standoff.offerFromClubId && (
                <button
                  type="button"
                  onClick={() => onMove({ kind: "accetta_cessione" })}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-emerald-500/50 px-3 py-2.5 text-xs font-bold text-emerald-400 transition-transform active:scale-95"
                >
                  <Banknote size={13} /> Accetta l'offerta
                </button>
              )}
            </div>
          )}
          {!chiusa && !scegliReparto && (
            <button
              type="button"
              onClick={() => onMove({ kind: "ignora" })}
              className="mt-2 w-full rounded-2xl border border-[var(--surface-border)] px-3 py-2 text-[11px] font-bold text-[var(--text-secondary)]"
            >
              Ignoralo
            </button>
          )}
        </footer>
      </motion.div>
    </motion.div>
  );
}
