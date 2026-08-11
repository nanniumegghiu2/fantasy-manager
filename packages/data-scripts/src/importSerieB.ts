import { computeMarketValue } from "@app/game-engine";
import { ROLE_DEPARTMENT, type Role } from "@app/shared-types";
import { connectDb } from "./db";
import { SERIE_B_CLUBS, SERIE_B_LEAGUE } from "../seeds/serie-b-2025-26";

/**
 * Importa la **Serie B 2025/26** (CLAUDE.md sez. 2.1/2.3, `docs/piano-serie-b.md`).
 *
 * Uso: `pnpm import-serie-b` (dry run) oppure `pnpm import-serie-b -- --apply`.
 * Rieseguirlo cancella e ricrea il solo campionato "Serie B": è ripetibile senza duplicati e
 * non tocca nessuno dei Big 5.
 *
 * ## Perché qui non si legge alcun foglio
 *
 * Gli altri campionati arrivano da `Cartel1.xlsx`. La Serie B **non c'è**: il foglio contiene
 * solo i Big 5 (verificato — 3.204 righe, cinque campionati). I dati sono quindi compilati da
 * noi in `seeds/serie-b-2025-26/`, con la separazione fra fatti e stime dichiarata lì.
 *
 * ## Cosa scrive
 *
 * - `overall` **e** `overall_override` con lo stesso valore, come già fa l'import dei Big 5:
 *   l'override è ciò che marca il valore come **stima editoriale nostra** e lo protegge da
 *   `pnpm recompute`, che altrimenti lo riscriverebbe col percentile del pool.
 * - `birth_date`, che l'import dei Big 5 non scriveva (arrivava dopo, da `importBirthDates`).
 *   Qui l'abbiamo alla fonte, e senza di essa la DS mode non saprebbe l'età di nessuno:
 *   niente crescita, niente ritiri, niente regen.
 * - `market_value` dal nostro `computeMarketValue`, mai un valore di terzi.
 *
 * `department` **non** si scrive: è una colonna generata dal ruolo (sez. 3.1).
 */

/** Prestigio calcistico della nazionalità (1-5), stessa scala e stessi valori dell'import Big 5. */
const NATION_PRESTIGE: Record<string, number> = {
  Brasile: 5,
  Francia: 5,
  Argentina: 5,
  Germania: 5,
  Spagna: 5,
  Italia: 5,
  Inghilterra: 5,
  Portogallo: 4,
  "Paesi Bassi": 4,
  Belgio: 4,
  Uruguay: 4,
  Croazia: 4,
};

/**
 * **Chi gioca largo sa giocare largo su due linee.**
 *
 * Stessa idea di `INTERCHANGEABLE` (terzino ↔ quinto) nell'import dei Big 5, applicata alla
 * fascia offensiva: l'esterno alto della linea 5 (`TQD`/`TQS`) e l'esterno di centrocampo
 * della linea 4 (`ED`/`ES`) sono lo stesso giocatore in due sistemi diversi — sale o scende di
 * una linea a seconda che si giochi col trequartista o col centrocampo a quattro.
 *
 * Non è una comodità: senza, la Serie B aveva **15 soli candidati `ED` su 20 club** (misurato
 * dal controllo qui sotto, non ipotizzato), cioè meno di uno a squadra, e i moduli con
 * centrocampo a quattro sarebbero stati irriempibili. È lo stesso difetto già capitato con i
 * Quinti (Decision Log 2026-07-28), dove pure la soluzione fu una regola e non un elenco.
 *
 * Sta nel codice e non nei dati per la ragione di sempre: una regola scritta una volta non può
 * andare fuori sincrono con sé stessa, quaranta righe copiate a mano sì.
 */
const WIDE_INTERCHANGEABLE: Partial<Record<Role, Role>> = {
  TQD: "ED",
  ED: "TQD",
  TQS: "ES",
  ES: "TQS",
};

/** I ruoli secondari effettivi di un giocatore: quelli dichiarati più quello di fascia. */
function secondaryRolesOf(role: Role, declared: Role[] | undefined): Role[] {
  const roles = new Set<Role>(declared ?? []);
  const gemello = WIDE_INTERCHANGEABLE[role];
  if (gemello) roles.add(gemello);
  roles.delete(role);
  return [...roles];
}

/**
 * Controlli che devono passare **prima** di scrivere.
 *
 * Non sono formalità: ognuno corrisponde a un difetto già capitato almeno una volta in questo
 * progetto (Decision Log 2026-07-27/28) — un giocatore duplicato in due club, un ruolo che il
 * pool non sa coprire e che rende un modulo irriempibile, una banda di Overall che scivola
 * sopra quella del campionato superiore.
 */
function validate(): string[] {
  const problemi: string[] = [];

  if (SERIE_B_CLUBS.length !== 20) {
    problemi.push(`Club attesi 20, trovati ${SERIE_B_CLUBS.length}`);
  }

  // Nessuno può stare in due rose contemporaneamente. Le fonti elencano lo stesso giocatore
  // sia fra i "current" di un club sia fra i "left" di un altro, ed è lì che nasce l'errore.
  const clubDi = new Map<string, string>();
  for (const club of SERIE_B_CLUBS) {
    for (const p of club.players) {
      const altro = clubDi.get(p.name);
      if (altro) problemi.push(`"${p.name}" compare sia in ${altro} sia in ${club.name}`);
      else clubDi.set(p.name, club.name);
    }
  }

  for (const club of SERIE_B_CLUBS) {
    if (club.players.length < 20) {
      problemi.push(`${club.name}: solo ${club.players.length} giocatori`);
    }
    // Undici schierabili con un portiere vero: il minimo perché una partita esista.
    const portieri = club.players.filter((p) => p.role === "POR").length;
    if (portieri < 2) problemi.push(`${club.name}: ${portieri} portieri`);

    for (const p of club.players) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate)) {
        problemi.push(`${club.name} / ${p.name}: data di nascita "${p.birthDate}" non valida`);
      }
      if (p.overall < 60 || p.overall > 74) {
        problemi.push(`${club.name} / ${p.name}: Overall ${p.overall} fuori dalla banda 60-74`);
      }
      if (p.secondaryRoles?.includes(p.role)) {
        problemi.push(`${club.name} / ${p.name}: ruolo principale ripetuto fra i secondari`);
      }
    }
  }

  // Ogni casella dello scacchiere deve avere candidati, altrimenti alcuni moduli diventano
  // irriempibili — è già successo con i Quinti (Decision Log 2026-07-28).
  const copertura = new Map<Role, number>();
  for (const club of SERIE_B_CLUBS) {
    for (const p of club.players) {
      for (const ruolo of [p.role, ...secondaryRolesOf(p.role, p.secondaryRoles)]) {
        copertura.set(ruolo, (copertura.get(ruolo) ?? 0) + 1);
      }
    }
  }
  for (const ruolo of Object.keys(ROLE_DEPARTMENT) as Role[]) {
    const n = copertura.get(ruolo) ?? 0;
    if (n < 20) problemi.push(`Ruolo ${ruolo}: solo ${n} candidati in tutta la Serie B`);
  }

  return problemi;
}

function riepilogo() {
  const tutti = SERIE_B_CLUBS.flatMap((c) => c.players);
  const overalls = tutti.map((p) => p.overall).sort((a, b) => a - b);
  const mediana = overalls[Math.floor(overalls.length / 2)]!;
  const media = overalls.reduce((s, v) => s + v, 0) / overalls.length;

  console.log(`\nSerie B 2025/26 — ${SERIE_B_CLUBS.length} club, ${tutti.length} giocatori`);
  console.log(
    `Overall: min ${overalls[0]}, mediana ${mediana}, media ${media.toFixed(1)}, max ${overalls[overalls.length - 1]}\n`,
  );

  for (const club of [...SERIE_B_CLUBS].sort((a, b) => forza(b) - forza(a))) {
    console.log(
      `${club.name.padEnd(16)} ${String(club.players.length).padStart(2)} giocatori · ` +
        `undici migliori ${forza(club).toFixed(1)} · prestigio ${club.prestigeTier}`,
    );
  }
}

/** Media degli undici migliori: lo stesso metro con cui il gioco misura un club. */
function forza(club: { players: { overall: number }[] }): number {
  const top = [...club.players].sort((a, b) => b.overall - a.overall).slice(0, 11);
  return top.reduce((s, p) => s + p.overall, 0) / top.length;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const problemi = validate();
  riepilogo();

  if (problemi.length > 0) {
    console.error(`\n${problemi.length} problemi da correggere prima di importare:`);
    for (const p of problemi) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log("\nControlli di coerenza: tutti superati.");

  if (!apply) {
    console.log("(dry run — rilancia con `pnpm import-serie-b -- --apply` per scrivere)");
    return;
  }

  const client = await connectDb();
  try {
    await client.query("begin");

    // Ricrea da zero il solo campionato: rende lo script rieseguibile senza duplicati.
    await client.query(
      `delete from player_pool where club_id in (
         select c.id from clubs c join leagues l on l.id = c.league_id where l.name = $1)`,
      [SERIE_B_LEAGUE.name],
    );
    await client.query(
      `delete from clubs where league_id in (select id from leagues where name = $1)`,
      [SERIE_B_LEAGUE.name],
    );
    await client.query(`delete from leagues where name = $1`, [SERIE_B_LEAGUE.name]);

    /**
     * Club nella stessa epoca, per il moltiplicatore di densità del valore di mercato
     * (sez. 2.3). Si contano quelli già presenti **dopo** la cancellazione, più i venti che
     * stiamo per inserire.
     */
    const { rows: eraRows } = await client.query<{ n: number }>(
      `select count(*)::int n from clubs where era = $1`,
      [SERIE_B_LEAGUE.era],
    );
    const clubsInSameEra = eraRows[0]!.n + SERIE_B_CLUBS.length;

    const { rows: leagueRow } = await client.query<{ id: string }>(
      `insert into leagues (name, nation, prestige_tier) values ($1, $2, $3) returning id`,
      [SERIE_B_LEAGUE.name, SERIE_B_LEAGUE.nation, SERIE_B_LEAGUE.prestigeTier],
    );
    const leagueId = leagueRow[0]!.id;

    let inseriti = 0;
    for (const club of SERIE_B_CLUBS) {
      const { rows: clubRow } = await client.query<{ id: string }>(
        `insert into clubs (name, league_id, era, prestige_tier) values ($1, $2, $3, $4) returning id`,
        [club.name, leagueId, SERIE_B_LEAGUE.era, club.prestigeTier],
      );
      const clubId = clubRow[0]!.id;

      for (const p of club.players) {
        const marketValue = computeMarketValue({
          overall: p.overall,
          leaguePrestigeTier: SERIE_B_LEAGUE.prestigeTier,
          clubPrestigeTier: club.prestigeTier,
          nationPrestigeTier: NATION_PRESTIGE[p.nation] ?? 3,
          clubsInSameEra,
        });
        await client.query(
          `insert into player_pool
             (name, nation, role, secondary_roles, overall, overall_override, market_value, club_id, birth_date)
           values ($1, $2, $3::player_role, $4::player_role[], $5, $5, $6, $7, $8)`,
          [
            p.name,
            p.nation,
            p.role,
            secondaryRolesOf(p.role, p.secondaryRoles),
            p.overall,
            marketValue,
            clubId,
            p.birthDate,
          ],
        );
        inseriti++;
      }
      console.log(`${club.name}: ${club.players.length} giocatori`);
    }

    await client.query("commit");
    console.log(`\nImportati ${inseriti} giocatori in ${SERIE_B_CLUBS.length} club.`);
    console.log("Ricordati di rilanciare `pnpm recompute` per i valori di mercato del pool intero.");
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
