/**
 * **Nel meeting col mister, ogni opzione porta a un risultato tangibile.**
 *
 * ⚠️ Segnalazione dell'utente: *"ho delle opzioni come proponi compromesso che in realtà non
 * servono a nulla. Amplia questa funzionalità cercando di abbassare le pretese del mister. Tutte
 * le opzioni a schermo devono portare a un risultato tangibile nella conversazione"*.
 *
 * La causa stava in un ramo solo: `reduce_target` su una promessa `negoziabile` **senza soglia
 * numerica** rispondeva *"accetto un compromesso ragionevole"* e lasciava la promessa
 * **identica**. E le promesse senza soglia sono la maggioranza del catalogo.
 *
 * Il test centrale qui sotto è la formulazione letterale della richiesta: si scorrono **tutte**
 * le mosse su **tutti** i tipi di promessa, e per ognuna si pretende che qualcosa sia cambiato —
 * la promessa, l'ingaggio, o almeno una contropartita dichiarata. Non verifica una frase:
 * verifica che sia successo qualcosa.
 */
import { describe, expect, it } from "vitest";
import {
  openCoachNegotiation,
  proposePromiseCompromise,
} from "../ds/coachNegotiation";
import { softenPromise, counterDemandFor, MAX_SOFTENINGS } from "../ds/promiseSoftening";
import { findCoach } from "../ds/coaches";
import type { CoachPromise, CoachPromiseKind } from "../ds/types";

const TIPI: CoachPromiseKind[] = [
  "top_player",
  "formation_fit",
  "sell_misfit",
  "youth_prospect",
  "veteran_leadership",
  "trim_squad",
  "key_player_retention",
  "depth_backup",
  "domestic_core",
  "budget_discipline",
];

function promessa(
  kind: CoachPromiseKind,
  priority: CoachPromise["priority"] = "negoziabile",
): CoachPromise {
  return {
    id: `p-${kind}-${priority}`,
    kind,
    description: `Richiesta di tipo ${kind}`,
    seasonAccepted: 1,
    fulfilled: false,
    priority,
    salaryBonusDemanded: 900_000,
    // Solo alcuni tipi hanno una soglia: è proprio l'assenza a rompere il vecchio compromesso.
    targetValue: kind === "top_player" || kind === "formation_fit" ? 84 : undefined,
    targetRole: kind === "formation_fit" ? "DC" : undefined,
    targetPlayerId: kind === "key_player_retention" || kind === "sell_misfit" ? "x1" : undefined,
    targetPlayerName: kind === "key_player_retention" || kind === "sell_misfit" ? "Rossi" : undefined,
  };
}

function stato(promesse: CoachPromise[]) {
  return openCoachNegotiation(findCoach("c-10")!, promesse, true, 0);
}

/** Qualcosa è cambiato rispetto a prima? È la definizione operativa di "risultato tangibile". */
function haProdottoQualcosa(
  prima: ReturnType<typeof stato>,
  esito: ReturnType<typeof proposePromiseCompromise>,
  id: string,
): boolean {
  const a = prima.promises.find((p) => p.id === id);
  const b = esito.state.promises.find((p) => p.id === id);
  if (!b) return true; // stralciata
  if (JSON.stringify(a) !== JSON.stringify(b)) return true; // modificata
  if (esito.state.hireCost !== prima.hireCost) return true; // pagata
  if (esito.counterDemand) return true; // rifiutata, ma con il prezzo dichiarato
  return false;
}

describe("ogni mossa del meeting col mister produce un effetto", () => {
  const mosse = ["reduce_target", "remove_promise", "delay", "offer_alternative"] as const;

  it("nessuna combinazione di mossa e tipo di richiesta lascia le cose come stavano", () => {
    const inerti: string[] = [];
    for (const kind of TIPI) {
      for (const priority of ["imprescindibile", "negoziabile", "flessibile"] as const) {
        for (const mossa of mosse) {
          const p = promessa(kind, priority);
          const prima = stato([p, promessa("depth_backup", "flessibile")]);
          const esito = proposePromiseCompromise(prima, p.id, mossa);
          if (!haProdottoQualcosa(prima, esito, p.id)) inerti.push(`${kind}/${priority}/${mossa}`);
        }
      }
    }
    // È la richiesta dell'utente, alla lettera.
    expect(inerti, "mosse senza alcun effetto").toEqual([]);
  });

  it("il compromesso abbassa davvero le pretese, non solo le parole", () => {
    for (const kind of TIPI) {
      const p = promessa(kind, "negoziabile");
      const esito = softenPromise(p);
      expect(esito.changed, `${kind} non sa farsi più piccola`).toBe(true);
      // La descrizione cambia sempre: è ciò che l'utente vede sulla scheda.
      expect(esito.promise.description).not.toBe(p.description);
    }
  });

  it("una soglia numerica scende davvero", () => {
    const p = promessa("top_player", "negoziabile");
    const esito = softenPromise(p);
    expect(Number(esito.promise.targetValue)).toBeLessThan(Number(p.targetValue));
  });

  it("su una richiesta nominata la prima concessione è rinunciare al nome", () => {
    const p = promessa("formation_fit", "negoziabile");
    p.targetPlayerId = "tizio";
    p.targetPlayerName = "Tizio";
    const esito = softenPromise(p);
    expect(esito.promise.targetPlayerId).toBeUndefined();
    expect(esito.promise.description).toMatch(/il nome lo scelga lei/i);
  });

  it("l'imprescindibile cede una volta sola, e lo dice", () => {
    let p = promessa("top_player", "imprescindibile");
    const primo = softenPromise(p);
    expect(primo.changed).toBe(true);
    expect(primo.exhausted).toBe(true);

    p = primo.promise;
    const secondo = softenPromise(p);
    expect(secondo.changed).toBe(false);
    expect(secondo.reply).toMatch(/gi[àa] venuto incontro|non scendo/i);
  });

  it("una negoziabile si ammorbidisce due volte, poi basta", () => {
    let p = promessa("domestic_core", "negoziabile");
    for (let i = 0; i < MAX_SOFTENINGS; i++) {
      const e = softenPromise(p);
      expect(e.changed, `gradino ${i + 1}`).toBe(true);
      p = e.promise;
    }
    expect(softenPromise(p).changed).toBe(false);
  });

  it("quando non cede, dichiara sempre cosa servirebbe", () => {
    const p = promessa("top_player", "imprescindibile");
    // Già al minimo: la mossa non può concedere altro.
    const esaurita = softenPromise(p).promise;
    const prima = stato([esaurita, promessa("trim_squad", "flessibile")]);
    const esito = proposePromiseCompromise(prima, esaurita.id, "reduce_target");
    expect(esito.accepted).toBe(false);
    expect(esito.counterDemand).toBeDefined();
    // E il testo la nomina: un no muto non è un risultato.
    expect(esito.message).toContain(esito.counterDemand!.text);
  });

  it("la contropartita più economica viene proposta per prima", () => {
    const p = promessa("top_player", "imprescindibile");
    // Rimandabile: nessuna scadenza già fissata.
    expect(counterDemandFor(p, []).kind).toBe("rimanda");

    // Già rimandata: allora si offre lo scambio con un'altra richiesta.
    const rimandata = { ...p, deadlineSeason: 2 };
    const altra = promessa("trim_squad", "flessibile");
    expect(counterDemandFor(rimandata, [rimandata, altra]).kind).toBe("stralcia_altra");

    // Nient'altro da scambiare: resta l'ingaggio, l'ultima strada e la più cara.
    expect(counterDemandFor(rimandata, [rimandata]).kind).toBe("bonus_ingaggio");
  });

  it("il bonus d'ingaggio continua a togliere la richiesta e ad alzare il costo", () => {
    const p = promessa("key_player_retention", "imprescindibile");
    const prima = stato([p]);
    const esito = proposePromiseCompromise(prima, p.id, "boost_salary");
    expect(esito.state.promises.find((x) => x.id === p.id)).toBeUndefined();
    expect(esito.state.hireCost).toBeGreaterThan(prima.hireCost);
  });
});
