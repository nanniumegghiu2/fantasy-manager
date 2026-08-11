/** Formattazione delle cifre, condivisa da chat, trattative e schede contratto. */

/** `€ 12,5M` sopra il milione, `€ 450k` sotto: leggibile a colpo d'occhio su schermo stretto. */
export function formatEuro(amount: number): string {
  const segno = amount < 0 ? "−" : "";
  const v = Math.abs(amount);
  if (v >= 1_000_000) return `${segno}€ ${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  return `${segno}€ ${Math.round(v / 1_000).toLocaleString("it-IT")}k`;
}

/** Le cifre dei contratti si dicono sempre per anno (regola di prodotto, non solo di stile). */
export function formatWage(annual: number): string {
  return `${formatEuro(annual)}/anno`;
}

/** Il totale di un contratto: è il numero che dà peso alla durata. */
export function formatContractTotal(annual: number, seasons: number): string {
  return `${formatWage(annual)} × ${seasons} ${seasons === 1 ? "anno" : "anni"} = ${formatEuro(annual * seasons)}`;
}
