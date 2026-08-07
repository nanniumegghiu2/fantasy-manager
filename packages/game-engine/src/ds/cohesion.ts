/**
 * **Affiatamento**: quanto una squadra si conosce. In DS mode prende il posto dell'intesa
 * classica nel calcolo della forza (`SquadStrengthOptions.cohesionBonus`).
 *
 * Perché non si riusa l'intesa della Modalità Classica. Quella conta i tratti condivisi fra
 * due giocatori — campionato, epoca, nazione — e in una carriera è **degenere e dannosa**:
 * in database c'è una sola epoca e in un club reale tutti condividono anche il campionato,
 * quindi ogni coppia parte già al massimo e il bonus è una costante. Peggio, l'unico modo di
 * *smuoverlo* è comprare all'estero, che lo fa **scendere**: il mercato lavorerebbe contro la
 * squadra, e il colpo da un altro campionato sarebbe penalizzato due volte (costo e malus).
 *
 * L'affiatamento misura invece ciò che in una carriera cambia davvero:
 *  - **continuità** — da quanti anni questi due giocano insieme in questo club;
 *  - **nazionalità** — l'unica componente dell'intesa classica che resta sensata;
 *  - **familiarità col modulo** — da quante giornate la squadra gioca così con questo mister.
 *
 * Conseguenza voluta: un gruppo tenuto insieme vale più della somma dei suoi Overall, e un
 * acquisto è un **investimento che matura** invece di una penalità immediata.
 *
 * Le stesse regole valgono per le squadre gestite dal computer: la simmetria fra noi e loro è
 * un principio già stabilito nel progetto (vedi il difetto dell'intesa a senso unico corretto
 * il 2026-07-29), e romperla qui rimetterebbe in piedi lo stesso tipo di bug.
 */
import { formationBoardEdges } from "../board";
import type { Formation } from "@app/shared-types";
import type { Lineup, PlayerIndex, RosterEntry } from "./types";

/**
 * Tetto del bonus, sulla stessa scala del bonus intesa della Modalità Classica (0-10), così
 * i due mondi restano confrontabili e la calibrazione del motore continua a valere.
 */
export const MAX_COHESION_BONUS = 10;

/**
 * Peso delle tre componenti. Placeholder di bilanciamento **dichiarati**: vanno tarati
 * misurando (quanto vale davvero un gruppo consolidato rispetto a una rosa rifatta), non
 * stimati. La continuità pesa più delle altre due messe insieme perché è l'unica che il
 * giocatore costruisce con le sue scelte nell'arco delle stagioni.
 */
export const COHESION_WEIGHTS = {
  continuity: 6,
  nationality: 2,
  familiarity: 2,
} as const;

/**
 * Dopo quante stagioni insieme la continuità di una coppia è considerata piena.
 *
 * Quattro e non dieci: se servisse un'intera carriera per arrivare al massimo, il bonus
 * sarebbe irrilevante nelle prime stagioni — cioè proprio quando l'utente sta imparando a
 * giocare — e chi eredita una rosa consolidata non avrebbe nulla da difendere.
 */
export const FULL_CONTINUITY_SEASONS = 4;

/** Dopo quante giornate col medesimo modulo la familiarità è piena. */
export const FULL_FAMILIARITY_MATCHDAYS = 8;

/**
 * La stagione di arrivo da attribuire ai giocatori **già in rosa** quando la carriera comincia.
 *
 * Non è un dettaglio contabile. Segnandoli come arrivati nella stagione 1 la loro continuità
 * varrebbe zero — cioè il gruppo che si eredita risulterebbe appena conosciuto, mentre nella
 * realtà quei giocatori sono al club da anni. Peggio: con l'affiatamento a zero **ogni acquisto
 * sarebbe gratuito**, e la meccanica che rende un colpo di mercato un investimento che matura
 * non avrebbe alcun prezzo da far pagare.
 *
 * Con questo valore la rosa iniziale parte **rodata** e ogni nuovo arrivo la diluisce: rifare
 * mezza squadra costa affiatamento nell'immediato, tenerla insieme lo conserva.
 */
export const INHERITED_SINCE_SEASON = 1 - FULL_CONTINUITY_SEASONS;

export interface CohesionInput {
  formation: Formation;
  lineup: Lineup;
  entries: readonly RosterEntry[];
  players: PlayerIndex;
  /** Stagione in corso: serve a misurare da quanto ogni giocatore è al club. */
  season: number;
  /** Giornate consecutive giocate con questo modulo e questo allenatore. */
  matchdaysWithFormation?: number;
}

export interface CohesionBreakdown {
  /** Il bonus finale, 0-`MAX_COHESION_BONUS`, da passare a `computeSquadStrength`. */
  bonus: number;
  /** Le tre componenti, per poterle mostrare all'utente invece di un numero opaco. */
  continuity: number;
  nationality: number;
  familiarity: number;
  /** Coppie adiacenti effettivamente valutate: zero se l'undici è incompleto. */
  pairs: number;
}

/** Quanto una singola coppia ha giocato insieme, normalizzato 0-1. */
function pairContinuity(a: RosterEntry, b: RosterEntry, season: number): number {
  // Chi è arrivato più tardi determina da quando la coppia esiste.
  const together = season - Math.max(a.sinceSeason, b.sinceSeason);
  if (together <= 0) return 0;
  return Math.min(together / FULL_CONTINUITY_SEASONS, 1);
}

/**
 * L'affiatamento dell'undici schierato.
 *
 * Si valuta sulle **coppie adiacenti sullo scacchiere** (`formationBoardEdges`), non su tutte
 * le 55 coppie possibili: è la stessa topologia usata dalle linee di intesa disegnate sul
 * campo, ed è l'unica fonte di verità del progetto in materia. Due giocatori che non si
 * toccano mai in campo non hanno ragione di "conoscersi" ai fini del rendimento.
 */
export function computeCohesion({
  formation,
  lineup,
  entries,
  players,
  season,
  matchdaysWithFormation = 0,
}: CohesionInput): CohesionBreakdown {
  const byId = new Map(entries.map((entry) => [entry.playerId, entry]));

  let continuitySum = 0;
  let nationalitySum = 0;
  let pairs = 0;

  for (const edge of formationBoardEdges(formation)) {
    const aId = lineup.starters[edge.slotAId];
    const bId = lineup.starters[edge.slotBId];
    if (!aId || !bId) continue;
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a || !b) continue;

    pairs++;
    continuitySum += pairContinuity(a, b, season);
    const nationA = players[aId]?.nation;
    const nationB = players[bId]?.nation;
    if (nationA && nationB && nationA === nationB) nationalitySum += 1;
  }

  // Un undici incompleto non regala affiatamento: senza coppie non c'è nulla da misurare.
  if (pairs === 0) {
    return { bonus: 0, continuity: 0, nationality: 0, familiarity: 0, pairs: 0 };
  }

  const continuity = (continuitySum / pairs) * COHESION_WEIGHTS.continuity;
  const nationality = (nationalitySum / pairs) * COHESION_WEIGHTS.nationality;
  const familiarity =
    Math.min(matchdaysWithFormation / FULL_FAMILIARITY_MATCHDAYS, 1) * COHESION_WEIGHTS.familiarity;

  const bonus = Math.min(
    Math.round(continuity + nationality + familiarity),
    MAX_COHESION_BONUS,
  );

  return {
    bonus,
    continuity: Number(continuity.toFixed(2)),
    nationality: Number(nationality.toFixed(2)),
    familiarity: Number(familiarity.toFixed(2)),
    pairs,
  };
}

/**
 * Etichetta leggibile del livello di affiatamento, per la UI. Le soglie seguono la stessa
 * logica dei colori dell'intesa (`CHEMISTRY_LABEL` lato app): l'utente deve capire a colpo
 * d'occhio se il gruppo è rodato o appena assemblato.
 */
export function cohesionLabel(bonus: number): "Rodata" | "In crescita" | "Da assemblare" {
  if (bonus >= 7) return "Rodata";
  if (bonus >= 4) return "In crescita";
  return "Da assemblare";
}
