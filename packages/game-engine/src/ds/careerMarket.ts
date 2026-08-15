/**
 * Il **mercato dentro una carriera**: cosa succede quando si apre una finestra, e cosa può
 * farci l'utente.
 *
 * Impostazione scelta: mercato **mirato e leggibile**. Non si rimescolano le rose dei 96 club
 * a ogni sessione — si generano poche operazioni sensate e, soprattutto, **al massimo tre
 * offerte concrete** per i propri giocatori. Il criterio non è il realismo assoluto ma la
 * comprensibilità: l'utente deve poter capire *perché* è arrivata quell'offerta, altrimenti
 * il mercato è rumore che subisce invece di un avversario con cui negoziare.
 *
 * Tutte le funzioni sono pure e ricevono un PRNG: una finestra di mercato riaperta dopo aver
 * ricaricato un salvataggio propone esattamente le stesse operazioni.
 */
import { derivedRandom } from "../random";
import {
  appetite,
  askingPrice,
  currentValue,
  departmentNeed,
  respondToCounterOffer,
  type MarketPlayer,
  type ValuationContext,
} from "./market";
import { canBuy, canSell, averageOverall, isLoanedIn, isLoanedOut, MIN_SQUAD_SIZE } from "./roster";
import {
  canLoanIn,
  canLoanOut,
  estimateLoanMinutes,
  isGoodLoanDestination,
  loanFee,
  openLoan,
} from "./loans";
import { quickSalePrice, type SearchResult } from "./scouting";
import { FABBISOGNO_PER_REPARTO } from "./aiWorld";
import type { PlayerIndex, PlayerRef, RosterEntry } from "./types";
import { ROLE_DEPARTMENT, type Department } from "@app/shared-types";

/** Quante offerte concrete arrivano al massimo in una finestra. */
export const MAX_OFFERS_PER_WINDOW = 3;

/**
 * Di quanto un club può stare **sotto** l'Overall di un giocatore e cercarlo lo stesso.
 *
 * Quattro punti: un club che gioca su 80 può ambire a un 84 (è il colpo che alza l'asticella),
 * non a un 90. Sopra questa soglia l'offerta non sarebbe una tentazione ma un errore del gioco.
 */
const MAX_BUYER_GAP = 4;

/** Il livello di un club: la media del suo undici titolare. */
function livelloClub(club: MarketClub): number {
  if (club.startingEleven.length === 0) return 70;
  return club.startingEleven.reduce((s, o) => s + o, 0) / club.startingEleven.length;
}
/** Quanti acquisti propone lo scouting: una rosa corta di candidati, non un catalogo. */
export const SHORTLIST_SIZE = 8;

export type MarketWindow = "estiva" | "riparazione";

/** Un'offerta dell'IA per un nostro giocatore. */
export interface IncomingOffer {
  playerId: string;
  playerName: string;
  fromClubId: string;
  fromClubName: string;
  fee: number;
  /** Quanto ci teneva: decide se accetterà una controproposta. */
  appetite: number;
}

/** Un giocatore che possiamo comprare. */
export interface ShortlistEntry {
  playerId: string;
  playerName: string;
  clubId: string;
  clubName: string;
  overall: number;
  age: number;
  price: number;
}

/** Un giovane da mandare in prestito, con la destinazione proposta. */
export interface LoanOffer {
  playerId: string;
  playerName: string;
  clubId: string;
  clubName: string;
  expectedMinutes: number;
  fee: number;
}

export interface MarketSnapshot {
  window: MarketWindow;
  offers: IncomingOffer[];
  shortlist: ShortlistEntry[];
  loanOffers: LoanOffer[];
  /** Giocatori IA in eccedenza reale (titolari+panchina coperti): il mercato IA "vivo". */
  aiSellable: AiSellableListing[];
  /**
   * Clausole rescissorie **già esercitate** all'apertura della finestra.
   *
   * Non è una scheda di cose da fare: è una notizia da leggere, e sta nello snapshot solo
   * perché il pannello di mercato la mostri in cima invece di lasciarla scorrere via fra i
   * messaggi di giornata. Vuota nella stragrande maggioranza delle finestre.
   */
  clauseSales?: ClauseSale[];
}

/**
 * Le due liste che l'utente compila sulla propria rosa.
 *
 * Non sono un dettaglio di comodo: sono il modo in cui si *dichiara una strategia* prima che il
 * mercato risponda. Mettere qualcuno in lista trasferimenti significa dire "questo lo cedo", e
 * il mercato lo prende sul serio — le offerte arrivano soprattutto per loro. Senza le liste
 * l'utente subirebbe le offerte invece di provocarle.
 */
export interface SquadLists {
  /** Id dei propri giocatori messi in vendita. */
  transferList: string[];
  /** Id dei propri giovani offerti in prestito. */
  loanList: string[];
}

export function emptySquadLists(): SquadLists {
  return { transferList: [], loanList: [] };
}

/** Un club del mondo, ai fini del mercato. */
export interface MarketClub {
  id: string;
  name: string;
  leagueId: string;
  /** Gli Overall del suo undici titolare: servono a capire se un prestito giocherebbe. */
  startingEleven: number[];
  /** Posizione nell'ultima classifica del suo campionato, per capire chi è un rivale. */
  lastPosition?: number;
}

/**
 * **L'anagrafica del mercato: chi è, non chi si può comprare.**
 *
 * Sono due domande diverse e confonderle è già costato due volte. La prima: restringendo
 * `players` ai soli giocatori altrui, `buildOffers` — che scarta chi non trova in anagrafica —
 * smetteva di generare **qualunque** offerta per i nostri. La seconda, segnalata dall'utente:
 * l'anagrafica si componeva dall'indice del mondo evoluto più due rattoppi (il roster di
 * database del nostro club e i regen), e **chi avevamo comprato da un altro club non stava in
 * nessuno dei tre** — `evolveWorld` lo toglie dal mondo perché è nostro, il database lo assegna
 * ancora alla vecchia squadra, e regen non è. Il suo nome cadeva sul ripiego `"Giocatore"`, e da
 * lì veniva **congelato** dentro le offerte di prestito salvate.
 *
 * Da qui in poi la regola è una funzione e non un commento: l'anagrafica è l'**unione** di tutto
 * ciò che conosciamo, e a filtrarsi è solo `transferPool`. Le fonti si sovrappongono di
 * proposito — chi arriva dopo aggiorna, nessuno azzera — perché l'unica cosa che potrebbe
 * reintrodurre il difetto è l'ordine di composizione.
 */
export function marketPlayerIndex(sources: {
  /** Tutti i giocatori del database: la fonte che non dimentica nessuno. */
  database: readonly PlayerRef[];
  /** Il mondo evoluto: esclude i nostri, ma è l'unico a contenere i regen dei club IA. */
  world: readonly PlayerRef[];
  /** I ragazzi nati nella nostra carriera: non esistono né nel database né nel mondo. */
  generated: readonly PlayerRef[];
}): PlayerIndex {
  const index: PlayerIndex = {};
  for (const gruppo of [sources.database, sources.world, sources.generated]) {
    for (const p of gruppo) {
      index[p.id] = { id: p.id, name: p.name, nation: p.nation, role: p.role, secondaryRoles: p.secondaryRoles };
    }
  }
  return index;
}

export interface MarketWorld {
  clubs: Record<string, MarketClub>;
  /** I giocatori acquistabili, cioè quelli degli altri club. */
  transferPool: MarketPlayer[];
  valuation: ValuationContext;
  /** Chi è: **tutti** i giocatori conosciuti, mai un sottoinsieme (`marketPlayerIndex`). */
  players: PlayerIndex;
  /** Nomi per id, per rendere leggibili offerte e liste. */
  nameOf: (playerId: string) => string;
  /**
   * Età di un giocatore nella stagione corrente.
   *
   * Serve al mercato quanto al ciclo di vita: senza, un trentatreenne varrebbe come un
   * ventenne di pari Overall e i prestiti non saprebbero chi è "giovane". Chi non ha data di
   * nascita nel pool ricade su un valore neutro, non su un errore.
   */
  ageOf: (playerId: string) => number;
  /** Quante giornate ha il campionato, per stimare i minuti di un prestito. */
  leagueRounds: number;
}

/**
 * Apre una finestra di mercato: genera offerte per i nostri, una lista della spesa e le
 * proposte di prestito.
 *
 * Le offerte arrivano **solo** per giocatori che si possono davvero vendere (la banda di rosa
 * vale anche per noi): ricevere un'offerta e non poterla accettare sarebbe una frustrazione
 * senza scopo.
 */
export function openMarketWindow(
  roster: readonly RosterEntry[],
  world: MarketWorld,
  ownClubId: string,
  ownLeagueId: string,
  budget: number,
  window: MarketWindow,
  seed: string,
  season: number,
  lists: SquadLists = emptySquadLists(),
): MarketSnapshot {
  const random = derivedRandom(seed, "market", season, window);
  const squadAverage = averageOverall(roster);

  return {
    window,
    offers: buildOffers(roster, world, ownClubId, ownLeagueId, window, random, lists, season),
    shortlist: buildShortlist(roster, world, budget, squadAverage, random),
    loanOffers: buildLoanOffers(roster, world, random),
    aiSellable: aiSellableListings(world, random),
  };
}

function buildOffers(
  roster: readonly RosterEntry[],
  world: MarketWorld,
  ownClubId: string,
  ownLeagueId: string,
  window: MarketWindow,
  random: () => number,
  lists: SquadLists,
  season: number,
): IncomingOffer[] {
  const vendibili = roster.filter((entry) => canSell(roster, entry.playerId, world.players).ok);
  const compratori = Object.values(world.clubs).filter((club) => club.id !== ownClubId);
  const offers: IncomingOffer[] = [];
  const inLista = new Set(lists.transferList);

  /**
   * **Quante offerte arrivano si decide prima**, e l'appetito dei club non decide più *se*
   * un'offerta esiste ma solo *quanto* vale.
   *
   * È la correzione di un difetto segnalato due volte dall'utente: le offerte erano pochissime
   * e sparivano del tutto dopo qualche stagione. La causa stava nel filtro sull'appetito —
   * `starDamping` dimezza il desiderio per ogni fuoriclasse già in rosa del compratore, quindi
   * i club forti (gli unici plausibili per un buon giocatore) risultavano quasi sempre
   * disinteressati e non partiva nulla. Con un bersaglio dichiarato il mercato è **sempre
   * vivo**; chi ti cerca poco lo dimostra offrendo poco, che è la forma giusta del
   * disinteresse in una trattativa.
   */
  const bersaglio =
    window === "estiva" ? 3 + Math.floor(random() * 2) : 1 + Math.floor(random() * 2);

  // **Prima chi hai messo in vendita.** È il modo in cui la tua strategia arriva al mercato:
  // dichiarare un giocatore cedibile deve produrre offerte, non lasciare che il caso decida
  // per te. Fra gli altri si mescola, così due finestre non propongono gli stessi nomi.
  const ordinati = [...vendibili]
    .map((entry) => ({ entry, peso: random() + (inLista.has(entry.playerId) ? 10 : 0) }))
    .sort((a, b) => b.peso - a.peso)
    .map((x) => x.entry);

  for (const entry of ordinati) {
    if (offers.length >= Math.min(bersaglio, MAX_OFFERS_PER_WINDOW)) break;

    /**
     * Il compratore dev'essere **credibile per quel giocatore**.
     *
     * Prima si pescava un club a caso, e il risultato era che una squadra di bassa classifica
     * offriva per il tuo fuoriclasse: irrealistico, e soprattutto privo di tensione — un'offerta
     * che non potresti mai prendere sul serio non è una decisione. Ora il livello del suo undici
     * dev'essere all'altezza: chi vale 88 lo cerca chi gioca a quel livello, non chi lotta per
     * non retrocedere.
     */
    let plausibili = compratori.filter((c) => {
      const livello = livelloClub(c);
      return livello >= entry.overall - MAX_BUYER_GAP;
    });

    // Se il giocatore è stato messo in lista trasferimenti dall'utente, il mercato deve rispondere:
    // se nessun club soddisfa il livello ideale (es. fuoriclasse o stagioni avanzate con declino generale),
    // si ripiega sui migliori club disponibili invece di far sparire le offerte nel nulla.
    //
    // **Lo stesso fallback vale anche senza lista, dalla terza stagione in poi.** Il mondo IA
    // cresce più lentamente della rosa utente (crescita smorzata e ferma nel picco 24-28), quindi
    // il divario si allarga stagione dopo stagione: senza questo allentamento le cessioni si
    // inaridivano proprio per chi non aveva ancora dichiarato nessuno cedibile — segnalato due
    // volte dall'utente. L'offerta resta comunque più bassa (stesso principio "chi cerca poco
    // offre poco": qui non si forza `dichiarato`, quindi l'appetito reale del club decide la cifra).
    if (plausibili.length === 0 && (inLista.has(entry.playerId) || season >= 3)) {
      const ordinatiPerLivello = [...compratori].sort((a, b) => livelloClub(b) - livelloClub(a));
      plausibili = ordinatiPerLivello.slice(0, Math.min(8, compratori.length));
    }

    if (plausibili.length === 0) continue;

    const club = plausibili[Math.floor(random() * plausibili.length)];
    if (!club) continue;

    const resolved = world.players[entry.playerId];
    if (!resolved) continue;

    const target: MarketPlayer = {
      playerId: entry.playerId,
      clubId: ownClubId,
      overall: entry.overall,
      potential: entry.potential,
      age: world.ageOf(entry.playerId),
      nation: resolved.nation,
      department: ROLE_DEPARTMENT[resolved.role],
      stats: entry.stats,
    };

    const need = departmentNeed(
      club.startingEleven.map((overall) => ({ ...target, overall })),
      target.department,
      entry.overall,
    );
    const want = appetite(target, club.startingEleven.map((o) => ({ ...target, overall: o })), need);
    const dichiarato = inLista.has(entry.playerId);

    /**
     * L'appetito diventa la **misura dell'offerta**, non un filtro.
     *
     * Chi ti cerca poco te lo dice offrendo poco (e reggerà male una controproposta, perché
     * `appetite` governa anche la trattativa); chi ti cerca davvero apre alto. Un club che non
     * lo vuole affatto offre comunque una cifra bassa, che è esattamente il tipo di proposta da
     * rifiutare — e rifiutare è una decisione, mentre il silenzio non lo è.
     */
    const interesse = Math.max(0.12, want);
    const value = currentValue(target, world.valuation);
    const rival = club.leagueId === ownLeagueId && (club.lastPosition ?? 20) <= 8;
    const generosita = 0.72 + interesse * 0.5;

    offers.push({
      playerId: entry.playerId,
      playerName: world.nameOf(entry.playerId),
      fromClubId: club.id,
      fromClubName: club.name,
      // Chi è dichiarato cedibile perde potere contrattuale: il mercato lo sa, e l'offerta
      // arriva più bassa. È il prezzo della lista, e ciò che rende una scelta e non un
      // pulsante gratuito da premere su tutta la rosa.
      fee: Math.round(
        askingPrice({ player: target, value, strengthLoss: 1, rival, wantsOut: dichiarato }) *
          generosita,
      ),
      appetite: dichiarato ? Math.max(interesse, 0.35) : interesse,
    });
  }

  /**
   * **In estate almeno un'offerta arriva sempre — ma solo se esiste un acquirente credibile.**
   * CLAUDE.md lo documenta come invariante, ma nessun codice lo garantiva davvero: con
   * `bersaglio` basso o candidati sfortunati nell'ordine casuale, la scheda Offerte poteva
   * aprirsi vuota anche quando un compratore plausibile esisteva. **Non** forza però un'offerta
   * quando **nessuno** è credibile (una rosa fortissima può legittimamente non avere pretendenti
   * alla sua portata): qui si cerca esplicitamente, fra tutti i vendibili e tutti i compratori,
   * la migliore coppia entro `MAX_BUYER_GAP` — un'offerta che non si potrebbe mai prendere sul
   * serio resterebbe rumore, non una decisione.
   */
  if (offers.length === 0 && window === "estiva") {
    let migliore: { entry: RosterEntry; club: MarketClub } | undefined;
    for (const entry of vendibili) {
      const credibili = compratori.filter((c) => livelloClub(c) >= entry.overall - MAX_BUYER_GAP);
      if (credibili.length === 0) continue;
      const club = [...credibili].sort((a, b) => livelloClub(b) - livelloClub(a))[0]!;
      const listato = inLista.has(entry.playerId);
      const migliorePrecedente = migliore ? inLista.has(migliore.entry.playerId) : false;
      if (!migliore || (listato && !migliorePrecedente) || entry.overall > migliore.entry.overall) {
        migliore = { entry, club };
      }
    }
    if (migliore) {
      const { entry: scelto, club } = migliore;
      const resolved = world.players[scelto.playerId];
      if (resolved) {
        const target: MarketPlayer = {
          playerId: scelto.playerId,
          clubId: ownClubId,
          overall: scelto.overall,
          potential: scelto.potential,
          age: world.ageOf(scelto.playerId),
          nation: resolved.nation,
          department: ROLE_DEPARTMENT[resolved.role],
          stats: scelto.stats,
        };
        const value = currentValue(target, world.valuation);
        const dichiarato = inLista.has(scelto.playerId);
        offers.push({
          playerId: scelto.playerId,
          playerName: world.nameOf(scelto.playerId),
          fromClubId: club.id,
          fromClubName: club.name,
          fee: Math.round(
            askingPrice({ player: target, value, strengthLoss: 1, rival: false, wantsOut: dichiarato }) * 0.75,
          ),
          appetite: 0.2,
        });
      }
    }
  }

  return offers;
}

/* -------------------------------------------------------------------------- */
/* Clausole rescissorie                                                        */
/* -------------------------------------------------------------------------- */

/** Un club ha pagato la clausola di un nostro giocatore: non c'è niente da negoziare. */
export interface ClauseSale {
  playerId: string;
  playerName: string;
  toClubId: string;
  toClubName: string;
  /** La cifra della clausola, cioè quanto incassiamo. Non è trattabile: è quella firmata. */
  fee: number;
  /** Quanto vale oggi sul mercato: dice se la clausola era un affare per loro o per noi. */
  marketValue: number;
}

/**
 * **Le clausole sono vere.**
 *
 * ⚠️ Difetto segnalato dall'utente, e il più netto del gruppo: `releaseClause` si negoziava al
 * tavolo del contratto, si salvava nell'override e **non la leggeva nessuno**. Una clausola che
 * nessuno può esercitare non è una concessione, è una casella di testo: firmarla non costava
 * nulla, quindi accettarla per chiudere una trattativa era sempre la scelta giusta.
 *
 * Adesso all'apertura di ogni finestra un club può pagarla e portarsi via il giocatore. Tre
 * regole, e nessuna è arbitraria:
 *
 *  1. **chi paga dev'essere credibile per quel giocatore** (`MAX_BUYER_GAP`, la stessa soglia
 *     che filtra le offerte normali) **e** abbastanza ricco: una clausola da ottanta milioni non
 *     la esercita chi lotta per non retrocedere;
 *  2. **quanto è probabile dipende dallo sconto**. Una clausola sotto il valore di mercato è un
 *     affare e qualcuno la coglie quasi sempre; una molto sopra è una protezione e resta lettera
 *     morta. È questo a rendere la cifra una decisione vera al momento della firma;
 *  3. **una sola per finestra**, e mai se la rosa scenderebbe sotto gli undici schierabili: la
 *     clausola è la notizia della sessione, non una falcidia.
 *
 * Non è un'offerta: `ClauseSale` è un fatto compiuto. Il DS non ha voce in capitolo, ed è
 * precisamente ciò che una clausola significa.
 */
export function buildClauseSales(
  roster: readonly RosterEntry[],
  world: MarketWorld,
  ownClubId: string,
  clauseOf: (playerId: string) => number | undefined,
  random: () => number,
): ClauseSale[] {
  if (roster.length <= MIN_SQUAD_SIZE) return [];

  const compratori = Object.values(world.clubs).filter((c) => c.id !== ownClubId);
  const candidati: ClauseSale[] = [];

  for (const entry of roster) {
    if (isLoanedIn(entry) || isLoanedOut(entry)) continue;
    const clausola = clauseOf(entry.playerId);
    if (!clausola || clausola <= 0) continue;

    const resolved = world.players[entry.playerId];
    if (!resolved) continue;

    const target: MarketPlayer = {
      playerId: entry.playerId,
      clubId: ownClubId,
      overall: entry.overall,
      potential: entry.potential,
      age: world.ageOf(entry.playerId),
      nation: resolved.nation,
      department: ROLE_DEPARTMENT[resolved.role],
      stats: entry.stats,
    };
    const valore = currentValue(target, world.valuation);
    if (valore <= 0) continue;

    // Quanto è appetibile: sotto il valore è un'occasione, molto sopra non la tocca nessuno.
    const rapporto = clausola / valore;
    const probabilita = Math.max(0, Math.min(0.8, 0.95 - (rapporto - 0.7) * 0.62));
    if (probabilita <= 0) continue;

    const plausibili = compratori.filter((club) => {
      if (livelloClub(club) < entry.overall - MAX_BUYER_GAP) return false;
      return clausola <= budgetPlausibile(club, world);
    });
    if (plausibili.length === 0) continue;

    // Un tiro per giocatore: l'ordine di scorrimento non deve decidere chi è a rischio.
    if (random() >= probabilita) continue;

    const club = plausibili[Math.floor(random() * plausibili.length)];
    if (!club) continue;

    candidati.push({
      playerId: entry.playerId,
      playerName: world.nameOf(entry.playerId),
      toClubId: club.id,
      toClubName: club.name,
      fee: clausola,
      marketValue: valore,
    });
  }

  if (candidati.length === 0) return [];
  // Una sola: se più di uno è stato "colpito", parte quello su cui la clausola era più bassa
  // rispetto al valore — cioè l'affare più evidente per chi compra.
  return [
    candidati.sort((a, b) => a.fee / a.marketValue - b.fee / b.marketValue)[0]!,
  ];
}

/**
 * Quanto può spendere un club in un colpo solo.
 *
 * `MarketClub` non porta un bilancio — il mondo IA lo calcola altrove — quindi si stima dal
 * livello dell'undici e dal prestigio, che sono i due dati che abbiamo qui. Serve a una domanda
 * sola: questa clausola è alla sua portata?
 */
function budgetPlausibile(club: MarketClub, world: MarketWorld): number {
  const livello = livelloClub(club);
  const prestigio = world.valuation.clubPrestige[club.id] ?? 3;
  return Math.max(8_000_000, Math.pow(1.22, Math.max(0, livello - 62)) * 1_400_000 * prestigio);
}

/** Un giocatore IA in eccedenza reale nel suo club: il mercato dei "cedibili" della ricerca. */
export interface AiSellableListing {
  playerId: string;
  playerName: string;
  clubId: string;
  clubName: string;
  overall: number;
  department: Department;
  price: number;
  /** Perché il club lo lascerebbe andare: mostrato in chiaro nella scheda. */
  reason: string;
}

/**
 * Chi le squadre IA cederebbero davvero, per **sovrabbondanza reale** (titolari+panchina già
 * coperti, sez. "mercato IA vivo" — CLAUDE.md §3.7.10), non a caso.
 *
 * Diversa dalla ricerca libera (`searchPlayers`, tutto il database piatto): qui compare solo
 * chi un club ha davvero in eccesso nel proprio reparto, col motivo dichiarato — è il modo in
 * cui il mercato IA "sopperisce alle proprie sovrabbondanze" invece di limitarsi a esistere.
 * Rigenerata a ogni finestra (il `random` passato è già seedato per stagione/finestra).
 */
export function aiSellableListings(
  world: MarketWorld,
  random: () => number,
  limit = 20,
): AiSellableListing[] {
  const perClubReparto = new Map<string, MarketPlayer[]>();
  for (const player of world.transferPool) {
    const chiave = `${player.clubId}|${player.department}`;
    const elenco = perClubReparto.get(chiave);
    if (elenco) elenco.push(player);
    else perClubReparto.set(chiave, [player]);
  }

  const risultati: AiSellableListing[] = [];
  for (const [chiave, giocatori] of perClubReparto) {
    const [clubId, dep] = chiave.split("|") as [string, Department];
    const eccedenza = giocatori.length - FABBISOGNO_PER_REPARTO[dep];
    if (eccedenza <= 0) continue;

    const club = world.clubs[clubId];
    // I più deboli del gruppo sono quelli davvero "di troppo": il club terrebbe i migliori.
    const cedibili = [...giocatori].sort((a, b) => b.overall - a.overall).slice(-eccedenza);
    for (const player of cedibili) {
      const value = currentValue(player, world.valuation);
      risultati.push({
        playerId: player.playerId,
        playerName: world.nameOf(player.playerId),
        clubId,
        clubName: club?.name ?? "Club",
        overall: player.overall,
        department: dep,
        // Scontato rispetto al valore pieno: il club vuole smaltirlo, non trattenerlo.
        price: Math.max(50_000, Math.round((value * 0.82) / 50_000) * 50_000),
        reason: `Il ${club?.name ?? "club"} ha già titolare e riserve coperte in ${dep}: valuta offerte.`,
      });
    }
  }

  // Mescolato (seedato): altrimenti la lista uscirebbe sempre nello stesso ordine di club.
  for (let i = risultati.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [risultati[i], risultati[j]] = [risultati[j]!, risultati[i]!];
  }
  return risultati.slice(0, limit);
}

function buildShortlist(
  roster: readonly RosterEntry[],
  world: MarketWorld,
  budget: number,
  squadAverage: number,
  random: () => number,
): ShortlistEntry[] {
  if (!canBuy(roster).ok) return [];

  // Si propongono solo giocatori **alla portata** e che migliorerebbero davvero: una lista
  // piena di fuoriclasse inarrivabili è peggio di una lista vuota.
  const candidati = world.transferPool
    .map((player) => ({ player, price: currentValue(player, world.valuation) }))
    .filter(({ player, price }) => price <= budget && player.overall >= squadAverage - 2)
    .sort((a, b) => b.player.overall - a.player.overall);

  const scelti: ShortlistEntry[] = [];
  const visti = new Set<string>();
  // Si pesca dalla parte alta con un po' di casualità, così due finestre non propongono la
  // stessa identica lista.
  for (let i = 0; i < candidati.length && scelti.length < SHORTLIST_SIZE; i++) {
    const index = Math.floor(random() * Math.min(candidati.length, SHORTLIST_SIZE * 3));
    const scelta = candidati[index] ?? candidati[i]!;
    if (visti.has(scelta.player.playerId)) continue;
    visti.add(scelta.player.playerId);
    const club = world.clubs[scelta.player.clubId];
    scelti.push({
      playerId: scelta.player.playerId,
      playerName: world.nameOf(scelta.player.playerId),
      clubId: scelta.player.clubId,
      clubName: club?.name ?? "Club",
      overall: scelta.player.overall,
      age: scelta.player.age,
      price: scelta.price,
    });
  }
  return scelti;
}

function buildLoanOffers(
  roster: readonly RosterEntry[],
  world: MarketWorld,
  random: () => number,
): LoanOffer[] {
  const clubs = Object.values(world.clubs);
  const offers: LoanOffer[] = [];

  for (const entry of roster) {
    if (offers.length >= 3) continue;
    if (entry.loan) continue;
    // Solo giovani: sopra la soglia il prestito non è più un percorso di crescita, ed è la
    // stessa regola che `canLoanOut` applicherà al momento di accettare.
    if (!canLoanOut(roster, {
      playerId: entry.playerId,
      age: world.ageOf(entry.playerId),
      overall: entry.overall,
      potential: entry.potential,
    }).ok) {
      continue;
    }
    // Destinazione dove giocherebbe davvero: mandarlo in panchina altrove non ha senso. Si
    // provano più club (non uno solo) prima di rinunciare: con un solo tentativo casuale un
    // giovane restava spesso senza alcuna proposta per pura sfortuna del sorteggio, mentre la
    // garanzia "in lista prestiti arriva subito una destinazione" (sez. 3.7.5, alla pari dei
    // trasferimenti) richiede che una destinazione **buona** si trovi quasi sempre, se esiste.
    let club: (typeof clubs)[number] | undefined;
    for (let tentativo = 0; tentativo < 8 && clubs.length > 0; tentativo++) {
      const candidato = clubs[Math.floor(random() * clubs.length)];
      if (candidato && isGoodLoanDestination(entry.overall, candidato.startingEleven)) {
        club = candidato;
        break;
      }
    }
    if (!club) continue;
    offers.push({
      playerId: entry.playerId,
      playerName: world.nameOf(entry.playerId),
      clubId: club.id,
      clubName: club.name,
      expectedMinutes: estimateLoanMinutes(entry.overall, club.startingEleven, world.leagueRounds),
      fee: loanFee(entry.overall * 100_000),
    });
  }
  return offers;
}

/* -------------------------------------------------------------------------- */
/* Azioni dell'utente                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Tutto ciò che si può fare in una finestra di mercato.
 *
 * Le azioni sono divise in tre famiglie, e non per ordine: **rispondere** a chi ti cerca,
 * **cercare** tu (con acquisto al valore o richiesta di prestito), e **dichiarare** la tua
 * strategia mettendo i tuoi in vendita o in lista prestito. È la terza famiglia a rendere il
 * mercato una trattativa invece di una vetrina: senza, l'utente può solo reagire.
 */
export type MarketAction =
  // Rispondere a chi ti cerca.
  | { kind: "accetta_offerta"; playerId: string }
  | { kind: "rifiuta_offerta"; playerId: string }
  | { kind: "controproposta"; playerId: string; fee: number }
  // Cercare tu.
  | { kind: "compra"; playerId: string }
  | { kind: "acquista"; target: SearchResult }
  | { kind: "chiedi_prestito"; target: SearchResult }
  // Dichiarare la tua strategia.
  | { kind: "lista_trasferimenti"; playerId: string; on: boolean }
  | { kind: "lista_prestiti"; playerId: string; on: boolean }
  | { kind: "vendi_subito"; playerId: string }
  | { kind: "manda_in_prestito"; playerId: string; clubId: string }
  | { kind: "rifiuta_prestito"; playerId: string };

/** Lo stato che il mercato può cambiare. Entra ed esce dalla stessa funzione. */
export interface MarketState {
  roster: RosterEntry[];
  budget: number;
  snapshot: MarketSnapshot;
  lists: SquadLists;
}

export interface MarketActionResult extends MarketState {
  /** Messaggio da mostrare: ogni azione deve dire cosa è successo. */
  message: string;
  /** L'operazione non è andata a buon fine: la UI lo segnala in modo diverso. */
  rejected?: boolean;
}

/**
 * Applica un'azione di mercato.
 *
 * Ogni operazione passa dai vincoli di rosa: non si può scendere sotto il minimo né sfondare
 * il massimo, e questo vale per l'utente esattamente come per l'IA. Un mercato in cui il
 * giocatore può svuotare la rosa non è una libertà, è un modo per rompere la partita.
 */
export function applyMarketAction(
  state: MarketState,
  action: MarketAction,
  world: MarketWorld,
  season: number,
  seed: string,
): MarketActionResult {
  const { roster, budget, snapshot, lists } = state;
  const invariato = { roster: [...roster], budget, snapshot, lists, message: "" };

  switch (action.kind) {
    case "accetta_offerta": {
      const offer = snapshot.offers.find((o) => o.playerId === action.playerId);
      if (!offer) return { ...invariato, message: "Offerta non più disponibile.", rejected: true };
      const check = canSell(roster, action.playerId, world.players);
      if (!check.ok) return { ...invariato, message: check.reason ?? "Non puoi venderlo.", rejected: true };
      return {
        roster: roster.filter((e) => e.playerId !== action.playerId),
        budget: budget + offer.fee,
        snapshot: { ...snapshot, offers: snapshot.offers.filter((o) => o.playerId !== action.playerId) },
        // Chi se ne va esce anche dalle liste: lasciarcelo produrrebbe offerte per un
        // giocatore che non è più nostro.
        lists: rimuoviDalleListe(lists, action.playerId),
        message: `${offer.playerName} ceduto per ${formatEuro(offer.fee)} (${offer.fromClubName}).`,
      };
    }

    case "rifiuta_offerta": {
      const offer = snapshot.offers.find((o) => o.playerId === action.playerId);
      return {
        ...invariato,
        snapshot: { ...snapshot, offers: snapshot.offers.filter((o) => o.playerId !== action.playerId) },
        // Il rifiuto ha un costo: il giocatore lo prende male (lo applica `advanceWeek`).
        message: offer ? `Hai rifiutato l'offerta per ${offer.playerName}.` : "Offerta rifiutata.",
      };
    }

    case "rifiuta_prestito": {
      const loan = snapshot.loanOffers.find((l) => l.playerId === action.playerId);
      return {
        ...invariato,
        snapshot: { ...snapshot, loanOffers: snapshot.loanOffers.filter((l) => l.playerId !== action.playerId) },
        message: loan ? `Hai rifiutato la destinazione per ${loan.playerName}.` : "Destinazione rifiutata.",
      };
    }

    case "controproposta": {
      const offer = snapshot.offers.find((o) => o.playerId === action.playerId);
      if (!offer) return { ...invariato, message: "Offerta non più disponibile.", rejected: true };
      const random = derivedRandom(seed, "counter", season, action.playerId);
      const decision = respondToCounterOffer(
        { playerId: offer.playerId, fromClubId: offer.fromClubId, toClubId: "", fee: offer.fee, appetite: offer.appetite },
        action.fee,
        random,
      );
      if (!decision.accepted) {
        return {
          ...invariato,
          snapshot: { ...snapshot, offers: snapshot.offers.filter((o) => o.playerId !== action.playerId) },
          rejected: true,
          message: `Il ${offer.fromClubName} si è tirato indietro.`,
        };
      }
      return {
        roster: roster.filter((e) => e.playerId !== action.playerId),
        budget: budget + (decision.fee ?? offer.fee),
        snapshot: { ...snapshot, offers: snapshot.offers.filter((o) => o.playerId !== action.playerId) },
        lists: rimuoviDalleListe(lists, action.playerId),
        message: `${offer.playerName} ceduto per ${formatEuro(decision.fee ?? offer.fee)}.`,
      };
    }

    case "compra": {
      const entry = snapshot.shortlist.find((s) => s.playerId === action.playerId);
      if (!entry) return { ...invariato, message: "Giocatore non più disponibile.", rejected: true };
      const esito = acquista(state, {
        playerId: entry.playerId,
        playerName: entry.playerName,
        clubName: entry.clubName,
        price: entry.price,
        overall: entry.overall,
        age: entry.age,
        season,
      });
      if (esito.rejected) return esito;
      return {
        ...esito,
        snapshot: { ...esito.snapshot, shortlist: snapshot.shortlist.filter((s) => s.playerId !== action.playerId) },
      };
    }

    case "acquista": {
      const { target } = action;
      return acquista(state, {
        playerId: target.playerId,
        playerName: target.name,
        clubName: target.clubName,
        price: target.price,
        overall: target.overall,
        age: target.age,
        season,
      });
    }

    case "chiedi_prestito": {
      const { target } = action;
      if (!target.loanable) {
        return { ...invariato, message: `Il ${target.clubName} non lo dà in prestito.`, rejected: true };
      }
      const capienza = canLoanIn(roster);
      if (!capienza.ok) return { ...invariato, message: capienza.reason ?? "Troppi prestiti.", rejected: true };
      const spazio = canBuy(roster);
      if (!spazio.ok) return { ...invariato, message: spazio.reason ?? "Rosa al completo.", rejected: true };
      if (target.loanFee > budget) {
        return { ...invariato, message: "Budget insufficiente per il prestito.", rejected: true };
      }

      // Arriva **in prestito**, quindi a fine stagione se ne va: `settleLoans` lo rimanderà a
      // casa, e la crescita che avrà fatto la incassa il suo club. È il prezzo dell'aiuto
      // immediato, ed è ciò che impedisce di costruire una rosa intera senza spendere.
      const nuovo: RosterEntry = {
        ...creaAcquisto(target.playerId, target.overall, target.age, season),
        loan: { ownerClubId: target.clubId, untilSeason: season, expectedMinutes: 0 },
      };
      return {
        roster: [...roster, nuovo],
        budget: budget - target.loanFee,
        snapshot,
        lists,
        message: `${target.name} arriva in prestito per ${formatEuro(target.loanFee)} (${target.clubName}).`,
      };
    }

    case "lista_trasferimenti": {
      const presente = lists.transferList.includes(action.playerId);
      if (action.on === presente) return invariato;
      /**
       * ⚠️ **Un giocatore in prestito non si mette in vendita.**
       *
       * `canSell` lo negava da sempre, ma la lista trasferimenti non passava da nessun
       * controllo: si poteva dichiarare cedibile un giocatore **di un altro club**, e la
       * garanzia "chi metti in vendita riceve offerte adesso" gli generava pure un compratore.
       * Il rifiuto non usa `canSell` per intero — essere infortunati o sfiorare il minimo di
       * rosa non deve impedire di *programmare* una cessione, che è ciò per cui la lista
       * esiste (sez. 3.7.5) — ma solo le due ragioni di proprietà.
       */
      const inRosa = roster.find((e) => e.playerId === action.playerId);
      if (action.on && inRosa) {
        if (isLoanedIn(inRosa)) {
          return {
            ...invariato,
            message: "È in prestito da un altro club: non è tuo da vendere.",
            rejected: true,
          };
        }
        if (isLoanedOut(inRosa)) {
          return {
            ...invariato,
            message: "È in prestito altrove: rientrerà a fine stagione.",
            rejected: true,
          };
        }
      }
      const nome = world.nameOf(action.playerId);
      return {
        ...invariato,
        lists: {
          ...lists,
          transferList: action.on
            ? [...lists.transferList, action.playerId]
            : lists.transferList.filter((id) => id !== action.playerId),
        },
        message: action.on
          ? `${nome} è in lista trasferimenti: arriveranno offerte, ma vale meno.`
          : `${nome} non è più sul mercato.`,
      };
    }

    case "lista_prestiti": {
      const presente = lists.loanList.includes(action.playerId);
      if (action.on === presente) return invariato;
      const entry = roster.find((e) => e.playerId === action.playerId);
      if (action.on && entry) {
        const check = canLoanOut(roster, {
          playerId: entry.playerId,
          age: world.ageOf(entry.playerId),
          overall: entry.overall,
          potential: entry.potential,
        });
        if (!check.ok) return { ...invariato, message: check.reason ?? "Non è prestabile.", rejected: true };
      }
      const nome = world.nameOf(action.playerId);
      return {
        ...invariato,
        lists: {
          ...lists,
          loanList: action.on
            ? [...lists.loanList, action.playerId]
            : lists.loanList.filter((id) => id !== action.playerId),
        },
        message: action.on ? `${nome} è in lista prestiti.` : `${nome} resta in rosa.`,
      };
    }

    case "vendi_subito": {
      const entry = roster.find((e) => e.playerId === action.playerId);
      if (!entry) return { ...invariato, message: "Non è un tuo giocatore.", rejected: true };
      const check = canSell(roster, action.playerId, world.players);
      if (!check.ok) return { ...invariato, message: check.reason ?? "Non puoi venderlo.", rejected: true };

      const resolved = world.players[action.playerId];
      const valore = currentValue(
        {
          playerId: entry.playerId,
          clubId: "", // il proprio club: la valutazione usa i tier di chi lo possiede
          overall: entry.overall,
          potential: entry.potential,
          age: world.ageOf(entry.playerId),
          nation: resolved?.nation ?? "Italia",
          department: resolved ? ROLE_DEPARTMENT[resolved.role] : "CC",
          stats: entry.stats,
        },
        world.valuation,
      );
      const incasso = quickSalePrice(valore);
      return {
        roster: roster.filter((e) => e.playerId !== action.playerId),
        budget: budget + incasso,
        snapshot: { ...snapshot, offers: snapshot.offers.filter((o) => o.playerId !== action.playerId) },
        lists: rimuoviDalleListe(lists, action.playerId),
        message: `${world.nameOf(action.playerId)} ceduto subito per ${formatEuro(incasso)}: chi ha fretta incassa meno.`,
      };
    }

    case "manda_in_prestito": {
      const entry = roster.find((e) => e.playerId === action.playerId);
      if (!entry) return { ...invariato, message: "Non è un tuo giocatore.", rejected: true };
      const check = canLoanOut(roster, {
        playerId: entry.playerId,
        age: world.ageOf(entry.playerId),
        overall: entry.overall,
        potential: entry.potential,
      });
      if (!check.ok) return { ...invariato, message: check.reason ?? "Prestito non possibile.", rejected: true };
      const club = world.clubs[action.clubId];
      const proposta = snapshot.loanOffers.find((l) => l.playerId === action.playerId);
      const expectedMinutes =
        proposta?.expectedMinutes ??
        estimateLoanMinutes(entry.overall, club?.startingEleven ?? [], world.leagueRounds);

      return {
        roster: roster.map((e) =>
          e.playerId === action.playerId
            ? openLoan(
                e,
                { playerId: e.playerId, clubId: action.clubId, direction: "uscita", fee: 0, expectedMinutes },
                season,
              )
            : e,
        ),
        budget,
        snapshot: { ...snapshot, loanOffers: snapshot.loanOffers.filter((l) => l.playerId !== action.playerId) },
        lists: rimuoviDalleListe(lists, action.playerId),
        message: `${world.nameOf(action.playerId)} va a giocare altrove: circa ${Math.round(expectedMinutes / 90)} partite (${club?.name ?? "club"}).`,
      };
    }
  }
}

/** L'acquisto vero e proprio, condiviso da lista dello scouting e ricerca libera. */
function acquista(
  state: MarketState,
  input: {
    playerId: string;
    playerName: string;
    clubName: string;
    price: number;
    overall: number;
    age: number;
    season: number;
  },
): MarketActionResult {
  const { roster, budget, snapshot, lists } = state;
  const invariato = { roster: [...roster], budget, snapshot, lists, message: "" };

  if (roster.some((e) => e.playerId === input.playerId)) {
    return { ...invariato, message: "È già dei nostri.", rejected: true };
  }
  if (input.price > budget) {
    return { ...invariato, message: "Budget insufficiente.", rejected: true };
  }
  const check = canBuy(roster);
  if (!check.ok) return { ...invariato, message: check.reason ?? "Rosa al completo.", rejected: true };

  return {
    roster: [...roster, creaAcquisto(input.playerId, input.overall, input.age, input.season)],
    budget: budget - input.price,
    snapshot,
    lists,
    message: `${input.playerName} acquistato per ${formatEuro(input.price)} (${input.clubName}).`,
  };
}

function creaAcquisto(
  playerId: string,
  overall: number,
  age: number,
  season: number,
): RosterEntry {
  return {
    playerId,
    overall,
    potential: overall + Math.max(0, 24 - age),
    // Arriva **adesso**: l'affiatamento se lo dovrà guadagnare.
    sinceSeason: season,
    morale: 70,
    injuryMatchdaysLeft: 0,
    fatigue: 0,
    stats: { appearances: 0, minutes: 0, goals: 0, assists: 0 },
  };
}

function rimuoviDalleListe(lists: SquadLists, playerId: string): SquadLists {
  return {
    transferList: lists.transferList.filter((id) => id !== playerId),
    loanList: lists.loanList.filter((id) => id !== playerId),
  };
}

function formatEuro(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M€`;
  return `${Math.round(value / 1000)}k€`;
}

export { canLoanIn };
