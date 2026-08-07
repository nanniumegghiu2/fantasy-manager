/**
 * Gli **eventi** che accadono fra una giornata e l'altra: infortuni, fatica, morale, e la
 * richiesta di cessione di chi non trova campo.
 *
 * Principio che attraversa tutto il file: un evento o è una **conseguenza** (l'infortunio: si
 * subisce, e la formazione si riadatta da sola) o è una **decisione** (la richiesta di
 * cessione: quattro opzioni, tutte con un prezzo). Non esistono eventi che siano solo un
 * messaggio: se non cambiano nulla e non chiedono nulla, sono rumore.
 *
 * Bersaglio di ritmo dichiarato: **4-8 decisioni a stagione**. Sotto, la carriera è una
 * sequenza di clic; sopra, diventa un ufficio reclami.
 */
import type { RosterEntry } from "./types";

/* -------------------------------------------------------------------------- */
/* Infortuni                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Probabilità base che un titolare si infortuni in una partita.
 *
 * Placeholder di bilanciamento **dichiarato**. Con 11 titolari e ~45 partite fra campionato e
 * coppa dà 15-18 infortuni a stagione: abbastanza da far sentire la rosa corta, non tanti da
 * rendere l'undici un sorteggio.
 */
export const BASE_INJURY_RISK = 0.025;

/** Quanto la fatica accresce il rischio: a fatica piena il pericolo è ~1.7 volte. */
export const FATIGUE_INJURY_WEIGHT = 150;

export interface Injury {
  playerId: string;
  /** Giornate di indisponibilità. */
  matchdays: number;
  severity: "lieve" | "media" | "grave";
}

/**
 * Estrae gli infortuni di una giornata fra i titolari che hanno giocato.
 *
 * **Momento scelto: la fine della partita, mai durante.** Il motore non ha alcun concetto di
 * sostituzione a gara in corso, e introdurlo significherebbe ricalcolare la forza della
 * squadra a metà estrazione di Poisson — un cambiamento invasivo per un guadagno solo
 * narrativo. Il referto può raccontare "uscito al 63'", ma l'effetto parte dalla giornata
 * successiva. Semplificazione dichiarata.
 */
export function rollInjuries(
  playedEntries: readonly RosterEntry[],
  random: () => number,
): Injury[] {
  const injuries: Injury[] = [];
  for (const entry of playedEntries) {
    const risk = BASE_INJURY_RISK * (1 + entry.fatigue / FATIGUE_INJURY_WEIGHT);
    if (random() >= risk) continue;

    const roll = random();
    if (roll < 0.6) {
      injuries.push({ playerId: entry.playerId, matchdays: 1 + Math.floor(random() * 2), severity: "lieve" });
    } else if (roll < 0.9) {
      injuries.push({ playerId: entry.playerId, matchdays: 3 + Math.floor(random() * 4), severity: "media" });
    } else {
      injuries.push({ playerId: entry.playerId, matchdays: 7 + Math.floor(random() * 9), severity: "grave" });
    }
  }
  return injuries;
}

/* -------------------------------------------------------------------------- */
/* Fatica                                                                      */
/* -------------------------------------------------------------------------- */

/** Fatica accumulata giocando una partita intera. */
export const FATIGUE_PER_MATCH = 18;
/** Fatica smaltita in una settimana da chi non ha giocato. */
export const FATIGUE_RECOVERY = 22;

/**
 * Aggiorna la fatica dopo una giornata.
 *
 * È l'unica ragione per cui la panchina conta davvero: senza, i quattordici giocatori oltre
 * l'undici sarebbero solo un'assicurazione contro gli infortuni, e la Corona Continentale non
 * avrebbe alcun prezzo sportivo.
 */
export function updateFatigue(entry: RosterEntry, played: boolean): number {
  const next = played ? entry.fatigue + FATIGUE_PER_MATCH : entry.fatigue - FATIGUE_RECOVERY;
  return clamp(next, 0, 100);
}

/* -------------------------------------------------------------------------- */
/* Morale e richieste di cessione                                              */
/* -------------------------------------------------------------------------- */

/** Sotto questa soglia il giocatore chiede la cessione. */
export const UNHAPPY_THRESHOLD = 38;
/** Morale verso cui tutti tendono col tempo. */
export const MORALE_BASELINE = 60;
/** Giornate di tregua dopo che una richiesta è stata risolta. */
export const REQUEST_COOLDOWN = 6;

/**
 * Di quanto un giocatore dev'essere più forte della media della rosa perché la panchina gli
 * pesi davvero.
 *
 * La condizione è **relativa alla squadra**, non assoluta, ed è il punto centrale: a un
 * giocatore da 82 all'Inter la panchina pesa meno che a uno da 76 al Lecce, perché nel secondo
 * caso è il migliore che hanno. Una soglia assoluta farebbe lamentare i campioni delle grandi
 * e tacere i migliori delle piccole, cioè l'esatto contrario.
 */
export const TOO_GOOD_FOR_BENCH_GAP = 4;

/** Quota di minuti sotto la quale un giocatore si considera "che non gioca". */
export const LOW_MINUTES_SHARE = 1 / 3;

export interface MoraleContext {
  /** Overall medio della rosa: il metro rispetto a cui si misura chi è "troppo forte". */
  squadAverage: number;
  /** Minuti disponibili finora in stagione (giornate giocate × 90). */
  availableMinutes: number;
  /** Il giocatore era in campo nell'ultima giornata? */
  played: boolean;
  /** Ha segnato nell'ultima giornata? */
  scored: boolean;
  /** L'utente ha appena rifiutato un'offerta per lui? */
  offerRefused?: boolean;
  /** Posizioni di distanza dall'obiettivo di inizio stagione (positivo = si sta sotto). */
  positionsBelowTarget?: number;
}

export interface MoraleChange {
  playerId: string;
  before: number;
  after: number;
  /** Perché è cambiato: la UI lo mostra, e serve a rendere l'evento comprensibile. */
  reasons: string[];
}

/**
 * Deriva del morale dopo una giornata.
 *
 * Tutte le componenti sono piccole di proposito: il morale deve muoversi in settimane, non in
 * una partita, altrimenti una sconfitta fa esplodere lo spogliatoio e l'utente impara a
 * ignorarlo.
 */
export function updateMorale(entry: RosterEntry, context: MoraleContext): MoraleChange {
  const reasons: string[] = [];
  let morale = entry.morale;

  const minutesShare =
    context.availableMinutes > 0 ? entry.stats.minutes / context.availableMinutes : 0;

  if (isTooGoodForBench(entry, context)) {
    morale -= 3;
    reasons.push("Gioca troppo poco per il suo valore");
  }
  if ((context.positionsBelowTarget ?? 0) > 4) {
    morale -= 2;
    reasons.push("La squadra è sotto le attese");
  }
  if (context.offerRefused) {
    morale -= 5;
    reasons.push("Hai rifiutato un'offerta per lui");
  }
  if (context.played) {
    morale += 2;
    reasons.push("Ha giocato");
  }
  if (context.scored) {
    morale += 3;
    reasons.push("È andato a segno");
  }

  // Ritorno graduale verso la media: senza, un morale basso non risalirebbe mai e ogni
  // giocatore finirebbe per chiedere la cessione prima o poi.
  morale += morale < MORALE_BASELINE ? 2 : morale > MORALE_BASELINE ? -1 : 0;

  // Chi gioca tanto è comunque contento, qualunque cosa dica il resto.
  if (minutesShare > 0.6 && morale < MORALE_BASELINE) morale += 1;

  return {
    playerId: entry.playerId,
    before: entry.morale,
    after: clamp(Math.round(morale), 0, 100),
    reasons,
  };
}

/** Il giocatore è nettamente più forte della media della rosa e non trova campo? */
export function isTooGoodForBench(entry: RosterEntry, context: MoraleContext): boolean {
  if (entry.overall < context.squadAverage + TOO_GOOD_FOR_BENCH_GAP) return false;
  if (context.availableMinutes <= 0) return false;
  // Se gioca con regolarità (in almeno il 40% delle giornate giocate), non è un panchinaro insoddisfatto
  const matchCount = context.availableMinutes / 90;
  if (matchCount > 0 && entry.stats.appearances / matchCount >= 0.4) return false;
  return entry.stats.minutes / context.availableMinutes < LOW_MINUTES_SHARE;
}

export type TransferRequestReason = "vuole_giocare" | "scontento" | "richiamato";

/**
 * Probabilità **per giornata** che un big chieda di andarsene pur stando benissimo.
 *
 * È la "richiesta a sorpresa" chiesta dall'utente. Senza, l'unica strada era il morale sotto
 * soglia — e siccome il morale tende alla media, capitava quasi mai: nelle simulazioni reali
 * era un evento che non si vedeva mai. Qui invece è il mercato a bussare: una grande chiama, e
 * il giocatore chiede di essere ascoltato anche se in squadra sta bene.
 */
export const SURPRISE_REQUEST_ODDS = 0.038;

export interface TransferRequest {
  playerId: string;
  reason: TransferRequestReason;
  /** Giornata in cui è stata aperta: serve al cooldown. */
  openedAtMatchday: number;
}

export interface RequestContext {
  matchday: number;
  /** C'è già una richiesta aperta? Se ne gestisce **una alla volta**. */
  hasOpenRequest: boolean;
  /** Giornata dell'ultima richiesta risolta, per il periodo di tregua. */
  lastResolvedMatchday?: number;
  /** Serve alla richiesta a sorpresa: senza, resta solo la strada del malcontento. */
  random?: () => number;
}

/**
 * Chi apre una richiesta di cessione, se qualcuno.
 *
 * Due valvole impediscono che l'evento diventi rumore di fondo: **una sola richiesta aperta
 * alla volta** e un periodo di tregua dopo ogni risoluzione. Senza, una rosa con tre
 * malcontenti bombarderebbe l'utente di decisioni tutte uguali.
 */
export function findTransferRequest(
  roster: readonly RosterEntry[],
  context: RequestContext,
  moraleContextOf: (entry: RosterEntry) => MoraleContext,
): TransferRequest | null {
  if (context.hasOpenRequest) return null;
  if (
    context.lastResolvedMatchday !== undefined &&
    context.matchday - context.lastResolvedMatchday < REQUEST_COOLDOWN
  ) {
    return null;
  }

  // Fra i malcontenti parla il più forte: è quello la cui uscita fa più male, quindi la
  // decisione è davvero una decisione.
  const candidates = roster
    .filter((entry) => entry.morale < UNHAPPY_THRESHOLD && !entry.loan)
    .sort((a, b) => b.overall - a.overall);

  const chosen = candidates[0];
  if (chosen) {
    return {
      playerId: chosen.playerId,
      reason: isTooGoodForBench(chosen, moraleContextOf(chosen)) ? "vuole_giocare" : "scontento",
      openedAtMatchday: context.matchday,
    };
  }

  /**
   * **La richiesta a sorpresa**: un big chiede di andarsene pur stando bene.
   *
   * Serve perché la strada del malcontento, da sola, non basta: il morale tende alla media, e
   * nelle simulazioni reali dell'utente l'evento non si vedeva mai. Qui è il mercato a bussare
   * — una grande chiama — e la decisione arriva quando meno la si aspetta, che è il punto.
   */
  const random = context.random;
  if (!random || random() >= SURPRISE_REQUEST_ODDS) return null;

  const big = [...roster]
    .filter((entry) => !entry.loan)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 4);
  const corteggiato = big[Math.floor(random() * big.length)];
  if (!corteggiato) return null;

  return {
    playerId: corteggiato.playerId,
    reason: "richiamato",
    openedAtMatchday: context.matchday,
  };
}

/** Le quattro risposte possibili a una richiesta di cessione. */
export type RequestResponse = "accetta" | "rifiuta" | "prometti" | "prestito";

export interface RequestOutcome {
  entry: RosterEntry;
  /** Il giocatore va messo in lista di cessione? */
  listed: boolean;
  /** Promessa aperta da onorare: se non gioca entro questa giornata, il crollo è peggiore. */
  promiseDeadline?: number;
  message: string;
}

/** Entro quante giornate va onorata la promessa di spazio. */
export const PROMISE_MATCHDAYS = 4;

/**
 * Applica la risposta dell'utente.
 *
 * La terza opzione è quella che rende la scelta interessante: promettere spazio è un
 * **debito**, non una soluzione. Alza il morale subito, ma se entro quattro giornate il
 * giocatore non è titolare il crollo è peggiore di quello che si voleva evitare.
 */
export function resolveTransferRequest(
  entry: RosterEntry,
  response: RequestResponse,
  matchday: number,
): RequestOutcome {
  switch (response) {
    case "accetta":
      return {
        entry: { ...entry, morale: clamp(entry.morale + 20, 0, 100) },
        listed: true,
        message: "Messo in lista di cessione: il prezzo richiesto scende.",
      };
    case "rifiuta":
      return {
        entry: { ...entry, morale: 15 },
        listed: false,
        message: "Resta, ma non l'ha presa bene: renderà meno finché non giocherà.",
      };
    case "prometti":
      return {
        entry: { ...entry, morale: clamp(entry.morale + 15, 0, 100) },
        listed: false,
        promiseDeadline: matchday + PROMISE_MATCHDAYS,
        message: `Gli hai promesso spazio: dev'essere titolare entro ${PROMISE_MATCHDAYS} giornate.`,
      };
    case "prestito":
      return {
        entry: { ...entry, morale: clamp(entry.morale + 25, 0, 100) },
        listed: false,
        message: "Andrà a giocare altrove e tornerà cresciuto.",
      };
  }
}

/** Una promessa non mantenuta: il morale crolla sotto il livello di partenza. */
export function breakPromise(entry: RosterEntry): RosterEntry {
  return { ...entry, morale: 0 };
}

/**
 * Malus all'Overall effettivo di chi è **in rotta con la società**.
 *
 * Da non confondere con `moralePenalty` di `lineup.ts`, che è una cosa diversa: quella pesa il
 * morale nella *scelta* dei titolari (un giocatore giù di morale viene preferito meno), questa
 * è il prezzo sportivo di una frattura conclamata e si applica a chi scende comunque in campo.
 *
 * Non tocca il valore anagrafico: è un calcolo derivato usato quando si schiera la squadra,
 * come il malus posizionale. Serve a dare un costo sportivo al "rifiuta" — altrimenti
 * rifiutare sarebbe sempre gratis e la decisione non esisterebbe.
 */
export function discontentPenalty(morale: number): number {
  if (morale <= 5) return 6;
  if (morale < UNHAPPY_THRESHOLD) return 3;
  return 0;
}

/**
 * Modificatore di **squadra** dal morale medio dei titolari, in punti attacco/difesa.
 *
 * `discontentPenalty` (sopra) è un malus **individuale**, applicato solo a chi è personalmente
 * in rotta. Qui invece è l'umore generale dello spogliatoio a contare: una squadra serena gioca
 * meglio nel suo insieme, non solo perché i singoli scontenti rendono meno — richiesta esplicita
 * dell'utente ("avere una squadra dal morale alto farà ottenere un bonus"), che oggi mancava
 * (il malus per morale basso esisteva già, il bonus per morale alto no). Simmetrico e limitato:
 * non deve sostituire l'effetto della chemistry, solo aggiungerne una sfumatura.
 */
export function moraleTeamModifier(avgMorale: number): number {
  const scarto = avgMorale - MORALE_BASELINE;
  if (scarto >= 15) return Math.min(3, Math.round((scarto - 15) / 10) + 1);
  if (scarto <= -20) return -Math.min(3, Math.round((-scarto - 20) / 10) + 1);
  return 0;
}

/**
 * Modificatore di **squadra** dalla fatica media dei titolari.
 *
 * La fatica pesava finora solo nella *scelta* dell'undici (`fatiguePenalty`, `lineup.ts`), mai
 * come effetto sul risultato di chi viene comunque schierato — richiesta esplicita dell'utente
 * ("una squadra troppo stanca non può ottenere buoni risultati"). Il tetto positivo è più basso
 * di quello negativo: una squadra fresca è normale, non un vantaggio tattico; una squadra sfinita
 * sì che si vede in campo.
 */
export function fatigueTeamModifier(avgFatigue: number): number {
  if (avgFatigue <= 15) return Math.min(2, Math.round((15 - avgFatigue) / 10) + 1);
  if (avgFatigue >= 70) return -Math.min(3, Math.round((avgFatigue - 70) / 10) + 1);
  return 0;
}

/** Nome leggibile del motivo, per il referto. */
export function requestReasonLabel(reason: TransferRequestReason): string {
  if (reason === "vuole_giocare") return "Vuole giocare";
  if (reason === "richiamato") return "Lo cerca una grande";
  return "È scontento";
}

/** Aggiorna gli infortuni: una giornata passata è una giornata in meno. */
export function tickInjuries(roster: readonly RosterEntry[]): RosterEntry[] {
  return roster.map((entry) =>
    entry.injuryMatchdaysLeft > 0
      ? { ...entry, injuryMatchdaysLeft: entry.injuryMatchdaysLeft - 1 }
      : entry,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
