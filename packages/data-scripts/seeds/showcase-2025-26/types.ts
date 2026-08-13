import type { Role } from "@app/shared-types";

/**
 * **Le leghe vetrina, 2025/26** — club non giocabili che esistono per popolare il mercato.
 *
 * Richiesta dell'utente (2026-08-13): più squadre e più giocatori in database, così la ricerca
 * di mercato della DS mode smette di proporre sempre gli stessi venti nomi. Piano completo in
 * `docs/piano-leghe-vetrina.md`.
 *
 * ## Cosa qui è un fatto e cosa è un nostro giudizio (CLAUDE.md §2.1/2.2)
 *
 * La distinzione non è formale: è la ragione per cui questo progetto può esistere.
 *
 * **Fatti**, presi da fonti pubbliche e mai inventati:
 * - `name`, `birthDate`, `nation` e la posizione grossa (G/D/M/F) vengono da
 *   [footballsquads.co.uk](https://www.footballsquads.co.uk), la stessa fonte già usata per la
 *   Serie B e per i club di Serie A senza pagina Wikipedia dedicata. Riporta solo rosa,
 *   ruolo, nazionalità e data di nascita: nessuna statistica, nessuna valutazione proprietaria
 *   di terzi.
 *
 * **Stime editoriali nostre**, dichiarate come tali:
 * - `role` e `secondaryRoles` — la fonte distingue solo G/D/M/F, mentre lo scacchiere del gioco
 *   ha 14 caselle (§3.1). La casella puntuale è quindi una **nostra attribuzione**. Vale la
 *   stessa precisazione della Serie B: il nostro reparto non coincide sempre con la lettera
 *   della fonte, perché ali e trequartisti stanno nelle linee 4-5, cioè in centrocampo — una
 *   "F" può diventare `TQD`/`TQS`/`TRQ`. Quel che resta invariante è la fascia di campo: un
 *   portiere resta portiere, un difensore non diventa mai una punta.
 * - `overall` — scritto uno per uno, con una banda dichiarata per campionato (sotto).
 *
 * ## Perché le rose sono curate e non complete
 *
 * Si tengono **20-24 giocatori** per club, senza i ragazzi del vivaio: allungano le liste senza
 * essere mai una scelta sensata nel mercato, ed è la stessa regola già applicata alla Serie B e
 * alla potatura sotto 65 della Serie A (§2.3).
 *
 * Dove la fonte presenta righe incomplete o incoerenti (numeri di maglia senza nome, un ruolo
 * che non torna) quelle righe si **scartano**, non si completano a memoria: un dato inventato
 * qui sarebbe indistinguibile da uno vero, ed è esattamente ciò che la separazione fra fatti e
 * stime serve a impedire.
 */
export interface ShowcasePlayer {
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
  /** Stima editoriale nostra, dentro la banda dichiarata del suo campionato. */
  overall: number;
}

export interface ShowcaseClub {
  name: string;
  /** 1-5, stessa scala di `clubs.prestige_tier`. */
  prestigeTier: number;
  players: ShowcasePlayer[];
}

export interface ShowcaseLeague {
  /** Deve comparire in `SHOWCASE_LEAGUES` (`divisions.ts`), altrimenti diventa giocabile. */
  name: string;
  nation: string;
  /**
   * 1-5. Alimenta il valore di mercato (§2.3): è ciò che rende un giocatore della Primeira Liga
   * strutturalmente più economico di un pari Overall di Premier, che è metà del motivo per cui
   * pescare da questi campionati è un affare.
   */
  prestigeTier: number;
  /**
   * La banda di Overall consentita, verificata dall'importer.
   *
   * Non è una formalità: senza, una lega vetrina può diventare una scorciatoia per trovare
   * fuoriclasse a poco prezzo, e il mercato dei Big 5 smetterebbe di avere senso.
   */
  overallRange: readonly [number, number];
  clubs: ShowcaseClub[];
}

export const SHOWCASE_ERA = "2025/26";
