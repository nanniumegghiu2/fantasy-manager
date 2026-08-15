import { describe, it, expect } from "vitest";
import { dressingRoom, playerFactsOf, careerPlayers } from "../ds/career";
import type { ResolvedPlayer } from "../ds/career";
import { newCareer } from "./helpers/dsWorld";

/**
 * **Quanto costa consultare lo spogliatoio.**
 *
 * Non è un test di comportamento ma una **misura**, scritta per rispondere a una segnalazione
 * precisa dell'utente: dopo il rinnovo grafico la modalità è diventata «lenta e macchinosa nella
 * navigazione e nei click dei tasti».
 *
 * Il sospetto, letto nel codice prima di misurare: `playerFactsOf` chiama `careerPlayers(state,
 * world)` — che quando esistono dei regen fa `{ ...world.players }`, cioè copia l'intero indice
 * del mondo — **una volta per giocatore**, dentro il ciclo di `dressingRoom` sulla rosa. Con un
 * mondo reale da ~3.500 giocatori e una rosa da ~28, sono ~100.000 copie di oggetto per singola
 * chiamata.
 *
 * Il test non fissa una soglia in millisecondi (dipende dalla macchina): fissa il **rapporto**
 * fra il costo con e senza regen, che è la proprietà che dice se il difetto c'è.
 */
describe("costo di dressingRoom", () => {
  it("non deve crescere con la dimensione del mondo", () => {
    const { state, world } = newCareer();

    // Un mondo realistico: il database vero ne ha 3.564.
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
    const mondoGrande = { ...world, players: grande };

    // Un regen basta a far scattare la copia dell'indice in `careerPlayers`.
    const conRegen = {
      ...state,
      generated: [
        {
          id: "regen-1",
          name: "Regen Uno",
          nation: "Italia",
          role: "CC" as const,
          secondaryRoles: [],
          birthDate: "2008-01-01",
          potential: 80,
          overall: 60,
        },
      ],
    };

    /**
     * ⚠️ **Ogni giro usa uno stato nuovo, per battere la cache.**
     *
     * `dressingRoom` è memoizzata sull'identità di `state`: cronometrando lo stesso oggetto si
     * misurerebbe la cache e non il calcolo, e il test resterebbe verde anche se il costo vero
     * tornasse a mille millisecondi. È lo stesso antipattern già registrato nel Decision Log —
     * un test che non può fallire per la ragione giusta è peggio di nessun test.
     */
    const cronometra = (base: typeof state, giri = 20) => {
      dressingRoom({ ...base }, mondoGrande); // scalda i percorsi, non la cache
      const t0 = performance.now();
      for (let i = 0; i < giri; i++) dressingRoom({ ...base }, mondoGrande);
      return (performance.now() - t0) / giri;
    };

    const senzaRegen = cronometra(state);
    const conRegenMs = cronometra(conRegen as typeof state);

    console.log(
      `dressingRoom su mondo da ${Object.keys(grande).length} giocatori:\n` +
        `  senza regen: ${senzaRegen.toFixed(2)}ms\n` +
        `  con 1 regen: ${conRegenMs.toFixed(2)}ms  (${(conRegenMs / senzaRegen).toFixed(1)}× più lento)`,
    );

    // Un solo regen non può rendere l'operazione un ordine di grandezza più cara: se lo fa, è
    // perché l'indice del mondo viene ricostruito per ogni giocatore della rosa.
    expect(conRegenMs).toBeLessThan(senzaRegen * 3);
  });

  it("careerPlayers non va chiamata una volta per giocatore", () => {
    const { state, world } = newCareer();
    const conRegen = {
      ...state,
      generated: [
        {
          id: "regen-1",
          name: "Regen Uno",
          nation: "Italia",
          role: "CC" as const,
          secondaryRoles: [],
          birthDate: "2008-01-01",
          potential: 80,
          overall: 60,
        },
      ],
    } as typeof state;

    let chiamate = 0;
    const spia = new Proxy(world.players, {
      ownKeys(t) {
        chiamate++;
        return Reflect.ownKeys(t);
      },
    });

    dressingRoom(conRegen, { ...world, players: spia });

    console.log(`copie dell'indice del mondo per una chiamata a dressingRoom: ${chiamate}`);
    // Al più una: l'indice è lo stesso per tutti i giocatori della stessa chiamata.
    expect(chiamate).toBeLessThanOrEqual(1);
  });
});
