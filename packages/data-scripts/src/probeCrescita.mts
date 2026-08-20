/**
 * **Quanto cambia la crescita adesso che le medie voto contano.**
 *
 * Misura mirata invece di rigirare l'intera calibrazione: l'unica cosa cambiata è che
 * `statLineOf` passa `averageRating` e `cleanSheets` ad `applySeasonAdjustment` invece di `null`.
 * Qui si confrontano gli stessi giocatori con e senza quel dato.
 */
import { advanceSeasonOveralls, createRosterEntry, type AgingInput } from "@app/game-engine";
import type { Role } from "@app/shared-types";

const RUOLI: Role[] = ["POR", "DC", "TD", "MED", "CC", "ED", "TRQ", "ATT"];

function rosa(conVoti: boolean): AgingInput[] {
  return RUOLI.flatMap((role, i) =>
    [22, 27, 32].map((age, j) => {
      const entry = createRosterEntry({
        playerId: `${role}-${age}`,
        overall: 76,
        potential: 86,
        sinceSeason: 1,
      });
      // Una stagione da titolare, con produzione plausibile per ruolo.
      const gol = role === "ATT" ? 14 : role === "TRQ" || role === "ED" ? 6 : role === "CC" ? 3 : 1;
      const assist = role === "CC" || role === "TRQ" ? 8 : role === "ED" ? 5 : 1;
      // Il voto: chi rende bene prende 6,9, chi rende male 5,8.
      const rende = (i + j) % 2 === 0;
      const voto = rende ? 6.9 : 5.8;
      return {
        entry: {
          ...entry,
          stats: {
            appearances: 30,
            minutes: 2700,
            goals: gol,
            assists: assist,
            ratingSum: conVoti ? voto * 30 : 0,
            ratedAppearances: conVoti ? 30 : 0,
            cleanSheets: conVoti && role === "POR" ? 12 : 0,
          },
        },
        role,
        age,
        leaguePrestige: 5,
      } satisfies AgingInput;
    }),
  );
}

const senza = advanceSeasonOveralls(rosa(false), 1);
const con = advanceSeasonOveralls(rosa(true), 1);

console.log("ruolo/età   merito SENZA voti   merito CON voti   scarto");
let sommaScarto = 0;
for (let i = 0; i < senza.length; i++) {
  const a = senza[i]!;
  const b = con[i]!;
  sommaScarto += Math.abs(b.meritDelta - a.meritDelta);
  console.log(
    `${a.playerId.padEnd(10)}  ${String(a.meritDelta).padStart(6)}            ${String(b.meritDelta).padStart(6)}          ${b.meritDelta - a.meritDelta > 0 ? "+" : ""}${b.meritDelta - a.meritDelta}`,
  );
}
console.log(`\nscarto medio assoluto sul merito: ${(sommaScarto / senza.length).toFixed(2)} punti di Overall`);
const portieri = con.filter((r) => r.playerId.startsWith("POR"));
const portieriSenza = senza.filter((r) => r.playerId.startsWith("POR"));
console.log(
  `[declino] 32 anni — Overall dopo, senza voti ${senza.filter(r=>r.playerId.endsWith("-32")).map(r=>r.after).join(",")} · con voti ${con.filter(r=>r.playerId.endsWith("-32")).map(r=>r.after).join(",")}`,
);
console.log(
  `portieri — merito medio senza voti ${(portieriSenza.reduce((s, r) => s + r.meritDelta, 0) / portieriSenza.length).toFixed(2)}, con voti ${(portieri.reduce((s, r) => s + r.meritDelta, 0) / portieri.length).toFixed(2)}`,
);
