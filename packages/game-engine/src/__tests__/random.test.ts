import { describe, expect, it } from "vitest";
import { createCareerSeed, derivedRandom, hashSeed, mulberry32, shuffle } from "../random";

describe("mulberry32", () => {
  it("produce sempre la stessa sequenza per lo stesso seme", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  /**
   * Valori congelati: cambiare l'algoritmo invaliderebbe ogni salvataggio di carriera in
   * corso e la calibrazione del motore. Se questo test fallisce, la modifica va annullata.
   */
  it("i primi valori sono congelati", () => {
    const random = mulberry32(20260730);
    const first = [random(), random(), random()].map((n) => Number(n.toFixed(9)));
    expect(first).toEqual([0.395243825, 0.110824016, 0.921033583]);
  });

  /**
   * Fino a ora ogni file di test si portava dietro la propria copia di mulberry32, scritta
   * con `| 0` invece di `>>> 0`. Le due formulazioni sembrano diverse ma producono la stessa
   * sequenza (verificato su 14.000 valori e 7 semi, inclusi quelli che vanno in overflow):
   * questo test lo fissa, così sostituire le copie con questa funzione resta sicuro.
   */
  it("coincide con la copia storica usata negli altri test", () => {
    const storica = (seed: number) =>
      function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    for (const seed of [0, 1, 42, 20260730, 2147483647, 4000000000]) {
      const nuovo = mulberry32(seed);
      const vecchio = storica(seed);
      expect(Array.from({ length: 200 }, nuovo)).toEqual(Array.from({ length: 200 }, vecchio));
    }
  });

  it("resta nell'intervallo [0, 1)", () => {
    const random = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("hashSeed", () => {
  it("è stabile e sensibile all'ordine", () => {
    expect(hashSeed("a", 1)).toBe(hashSeed("a", 1));
    expect(hashSeed("a", 1)).not.toBe(hashSeed(1, "a"));
  });

  it("non confonde parti diverse che concatenate darebbero la stessa stringa", () => {
    // Senza separatore ("ab"+"c" === "a"+"bc") due unità di simulazione distinte
    // condividerebbero la sequenza casuale.
    expect(hashSeed("ab", "c")).not.toBe(hashSeed("a", "bc"));
  });
});

describe("derivedRandom", () => {
  it("unità di simulazione diverse ricevono sequenze diverse", () => {
    const seed = "9f3a1c02";
    const giornata = derivedRandom(seed, "md", "serie-a", 1, 5);
    const coppa = derivedRandom(seed, "cup", 1, 5);
    expect(giornata()).not.toBe(coppa());
  });

  it("la stessa unità è riproducibile: è ciò che permette di riprendere una carriera salvata", () => {
    const seed = "9f3a1c02";
    const prima = derivedRandom(seed, "md", "serie-a", 3, 12);
    const dopo = derivedRandom(seed, "md", "serie-a", 3, 12);
    expect(Array.from({ length: 5 }, prima)).toEqual(Array.from({ length: 5 }, dopo));
  });

  it("la stagione fa parte delle coordinate: il calendario cambia ogni anno", () => {
    const seed = "9f3a1c02";
    const stagione1 = derivedRandom(seed, "league", "serie-a", 1);
    const stagione2 = derivedRandom(seed, "league", "serie-a", 2);
    expect(Array.from({ length: 5 }, stagione1)).not.toEqual(Array.from({ length: 5 }, stagione2));
  });

  it("carriere diverse hanno mondi diversi", () => {
    const a = derivedRandom("aaaaaaaa", "league", "serie-a", 1);
    const b = derivedRandom("bbbbbbbb", "league", "serie-a", 1);
    expect(a()).not.toBe(b());
  });
});

describe("shuffle", () => {
  it("non modifica l'array ricevuto e ne conserva gli elementi", () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = shuffle(original, mulberry32(3));
    expect(original).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...result].sort((x, y) => x - y)).toEqual(original);
  });

  it("è riproducibile con lo stesso seme", () => {
    expect(shuffle([1, 2, 3, 4, 5], mulberry32(9))).toEqual(shuffle([1, 2, 3, 4, 5], mulberry32(9)));
  });
});

describe("createCareerSeed", () => {
  it("produce un seme esadecimale a 8 caratteri", () => {
    expect(createCareerSeed(mulberry32(1))).toMatch(/^[0-9a-f]{8}$/);
  });
});
