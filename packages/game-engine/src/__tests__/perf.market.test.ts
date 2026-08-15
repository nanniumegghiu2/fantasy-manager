import { describe, it } from "vitest";
import { dressingRoom, playerValue, searchMarket, financesOf, currentLineup } from "../ds/career";
import type { ResolvedPlayer } from "../ds/career";
import { newCareer } from "./helpers/dsWorld";

/**
 * Dove va il tempo quando si apre il mercato.
 *
 * Misurato nel browser con CPU 4× (telefono di fascia media): aprire la finestra costava **473ms
 * di JavaScript bloccante**, cambiare scheda 235-374ms. Questo test dice *quale* funzione li
 * consuma, invece di farlo indovinare.
 */
describe("costo delle letture del mercato", () => {
  it("misura le funzioni che il pannello chiama a ogni apertura", () => {
    const { state, world } = newCareer();

    const grande: Record<string, ResolvedPlayer> = { ...world.players };
    for (let i = 0; i < 3500; i++) {
      grande[`extra-${i}`] = {
        id: `extra-${i}`,
        name: `Extra ${i}`,
        nation: "Italia",
        role: "CC",
        secondaryRoles: [],
        department: "CC",
        birthDate: "1998-01-01",
      };
    }
    const w = { ...world, players: grande };

    const ms = (nome: string, fn: () => unknown, giri = 10) => {
      fn();
      const t0 = performance.now();
      for (let i = 0; i < giri; i++) fn();
      const per = (performance.now() - t0) / giri;
      console.log(`  ${nome.padEnd(34)} ${per.toFixed(2)}ms`);
      return per;
    };

    console.log(`\ncosto per chiamata (mondo da ${Object.keys(grande).length} giocatori):`);
    ms("dressingRoom", () => dressingRoom(state, w));
    ms("financesOf", () => financesOf(state, w));
    ms("currentLineup", () => currentLineup(state, w));
    ms("playerValue (uno)", () => playerValue(state, w, state.roster[0]!.playerId));
    ms("playerValue (tutta la rosa)", () => state.roster.map((e) => playerValue(state, w, e.playerId)));
    ms("searchMarket (senza filtri)", () => searchMarket(state, w, { sort: "overall" }), 5);
    ms("searchMarket (per nome)", () => searchMarket(state, w, { query: "extra-1", sort: "overall" }), 5);
  });
});
