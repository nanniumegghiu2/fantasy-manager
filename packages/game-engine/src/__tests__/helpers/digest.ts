/**
 * **Impronta stabile di un oggetto serializzabile**, per confrontare due esecuzioni.
 *
 * `JSON.stringify` da solo non basta: conserva l'ordine di inserimento delle chiavi, quindi due
 * stati identici nel contenuto ma costruiti per strade diverse (`{a, b}` contro `{b, a}`)
 * darebbero stringhe diverse e un test di determinismo fallirebbe **senza che nulla sia
 * divergente davvero**. Qui le chiavi si ordinano prima di scrivere.
 *
 * Vive nei test e non nel motore perché per ora serve solo a dimostrare una proprietà. Quando il
 * multigiocatore avrà bisogno dell'hash di stato alla barriera (piano §3.2), questa funzione è il
 * punto da promuovere — non da riscrivere.
 */
export function digest(value: unknown): string {
  return JSON.stringify(value, (_key, raw: unknown) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).sort(([a], [b]) =>
          a < b ? -1 : a > b ? 1 : 0,
        ),
      );
    }
    return raw;
  });
}

/**
 * Dove due impronte divergono, in forma leggibile.
 *
 * Un `expect(a).toBe(b)` su due stringhe da decine di migliaia di caratteri produce un messaggio
 * inutilizzabile: serve sapere **a quale carattere** si separano e cosa c'è intorno, altrimenti
 * un fallimento di questo test costa un'ora di ricerca a occhio.
 */
export function firstDifference(a: string, b: string): string {
  if (a === b) return "";
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const da = i - 60 < 0 ? 0 : i - 60;
  return [
    `divergenza al carattere ${i}`,
    `  A: …${a.slice(da, i + 60)}`,
    `  B: …${b.slice(da, i + 60)}`,
  ].join("\n");
}
