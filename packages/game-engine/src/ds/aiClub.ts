/**
 * Le squadre gestite dal computer, in DS mode.
 *
 * Esiste per una ragione sola, ed è una lezione già pagata: **le due parti del confronto devono
 * essere costruite con la stessa formula**. Nella Modalità Classica il bonus intesa andava solo
 * alla rosa dell'utente, e una squadra da 70 si presentava da 80 (Decision Log, 2026-07-29). Qui
 * lo stesso errore si ripresenterebbe in una forma più insidiosa: la forza dell'utente esce da
 * `computeSquadStrength`, che pesa i reparti (62% attaccanti sull'attacco, 55% difensori sulla
 * difesa) e somma l'affiatamento, mentre una squadra avversaria costruita con la **media piatta**
 * dei suoi undici risulterebbe sistematicamente più debole a parità di giocatori — perché la
 * media piatta annacqua i migliori, che sono proprio quelli su cui i pesi insistono.
 *
 * Da qui passano tutte le avversarie: campionato e Corona.
 */
import { bestElevenByDepartment, buildScorerPool, ATTACK_MIX, DEFENCE_MIX } from "../squadStrength";
import type { LeagueTeam } from "../season/leagueState";
import type { Department, Player } from "@app/shared-types";

/**
 * Affiatamento attribuito a un club reale, sulla scala 0-10 di `MAX_COHESION_BONUS`.
 *
 * Un club vero è un gruppo consolidato: i suoi giocatori sono lì da anni e conoscono il modulo
 * del loro allenatore, quindi sta in alto. **Non al massimo**, però: il tetto deve restare
 * qualcosa che l'utente può raggiungere e superare tenendo insieme il gruppo e curando le
 * nazionalità, altrimenti la meccanica dell'affiatamento non premierebbe mai nessuna scelta.
 *
 * Placeholder di bilanciamento **dichiarato**, da tarare misurando come `GOAL_SCALE`.
 */
export const AI_CLUB_COHESION = 8;

export interface CareerOpponentInput {
  id: string;
  name: string;
  /** Tutta la rosa del club: l'undici lo sceglie questa funzione, per reparto. */
  players: Player[];
}

/**
 * Un club reale come avversaria.
 *
 * L'undici è scelto **per reparto** (1 POR, 4 DIF, 4 CC, 2 ATT) e non prendendo gli undici
 * Overall più alti: quest'ultima scelta produceva formazioni impossibili, con grandi club
 * senza portieri e un portiere fantasma migliore di quello vero (Decision Log, 2026-07-29).
 */
export function careerOpponentTeam({ id, name, players }: CareerOpponentInput): LeagueTeam {
  const eleven = bestElevenByDepartment(players);
  if (eleven.length === 0) {
    return { id, name, rating: 70, strength: { attack: 70, defence: 70 }, scorers: [] };
  }

  const rating = eleven.reduce((sum, p) => sum + p.overall, 0) / eleven.length;
  const byDepartment = (department: Department) => {
    const group = eleven.filter((p) => p.department === department);
    return group.length > 0 ? group.reduce((s, p) => s + p.overall, 0) / group.length : rating;
  };

  const attack = Math.round(
    ATTACK_MIX.ATT * byDepartment("ATT") + ATTACK_MIX.CC * byDepartment("CC") + AI_CLUB_COHESION,
  );
  const defence = Math.round(
    DEFENCE_MIX.DIF * byDepartment("DIF") +
      DEFENCE_MIX.POR * byDepartment("POR") +
      DEFENCE_MIX.CC * byDepartment("CC") +
      AI_CLUB_COHESION,
  );

  return {
    id,
    name,
    rating: Math.round(rating),
    strength: { attack, defence },
    // Chi segna contro di noi è uno che quella squadra schiererebbe davvero.
    scorers: buildScorerPool(eleven),
  };
}
