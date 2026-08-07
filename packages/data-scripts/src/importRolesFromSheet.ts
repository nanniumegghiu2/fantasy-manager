import xlsx from "xlsx";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb } from "./db";
import type { Role } from "@app/shared-types";

/**
 * Corregge ruolo principale e ruoli secondari dei giocatori usando la colonna `Posizione`
 * del foglio fornito dall'utente (`Cartel1.xlsx`).
 *
 * Perché serve: i ruoli attuali vengono da `remapRolesToBoard.ts`, che li assegnava **a
 * rotazione** dentro ogni reparto — una stima di partenza dichiarata, non il ruolo reale.
 * Il risultato si vede a occhio nudo sulla rosa dell'Inter: Acerbi Quinto Destro, Dumfries
 * Difensore Centrale, Akanji Terzino Sinistro. La posizione tattica di un giocatore è un
 * fatto, quindi questa colonna è utilizzabile e risolve il problema alla radice.
 *
 * Bonus: la colonna elenca **più posizioni** in ordine di competenza (es. `CM, CDM, RB`),
 * quindi popola anche `secondary_roles`, oggi vuoto per tutti — cioè accende il malus da
 * ruolo secondario (sez. 3.1) che finora non ha mai avuto dati su cui lavorare.
 *
 * Uso: `pnpm import-roles` (dry run) oppure `pnpm import-roles -- --apply` per scrivere.
 */

/** Posizioni del foglio → caselle del nostro scacchiere a 14 ruoli (sez. 3.1). */
const POSITION_TO_ROLE: Record<string, Role> = {
  GK: "POR",
  RB: "TD",
  // "Quinto" in italiano E' il wing-back: mapparlo su terzino lasciava QD/QS quasi vuoti
  // (3 quinti sinistri in tutto il campionato) e sbilanciava i moduli a 3 difensori.
  RWB: "QD",
  CB: "DC",
  LB: "TS",
  LWB: "QS",
  CDM: "MED",
  CM: "CC",
  RM: "ED",
  LM: "ES",
  CAM: "TRQ",
  RW: "TQD",
  LW: "TQS",
  ST: "ATT",
  CF: "ATT",
};

interface SheetRow {
  "Nome Completo": string | null;
  Posizione: string | null;
  "Nome Club": string | null;
}

/**
 * Correzioni manuali per i giocatori che il foglio non può risolvere, con il motivo.
 *
 * Sono quasi tutti brasiliani e portoghesi che nel foglio compaiono col **nome legale**
 * mentre noi (come il resto del mondo) usiamo il soprannome: "Dodô" nel foglio è
 * "Domilson Cordeiro dos Santos Júnior", e non c'è una sola parola in comune da cui
 * partire. Nessun algoritmo può indovinarlo: sono stima editoriale dichiarata, come gli
 * Overall (sez. 2.2). Vengono applicate DOPO il foglio, quindi non lo contraddicono mai —
 * intervengono solo dove il foglio tace.
 */
const MANUAL_ROLES: Record<string, { role: Role; secondary?: Role[] }> = {
  "Fiorentina|Dodô": { role: "TD" }, // terzino destro
  "Roma|Wesley": { role: "TD", secondary: ["TQD"] }, // terzino destro brasiliano
  "Roma|Kostas Tsimikas": { role: "TS" }, // terzino sinistro
  "Cagliari|Zé Pedro": { role: "DC" }, // difensore centrale portoghese
  "Pisa|Felipe Loyola": { role: "MED", secondary: ["CC"] }, // mediano cileno
  "Udinese|Abdoulaye Camara": { role: "CC" }, // centrocampista centrale
  "Torino|Rafael Obrador": { role: "TS" }, // terzino sinistro
  "Napoli|Alisson Santos": { role: "TQD", secondary: ["ATT"] }, // esterno offensivo
  "Sassuolo|Pedro Felipe": { role: "DC" }, // difensore centrale brasiliano
  "Genoa|Vitinha": { role: "ATT" }, // punta portoghese
  // Assenti dal foglio ma titolari veri: qui il ruolo a rotazione si notava in partita.
  "Roma|Angeliño": { role: "TS", secondary: ["QS"] }, // terzino sinistro, non destro
  "Lazio|Kenneth Taylor": { role: "CC", secondary: ["TRQ"] }, // mezzala
  "Parma|Gabriel Strefezza": { role: "TQD", secondary: ["ED"] }, // ala destra
  "Pisa|Samuel Iling-Junior": { role: "TQS", secondary: ["ES"] }, // ala sinistra
  "Pisa|Lisandru Tramoni": { role: "TRQ", secondary: ["TQS"] }, // trequartista
};

/**
 * Lettere che **non** hanno una forma decomposta in NFD, quindi sopravvivono allo strip
 * degli accenti e rompono il confronto: "Radosław" diventava `radosaw` invece di
 * `radoslaw`, e il giocatore non veniva mai trovato.
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

/** Confronto tollerante ad accenti, alfabeti non latini, punteggiatura e maiuscole. */
function normalize(value: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[łøđðþæœßı]/g, (ch) => SPECIAL_LETTERS[ch] ?? ch)
    // Il foglio incolla al nome la versione in arabo/greco ("Harrouiعبدو هروي"):
    // tutto ciò che non è latino diventa spazio.
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
 * Quanto due nomi si somigliano. Serve perché il foglio riporta i **nomi legali completi**
 * mentre noi usiamo quelli d'uso: "Álvaro Borja Morata Martín" contro "Álvaro Morata",
 * "Oluwafikayomi Oluwadamilola Tomori" contro "Fikayo Tomori". Un confronto per cognome
 * (ultima parola) falliva su tutti gli spagnoli e i brasiliani, che portano due cognomi.
 *
 * Punteggio: 3 per ogni parola identica, 1 se una parola è contenuta nell'altra
 * (Fikayo⊂Oluwafikayomi, Tino⊂Faustino).
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

/**
 * Coppie di ruoli tatticamente intercambiabili, aggiunte d'ufficio come ruolo secondario.
 *
 * Serve perché il foglio distingue pochissimo `RB`/`RWB` e `LB`/`LWB`: quasi tutti i
 * giocatori sono catalogati come terzini, e il campionato si ritrovava con **3 soli quinti
 * sinistri** — con cui un draft per ruolo su un 3-5-2 è impossibile (il pacchetto da 5
 * candidati non riuscirebbe nemmeno a riempirsi). Nel calcio reale un terzino fa il quinto
 * e viceversa a seconda che si giochi a quattro o a tre dietro, quindi la regola è vera,
 * non una toppa: entra come **secondario**, quindi col malus di sez. 3.1.
 */
const INTERCHANGEABLE: Partial<Record<Role, Role>> = {
  TS: "QS",
  QS: "TS",
  TD: "QD",
  QD: "TD",
};

function rolesFromPositions(positions: string): { role: Role; secondary: Role[] } | null {
  const mapped = positions
    .split(",")
    .map((p) => POSITION_TO_ROLE[p.trim().toUpperCase()])
    .filter((r): r is Role => !!r);
  if (mapped.length === 0) return null;

  const [role, ...rest] = mapped;
  const secondary = new Set(rest.filter((r) => r !== role));

  const twin = INTERCHANGEABLE[role];
  if (twin) secondary.add(twin);
  for (const other of rest) {
    const otherTwin = INTERCHANGEABLE[other];
    if (otherTwin && otherTwin !== role) secondary.add(otherTwin);
  }

  return { role, secondary: [...secondary] };
}

function sheetPath(): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../Cartel1.xlsx",
  );
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rows: SheetRow[] = xlsx.utils.sheet_to_json(
    xlsx.readFile(sheetPath()).Sheets["DB"],
    { defval: null },
  );

  /**
   * Indice per **club**, non per cognome. Cercare dentro la squadra giusta è molto più
   * affidabile: i candidati scendono da migliaia a ~30, i cognomi non collidono più tra
   * campionati diversi (il foglio contiene club ecuadoriani, perché anche l'Ecuador ha una
   * "Serie A") e sparisce il rischio di agganciare un omonimo di un'altra squadra.
   */
  const byClub = new Map<string, SheetRow[]>();
  for (const row of rows) {
    if (!row["Nome Completo"] || !row.Posizione || !row["Nome Club"]) continue;
    const key = normalizeClub(row["Nome Club"]);
    if (!byClub.has(key)) byClub.set(key, []);
    byClub.get(key)!.push(row);
  }

  const client = await connectDb();
  const { rows: players } = await client.query<{
    id: string;
    name: string;
    role: string;
    club: string;
    overall: number;
  }>(`select p.id, p.name, p.role::text as role, p.overall, c.name as club
      from player_pool p join clubs c on c.id = p.club_id`);

  let updated = 0;
  let unmatched = 0;
  const changes: string[] = [];
  const unmatchedNames: string[] = [];

  const allRows = rows.filter((r) => r["Nome Completo"] && r.Posizione);

  for (const player of players) {
    /*
     * Due passaggi, dal più affidabile al più permissivo.
     *
     * 1. **Dentro il club**: soglia bassa (4 = almeno due parole in comune) perché i
     *    candidati sono ~30 e il rischio di sbagliare è minimo. Con una parola sola
     *    "Josep Martínez" tornerebbe ad agganciarsi a "Lautaro Martínez", suo compagno.
     * 2. **Su tutto il foglio**, solo per chi resta: serve per i giocatori che hanno
     *    **cambiato squadra** rispetto allo scatto del foglio (Raspadori, Malen, Tsimikas)
     *    e per i nomi singoli (Bremer, Dodô). Qui la soglia sale a 6 — due parole
     *    identiche — perché senza il vincolo del club gli omonimi sono migliaia. I nomi
     *    mononimi fanno eccezione a 3, ma solo se in tutto il foglio ce n'è uno solo.
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
      const global = rank(allRows);
      const threshold = mononym ? 3 : 6;
      if (global[0] && global[0].score >= threshold && (!global[1] || global[0].score > global[1].score)) {
        match = global[0].row;
      }
    }

    const manual = MANUAL_ROLES[`${player.club}|${player.name}`];
    if (!match && manual) {
      if (manual.role !== player.role) {
        changes.push(`${player.name} (${player.club}): ${player.role} -> ${manual.role} [manuale]`);
      }
      if (apply) {
        await client.query(
          `update player_pool set role = $1, secondary_roles = $2::player_role[] where id = $3`,
          [manual.role, manual.secondary ?? [], player.id],
        );
      }
      updated++;
      continue;
    }

    if (!match) {
      unmatched++;
      unmatchedNames.push(`${String(player.overall).padStart(2)} | ${player.role.padEnd(4)} | ${player.name} (${player.club})`);
      continue;
    }

    const resolved = rolesFromPositions(match.Posizione!);
    if (!resolved) {
      unmatched++;
      unmatchedNames.push(`${player.name} (${player.club}) [posizione non mappata: ${match.Posizione}]`);
      continue;
    }

    /*
     * Rete di sicurezza sul portiere: nessun abbinamento corretto trasforma un portiere in
     * un giocatore di movimento o viceversa. Se succede, l'abbinamento è sbagliato — non il
     * ruolo — quindi si scarta invece di scrivere un dato errato.
     */
    if ((player.role === "POR") !== (resolved.role === "POR")) {
      unmatched++;
      unmatchedNames.push(`${player.name} (${player.club}) [scartato: portiere vs movimento]`);
      continue;
    }

    if (resolved.role !== player.role) {
      changes.push(`${player.name} (${player.club}): ${player.role} -> ${resolved.role}`);
    }

    if (apply) {
      await client.query(
        `update player_pool set role = $1, secondary_roles = $2::player_role[] where id = $3`,
        [resolved.role, resolved.secondary, player.id],
      );
    }
    updated++;
  }

  await client.end();

  console.log(`Giocatori nel database: ${players.length}`);
  console.log(`Agganciati al foglio:   ${updated}`);
  console.log(`Non trovati:            ${unmatched}`);
  console.log(`Ruolo principale che cambierebbe: ${changes.length}`);
  if (unmatchedNames.length) {
    console.log("\nNON AGGANCIATI (ruolo lasciato invariato):");
    for (const name of [...unmatchedNames].sort().reverse()) console.log("  " + name);
  }
  console.log("\nPrimi 25 cambi:");
  for (const change of changes.slice(0, 25)) console.log("  " + change);
  if (!apply) console.log("\n(dry run — rilancia con --apply per scrivere)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
