/**
 * **Sintonia DS - Allenatore, Intoccabili e Ultimatum**
 *
 * Regola il rapporto dinamico tra la Direzione Sportiva e l'Allenatore:
 *  1. **Intoccabili (`coachUntouchables`)**: I 2-3 giocatori chiave della rosa che il mister considera inamovibili.
 *  2. **Sintonia (`coachHarmony`)**: Valore 0-100. Alta sintonia dà un bonus sul campo, bassa sintonia penalizza attacco e difesa.
 *  3. **Ultimatum di Esonero (`coachUltimatum`)**: Scatta dopo un andamento negativo per dare una scossa alla squadra.
 */
import type { PlayerIndex, RosterEntry } from "./types";

export interface CoachUltimatum {
  startRound: number;
  matchdaysLeft: number;
  targetPoints: number;
  pointsAccumulated: number;
  reason: string;
}

/** I giocatori che l'allenatore considera i suoi pilastri inamovibili (i primi 3 per Overall disponibili). */
export function getCoachUntouchables(
  roster: readonly RosterEntry[],
  coachId: string | null | undefined,
  _players: PlayerIndex,
): string[] {
  if (!coachId) return [];
  const disponibili = roster.filter((e) => !e.loan?.hostClubId);
  if (disponibili.length === 0) return [];

  // I 3 giocatori con Overall più alto che giocano regolarmente
  return [...disponibili]
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 3)
    .map((e) => e.playerId);
}

/** Calcola il bonus/malus di sintonia applicato alla forza della squadra. */
export function computeHarmonyModifier(harmony: number): { attack: number; defence: number } {
  if (harmony >= 88) return { attack: 4, defence: 4 };
  if (harmony >= 75) return { attack: 2, defence: 2 };
  if (harmony >= 55) return { attack: 0, defence: 0 };
  if (harmony >= 35) return { attack: -3, defence: -3 };
  return { attack: -6, defence: -6 };
}

/** Etichetta e tono del clima di sintonia tra DS e Allenatore. */
export function harmonyLabel(harmony: number): { label: string; tone: string } {
  if (harmony >= 85) return { label: "Perfetta sintonia", tone: "#3ddc6b" };
  if (harmony >= 70) return { label: "Buona intesa", tone: "#8fd4a4" };
  if (harmony >= 50) return { label: "Tensione strisciante", tone: "#ffc107" };
  if (harmony >= 30) return { label: "Clima teso", tone: "#ff8a3d" };
  return { label: "Rottura imminente", tone: "#ff4d4d" };
}
