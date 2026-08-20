/**
 * **La partita da guardare si decide una volta sola.**
 *
 * ⚠️ Segnalazione dell'utente: *"vedo l'esito delle partite prima del 2D, soprattutto nelle
 * coppe vedo il passaggio o meno del turno, perdendo la suspance della partita"*.
 *
 * Una delle due cause era una **doppia implementazione della stessa regola**: `advanceToNextStop`
 * decideva se fermarsi, `CareerScreen` decideva se proporre l'invito, e i due criteri non
 * coincidevano — la UI passava anche la posizione dell'avversaria (lo scontro diretto), il
 * motore no. La conseguenza: la UI marcava come chiave una partita a **metà coda** su cui il
 * motore non si era fermato, le settimane successive continuavano a scorrere, e l'invito
 * arrivava alla fine per una gara di parecchie giornate prima — con tutto il resto già a
 * schermo.
 *
 * L'invariante che questi test difendono è quella che rende impossibile il difetto, a
 * prescindere da come i due pezzi verranno riscritti: **se un referto è una partita chiave, la
 * corsa si ferma su di lui, e nessun referto prima dell'ultimo lo è mai.**
 */
import { describe, expect, it } from "vitest";
import {
  advanceToNextStop,
  advanceWeek,
  createCareer,
  type CareerState,
  type CareerWorld,
  type StopReason,
} from "../ds/career";
import { buildWorld, newCareer, rinnovaTutti, withCupAndMarket } from "./helpers/dsWorld";

/** Una carriera con Corona e mercato accesi: è lì che vivono le partite chiave vere. */
function carrieraCompleta(seed = "chiave-1"): { state: CareerState; world: CareerWorld } {
  const base = buildWorld(80);
  const world = withCupAndMarket(base);
  const state = createCareer({
    seed,
    clubId: "mio",
    leagueId: "serie-a",
    coachId: "c-10",
    roster: base.roster,
    budget: 30_000_000,
  });
  return { state: rinnovaTutti(state), world };
}

/**
 * Toglie di mezzo ciò che ferma la corsa e **non è** una partita: mercato aperto e richiesta di
 * un giocatore. Senza, il test si arena alla prima finestra e non arriva mai a una gara di
 * coppa — cioè verificherebbe zero, che è peggio di non verificare.
 */
function sblocca(state: CareerState, world: CareerWorld, reason: StopReason): CareerState {
  if (reason !== "mercato" && reason !== "richiesta") return state;
  const { state: next } = advanceWeek(state, world, {
    closeMarket: true,
    requestResponse: "prometti",
  });
  return rinnovaTutti(next);
}

describe("la corsa si ferma esattamente sulla partita chiave", () => {
  it("nessun referto prima dell'ultimo è mai una partita chiave", () => {
    // Più semi: il difetto dipendeva dal calendario e dalla classifica, quindi un solo seme
    // avrebbe potuto non incontrare mai uno scontro diretto a metà coda.
    for (const seme of ["chiave-1", "chiave-2", "chiave-3"]) {
      const { state, world } = carrieraCompleta(seme);
      let current = state;

      let viste = 0;
      for (let giro = 0; giro < 200; giro++) {
        const { state: next, reports, reason } = advanceToNextStop(current, world);
        current = sblocca(next, world, reason);

        const primi = reports.slice(0, -1);
        const conChiave = primi.filter((r) => r.keyMatch).map((r) => `${r.season}/${r.week}`);
        // È l'asserzione che sarebbe fallita prima: una partita chiave in mezzo alla coda
        // significa che la corsa le è passata sopra, e i risultati successivi si sono già visti.
        expect(conChiave, `seme ${seme}: partite chiave saltate`).toEqual([]);

        if (reason === "partita_chiave") {
          expect(reports[reports.length - 1]!.keyMatch).toBeDefined();
          viste++;
        }
        if (reason === "fine_carriera") break;
        if (reports.length === 0 && reason !== "mercato" && reason !== "richiesta") break;
      }

      // Un test che non incontra mai il caso non verifica niente: qui è essenziale dirlo,
      // perché l'asserzione centrale è un "non deve mai succedere".
      expect(viste, `seme ${seme}: nessuna partita chiave incontrata`).toBeGreaterThan(0);
    }
  });

  it("una partita chiave porta con sé tutto ciò che serve per giocarla in 2D", () => {
    const { state, world } = carrieraCompleta("chiave-teatro");
    let current = state;

    for (let giro = 0; giro < 200; giro++) {
      const { state: next, reports, reason } = advanceToNextStop(current, world);
      current = sblocca(next, world, reason);
      if (reason !== "partita_chiave") {
        if (reason === "fine_carriera") break;
        if (reports.length === 0 && reason !== "mercato" && reason !== "richiesta") break;
        continue;
      }

      const chiave = reports[reports.length - 1]!.keyMatch!;
      expect(chiave.opponent.length).toBeGreaterThan(0);
      expect(chiave.reason.length).toBeGreaterThan(0);
      expect(["campionato", "corona", "tricolore"]).toContain(chiave.competition);
      // Il tabellino è quello vero della partita, non una copia ricalcolata: è la garanzia che
      // guardare o saltare dia lo stesso esito.
      const referto = reports[reports.length - 1]!;
      const originale =
        chiave.competition === "corona"
          ? referto.cupMatch?.result
          : chiave.competition === "tricolore"
            ? referto.nationalCupMatch?.result
            : referto.match?.result;
      expect(chiave.result).toBe(originale);
      return;
    }

    throw new Error("Nessuna partita chiave incontrata: il test non ha verificato nulla");
  });

  it("una settimana senza partite non è mai una partita chiave", () => {
    const { state, world } = newCareer("chiave-vuota");
    const { reports } = advanceToNextStop(rinnovaTutti(state), world);
    for (const referto of reports) {
      if (!referto.match && !referto.cupMatch && !referto.nationalCupMatch) {
        expect(referto.keyMatch).toBeUndefined();
      }
    }
  });
});
