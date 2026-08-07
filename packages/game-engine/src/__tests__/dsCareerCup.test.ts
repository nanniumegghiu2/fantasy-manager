/**
 * Bug grave segnalato dall'utente: le partite di Coppa ai rigori non mostravano lo spareggio,
 * perché il tabellino mostrato nel Match Theatre (`ownMatch.result`) era una simulazione
 * **indipendente** dal vero esito del tabellone (`nostra`, da `simulateKnockoutRound`). Le due
 * potevano disaccordarsi sulla parità, quindi la sezione rigori (che scatta solo se il "90°"
 * mostrato pareggia) non si attivava mai quando in realtà il vero risultato era finito ai
 * rigori. Questo test blocca l'invariante: il tabellino narrato deve sempre concordare con
 * l'esito vero sulla parità (pareggio ⇔ rigori disputati).
 */
import { describe, expect, it } from "vitest";
import { playCupRound, emptyCupSave, type CupSave } from "../ds/careerCup";
import type { LeagueTeam } from "../season/leagueState";

function team(id: string, rating: number): LeagueTeam {
  return { id, name: id, rating, strength: { attack: rating, defence: rating } };
}

/** Un tabellone già alla finale, due squadre pari forza: massimizza la chance di pareggio. */
function finaleSave(): CupSave {
  const save = emptyCupSave(["own", "opp"], ["Serie A", "Serie A"]);
  save.stage = "finale";
  save.bracket = [0, 1];
  save.groupRound = 999; // salta il ramo girone
  return save;
}

const teamsById: Record<string, LeagueTeam> = {
  own: team("own", 80),
  opp: team("opp", 80),
};

describe("playCupRound — tabellino coerente col vero esito (rigori)", () => {
  it("il pareggio mostrato coincide sempre con l'esito reale ai rigori, su molti semi", () => {
    let trovatoRigori = false;
    for (let i = 0; i < 200; i++) {
      const outcome = playCupRound(finaleSave(), teamsById, "own", [], `seed-${i}`, 1, i);
      const own = outcome.ownMatch;
      if (!own) continue;
      const pareggioMostrato = own.result.goalsFor === own.result.goalsAgainst;
      expect(pareggioMostrato).toBe(!!own.wentToPenalties);
      if (own.wentToPenalties) trovatoRigori = true;
    }
    // Con 200 semi su una finale ad armi pari, ci aspettiamo di incontrare almeno un caso di
    // rigori — se non lo trovassimo mai, il test non starebbe verificando nulla di utile.
    expect(trovatoRigori).toBe(true);
  });

  it("una vittoria/sconfitta decisa in regolamento o supplementari non pareggia mai nel tabellino", () => {
    for (let i = 0; i < 200; i++) {
      const outcome = playCupRound(finaleSave(), teamsById, "own", [], `noreq-${i}`, 1, i);
      const own = outcome.ownMatch;
      if (!own || own.wentToPenalties) continue;
      expect(own.result.goalsFor).not.toBe(own.result.goalsAgainst);
      expect(own.result.outcome).toBe(own.result.goalsFor > own.result.goalsAgainst ? "win" : "loss");
    }
  });
});
