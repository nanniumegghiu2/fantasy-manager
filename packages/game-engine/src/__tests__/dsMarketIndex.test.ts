/**
 * **L'anagrafica di mercato copre tutti.**
 *
 * Il difetto che ha imposto questa regola, segnalato dall'utente: alcune offerte di prestito
 * ricevute **dalla seconda stagione in poi** mostravano `"Giocatore"` al posto del nome.
 *
 * La causa non era un ripiego troppo timido ma un insieme incompleto. `evolveWorld` toglie dal
 * mondo chi è diventato nostro (`ownedByUser`), e lo fa *prima* di inserirlo nell'indice "chi è";
 * l'anagrafica del mercato veniva poi ricostruita da quell'indice più due rattoppi — i giocatori
 * del nostro club **secondo il database** e i regen. Chi abbiamo **comprato da un altro club**
 * non sta in nessuno dei tre insiemi: non è più nel mondo (è nostro), non è nel roster di
 * database del nostro club (era di un'altra squadra), non è un regen.
 *
 * Le proposte di prestito riguardano gli under 24, cioè proprio i giovani che si comprano, e non
 * possono esistere prima di aver comprato qualcuno: ecco perché il difetto compariva dalla
 * seconda stagione.
 *
 * La regola era già scritta come commento nel punto sbagliato ("l'anagrafica deve coprire
 * tutti"); qui diventa una funzione con un test, così non può più andare fuori sincrono con sé
 * stessa.
 */
import { describe, expect, it } from "vitest";
import { marketPlayerIndex } from "../ds/careerMarket";
import type { PlayerRef } from "../ds/types";

function ref(id: string, name: string): PlayerRef {
  return { id, name, nation: "Italia", role: "CC", secondaryRoles: [] };
}

describe("marketPlayerIndex", () => {
  it("copre chi abbiamo comprato, che il mondo evoluto non contiene più", () => {
    const comprato = ref("p-comprato", "Marco Rossi");

    const index = marketPlayerIndex({
      // Il database li conosce tutti, sempre: è la fonte che non dimentica nessuno.
      database: [comprato, ref("p-altro", "Luca Bianchi")],
      // Il mondo evoluto esclude i nostri, ed è corretto che lo faccia: li gestisce la carriera.
      world: [ref("p-altro", "Luca Bianchi")],
      generated: [],
    });

    expect(index["p-comprato"]?.name).toBe("Marco Rossi");
  });

  it("copre i regen, che nel database non esistono", () => {
    const index = marketPlayerIndex({
      database: [ref("p-1", "Luca Bianchi")],
      world: [ref("p-1", "Luca Bianchi")],
      generated: [ref("regen-9", "Andrea Verdi")],
    });

    expect(index["regen-9"]?.name).toBe("Andrea Verdi");
  });

  it("copre i regen nati nei club del computer, che stanno solo nel mondo evoluto", () => {
    const index = marketPlayerIndex({
      database: [ref("p-1", "Luca Bianchi")],
      world: [ref("p-1", "Luca Bianchi"), ref("airegen-p-7", "Nicola Ferri")],
      generated: [],
    });

    expect(index["airegen-p-7"]?.name).toBe("Nicola Ferri");
  });

  it("nessuna fonte può far sparire un giocatore già presente", () => {
    // Le fonti si sovrappongono: chi arriva dopo aggiorna, non azzera. Verificato perché
    // l'ordine di composizione è l'unica cosa che potrebbe reintrodurre il difetto.
    const index = marketPlayerIndex({
      database: [ref("p-1", "Luca Bianchi"), ref("p-2", "Marco Rossi")],
      world: [ref("p-2", "Marco Rossi")],
      generated: [ref("p-3", "Andrea Verdi")],
    });

    expect(Object.keys(index).sort()).toEqual(["p-1", "p-2", "p-3"]);
  });
});
