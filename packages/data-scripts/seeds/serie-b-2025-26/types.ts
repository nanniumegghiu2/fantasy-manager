import type { Role } from "@app/shared-types";

/**
 * Serie B italiana 2025/26 — club e rose.
 *
 * ## Cosa qui è un fatto e cosa è un nostro giudizio (CLAUDE.md sez. 2.1/2.2)
 *
 * La distinzione non è formale: è la ragione per cui questo progetto può esistere.
 *
 * **Fatti**, presi da fonti pubbliche e mai inventati:
 * - `name`, `birthDate`, `nation` e la posizione grossa (G/D/M/F) vengono da
 *   [footballsquads.co.uk](https://www.footballsquads.co.uk/italy/2025-2026/serieb.htm),
 *   la stessa fonte già usata per i club di Serie A senza pagina Wikipedia dedicata. Riporta
 *   solo rosa, ruolo, nazionalità e data di nascita: nessuna statistica, nessuna valutazione
 *   proprietaria di terzi.
 *
 * **Stime editoriali nostre**, dichiarate come tali:
 * - `role` e `secondaryRoles` — la fonte distingue solo G/D/M/F, mentre lo scacchiere del
 *   gioco ha 14 caselle (sez. 3.1). La casella puntuale è quindi **una nostra attribuzione**,
 *   basata su come quel giocatore viene impiegato, non un dato importato.
 *
 *   Da qui una precisazione che vale la pena fare per non sovrastimare la fattualità del
 *   dato: il nostro **reparto non coincide sempre con la lettera della fonte**, perché lo
 *   scacchiere mette ali e trequartisti nella linea 4-5, cioè in **centrocampo** — quindi una
 *   "F" della fonte può diventare `TQD`/`TQS`/`TRQ` e risultare CC da noi. Non è un errore di
 *   trascrizione: è la stessa convenzione con cui l'importatore dei Big 5 mappa già `RW`→`TQD`,
 *   `LW`→`TQS`, `CAM`→`TRQ`. Quel che resta invariante è la **fascia di campo**: un portiere
 *   resta portiere, un difensore non diventa mai una punta.
 * - `overall` — scritto uno per uno, come per i Big 5. Banda **60-74**: il tetto sta sotto i
 *   fuoriclasse di Serie A e il pavimento sotto il fondo rosa della A, così le due leghe
 *   restano confrontabili senza che la B risulti mai artificialmente competitiva.
 *
 *   Il pavimento è **60 e non più basso** perché è il minimo della scala del progetto
 *   (CLAUDE.md sez. 2.2) e il database lo impone con un vincolo `check` su `player_pool`.
 *   La prima stesura scendeva a 58 e la scrittura è stata giustamente respinta: i 52 valori
 *   58/59 sono stati riportati a 60, appiattendo il fondo rosa della categoria. È una perdita
 *   di granularità reale ma innocua — quei giocatori sono le ultime riserve di squadre di
 *   Serie B, indistinguibili fra loro anche nella realtà.
 *
 * ## Perché un solo file per giocatore invece di due
 *
 * Per la Serie A anagrafica e valutazioni vivono in file separati (`editorial-overalls-*.ts`),
 * agganciati per `Club|Nome`. Lì era obbligato: l'anagrafica arrivava da un foglio esterno.
 * Qui scriviamo **entrambe** le cose, e tenerle in due elenchi da riconciliare a stringa
 * introdurrebbe solo un modo nuovo di sbagliare — è già costato normalizzazioni NFC e chiavi
 * mancate (Decision Log, 2026-07-29).
 *
 * ## Regole di composizione della rosa
 *
 * - **Niente giovanili**: le rose della fonte includono i 2007-2009 del vivaio, che allungano
 *   le liste senza essere mai una scelta sensata — stessa ragione della potatura sotto 65
 *   applicata alla Serie A (sez. 2.3). Si tengono 22-25 giocatori per club.
 * - **Ogni terzino sa fare il quinto** (`TD`→`QD`, `TS`→`QS` fra i secondari): regola
 *   obbligatoria di sez. 2.3, senza la quale i moduli a tre difensori diventano irriempibili.
 */
export interface SerieBPlayer {
  /** Fattuale. */
  name: string;
  /** Fattuale, in italiano — stesse stringhe di `NATION_IT`, altrimenti la chemistry non lega. */
  nation: string;
  /** Fattuale: `YYYY-MM-DD`. */
  birthDate: string;
  /** Stima editoriale nostra: la casella puntuale dentro un reparto che è invece fattuale. */
  role: Role;
  /** Stima editoriale nostra. */
  secondaryRoles?: Role[];
  /** Stima editoriale nostra, banda 58-74. */
  overall: number;
}

export interface SerieBClub {
  name: string;
  /** 1-5, stessa scala di `clubs.prestige_tier`: in Serie B non si va oltre 2. */
  prestigeTier: number;
  players: SerieBPlayer[];
}

/** Il campionato, come riga di `leagues`. */
export const SERIE_B_LEAGUE = {
  name: "Serie B",
  nation: "Italia",
  /**
   * Prestigio 1, il minimo. Alimenta il valore di mercato (sez. 2.3) e la base Overall:
   * è ciò che rende un giocatore di Serie B strutturalmente più economico di un pari Overall
   * di Serie A, che è esattamente la ragione per cui il mercato fra le due leghe è interessante.
   */
  prestigeTier: 1,
  era: "2025/26",
} as const;
