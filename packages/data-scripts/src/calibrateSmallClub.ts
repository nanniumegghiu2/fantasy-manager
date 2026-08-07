/**
 * **La scalata di una piccola è possibile?**
 *
 * L'utente ha segnalato che partendo da un club di bassa classifica la retrocessione è quasi
 * certa, e ha chiesto che un buon mercato venga premiato fino a rendere raggiungibile il
 * trionfo nell'arco delle dieci stagioni. Questa è la misura, non la stima: si prende un club
 * reale fra i più deboli di un campionato e si simulano le stagioni con tre condotte diverse.
 *
 *  - **Immobile**: non si fa mercato. È il caso peggiore, e serve da riferimento.
 *  - **Solo acquisti**: si spende il budget in giocatori migliori dei propri.
 *  - **Mercato completo**: si vendono i fuori rosa (che non giocano comunque) e si concentra
 *    tutto sull'undici titolare. È la strategia che la modalità vuole premiare.
 *
 * Il confronto fra la seconda e la terza dice se la meccanica funziona: se vendere il fondo
 * rosa non cambia nulla, la "scalata" è una dichiarazione e non un gioco.
 *
 * Strumento di **sola lettura**: non tocca il database.
 */
import {
  MAX_SQUAD_SIZE,
  MIN_SQUAD_SIZE,
  aiOverallInSeason,
  bestElevenByDepartment,
  careerOpponentTeam,
  computeSquadStrength,
  createLeagueState,
  buildStandings,
  getFormation,
  initialBudget,
  pickStartingEleven,
  simulateMatchday,
  mulberry32,
  hashSeed,
  type DsDifficulty,
  type LeagueTeam,
} from "@app/game-engine";
import { ROLE_DEPARTMENT } from "@app/shared-types";
import type { Player, Role } from "@app/shared-types";
import { connectDb } from "./db";

const STAGIONI = 6;
const RIPETIZIONI = 40;
const MODULO = "4-3-3";

type Condotta = "immobile" | "solo_acquisti" | "mercato_completo";

interface Riga {
  id: string;
  name: string;
  overall: number;
  role: Role;
  secondary_roles: Role[];
  club_id: string;
  nation: string;
  birth_date: string | null;
  market_value: number;
}

async function main() {
  const db = await connectDb();
  const { rows } = await db.query<Riga & { league_id: string; club_name: string }>(`
    select p.id, p.name, coalesce(p.overall_override, p.overall) as overall, p.role,
           p.secondary_roles, p.club_id, p.nation, p.birth_date, p.market_value,
           c.league_id, c.name as club_name
    from player_pool p join clubs c on c.id = p.club_id
  `);
  await db.end();

  const perLega = new Map<string, typeof rows>();
  for (const r of rows) {
    const elenco = perLega.get(r.league_id);
    if (elenco) elenco.push(r);
    else perLega.set(r.league_id, [r]);
  }

  // Il campionato con più club: è quello in cui la lotta salvezza è più affollata.
  const [legaId, giocatoriLega] = [...perLega.entries()].sort(
    (a, b) => new Set(b[1].map((p) => p.club_id)).size - new Set(a[1].map((p) => p.club_id)).size,
  )[0]!;

  const clubIds = [...new Set(giocatoriLega.map((p) => p.club_id))];
  const forzaClub = clubIds
    .map((id) => {
      const rosa = giocatoriLega.filter((p) => p.club_id === id).map(toPlayer);
      const undici = bestElevenByDepartment(rosa);
      return {
        id,
        name: giocatoriLega.find((p) => p.club_id === id)!.club_name,
        rating: undici.reduce((s, p) => s + p.overall, 0) / Math.max(undici.length, 1),
      };
    })
    .sort((a, b) => a.rating - b.rating);

  const piccola = forzaClub[1]!; // la seconda più debole: quella che deve salvarsi
  console.log(`Campionato: ${legaId} · ${clubIds.length} club`);
  console.log(
    `Club di prova: ${piccola.name} (undici migliori ${piccola.rating.toFixed(1)}, ` +
      `il più forte del campionato è ${forzaClub[forzaClub.length - 1]!.rating.toFixed(1)})\n`,
  );

  const formation = getFormation(MODULO)!;

  console.log("difficoltà  condotta            pos. media  retrocessioni  miglior pos.  titoli");
  console.log("─".repeat(84));

  for (const difficulty of ["difficile", "normale", "facile"] as DsDifficulty[]) {
    for (const condotta of ["immobile", "solo_acquisti", "mercato_completo"] as Condotta[]) {
      const posizioni: number[] = [];
      let retrocessioni = 0;
      let titoli = 0;

      for (let run = 0; run < RIPETIZIONI; run++) {
        const random = mulberry32(hashSeed(`${difficulty}-${condotta}-${run}`));
        let rosa = giocatoriLega.filter((p) => p.club_id === piccola.id).map(toPlayer);
        let budget = initialBudget(
          rosa.reduce((s, p) => s + p.overall, 0) / rosa.length,
          difficulty,
        );
        let posizionePrecedente: number | undefined;

        for (let stagione = 1; stagione <= STAGIONI; stagione++) {
          // Il mondo invecchia: anche le avversarie, non solo noi.
          const mondo = giocatoriLega
            .map((p) => ({
              ...toPlayer(p),
              overall: aiOverallInSeason(p.overall, p.birth_date, stagione),
            }))
            .filter((p) => !rosa.some((mio) => mio.id === p.id));

          if (condotta !== "immobile") {
            const esito = faiMercato(rosa, mondo, budget, condotta, random, formation);
            rosa = esito.rosa;
            budget = esito.budget;
          }

          const lineup = pickStartingEleven(
            formation,
            rosa.map(toEntry),
            Object.fromEntries(rosa.map((p) => [p.id, p])),
          );
          const starters: Record<string, Player> = {};
          for (const [slotId, playerId] of Object.entries(lineup.starters)) {
            const p = rosa.find((x) => x.id === playerId);
            if (p) starters[slotId] = p;
          }
          // Affiatamento pieno: il gruppo è insieme da anni, come le avversarie.
          const nostra = computeSquadStrength(formation, starters, { cohesionBonus: 8 });

          const avversarie: LeagueTeam[] = clubIds
            .filter((id) => id !== piccola.id)
            .map((id) =>
              careerOpponentTeam({
                id,
                name: id,
                players: mondo.filter((p) => p.clubId === id),
              }),
            );

          const posizione = simulaStagione(nostra, avversarie, random);
          if (stagione === STAGIONI) {
            posizioni.push(posizione);
            if (posizione === 1) titoli++;
          }
          if (posizione > clubIds.length - 3) {
            retrocessioni++;
            posizioni.push(posizione);
            break;
          }

          // Budget dell'anno dopo, con il premio al miglioramento.
          const media = rosa.reduce((s, p) => s + p.overall, 0) / rosa.length;
          budget =
            initialBudget(media, difficulty) *
              moltiplicatorePosizione(posizione) *
              moltiplicatoreMiglioramento(posizione, posizionePrecedente) +
            budget * 0.3;
          posizionePrecedente = posizione;
        }
      }

      const media = posizioni.reduce((s, p) => s + p, 0) / Math.max(posizioni.length, 1);
      console.log(
        `${difficulty.padEnd(11)} ${condotta.padEnd(19)} ${media.toFixed(1).padStart(9)}  ` +
          `${`${Math.round((retrocessioni / RIPETIZIONI) * 100)}%`.padStart(12)}  ` +
          `${String(Math.min(...posizioni)).padStart(11)}  ${String(titoli).padStart(6)}`,
      );
    }
    console.log("─".repeat(84));
  }
}

/* -------------------------------------------------------------------------- */

function toPlayer(r: Riga & { league_id?: string }): Player {
  return {
    id: r.id,
    name: r.name,
    overall: Number(r.overall),
    marketValue: Number(r.market_value),
    clubId: r.club_id,
    era: "",
    nation: r.nation,
    league: r.league_id ?? "",
    role: r.role,
    secondaryRoles: r.secondary_roles ?? [],
    department: ROLE_DEPARTMENT[r.role],
    birthDate: r.birth_date,
  };
}

function toEntry(p: Player) {
  return {
    playerId: p.id,
    overall: p.overall,
    potential: p.overall,
    sinceSeason: -3,
    morale: 70,
    injuryMatchdaysLeft: 0,
    fatigue: 0,
    stats: { appearances: 0, minutes: 0, goals: 0, assists: 0 },
  };
}

/**
 * Il mercato di una stagione.
 *
 * "Solo acquisti" spende finché può; "mercato completo" prima **libera posti e casse** cedendo
 * il fondo rosa — che non gioca comunque — e poi compra. È la differenza che il test deve
 * misurare.
 */
function faiMercato(
  rosa: Player[],
  mondo: Player[],
  budget: number,
  condotta: Condotta,
  random: () => number,
  formation: ReturnType<typeof getFormation>,
) {
  let attuale = [...rosa];
  let cassa = budget;

  if (condotta === "mercato_completo") {
    // Si cede il fondo rosa: chi non entra nell'undici e vale meno.
    const ordinati = [...attuale].sort((a, b) => a.overall - b.overall);
    const daCedere = ordinati.slice(0, Math.max(0, attuale.length - MIN_SQUAD_SIZE - 1));
    for (const p of daCedere) {
      cassa += valore(p) * 0.78;
      attuale = attuale.filter((x) => x.id !== p.id);
    }
  }

  const undiciAttuale = pickStartingEleven(
    formation!,
    attuale.map(toEntry),
    Object.fromEntries(attuale.map((p) => [p.id, p])),
  );
  const titolari = new Set(Object.values(undiciAttuale.starters));
  const peggiorTitolare = Math.min(
    ...attuale.filter((p) => titolari.has(p.id)).map((p) => p.overall),
  );

  // Si comprano i migliori che il budget consente, purché migliorino l'undici.
  const candidati = mondo
    .filter((p) => p.overall > peggiorTitolare + 1)
    .map((p) => ({ p, prezzo: valore(p) }))
    .filter((c) => c.prezzo <= cassa)
    .sort((a, b) => b.p.overall - a.p.overall);

  for (const c of candidati) {
    if (attuale.length >= MAX_SQUAD_SIZE) break;
    if (c.prezzo > cassa) continue;
    if (attuale.some((x) => x.id === c.p.id)) continue;
    cassa -= c.prezzo;
    attuale.push(c.p);
    if (random() < 0.15) break; // non si spende tutto sempre: resta un margine
  }

  return { rosa: attuale, budget: cassa };
}

/** Valore indicativo: la stessa curva del gioco, senza il contesto di club. */
function valore(p: Player): number {
  return Math.max(200_000, Math.pow(Math.max(0, p.overall - 58) / 8, 3.2) * 900_000);
}

function moltiplicatorePosizione(position: number): number {
  if (position === 1) return 1.6;
  if (position <= 4) return 1.35;
  if (position <= 7) return 1.15;
  if (position <= 12) return 1.0;
  return 0.95;
}

function moltiplicatoreMiglioramento(position: number, precedente: number | undefined): number {
  if (precedente === undefined) return 1;
  const salto = precedente - position;
  if (salto >= 8) return 1.45;
  if (salto >= 4) return 1.25;
  if (salto >= 1) return 1.1;
  return 1;
}

/** Simula un campionato e restituisce la posizione finale della nostra squadra. */
function simulaStagione(
  nostra: { attack: number; defence: number },
  avversarie: LeagueTeam[],
  random: () => number,
): number {
  const teams: LeagueTeam[] = [
    {
      id: "mio",
      name: "La mia squadra",
      rating: Math.round((nostra.attack + nostra.defence) / 2),
      strength: nostra,
    },
    ...avversarie,
  ];
  // La taglia dev'essere pari: il calendario all'italiana lo richiede.
  const pari = teams.length % 2 === 0 ? teams : teams.slice(0, teams.length - 1);
  const league = createLeagueState(pari, random);
  const giornate = (pari.length - 1) * 2;
  for (let g = 0; g < giornate; g++) simulateMatchday(league, random);
  return buildStandings(league, 0).find((r) => r.isUser)!.position;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
