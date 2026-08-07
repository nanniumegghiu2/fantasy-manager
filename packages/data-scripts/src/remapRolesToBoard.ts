import { connectDb } from "./db";

/**
 * Distribuisce i giocatori di ciascun reparto sui ruoli dello scacchiere tattico
 * (CLAUDE.md sez. 3.1), a rotazione: serve quando un blocco di giocatori ha solo il
 * reparto (o un ruolo troppo generico) e nessun ruolo puntuale. Stima editoriale di
 * partenza, non il ruolo reale verificato di ogni giocatore — rifinibile via pannello admin.
 *
 * Nota: i ruoli centrali sono UNO solo per linea (DC, MED, CC, TRQ, ATT) — le caselle
 * multiple della stessa linea condividono lo stesso ruolo. Qui compaiono una volta sola,
 * ma pesano di più nella rotazione perché in campo ci sono più caselle da riempire.
 */
const NEW_ROLES_BY_DEPARTMENT: Record<string, string[]> = {
  POR: ["POR"],
  DIF: ["TD", "DC", "DC", "DC", "TS", "QD", "QS"],
  CC: ["MED", "MED", "ED", "CC", "CC", "CC", "ES", "TQD", "TRQ", "TRQ", "TQS"],
  ATT: ["ATT"],
};

async function main() {
  const client = await connectDb();
  try {
    for (const [department, roles] of Object.entries(NEW_ROLES_BY_DEPARTMENT)) {
      const { rows } = await client.query<{ id: string }>(
        `select id from player_pool where department = $1 order by club_id, id`,
        [department],
      );
      for (let i = 0; i < rows.length; i++) {
        const role = roles[i % roles.length];
        await client.query(`update player_pool set role = $1 where id = $2`, [role, rows[i].id]);
      }
      console.log(`${department}: ${rows.length} giocatori remappati su ${roles.join("/")}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
