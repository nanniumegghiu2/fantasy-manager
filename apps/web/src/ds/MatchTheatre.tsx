import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, FastForward, Pause, Play, X, Zap } from "lucide-react";
import {
  buildHighlights,
  buildShootout,
  layoutEleven,
  type ActionStep,
  type Highlight,
  type MatchResult,
  type MatchTheatreContext,
  type ShootoutKick,
} from "@app/game-engine";
import { OUTCOME_COLOR, outcomeOf } from "./format";
import { CelebrationConfetti } from "./CelebrationConfetti";

/**
 * **La partita, vista dal campo (Match Theatre 2D).**
 *
 * Rievocazione delle azioni salienti a sequenze temporali (micro-fasi): passaggi, cross
 * curvi, tiri, parate del portiere ed esultanze. Il risultato è già deciso dal motore
 * di gioco, questa vista trasforma la cronaca in un momento di spettacolo visivo.
 *
 * **Formazioni vere, non più un 4-3-3 finto identico per entrambe le squadre.** Con `context`
 * (le due formazioni reali, calcolate in `CareerScreen`), i 22 pallini vanno esattamente dove
 * `layoutEleven` (engine) li mette — e i protagonisti di ogni fase (`ActionStep.fromPlayerId`/
 * `toPlayerId`) sono giocatori con un nome, non ruoli generici. Senza `context` (formazioni non
 * risolvibili) si ricade sul vecchio schieramento astratto, invece di rompersi.
 */

const MS_PER_MINUTE_BASE = 28;

interface Pallino {
  id: string;
  nostro: boolean;
  ruoloGenerico: "GK" | "DEF" | "MID" | "ATT";
  baseX: number;
  baseY: number;
}

/** Schieramento astratto di riserva, usato solo se le formazioni vere non sono note. */
function creaPalliniGenerici(): Pallino[] {
  const formazioneNostra: { role: Pallino["ruoloGenerico"]; pos: [number, number] }[] = [
    { role: "GK", pos: [4, 50] },
    { role: "DEF", pos: [20, 20] },
    { role: "DEF", pos: [18, 40] },
    { role: "DEF", pos: [18, 60] },
    { role: "DEF", pos: [20, 80] },
    { role: "MID", pos: [38, 25] },
    { role: "MID", pos: [35, 50] },
    { role: "MID", pos: [38, 75] },
    { role: "ATT", pos: [52, 30] },
    { role: "ATT", pos: [54, 50] },
    { role: "ATT", pos: [52, 70] },
  ];

  const nostri: Pallino[] = formazioneNostra.map((item, i) => ({
    id: `noi-${i}`,
    nostro: true,
    ruoloGenerico: item.role,
    baseX: item.pos[0],
    baseY: item.pos[1],
  }));

  const loro: Pallino[] = formazioneNostra.map((item, i) => ({
    id: `loro-${i}`,
    nostro: false,
    ruoloGenerico: item.role,
    baseX: 100 - item.pos[0],
    baseY: 100 - item.pos[1],
  }));

  return [...nostri, ...loro];
}

const DEPT_TO_RUOLO: Record<string, Pallino["ruoloGenerico"]> = {
  POR: "GK",
  DIF: "DEF",
  CC: "MID",
  ATT: "ATT",
};

/** Le formazioni vere, quando le conosciamo: stesse coordinate che l'engine dà alle azioni. */
function creaPalliniReali(context: MatchTheatreContext): Pallino[] {
  const nostrePos = layoutEleven(context.ourEleven, "for");
  const lorePos = layoutEleven(context.opponentEleven, "against");
  const nostri: Pallino[] = context.ourEleven.map((p) => {
    const pos = nostrePos.get(p.playerId) ?? { x: 20, y: 50 };
    return { id: p.playerId, nostro: true, ruoloGenerico: DEPT_TO_RUOLO[p.department] ?? "MID", baseX: pos.x, baseY: pos.y };
  });
  const loro: Pallino[] = context.opponentEleven.map((p) => {
    const pos = lorePos.get(p.playerId) ?? { x: 80, y: 50 };
    return { id: p.playerId, nostro: false, ruoloGenerico: DEPT_TO_RUOLO[p.department] ?? "MID", baseX: pos.x, baseY: pos.y };
  });
  return [...nostri, ...loro];
}

interface MatchTheatreProps {
  result: MatchResult;
  opponent: string;
  clubName: string;
  reason: string;
  seed: string;
  nameOf: (playerId: string | null) => string;
  /** Le due formazioni vere, se risolvibili (`CareerScreen`, `buildTheatreContext`). */
  context?: MatchTheatreContext;
  /** Presente solo per una partita di Coppa decisa ai rigori (sez. quarti-in-su). */
  penalties?: { weWon: boolean };
  onClose: () => void;
}

export function MatchTheatre({
  result,
  opponent,
  clubName,
  reason,
  seed,
  nameOf,
  context,
  penalties,
  onClose,
}: MatchTheatreProps) {
  const azioni = useMemo(
    () => buildHighlights(result, seed, nameOf, context),
    [result, seed, nameOf, context],
  );
  const rigori = useMemo(() => (penalties ? buildShootout(penalties.weWon, seed) : []), [penalties, seed]);
  const [rigoreIndex, setRigoreIndex] = useState(0);
  const PALLINI = useMemo(
    () => (context ? creaPalliniReali(context) : creaPalliniGenerici()),
    [context],
  );
  const [minuto, setMinuto] = useState(0);
  const [azione, setAzione] = useState<Highlight | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 2>(1);
  const [finita, setFinita] = useState(false);
  const prossima = useRef(0);

  const currentStep: ActionStep | null = useMemo(() => {
    if (!azione || !azione.steps || azione.steps.length === 0) return null;
    return azione.steps[stepIndex] ?? azione.steps[azione.steps.length - 1] ?? null;
  }, [azione, stepIndex]);

  // Gestione timer e riproduzione micro-fasi dell'azione
  useEffect(() => {
    if (finita || isPaused) return;

    let timer: ReturnType<typeof setTimeout>;

    // Se c'è un'azione attiva, scorrere le sue micro-fasi
    if (azione && azione.steps && azione.steps.length > 0) {
      const step = meStep(azione, stepIndex);
      const durataFase = Math.max(200, (step.durationMs || 700) / speedMultiplier);

      timer = setTimeout(() => {
        if (stepIndex + 1 < azione.steps.length) {
          setStepIndex((idx) => idx + 1);
        } else {
          // Fase completata: torna al minuto libero
          setAzione(null);
          setStepIndex(0);
          setMinuto((m) => m + 1);
        }
      }, durataFase);
    } else {
      // Orologio standard dei minuti
      const corrente = azioni[prossima.current];
      if (corrente && corrente.minute === minuto) {
        setAzione(corrente);
        setStepIndex(0);
        prossima.current += 1;
      } else {
        const msMinute = MS_PER_MINUTE_BASE / speedMultiplier;
        timer = setTimeout(() => {
          if (minuto >= 90) {
            setFinita(true);
            return;
          }
          setMinuto((m) => m + 1);
        }, msMinute);
      }
    }

    return () => clearTimeout(timer);
  }, [minuto, azione, stepIndex, finita, isPaused, speedMultiplier, azioni]);

  // I rigori si vedono solo a partita finita, e solo se c'è davvero uno spareggio da
  // raccontare: stessa cadenza degli altri orologi, un tiro alla volta.
  useEffect(() => {
    if (!finita || isPaused || rigori.length === 0 || rigoreIndex >= rigori.length) return;
    const timer = setTimeout(() => setRigoreIndex((i) => i + 1), 900 / speedMultiplier);
    return () => clearTimeout(timer);
  }, [finita, isPaused, rigori.length, rigoreIndex, speedMultiplier]);

  /**
   * **Battito ambientale**: quando non c'è un'azione attiva (il 90% dei tick, sez. 9a/9b del
   * pacchetto), il campo non deve restare una foto ferma. Un contatore lento (non 60fps — la
   * molla di Framer Motion smussa già il salto) basta a far respirare i 22 pallini e a far
   * girare un pallone "a vista" fra compagni veri, senza narrare nulla (nessun testo, nessun
   * evento): è solo la squadra che tiene palla nei momenti morti, che in una partita vera sono
   * la maggioranza del tempo.
   */
  const [ambientTick, setAmbientTick] = useState(0);
  useEffect(() => {
    if (azione || finita || isPaused) return;
    const id = setInterval(() => setAmbientTick((t) => t + 1), 650 / speedMultiplier);
    return () => clearInterval(id);
  }, [azione, finita, isPaused, speedMultiplier]);

  const salta = () => {
    setMinuto(90);
    setFinita(true);
    setAzione(azioni[azioni.length - 1] ?? null);
    setStepIndex(0);
    setRigoreIndex(rigori.length);
  };

  const parziale = useMemo(() => {
    let nostri = 0;
    let loro = 0;
    for (const e of result.events) {
      if (e.minute > minuto) continue;
      if (e.team === "for") nostri++;
      else loro++;
    }
    return { nostri, loro };
  }, [result.events, minuto]);

  const esito = outcomeOf(parziale.nostri, parziale.loro);
  const marcatoreNome = azione?.playerId ? nameOf(azione.playerId) : "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-md"
    >
      {finita &&
        rigoreIndex >= rigori.length &&
        (penalties ? penalties.weWon : result.goalsFor > result.goalsAgainst) && <CelebrationConfetti />}
      <motion.div
        initial={{ scale: 0.94, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-[var(--surface-border)] px-4 py-3 bg-black/20">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[10px] font-bold tracking-widest text-[var(--accent)] uppercase">
              <Crown size={11} />
              {reason}
            </p>
            <p className="truncate text-sm leading-tight font-extrabold">
              {clubName} <span className="text-[var(--text-secondary)] font-normal">vs</span> {opponent}
            </p>
          </div>
          <span
            className="shrink-0 rounded-xl px-3.5 py-1.5 text-xl font-extrabold tabular-nums shadow-inner"
            style={{ backgroundColor: `${OUTCOME_COLOR[esito]}22`, color: OUTCOME_COLOR[esito] }}
          >
            {parziale.nostri} - {parziale.loro}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi la partita"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)] hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </header>

        {/* Campo da gioco 2D */}
        <div className="relative">
          <Campo
            azione={azione}
            currentStep={currentStep}
            clubName={clubName}
            opponentName={opponent}
            scorerName={marcatoreNome}
            pallini={PALLINI}
            ambientTick={ambientTick}
          />

          {/* Orologio Minuto + Badge Velocità */}
          <div className="absolute top-2 left-2 flex items-center gap-2">
            <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white tabular-nums border border-white/10 shadow">
              {Math.min(minuto, 90)}&apos;
            </span>

            {/* Badge micro-fase corrente */}
            {currentStep?.phaseLabel && (
              <motion.span
                key={currentStep.phaseLabel}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-full bg-[var(--brand)] px-2.5 py-0.5 text-[10px] font-extrabold text-[var(--brand-contrast)] uppercase shadow"
              >
                {currentStep.phaseLabel}
              </motion.span>
            )}
          </div>

          {/* Banner Cronaca Azione */}
          <AnimatePresence mode="wait">
            {azione && (
              <motion.div
                key={`${azione.minute}-${azione.kind}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="absolute inset-x-2 bottom-2 rounded-2xl px-4 py-2.5 backdrop-blur-md shadow-xl border border-white/15"
                style={{ backgroundColor: `${coloreAzione(azione)}ee` }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black tracking-widest text-black/70 uppercase">
                    {azione.minute}&apos; · {azione.team === "for" ? clubName : opponent}
                  </p>
                  <span className="text-[10px] font-bold text-black/60 uppercase">
                    {azione.kind}
                  </span>
                </div>
                <p className="text-sm sm:text-base leading-tight font-extrabold text-black/90">
                  {azione.text}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rigori: tiro per tiro, solo a partita finita e solo se c'è uno spareggio vero. */}
          {finita && rigori.length > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 backdrop-blur-sm">
              <p className="text-[10px] font-bold tracking-widest text-amber-300 uppercase">
                Si va ai rigori
              </p>
              <div className="flex gap-1.5">
                {rigori.map((k, i) => (
                  <RigoreSegno key={i} kick={k} visto={i < rigoreIndex} />
                ))}
              </div>
              <p className="text-2xl font-extrabold text-white tabular-nums">
                {rigori.slice(0, rigoreIndex).filter((k) => k.team === "for" && k.scored).length}
                {" - "}
                {rigori.slice(0, rigoreIndex).filter((k) => k.team === "against" && k.scored).length}
              </p>
              {rigoreIndex >= rigori.length && (
                <p
                  className="text-sm font-extrabold uppercase tracking-wide"
                  style={{ color: penalties?.weWon ? "#3ddc6b" : "#ff4d4d" }}
                >
                  {penalties?.weWon ? "Passiamo il turno!" : "Eliminati ai rigori"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer con controlli */}
        <footer className="flex items-center justify-between gap-2 border-t border-[var(--surface-border)] p-3 bg-black/10">
          {!finita && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-white"
                title={isPaused ? "Riprendi" : "Pausa"}
              >
                {isPaused ? <Play size={16} /> : <Pause size={16} />}
              </button>

              <button
                type="button"
                onClick={() => setSpeedMultiplier((s) => (s === 1 ? 2 : 1))}
                className={`flex h-9 items-center gap-1 rounded-xl border px-3 text-xs font-bold transition-colors ${
                  speedMultiplier === 2
                    ? "border-[var(--brand)] bg-[var(--brand)]/15 text-[var(--brand)]"
                    : "border-[var(--surface-border)] text-[var(--text-secondary)]"
                }`}
              >
                <Zap size={14} />
                {speedMultiplier}x
              </button>
            </div>
          )}

          <div className="flex-1">
            {finita ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl bg-[var(--brand)] py-3 text-sm font-extrabold text-[var(--brand-contrast)] shadow-lg active:scale-[0.98]"
              >
                Torna alla stagione
              </button>
            ) : (
              <button
                type="button"
                onClick={salta}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] py-2.5 text-sm font-bold text-[var(--text-secondary)] hover:text-white"
              >
                <FastForward size={16} />
                Vai al finale
              </button>
            )}
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}

/** Campo da gioco 2D dinamico con traiettorie e pallini reattivi. */
function Campo({
  azione,
  currentStep,
  clubName: _clubName,
  opponentName: _opponentName,
  scorerName,
  pallini,
  ambientTick,
}: {
  azione: Highlight | null;
  currentStep: ActionStep | null;
  clubName: string;
  opponentName: string;
  scorerName: string;
  pallini: Pallino[];
  /** Battito lento per il movimento d'ambiente (sez. 9a/9b): 0 quando un'azione è in corso. */
  ambientTick: number;
}) {
  // Il possesso d'ambiente: chi tiene palla nei momenti morti, fra due compagni veri della
  // stessa squadra — nessun evento narrato, solo un pallone che gira (sez. 9b).
  const possessoAmbientale = useMemo(
    () => (azione ? null : palleggioAmbientale(pallini, ambientTick)),
    [azione, pallini, ambientTick],
  );

  // Palla: coordinate correnti
  const ballPos = useMemo(() => {
    if (currentStep) return { x: currentStep.toX, y: currentStep.toY };
    if (azione) return { x: azione.x, y: azione.y };
    if (possessoAmbientale) return possessoAmbientale;
    return { x: 50, y: 50 };
  }, [azione, currentStep, possessoAmbientale]);

  // Flash porta al gol
  const isGoalMoment =
    currentStep?.trajectory === "shot" &&
    (azione?.kind === "gol" || azione?.kind === "rigore");

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#246b33] shadow-inner select-none">
      {/* Texture Erba a strisce */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0 10%, transparent 10% 20%)",
        }}
      />

      {/* Rete Porta Flash al Gol */}
      {isGoalMoment && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.8, 0.3] }}
          transition={{ repeat: Infinity, duration: 0.3 }}
          className={`absolute inset-y-0 ${
            azione.team === "for" ? "right-0 w-[8%]" : "left-0 w-[8%]"
          } bg-emerald-400/40 blur-sm`}
        />
      )}

      {/* Segnatura del campo SVG */}
      <svg viewBox="0 0 100 62" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <g stroke="rgba(255,255,255,0.6)" strokeWidth="0.4" fill="none">
          <rect x="2" y="2" width="96" height="58" />
          <line x1="50" y1="2" x2="50" y2="60" />
          <circle cx="50" cy="31" r="8.5" />
          {/* Area di rigore sinistra */}
          <rect x="2" y="15" width="13" height="32" />
          <rect x="2" y="23" width="4.5" height="16" />
          <circle cx="11" cy="31" r="0.8" fill="rgba(255,255,255,0.8)" />
          {/* Area di rigore destra */}
          <rect x="85" y="15" width="13" height="32" />
          <rect x="93.5" y="23" width="4.5" height="16" />
          <circle cx="89" cy="31" r="0.8" fill="rgba(255,255,255,0.8)" />
        </g>

        {/* Traiettoria palla (SVG overlay) */}
        {currentStep && (
          <TraiettoriaPalla step={currentStep} team={azione?.team ?? "for"} />
        )}
      </svg>

      {/* 22 Pallini Giocatori */}
      {pallini.map((p) => {
        const pos = calcolaPosizioneGiocatore(p, meStep(azione, 0), currentStep, azione, ambientTick);
        // Con formazioni vere il protagonista si riconosce dall'id esatto (fromPlayerId/
        // toPlayerId, sez. highlights.ts) — molto più preciso del vecchio confronto per ruolo
        // generico, che restava comunque come riserva quando l'id non è noto.
        const idNoto = currentStep && (currentStep.fromPlayerId || currentStep.toPlayerId);
        const isActiveActor =
          !!currentStep &&
          (idNoto
            ? p.id === currentStep.fromPlayerId || p.id === currentStep.toPlayerId
            : (currentStep.activeActor === "keeper" && p.ruoloGenerico === "GK" && p.nostro !== (azione?.team === "for")) ||
              (currentStep.activeActor === "shooter" && p.ruoloGenerico === "ATT" && p.nostro === (azione?.team === "for")) ||
              (currentStep.activeActor === "passer" && p.ruoloGenerico === "MID" && p.nostro === (azione?.team === "for")));

        return (
          <motion.div
            key={p.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            transition={{ type: "spring", stiffness: 70, damping: 16 }}
          >
            {/* Anello evidenziatore per il protagonista dell'azione */}
            {isActiveActor && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute -inset-1 rounded-full border-2 border-amber-300 shadow-lg"
              />
            )}

            {/* Pallino Giocatore */}
            <span
              className="block h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full shadow-md transition-transform"
              style={{
                backgroundColor: p.nostro ? "#ffffff" : "#1e293b",
                border: p.nostro ? "2px solid #0f172a" : "2px solid #94a3b8",
              }}
            />

            {/* Nome Marcatore sopra la testa */}
            {isActiveActor && currentStep.activeActor === "shooter" && scorerName && (
              <motion.span
                initial={{ y: 4, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-1.5 py-0.5 text-[9px] font-black text-amber-300 shadow border border-amber-300/30"
              >
                ⚽ {scorerName}
              </motion.span>
            )}
          </motion.div>
        );
      })}

      {/* Il Pallone da Calcio */}
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
        style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%` }}
        animate={{ left: `${ballPos.x}%`, top: `${ballPos.y}%` }}
        transition={transizionePalla(currentStep?.trajectory)}
      >
        <span className="block h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full bg-white shadow-lg ring-2 ring-black/60 border border-slate-300" />
      </motion.div>
    </div>
  );
}

/** Disegna la scia o l'arco della palla con SVG. */
function TraiettoriaPalla({ step, team }: { step: ActionStep; team: "for" | "against" }) {
  const { fromX, fromY, toX, toY, trajectory } = step;

  if (trajectory === "cross") {
    const midX = (fromX + toX) / 2;
    const midY = Math.min(fromY, toY) - 12; // Arco verso l'alto
    return (
      <path
        d={`M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="0.8"
        strokeDasharray="1.5 1.5"
      />
    );
  }

  if (trajectory === "shot") {
    return (
      <line
        x1={fromX}
        y1={fromY}
        x2={toX}
        y2={toY}
        stroke={team === "for" ? "#34d399" : "#f87171"}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    );
  }

  if (trajectory === "save_deflect" || trajectory === "post_rebound") {
    return (
      <g>
        <line
          x1={fromX}
          y1={fromY}
          x2={toX}
          y2={toY}
          stroke="#38bdf8"
          strokeWidth="0.9"
          strokeDasharray="1 1"
        />
        <circle cx={fromX} cy={fromY} r="1.5" fill="#facc15" />
      </g>
    );
  }

  return (
    <line
      x1={fromX}
      y1={fromY}
      x2={toX}
      y2={toY}
      stroke="rgba(255,255,255,0.4)"
      strokeWidth="0.6"
      strokeDasharray="1 1"
    />
  );
}

/**
 * Un hash breve e deterministico dall'id: seme per la deriva d'ambiente di ogni pallino, così
 * i 22 non oscillano mai in sincrono (sez. 9a).
 */
function seedDaId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Deriva organica attorno alla posizione base, quando non succede nulla: ampiezza contenuta
 * (2-4% di campo), periodo e fase seedati per giocatore. Pura differenza fra "foto di squadra"
 * e "campo vivo" per il 90% del tempo mostrato (sez. 9a) — nessun dato nuovo dal motore, solo
 * calcolo lato client.
 */
function derivaAmbientale(p: Pallino, tick: number): { x: number; y: number } {
  const seme = seedDaId(p.id);
  const fase = ((seme % 1000) / 1000) * Math.PI * 2;
  const periodo = 5 + (seme % 4); // 5-8 tick a giro: mai identico fra due pallini
  const ampX = 2 + (seme % 3); // 2-4
  const ampY = 1.5 + ((seme >> 3) % 3); // 1.5-3.5
  const t = tick / periodo + fase;
  const x = p.baseX + Math.sin(t) * ampX;
  const y = p.baseY + Math.cos(t * 0.85) * ampY;
  return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
}

/**
 * Il possesso d'ambiente: un pallone che gira fra due compagni veri della stessa squadra nei
 * momenti morti (sez. 9b) — **non narra nessun esito**, solo un possesso a vista. Cambia
 * squadra ogni 3 tick e interpola fra due giocatori di movimento (mai il portiere, che non
 * partecipa al palleggio visibile).
 */
function palleggioAmbientale(pallini: Pallino[], tick: number): { x: number; y: number } | null {
  if (pallini.length === 0) return null;
  const squadraNostra = Math.floor(tick / 3) % 2 === 0;
  const candidati = pallini.filter((p) => p.nostro === squadraNostra && p.ruoloGenerico !== "GK");
  if (candidati.length < 2) return null;
  const passo = tick % 3;
  const idxA = tick % candidati.length;
  const idxB = (tick + 1 + (tick % (candidati.length - 1 || 1))) % candidati.length;
  const a = candidati[idxA]!;
  const b = candidati[idxB === idxA ? (idxA + 1) % candidati.length : idxB]!;
  const progresso = passo / 2; // 0 → 0.5 → 1 sui tre tick del possesso corrente
  return {
    x: a.baseX + (b.baseX - a.baseX) * progresso,
    y: a.baseY + (b.baseY - a.baseY) * progresso,
  };
}

/** Calcola la dinamica di movimento dei pallini a seconda dell'azione e dello step. */
function calcolaPosizioneGiocatore(
  p: Pallino,
  _firstStep: ActionStep | null,
  currentStep: ActionStep | null,
  azione: Highlight | null,
  ambientTick = 0,
): { x: number; y: number } {
  if (!azione || !currentStep) {
    return derivaAmbientale(p, ambientTick);
  }

  const { activeActor, trajectory, fromPlayerId, toPlayerId } = currentStep;
  const nostraAzione = azione.team === "for";
  // Con l'id vero il protagonista è quello, punto; senza, si ripiega sul ruolo generico.
  const idNoto = !!(fromPlayerId || toPlayerId);
  const eProtagonista = idNoto ? p.id === fromPlayerId || p.id === toPlayerId : undefined;

  // Portiere in tuffo
  if (
    activeActor === "keeper" &&
    p.nostro !== nostraAzione &&
    (idNoto ? eProtagonista : p.ruoloGenerico === "GK")
  ) {
    return { x: currentStep.toX, y: currentStep.toY };
  }

  // Tiratore / Attaccante al momento del tiro o passaggio
  if (
    p.nostro === nostraAzione &&
    (activeActor === "shooter" || activeActor === "passer") &&
    (idNoto ? eProtagonista : p.ruoloGenerico === "ATT")
  ) {
    return { x: currentStep.fromX, y: currentStep.fromY };
  }

  // Esultanza: l'attaccante corre verso la bandierina, la squadra lo segue
  if (trajectory === "celebration" && p.nostro === nostraAzione) {
    if (idNoto ? eProtagonista : p.ruoloGenerico === "ATT") {
      return { x: currentStep.toX, y: currentStep.toY };
    }
    return {
      x: currentStep.toX + (p.baseX - 50) * 0.2,
      y: currentStep.toY + (p.baseY - 50) * 0.2,
    };
  }

  // Movimento generale del blocco squadra verso l'azione: chi non ha palla non reagisce in
  // blocco unico — i difensori vicini alla propria area **pressano/marcano di più** quando il
  // pallone entra nella loro metà campo, gli attaccanti lontani dalla propria fase difensiva
  // reagiscono poco (sez. 9d). Stessa formula distanza/peso di sempre, il coefficiente per
  // reparto è quel che cambia.
  const targetX = currentStep.toX;
  const distanza = Math.abs(p.baseX - targetX);
  const nonPossidente = p.nostro !== nostraAzione;
  // "Propria area vicina" per chi difende: l'azione avanza verso la metà campo di chi non ha
  // palla, cioè verso x alto se è "for" ad attaccare, verso x basso se è "against".
  const propriaAreaVicina = nostraAzione ? targetX > 55 : targetX < 45;
  const pesoReparto = p.nostro === nostraAzione
    ? 0.45
    : nonPossidente && p.ruoloGenerico === "DEF" && propriaAreaVicina
      ? 0.55
      : nonPossidente && p.ruoloGenerico === "ATT"
        ? 0.15
        : 0.3;
  const peso = Math.max(0, 1 - distanza / 75) * pesoReparto;

  return {
    x: p.baseX + (targetX - p.baseX) * peso,
    y: p.baseY + (currentStep.toY - p.baseY) * peso,
  };
}

function transizionePalla(trajectory?: ActionStep["trajectory"]) {
  if (trajectory === "shot") {
    return { ease: "linear" as const, duration: 0.35 };
  }
  if (trajectory === "cross") {
    return { type: "spring" as const, stiffness: 140, damping: 18 };
  }
  if (trajectory === "save_deflect" || trajectory === "post_rebound") {
    return { type: "spring" as const, stiffness: 300, damping: 22 };
  }
  return { type: "spring" as const, stiffness: 90, damping: 16 };
}

function meStep(azione: Highlight | null, index: number): ActionStep {
  if (azione && azione.steps && azione.steps[index]) {
    return azione.steps[index];
  }
  return {
    fromX: 50,
    fromY: 50,
    toX: azione?.x ?? 50,
    toY: azione?.y ?? 50,
    trajectory: "pass",
    durationMs: 700,
  };
}

function coloreAzione(azione: Highlight): string {
  if (azione.kind === "gol" || azione.kind === "rigore") {
    return azione.team === "for" ? "#3ddc6b" : "#ff6b6b";
  }
  if (azione.kind === "espulsione") return "#ff4d4d";
  return "#ffd166";
}

/** Un tiro dal dischetto: pallino pieno per chi ha già tirato, vuoto per chi deve ancora. */
function RigoreSegno({ kick, visto }: { kick: ShootoutKick; visto: boolean }) {
  const nostro = kick.team === "for";
  if (!visto) {
    return (
      <span
        className="block h-3 w-3 rounded-full border-2 opacity-40"
        style={{ borderColor: nostro ? "#ffffff" : "#94a3b8" }}
      />
    );
  }
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="block h-3 w-3 rounded-full"
      style={{ backgroundColor: kick.scored ? "#3ddc6b" : "#ff4d4d" }}
    />
  );
}
