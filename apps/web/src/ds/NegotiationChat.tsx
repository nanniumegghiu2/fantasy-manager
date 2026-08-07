import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Check, HandCoins, Hourglass, SlidersHorizontal, X, Zap } from "lucide-react";
import {
  endingLabel,
  suggestedMoves,
  type Negotiation,
  type NegotiationMove,
} from "@app/game-engine";
import { euro } from "./format";

/**
 * **La trattativa, come una conversazione.**
 *
 * Comprare premendo un pulsante è un'operazione contabile; qui si tratta con qualcuno. Le
 * scelte principali sono preimpostate — non serve inventare una cifra al buio per ogni mossa —
 * e ogni rilancio consuma la **pazienza** dell'interlocutore, che è la risorsa vera: si può
 * strappare qualche milione, ma tirando troppo la corda la trattativa si arena e il giocatore
 * non si muove. Una cifra **personalizzata** resta comunque disponibile (dietro "Personalizza",
 * non in prima vista): stessa mossa `rilancia` dei bottoni preimpostati, stesso costo in
 * pazienza — solo la cifra la sceglie l'utente invece del passo calcolato dal motore.
 *
 * La barra della pazienza è l'unico aiuto visivo: il limite oltre cui l'altro non va resta
 * nascosto, perché indovinarlo dalle risposte è il gioco.
 */

interface NegotiationChatProps {
  negotiation: Negotiation;
  budget: number;
  onMove: (move: NegotiationMove) => void;
  onClose: () => void;
}

/**
 * Un prestito non ha un prezzo, ha **minuti garantiti**: la stessa cifra interna letta come
 * "N partite" invece che in euro. Tutti i punti che mostrano `negotiation.amount` (o l'importo di
 * un messaggio) passano da qui, così l'unità è sempre coerente col tipo di trattativa.
 */
function formattaCifra(kind: Negotiation["kind"], value: number): string {
  if (kind === "prestito") {
    const partite = Math.round(value / 90);
    return `${partite} ${partite === 1 ? "partita" : "partite"}`;
  }
  return euro(value);
}

/**
 * Gli incrementi rapidi della cifra personalizzata: 0,5M/1M/5M per un trasferimento, l'unità
 * equivalente in partite per un prestito (minuti garantiti, non un prezzo — sez. `formattaCifra`).
 */
function passiIncremento(kind: Negotiation["kind"]): number[] {
  return kind === "prestito" ? [90, 90 * 3, 90 * 5] : [500_000, 1_000_000, 5_000_000];
}

function etichettaPasso(kind: Negotiation["kind"], passo: number): string {
  if (kind === "prestito") return `${Math.round(passo / 90)} p.`;
  return passo >= 1_000_000 ? `${passo / 1_000_000}M` : `${passo / 1000}k`;
}

export function NegotiationChat({ negotiation, budget, onMove, onClose }: NegotiationChatProps) {
  const fondo = useRef<HTMLDivElement>(null);
  const [scrive, setScrive] = useState(false);
  const messaggiVisti = useRef(negotiation.log.length);
  const [personalizza, setPersonalizza] = useState(false);
  const [cifra, setCifra] = useState(negotiation.amount);

  // Quando arriva una risposta, prima si vede "sta scrivendo": è ciò che fa sembrare una
  // conversazione invece di una tabella che si aggiorna.
  useEffect(() => {
    if (negotiation.log.length > messaggiVisti.current) {
      const ultimo = negotiation.log[negotiation.log.length - 1];
      messaggiVisti.current = negotiation.log.length;
      if (ultimo?.speaker === "loro") {
        setScrive(true);
        const timer = setTimeout(() => setScrive(false), 520);
        return () => clearTimeout(timer);
      }
    }
  }, [negotiation.log]);

  useEffect(() => {
    fondo.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [negotiation.log.length, scrive]);

  // La cifra personalizzata riparte dall'ultima proposta sul tavolo a ogni nuovo giro.
  useEffect(() => {
    setCifra(negotiation.amount);
  }, [negotiation.amount, negotiation.round]);

  const chiusa = negotiation.status !== "aperta";
  const mosse = suggestedMoves(negotiation);
  // In acquisto, qualunque mossa proponga una cifra oltre il budget resta visibile ma non
  // cliccabile: nasconderla lascerebbe intuire il limite, disabilitarla lo rende un vincolo
  // vero — niente più acquisti "per sbaglio" di un giocatore che non ci si può permettere.
  const costoMossa = (move: NegotiationMove): number | null => {
    if (move.kind === "accetta") return negotiation.amount;
    if (move.kind === "rilancia" || move.kind === "ultimatum") return move.amount;
    return null;
  };
  const nonSostenibile = (move: NegotiationMove) => {
    if (negotiation.kind !== "acquisto") return false;
    const costo = costoMossa(move);
    return costo !== null && costo > budget;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
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
            <Building2 size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-tight font-extrabold">
              Direttore sportivo · {negotiation.clubName}
            </p>
            <p className="truncate text-[11px] text-[var(--text-secondary)]">
              {negotiation.kind === "cessione"
                ? "Vuole"
                : negotiation.kind === "prestito"
                  ? "Prestito per"
                  : "Trattativa per"}{" "}
              {negotiation.playerName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi la trattativa"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)]"
          >
            <X size={15} />
          </button>
        </header>

        {/* Pazienza: quanto ancora si può tirare la corda. */}
        <div className="flex items-center gap-2 border-b border-[var(--surface-border)] px-4 py-2">
          <span className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            Pazienza
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-raised)]">
            <motion.span
              className="block h-full rounded-full"
              animate={{
                width: `${negotiation.patience}%`,
                backgroundColor:
                  negotiation.patience > 55
                    ? "#3ddc6b"
                    : negotiation.patience > 25
                      ? "#ffab2e"
                      : "#ff4d4d",
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </span>
          <span className="text-[11px] font-extrabold tabular-nums">
            {formattaCifra(negotiation.kind, negotiation.amount)}
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          <AnimatePresence initial={false}>
            {negotiation.log.map((messaggio, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className={`flex ${messaggio.speaker === "noi" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
                    messaggio.speaker === "noi"
                      ? "rounded-br-md bg-[var(--brand)] text-[var(--brand-contrast)]"
                      : "rounded-bl-md bg-[var(--surface-raised)]"
                  }`}
                >
                  <p className="text-[13px] leading-relaxed">{messaggio.text}</p>
                  {messaggio.amount !== undefined && (
                    <p
                      className={`mt-1 text-sm font-extrabold tabular-nums ${
                        messaggio.speaker === "noi" ? "" : "text-[var(--accent)]"
                      }`}
                    >
                      {formattaCifra(negotiation.kind, messaggio.amount)}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {scrive && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-2xl rounded-bl-md bg-[var(--surface-raised)] px-3.5 py-3">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)]"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={fondo} />
        </div>

        <footer className="border-t border-[var(--surface-border)] p-3">
          {chiusa ? (
            <div className="flex flex-col gap-2">
              <p
                className="flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-extrabold"
                style={{
                  backgroundColor: negotiation.status === "conclusa" ? "#3ddc6b22" : "#ff4d4d22",
                  color: negotiation.status === "conclusa" ? "#2a9b4d" : "#ff4d4d",
                }}
              >
                {negotiation.status === "conclusa" ? <Check size={16} /> : <X size={16} />}
                {negotiation.status === "conclusa"
                  ? `${endingLabel(negotiation)} a ${formattaCifra(negotiation.kind, negotiation.amount)}`
                  : endingLabel(negotiation)}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl bg-[var(--brand)] py-3 text-sm font-extrabold text-[var(--brand-contrast)]"
              >
                Torna al mercato
              </button>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-2 gap-2">
              {mosse.map((m, i) => {
                const principale = m.move.kind === "accetta";
                const abbandona = m.move.kind === "abbandona";
                const attesa = m.move.kind === "prendi_tempo";
                const ultimatum = m.move.kind === "ultimatum";
                const disabilitata = nonSostenibile(m.move);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={disabilitata}
                    onClick={() => onMove(m.move)}
                    aria-label={disabilitata ? `${m.label} — budget insufficiente` : m.label}
                    className={`flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-bold transition-transform ${
                      disabilitata
                        ? "cursor-not-allowed border border-[var(--surface-border)] text-[var(--text-secondary)] opacity-40"
                        : `active:scale-95 ${
                            principale
                              ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                              : abbandona
                                ? "border border-[var(--surface-border)] text-[var(--text-secondary)]"
                                : ultimatum
                                  ? "border border-[#ff4d4d]/60 text-[#ff4d4d]"
                                  : attesa
                                    ? "border border-[var(--surface-border)] text-[var(--text-primary)]"
                                    : "border border-[var(--accent)]/50 text-[var(--accent)]"
                          }`
                    }`}
                  >
                    {principale && <Check size={13} />}
                    {attesa && <Hourglass size={13} />}
                    {ultimatum && <Zap size={13} />}
                    {!principale && !abbandona && !attesa && !ultimatum && <HandCoins size={13} />}
                    {m.label}
                  </button>
                );
              })}
              </div>
              <p className="mt-2 text-center text-[10px] leading-relaxed text-[var(--text-secondary)]">
                Prendere tempo può far arrivare un'altra squadra. L'ultimatum chiude o rompe.
              </p>

              {/* Cifra personalizzata: stessa mossa "rilancia" dei bottoni sopra, stesso costo
                  in pazienza — solo la cifra la sceglie l'utente, con incrementi rapidi invece
                  di un input libero (semplificato su richiesta esplicita dell'utente: "1mln,
                  0,5mln ecc." invece di digitare un numero). */}
              {personalizza ? (
                <div className="mt-2.5 flex flex-col gap-2">
                  <p className="text-center text-lg font-extrabold tabular-nums">
                    {formattaCifra(negotiation.kind, cifra)}
                  </p>
                  <div className="flex items-center justify-center gap-1.5">
                    {passiIncremento(negotiation.kind).map((passo) => (
                      <button
                        key={`meno-${passo}`}
                        type="button"
                        onClick={() => setCifra((v) => Math.max(0, v - passo))}
                        className="rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text-secondary)] active:scale-95"
                      >
                        −{etichettaPasso(negotiation.kind, passo)}
                      </button>
                    ))}
                    {passiIncremento(negotiation.kind).map((passo) => (
                      <button
                        key={`più-${passo}`}
                        type="button"
                        onClick={() => setCifra((v) => v + passo)}
                        className="rounded-lg border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-2.5 py-1.5 text-[11px] font-bold text-[var(--brand)] active:scale-95"
                      >
                        +{etichettaPasso(negotiation.kind, passo)}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={nonSostenibile({ kind: "rilancia", amount: cifra })}
                      onClick={() => {
                        onMove({ kind: "rilancia", amount: cifra });
                        setPersonalizza(false);
                      }}
                      className={`flex-1 rounded-xl px-3 py-2 text-[11px] font-bold ${
                        nonSostenibile({ kind: "rilancia", amount: cifra })
                          ? "cursor-not-allowed bg-[var(--surface-raised)] text-[var(--text-secondary)] opacity-40"
                          : "bg-[var(--accent)] text-[var(--brand-contrast)]"
                      }`}
                    >
                      Rilancia
                    </button>
                    <button
                      type="button"
                      onClick={() => setPersonalizza(false)}
                      aria-label="Annulla cifra personalizzata"
                      className="shrink-0 rounded-xl border border-[var(--surface-border)] p-2 text-[var(--text-secondary)]"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  {nonSostenibile({ kind: "rilancia", amount: cifra }) && (
                    <p className="px-1 text-[10px] font-bold text-[#ff4d4d]">
                      Budget insufficiente per questa cifra.
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPersonalizza(true)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--surface-border)] py-2 text-[11px] font-bold text-[var(--text-secondary)]"
                >
                  <SlidersHorizontal size={12} />
                  Personalizza la cifra
                </button>
              )}
            </div>
          )}
        </footer>
      </motion.div>
    </motion.div>
  );
}
