/**
 * La **scelta** della partita da guardare e la sequenza dei rigori.
 *
 * La cronaca vera e propria è passata a `matchSim.ts` (vedi `dsMatchSim.test.ts`): qui restano
 * le due cose che riguardano *quale* partita si apre e un esito deciso altrove che si limita a
 * essere raccontato.
 */
import { describe, expect, it } from "vitest";
import { buildShootout, isKeyMatch, keyMatchReason } from "../ds/highlights";

describe("rigori: la sequenza racconta un esito già deciso", () => {
  it("chi vince fa tutti e cinque i tiri", () => {
    const kicks = buildShootout(true, "seme-vinto");
    const nostri = kicks.filter((k) => k.team === "for");
    expect(nostri).toHaveLength(5);
    expect(nostri.every((k) => k.scored)).toBe(true);
    const loro = kicks.filter((k) => k.team === "against");
    expect(loro.filter((k) => k.scored)).toHaveLength(4);
  });

  it("chi perde ne sbaglia esattamente uno", () => {
    const kicks = buildShootout(false, "seme-perso");
    const nostri = kicks.filter((k) => k.team === "for");
    expect(nostri.filter((k) => k.scored)).toHaveLength(4);
    const loro = kicks.filter((k) => k.team === "against");
    expect(loro.every((k) => k.scored)).toBe(true);
  });

  it("è deterministico per lo stesso seme, ma varia da un seme all'altro", () => {
    const a = buildShootout(false, "seme-x");
    const b = buildShootout(false, "seme-x");
    expect(a).toEqual(b);
    const c = buildShootout(false, "seme-y");
    expect(a).not.toEqual(c);
  });

  it("l'ordine dei tiri alterna le due squadre, 10 tiri in tutto", () => {
    const kicks = buildShootout(true, "seme-ordine");
    expect(kicks).toHaveLength(10);
    for (let i = 0; i < kicks.length; i += 2) {
      expect(kicks[i]!.team).toBe("for");
      expect(kicks[i + 1]!.team).toBe("against");
    }
  });
});

describe("quali partite meritano di essere viste", () => {
  it("tutto il tabellone di Corona conta: ogni gara è un'eliminazione", () => {
    for (const stage of ["quarti", "semifinali", "finale"]) {
      expect(isKeyMatch({ cupStage: stage, totalRounds: 38 })).toBe(true);
    }
  });

  it("il girone di Corona no: sono sei partite, non un'eliminazione", () => {
    expect(isKeyMatch({ cupStage: "girone", totalRounds: 38 })).toBe(false);
  });

  it("le fasi finali di Coppa Tricolore contano quanto quelle di Corona", () => {
    for (const stage of ["quarti", "semifinale", "finale"]) {
      expect(isKeyMatch({ nationalCupStage: stage, totalRounds: 38 })).toBe(true);
    }
  });

  it("i primi turni di Tricolore no: quaranta squadre cominciano con partite che non decidono", () => {
    for (const stage of ["preliminare", "sedicesimi", "ottavi"]) {
      expect(isKeyMatch({ nationalCupStage: stage, totalRounds: 38 })).toBe(false);
    }
  });

  it("l'invito nomina la coppa giusta: Tricolore e Corona non si confondono", () => {
    expect(keyMatchReason({ nationalCupStage: "finale", totalRounds: 38 })).toMatch(/Tricolore/);
    expect(keyMatchReason({ cupStage: "finale", totalRounds: 38 })).toMatch(/Corona/);
  });

  it("in campionato conta solo la volata, e solo se siamo in corsa", () => {
    // Ultima giornata, primi: conta.
    expect(isKeyMatch({ leagueRound: 36, totalRounds: 38, position: 1 })).toBe(true);
    // Ultima giornata, decimi e lontani: non conta.
    expect(
      isKeyMatch({ leagueRound: 36, totalRounds: 38, position: 10, gapFromFirst: 30 }),
    ).toBe(false);
    // Metà stagione, primi: non conta ancora.
    expect(isKeyMatch({ leagueRound: 12, totalRounds: 38, position: 1 })).toBe(false);
  });

  it("chi insegue a pochi punti è in corsa quanto chi guida", () => {
    expect(
      isKeyMatch({ leagueRound: 35, totalRounds: 38, position: 4, gapFromFirst: 3 }),
    ).toBe(true);
  });

  it("scontro diretto fra le prime quattro: conta a prescindere dalla giornata", () => {
    expect(
      isKeyMatch({ leagueRound: 10, totalRounds: 38, position: 3, opponentPosition: 2 }),
    ).toBe(true);
  });

  it("non è uno scontro diretto se l'avversaria è fuori dal vertice", () => {
    expect(
      isKeyMatch({ leagueRound: 10, totalRounds: 38, position: 2, opponentPosition: 12 }),
    ).toBe(false);
  });

  it("il motivo distingue lo scontro diretto dalla volata", () => {
    expect(
      keyMatchReason({ leagueRound: 10, totalRounds: 38, position: 1, opponentPosition: 3 }),
    ).toMatch(/[Ss]contro diretto/);
  });

  it("il motivo è scritto e comprensibile", () => {
    expect(keyMatchReason({ cupStage: "finale", totalRounds: 38 })).toMatch(/[Ff]inale/);
    expect(keyMatchReason({ leagueRound: 36, totalRounds: 38, position: 1 })).toMatch(/titolo/i);
  });
});
