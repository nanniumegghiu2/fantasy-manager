import { connectDb } from "./db";
import { EDITORIAL_OVERALLS } from "../seeds/editorial-overalls-serie-a";

/**
 * Scrive gli Overall editoriali della Serie A (`seeds/editorial-overalls-serie-a.ts`).
 *
 * Va a finire in **`overall_override`**, non in `overall`: la colonna override esiste
 * proprio per marcare i valori che sono una nostra stima dichiarata invece che il risultato
 * dell'algoritmo (sez. 2.2), e `computeOverallRatings`/`recompute` la rispettano. Così
 * restano distinguibili, e un ricalcolo futuro non li sovrascrive per sbaglio.
 *
 * `overall` viene allineato nello stesso passaggio perché è la colonna che il gioco legge.
 *
 * Uso: `pnpm apply-editorial` (dry run) oppure `pnpm apply-editorial -- --apply`.
 * Dopo l'applicazione conviene lanciare `pnpm recompute` per aggiornare i valori di mercato.
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const client = await connectDb();

  const { rows: players } = await client.query<{
    id: string;
    name: string;
    club: string;
    overall: number;
  }>(`select p.id, p.name, c.name as club, p.overall
      from player_pool p
      join clubs c on c.id = p.club_id
      join leagues l on l.id = c.league_id
      where l.name = 'Serie A'`);

  const seen = new Set<string>();
  let updated = 0;
  const missing: string[] = [];

  for (const player of players) {
    const key = `${player.club}|${player.name}`;
    const value = EDITORIAL_OVERALLS[key];
    if (value == null) {
      missing.push(key);
      continue;
    }
    seen.add(key);
    if (apply) {
      await client.query(
        `update player_pool set overall_override = $1, overall = $1 where id = $2`,
        [value, player.id],
      );
    }
    updated++;
  }

  const unusedKeys = Object.keys(EDITORIAL_OVERALLS).filter((k) => !seen.has(k));

  await client.end();

  console.log(`Giocatori Serie A nel database: ${players.length}`);
  console.log(`Con Overall editoriale:        ${updated}`);
  console.log(`Senza corrispondenza:          ${missing.length}`);
  if (missing.length) console.log("  " + missing.slice(0, 20).join("\n  "));
  console.log(`Chiavi del seed non usate:     ${unusedKeys.length}`);
  if (unusedKeys.length) console.log("  " + unusedKeys.slice(0, 20).join("\n  "));
  if (!apply) console.log("\n(dry run — rilancia con --apply per scrivere)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
