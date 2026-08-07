/**
 * Le venti squadre ammesse alla **Corona Continentale** nella prima stagione di carriera:
 * le prime quattro di ciascuno dei cinque campionati secondo la stagione 2025/26.
 *
 * **Stima editoriale dichiarata**, non un dato importato. Il database contiene rose e Overall
 * ma non le classifiche finali di campionato, quindi la griglia di partenza va decisa da noi —
 * esattamente come si è fatto per gli Overall (CLAUDE.md sez. 2.2), e con lo stesso statuto:
 * è un nostro giudizio, non un fatto spacciato per tale.
 *
 * Il criterio adottato è la forza dell'undici titolare che il database attribuisce a ciascun
 * club, così la griglia è coerente con il resto del gioco: se il motore considera l'Inter la
 * più forte d'Italia, sarebbe incomprensibile vederla fuori dalla Corona alla prima stagione.
 *
 * Dalla **seconda stagione in poi questo elenco non serve più**: le partecipanti sono le prime
 * quattro delle classifiche effettivamente simulate.
 */

/**
 * Nomi dei club così come compaiono in `clubs.name`: si risolvono a id al caricamento.
 *
 * **Tre per campionato più una ripescata**, per un totale di sedici (vedi `CONTINENTAL_TEAMS`).
 * La sedicesima è il Chelsea, prima delle escluse per forza dell'undici: la Premier è il
 * campionato più forte del database, quindi è lì che il posto in più ha più senso.
 */
export const CONTINENTAL_SEED_CLUBS: Record<string, string[]> = {
  "Serie A": ["Inter", "Napoli", "Milan"],
  "Premier League": ["Manchester City", "Arsenal", "Liverpool", "Chelsea"],
  "La Liga": ["Real Madrid", "FC Barcelona", "Atlético Madrid"],
  Bundesliga: ["FC Bayern München", "Borussia Dortmund", "Bayer 04 Leverkusen"],
  "Ligue 1": ["Paris Saint-Germain", "Olympique de Marseille", "AS Monaco"],
};

/**
 * Quante squadre partecipano alla Corona: **sedici**, tre per campionato più una ripescata.
 *
 * Era venti, ed è stato ridotto misurando (`pnpm probe-coppa`). Con venti iscritte e otto posti
 * per il tabellone, **sei sole partite** decidono un ordinamento fra squadre che il database
 * comprime in tredici punti di attacco: la corazzata resta fuori quasi metà delle volte, e a
 * ripetersi per tre stagioni sembra un difetto anche quando è statistica. È la segnalazione
 * dell'utente — "nonostante sia fortissima non riesco mai ad avanzare".
 *
 * Con sedici iscritte gli stessi otto posti diventano metà del gruppo: chi è forte passa
 * spesso, chi è al limite se la gioca, e il girone resta corto e teso com'era pensato. Il
 * formato non cambia — sei turni, poi quarti, semifinale e finale — cambia solo quanta gente
 * si contende gli stessi posti.
 */
export const CONTINENTAL_TEAMS = 16;

/**
 * Quante squadre si qualificano da ogni campionato, dalla seconda stagione in poi.
 *
 * Tre per lega fanno quindici: la sedicesima è la migliore fra le escluse, che è anche il modo
 * di non chiudere la porta a un campionato particolarmente forte in quella stagione.
 */
export const QUALIFIERS_PER_LEAGUE = 3;

/** L'elenco piatto dei venti nomi, nell'ordine dei campionati. */
export function continentalSeedNames(): string[] {
  return Object.values(CONTINENTAL_SEED_CLUBS).flat();
}

/** Il campionato di provenienza di un club della griglia iniziale. */
export function seedLeagueOf(clubName: string): string | undefined {
  for (const [league, clubs] of Object.entries(CONTINENTAL_SEED_CLUBS)) {
    if (clubs.includes(clubName)) return league;
  }
  return undefined;
}

/** Un club è ammesso alla Corona nella prima stagione? Serve a evidenziarlo alla scelta. */
export function isSeededForContinental(clubName: string): boolean {
  return seedLeagueOf(clubName) !== undefined;
}
