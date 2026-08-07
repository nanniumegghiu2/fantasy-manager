import type { Department, Formation, Player, Role } from "@app/shared-types";

/** Difficoltà scelta in setup (sez. 3.5 CLAUDE.md): quanti redraft (rifiuta e riproponi) sono disponibili durante l'intero draft. */
export type Difficulty = "facile" | "normale" | "difficile";

/** Numero di redraft disponibili per l'intero draft, per difficoltà (sez. 3.2 CLAUDE.md). */
export const REDRAFT_ALLOWANCE: Record<Difficulty, number> = {
  facile: 5,
  normale: 2,
  difficile: 0,
};

export function canRedraft(difficulty: Difficulty, redraftsUsed: number): boolean {
  return redraftsUsed < REDRAFT_ALLOWANCE[difficulty];
}

/**
 * Quanto la difficoltà sbilancia i pacchetti verso i giocatori forti (sez. 3.2 CLAUDE.md).
 *
 * La difficoltà agisce su **due leve**, non più solo sui redraft: quante volte puoi
 * rifiutare una proposta, e quanto è probabile che la proposta sia buona in partenza.
 *
 * - **facile**: i fuoriclasse escono molto più spesso della loro frequenza reale nel pool
 * - **normale**: sbilanciamento contenuto, i forti sono favoriti ma non garantiti
 * - **difficile**: nessuno sbilanciamento — esce quello che il pool contiene davvero, e
 *   pescare una rosa da 38-0-0 dipende solo da fortuna e da come la costruisci
 */
export const QUALITY_BIAS: Record<Difficulty, number> = {
  facile: 4.5,
  normale: 1.5,
  difficile: 0,
};

/**
 * Riferimento basso della scala per normalizzare l'Overall in 0-1 prima di elevarlo al
 * bias. Volutamente **sotto** il minimo reale del pool (65): usare il minimo effettivo
 * schiaccerebbe il peso del giocatore più scarso a zero, escludendolo del tutto invece di
 * renderlo solo meno probabile.
 */
const QUALITY_FLOOR = 55;
const QUALITY_CEILING = 99;

/** Peso di pescata di un Overall, data la difficoltà. Con bias 0 vale 1 per tutti (pescata uniforme). */
export function qualityWeight(overall: number, difficulty: Difficulty): number {
  const bias = QUALITY_BIAS[difficulty];
  if (bias === 0) return 1;
  const normalized = Math.min(
    Math.max((overall - QUALITY_FLOOR) / (QUALITY_CEILING - QUALITY_FLOOR), 0.01),
    1,
  );
  return Math.pow(normalized, bias);
}

/**
 * Estrazione casuale senza ripetizioni di `n` elementi, con probabilità proporzionale al
 * peso. Nessun elemento è mai escluso a priori: un peso basso resta possibile, solo raro.
 */
export function weightedSampleN<T>(
  items: T[],
  n: number,
  weightOf: (item: T) => number,
  random: () => number = Math.random,
): T[] {
  const remaining = items.map((item) => ({ item, weight: Math.max(weightOf(item), 1e-6) }));
  const picked: T[] = [];

  while (picked.length < n && remaining.length > 0) {
    const total = remaining.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * total;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i].weight;
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picked.push(remaining[index].item);
    remaining.splice(index, 1);
  }

  return picked;
}

export type DraftMode = "per_squadra" | "per_ruolo";

/**
 * Uno slot titolare ancora libero da riempire (ruolo specifico, sez. 3.1). Le riserve sono
 * state rimosse dal draft (Decision Log 2026-07-27): si giocano solo gli 11 titolari.
 */
export interface DraftRequirement {
  id: string;
  role: Role;
  department: Department;
}

/** Stato minimo del draft necessario per calcolare gli slot ancora liberi. */
export interface DraftProgress {
  formation: Formation;
  filledStarterSlotIds: ReadonlySet<string>;
}

export function createEmptyProgress(formation: Formation): DraftProgress {
  return {
    formation,
    filledStarterSlotIds: new Set(),
  };
}

/** Rosa completa (11 titolari) = tutti gli slot riempiti, nessun requirement aperto. */
export function isSquadComplete(progress: DraftProgress): boolean {
  return openRequirements(progress).length === 0;
}

export function openRequirements(progress: DraftProgress): DraftRequirement[] {
  return progress.formation.slots
    .filter((slot) => !progress.filledStarterSlotIds.has(slot.id))
    .map((slot) => ({
      id: slot.id,
      role: slot.role,
      department: slot.department,
    }));
}

/** Un giocatore può coprire uno slot se il ruolo è il suo principale o uno dei secondari (sez. 3.1). */
export function isRoleCompatible(player: Player, role: Role): boolean {
  return player.role === role || player.secondaryRoles.includes(role);
}

/**
 * Overall effettivo per uno slot: **sempre** quello del giocatore.
 *
 * C'era un malus fisso di 8 punti per chi copriva un ruolo secondario, rimosso su richiesta
 * dell'utente. Restava comunque una penalità implicita e più interessante: schierare un
 * giocatore fuori dal suo ruolo naturale lo porta in una casella diversa dello scacchiere,
 * quindi cambia i suoi vicini e con essi le linee di intesa (sez. 3.4). Il prezzo lo decide
 * la coesione della rosa, non una sottrazione fissa.
 *
 * La funzione resta perché è il punto in cui il motore chiede "quanto vale questo giocatore
 * in questa casella": se in futuro tornasse una penalità (o un bonus) vive qui.
 */
export function effectiveOverallForRole(player: Player, _role: Role): number {
  return player.overall;
}

/** Serve il ruolo dello slot, principale o secondario (sez. 3.1). */
export function playerMatchesRequirement(player: Player, req: DraftRequirement): boolean {
  return isRoleCompatible(player, req.role);
}

export function matchingRequirements(
  player: Player,
  progress: DraftProgress,
): DraftRequirement[] {
  return openRequirements(progress).filter((req) => playerMatchesRequirement(player, req));
}

/**
 * Modalità "per squadra" (sez. 3.2): un club è proponibile solo se almeno uno
 * dei suoi giocatori è compatibile con uno slot ancora libero — mai un
 * pacchetto senza alcuna scelta valida.
 */
export function isClubEligible(clubPlayers: Player[], progress: DraftProgress): boolean {
  const reqs = openRequirements(progress);
  return clubPlayers.some((player) => reqs.some((req) => playerMatchesRequirement(player, req)));
}

export interface ClubPackage {
  clubId: string;
  players: Player[];
}

/** Filtra una lista di pacchetti-club a quelli effettivamente proponibili nello stato corrente. */
export function eligibleClubPackages(
  packages: ClubPackage[],
  progress: DraftProgress,
): ClubPackage[] {
  return packages.filter((pkg) => isClubEligible(pkg.players, progress));
}

/** Numero di club mostrati in un pacchetto in modalità "per squadra" (sez. 3.2). */
export const TEAM_MODE_PACK_SIZE = 5;

/**
 * Forza di un club ai fini della pescata: la media dei suoi 5 giocatori migliori tra
 * quelli **ancora utili**. Non il migliore in assoluto, che premierebbe una squadra
 * mediocre con un solo campione, e non la media di tutta la rosa, che verrebbe schiacciata
 * dai rincalzi.
 */
function clubStrength(pkg: ClubPackage): number {
  const best = [...pkg.players].sort((a, b) => b.overall - a.overall).slice(0, 5);
  if (best.length === 0) return 0;
  return best.reduce((sum, p) => sum + p.overall, 0) / best.length;
}

/**
 * Pacchetto di club per la modalità "per squadra", sbilanciato dalla difficoltà: in facile
 * escono molto più spesso i club forti, in difficile la pescata è uniforme fra tutti quelli
 * proponibili.
 */
export function drawClubPack(
  packages: ClubPackage[],
  progress: DraftProgress,
  difficulty: Difficulty,
  random: () => number = Math.random,
  count: number = TEAM_MODE_PACK_SIZE,
): ClubPackage[] {
  const eligible = eligibleClubPackages(packages, progress);
  return weightedSampleN(eligible, count, (pkg) => qualityWeight(clubStrength(pkg), difficulty), random);
}

/** Numero di candidati mostrati in modalità "per ruolo" (sez. 3.2). */
export const ROLE_MODE_CANDIDATE_COUNT = 5;

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Modalità "per ruolo" (sez. 3.2): candidati per un requirement specifico,
 * da squadre diverse quando possibile (varietà, coerente con lo spirito del
 * draft "per squadra" pur mostrando piu' opzioni in una volta). I giocatori
 * nel loro ruolo principale vengono preferiti a quelli in ruolo secondario
 * (che sconterebbero il malus, sez. 3.1) quando ce ne sono abbastanza.
 */
export function candidatesForRequirement(
  pool: Player[],
  req: DraftRequirement,
  random: () => number = Math.random,
  count: number = ROLE_MODE_CANDIDATE_COUNT,
  /** Sbilancia i candidati verso gli Overall alti: assente = pescata uniforme, come prima. */
  difficulty?: Difficulty,
): Player[] {
  const matching = pool.filter((player) => playerMatchesRequirement(player, req));
  const isPrimaryMatch = (player: Player) => player.role === req.role;
  // L'ordine di estrazione è pesato per Overall secondo la difficoltà: chi è forte finisce
  // più spesso nelle prime posizioni, quindi più spesso dentro il pacchetto da 5.
  const order = (players: Player[]) =>
    difficulty
      ? weightedSampleN(
          players,
          players.length,
          (p) => qualityWeight(effectiveOverallForRole(p, req.role), difficulty),
          random,
        )
      : shuffled(players, random);

  const primary = order(matching.filter((p) => isPrimaryMatch(p)));
  const secondary = order(matching.filter((p) => !isPrimaryMatch(p)));

  const picked: Player[] = [];
  const usedClubIds = new Set<string>();

  for (const player of [...primary, ...secondary]) {
    if (picked.length >= count) break;
    if (usedClubIds.has(player.clubId)) continue;
    picked.push(player);
    usedClubIds.add(player.clubId);
  }

  if (picked.length < count) {
    for (const player of [...primary, ...secondary]) {
      if (picked.length >= count) break;
      if (picked.includes(player)) continue;
      picked.push(player);
    }
  }

  return picked;
}
