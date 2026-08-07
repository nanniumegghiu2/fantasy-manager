import { connectDb } from "./db";
import { EDITORIAL_PREMIER } from "../seeds/editorial-overalls-premier";
import { EDITORIAL_LIGA } from "../seeds/editorial-overalls-liga";
import { EDITORIAL_BUNDESLIGA } from "../seeds/editorial-overalls-bundesliga";
import { EDITORIAL_LIGUE1 } from "../seeds/editorial-overalls-ligue1";

/**
 * Applica gli Overall editoriali ai campionati importati da foglio, sostituendo la base da
 * contesto (`computeContextPrior`) che dava lo stesso valore a tutti i compagni di squadra.
 *
 * Due trattamenti diversi, di proposito:
 *
 * 1. **Giocatori valutati** (`seeds/editorial-overalls-*.ts`): prendono il valore scritto.
 * 2. **Tutti gli altri** — in gran parte ragazzi delle giovanili che nel campionato non
 *    giocano — prendono un valore da **fondo rosa** ricavato dal tier del club. Non è
 *    pigrizia: valutarli uno per uno sarebbe finta precisione su giocatori di cui non si sa
 *    nulla, e lasciarli al prior da contesto li avrebbe tenuti sopra i titolari della Serie
 *    A. Il tetto per tier li mette sotto la soglia dei titolari, quindi restano pescabili ma
 *    non sono mai una scelta forte.
 *
 * Uso: `pnpm apply-editorial-big5` (dry run) oppure `-- --apply`.
 */

/** Tetto per chi non ha una valutazione individuale, per tier di prestigio del club. */
const DEPTH_CAP_BY_TIER: Record<number, number> = { 5: 74, 4: 72, 3: 70, 2: 68, 1: 66 };

/** Campionati coperti finora dalla valutazione editoriale, con la rispettiva mappa. */
const EDITORIAL_BY_LEAGUE: Record<string, Record<string, number>> = {
  "Premier League": EDITORIAL_PREMIER,
  "La Liga": EDITORIAL_LIGA,
  Bundesliga: EDITORIAL_BUNDESLIGA,
  "Ligue 1": EDITORIAL_LIGUE1,
};

/**
 * I nomi del foglio sorgente non sono normalizzati Unicode in modo uniforme: alcuni accenti
 * sono un carattere precomposto (`í` = U+00ED), altri una lettera più un accento combinante
 * (`i` + U+0301). Le due forme sono indistinguibili a schermo ma diverse come stringhe, e
 * facevano fallire il match di chiavi corrette (es. "Olympique Lyonnais|Alejandro Rodríguez").
 * Confrontiamo quindi sempre in NFC.
 */
const normalizeKey = (key: string) => key.normalize("NFC");

async function main() {
  const apply = process.argv.includes("--apply");
  const client = await connectDb();

  const leagues = Object.keys(EDITORIAL_BY_LEAGUE);
  const { rows: players } = await client.query<{
    id: string;
    name: string;
    club: string;
    league: string;
    tier: number;
    overall: number;
  }>(
    `select p.id, p.name, c.name as club, l.name as league, c.prestige_tier as tier, p.overall
     from player_pool p
     join clubs c on c.id = p.club_id
     join leagues l on l.id = c.league_id
     where l.name = any($1)`,
    [leagues],
  );

  let rated = 0;
  let depth = 0;
  const unusedKeys = new Set(
    Object.values(EDITORIAL_BY_LEAGUE).flatMap((map) => Object.keys(map).map(normalizeKey)),
  );
  /** Le mappe editoriali indicizzate per chiave normalizzata (vedi `normalizeKey`). */
  const normalizedMaps = new Map(
    Object.entries(EDITORIAL_BY_LEAGUE).map(([league, map]) => [
      league,
      new Map(Object.entries(map).map(([key, value]) => [normalizeKey(key), value])),
    ]),
  );

  for (const player of players) {
    const key = normalizeKey(`${player.club}|${player.name}`);
    const map = normalizedMaps.get(player.league);
    if (!map) continue;

    const editorial = map.get(key);
    let value: number;
    if (editorial != null) {
      value = editorial;
      rated++;
      unusedKeys.delete(key);
    } else {
      value = DEPTH_CAP_BY_TIER[player.tier] ?? 68;
      depth++;
    }

    if (apply) {
      await client.query(
        `update player_pool set overall_override = $1, overall = $1 where id = $2`,
        [value, player.id],
      );
    }
  }

  await client.end();

  console.log(`Giocatori nei campionati coperti: ${players.length}`);
  console.log(`Con valutazione individuale:      ${rated}`);
  console.log(`Con valore da fondo rosa:         ${depth}`);
  if (unusedKeys.size) {
    console.log(`\nChiavi del seed senza corrispondenza (${unusedKeys.size}) — nome sbagliato?`);
    for (const key of [...unusedKeys].slice(0, 25)) console.log("  " + key);
  }
  if (!apply) console.log("\n(dry run — rilancia con --apply per scrivere)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
