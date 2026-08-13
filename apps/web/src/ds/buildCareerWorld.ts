import {
  CONTINENTAL_TEAMS,
  INHERITED_SINCE_SEASON,
  QUALIFIERS_PER_LEAGUE,
  ageInSeason,
  bestElevenByDepartment,
  careerOpponentTeam,
  createRosterEntry,
  DIVISION_PAIRS,
  estimatePotential,
  evolveWorld,
  initialBudget,
  isContinentalEligible,
  leagueOfClub,
  marketPlayerIndex,
  planWorldTransfers,
  type CareerWorld,
  type DivisionMove,
  type DivisionWorld,
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

/**
 * I club di un campionato, **dopo** le promozioni e retrocessioni già avvenute.
 *
 * `club.leagueId` è l'appartenenza del database, cioè quella della prima stagione. Da quando
 * esistono le due divisioni italiane non basta più: alla terza stagione di una carriera il
 * Palermo può essere in Serie A e il Venezia in Serie B, e leggere il campo grezzo darebbe il
 * campionato del 2025/26 invece di quello che si sta giocando.
 *
 * `moves` vuoto (il caso di ogni carriera in Premier, Liga, Bundesliga o Ligue 1, e di ogni
 * salvataggio precedente) riporta esattamente al comportamento di prima.
 */
export function clubsOfLeague(
  world: DsWorldData,
  leagueId: string,
  moves: readonly DivisionMove[] = [],
): DsClub[] {
  if (moves.length === 0) return world.clubs.filter((club) => club.leagueId === leagueId);

  const pair = divisionPairIds(world);
  if (!pair) return world.clubs.filter((club) => club.leagueId === leagueId);

  return world.clubs.filter(
    (club) =>
      leagueOfClub(club.id, club.leagueId, moves, pair.topLeagueId, pair.secondLeagueId) ===
      leagueId,
  );
}

/**
 * Gli id delle due leghe collegate da promozione/retrocessione, se entrambe sono nel database.
 *
 * Torna `null` quando la seconda divisione non è stata ancora importata: in quel caso la
 * carriera si comporta come prima dell'introduzione del sistema, senza movimenti. È ciò che
 * permette di girare su un database parziale senza casi speciali sparsi.
 */
export function divisionPairIds(
  world: DsWorldData,
): { topLeagueId: string; secondLeagueId: string; topLeagueName: string; secondLeagueName: string } | null {
  for (const pair of DIVISION_PAIRS) {
    const top = world.leagues.find((l) => l.name === pair.top);
    const second = world.leagues.find((l) => l.name === pair.second);
    if (top && second) {
      return {
        topLeagueId: top.id,
        secondLeagueId: second.id,
        topLeagueName: top.name,
        secondLeagueName: second.name,
      };
    }
  }
  return null;
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
    /**
     * **Le seconde divisioni non entrano in Corona** (`divisions.ts`).
     *
     * Senza questo filtro il giro qui sotto prenderebbe le prime tre di *ogni* campionato
     * presente nel database, Serie B compresa: tre club di seconda divisione si sarebbero
     * trovati nel torneo continentale il giorno stesso in cui la Serie B è stata importata.
     */
    if (!isContinentalEligible(league.name)) continue;

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
  /**
   * Le promozioni e retrocessioni già avvenute in questa carriera.
   *
   * Senza, il mondo continuerebbe a leggere l'appartenenza del database — cioè quella della
   * prima stagione — e alla terza annata di una carriera in Serie B si giocherebbe contro le
   * squadre di Serie A del 2025/26.
   */
  divisionMoves?: readonly DivisionMove[];
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
  divisionMoves = [],
}: CareerWorldInput): CareerWorld {
  const club = world.clubsById.get(clubId);
  const pair = divisionPairIds(world);
  /**
   * **Dove giochiamo adesso**, non dove eravamo nel database: dopo una retrocessione il nostro
   * club appartiene all'altra lega, e da quel campionato devono uscire le avversarie.
   */
  const leagueId = club
    ? pair
      ? leagueOfClub(club.id, club.leagueId, divisionMoves, pair.topLeagueId, pair.secondLeagueId)
      : club.leagueId
    : "";
  const leagueClubs = clubsOfLeague(world, leagueId, divisionMoves);
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

  /**
   * Le due divisioni, quando entrambe sono nel database.
   *
   * `teams` copre **tutti** i club di Serie A e Serie B, non solo quelli del nostro campionato:
   * a fine stagione il motore simula la lega gemella per sapere chi sale e chi scende, e senza
   * le loro forze non avrebbe con cosa giocarla.
   */
  const divisions: DivisionWorld | undefined = pair
    ? {
        topLeagueId: pair.topLeagueId,
        secondLeagueId: pair.secondLeagueId,
        topLeagueName: pair.topLeagueName,
        secondLeagueName: pair.secondLeagueName,
        clubsByLeague: {
          [pair.topLeagueId]: clubsOfLeague(world, pair.topLeagueId, divisionMoves).map((c) => c.id),
          [pair.secondLeagueId]: clubsOfLeague(world, pair.secondLeagueId, divisionMoves).map(
            (c) => c.id,
          ),
        },
        teams: Object.fromEntries(
          [
            ...clubsOfLeague(world, pair.topLeagueId, divisionMoves),
            ...clubsOfLeague(world, pair.secondLeagueId, divisionMoves),
          ].map((c) => [
            c.id,
            careerOpponentTeam({
              id: c.id,
              name: c.name,
              /**
               * Per **noi** si legge il pool grezzo, non il mondo evoluto: `evolveWorld` esclude
               * i nostri giocatori (li gestisce la carriera), quindi `rosaDi(nostroClub)` è
               * vuoto e ci attribuirebbe la forza di ripiego. È lo stesso difetto già corretto
               * una volta sulle iscritte alla Corona, dove ci iscriveva come la più debole del
               * torneo. Qui il valore serve solo da anagrafica di riserva — nel campionato la
               * nostra forza vera la mette il riduttore — ma sbagliarlo sarebbe una trappola
               * pronta a scattare al primo uso nuovo di questa mappa.
               */
              players: c.id === clubId ? ((world.playersByClub.get(c.id) ?? []) as Player[]) : rosaDi(c.id),
            }),
          ]),
        ),
      }
    : undefined;

  return {
    players,
    opponents,
    divisions,
    leagueName: world.leaguesById.get(leagueId)?.name,
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
    market: buildMarketWorld(world, evolved, clubId, ageOf, generated, ownedByUser, divisionMoves),
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
  divisionMoves: readonly DivisionMove[],
): NonNullable<CareerWorld["market"]> {
  const clubs: NonNullable<CareerWorld["market"]>["clubs"] = {};
  const leaguePrestigeByClub: Record<string, number> = {};
  const clubPrestige: Record<string, number> = {};

  const pair = divisionPairIds(world);
  for (const club of world.clubs) {
    const rosa = (evolved.byClub.get(club.id) ?? []) as unknown as Player[];
    /**
     * Il campionato **attuale** del club, movimenti applicati.
     *
     * Conta sul serio: da qui esce il prestigio di lega che entra nel valore di mercato. Chi è
     * appena retrocesso deve valere come una squadra di Serie B — è metà del motivo per cui la
     * retrocessione fa male e la promozione conviene.
     */
    const leagueId = pair
      ? leagueOfClub(club.id, club.leagueId, divisionMoves, pair.topLeagueId, pair.secondLeagueId)
      : club.leagueId;

    clubs[club.id] = {
      id: club.id,
      name: club.name,
      leagueId,
      startingEleven: bestElevenByDepartment(rosa).map((p) => p.overall),
    };
    leaguePrestigeByClub[club.id] = world.leaguesById.get(leagueId)?.prestigeTier ?? 3;
    clubPrestige[club.id] = club.prestigeTier;
  }

  const nelMondo = [...evolved.byId.values()];
  // Acquistabile è chi non è già nostro. Il controllo su `ownedByUser` serve per i **regen**,
  // che restano in anagrafica anche dopo l'acquisto (per avere nome e ruolo) ma non devono
  // ricomparire fra chi si può comprare.
  const acquistabili = nelMondo.filter((p) => p.clubId !== ownClubId && !ownedByUser.has(p.id));

  /**
   * **Anagrafica ≠ acquistabili**, e la regola vive ora nel motore (`marketPlayerIndex`), dove è
   * coperta da test.
   *
   * Qui si passano le tre fonti nell'ordine giusto. La prima — **tutti** i giocatori del
   * database — è quella che mancava: il mondo evoluto esclude chi è diventato nostro, e per un
   * giocatore comprato da un altro club nessuna delle altre due fonti sapeva più il nome. Da lì
   * il `"Giocatore"` congelato dentro le offerte di prestito, dalla seconda stagione in poi.
   */
  const anagrafica: PlayerIndex = marketPlayerIndex({
    database: world.players,
    world: nelMondo,
    generated,
  });

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
