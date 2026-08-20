/**
 * **Il mercato dei parametri zero.**
 *
 * È il luogo in cui si vede l'abilità del direttore sportivo: uno svincolato non costa
 * cartellino, quindi **il portafoglio non decide, decide chi lo convince**. Una piccola squadra
 * può strappare un giocatore a un club più ricco offrendo ciò che il ricco non può offrire — il
 * campo. E siccome i minuti garantiti sono un impegno verificato (`commitments.ts`), quel colpo
 * è anche un debito: tenerlo poi in panchina produce la rottura, con gli interessi.
 *
 * ## Ogni carriera è unica
 *
 * Il pool non è una lista di nomi scelti a mano: nasce dai **contratti scaduti**, e le scadenze
 * si derivano dal seme di carriera (`contracts.ts`). Due carriere sullo stesso database hanno
 * quindi svincolati diversi. Il test `dsFreeAgents.test.ts` blocca la proprietà misurandola:
 * semi diversi → sovrapposizione bassa.
 *
 * ## Il pool si consuma e decade
 *
 * Senza queste due regole sarebbe un negozio sempre aperto:
 *  - **decadimento**: chi resta senza squadra perde condizione, finestra dopo finestra;
 *  - **concorrenza**: i club IA firmano, e il colpo migliore sparisce se non lo prendi subito.
 */
import { ROLE_DEPARTMENT, type Department, type Role } from "@app/shared-types";
import { derivedRandom } from "../random";
import { ageInSeason } from "./aging";
import { baseWageOf, contractExpiryOf, type ContractOverrides } from "./contracts";
import { generateName } from "./names";
import { derivePlayerPersonality, type PlayerPersonality } from "./types";
import { aiOverallInSeason, isRetiredBySeason, type WorldPlayer } from "./aiWorld";

/* -------------------------------------------------------------------------- */
/* Modello                                                                     */
/* -------------------------------------------------------------------------- */

export type FreeAgentOrigin = "scaduto" | "svincolato" | "regen" | "rottura";

export interface FreeAgent {
  id: string;
  name: string;
  nation: string;
  role: Role;
  secondaryRoles: Role[];
  department: Department;
  birthDate?: string | null;
  age: number;
  /** Overall **già decaduto** per le finestre passate da libero. */
  overall: number;
  /** Overall di partenza, prima del decadimento: serve a mostrare quanto sta perdendo. */
  baseOverall: number;
  origin: FreeAgentOrigin;
  /** Da quante finestre è senza squadra. */
  windowsFree: number;
  /** Quanto perderà ancora se resta libero un'altra finestra. */
  nextDecay: number;
  personality: PlayerPersonality;
  /** Ingaggio annuo richiesto. */
  askingWage: number;
  /** Durata richiesta, in stagioni. */
  askingSeasons: number;
  /** Vuole garanzie di titolarità per firmare? */
  wantsStarter: boolean;
  /** Quanti club lo stanno seguendo: è l'urgenza, e si vede nella lista. */
  suitors: number;
}

/** Quanto Overall si perde per ogni finestra passata da svincolato, e il tetto complessivo. */
export const DECAY_PER_WINDOW = 1;
export const MAX_DECAY = 4;

/** Chi sta sotto questa soglia non entra nella vetrina: allungherebbe la lista senza scelte vere. */
export const FREE_AGENT_MIN_OVERALL = 64;

/* -------------------------------------------------------------------------- */
/* Costruzione del pool                                                        */
/* -------------------------------------------------------------------------- */

export interface FreeAgentPoolInput {
  /** I giocatori del mondo alla stagione corrente (da `evolveWorld`). */
  worldPlayers: readonly WorldPlayer[];
  seed: string;
  season: number;
  /** La finestra aperta: in inverno il decadimento è già di una tacca. */
  winter?: boolean;
  overrides?: ContractOverrides;
  /** Chi è stato svincolato per decisione (nostra o dell'IA). */
  released?: readonly string[];
  /** Chi ha già firmato con qualcuno: esce dal pool. */
  signed?: ReadonlySet<string>;
  /** Prestigio per club, per stimare l'ingaggio richiesto di chi veniva da una grande. */
  clubPrestige?: Record<string, number>;
  /** Quanti giovani senza squadra generare, oltre ai contratti scaduti. */
  regenCount?: number;
}

/**
 * Il pool degli svincolati adesso.
 *
 * Puro e derivato: ricostruirlo dà sempre la stessa lista, quindi non occupa un byte di
 * salvataggio — stesso principio di `aiWorld.ts`.
 */
export function buildFreeAgentPool(input: FreeAgentPoolInput): FreeAgent[] {
  const {
    worldPlayers,
    seed,
    season,
    winter = false,
    overrides,
    released = [],
    signed,
    clubPrestige = {},
    regenCount = 6,
  } = input;

  const rilasciati = new Set(released);
  const pool: FreeAgent[] = [];

  for (const player of worldPlayers) {
    if (signed?.has(player.id)) continue;

    const override = overrides?.[player.id];
    const scadenza = override ? override.until : contractExpiryOf(player, seed);
    const svincolato = rilasciati.has(player.id);
    // Libero da: la stagione dopo la scadenza, oppure subito se rescisso.
    if (!svincolato && scadenza >= season) continue;
    // ⚠️ **I club rinnovano.** Senza questo filtro il pool cresce di stagione in stagione fino a
    // contenere i migliori giocatori del mondo (sez. `clubWouldRenew`).
    if (!svincolato && clubWouldRenew(player, seed, season)) continue;

    const primaStagioneLibero = svincolato ? season : scadenza + 1;
    const finestreLibero = Math.max(0, (season - primaStagioneLibero) * 2 + (winter ? 1 : 0));

    const agente = toFreeAgent(player, {
      seed,
      season,
      windowsFree: finestreLibero,
      origin: svincolato ? "svincolato" : "scaduto",
      prestige: clubPrestige[player.clubId] ?? 3,
    });
    if (!agente || agente.overall < FREE_AGENT_MIN_OVERALL) continue;
    // I club IA firmano anche loro: chi è stato preso non è più in vetrina.
    if (aiClaimsFreeAgent(agente, seed, season, winter)) continue;
    pool.push(agente);
  }

  /**
   * ⚠️ **Anche i ragazzi senza squadra escono dalla vetrina quando qualcuno li firma.**
   *
   * Il filtro `signed` valeva solo per il giro sui giocatori del mondo, e i regen si
   * aggiungevano **dopo**, incondizionatamente. Siccome il loro id è derivato da
   * `(seme, stagione, indice)` — quindi stabile dentro la stagione — il difetto si vedeva così:
   * si firmava uno svincolato in estate, lo si vendeva a gennaio, e alla riapertura della
   * vetrina **era di nuovo lì**. La lista lo nascondeva solo finché stava in rosa
   * (`FreeAgentsPanel`), che è esattamente il caso in cui il difetto non si nota.
   */
  pool.push(
    ...generateUnattachedYouth(seed, season, regenCount, pool).filter((a) => !signed?.has(a.id)),
  );

  return pool.sort((a, b) => b.overall - a.overall);
}

/**
 * **Il club rinnova, e questa è la regola che mancava del tutto.**
 *
 * ⚠️ Il difetto, segnalato dall'utente: *"col passare delle stagioni si trovano nella lista
 * svincolati tutti i più forti giocatori del gioco"*. La causa non era una soglia sbagliata ma
 * un'assenza — le scadenze si derivano dal seme per **tutti** i 3.000 giocatori del mondo, e
 * nessun codice faceva rinnovare i club IA. Quindi ogni contratto che scadeva finiva sul mercato
 * e non ne usciva mai più: alla quinta o sesta stagione la vetrina conteneva mezzo database,
 * fuoriclasse compresi. Non era uno squilibrio, era un accumulo.
 *
 * Un club vero rinnova quasi tutti e lascia andare pochi. Chi lascia andare, e chi trattiene,
 * dipende da due fatti soli — e sono quelli che rendono la lista **plausibile** invece che
 * ricchissima:
 *  - **il livello**: un fuoriclasse non lo perdi a zero se non per un caso raro (e quando
 *    capita è la notizia della finestra, non l'ordinaria amministrazione);
 *  - **l'età**: a trentadue anni il rinnovo è tutt'altro che scontato, ed è infatti da lì che
 *    arriva il grosso dei parametri zero veri.
 *
 * Deterministico per `(seme, giocatore, stagione)`: nessun byte di salvataggio, e ricaricare una
 * carriera non cambia chi è sul mercato.
 */
export function clubWouldRenew(
  player: { id: string; overall: number; birthDate?: string | null },
  seed: string,
  season: number,
): boolean {
  const age = ageInSeason(player.birthDate, season) ?? 26;
  const overall = aiOverallInSeason(player.overall, player.birthDate, season);

  /**
   * Probabilità che il club **rinnovi**. I numeri sono placeholder di bilanciamento dichiarati,
   * tarati su una sola proprietà misurabile: la vetrina deve restare fatta soprattutto di
   * veterani e comprimari, con il colpo grosso raro (`dsFreeAgents.test.ts`).
   */
  /**
   * ⚠️ **Ritarato misurando la vetrina, non a occhio** (segnalazione dell'utente: *"mercato
   * svincolati ancora totalmente inutile"*).
   *
   * Con i valori di prima la sonda contava, alla quarta stagione, **13 giocatori da 78 in su su
   * 382 svincolati**, e uno solo sopra 84 in cinque stagioni. Una vetrina così non è "rara": è
   * vuota, e aprirla non serve a niente. I fuoriclasse restano difficili da trovare liberi, ma
   * smettono di essere impossibili.
   */
  let probabilita = 0.82;
  if (overall >= 84) probabilita = 0.93;
  else if (overall >= 78) probabilita = 0.88;
  else if (overall >= 72) probabilita = 0.84;
  else probabilita = 0.7; // il fondo rosa si lascia andare volentieri

  // L'età morde più del livello: è il vero motivo per cui un buon giocatore finisce libero.
  if (age >= 34) probabilita -= 0.5;
  else if (age >= 32) probabilita -= 0.32;
  else if (age >= 30) probabilita -= 0.16;
  else if (age <= 23) probabilita += 0.06; // i giovani si blindano

  return derivedRandom(seed, "renewAI", player.id, season)() < Math.max(0.05, Math.min(0.99, probabilita));
}

/**
 * **Anche le squadre del computer firmano a parametro zero.**
 *
 * ⚠️ Richiesta esplicita dell'utente — *"il mondo deve essere vivo, non esisto solo io a
 * muovermi"* — e il difetto era completo: `freeAgentsSigned` registrava **soltanto le nostre**
 * firme, quindi nessuno usciva mai dalla vetrina se non per mano nostra. Le offerte rivali
 * (`rivalBidsFor`) esistevano solo *mentre* trattavamo un giocatore: erano una resistenza al
 * momento della firma, non un mercato che si muove da sé. Un buon parametro zero poteva restare
 * lì per stagioni intere, e la lista non si consumava mai.
 *
 * Derivato, non salvato: la firma dipende da `(seme, giocatore, stagione, finestra)`, quindi non
 * costa un byte e ricaricare una carriera trova la stessa vetrina. Dentro una finestra la lista
 * è **stabile** — non sparisce nessuno mentre lo stai guardando — e cambia all'apertura della
 * successiva, che è esattamente dove deve stare l'urgenza.
 *
 * Due regole, quelle che rendono la vetrina un posto dove conviene arrivare presto:
 *  - **chi è forte va via subito**: un ottimo giocatore libero è un'occasione per tutti, non
 *    solo per noi;
 *  - **chi resta a lungo interessa sempre meno**: se nessuno l'ha preso in due finestre, un
 *    motivo c'è, e il gioco lo dice lasciandolo lì.
 */
export function aiClaimsFreeAgent(
  agent: FreeAgent,
  seed: string,
  season: number,
  winter: boolean,
): boolean {
  // Appena liberato nessuno ha ancora firmato: la prima finestra è la nostra occasione piena.
  if (agent.windowsFree === 0 && !winter) return false;

  let probabilita = 0.12;
  if (agent.overall >= 82) probabilita = 0.62;
  else if (agent.overall >= 78) probabilita = 0.42;
  else if (agent.overall >= 74) probabilita = 0.26;

  // Un veterano interessa meno del pari livello nel pieno: è il motivo per cui la vetrina resta
  // fatta soprattutto di gente avanti con l'età anche dopo che l'IA ha fatto la sua spesa.
  if (agent.age >= 33) probabilita *= 0.45;
  else if (agent.age >= 30) probabilita *= 0.7;

  // Chi è già rimasto libero a lungo attira sempre meno, non di più.
  probabilita *= Math.max(0.3, 1 - agent.windowsFree * 0.18);

  return derivedRandom(seed, "faClaim", agent.id, season, winter ? 1 : 0)() < probabilita;
}

interface ToFreeAgentCtx {
  seed: string;
  season: number;
  windowsFree: number;
  origin: FreeAgentOrigin;
  prestige: number;
}

function toFreeAgent(player: WorldPlayer, ctx: ToFreeAgentCtx): FreeAgent | null {
  if (isRetiredBySeason(player.birthDate, ctx.season)) return null;
  const age = ageInSeason(player.birthDate, ctx.season);
  if (age === null) return null;

  const base = aiOverallInSeason(player.overall, player.birthDate, ctx.season);
  const decadimento = Math.min(MAX_DECAY, ctx.windowsFree * DECAY_PER_WINDOW);
  const overall = Math.max(50, base - decadimento);

  const personality = derivePlayerPersonality(player.id, age, overall, ctx.season, ctx.season);
  const random = derivedRandom(ctx.seed, "freeagent", player.id, ctx.season);

  // Chi è libero da tempo abbassa le pretese: è l'altra faccia del decadimento, e rende sensato
  // aspettare gennaio per un affare — al prezzo di prenderlo meno in forma.
  const sconto = 1 - Math.min(0.35, ctx.windowsFree * 0.12);
  const richiesta = baseWageOf(overall, age, ctx.prestige) * (0.95 + random() * 0.3) * sconto;

  return {
    id: player.id,
    name: player.name,
    nation: player.nation,
    role: player.role,
    secondaryRoles: player.secondaryRoles,
    department: player.department,
    birthDate: player.birthDate,
    age,
    overall,
    baseOverall: base,
    origin: ctx.origin,
    windowsFree: ctx.windowsFree,
    nextDecay: ctx.windowsFree * DECAY_PER_WINDOW >= MAX_DECAY ? 0 : DECAY_PER_WINDOW,
    personality,
    askingWage: Math.max(60_000, Math.round(richiesta / 10_000) * 10_000),
    askingSeasons: age >= 33 ? 1 : age >= 30 ? 2 : age <= 22 ? 4 : 3,
    /**
     * ⚠️ **Non tutti pretendono il posto.**
     *
     * Con la soglia a 74 la pretendeva quasi chiunque valesse qualcosa, e siccome non concederla
     * schiacciava il punteggio (`campo` a 0,2) la conseguenza era quella segnalata dall'utente:
     * *"nonostante sia uno dei club più affermati in Europa solo pochi giocatori accettano il
     * trasferimento"*. Un giocatore da 75 che va in una grande sa benissimo di non essere
     * titolare, e ci va lo stesso. La soglia sale a 79, e la pretesa resta di chi ha davvero
     * carriera da difendere — più i giovani ambiziosi, per cui giocare *è* la carriera.
     */
    wantsStarter: overall >= 79 || personality === "giovane_ambizioso",
    suitors: 0,
  };
}

const YOUTH_ROLES: Role[] = ["POR", "TD", "DC", "TS", "MED", "CC", "ED", "ES", "TRQ", "ATT"];
const YOUTH_NATIONS = ["Italia", "Francia", "Spagna", "Germania", "Inghilterra", "Brasile", "Argentina", "Portogallo"];

/**
 * I giovani senza squadra: coprono i ruoli che il caso lascia scoperti e danno alle piccole una
 * scommessa a basso costo. Nomi generati dalla stessa macchina dei regen, quindi già unici.
 */
function generateUnattachedYouth(
  seed: string,
  season: number,
  quanti: number,
  esistenti: readonly FreeAgent[],
): FreeAgent[] {
  const nomiUsati = new Set(esistenti.map((a) => a.name));
  const out: FreeAgent[] = [];

  for (let i = 0; i < quanti; i++) {
    const random = derivedRandom(seed, "freeyouth", season, i);
    const nation = YOUTH_NATIONS[Math.floor(random() * YOUTH_NATIONS.length)]!;
    const role = YOUTH_ROLES[Math.floor(random() * YOUTH_ROLES.length)]!;
    const age = 18 + Math.floor(random() * 4);
    const overall = FREE_AGENT_MIN_OVERALL + Math.floor(random() * 8);
    const name = generateName(nation, nomiUsati, random);
    nomiUsati.add(name);

    out.push({
      id: `freeyouth-${seed}-${season}-${i}`,
      name,
      nation,
      role,
      secondaryRoles: [],
      department: ROLE_DEPARTMENT[role],
      birthDate: `${2025 + season - 1 - age}-0${1 + Math.floor(random() * 9)}-12`,
      age,
      overall,
      baseOverall: overall,
      origin: "regen",
      windowsFree: 0,
      nextDecay: 0,
      personality: "giovane_ambizioso",
      askingWage: Math.max(60_000, Math.round(baseWageOf(overall, age, 2) / 10_000) * 10_000),
      askingSeasons: 4,
      wantsStarter: false,
      suitors: 0,
    });
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* La trattativa: cinque assi, non una cifra                                   */
/* -------------------------------------------------------------------------- */

export interface FreeAgentBid {
  clubId: string;
  clubName: string;
  /** 1-5. Pesa sull'ambizione percepita. */
  prestige: number;
  /** Ingaggio annuo offerto. */
  wage: number;
  /** Durata offerta, in stagioni. */
  seasons: number;
  /** Titolarità garantita: è un impegno verificato, non una frase. */
  guaranteedStarter: boolean;
  /** Fascia da capitano. */
  captain: boolean;
  /** Posizione promessa in campionato (1 = titolo). Più bassa, più ambiziosa. */
  ambitionTarget?: number;
}

/**
 * Quanto vale un'offerta **per lui**, 0-100.
 *
 * I pesi cambiano con la personalità, ed è tutto il senso della meccanica: al `mercenario`
 * interessa la cifra, al `giovane_ambizioso` i minuti, al `leader` il ruolo e le ambizioni. Ecco
 * perché una piccola può battere il Real: non gareggia sullo stesso asse.
 */
export function freeAgentBidScore(agent: FreeAgent, bid: FreeAgentBid): number {
  const pesi: Record<PlayerPersonality, { soldi: number; durata: number; campo: number; ambizione: number; ruolo: number }> = {
    mercenario: { soldi: 0.58, durata: 0.14, campo: 0.1, ambizione: 0.1, ruolo: 0.08 },
    giovane_ambizioso: { soldi: 0.2, durata: 0.15, campo: 0.42, ambizione: 0.15, ruolo: 0.08 },
    leader: { soldi: 0.26, durata: 0.12, campo: 0.18, ambizione: 0.24, ruolo: 0.2 },
    insofferente: { soldi: 0.36, durata: 0.12, campo: 0.3, ambizione: 0.14, ruolo: 0.08 },
    professionista: { soldi: 0.34, durata: 0.24, campo: 0.2, ambizione: 0.14, ruolo: 0.08 },
  };
  const p = pesi[agent.personality];

  const soldi = Math.min(1.3, bid.wage / Math.max(1, agent.askingWage));
  const durata = 1 - Math.min(1, Math.abs(bid.seasons - agent.askingSeasons) / 3);
  /**
   * Non concedere il posto a chi lo chiede **pesa**, ma non annulla l'offerta: chi punta in alto
   * mette in conto di doverselo giocare. Con 0,2 la sola mancanza della garanzia bastava a farlo
   * perdere contro qualunque rivale che gliela concedesse, a prescindere da tutto il resto —
   * ingaggio, blasone, ambizioni. Alzato a 0,45: resta la leva più forte che una piccola ha per
   * battere una grande, senza essere l'unica cosa che conta.
   */
  const campo = agent.wantsStarter ? (bid.guaranteedStarter ? 1 : 0.45) : bid.guaranteedStarter ? 1 : 0.75;
  const ruolo = bid.captain ? 1 : 0.55;

  /**
   * **L'ambizione si smorza con l'età** (richiesta esplicita dell'utente).
   *
   * Un venticinquenne libero guarda dove può arrivare e il blasone pesa; un trentaquattrenne
   * guarda dove può giocare, e una piccola che gli offre il campo diventa una destinazione
   * sensata. Senza questo smorzamento la vetrina premiava sempre i club più blasonati e la
   * meccanica "la piccola batte la grande offrendo minuti" valeva solo per i giovani — cioè
   * proprio per la categoria che una piccola fatica di più a trattenere.
   *
   * Il peso dell'ambizione non sparisce: si riversa sul campo, perché è lì che si sposta la
   * testa di chi ha più anni che carriera davanti.
   */
  const pesoAmbizione = agent.age >= 33 ? 0.3 : agent.age >= 30 ? 0.6 : agent.age >= 27 ? 0.85 : 1;
  const ambizioneGrezza = Math.min(
    1,
    (bid.prestige / 5) * 0.7 +
      (bid.ambitionTarget ? Math.max(0, (8 - bid.ambitionTarget) / 8) * 0.3 : 0.15),
  );
  // Chi è avanti con l'età legge il prestigio più vicino alla parità: la differenza fra una
  // grande e una piccola si assottiglia invece di annullarsi.
  const ambizione = 1 - (1 - ambizioneGrezza) * pesoAmbizione;
  const campoPesato = p.campo + p.ambizione * (1 - pesoAmbizione);

  const grezzo =
    p.soldi * soldi +
    p.durata * durata +
    campoPesato * campo +
    p.ambizione * pesoAmbizione * ambizione +
    p.ruolo * ruolo;

  /**
   * **Il pavimento sull'ingaggio: sotto una certa cifra non è un'offerta.**
   *
   * ⚠️ Serve perché i cinque assi si compensano fra loro, e per il `giovane_ambizioso` i soldi
   * pesano solo 0,20: alzando il peso del campo (correzione "pochi accettano il trasferimento")
   * un'offerta da **un ventesimo** di quanto chiedeva superava comunque la soglia grazie a
   * durata, ambizione e ruolo. L'ha colto un test che esisteva già — *"un'offerta troppo bassa
   * non la accetta nessuno, anche senza concorrenza"* — ed è esattamente il genere di
   * compensazione che una somma pesata produce se nessun asse ha diritto di veto.
   *
   * Sotto metà della richiesta il punteggio collassa in proporzione, invece di essere azzerato:
   * così la controproposta (`buildCounter`) continua a poter dire *quanto* servirebbe, che è la
   * cosa che rende la vetrina una trattativa e non un muro.
   */
  const pavimento = agent.askingWage * FREE_AGENT_WAGE_FLOOR;
  const collasso = bid.wage >= pavimento ? 1 : Math.max(0, bid.wage / Math.max(1, pavimento));

  return Math.round(Math.max(0, Math.min(1, grezzo * collasso)) * 100);
}

/** Sotto questo punteggio non firma con nessuno: preferisce restare libero e aspettare. */
export const FREE_AGENT_MIN_SCORE = 46;

/**
 * Frazione della richiesta sotto cui l'ingaggio diventa un veto, non un asse da compensare.
 * Nessuno firma per metà di quanto ha chiesto perché gli si promette il posto e la fascia.
 */
export const FREE_AGENT_WAGE_FLOOR = 0.5;

/**
 * **Cosa serve per convincerlo**, quando qualcun altro sta offrendo di più.
 *
 * ⚠️ Il difetto che questo tipo corregge, segnalato dall'utente: *"nove volte su dieci mi dice
 * che ha già accettato un'altra offerta, rendendo praticamente inutile la lista svincolati"*.
 * Non era la frequenza a essere sbagliata — la concorrenza deve esistere — ma il fatto che il no
 * fosse **definitivo e muto**: si scopriva di aver perso senza sapere di quanto, quindi rilanciare
 * era tirare a indovinare e la scheda si chiudeva lì.
 *
 * Un agente vero non dice "ho firmato altrove": dice *"per venire da voi mi serve questo"*. Da
 * qui in poi il verdetto negativo porta con sé la controproposta, e la trattativa continua.
 */
export interface FreeAgentCounter {
  /** L'ingaggio annuo che basterebbe a superare la migliore offerta rivale. */
  wage: number;
  /** Serve anche la titolarità garantita per chiudere? */
  needsStarter: boolean;
  /** Serve una durata diversa da quella proposta? Assente = quella offerta va bene. */
  seasons?: number;
  /** Quanto siamo lontani, in punti della sua scala: alimenta il testo e la barra. */
  gap: number;
}

/**
 * **I tre esiti possibili di una trattativa con uno svincolato** (specifica dell'utente).
 *
 * Prima erano due — "firma" o "non firma" — e il no arrivava in forme diverse che l'utente non
 * poteva distinguere: a volte era un rifiuto di principio, a volte una gara persa per poco. Non
 * sapendo quale dei due fosse, in entrambi i casi si chiudeva la scheda.
 *
 *  - `disinteressato` — non verrebbe comunque, e lo dice chiaramente: la trattativa **si chiude**
 *    e non c'è nulla da rilanciare. È l'esito che mancava del tutto;
 *  - `accordo` — gli va bene: si firma;
 *  - `conteso` — c'è chi offre di più, ma è prendibile: arriva la **cifra che serve**, e se non
 *    la si copre va davvero all'altro club.
 */
export type FreeAgentOutcome = "disinteressato" | "accordo" | "conteso";

export interface FreeAgentVerdict {
  accepted: boolean;
  /** Quale dei tre esiti è: la UI ci costruisce sopra tre schermate diverse, non un messaggio. */
  outcome: FreeAgentOutcome;
  score: number;
  /** Il punteggio della migliore offerta rivale, per raccontare perché ha scelto. */
  rivalScore: number;
  rivalClubName?: string;
  message: string;
  /**
   * Presente **solo** con esito `conteso`: dice cosa offrire per superare la concorrenza. Con
   * `disinteressato` è assente di proposito — non esiste una cifra che lo convinca.
   */
  counter?: FreeAgentCounter;
}

/**
 * L'ingaggio minimo che porterebbe la nostra offerta al punteggio bersaglio.
 *
 * Si risolve per bisezione invece che algebricamente perché `freeAgentBidScore` non è invertibile
 * a mano (pesi per personalità, tetti, componenti non lineari): venti passi bastano a centrare
 * l'euro utile, e restano una funzione pura del punteggio: se un giorno i pesi cambiano, questa
 * continua a dire il vero senza essere riscritta.
 */
function wageToReach(agent: FreeAgent, bid: FreeAgentBid, bersaglio: number): number | null {
  const massimo = agent.askingWage * 3;
  if (freeAgentBidScore(agent, { ...bid, wage: massimo }) < bersaglio) return null;

  let basso = 0;
  let alto = massimo;
  for (let i = 0; i < 20; i++) {
    const mezzo = (basso + alto) / 2;
    if (freeAgentBidScore(agent, { ...bid, wage: mezzo }) >= bersaglio) alto = mezzo;
    else basso = mezzo;
  }
  return Math.ceil(alto / 10_000) * 10_000;
}

/**
 * Compone la controproposta: prima prova coi soldi, poi aggiunge il campo.
 *
 * L'ordine non è arbitrario. I minuti garantiti sono un **impegno verificato**
 * (`commitments.ts`), quindi concederli è una scelta che si paga dopo: chiederli per primi
 * significherebbe suggerire all'utente la strada più costosa quando spesso ne basta una più
 * semplice. Se nemmeno tutto insieme basta, il giocatore non è prendibile e lo si dice.
 */
function buildCounter(
  agent: FreeAgent,
  ourBid: FreeAgentBid,
  bersaglio: number,
  gap: number,
): FreeAgentCounter | undefined {
  const soloSoldi = wageToReach(agent, ourBid, bersaglio);
  // ⚠️ Il tetto di quanto ha senso offrire, alzato da 2,2 a 3: con la soglia precedente un club
  // ricco non poteva **materialmente** coprire l offerta di un rivale forte, e il verdetto usciva
  // "fuori dalla vostra portata" anche quando i soldi c erano. Chi ha i mezzi deve poter vincere
  // la corsa — e pagarla.
  if (soloSoldi !== null && soloSoldi <= agent.askingWage * 3) {
    return { wage: soloSoldi, needsStarter: ourBid.guaranteedStarter, gap };
  }

  if (!ourBid.guaranteedStarter) {
    const conCampo = { ...ourBid, guaranteedStarter: true };
    const conStarter = wageToReach(agent, conCampo, bersaglio);
    if (conStarter !== null && conStarter <= agent.askingWage * 3) {
      return { wage: conStarter, needsStarter: true, gap };
    }
  }

  // Ultima leva: la durata che chiede, che vale poco ma può colmare uno scarto minimo.
  if (ourBid.seasons !== agent.askingSeasons) {
    const conDurata = { ...ourBid, guaranteedStarter: true, seasons: agent.askingSeasons };
    const finale = wageToReach(agent, conDurata, bersaglio);
    if (finale !== null && finale <= agent.askingWage * 3.2) {
      return { wage: finale, needsStarter: true, seasons: agent.askingSeasons, gap };
    }
  }

  return undefined;
}

/**
 * Chi vince la corsa.
 *
 * L'esito non è mai "chi offre di più": è chi ottiene il punteggio più alto **sulla sua** scala.
 * Un pizzico di rumore seedato impedisce che la scelta sia un calcolo esatto ripetibile a mente,
 * ma resta stabile a parità di offerta — ricaricare un salvataggio non cambia il verdetto.
 */
/**
 * **C'è chi non verrebbe comunque**, e non è questione di cifre.
 *
 * ⚠️ Questo veto è esplicito e non emergente, ed è una scelta. Affidarlo ai soli punteggi non
 * funzionava: con un'offerta abbastanza generosa il totale supera sempre la soglia, quindi
 * *qualunque* giocatore risultava prendibile pagando — e il primo dei tre esiti chiesti
 * dall'utente ("completamente disinteressato") non si verificava mai. Verificato scrivendo il
 * test: un'offerta simbolica produceva comunque una controproposta.
 *
 * La regola guarda la distanza fra **quanto vale** e **dove lo si sta chiamando**: un giocatore
 * nettamente sopra il livello di un club senza ambizioni non ci va per soldi, perché a quel
 * punto della carriera i soldi li trova anche altrove. Non vale per i veterani, che invece
 * accettano volentieri di scendere di categoria (vedi il peso dell'età in `freeAgentBidScore`).
 */
export function wouldConsider(agent: FreeAgent, bid: FreeAgentBid): boolean {
  if (agent.age >= 31) return true; // chi ha più anni che carriera guarda al campo, non al blasone
  if (agent.personality === "mercenario") return true; // per lui i soldi bastano sempre

  // Quanto in alto può ambire, letto dal prestigio del club: 1 → ~68, 5 → ~88.
  const livelloDelClub = 63 + bid.prestige * 5;
  const scarto = agent.overall - livelloDelClub;

  // Sopra questa distanza il progetto non lo riguarda. Il giovane ambizioso è il più esigente:
  // ha una carriera davanti e non la spende in un posto senza obiettivi.
  const tolleranza = agent.personality === "giovane_ambizioso" ? 6 : 10;
  return scarto <= tolleranza;
}

export function resolveFreeAgentBids(
  agent: FreeAgent,
  ourBid: FreeAgentBid,
  rivalBids: readonly FreeAgentBid[],
  seed: string,
  season: number,
): FreeAgentVerdict {
  // Il veto viene **prima** del punteggio: se il progetto non lo riguarda, non c e cifra da
  // calcolare e non c e trattativa da aprire.
  if (!wouldConsider(agent, ourBid)) {
    return {
      accepted: false,
      outcome: "disinteressato",
      score: 0,
      rivalScore: 0,
      message:
        "La ringrazio, Direttore, ma non fa per me: a questo punto della carriera cerco un altro tipo di progetto.",
    };
  }

  const rumore = derivedRandom(seed, "faBid", agent.id, season);
  const nostro = freeAgentBidScore(agent, ourBid) + (rumore() - 0.5) * 6;

  let miglioreRivale = 0;
  let nomeRivale: string | undefined;
  for (const bid of rivalBids) {
    const punteggio = freeAgentBidScore(agent, bid) + (rumore() - 0.5) * 6;
    if (punteggio > miglioreRivale) {
      miglioreRivale = punteggio;
      nomeRivale = bid.clubName;
    }
  }

  const score = Math.round(nostro);
  const rivalScore = Math.round(miglioreRivale);

  if (score < FREE_AGENT_MIN_SCORE) {
    /**
     * **Non ci siamo, e ci sono due modi diversi di non esserci.**
     *
     * Se una cifra ragionevole basterebbe a convincerlo è una trattativa da aprire; se **nessuna
     * offerta sostenibile** lo porta sopra la soglia, il progetto non gli interessa e va detto
     * chiaro invece di lasciar rilanciare a vuoto. È il primo dei tre esiti chiesti dall'utente,
     * e prima non esisteva: si vedeva sempre lo stesso "preferisco aspettare".
     */
    const counter = buildCounter(agent, ourBid, FREE_AGENT_MIN_SCORE, FREE_AGENT_MIN_SCORE - score);
    if (!counter) {
      return {
        accepted: false,
        outcome: "disinteressato",
        score,
        rivalScore,
        rivalClubName: nomeRivale,
        message:
          "Sarò sincero, Direttore: non è il progetto che cerco. Non è questione di cifre, non se ne fa nulla.",
      };
    }
    return {
      accepted: false,
      outcome: "conteso",
      score,
      rivalScore,
      rivalClubName: nomeRivale,
      counter,
      message: "Così non ci siamo, Direttore. Ma se trovate i margini, se ne può riparlare.",
    };
  }
  if (rivalScore > score) {
    /**
     * **Non ha ancora firmato: sta dicendo che c'è di meglio.**
     *
     * Il messaggio precedente ("ho accettato la proposta del…") chiudeva la porta e lasciava
     * l'utente senza appigli. La differenza non è di tono: con la controproposta la corsa a un
     * parametro zero diventa una trattativa che si può **vincere**, che è tutto il senso di
     * avere una vetrina.
     */
    const counter = buildCounter(agent, ourBid, rivalScore + 1, rivalScore - score);
    if (!counter) {
      // Fuori portata: non è una gara che si può vincere, ed è più onesto dirlo che far
      // rilanciare a vuoto.
      return {
        accepted: false,
        outcome: "disinteressato",
        score,
        rivalScore,
        rivalClubName: nomeRivale,
        message: nomeRivale
          ? `Mi dispiace, Direttore: la proposta del ${nomeRivale} è fuori dalla vostra portata.`
          : "Ho ricevuto una proposta che non potete coprire.",
      };
    }
    return {
      accepted: false,
      outcome: "conteso",
      score,
      rivalScore,
      rivalClubName: nomeRivale,
      counter,
      message: nomeRivale
        ? `Il ${nomeRivale} si è fatto avanti con qualcosa di più. Se coprite quella cifra, io vengo da voi.`
        : "Ho una proposta migliore sul tavolo. Copritela e chiudiamo.",
    };
  }
  return {
    accepted: true,
    outcome: "accordo",
    score,
    rivalScore,
    rivalClubName: nomeRivale,
    message: "Ci sto: firmo con voi.",
  };
}

/* -------------------------------------------------------------------------- */
/* La concorrenza dell'IA                                                      */
/* -------------------------------------------------------------------------- */

export interface RivalClubInfo {
  clubId: string;
  clubName: string;
  prestige: number;
  /** Margine di cassa ingaggi del club, in €/anno: senza spazio non può offrire. */
  wageRoom: number;
  /** Il reparto che gli manca davvero: fuori da lì non si muove. */
  needs: readonly Department[];
  /** Livello del suo undici: decide se offrirebbe la titolarità a questo giocatore. */
  elevenAverage: number;
}

/**
 * Le offerte che i club IA presentano allo stesso svincolato.
 *
 * Un club offre solo se: gli serve quel reparto, ha spazio a bilancio, e il giocatore è alla sua
 * portata. Le tre condizioni insieme sono ciò che rende battibile un club più ricco — spesso il
 * grande non ha bisogno di quel ruolo, o non gli garantirebbe mai il posto.
 */
export function rivalBidsFor(
  agent: FreeAgent,
  rivals: readonly RivalClubInfo[],
  seed: string,
  season: number,
): FreeAgentBid[] {
  const bids: FreeAgentBid[] = [];

  for (const club of rivals) {
    const random = derivedRandom(seed, "faRival", agent.id, club.clubId, season);
    if (!club.needs.includes(agent.department)) continue;
    if (club.wageRoom < agent.askingWage * 0.85) continue;
    // Un club molto più forte non perde tempo con chi non alzerebbe il livello.
    if (club.elevenAverage - agent.overall > 6) continue;
    // Meno club si muovono su ciascuno: con la vecchia soglia quasi ogni svincolato aveva un
    // pretendente, e la corsa si vinceva solo strapagando. La concorrenza resta, non è più
    // sistematica.
    //
    // ⚠️ Sceso ancora (0,45 → 0,3) **dopo aver misurato la popolazione giusta**: sul totale
    // degli svincolati l accordo usciva all 83%, ma su quelli da 78 in su — gli unici che uno
    // prova davvero a prendere — piu della meta finiva "fuori dalla vostra portata". Su un
    // giocatore forte i club plausibili sono tanti, e il massimo di tante offerte e sempre alto:
    // bastava questo a rendere la vetrina inutile proprio dove conta.
    if (random() > 0.3) continue;

    const generosita = 0.9 + random() * 0.45;
    bids.push({
      clubId: club.clubId,
      clubName: club.clubName,
      prestige: club.prestige,
      wage: Math.min(club.wageRoom, Math.round(agent.askingWage * generosita)),
      seasons: agent.askingSeasons,
      // Il posto da titolare lo promette solo chi ne ha davvero bisogno.
      guaranteedStarter: agent.overall >= club.elevenAverage + 1,
      captain: false,
      ambitionTarget: club.prestige >= 4 ? 3 : club.prestige >= 3 ? 7 : 12,
    });
  }

  return bids;
}

/* -------------------------------------------------------------------------- */
/* L'interesse, dichiarato prima di trattare                                   */
/* -------------------------------------------------------------------------- */

/**
 * **Quanto gli interessa venire da noi, detto prima di aprire il tavolo.**
 *
 * ⚠️ Scelta dell'utente dopo la segnalazione *"mercato svincolati ancora totalmente inutile"*:
 * non basta ritarare i numeri, bisogna **vedere** con chi vale la pena provarci. Prima l'esito si
 * scopriva solo dopo aver presentato un'offerta, quindi ogni tentativo era al buio e una vetrina
 * da centinaia di nomi diventava una lotteria.
 *
 * Si calcola con **gli stessi pesi** di `freeAgentBidScore`, valutati su un'offerta di
 * riferimento — la sua richiesta piena, senza garanzie. Non è quindi un secondo modello che può
 * divergere dal primo: è il primo, interrogato prima.
 */
export interface FreeAgentInterest {
  /** 0 = non se ne parla, 4 = verrebbe subito. */
  level: 0 | 1 | 2 | 3 | 4;
  /** Su cosa si gioca la trattativa: è il consiglio pratico. */
  lever: "soldi" | "campo" | "ambizione" | "progetto";
  /** Cosa direbbe il suo agente, in una riga. */
  text: string;
}

export function freeAgentInterest(
  agent: FreeAgent,
  club: { prestige: number; ambitionTarget?: number; clubId?: string; clubName?: string },
): FreeAgentInterest {
  const riferimento: FreeAgentBid = {
    clubId: club.clubId ?? "mio",
    clubName: club.clubName ?? "il club",
    prestige: club.prestige,
    wage: agent.askingWage,
    seasons: agent.askingSeasons,
    guaranteedStarter: false,
    captain: false,
    ambitionTarget: club.ambitionTarget,
  };

  // Il veto viene prima anche qui: se il progetto non lo riguarda, non c'è punteggio che tenga.
  if (!wouldConsider(agent, riferimento)) {
    return {
      level: 0,
      lever: "progetto",
      text: "Non è il progetto che cerca: non verrebbe nemmeno pagandolo.",
    };
  }

  const punteggio = freeAgentBidScore(agent, riferimento);
  const level: FreeAgentInterest["level"] =
    punteggio >= 82 ? 4 : punteggio >= 68 ? 3 : punteggio >= 54 ? 2 : punteggio >= 40 ? 1 : 0;

  /**
   * **Su cosa si gioca**: si prova a migliorare un asse alla volta e si guarda quale sposta di
   * più il punteggio. È il modo onesto di dirlo — la leva è quella che *nel modello* pesa di
   * più per lui, non una frase generica sulla sua personalità.
   */
  const conCampo = freeAgentBidScore(agent, { ...riferimento, guaranteedStarter: true });
  const conSoldi = freeAgentBidScore(agent, { ...riferimento, wage: agent.askingWage * 1.3 });
  const conRuolo = freeAgentBidScore(agent, { ...riferimento, captain: true });
  const guadagni: [FreeAgentInterest["lever"], number][] = [
    ["campo", conCampo - punteggio],
    ["soldi", conSoldi - punteggio],
    ["ambizione", conRuolo - punteggio],
  ];
  guadagni.sort((a, b) => b[1] - a[1]);
  const lever = guadagni[0]![0];

  const frasi: Record<FreeAgentInterest["lever"], string[]> = {
    campo: [
      "Vuole giocare: garantitegli il posto e il resto conta poco.",
      "Il campo prima di tutto: senza garanzie non si muove.",
    ],
    soldi: [
      "Guarda la cifra: su quella si convince, sul resto meno.",
      "È l'ingaggio a decidere: alzate quello e ci siamo.",
    ],
    ambizione: [
      "Cerca un posto dove contare: dategli un ruolo e vi ascolta.",
      "Vuole sentirsi importante, più che ricco.",
    ],
    progetto: ["Il progetto non lo convince."],
  };
  const opzioni = frasi[lever];
  const frase = opzioni[agent.id.length % opzioni.length]!;

  const apertura =
    level >= 4
      ? "Verrebbe volentieri."
      : level === 3
        ? "Ci pensa seriamente."
        : level === 2
          ? "Ascolta, ma senza entusiasmo."
          : level === 1
            ? "Freddo: servirà molto per convincerlo."
            : "Non è interessato.";

  return { level, lever, text: `${apertura} ${frase}` };
}
