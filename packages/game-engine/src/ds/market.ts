/**
 * Il **mercato**: quanto vale un giocatore, quanto lo si paga, e cosa fanno le altre squadre.
 *
 * Impostazione scelta dall'utente: mercato **mirato e leggibile**. Poche operazioni sensate
 * per club invece di un rimescolamento generale, e al massimo tre offerte concrete a finestra
 * per i propri giocatori. Il criterio non è il realismo assoluto ma la **comprensibilità**:
 * l'utente deve poter capire *perché* è successo qualcosa, altrimenti il mercato diventa
 * rumore di fondo che subisce invece di un avversario con cui negoziare.
 *
 * ## Il rischio numero uno: la deriva su dieci stagioni
 *
 * Senza vincoli, dieci stagioni di trasferimenti portano a configurazioni assurde — un club
 * con quindici fuoriclasse e campionati svuotati. I cinque vincoli qui sotto sono tutti
 * predicati puri e verificabili, e sono la parte di questo file che conta di più:
 *
 *  1. **nessun giocatore si crea o si distrugge** nel mercato: solo trasferimenti fra club
 *     (le nascite avvengono altrove, in `regen.ts`, e sono 1:1 coi ritiri);
 *  2. **banda di rosa** 21-27 con soglie di reparto, che vale anche per l'utente;
 *  3. **budget conservato**: comprare toglie, vendere aggiunge, nessuna moneta dal nulla;
 *  4. **tetto morbido sulle stelle**: l'appetito per un fuoriclasse si dimezza per ogni
 *     fuoriclasse già in rosa. È la leva singola più efficace contro il "club con quindici
 *     campioni", perché agisce prima che l'operazione venga anche solo proposta;
 *  5. **niente accumulo per ruolo**: non si compra il quarto giocatore dello stesso ruolo di
 *     pari livello.
 */
import { computeMarketValue, nationPrestigeTier } from "../marketValue";
import { canBuy, canSell, MIN_BY_DEPARTMENT } from "./roster";
import type { PlayerIndex, RosterEntry, SeasonStats } from "./types";
import type { Department } from "@app/shared-types";

/** Contesto di valutazione: dati di club e campionato che il `Player` non porta con sé. */
export interface ValuationContext {
  leaguePrestigeByClub: Record<string, number>;
  clubPrestige: Record<string, number>;
  clubsInSameEra: number;
}

/** Un giocatore ai fini del mercato: quel che serve per valutarlo e per decidere se serve. */
export interface MarketPlayer {
  playerId: string;
  clubId: string;
  overall: number;
  potential: number;
  age: number;
  nation: string;
  department: Department;
  stats: SeasonStats;
}

/** Overall a partire dal quale un giocatore è considerato una "stella". */
export const STAR_THRESHOLD = 86;

/**
 * Valore corrente di un giocatore.
 *
 * Non si memorizza mai: si ricalcola dal club **attuale**, così vendere a un club piccolo ne
 * abbassa il valore — effetto corretto e gratuito. Sopra la formula di base si applicano due
 * fattori:
 *  - **forma**, dal rendimento della stagione appena conclusa;
 *  - **età e potenziale**, perché chi compra paga anche gli anni davanti: a parità di Overall
 *    un ventenne in ascesa vale più di un trentenne in calo. È questo fattore a rendere
 *    profittevole valorizzare un giovane e rivenderlo, che è la strategia con cui un club
 *    piccolo può finanziarsi.
 */
export function currentValue(player: MarketPlayer, context: ValuationContext): number {
  const base = computeMarketValue({
    overall: player.overall,
    leaguePrestigeTier: context.leaguePrestigeByClub[player.clubId] ?? 3,
    clubPrestigeTier: context.clubPrestige[player.clubId] ?? 3,
    nationPrestigeTier: nationPrestigeTier(player.nation),
    clubsInSameEra: context.clubsInSameEra,
  });
  return roundToStep(base * formFactor(player) * ageFactor(player));
}

/** 0.85-1.20 dal rendimento: chi ha giocato e prodotto vale di più di chi è stato fermo. */
export function formFactor(player: MarketPlayer): number {
  const minutes = player.stats.minutes;
  if (minutes < 400) return 0.85; // quasi mai in campo: il mercato se ne accorge
  const per90 = ((player.stats.goals + player.stats.assists) / Math.max(minutes, 1)) * 90;
  const expected = player.department === "ATT" ? 0.5 : player.department === "CC" ? 0.3 : 0.1;
  const ratio = per90 / expected;
  return clamp(0.9 + ratio * 0.25, 0.85, 1.2);
}

/**
 * Il valore segue la prospettiva, non solo il presente.
 *
 * Un ventenne con margine vale più di quanto dica il suo Overall di oggi; un trentaduenne
 * vale meno, perché chi lo compra sa quante stagioni gli restano.
 */
export function ageFactor(player: MarketPlayer): number {
  const upside = Math.max(0, player.potential - player.overall);
  if (player.age <= 21) return clamp(1 + upside * 0.035, 1, 1.7);
  if (player.age <= 24) return clamp(1 + upside * 0.02, 1, 1.35);
  if (player.age <= 28) return 1;
  if (player.age <= 30) return 0.85;
  if (player.age <= 32) return 0.65;
  return 0.45;
}

export interface AskingPriceInput {
  player: MarketPlayer;
  value: number;
  /** Di quanto peggiora l'undici del venditore se lo cede: misura quanto gli serve. */
  strengthLoss: number;
  /** Il compratore è nella stessa lega e in zona alta di classifica? */
  rival?: boolean;
  /** Il giocatore ha chiesto la cessione: il venditore ha meno potere contrattuale. */
  wantsOut?: boolean;
}

/**
 * Il prezzo richiesto è **situazionale**, non una tabella.
 *
 * Se togliendo un giocatore la squadra crolla, il suo club lo fa pagare caro anche se il
 * listino dice altro; se il compratore è un rivale diretto, il prezzo sale ancora. È l'unico
 * modo perché "questo non si tocca" abbia un significato meccanico e non solo narrativo.
 */
export function askingPrice({
  value,
  strengthLoss,
  rival = false,
  wantsOut = false,
}: AskingPriceInput): number {
  const scarcity = clamp(1 + Math.max(0, strengthLoss) * 0.18, 1, 1.9);
  const rivalPremium = rival ? 1.6 : 1;
  // Chi ha chiesto la cessione indebolisce la posizione del suo club: sconto dichiarato.
  const mood = wantsOut ? 0.8 : 1;
  return roundToStep(value * scarcity * rivalPremium * mood);
}

/**
 * Quanto un club **desidera** un giocatore, 0-1. Zero significa "non lo prenderebbe mai".
 *
 * Qui vivono i vincoli anti-deriva 4 e 5: il tetto morbido sulle stelle e il divieto di
 * accumulo per ruolo agiscono sull'appetito, cioè **prima** che l'operazione sia proposta.
 * Filtrare a valle sarebbe meno efficace, perché il club continuerebbe a provarci.
 */
export function appetite(
  target: MarketPlayer,
  buyerSquad: MarketPlayer[],
  targetDepartmentNeed: number,
): number {
  if (targetDepartmentNeed <= 0) return 0;

  // (4) Tetto morbido sulle stelle: ogni fuoriclasse già in rosa dimezza l'appetito.
  const stars = buyerSquad.filter((p) => p.overall >= STAR_THRESHOLD).length;
  const starDamping = target.overall >= STAR_THRESHOLD ? Math.pow(0.5, stars) : 1;

  // (5) Niente accumulo: se ci sono già tre pari-ruolo dello stesso livello, non serve.
  const sameRole = buyerSquad.filter(
    (p) => p.department === target.department && Math.abs(p.overall - target.overall) <= 2,
  ).length;
  if (sameRole >= 3) return 0;

  // Quanto migliora davvero la squadra: il confronto è col peggiore del reparto.
  const inDepartment = buyerSquad.filter((p) => p.department === target.department);
  const weakest = inDepartment.length > 0 ? Math.min(...inDepartment.map((p) => p.overall)) : 0;
  const upgrade = clamp((target.overall - weakest) / 12, 0, 1);

  return clamp(upgrade * starDamping * clamp(targetDepartmentNeed, 0, 1), 0, 1);
}

/** Quanto la squadra ha bisogno di un reparto: 0 = coperto, 1 = emergenza. */
export function departmentNeed(
  squad: MarketPlayer[],
  department: Department,
  targetOverall: number,
): number {
  const group = squad.filter((p) => p.department === department);
  if (group.length < MIN_BY_DEPARTMENT[department]) return 1;
  const best = Math.max(...group.map((p) => p.overall));
  return clamp((targetOverall - best + 4) / 10, 0, 1);
}

export interface TransferOffer {
  playerId: string;
  fromClubId: string;
  toClubId: string;
  fee: number;
  /** Quanto il compratore ci teneva: decide se accetta una controproposta. */
  appetite: number;
}

export interface OfferDecision {
  accepted: boolean;
  /** Prezzo finale concordato, se accettata. */
  fee?: number;
}

/**
 * Risposta dell'IA a una controproposta dell'utente.
 *
 * L'aumento richiesto pesa in proporzione a quanto quel giocatore serviva al compratore: chi
 * ne ha davvero bisogno paga il sovrapprezzo, chi stava solo tentando si tira indietro. Così
 * la controproposta è una scommessa informata, non un pulsante che conviene sempre premere.
 */
export function respondToCounterOffer(
  offer: TransferOffer,
  counterFee: number,
  random: () => number,
): OfferDecision {
  const increase = counterFee / Math.max(offer.fee, 1) - 1;
  const tolerance = 0.15 + offer.appetite * 0.45;
  if (increase <= 0) return { accepted: true, fee: offer.fee };
  const probability = clamp(1 - increase / tolerance, 0, 1);
  return random() < probability ? { accepted: true, fee: counterFee } : { accepted: false };
}

/** Vincolo 2: l'operazione rispetta le bande di rosa di entrambe le squadre? */
export function isTransferLegal(
  sellerRoster: readonly RosterEntry[],
  buyerRoster: readonly RosterEntry[],
  playerId: string,
  players: PlayerIndex,
): { ok: boolean; reason?: string } {
  const sell = canSell(sellerRoster, playerId, players);
  if (!sell.ok) return { ok: false, reason: sell.reason };
  const buy = canBuy(buyerRoster);
  if (!buy.ok) return { ok: false, reason: buy.reason };
  return { ok: true };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundToStep(value: number, step = 50_000): number {
  return Math.max(step, Math.round(value / step) * step);
}
