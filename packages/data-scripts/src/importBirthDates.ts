import xlsx from "xlsx";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb } from "./db";

/**
 * Popola `player_pool.birth_date` dall'anagrafica di `Cartel1.xlsx`, colonna "Data di nascita".
 *
 * Perché serve: la DS mode fa vivere i giocatori nel tempo — crescita fino al picco 24-28,
 * declino, ritiro a 34 — e senza l'età nessuna di quelle regole ha un ingrediente su cui
 * lavorare. La data di nascita è un **fatto** anagrafico, quindi utilizzabile (CLAUDE.md
 * sez. 2.1); le colonne `overall` e `Valore` dello stesso foglio restano fuori, sono giudizi
 * di terzi (sez. 2.2, vincolo non negoziabile).
 *
 * L'abbinamento riusa la stessa logica di `importRolesFromSheet.ts`, con le trappole già
 * pagate lì: nomi legali completi contro nomi d'uso, lettere senza forma decomposta in NFD,
 * indice per club invece che per cognome. È duplicata qui — non estratta in un modulo comune —
 * perché quello script è uno strumento one-off già eseguito e congelato: toccarlo per
 * rifattorizzarlo rischierebbe di cambiarne il risultato senza alcun beneficio.
 *
 * Uso: `pnpm import-birthdates` (dry run) oppure `pnpm import-birthdates -- --apply`.
 */

interface SheetRow {
  "Nome Completo": string | null;
  "Nome Club": string | null;
  "Data di nascita": number | null;
}

/**
 * Lettere che **non** hanno una forma decomposta in NFD, quindi sopravvivono allo strip degli
 * accenti e rompono il confronto: "Radosław" diventerebbe `radosaw` invece di `radoslaw`.
 */
const SPECIAL_LETTERS: Record<string, string> = {
  ł: "l",
  ø: "o",
  đ: "d",
  ð: "d",
  þ: "th",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  ı: "i",
};

/**
 * Confronto tollerante ad accenti, alfabeti non latini, punteggiatura e maiuscole.
 *
 * La normalizzazione in NFD è anche ciò che rende indifferente la forma di partenza: il foglio
 * mescola accenti precomposti (`í`) e lettera più accento combinante (`i`+U+0301), stringhe
 * diverse ma identiche a schermo, che senza questo passaggio non si aggancerebbero mai.
 */
function normalize(value: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[łøđðþæœßı]/g, (ch) => SPECIAL_LETTERS[ch] ?? ch)
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((t) => t.length >= 3);
}

/**
 * Quanto due nomi si somigliano: 3 per ogni parola identica, 1 se una parola è contenuta
 * nell'altra (Fikayo⊂Oluwafikayomi, Tino⊂Faustino). Un confronto per cognome fallirebbe su
 * spagnoli e brasiliani, che nel foglio portano due cognomi.
 */
function nameScore(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  let score = 0;
  for (const l of left) {
    if (right.includes(l)) score += 3;
    else if (right.some((r) => r.includes(l) || l.includes(r))) score += 1;
  }
  return score;
}

/** "AC Milan", "Hellas Verona FC" e "Milan" devono coincidere. */
function normalizeClub(value: string): string {
  return normalize(value)
    .replace(/\b(ac|fc|as|ss|us|ssc|calcio|club)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Le date del foglio sono seriali Excel (giorni dal 30/12/1899). */
function excelDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
}

function isoDate(serial: number): string {
  return excelDate(serial).toISOString().slice(0, 10);
}

/** Stagione di riferimento del pool (2025/26): l'età si legge a metà stagione. */
const SEASON_REFERENCE = new Date(Date.UTC(2026, 0, 1));

function ageAtReference(iso: string): number {
  const birth = new Date(`${iso}T00:00:00Z`);
  let age = SEASON_REFERENCE.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = SEASON_REFERENCE.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && SEASON_REFERENCE.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

function sheetPath(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../Cartel1.xlsx");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rows: SheetRow[] = xlsx.utils.sheet_to_json(xlsx.readFile(sheetPath()).Sheets["DB"], {
    defval: null,
  });

  const dated = rows.filter((r) => r["Nome Completo"] && r["Data di nascita"]);

  /**
   * Indice per **club**: i candidati scendono da migliaia a ~30, e spariscono gli omonimi di
   * altri campionati (il foglio contiene club ecuadoriani, perché anche l'Ecuador ha una
   * "Serie A", e club ucraini sotto "Premier League").
   */
  const byClub = new Map<string, SheetRow[]>();
  for (const row of dated) {
    if (!row["Nome Club"]) continue;
    const key = normalizeClub(row["Nome Club"]);
    if (!byClub.has(key)) byClub.set(key, []);
    byClub.get(key)!.push(row);
  }

  const client = await connectDb();
  const { rows: players } = await client.query<{
    id: string;
    name: string;
    club: string;
    league: string;
  }>(`select p.id, p.name, c.name as club, l.name as league
      from player_pool p
        join clubs c on c.id = p.club_id
        join leagues l on l.id = c.league_id`);

  const matched: { id: string; birthDate: string; age: number }[] = [];
  const unmatched: string[] = [];

  for (const player of players) {
    /*
     * Due passaggi, dal più affidabile al più permissivo — stessa scala di soglie di
     * `importRolesFromSheet.ts`.
     *
     * 1. **Dentro il club**: soglia 4 (almeno due parole in comune). Con una parola sola
     *    "Josep Martínez" tornerebbe ad agganciarsi a "Lautaro Martínez", suo compagno.
     * 2. **Su tutto il foglio**, solo per chi resta: serve per chi ha cambiato squadra
     *    rispetto allo scatto del foglio. Soglia 6, perché senza il vincolo del club gli
     *    omonimi sono migliaia. I mononimi fanno eccezione a 3, ma solo se il primo classificato
     *    è l'unico a quel punteggio.
     */
    const mononym = tokens(player.name).length === 1;
    const rank = (pool: SheetRow[]) =>
      pool
        .map((row) => ({ row, score: nameScore(player.name, row["Nome Completo"]!) }))
        .sort((a, b) => b.score - a.score);

    const inClub = rank(byClub.get(normalizeClub(player.club)) ?? []);
    let match =
      inClub[0] && inClub[0].score >= 4 && (!inClub[1] || inClub[0].score > inClub[1].score)
        ? inClub[0].row
        : undefined;

    if (!match) {
      const global = rank(dated);
      const threshold = mononym ? 3 : 6;
      if (
        global[0] &&
        global[0].score >= threshold &&
        (!global[1] || global[0].score > global[1].score)
      ) {
        match = global[0].row;
      }
    }

    if (!match) {
      unmatched.push(`${player.name} (${player.club}, ${player.league})`);
      continue;
    }

    const birthDate = isoDate(match["Data di nascita"]!);
    const age = ageAtReference(birthDate);
    /*
     * Rete di sicurezza: un'età fuori da 15-45 anni non è un giocatore di prima squadra ma un
     * abbinamento sbagliato o un seriale letto male. Si scarta invece di scrivere un dato che
     * farebbe ritirare qualcuno alla prima stagione.
     */
    if (age < 15 || age > 45) {
      unmatched.push(`${player.name} (${player.club}) [scartato: età ${age} implausibile]`);
      continue;
    }

    matched.push({ id: player.id, birthDate, age });
  }

  console.log(`Giocatori nel database: ${players.length}`);
  console.log(`Agganciati al foglio:   ${matched.length}`);
  console.log(`Non trovati:            ${unmatched.length}`);

  const buckets = new Map<string, number>();
  const label = (age: number) =>
    age <= 20 ? "≤20" : age <= 23 ? "21-23" : age <= 28 ? "24-28 (picco)" : age <= 33 ? "29-33" : "34+ (ritiro)";
  for (const m of matched) buckets.set(label(m.age), (buckets.get(label(m.age)) ?? 0) + 1);
  console.log("\nDistribuzione età alla stagione 2025/26:");
  for (const key of ["≤20", "21-23", "24-28 (picco)", "29-33", "34+ (ritiro)"]) {
    console.log(`  ${key.padEnd(14)} ${String(buckets.get(key) ?? 0).padStart(4)}`);
  }
  const ages = matched.map((m) => m.age);
  if (ages.length) {
    const avg = ages.reduce((s, a) => s + a, 0) / ages.length;
    console.log(`  età media ${avg.toFixed(1)} (min ${Math.min(...ages)}, max ${Math.max(...ages)})`);
  }

  if (unmatched.length) {
    console.log("\nNON AGGANCIATI (birth_date lasciata nulla):");
    for (const name of [...unmatched].sort()) console.log("  " + name);
  }

  if (!apply) {
    await client.end();
    console.log("\n(dry run — rilancia con --apply per scrivere)");
    return;
  }

  try {
    await client.query("begin");
    for (const { id, birthDate } of matched) {
      await client.query(`update player_pool set birth_date = $1 where id = $2`, [birthDate, id]);
    }
    await client.query("commit");
    console.log(`\nScritte ${matched.length} date di nascita.`);
  } catch (error: any) {
    await client.query("rollback");
    console.error("FALLITO:", error.message, "|", error.detail ?? "");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
