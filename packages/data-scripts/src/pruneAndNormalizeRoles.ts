import { connectDb } from "./db";

/**
 * Due manutenzioni sul pool, decise dall'utente e da eseguire insieme perché la seconda
 * rende possibile la prima:
 *
 * 1. **Rimuove i giocatori sotto Overall 65.** Sono primavera, terzi portieri e fondo rosa
 *    che allungavano le liste del draft senza mai essere una scelta sensata. Restano ~472
 *    giocatori, con le rose più corte a 21 — ampiamente sufficienti per un draft da 11.
 *
 * 2. **Ogni terzino sa fare il quinto**: `TD` guadagna `QD` tra i ruoli secondari e `TS`
 *    guadagna `QS`. Senza questo il punto 1 romperebbe il gioco: **tutti** i giocatori con
 *    Quinto come ruolo primario stanno sotto 65 (7 QD e 3 QS, tutti primavera), quindi
 *    dopo la cancellazione nessuno potrebbe più occupare quelle caselle e i moduli a tre
 *    difensori — 3-5-2, 3-4-3, 3-4-2-1 — diventerebbero impossibili da riempire.
 *    Tatticamente è corretto: nel calcio reale un terzino gioca da quinto quando la squadra
 *    passa a tre dietro. Entra come **secondario**, quindi col malus di sez. 3.1.
 *
 * Idempotente: rilanciarlo non cambia nulla. `pnpm prune-roles` per il dry run,
 * `pnpm prune-roles -- --apply` per scrivere.
 */
const MIN_OVERALL = 65;

async function main() {
  const apply = process.argv.includes("--apply");
  const client = await connectDb();

  const { rows: before } = await client.query<{ totale: number; sotto: number }>(
    `select count(*)::int totale, count(*) filter (where overall < $1)::int sotto from player_pool`,
    [MIN_OVERALL],
  );
  console.log(`Giocatori: ${before[0].totale} — sotto ${MIN_OVERALL}: ${before[0].sotto}`);

  if (apply) {
    await client.query(`delete from player_pool where overall < $1`, [MIN_OVERALL]);
  }

  // `array_append` solo dove il ruolo gemello non c'è già: rilanciare non duplica nulla.
  const rule = `
    update player_pool
    set secondary_roles = array_append(secondary_roles, $2::player_role)
    where role = $1::player_role and not ($2::player_role = any(secondary_roles))`;

  let touched = 0;
  for (const [role, twin] of [
    ["TD", "QD"],
    ["TS", "QS"],
  ] as const) {
    const { rows } = await client.query<{ n: number }>(
      `select count(*)::int n from player_pool
       where role = $1::player_role and not ($2::player_role = any(secondary_roles))
         and ($3 or overall >= $4)`,
      [role, twin, apply, MIN_OVERALL],
    );
    console.log(`${role} senza ${twin} tra i secondari: ${rows[0].n}`);
    if (apply) {
      const res = await client.query(rule, [role, twin]);
      touched += res.rowCount ?? 0;
    }
  }

  const { rows: after } = await client.query<{ n: number }>(
    `select count(*)::int n from player_pool`,
  );
  await client.end();

  console.log(`\nGiocatori rimasti: ${after[0].n}`);
  if (apply) console.log(`Ruoli secondari aggiornati: ${touched}`);
  else console.log("(dry run — rilancia con --apply per scrivere)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
