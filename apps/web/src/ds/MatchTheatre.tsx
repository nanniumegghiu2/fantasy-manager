import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart2,
  Crown,
  FastForward,
  Pause,
  Play,
  X,
  Zap,
} from "lucide-react";
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
 * **Match Theatre 2D HD (Football Manager Style Match Engine)**
 *
 * Visualizzazione ad alta definizione delle partite 2D:
 * - **Palla HD**: Reticolo al neon, scia di movimento (motion trail) e fisica di quota (ballHeight).
 * - **Pallini Giocatori HD con Numeri di Maglia**: Maglie distinte casa/trasferta con numeri (1-11) e spotlight possessore.
 * - **Action FX Pop-up**: Banner e badge animati nel punto esatto dell'azione (GOAL, PARATA, PALO, CROSS, TIRO).
 * - **HUD Partita Live**: Inerzia di gara (Momentum), Statistiche live (Tiri, In Porta, Possesso, Angoli) e Timeline eventi.
 */

const MS_PER_MINUTE_BASE = 28;

interface Pallino {
  id: string;
  nostro: boolean;
  ruoloGenerico: "GK" | "DEF" | "MID" | "ATT";
  baseX: number;
  baseY: number;
  numero: number;
}

const DEPT_TO_RUOLO: Record<string, Pallino["ruoloGenerico"]> = {
  POR: "GK",
  DIF: "DEF",
  CC: "MID",
  ATT: "ATT",
};

/** Schieramento astratto di riserva se le formazioni reali non sono disponibili */
function creaPalliniGenerici(): Pallino[] {
  const formazioneNostra: { role: Pallino["ruoloGenerico"]; pos: [number, number]; numero: number }[] = [
    { role: "GK", pos: [4, 50], numero: 1 },
    { role: "DEF", pos: [20, 20], numero: 2 },
    { role: "DEF", pos: [18, 40], numero: 3 },
    { role: "DEF", pos: [18, 60], numero: 4 },
    { role: "DEF", pos: [20, 80], numero: 5 },
    { role: "MID", pos: [38, 25], numero: 6 },
    { role: "MID", pos: [35, 50], numero: 7 },
    { role: "MID", pos: [38, 75], numero: 8 },
    { role: "ATT", pos: [52, 30], numero: 9 },
    { role: "ATT", pos: [54, 50], numero: 10 },
    { role: "ATT", pos: [52, 70], numero: 11 },
  ];

  const nostri: Pallino[] = formazioneNostra.map((item, i) => ({
    id: `noi-${i}`,
    nostro: true,
    ruoloGenerico: item.role,
    baseX: item.pos[0],
    baseY: item.pos[1],
    numero: item.numero,
  }));

  const loro: Pallino[] = formazioneNostra.map((item, i) => ({
    id: `loro-${i}`,
    nostro: false,
    ruoloGenerico: item.role,
    baseX: 100 - item.pos[0],
    baseY: 100 - item.pos[1],
    numero: item.numero,
  }));

  return [...nostri, ...loro];
}

/** Le formazioni vere, con assegnazione deterministica dei numeri di maglia 1-11 */
function creaPalliniReali(context: MatchTheatreContext): Pallino[] {
  const nostrePos = layoutEleven(context.ourEleven, "for");
  const lorePos = layoutEleven(context.opponentEleven, "against");

  const mappaNumeri = (dept: string, index: number) => {
    if (dept === "POR") return 1;
    if (dept === "DIF") return 2 + (index % 4);
    if (dept === "CC") return 6 + (index % 4);
    return 9 + (index % 3);
  };

  const deptCountsNostri: Record<string, number> = { POR: 0, DIF: 0, CC: 0, ATT: 0 };
  const nostri: Pallino[] = context.ourEleven.map((p) => {
    const pos = nostrePos.get(p.playerId) ?? { x: 20, y: 50 };
    const count = deptCountsNostri[p.department] ?? 0;
    deptCountsNostri[p.department] = count + 1;
    return {
      id: p.playerId,
      nostro: true,
      ruoloGenerico: DEPT_TO_RUOLO[p.department] ?? "MID",
      baseX: pos.x,
      baseY: pos.y,
      numero: mappaNumeri(p.department, count),
    };
  });

  const deptCountsLoro: Record<string, number> = { POR: 0, DIF: 0, CC: 0, ATT: 0 };
  const loro: Pallino[] = context.opponentEleven.map((p) => {
    const pos = lorePos.get(p.playerId) ?? { x: 80, y: 50 };
    const count = deptCountsLoro[p.department] ?? 0;
    deptCountsLoro[p.department] = count + 1;
    return {
      id: p.playerId,
      nostro: false,
      ruoloGenerico: DEPT_TO_RUOLO[p.department] ?? "MID",
      baseX: pos.x,
      baseY: pos.y,
      numero: mappaNumeri(p.department, count),
    };
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
  context?: MatchTheatreContext;
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
  const [showStatsDrawer, setShowStatsDrawer] = useState(false);
  const prossima = useRef(0);

  const currentStep: ActionStep | null = useMemo(() => {
    if (!azione || !azione.steps || azione.steps.length === 0) return null;
    return azione.steps[stepIndex] ?? azione.steps[azione.steps.length - 1] ?? null;
  }, [azione, stepIndex]);

  // Gestione timer e riproduzione micro-fasi dell'azione
  useEffect(() => {
    if (finita || isPaused) return;

    let timer: ReturnType<typeof setTimeout>;

    if (azione && azione.steps && azione.steps.length > 0) {
      const step = meStep(azione, stepIndex);
      const durataFase = Math.max(200, (step.durationMs || 700) / speedMultiplier);

      timer = setTimeout(() => {
        if (stepIndex + 1 < azione.steps.length) {
          setStepIndex((idx) => idx + 1);
        } else {
          setAzione(null);
          setStepIndex(0);
          setMinuto((m) => m + 1);
        }
      }, durataFase);
    } else {
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

  useEffect(() => {
    if (!finita || isPaused || rigori.length === 0 || rigoreIndex >= rigori.length) return;
    const timer = setTimeout(() => setRigoreIndex((i) => i + 1), 900 / speedMultiplier);
    return () => clearTimeout(timer);
  }, [finita, isPaused, rigori.length, rigoreIndex, speedMultiplier]);

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

  // Statistiche live calcolate fino al minuto corrente
  const statsLive = useMemo(() => {
    const azioniViste = azioni.filter((a) => a.minute <= minuto);
    const tiriNostri =
      result.events.filter((e) => e.minute <= minuto && e.team === "for").length +
      azioniViste.filter((a) => a.team === "for" && (a.kind === "occasione" || a.kind === "parata" || a.kind === "palo")).length;
    const tiriLoro =
      result.events.filter((e) => e.minute <= minuto && e.team === "against").length +
      azioniViste.filter((a) => a.team === "against" && (a.kind === "occasione" || a.kind === "parata" || a.kind === "palo")).length;
    
    const inPortaNostri =
      parziale.nostri + azioniViste.filter((a) => a.team === "for" && a.kind === "parata").length;
    const inPortaLoro =
      parziale.loro + azioniViste.filter((a) => a.team === "against" && a.kind === "parata").length;

    const diff = tiriNostri - tiriLoro;
    const possessoNostri = Math.min(78, Math.max(22, 50 + diff * 4));
    
    return {
      tiriNostri,
      tiriLoro,
      inPortaNostri,
      inPortaLoro,
      possessoNostri,
      possessoLoro: 100 - possessoNostri,
      angoliNostri: Math.max(0, Math.floor(tiriNostri * 0.4)),
      angoliLoro: Math.max(0, Math.floor(tiriLoro * 0.4)),
    };
  }, [azioni, result.events, minuto, parziale]);

  // Calcolo Inerzia / Pressione di gara negli ultimi minuti
  const momentumPercent = useMemo(() => {
    const recenti = azioni.filter((a) => a.minute <= minuto && a.minute >= Math.max(0, minuto - 15));
    if (recenti.length === 0) return 50;
    const countFor = recenti.filter((a) => a.team === "for").length;
    return Math.round((countFor / recenti.length) * 100);
  }, [azioni, minuto]);

  const esito = outcomeOf(parziale.nostri, parziale.loro);
  const marcatoreNome = azione?.playerId ? nameOf(azione.playerId) : "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-1 sm:p-4 backdrop-blur-lg select-none"
    >
      {finita &&
        rigoreIndex >= rigori.length &&
        (penalties ? penalties.weWon : result.goalsFor > result.goalsAgainst) && <CelebrationConfetti />}
      <motion.div
        initial={{ scale: 0.94, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-emerald-500/30 bg-[#0d1520] shadow-2xl"
      >
        {/* Header con Risultato & Momentum HUD */}
        <header className="flex flex-col border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[10px] font-black tracking-widest text-emerald-400 uppercase">
                <Crown size={11} />
                {reason}
              </p>
              <p className="truncate text-sm leading-tight font-extrabold text-white">
                {clubName} <span className="text-slate-400 font-normal">vs</span> {opponent}
              </p>
            </div>
            <span
              className="shrink-0 rounded-2xl px-4 py-1.5 text-2xl font-black tabular-nums shadow-lg border border-white/10"
              style={{ backgroundColor: `${OUTCOME_COLOR[esito]}22`, color: OUTCOME_COLOR[esito] }}
            >
              {parziale.nostri} - {parziale.loro}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi la partita"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Gauge dell'Inerzia di Gara (Match Momentum Bar) */}
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase shrink-0">
              Inerzia
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800 p-0.5 border border-white/5 flex">
              <motion.div
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${momentumPercent}%` }}
              />
              <motion.div
                className="h-full rounded-full bg-rose-500 transition-all duration-500"
                style={{ width: `${100 - momentumPercent}%` }}
              />
            </div>
            <span className="text-[9px] font-bold text-slate-300 tabular-nums shrink-0">
              {momentumPercent}% / {100 - momentumPercent}%
            </span>
          </div>
        </header>

        {/* Campo da gioco 2D HD */}
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

          {/* Orologio Minuto + Badge Micro-Fase */}
          <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
            <span className="rounded-xl bg-black/80 backdrop-blur px-3 py-1 text-xs font-black text-white tabular-nums border border-emerald-400/40 shadow-lg">
              {Math.min(minuto, 90)}&apos;
            </span>

            {currentStep?.phaseLabel && (
              <motion.span
                key={currentStep.phaseLabel}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-xl bg-emerald-500 px-3 py-1 text-[10px] font-black text-slate-950 uppercase shadow-lg border border-emerald-300"
              >
                {currentStep.phaseLabel}
              </motion.span>
            )}
          </div>

          {/* Pulsante Statistiche Live Overlay */}
          <button
            type="button"
            onClick={() => setShowStatsDrawer((v) => !v)}
            className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-xl border border-white/20 bg-slate-900/80 px-2.5 py-1 text-xs font-extrabold text-white backdrop-blur hover:bg-slate-800 transition-colors shadow-lg"
          >
            <BarChart2 size={14} className="text-emerald-400" />
            Stats
          </button>

          {/* Drawer Statistiche Live */}
          <AnimatePresence>
            {showStatsDrawer && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                className="absolute top-12 right-3 z-30 w-64 rounded-2xl border border-white/20 bg-slate-900/95 p-3 backdrop-blur-md shadow-2xl text-xs text-white"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                  <span className="font-black text-emerald-400 uppercase tracking-wider text-[10px]">
                    Statistiche Partita
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowStatsDrawer(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <StatRow label="Tiri Totali" v1={statsLive.tiriNostri} v2={statsLive.tiriLoro} />
                  <StatRow label="In Porta" v1={statsLive.inPortaNostri} v2={statsLive.inPortaLoro} />
                  <StatRow label="Possesso Palla" v1={`${statsLive.possessoNostri}%`} v2={`${statsLive.possessoLoro}%`} />
                  <StatRow label="Calci d'Angolo" v1={statsLive.angoliNostri} v2={statsLive.angoliLoro} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Banner Cronaca Azione in Basso */}
          <AnimatePresence mode="wait">
            {azione && (
              <motion.div
                key={`${azione.minute}-${azione.kind}`}
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="absolute inset-x-3 bottom-3 z-20 rounded-2xl p-3 backdrop-blur-md shadow-2xl border border-white/20"
                style={{ backgroundColor: `${coloreAzione(azione)}ee` }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black tracking-widest text-black/80 uppercase">
                    {azione.minute}&apos; · {azione.team === "for" ? clubName : opponent}
                  </p>
                  <span className="text-[10px] font-bold text-black/70 uppercase tracking-wider">
                    {azione.kind}
                  </span>
                </div>
                <p className="text-sm sm:text-base leading-tight font-black text-slate-950 mt-0.5">
                  {azione.text}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rigori Spareggio Overlay */}
          {finita && rigori.length > 0 && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-md">
              <p className="text-[11px] font-black tracking-widest text-amber-300 uppercase">
                Sequenza dei Rigori
              </p>
              <div className="flex gap-2">
                {rigori.map((k, i) => (
                  <RigoreSegno key={i} kick={k} visto={i < rigoreIndex} />
                ))}
              </div>
              <p className="text-3xl font-black text-white tabular-nums">
                {rigori.slice(0, rigoreIndex).filter((k) => k.team === "for" && k.scored).length}
                {" - "}
                {rigori.slice(0, rigoreIndex).filter((k) => k.team === "against" && k.scored).length}
              </p>
              {rigoreIndex >= rigori.length && (
                <p
                  className="text-sm font-black uppercase tracking-wider"
                  style={{ color: penalties?.weWon ? "#3ddc6b" : "#ff4d4d" }}
                >
                  {penalties?.weWon ? "Vittoria ai Rigori!" : "Sconfitta ai Rigori"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Timeline Eventi della Partita */}
        <div className="border-t border-white/10 bg-slate-950 px-4 py-2 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
              Timeline:
            </span>
            {result.events.map((e, idx) => (
              <span
                key={idx}
                className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${
                  e.minute <= minuto
                    ? e.team === "for"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "bg-slate-800/40 text-slate-500"
                }`}
              >
                ⚽ {e.minute}&apos; {nameOf(e.scorerId).split(" ").pop()}
              </span>
            ))}
            {result.events.length === 0 && (
              <span className="text-[10px] italic text-slate-500">Nessun gol in partita</span>
            )}
          </div>
        </div>

        {/* Footer Controlli */}
        <footer className="flex items-center justify-between gap-3 border-t border-white/10 p-3 bg-slate-900/90">
          {!finita && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-200 hover:bg-white/15 hover:text-white transition-colors"
                title={isPaused ? "Riprendi" : "Pausa"}
              >
                {isPaused ? <Play size={17} /> : <Pause size={17} />}
              </button>

              <button
                type="button"
                onClick={() => setSpeedMultiplier((s) => (s === 1 ? 2 : 1))}
                className={`flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-black transition-colors ${
                  speedMultiplier === 2
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                    : "border-white/15 bg-white/5 text-slate-300"
                }`}
              >
                <Zap size={14} />
                {speedMultiplier}x Velocità
              </button>
            </div>
          )}

          <div className="flex-1">
            {finita ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-black text-slate-950 shadow-lg hover:bg-emerald-400 active:scale-[0.98] transition-transform"
              >
                Torna alla stagione
              </button>
            ) : (
              <button
                type="button"
                onClick={salta}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <FastForward size={16} />
                Salta al finale
              </button>
            )}
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}

function StatRow({ label, v1, v2 }: { label: string; v1: string | number; v2: string | number }) {
  return (
    <div className="flex items-center justify-between font-extrabold text-[11px]">
      <span className="text-emerald-400 w-10 text-left tabular-nums">{v1}</span>
      <span className="text-slate-400 font-semibold">{label}</span>
      <span className="text-rose-400 w-10 text-right tabular-nums">{v2}</span>
    </div>
  );
}

/** Campo da gioco 2D HD con Traiettorie avanzate e Pop-up d'Azione FX */
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
  ambientTick: number;
}) {
  const possessoAmbientale = useMemo(
    () => (azione ? null : palleggioAmbientale(pallini, ambientTick)),
    [azione, pallini, ambientTick],
  );

  const ballPos = useMemo(() => {
    if (currentStep) return { x: currentStep.toX, y: currentStep.toY };
    if (azione) return { x: azione.x, y: azione.y };
    if (possessoAmbientale) return possessoAmbientale;
    return { x: 50, y: 50 };
  }, [azione, currentStep, possessoAmbientale]);

  // Calcolo altezza/scala del pallone per la fisica 3D di quota
  const ballHeightStyle = useMemo(() => {
    const h = currentStep?.ballHeight ?? "ground";
    if (h === "high_arc") return { scale: 1.65, offsetY: -12, shadowSize: 14 };
    if (h === "low_arc") return { scale: 1.35, offsetY: -6, shadowSize: 10 };
    if (h === "rocket") return { scale: 1.45, offsetY: -3, shadowSize: 8 };
    return { scale: 1.0, offsetY: 0, shadowSize: 6 };
  }, [currentStep?.ballHeight]);

  const isGoalMoment =
    currentStep?.trajectory === "shot" &&
    (azione?.kind === "gol" || azione?.kind === "rigore");

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#1e5828] shadow-inner select-none border-b border-white/10">
      {/* Texture Erba HD a strisce erba scura/chiara */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0 10%, transparent 10% 20%)",
        }}
      />

      {/* Goal Flash / Goal Net Ripple Animato */}
      {isGoalMoment && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.9, 0.4] }}
          transition={{ repeat: Infinity, duration: 0.25 }}
          className={`absolute inset-y-0 ${
            azione.team === "for" ? "right-0 w-[10%]" : "left-0 w-[10%]"
          } bg-emerald-400/50 blur-sm border-l-2 border-emerald-300`}
        />
      )}

      {/* Segnatura del campo SVG HD */}
      <svg viewBox="0 0 100 62" preserveAspectRatio="none" className="absolute inset-0 h-full w-full pointer-events-none">
        <g stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" fill="none">
          <rect x="2" y="2" width="96" height="58" />
          <line x1="50" y1="2" x2="50" y2="60" />
          <circle cx="50" cy="31" r="8.5" />
          {/* Area di rigore sinistra */}
          <rect x="2" y="15" width="13" height="32" />
          <rect x="2" y="23" width="4.5" height="16" />
          <circle cx="11" cy="31" r="0.9" fill="rgba(255,255,255,0.9)" />
          {/* Area di rigore destra */}
          <rect x="85" y="15" width="13" height="32" />
          <rect x="93.5" y="23" width="4.5" height="16" />
          <circle cx="89" cy="31" r="0.9" fill="rgba(255,255,255,0.9)" />
        </g>

        {/* Traiettoria Palla SVG avanzata con gradiente scia */}
        {currentStep && (
          <TraiettoriaPalla step={currentStep} team={azione?.team ?? "for"} />
        )}
      </svg>

      {/* Action FX Pop-up sul punto esatto del campo dove avviene l'evento */}
      <AnimatePresence>
        {currentStep?.actionTag && (
          <motion.div
            key={`${currentStep.actionTag}-${currentStep.toX}-${currentStep.toY}`}
            initial={{ scale: 0.2, y: 10, opacity: 0 }}
            animate={{ scale: 1.2, y: -22, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className="absolute -translate-x-1/2 z-30 pointer-events-none"
            style={{ left: `${currentStep.toX}%`, top: `${currentStep.toY}%` }}
          >
            <ActionBadge tag={currentStep.actionTag} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 22 Pallini Giocatori HD con Numeri di Maglia e Colori Sociali */}
      {pallini.map((p) => {
        const pos = calcolaPosizioneGiocatore(p, meStep(azione, 0), currentStep, azione, ambientTick);
        const idNoto = currentStep && (currentStep.fromPlayerId || currentStep.toPlayerId);
        const isActiveActor =
          !!currentStep &&
          (idNoto
            ? p.id === currentStep.fromPlayerId || p.id === currentStep.toPlayerId
            : (currentStep.activeActor === "keeper" && p.ruoloGenerico === "GK" && p.nostro !== (azione?.team === "for")) ||
              (currentStep.activeActor === "shooter" && p.ruoloGenerico === "ATT" && p.nostro === (azione?.team === "for")) ||
              (currentStep.activeActor === "passer" && p.ruoloGenerico === "MID" && p.nostro === (azione?.team === "for")));

        const isKeeper = p.ruoloGenerico === "GK";

        return (
          <motion.div
            key={p.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            animate={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            transition={{ type: "spring", stiffness: 75, damping: 17 }}
          >
            {/* Spotlight Possesso Palla / Attore Attivo */}
            {isActiveActor && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ repeat: Infinity, duration: 0.9 }}
                className="absolute -inset-1.5 rounded-full border-2 border-amber-300 ring-4 ring-amber-400/40 shadow-xl"
              />
            )}

            {/* Pallino Giocatore con Numero di Maglia */}
            <span
              className="relative flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full shadow-lg border text-[10px] sm:text-[11px] font-black tabular-nums transition-transform"
              style={{
                backgroundColor: isKeeper
                  ? "#f59e0b"
                  : p.nostro
                    ? "#10b981"
                    : "#0f172a",
                borderColor: p.nostro ? "#ffffff" : "#cbd5e1",
                color: isKeeper ? "#000000" : "#ffffff",
                boxShadow: isActiveActor ? "0 0 12px rgba(251, 191, 36, 0.9)" : "0 2px 5px rgba(0,0,0,0.5)",
              }}
            >
              {p.numero}
            </span>

            {/* Etichetta Nome sopra il Marcatore al tiro */}
            {isActiveActor && currentStep.activeActor === "shooter" && scorerName && (
              <motion.span
                initial={{ y: 4, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-950/90 border border-amber-400/60 px-2 py-0.5 text-[9px] font-black text-amber-300 shadow-xl z-30"
              >
                ⚽ {scorerName}
              </motion.span>
            )}
          </motion.div>
        );
      })}

      {/* Ombra a Terra del Pallone */}
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 rounded-full bg-black/50 blur-xs pointer-events-none"
        style={{
          left: `${ballPos.x}%`,
          top: `${ballPos.y}%`,
          width: `${ballHeightStyle.shadowSize}px`,
          height: `${ballHeightStyle.shadowSize * 0.6}px`,
        }}
        animate={{ left: `${ballPos.x}%`, top: `${ballPos.y}%` }}
        transition={transizionePalla(currentStep?.trajectory)}
      />

      {/* Il Pallone da Calcio HD con Reticolo Neon & Elevazione */}
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
        style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%` }}
        animate={{ left: `${ballPos.x}%`, top: `${ballPos.y}%` }}
        transition={transizionePalla(currentStep?.trajectory)}
      >
        <motion.div
          animate={{ scale: ballHeightStyle.scale, y: ballHeightStyle.offsetY }}
          transition={{ type: "spring", stiffness: 180, damping: 15 }}
          className="relative flex items-center justify-center"
        >
          {/* Anello Neon Pulsante della Palla */}
          <span className="absolute -inset-1 rounded-full bg-amber-400/60 blur-xs animate-pulse" />
          <span className="block h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full bg-white shadow-2xl ring-2 ring-slate-950 border border-slate-200" />
        </motion.div>
      </motion.div>
    </div>
  );
}

/** Pop-up visivo d'impatto sul campo per i vari tipi di azione */
function ActionBadge({ tag }: { tag: string }) {
  switch (tag) {
    case "GOAL":
      return (
        <span className="flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-950 shadow-2xl border-2 border-white uppercase tracking-wider">
          ⚽ GOOOAL!
        </span>
      );
    case "SAVE":
      return (
        <span className="flex items-center gap-1 rounded-full bg-cyan-500 px-3 py-1 text-xs font-black text-white shadow-2xl border-2 border-white uppercase tracking-wider">
          🧤 PARATA!
        </span>
      );
    case "POST":
      return (
        <span className="flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-slate-950 shadow-2xl border-2 border-white uppercase tracking-wider">
          💥 PALO!
        </span>
      );
    case "CROSS":
      return (
        <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black text-slate-950 shadow-lg border border-white uppercase">
          🎯 CROSS
        </span>
      );
    case "SHOT":
      return (
        <span className="flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-black text-white shadow-lg border border-white uppercase">
          ⚡ TIRO!
        </span>
      );
    case "CARD":
      return (
        <span className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white shadow-2xl border-2 border-white uppercase">
          🟥 ESPULSIONE!
        </span>
      );
    default:
      return null;
  }
}

/** Disegna la scia o l'arco della palla con SVG avanzato */
function TraiettoriaPalla({ step, team }: { step: ActionStep; team: "for" | "against" }) {
  const { fromX, fromY, toX, toY, trajectory } = step;

  if (trajectory === "cross") {
    const midX = (fromX + toX) / 2;
    const midY = Math.min(fromY, toY) - 14;
    return (
      <g>
        <path
          d={`M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.2"
          strokeDasharray="2 2"
        />
        <circle cx={toX} cy={toY} r="1.5" fill="#f59e0b" />
      </g>
    );
  }

  if (trajectory === "shot") {
    return (
      <g>
        <line
          x1={fromX}
          y1={fromY}
          x2={toX}
          y2={toY}
          stroke={team === "for" ? "#34d399" : "#f87171"}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx={toX} cy={toY} r="1.8" fill={team === "for" ? "#34d399" : "#f87171"} />
      </g>
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
          strokeWidth="1.4"
          strokeDasharray="1.5 1.5"
        />
        <circle cx={fromX} cy={fromY} r="2" fill="#facc15" />
      </g>
    );
  }

  return (
    <line
      x1={fromX}
      y1={fromY}
      x2={toX}
      y2={toY}
      stroke="rgba(255,255,255,0.6)"
      strokeWidth="0.9"
      strokeDasharray="1.5 1.5"
    />
  );
}

function seedDaId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function derivaAmbientale(p: Pallino, tick: number): { x: number; y: number } {
  const seme = seedDaId(p.id);
  const fase = ((seme % 1000) / 1000) * Math.PI * 2;
  const periodo = 5 + (seme % 4);
  const ampX = 2 + (seme % 3);
  const ampY = 1.5 + ((seme >> 3) % 3);
  const t = tick / periodo + fase;
  const x = p.baseX + Math.sin(t) * ampX;
  const y = p.baseY + Math.cos(t * 0.85) * ampY;
  return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
}

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
  const progresso = passo / 2;
  return {
    x: a.baseX + (b.baseX - a.baseX) * progresso,
    y: a.baseY + (b.baseY - a.baseY) * progresso,
  };
}

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
  const idNoto = !!(fromPlayerId || toPlayerId);
  const eProtagonista = idNoto ? p.id === fromPlayerId || p.id === toPlayerId : undefined;

  if (
    activeActor === "keeper" &&
    p.nostro !== nostraAzione &&
    (idNoto ? eProtagonista : p.ruoloGenerico === "GK")
  ) {
    return { x: currentStep.toX, y: currentStep.toY };
  }

  if (
    p.nostro === nostraAzione &&
    (activeActor === "shooter" || activeActor === "passer") &&
    (idNoto ? eProtagonista : p.ruoloGenerico === "ATT")
  ) {
    return { x: currentStep.fromX, y: currentStep.fromY };
  }

  if (trajectory === "celebration" && p.nostro === nostraAzione) {
    if (idNoto ? eProtagonista : p.ruoloGenerico === "ATT") {
      return { x: currentStep.toX, y: currentStep.toY };
    }
    return {
      x: currentStep.toX + (p.baseX - 50) * 0.2,
      y: currentStep.toY + (p.baseY - 50) * 0.2,
    };
  }

  const targetX = currentStep.toX;
  const distanza = Math.abs(p.baseX - targetX);
  const nonPossidente = p.nostro !== nostraAzione;
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

function RigoreSegno({ kick, visto }: { kick: ShootoutKick; visto: boolean }) {
  const nostro = kick.team === "for";
  if (!visto) {
    return (
      <span
        className="block h-3.5 w-3.5 rounded-full border-2 opacity-40"
        style={{ borderColor: nostro ? "#ffffff" : "#94a3b8" }}
      />
    );
  }
  return (
    <span
      className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-black text-black shadow"
      style={{ backgroundColor: kick.scored ? "#3ddc6b" : "#ff4d4d" }}
    >
      {kick.scored ? "✓" : "✕"}
    </span>
  );
}
