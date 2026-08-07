import { connectDb } from "./db";

/**
 * AD/AS sono stati eliminati come ruoli distinti (CLAUDE.md sez. 3.1, Decision Log
 * 2026-07-27): la linea attaccanti dello scacchiere è ora un solo ruolo (ATT), usabile
 * fino a 2 volte per modulo. Remappa i giocatori già assegnati a role='AD'/role='AS'
 * (da `remapRolesToBoard.ts`) su role='ATT'. Le due etichette enum 'AD'/'AS' restano
 * definite a livello Postgres (niente `DROP VALUE` in Postgres) ma orfane/inutilizzate,
 * come già successo per MED/TRQ/SP nella migrazione precedente — nessun problema perché
 * il codice TS non le referenzia più.
 */
async function main() {
  const client = await connectDb();
  try {
    const { rowCount } = await client.query(
      `update player_pool set role = 'ATT' where role in ('AD', 'AS')`,
    );
    console.log(`${rowCount} giocatori remappati da AD/AS a ATT`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
