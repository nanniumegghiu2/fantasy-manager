/**
 * Le primitive della DS mode — il sistema di design che mancava.
 *
 * La diagnosi (`docs/piano-ds-mobile.md`, parte A1) ha trovato una causa sola
 * dietro le tre lamentele dell'utente (frasi tagliate, passaggi poco intuitivi,
 * grafiche non ottimizzate): non esisteva un sistema. `index.css` dichiarava
 * **solo colori** — nessuna scala tipografica, di spaziatura, di raggi, di
 * bersaglio tattile — e 43 schermate se le erano inventate una per una.
 *
 * ⚠️ **Regola**: una schermata della DS mode non scrive più misure a mano. Se
 * serve una forma che qui non c'è, si aggiunge qui — non nel file di quella
 * schermata, o fra tre mesi saremo di nuovo a 353 misure arbitrarie.
 */
export { Button } from "./Button";
export { Chip, ChipBar } from "./Chip";
export { ListRow } from "./ListRow";
export { Sheet } from "./Sheet";
export { Stat, StatRow } from "./Stat";
export { Stepper, type Step } from "./Stepper";
export { TabBar, type TabItem } from "./TabBar";
