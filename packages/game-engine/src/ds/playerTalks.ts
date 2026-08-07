/**
 * **La chat coi giocatori scontenti.**
 *
 * Prima l'unico modo di intervenire sul morale era subire `pendingRequest` — throttled, uno
 * alla volta, generato dal motore. Richiesta esplicita dell'utente: poter aprire la
 * conversazione con **qualunque** giocatore scontento dalla scheda Rosa, non solo aspettare che
 * tocchi a lui. Le due leve rispecchiano quelle già esistenti nella modalità (prometti/lista),
 * ma qui l'iniziativa è del direttore sportivo, non del giocatore.
 */
import type { CareerState } from "./career";
import type { RosterEntry } from "./types";

export type PlayerTalkAction = "promise_minutes" | "list_for_transfer" | "nothing";

export interface PlayerTalkOption {
  action: PlayerTalkAction;
  label: string;
  /** Se l'azione ha senso per questo giocatore adesso (es. non promettere a chi è già promesso). */
  available: boolean;
}

/** Le mosse disponibili nella chat, per lo stato attuale del giocatore. */
export function talkOptions(entry: RosterEntry, state: CareerState): PlayerTalkOption[] {
  const giaPromesso = !!state.minutesPromises?.[entry.playerId];
  const giaInLista = (state.lists?.transferList ?? []).includes(entry.playerId);
  return [
    {
      action: "promise_minutes",
      label: giaPromesso ? "Gli hai già promesso spazio" : "Promettigli più spazio",
      available: !giaPromesso,
    },
    {
      action: "list_for_transfer",
      label: giaInLista ? "È già in lista trasferimenti" : "Mettilo in lista trasferimenti",
      available: !giaInLista,
    },
    { action: "nothing", label: "Non c'è niente da fare per ora", available: true },
  ];
}

export interface PlayerTalkOutcome {
  state: CareerState;
  message: string;
}

/**
 * Applica l'esito della chat: cambia il morale e, per `promise_minutes`, apre un impegno
 * verificato giornata per giornata (`career.ts`, `applyMatchdayToRoster`) — non è solo un
 * numero che sale, è una promessa che si può mantenere o infrangere.
 */
export function applyPlayerTalk(
  state: CareerState,
  playerId: string,
  action: PlayerTalkAction,
): PlayerTalkOutcome {
  const entry = state.roster.find((e) => e.playerId === playerId);
  if (!entry) return { state, message: "Non fa parte della rosa." };

  const setMorale = (delta: number): CareerState => ({
    ...state,
    roster: state.roster.map((e) =>
      e.playerId === playerId ? { ...e, morale: Math.max(0, Math.min(100, e.morale + delta)) } : e,
    ),
  });

  if (action === "promise_minutes") {
    if (state.minutesPromises?.[playerId]) {
      return { state, message: "Gli hai già promesso spazio: aspetta che si veda in campo." };
    }
    const dopo = setMorale(8);
    return {
      state: {
        ...dopo,
        minutesPromises: { ...(state.minutesPromises ?? {}), [playerId]: { roundsWaited: 0 } },
      },
      message: "Gli hai promesso più spazio. Ora deve vederlo in campo entro tre giornate, o la fiducia crolla.",
    };
  }

  if (action === "list_for_transfer") {
    const lista = state.lists?.transferList ?? [];
    if (lista.includes(playerId)) return { state, message: "È già in lista trasferimenti." };
    const dopo = setMorale(5);
    return {
      state: {
        ...dopo,
        lists: { transferList: [...lista, playerId], loanList: state.lists?.loanList ?? [] },
      },
      message: "L'hai messo in lista trasferimenti: sa che puoi trovargli una sistemazione.",
    };
  }

  // "nothing": un piccolo prezzo per essere andati a sentirlo senza offrire nulla di concreto.
  return { state: setMorale(-2), message: "Non hai potuto offrirgli nulla di concreto. Non l'ha presa bene." };
}
