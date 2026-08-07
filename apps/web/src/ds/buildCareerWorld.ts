import {
  CONTINENTAL_TEAMS,
  INHERITED_SINCE_SEASON,
  QUALIFIERS_PER_LEAGUE,
  ageInSeason,
  bestElevenByDepartment,
  careerOpponentTeam,
  createRosterEntry,
  estimatePotential,
  evolveWorld,
  initialBudget,
  planWorldTransfers,
  type CareerWorld,
  type DsDifficulty,
  type GeneratedPlayer,
  type LeagueTeam,
  type PlayerIndex,
  type ResolvedPlayer,
  type RosterEntry,
  type WorldClub,
  type WorldPlayer,
  type WorldTransfer,
} from "@app/game-engine";
import type { Player } from "@app/shared-types";
import type { DsClub, DsWorldData } from "./useDsWorld";

/**
 * Traduce il **database** nel **mondo** che il motore si aspetta.
 *
 * Sta in `apps/web` e non nel motore per una ragione precisa: qui dentro non c'è simulazione,
 * solo la mappatura fra le tabelle Supabase e i tipi puri di `packages/game-engine`. La regola
 * di confine del progetto (CLAUDE.md sez. 9) chiede il contrario solo per ciò che è verificabile
 * con un test senza montare un componente — e questo file esiste per forma dei dati, non per
 * regole di gioco.
 */

/** Quante squadre ha un campionato: decide anche le giornate (20 → 38, 18 → 34). */
function leagueSize(clubs: DsClub[]): number {
  // Un campionato con un numero dispari di club non può giocare all'italiana: si scende al
  // pari più vicino, esattamente come fa `fillLeague` nel motore.
  return clubs.length % 2 === 0 ? clubs.length : clubs.length - 1;
}

/** I club di un campionato, ordinati per forza dei loro undici migliori. */
export function clubsOfLeague(world: DsWorldData, leagueId: string): DsClub[] {
  return world.clubs.filter((club) => club.leagueId === leagueId);
}

/** Forza di un club, dai suoi undici migliori: è il numero mostrato nel selettore. */
export function clubRating(world: DsWorldData, clubId: string): number {
  const players = world.playersByClub.get(clubId) ?? [];
  if (players.length === 0) return 0;
  const eleven = bestElevenByDepartment(players);
  if (eleven.length === 0) return 0;
  return Math.round(eleven.reduce((sum, p) => sum + p.overall, 0) / eleven.length);
}

/**
 * Le venti iscritte alla Corona Continentale della prima stagione.
 *
 * Sono le prime quattro di ogni campionato, con un criterio dichiarato: la forza degli undici
 * migliori. `CONTINENTAL_SEED_CLUBS` resta la stima editoriale di riferimento, ma va risolta
 * contro i club **realmente presenti** nel database, non data per scontata — un club rinominato
 * o non ancora inserito farebbe altrimenti un torneo a diciannove.
 */
export function continentalEntrants(world: DsWorldData): { clubIds: string[]; leagues: string[] } {
  const clubIds: string[] = [];
  const leagues: string[] = [];
  const escluse: { id: string; leagueId: string; rating: number }[] = [];

  for (const league of world.leagues) {
    const ordinati = clubsOfLeague(world, league.id)
      .map((club) => ({ club, rating: clubRating(world, club.id) }))
      .sort((a, b) => b.rating - a.rating);

    for (const { club } of ordinati.slice(0, QUALIFIERS_PER_LEAGUE)) {
      clubIds.push(club.id);
      leagues.push(league.id);
    }
    // Le prime escluse restano in lista d'attesa per i ripescaggi.
    for (const { club, rating } of ordinati.slice(QUALIFIERS_PER_LEAGUE)) {
      escluse.push({ id: club.id, leagueId: league.id, rating });
    }
  }

  // Si completa il tabellone con le migliori fra le escluse, in ordine di forza: è il modo di
  // non chiudere la porta a un campionato particolarmente forte in quella stagione.
  escluse.sort((a, b) => b.rating - a.rating);
  for (const club of escluse) {
    if (clubIds.length >= CONTINENTAL_TEAMS) break;
    clubIds.push(club.id);
    leagues.push(club.leagueId);
  }

  return {
    clubIds: clubIds.slice(0, CONTINENTAL_TEAMS),
    leagues: leagues.slice(0, CONTINENTAL_TEAMS),
  };
}

export interface CareerWorldInput {
  world: DsWorldData;
  clubId: string;
  /** Stagione corrente: serve per calcolare le età, che cambiano di anno in anno. */
  season: number;
  /** Seme della carriera: governa l'evoluzione del mondo (ritiri, regen, mercato IA). */
  seed: string;
  /** I trasferimenti già avvenuti fra squadre del computer. */
  transfers: readonly WorldTransfer[];
  /** Giocatori passati alla nostra rosa: il mondo non li ha più. */
  ownedByUser: ReadonlySet<string>;
  difficulty: DsDifficulty;
  /**
   * I giocatori **inventati dalla carriera** (regen dei nostri ritirati).
   *
   * Non esistono nel database, quindi vanno iniettati qui: senza, il mercato non ne conosce il
   * nome e le proposte di prestito li chiamano "Giocatore". È lo stesso difetto già corretto
   * per l'anagrafica generale, ricomparso nel **mondo del mercato**, che è un secondo indice.
   */
  generated?: readonly GeneratedPlayer[];
}

/** Traduce il pool del database nella forma che il mondo vivo si aspetta. */
function toWorldPlayers(world: DsWorldData): WorldPlayer[] {
  return world.players.map((p) => ({
    id: p.id,
    name: p.name,
    nation: p.nation,
    role: p.role,
    secondaryRoles: p.secondaryRoles,
    department: p.department,
    birthDate: p.birthDate,
    overall: p.overall,
    clubId: p.clubId,
  }));
}

function toWorldClubs(world: DsWorldData): WorldClub[] {
  return world.clubs.map((c) => ({
    id: c.id,
    name: c.name,
    leagueId: c.leagueId,
    prestigeTier: c.prestigeTier,
  }));
}

/**
 * Costruisce il `CareerWorld` per un club.
 *
 * Va ricostruito **a ogni stagione**, perché le età cambiano: `ageOf` è una funzione del
 * mondo, non dello stato, e un mondo congelato alla prima stagione farebbe restare tutti
 * ventenni per dieci anni.
 */
export function buildCareerWorld({
  world,
  clubId,
  season,
  seed,
  transfers,
  ownedByUser,
  generated = [],
}: CareerWorldInput): CareerWorld {
  const club = world.clubsById.get(clubId);
  const leagueId = club?.leagueId ?? "";
  const leagueClubs = clubsOfLeague(world, leagueId);
  const size = leagueSize(leagueClubs);

  /**
   * **Il mondo com'è adesso**, non com'era nel database: invecchiato, senza i ritirati, coi
   * regen al loro posto e coi trasferimenti dell'IA già applicati. Da qui in giù tutto —
   * avversarie, coppa, mercato, ricerca — legge questa fotografia e non il pool statico.
   */
  const worldClubs = toWorldClubs(world);
  // Regen nati da un nostro ritirato ma atterrati a caso in un club che non è il nostro (sez.
  // "niente trucco compra-e-aspetta-il-ritiro" — packages/game-engine/src/ds/career.ts): il
  // mondo deve innestarli nel club di destinazione, altrimenti sarebbero generati ma invisibili.
  const externalRegens = generated
    .filter((p) => p.destinationClubId && p.destinationClubId !== clubId)
    .map((p) => ({ destinationClubId: p.destinationClubId!, player: p }));

  const evolved = evolveWorld({
    clubs: worldClubs,
    players: toWorldPlayers(world),
    ownClubId: clubId,
    ownedByUser,
    seed,
    season,
    transfers,
    externalRegens,
  });

  const rosaDi = (id: string): Player[] => (evolved.byClub.get(id) ?? []) as unknown as Player[];

  // Le avversarie: tutte le altre del campionato, tagliate alla dimensione pari più vicina.
  const opponents = leagueClubs
    .filter((c) => c.id !== clubId)
    .map((c) => careerOpponentTeam({ id: c.id, name: c.name, players: rosaDi(c.id) }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, size - 1);

  // Anagrafica: il pool del database (serve anche per chi è nella **nostra** rosa, che il
  // mondo non contiene) più i giocatori nati in carriera nelle squadre del computer.
  const players: Record<string, ResolvedPlayer> = {};
  for (const player of world.players) {
    players[player.id] = {
      id: player.id,
      name: player.name,
      nation: player.nation,
      role: player.role,
      secondaryRoles: player.secondaryRoles,
      department: player.department,
      birthDate: player.birthDate,
    };
  }
  for (const generato of evolved.byId.values()) {
    if (!generato.regen) continue;
    players[generato.id] = {
      id: generato.id,
      name: generato.name,
      nation: generato.nation,
      role: generato.role,
      secondaryRoles: generato.secondaryRoles,
      department: generato.department,
      birthDate: generato.birthDate,
    };
  }

  const entrants = continentalEntrants(world);
  const cupTeams: Record<string, LeagueTeam> = {};
  for (const id of entrants.clubIds) {
    const c = world.clubsById.get(id);
    if (c) cupTeams[id] = careerOpponentTeam({ id: c.id, name: c.name, players: rosaDi(c.id) });
  }

  /**
   * **La nostra squadra va costruita a parte, sempre.**
   *
   * `evolveWorld` esclude i nostri giocatori dal mondo — giustamente, li gestisce la carriera —
   * quindi `rosaDi(nostroClub)` restituisce una lista **vuota**. Il giro qui sopra la
   * attraversava comunque quando eravamo fra le teste di serie, cioè proprio quando la squadra
   * è forte, e ci iscriveva alla Corona con forza 70: la più debole del torneo. Il sintomo era
   * quello segnalato dall'utente — una squadra fortissima che non superava mai il girone.
   *
   * Il valore qui è solo l'anagrafica di riserva: la forza vera la sostituisce il riduttore
   * con quella della rosa reale (`squadStrengthOf`), come già fa per il campionato.
   */
  if (club) {
    cupTeams[club.id] = careerOpponentTeam({
      id: club.id,
      name: club.name,
      players: (world.playersByClub.get(club.id) ?? []) as Player[],
    });
  }

  const ageOf = (playerId: string) => ageInSeason(players[playerId]?.birthDate, season) ?? 25;

  return {
    players,
    opponents,
    clubName: club?.name ?? "La mia squadra",
    leagueRounds: (size - 1) * 2,
    /**
     * **Le iscritte alla Corona ci sono sempre**, anche quando quest'anno non la giochiamo.
     *
     * Prima venivano allegate solo `if (inCup)`, e la conseguenza era un vicolo cieco: chi non
     * era in coppa non aveva `cupEntrants` nel mondo, quindi `nextSeasonCup` non sapeva con chi
     * costruirla e restituiva "niente Corona" — **qualificarsi diventava impossibile**, e chi
     * ne usciva una volta non poteva più rientrarci. Sono sedici club: allegarli sempre non
     * costa nulla, e a decidere se si gioca resta `state.cup`, non la presenza dei dati.
     */
    cupTeams,
    cupEntrants: entrants,
    market: buildMarketWorld(world, evolved, clubId, ageOf, generated, ownedByUser),
    // Il mercato del mondo si ricalcola sulla fotografia di **questa** stagione.
    planTransfers: (stagione) =>
      planWorldTransfers({
        clubs: worldClubs,
        byClub: evolved.byClub,
        ownClubId: clubId,
        seed,
        season: stagione,
      }),
  };
}

/**
 * Il mondo del mercato: club acquirenti, giocatori acquistabili, contesto di valutazione.
 *
 * Legge il **mondo evoluto**, non il database: chi si è ritirato non compare fra gli
 * acquistabili, chi è cresciuto costa di più, e chi è stato comprato da un altro club risulta
 * lì e non dov'era all'inizio della carriera.
 */
function buildMarketWorld(
  world: DsWorldData,
  evolved: ReturnType<typeof evolveWorld>,
  ownClubId: string,
  ageOf: (playerId: string) => number,
  generated: readonly GeneratedPlayer[],
  ownedByUser: ReadonlySet<string>,
): NonNullable<CareerWorld["market"]> {
  const clubs: NonNullable<CareerWorld["market"]>["clubs"] = {};
  const leaguePrestigeByClub: Record<string, number> = {};
  const clubPrestige: Record<string, number> = {};

  for (const club of world.clubs) {
    const rosa = (evolved.byClub.get(club.id) ?? []) as unknown as Player[];
    clubs[club.id] = {
      id: club.id,
      name: club.name,
      leagueId: club.leagueId,
      startingEleven: bestElevenByDepartment(rosa).map((p) => p.overall),
    };
    leaguePrestigeByClub[club.id] = world.leaguesById.get(club.leagueId)?.prestigeTier ?? 3;
    clubPrestige[club.id] = club.prestigeTier;
  }

  /**
   * **Anagrafica ≠ acquistabili.** Sono due cose diverse e confonderle è già costato caro:
   * restringendo `players` ai soli giocatori altrui, `buildOffers` — che scarta chi non trova
   * nell'anagrafica — smetteva di generare **qualunque** offerta per i nostri, e le proposte di
   * prestito mostravano "Giocatore" al posto del nome. L'anagrafica deve coprire tutti;
   * `transferPool` è l'unica cosa che si filtra.
   */
  const nelMondo = [...evolved.byId.values()];
  // Acquistabile è chi non è già nostro. Il controllo su `ownedByUser` serve per i **regen**,
  // che restano in anagrafica anche dopo l'acquisto (per avere nome e ruolo) ma non devono
  // ricomparire fra chi si può comprare.
  const acquistabili = nelMondo.filter((p) => p.clubId !== ownClubId && !ownedByUser.has(p.id));

  const anagrafica: PlayerIndex = {};
  for (const p of nelMondo) {
    anagrafica[p.id] = {
      id: p.id,
      name: p.name,
      nation: p.nation,
      role: p.role,
      secondaryRoles: p.secondaryRoles,
    };
  }
  // I nostri: il mondo non li contiene, ma il mercato deve saperne nome e ruolo.
  for (const p of world.playersByClub.get(ownClubId) ?? []) {
    anagrafica[p.id] = {
      id: p.id,
      name: p.name,
      nation: p.nation,
      role: p.role,
      secondaryRoles: p.secondaryRoles,
    };
  }
  // E i ragazzi nati in carriera: non stanno né nel database né nel mondo, quindi senza questo
  // giro le proposte di prestito li chiamerebbero "Giocatore".
  for (const p of generated) {
    anagrafica[p.id] = {
      id: p.id,
      name: p.name,
      nation: p.nation,
      role: p.role,
      secondaryRoles: p.secondaryRoles,
    };
  }

  return {
    clubs,
    // Acquistabile è chiunque non sia già nostro. Il filtro per prezzo e livello lo fa il
    // motore: qui non si decide nulla, si espone il pool.
    transferPool: acquistabili.map((p) => ({
      playerId: p.id,
      clubId: p.clubId,
      overall: p.overall,
      potential: estimatePotential(p.overall, ageOf(p.id)),
      age: ageOf(p.id),
      nation: p.nation,
      department: p.department,
      stats: { appearances: 0, minutes: 0, goals: 0, assists: 0 },
    })),
    valuation: {
      leaguePrestigeByClub,
      clubPrestige,
      clubsInSameEra: world.clubs.length,
    },
    players: anagrafica,
    nameOf: (id) => anagrafica[id]?.name ?? "Giocatore",
    ageOf,
    leagueRounds: 38,
  };
}

/** La rosa iniziale del club scelto, con potenziale stimato dall'età. */
export function initialRoster(world: DsWorldData, clubId: string, season = 1): RosterEntry[] {
  const players = world.playersByClub.get(clubId) ?? [];
  return players.map((player) =>
    createRosterEntry({
      playerId: player.id,
      overall: player.overall,
      potential: estimatePotential(player.overall, ageInSeason(player.birthDate, season) ?? 25),
      // Il gruppo che si eredita è già rodato: sono al club da anni, non arrivati oggi.
      sinceSeason: INHERITED_SINCE_SEASON,
    }),
  );
}

/** Budget di partenza, dal livello della rosa: un club forte comincia con più mezzi. */
export function startingBudget(roster: RosterEntry[], difficulty: DsDifficulty = "normale"): number {
  if (roster.length === 0) return 0;
  const media = roster.reduce((sum, e) => sum + e.overall, 0) / roster.length;
  return initialBudget(media, difficulty);
}

/** Gli undici migliori di un club, per l'anteprima nel selettore. */
export function clubHighlights(world: DsWorldData, clubId: string): Player[] {
  const players = world.playersByClub.get(clubId) ?? [];
  return [...players].sort((a, b) => b.overall - a.overall).slice(0, 3);
}
