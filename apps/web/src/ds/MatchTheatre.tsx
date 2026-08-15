import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Crown,
  FastForward,
  Gauge,
  Pause,
  Play,
  Radio,
  ShieldAlert,
  Square,
  Target,
  X,
} from "lucide-react";
import {
  GOAL_MOUTH,
  MATCH_SECONDS,
  ballAt,
  buildShootout,
  phaseIndexAt,
  simulateMatchFlow,
  tacticalPosition,
  type BallState,
  type MatchFlow,
  type MatchResult,
  type MatchTheatreContext,
  type PhaseFlash,
  type PitchPlayer,
  type PlayPhase,
  type ShootoutKick,
} from "@app/game-engine";
import { OUTCOME_COLOR, outcomeOf } from "./format";
import { CelebrationConfetti } from "./CelebrationConfetti";

/**
 * **Il Match Theatre 2D.**
 *
 * Il motore (`ds/matchSim.ts`) produce una partita intera come flusso continuo di possessi;
 * questo componente si limita a **guardarla scorrere**: a ogni fotogramma chiede al motore dov'è
 * il pallone e dove sta ciascuno dei ventidue, e disegna. Nessun calcolo di gioco vive qui — è
 * la stessa regola di confine fra motore e app che vale per tutto il progetto.
 *
 * ## Il problema del tempo, e come è risolto
 *
 * Novanta minuti di gioco continuo non stanno in novanta secondi: se si comprimesse tutto in
 * modo uniforme il pallone si muoverebbe sessanta volte troppo veloce e non si vedrebbe un
 * passaggio. La soluzione è un **orologio a velocità variabile**: i possessi che contano (gol,
 * parate, pali, cartellini rossi) scorrono a ritmo quasi naturale, mentre sul resto della
 * partita l'orologio corre — e mentre corre il campo lo dichiara, invece di fingere che nulla
 * stia succedendo. È il modo in cui si guarda davvero una partita in differita.
 */

/* -------------------------------------------------------------------------- */
/* Ritmo di riproduzione                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Secondi di gioco per ogni secondo reale durante un possesso che vale la pena vedere.
 *
 * I due numeri non sono a occhio: una partita ha una ventina di possessi "da vedere" per un
 * totale di circa 320 secondi di gioco, e il resto sono 5.000 secondi da attraversare. Con la
 * prima taratura (2,6 e 190) la partita durava due minuti e mezzo — misurato nel browser,
 * cinque minuti di gioco dopo dodici secondi reali. Così sta sotto il minuto e mezzo a 1x, e
 * chi vuole di più ha il 2x e il 4x.
 */
const RATE_LIVE = 4.5;
/** ...e durante il resto della partita, che scorre via. */
const RATE_SKIP = 330;
/**
 * ...e attorno a un gol, che è l'unica cosa che conta davvero in una partita.
 *
 * Rallenta **prima** che la palla arrivi (vedi `GOAL_SLOWDOWN_LEAD`), non dopo: il tiro, il
 * portiere superato e la palla che entra devono potersi vedere uno per uno.
 */
const RATE_GOAL = 1.15;
/** Quanti secondi di gioco prima della rete si comincia a rallentare. */
const GOAL_SLOWDOWN_LEAD = 3;
/** Un fotogramma non può mai far saltare più di così: protegge dalle schede in secondo piano. */
const MAX_STEP_SECONDS = 0.12;

type Velocita = 1 | 2 | 4;

/* -------------------------------------------------------------------------- */

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

interface Frame {
  second: number;
  phase: PlayPhase | null;
  ball: BallState;
  positions: Map<string, { x: number; y: number }>;
  correndo: boolean;
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
  const flow: MatchFlow = useMemo(
    () => simulateMatchFlow(result, seed, nameOf, context),
    [result, seed, nameOf, context],
  );
  const rigori = useMemo(
    () => (penalties ? buildShootout(penalties.weWon, seed) : []),
    [penalties, seed],
  );

  const [frame, setFrame] = useState<Frame>(() => primoFrame(flow));
  const [inPausa, setInPausa] = useState(false);
  const [velocita, setVelocita] = useState<Velocita>(1);
  const [finita, setFinita] = useState(false);
  const [rigoreIndex, setRigoreIndex] = useState(0);

  const orologio = useRef(0);
  const ultimoFrame = useRef<number | null>(null);

  /**
   * L'anello di animazione. Sta tutto qui perché è una cosa sola: far avanzare l'orologio e
   * chiedere al motore la fotografia di quell'istante. Il ritmo dipende dal possesso in corso —
   * è l'unica riga di "regia" del componente.
   */
  useEffect(() => {
    if (finita || inPausa) {
      ultimoFrame.current = null;
      return;
    }
    let handle = 0;
    const tick = (now: number) => {
      const precedente = ultimoFrame.current ?? now;
      ultimoFrame.current = now;
      const delta = Math.min(MAX_STEP_SECONDS, (now - precedente) / 1000);

      const indice = phaseIndexAt(flow.phases, orologio.current);
      const fase = flow.phases[indice] ?? null;
      const dentro = !!fase && orologio.current <= fase.endSecond;
      const correndo = !(dentro && fase!.notable);
      const versoIlGol =
        dentro && fase!.goalSecond !== undefined && orologio.current >= fase!.goalSecond - GOAL_SLOWDOWN_LEAD;
      const rate = (versoIlGol ? RATE_GOAL : correndo ? RATE_SKIP : RATE_LIVE) * velocita;

      orologio.current += delta * rate;
      if (orologio.current >= MATCH_SECONDS) {
        orologio.current = MATCH_SECONDS;
        setFrame(costruisciFrame(flow, MATCH_SECONDS));
        setFinita(true);
        return;
      }
      setFrame(costruisciFrame(flow, orologio.current));
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [flow, finita, inPausa, velocita]);

  // I rigori scorrono uno alla volta, a partita finita.
  useEffect(() => {
    if (!finita || inPausa || rigori.length === 0 || rigoreIndex >= rigori.length) return;
    const timer = setTimeout(() => setRigoreIndex((i) => i + 1), 850 / velocita);
    return () => clearTimeout(timer);
  }, [finita, inPausa, rigori.length, rigoreIndex, velocita]);

  const salta = useCallback(() => {
    orologio.current = MATCH_SECONDS;
    setFrame(costruisciFrame(flow, MATCH_SECONDS));
    setFinita(true);
    setRigoreIndex(rigori.length);
  }, [flow, rigori.length]);

  const minuto = Math.min(90, Math.floor(frame.second / 60) + (frame.second > 0 ? 1 : 0));

  /**
   * Cronaca, statistiche e inerzia scorrono tutte e tre l'elenco dei possessi: ricalcolarle a
   * ogni fotogramma significherebbe farlo sessanta volte al secondo per informazioni che
   * cambiano al massimo una volta al secondo di gioco. Il secondo arrotondato è la chiave.
   */
  const secondoIntero = Math.floor(frame.second);

  /**
   * Il punteggio scatta **nell'istante in cui il pallone entra**, non al cambio di minuto.
   *
   * Contarlo dai minuti degli eventi (com'era prima) lo faceva salire fino a un minuto prima o
   * dopo la rete mostrata a schermo: proprio sul momento in cui l'utente sta guardando il
   * tabellone. Il quarto di secondo come chiave del memo basta a farlo sembrare istantaneo
   * senza ricontare a ogni fotogramma.
   */
  const tacca = Math.round(frame.second * 4);
  const parziale = useMemo(() => {
    let nostri = 0;
    let loro = 0;
    for (const fase of flow.phases) {
      if (fase.outcome !== "gol") continue;
      if ((fase.goalSecond ?? fase.endSecond) > tacca / 4) continue;
      if (fase.team === "for") nostri++;
      else loro++;
    }
    return { nostri, loro };
  }, [flow.phases, tacca]);

  /** La cronaca: le ultime righe già passate, dalla più recente. */
  const cronaca = useMemo(() => {
    const righe: { minute: number; text: string; team: "for" | "against"; flash: PhaseFlash }[] = [];
    for (const fase of flow.phases) {
      if (!fase.commentary || fase.endSecond > secondoIntero) continue;
      righe.push({
        minute: Math.floor(fase.endSecond / 60) + 1,
        text: fase.commentary,
        team: fase.team,
        flash: fase.flash,
      });
    }
    return righe.reverse().slice(0, 4);
  }, [flow.phases, secondoIntero]);

  /** Le statistiche di quello che si è visto finora, non quelle di fine partita. */
  const stats = useMemo(() => vistoFinora(flow, secondoIntero), [flow, secondoIntero]);

  /** Chi sta spingendo negli ultimi minuti: l'inerzia della gara. */
  const inerzia = useMemo(() => {
    const finestra = flow.phases.filter(
      (p) => p.endSecond <= secondoIntero && p.endSecond >= secondoIntero - 600,
    );
    if (finestra.length === 0) return 50;
    const tempoNostro = finestra
      .filter((p) => p.team === "for")
      .reduce((s, p) => s + (p.endSecond - p.startSecond), 0);
    const totale = finestra.reduce((s, p) => s + (p.endSecond - p.startSecond), 0);
    return totale > 0 ? Math.round((tempoNostro / totale) * 100) : 50;
  }, [flow.phases, secondoIntero]);

  const esito = outcomeOf(parziale.nostri, parziale.loro);
  const vittoria = penalties ? penalties.weWon : result.goalsFor > result.goalsAgainst;

  /** Il pallone è appena entrato: da qui parte il lampeggio del gol, e dura la sospensione. */
  const golAdesso =
    !!frame.phase &&
    frame.phase.outcome === "gol" &&
    frame.phase.goalSecond !== undefined &&
    frame.second >= frame.phase.goalSecond &&
    frame.second <= frame.phase.endSecond;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-1 backdrop-blur-lg select-none sm:p-4"
    >
      {finita && rigoreIndex >= rigori.length && vittoria && <CelebrationConfetti />}

      <motion.div
        initial={{ scale: 0.95, y: 14, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-card border border-emerald-500/25 bg-[#0b1118] shadow-2xl"
      >
        <Intestazione
          reason={reason}
          clubName={clubName}
          opponent={opponent}
          parziale={parziale}
          colore={OUTCOME_COLOR[esito]}
          inerzia={inerzia}
          onClose={onClose}
        />

        <div className="relative">
          <Campo
            players={flow.players}
            frame={frame}
            clubName={clubName}
            opponent={opponent}
            nameOf={nameOf}
          />

          <Orologio minuto={minuto} correndo={frame.correndo} />

          <AnimatePresence>
            {golAdesso && (
              <BannerGol
                key={`gol-${frame.phase!.index}`}
                marcatore={cognome(nameOf(frame.phase!.scorerId))}
                squadra={frame.phase!.team === "for" ? clubName : opponent}
                nostro={frame.phase!.team === "for"}
              />
            )}
            {!golAdesso &&
              frame.phase?.flash &&
              !frame.correndo &&
              frame.second >= frame.phase.endSecond - 1.2 && (
                <Lampo key={`${frame.phase.index}-${frame.phase.flash}`} flash={frame.phase.flash} />
              )}
          </AnimatePresence>

          {finita && rigori.length > 0 && (
            <Rigori kicks={rigori} visti={rigoreIndex} weWon={!!penalties?.weWon} />
          )}
        </div>

        {/* Le statistiche stanno **sotto** il campo e non sopra: da riquadro in sovrimpressione
            coprivano l'angolo in cui si sviluppa metà delle azioni. */}
        <StrisciaStatistiche stats={stats} />

        <Cronaca righe={cronaca} clubName={clubName} opponent={opponent} />

        <footer className="flex items-center gap-2 border-t border-white/10 bg-slate-950/80 p-3">
          {!finita && (
            <>
              <button
                type="button"
                onClick={() => setInPausa((p) => !p)}
                aria-label={inPausa ? "Riprendi la partita" : "Metti in pausa"}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-white/15 bg-white/5 text-slate-200 transition-colors hover:bg-white/15 hover:text-white"
              >
                {inPausa ? <Play size={18} /> : <Pause size={18} />}
              </button>
              <button
                type="button"
                onClick={() => setVelocita((v) => (v === 1 ? 2 : v === 2 ? 4 : 1))}
                aria-label={`Velocità ${velocita}x, tocca per cambiare`}
                className={`flex h-11 shrink-0 items-center gap-1.5 rounded-control border px-3.5 text-label font-black transition-colors ${
                  velocita === 1
                    ? "border-white/15 bg-white/5 text-slate-300"
                    : "border-emerald-400/70 bg-emerald-500/20 text-emerald-300"
                }`}
              >
                <Gauge size={15} />
                {velocita}x
              </button>
            </>
          )}
          <div className="min-w-0 flex-1">
            {finita ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-card bg-emerald-500 py-3 text-body font-black text-slate-950 shadow-lg transition-transform hover:bg-emerald-400 active:scale-[0.98]"
              >
                Torna alla stagione
              </button>
            ) : (
              <button
                type="button"
                onClick={salta}
                className="flex w-full items-center justify-center gap-2 rounded-card border border-white/15 bg-white/5 py-2.5 text-body font-bold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
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

/* -------------------------------------------------------------------------- */
/* Il fotogramma: dove sono pallone e ventidue in questo istante               */
/* -------------------------------------------------------------------------- */

function primoFrame(flow: MatchFlow): Frame {
  return costruisciFrame(flow, 0);
}

/**
 * La fotografia di un istante.
 *
 * Due dettagli che valgono più di quanto sembri:
 *  - **chi porta palla è disegnato sul pallone**, non nella sua posizione tattica. Toglie di
 *    mezzo la circolarità (la forma dipende dal pallone, il pallone dai giocatori) ed è anche
 *    ciò che si vede davvero guardando dall'alto: il portatore *è* dov'è la palla;
 *  - **chi la sta per ricevere le va incontro**, con peso crescente man mano che il passaggio
 *    arriva. Senza, il pallone raggiungerebbe un punto vuoto e il ricevente comparirebbe dopo.
 */
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function costruisciFrame(flow: MatchFlow, second: number): Frame {
  const indice = phaseIndexAt(flow.phases, second);
  const phase = flow.phases[indice] ?? null;
  const dentro = !!phase && second <= phase.endSecond;
  const ball = phase ? ballAt(phase, second) : { x: 50, y: 50, height: 0, carrierId: null, receiverId: null, progress: 0, kind: "inizio" as const };
  const correndo = !(dentro && phase!.notable);

  const positions = new Map<string, { x: number; y: number }>();
  const ctx = {
    ball: { x: ball.x, y: ball.y },
    possession: (phase?.team ?? "for") as "for" | "against",
    intensity: phase?.notable ? 1 : 0.45,
  };

  // Il portiere che sta per essere battuto si tuffa **dalla parte sbagliata**: è ciò che rende
  // leggibile un gol dall'alto. Senza, il pallone entra mentre il portiere lo segue educatamente,
  // e la rete sembra un passaggio come un altro.
  const golInCorso = phase?.outcome === "gol" && ball.kind === "rete";
  const portiereBattuto = golInCorso
    ? (flow.players.find((p) => p.department === "POR" && p.side !== phase!.team)?.id ?? null)
    : null;

  for (const p of flow.players) {
    const base = tacticalPosition(p, ctx, second);
    let { x, y } = base;

    if (p.id === portiereBattuto) {
      const tuffo = ball.y > 50 ? -20 : 20;
      y = clamp(y + tuffo * Math.min(1, ball.progress * 2.5), 20, 80);
      x += (ball.x - x) * 0.25;
    }

    if (p.id === ball.carrierId && ball.progress < 0.35) {
      const peso = 1 - ball.progress / 0.35;
      x += (ball.x - x) * peso;
      y += (ball.y - y) * peso;
    }
    if (p.id === ball.receiverId && ball.progress > 0.4) {
      const peso = (ball.progress - 0.4) / 0.6;
      x += (ball.x - x) * peso * peso;
      y += (ball.y - y) * peso * peso;
    }
    positions.set(p.id, { x, y });
  }

  return { second, phase, ball, positions, correndo };
}

/** Quello che si è visto fino a questo istante, non il totale di fine partita. */
function vistoFinora(flow: MatchFlow, second: number) {
  const conta = { for: { tiri: 0, porta: 0, angoli: 0, falli: 0 }, against: { tiri: 0, porta: 0, angoli: 0, falli: 0 } };
  let tempoFor = 0;
  let tempoTot = 0;
  for (const fase of flow.phases) {
    if (fase.endSecond > second) break;
    const mia = conta[fase.team];
    const altra = conta[fase.team === "for" ? "against" : "for"];
    tempoTot += fase.endSecond - fase.startSecond;
    if (fase.team === "for") tempoFor += fase.endSecond - fase.startSecond;
    if (fase.outcome === "gol" || fase.outcome === "parata") {
      mia.tiri++;
      mia.porta++;
    } else if (fase.outcome === "fuori" || fase.outcome === "palo") {
      mia.tiri++;
    } else if (fase.outcome === "angolo") {
      mia.angoli++;
    } else if (fase.outcome === "fallo") {
      altra.falli++;
    }
  }
  const possesso = tempoTot > 0 ? Math.round((tempoFor / tempoTot) * 100) : 50;
  return { ...conta, possesso };
}

/* -------------------------------------------------------------------------- */
/* Il campo                                                                    */
/* -------------------------------------------------------------------------- */

const COLORI = {
  nostri: "#10b981",
  nostriBordo: "#ecfdf5",
  loro: "#1e293b",
  loroBordo: "#94a3b8",
  portiere: "#f59e0b",
} as const;

/**
 * Il campo in SVG, in coordinate 0-100 × 0-64.
 *
 * Tutto sta dentro un unico `<svg>` — pallone, ombra, ventidue giocatori, scia — perché il
 * fotogramma cambia sessanta volte al secondo: con altrettanti elementi DOM animati da una
 * libreria si perderebbero fotogrammi proprio nel momento in cui si guarda il gol.
 */
function Campo({
  players,
  frame,
  clubName,
  opponent,
  nameOf,
}: {
  players: PitchPlayer[];
  frame: Frame;
  clubName: string;
  opponent: string;
  nameOf: (id: string | null) => string;
}) {
  const { ball, positions, phase, correndo } = frame;
  const scia = useScia(ball, correndo);
  const alzato = ball.height;
  const golOra = phase?.flash === "GOL" && ball.kind === "rete";
  const portatore = ball.carrierId;
  // Solo il cognome: un nome legale per esteso ("Leon Christoph Goretzka") copre mezzo campo.
  const nomePortatore = portatore ? cognome(nameOf(portatore)) : "";

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-white/10 bg-[#12401f]">
      {/* Strisce di taglio dell'erba: due verdi vicini, mai un pattern appariscente. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 8.33%, rgba(0,0,0,0.07) 8.33% 16.66%)",
        }}
      />
      {/* Vignettatura: stacca il campo dal bordo del pannello. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.45) 100%)" }}
      />

      {golOra && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0, 0.28, 0] }}
          transition={{ duration: 0.9 }}
          className="pointer-events-none absolute inset-0 bg-white"
        />
      )}

      <svg
        viewBox="-1 0 102 64"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`Campo di gioco, ${clubName} contro ${opponent}`}
      >
        <Segnatura />
        <Porta lato="sinistra" gonfia={golOra && ball.x < 50} />
        <Porta lato="destra" gonfia={golOra && ball.x > 50} />

        {/* La scia del pallone: pochi punti che sbiadiscono, non un effetto luminoso. */}
        {scia.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y * 0.64}
            r={0.5 + (i / scia.length) * 0.6}
            fill="#ffffff"
            opacity={(i / scia.length) * 0.3}
          />
        ))}

        {/* I ventidue. L'ordine di disegno mette il portatore in cima. */}
        {players.map((p) => {
          const pos = positions.get(p.id) ?? p.base;
          const attivo = p.id === ball.carrierId || p.id === ball.receiverId;
          return (
            <Giocatore
              key={p.id}
              player={p}
              x={pos.x}
              y={pos.y * 0.64}
              attivo={attivo}
              inPrimoPiano={p.id === ball.carrierId}
            />
          );
        })}

        {/* Ombra a terra: resta al suolo mentre il pallone si alza. È il trucco che dà
            profondità a una vista 2D senza dover disegnare una terza dimensione. */}
        <ellipse
          cx={ball.x}
          cy={ball.y * 0.64}
          rx={0.85 + alzato * 0.5}
          ry={0.5 + alzato * 0.3}
          fill="rgba(0,0,0,0.45)"
        />
        {/* Sul gol il pallone si accende: è l'unico momento in cui va cercato con l'occhio. */}
        {golOra && (
          <motion.circle
            cx={ball.x}
            cy={ball.y * 0.64 - alzato * 3.2}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="0.5"
            animate={{ r: [1.4, 5.5], opacity: [0.9, 0] }}
            transition={{ duration: 0.75, repeat: Infinity }}
          />
        )}
        <circle
          cx={ball.x}
          cy={ball.y * 0.64 - alzato * 3.2}
          r={(golOra ? 1.35 : 0.95) + alzato * 0.5}
          fill="#ffffff"
          stroke={golOra ? "#fbbf24" : "rgba(15,23,42,0.85)"}
          strokeWidth={golOra ? 0.4 : 0.28}
        />
      </svg>

      {/* Il nome di chi ha il pallone: una sola etichetta, quella che serve. Sparisce sul gol,
          dove c'è già il banner col nome del marcatore e due etichette si sovrapporrebbero. */}
      <AnimatePresence>
        {!correndo && !golOra && nomePortatore && (
          <motion.span
            key={portatore}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-control border border-white/20 bg-slate-950/90 px-1.5 py-0.5 text-label font-black whitespace-nowrap text-white shadow-lg"
            // Il viewBox è allargato a −1..101 per contenere le porte: un overlay in HTML deve
            // riportare la coordinata su quella scala, altrimenti scivola di un punto.
            style={{ left: `${((ball.x + 1) / 102) * 100}%`, top: `${Math.max(7, ball.y - 5)}%` }}
          >
            {nomePortatore}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Quando l'orologio corre lo dichiara: fingere che nulla stia succedendo sarebbe peggio. */}
      <AnimatePresence>
        {correndo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent pb-2 pt-8"
          >
            <FastForward size={12} className="text-emerald-300" />
            <span className="text-micro font-black tracking-widest text-emerald-200 uppercase">
              Si gioca
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** L'ultima parola di un nome: sul campo c'è spazio per il cognome e basta. */
function cognome(nome: string): string {
  const parti = nome.trim().split(/\s+/);
  return parti[parti.length - 1] ?? nome;
}

/** La segnatura del campo, in proporzioni credibili. Grafica originale, nessun asset. */
function Segnatura() {
  return (
    <g stroke="rgba(255,255,255,0.55)" strokeWidth="0.32" fill="none">
      <rect x="2" y="2" width="96" height="60" />
      <line x1="50" y1="2" x2="50" y2="62" />
      <circle cx="50" cy="32" r="8" />
      <circle cx="50" cy="32" r="0.6" fill="rgba(255,255,255,0.8)" stroke="none" />
      {/* Area sinistra */}
      <rect x="2" y="14" width="14" height="36" />
      <rect x="2" y="24" width="5" height="16" />
      <circle cx="11.5" cy="32" r="0.5" fill="rgba(255,255,255,0.8)" stroke="none" />
      <path d="M 16 25.5 A 8 8 0 0 1 16 38.5" />
      {/* Area destra */}
      <rect x="84" y="14" width="14" height="36" />
      <rect x="93" y="24" width="5" height="16" />
      <circle cx="88.5" cy="32" r="0.5" fill="rgba(255,255,255,0.8)" stroke="none" />
      <path d="M 84 25.5 A 8 8 0 0 0 84 38.5" />
      {/* Bandierine d'angolo */}
      <path d="M 2 3.2 A 1.2 1.2 0 0 0 3.2 2" />
      <path d="M 96.8 2 A 1.2 1.2 0 0 0 98 3.2" />
      <path d="M 2 60.8 A 1.2 1.2 0 0 1 3.2 62" />
      <path d="M 96.8 62 A 1.2 1.2 0 0 1 98 60.8" />
    </g>
  );
}

/**
 * La porta, con la rete disegnata e la retina che si gonfia quando la palla entra.
 *
 * Sta **fuori** dalla riga di fondo (il campo va da 2 a 98, la porta da −1 a 2 e da 98 a 101):
 * è ciò che permette al pallone di essere visto *superare* la linea invece di fermarcisi sopra,
 * che era il difetto segnalato. Il viewBox del campo è allargato apposta per contenerle.
 *
 * La bocca della porta corrisponde a `GOAL_MOUTH` del motore, riportata sulla scala verticale
 * del disegno (0-64): se i due numeri divergessero, la palla entrerebbe accanto al palo.
 */
function Porta({ lato, gonfia }: { lato: "sinistra" | "destra"; gonfia: boolean }) {
  const yTop = (GOAL_MOUTH.yMin / 100) * 64 - 2;
  const alt = ((GOAL_MOUTH.yMax - GOAL_MOUTH.yMin) / 100) * 64 + 4;
  const x = lato === "sinistra" ? -0.9 : 98;
  const larg = 2.9;
  const maglie = 5;
  return (
    <g>
      <motion.rect
        x={x}
        y={yTop}
        width={larg}
        height={alt}
        fill={gonfia ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)"}
        stroke="#ffffff"
        strokeWidth="0.45"
        animate={gonfia ? { opacity: [1, 0.45, 1] } : { opacity: 1 }}
        transition={gonfia ? { duration: 0.42, repeat: Infinity } : { duration: 0.2 }}
      />
      {/* La rete: poche maglie, quel tanto che basta perché si legga come rete. */}
      <g stroke="rgba(255,255,255,0.42)" strokeWidth="0.14">
        {Array.from({ length: maglie }, (_, i) => (
          <line
            key={`h${i}`}
            x1={x}
            y1={yTop + ((i + 1) * alt) / (maglie + 1)}
            x2={x + larg}
            y2={yTop + ((i + 1) * alt) / (maglie + 1)}
          />
        ))}
        <line x1={x + larg / 2} y1={yTop} x2={x + larg / 2} y2={yTop + alt} />
      </g>
    </g>
  );
}

function Giocatore({
  player,
  x,
  y,
  attivo,
  inPrimoPiano,
}: {
  player: PitchPlayer;
  x: number;
  y: number;
  attivo: boolean;
  inPrimoPiano: boolean;
}) {
  const portiere = player.department === "POR";
  const riempimento = portiere ? COLORI.portiere : player.side === "for" ? COLORI.nostri : COLORI.loro;
  const bordo = portiere ? "#fef3c7" : player.side === "for" ? COLORI.nostriBordo : COLORI.loroBordo;
  const testo = portiere ? "#1c1206" : "#ffffff";
  const r = 1.85;

  return (
    <g transform={`translate(${x} ${y})`} style={{ transition: "transform 90ms linear" }}>
      {attivo && (
        <circle r={r + 0.9} fill="none" stroke="#fbbf24" strokeWidth="0.4" opacity={inPrimoPiano ? 0.95 : 0.5} />
      )}
      <ellipse cx="0" cy={r * 0.75} rx={r * 0.85} ry={r * 0.35} fill="rgba(0,0,0,0.3)" />
      <circle r={r} fill={riempimento} stroke={bordo} strokeWidth="0.32" />
      <text
        y="0.72"
        textAnchor="middle"
        fontSize="2"
        fontWeight="800"
        fill={testo}
        style={{ pointerEvents: "none" }}
      >
        {player.shirt}
      </text>
    </g>
  );
}

/**
 * La scia del pallone: le ultime posizioni.
 *
 * L'aggiornamento sta in un effetto e non nel corpo del render: mutare un ref mentre si
 * disegna renderebbe il render impuro, e col doppio render di StrictMode la scia si
 * riempirebbe al doppio della velocità.
 */
function useScia(ball: BallState, correndo: boolean) {
  const punti = useRef<{ x: number; y: number }[]>([]);
  useEffect(() => {
    if (correndo) {
      punti.current = [];
      return;
    }
    punti.current.push({ x: ball.x, y: ball.y });
    if (punti.current.length > 9) punti.current.shift();
  }, [ball.x, ball.y, correndo]);
  return punti.current;
}

/* -------------------------------------------------------------------------- */
/* HUD                                                                         */
/* -------------------------------------------------------------------------- */

function Intestazione({
  reason,
  clubName,
  opponent,
  parziale,
  colore,
  inerzia,
  onClose,
}: {
  reason: string;
  clubName: string;
  opponent: string;
  parziale: { nostri: number; loro: number };
  colore: string;
  inerzia: number;
  onClose: () => void;
}) {
  return (
    <header className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-micro font-black tracking-widest text-emerald-400 uppercase">
            <Crown size={11} />
            {reason}
          </p>
          <p className="truncate text-body leading-tight font-extrabold text-white">
            {clubName} <span className="font-normal text-slate-500">vs</span> {opponent}
          </p>
        </div>
        <span
          className="shrink-0 rounded-card border border-white/10 px-4 py-1.5 text-display font-black tabular-nums shadow-lg"
          style={{ backgroundColor: `${colore}22`, color: colore }}
        >
          {parziale.nostri} - {parziale.loro}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi la partita"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="shrink-0 text-micro font-black tracking-wider text-slate-500 uppercase">
          Inerzia
        </span>
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-emerald-400 transition-[width] duration-700"
            style={{ width: `${inerzia}%` }}
          />
          <div
            className="h-full bg-rose-500 transition-[width] duration-700"
            style={{ width: `${100 - inerzia}%` }}
          />
        </div>
        <span className="shrink-0 text-label font-bold text-slate-400 tabular-nums">
          {inerzia}/{100 - inerzia}
        </span>
      </div>
    </header>
  );
}

function Orologio({ minuto, correndo }: { minuto: number; correndo: boolean }) {
  return (
    <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-control border border-emerald-400/40 bg-black/80 px-3 py-1 shadow-lg backdrop-blur">
      <Radio size={11} className={correndo ? "text-slate-500" : "animate-pulse text-emerald-400"} />
      <span className="text-label font-black text-white tabular-nums">{minuto}&apos;</span>
    </div>
  );
}

/**
 * Le statistiche, su una riga sola sotto il campo.
 *
 * Erano un riquadro in alto a destra **sopra** il campo, e coprivano l'angolo dell'area in cui
 * si sviluppa buona parte delle azioni offensive: proprio dove si guarda. Su una striscia
 * orizzontale ci stanno tutte e non nascondono niente; su schermo stretto scorre lateralmente.
 */
function StrisciaStatistiche({ stats }: { stats: ReturnType<typeof vistoFinora> }) {
  const voci: [string, string | number, string | number][] = [
    ["Tiri", stats.for.tiri, stats.against.tiri],
    ["In porta", stats.for.porta, stats.against.porta],
    ["Angoli", stats.for.angoli, stats.against.angoli],
    ["Falli", stats.for.falli, stats.against.falli],
    ["Possesso", `${stats.possesso}%`, `${100 - stats.possesso}%`],
  ];
  return (
    <div className="flex gap-4 overflow-x-auto border-b border-white/10 bg-slate-950/70 px-3 py-1.5">
      {voci.map(([label, a, b]) => (
        <div key={label} className="flex shrink-0 items-center gap-1.5 text-label font-extrabold">
          <span className="text-emerald-400 tabular-nums">{a}</span>
          <span className="text-micro font-semibold tracking-wide text-slate-500 uppercase">
            {label}
          </span>
          <span className="text-rose-400 tabular-nums">{b}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Il gol a schermo: grande, lampeggiante, con chi l'ha fatto.
 *
 * Il lampeggio non è decorativo — è il segnale che distingue l'unico evento che cambia la
 * partita da tutti gli altri, che usano il badge sobrio di `Lampo`.
 */
function BannerGol({
  marcatore,
  squadra,
  nostro,
}: {
  marcatore: string;
  squadra: string;
  nostro: boolean;
}) {
  const colore = nostro ? "#34d399" : "#fb7185";
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.15, opacity: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 18 }}
      className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-1"
    >
      <motion.span
        animate={{ opacity: [1, 0.25, 1], scale: [1, 1.06, 1] }}
        transition={{ duration: 0.62, repeat: Infinity, ease: "easeInOut" }}
        className="text-5xl font-black tracking-[0.2em] drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)] sm:text-6xl"
        style={{ color: colore, WebkitTextStroke: "1.5px rgba(0,0,0,0.55)" }}
      >
        GOL
      </motion.span>
      <motion.span
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.18 }}
        className="rounded-full border px-4 py-1 text-body font-black tracking-wide text-white uppercase shadow-2xl backdrop-blur"
        style={{ borderColor: colore, backgroundColor: "rgba(2,6,23,0.75)" }}
      >
        {marcatore}
      </motion.span>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-micro font-bold tracking-widest text-slate-300 uppercase"
      >
        {squadra}
      </motion.span>
    </motion.div>
  );
}

const LAMPO: Record<Exclude<PhaseFlash, null>, { testo: string; colore: string; icona: typeof Target }> = {
  GOL: { testo: "Gol", colore: "#fbbf24", icona: Target },
  PARATA: { testo: "Parata", colore: "#38bdf8", icona: ShieldAlert },
  PALO: { testo: "Palo", colore: "#f97316", icona: ShieldAlert },
  FUORI: { testo: "Fuori", colore: "#94a3b8", icona: Target },
  GIALLO: { testo: "Ammonizione", colore: "#facc15", icona: Square },
  ROSSO: { testo: "Espulsione", colore: "#ef4444", icona: Square },
};

function Lampo({ flash }: { flash: Exclude<PhaseFlash, null> }) {
  const { testo, colore, icona: Icona } = LAMPO[flash];
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: "spring", stiffness: 460, damping: 24 }}
      className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center"
    >
      <span
        className="flex items-center gap-2 rounded-card border-2 px-5 py-2 text-title font-black tracking-wide uppercase shadow-2xl"
        style={{ backgroundColor: `${colore}25`, borderColor: colore, color: colore }}
      >
        <Icona size={20} />
        {testo}
      </span>
    </motion.div>
  );
}

function Cronaca({
  righe,
  clubName,
  opponent,
}: {
  righe: { minute: number; text: string; team: "for" | "against"; flash: PhaseFlash }[];
  clubName: string;
  opponent: string;
}) {
  return (
    <div className="min-h-[76px] border-t border-white/10 bg-slate-950 px-3 py-2">
      <AnimatePresence initial={false}>
        {righe.map((r, i) => (
          <motion.div
            key={`${r.minute}-${r.text}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: i === 0 ? 1 : 0.42, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="flex items-baseline gap-2 py-0.5"
          >
            <span
              className="w-8 shrink-0 text-right text-label font-black tabular-nums"
              style={{ color: r.team === "for" ? "#34d399" : "#fb7185" }}
            >
              {r.minute}&apos;
            </span>
            <span className="min-w-0 flex-1 truncate text-label leading-tight font-semibold text-slate-200">
              {r.text}
            </span>
            <span className="hidden shrink-0 text-micro font-bold text-slate-600 uppercase sm:inline">
              {r.team === "for" ? clubName : opponent}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
      {righe.length === 0 && (
        <p className="py-1 text-label italic text-slate-600">La partita è appena cominciata.</p>
      )}
    </div>
  );
}

function Rigori({
  kicks,
  visti,
  weWon,
}: {
  kicks: ShootoutKick[];
  visti: number;
  weWon: boolean;
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 backdrop-blur-md">
      <p className="text-micro font-black tracking-widest text-amber-300 uppercase">
        Sequenza dei rigori
      </p>
      <div className="flex gap-1.5">
        {kicks.map((k, i) => (
          <Segno key={i} kick={k} visto={i < visti} />
        ))}
      </div>
      <p className="text-display font-black text-white tabular-nums">
        {kicks.slice(0, visti).filter((k) => k.team === "for" && k.scored).length}
        {" - "}
        {kicks.slice(0, visti).filter((k) => k.team === "against" && k.scored).length}
      </p>
      {visti >= kicks.length && (
        <p
          className="text-body font-black tracking-wider uppercase"
          style={{ color: weWon ? "#3ddc6b" : "#ff4d4d" }}
        >
          {weWon ? "Vittoria ai rigori" : "Sconfitta ai rigori"}
        </p>
      )}
    </div>
  );
}

function Segno({ kick, visto }: { kick: ShootoutKick; visto: boolean }) {
  if (!visto) {
    return (
      <span
        className="block h-3.5 w-3.5 rounded-full border-2 opacity-40"
        style={{ borderColor: kick.team === "for" ? "#ffffff" : "#94a3b8" }}
      />
    );
  }
  return (
    <span
      className="block h-3.5 w-3.5 rounded-full shadow"
      style={{ backgroundColor: kick.scored ? "#3ddc6b" : "#ff4d4d" }}
      aria-label={kick.scored ? "Rigore realizzato" : "Rigore sbagliato"}
    />
  );
}
