/**
 * **Determinismo del motore DS**: la precondizione del multigiocatore a passo bloccato.
 *
 * Nel modello scelto (`docs/piano-ds-multiplayer.md` §2, opzione B) il server custodisce solo
 * l'elenco ordinato delle decisioni, e **ogni client ricostruisce lo stato eseguendole**. Regge su
 * una sola proprietà: *stessi ingressi ⇒ stesso stato*. Se il motore avesse una sola fonte di
 * casualità non seedata, due giocatori vedrebbero due partite diverse — e il sintomo non sarebbe
 * un errore ma un **disaccordo**: classifiche che non coincidono, un derby con due risultati.
 *
 * Questi test simulano due client: **due mondi e due stati costruiti indipendentemente**, avanzati
 * con le stesse decisioni. Il confronto è settimana per settimana e non solo alla fine, perché una
 * divergenza va localizzata quando accade: a fine stagione l'impronta è di decine di migliaia di
 * caratteri e sapere solo che "differisce" non aiuta nessuno.
 *
 * Scritti **prima** di toccare il motore per il multigiocatore, per la stessa ragione per cui il
 * characterization test del campionato è stato scritto prima del suo rifacimento (Decision Log,
 * 2026-07-30): i test esistenti sono statistici o strutturali e **passerebbero anche se il motore
 * diventasse non riproducibile**.
 */
import { describe, expect, it } from "vitest";
import { advanceToNextStop, advanceWeek, type CareerState, type WeekDecisions } from "../ds/career";
import { evaluateAiCoaches, type WorldClub } from "../ds/aiWorld";
import { CAREER_SEASONS } from "../ds/types";
import { fullCareer, playSeason, rinnovaTutti } from "./helpers/dsWorld";
import { digest, firstDifference } from "./helpers/digest";

/**
 * Le decisioni di un DS **prevedibile**: identiche a ogni settimana e su entrambi i client.
 *
 * Serve che siano fisse, non che siano sagge: qui non si misura la qualità del gioco ma il fatto
 * che lo stesso ingresso produca la stessa uscita. Una politica che scegliesse "a caso" renderebbe
 * il test incapace di distinguere una divergenza del motore da una divergenza delle decisioni.
 */
const DECISIONI: WeekDecisions = { requestResponse: "prometti", closeMarket: true };

/**
 * Porta una carriera dentro la stagione, **con nessuna decisione in sospeso**.
 *
 * Due condizioni, e servono entrambe. Una carriera nasce in `mercato_estivo` con una finestra che
 * si apre alla prima settimana, e finché è aperta il calendario **non avanza**. Ma subito dopo la
 * chiusura può già esserci una richiesta di cessione sul tavolo — succede davvero al seme di questo
 * test — e `advanceToNextStop`, che chiama `advanceWeek` **senza decisioni**, si fermerebbe
 * all'istante con motivo `"richiesta"` e zero referti. Sarebbe il comportamento giusto del motore e
 * un test che non misura nulla.
 */
function avviaStagione(state: CareerState, world: Parameters<typeof advanceWeek>[1]): CareerState {
  let current = rinnovaTutti(state);
  for (let i = 0; i < 20; i++) {
    current = advanceWeek(current, world, DECISIONI).state;
    if (!current.market && !current.pendingRequest && current.league.round > 0) return current;
  }
  throw new Error("La carriera non raggiunge mai un punto senza decisioni aperte");
}

/** Confronto con messaggio utile: `toBe` su due stringhe enormi non è diagnosticabile. */
function esigiIdentici(a: unknown, b: unknown, dove: string) {
  const da = digest(a);
  const db = digest(b);
  if (da !== db) {
    throw new Error(`Stati divergenti — ${dove}\n${firstDifference(da, db)}`);
  }
  expect(da).toBe(db);
}

describe("determinismo del motore DS (precondizione del multigiocatore)", () => {
  it("due client indipendenti giocano la stessa stagione, settimana per settimana", () => {
    // Due istanze costruite **separatamente**: niente oggetti in comune, come due browser diversi.
    const clientA = fullCareer("lockstep", 80);
    const clientB = fullCareer("lockstep", 80);

    let a: CareerState = rinnovaTutti(clientA.state);
    let b: CareerState = rinnovaTutti(clientB.state);
    esigiIdentici(a, b, "stato iniziale");

    let giornateGiocate = 0;
    let stagioneFinita = false;

    for (let settimana = 1; settimana <= 60; settimana++) {
      const passoA = advanceWeek(a, clientA.world, DECISIONI);
      const passoB = advanceWeek(b, clientB.world, DECISIONI);

      /**
       * Si confronta anche il **referto**, non solo lo stato. È ciò che l'utente vede: due referti
       * diversi sono due partite diverse raccontate, anche se per caso lo stato finale coincide.
       */
      esigiIdentici(passoA.report, passoB.report, `referto della settimana ${settimana}`);
      esigiIdentici(passoA.state, passoB.state, `stato dopo la settimana ${settimana}`);

      a = passoA.state;
      b = passoB.state;
      /**
       * Il massimo, non il valore finale: `league.round` **si azzera alla chiusura della stagione**
       * per far posto a quella nuova, quindi leggerlo dopo il `break` misurerebbe la stagione
       * successiva e direbbe sempre zero.
       */
      giornateGiocate = Math.max(giornateGiocate, a.league.round);
      if (passoA.report.seasonEnded) {
        stagioneFinita = true;
        break;
      }
    }

    // Il test non deve poter passare a vuoto: se la stagione non fosse mai partita, i confronti
    // sopra sarebbero veri su stati identici e immobili.
    expect(giornateGiocate).toBeGreaterThan(30);
    expect(stagioneFinita).toBe(true);
  });

  it("`advanceToNextStop` è deterministico: stessa corsa, stessi referti, stesso motivo di stop", () => {
    const clientA = fullCareer("corsa", 80);
    const clientB = fullCareer("corsa", 80);

    const corsaA = advanceToNextStop(avviaStagione(clientA.state, clientA.world), clientA.world);
    const corsaB = advanceToNextStop(avviaStagione(clientB.state, clientB.world), clientB.world);

    expect(corsaA.reason).toBe(corsaB.reason);
    expect(corsaA.reports.length).toBe(corsaB.reports.length);
    esigiIdentici(corsaA.reports, corsaB.reports, "referti della corsa");
    esigiIdentici(corsaA.state, corsaB.state, "stato a fine corsa");

    // Una corsa che si ferma subito non dimostrerebbe nulla.
    expect(corsaA.reports.length).toBeGreaterThan(0);
  });

  it("una carriera intera resta identica sui due client, stagione dopo stagione", () => {
    const clientA = fullCareer("carriera-lunga", 80);
    const clientB = fullCareer("carriera-lunga", 80);

    let a: CareerState = clientA.state;
    let b: CareerState = clientB.state;
    let stagioniGiocate = 0;

    for (let s = 0; s < CAREER_SEASONS; s++) {
      a = playSeason(a, clientA.world);
      b = playSeason(b, clientB.world);
      stagioniGiocate++;
      /**
       * Il confronto è **a ogni stagione**, non solo alla decima: il ciclo di vita (ritiri, regen,
       * mercato del mondo IA) è il punto in cui una fonte di casualità non seedata si manifesta,
       * e sapere *in quale stagione* diverge dice quale sistema l'ha causata.
       */
      esigiIdentici(a, b, `stato a fine stagione ${stagioniGiocate}`);
      if (a.phase === "conclusa") break;
    }

    expect(stagioniGiocate).toBeGreaterThanOrEqual(3);
  });
});

describe("le fonti di casualità non seedate", () => {
  /**
   * Regressione diretta della falla trovata pianificando il multigiocatore: l'id delle notizie di
   * mercato allenatori conteneva un suffisso `Math.random()`. Invisibile in single-player — è solo
   * la chiave di una riga — e fatale a passo bloccato.
   */
  it("gli id delle notizie sul mercato allenatori non dipendono dal caso", () => {
    const clubs: WorldClub[] = [
      { id: "club-1", name: "Club Uno", leagueId: "serie-a", prestigeTier: 5 },
      { id: "club-2", name: "Club Due", leagueId: "serie-a", prestigeTier: 4 },
    ];
    const standings = [
      { clubId: "club-1", rank: 15 },
      { clubId: "club-2", rank: 18 },
    ];
    // `evaluateAiCoaches` toglie l'allenatore dalla mappa: serve una mappa fresca per esecuzione,
    // altrimenti la seconda chiamata non produrrebbe alcuna notizia e il test passerebbe a vuoto.
    const mappa = () => new Map([["club-1", "c-01"], ["club-2", "c-02"]]);

    const prima = evaluateAiCoaches(clubs, standings, 3, mappa());
    const dopo = evaluateAiCoaches(clubs, standings, 3, mappa());

    expect(prima.length).toBeGreaterThan(0);
    esigiIdentici(prima, dopo, "notizie del mercato allenatori");
  });
});
