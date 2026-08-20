/**
 * **Come si ammorbidisce una richiesta del mister.**
 *
 * ⚠️ Segnalazione dell'utente: *"nel meeting con l'allenatore ho delle opzioni come proponi
 * compromesso che in realtà non servono a nulla. Amplia questa funzionalità cercando di abbassare
 * le pretese del mister. Tutte le opzioni a schermo devono portare a un risultato tangibile"*.
 *
 * La causa era precisa e sta in `proposePromiseCompromise`: il ramo `reduce_target` per una
 * promessa `negoziabile` **senza `targetValue` numerico** rispondeva *"accetto un compromesso
 * ragionevole su questo punto"* e lasciava la promessa **identica**. E le promesse senza soglia
 * numerica sono la maggioranza del catalogo (`sell_misfit`, `youth_prospect`,
 * `veteran_leadership`, `key_player_retention`, `domestic_core`, `budget_discipline`): il
 * "compromesso" era quasi sempre una frase e basta.
 *
 * Qui vive la risposta: per ogni tipo di richiesta, **come si fa più piccola**. Dove c'è un
 * numero si abbassa la soglia; dove non c'è si **restringe l'ambito** — che è il modo in cui
 * un allenatore vero viene incontro alla società: non rinuncia, chiede meno.
 *
 * Modulo puro e senza dipendenze dal resto della carriera: entra ed esce una promessa.
 */
import type { CoachPromise } from "./types";

/** Quante volte una singola richiesta può essere ammorbidita prima di essere al minimo. */
export const MAX_SOFTENINGS = 2;

export interface SoftenResult {
  /** La promessa dopo l'ammorbidimento. Uguale all'originale solo se non c'era più margine. */
  promise: CoachPromise;
  /** Ha davvero ceduto qualcosa? Se falso, la mossa deve produrre un altro esito. */
  changed: boolean;
  /** Cosa ha concesso, detto da lui: finisce nella chat. */
  reply: string;
  /** Non c'è più margine: da qui in poi si può solo stralciare o pagare. */
  exhausted: boolean;
}

/**
 * Quante volte questa promessa è già stata ammorbidita.
 *
 * ⚠️ Il primo tentativo lo deduceva contando un marcatore dentro la descrizione, e non poteva
 * funzionare: ogni concessione **riscrive** la descrizione, quindi il conto tornava sempre a
 * uno. L'ha colto il test "si ammorbidisce due volte, poi basta" al primo giro — ed è il genere
 * di stato che va tenuto in un campo, non ricavato dal testo che si mostra all'utente.
 */
function gradini(promise: CoachPromise): number {
  return promise.softenings ?? 0;
}

/**
 * Abbassa di un gradino le pretese su questa richiesta.
 *
 * **Ogni tipo sa come farsi più piccolo**, ed è questo a rendere la mossa sempre concreta:
 *  - dove c'è una soglia numerica si scende (Overall, quanti nazionali, quanto sfoltire);
 *  - dove non c'è, si **restringe l'ambito**: da "un giocatore che decide le partite" a "un
 *    titolare per quella casella", da "incedibile" a "incedibile in questa finestra", da "un
 *    giovane su cui lavorare" a "un giovane, anche uno già in rosa".
 *
 * `imprescindibile` cede **una volta sola** e lo dice: è ciò che gli lascia una linea, senza
 * trasformare il no in un muro.
 */
export function softenPromise(promise: CoachPromise): SoftenResult {
  const fatti = gradini(promise);
  const tetto = promise.priority === "imprescindibile" ? 1 : MAX_SOFTENINGS;

  if (fatti >= tetto) {
    return {
      promise,
      changed: false,
      reply:
        promise.priority === "imprescindibile"
          ? "Le sono già venuto incontro una volta su questo punto, Direttore. Più in basso non scendo."
          : "Su questa richiesta ho già limato tutto il limabile. O la togliamo, o resta così.",
      exhausted: true,
    };
  }

  const ultimo = fatti + 1 >= tetto;
  const coda = ultimo ? " Ma è l'ultima volta che ci torniamo sopra." : "";

  switch (promise.kind) {
    case "top_player": {
      const soglia = typeof promise.targetValue === "number" ? promise.targetValue : 84;
      const nuova = Math.max(74, soglia - 3);
      return {
        promise: {
          ...promise,
          softenings: fatti + 1,
          targetValue: nuova,
          description: "Un titolare vero per il reparto che conta, non per forza un fuoriclasse",
        },
        changed: true,
        reply: `Va bene: non pretendo più uno che le partite le decide da solo, ma un titolare che alzi il livello.${coda}`,
        exhausted: ultimo,
      };
    }

    case "formation_fit": {
      const soglia = typeof promise.targetValue === "number" ? promise.targetValue : 78;
      const nuova = Math.max(70, soglia - 3);
      // Se era **nominato**, la prima concessione è rinunciare al nome: molto più utile alla
      // società che tre punti di soglia, ed è ciò che un allenatore concede per primo.
      if (promise.targetPlayerId) {
        return {
          promise: {
            ...promise,
            softenings: fatti + 1,
            targetPlayerId: undefined,
            targetPlayerName: undefined,
            targetValue: nuova,
            description: "Un titolare per quella casella, il nome lo scelga lei",
          },
          changed: true,
          reply: `Rinuncio al nome: mi porti chi vuole, purché per quella casella sia da titolare.${coda}`,
          exhausted: ultimo,
        };
      }
      return {
        promise: {
          ...promise,
          softenings: fatti + 1,
          targetValue: nuova,
          description: "Qualcuno per quella casella che non sia un adattato",
        },
        changed: true,
        reply: `Scendo sull'asticella, ma quella casella non la copro con un adattato.${coda}`,
        exhausted: ultimo,
      };
    }

    case "key_player_retention":
      return {
        promise: {
          ...promise,
          softenings: fatti + 1,
          description:
            `${promise.targetPlayerName ?? "Il giocatore"} non si muove **in questa finestra**`,
        },
        changed: true,
        reply: `D'accordo: non chiedo che resti per sempre, chiedo che resti adesso.${coda}`,
        exhausted: ultimo,
      };

    case "sell_misfit":
      return {
        promise: {
          ...promise,
          softenings: fatti + 1,
          description:
            `${promise.targetPlayerName ?? "Quel giocatore"}: se non si cede, almeno vada in prestito`,
        },
        changed: true,
        reply: `Non serve venderlo per forza: mi basta che vada a giocare altrove.${coda}`,
        exhausted: ultimo,
      };

    case "youth_prospect":
      return {
        promise: {
          ...promise,
          softenings: fatti + 1,
          description: "Un giovane su cui lavorare, anche uno che abbiamo già in casa",
        },
        changed: true,
        reply: `Se non lo comprate, lo cerco in casa: ma un ragazzo su cui lavorare lo voglio.${coda}`,
        exhausted: ultimo,
      };

    case "veteran_leadership":
      return {
        promise: {
          ...promise,
          softenings: fatti + 1,
          description: "Uno con esperienza nello spogliatoio, non per forza un titolare",
        },
        changed: true,
        reply: `Non dev'essere un titolare: mi serve qualcuno che nello spogliatoio parli.${coda}`,
        exhausted: ultimo,
      };

    case "trim_squad": {
      const soglia = typeof promise.targetValue === "number" ? promise.targetValue : 23;
      return {
        promise: {
          ...promise,
          softenings: fatti + 1,
          targetValue: soglia + 2,
          description: `Una rosa che stia entro ${soglia + 2} elementi`,
        },
        changed: true,
        reply: `Le concedo due elementi in più, ma allenarne trenta non si può.${coda}`,
        exhausted: ultimo,
      };
    }

    case "domestic_core": {
      const soglia = typeof promise.targetValue === "number" ? promise.targetValue : 3;
      const nuova = Math.max(1, soglia - 1);
      return {
        promise: {
          ...promise,
          softenings: fatti + 1,
          targetValue: nuova,
          description: `Almeno ${nuova} giocatori di casa nello spogliatoio`,
        },
        changed: true,
        reply: `Ne basta uno in meno, purché lo spogliatoio parli anche la nostra lingua.${coda}`,
        exhausted: ultimo,
      };
    }

    case "depth_backup":
      return {
        promise: {
          ...promise,
          softenings: fatti + 1,
          description: "Un ricambio affidabile, anche di esperienza invece che di prospettiva",
        },
        changed: true,
        reply: `Va bene un ricambio d'esperienza: l'importante è non restare scoperti.${coda}`,
        exhausted: ultimo,
      };

    case "budget_discipline":
      return {
        promise: {
          ...promise,
          softenings: fatti + 1,
          description: "Non spendere tutto: qualcosa va tenuto per gennaio",
        },
        changed: true,
        reply: `Non le chiedo di risparmiare: le chiedo di non arrivare a gennaio a mani vuote.${coda}`,
        exhausted: ultimo,
      };

    default:
      // Nessuna forma ridotta prevista per questo tipo: si dichiara invece di fingere una
      // concessione. È esattamente il caso che prima produceva la frase a vuoto.
      return {
        promise,
        changed: false,
        reply: "Su questo non saprei nemmeno cosa toglierle, Direttore: o c'è, o non c'è.",
        exhausted: true,
      };
  }
}

/**
 * **Cosa serve per farlo cedere**, quando ammorbidire non basta più.
 *
 * ⚠️ È la seconda metà della richiesta dell'utente: *"tutte le opzioni a schermo devono portare
 * a un risultato tangibile"*. Un no che chiude la porta non è un risultato — un no che dichiara
 * il prezzo sì, perché lascia una mossa da fare. Le tre contropartite sono quelle che il sistema
 * già sa applicare, quindi non c'è nulla di nuovo da far funzionare: c'è da **dirle**.
 */
export type CounterDemandKind = "bonus_ingaggio" | "stralcia_altra" | "rimanda";

export interface CounterDemand {
  kind: CounterDemandKind;
  /** Quanto costa, quando la contropartita è economica. */
  amount?: number;
  /** Su quale altra richiesta si può cedere, quando la contropartita è uno scambio. */
  otherPromiseId?: string;
  text: string;
}

/**
 * La contropartita che il mister mette sul tavolo insieme al suo no.
 *
 * L'ordine non è casuale: si propone per prima la strada che **non costa soldi** (rimandare),
 * poi lo scambio con un'altra richiesta, e solo per ultima quella economica. Suggerire per prima
 * la più cara sarebbe spingere l'utente verso la scelta peggiore.
 */
export function counterDemandFor(
  promise: CoachPromise,
  altre: readonly CoachPromise[],
): CounterDemand {
  const rimandabile = promise.deadlineSeason === undefined;
  if (rimandabile) {
    return {
      kind: "rimanda",
      text: "Se adesso non si può, ne riparliamo alla prossima finestra: ma non me ne dimentico.",
    };
  }

  const scambiabile = altre.find((p) => p.id !== promise.id && p.priority !== "imprescindibile");
  if (scambiabile) {
    return {
      kind: "stralcia_altra",
      otherPromiseId: scambiabile.id,
      text: `Facciamo così: su questa non mollo, ma lascio cadere «${scambiabile.description}».`,
    };
  }

  const bonus = promise.salaryBonusDemanded ?? 1_000_000;
  return {
    kind: "bonus_ingaggio",
    amount: bonus,
    text: `Se proprio non se ne fa nulla, allora riconoscetemelo sull'ingaggio: ${Math.round(bonus / 100_000) / 10}M.`,
  };
}
