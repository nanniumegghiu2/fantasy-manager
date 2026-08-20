import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, Share2, Trophy, X } from "lucide-react";
import { CelebrationConfetti } from "./CelebrationConfetti";
import { seasonYearLabel } from "@app/game-engine";
import {
  downloadTriumph,
  shareTriumph,
  triumphTitle,
  trophyCount,
  trophyLabels,
  type ShareCardData,
  type ShareFormat,
  type ShareOutcome,
} from "./shareCard";

/**
 * **La schermata di trionfo**, e il punto da cui l'immagine parte per i social.
 *
 * ## Una schermata sola, a tre intensità
 *
 * Non esiste una versione "triplete" e una "normale": è la stessa presa a tutto schermo, che
 * cresce col numero di trofei. Un trofeo → sobria; due → doppietta, più oro; tre → oro pieno,
 * coriandoli al massimo, coppe che entrano una dopo l'altra.
 *
 * La ragione è misurata, non estetica: il triplete richiede campionato + Corona + Coppa
 * Tricolore nella stessa stagione, che nell'ordine di grandezza di questo motore capita in
 * **circa una carriera su dieci**. Una schermata elaborata riservata a quel caso non la
 * vedrebbe quasi nessuno, mentre la macchina — canvas, condivisione, coriandoli — è identica
 * per qualunque trofeo.
 */

interface TriumphScreenProps {
  data: ShareCardData;
  onClose: () => void;
}

const MESSAGGIO: Record<ShareOutcome, string> = {
  condiviso: "Condiviso.",
  scaricato: "Immagine salvata, testo copiato negli appunti.",
  annullato: "",
  errore: "Non sono riuscito a creare l'immagine su questo dispositivo.",
};

export function TriumphScreen({ data, onClose }: TriumphScreenProps) {
  const [formato, setFormato] = useState<ShareFormat>("post");
  const [inCorso, setInCorso] = useState<"share" | "download" | null>(null);
  const [esito, setEsito] = useState<ShareOutcome | null>(null);

  const trofei = trophyCount(data.trophies);
  const etichette = trophyLabels(data.trophies);
  const titolo = triumphTitle(data);
  const oro = trofei >= 2;

  async function condividi() {
    setInCorso("share");
    setEsito(await shareTriumph(data, formato));
    setInCorso(null);
  }

  async function salva() {
    setInCorso("download");
    setEsito(await downloadTriumph(data, formato));
    setInCorso(null);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#0e1614] text-white"
    >
      {/* I coriandoli si accendono da un trofeo in su: senza trofei questa schermata non si apre. */}
      {trofei > 0 && <CelebrationConfetti />}

      <div className="relative flex min-h-svh flex-col items-center justify-center px-6 py-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute right-4 top-4 rounded-full border border-white/15 p-2 text-white/70 transition hover:bg-white/10"
        >
          <X size={18} />
        </button>

        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-label font-semibold uppercase tracking-[0.28em] text-white/55"
        >
          {data.leagueName} · {seasonYearLabel(data.season)}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.16, type: "spring", stiffness: 220, damping: 18 }}
          className="mt-2 text-center text-display font-extrabold sm:text-4xl"
        >
          {data.clubName}
        </motion.h1>

        {/* Le coppe entrano una dopo l'altra: è ciò che rende il triplete diverso da una vittoria. */}
        <div className="mt-8 flex items-end justify-center gap-4">
          {Array.from({ length: Math.max(trofei, 1) }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.22, type: "spring", stiffness: 260, damping: 16 }}
            >
              <Trophy
                size={trofei >= 3 ? 66 : 82}
                strokeWidth={1.5}
                className={
                  trofei === 0
                    ? "text-white/25"
                    : oro
                      ? "text-[#f5c518] drop-shadow-[0_0_28px_rgba(245,197,24,0.55)]"
                      : "text-copper-300"
                }
              />
            </motion.div>
          ))}
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + Math.max(trofei, 1) * 0.22 }}
          className={`mt-7 text-center font-black tracking-tight ${
            trofei >= 3 ? "text-5xl text-[#f5c518] sm:text-6xl" : "text-4xl sm:text-5xl"
          }`}
        >
          {titolo}
        </motion.h2>

        {etichette.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + trofei * 0.2 }}
            className="mt-3 text-center text-body font-semibold text-white/75"
          >
            {etichette.join("  ·  ")}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 + trofei * 0.2 }}
          className="mt-8 grid w-full max-w-md grid-cols-3 gap-3"
        >
          {[
            { valore: `${data.position}º`, etichetta: "in campionato" },
            { valore: String(data.points), etichetta: "punti" },
            {
              valore: `${data.goalsFor >= data.goalsAgainst ? "+" : ""}${data.goalsFor - data.goalsAgainst}`,
              etichetta: "diff. reti",
            },
          ].map((c) => (
            <div
              key={c.etichetta}
              className="rounded-card border border-white/10 bg-white/5 px-3 py-4 text-center"
            >
              <p className="text-display font-extrabold">{c.valore}</p>
              <p className="mt-1 text-micro font-semibold uppercase tracking-wider text-white/50">
                {c.etichetta}
              </p>
            </div>
          ))}
        </motion.div>

        {data.topScorer && (
          <p className="mt-4 text-body font-semibold text-[#f5c518]">
            {data.topScorer.name} · {data.topScorer.goals} gol
          </p>
        )}

        {/* Formato: verticale da feed o storia a tutto schermo. Due tocchi, non un menù. */}
        <div className="mt-8 flex gap-2 rounded-full border border-white/12 bg-white/5 p-1">
          {(["post", "storia"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormato(f)}
              className={`rounded-full px-4 py-1.5 text-label font-bold uppercase tracking-wider transition ${
                formato === f ? "bg-white text-[#0e1614]" : "text-white/60"
              }`}
            >
              {f === "post" ? "Post" : "Storia"}
            </button>
          ))}
        </div>

        <div className="mt-5 flex w-full max-w-md flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={condividi}
            disabled={inCorso !== null}
            className="flex flex-1 items-center justify-center gap-2 rounded-card bg-[#f5c518] px-5 py-4 text-body font-bold text-[#2a2100] transition active:scale-[0.98] disabled:opacity-60"
          >
            <Share2 size={18} />
            {inCorso === "share" ? "Preparo l'immagine…" : "Condividi"}
          </button>
          <button
            type="button"
            onClick={salva}
            disabled={inCorso !== null}
            className="flex items-center justify-center gap-2 rounded-card border border-white/15 px-5 py-4 text-body font-semibold text-white/85 transition active:scale-[0.98] disabled:opacity-60"
          >
            <Download size={18} />
            Salva
          </button>
        </div>

        <AnimatePresence>
          {esito && MESSAGGIO[esito] && (
            <motion.p
              key={esito}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-4 flex items-center gap-2 text-body font-semibold ${
                esito === "errore" ? "text-red-300" : "text-emerald-300"
              }`}
            >
              {esito !== "errore" && <Check size={16} />}
              {MESSAGGIO[esito]}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={onClose}
          className="mt-8 text-body font-semibold text-white/50 underline underline-offset-4"
        >
          Continua la carriera
        </button>
      </div>
    </motion.div>
  );
}
