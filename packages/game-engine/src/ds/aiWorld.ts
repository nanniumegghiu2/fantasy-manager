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
 * Da 14 a 50: con 96 club e oltre 2.500 giocatori, 14 operazioni su dieci stagioni si
 * muovevano troppo poco per sembrare vivo — richiesta esplicita dell'utente di un mercato IA
 * più dinamico nel pannello "Mercato dal mondo" (CLAUDE.md §3.7.10).
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

export interface PlanWorldTransfersInput {
  clubs: WorldClub[];
  /** Giocatori per club, già invecchiati e ripuliti dai ritirati. */
  byClub: Map<string, WorldPlayer[]>;
  /** Il club dell'utente: il mondo non tocca la sua rosa. */
  ownClubId: string;
  seed: string;
  season: number;
}

/**
 * I trasferimenti che le squadre del computer fanno in questa sessione di mercato.
 *
 * Logica volutamente semplice e **leggibile**: un club prende un giocatore migliore del suo
 * undici da un club più debole, pagandone il valore. Non è un modello di mercato realistico —
 * è un mondo che si muove in modo comprensibile, che è ciò che serve perché l'utente lo
 * percepisca vivo senza doverlo studiare.
 */
export function planWorldTransfers({
  clubs,
  byClub,
  ownClubId,
  seed,
  season,
}: PlanWorldTransfersInput): WorldTransfer[] {
  const random = derivedRandom(seed, "worldmarket", season);
  const forza = new Map<string, number>();
  for (const club of clubs) {
    const rosa = byClub.get(club.id) ?? [];
    const migliori = [...rosa].sort((a, b) => b.overall - a.overall).slice(0, 11);
    forza.set(
      club.id,
      migliori.length > 0 ? migliori.reduce((s, p) => s + p.overall, 0) / migliori.length : 70,
    );
  }

  const compratori = clubs
    .filter((c) => c.id !== ownClubId)
    .sort((a, b) => (forza.get(b.id) ?? 0) - (forza.get(a.id) ?? 0));

  const transfers: WorldTransfer[] = [];
  const giaMossi = new Set<string>();

  for (const compratore of compratori) {
    if (transfers.length >= WORLD_TRANSFERS_PER_SEASON) break;
    // Non tutti comprano ogni anno: un mondo in cui si muovono tutti sarebbe rumore.
    if (random() > 0.5) continue;

    const forzaCompratore = forza.get(compratore.id) ?? 70;
    const rosaCompratore = byClub.get(compratore.id) ?? [];
    if (rosaCompratore.length >= 30) continue;

    /**
     * Il reparto da rinforzare: prima si guarda la **profondità reale** (titolari + una
     * panchina credibile, non gli 11 nudi — richiesta esplicita dell'utente), e solo se tutti i
     * reparti hanno un cuscinetto a posto si ripiega sul reparto più debole per qualità.
     */
    const bersaglioReparto = repartoScoperto(rosaCompratore) ?? repartoPiuDebole(rosaCompratore);

    /**
     * Chi si può prendere: qualcuno che **lo migliori davvero**, da un club che ha un'eccedenza
     * vera in quel reparto (titolari+panchina già coperti, quello è di troppo) o, in mancanza,
     * da un club più debole. Tre passate: prima l'eccedenza reale (il colpo più sensato — quel
     * club vuole smaltire), poi il reparto giusto senza guardare l'eccedenza, infine qualunque
     * reparto con l'asticella alzata — perché a quel punto non è un rattoppo, è un'occasione.
     */
    const cerca = (soloReparto: boolean, sogliaExtra: number, soloEccedenza: boolean) => {
      const trovati: { player: WorldPlayer; venditore: WorldClub }[] = [];
      for (const venditore of clubs) {
        if (venditore.id === compratore.id || venditore.id === ownClubId) continue;
        const forzaVenditore = forza.get(venditore.id) ?? 70;
        if (forzaCompratore - forzaVenditore < MIN_BUYER_EDGE) continue;
        const rosaVenditore = byClub.get(venditore.id) ?? [];
        if (rosaVenditore.length <= 22) continue; // non si svuota una rosa già corta
        if (soloEccedenza && eccedenzaReparto(rosaVenditore, bersaglioReparto) <= 0) continue;

        for (const player of rosaVenditore) {
          if (giaMossi.has(player.id)) continue;
          if (soloReparto && player.department !== bersaglioReparto) continue;
          if (player.overall < forzaCompratore + sogliaExtra) continue;
          trovati.push({ player, venditore });
        }
      }
      return trovati;
    };

    const candidati = (() => {
      const daEccedenza = cerca(true, -3, true);
      if (daEccedenza.length > 0) return daEccedenza;
      const nelReparto = cerca(true, -3, false);
      return nelReparto.length > 0 ? nelReparto : cerca(false, 0, false);
    })();

    if (candidati.length === 0) continue;
    const scelto = candidati[Math.floor(random() * candidati.length)]!;
    giaMossi.add(scelto.player.id);

    transfers.push({
      playerId: scelto.player.id,
      playerName: scelto.player.name,
      fromClubId: scelto.venditore.id,
      toClubId: compratore.id,
      fee: prezzoIndicativo(scelto.player, compratore.prestigeTier),
      season,
    });
  }

  return transfers;
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

/** Il primo reparto sotto il fabbisogno titolari+panchina, se ce n'è uno: la necessità reale. */
function repartoScoperto(rosa: WorldPlayer[]): Department | null {
  const ordine: Department[] = ["POR", "DIF", "CC", "ATT"];
  for (const dep of ordine) {
    const conteggio = rosa.filter((p) => p.department === dep).length;
    if (conteggio < FABBISOGNO_PER_REPARTO[dep]) return dep;
  }
  return null;
}

function repartoPiuDebole(rosa: WorldPlayer[]): Department {
  const ordine: Department[] = ["POR", "DIF", "CC", "ATT"];
  let peggiore: Department = "ATT";
  let peggiorMedia = Infinity;
  for (const dep of ordine) {
    const gruppo = rosa.filter((p) => p.department === dep);
    if (gruppo.length === 0) return dep;
    const migliori = [...gruppo]
      .sort((a, b) => b.overall - a.overall)
      .slice(0, TITOLARI_PER_REPARTO[dep]);
    const media = migliori.reduce((s, p) => s + p.overall, 0) / migliori.length;
    if (media < peggiorMedia) {
      peggiorMedia = media;
      peggiore = dep;
    }
  }
  return peggiore;
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
          id: `notice-${club.id}-${season}-${Math.random().toString(36).slice(2, 6)}`,
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

