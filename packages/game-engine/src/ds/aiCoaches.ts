/**
 * **Il mondo IA degli allenatori.**
 *
 * Prima le squadre del computer non avevano nessun allenatore assegnato: le avversarie erano
 * solo "undici migliori per reparto" (`aiClub.ts`), senza nome, modulo o stile in panchina. Qui
 * si dà loro un'identità vera, riusando un catalogo (`coaches.ts`) che aveva già tutto il
 * necessario e zero collegamenti: `Coach.defaultClubId`, `Coach.isFreeAgent`,
 * `Coach.currentClubId`, `Coach.tacticalPhilosophy`, `getClubDefaultCoach`, `availableCoaches`.
 *
 * **Compromesso dichiarato sull'ampiezza**: il catalogo ha 24 allenatori per un mondo di 96
 * club — coprirli tutti con un nome è impossibile senza inventare decine di identità. Ricevono
 * un'allenatore individuale solo i club di cui il motore calcola un segnale vero:
 *  - le **19 avversarie della propria lega** (`world.opponents`): hanno una posizione in
 *    classifica reale ogni stagione, quindi l'esonero si giudica sui risultati veri;
 *  - i **club qualificati alla Corona** (`world.cupTeams`): nessuna classifica (è un tabellone,
 *    non un campionato), quindi il segnale è lo scarto fra il prestigio del club e la forza
 *    attuale della sua rosa — onesto, anche se meno diretto di una posizione.
 * Il resto dei 96 club resta senza un nome assegnato: `ClubViewerModal` mostrerà "Staff
 * tecnico", non un'identità inventata a caso.
 *
 * **Perché si salva e non si deriva.** Il resto del mondo IA (`aiWorld.ts`) si ricalcola da zero
 * ogni volta dal seme — qui non si può: chi allena un club *oggi* dipende da chi è stato
 * esonerato l'anno scorso, che dipende da chi c'era l'anno prima. È una storia, non una funzione
 * pura di (club, stagione) — lo stesso motivo per cui `worldTransfers` si salva.
 */
import { derivedRandom } from "../random";
import { availableCoaches, findCoach, getClubDefaultCoach } from "./coaches";

export interface AiCoachAssignment {
  coachId: string;
  sinceSeason: number;
}

export interface AiClubInfo {
  id: string;
  name: string;
  /** 1-5, stessa scala di `clubs.prestige_tier`. */
  prestige: number;
}

/** Assegna un allenatore a ogni club della lista, una volta sola (alla creazione carriera). */
export function assignInitialCoaches(
  clubs: readonly AiClubInfo[],
  seed: string,
  season: number,
): Record<string, AiCoachAssignment> {
  const assegnati: Record<string, AiCoachAssignment> = {};
  const usati = new Set<string>();
  const random = derivedRandom(seed, "aiCoachInit");

  for (const club of clubs) {
    const predefinito = getClubDefaultCoach(club.id, club.name);
    let coach = predefinito && !usati.has(predefinito.id) ? predefinito : undefined;
    if (!coach) {
      const liberi = availableCoaches(club.prestige).filter((c) => c.isFreeAgent && !usati.has(c.id));
      if (liberi.length > 0) coach = liberi[Math.floor(random() * liberi.length)];
    }
    if (coach) {
      assegnati[club.id] = { coachId: coach.id, sinceSeason: season };
      usati.add(coach.id);
    }
  }
  return assegnati;
}

export interface AiClubSeasonInfo extends AiClubInfo {
  /** Posizione finale in classifica, solo per chi ne ha una vera (le 19 avversarie di lega). */
  leaguePosition?: number;
  leagueSize?: number;
  /** Forza attuale della rosa (media Overall dei titolari): sempre disponibile, è il fallback. */
  squadAverage: number;
}

export interface CoachMove {
  clubId: string;
  clubName: string;
  firedCoachId: string;
  firedCoachName: string;
  hiredCoachId: string;
  hiredCoachName: string;
}

/**
 * Quanto sotto le attese (in frazione della lega) un club dev'essere prima che il suo
 * allenatore rischi davvero la panchina. Placeholder di bilanciamento dichiarato.
 */
const FIRE_RISK_POSITION_GAP = 0.35;
/** Stesso principio, versione "nessuna classifica": scarto di Overall dal prestigio atteso. */
const FIRE_RISK_SQUAD_GAP = 8;
/** Probabilità di esonero **condizionata** al segnale di rischio, non un tiro a vuoto ogni stagione. */
const FIRE_ODDS = 0.35;

/**
 * Un turno di esoneri/assunzioni, una volta a stagione — stesso punto di aggancio già usato da
 * `world.planTransfers` in `career.ts` (guardia "una volta per stagione" fuori da questa
 * funzione, a carico del chiamante). Pura: stesso seed e stessi dati → stesso esito.
 */
export function evolveCoaches(
  current: Record<string, AiCoachAssignment>,
  clubs: readonly AiClubSeasonInfo[],
  season: number,
  seed: string,
): { assignments: Record<string, AiCoachAssignment>; moves: CoachMove[] } {
  const random = derivedRandom(seed, "aiCoachEvolve", season);
  const assignments = { ...current };
  const usati = new Set(Object.values(current).map((a) => a.coachId));
  const moves: CoachMove[] = [];

  for (const club of clubs) {
    const attuale = assignments[club.id];
    if (!attuale) continue; // fuori dal perimetro con identità (vedi intestazione del file)
    const coach = findCoach(attuale.coachId);
    if (!coach) continue;

    if (!rischioEsonero(club) || random() >= FIRE_ODDS) continue;

    usati.delete(attuale.coachId);
    const liberi = availableCoaches(club.prestige).filter(
      (c) => c.isFreeAgent && c.id !== attuale.coachId && !usati.has(c.id),
    );
    // Nessun candidato credibile: resta con l'attuale — stesso principio già usato in
    // `buildOffers` (non si forza un esito senza qualcuno di vero dall'altra parte).
    if (liberi.length === 0) {
      usati.add(attuale.coachId);
      continue;
    }
    const nuovo = liberi[Math.floor(random() * liberi.length)]!;
    assignments[club.id] = { coachId: nuovo.id, sinceSeason: season };
    usati.add(nuovo.id);
    moves.push({
      clubId: club.id,
      clubName: club.name,
      firedCoachId: coach.id,
      firedCoachName: coach.name,
      hiredCoachId: nuovo.id,
      hiredCoachName: nuovo.name,
    });
  }

  return { assignments, moves };
}

function rischioEsonero(club: AiClubSeasonInfo): boolean {
  if (club.leaguePosition !== undefined && club.leagueSize) {
    const attesa = expectedPositionFromPrestige(club.prestige, club.leagueSize);
    return club.leaguePosition > attesa + club.leagueSize * FIRE_RISK_POSITION_GAP;
  }
  const attesaOverall = 60 + club.prestige * 6;
  return club.squadAverage < attesaOverall - FIRE_RISK_SQUAD_GAP;
}

/** Prestigio 5 → si aspetta la vetta, prestigio 1 → si aspetta il fondo. Lineare, dichiarato. */
function expectedPositionFromPrestige(prestige: number, leagueSize: number): number {
  const percentile = (5 - Math.max(1, Math.min(5, prestige))) / 4;
  return Math.max(1, Math.round(percentile * leagueSize));
}
