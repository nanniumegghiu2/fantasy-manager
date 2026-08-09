import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  Banknote,
  Check,
  Coins,
  DollarSign,
  Flame,
  Hourglass,
  Plane,
  ShieldAlert,
  Sparkles,
  Star,
  Tag,
  Trophy,
  User,
  UserCheck,
  X,
} from "lucide-react";
import type { Department } from "@app/shared-types";
import { formatEuroAmount, relevantMoves, type PlayerPersonality, type PlayerStandoff, type StandoffMove } from "@app/game-engine";

const REPARTI: { department: Department; label: string }[] = [
  { department: "POR", label: "Portiere" },
  { department: "DIF", label: "Difesa" },
  { department: "CC", label: "Centrocampo" },
  { department: "ATT", label: "Attacco" },
];

const PERSONALITY_LABELS: Record<PlayerPersonality, { label: string; bg: string; text: string; icon: typeof Star }> = {
  leader: { label: "Leader / Senatore", bg: "bg-amber-500/20", text: "text-amber-400", icon: Award },
  giovane_ambizioso: { label: "Giovane Ambizioso", bg: "bg-cyan-500/20", text: "text-cyan-400", icon: Star },
  mercenario: { label: "Mercenario", bg: "bg-emerald-500/20", text: "text-emerald-400", icon: DollarSign },
  insofferente: { label: "Insofferente", bg: "bg-rose-500/20", text: "text-rose-400", icon: Flame },
  professionista: { label: "Professionista", bg: "bg-blue-500/20", text: "text-blue-400", icon: UserCheck },
};

interface PlayerStandoffChatProps {
  standoff: PlayerStandoff;
  onMove: (move: StandoffMove) => void;
  onClose: () => void;
  forced?: boolean;
}

export function PlayerStandoffChat({ standoff, onMove, onClose, forced }: PlayerStandoffChatProps) {
  const fondo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fondo.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [standoff.log.length]);

  const [scegliReparto, setScegliReparto] = useState(false);
  useEffect(() => {
    setScegliReparto(false);
  }, [standoff.round]);

  const chiusa = standoff.status !== "aperta";
  const mosse = new Set(relevantMoves(standoff.reason));

  const personalityInfo = standoff.personality ? PERSONALITY_LABELS[standoff.personality] : null;
  const PersonalityIcon = personalityInfo?.icon;

  const hasOfferCard = !!(standoff.offerDetails || standoff.offerFromClubName);
  const offerAmount = standoff.offerDetails?.amount ?? 0;
  const offerClub = standoff.offerDetails?.clubName ?? standoff.offerFromClubName ?? "Club offerente";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 330, damping: 32 }}
        className="flex h-[85svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] sm:h-[78svh] sm:rounded-3xl"
      >
        {/* Header con Profilo Calciatore e Personalità */}
        <header className="flex flex-col gap-2 border-b border-[var(--surface-border)] bg-[var(--surface-raised)]/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand)]/15 text-[var(--brand)] font-black text-base border border-[var(--brand)]/30">
                {standoff.overall ?? "75"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 truncate">
                  <p className="truncate text-base font-extrabold leading-tight">{standoff.playerName}</p>
                </div>
                <p className="truncate text-xs text-[var(--text-secondary)]">
                  {standoff.reason === "vuole_giocare"
                    ? "Rivendica più spazio in campo"
                    : standoff.reason === "richiamato"
                      ? `Corteggiato dal ${offerClub}`
                      : standoff.reason === "tradito"
                        ? "Fiducia tradita da una promessa"
                        : standoff.reason === "bivio_mister"
                          ? "Ultimatum sul mister"
                          : "Malcontento societario"}
                </p>
              </div>
            </div>
            {(!forced || chiusa) && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Chiudi"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Badge Personalità se disponibile */}
          {personalityInfo && PersonalityIcon && (
            <div className="flex items-center gap-2 pt-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ${personalityInfo.bg} ${personalityInfo.text}`}
              >
                <PersonalityIcon size={12} />
                {personalityInfo.label}
              </span>
            </div>
          )}
        </header>

        {/* Barra della Tensione / Pazienza */}
        <div className="flex items-center gap-2 border-b border-[var(--surface-border)] bg-black/20 px-4 py-2">
          <span className="text-[10px] font-extrabold tracking-wider text-[var(--text-secondary)] uppercase">
            Tensione
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-raised)]">
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
          <span className="text-[11px] font-mono font-bold text-[var(--text-secondary)]">
            {standoff.patience}%
          </span>
        </div>

        {/* Area Messaggi Chat + Card Offerta */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {/* Card dell'Offerta Ricevuta se presente */}
          {hasOfferCard && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-emerald-900/20 to-black p-3.5 shadow-lg"
            >
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                  <Banknote size={14} /> Offerta Ufficiale Ricevuta
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px]">
                  {standoff.offerDetails?.kind === "prestito" ? "Prestito" : "Trasferimento"}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Club richiedente</p>
                  <p className="text-sm font-black text-white">{offerClub}</p>
                </div>
                {offerAmount > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-[var(--text-secondary)]">Cifra Offerta</p>
                    <p className="text-base font-black text-emerald-400">{formatEuroAmount(offerAmount)}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

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
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                    messaggio.speaker === "ds"
                      ? "rounded-br-md bg-[var(--brand)] text-[var(--brand-contrast)] font-medium"
                      : "rounded-bl-md bg-[var(--surface-raised)] border border-[var(--surface-border)] text-white"
                  }`}
                >
                  {messaggio.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={fondo} />
        </div>

        {/* Footer con Mosse Gestionali */}
        <footer className="border-t border-[var(--surface-border)] bg-[var(--surface-raised)]/30 p-3">
          {chiusa ? (
            <div className="flex flex-col gap-2">
              <p
                className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold"
                style={{
                  backgroundColor: standoff.status === "placata" ? "#3ddc6b22" : "#ff4d4d22",
                  color: standoff.status === "placata" ? "#2a9b4d" : "#ff4d4d",
                }}
              >
                {standoff.status === "placata" ? <Check size={16} /> : <ShieldAlert size={16} />}
                {standoff.status === "placata" ? "Trattativa conclusa con successo" : "Rapporto rotto con il calciatore"}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl bg-[var(--brand)] py-3 text-sm font-extrabold text-[var(--brand-contrast)] active:scale-98 transition-transform"
              >
                Torna alla Rosa
              </button>
            </div>
          ) : scegliReparto ? (
            <div className="flex flex-col gap-2">
              <p className="px-1 text-[11px] font-bold text-[var(--text-secondary)]">
                In quale reparto prometti di acquistare un rinforzo?
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
                Scelta drastica di spogliatoio: chi deve restare nel club?
              </p>
              <button
                type="button"
                onClick={() => onMove({ kind: "scegli_giocatore" })}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-500 px-3 py-3 text-xs font-extrabold text-white transition-transform active:scale-95"
              >
                <User size={14} /> Scegli il Giocatore — Il Mister si dimette
              </button>
              <button
                type="button"
                onClick={() => onMove({ kind: "scegli_mister" })}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-rose-500/50 px-3 py-3 text-xs font-extrabold text-rose-400 transition-transform active:scale-95"
              >
                <ShieldAlert size={14} /> Scegli il Mister — Il Calciatore rompe
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {mosse.has("rassicura") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "rassicura" })}
                    className="flex flex-col items-center justify-center rounded-2xl border border-[var(--accent)]/50 px-3 py-2 text-xs font-bold text-[var(--accent)] transition-transform active:scale-95"
                  >
                    <span>Rassicuralo</span>
                  </button>
                )}
                {mosse.has("prometti_spazio") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "prometti_spazio" })}
                    className="flex flex-col items-center justify-center rounded-2xl bg-[var(--brand)] px-3 py-2 text-xs font-bold text-[var(--brand-contrast)] transition-transform active:scale-95"
                  >
                    <span className="flex items-center gap-1">
                      <Hourglass size={12} /> Prometti Spazio
                    </span>
                    <span className="text-[9px] opacity-80 font-normal">Soggetto ad OK Mister</span>
                  </button>
                )}
                {mosse.has("premio_denaro") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "premio_denaro" })}
                    className="flex flex-col items-center justify-center rounded-2xl border border-amber-500/50 px-3 py-2 text-xs font-bold text-amber-400 transition-transform active:scale-95"
                  >
                    <span className="flex items-center gap-1">
                      <Coins size={12} /> Premio in Denaro
                    </span>
                    <span className="text-[9px] text-amber-300/80 font-normal">Scala dal Budget</span>
                  </button>
                )}
                {mosse.has("promessa_rinforzi") && (
                  <button
                    type="button"
                    onClick={() => setScegliReparto(true)}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--brand)]/50 px-3 py-2.5 text-xs font-bold text-[var(--brand)] transition-transform active:scale-95"
                  >
                    <Sparkles size={13} /> Promessa: Rinforzo
                  </button>
                )}
                {mosse.has("promessa_trionfo") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "promessa_trionfo" })}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-violet-500/50 px-3 py-2.5 text-xs font-bold text-violet-400 transition-transform active:scale-95"
                  >
                    <Trophy size={13} /> Promessa: Trionfo
                  </button>
                )}
                {mosse.has("multa_disciplina") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "multa_disciplina" })}
                    className="flex flex-col items-center justify-center rounded-2xl border border-rose-500/50 px-3 py-2 text-xs font-bold text-rose-400 transition-transform active:scale-95"
                  >
                    <span className="flex items-center gap-1">
                      <AlertTriangle size={12} /> Multa Disciplinare
                    </span>
                    <span className="text-[9px] text-rose-300/80 font-normal">Morale -25</span>
                  </button>
                )}
                {mosse.has("lista_cessione") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "lista_cessione" })}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#ff8a3d]/50 px-3 py-2.5 text-xs font-bold text-[#ff8a3d] transition-transform active:scale-95"
                  >
                    <Tag size={13} /> Lista Trasferimenti
                  </button>
                )}
                {mosse.has("concedi_prestito") && (
                  <button
                    type="button"
                    onClick={() => onMove({ kind: "concedi_prestito" })}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#5aa9e6]/50 px-3 py-2.5 text-xs font-bold text-[#5aa9e6] transition-transform active:scale-95"
                  >
                    <Plane size={13} /> Concedi Prestito
                  </button>
                )}
              </div>

              {mosse.has("accetta_cessione") && (standoff.offerFromClubId || standoff.offerDetails) && (
                <button
                  type="button"
                  onClick={() => onMove({ kind: "accetta_cessione" })}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 py-3 text-xs font-black text-white transition-transform active:scale-95 shadow-md hover:bg-emerald-500"
                >
                  <Banknote size={15} /> Accetta Offerta {offerAmount > 0 ? `da ${formatEuroAmount(offerAmount)}` : ""}
                </button>
              )}
            </div>
          )}

          {!chiusa && !scegliReparto && (
            <button
              type="button"
              onClick={() => onMove({ kind: "ignora" })}
              className="mt-2 w-full rounded-2xl border border-[var(--surface-border)] px-3 py-2 text-[11px] font-bold text-[var(--text-secondary)] hover:text-white"
            >
              Ignoralo
            </button>
          )}
        </footer>
      </motion.div>
    </motion.div>
  );
}
