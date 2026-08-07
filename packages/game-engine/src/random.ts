/**
 * Casualità riproducibile del motore.
 *
 * Tutte le funzioni di simulazione accettano un `random: () => number` iniettabile invece di
 * usare `Math.random`, così un test può fissare il seed e ottenere sempre lo stesso risultato.
 * Finora ogni file di test si portava dietro la sua copia di `mulberry32`; qui c'è l'unica.
 *
 * **Semi derivati** (`derivedRandom`) è il pezzo che rende possibile la DS mode. Una carriera
 * dura 10 stagioni e va salvata e ripresa a metà: se il generatore avesse uno stato interno
 * bisognerebbe serializzarlo, e ogni piccola modifica al motore lo renderebbe incompatibile
 * coi salvataggi esistenti. Invece si salva **solo il seme della carriera**, e ogni unità di
 * simulazione (una giornata, un sorteggio, una finestra di mercato) si ricava il proprio
 * generatore da quel seme più le sue coordinate. Riprendere una carriera dalla settimana 21
 * produce esattamente ciò che si sarebbe ottenuto senza mai interromperla, e due unità
 * diverse non si influenzano a vicenda.
 */

/**
 * Generatore mulberry32: veloce, deterministico e con qualità più che sufficiente per una
 * simulazione di gioco. **Non va cambiato**: cambiarlo invaliderebbe ogni salvataggio in
 * corso e la calibrazione del motore. Un test ne congela i primi valori.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Trasforma una lista di coordinate in un seme a 32 bit (FNV-1a).
 *
 * Le parti sono separate da un carattere che non compare negli uuid né nei numeri, altrimenti
 * `("ab", "c")` e `("a", "bc")` darebbero lo stesso seme — e due unità di simulazione diverse
 * finirebbero per produrre la stessa sequenza.
 */
export function hashSeed(...parts: (string | number)[]): number {
  const text = parts.join("");
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Il generatore di una specifica unità di simulazione, ricavato dal seme della carriera.
 *
 * Esempi d'uso previsti:
 * - calendario di un campionato: `derivedRandom(seed, "league", leagueId, season)`
 * - una giornata:                `derivedRandom(seed, "md", leagueId, season, round)`
 * - un turno di coppa:           `derivedRandom(seed, "cup", season, round)`
 * - una finestra di mercato:     `derivedRandom(seed, "market", season, window)`
 * - gli infortuni di una settimana: `derivedRandom(seed, "inj", season, week)`
 *
 * Includere sempre la stagione è ciò che garantisce, fra l'altro, che il calendario sia
 * **diverso a ogni stagione** pur restando riproducibile.
 */
export function derivedRandom(careerSeed: string | number, ...parts: (string | number)[]): () => number {
  return mulberry32(hashSeed(careerSeed, ...parts));
}

/** Seme di partenza per una nuova carriera, come stringa breve leggibile nei salvataggi. */
export function createCareerSeed(random: () => number = Math.random): string {
  return Math.floor(random() * 0xffffffff).toString(16).padStart(8, "0");
}

/** Mescolamento di Fisher-Yates con PRNG iniettabile: non modifica l'array ricevuto. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
