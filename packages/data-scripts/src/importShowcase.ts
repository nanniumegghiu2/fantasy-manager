import { computeMarketValue, isShowcaseLeague } from "@app/game-engine";
import { ROLE_DEPARTMENT, type Role } from "@app/shared-types";
import { connectDb } from "./db";
import {
  NATION_PRESTIGE,
  SHOWCASE_ERA,
  SHOWCASE_LEAGUES_DATA,
  type ShowcaseLeague,
} from "../seeds/showcase-2025-26";

/**
 * Importa le **leghe vetrina** (`docs/piano-leghe-vetrina.md`): club non giocabili che esistono
 * per popolare il mercato della DS mode.
 *
 * Uso: `pnpm import-showcase` (dry run) oppure `pnpm import-showcase -- --apply`.
 * Rieseguirlo cancella e ricrea **solo** questi campionati: è ripetibile senza duplicati e non
 * tocca né i Big 5 né la Serie B.
 *
 * ## Cosa scrive, e perché così
 *
 * - `overall` **e** `overall_override` con lo stesso valore, come gli import precedenti:
 *   l'override marca il valore come **stima editoriale nostra** e lo protegge da `pnpm
 *   recompute`, che altrimenti lo riscriverebbe col percentile del pool.
 * - `birth_date`: senza, la DS mode non saprebbe l'età di nessuno — niente crescita, niente
 *   ritiri, niente regen.
 * - `market_value` dal nostro `computeMarketValue`, mai un valore di terzi.
 *
 * `department` **non** si scrive: è una colonna generata dal ruolo (§3.1).
 *
 * ## L'avvertenza che vale più di tutte
 *
 * **`pnpm prune-roles` non va rilanciato.** Taglia sotto Overall 65 e cancellerebbe il fondo
 * rosa di quasi tutti questi club — stessa avvertenza già valida per la Serie B (§2.3).
 */

/** Terzino ↔ quinto, e fascia alta ↔ fascia di centrocampo: le due regole di sempre. */
const INTERCHANGEABLE: Partial<Record<Role, Role>> = {
  TD: "QD",
  QD: "TD",
  TS: "QS",
  QS: "TS",
  TQD: "ED",
  ED: "TQD",
  TQS: "ES",
  ES: "TQS",
};

/**
 * I ruoli secondari effettivi: quelli dichiarati più il gemello di fascia.
 *
 * Sta nel codice e non nei dati per la ragione di sempre: una regola scritta una volta non può
 * andare fuori sincrono con sé stessa, cinquecento righe copiate a mano sì. Senza, le caselle
 * Quinto ed Esterno resterebbero quasi vuote e alcuni moduli diventerebbero irriempibili — è
 * già successo due volte in questo progetto (Decision Log 2026-07-28 e 2026-08-11b).
 */
function secondaryRolesOf(role: Role, declared: Role[] | undefined): Role[] {
  const roles = new Set<Role>(declared ?? []);
  const gemello = INTERCHANGEABLE[role];
  if (gemello) roles.add(gemello);
  roles.delete(role);
  return [...roles];
}

/**
 * Controlli che devono passare **prima** di scrivere.
 *
 * Ognuno corrisponde a un difetto già capitato almeno una volta in questo progetto: un
 * giocatore in due rose, un ruolo che il pool non sa coprire, una banda di Overall che scivola
 * sopra quella dei campionati veri.
 */
function validate(): string[] {
  const problemi: string[] = [];

  for (const lega of SHOWCASE_LEAGUES_DATA) {
    /**
     * **Il controllo che protegge dall'errore più costoso.** Una lega vetrina che non compare in
     * `SHOWCASE_LEAGUES` resta **giocabile**: comparirebbe nel selettore del club, iscriverebbe
     * le sue prime quattro alla Corona Continentale ed entrerebbe nella Modalità Classica. Non è
     * un difetto che si nota subito, ed è per questo che va bloccato qui.
     */
    if (!isShowcaseLeague(lega.name)) {
      problemi.push(
        `"${lega.name}" non è in SHOWCASE_LEAGUES (divisions.ts): verrebbe importata come campionato GIOCABILE`,
      );
    }
  }

  /**
   * Nessuno può stare in due rose. La chiave è **nome + data di nascita**, non il solo nome: in
   * Brasile i mononimi si ripetono (tre "Allan" e due "Danilo" in questo dataset sono tre e due
   * persone diverse), e un controllo sul solo nome li avrebbe respinti tutti come duplicati.
   * Con la data di nascita restano distinti, e chi è davvero la stessa persona in due club viene
   * comunque preso — ed è successo: due giocatori comparivano sia in Brasile sia in Argentina,
   * perché le due fonti fotografano momenti diversi del loro trasferimento.
   */
  const clubDi = new Map<string, string>();
  for (const lega of SHOWCASE_LEAGUES_DATA) {
    for (const club of lega.clubs) {
      for (const p of club.players) {
        const chiave = `${p.name}|${p.birthDate}`;
        const altro = clubDi.get(chiave);
        if (altro) problemi.push(`"${p.name}" (${p.birthDate}) compare sia in ${altro} sia in ${club.name}`);
        else clubDi.set(chiave, club.name);
      }
    }
  }

  for (const lega of SHOWCASE_LEAGUES_DATA) {
    const [min, max] = lega.overallRange;
    for (const club of lega.clubs) {
      if (club.players.length < 20) {
        problemi.push(`${club.name}: solo ${club.players.length} giocatori (minimo 20)`);
      }
      const portieri = club.players.filter((p) => p.role === "POR").length;
      if (portieri < 2) problemi.push(`${club.name}: ${portieri} portieri (minimo 2)`);

      // Undici schierabili con un reparto plausibile: il minimo perché una partita esista, e il
      // minimo perché `bestElevenByDepartment` non ripieghi su una media inventata.
      for (const [dep, minimo] of [["DIF", 5], ["CC", 5], ["ATT", 2]] as const) {
        const n = club.players.filter((p) => ROLE_DEPARTMENT[p.role] === dep).length;
        if (n < minimo) problemi.push(`${club.name}: solo ${n} giocatori in ${dep} (minimo ${minimo})`);
      }

      for (const p of club.players) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate)) {
          problemi.push(`${club.name} / ${p.name}: data di nascita "${p.birthDate}" non valida`);
        }
        if (p.overall < min || p.overall > max) {
          problemi.push(
            `${club.name} / ${p.name}: Overall ${p.overall} fuori dalla banda ${min}-${max} di ${lega.name}`,
          );
        }
        // Il vincolo `check` del database: la scala del progetto parte da 60 (§2.2). È già
        // costato una scrittura respinta durante l'import della Serie B.
        if (p.overall < 60 || p.overall > 99) {
          problemi.push(`${club.name} / ${p.name}: Overall ${p.overall} fuori dalla scala 60-99`);
        }
        if (p.secondaryRoles?.includes(p.role)) {
          problemi.push(`${club.name} / ${p.name}: ruolo principale ripetuto fra i secondari`);
        }
      }
    }
  }

  // Ogni casella dello scacchiere deve avere candidati, altrimenti il mercato non riesce a
  // proporre nulla per quel ruolo — e la varietà, che è lo scopo di tutta l'operazione, si
  // fermerebbe proprio dove serve.
  const copertura = new Map<Role, number>();
  for (const lega of SHOWCASE_LEAGUES_DATA) {
    for (const club of lega.clubs) {
      for (const p of club.players) {
        for (const ruolo of [p.role, ...secondaryRolesOf(p.role, p.secondaryRoles)]) {
          copertura.set(ruolo, (copertura.get(ruolo) ?? 0) + 1);
        }
      }
    }
  }
  for (const ruolo of Object.keys(ROLE_DEPARTMENT) as Role[]) {
    const n = copertura.get(ruolo) ?? 0;
    if (n < 10) problemi.push(`Ruolo ${ruolo}: solo ${n} candidati in tutte le leghe vetrina`);
  }

  return problemi;
}

/** Media degli undici migliori: lo stesso metro con cui il gioco misura un club. */
function forza(club: { players: { overall: number }[] }): number {
  const top = [...club.players].sort((a, b) => b.overall - a.overall).slice(0, 11);
  return top.reduce((s, p) => s + p.overall, 0) / top.length;
}

function riepilogo() {
  const tutti = SHOWCASE_LEAGUES_DATA.flatMap((l) => l.clubs.flatMap((c) => c.players));
  const club = SHOWCASE_LEAGUES_DATA.flatMap((l) => l.clubs);
  const overalls = tutti.map((p) => p.overall).sort((a, b) => a - b);

  console.log(`\nLeghe vetrina — ${SHOWCASE_LEAGUES_DATA.length} campionati, ${club.length} club, ${tutti.length} giocatori`);
  console.log(
    `Overall: min ${overalls[0]}, mediana ${overalls[Math.floor(overalls.length / 2)]}, ` +
      `media ${(overalls.reduce((s, v) => s + v, 0) / overalls.length).toFixed(1)}, max ${overalls[overalls.length - 1]}`,
  );

  const nazioni = new Set(tutti.map((p) => p.nation));
  console.log(`Nazionalità distinte: ${nazioni.size}\n`);

  for (const lega of SHOWCASE_LEAGUES_DATA) {
    const giocatori = lega.clubs.flatMap((c) => c.players);
    console.log(
      `${lega.name.padEnd(20)} ${String(lega.clubs.length).padStart(2)} club · ` +
        `${String(giocatori.length).padStart(3)} giocatori · banda ${lega.overallRange[0]}-${lega.overallRange[1]}`,
    );
    for (const c of [...lega.clubs].sort((a, b) => forza(b) - forza(a))) {
      console.log(
        `   ${c.name.padEnd(18)} ${String(c.players.length).padStart(2)} giocatori · undici migliori ${forza(c).toFixed(1)}`,
      );
    }
  }
}

async function scriviLega(
  client: Awaited<ReturnType<typeof connectDb>>,
  lega: ShowcaseLeague,
  clubsInSameEra: number,
): Promise<number> {
  const { rows: leagueRow } = await client.query<{ id: string }>(
    `insert into leagues (name, nation, prestige_tier) values ($1, $2, $3) returning id`,
    [lega.name, lega.nation, lega.prestigeTier],
  );
  const leagueId = leagueRow[0]!.id;

  let inseriti = 0;
  for (const club of lega.clubs) {
    const { rows: clubRow } = await client.query<{ id: string }>(
      `insert into clubs (name, league_id, era, prestige_tier) values ($1, $2, $3, $4) returning id`,
      [club.name, leagueId, SHOWCASE_ERA, club.prestigeTier],
    );
    const clubId = clubRow[0]!.id;

    for (const p of club.players) {
      const marketValue = computeMarketValue({
        overall: p.overall,
        leaguePrestigeTier: lega.prestigeTier,
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
  }
  return inseriti;
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
  console.log("Controlli di coerenza: tutti superati.");

  if (!apply) {
    console.log("(dry run — rilancia con `pnpm import-showcase -- --apply` per scrivere)");
    return;
  }

  const client = await connectDb();
  try {
    await client.query("begin");

    const nomi = SHOWCASE_LEAGUES_DATA.map((l) => l.name);

    // Ricrea da zero i soli campionati vetrina: rende lo script rieseguibile senza duplicati.
    await client.query(
      `delete from player_pool where club_id in (
         select c.id from clubs c join leagues l on l.id = c.league_id where l.name = any($1))`,
      [nomi],
    );
    await client.query(
      `delete from clubs where league_id in (select id from leagues where name = any($1))`,
      [nomi],
    );
    await client.query(`delete from leagues where name = any($1)`, [nomi]);

    /**
     * Club nella stessa epoca, per il moltiplicatore di densità del valore di mercato (§2.3).
     * Si contano quelli rimasti **dopo** la cancellazione, più quelli che stiamo per inserire.
     *
     * Nota misurata prima di importare: il moltiplicatore **satura a 20 club** per epoca, e
     * nell'epoca 2025/26 ce ne sono già oltre cento. Aggiungerne altri non muove di un euro i
     * valori esistenti — il che è esattamente ciò che si voleva, perché una carriera in corso
     * non deve vedere i prezzi cambiare da sola.
     */
    const { rows: eraRows } = await client.query<{ n: number }>(
      `select count(*)::int n from clubs where era = $1`,
      [SHOWCASE_ERA],
    );
    const nuoviClub = SHOWCASE_LEAGUES_DATA.reduce((s, l) => s + l.clubs.length, 0);
    const clubsInSameEra = eraRows[0]!.n + nuoviClub;

    let totale = 0;
    for (const lega of SHOWCASE_LEAGUES_DATA) {
      const n = await scriviLega(client, lega, clubsInSameEra);
      console.log(`${lega.name}: ${lega.clubs.length} club, ${n} giocatori`);
      totale += n;
    }

    await client.query("commit");
    console.log(`\nImportati ${totale} giocatori in ${nuoviClub} club vetrina.`);
    console.log("NON rilanciare `pnpm prune-roles`: taglia sotto Overall 65 e svuoterebbe queste rose.");
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
