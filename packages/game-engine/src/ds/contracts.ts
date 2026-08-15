/**
 * **I contratti**: durata in stagioni intere, ingaggio annuo, scadenze, rinnovi.
 *
 * ## Il contratto è derivato, la decisione è salvata
 *
 * Il vincolo che ha guidato tutto il disegno è lo stesso di `aiWorld.ts`: lo stato di 2.586
 * giocatori per dieci stagioni **non si salva** (il salvataggio deve restare sotto i 100 KB,
 * CLAUDE.md § 3.7.10). Un record `{until, wage}` per ciascuno costerebbe da solo più del budget
 * intero. Quindi la scadenza e l'ingaggio si **derivano** da `(seme di carriera, giocatore)`
 * esattamente come già si derivano età, ritiri e regen, e si salva **solo** ciò che qualcuno ha
 * cambiato (`ContractOverrides`): un rinnovo, uno svincolo, una firma.
 *
 * Da questa scelta discende gratis una proprietà che il progetto richiedeva a parte: **ogni
 * carriera è unica**. Il seme è per carriera, quindi *chi* va in scadenza nella stagione 3 cambia
 * da una partita all'altra. Non una lista di nomi estratti a caso: lo stesso mondo reale che si
 * sfalda in un ordine diverso.
 *
 * ## Tutto è annuale
 *
 * Durate in stagioni intere (1-5), cifre sempre per anno. Dove serve il totale si mostrano
 * entrambi (`contractTotalCost`), perché è quello a dare peso alla durata.
 */
import { derivedRandom } from "../random";
import { ageInSeason } from "./aging";

/* -------------------------------------------------------------------------- */
/* Modello                                                                     */
/* -------------------------------------------------------------------------- */

export interface Contract {
  /** Ultima stagione di validità: alla sua fine, se non rinnovato, il giocatore è svincolato. */
  until: number;
  /** Ingaggio **annuo**. */
  wage: number;
  signedSeason: number;
  /** Clausola di rescissione: chi la paga se lo prende senza trattare. */
  releaseClause?: number;
}

export type ContractStatus =
  /** Due o più stagioni residue: tranquillo. */
  | "lungo"
  /** Ultima stagione: rinnova, vendi, o lo perdi a zero. */
  | "in_scadenza"
  /** Ultima stagione e finestra invernale aperta: può già firmare altrove per l'anno prossimo. */
  | "precontratto"
  /** Senza contratto: prendibile a parametro zero. */
  | "svincolato";

/** Ciò che il salvataggio conserva: solo i contratti che qualcuno ha cambiato. */
export interface ContractOverrides {
  [playerId: string]: { until: number; wage: number; signedSeason: number; clause?: number };
}

/** I dati anagrafici minimi che servono a derivare un contratto. */
export interface ContractSubject {
  id: string;
  birthDate?: string | null;
  overall: number;
}

/* -------------------------------------------------------------------------- */
/* Derivazione della durata                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Durata iniziale del contratto, in stagioni, pesata su età e Overall.
 *
 * Placeholder di bilanciamento **dichiarato**, tarato sul bersaglio di sez. 10 del piano: fra il
 * 9% e il 14% del mondo in scadenza ogni stagione. Le fasce non sono arbitrarie:
 *  - i **veterani** firmano corto, quindi sono la maggioranza degli svincolati — realistico e
 *    poco squilibrante, perché un trentaquattrenne a zero non ribalta un campionato;
 *  - i **fuoriclasse nel pieno** firmano lungo: se finissero a zero con facilità, il mercato dei
 *    cartellini smetterebbe di avere senso;
 *  - i **giovani** sono legati: rubarne uno a parametro zero dev'essere raro e memorabile.
 */
export function baseContractLength(age: number, overall: number, random: () => number): number {
  const tiro = random();
  if (age >= 32) return tiro < 0.55 ? 1 : 2;
  if (age >= 29) return tiro < 0.4 ? 2 : 3;
  if (age <= 23) return tiro < 0.35 ? 3 : tiro < 0.75 ? 4 : 5;
  // Fascia centrale 24-28: i migliori sono blindati, la fascia media è dove stanno le occasioni.
  if (overall >= 82) return tiro < 0.45 ? 4 : 5;
  return tiro < 0.3 ? 2 : tiro < 0.7 ? 3 : 4;
}

/**
 * La stagione in cui scade il contratto di un giocatore, se nessuno l'ha mai toccato.
 *
 * Deterministico per `(seme, giocatore)`: ricalcolarlo mille volte dà sempre lo stesso anno, e
 * carriere diverse producono scadenze diverse.
 *
 * `fromSeason` è la stagione in cui quel contratto è cominciato. **Non è un dettaglio**: senza,
 * un giocatore arrivato alla stagione 5 (un acquisto, un regen) riceveva una scadenza calcolata
 * sulla scala della stagione 1, cioè **già scaduta**, e usciva dalla rosa il giorno dopo essere
 * entrato. Difetto trovato da un test sul ciclo di vita, non ipotizzato.
 */
export function contractExpiryOf(subject: ContractSubject, seed: string, fromSeason = 1): number {
  const eta = ageInSeason(subject.birthDate, fromSeason) ?? 26;
  const random = derivedRandom(seed, "contract", subject.id);
  return fromSeason + baseContractLength(eta, subject.overall, random) - 1;
}

/* -------------------------------------------------------------------------- */
/* Ingaggi                                                                     */
/* -------------------------------------------------------------------------- */

/** Ingaggio annuo di un giocatore da 60 di Overall in un club di prestigio medio. */
export const BASE_WAGE = 120_000;
/** Quanti punti di Overall servono per moltiplicare l'ingaggio per `e`. */
export const WAGE_SCALE = 11;

/**
 * Ingaggio annuo derivato da Overall, età e prestigio del club.
 *
 * Esponenziale sull'Overall per la stessa ragione del valore di mercato (`marketValue.ts`): fra
 * un 72 e un 82 non c'è una differenza dell'11%, c'è una differenza di categoria. La taratura
 * mira a un monte ingaggi pari al **40-50% del fatturato** per una rosa vera, che è il rapporto
 * che rende sensato il default della ripartizione (`finances.ts`).
 */
export function baseWageOf(overall: number, age: number, clubPrestige = 3): number {
  const base = BASE_WAGE * Math.exp((overall - 60) / WAGE_SCALE);
  const perPrestigio = 0.8 + clubPrestige * 0.1;
  // Un ragazzo non guadagna come un affermato a parità di Overall; un veterano tiene il suo.
  const perEta = age <= 20 ? 0.6 : age <= 23 ? 0.78 : age >= 33 ? 1.05 : 1;
  return Math.max(60_000, Math.round((base * perPrestigio * perEta) / 10_000) * 10_000);
}

/** Costo complessivo di un contratto: è il numero che dà peso alla durata. */
export function contractTotalCost(wage: number, seasons: number): number {
  return wage * Math.max(1, seasons);
}

/* -------------------------------------------------------------------------- */
/* Il contratto corrente di un giocatore                                       */
/* -------------------------------------------------------------------------- */

export interface ContractContext {
  seed: string;
  season: number;
  /** Stagione in cui il giocatore è arrivato: la scadenza derivata parte da lì. */
  sinceSeason?: number;
  overrides?: ContractOverrides;
  clubPrestige?: number;
  /** Chi è stato svincolato: non ha più contratto, quale che fosse la sua scadenza derivata. */
  released?: readonly string[];
}

/** Il contratto di un giocatore adesso: dall'override se esiste, altrimenti derivato dal seme. */
export function contractOf(subject: ContractSubject, ctx: ContractContext): Contract | null {
  if (ctx.released?.includes(subject.id)) return null;

  const override = ctx.overrides?.[subject.id];
  if (override) {
    return {
      until: override.until,
      wage: override.wage,
      signedSeason: override.signedSeason,
      releaseClause: override.clause,
    };
  }

  const eta = ageInSeason(subject.birthDate, ctx.season) ?? 26;
  return {
    until: contractExpiryOf(subject, ctx.seed, ctx.sinceSeason ?? 1),
    wage: baseWageOf(subject.overall, eta, ctx.clubPrestige ?? 3),
    signedSeason: 1,
  };
}

/** Stagioni ancora coperte, contando quella in corso. Zero = è già libero. */
export function seasonsLeftOf(contract: Contract | null, season: number): number {
  if (!contract) return 0;
  return Math.max(0, contract.until - season + 1);
}

/**
 * In che stato è il contratto adesso.
 *
 * `precontratto` esiste solo nella finestra invernale: è il momento in cui un club altrui può
 * legare a sé un nostro giocatore in scadenza a costo zero per la stagione dopo — la decisione
 * più dura che il sistema contratti porta in dote (venderlo subito o perderlo a giugno).
 */
export function contractStatus(
  contract: Contract | null,
  season: number,
  winterWindowOpen = false,
): ContractStatus {
  const residue = seasonsLeftOf(contract, season);
  if (residue <= 0) return "svincolato";
  if (residue === 1) return winterWindowOpen ? "precontratto" : "in_scadenza";
  return "lungo";
}

/* -------------------------------------------------------------------------- */
/* Rinnovo                                                                     */
/* -------------------------------------------------------------------------- */

/** Il pacchetto che si negozia a un rinnovo: mai una cifra sola. */
export interface RenewalTerms {
  /** Ingaggio annuo richiesto. */
  wage: number;
  /** Durata richiesta, in stagioni. */
  seasons: number;
  /** Clausola richiesta, se il giocatore la pretende (0 = nessuna). */
  clause: number;
  /** Vuole giocare da titolare per firmare? */
  wantsStarter: boolean;
  /** Vuole la fascia? */
  wantsCaptaincy: boolean;
}

export interface RenewalContext {
  age: number;
  overall: number;
  marketValue: number;
  currentWage: number;
  /** Quanto guadagna rispetto ai compagni del suo livello: sotto 1 = sottopagato. */
  wageVsPeers: number;
  /** Rendimento rispetto alle attese, in punti (positivo = sopra). */
  overUnderPerformance: number;
  clubPrestige: number;
  personality: "leader" | "giovane_ambizioso" | "mercenario" | "insofferente" | "professionista";
  playedShare: number;
}

/**
 * Che cosa chiede per rinnovare.
 *
 * La richiesta nasce dai **fatti** (rendimento, quanto è sottopagato, quanto gioca), non da una
 * percentuale fissa: è ciò che rende il rinnovo di chi sta facendo una grande stagione un
 * problema vero e quello di una riserva una formalità.
 */
export function renewalTerms(ctx: RenewalContext): RenewalTerms {
  const equo = baseWageOf(ctx.overall, ctx.age, ctx.clubPrestige);

  let richiesta = Math.max(equo, ctx.currentWage);
  // Chi è sottopagato chiede di essere riportato in linea, e chi rende sopra le attese di più.
  if (ctx.wageVsPeers < 1) richiesta *= 1 + Math.min(0.45, (1 - ctx.wageVsPeers) * 0.9);
  richiesta *= 1 + Math.max(-0.1, Math.min(0.35, ctx.overUnderPerformance / 20));
  if (ctx.personality === "mercenario") richiesta *= 1.18;
  if (ctx.personality === "professionista") richiesta *= 0.95;

  const durata =
    ctx.age >= 33 ? 1 : ctx.age >= 30 ? 2 : ctx.age <= 23 ? (ctx.personality === "giovane_ambizioso" ? 3 : 4) : 3;

  return {
    wage: Math.round(richiesta / 10_000) * 10_000,
    seasons: durata,
    // La clausola la pretende chi ha mercato: è il suo modo di non restare intrappolato.
    clause:
      ctx.overall >= 80 && ctx.age <= 29
        ? Math.round((ctx.marketValue * 1.6) / 500_000) * 500_000
        : 0,
    /**
     * ⚠️ **Il giovane ambizioso non pretende il posto a prescindere.**
     *
     * La clausola `|| personality === "giovane_ambizioso"` lo faceva chiedere *sempre*, anche
     * arrivando dietro a un titolare molto più forte — ed era metà della segnalazione "nove
     * acquisti su dieci vogliono la titolarità". Resta il più esigente dei cinque profili
     * (`playedShare` bassa gli basta meno che agli altri), ma la garanzia la chiede solo se il
     * posto lo prenderebbe davvero: chi lo chiama a fare la riserva in una grande lo sa, e lui
     * pure.
     */
    wantsStarter: ctx.playedShare >= (ctx.personality === "giovane_ambizioso" ? 0.45 : 0.5),
    wantsCaptaincy: ctx.personality === "leader" && ctx.age >= 28,
  };
}

/**
 * Quanto è generosa un'offerta rispetto a ciò che chiede, come punteggio 0-100.
 *
 * Pesato per **personalità**: al `mercenario` interessa la cifra, al `giovane_ambizioso` i
 * minuti, al `leader` il ruolo. È la ragione per cui la stessa offerta convince uno e offende un
 * altro — e per cui la personalità smette di essere decorativa e diventa un'informazione che il
 * DS deve leggere prima di sedersi al tavolo.
 */
export function renewalOfferScore(
  offer: { wage: number; seasons: number; clause: number; starter: boolean; captain: boolean },
  terms: RenewalTerms,
  personality: RenewalContext["personality"],
): number {
  const pesi: Record<RenewalContext["personality"], { soldi: number; durata: number; campo: number; ruolo: number }> = {
    mercenario: { soldi: 0.62, durata: 0.18, campo: 0.12, ruolo: 0.08 },
    giovane_ambizioso: { soldi: 0.28, durata: 0.17, campo: 0.45, ruolo: 0.1 },
    leader: { soldi: 0.3, durata: 0.2, campo: 0.2, ruolo: 0.3 },
    insofferente: { soldi: 0.4, durata: 0.15, campo: 0.3, ruolo: 0.15 },
    professionista: { soldi: 0.4, durata: 0.3, campo: 0.2, ruolo: 0.1 },
  };
  const p = pesi[personality];

  const soldi = Math.min(1.25, offer.wage / Math.max(1, terms.wage));
  const durata = 1 - Math.min(1, Math.abs(offer.seasons - terms.seasons) / 3);
  const campo = terms.wantsStarter ? (offer.starter ? 1 : 0.25) : 1;
  const ruolo = terms.wantsCaptaincy ? (offer.captain ? 1 : 0.4) : 1;

  const grezzo = p.soldi * soldi + p.durata * durata + p.campo * campo + p.ruolo * ruolo;
  return Math.round(Math.max(0, Math.min(1, grezzo)) * 100);
}

/** Sopra questo punteggio il giocatore firma. Sotto, resta al tavolo o si alza. */
export const RENEWAL_ACCEPT_SCORE = 78;
