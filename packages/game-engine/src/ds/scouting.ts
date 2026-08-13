/**
 * **Ricerca giocatori**: il mercato smette di essere una vetrina e diventa una caccia.
 *
 * La differenza rispetto alla lista della spesa dello scouting (`careerMarket.ts`) non è di
 * comodità ma di ruolo nel gioco: una lista di otto nomi decisi dal sistema fa *subire* il
 * mercato, mentre poter cercare chiunque e comprarlo al suo prezzo lo rende la cosa che si va
 * a fare. In una modalità da direttore sportivo è il mercato il momento centrale, quindi qui
 * deve esserci tutto il database, non un estratto.
 *
 * Le funzioni sono pure e il risultato dipende solo da (criteri, mondo, seme): due ricerche
 * identiche danno la stessa lista, anche dopo aver ricaricato un salvataggio.
 */
import { derivedRandom, hashSeed } from "../random";
import { currentValue, type MarketPlayer, type ValuationContext } from "./market";
import { ROLE_DEPARTMENT, type Department, type Role } from "@app/shared-types";

/** Quanti risultati si mostrano: oltre, la lista smette di essere leggibile. */
export const SEARCH_RESULTS = 40;

/** Età massima di un giocatore che l'IA mette in lista prestito. */
export const AI_LOAN_MAX_AGE = 23;

export interface SearchableClub {
  id: string;
  name: string;
  /** Overall dell'undici titolare: serve a capire chi in quel club non gioca. */
  startingEleven: number[];
}

export interface SearchablePlayer extends MarketPlayer {
  name: string;
  role: Role;
  secondaryRoles: Role[];
}

export interface SearchCriteria {
  /** Testo libero su nome e club. */
  query?: string;
  /** Filtro per reparto; `undefined` = tutti. */
  department?: Department;
  /**
   * Filtro per ruolo puntuale del tabellone, **multi-selezione**: un giocatore che copre uno
   * qualunque dei ruoli scelti (principale o secondario) passa il filtro — "DC o CC" trova chi
   * sa fare l'uno o l'altro, non solo chi li fa entrambi. Vuoto/assente = nessun filtro.
   */
  roles?: Role[];
  maxPrice?: number;
  minOverall?: number;
  maxOverall?: number;
  minAge?: number;
  maxAge?: number;
  /** Solo chi il suo club lascerebbe partire in prestito. */
  onlyLoanable?: boolean;
  /** Come ordinare i risultati. */
  sort?: "overall" | "prezzo" | "eta" | "potenziale";
}

export interface SearchResult {
  playerId: string;
  name: string;
  clubId: string;
  clubName: string;
  overall: number;
  age: number;
  role: Role;
  secondaryRoles: Role[];
  department: Department;
  /** Prezzo del cartellino: il **valore di mercato** del giocatore, senza sovrapprezzi. */
  price: number;
  /** Il club lo darebbe in prestito: giovane che lì non gioca. */
  loanable: boolean;
  /** Costo del prestito, se possibile. */
  loanFee: number;
}

/**
 * Il club darebbe questo giocatore in prestito?
 *
 * Criterio derivabile senza simulare i campionati esteri: è **giovane** e nel suo club **non
 * sarebbe titolare**. È la stessa situazione che rende sensato il prestito dal lato opposto —
 * un talento parcheggiato in una grande squadra — quindi le due meccaniche si specchiano
 * invece di essere due regole scollegate.
 *
 * La componente casuale, derivata dal seme, serve solo a non rendere la lista identica in ogni
 * stagione: senza, il mercato dei prestiti sarebbe una tabella fissa.
 */
export function isLoanListed(
  player: { playerId: string; age: number; overall: number },
  club: SearchableClub | undefined,
  seed: string,
  season: number,
): boolean {
  if (player.age > AI_LOAN_MAX_AGE) return false;
  const eleven = club?.startingEleven ?? [];
  if (eleven.length > 0) {
    const peggiorTitolare = Math.min(...eleven);
    // Se scalzerebbe un titolare, il club se lo tiene.
    if (player.overall >= peggiorTitolare) return false;
  }
  // Due su tre dei giovani che non giocano finiscono davvero in lista.
  return derivedRandom(seed, "loanlist", season, hashSeed(player.playerId))() < 0.66;
}

/**
 * **Un giocatore passa i filtri?** Una regola sola, per tutte le liste del mercato.
 *
 * La ricerca globale l'aveva; le schede *Svincolati* e *Cedibili IA* no — la prima filtrava per
 * solo reparto, la seconda per niente. Su quelle liste l'utente si trovava a scorrere decine di
 * nomi senza modo di stringere, ed è la segnalazione da cui nasce questa funzione.
 *
 * Sta qui e non in tre componenti perché tre copie della stessa condizione divergono alla prima
 * modifica: basta che una dimentichi i ruoli secondari e "cerca un terzino" darebbe risultati
 * diversi a seconda della scheda aperta.
 *
 * Prezzo e prestito **non** sono qui: dipendono dalla valutazione e dal seme, quindi vivono in
 * `searchPlayers` dove quei dati esistono. Chi filtra una lista già costruita usa `maxPrice` su
 * `SearchResult.price`, che è la stessa cifra.
 */
export function matchesCriteria(
  player: {
    name: string;
    clubName?: string;
    role: Role;
    secondaryRoles: readonly Role[];
    overall: number;
    age: number;
  },
  criteria: SearchCriteria,
): boolean {
  const termine = criteria.query?.trim().toLowerCase() ?? "";
  if (
    termine &&
    !player.name.toLowerCase().includes(termine) &&
    !(player.clubName ?? "").toLowerCase().includes(termine)
  ) {
    return false;
  }

  if (criteria.department && ROLE_DEPARTMENT[player.role] !== criteria.department) return false;

  // Un ruolo secondario vale quanto il principale in una ricerca: chi cerca un terzino sinistro
  // vuole vedere anche chi lo sa fare, non solo chi lo fa di mestiere. Multi-selezione: basta
  // coprire **uno qualunque** dei ruoli scelti.
  if (
    criteria.roles &&
    criteria.roles.length > 0 &&
    !criteria.roles.some((r) => player.role === r || player.secondaryRoles.includes(r))
  ) {
    return false;
  }

  if (criteria.minOverall !== undefined && player.overall < criteria.minOverall) return false;
  if (criteria.maxOverall !== undefined && player.overall > criteria.maxOverall) return false;
  if (criteria.minAge !== undefined && player.age < criteria.minAge) return false;
  if (criteria.maxAge !== undefined && player.age > criteria.maxAge) return false;
  return true;
}

/** Ordina una lista già filtrata, con gli stessi quattro criteri della ricerca globale. */
export function sortResults<T extends { overall: number; price: number; age: number }>(
  results: T[],
  sort: SearchCriteria["sort"],
): T[] {
  const out = [...results];
  if (sort === "prezzo") out.sort((a, b) => a.price - b.price);
  else if (sort === "eta") out.sort((a, b) => a.age - b.age);
  else out.sort((a, b) => b.overall - a.overall);
  return out;
}

export interface SearchInput {
  players: SearchablePlayer[];
  clubs: Record<string, SearchableClub>;
  valuation: ValuationContext;
  /** Club dell'utente: i propri giocatori non compaiono fra gli acquistabili. */
  ownClubId: string;
  seed: string;
  season: number;
  criteria: SearchCriteria;
}

/** Costo di un prestito: una frazione del valore, non il cartellino. */
export function loanCost(value: number): number {
  return Math.max(50_000, Math.round((value * 0.08) / 50_000) * 50_000);
}

export function searchPlayers({
  players,
  clubs,
  valuation,
  ownClubId,
  seed,
  season,
  criteria,
}: SearchInput): SearchResult[] {
  const risultati: SearchResult[] = [];
  for (const player of players) {
    if (player.clubId === ownClubId) continue;

    const club = clubs[player.clubId];
    const nomeClub = club?.name ?? "";
    const department = ROLE_DEPARTMENT[player.role];

    if (!matchesCriteria({ ...player, clubName: nomeClub }, criteria)) continue;

    const price = currentValue(player, valuation);
    if (criteria.maxPrice !== undefined && price > criteria.maxPrice) continue;

    const loanable = isLoanListed(player, club, seed, season);
    if (criteria.onlyLoanable && !loanable) continue;

    risultati.push({
      playerId: player.playerId,
      name: player.name,
      clubId: player.clubId,
      clubName: nomeClub || "Club",
      overall: player.overall,
      age: player.age,
      role: player.role,
      secondaryRoles: player.secondaryRoles,
      department,
      price,
      loanable,
      loanFee: loanCost(price),
    });
  }

  const ordina: Record<NonNullable<SearchCriteria["sort"]>, (a: SearchResult, b: SearchResult) => number> = {
    overall: (a, b) => b.overall - a.overall || a.price - b.price,
    prezzo: (a, b) => a.price - b.price || b.overall - a.overall,
    eta: (a, b) => a.age - b.age || b.overall - a.overall,
    potenziale: (a, b) => b.overall - b.age - (a.overall - a.age),
  };

  const ordinati = risultati.sort(ordina[criteria.sort ?? "overall"]);

  /**
   * **La ricerca proponeva sempre gli stessi nomi**: `Array.sort` è stabile e deterministico,
   * quindi a parità di filtri il "migliore" restava sempre lo stesso, finestra dopo finestra —
   * segnalato dall'utente. Si mescola a **piccoli gruppi** (chi è quasi alla pari cambia
   * ordine da una stagione all'altra, il criterio scelto resta rispettato in blocco: il
   * migliore vero non scende mai sotto i primi gruppi) usando un seme che varia per stagione —
   * a parità di stagione la ricerca resta stabile (due chiamate identiche danno lo stesso
   * risultato, invariante di CLAUDE.md §3.7.13), varia da una stagione/finestra all'altra.
   *
   * Si allarga anche il pool considerato prima del taglio finale, per portare in vista ogni
   * tanto un nome che prima restava sempre fuori dai 40.
   */
  const random = derivedRandom(seed, "search", season, criteria.sort ?? "overall");
  const pool = ordinati.slice(0, Math.min(60, ordinati.length));
  const GRUPPO = 6;
  for (let i = 0; i < pool.length; i += GRUPPO) {
    const fine = Math.min(i + GRUPPO, pool.length);
    for (let j = fine - 1; j > i; j--) {
      const k = i + Math.floor(random() * (j - i + 1));
      [pool[j], pool[k]] = [pool[k]!, pool[j]!];
    }
  }

  return pool.slice(0, SEARCH_RESULTS);
}

/**
 * Quanto rende vendere **subito** un proprio giocatore, senza aspettare un'offerta.
 *
 * Sconto dichiarato: chi ha fretta incassa meno. Serve a tenere una differenza fra il mettere
 * in lista e aspettare l'offerta giusta (prezzo pieno o sopra) e il liberarsene adesso per
 * fare cassa — altrimenti la lista trasferimenti non avrebbe alcuna ragione di esistere.
 * Abbassato da 0.78 a 0.58 su richiesta esplicita dell'utente: deve sentirsi una vera svendita
 * di saldo, non un piccolo sconto sul valore pieno.
 */
export const QUICK_SALE_SHARE = 0.58;

export function quickSalePrice(value: number): number {
  return Math.max(50_000, Math.round((value * QUICK_SALE_SHARE) / 50_000) * 50_000);
}
