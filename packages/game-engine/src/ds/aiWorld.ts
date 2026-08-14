/**
 * **Il mondo che vive**: le squadre gestite dal computer invecchiano, perdono chi si ritira,
 * crescono i propri giovani e fanno mercato fra loro.
 *
 * Perché serve. Senza questo modulo la carriera si svolge in un mondo immobile: i 2.586
 * giocatori del database restano identici per dieci stagioni, quindi si incontrano
 * quarantenni in campo, le squadre avversarie non cambiano mai forza, e l'unico a fare
 * mercato è l'utente. È l'opposto di ciò che rende viva una modalità da direttore sportivo.
 *
 * **Il vincolo che ne ha guidato il disegno è la dimensione del salvataggio.** Tenere lo stato
 * di 2.586 giocatori per dieci stagioni farebbe esplodere il JSONB, e il progetto ha come
 * requisito esplicito un salvataggio sotto i 100 KB (sez. 3.7.10). La soluzione è **derivare
 * quasi tutto**:
 *  - **invecchiamento e declino** sono una funzione pura di (Overall iniziale, età, stagione):
 *    zero byte salvati;
 *  - **i ritiri** sono una funzione pura dell'età: zero byte;
 *  - **i regen dell'IA** si generano dal seme: zero byte;
 *  - si salvano **solo i trasferimenti**, che non sono derivabili perché dipendono anche dalle
 *    operazioni dell'utente — e servono comunque, perché il pannello "Mercato dal mondo" li
 *    deve mostrare.
 */
import { derivedRandom, hashSeed } from "../random";
import { ageInSeason, ageMargin, estimatePotential, isDeveloping, shouldRetire } from "./aging";
import { generateName } from "./names";
import { ROLE_DEPARTMENT, type Department, type Role } from "@app/shared-types";

/** Un giocatore del mondo, nella forma che serve a costruire le avversarie e il mercato. */
export interface WorldPlayer {
  id: string;
  name: string;
  nation: string;
  role: Role;
  secondaryRoles: Role[];
  department: Department;
  birthDate?: string | null;
  overall: number;
  clubId: string;
  /** Generato dal gioco per rimpiazzare un ritirato. */
  regen?: boolean;
}

export interface WorldClub {
  id: string;
  name: string;
  leagueId: string;
  prestigeTier: number;
}

/** Un trasferimento fra due squadre del computer: è ciò che il salvataggio conserva. */
export interface WorldTransfer {
  playerId: string;
  playerName: string;
  fromClubId: string;
  toClubId: string;
  fee: number;
  season: number;
  /**
   * Che tipo di operazione è, per il notiziario di mercato.
   *
   * Campi **opzionali**: i salvataggi precedenti non li hanno, e una carriera già avviata non
   * deve rompersi né perdere il suo storico. Chi legge tratta l'assenza come `"colpo"`.
   *  - `colpo` — un club si rinforza;
   *  - `sostituzione` — è il rimpiazzo di chi è appena partito, e senza di esso quella cessione
   *    non sarebbe nemmeno avvenuta (vedi `planWorldTransfers`);
   *  - `esubero` — un club smaltisce chi era di troppo.
   */
  kind?: "colpo" | "sostituzione" | "esubero";
  /** Per una `sostituzione`: chi si sta rimpiazzando. Serve a raccontare la catena nel feed. */
  replacesPlayerName?: string;
  /** Reparto dell'operazione, per raggruppare le notizie senza dover risalire al giocatore. */
  department?: Department;
}

/* -------------------------------------------------------------------------- */
/* Invecchiamento: derivato, non salvato                                        */
/* -------------------------------------------------------------------------- */

/**
 * L'Overall di un giocatore dell'IA alla stagione `season`.
 *
 * Applica la stessa curva del ciclo di vita dell'utente (`ageMargin`) stagione per stagione,
 * ma **senza la componente di rendimento**: i campionati altrui girano in modalità "solo
 * risultato" e non producono minuti individuali, quindi non c'è nulla su cui premiare o
 * punire. Si usa una frazione del margine — un giovane dell'IA cresce, ma non quanto uno a cui
 * l'utente sta dando campo di proposito. È la differenza che rende sensato valorizzare i propri.
 *
 * Puro e senza stato: ricalcolarlo mille volte dà sempre lo stesso numero.
 */
export function aiOverallInSeason(
  baseOverall: number,
  birthDate: string | null | undefined,
  season: number,
): number {
  if (season <= 1) return baseOverall;
  const etaIniziale = ageInSeason(birthDate, 1);
  if (etaIniziale === null) return baseOverall;

  const potenziale = estimatePotential(baseOverall, etaIniziale, 0.5);
  let overall = baseOverall;

  for (let s = 1; s < season; s++) {
    const eta = etaIniziale + (s - 1);
    const margine = ageMargin(eta);
    // **Nel picco (24-28) non si cresce.** `ageMargin` vale 1 lì, ma quel punto è oscillazione
    // legata al rendimento, non crescita strutturale — e per l'IA il rendimento individuale non
    // esiste. Applicarlo comunque farebbe salire ogni giocatore del mondo di cinque punti solo
    // per aver compiuto gli anni, e in dieci stagioni i campionati si gonfierebbero da soli.
    if (margine > 0 && isDeveloping(eta)) {
      // Cresce verso il potenziale, ma a rilento: mai oltre il tetto.
      overall = Math.min(potenziale, overall + margine * AI_GROWTH_SHARE);
    } else if (margine < 0) {
      overall += margine;
    }
  }

  return Math.max(MIN_OVERALL, Math.min(MAX_OVERALL, Math.round(overall)));
}

/**
 * Quanta parte del margine di crescita prende un giovane dell'IA.
 *
 * Sotto 1 di proposito: chi cresce di più è il giovane a cui **tu** dai minuti, ed è tutto il
 * senso della strategia della piccola squadra. Placeholder di bilanciamento dichiarato.
 */
export const AI_GROWTH_SHARE = 0.55;

const MIN_OVERALL = 60;
const MAX_OVERALL = 99;

/** Un giocatore dell'IA si è ritirato entro questa stagione? */
export function isRetiredBySeason(birthDate: string | null | undefined, season: number): boolean {
  for (let s = 2; s <= season; s++) {
    const eta = ageInSeason(birthDate, s);
    if (shouldRetire(eta, s)) return true;
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Regen delle squadre IA                                                       */
/* -------------------------------------------------------------------------- */

/**
 * In quale stagione un giocatore si ritira. Deterministico dalla sola data di nascita.
 *
 * Serve ad **ancorare** il suo rimpiazzo: senza, la data di nascita del regen dipenderebbe
 * dalla stagione in cui lo si osserva, e quindi cambierebbe a ogni ricostruzione del mondo.
 */
function retirementSeasonOf(birthDate: string | null | undefined, maxSeason: number): number {
  for (let s = 2; s <= maxSeason; s++) {
    if (shouldRetire(ageInSeason(birthDate, s), s)) return s;
  }
  return maxSeason;
}

/**
 * I rimpiazzi dei ritirati di un club, generati dal seme.
 *
 * Non si salvano: ricostruirli dà sempre gli stessi ragazzi.
 *
 * **L'identità è legata al ritirato, non alla stagione in cui si guarda il mondo.** La prima
 * versione numerava i regen con la stagione corrente (`airegen-<club>-<stagione>-<i>`), e la
 * conseguenza era grave anche se invisibile a prima vista: lo stesso ragazzo cambiava id ogni
 * anno, quindi un regen scoutizzato nella stagione 3 spariva nella 4 — e uno **comprato**
 * restava in rosa senza più anagrafica, cioè col nome "Giocatore". Ancorando id e generatore
 * al predecessore, chi nasce una volta resta sé stesso per tutta la carriera.
 *
 * L'unicità del nome è garantita **dentro il club** e contro i nomi della sua rosa: un
 * controllo globale su 2.586 nomi a ogni ricostruzione costerebbe più di quanto valga, e due
 * omonimi in campionati diversi non sono un problema che l'utente possa notare.
 */
function regensForClub(
  club: WorldClub,
  ritirati: WorldPlayer[],
  nomiUsati: Set<string>,
  seed: string,
  season: number,
): WorldPlayer[] {
  return ritirati.map((uscito) => {
    const random = derivedRandom(seed, "airegen", uscito.id);
    const eta = 17 + Math.floor(random() * 3);
    const nome = generateName(uscito.nation, nomiUsati, random);
    nomiUsati.add(nome);
    // Parte molto sotto il predecessore: è una promessa, non un pronto-uso. Se fosse subito
    // forte, perdere un campione non costerebbe nulla a nessuno.
    const base = Math.max(MIN_OVERALL, Math.round(uscito.overall - 10 + random() * 8));
    const nascita = retirementSeasonOf(uscito.birthDate, season);
    const mese = 1 + Math.floor(random() * 12);
    const birthDate = `${2025 + nascita - 1 - eta}-${String(mese).padStart(2, "0")}-15`;

    return {
      id: `airegen-${uscito.id}`,
      name: nome,
      nation: uscito.nation,
      role: uscito.role,
      secondaryRoles: [],
      department: ROLE_DEPARTMENT[uscito.role],
      birthDate,
      // Anche i regen invecchiano: nato nella stagione in cui il predecessore si è ritirato,
      // cresce dalle stagioni successive come chiunque altro nel mondo.
      overall: aiOverallInSeason(base, birthDate, Math.max(1, season - nascita + 1)),
      clubId: club.id,
      regen: true,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Mercato fra squadre IA                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Quanti trasferimenti fra squadre del computer si generano per stagione.
 *
 * Con 96 club e oltre 2.500 giocatori, poche operazioni all'anno non fanno sembrare vivo un
 * mondo. Il numero è un **tetto**, non un obiettivo: le catene di sostituzione (sotto) ne
 * consumano due alla volta, e una finestra può chiudersi molto prima se non ci sono affari
 * sensati da fare.
 */
export const WORLD_TRANSFERS_PER_SEASON = 50;

/**
 * Quanto deve essere più forte il compratore per prendersi un giocatore.
 *
 * È la regola che impedisce al mondo di andare alla deriva: i giocatori si muovono **verso
 * l'alto**, non a caso. Senza, dopo dieci stagioni le rose sarebbero rimescolate a sorte e la
 * gerarchia dei campionati non esisterebbe più.
 */
const MIN_BUYER_EDGE = 2;

/**
 * Quanto deve essere piu forte il compratore perche la sua offerta diventi **irrifiutabile**.
 *
 * Sotto questa distanza un club non si priva di un titolare che gli serve; sopra, la differenza
 * di mezzi e tale che rifiutare non e realistico — ed e il solo modo in cui un big soffia il
 * pezzo pregiato a una media senza che il mercato diventi un mercatino dove tutto e in vendita.
 */
const IRRESISTIBLE_OFFER_EDGE = 5;


/** Quanto di quello che incassa un club torna disponibile subito per il rimpiazzo. */
const REINVEST_SHARE = 0.85;

export interface PlanWorldTransfersInput {
  clubs: WorldClub[];
  /** Giocatori per club, già invecchiati e ripuliti dai ritirati. */
  byClub: Map<string, WorldPlayer[]>;
  /** Il club dell'utente: il mondo non tocca la sua rosa. */
  ownClubId: string;
  seed: string;
  season: number;
}

/** Lo stato di un club durante la finestra: rosa che cambia sotto i piedi, e cassa. */
interface ClubMarket {
  club: WorldClub;
  rosa: WorldPlayer[];
  /** Media degli undici migliori a inizio finestra: il livello a cui quel club gioca. */
  forza: number;
  /** Liquidità residua. Vendere la ricarica, comprare la consuma. */
  cassa: number;
}

/**
 * **Il mercato delle squadre del computer.**
 *
 * ## Il difetto che ha imposto la riscrittura
 *
 * La versione precedente modellava **solo il compratore**: si sceglieva un club che voleva
 * rinforzarsi, gli si trovava un giocatore migliore in un club più debole, e l'operazione era
 * fatta. Il venditore non esisteva come soggetto — non decideva, non ricomprava, non aveva un
 * bilancio. La conseguenza, vista in gioco e segnalata dall'utente, è che **un club poteva
 * vendere i suoi migliori attaccanti e restare senza**: nulla nel modello si accorgeva del
 * buco, e nulla lo riempiva. Un mondo così non è "semplice", è implausibile.
 *
 * ## Le quattro regole che lo rendono realistico
 *
 * 1. **Nessuno vende sotto il fabbisogno.** Dopo l'operazione il venditore deve avere ancora
 *    titolari e panchina coperti in quel reparto (`FABBISOGNO_PER_REPARTO`). Chi ha esattamente
 *    il necessario non svende: non è avarizia, è che una rosa incompleta non scende in campo.
 * 2. **Chi cede un titolare lo rimpiazza, o non cede.** Le due operazioni sono decise
 *    **insieme**: se il rimpiazzo non si trova, la cessione non avviene affatto. È il modo per
 *    garantire l'invariante per costruzione invece di correggerla a valle — non serve annullare
 *    niente, perché niente di sbagliato viene mai scritto. Il rimpiazzo dev'essere di livello
 *    vicino (`MAX_REPLACEMENT_GAP`) e arriva a sua volta da chi ha un'**eccedenza vera**, così
 *    la catena si ferma al secondo anello e non propaga buchi all'infinito.
 * 3. **I soldi contano.** Ogni club ha una cassa derivata da prestigio e livello, e vendere la
 *    ricarica: è ciò che permette a una media di reinvestire l'incasso del suo gioiello, e che
 *    impedisce a una piccola di comprarne cinque.
 * 4. **Si vende solo verso l'alto** (`MIN_BUYER_EDGE`), com'era già: è la regola che tiene in
 *    piedi la gerarchia dei campionati su dieci stagioni.
 *
 * Restano fuori di proposito prestiti, parametri zero e clausole: sono meccaniche che l'utente
 * gioca in prima persona, e replicarle per 96 club costerebbe molto senza che si veda.
 */
export function planWorldTransfers({
  clubs,
  byClub,
  ownClubId,
  seed,
  season,
}: PlanWorldTransfersInput): WorldTransfer[] {
  const random = derivedRandom(seed, "worldmarket", season);

  const mercato = new Map<string, ClubMarket>();
  for (const club of clubs) {
    if (club.id === ownClubId) continue;
    const rosa = [...(byClub.get(club.id) ?? [])];
    const forza = forzaUndici(rosa);
    mercato.set(club.id, { club, rosa, forza, cassa: cassaIniziale(club, forza) });
  }

  const transfers: WorldTransfer[] = [];
  const giaMossi = new Set<string>();

  /**
   * L'ordine in cui i club si muovono: i più forti per primi, com'è nel mercato vero — chi ha
   * mezzi sceglie prima, e agli altri restano gli scarti. La componente casuale evita che sia
   * *sempre* lo stesso ordine, che renderebbe dieci stagioni identiche.
   */
  const turni = [...mercato.values()]
    .map((m) => ({ m, peso: m.forza + random() * 6 }))
    .sort((a, b) => b.peso - a.peso)
    .map((x) => x.m);

  for (const compratore of turni) {
    if (transfers.length >= WORLD_TRANSFERS_PER_SEASON) break;
    // Non tutti si muovono ogni anno: un mondo in cui compra chiunque sarebbe rumore.
    if (random() > 0.55) continue;
    if (compratore.rosa.length >= 30) continue;

    /**
     * I reparti da rinforzare, **in ordine di bisogno**: prima la necessità (sotto il fabbisogno
     * di titolari e panchina), poi la qualità. Un club a cui manca un portiere compra un
     * portiere, non un attaccante, anche se l'attacco è il reparto meno brillante.
     *
     * È un **elenco** e non una scelta secca, e la ragione l'ha trovata un test: se tutti i club
     * del mondo sono corti nello stesso reparto, nessuno può venderci dentro (regola 1) e con un
     * bersaglio solo il mercato si bloccherebbe **del tutto**, senza un'operazione. Ripiegare sul
     * reparto successivo è anche ciò che farebbe un dirigente vero: se l'attaccante che cerchi
     * non è sul mercato, rinforzi dove puoi.
     */
    let affare: WorldTransfer[] | null = null;
    for (const bersaglio of repartiDaRinforzare(compratore.rosa)) {
      affare = cercaAffare({ compratore, bersaglio, mercato, giaMossi, random, season });
      if (affare) break;
    }
    if (!affare) continue;

    for (const t of affare) {
      giaMossi.add(t.playerId);
      transfers.push(t);
    }
  }

  return transfers;
}

/**
 * I reparti su cui un club interverrebbe, dal più urgente al meno.
 *
 * Tre fasce, e la terza è quella che evita un comportamento assurdo visto misurando: prima i
 * reparti **sotto il fabbisogno** (manca proprio gente), poi quelli adeguati ordinati per
 * qualità dei titolari, e **in fondo quelli in cui il club ha già un'eccedenza vera**. Senza la
 * terza fascia, un club con quattordici centrocampisti e cinque difensori — non riuscendo a
 * trovare il difensore che gli serviva — ripiegava comprando *un altro centrocampista*: la
 * risposta peggiore possibile, e per giunta quella che il ripiego stesso doveva evitare.
 */
function repartiDaRinforzare(rosa: WorldPlayer[]): Department[] {
  const ordine: Department[] = ["POR", "DIF", "CC", "ATT"];
  const conteggio = (dep: Department) => rosa.filter((p) => p.department === dep).length;

  const scoperti = ordine.filter((dep) => conteggio(dep) < FABBISOGNO_PER_REPARTO[dep]);
  const abbondanti = ordine.filter((dep) => conteggio(dep) >= FABBISOGNO_PER_REPARTO[dep] + 2);
  const adeguati = ordine.filter((dep) => !scoperti.includes(dep) && !abbondanti.includes(dep));

  const perQualita = (a: Department, b: Department) => qualitaReparto(rosa, a) - qualitaReparto(rosa, b);
  return [...scoperti, ...adeguati.sort(perQualita), ...abbondanti.sort(perQualita)];
}

/** La qualità di un reparto: media dei soli titolari, non di tutti i giocatori che lo coprono. */
function qualitaReparto(rosa: WorldPlayer[], dep: Department): number {
  const migliori = ordinatiPerForza(rosa, dep).slice(0, TITOLARI_PER_REPARTO[dep]);
  if (migliori.length === 0) return 0;
  return migliori.reduce((s, p) => s + p.overall, 0) / migliori.length;
}

/**
 * Cerca un'operazione sensata per questo compratore, **completa di eventuale rimpiazzo**.
 *
 * Torna una o due operazioni da eseguire insieme, oppure `null` se non c'è niente di sensato da
 * fare — e "niente" è una risposta legittima: un mercato in cui ogni club compra per forza
 * qualcosa è esattamente il mercato irrealistico da cui si veniva.
 */
function cercaAffare({
  compratore,
  bersaglio,
  mercato,
  giaMossi,
  random,
  season,
}: {
  compratore: ClubMarket;
  bersaglio: Department;
  mercato: Map<string, ClubMarket>;
  giaMossi: Set<string>;
  random: () => number;
  season: number;
}): WorldTransfer[] | null {
  const candidati: { player: WorldPlayer; venditore: ClubMarket; titolare: boolean }[] = [];

  for (const venditore of mercato.values()) {
    if (venditore.club.id === compratore.club.id) continue;
    // Si compra da chi sta più in basso: è la regola che tiene la gerarchia.
    if (compratore.forza - venditore.forza < MIN_BUYER_EDGE) continue;

    const nelReparto = ordinatiPerForza(venditore.rosa, bersaglio);
    // **Sotto il fabbisogno non si vende.** Una rosa incompleta non scende in campo, e nessun
    // direttore sportivo si mette in quella condizione per incassare.
    if (nelReparto.length <= FABBISOGNO_PER_REPARTO[bersaglio]) continue;

    for (const [rango, player] of nelReparto.entries()) {
      if (giaMossi.has(player.id)) continue;
      // Deve migliorare davvero chi lo compra, altrimenti non è un rinforzo ma un movimento.
      if (player.overall < compratore.forza - 2) continue;

      const titolare = rango < TITOLARI_PER_REPARTO[bersaglio];

      /**
       * **Perché il venditore accetterebbe di privarsene** (decisione dell'utente, 2026-08-14).
       *
       * Non basta che qualcuno lo voglia: un club cede un suo uomo per una ragione, e sono
       * queste due. Senza, ogni titolare era in vendita e il mercato somigliava a un mercatino.
       *
       *  - **non è congruo alla sua forza**: un giocatore sotto il livello dei titolari di quel
       *    club è un peso in rosa, e lasciarlo andare a chi lo farà giocare conviene a entrambi;
       *  - **offerta irrifiutabile**: chi sta molto più in alto paga cifre che non si rifiutano,
       *    e a quel punto anche un titolare parte.
       *
       * Le riserve restano cedibili sempre: è la fisiologia di ogni finestra.
       */
      const nonCongruo = player.overall < venditore.forza - 1;
      const irrifiutabile = compratore.forza - venditore.forza >= IRRESISTIBLE_OFFER_EDGE;
      // Ha di che sostituirlo in casa: cederlo non lascia un buco, è gestione della rosa.
      const eccedenza = nelReparto.length >= FABBISOGNO_PER_REPARTO[bersaglio] + 2;
      if (titolare && !nonCongruo && !irrifiutabile && !eccedenza) continue;

      candidati.push({
        player,
        venditore,
        // È uno degli undici di quel reparto: la cessione è una notizia, non ordinaria gestione.
        titolare,
      });
    }
  }

  if (candidati.length === 0) return null;

  // Si prova il migliore che ci si può permettere, poi a scendere: un club punta in alto e
  // ripiega, non pesca a caso in tutta la lista.
  candidati.sort((a, b) => b.player.overall - a.player.overall);
  const finestra = candidati.slice(0, Math.min(candidati.length, 6));

  for (let tentativo = 0; tentativo < finestra.length; tentativo++) {
    const scelto = finestra[Math.floor(random() * finestra.length)] ?? finestra[0]!;
    const prezzo = prezzoIndicativo(scelto.player, compratore.club.prestigeTier);
    if (prezzo > compratore.cassa) continue;

    const principale: WorldTransfer = {
      playerId: scelto.player.id,
      playerName: scelto.player.name,
      fromClubId: scelto.venditore.club.id,
      toClubId: compratore.club.id,
      fee: prezzo,
      season,
      kind: scelto.titolare ? "colpo" : "esubero",
      department: bersaglio,
    };

    /**
     * ⚠️ **Niente più catene di sostituzione** (decisione dell'utente, 2026-08-14).
     *
     * Il modello precedente imponeva che chi cede un titolare lo rimpiazzasse *nella stessa
     * operazione*, e se il rimpiazzo non si trovava la cessione non avveniva. Sembrava
     * prudente e invece era il difetto: *"a catena ci sarà la squadra che ha venduto Caio che
     * necessiterà di acquistare Sempronio"* — un mercato in cui ogni movimento ne impone un
     * altro dello stesso ruolo, cioè l'opposto di come si comporta un club vero. E costringeva
     * a comprare per ruolo anche chi in quel ruolo non aveva alcun bisogno.
     *
     * L'invariante che conta — **nessuno resta scoperto** — non si regge sulle catene ma sulla
     * regola di vendita: si cede solo da un reparto che **resta sopra il fabbisogno** anche
     * dopo l'uscita (controllo più sopra). Chi vende un titolare incassa e interverrà dove
     * serve *a lui*, magari in un altro reparto e magari alla finestra successiva: è esattamente
     * ciò che fa un direttore sportivo.
     */
    esegui(compratore, scelto.venditore, scelto.player, prezzo);
    return [principale];
  }

  return null;
}


/** Applica un'operazione allo stato dei due club: rose e casse si muovono davvero. */
function esegui(
  compratore: ClubMarket,
  venditore: ClubMarket,
  player: WorldPlayer,
  prezzo: number,
): void {
  venditore.rosa = venditore.rosa.filter((p) => p.id !== player.id);
  compratore.rosa = [...compratore.rosa, { ...player, clubId: compratore.club.id }];
  compratore.cassa -= prezzo;
  venditore.cassa += prezzo * REINVEST_SHARE;
}

/** I giocatori di un reparto, dal più forte al più debole. */
function ordinatiPerForza(rosa: WorldPlayer[], dep: Department): WorldPlayer[] {
  return rosa.filter((p) => p.department === dep).sort((a, b) => b.overall - a.overall);
}

function forzaUndici(rosa: WorldPlayer[]): number {
  const migliori = [...rosa].sort((a, b) => b.overall - a.overall).slice(0, 11);
  return migliori.length > 0 ? migliori.reduce((s, p) => s + p.overall, 0) / migliori.length : 70;
}

/**
 * La cassa di un club per la finestra.
 *
 * Prestigio e livello della rosa, cioè le due cose che nel gioco già dicono "quanto è grande
 * questo club". Non passa dal budget del DS (`budget.ts`): quello è tarato sulla progressione
 * di *una* carriera, mentre qui serve solo una scala credibile che impedisca a una piccola di
 * comprare cinque titolari.
 */
function cassaIniziale(club: WorldClub, forza: number): number {
  return Math.round(6_000_000 * club.prestigeTier + Math.max(0, forza - 68) * 4_000_000);
}

/**
 * Il reparto in cui il club è più debole.
 *
 * Si confrontano **solo i giocatori che scendono in campo** in quel reparto: uno per la porta,
 * quattro in difesa, quattro a centrocampo, due davanti. Guardarne tre ovunque — com'era nella
 * prima versione — faceva risultare la porta il reparto più debole di **ogni** club, perché il
 * secondo e il terzo portiere sono sempre molto sotto il titolare: il risultato era un mercato
 * mondiale fatto di soli portieri, visibile a occhio nudo nel pannello.
 */
const TITOLARI_PER_REPARTO: Record<Department, number> = { POR: 1, DIF: 4, CC: 4, ATT: 2 };

/**
 * Cuscinetto di panchina per reparto, oltre ai titolari.
 *
 * **Una rosa non è solo gli undici titolari, è titolari + una panchina credibile** — richiesta
 * esplicita dell'utente, applicata sia al giudizio di sovrabbondanza (chi cede) sia a quello di
 * necessità (chi compra): un club con 4 centrocampisti per 4 titolari non ha "0 di eccedenza",
 * ha ancora zero ricambi. Placeholder di bilanciamento dichiarato: rispecchia grosso modo una
 * rosa vera (1 secondo portiere, 2 riserve di difesa, 2 di centrocampo, 1 d'attacco).
 */
const PANCHINA_PER_REPARTO: Record<Department, number> = { POR: 1, DIF: 2, CC: 2, ATT: 1 };

/** Titolari + panchina: il fabbisogno reale di un reparto, non i soli undici. */
export const FABBISOGNO_PER_REPARTO: Record<Department, number> = {
  POR: TITOLARI_PER_REPARTO.POR + PANCHINA_PER_REPARTO.POR,
  DIF: TITOLARI_PER_REPARTO.DIF + PANCHINA_PER_REPARTO.DIF,
  CC: TITOLARI_PER_REPARTO.CC + PANCHINA_PER_REPARTO.CC,
  ATT: TITOLARI_PER_REPARTO.ATT + PANCHINA_PER_REPARTO.ATT,
};

/** Quanti giocatori, in un reparto, superano il fabbisogno titolari+panchina: vera eccedenza. */
export function eccedenzaReparto(rosa: WorldPlayer[], dep: Department): number {
  const conteggio = rosa.filter((p) => p.department === dep).length;
  return Math.max(0, conteggio - FABBISOGNO_PER_REPARTO[dep]);
}

/**
 * Prezzo di un trasferimento del mondo.
 *
 * Non passa da `computeMarketValue` di proposito: quella formula ha bisogno del contesto di
 * campionato ed epoca, che qui non aggiungerebbe nulla — la cifra serve solo a dare una scala
 * credibile a una notizia di mercato che l'utente legge di sfuggita.
 */
function prezzoIndicativo(player: WorldPlayer, prestigioCompratore: number): number {
  const base = Math.pow(Math.max(0, player.overall - 58) / 8, 3.2) * 900_000;
  const moltiplicatore = 0.8 + prestigioCompratore * 0.12;
  return Math.max(200_000, Math.round((base * moltiplicatore) / 100_000) * 100_000);
}

/* -------------------------------------------------------------------------- */
/* Ricostruzione del mondo a una data stagione                                 */
/* -------------------------------------------------------------------------- */

/** Un regen nato in carriera (dai nostri ritirati) e destinato a un club che non è il nostro. */
export interface ExternalRegen {
  destinationClubId: string;
  player: {
    id: string;
    name: string;
    nation: string;
    role: Role;
    secondaryRoles: Role[];
    birthDate: string;
    overall: number;
  };
}

export interface EvolveWorldInput {
  clubs: WorldClub[];
  /** I giocatori come stanno nel database, cioè alla stagione 1. */
  players: WorldPlayer[];
  ownClubId: string;
  /** Id dei giocatori che sono passati alla nostra rosa: il mondo non li ha più. */
  ownedByUser: ReadonlySet<string>;
  seed: string;
  season: number;
  /** I trasferimenti già avvenuti nelle stagioni precedenti (dal salvataggio). */
  transfers: readonly WorldTransfer[];
  /**
   * Regen nati da un nostro ritirato ma atterrati a caso in un club che non è il nostro (sez.
   * "niente trucco compra-e-aspetta-il-ritiro"). Vanno innestati nel club di destinazione
   * esattamente come un regen dell'IA — altrimenti sarebbero generati ma invisibili al mondo.
   */
  externalRegens?: readonly ExternalRegen[];
}

export interface EvolvedWorld {
  byClub: Map<string, WorldPlayer[]>;
  /** Tutti i giocatori vivi del mondo, per id. */
  byId: Map<string, WorldPlayer>;
  /** Quanti si sono ritirati complessivamente, per il resoconto. */
  retired: number;
}

/**
 * Il mondo com'è alla stagione `season`: invecchiato, senza i ritirati, coi regen al loro posto
 * e coi trasferimenti già applicati.
 *
 * Si ricostruisce da zero a ogni stagione. Costa un giro su 2.586 giocatori — trascurabile
 * rispetto al vantaggio di non doverne salvare lo stato.
 */
export function evolveWorld({
  clubs,
  players,
  ownClubId,
  ownedByUser,
  seed,
  season,
  transfers,
  externalRegens = [],
}: EvolveWorldInput): EvolvedWorld {
  const byClub = new Map<string, WorldPlayer[]>();
  const byId = new Map<string, WorldPlayer>();
  for (const club of clubs) byClub.set(club.id, []);

  // Dove si trova ciascun giocatore adesso, dopo i trasferimenti del mondo.
  const clubDi = new Map<string, string>();
  for (const t of transfers) {
    if (t.season <= season) clubDi.set(t.playerId, t.toClubId);
  }

  let retired = 0;
  const ritiratiPerClub = new Map<string, WorldPlayer[]>();

  for (const player of players) {
    // La rosa dell'utente è gestita dalla carriera, non dal mondo.
    if (player.clubId === ownClubId || ownedByUser.has(player.id)) continue;

    if (isRetiredBySeason(player.birthDate, season)) {
      retired++;
      const casa = clubDi.get(player.id) ?? player.clubId;
      const elenco = ritiratiPerClub.get(casa);
      if (elenco) elenco.push(player);
      else ritiratiPerClub.set(casa, [player]);
      continue;
    }

    const casa = clubDi.get(player.id) ?? player.clubId;
    const evoluto: WorldPlayer = {
      ...player,
      clubId: casa,
      overall: aiOverallInSeason(player.overall, player.birthDate, season),
    };
    byId.set(evoluto.id, evoluto);
    const elenco = byClub.get(casa);
    if (elenco) elenco.push(evoluto);
  }

  /**
   * **Il regen nasce in un club a caso, non più in quello del ritirato.**
   *
   * Prima ogni club rimpiazzava solo i propri ritirati, nello stesso club — prevedibile, e
   * una delle ragioni per cui carriere diverse finivano per sembrare uguali. Ora si accorpano
   * tutti i ritirati IA della stagione in un'unica lista e si tira, per ciascuno, un club di
   * destinazione a caso (seedato) fra tutti quelli che non sono il nostro — l'identità del
   * regen resta comunque ancorata al ritirato (`airegen-<id>`, dentro `regensForClub`), solo
   * la squadra in cui nasce cambia.
   */
  const eligibleClubs = clubs.filter((c) => c.id !== ownClubId);
  const tuttiIRitirati: WorldPlayer[] = [];
  for (const elenco of ritiratiPerClub.values()) tuttiIRitirati.push(...elenco);

  /**
   * Seed **per ritirato**, non un'unica sequenza consumata in ordine di lista.
   *
   * Un'unica sequenza condivisa (`derivedRandom(seed, "regenClub", season)` pescata una volta
   * per ritirato in ordine di lista) sembrava innocua ma non lo era: a season diverse la lista
   * dei ritirati ha lunghezza diversa (i ritiri si accumulano), quindi lo stesso ritirato può
   * occupare una posizione diversa nella lista fra una valutazione e l'altra — e con essa
   * un'estrazione diversa, quindi un club di destinazione diverso, quindi (a cascata) un nome
   * diverso. Seedando sul solo id del ritirato l'estrazione non dipende più da quanti altri
   * ritirati ci sono intorno: la destinazione — come l'id — resta la stessa per sempre.
   */
  const ritiratiPerDestinazione = new Map<string, WorldPlayer[]>();
  for (const ritirato of tuttiIRitirati) {
    if (eligibleClubs.length === 0) break;
    const destRandom = derivedRandom(seed, "regenClub", ritirato.id);
    const destinazione = eligibleClubs[Math.floor(destRandom() * eligibleClubs.length)]!;
    const elenco = ritiratiPerDestinazione.get(destinazione.id);
    if (elenco) elenco.push(ritirato);
    else ritiratiPerDestinazione.set(destinazione.id, [ritirato]);
  }

  for (const club of eligibleClubs) {
    const ritirati = ritiratiPerDestinazione.get(club.id) ?? [];
    if (ritirati.length === 0) continue;
    const rosa = byClub.get(club.id) ?? [];
    const nomi = new Set(rosa.map((p) => p.name));
    for (const regen of regensForClub(club, ritirati, nomi, seed, season)) {
      /**
       * **Se l'hai comprato tu resta in anagrafica, ma non nella sua vecchia squadra.**
       *
       * Due difetti opposti, entrambi visti in gioco, e la distinzione fra i due è il punto:
       *  - generarlo e basta lo lasciava **anche** nel club d'origine, che continuava a
       *    schierarlo contro di noi: due copie della stessa persona;
       *  - saltarlo del tutto — la prima correzione — lo cancellava dall'**anagrafica**, e
       *    comprandolo compariva in rosa come "Giocatore" senza nome né ruolo.
       *
       * La risposta giusta è tenerlo in `byId` (chi è) e toglierlo da `byClub` (dove gioca):
       * sono due domande diverse e vanno risposte separatamente.
       */
      byId.set(regen.id, regen);
      if (!ownedByUser.has(regen.id)) rosa.push(regen);
    }
    byClub.set(club.id, rosa);
  }

  // Regen nati da un nostro ritirato ma atterrati altrove: senza questo innesto sarebbero
  // generati (career.ts li tiene in `state.generated`) ma invisibili al mondo — né in campo
  // per la squadra di destinazione, né acquistabili.
  for (const { destinationClubId, player } of externalRegens) {
    if (destinationClubId === ownClubId) continue;
    const rosa = byClub.get(destinationClubId);
    if (!rosa) continue;
    const worldPlayer: WorldPlayer = {
      id: player.id,
      name: player.name,
      nation: player.nation,
      role: player.role,
      secondaryRoles: player.secondaryRoles,
      department: ROLE_DEPARTMENT[player.role],
      birthDate: player.birthDate,
      overall: player.overall,
      clubId: destinationClubId,
      regen: true,
    };
    byId.set(worldPlayer.id, worldPlayer);
    if (!ownedByUser.has(worldPlayer.id)) rosa.push(worldPlayer);
  }

  return { byClub, byId, retired };
}

/** Un identificatore stabile del mondo a una stagione: utile a memorizzare i calcoli. */
export function worldKey(seed: string, season: number, transfers: readonly WorldTransfer[]): string {
  return `${hashSeed(seed)}-${season}-${transfers.length}`;
}

/** Notifica di un evento accaduto nel mercato allenatori del mondo vivo. */
export interface WorldCoachNotice {
  id: string;
  season: number;
  kind: "esonero" | "ingaggio" | "poaching" | "dimissioni";
  coachName: string;
  clubId: string;
  clubName: string;
  message: string;
}

/**
 * Valuta l'operato dei tecnici delle squadre CPU e genera esoneri/ingaggi se un club delude.
 */
export function evaluateAiCoaches(
  clubs: WorldClub[],
  standings: { clubId: string; rank: number }[],
  season: number,
  coachesMap: Map<string, string> // clubId -> coachId
): WorldCoachNotice[] {
  const notices: WorldCoachNotice[] = [];
  const rankMap = new Map(standings.map((s) => [s.clubId, s.rank]));

  for (const club of clubs) {
    const rank = rankMap.get(club.id);
    if (!rank) continue;

    // Target rank in base al prestigeTier (Tier 5 -> top 3, Tier 4 -> top 6, Tier 3 -> top 10)
    const targetRank = club.prestigeTier >= 5 ? 3 : club.prestigeTier >= 4 ? 6 : club.prestigeTier >= 3 ? 10 : 16;

    if (rank > targetRank + 3) {
      const currentCoachId = coachesMap.get(club.id);
      if (currentCoachId) {
        notices.push({
          /**
           * **Id derivato, mai casuale.** C'era un suffisso `Math.random()` che non serviva a
           * nulla — un club produce al più una notizia per stagione, quindi `club.id + season` è
           * già univoco — ma rendeva il motore **non riproducibile**: in single-player è invisibile
           * (è solo la chiave di una riga), nel multigiocatore a passo bloccato due client
           * calcolerebbero stati diversi alla prima notizia di mercato allenatori, che è esattamente
           * il tipo di divergenza impossibile da diagnosticare a valle.
           */
          id: `notice-${club.id}-${season}`,
          season,
          kind: "esonero",
          coachName: "L'allenatore",
          clubId: club.id,
          clubName: club.name,
          message: `ESONERO: Il club ${club.name} ha sollevato dall'incarico il proprio allenatore per i risultati deludenti (${rank}° posto)!`,
        });
        coachesMap.delete(club.id);
      }
    }
  }

  return notices;
}

