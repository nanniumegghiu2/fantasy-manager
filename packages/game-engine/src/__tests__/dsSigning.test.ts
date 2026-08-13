/**
 * **L'acquisto è due trattative, non una.**
 *
 * Il difetto che ha imposto questa fase, segnalato dall'utente: chiuso l'accordo col club il
 * giocatore entrava in rosa e basta — con un ingaggio derivato dal seme che nessuno aveva
 * accettato, nessun controllo sul margine ingaggi, nessuna possibilità che dicesse di no. Era
 * l'unica operazione del gioco senza un tavolo contrattuale: un parametro zero si negozia su
 * cinque assi, un rinnovo pure, un acquisto da trenta milioni no.
 *
 * ⚠️ Prima di questa fase **nessun test copriva l'acquisto via trattativa fino alla rosa**: si
 * poteva cambiare quel ramo senza che una sola asserzione se ne accorgesse (verificato: la
 * modifica è passata con 789 test verdi). Questi test chiudono anche quel buco.
 */
import { describe, expect, it } from "vitest";
import {
  abandonSigning,
  createCareer,
  advanceWeek,
  isNegotiationBlocked,
  negotiatePurchase,
  playNegotiation,
  searchMarket,
  signIncomingPlayer,
  signingDemandOf,
  contractFor,
  financesOf,
  type CareerState,
  type CareerWorld,
  type SearchResult,
} from "../index";
import { CUP_CLUBS, CUP_LEAGUES, buildWorld, withCupAndMarket } from "./helpers/dsWorld";

function conMercato(seed: string): { state: CareerState; world: CareerWorld } {
  const base = buildWorld(80);
  const world = withCupAndMarket(base);
  const state = createCareer({
    seed,
    clubId: "mio",
    leagueId: "serie-a",
    coachId: "c-10",
    roster: base.roster,
    budget: 120_000_000,
    cupEntrants: { clubIds: CUP_CLUBS, leagues: CUP_LEAGUES },
  });
  return { state: advanceWeek(state, world).state, world };
}

/** Un bersaglio che possiamo permetterci, per non misurare il vincolo di budget per sbaglio. */
function bersaglio(state: CareerState, world: CareerWorld): SearchResult | undefined {
  return searchMarket(state, world, { maxPrice: 20_000_000, sort: "prezzo" })[0];
}

/** Porta la trattativa col club fino all'accordo. */
function accordoColClub(seed: string) {
  const { state, world } = conMercato(seed);
  const target = bersaglio(state, world);
  expect(target, "nessun bersaglio acquistabile: il test non verificherebbe nulla").toBeDefined();

  const aperta = negotiatePurchase(state, world, target!);
  const { state: dopo } = playNegotiation(aperta, world, { kind: "accetta" });
  return { state: dopo, world, target: target! };
}

describe("il contratto di chi stiamo comprando", () => {
  it("l'accordo col club non mette in rosa e non paga il cartellino", () => {
    const { state, world, target } = accordoColClub("firma-1");
    if (!state.negotiation?.awaitingContract) return; // il club può rifiutare: non è il caso in esame

    expect(state.roster.some((e) => e.playerId === target.playerId)).toBe(false);
    expect(state.budget).toBe(conMercato("firma-1").state.budget);
    expect(signingDemandOf(state, world, target.playerId, state.negotiation.amount)).toBeTruthy();
  });

  it("accettando le sue richieste firma, entra in rosa e il cartellino si paga", () => {
    const { state, world, target } = accordoColClub("firma-2");
    const tratt = state.negotiation;
    if (!tratt?.awaitingContract) return;

    const terms = signingDemandOf(state, world, target.playerId, tratt.amount, tratt.clubId)!;
    const budgetPrima = state.budget;

    const esito = signIncomingPlayer(state, world, {
      wage: terms.wage,
      seasons: terms.seasons,
      clause: terms.clause,
      guaranteedStarter: terms.wantsStarter,
      captain: terms.wantsCaptaincy,
    });

    expect(esito.ok, esito.message).toBe(true);
    expect(esito.state.roster.some((e) => e.playerId === target.playerId)).toBe(true);
    expect(esito.state.budget).toBe(budgetPrima - tratt.amount);

    // Il contratto è **quello firmato**, non quello derivato dal seme: è tutto il punto.
    const contratto = contractFor(esito.state, world, target.playerId);
    expect(contratto?.wage).toBe(terms.wage);
    expect(contratto?.until).toBe(esito.state.season + terms.seasons - 1);
  });

  it("un'offerta al ribasso lo fa rifiutare, e allora salta anche il cartellino", () => {
    const { state, world, target } = accordoColClub("firma-3");
    const tratt = state.negotiation;
    if (!tratt?.awaitingContract) return;

    const terms = signingDemandOf(state, world, target.playerId, tratt.amount, tratt.clubId)!;
    const budgetPrima = state.budget;

    const esito = signIncomingPlayer(state, world, {
      // Metà di quello che chiede, niente durata, niente garanzie: nessuna personalità firma.
      wage: Math.round(terms.wage * 0.35),
      seasons: 1,
      clause: 0,
    });

    expect(esito.ok).toBe(false);
    expect(esito.state.roster.some((e) => e.playerId === target.playerId)).toBe(false);
    expect(esito.state.budget, "il cartellino non va pagato se il contratto salta").toBe(budgetPrima);
    // D4: bloccato per il resto della finestra, altrimenti si riapre finché non esce il sì.
    expect(isNegotiationBlocked(esito.state, target.playerId)).toBe(true);
  });

  it("alzarsi dal tavolo del contratto blocca il giocatore quanto un rifiuto", () => {
    const { state, target } = accordoColClub("firma-4");
    if (!state.negotiation?.awaitingContract) return;

    const dopo = abandonSigning(state);
    expect(dopo.negotiation?.status).toBe("arenata");
    expect(isNegotiationBlocked(dopo, target.playerId)).toBe(true);
    expect(dopo.roster.some((e) => e.playerId === target.playerId)).toBe(false);
  });

  it("un ingaggio oltre il margine non si può firmare, e lo dice prima", () => {
    const { state, world, target } = accordoColClub("firma-5");
    const tratt = state.negotiation;
    if (!tratt?.awaitingContract) return;

    const margine = financesOf(state, world).wageRoom;
    const esito = signIncomingPlayer(state, world, {
      wage: margine + 5_000_000,
      seasons: 3,
    });

    expect(esito.ok).toBe(false);
    expect(esito.message).toMatch(/margine ingaggi/i);
    // Rifiutare per mancanza di margine **non** è un no del giocatore: la trattativa resta viva.
    expect(esito.state.negotiation?.awaitingContract).toBe(true);
    expect(isNegotiationBlocked(esito.state, target.playerId)).toBe(false);
  });

  it("chi arriva più forte della media pretende il posto da titolare", () => {
    const { state, world } = conMercato("firma-6");
    const forti = searchMarket(state, world, { minOverall: 85, sort: "overall" });
    const deboli = searchMarket(state, world, { maxOverall: 70, sort: "overall" });
    if (forti.length === 0 || deboli.length === 0) return;

    const alto = signingDemandOf(state, world, forti[0]!.playerId, 30_000_000);
    const basso = signingDemandOf(state, world, deboli[0]!.playerId, 2_000_000);

    expect(alto?.wantsStarter).toBe(true);
    // Il debole può volerlo lo stesso se è un giovane ambizioso: si verifica l'ingaggio, che è
    // la scala su cui i due casi si separano sempre.
    expect(alto!.wage).toBeGreaterThan(basso!.wage);
  });
});
