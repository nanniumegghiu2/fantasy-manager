/**
 * Tipi condivisi della **DS Mode** (Direttore Sportivo).
 *
 * Questo file è la fondazione comune su cui poggiano tutti i moduli `ds/*`: rosa, undici,
 * affiatamento, ciclo di vita, mercato, eventi. Sta a sé proprio perché più moduli — scritti
 * anche in parallelo — devono parlare la stessa lingua: se ognuno si inventasse la propria
 * `RosterEntry` il riduttore `advanceWeek` non riuscirebbe a metterli insieme.
 *
 * Principio di fondo del salvataggio: **qui dentro non entrano mai oggetti `Player`**, solo
 * il loro `id` più lo stato che cambia durante la carriera. I dati anagrafici si risolvono a
 * runtime dal pool, così una carriera resta compatta (~60-70 KB dopo 10 stagioni) e non si
 * porta dietro una fotografia stantia del database.
 */
import type { Role } from "@app/shared-types";

/** Numero di stagioni di una carriera. */
export const CAREER_SEASONS = 10;

/** Età a cui un giocatore si ritira a fine stagione. */
export const RETIREMENT_AGE = 34;

/**
 * Da dove viene un giocatore.
 *
 * `reale` = importato dal database (giocatore vero). `regen` = generato dal gioco per
 * rimpiazzare un ritirato: nome inventato, nazionalità e ruolo ereditati. La distinzione va
 * mantenuta perché i due tipi hanno statuti diversi — i vincoli legali di CLAUDE.md sez. 2
 * riguardano solo i primi — e perché la UI li mostra con un segno distintivo.
 */
export type PlayerOrigin = "reale" | "regen";

/**
 * Un giocatore generato dal gioco. Ha la stessa forma di `Player` più i campi che servono al
 * ciclo di vita; i giocatori reali li ricevono a inizio carriera, dedotti dall'anagrafica.
 */
export interface GeneratedPlayer {
  id: string;
  name: string;
  nation: string;
  role: Role;
  secondaryRoles: Role[];
  /** `YYYY-MM-DD`. Per i regen è coerente con l'età voluta alla nascita del giocatore. */
  birthDate: string;
  overall: number;
  potential: number;
  origin: PlayerOrigin;
  /**
   * Il club in cui questo regen nasce, quando **non** è il nostro.
   *
   * Il rimpiazzo di un proprio ritirato non finisce più garantito nella propria rosa: nasce in
   * un club scelto a caso fra tutti (compreso il proprio), altrimenti comprare un giocatore a
   * fine carriera e aspettarne il ritiro garantirebbe un regen gratis in squadra. Quando
   * l'estrazione esce su un club diverso dal nostro, il regen non entra in `roster` — resta
   * solo qui, taggato con la sua destinazione, cosicché il mondo (derivato dal seme, mai
   * salvato) possa innestarlo nel club giusto quando si ricostruisce.
   */
  destinationClubId?: string;
}

/**
 * La vista **minima** di un giocatore che i moduli di rosa/undici/affiatamento richiedono.
 *
 * Non è un nuovo modello di dati: sia `Player` (giocatore reale risolto dal pool) sia
 * `GeneratedPlayer` (regen) vi sono strutturalmente assegnabili, quindi le funzioni pure
 * accettano indifferentemente gli uni e gli altri senza conversioni. Chiedere qui il tipo
 * completo `Player` obbligherebbe i regen a portarsi dietro campi che non hanno senso per
 * loro (`clubId`, `era`, `marketValue` al momento della nascita).
 */
export interface PlayerRef {
  id: string;
  name: string;
  nation: string;
  role: Role;
  secondaryRoles: Role[];
}

/** Anagrafica risolta a runtime: `playerId` → giocatore. Il salvataggio contiene solo gli id. */
export type PlayerIndex = Record<string, PlayerRef>;

/** Stato di prestito di un giocatore della rosa. */
export interface LoanState {
  /** Club che lo ospita (se è in prestito **da noi** verso un'altra squadra). */
  hostClubId?: string;
  /** Club proprietario (se è in prestito **a noi**). */
  ownerClubId?: string;
  /**
   * Ultima stagione del prestito: a fine di **questa** stagione il giocatore rientra.
   *
   * Un prestito aperto nella finestra invernale della stagione 3 vale `3` esattamente come uno
   * aperto in estate: la durata è "fino a fine stagione", non dodici mesi.
   */
  untilSeason: number;
  /**
   * Minuti che il giocatore accumulerà al club ospitante.
   *
   * Si stimano all'apertura (`estimateLoanMinutes`) e si accreditano al rientro, perché i
   * campionati altrui girano in modalità "solo risultato" e non producono minuti individuali.
   * Senza questo campo il prestito **non farebbe crescere nessuno**, che è tutto il suo scopo.
   */
  expectedMinutes?: number;
}

/**
 * Statistiche stagionali di un giocatore. I **minuti** non sono un dettaglio: sono
 * l'ingrediente che alimenta la crescita (`applySeasonAdjustment` scala lo scostamento sui
 * minuti giocati), ed è ciò che rende sensato dare campo a un giovane invece di parcheggiarlo.
 */
export interface SeasonStats {
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
}

export function emptySeasonStats(): SeasonStats {
  return { appearances: 0, minutes: 0, goals: 0, assists: 0 };
}

/**
 * Un giocatore nella rosa di un club durante la carriera.
 *
 * Contiene **solo** l'id e ciò che evolve: nulla di anagrafico, che si risolve dal pool.
 */
export interface RosterEntry {
  playerId: string;
  /**
   * Overall al momento in cui è entrato in rosa, poi aggiornato dal ciclo di vita.
   *
   * È una *copia*, non un riferimento al database: un ricalcolo massivo degli Overall
   * (`pnpm recompute`, che il progetto esegue dopo ogni inserimento dati) non deve
   * riscrivere in silenzio la squadra di una carriera già iniziata.
   */
  overall: number;
  /** Tetto di crescita, nascosto all'utente (nello scouting si mostra al più come fascia). */
  potential: number;
  /** Stagione in cui è arrivato al club: base della continuità, cioè dell'affiatamento. */
  sinceSeason: number;
  /** 0-100. Sotto la soglia il giocatore chiede la cessione. */
  morale: number;
  /** Giornate di indisponibilità rimanenti; 0 = disponibile. */
  injuryMatchdaysLeft: number;
  /** 0-100. Cresce giocando e rende sensato ruotare la rosa. */
  fatigue: number;
  stats: SeasonStats;
  /** Statistiche della stagione precedente per il mercato estivo. */
  lastSeasonStats?: SeasonStats;
  loan?: LoanState;
}

/** L'undici schierato: casella del modulo → id del giocatore. */
export interface Lineup {
  starters: Record<string, string>;
  bench: string[];
  /** Caselle coperte fuori ruolo: la UI le segnala, il motore le penalizza. */
  outOfPosition: string[];
}

/** Un allenatore: modulo preferito e stile, entrambi inventati da noi. */
export interface Coach {
  id: string;
  name: string;
  nation: string;
  formationId: string;
  /** Sposta i due lati della squadra, in punti di Overall. */
  style: { attack: number; defence: number };
  /** Quanto è bravo a far crescere i giovani: moltiplica il margine di crescita. */
  development: number;
  /** Costo dell'ingaggio e buonuscita in caso di esonero. */
  hireCost: number;
  severance: number;
  /**
   * Levatura dell'allenatore, 1-5, stessa scala di `clubs.prestige_tier`.
   *
   * Non è un attributo che agisce sulla simulazione (lì contano stile e `development`): serve
   * a decidere **chi è disposto ad allenarti**. Senza, un club di bassa classifica vedrebbe
   * nella lista lo stesso allenatore da 8 milioni del club di vertice e la scelta sarebbe
   * finta, perché non potrebbe permetterselo comunque.
   */
  reputation: number;
  /** Club di default guidato a inizio carriera (se presente). */
  defaultClubId?: string;
  /** `true` se il mister è attualmente senza panchina. */
  isFreeAgent?: boolean;
  /** Club attualmente allenato durante il mondo vivo. */
  currentClubId?: string | null;
  /** Filosofia tattica descrittiva (es. "Gegenpressing", "3-5-2 Spettacolo", "Calcio Posizionale"). */
  tacticalPhilosophy?: string;
}

/** Le 9 tipologie di promesse di mercato che l'allenatore può pretendere durante la trattativa. */
export type CoachPromiseKind =
  | "top_player"
  | "formation_fit"
  | "youth_prospect"
  | "veteran_leadership"
  | "trim_squad"
  | "key_player_retention"
  | "depth_backup"
  | "domestic_core"
  /**
   * Non spendere tutto il budget in un colpo solo: tienine un margine per la finestra di
   * riparazione o un imprevisto. **Non** è sui contratti/ingaggi dei giocatori — non esistono
   * nel gioco (CLAUDE.md §3.7.5/3.7.13): l'unico stipendio realmente modellato è quello del
   * mister stesso (`hireCost`/`boost_salary`, tutt'altra cosa). Si chiamava `salary_guarantee`
   * e descriveva "i rinnovi chiave dei titolari" — un sistema di contratti giocatore che il
   * gioco non ha mai avuto, segnalato dall'utente come incoerente.
   */
  | "budget_discipline"
  /**
   * Speculare a `key_player_retention`: il mister vuole **fuori** un giocatore preciso, non
   * dentro il sistema di gioco (`targetPlayerId`). Soddisfatta quando non è più in rosa.
   */
  | "sell_misfit";

export interface SessionDeal {
  playerId: string;
  playerName: string;
  kind: "acquisto" | "cessione" | "prestito";
  amount: number;
}

/** Una promessa vincolante contratta col mister prima della firma. */
export interface CoachPromise {
  id: string;
  kind: CoachPromiseKind;
  description: string;
  targetValue?: number | string;
  targetRole?: Role;
  targetPlayerId?: string;
  targetPlayerName?: string;
  fulfilled?: boolean;
  seasonAccepted: number;
  priority?: "imprescindibile" | "negoziabile" | "flessibile";
  rejectedOffer?: boolean;
  salaryBonusDemanded?: number;
  /**
   * Entro quale stagione va verificata. Default implicito: `seasonAccepted` (la finestra
   * corrente, comportamento di sempre). La mediazione "rimanda" (`proposePromiseCompromise`,
   * azione `delay`) la sposta di una stagione invece di forzare un pagamento o un rifiuto.
   */
  deadlineSeason?: number;
}

/** Le competizioni di una stagione. */
export type CompetitionKind = "campionato" | "corona";

/** Fase in cui si trova la carriera: decide cosa può fare l'utente. */
export type CareerPhase =
  | "scelta_club"
  | "scelta_allenatore"
  | "mercato_estivo"
  | "stagione"
  | "mercato_riparazione"
  | "fine_stagione"
  | "conclusa";

/** Motivo per cui una carriera è finita. */
export type CareerEnding = "completata" | "retrocessione" | "abbandono";

/**
 * Personalità del calciatore (archetipo): governa l'atteggiamento visivo e la reazione
 * alle varie mosse del Direttore Sportivo nelle chat e trattative.
 */
export type PlayerPersonality = "leader" | "giovane_ambizioso" | "mercenario" | "insofferente" | "professionista";

/** Deriva in modo deterministico l'archetipo di personalità di un calciatore dai suoi dati reali. */
export function derivePlayerPersonality(
  playerId: string,
  age: number,
  overall: number,
  sinceSeason: number,
  currentSeason: number,
): PlayerPersonality {
  const yearsAtClub = Math.max(0, currentSeason - sinceSeason);

  // Veterano con alta presenza nel club o Overall elevato -> Leader
  if (age >= 28 && (yearsAtClub >= 3 || overall >= 83)) {
    return "leader";
  }
  // Giovane promettente under 24 -> Giovane Ambizioso
  if (age <= 24) {
    return "giovane_ambizioso";
  }
  // Algoritmo derivato dal seed dell'id per i restanti profili
  const hash = playerId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const mod = hash % 3;
  if (mod === 0) return "mercenario";
  if (mod === 1) return "insofferente";
  return "professionista";
}

