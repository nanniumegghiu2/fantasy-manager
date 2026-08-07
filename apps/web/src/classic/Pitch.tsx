import { motion } from "framer-motion";
import { Star } from "lucide-react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { PITCH_VIEWBOX_HEIGHT, PITCH_VIEWBOX_WIDTH } from "./pitchLayouts";
import { OriginBadge } from "./NationFlag";
import { overallTier } from "./theme";

const GRASS_DARK = "#12703a";
const GRASS_LIGHT = "#1a8a48";

/**
 * Sfondo campo originale (linee generiche, nessun asset ufficiale — CLAUDE.md sez. 2),
 * verde erba con strisce di taglio e una vignettatura ai bordi che stacca i giocatori dal
 * fondo. Si adatta sempre allo spazio disponibile del contenitore (max-width/max-height
 * 100% + aspect-ratio, mai piu' grande di cosi') cosi' che campo + lista giocatori
 * restino entrambi visibili senza scroll di pagina.
 */
export function Pitch({
  children,
  onPointerMove,
  onPointerUp,
}: {
  children: ReactNode;
  onPointerMove?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className="relative mx-auto max-h-full max-w-full overflow-hidden rounded-3xl border border-black/20 shadow-xl ring-1 ring-white/10"
      style={{ aspectRatio: `${PITCH_VIEWBOX_WIDTH} / ${PITCH_VIEWBOX_HEIGHT}`, touchAction: "manipulation" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <svg
        viewBox={`0 0 ${PITCH_VIEWBOX_WIDTH} ${PITCH_VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <radialGradient id="pitch-vignette" cx="50%" cy="45%" r="75%">
            <stop offset="55%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width={PITCH_VIEWBOX_WIDTH} height={PITCH_VIEWBOX_HEIGHT} fill={GRASS_DARK} />
        {Array.from({ length: 8 }).map((_, i) => (
          <rect
            key={i}
            x="0"
            y={i * (PITCH_VIEWBOX_HEIGHT / 8)}
            width={PITCH_VIEWBOX_WIDTH}
            height={PITCH_VIEWBOX_HEIGHT / 16}
            fill={GRASS_LIGHT}
          />
        ))}

        <g stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" fill="none">
          <rect x="2" y="2" width={PITCH_VIEWBOX_WIDTH - 4} height={PITCH_VIEWBOX_HEIGHT - 4} rx="1" />
          <line x1="2" y1={PITCH_VIEWBOX_HEIGHT / 2} x2={PITCH_VIEWBOX_WIDTH - 2} y2={PITCH_VIEWBOX_HEIGHT / 2} />
          <circle cx="50" cy={PITCH_VIEWBOX_HEIGHT / 2} r="11" />
          <circle cx="50" cy={PITCH_VIEWBOX_HEIGHT / 2} r="0.9" fill="rgba(255,255,255,0.5)" />
          {/* area di rigore avversaria (attacco, in alto) */}
          <rect x="25" y="2" width="50" height="20" />
          <rect x="38" y="2" width="24" height="7" />
          <path d="M 38 22 A 11 11 0 0 0 62 22" />
          {/* area di rigore propria (difesa, in basso) */}
          <rect x="25" y={PITCH_VIEWBOX_HEIGHT - 22} width="50" height="20" />
          <rect x="38" y={PITCH_VIEWBOX_HEIGHT - 9} width="24" height="7" />
          <path d={`M 38 ${PITCH_VIEWBOX_HEIGHT - 22} A 11 11 0 0 1 62 ${PITCH_VIEWBOX_HEIGHT - 22}`} />
        </g>

        <rect
          x="0"
          y="0"
          width={PITCH_VIEWBOX_WIDTH}
          height={PITCH_VIEWBOX_HEIGHT}
          fill="url(#pitch-vignette)"
        />
      </svg>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

export type PitchDotState = "filled" | "empty" | "lit" | "dim";

interface PitchDotProps {
  x: number;
  y: number;
  /** Nome per esteso del ruolo: usato per l'etichetta accessibile e per i test. */
  label: string;
  /**
   * Sigla del ruolo (es. `MED`) mostrata sulla targhetta quando la casella è vuota: nomi
   * come "Centrocampista Centrale" non entrano in 70px e finirebbero troncati a metà.
   */
  shortLabel: string;
  playerName?: string;
  overall?: number;
  /** Nazionalità del titolare: bandierina sotto la targhetta, per leggere l'intesa a colpo d'occhio. */
  nation?: string;
  /** Campionato del titolare: sigla testuale accanto alla bandierina (mai il logo, sez. 2). */
  league?: string;
  state: PitchDotState;
  onClick?: () => void;
  /** Id della casella: serve all'hit test del trascinamento (`document.elementFromPoint`). */
  slotId?: string;
  /** La casella è la sorgente da cui si sta trascinando un giocatore. */
  dragging?: boolean;
  /** La casella accetta il rilascio di un trascinamento in corso. */
  droppable?: boolean;
  /** Pressione iniziale: da qui può partire un trascinamento. */
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
  /**
   * Titolare garantito dalla direttiva DS-Mister per questa casella (sez. mercato): bordo
   * dorato + stella, stesso trattamento già usato per "★ TITOLARE GARANTITO" nel select del
   * meeting col mister — qui va in campo, dove la lavagna tattica del mercato lo mostra.
   */
  guaranteed?: boolean;
}

/** Cognome soltanto: sotto i 40px di larghezza il nome intero non è mai leggibile. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.at(-1)! : name;
}

/**
 * Casella del tabellone: un gettone circolare con l'Overall al centro (colorato per fascia
 * di qualità) e il cognome su una targhetta sotto. Gli stati sono quattro — occupata,
 * libera, "accesa" perché compatibile col giocatore selezionato, spenta perché
 * incompatibile — e ognuno ha un trattamento visivo distinto, così durante il draft si
 * capisce a colpo d'occhio dove si può giocare.
 */
export function PitchDot({
  x,
  y,
  label,
  shortLabel,
  playerName,
  overall,
  nation,
  league,
  state,
  onClick,
  slotId,
  dragging,
  droppable,
  onPointerDown,
  guaranteed,
}: PitchDotProps) {
  // Anche una casella **occupata** è interattiva quando riceve un onClick: è così che si
  // solleva un titolare per spostarlo. Prima "filled" era escluso e il bottone restava
  // `disabled`, quindi il tocco non arrivava mai — lo spostamento a click era inerte.
  const interactive = state !== "dim" && !!onClick;
  const tier = overall != null ? overallTier(overall) : undefined;

  const circleStyle =
    state === "filled" && tier
      ? { backgroundColor: tier.dot, color: tier.dotText }
      : state === "lit"
        ? { backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }
        : undefined;

  const circleClass =
    state === "filled"
      ? "border-white/70 shadow-lg"
      : state === "lit"
        ? "border-white shadow-[0_0_18px_4px_rgba(255,255,255,0.45)]"
        : state === "dim"
          ? "border-white/15 bg-black/40 text-white/25"
          : "border-dashed border-white/70 bg-black/30 text-white/85";

  return (
    <motion.div
      data-state={state}
      data-slot-label={label}
      style={{ left: `${x}%`, top: `${(y / PITCH_VIEWBOX_HEIGHT) * 100}%` }}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      // Il rilascio si accetta su tutta la casella, non solo sul cerchio: il bersaglio di un
      // trascinamento col dito deve essere generoso. L'hit test avviene in TacticalBoard.
      data-slot-id={slotId}
      data-droppable={droppable ? "true" : undefined}
      initial={false}
      animate={
        state === "dim"
          ? { scale: 0.85, opacity: 0.55 }
          : dragging
            ? { scale: 1.06, opacity: 0.5 }
            : { scale: 1, opacity: 1 }
      }
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
    >
      <span className="relative flex items-center justify-center">
        {/* L'alone pulsante sta DIETRO il gettone, non sul gettone: attira l'occhio senza
            far muovere il bersaglio del tocco, che su mobile è già solo ~40px. */}
        {state === "lit" && (
          <motion.span
            aria-hidden
            initial={{ scale: 0.9, opacity: 0.7 }}
            animate={{ scale: [0.95, 1.55], opacity: [0.55, 0] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-[var(--accent)]"
          />
        )}
        <motion.button
          type="button"
          disabled={!interactive}
          onClick={interactive ? onClick : undefined}
          aria-label={playerName ? `${label}: ${playerName}` : label}
          whileTap={interactive ? { scale: 0.88 } : undefined}
          // La chiave sull'Overall fa ripartire l'animazione di ingresso ogni volta che la
          // casella cambia contenuto: il gettone "atterra" sul campo quando viene assegnato.
          key={`${state}-${overall ?? "empty"}`}
          onPointerDown={onPointerDown}
          initial={state === "filled" ? { scale: 0.2, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 20 }}
          className={`relative flex aspect-square w-[clamp(30px,9vw,44px)] items-center justify-center rounded-full border-2 text-sm font-extrabold backdrop-blur-[2px] ${circleClass} ${
            interactive ? "cursor-pointer" : "cursor-default"
          } ${
            guaranteed
              ? "ring-2 ring-[#f5c518] ring-offset-1 ring-offset-transparent shadow-[0_0_10px_2px_rgba(245,197,24,0.55)]"
              : ""
          }`}
          style={circleStyle}
        >
          {overall ?? "+"}
        </motion.button>
        {guaranteed && (
          <span
            aria-label="Titolare garantito dal mister"
            title="Titolare garantito dal mister"
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f5c518] text-black shadow"
          >
            <Star size={10} fill="black" strokeWidth={0} />
          </span>
        )}
      </span>

      <span
        className={`mt-1 max-w-[76px] truncate rounded-full px-1.5 py-px text-center text-[9px] leading-tight font-bold tracking-wide sm:text-[10px] ${
          state === "filled"
            ? "bg-black/65 text-white"
            : state === "dim"
              ? "bg-black/40 text-white/40"
              : "bg-black/55 text-white/90"
        }`}
      >
        {playerName ? shortName(playerName) : shortLabel}
      </span>

      {/* Provenienza: è ciò che decide le linee di intesa (sez. 3.4), quindi va letto sul
          campo e non solo nella lista del draft. */}
      {playerName && nation && (
        <span className="mt-0.5 flex items-center gap-1 rounded-full bg-black/60 px-1 py-px text-[8px] leading-tight text-white/85 sm:text-[9px]">
          <OriginBadge nation={nation} league={league} size={7} compact />
          <span className="font-bold tracking-wide">{shortLabel}</span>
        </span>
      )}
    </motion.div>
  );
}
