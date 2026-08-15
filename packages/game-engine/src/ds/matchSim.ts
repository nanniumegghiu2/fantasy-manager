/**
 * **Il motore 2D della partita**: un flusso di gioco continuo, non più sette azioni isolate.
 *
 * ## Cosa cambia rispetto a `buildHighlights`
 *
 * La versione precedente produceva un pugno di "azioni salienti" con una coreografia scritta a
 * mano — coordinate fisse, durate fisse, sempre gli stessi quattro passaggi. Fra un'azione e
 * l'altra non succedeva nulla: i ventidue pallini oscillavano su una sinusoide e il pallone
 * faceva un palleggio finto. Era un carosello di clip, non una partita.
 *
 * Qui la partita è **un unico flusso continuo di possessi** che copre tutti i 90 minuti. La
 * palla passa di piede in piede fra giocatori veri, ogni possesso nasce dove è finito quello
 * prima, e i ventidue si dispongono con una **forma di squadra** che scorre col pallone
 * (`tacticalPosition`) invece di vibrare sul posto. È il modello che rende leggibile la vista
 * 2D di Football Manager: non serve animare tutto, serve che il *blocco* si muova come un
 * blocco.
 *
 * ## L'invariante che regge tutto, e che qui è più stretta di prima
 *
 * Questo modulo **non simula il risultato**. Riceve il `MatchResult` già deciso da
 * `simulateMatch` e ci costruisce attorno una partita coerente: i gol sono quelli, ai minuti
 * di quelli, dei marcatori di quelli, e **nessun altro possesso può finire in rete** (il tipo
 * di conclusione si decide *prima* di costruire la catena di passaggi, e "gol" è un esito
 * riservato ai possessi programmati). Guardare una partita o saltarla dà esattamente lo stesso
 * esito — la proprietà che rende indolore la scelta di `KeyMatchPrompt`.
 *
 * Anche le **statistiche** (tiri, parate, angoli, possesso) escono dal flusso invece di essere
 * inventate a parte: quello che si legge nell'HUD è il conto di quello che si è visto.
 */
import { derivedRandom, hashSeed } from "../random";
import type { MatchEvent, MatchResult } from "../season/matchModel";
import type { Department } from "@app/shared-types";

/* -------------------------------------------------------------------------- */
/* Il campo e chi ci sta dentro                                                */
/* -------------------------------------------------------------------------- */

/** Durata della partita in secondi di gioco. Il campo è 0-100 in entrambe le dimensioni. */
export const MATCH_SECONDS = 5400;

/**
 * La porta, in coordinate di campo.
 *
 * Il pallone di un gol deve finire **dentro la rete**, non sulla linea: `x` oltre la riga di
 * fondo (che sta a 2 e a 98) e `y` dentro la bocca della porta. Prima la rete arrivava a 100 o
 * a 0, cioè sul bordo esatto del riquadro, e a schermo si vedeva il pallone *fermarsi* sulla
 * linea invece di superare il portiere ed entrare.
 */
export const GOAL_MOUTH = { yMin: 41, yMax: 59, insideFor: 99, insideAgainst: 1 } as const;

/**
 * Quanto la palla resta in rete prima che il gioco riprenda.
 *
 * Non è un dettaglio di presentazione: senza questa sospensione la fase finisce nell'istante in
 * cui il pallone entra e il possesso successivo comincia subito, quindi il gol — l'unica cosa
 * che davvero conta in una partita — durerebbe meno di un passaggio qualunque.
 */
const GOAL_HOLD_SECONDS = 4.5;

/** Un titolare, per posizionarlo sul campo condiviso: basta sapere dove gioca. */
export interface TheatrePlayer {
  playerId: string;
  department: Department;
}

/** Le due formazioni reali in campo: la nostra rosa vera, l'undici migliore dell'avversaria. */
export interface MatchTheatreContext {
  ourEleven: readonly TheatrePlayer[];
  opponentEleven: readonly TheatrePlayer[];
}

/**
 * Un giocatore sul campo 2D: dove sta di base, che numero porta, e la fase della sua
 * oscillazione personale (`wobble`) — derivata dall'id, così due compagni non respirano mai
 * all'unisono, che è la cosa che più di ogni altra fa sembrare finta una vista 2D.
 */
export interface PitchPlayer {
  id: string;
  side: "for" | "against";
  department: Department;
  base: { x: number; y: number };
  shirt: number;
  wobble: number;
}

/**
 * Le corsie di ciascun reparto, in coordinate assolute del campo.
 *
 * I centrocampi delle due squadre stanno a 45 e 55 e non entrambi a 50: sovrapposti erano un
 * grumo illeggibile di dieci pallini.
 */
const LANE_X: Record<Department, number> = { POR: 5, DIF: 22, CC: 43, ATT: 68 };

/** Quanto si apre un reparto in larghezza (1 = tutta l'ampiezza del campo). */
const LANE_SPREAD: Record<Department, number> = { POR: 0, DIF: 0.78, CC: 0.76, ATT: 0.5 };

/**
 * Quanto un giocatore largo del reparto sta più avanti di uno centrale.
 *
 * Senza questo scarto una linea a quattro è quattro pallini sulla stessa verticale, e con
 * quattro centrocampisti il campo mostra un muro invece di una squadra. I terzini e gli esterni
 * stanno più alti dei centrali: è vero nel calcio ed è ciò che rende leggibile la forma.
 */
const WIDE_ADVANCE: Record<Department, number> = { POR: 0, DIF: 6, CC: 7, ATT: 3 };

/**
 * Posiziona gli undici titolari **veri** di una squadra sul campo condiviso (0-100), per
 * reparto: stessa corsia orizzontale per chi gioca lo stesso ruolo, distribuiti in verticale
 * con un'ampiezza che dipende dal reparto (una linea di difesa è larga, due punte no).
 */
export function layoutEleven(
  eleven: readonly TheatrePlayer[],
  side: "for" | "against",
): Map<string, { x: number; y: number }> {
  const byDept = new Map<Department, TheatrePlayer[]>();
  for (const p of eleven) {
    const list = byDept.get(p.department) ?? [];
    list.push(p);
    byDept.set(p.department, list);
  }
  const positions = new Map<string, { x: number; y: number }>();
  for (const [dept, players] of byDept) {
    const baseX = LANE_X[dept];
    const spread = LANE_SPREAD[dept];
    players.forEach((p, i) => {
      const quota = players.length === 1 ? 0 : i / (players.length - 1) - 0.5;
      const y = 50 + quota * 100 * spread;
      // Chi gioca largo sta un po' più avanti di chi gioca in mezzo: la linea si incurva.
      const avanzato = (Math.abs(quota) * 2 - 0.45) * WIDE_ADVANCE[dept];
      const x = side === "for" ? baseX + avanzato : 100 - baseX - avanzato;
      positions.set(p.playerId, { x: Math.round(x), y: Math.round(y) });
    });
  }
  return positions;
}

/** Numeri di maglia plausibili: 1 al portiere, 2-5 dietro, 6-8 in mezzo, 9-11 davanti. */
function shirtNumber(dept: Department, indexInDept: number): number {
  if (dept === "POR") return 1;
  if (dept === "DIF") return 2 + (indexInDept % 4);
  if (dept === "CC") return 6 + (indexInDept % 4);
  return 9 + (indexInDept % 3);
}

/** Un undici generico, quando le formazioni vere non sono disponibili (test, dati mancanti). */
function genericEleven(prefix: string): TheatrePlayer[] {
  const shape: [Department, number][] = [
    ["POR", 1],
    ["DIF", 4],
    ["CC", 4],
    ["ATT", 2],
  ];
  const out: TheatrePlayer[] = [];
  for (const [department, quanti] of shape) {
    for (let i = 0; i < quanti; i++) {
      out.push({ playerId: `${prefix}-${department.toLowerCase()}${i + 1}`, department });
    }
  }
  return out;
}

/**
 * I ventidue giocatori sul campo, pronti per essere disegnati e per ricevere il pallone.
 *
 * Senza contesto costruisce due undici anonimi: il flusso resta generabile e testabile senza
 * dover montare una carriera vera.
 */
export function buildPitchPlayers(context?: MatchTheatreContext): PitchPlayer[] {
  const ourEleven = context?.ourEleven?.length ? context.ourEleven : genericEleven("noi");
  const oppEleven = context?.opponentEleven?.length ? context.opponentEleven : genericEleven("loro");

  const build = (eleven: readonly TheatrePlayer[], side: "for" | "against"): PitchPlayer[] => {
    const pos = layoutEleven(eleven, side);
    const conta: Record<string, number> = {};
    return eleven.map((p) => {
      const n = conta[p.department] ?? 0;
      conta[p.department] = n + 1;
      return {
        id: p.playerId,
        side,
        department: p.department,
        base: pos.get(p.playerId) ?? { x: side === "for" ? 25 : 75, y: 50 },
        shirt: shirtNumber(p.department, n),
        // Fase dell'oscillazione: stabile per giocatore, diversa da compagno a compagno.
        wobble: (hashSeed(p.playerId) % 6283) / 1000,
      };
    });
  };

  return [...build(ourEleven, "for"), ...build(oppEleven, "against")];
}

/* -------------------------------------------------------------------------- */
/* La forma di squadra: il cuore dell'aspetto "FM"                             */
/* -------------------------------------------------------------------------- */

/** Quanto ogni reparto sale quando la squadra ha il pallone. */
const PUSH: Record<Department, number> = { POR: 4, DIF: 13, CC: 12, ATT: 8 };
/** Quanto ogni reparto arretra quando la squadra il pallone non ce l'ha. */
const DROP: Record<Department, number> = { POR: 1, DIF: 5, CC: 12, ATT: 17 };
/** Quanto la linea di reparto scorre in profondità seguendo il pallone. */
const LINE_SHIFT: Record<Department, number> = { POR: 0.06, DIF: 0.3, CC: 0.34, ATT: 0.26 };
/** Quanto un reparto scivola lateralmente verso la fascia dove sta il pallone. */
const SIDE_SLIDE: Record<Department, number> = { POR: 0.3, DIF: 0.3, CC: 0.26, ATT: 0.2 };

export interface ShapeContext {
  ball: { x: number; y: number };
  /** Chi ha il pallone in questo istante. */
  possession: "for" | "against";
  /** 0 = giro palla tranquillo, 1 = azione da gol: il blocco si stringe attorno alla palla. */
  intensity: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Dove sta un giocatore in questo istante.
 *
 * Non è un'animazione decorativa: è un modello di squadra, e le quattro regole che lo compongono
 * sono quelle che si leggono guardando una partita dall'alto.
 *
 *  1. **Il blocco sale e scende col possesso**: chi ha la palla alza la linea, chi non ce l'ha
 *     rientra. È il movimento che si nota di più e che mancava del tutto.
 *  2. **La linea segue la palla in profondità**: la difesa di *entrambe* le squadre scorre nella
 *     stessa direzione assoluta del pallone, perché è il pallone a decidere dov'è il fronte.
 *  3. **Scivolamento laterale**: il reparto si compatta sulla fascia dove si gioca, lasciando
 *     libero il lato debole — la cosa che rende riconoscibile una squadra ordinata.
 *  4. **Convergenza di prossimità**: chi è vicino al pallone ci va davvero, e chi difende ci va
 *     più di chi accompagna (pressing). Senza questa regola i pallini restano equidistanti e la
 *     scena sembra una tabella, non una partita.
 *
 * Sopra a tutto, un'oscillazione minima per giocatore: nessuno sta mai perfettamente fermo.
 */
export function tacticalPosition(
  player: Pick<PitchPlayer, "base" | "department" | "side" | "wobble">,
  ctx: ShapeContext,
  time: number,
): { x: number; y: number } {
  const dir = player.side === "for" ? 1 : -1;
  const dept = player.department;
  const attacking = ctx.possession === player.side;

  if (dept === "POR") {
    // Il portiere non fa parte del blocco: sta sui pali, esce quando la palla si avvicina.
    const goalLine = player.side === "for" ? 3 : 97;
    const distanzaDallaPorta =
      player.side === "for" ? clamp(ctx.ball.x, 0, 100) : clamp(100 - ctx.ball.x, 0, 100);
    const pericolo = clamp(1 - distanzaDallaPorta / 38, 0, 1);
    return {
      x: clamp(goalLine + dir * (1.5 + pericolo * 9), 2, 98),
      y: clamp(50 + (ctx.ball.y - 50) * (0.3 + 0.28 * pericolo), 22, 78),
    };
  }

  // 1. Il blocco sale o rientra.
  let x = player.base.x + dir * (attacking ? PUSH[dept] : -DROP[dept]);
  // 2. La linea scorre col pallone.
  x += (ctx.ball.x - 50) * LINE_SHIFT[dept];
  // 3. Scivolamento laterale.
  let y = player.base.y + (ctx.ball.y - 50) * SIDE_SLIDE[dept];

  // 4. Convergenza: più si è vicini al pallone, più ci si va.
  //
  // Il raggio è stretto di proposito. La prima taratura ne usava uno largo (42 su un campo di
  // 100) e il risultato, visto nel browser, era che *tutti* convergevano sempre: i ventidue si
  // rannicchiavano attorno al pallone e la forma di squadra spariva. Deve pressare chi è
  // davvero vicino, non mezza squadra.
  const distanza = Math.hypot(ctx.ball.x - x, ctx.ball.y - y);
  const vicinanza = clamp(1 - distanza / 26, 0, 1);
  const forza = (attacking ? 0.24 : 0.4) * vicinanza * (0.55 + 0.45 * ctx.intensity);
  x += (ctx.ball.x - x) * forza;
  y += (ctx.ball.y - y) * forza;

  // Respiro individuale.
  x += Math.sin(time * 0.85 + player.wobble) * 0.9;
  y += Math.cos(time * 0.63 + player.wobble * 1.7) * 1.2;

  return { x: clamp(x, 2.5, 97.5), y: clamp(y, 5, 95) };
}

/* -------------------------------------------------------------------------- */
/* Il flusso della partita                                                     */
/* -------------------------------------------------------------------------- */

export type TouchKind =
  | "inizio"
  | "passaggio"
  | "lancio"
  | "cross"
  | "dribbling"
  | "tiro"
  | "colpo_di_testa"
  | "rigore"
  | "parata"
  | "respinta"
  | "recupero"
  | "fallo"
  | "rimessa"
  | "angolo"
  | "rinvio"
  | "rete";

/** Come viaggia il pallone: serve alla vista 2D per alzarlo da terra e disegnarne l'ombra. */
export type BallArc = "raso" | "teso" | "alto";

export interface BallTouch {
  /** Secondo assoluto di gioco in cui il pallone arriva qui. */
  t: number;
  x: number;
  y: number;
  /** Chi tocca il pallone, quando è un giocatore in campo. */
  playerId: string | null;
  team: "for" | "against";
  kind: TouchKind;
  arc: BallArc;
}

export type PhaseOutcome =
  | "gol"
  | "parata"
  | "fuori"
  | "palo"
  | "angolo"
  | "recupero"
  | "fallo"
  | "rimessa"
  | "fuorigioco";

/** Un evento che merita una riga di cronaca e un lampo a schermo. */
export type PhaseFlash = "GOL" | "PARATA" | "PALO" | "FUORI" | "GIALLO" | "ROSSO" | null;

export interface PlayPhase {
  index: number;
  team: "for" | "against";
  startSecond: number;
  endSecond: number;
  touches: BallTouch[];
  outcome: PhaseOutcome;
  /** Il marcatore vero del tabellino, mai uno inventato. */
  scorerId: string | null;
  /**
   * L'istante esatto in cui il pallone entra in rete, per le sole fasi da gol.
   *
   * Serve a due cose che senza di esso non si possono fare bene: rallentare la riproduzione
   * **prima** che la palla arrivi (non dopo, quando è già dentro) e far scattare il punteggio
   * nel fotogramma giusto invece che al cambio di minuto.
   */
  goalSecond?: number;
  /** Chi ha concluso/commesso il fallo: per la riga di cronaca. */
  actorId: string | null;
  /** Cartellino estratto in questa fase, se c'è. */
  card: "giallo" | "rosso" | null;
  /** Riga di cronaca già scritta: la vista non compone testo. */
  commentary: string | null;
  flash: PhaseFlash;
  /**
   * Vale la pena guardarla al rallentatore? La riproduzione mostra queste per intero e corre
   * sulle altre — senza questa distinzione, 90 minuti continui richiederebbero 90 minuti.
   *
   * ⚠️ **Solo i gol**, dal 2026-08-15. Richiesta dell'utente: *"al momento si vedono troppe cose
   * inutili, nelle azioni voglio solo vedere i gol e poi la partita in modalità veloce"*. Prima
   * erano al rallentatore anche parate, pali, cartellini e un terzo dei tiri fuori: una ventina
   * di fermate a partita, che è la ragione per cui guardarne una sembrava lungo. Parate e pali
   * restano nella cronaca e nelle statistiche — succedono, si leggono, non fermano la partita.
   */
  notable: boolean;
}

export interface SideStats {
  shots: number;
  onTarget: number;
  saves: number;
  corners: number;
  fouls: number;
  offsides: number;
  possession: number;
  goals: number;
}

export interface MatchFlow {
  phases: PlayPhase[];
  stats: { for: SideStats; against: SideStats };
  players: PitchPlayer[];
  /** Durata effettiva coperta dal flusso, in secondi. */
  duration: number;
}

const OPPOSITE = { for: "against", against: "for" } as const;

/**
 * Quanto pesa ogni esito quando il possesso non è programmato per finire in rete.
 *
 * I pesi sono tarati sul **numero di possessi di una partita intera** (~280), non a occhio: una
 * partita vera ha una ventina di tiri, una decina di angoli e venticinque falli, quindi la
 * probabilità di conclusione deve stare sotto l'8%. La prima stesura ne metteva il 14% e
 * produceva cinquantuno tiri a partita — un test lo ha misurato subito, ed è il genere di
 * errore che a occhio sarebbe passato per "partita movimentata".
 */
const OUTCOME_WEIGHTS: [PhaseOutcome, number][] = [
  ["recupero", 58],
  ["rimessa", 13],
  // Sei e non nove: a nove il conto arrivava a trentotto falli a partita, misurato in campo al
  // 69' con 19-9 già sul tabellone. Una partita vera ne ha poco più di venti.
  ["fallo", 6],
  ["fuori", 3.5],
  ["angolo", 4],
  ["parata", 3],
  ["fuorigioco", 3],
  ["palo", 0.6],
];

function pesato<T>(voci: [T, number][], random: () => number): T {
  const totale = voci.reduce((s, [, w]) => s + w, 0);
  let roll = random() * totale;
  for (const [v, w] of voci) {
    roll -= w;
    if (roll <= 0) return v;
  }
  return voci[voci.length - 1]![0];
}

/** Distanza dalla porta avversaria a cui si chiude il possesso, per tipo di esito. */
function profonditaFinale(outcome: PhaseOutcome, random: () => number): number {
  switch (outcome) {
    case "gol":
      return 3 + random() * 5;
    case "parata":
    case "palo":
      return 8 + random() * 9;
    case "fuori":
      return 10 + random() * 14;
    case "angolo":
      return 4 + random() * 6;
    case "fuorigioco":
      return 14 + random() * 12;
    case "fallo":
      return 28 + random() * 30;
    case "rimessa":
      return 24 + random() * 38;
    default:
      return 30 + random() * 34;
  }
}

/**
 * Chi riceve il pallone in un certo punto: il compagno di reparto più vicino, con un pizzico di
 * scelta fra i tre più vicini perché la stessa catena non si ripeta identica. Il portiere entra
 * solo se non c'è nessun altro (un rinvio), altrimenti la palla tornerebbe indietro di continuo.
 */
function riceve(
  squadra: PitchPlayer[],
  x: number,
  y: number,
  escludi: string | null,
  random: () => number,
  /**
   * Il reparto che dovrebbe toccarla in questo momento dell'azione.
   *
   * Vincolo **morbido**: se quel reparto non ha nessuno libero si torna alla prossimità pura,
   * invece di rompere la catena. Serve alle azioni da gol, dove il pallone deve risalire per
   * reparti — dietro, in mezzo, davanti — e non passare da un difensore a un attaccante e
   * ritorno come se il centrocampo non esistesse.
   */
  repartoAtteso?: Department,
): PitchPlayer | null {
  const candidati = squadra.filter((p) => p.id !== escludi && p.department !== "POR");
  const pool = candidati.length > 0 ? candidati : squadra.filter((p) => p.id !== escludi);
  if (pool.length === 0) return null;

  const dalReparto = repartoAtteso
    ? pool.filter((p) => p.department === repartoAtteso)
    : [];
  const scelti = dalReparto.length > 0 ? dalReparto : pool;

  const ordinati = [...scelti].sort(
    (a, b) => Math.hypot(a.base.x - x, a.base.y - y) - Math.hypot(b.base.x - x, b.base.y - y),
  );
  const finestra = Math.min(3, ordinati.length);
  return ordinati[Math.floor(random() * finestra)]!;
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

/**
 * Le frasi della cronaca.
 *
 * Più formulazioni per ciascun esito, scelte dal seme: con una sola, in novanta minuti si legge
 * venti volte la stessa riga e la partita smette di sembrare raccontata da qualcuno. `{chi}` è
 * il nome del protagonista.
 */
const FRASI: Record<string, string[]> = {
  gol: [
    "{chi} calcia e la mette dentro. Gol!",
    "Conclusione secca di {chi}: non c'è niente da fare, è gol.",
    "{chi} si gira in area e trova l'angolo lontano. Rete!",
    "La difende, si allarga e {chi} la scarica sotto la traversa. Gol!",
  ],
  gol_testa: [
    "Cross in mezzo e incornata di {chi}: gol!",
    "Palla alta sul secondo palo, {chi} ci arriva di testa. Rete!",
    "{chi} anticipa tutti sul primo palo e la devia in porta. Gol!",
  ],
  parata: [
    "Conclusione di {chi}, ci arriva il portiere.",
    "{chi} calcia forte ma il portiere è attento: in angolo.",
    "Tiro velenoso di {chi}, respinto con i pugni.",
    "Il portiere si distende sulla botta di {chi} e salva tutto.",
  ],
  palo: [
    "Legno pieno! {chi} a un soffio dal gol.",
    "{chi} centra il palo: che occasione sprecata.",
    "Traversa clamorosa su tiro di {chi}.",
  ],
  fuori: [
    "{chi} prova la conclusione, fuori di poco.",
    "Ci prova {chi} da fuori area: alta sopra la traversa.",
    "{chi} calcia di prima intenzione ma la manda sul fondo.",
    "Buona iniziativa di {chi}, conclusione imprecisa.",
  ],
  rosso: [
    "Intervento durissimo su {chi}: l'arbitro non ha dubbi, è rosso.",
    "Fallo da ultimo uomo su {chi}: espulsione diretta.",
    "Proteste e strattone su {chi}: l'arbitro estrae il rosso.",
  ],
  giallo: [
    "Fallo tattico su {chi}, cartellino giallo.",
    "Entrata in ritardo su {chi}: ammonito.",
    "{chi} viene steso a metà campo, arriva il giallo.",
  ],
  rigore: [
    "Dal dischetto {chi} non sbaglia: è rete.",
    "{chi} spiazza il portiere dagli undici metri. Gol!",
    "Rincorsa lenta, {chi} la piazza all'angolino. Rigore trasformato.",
  ],
};

function frase(chiave: string, chi: string, random: () => number): string {
  const opzioni = FRASI[chiave] ?? ["Azione da segnalare."];
  return opzioni[Math.floor(random() * opzioni.length)]!.replace("{chi}", chi);
}

/**
 * Costruisce un singolo possesso: da dove parte il pallone fino a come finisce.
 *
 * La catena di passaggi è generata **dopo** aver deciso l'esito, non prima: è ciò che rende
 * impossibile per costruzione che un possesso non programmato finisca in rete, e che permette
 * a un'azione da gol di svilupparsi fino in area mentre un giro palla si spegne a centrocampo.
 */
function costruisciFase(params: {
  index: number;
  team: "for" | "against";
  start: { x: number; y: number };
  startSecond: number;
  durata: number;
  outcome: PhaseOutcome;
  goalEvent: MatchEvent | null;
  squadra: PitchPlayer[];
  avversari: PitchPlayer[];
  random: () => number;
  nameOf: (id: string | null) => string;
}): PlayPhase {
  const {
    index,
    team,
    start,
    startSecond,
    durata,
    outcome,
    goalEvent,
    squadra,
    avversari,
    random,
    nameOf,
  } = params;

  const versoPorta = team === "for" ? 100 : 0;
  const rigore = goalEvent?.kind === "penalty";
  const profondita = profonditaFinale(outcome, random);
  const finaleX = team === "for" ? 100 - profondita : profondita;
  const finaleY = clamp(50 + (random() - 0.5) * (outcome === "gol" ? 34 : 52), 8, 92);

  const touches: BallTouch[] = [];
  let t = startSecond;
  let ultimo: string | null = null;

  // Il primo tocco è la ripartenza: da dove il pallone è rimasto, con chi ce l'ha più vicino.
  const primoRicevente = riceve(squadra, start.x, start.y, null, random);
  ultimo = primoRicevente?.id ?? null;
  touches.push({
    t,
    x: clamp(start.x, 2, 98),
    y: clamp(start.y, 4, 96),
    playerId: ultimo,
    team,
    kind: index === 0 ? "inizio" : "recupero",
    arc: "raso",
  });

  if (rigore) {
    // Il rigore non ha costruzione: c'è il fallo, il dischetto, il tiro.
    const dischettoX = team === "for" ? 88 : 12;
    const tiratore = goalEvent?.scorerId ?? ultimo;
    t += Math.max(3, durata * 0.55);
    touches.push({
      t,
      x: dischettoX,
      y: 50,
      playerId: tiratore,
      team,
      kind: "rigore",
      arc: "raso",
    });
    const dentroX = team === "for" ? GOAL_MOUTH.insideFor : GOAL_MOUTH.insideAgainst;
    const dentroY = clamp(50 + (random() - 0.5) * 20, GOAL_MOUTH.yMin, GOAL_MOUTH.yMax);
    t += 1.6;
    touches.push({ t, x: dentroX, y: dentroY, playerId: tiratore, team, kind: "rete", arc: "teso" });
    const secondoDelGol = t;
    // La palla resta in rete: è il momento che il gioco deve lasciar respirare.
    t += GOAL_HOLD_SECONDS;
    touches.push({ t, x: dentroX, y: dentroY, playerId: tiratore, team, kind: "rete", arc: "raso" });
    return {
      index,
      team,
      startSecond,
      endSecond: t,
      touches,
      outcome: "gol",
      scorerId: goalEvent?.scorerId ?? null,
      goalSecond: secondoDelGol,
      actorId: tiratore,
      card: null,
      commentary: frase("rigore", nameOf(goalEvent?.scorerId ?? null), random),
      flash: "GOL",
      notable: true,
    };
  }

  /**
   * **L'azione da gol si costruisce, le altre no.**
   *
   * ⚠️ Richiesta dell'utente: *"voglio migliorato la qualità del motore grafico delle azioni dei
   * gol con movimenti strutturati, movimenti realistici dei pallini e azioni convincenti tra
   * difesa e attacco"*. Prima ogni possesso — gol compreso — aveva la stessa forma: due-cinque
   * tocchi con la stessa legge di avanzamento. Il gol arrivava quindi con la stessa costruzione
   * di una rimessa laterale, e l'unica cosa che lo distingueva era il finale.
   *
   * Adesso una rete nasce da una catena **più lunga e più lenta** (cinque-otto tocchi contro
   * due-cinque), e soprattutto da una **risalita per reparti**: il pallone parte da dietro,
   * passa dal centrocampo e arriva davanti, invece di puntare la porta dal primo tocco. È la
   * differenza fra un'azione e un lancio lungo, ed è l'unica cosa che rende leggibile il gioco
   * fra difesa e attacco in una vista dall'alto.
   */
  const eGol = outcome === "gol";
  const passaggi = eGol ? 5 + Math.floor(random() * 4) : 2 + Math.floor(random() * 4);
  const tempoCostruzione =
    durata * (eGol ? 1.35 : outcome === "recupero" || outcome === "rimessa" ? 0.9 : 0.75);
  for (let i = 1; i <= passaggi; i++) {
    const u = i / (passaggi + 1);
    /**
     * Su un gol la risalita è **quasi lineare** e il pallone cambia fascia: si costruisce
     * davvero, invece di puntare la porta con una parabola che schiaccia tutti i tocchi
     * nell'area avversaria. Sulle altre azioni resta la legge di prima.
     */
    const x = eGol
      ? lerp(start.x, finaleX, u * 0.82 + u * u * 0.18)
      : lerp(start.x, finaleX, u * u * 0.55 + u * 0.45);
    // L'ampiezza: su un gol il pallone attraversa il campo (il gioco si sposta di fascia),
    // sulle altre oscilla e basta. È ciò che rende l'azione "convincente" invece che diritta.
    const respiro = eGol ? Math.sin(u * Math.PI) * 34 * (random() < 0.5 ? -1 : 1) : 0;
    const y = clamp(lerp(start.y, finaleY, u) + respiro + (random() - 0.5) * 26, 6, 94);
    /**
     * **Chi tocca il pallone segue i reparti**: dietro all'inizio, in mezzo a metà azione,
     * davanti alla fine. Senza questo vincolo il ricevente era semplicemente "il più vicino", e
     * capitava di vedere un attaccante impostare da centrocampo mentre il difensore concludeva.
     */
    const repartoAtteso: Department | undefined = eGol
      ? u < 0.3
        ? "DIF"
        : u < 0.68
          ? "CC"
          : "ATT"
      : undefined;
    const ricevente = riceve(squadra, x, y, ultimo, random, repartoAtteso);
    const avanzamento = Math.abs(x - (touches[touches.length - 1]?.x ?? x));
    // Il tipo di tocco decide anche **come vola il pallone**, che è ciò che dà profondità a una
    // vista dall'alto: un cross dalla fascia si alza, un lancio scavalca, un appoggio resta
    // raso. Con la sola soglia sull'avanzamento i palloni alti non uscivano quasi mai, e il
    // campo sembrava un biliardo — un test lo ha misurato.
    const largo = Math.abs(y - 50) > 26;
    const profondo = team === "for" ? x > 68 : x < 32;
    let kind: TouchKind;
    let arc: BallArc;
    if (largo && profondo && random() < 0.5) {
      kind = "cross";
      arc = "alto";
    } else if (avanzamento > 20 || random() < 0.1) {
      kind = "lancio";
      arc = "alto";
    } else if (random() < 0.18) {
      kind = "dribbling";
      arc = "raso";
    } else {
      kind = "passaggio";
      arc = random() < 0.22 ? "teso" : "raso";
    }
    t += Math.max(0.8, (tempoCostruzione / passaggi) * (0.7 + random() * 0.6));
    touches.push({ t, x, y, playerId: ricevente?.id ?? ultimo, team, kind, arc });
    ultimo = ricevente?.id ?? ultimo;
  }

  const conclusore = ultimo;
  const portiereAvversario = avversari.find((p) => p.department === "POR") ?? null;
  const nomeConclusore = nameOf(conclusore);

  // La chiusura: cambia il tipo di ultimo tocco e la riga di cronaca.
  const chiudi = (
    kind: TouchKind,
    x: number,
    y: number,
    arc: BallArc,
    playerId: string | null,
    dt: number,
  ) => {
    t += dt;
    touches.push({ t, x, y, playerId, team, kind, arc });
  };

  let commentary: string | null = null;
  let flash: PhaseFlash = null;
  let card: "giallo" | "rosso" | null = null;
  let notable = false;
  let goalSecond: number | undefined;

  switch (outcome) {
    case "gol": {
      const marcatore = goalEvent?.scorerId ?? conclusore;
      const diTesta = random() < 0.22;
      if (diTesta) {
        chiudi("cross", team === "for" ? 88 : 12, random() < 0.5 ? 12 : 88, "alto", conclusore, 1.1);
      }
      // Il tiro parte da più lontano di prima (84 invece di 92): il pallone deve avere spazio
      // per essere *visto* attraversare l'area, superare il portiere ed entrare.
      chiudi(
        diTesta ? "colpo_di_testa" : "tiro",
        team === "for" ? 84 : 16,
        finaleY,
        "raso",
        marcatore,
        1.0,
      );
      const dentroX = team === "for" ? GOAL_MOUTH.insideFor : GOAL_MOUTH.insideAgainst;
      const dentroY = clamp(finaleY, GOAL_MOUTH.yMin, GOAL_MOUTH.yMax);
      chiudi("rete", dentroX, dentroY, "teso", marcatore, 1.5);
      goalSecond = t;
      chiudi("rete", dentroX, dentroY, "raso", marcatore, GOAL_HOLD_SECONDS);
      commentary = frase(diTesta ? "gol_testa" : "gol", nameOf(marcatore), random);
      flash = "GOL";
      notable = true;
      break;
    }
    case "parata": {
      chiudi("tiro", team === "for" ? 93 : 7, finaleY, "teso", conclusore, 0.9);
      chiudi(
        "parata",
        team === "for" ? 96 : 4,
        clamp(finaleY + (random() < 0.5 ? -14 : 14), 6, 94),
        "teso",
        portiereAvversario?.id ?? null,
        0.55,
      );
      commentary = frase("parata", nomeConclusore, random);
      flash = "PARATA";
      break;
    }
    case "palo": {
      chiudi("tiro", team === "for" ? 96 : 4, finaleY, "teso", conclusore, 0.9);
      chiudi(
        "respinta",
        team === "for" ? 86 : 14,
        clamp(finaleY + (random() < 0.5 ? -20 : 20), 8, 92),
        "teso",
        null,
        0.6,
      );
      commentary = frase("palo", nomeConclusore, random);
      flash = "PALO";
      break;
    }
    case "fuori": {
      chiudi(
        "tiro",
        team === "for" ? 100 : 0,
        finaleY > 50 ? 97 : 3,
        "teso",
        conclusore,
        0.9,
      );
      commentary = frase("fuori", nomeConclusore, random);
      flash = "FUORI";
      break;
    }
    case "angolo": {
      chiudi("angolo", versoPorta, finaleY > 50 ? 96 : 4, "raso", conclusore, 0.8);
      commentary = null;
      break;
    }
    case "fallo": {
      const roll = random();
      card = roll < 0.035 ? "rosso" : roll < 0.16 ? "giallo" : null;
      const fallo = avversari[Math.floor(random() * avversari.length)] ?? null;
      chiudi("fallo", touches[touches.length - 1]!.x, touches[touches.length - 1]!.y, "raso", fallo?.id ?? null, 0.8);
      if (card === "rosso") {
        commentary = frase("rosso", nomeConclusore, random);
        flash = "ROSSO";
      } else if (card === "giallo") {
        commentary = frase("giallo", nomeConclusore, random);
        flash = "GIALLO";
      }
      break;
    }
    case "fuorigioco": {
      chiudi("fallo", touches[touches.length - 1]!.x, touches[touches.length - 1]!.y, "raso", conclusore, 0.7);
      commentary = null;
      break;
    }
    case "rimessa": {
      chiudi(
        "rimessa",
        touches[touches.length - 1]!.x,
        touches[touches.length - 1]!.y > 50 ? 97 : 3,
        "raso",
        conclusore,
        0.7,
      );
      break;
    }
    default: {
      const recupera = avversari[Math.floor(random() * avversari.length)] ?? null;
      chiudi(
        "recupero",
        touches[touches.length - 1]!.x,
        touches[touches.length - 1]!.y,
        "raso",
        recupera?.id ?? null,
        0.8,
      );
      break;
    }
  }

  return {
    index,
    team,
    startSecond,
    endSecond: t,
    touches,
    scorerId: outcome === "gol" ? (goalEvent?.scorerId ?? null) : null,
    goalSecond,
    actorId: conclusore,
    outcome,
    card,
    commentary,
    flash,
    notable,
  };
}

/** Dove riparte il gioco dopo un possesso concluso, e con quale squadra. */
function ripartenza(
  fase: PlayPhase,
  random: () => number,
): { team: "for" | "against"; x: number; y: number } {
  const ultimo = fase.touches[fase.touches.length - 1]!;
  const avversaria = OPPOSITE[fase.team];
  switch (fase.outcome) {
    case "gol":
      // Si riparte dal centro, palla a chi ha subito.
      return { team: avversaria, x: 50, y: 50 };
    case "parata":
    case "fuori":
      // Rinvio dal fondo della squadra che ha subito il tiro.
      return { team: avversaria, x: fase.team === "for" ? 10 : 90, y: 30 + random() * 40 };
    case "palo":
      return { team: random() < 0.5 ? fase.team : avversaria, x: ultimo.x, y: ultimo.y };
    case "angolo":
      // L'angolo è battuto dalla stessa squadra, dalla bandierina.
      return { team: fase.team, x: fase.team === "for" ? 98 : 2, y: ultimo.y > 50 ? 96 : 4 };
    case "fallo":
      return { team: fase.team, x: ultimo.x, y: ultimo.y };
    case "fuorigioco":
      return { team: avversaria, x: ultimo.x, y: ultimo.y };
    case "rimessa":
      return { team: avversaria, x: ultimo.x, y: ultimo.y > 50 ? 97 : 3 };
    default:
      return { team: avversaria, x: ultimo.x, y: ultimo.y };
  }
}

/**
 * Costruisce la partita intera.
 *
 * Il ciclo è semplice e vale la pena leggerlo tutto: si avanza nel tempo un possesso alla volta,
 * e prima di costruirne uno si guarda se **il prossimo gol del tabellino cade dentro la sua
 * finestra**. Se sì, il possesso appartiene per forza alla squadra che ha segnato e finisce in
 * rete al secondo giusto; se no, l'esito si pesca da una distribuzione in cui "gol" non compare
 * proprio. È questo a rendere l'invariante una proprietà strutturale e non un controllo a valle.
 */
export function simulateMatchFlow(
  result: MatchResult,
  seed: string,
  nameOf: (playerId: string | null) => string,
  context?: MatchTheatreContext,
): MatchFlow {
  const random = derivedRandom(seed, "matchflow");
  const players = buildPitchPlayers(context);
  const squadre = {
    for: players.filter((p) => p.side === "for"),
    against: players.filter((p) => p.side === "against"),
  };

  // Il minuto di un gol dice il minuto, non il secondo: lo si sparpaglia dentro il minuto per
  // non avere tutte le reti allo scoccare esatto.
  const goals = [...result.events].sort((a, b) => a.minute - b.minute);
  const goalSeconds = goals.map((e) => clamp((e.minute - 1) * 60 + random() * 58, 0, MATCH_SECONDS - 20));

  // Chi tiene di più il pallone: derivato dalle reti, l'unico segnale di forza disponibile qui.
  const quotaNostra = clamp(
    (result.goalsFor + 1.6) / (result.goalsFor + result.goalsAgainst + 3.2),
    0.34,
    0.66,
  );

  const phases: PlayPhase[] = [];
  let t = 0;
  let prossimoGol = 0;
  let palla: { team: "for" | "against"; x: number; y: number } = {
    team: random() < 0.5 ? "for" : "against",
    x: 50,
    y: 50,
  };

  while (t < MATCH_SECONDS && phases.length < 400) {
    const evento = goals[prossimoGol] ?? null;
    const secondoGol = goalSeconds[prossimoGol] ?? Infinity;

    let durata = 7 + random() * 15;
    let team = palla.team;
    let outcome: PhaseOutcome;
    let goalEvent: MatchEvent | null = null;

    if (evento && secondoGol - t <= durata + 5) {
      // Questo possesso è quello del gol: squadra, durata ed esito sono decisi dal tabellino.
      goalEvent = evento;
      team = evento.team;
      durata = Math.max(5, secondoGol - t);
      outcome = "gol";
      prossimoGol += 1;
    } else {
      // Il possesso resta a chi l'ha conquistato, con una correzione verso chi domina la partita.
      if (random() > (team === "for" ? quotaNostra : 1 - quotaNostra) * 1.25) {
        team = OPPOSITE[team];
      }
      outcome = pesato(OUTCOME_WEIGHTS, random);
      // Non si sfora il minuto del prossimo gol: sarebbe una rete fuori tempo.
      if (Number.isFinite(secondoGol)) durata = Math.min(durata, Math.max(4, secondoGol - t - 4));
    }

    const fase = costruisciFase({
      index: phases.length,
      team,
      start: { x: palla.x, y: palla.y },
      startSecond: t,
      durata,
      outcome,
      goalEvent,
      squadra: squadre[team],
      avversari: squadre[OPPOSITE[team]],
      random,
      nameOf,
    });

    phases.push(fase);
    t = fase.endSecond + 0.6 + random() * 2.2;
    palla = ripartenza(fase, random);
  }

  // Se il tabellino avesse ancora gol da assegnare (partita chiusa troppo presto per gli
  // arrotondamenti), si aggiungono in coda: il risultato mostrato deve sempre coincidere.
  while (prossimoGol < goals.length) {
    const evento = goals[prossimoGol]!;
    const fase = costruisciFase({
      index: phases.length,
      team: evento.team,
      start: { x: 50, y: 50 },
      startSecond: Math.min(t, MATCH_SECONDS - 12),
      durata: 8,
      outcome: "gol",
      goalEvent: evento,
      squadra: squadre[evento.team],
      avversari: squadre[OPPOSITE[evento.team]],
      random,
      nameOf,
    });
    phases.push(fase);
    t = fase.endSecond + 2;
    prossimoGol += 1;
  }

  return {
    phases,
    stats: calcolaStatistiche(phases),
    players,
    duration: Math.max(MATCH_SECONDS, phases[phases.length - 1]?.endSecond ?? MATCH_SECONDS),
  };
}

/**
 * Le statistiche escono dal flusso, non da una formula a parte: quello che l'HUD mostra è il
 * conto di quello che si è visto passare sul campo.
 */
function calcolaStatistiche(phases: PlayPhase[]): MatchFlow["stats"] {
  const vuota = (): SideStats => ({
    shots: 0,
    onTarget: 0,
    saves: 0,
    corners: 0,
    fouls: 0,
    offsides: 0,
    possession: 0,
    goals: 0,
  });
  const stats = { for: vuota(), against: vuota() };
  const tempo = { for: 0, against: 0 };

  for (const fase of phases) {
    const mia = stats[fase.team];
    const altra = stats[OPPOSITE[fase.team]];
    tempo[fase.team] += Math.max(0, fase.endSecond - fase.startSecond);
    switch (fase.outcome) {
      case "gol":
        mia.shots += 1;
        mia.onTarget += 1;
        mia.goals += 1;
        break;
      case "parata":
        mia.shots += 1;
        mia.onTarget += 1;
        altra.saves += 1;
        break;
      case "fuori":
      case "palo":
        mia.shots += 1;
        break;
      case "angolo":
        mia.corners += 1;
        break;
      case "fallo":
        altra.fouls += 1;
        break;
      case "fuorigioco":
        mia.offsides += 1;
        break;
      default:
        break;
    }
  }

  const totale = tempo.for + tempo.against;
  stats.for.possession = totale > 0 ? Math.round((tempo.for / totale) * 100) : 50;
  stats.against.possession = 100 - stats.for.possession;
  return stats;
}

/* -------------------------------------------------------------------------- */
/* Lettura del flusso a un dato istante                                        */
/* -------------------------------------------------------------------------- */

export interface BallState {
  x: number;
  y: number;
  /** 0 = a terra, 1 = massima altezza: la vista alza il pallone e stacca l'ombra. */
  height: number;
  /** Chi la sta portando o l'ha appena giocata. */
  carrierId: string | null;
  /** Chi la sta per ricevere: si muove incontro al pallone. */
  receiverId: string | null;
  /** Quanto è avanzato il passaggio in corso (0-1). */
  progress: number;
  kind: TouchKind;
}

const ARC_HEIGHT: Record<BallArc, number> = { raso: 0, teso: 0.28, alto: 1 };

/**
 * Dov'è il pallone in un dato secondo di una fase.
 *
 * L'interpolazione non è lineare per tutti i tocchi: un tiro parte forte e arriva subito, un
 * passaggio rallenta all'arrivo, un cross descrive una parabola. Sono tre righe, ma sono la
 * differenza fra un pallino che scivola e un pallone che viene giocato.
 */
export function ballAt(phase: PlayPhase, second: number): BallState {
  const touches = phase.touches;
  const primo = touches[0]!;
  if (second <= primo.t) {
    return {
      x: primo.x,
      y: primo.y,
      height: 0,
      carrierId: primo.playerId,
      receiverId: primo.playerId,
      progress: 0,
      kind: primo.kind,
    };
  }
  for (let i = 0; i < touches.length - 1; i++) {
    const a = touches[i]!;
    const b = touches[i + 1]!;
    if (second >= b.t) continue;
    const span = Math.max(0.001, b.t - a.t);
    const u = clamp((second - a.t) / span, 0, 1);
    // Un tiro viaggia a velocità piena, un passaggio decelera in ricezione.
    const eased =
      b.kind === "tiro" || b.kind === "rete" || b.kind === "rigore"
        ? u
        : b.kind === "dribbling"
          ? u * u * (3 - 2 * u)
          : 1 - (1 - u) * (1 - u);
    return {
      x: lerp(a.x, b.x, eased),
      y: lerp(a.y, b.y, eased),
      height: ARC_HEIGHT[b.arc] * Math.sin(Math.PI * u),
      carrierId: a.playerId,
      receiverId: b.playerId,
      progress: u,
      kind: b.kind,
    };
  }
  const ultimo = touches[touches.length - 1]!;
  return {
    x: ultimo.x,
    y: ultimo.y,
    height: 0,
    carrierId: ultimo.playerId,
    receiverId: ultimo.playerId,
    progress: 1,
    kind: ultimo.kind,
  };
}

/** L'indice della fase in corso a un dato secondo (o l'ultima già giocata). */
export function phaseIndexAt(phases: readonly PlayPhase[], second: number): number {
  if (phases.length === 0) return -1;
  let lo = 0;
  let hi = phases.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (phases[mid]!.startSecond <= second) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}
