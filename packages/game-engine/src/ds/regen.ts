/**
 * **Regen**: il ragazzo che prende il posto di chi si ritira.
 *
 * Perché esistono. I ritiri a 34 anni, da soli, svuoterebbero il mondo: si ritira circa il
 * 5-8% del pool a stagione, quindi dopo dieci stagioni mancherebbe metà del database e le
 * rose scenderebbero sotto il minimo di 21 giocatori. Il mercato non può tappare il buco,
 * perché sposta giocatori senza crearne. Il rimpiazzo è quindi **1:1**: a ogni ritiro
 * corrisponde una nascita, e la dimensione del pool si conserva per costruzione — il che
 * rende anche verificabili gli invarianti anti-deriva del mercato.
 *
 * Come sono fatti, e perché così:
 *  - **stessa nazionalità e stesso ruolo** del ritirato, così le rose non si deformano nei
 *    reparti e la composizione dei campionati resta plausibile nel tempo;
 *  - **17-19 anni**: entrano come promesse, non come pronti-uso. Un rimpiazzo già forte
 *    renderebbe indolore perdere un campione, che è l'opposto di ciò che deve succedere;
 *  - **potenziale simile ma variabile**: centrato sul picco storico di chi se ne va, con una
 *    dispersione vera. La maggior parte somiglierà al predecessore, ma ogni tanto nasce un
 *    fenomeno o un flop — è questo che evita la monotonia su dieci stagioni, ed è una
 *    richiesta esplicita dell'utente.
 */
import type { Role } from "@app/shared-types";
import { generateName } from "./names";
import type { GeneratedPlayer } from "./types";

/** Estremi della scala Overall del progetto. */
const MIN_OVERALL = 60;
const MAX_OVERALL = 99;

/** Età alla nascita di un regen. */
export const REGEN_MIN_AGE = 17;
export const REGEN_MAX_AGE = 19;

/**
 * Dispersione del potenziale attorno a quello del ritirato, in punti di Overall.
 *
 * Placeholder di bilanciamento **dichiarato**. Il valore governa direttamente quanto il gioco
 * resta interessante nelle stagioni avanzate: troppo stretto e ogni regen è una fotocopia del
 * predecessore, troppo largo e la qualità dei campionati va alla deriva.
 */
export const POTENTIAL_SPREAD = 7;

/**
 * Estrazione approssimativamente normale in [-1, 1], somma di tre uniformi.
 *
 * Serve una campana e non una uniforme: con una uniforme i "fenomeni" e i "flop" sarebbero
 * frequenti quanto i casi normali, e la dispersione perderebbe significato. Con tre uniformi
 * i valori centrali dominano e gli estremi restano rari, che è il comportamento voluto.
 */
function bellNoise(random: () => number): number {
  return ((random() + random() + random()) / 3 - 0.5) * 2;
}

function clampOverall(value: number): number {
  return Math.min(Math.max(Math.round(value), MIN_OVERALL), MAX_OVERALL);
}

export interface RegenInput {
  /** Chi si è ritirato: da lui si ereditano nazionalità, ruolo e livello di riferimento. */
  retiring: {
    id: string;
    nation: string;
    role: Role;
    secondaryRoles: Role[];
    /** Il valore che il ritirato aveva al suo apice: il metro del rimpiazzo. */
    peakOverall: number;
  };
  /** Tutti i nomi già esistenti nella carriera: garantisce che un nome non si ripeta mai. */
  usedNames: ReadonlySet<string>;
  /** Stagione in cui nasce (serve a calcolarne la data di nascita). */
  season: number;
  /** Anno della prima stagione di carriera, per ancorare le date. */
  firstSeasonYear?: number;
  random: () => number;
}

/**
 * Genera il rimpiazzo di un giocatore che si ritira.
 *
 * L'`id` è derivato da quello del ritirato più la stagione: è stabile e riproducibile, quindi
 * ricaricare un salvataggio non fa "rinascere" un giocatore diverso.
 */
export function createRegen({
  retiring,
  usedNames,
  season,
  firstSeasonYear = 2025,
  random,
}: RegenInput): GeneratedPlayer {
  const age = REGEN_MIN_AGE + Math.floor(random() * (REGEN_MAX_AGE - REGEN_MIN_AGE + 1));
  const birthYear = firstSeasonYear + season - 1 - age;
  const month = 1 + Math.floor(random() * 12);
  const day = 1 + Math.floor(random() * 28);
  const birthDate = `${birthYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const potential = clampOverall(retiring.peakOverall + bellNoise(random) * POTENTIAL_SPREAD);
  // Un diciassettenne parte molto sotto il proprio tetto: quanto sotto dipende dall'età, così
  // un diciannovenne è già più pronto di un diciassettenne con lo stesso potenziale.
  const gap = 16 - (age - REGEN_MIN_AGE) * 3;
  const overall = clampOverall(Math.min(potential - gap + bellNoise(random) * 2, potential));

  return {
    id: `regen-${retiring.id}-${season}`,
    name: generateName(retiring.nation, usedNames, random),
    nation: retiring.nation,
    role: retiring.role,
    // I ruoli secondari del predecessore non si ereditano: sono il frutto di una carriera,
    // non una caratteristica di nascita. Un giovane arriva con il suo ruolo e basta.
    secondaryRoles: [],
    birthDate,
    overall,
    potential,
    origin: "regen",
  };
}

/**
 * Genera i rimpiazzi per un gruppo di ritirati, tenendo aggiornato l'insieme dei nomi usati.
 *
 * Va chiamata con **tutti** i ritiri della stagione insieme: generarli uno alla volta senza
 * accumulare i nomi appena assegnati permetterebbe due omonimi nati lo stesso anno.
 */
export function createRegenBatch(
  retirees: RegenInput["retiring"][],
  usedNames: ReadonlySet<string>,
  season: number,
  random: () => number,
  firstSeasonYear = 2025,
): GeneratedPlayer[] {
  const used = new Set(usedNames);
  return retirees.map((retiring) => {
    const regen = createRegen({ retiring, usedNames: used, season, firstSeasonYear, random });
    used.add(regen.name);
    return regen;
  });
}
