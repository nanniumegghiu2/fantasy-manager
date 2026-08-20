/**
 * **Sonda diagnostica sugli svincolati.**
 *
 * ⚠️ Segnalazione dell'utente: *"mercato svincolati ancora totalmente inutile, resta altissima la
 * percentuale di giocatori totalmente disinteressati alla trattativa nonostante sia la squadra
 * dominante in nazione"*.
 *
 * Ci sono **tre punti distinti** in cui una trattativa può finire con un no, e a occhio sono
 * indistinguibili: il veto d'ingresso (`wouldConsider`), il punteggio sotto la soglia senza una
 * controproposta sostenibile, e il rivale che offre di più. Prima di ritarare qualcosa bisogna
 * sapere **quale** dei tre scatta e con che frequenza — altrimenti si corregge il numero
 * sbagliato, che in questo motore è già successo.
 *
 * Sola lettura: costruisce il pool dai dati veri del database e non scrive nulla.
 */
import {
  FREE_AGENT_MIN_SCORE,
  buildFreeAgentPool,
  freeAgentBidScore,
  mulberry32,
  resolveFreeAgentBids,
  rivalBidsFor,
  wouldConsider,
  type FreeAgent,
  type FreeAgentBid,
  type RivalClubInfo,
} from "@app/game-engine";
import { ROLE_DEPARTMENT } from "@app/shared-types";
import type { Role } from "@app/shared-types";
import { connectDb } from "./db";

interface Riga {
  id: string;
  name: string;
  overall: number;
  role: Role;
  secondary_roles: Role[];
  club_id: string;
  nation: string;
  birth_date: string | null;
  league_id: string;
  club_name: string;
  club_prestige: number;
}

/** I tre profili di club con cui si misura: il divario è tutto il punto della segnalazione. */
const PROFILI = [
  { nome: "dominante (prestigio 5)", prestigio: 5, ambizione: 1 },
  { nome: "media (prestigio 3)", prestigio: 3, ambizione: 7 },
  { nome: "piccola (prestigio 1)", prestigio: 1, ambizione: 14 },
];

async function main() {
  const db = await connectDb();
  const { rows } = await db.query<Riga>(`
    select p.id, p.name, coalesce(p.overall_override, p.overall) as overall, p.role,
           p.secondary_roles, p.club_id, p.nation, p.birth_date,
           c.league_id, c.name as club_name, c.prestige_tier as club_prestige
    from player_pool p join clubs c on c.id = p.club_id
  `);
  await db.end();

  const worldPlayers = rows.map((r) => ({
    id: r.id,
    name: r.name,
    nation: r.nation,
    role: r.role,
    secondaryRoles: r.secondary_roles ?? [],
    department: ROLE_DEPARTMENT[r.role],
    birthDate: r.birth_date,
    overall: r.overall,
    clubId: r.club_id,
  }));

  const clubPrestige: Record<string, number> = {};
  for (const r of rows) clubPrestige[r.club_id] = r.club_prestige ?? 3;

  // I club rivali: una ventina, con margini plausibili — la stessa forma che `rivalClubsFor`
  // costruisce in partita.
  const perClub = new Map<string, number[]>();
  for (const r of rows) {
    const l = perClub.get(r.club_id) ?? [];
    l.push(r.overall);
    perClub.set(r.club_id, l);
  }
  const rivali: RivalClubInfo[] = [...perClub.entries()]
    .map(([clubId, ovr]) => {
      const undici = [...ovr].sort((a, b) => b - a).slice(0, 11);
      const media = undici.reduce((s, o) => s + o, 0) / Math.max(1, undici.length);
      const prestigio = clubPrestige[clubId] ?? 3;
      return {
        clubId,
        clubName: clubId,
        prestige: prestigio,
        wageRoom: Math.round(600_000 * prestigio * (0.8 + media / 100)),
        needs: ["DIF", "CC", "ATT"] as RivalClubInfo["needs"],
        elevenAverage: media,
      };
    })
    .sort((a, b) => b.elevenAverage - a.elevenAverage)
    .slice(0, 24);

  console.log(`Pool di partenza: ${worldPlayers.length} giocatori, ${perClub.size} club.\n`);

  for (const stagione of [1, 3, 5]) {
    const pool: FreeAgent[] = buildFreeAgentPool({
      worldPlayers,
      seed: "probe-svincolati",
      season: stagione,
      clubPrestige,
    });
    if (pool.length === 0) {
      console.log(`Stagione ${stagione}: vetrina vuota.\n`);
      continue;
    }

    for (const profilo of PROFILI) {
      const conta = {
        accordo: 0,
        conteso: 0,
        veto: 0,
        soglia: 0,
        fuoriPortata: 0,
      };
      let punteggio = 0;

      for (const agente of pool) {
        const nostra: FreeAgentBid = {
          clubId: "mio",
          clubName: "La mia squadra",
          prestige: profilo.prestigio,
          // L'offerta di riferimento: quello che l'interfaccia propone di default, cioè la sua
          // richiesta piena senza garanzie. È il caso che l'utente vive.
          wage: agente.askingWage,
          seasons: agente.askingSeasons,
          guaranteedStarter: false,
          captain: false,
          ambitionTarget: profilo.ambizione,
        };
        punteggio += freeAgentBidScore(agente, nostra);

        const rivaliDiQuesto = rivalBidsFor(agente, rivali, "probe-svincolati", stagione);
        const verdetto = resolveFreeAgentBids(agente, nostra, rivaliDiQuesto, "probe-svincolati", stagione);

        if (verdetto.outcome === "accordo") conta.accordo++;
        else if (verdetto.outcome === "conteso") conta.conteso++;
        else if (!wouldConsider(agente, nostra)) conta.veto++;
        else if (verdetto.score < FREE_AGENT_MIN_SCORE) conta.soglia++;
        else conta.fuoriPortata++;
      }

      const n = pool.length;
      const pc = (v: number) => `${((v / n) * 100).toFixed(0)}%`;
      console.log(
        `Stagione ${stagione} · club ${profilo.nome} · ${n} svincolati\n` +
          `  accordo subito     ${pc(conta.accordo)}\n` +
          `  contesi (trattabili) ${pc(conta.conteso)}\n` +
          `  DISINTERESSATI     ${pc(conta.veto + conta.soglia + conta.fuoriPortata)}` +
          `   → veto d'ingresso ${pc(conta.veto)} · sotto soglia ${pc(conta.soglia)} · rivale fuori portata ${pc(conta.fuoriPortata)}\n` +
          `  punteggio medio della nostra offerta: ${(punteggio / n).toFixed(1)} (serve ${FREE_AGENT_MIN_SCORE})\n`,
      );
    }
  }

  // Un controllo di coerenza sul rumore: la scelta non deve dipendere dal seme più che
  // dall'offerta, altrimenti la vetrina è una lotteria e non una trattativa.
  const campione = buildFreeAgentPool({
    worldPlayers,
    seed: "probe-svincolati",
    season: 1,
    clubPrestige,
  })[0];
  if (campione) {
    let accordi = 0;
    for (let s = 0; s < 50; s++) {
      const random = mulberry32(s);
      void random;
      const v = resolveFreeAgentBids(
        campione,
        {
          clubId: "mio",
          clubName: "La mia squadra",
          prestige: 5,
          wage: Math.round(campione.askingWage * 1.25),
          seasons: campione.askingSeasons,
          guaranteedStarter: true,
          captain: false,
          ambitionTarget: 1,
        },
        [],
        `rumore-${s}`,
        1,
      );
      if (v.accepted) accordi++;
    }
    console.log(
      `Controllo: con un'offerta generosa e senza rivali, ${campione.name} firma in ${accordi}/50 semi.`,
    );
  }
}

probeSottoRichiesta;
main().then(() => probeSottoRichiesta()).catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * **E se non si può offrire quanto chiede?**
 *
 * È il caso che l'utente vive davvero: il margine ingaggi non è infinito, quindi si ritocca la
 * cifra verso il basso. Qui si misura cosa succede a ciascun gradino — ed è dove ci si aspetta
 * di trovare il muro, perché `FREE_AGENT_WAGE_FLOOR` fa collassare il punteggio sotto metà.
 */
export async function probeSottoRichiesta() {
  const db = await connectDb();
  const { rows } = await db.query<Riga>(`
    select p.id, p.name, coalesce(p.overall_override, p.overall) as overall, p.role,
           p.secondary_roles, p.club_id, p.nation, p.birth_date,
           c.league_id, c.name as club_name, c.prestige_tier as club_prestige
    from player_pool p join clubs c on c.id = p.club_id
  `);
  await db.end();

  const worldPlayers = rows.map((r) => ({
    id: r.id,
    name: r.name,
    nation: r.nation,
    role: r.role,
    secondaryRoles: r.secondary_roles ?? [],
    department: ROLE_DEPARTMENT[r.role],
    birthDate: r.birth_date,
    overall: r.overall,
    clubId: r.club_id,
  }));
  const clubPrestige: Record<string, number> = {};
  for (const r of rows) clubPrestige[r.club_id] = r.club_prestige ?? 3;

  const pool = buildFreeAgentPool({ worldPlayers, seed: "probe-sotto", season: 3, clubPrestige });
  console.log(`\n--- Offerta ridotta (club dominante, titolarità concessa) · ${pool.length} svincolati ---`);
  for (const quota of [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45]) {
    let accordo = 0;
    let conteso = 0;
    let disinteressato = 0;
    for (const agente of pool) {
      const v = resolveFreeAgentBids(
        agente,
        {
          clubId: "mio",
          clubName: "La mia squadra",
          prestige: 5,
          wage: Math.round(agente.askingWage * quota),
          seasons: agente.askingSeasons,
          guaranteedStarter: true,
          captain: false,
          ambitionTarget: 1,
        },
        [],
        "probe-sotto",
        3,
      );
      if (v.outcome === "accordo") accordo++;
      else if (v.outcome === "conteso") conteso++;
      else disinteressato++;
    }
    const n = pool.length;
    const pc = (v: number) => `${((v / n) * 100).toFixed(0)}%`;
    console.log(
      `  offerta al ${(quota * 100).toFixed(0)}% del richiesto → accordo ${pc(accordo)} · trattabile ${pc(conteso)} · DISINTERESSATO ${pc(disinteressato)}`,
    );
  }
}
