/**
 * **Le azioni salienti di una partita**, ricavate da un risultato già deciso.
 *
 * Il punto architetturale, e non è un dettaglio: questa funzione **non simula nulla**. La
 * partita l'ha già giocata `simulateMatch`, con la sua calibrazione e la sua sequenza di numeri
 * casuali; toccarla per aggiungere occasioni ed espulsioni significherebbe cambiare i risultati
 * di tutto il gioco e buttare via la taratura (il characterization test lo intercetterebbe
 * subito, ed è lì apposta). Qui si prende il tabellino e se ne ricava un **racconto coerente**:
 * i gol sono quelli veri, ai minuti veri, e attorno si aggiungono le occasioni mancate e i
 * cartellini che rendono guardabile una partita.
 *
 * È la stessa distinzione fra *cosa è successo* e *come lo si racconta* che regge il minutaggio
 * live della Modalità Classica.
 */
import { derivedRandom } from "../random";
import type { MatchEvent, MatchResult } from "../season/matchModel";
import type { Department } from "@app/shared-types";

export type HighlightKind = "gol" | "rigore" | "occasione" | "parata" | "palo" | "espulsione";

export type TrajectoryType =
  | "pass"
  | "cross"
  | "shot"
  | "save_deflect"
  | "post_rebound"
  | "celebration"
  | "dribble"
  | "tackle";

export interface ActionStep {
  /** Inizio palla (0-100) */
  fromX: number;
  fromY: number;
  /** Fine palla (0-100) */
  toX: number;
  toY: number;
  /** Tipo di movimento palla */
  trajectory: TrajectoryType;
  /** Durata in millisecondi della fase */
  durationMs: number;
  /** Etichetta visiva per la UI */
  phaseLabel?: string;
  /** Chi è il protagonista attivo della fase */
  activeActor?: "passer" | "shooter" | "keeper" | "defender";
  /** Chi ha la palla all'inizio della fase, quando lo sappiamo: un giocatore vero, non un ruolo. */
  fromPlayerId?: string | null;
  /** Chi ce l'ha alla fine della fase. */
  toPlayerId?: string | null;
}

export interface Highlight {
  minute: number;
  /** La nostra squadra o l'avversaria. */
  team: "for" | "against";
  kind: HighlightKind;
  /** Chi ne è protagonista, quando lo sappiamo. */
  playerId: string | null;
  /** Testo pronto per la UI: la cronaca non si compone a schermo. */
  text: string;
  /**
   * Dove finisce l'azione, in coordinate 0-100 del campo (0 = nostra porta, 100 = loro).
   * Serve alla vista 2D per far convergere i pallini nel punto giusto.
   */
  x: number;
  y: number;
  /** Sequenza animata di micro-fasi per la vista 2D */
  steps: ActionStep[];
  /** I giocatori veri coinvolti (passatore, rifinitore...), quando le formazioni sono note. */
  involvedPlayerIds?: string[];
}

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
 * Posiziona gli undici titolari **veri** di una squadra sul campo condiviso (0-100), per
 * reparto: stessa corsia orizzontale per chi gioca lo stesso ruolo, distribuiti in verticale.
 * Non è la formazione generica di prima (sempre lo stesso 4-3-3 finto per entrambe le squadre):
 * un modulo con l'attacco affollato mostra davvero più uomini nella corsia avanzata.
 */
export function layoutEleven(
  eleven: readonly TheatrePlayer[],
  side: "for" | "against",
): Map<string, { x: number; y: number }> {
  const laneX: Record<Department, number> = { POR: 6, DIF: 24, CC: 50, ATT: 76 };
  const byDept = new Map<Department, TheatrePlayer[]>();
  for (const p of eleven) {
    const list = byDept.get(p.department) ?? [];
    list.push(p);
    byDept.set(p.department, list);
  }
  const positions = new Map<string, { x: number; y: number }>();
  for (const [dept, players] of byDept) {
    const baseX = laneX[dept];
    players.forEach((p, i) => {
      const y = players.length === 1 ? 50 : 12 + (76 * i) / (players.length - 1);
      const x = side === "for" ? baseX : 100 - baseX;
      positions.set(p.playerId, { x: Math.round(x), y: Math.round(y) });
    });
  }
  return positions;
}

function elevenOf(
  team: "for" | "against",
  context: MatchTheatreContext | undefined,
): readonly TheatrePlayer[] | undefined {
  if (!context) return undefined;
  return team === "for" ? context.ourEleven : context.opponentEleven;
}

/** Pesca un vero compagno di squadra per un ruolo nell'azione (passatore, tiratore...). */
function pickTeammate(
  list: readonly TheatrePlayer[] | undefined,
  depts: Department[],
  random: () => number,
  exclude?: string | null,
): string | null {
  if (!list || list.length === 0) return null;
  const preferiti = list.filter((p) => depts.includes(p.department) && p.playerId !== exclude);
  const pool = preferiti.length > 0 ? preferiti : list.filter((p) => p.playerId !== exclude);
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length)]!.playerId;
}

/** Quante azioni non-gol si aggiungono, oltre alle reti. */
const OCCASIONI_PER_PARTITA = 6;

/**
 * Costruisce la cronaca di una partita.
 *
 * Deterministica dal seme: rivedere la stessa partita mostra le stesse azioni. Con `context`
 * (le due formazioni vere) i movimenti avvengono fra giocatori reali, sulle loro posizioni
 * reali; senza, resta il racconto astratto di prima (usato dove le formazioni non servono, es.
 * i test che non montano la vista 2D).
 */
export function buildHighlights(
  result: MatchResult,
  seed: string,
  nameOf: (playerId: string | null) => string,
  context?: MatchTheatreContext,
): Highlight[] {
  const random = derivedRandom(seed, "highlights");
  const azioni: Highlight[] = [];
  const positions = context
    ? new Map([...layoutEleven(context.ourEleven, "for"), ...layoutEleven(context.opponentEleven, "against")])
    : undefined;

  // 1. I gol, che sono fatti e non si inventano.
  for (const evento of result.events) {
    azioni.push(daEvento(evento, nameOf, random, context, positions));
  }

  // 2. Le occasioni: distribuite nei minuti liberi, con più peso a chi ha attaccato di più.
  const quotaNostra =
    result.goalsFor + result.goalsAgainst > 0
      ? (result.goalsFor + 1) / (result.goalsFor + result.goalsAgainst + 2)
      : 0.5;
  const minutiOccupati = new Set(result.events.map((e) => e.minute));

  for (let i = 0; i < OCCASIONI_PER_PARTITA; i++) {
    let minuto = 1 + Math.floor(random() * 90);
    for (let tentativo = 0; tentativo < 5 && minutiOccupati.has(minuto); tentativo++) {
      minuto = 1 + Math.floor(random() * 90);
    }
    minutiOccupati.add(minuto);

    const team: "for" | "against" = random() < quotaNostra ? "for" : "against";
    const tipo = scegliOccasione(random);
    const attori = sceltaAttori(team, context, random);
    const target = puntoDi(attori.shooterId, positions) ?? bersaglio(team, random);
    const steps = generaSteps(tipo, team, target, random, attori, positions);
    azioni.push({
      minute: minuto,
      team,
      kind: tipo,
      playerId: null,
      text: testoOccasione(tipo, team),
      involvedPlayerIds: [attori.passerId, attori.shooterId].filter((id): id is string => !!id),
      ...target,
      steps,
    });
  }

  // 3. Un'espulsione ogni tanto: rara, perché cambia la partita e non dev'essere di routine.
  if (random() < 0.12) {
    const team: "for" | "against" = random() < 0.5 ? "for" : "against";
    const attori = sceltaAttori(team, context, random);
    const target = puntoDi(attori.shooterId, positions) ?? bersaglio(team, random);
    const steps = generaSteps("espulsione", team, target, random, attori, positions);
    azioni.push({
      minute: 40 + Math.floor(random() * 45),
      team,
      kind: "espulsione",
      playerId: null,
      text: team === "for" ? "Rosso per noi: si finisce in dieci." : "Espulso un avversario.",
      ...target,
      steps,
    });
  }

  return azioni.sort((a, b) => a.minute - b.minute);
}

/** Chi c'è dentro l'azione, quando conosciamo le formazioni vere: passatore e finalizzatore. */
interface Attori {
  passerId: string | null;
  shooterId: string | null;
  keeperId: string | null;
  defenderId: string | null;
  /**
   * La costruzione dell'azione per intero, in ordine di tocco (chi l'ha avviata, chi l'ha
   * rifinita, chi ha concluso — fino a 3 giocatori reali). `passerId`/`shooterId` restano gli
   * ultimi due anelli, per compatibilità con chi già li usa; `chain` è il di più che permette
   * a `generaSteps` di raccontare 2-3 passaggi invece di uno solo. Corta o assente quando il
   * pool non offre abbastanza compagni distinti (es. contesto di test) — non si ripete mai lo
   * stesso giocatore due volte nella stessa azione.
   */
  chain: string[];
}

/** Come `pickTeammate`, ma esclude un intero insieme già usato nella stessa azione. */
function pickTeammateExcludingAll(
  list: readonly TheatrePlayer[] | undefined,
  depts: Department[],
  random: () => number,
  exclude: ReadonlySet<string>,
): string | null {
  if (!list || list.length === 0) return null;
  const preferiti = list.filter((p) => depts.includes(p.department) && !exclude.has(p.playerId));
  const pool = preferiti.length > 0 ? preferiti : list.filter((p) => !exclude.has(p.playerId));
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length)]!.playerId;
}

function sceltaAttori(
  team: "for" | "against",
  context: MatchTheatreContext | undefined,
  random: () => number,
  scorerId?: string | null,
): Attori {
  const nostri = elevenOf(team, context);
  const avversari = elevenOf(team === "for" ? "against" : "for", context);
  const keeperId = pickTeammate(avversari, ["POR"], random);
  const defenderId = pickTeammate(avversari, ["DIF"], random, keeperId);

  const shooterId = scorerId ?? pickTeammate(nostri, ["ATT", "CC"], random);
  const used = new Set<string>();
  if (shooterId) used.add(shooterId);

  // Chi avvia l'azione (difesa) e chi la rifinisce (centrocampo): due tocchi reali in più
  // prima del tiro, quando il pool li offre distinti — altrimenti la catena si accorcia da
  // sola invece di far toccare palla due volte allo stesso uomo.
  const starterId = pickTeammateExcludingAll(nostri, ["DIF"], random, used);
  if (starterId) used.add(starterId);
  const midId = pickTeammateExcludingAll(nostri, ["CC"], random, used);
  if (midId) used.add(midId);

  const chain = [starterId, midId, shooterId].filter((id): id is string => !!id);
  const passerId = chain.length >= 2 ? chain[chain.length - 2]! : null;

  return { passerId, shooterId, keeperId, defenderId, chain };
}

function puntoDi(
  playerId: string | null,
  positions: Map<string, { x: number; y: number }> | undefined,
): { x: number; y: number } | undefined {
  if (!playerId || !positions) return undefined;
  return positions.get(playerId);
}

function daEvento(
  evento: MatchEvent,
  nameOf: (playerId: string | null) => string,
  random: () => number,
  context: MatchTheatreContext | undefined,
  positions: Map<string, { x: number; y: number }> | undefined,
): Highlight {
  const chi = nameOf(evento.scorerId);
  const rigore = evento.kind === "penalty";
  const kind = rigore ? "rigore" : "gol";
  const attori = sceltaAttori(evento.team, context, random, evento.scorerId);
  const target = puntoDi(evento.scorerId, positions) ?? bersaglio(evento.team, random, true);
  const steps = generaSteps(kind, evento.team, target, random, attori, positions);
  return {
    minute: evento.minute,
    team: evento.team,
    kind,
    playerId: evento.scorerId,
    text: rigore ? `Rigore trasformato da ${chi}` : `Gol di ${chi}`,
    involvedPlayerIds: [attori.passerId, evento.scorerId].filter((id): id is string => !!id),
    ...target,
    steps,
  };
}

function scegliOccasione(random: () => number): HighlightKind {
  const r = random();
  if (r < 0.45) return "occasione";
  if (r < 0.8) return "parata";
  return "palo";
}

function testoOccasione(kind: HighlightKind, team: "for" | "against"): string {
  const nostra = team === "for";
  switch (kind) {
    case "parata":
      return nostra ? "Grande parata del loro portiere" : "Il nostro portiere salva tutto";
    case "palo":
      return nostra ? "Palo pieno! Che sfortuna" : "Palo loro: ci è andata bene";
    default:
      return nostra ? "Occasione enorme, fuori di poco" : "Brividi: si salvano in angolo";
  }
}

/**
 * Dove finisce l'azione sul campo.
 *
 * Le nostre azioni convergono verso la porta avversaria (x alto), le loro verso la nostra. I
 * gol finiscono più vicini alla linea, le occasioni un po' più larghe: basta questa differenza
 * perché a schermo si legga *dove* stava succedendo qualcosa.
 */
function bersaglio(
  team: "for" | "against",
  random: () => number,
  gol = false,
): { x: number; y: number } {
  const profondita = gol ? 6 + random() * 6 : 14 + random() * 14;
  const x = team === "for" ? 100 - profondita : profondita;
  const y = 50 + (random() - 0.5) * (gol ? 26 : 50);
  return { x: Math.round(x), y: Math.round(Math.min(92, Math.max(8, y))) };
}

function generaSteps(
  kind: HighlightKind,
  team: "for" | "against",
  target: { x: number; y: number },
  random: () => number,
  attori?: Attori,
  positions?: Map<string, { x: number; y: number }>,
): ActionStep[] {
  const fx = (x: number) => (team === "for" ? x : 100 - x);
  // Il passaggio parte dalla posizione **vera** del passatore, quando la conosciamo: è ciò che
  // rende la costruzione dell'azione un movimento fra compagni reali e non fra punti a caso.
  const partenza = (attori && puntoDi(attori.passerId, positions)) || null;
  // Con la catena completa (chi avvia, chi rifinisce, chi conclude) c'è un tocco reale in più
  // prima della "Costruzione d'attacco": il pallone parte da chi l'ha recuperata, non appare
  // già sui piedi del rifinitore.
  const starterId = attori && attori.chain.length >= 3 ? attori.chain[attori.chain.length - 3] : undefined;
  const primoTocco = starterId ? puntoDi(starterId, positions) : undefined;

  if (kind === "gol") {
    const startY = partenza?.y ?? 15 + Math.floor(random() * 70);
    const startX = partenza?.x ?? fx(45);
    const passY = 30 + Math.floor(random() * 40);
    const buildupStep: ActionStep[] = primoTocco
      ? [
          {
            fromX: primoTocco.x,
            fromY: primoTocco.y,
            toX: startX,
            toY: startY,
            trajectory: "pass",
            durationMs: 600,
            phaseLabel: "Recupero palla e prima costruzione",
            activeActor: "passer",
            fromPlayerId: starterId,
            toPlayerId: attori?.passerId,
          },
        ]
      : [];
    return [
      ...buildupStep,
      {
        fromX: startX,
        fromY: startY,
        toX: fx(72),
        toY: passY,
        trajectory: "pass",
        durationMs: 700,
        phaseLabel: "Costruzione d'attacco",
        activeActor: "passer",
        fromPlayerId: attori?.passerId,
        toPlayerId: attori?.shooterId,
      },
      {
        fromX: fx(72),
        fromY: passY,
        toX: fx(86),
        toY: target.y,
        trajectory: "cross",
        durationMs: 650,
        phaseLabel: "Cross velenoso in area!",
        activeActor: "shooter",
        fromPlayerId: attori?.passerId,
        toPlayerId: attori?.shooterId,
      },
      {
        fromX: fx(86),
        fromY: target.y,
        toX: target.x,
        toY: target.y,
        trajectory: "shot",
        durationMs: 450,
        phaseLabel: "TIRO POTENTE... GOOOL!",
        activeActor: "keeper",
        fromPlayerId: attori?.shooterId,
        toPlayerId: attori?.keeperId,
      },
      {
        fromX: target.x,
        fromY: target.y,
        toX: fx(92),
        toY: target.y > 50 ? 10 : 90,
        trajectory: "celebration",
        durationMs: 1100,
        phaseLabel: "Esultanza sotto la curva!",
        activeActor: "shooter",
        fromPlayerId: attori?.shooterId,
        toPlayerId: attori?.shooterId,
      },
    ];
  }

  if (kind === "rigore") {
    return [
      {
        fromX: fx(88),
        fromY: 50,
        toX: fx(88),
        toY: 50,
        trajectory: "pass",
        durationMs: 900,
        phaseLabel: "Concentrazione sul dischetto...",
        activeActor: "shooter",
        fromPlayerId: attori?.shooterId,
        toPlayerId: attori?.shooterId,
      },
      {
        fromX: fx(88),
        fromY: 50,
        toX: target.x,
        toY: target.y,
        trajectory: "shot",
        durationMs: 500,
        phaseLabel: "Rincorsa e TIRO! RETE!",
        activeActor: "keeper",
        fromPlayerId: attori?.shooterId,
        toPlayerId: attori?.keeperId,
      },
      {
        fromX: target.x,
        fromY: target.y,
        toX: fx(93),
        toY: 50,
        trajectory: "celebration",
        durationMs: 1000,
        phaseLabel: "Rigore impeccabile!",
        activeActor: "shooter",
        fromPlayerId: attori?.shooterId,
        toPlayerId: attori?.shooterId,
      },
    ];
  }

  if (kind === "parata") {
    const startY = 20 + Math.floor(random() * 60);
    const cornerY = target.y > 50 ? 94 : 6;
    return [
      {
        fromX: fx(52),
        fromY: startY,
        toX: fx(76),
        toY: target.y,
        trajectory: "dribble",
        durationMs: 700,
        phaseLabel: "Incursione al limite dell'area",
        activeActor: "shooter",
      },
      {
        fromX: fx(76),
        fromY: target.y,
        toX: fx(94),
        toY: target.y,
        trajectory: "shot",
        durationMs: 450,
        phaseLabel: "Gran tiro diretto all'angolino!",
        activeActor: "keeper",
      },
      {
        fromX: fx(94),
        fromY: target.y,
        toX: fx(98),
        toY: cornerY,
        trajectory: "save_deflect",
        durationMs: 750,
        phaseLabel: "VOLO MIRACOLOSO DEL PORTIERE!",
        activeActor: "keeper",
      },
    ];
  }

  if (kind === "palo") {
    const shotY = 35 + Math.floor(random() * 30);
    const reboundY = shotY + (random() > 0.5 ? 20 : -20);
    return [
      {
        fromX: fx(58),
        fromY: shotY,
        toX: fx(80),
        toY: shotY,
        trajectory: "pass",
        durationMs: 650,
        phaseLabel: "Smarca l'attaccante al limite",
        activeActor: "shooter",
      },
      {
        fromX: fx(80),
        fromY: shotY,
        toX: fx(96),
        toY: target.y,
        trajectory: "shot",
        durationMs: 450,
        phaseLabel: "Bomba a botta sicura!",
        activeActor: "shooter",
      },
      {
        fromX: fx(96),
        fromY: target.y,
        toX: fx(82),
        toY: Math.max(10, Math.min(90, reboundY)),
        trajectory: "post_rebound",
        durationMs: 750,
        phaseLabel: "LEGNO PIENO! Sfortuna clamorosa!",
      },
    ];
  }

  if (kind === "espulsione") {
    return [
      {
        fromX: fx(48),
        fromY: 50,
        toX: fx(52),
        toY: 50,
        trajectory: "tackle",
        durationMs: 800,
        phaseLabel: "Intervento durissimo a centrocampo!",
        activeActor: "defender",
      },
      {
        fromX: fx(52),
        fromY: 50,
        toX: fx(52),
        toY: 50,
        trajectory: "tackle",
        durationMs: 1200,
        phaseLabel: "L'arbitro estrae il CARTELLINO ROSSO!",
        activeActor: "defender",
      },
    ];
  }

  // Default: occasione generica fuori
  const missY = target.y > 50 ? 92 : 8;
  const occStartY = partenza?.y ?? 30;
  const occStartX = partenza?.x ?? fx(45);
  const occBuildup: ActionStep[] = primoTocco
    ? [
        {
          fromX: primoTocco.x,
          fromY: primoTocco.y,
          toX: occStartX,
          toY: occStartY,
          trajectory: "pass",
          durationMs: 550,
          phaseLabel: "Ripartenza dalle retrovie",
          activeActor: "passer",
          fromPlayerId: starterId,
          toPlayerId: attori?.passerId,
        },
      ]
    : [];
  return [
    ...occBuildup,
    {
      fromX: occStartX,
      fromY: occStartY,
      toX: fx(74),
      toY: target.y,
      trajectory: "pass",
      durationMs: 700,
      phaseLabel: "Scambio rapido d'attacco",
      activeActor: "passer",
      fromPlayerId: attori?.passerId,
      toPlayerId: attori?.shooterId,
    },
    {
      fromX: fx(74),
      fromY: target.y,
      toX: fx(98),
      toY: missY,
      trajectory: "shot",
      durationMs: 500,
      phaseLabel: "Conclusione che sfila sul fondo!",
      activeActor: "shooter",
      fromPlayerId: attori?.shooterId,
      toPlayerId: attori?.keeperId,
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Quali partite meritano di essere guardate                                    */
/* -------------------------------------------------------------------------- */

export interface KeyMatchInput {
  /** Fase di coppa, se la partita è di Corona. */
  cupStage?: string;
  /** Giornata di campionato giocata, se ce n'è una. */
  leagueRound?: number;
  totalRounds: number;
  /** La nostra posizione in classifica dopo questa giornata. */
  position?: number;
  /** Punti di distacco dal primo (0 se siamo noi). */
  gapFromFirst?: number;
  /** La posizione dell'avversaria di giornata: senza, non si può giudicare uno scontro diretto. */
  opponentPosition?: number;
}

/** Quante squadre contano come "vertice" per uno scontro diretto. */
const TOP_TIER = 4;

/**
 * Questa partita merita di essere vista?
 *
 * Tre casi, deliberatamente pochi — allargare l'elenco significherebbe chiedere all'utente di
 * scegliere ogni settimana, e la domanda smetterebbe di valere qualcosa:
 *  - **il tabellone di Corona** (quarti in su): ogni partita è un'eliminazione;
 *  - **scontro diretto**: noi e l'avversaria siamo entrambi fra le prime quattro, a
 *    prescindere dalla giornata — è la partita che pesa di più nella corsa al vertice, non
 *    solo quella dell'ultimo mese;
 *  - **partita scudetto**: siamo 1º/2º, o comunque a uno svantaggio ancora colmabile coi punti
 *    rimasti in palio, e mancano al massimo due giornate (placeholder dichiarato — la stessa
 *    finestra "ultime giornate", solo più stretta delle quattro di prima).
 */
export function isKeyMatch({
  cupStage,
  leagueRound,
  totalRounds,
  position,
  gapFromFirst,
  opponentPosition,
}: KeyMatchInput): boolean {
  if (cupStage && cupStage !== "girone") return true;
  if (leagueRound === undefined || position === undefined) return false;

  const scontroDiretto = position <= TOP_TIER && opponentPosition !== undefined && opponentPosition <= TOP_TIER;
  if (scontroDiretto) return true;

  const mancano = totalRounds - (leagueRound + 1);
  const puntiInPalio = (mancano + 1) * 3;
  const inCorsaPerIlTitolo = position <= 2 || (gapFromFirst ?? 99) <= puntiInPalio;
  return mancano <= 2 && inCorsaPerIlTitolo;
}

/** Perché questa partita conta: la UI lo mostra nell'invito a guardarla. */
export function keyMatchReason(input: KeyMatchInput): string {
  if (input.cupStage && input.cupStage !== "girone") {
    return input.cupStage === "finale"
      ? "Finale di Corona Continentale"
      : `Corona: ${input.cupStage}, si gioca tutto in una partita`;
  }
  if (
    input.position !== undefined &&
    input.position <= TOP_TIER &&
    input.opponentPosition !== undefined &&
    input.opponentPosition <= TOP_TIER
  ) {
    return "Scontro diretto per il vertice";
  }
  return "Volata per il titolo: ogni punto pesa";
}

/* -------------------------------------------------------------------------- */
/* Rigori: la sequenza si racconta, non si decide                             */
/* -------------------------------------------------------------------------- */

export interface ShootoutKick {
  order: number;
  team: "for" | "against";
  scored: boolean;
}

/**
 * La sequenza dei tiri dal dischetto, coerente con l'esito **già deciso** (`season/cup.ts`,
 * 50/50 dichiarato — sempre 5 a 4, mai una vera sequenza di tiri). Stessa regola di
 * `buildHighlights`: qui non si decide chi vince, si racconta chi ha già vinto. Chi vince fa
 * tutti e cinque i rigori, chi perde ne sbaglia esattamente uno — il seme decide solo **quale**
 * dei cinque, così due rivincite non si assomigliano mai nei dettagli.
 */
export function buildShootout(weWon: boolean, seed: string): ShootoutKick[] {
  const random = derivedRandom(seed, "shootout");
  const missIndexFor = weWon ? -1 : Math.floor(random() * 5);
  const missIndexAgainst = weWon ? Math.floor(random() * 5) : -1;
  const kicks: ShootoutKick[] = [];
  for (let i = 0; i < 5; i++) {
    kicks.push({ order: kicks.length + 1, team: "for", scored: i !== missIndexFor });
    kicks.push({ order: kicks.length + 1, team: "against", scored: i !== missIndexAgainst });
  }
  return kicks;
}
