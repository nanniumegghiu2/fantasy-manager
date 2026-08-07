/**
 * Scarica **tutte** le righe di una query Supabase, pagina per pagina.
 *
 * Perché serve: PostgREST (quindi Supabase) applica un tetto di sicurezza al numero di righe
 * restituite — di default **1000** — e lo fa **in silenzio**: nessun errore, nessun avviso,
 * semplicemente arrivano meno dati. Con 2.586 giocatori in `player_pool` il client ne
 * riceveva 1000, cioè circa il 39%: nel gioco ogni club sembrava avere 8-11 giocatori invece
 * di 21-27, e il draft pescava da un pool mutilato senza che nulla lo segnalasse.
 *
 * L'ordinamento esplicito non è un dettaglio estetico: senza un ordine stabile le pagine
 * possono sovrapporsi o saltare righe, quindi chi chiama deve passare un `.order()` su una
 * colonna univoca.
 */
const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    // Una pagina non piena significa che i dati sono finiti: è l'unico segnale affidabile,
    // perché il tetto del server non viene comunicato in alcun modo.
    if (rows.length < PAGE_SIZE) return all;
  }
}
