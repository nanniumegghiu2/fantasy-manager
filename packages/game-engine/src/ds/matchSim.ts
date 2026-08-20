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
  /**
   * **Il pressing ha un nome.**
   *
   * Prima chi non aveva il pallone si muoveva solo per prossimità, tutti allo stesso modo: il
   * risultato era o ventidue pallini equidistanti o — con un raggio più largo — mezza squadra
   * rannicchiata sulla palla, difetto già misurato una volta nel browser. Adesso **uno solo**
   * va addosso al portatore e gli altri coprono, che è quello che si vede guardando una partita
   * dall'alto.
   */
  presserId?: string | null;
  /** Chi ha il pallone: lui e chi lo riceve li muove `costruisciFrame`, non questa funzione. */
  carrierId?: string | null;
  /**
   * Il pallone sta volando in area su un cross: le punte attaccano primo e secondo palo, la
   * difesa avversaria si stringe fra loro e la porta.
   */
  crossing?: boolean;
}

/**
 * **Chi va a pressare il portatore**: l'avversario di movimento più vicino al pallone.
 *
 * Pura e in un posto solo, così la vista non deve deciderlo (e non può decidere diversamente da
 * come si muove il resto della squadra). Il portiere è escluso: non esce a pressare a metà campo.
 */
export function pressingTarget(
  players: readonly PitchPlayer[],
  ball: { x: number; y: number },
  possession: "for" | "against",
): string | null {
  let migliore: PitchPlayer | null = null;
  let distanza = Infinity;
  for (const p of players) {
    if (p.side === possession || p.department === "POR") continue;
    const d = Math.hypot(p.base.x - ball.x, p.base.y - ball.y);
    if (d < distanza) {
      distanza = d;
      migliore = p;
    }
  }
  return migliore?.id ?? null;
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
  player: Pick<PitchPlayer, "base" | "department" | "side" | "wobble"> & { id?: string },
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

  /**
   * 5. **Il pressing designato**: uno solo va addosso al portatore, e ci va davvero. È la
   * differenza fra una squadra che difende e ventidue pallini equidistanti.
   */
  if (player.id && player.id === ctx.presserId) {
    x += (ctx.ball.x - x) * 0.62;
    y += (ctx.ball.y - y) * 0.62;
  }

  /**
   * 6. **Il supporto**: i compagni vicini al portatore non stanno fermi ad aspettare. Uno si
   * allarga, uno si allunga in profondità — chi fa cosa lo decide la fase della sua
   * oscillazione, che è stabile per giocatore, quindi non cambia da un fotogramma all altro.
   */
  if (attacking && distanza < 34 && player.id !== ctx.carrierId) {
    const inProfondita = Math.sin(player.wobble) >= 0;
    if (inProfondita) x += dir * 5 * vicinanza;
    else y += (y >= ctx.ball.y ? 1 : -1) * 6 * vicinanza;
  }

  /**
   * 7. **L area si attacca sul cross.** Le punte vanno al primo e al secondo palo invece di
   * restare dove il blocco le aveva lasciate; la difesa avversaria si stringe fra loro e la
   * porta. Senza, un cross vola in mezzo a nessuno.
   */
  if (ctx.crossing) {
    const portaX = ctx.possession === "for" ? 92 : 8;
    if (attacking && dept === "ATT") {
      const palo = Math.sin(player.wobble * 1.3) >= 0 ? 42 : 58;
      x += (portaX - x) * 0.45;
      y += (palo - y) * 0.45;
    } else if (!attacking && dept === "DIF") {
      x += (portaX - x) * 0.2;
      y += (50 - y) * 0.25;
    }
  }

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
  /** Palla dietro la linea difensiva avversaria: il ricevente ci corre incontro. */
  | "filtrante"
  | "lancio"
  | "cross"
  | "dribbling"
  /** Scambio stretto: il pallone torna a chi l'ha giocato un attimo prima. */
  | "uno_due"
  /** Sponda di prima, spesso di testa, verso chi arriva. */
  | "sponda"
  | "tiro"
  | "colpo_di_testa"
  | "rigore"
  | "parata"
  | "respinta"
  /** Il difensore arriva sul pallone e lo porta via: il momento del contatto. */
  | "contrasto"
  /** Linea di passaggio letta e chiusa: la palla cambia squadra senza contatto. */
  | "intercetto"
  | "recupero"
  | "fallo"
  | "rimessa"
  | "angolo"
  | "rinvio"
  | "rete";

/**
 * **Il disegno di un possesso**, non solo il suo esito.
 *
 * ⚠️ Prima ogni possesso aveva la stessa forma — due-cinque tocchi che puntavano la porta dal
 * primo passaggio — e l'unica cosa che distingueva un'azione da gol da una rimessa laterale era
 * il finale. Il `pattern` è ciò che rende una ripartenza diversa da una manovra **prima** che si
 * sappia come finisce: decide quanti tocchi, quanto veloce viaggia la palla, da dove parte e
 * quale vocabolario usa.
 */
export type PhasePattern =
  /** Si riparte da dietro e si risale per reparti: lenta, tanti tocchi. */
  | "costruzione"
  /** Giro palla a metà campo, con cambi di fascia. */
  | "manovra"
  /** Palla vinta e via: pochi tocchi, in verticale, veloce. */
  | "ripartenza"
  /** Si salta il centrocampo: un lancio e il duello davanti. */
  | "palla_lunga"
  /** Recuperata alta, si attacca subito la porta da vicino. */
  | "pressing_alto"
  /** Rimessa, angolo, punizione: nasce ferma. */
  | "palla_inattiva";

/**
 * **Un duello vinto**: chi ha preso il pallone e a chi l'ha tolto.
 *
 * ⚠️ È la cosa che mancava del tutto, ed è metà della segnalazione dell'utente («voglio
 * passaggi, contrasti e ripartenze»). L'esito `recupero` copriva il **58%** dei possessi e
 * significava soltanto "il possesso finisce e la palla passa all'altra squadra": nessun
 * difensore convergeva, nessuno la toccava, non esisteva il momento del contatto — la palla
 * cambiava colore e basta.
 */
export interface Duel {
  winnerId: string | null;
  loserId: string | null;
  kind: "contrasto" | "intercetto";
}

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
export type PhaseFlash =
  | "GOL"
  | "PARATA"
  | "PALO"
  | "FUORI"
  | "GIALLO"
  | "ROSSO"
  | "CONTRASTO"
  | null;

export interface PlayPhase {
  index: number;
  team: "for" | "against";
  startSecond: number;
  endSecond: number;
  touches: BallTouch[];
  outcome: PhaseOutcome;
  /** Come è disegnato questo possesso: decide tocchi, velocità e vocabolario. */
  pattern: PhasePattern;
  /** Il duello che ha chiuso il possesso, quando è finito con la palla persa. */
  duel?: Duel;
  /** Chi ha servito l'assist sul gol: è l'ultimo tocco prima della conclusione. */
  assistId?: string | null;
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
  ["recupero", 31],
  ["rimessa", 27],
  ["fallo", 14],
  ["angolo", 7],
  ["fuori", 7.5],
  ["parata", 5],
  ["fuorigioco", 3],
  ["palo", 0.9],
];

/**
 * **Il tempo in cui il pallone non è in gioco**, fra la fine di un possesso e l'inizio del
 * successivo.
 *
 * Serve a due cose insieme, ed è il motivo per cui esiste invece di allungare i possessi. In una
 * partita vera il pallone è in gioco poco più di un'ora sui novanta minuti: modellare le pause
 * fa scendere il conto dei possessi dai ~280 di prima a ~140 — che è la densità chiesta
 * dall'utente, *"meno azioni ma ognuna un'azione vera"* — **senza** dover fingere possessi da
 * quaranta secondi, che nel calcio non esistono.
 *
 * Le durate sono quelle che chiunque riconosce: una rimessa si batte in fretta, un angolo no, e
 * dopo un gol si torna a centrocampo con calma.
 */
function pausaDopo(outcome: PhaseOutcome, random: () => number): number {
  switch (outcome) {
    case "gol":
      return 45 + random() * 30;
    case "angolo":
      return 22 + random() * 14;
    case "fallo":
      return 24 + random() * 18;
    case "fuorigioco":
      return 14 + random() * 8;
    case "parata":
    case "fuori":
    case "palo":
      return 14 + random() * 12;
    case "rimessa":
      return 10 + random() * 10;
    default:
      // Palla persa in mezzo al campo: il gioco non si ferma affatto.
      return 0.6 + random() * 2.2;
  }
}

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
 * **La cronaca di un duello nomina due persone**, non una.
 *
 * E la differenza fra "palla persa" e "Bastoni recupera su Leao": la prima e un cambio di
 * possesso, la seconda e un fatto di gioco. Con una sola formulazione per esito, in novanta
 * minuti si leggerebbe venti volte la stessa riga, quindi ce ne sono quattro per tipo.
 */
const FRASI_DUELLO = {
  contrasto: [
    "{vince} arriva in scivolata su {perde} e porta via il pallone.",
    "Contrasto vinto da {vince}: {perde} resta a terra, si prosegue.",
    "{perde} prova a passare, ma {vince} non lo lascia girare.",
    "Duello fisico fra {perde} e {vince}: la spunta {vince}.",
  ],
  intercetto: [
    "{vince} legge il passaggio di {perde} e lo chiude.",
    "Palla telefonata di {perde}, {vince} la intercetta.",
    "{vince} anticipa {perde} e rimette in gioco.",
    "Linea di passaggio chiusa da {vince}: {perde} sbaglia i tempi.",
  ],
};

function fraseDuello(
  intercetto: boolean,
  vince: string,
  perde: string,
  random: () => number,
): string {
  const opzioni = FRASI_DUELLO[intercetto ? "intercetto" : "contrasto"];
  return opzioni[Math.floor(random() * opzioni.length)]!
    .replace(/{vince}/g, vince)
    .replace(/{perde}/g, perde);
}

/**
 * Chi e piu vicino a un punto del campo, con un pizzico di scelta fra i primi tre.
 *
 * Serve ai duelli: chi contrasta e chi **era li**, non un compagno preso a caso in tutta la
 * squadra. Prendere sempre il primo renderebbe pero il difensore centrale l eroe di ogni
 * recupero, quindi si sorteggia in una finestra stretta.
 */
function piuVicino(
  squadra: readonly PitchPlayer[],
  x: number,
  y: number,
  random: () => number,
): PitchPlayer | null {
  const inCampo = squadra.filter((p) => p.department !== "POR");
  const pool = inCampo.length > 0 ? inCampo : squadra;
  if (pool.length === 0) return null;
  const ordinati = [...pool].sort(
    (a, b) => Math.hypot(a.base.x - x, a.base.y - y) - Math.hypot(b.base.x - x, b.base.y - y),
  );
  const finestra = Math.min(3, ordinati.length);
  return ordinati[Math.floor(random() * finestra)] ?? null;
}

/**
 * Costruisce un singolo possesso: da dove parte il pallone fino a come finisce.
 *
 * La catena di passaggi è generata **dopo** aver deciso l'esito, non prima: è ciò che rende
 * impossibile per costruzione che un possesso non programmato finisca in rete, e che permette
 * a un'azione da gol di svilupparsi fino in area mentre un giro palla si spegne a centrocampo.
 */
/**
 * **La forma di ciascun disegno di possesso.**
 *
 * Sono i cinque numeri che distinguono un'azione manovrata da una ripartenza, ed è tutto ciò
 * che serve: quanti tocchi, quanto tempo, quanto si risale in linea retta, quanto il gioco si
 * sposta di fascia, se il pallone deve passare per i reparti.
 *
 * `linearita` vicino a 1 = il pallone attraversa il campo in modo uniforme (si costruisce);
 * vicino a 0 = parabola che punta la porta dal primo tocco (si riparte).
 */
const FORMA_DEL_PATTERN: Record<
  PhasePattern,
  {
    minTocchi: number;
    maxTocchi: number;
    /** Frazione della durata spesa nella costruzione, prima della chiusura. */
    tempo: number;
    linearita: number;
    /** Di quanto il gioco si sposta di fascia a metà azione. */
    ampiezza: number;
    /** I tocchi seguono i reparti (dietro → mezzo → davanti). */
    perReparti: boolean;
    /** Il lancio lungo è nel vocabolario di questo disegno. */
    lanci: boolean;
  }
> = {
  costruzione: { minTocchi: 5, maxTocchi: 8, tempo: 1.35, linearita: 0.82, ampiezza: 30, perReparti: true, lanci: false },
  manovra: { minTocchi: 3, maxTocchi: 6, tempo: 1.05, linearita: 0.62, ampiezza: 26, perReparti: false, lanci: false },
  ripartenza: { minTocchi: 2, maxTocchi: 4, tempo: 0.6, linearita: 0.25, ampiezza: 10, perReparti: false, lanci: false },
  palla_lunga: { minTocchi: 1, maxTocchi: 2, tempo: 0.55, linearita: 0.2, ampiezza: 6, perReparti: false, lanci: true },
  pressing_alto: { minTocchi: 1, maxTocchi: 3, tempo: 0.5, linearita: 0.35, ampiezza: 12, perReparti: false, lanci: false },
  palla_inattiva: { minTocchi: 2, maxTocchi: 4, tempo: 0.9, linearita: 0.7, ampiezza: 20, perReparti: false, lanci: false },
};

/**
 * Dov'è la linea difensiva avversaria, in coordinate di campo.
 *
 * Serve a una cosa sola ma decisiva: riconoscere un **filtrante**, cioè un pallone che arriva
 * *oltre* quella linea. È la condizione che lo distingue da un lancio lungo, e senza di essa il
 * filtrante non è modellabile — è per questo che prima non esisteva.
 */
function lineaDifensiva(avversari: readonly PitchPlayer[], team: "for" | "against"): number {
  const difensori = avversari.filter((p) => p.department === "DIF");
  if (difensori.length === 0) return team === "for" ? 78 : 22;
  // Chi attacca verso destra deve superare il difensore **più arretrato**, cioè quello con la x
  // più alta; specularmente per chi attacca verso sinistra.
  const xs = difensori.map((p) => p.base.x);
  return team === "for" ? Math.max(...xs) : Math.min(...xs);
}

function costruisciFase(params: {
  index: number;
  team: "for" | "against";
  start: { x: number; y: number };
  startSecond: number;
  durata: number;
  outcome: PhaseOutcome;
  pattern: PhasePattern;
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
    pattern,
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
      pattern,
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
   * **L'azione ha un disegno, e il disegno dipende dal `pattern`.**
   *
   * ⚠️ Richiesta dell'utente: *"passaggi tra giocatori, contrasti e ripartenze, cross,
   * filtranti. Questo è avere azioni vere"*, col motore 2D di FM09 come riferimento.
   *
   * Prima esisteva un solo trattamento speciale — quello dei gol — e tutto il resto erano
   * due-cinque tocchi che puntavano la porta dal primo passaggio. Adesso ogni possesso sa che
   * cos'è:
   *
   *  - **costruzione**: si parte da dietro e si risale per reparti (DIF → CC → ATT), lentamente
   *    e con tanti tocchi. È l'azione che rende leggibile il gioco fra difesa e attacco;
   *  - **manovra**: giro palla a metà campo con un cambio di fascia;
   *  - **ripartenza**: pochi tocchi, verticali e veloci, senza passare da dietro;
   *  - **palla_lunga**: si salta il centrocampo con un lancio;
   *  - **pressing_alto**: la palla è già alta, si attacca la porta da vicino;
   *  - **palla_inattiva**: nasce ferma, quindi il primo tocco è lento e il secondo è la giocata.
   */
  const forma = FORMA_DEL_PATTERN[pattern];
  const passaggi =
    forma.minTocchi + Math.floor(random() * (forma.maxTocchi - forma.minTocchi + 1));
  const tempoCostruzione = durata * forma.tempo;

  /** Fin dove arriva la linea difensiva avversaria: serve a riconoscere un filtrante. */
  const lineaAvversaria = lineaDifensiva(avversari, team);
  /** Su quale fascia si sposta il gioco a metà azione: dà l'ampiezza senza farla a caso. */
  const fasciaFinale = random() < 0.5 ? -1 : 1;
  let precedente: string | null = ultimo;

  for (let i = 1; i <= passaggi; i++) {
    const u = i / (passaggi + 1);
    // La risalita: quasi lineare quando si costruisce (il pallone attraversa il campo), a
    // parabola quando si riparte (si punta subito la porta).
    const x = lerp(start.x, finaleX, u * forma.linearita + u * u * (1 - forma.linearita));
    // Il cambio di fascia vero e proprio, non un'oscillazione casuale attorno alla diagonale.
    const respiro = Math.sin(u * Math.PI) * forma.ampiezza * fasciaFinale;
    const y = clamp(lerp(start.y, finaleY, u) + respiro + (random() - 0.5) * 18, 6, 94);

    /**
     * **Chi tocca il pallone segue i reparti.** Senza questo vincolo il ricevente era
     * semplicemente il più vicino, e capitava di vedere un attaccante impostare da centrocampo
     * mentre il difensore concludeva. Il vincolo resta **morbido**: se il reparto atteso non ha
     * nessuno libero si torna alla prossimità, invece di rompere la catena.
     */
    const repartoAtteso = forma.perReparti
      ? u < 0.3
        ? "DIF"
        : u < 0.68
          ? "CC"
          : "ATT"
      : undefined;
    const ricevente = riceve(squadra, x, y, ultimo, random, repartoAtteso);
    const destinatario = ricevente?.id ?? ultimo;

    const precedenteX = touches[touches.length - 1]?.x ?? x;
    const avanzamento = Math.abs(x - precedenteX);
    const largo = Math.abs(y - 50) > 26;
    const profondo = team === "for" ? x > 68 : x < 32;
    /**
     * **Il filtrante è una condizione, non un tiro di dado**: il pallone arriva *oltre* la linea
     * difensiva avversaria. È ciò che lo distingue da un lancio, e prima non veniva mai
     * valutato — esisteva solo `lancio`, scelto per soglia di avanzamento.
     */
    const oltreLaLinea =
      team === "for" ? x > lineaAvversaria + 4 : x < lineaAvversaria - 4;

    let kind: TouchKind;
    let arc: BallArc;
    if (largo && profondo && random() < 0.55) {
      // Cross dalla fascia: il bersaglio lo sceglie `chiudiConCross`, qui vola in area.
      kind = "cross";
      arc = "alto";
    } else if (oltreLaLinea && avanzamento > 8) {
      kind = "filtrante";
      arc = "raso";
    } else if (avanzamento > 22 || (forma.lanci && random() < 0.35)) {
      kind = "lancio";
      arc = "alto";
    } else if (destinatario === precedente && random() < 0.22) {
      // Il pallone torna a chi l'ha appena giocato: è uno scambio stretto, non un errore.
      kind = "uno_due";
      arc = "raso";
    } else if (profondo && random() < 0.16) {
      kind = "sponda";
      arc = "teso";
    } else if (random() < 0.16) {
      kind = "dribbling";
      arc = "raso";
    } else {
      kind = "passaggio";
      arc = random() < 0.22 ? "teso" : "raso";
    }

    // **Quanto ci mette il pallone dipende da che giocata e**: un filtrante e teso e arriva
    // subito, un cross vola alto e lento, un appoggio sta in mezzo. Prima ogni tocco durava
    // uguale, ed e la ragione per cui a schermo tutti i passaggi si assomigliavano.
    t += Math.max(0.45, (tempoCostruzione / passaggi) * (0.7 + random() * 0.6) * DURATA_TOCCO[kind]);
    touches.push({ t, x, y, playerId: destinatario, team, kind, arc });
    precedente = ultimo;
    ultimo = destinatario;
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
  /**
   * Vale la pena guardarla al rallentatore?
   *
   * ⚠️ Due modalità, scelta dell'utente: *Salienti* mostra **solo i gol**, *Estesa* i gol più le
   * azioni importanti. `notable` marca la seconda categoria — occasioni, parate, pali,
   * espulsioni — e la selezione vera la fa `buildHighlightReel`, che sa quale modalità si sta
   * guardando. Prima `notable` era stato ristretto ai soli gol, e con una riproduzione che
   * attraversava il resto della partita a 330× il risultato era il blur segnalato.
   */
  let notable = false;
  let duel: Duel | undefined;
  /**
   * Chi ha servito il pallone della rete: e semplicemente **l ultimo tocco prima della
   * conclusione**, cioe la definizione vera di assist. Non serviva inventare niente, serviva
   * leggerlo — e prima nessuno lo leggeva, tanto che gli assist in carriera restavano a zero.
   */
  let assistId: string | null = null;
  let goalSecond: number | undefined;

  switch (outcome) {
    case "gol": {
      const marcatore = goalEvent?.scorerId ?? conclusore;
      // L ultimo che ha toccato prima della conclusione: se e il marcatore stesso, se l e
      // fatta da solo e l assist non esiste.
      assistId = conclusore !== marcatore ? conclusore : null;
      const diTesta = random() < 0.26;
      if (diTesta) {
        /**
         * **Il cross ha un bersaglio.**
         *
         * Prima era un tocco come un altro, scelto quando la palla capitava larga e profonda:
         * partiva dalla fascia e finiva in una coordinata fissa, senza che nessuno lo
         * attaccasse. Adesso parte dalla fascia, vola verso **la punta che stacca**, e il
         * tocco successivo e il suo colpo di testa. Sono due tocchi legati, cioe un azione.
         */
        const fascia = random() < 0.5 ? 12 : 88;
        chiudi("cross", team === "for" ? 88 : 12, fascia, "alto", conclusore, 1.1);
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
      notable = true;
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
      notable = true;
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
      // Le conclusioni fuori restano nella cronaca e nelle statistiche ma **non fermano la
      // partita**: sono una decina a gara, e misurando si vedeva che da sole portavano la
      // modalita Estesa a nove minuti. Succedono, si leggono, non si guardano.
      notable = false;
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
        notable = true;
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
      /**
       * **Il duello: il momento del contatto, con due nomi.**
       *
       * ⚠️ Era il difetto più grosso del motore, e copriva il **58%** dei possessi: `recupero`
       * significava soltanto "la palla passa all'altra squadra". Nessun difensore convergeva,
       * nessuno la toccava, la cronaca taceva — la palla cambiava colore e basta.
       *
       * Adesso il pallone lo porta via **un avversario preciso**, scelto fra i più vicini al
       * punto in cui si sta giocando (non a caso in tutta la squadra: chi contrasta è chi era
       * lì), e si distingue il **contrasto** — contatto, il difensore arriva addosso —
       * dall'**intercetto**, che è una linea di passaggio letta e chiusa. La conseguenza è nel
       * possesso successivo: se il pallone è stato vinto alto, parte una ripartenza
       * (`patternDopoDuello`).
       */
      const ultimoTocco = touches[touches.length - 1]!;
      const difensore = piuVicino(avversari, ultimoTocco.x, ultimoTocco.y, random);
      const intercetto = random() < 0.42;
      duel = {
        winnerId: difensore?.id ?? null,
        loserId: conclusore,
        kind: intercetto ? "intercetto" : "contrasto",
      };
      chiudi(
        intercetto ? "intercetto" : "contrasto",
        ultimoTocco.x,
        ultimoTocco.y,
        "raso",
        difensore?.id ?? null,
        0.8,
      );
      commentary = fraseDuello(
        intercetto,
        nameOf(difensore?.id ?? null),
        nomeConclusore,
        random,
      );
      // Solo il contrasto vero merita il lampo: un intercetto è pulito e passa nella cronaca.
      if (!intercetto) flash = "CONTRASTO";
      break;
    }
  }

  return {
    index,
    team,
    startSecond,
    endSecond: t,
    touches,
    pattern,
    duel,
    assistId,
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

/**
 * Il disegno di un possesso che **non** nasce da una palla vinta: lo decide da dove parte.
 *
 * Non è decorazione. Un pallone che riparte dal proprio portiere è una costruzione dal basso —
 * lenta, tanti tocchi, si risale per reparti; uno raccolto a metà campo è una manovra; una
 * rimessa o un angolo nascono da fermo. Prima erano tutti la stessa cosa, ed è la ragione per
 * cui il campo sembrava un carosello di passaggi identici.
 */
function scegliPattern(
  team: "for" | "against",
  palla: { x: number; y: number },
  outcome: PhaseOutcome,
  random: () => number,
): PhasePattern {
  if (outcome === "gol") {
    // Una rete nasce da una costruzione o da una verticalizzazione, mai da una palla ferma.
    return random() < 0.62 ? "costruzione" : "manovra";
  }
  // Quanto siamo lontani dalla nostra porta, in percentuale di campo.
  const risalita = team === "for" ? palla.x : 100 - palla.x;
  if (risalita < 28) return random() < 0.72 ? "costruzione" : "palla_lunga";
  if (risalita > 76) return "pressing_alto";
  return random() < 0.78 ? "manovra" : "palla_lunga";
}

/**
 * **La conseguenza del duello**: chi vince il pallone nella metà avversaria riparte.
 *
 * Questa riga è metà del valore dei contrasti. Senza, un recupero sarebbe soltanto un momento
 * carino da guardare e il possesso dopo verrebbe costruito da zero come tutti gli altri — cioè
 * il contrasto non *causerebbe* niente, che è come dire che non è successo.
 */
function patternDopoDuello(fase: PlayPhase): PhasePattern | null {
  if (!fase.duel) return null;
  const ultimo = fase.touches[fase.touches.length - 1]!;
  // Chi ha vinto il pallone è dell'altra squadra: la sua metà campo è specchiata.
  const vincitore = OPPOSITE[fase.team];
  const risalita = vincitore === "for" ? ultimo.x : 100 - ultimo.x;
  if (risalita > 70) return "pressing_alto";
  if (risalita > 34) return "ripartenza";
  return null;
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
  /**
   * Come nasce il prossimo possesso, deciso da **come è finito il precedente**.
   *
   * È l'anello che mancava: una palla vinta nella metà avversaria deve produrre una ripartenza,
   * non un possesso qualunque costruito da zero. Senza questa riga i contrasti restavano eventi
   * isolati e non succedeva mai niente *per causa loro*.
   */
  let prossimoPattern: PhasePattern | null = null;

  while (t < MATCH_SECONDS && phases.length < 400) {
    const evento = goals[prossimoGol] ?? null;
    const secondoGol = goalSeconds[prossimoGol] ?? Infinity;

    let durata = 14 + random() * 22;
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

    const pattern = prossimoPattern ?? scegliPattern(team, palla, outcome, random);
    // Una ripartenza è corta e veloce per definizione: dura meno di una manovra.
    if (pattern === "ripartenza" || pattern === "pressing_alto") durata = Math.min(durata, 14);

    const fase = costruisciFase({
      index: phases.length,
      team,
      start: { x: palla.x, y: palla.y },
      startSecond: t,
      durata,
      outcome,
      pattern,
      goalEvent,
      squadra: squadre[team],
      avversari: squadre[OPPOSITE[team]],
      random,
      nameOf,
    });

    phases.push(fase);
    // Il tempo morto: è ciò che porta i possessi da ~280 a ~140 senza inventarne di lunghissimi.
    t = fase.endSecond + pausaDopo(fase.outcome, random);
    palla = ripartenza(fase, random);
    prossimoPattern = patternDopoDuello(fase);
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
      pattern: "manovra",
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
 * **Quanto ci mette il pallone a percorrere un passaggio**, per tipo di giocata.
 *
 * Sotto 1 = piu veloce del passaggio medio. E l altra meta di "vedere una giocata": la
 * traiettoria dice *dove* va il pallone, questa dice *come* ci va. Senza, un filtrante teso e
 * un cross alto impiegavano lo stesso tempo e a schermo erano indistinguibili.
 */
const DURATA_TOCCO: Record<TouchKind, number> = {
  inizio: 1,
  passaggio: 1,
  filtrante: 0.62,
  lancio: 1.15,
  cross: 1.3,
  dribbling: 1.4,
  uno_due: 0.6,
  sponda: 0.55,
  tiro: 0.45,
  colpo_di_testa: 0.6,
  rigore: 1,
  parata: 0.5,
  respinta: 0.5,
  contrasto: 0.8,
  intercetto: 0.7,
  recupero: 0.9,
  fallo: 1,
  rimessa: 1,
  angolo: 1,
  rinvio: 1.2,
  rete: 0.45,
};

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
      b.kind === "tiro" || b.kind === "rete" || b.kind === "rigore" || b.kind === "filtrante"
        ? // Palloni tesi: viaggiano a velocita piena dall inizio alla fine.
          u
        : b.kind === "dribbling"
          ? // Chi porta palla accelera e rallenta: non e un passaggio, e una corsa.
            u * u * (3 - 2 * u)
          : b.kind === "cross" || b.kind === "lancio"
            ? // Parabola: parte forte e si siede in arrivo.
              1 - (1 - u) * (1 - u) * (1 - u)
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

/* -------------------------------------------------------------------------- */
/* Le finestre da guardare                                                     */
/* -------------------------------------------------------------------------- */

/**
 * **Le due modalità di visione**, scelte dall'utente sul modello di FM09.
 *
 * Entrambe sono a highlight — velocità reale durante l'azione, orologio che salta fra una e
 * l'altra — e differiscono solo in *cosa* è un highlight:
 *  - `salienti`: **solo i gol**;
 *  - `estesa`: i gol **più** le azioni importanti (conclusioni, parate, pali, espulsioni).
 *
 * È questo a far sparire il difetto segnalato: non esiste più riempitivo da attraversare a
 * velocità assurda, quindi non esiste più il pallone che teletrasporta.
 */
export type MatchViewMode = "salienti" | "estesa";

/** Una finestra di gioco da riprodurre a velocità reale. */
export interface HighlightWindow {
  /** Primo secondo da mostrare: comprende la rincorsa, cioè come nasce l'azione. */
  from: number;
  /** Ultimo secondo da mostrare. */
  to: number;
  /** La fase protagonista (quella che ha meritato la finestra). */
  phaseIndex: number;
  /** Il minuto di gioco in cui la finestra comincia, per la transizione dichiarata a schermo. */
  minute: number;
}

/**
 * Quanti secondi di gioco si vedono **prima** dell'azione vera e propria.
 *
 * In FM un highlight non comincia sul tiro: comincia qualche secondo prima, così si vede *come
 * nasce* l'occasione. Senza questa rincorsa una rete arriverebbe senza contesto — e la
 * costruzione per reparti, che è metà del lavoro fatto sul motore, non si vedrebbe mai.
 */
const LEAD_IN_SECONDS = 6;

/**
 * Le finestre da riprodurre, in ordine e senza sovrapposizioni.
 *
 * Pura e testabile: la vista non decide cosa guardare, lo chiede qui. Se due azioni importanti
 * sono vicine le finestre si fondono, altrimenti si vedrebbe la stessa manciata di secondi due
 * volte e l'orologio salterebbe all'indietro.
 */
export function buildHighlightReel(flow: MatchFlow, mode: MatchViewMode): HighlightWindow[] {
  const finestre: HighlightWindow[] = [];

  for (const fase of flow.phases) {
    const merita = mode === "salienti" ? fase.outcome === "gol" : fase.notable;
    if (!merita) continue;

    // La rincorsa parte dalla fase precedente quando è attaccata a questa: è lì che si vede il
    // contrasto o il recupero da cui l'azione è nata.
    const precedente = flow.phases[fase.index - 1];
    const inizioNaturale = fase.startSecond - LEAD_IN_SECONDS;
    const from =
      precedente && fase.startSecond - precedente.endSecond < 6
        ? Math.min(inizioNaturale, precedente.startSecond)
        : inizioNaturale;

    const finestra: HighlightWindow = {
      from: Math.max(0, from),
      to: Math.min(MATCH_SECONDS, fase.endSecond),
      phaseIndex: fase.index,
      minute: minutoDi(Math.max(0, from)),
    };

    const ultima = finestre[finestre.length - 1];
    if (ultima && finestra.from <= ultima.to + 1) {
      // Si fondono: due occasioni ravvicinate sono un unico passaggio di gioco.
      ultima.to = Math.max(ultima.to, finestra.to);
      ultima.phaseIndex = finestra.phaseIndex;
      continue;
    }
    finestre.push(finestra);
  }

  return finestre;
}

/** Il minuto di gioco (1-90+) corrispondente a un secondo del flusso. */
export function minutoDi(second: number): number {
  return Math.max(1, Math.min(90, Math.floor(second / 60) + 1));
}
