/**
 * Catalogo degli allenatori della DS Mode.
 *
 * Contiene un archivio curato di allenatori reali dei Big 5 campionati europei e svincolati
 * illustri. Ogni allenatore possiede il suo modulo preferito reale, lo stile tattico e
 * la propensione allo sviluppo dei giovani, oltre all'eventuale club di default guidato.
 */
import type { Coach } from "./types";

export const COACHES: Coach[] = [
  // --- Tier 5: Elite Mondiale (Reputazione 5) ---
  {
    id: "coach-inzaghi",
    name: "Simone Inzaghi",
    nation: "Italia",
    formationId: "3-5-2",
    style: { attack: 2, defence: 2 },
    development: 1.1,
    hireCost: 8_500_000,
    severance: 6_500_000,
    reputation: 5,
    defaultClubId: "inter",
    tacticalPhilosophy: "3-5-2 Spettacolo & Contropiede",
  },
  {
    id: "coach-guardiola",
    name: "Pep Guardiola",
    nation: "Spagna",
    formationId: "4-3-3",
    style: { attack: 3, defence: 1 },
    development: 1.3,
    hireCost: 10_000_000,
    severance: 8_000_000,
    reputation: 5,
    defaultClubId: "manchester-city",
    tacticalPhilosophy: "Tiki-Taka & Calcio Posizionale",
  },
  {
    id: "coach-ancelotti",
    name: "Carlo Ancelotti",
    nation: "Italia",
    formationId: "4-3-3",
    style: { attack: 3, defence: 1 },
    development: 1.0,
    hireCost: 9_500_000,
    severance: 7_500_000,
    reputation: 5,
    defaultClubId: "real-madrid",
    tacticalPhilosophy: "Gestione dei Campioni & Equilibrio",
  },
  {
    id: "coach-flick",
    name: "Hansi Flick",
    nation: "Germania",
    formationId: "4-2-3-1",
    style: { attack: 3, defence: 0 },
    development: 1.2,
    hireCost: 8_800_000,
    severance: 6_800_000,
    reputation: 5,
    defaultClubId: "barcelona",
    tacticalPhilosophy: "Gegenpressing & Verticalità",
  },
  {
    id: "coach-arteta",
    name: "Mikel Arteta",
    nation: "Spagna",
    formationId: "4-3-3",
    style: { attack: 2, defence: 2 },
    development: 1.4,
    hireCost: 8_200_000,
    severance: 6_200_000,
    reputation: 5,
    defaultClubId: "arsenal",
    tacticalPhilosophy: "Controllo del Gioco & Intensità",
  },
  {
    id: "coach-alonso",
    name: "Xabi Alonso",
    nation: "Spagna",
    formationId: "3-4-2-1",
    style: { attack: 3, defence: 1 },
    development: 1.5,
    hireCost: 8_500_000,
    severance: 6_500_000,
    reputation: 5,
    defaultClubId: "bayer-leverkusen",
    tacticalPhilosophy: "3-4-2-1 Dominante & Fluido",
  },
  {
    id: "coach-enrique",
    name: "Luis Enrique",
    nation: "Spagna",
    formationId: "4-3-3",
    style: { attack: 3, defence: 0 },
    development: 1.2,
    hireCost: 8_400_000,
    severance: 6_400_000,
    reputation: 5,
    defaultClubId: "psg",
    tacticalPhilosophy: "Possesso Asfissiante & Attacco",
  },
  {
    id: "coach-simeone",
    name: "Diego Simeone",
    nation: "Argentina",
    formationId: "4-4-2",
    style: { attack: 0, defence: 3 },
    development: 1.0,
    hireCost: 8_000_000,
    severance: 6_000_000,
    reputation: 5,
    defaultClubId: "atletico-madrid",
    tacticalPhilosophy: "Cholismo & Blocco Basso",
  },
  // Svincolati Elite
  {
    id: "coach-klopp",
    name: "Jürgen Klopp",
    nation: "Germania",
    formationId: "4-3-3",
    style: { attack: 3, defence: 1 },
    development: 1.5,
    hireCost: 9_500_000,
    severance: 7_000_000,
    reputation: 5,
    isFreeAgent: true,
    tacticalPhilosophy: "Heavy Metal Football & Pressing",
  },
  {
    id: "coach-allegri",
    name: "Massimiliano Allegri",
    nation: "Italia",
    formationId: "3-5-2",
    style: { attack: -1, defence: 3 },
    development: 1.0,
    hireCost: 7_500_000,
    severance: 5_500_000,
    reputation: 5,
    isFreeAgent: true,
    tacticalPhilosophy: "Corto Muso & Cinismo Tattico",
  },
  {
    id: "coach-zidane",
    name: "Zinedine Zidane",
    nation: "Francia",
    formationId: "4-3-3",
    style: { attack: 3, defence: 1 },
    development: 1.1,
    hireCost: 9_000_000,
    severance: 6_800_000,
    reputation: 5,
    isFreeAgent: true,
    tacticalPhilosophy: "Leadership & Calcio Europeo",
  },
  {
    id: "coach-tuchel",
    name: "Thomas Tuchel",
    nation: "Germania",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 2 },
    development: 1.2,
    hireCost: 8_000_000,
    severance: 6_000_000,
    reputation: 5,
    isFreeAgent: true,
    tacticalPhilosophy: "Rigore Tattico & Struttura",
  },

  // --- Tier 4: Europa & Top Club (Reputazione 4) ---
  {
    id: "coach-gasperini",
    name: "Gian Piero Gasperini",
    nation: "Italia",
    formationId: "3-4-2-1",
    style: { attack: 3, defence: -1 },
    development: 1.7,
    hireCost: 5_000_000,
    severance: 3_800_000,
    reputation: 4,
    defaultClubId: "atalanta",
    tacticalPhilosophy: "Uomo a Uomo & Intensità Feroce",
  },
  {
    id: "coach-conte",
    name: "Antonio Conte",
    nation: "Italia",
    formationId: "3-5-2",
    style: { attack: 2, defence: 2 },
    development: 1.0,
    hireCost: 6_000_000,
    severance: 4_500_000,
    reputation: 4,
    defaultClubId: "napoli",
    tacticalPhilosophy: "Martello Tattico & 3-5-2 di Grinta",
  },
  {
    id: "coach-motta",
    name: "Thiago Motta",
    nation: "Italia",
    formationId: "4-2-3-1",
    style: { attack: 1, defence: 2 },
    development: 1.4,
    hireCost: 4_800_000,
    severance: 3_500_000,
    reputation: 4,
    defaultClubId: "juventus",
    tacticalPhilosophy: "Occupazione degli Spazi & Pressione",
  },
  {
    id: "coach-emery",
    name: "Unai Emery",
    nation: "Spagna",
    formationId: "4-4-2",
    style: { attack: 2, defence: 1 },
    development: 1.2,
    hireCost: 4_500_000,
    severance: 3_200_000,
    reputation: 4,
    defaultClubId: "aston-villa",
    tacticalPhilosophy: "Trappola del Fuorigioco & Coppe",
  },
  {
    id: "coach-slot",
    name: "Arne Slot",
    nation: "Paesi Bassi",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 1 },
    development: 1.3,
    hireCost: 5_200_000,
    severance: 3_800_000,
    reputation: 4,
    defaultClubId: "liverpool",
    tacticalPhilosophy: "Calcio Olandese Dinamico",
  },
  {
    id: "coach-dezerbi",
    name: "Roberto De Zerbi",
    nation: "Italia",
    formationId: "4-2-3-1",
    style: { attack: 3, defence: -1 },
    development: 1.6,
    hireCost: 4_600_000,
    severance: 3_300_000,
    reputation: 4,
    defaultClubId: "marseille",
    tacticalPhilosophy: "Costruzione dal Basso & Coraggio",
  },
  {
    id: "coach-rose",
    name: "Marco Rose",
    nation: "Germania",
    formationId: "4-2-4",
    style: { attack: 2, defence: 1 },
    development: 1.3,
    hireCost: 4_200_000,
    severance: 3_000_000,
    reputation: 4,
    defaultClubId: "rb-leipzig",
    tacticalPhilosophy: "Transizioni Rapide & Verticalità",
  },
  {
    id: "coach-sarri",
    name: "Maurizio Sarri",
    nation: "Italia",
    formationId: "4-3-3",
    style: { attack: 3, defence: -1 },
    development: 1.3,
    hireCost: 4_500_000,
    severance: 3_200_000,
    reputation: 4,
    isFreeAgent: true,
    tacticalPhilosophy: "Sarrismi & Passaggi a Un Tocco",
  },
  {
    id: "coach-pioli",
    name: "Stefano Pioli",
    nation: "Italia",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 0 },
    development: 1.3,
    hireCost: 4_000_000,
    severance: 2_800_000,
    reputation: 4,
    isFreeAgent: true,
    tacticalPhilosophy: "Flessibilità & Transizione Positiva",
  },
  {
    id: "coach-terzic",
    name: "Edin Terzić",
    nation: "Germania",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 1 },
    development: 1.4,
    hireCost: 3_800_000,
    severance: 2_600_000,
    reputation: 4,
    isFreeAgent: true,
    tacticalPhilosophy: "Fervore Tattico & Squadra Unita",
  },

  // --- Tier 3: Fascia Media & Progetti Tattici (Reputazione 3) ---
  {
    id: "coach-italiano",
    name: "Vincenzo Italiano",
    nation: "Italia",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: -1 },
    development: 1.3,
    hireCost: 2_000_000,
    severance: 1_400_000,
    reputation: 3,
    defaultClubId: "bologna",
    tacticalPhilosophy: "Baricentro Alto & Pressione",
  },
  {
    id: "coach-palladino",
    name: "Raffaele Palladino",
    nation: "Italia",
    formationId: "3-4-2-1",
    style: { attack: 1, defence: 1 },
    development: 1.4,
    hireCost: 1_800_000,
    severance: 1_200_000,
    reputation: 3,
    defaultClubId: "fiorentina",
    tacticalPhilosophy: "3-4-2-1 Moderno & Sovrapposizioni",
  },
  {
    id: "coach-baroni",
    name: "Marco Baroni",
    nation: "Italia",
    formationId: "4-2-3-1",
    style: { attack: 1, defence: 1 },
    development: 1.2,
    hireCost: 1_700_000,
    severance: 1_100_000,
    reputation: 3,
    defaultClubId: "lazio",
    tacticalPhilosophy: "Equilibrio & Attacco Diretto",
  },
  {
    id: "coach-fabregas",
    name: "Cesc Fàbregas",
    nation: "Spagna",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 0 },
    development: 1.6,
    hireCost: 1_600_000,
    severance: 1_000_000,
    reputation: 3,
    defaultClubId: "como",
    tacticalPhilosophy: "Qualità Tecniche & Costruzione",
  },
  {
    id: "coach-derossi",
    name: "Daniele De Rossi",
    nation: "Italia",
    formationId: "4-3-3",
    style: { attack: 2, defence: 0 },
    development: 1.4,
    hireCost: 1_800_000,
    severance: 1_200_000,
    reputation: 3,
    isFreeAgent: true,
    tacticalPhilosophy: "Carattere & Palleggio Posizionale",
  },
  {
    id: "coach-juric",
    name: "Ivan Jurić",
    nation: "Croazia",
    formationId: "3-4-2-1",
    style: { attack: 1, defence: 2 },
    development: 1.2,
    hireCost: 1_700_000,
    severance: 1_100_000,
    reputation: 3,
    isFreeAgent: true,
    tacticalPhilosophy: "Marcature a Uomo Rispettate",
  },
  {
    id: "coach-glasner",
    name: "Oliver Glasner",
    nation: "Austria",
    formationId: "3-4-2-1",
    style: { attack: 2, defence: 1 },
    development: 1.3,
    hireCost: 1_900_000,
    severance: 1_300_000,
    reputation: 3,
    defaultClubId: "crystal-palace",
    tacticalPhilosophy: "Contropiede Organizzato & Fisicità",
  },

  // --- Tier 2/1: Salvezza ed Emergenti (Reputazione 1-2) ---
  {
    id: "coach-nicola",
    name: "Davide Nicola",
    nation: "Italia",
    formationId: "3-5-2",
    style: { attack: -1, defence: 3 },
    development: 1.1,
    hireCost: 650_000,
    severance: 420_000,
    reputation: 2,
    defaultClubId: "cagliari",
    tacticalPhilosophy: "Miracoli Salvezza & Cuore",
  },
  {
    id: "coach-gilardino",
    name: "Alberto Gilardino",
    nation: "Italia",
    formationId: "3-5-2",
    style: { attack: 0, defence: 2 },
    development: 1.3,
    hireCost: 600_000,
    severance: 400_000,
    reputation: 2,
    defaultClubId: "genoa",
    tacticalPhilosophy: "Compattezza Difensiva & Ripartenze",
  },
  {
    id: "coach-farioli",
    name: "Francesco Farioli",
    nation: "Italia",
    formationId: "4-3-3",
    style: { attack: 1, defence: 2 },
    development: 1.6,
    hireCost: 700_000,
    severance: 450_000,
    reputation: 2,
    defaultClubId: "ajax",
    tacticalPhilosophy: "Controllo Ritmi & Pulizia di Gioco",
  },
  {
    id: "coach-hoeness",
    name: "Sebastian Hoeneß",
    nation: "Germania",
    formationId: "4-2-3-1",
    style: { attack: 3, defence: 0 },
    development: 1.7,
    hireCost: 800_000,
    severance: 500_000,
    reputation: 2,
    defaultClubId: "stuttgart",
    tacticalPhilosophy: "Gegenpressing Spettacolare",
  },
  {
    id: "coach-knutsen",
    name: "Kjetil Knutsen",
    nation: "Norvegia",
    formationId: "4-3-3",
    style: { attack: 3, defence: -1 },
    development: 1.7,
    hireCost: 550_000,
    severance: 350_000,
    reputation: 1,
    isFreeAgent: true,
    tacticalPhilosophy: "Calcio Nordico Totale & Giovani",
  },

  // Aliases per retrocompatibilità salvataggi precedenti (c-01 .. c-24)
  { id: "c-01", name: "Simone Inzaghi", nation: "Italia", formationId: "3-5-2", style: { attack: 2, defence: 2 }, development: 1.1, hireCost: 8_500_000, severance: 6_500_000, reputation: 5, defaultClubId: "inter" },
  { id: "c-02", name: "Pep Guardiola", nation: "Spagna", formationId: "4-3-3", style: { attack: 3, defence: 1 }, development: 1.3, hireCost: 10_000_000, severance: 8_000_000, reputation: 5, defaultClubId: "manchester-city" },
  { id: "c-03", name: "Carlo Ancelotti", nation: "Italia", formationId: "4-3-3", style: { attack: 3, defence: 1 }, development: 1.0, hireCost: 9_500_000, severance: 7_500_000, reputation: 5, defaultClubId: "real-madrid" },
  { id: "c-04", name: "Hansi Flick", nation: "Germania", formationId: "4-2-3-1", style: { attack: 3, defence: 0 }, development: 1.2, hireCost: 8_800_000, severance: 6_800_000, reputation: 5, defaultClubId: "barcelona" },
  { id: "c-05", name: "Mikel Arteta", nation: "Spagna", formationId: "4-3-3", style: { attack: 2, defence: 2 }, development: 1.4, hireCost: 8_200_000, severance: 6_200_000, reputation: 5, defaultClubId: "arsenal" },
  { id: "c-06", name: "Roberto De Zerbi", nation: "Italia", formationId: "4-2-3-1", style: { attack: 3, defence: -1 }, development: 1.6, hireCost: 4_600_000, severance: 3_300_000, reputation: 4, defaultClubId: "marseille" },
  { id: "c-07", name: "Antonio Conte", nation: "Italia", formationId: "3-5-2", style: { attack: 2, defence: 2 }, development: 1.0, hireCost: 6_000_000, severance: 4_500_000, reputation: 4, defaultClubId: "napoli" },
  { id: "c-08", name: "Gian Piero Gasperini", nation: "Italia", formationId: "3-4-2-1", style: { attack: 3, defence: -1 }, development: 1.7, hireCost: 5_000_000, severance: 3_800_000, reputation: 4, defaultClubId: "atalanta" },
  { id: "c-09", name: "Thiago Motta", nation: "Italia", formationId: "4-2-3-1", style: { attack: 1, defence: 2 }, development: 1.4, hireCost: 4_800_000, severance: 3_500_000, reputation: 4, defaultClubId: "juventus" },
  { id: "c-10", name: "Vincenzo Italiano", nation: "Italia", formationId: "4-2-3-1", style: { attack: 1, defence: 1 }, development: 1.3, hireCost: 2_000_000, severance: 1_400_000, reputation: 3, defaultClubId: "bologna" },
  { id: "c-11", name: "Raffaele Palladino", nation: "Italia", formationId: "3-4-2-1", style: { attack: 1, defence: 1 }, development: 1.4, hireCost: 1_800_000, severance: 1_200_000, reputation: 3, defaultClubId: "fiorentina" },
  { id: "c-12", name: "Marco Baroni", nation: "Italia", formationId: "4-2-3-1", style: { attack: 1, defence: 1 }, development: 1.2, hireCost: 1_700_000, severance: 1_100_000, reputation: 3, defaultClubId: "lazio" },
  { id: "c-13", name: "Daniele De Rossi", nation: "Italia", formationId: "4-3-3", style: { attack: 2, defence: 0 }, development: 1.4, hireCost: 1_800_000, severance: 1_200_000, reputation: 3, isFreeAgent: true },
  { id: "c-14", name: "Sebastian Hoeneß", nation: "Germania", formationId: "4-2-3-1", style: { attack: 3, defence: 0 }, development: 1.7, hireCost: 800_000, severance: 500_000, reputation: 2, defaultClubId: "stuttgart" },
  { id: "c-15", name: "Cesc Fàbregas", nation: "Spagna", formationId: "4-2-3-1", style: { attack: 2, defence: 0 }, development: 1.6, hireCost: 1_600_000, severance: 1_000_000, reputation: 3, defaultClubId: "como" },
  { id: "c-16", name: "Davide Nicola", nation: "Italia", formationId: "3-5-2", style: { attack: -1, defence: 3 }, development: 1.1, hireCost: 650_000, severance: 420_000, reputation: 2, defaultClubId: "cagliari" },
  { id: "c-17", name: "Alberto Gilardino", nation: "Italia", formationId: "3-5-2", style: { attack: 0, defence: 2 }, development: 1.3, hireCost: 600_000, severance: 400_000, reputation: 2, defaultClubId: "genoa" },
  { id: "c-18", name: "Francesco Farioli", nation: "Italia", formationId: "4-3-3", style: { attack: 1, defence: 2 }, development: 1.6, hireCost: 700_000, severance: 450_000, reputation: 2, defaultClubId: "ajax" },
  { id: "c-19", name: "Oliver Glasner", nation: "Austria", formationId: "3-4-2-1", style: { attack: 2, defence: 1 }, development: 1.3, hireCost: 1_900_000, severance: 1_300_000, reputation: 3, defaultClubId: "crystal-palace" },
  { id: "c-20", name: "Kjetil Knutsen", nation: "Norvegia", formationId: "4-3-3", style: { attack: 3, defence: -1 }, development: 1.7, hireCost: 550_000, severance: 350_000, reputation: 1, isFreeAgent: true },
  { id: "c-21", name: "Jürgen Klopp", nation: "Germania", formationId: "4-3-3", style: { attack: 3, defence: 1 }, development: 1.5, hireCost: 9_500_000, severance: 7_000_000, reputation: 5, isFreeAgent: true },
  { id: "c-22", name: "Massimiliano Allegri", nation: "Italia", formationId: "3-5-2", style: { attack: -1, defence: 3 }, development: 1.0, hireCost: 7_500_000, severance: 5_500_000, reputation: 5, isFreeAgent: true },
  { id: "c-23", name: "Thomas Tuchel", nation: "Germania", formationId: "4-2-3-1", style: { attack: 2, defence: 2 }, development: 1.2, hireCost: 8_000_000, severance: 6_000_000, reputation: 5, isFreeAgent: true },
  { id: "c-24", name: "Maurizio Sarri", nation: "Italia", formationId: "4-3-3", style: { attack: 3, defence: -1 }, development: 1.3, hireCost: 4_500_000, severance: 3_200_000, reputation: 4, isFreeAgent: true },
];

export function findCoach(id: string): Coach | undefined {
  return COACHES.find((coach) => coach.id === id);
}

/** Trova l'allenatore reale assegnato di default a un club (tramite ID o ricerca sul nome). */
export function getClubDefaultCoach(clubId: string, clubName?: string): Coach | undefined {
  const normId = clubId.toLowerCase();
  const foundById = COACHES.find(
    (c) => c.defaultClubId && (normId.includes(c.defaultClubId) || c.defaultClubId.includes(normId))
  );
  if (foundById) return foundById;

  if (clubName) {
    const normName = clubName.toLowerCase();
    return COACHES.find((c) => {
      if (!c.defaultClubId) return false;
      const clean = c.defaultClubId.replace(/-/g, " ");
      return normName.includes(clean) || clean.includes(normName);
    });
  }
  return undefined;
}

/**
 * Gli allenatori disposti ad allenare un club di un dato prestigio.
 *
 * **Deduplicato per nome.** `COACHES` contiene, oltre al catalogo dettagliato, un blocco di
 * alias `c-01`..`c-24` mantenuto apposta per non rompere `findCoach` sui salvataggi precedenti
 * che referenziano quegli id (bug segnalato dall'utente: la lista mostrava lo stesso allenatore
 * due volte). Qui, dove si genera l'elenco **visibile** nel picker, si tiene solo la prima
 * occorrenza per nome — il blocco dettagliato viene prima nell'array, quindi è sempre quello a
 * vincere il dedup.
 */
export function availableCoaches(clubPrestigeTier: number, budget = Infinity): Coach[] {
  const idonei = COACHES.filter(
    (coach) => coach.reputation <= clubPrestigeTier + 1 && coach.hireCost <= budget
  ).sort((a, b) => b.reputation - a.reputation || b.development - a.development);

  const visti = new Set<string>();
  return idonei.filter((coach) => {
    if (visti.has(coach.name)) return false;
    visti.add(coach.name);
    return true;
  });
}

/** Calcola l'indennizzo di riscatto (buyout fee) per soffiare un tecnico sotto contratto ad un altro club. */
export function computeCoachBuyoutFee(coach: Coach): number {
  return Math.round(coach.hireCost * 1.5);
}

/**
 * Quanto costa liberarsi di un allenatore a stagione in corso.
 */
export function severanceCost(coach: Coach, matchdaysPlayed: number, totalMatchdays: number): number {
  const remaining = Math.max(0, 1 - matchdaysPlayed / Math.max(totalMatchdays, 1));
  return Math.round(coach.severance * remaining);
}
