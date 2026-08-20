/**
 * Gestore delle Trattative con l'Allenatore: Reazioni Umane, Compromessi e Bonus Ingaggio (DS Mode).
 *
 * Simula la trattativa contrattuale senza percentuali numeriche visibili, ma con reazioni
 * emotive e personali dell'allenatore. Se il mister rifiuta un compromesso o una rimozione,
 * l'utente può sbloccare la trattativa offrendo un bonus d'ingaggio che impatta direttamente sul budget.
 */
import type { Coach, CoachPromise, RosterEntry, PlayerIndex } from "./types";
import { counterDemandFor, softenPromise, type CounterDemand } from "./promiseSoftening";
import type { RoleCandidate } from "./coachRequestsCatalog";

export interface CoachNegotiationState {
  coachId: string;
  coachName: string;
  patience: number; // 0-100 (invisibile all'utente, gestita via dialoghi umani)
  hireCost: number; // Costo totale ingaggio (cresce se si offrono bonus ingaggio)
  buyoutFee: number;
  promises: CoachPromise[];
  status: "in_corso" | "firmata" | "arenata";
  log: { sender: "coach" | "user"; text: string }[];
}

/** Inizializza lo stato della trattativa contrattuale con la barra della pazienza al 100%. */
export function openCoachNegotiation(
  coach: Coach,
  promises: CoachPromise[],
  isDefaultCoach = false,
  buyoutFee = 0
): CoachNegotiationState {
  const hireCost = isDefaultCoach ? 0 : coach.hireCost;

  return {
    coachId: coach.id,
    coachName: coach.name,
    patience: 100,
    hireCost,
    buyoutFee,
    promises: [...promises],
    status: "in_corso",
    log: [
      {
        sender: "coach",
        text: `Buonasera Direttore, sono ${coach.name}. Per sposare il progetto e mettere la firma sul contratto voglio chiarire alcune richieste fondamentali.`,
      },
    ],
  };
}

/**
 * Gestisce una proposta del Direttore Sportivo su una singola promessa.
 *
 * Azioni possibili:
 * - "reduce_target": Proponi un compromesso sul target (es. Overall o quantità).
 * - "remove_promise": Chiedi di eliminare la richiesta.
 * - "boost_salary": Offri il bonus sull'ingaggio preteso dal mister per sbloccare il punto rifiutato.
 * - "offer_alternative": Proponi un bersaglio diverso (un altro giocatore reale) invece di
 *   pagare o rinunciare — solo per promesse con un ruolo/giocatore nominato.
 * - "delay": Rimanda la verifica alla finestra successiva (`deadlineSeason`), invece di
 *   risolverla ora — costa meno di un rifiuto ma non è gratis.
 *
 * I soldi non sono l'unica leva: `offer_alternative` e `delay` esistevano prima solo come
 * "paga o rinuncia", che non è una vera mediazione — segnalato dall'utente.
 */
export interface CompromiseOutcome {
  state: CoachNegotiationState;
  accepted: boolean;
  message: string;
  /**
   * ⚠️ **Un no che dichiara il prezzo.**
   *
   * Richiesta dell'utente: *«tutte le opzioni a schermo devono portare a un risultato
   * tangibile nella conversazione»*. Un rifiuto che chiude la porta non è un risultato — uno
   * che dice cosa servirebbe per cedere sì, perché lascia sempre una mossa da fare. È
   * presente **solo** quando la mossa non è passata.
   */
  counterDemand?: CounterDemand;
}

export function proposePromiseCompromise(
  state: CoachNegotiationState,
  promiseId: string,
  action: "reduce_target" | "remove_promise" | "boost_salary" | "offer_alternative" | "delay",
  alternativeCandidates?: RoleCandidate[],
): CompromiseOutcome {
  if (state.status !== "in_corso") {
    return { state, accepted: false, message: "La trattativa non è attiva." };
  }

  const promiseIndex = state.promises.findIndex((p) => p.id === promiseId);
  if (promiseIndex === -1) {
    return { state, accepted: false, message: "Promessa non trovata." };
  }

  const promise = state.promises[promiseIndex]!;
  const priority = promise.priority ?? "negoziabile";

  let accepted = true;
  let coachReply = "";
  let updatedPromises = [...state.promises];
  let newHireCost = state.hireCost;
  let patienceLoss = 20;
  let counterDemand: CounterDemand | undefined;

  if (action === "reduce_target") {
    /**
     * ⚠️ **Ogni compromesso cambia qualcosa di visibile.**
     *
     * Prima questo ramo, per una promessa `negoziabile` **senza soglia numerica**, rispondeva
     * *"accetto un compromesso ragionevole"* e lasciava la promessa identica. E le promesse
     * senza soglia sono la maggioranza del catalogo: il compromesso era quasi sempre una frase
     * e basta — la segnalazione dell'utente, alla lettera.
     *
     * Ora `softenPromise` sa **come si fa più piccola** ogni singola richiesta: dove c'è un
     * numero si scende, dove non c'è si restringe l'ambito. E quando non c'è più margine non si
     * finge: si dichiara, e arriva la contropartita.
     */
    if (priority === "flessibile") {
      patienceLoss = 10;
      updatedPromises = updatedPromises.filter((p) => p.id !== promiseId);
      coachReply = "Trattandosi di una richiesta secondaria, accetto volentieri il tuo compromesso e possiamo stralciarla.";
    } else {
      const esito = softenPromise(promise);
      patienceLoss = priority === "imprescindibile" ? 22 : 15;
      coachReply = esito.reply;
      if (esito.changed) {
        updatedPromises[promiseIndex] = { ...esito.promise, rejectedOffer: false };
      } else {
        accepted = false;
        // Segna il rifiuto: è ciò che sblocca il bonus d'ingaggio nel pannello.
        updatedPromises[promiseIndex] = { ...promise, rejectedOffer: true };
        counterDemand = counterDemandFor(promise, state.promises);
        coachReply = `${esito.reply} ${counterDemand.text}`;
      }
    }
  } else if (action === "remove_promise") {
    if (priority === "imprescindibile" || priority === "negoziabile") {
      accepted = false;
      patienceLoss = 40;
      updatedPromises[promiseIndex] = { ...promise, rejectedOffer: true };
      counterDemand = counterDemandFor(promise, state.promises);
      coachReply = `Toglierla del tutto no, Direttore: senza garanzie su "${promise.description}" non posso rispondere dei risultati. ${counterDemand.text}`;
    } else {
      patienceLoss = 15;
      updatedPromises = updatedPromises.filter((p) => p.id !== promiseId);
      coachReply = "Non sono felicissimo di rinunciarvi, ma per dimostrare apertura verso la società accetto di rimuovere la richiesta.";
    }
  } else if (action === "boost_salary") {
    const bonus = promise.salaryBonusDemanded ?? 1000000;
    newHireCost += bonus;
    patienceLoss = 5; // L'aumento economico gratifica l'allenatore
    updatedPromises = updatedPromises.filter((p) => p.id !== promiseId);
    coachReply = `L'adeguamento d'ingaggio di €${bonus.toLocaleString("it-IT")} riconosce il mio valore. A queste condizioni accetto di stralciare la richiesta dal contratto!`;
  } else if (action === "offer_alternative") {
    // Ha senso solo per promesse che nominano un ruolo/giocatore: altrove non c'è nulla da
    // sostituire, e si ripiega sullo stesso esito di un compromesso generico.
    const alternativa = (alternativeCandidates ?? []).find(
      (c) => c.role === promise.targetRole && c.playerId !== promise.targetPlayerId,
    );
    if (promise.targetRole && alternativa) {
      patienceLoss = 20;
      updatedPromises[promiseIndex] = {
        ...promise,
        targetPlayerId: alternativa.playerId,
        targetPlayerName: alternativa.playerName,
        description: `Acquisto di ${alternativa.playerName} (${promise.targetRole}, Overall ${alternativa.overall}) al posto della richiesta originale`,
        rejectedOffer: false,
      };
      coachReply = `${alternativa.playerName}? Non è la mia prima scelta, ma può funzionare nel sistema. Va bene, punto su di lui.`;
    } else {
      accepted = false;
      patienceLoss = 15;
      counterDemand = counterDemandFor(promise, state.promises);
      coachReply = `Un'alternativa credibile non ce l'ho in mente, Direttore. ${counterDemand.text}`;
    }
  } else if (action === "delay") {
    patienceLoss = 10;
    updatedPromises[promiseIndex] = {
      ...promise,
      deadlineSeason: promise.seasonAccepted + 1,
      rejectedOffer: false,
    };
    coachReply = "Va bene, non c'è fretta: rivediamola alla prossima finestra di mercato, non a questa.";
  }

  const newPatience = Math.max(0, state.patience - patienceLoss);
  const newStatus = newPatience === 0 ? "arenata" : "in_corso";

  if (newStatus === "arenata") {
    coachReply = `${coachReply} Avete tirato troppo la corda! La mia pazienza è esaurita: mi alzo dal tavolo, la trattativa finisce qui.`;
  }

  const userActionText =
    action === "reduce_target"
      ? `Proposta di compromesso su: "${promise.description}"`
      : action === "remove_promise"
        ? `Richiesta di eliminare la promessa: "${promise.description}"`
        : action === "delay"
          ? `Proposta di rimandare alla prossima finestra: "${promise.description}"`
          : action === "offer_alternative"
            ? `Proposta di un altro nome per: "${promise.description}"`
            : `Offerta di bonus sull'ingaggio di €${(promise.salaryBonusDemanded ?? 1000000).toLocaleString("it-IT")} per sbloccare: "${promise.description}"`;

  const newState: CoachNegotiationState = {
    ...state,
    patience: newPatience,
    hireCost: newHireCost,
    promises: updatedPromises,
    status: newStatus,
    log: [
      ...state.log,
      { sender: "user", text: userActionText },
      { sender: "coach", text: coachReply },
    ],
  };

  return { state: newState, accepted, message: coachReply, counterDemand };
}

/**
 * Sotto questa cifra il budget è considerato "speso tutto": la promessa di disciplina di
 * budget si rompe. Placeholder di bilanciamento dichiarato — coerente con `MIN_BUDGET` (sez.
 * 3.7.11), il pavimento già usato altrove per "una piccola squadra può ancora respirare".
 */
export const BUDGET_DISCIPLINE_FLOOR = 1_000_000;

export interface VerificationResult {
  allFulfilled: boolean;
  fulfilledCount: number;
  brokenCount: number;
  updatedPromises: CoachPromise[];
  coachResigned: boolean;
  harmonyDelta: number;
  summaryMessage: string;
}

/**
 * Questa promessa è soddisfatta **adesso**, dato lo stato attuale — la parte pura di verifica,
 * senza gli effetti (conteggio, dimissioni, messaggio) che sono affare solo di fine finestra.
 * Estratta apposta per essere riusata anche **durante** il mercato aperto (`livePromiseStatus`,
 * career.ts): il pallino verde/arancione nel pannello promesse deve aggiornarsi a ogni
 * transazione, non restare fermo allo stato con cui la promessa è stata accettata fino alla
 * chiusura della finestra.
 */
export function promiseSatisfiedNow(
  promise: CoachPromise,
  roster: RosterEntry[],
  playerIndex: PlayerIndex,
  currentSeason: number,
  clubNation: string,
  initialTopPlayerId?: string,
  currentBudget?: number,
): boolean {
  // Rimandata (azione "delay" della mediazione): non è ancora il momento di giudicarla — resta
  // "in sospeso", che qui trattiamo come non ancora infranta (la UI live la mostra a parte).
  if (promise.deadlineSeason !== undefined && promise.deadlineSeason > currentSeason) {
    return true;
  }

  switch (promise.kind) {
    case "top_player": {
      const requiredOverall = typeof promise.targetValue === "number" ? promise.targetValue : 80;
      return roster.some((e) => e.overall >= requiredOverall);
    }
    case "formation_fit": {
      const minOv = typeof promise.targetValue === "number" ? promise.targetValue : 75;
      if (promise.targetPlayerId) {
        // Nominata: soddisfatta solo da **quel** giocatore, non da un qualunque altro dello
        // stesso ruolo — è il punto di averlo nominato invece di lasciare la soglia generica.
        const preso = roster.find((e) => e.playerId === promise.targetPlayerId);
        return !!preso && preso.overall >= minOv - 3; // piccolo margine: può crescere/calare
      }
      if (promise.targetRole) {
        return roster.some((e) => {
          const p = playerIndex[e.playerId];
          if (!p || e.overall < minOv) return false;
          return p.role === promise.targetRole || p.secondaryRoles.includes(promise.targetRole!);
        });
      }
      return roster.length >= 18;
    }
    case "sell_misfit": {
      // Speculare a key_player_retention: soddisfatta quando quel giocatore **non** è più
      // in rosa — il mister lo vuole fuori dal sistema di gioco, non dentro.
      return promise.targetPlayerId ? !roster.some((e) => e.playerId === promise.targetPlayerId) : true;
    }
    case "youth_prospect": {
      return roster.some((e) => {
        const p = playerIndex[e.playerId];
        return p && e.sinceSeason === currentSeason;
      });
    }
    case "veteran_leadership": {
      return roster.some((e) => e.overall >= 75);
    }
    case "trim_squad": {
      const maxAllowed = typeof promise.targetValue === "number" ? promise.targetValue : 23;
      return roster.length <= maxAllowed;
    }
    case "key_player_retention": {
      const targetId = promise.targetPlayerId || initialTopPlayerId;
      return targetId ? roster.some((e) => e.playerId === targetId) : true;
    }
    case "depth_backup": {
      return roster.length >= 16;
    }
    case "domestic_core": {
      const requiredCount = typeof promise.targetValue === "number" ? promise.targetValue : 3;
      const count = roster.filter((e) => {
        const p = playerIndex[e.playerId];
        return p && p.nation.toLowerCase() === clubNation.toLowerCase();
      }).length;
      return count >= requiredCount;
    }
    case "budget_discipline": {
      // Nessuna informazione sul budget disponibile: non si può giudicare, si lascia passare
      // invece di romperla per una lacuna di chi chiama, non del giocatore.
      return currentBudget === undefined || currentBudget >= BUDGET_DISCIPLINE_FLOOR;
    }
    default:
      return true;
  }
}

/**
 * Esegue la verifica di tutte le promesse vincolanti fatte all'allenatore al termine
 * della finestra di mercato.
 */
export function verifyCoachPromises(
  promises: CoachPromise[],
  roster: RosterEntry[],
  playerIndex: PlayerIndex,
  currentSeason: number,
  clubNation: string,
  initialTopPlayerId?: string,
  /** Budget residuo, per `budget_discipline`. Assente → la promessa non si può giudicare, passa. */
  currentBudget?: number,
): VerificationResult {
  if (!promises || promises.length === 0) {
    return {
      allFulfilled: true,
      fulfilledCount: 0,
      brokenCount: 0,
      updatedPromises: [],
      coachResigned: false,
      harmonyDelta: 5,
      summaryMessage: "Nessuna promessa contrattuale in sospeso.",
    };
  }

  let fulfilledCount = 0;
  let brokenCount = 0;

  const updatedPromises = promises.map((promise) => {
    // Rimandata (azione "delay" della mediazione): non è ancora il momento di giudicarla, resta
    // in sospeso invece di contare come infranta — altrimenti rimandare non servirebbe a nulla.
    if (promise.deadlineSeason !== undefined && promise.deadlineSeason > currentSeason) {
      return promise;
    }

    const ok = promiseSatisfiedNow(
      promise,
      roster,
      playerIndex,
      currentSeason,
      clubNation,
      initialTopPlayerId,
      currentBudget,
    );

    if (ok) fulfilledCount++;
    else brokenCount++;

    return { ...promise, fulfilled: ok };
  });

  const allFulfilled = brokenCount === 0;
  const coachResigned = brokenCount >= 2 || (promises.length === 1 && brokenCount === 1);
  const harmonyDelta = allFulfilled ? 15 : -35 * brokenCount;

  const summaryMessage = coachResigned
    ? `ATTENZIONE: L'allenatore ha rassegnato le DIMISSIONI IRREVOCABILI per mancato rispetto delle promesse contrattuali (${brokenCount} promessa/e infranta/e)!`
    : allFulfilled
      ? "L'allenatore è entusiasta: tutte le promesse contrattuali sono state mantenute!"
      : `Il mister è fortemente scontento: ${brokenCount} promessa/e contrattuale/i non è stata mantenuta.`;

  return {
    allFulfilled,
    fulfilledCount,
    brokenCount,
    updatedPromises,
    coachResigned,
    harmonyDelta,
    summaryMessage,
  };
}
