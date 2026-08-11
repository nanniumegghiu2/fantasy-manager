/**
 * Catalogo degli allenatori della DS Mode.
 *
 * Contiene un archivio curato di allenatori reali dei Big 5 campionati europei e svincolati
 * illustri. Ogni allenatore possiede il suo modulo preferito, lo stile tattico e la propensione
 * allo sviluppo dei giovani, oltre all'eventuale club di default guidato.
 *
 * **Due regole strutturali da non violare.**
 *
 * 1. `COACHES` **non contiene nomi duplicati**. Gli alias dei salvataggi vecchi (`c-01`..`c-24`)
 *    vivono in `LEGACY_COACH_IDS`, una mappa id→id consultata solo da `findCoach`. Prima gli
 *    alias stavano dentro `COACHES` e ogni consumatore doveva ricordarsi di deduplicare: chi non
 *    lo faceva mostrava lo stesso allenatore due volte (bug segnalato dall'utente, causato da
 *    `CoachPickerScreen` che leggeva `COACHES` grezzo per la scheda Svincolati). Separandoli, la
 *    duplicazione è **impossibile per costruzione** invece che evitata a valle.
 *
 * 2. `hireCost` è l'**ingaggio ANNUO**, non un costo una tantum (sez. "Contratti" di
 *    `docs/piano-spogliatoio-contratti.md`). Le cifre erano già plausibili come stipendio annuo
 *    di un tecnico, quindi la reinterpretazione non ha richiesto una nuova tabella. La buonuscita
 *    non è più il campo fisso `severance` ma si **deriva** dalle stagioni residue di contratto.
 */
import type { Coach } from "./types";

/* -------------------------------------------------------------------------- */
/* Catalogo                                                                    */
/* -------------------------------------------------------------------------- */

export const COACHES: Coach[] = [
  /* ---------------- Tier 5: elite mondiale ---------------- */
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
    defaultClubId: "leverkusen",
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
    defaultClubId: "paris-saint-germain",
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
  {
    id: "coach-kompany",
    name: "Vincent Kompany",
    nation: "Belgio",
    formationId: "4-2-3-1",
    style: { attack: 3, defence: 1 },
    development: 1.3,
    hireCost: 7_800_000,
    severance: 5_800_000,
    reputation: 5,
    defaultClubId: "bayern",
    tacticalPhilosophy: "Baricentro Altissimo & Ampiezza",
  },
  {
    id: "coach-amorim",
    name: "Rúben Amorim",
    nation: "Portogallo",
    formationId: "3-4-2-1",
    style: { attack: 2, defence: 2 },
    development: 1.5,
    hireCost: 7_600_000,
    severance: 5_600_000,
    reputation: 5,
    defaultClubId: "manchester-united",
    tacticalPhilosophy: "3-4-2-1 Integrale & Costruzione",
  },
  /* Svincolati di prima fascia */
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
  {
    id: "coach-mourinho",
    name: "José Mourinho",
    nation: "Portogallo",
    formationId: "4-2-3-1",
    style: { attack: 0, defence: 3 },
    development: 0.95,
    hireCost: 8_600_000,
    severance: 6_400_000,
    reputation: 5,
    isFreeAgent: true,
    tacticalPhilosophy: "Pragmatismo & Gestione dei Big",
  },
  {
    id: "coach-spalletti",
    name: "Luciano Spalletti",
    nation: "Italia",
    formationId: "4-3-3",
    style: { attack: 3, defence: 0 },
    development: 1.3,
    hireCost: 6_800_000,
    severance: 5_000_000,
    reputation: 5,
    isFreeAgent: true,
    tacticalPhilosophy: "Movimento Senza Palla & Rifinitura",
  },

  /* ---------------- Tier 4: top club e coppe ---------------- */
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
    defaultClubId: "leipzig",
    tacticalPhilosophy: "Transizioni Rapide & Verticalità",
  },
  {
    id: "coach-maresca",
    name: "Enzo Maresca",
    nation: "Italia",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 1 },
    development: 1.5,
    hireCost: 5_400_000,
    severance: 3_900_000,
    reputation: 4,
    defaultClubId: "chelsea",
    tacticalPhilosophy: "Terzino a Centrocampo & Palleggio",
  },
  {
    id: "coach-postecoglou",
    name: "Ange Postecoglou",
    nation: "Australia",
    formationId: "4-3-3",
    style: { attack: 3, defence: -2 },
    development: 1.4,
    hireCost: 4_700_000,
    severance: 3_400_000,
    reputation: 4,
    defaultClubId: "tottenham",
    tacticalPhilosophy: "Linea Altissima & Nessun Compromesso",
  },
  {
    id: "coach-howe",
    name: "Eddie Howe",
    nation: "Inghilterra",
    formationId: "4-3-3",
    style: { attack: 2, defence: 1 },
    development: 1.3,
    hireCost: 4_400_000,
    severance: 3_200_000,
    reputation: 4,
    defaultClubId: "newcastle",
    tacticalPhilosophy: "Pressing Coordinato & Ritmo Alto",
  },
  {
    id: "coach-valverde",
    name: "Ernesto Valverde",
    nation: "Spagna",
    formationId: "4-2-3-1",
    style: { attack: 1, defence: 2 },
    development: 1.2,
    hireCost: 3_600_000,
    severance: 2_600_000,
    reputation: 4,
    defaultClubId: "athletic",
    tacticalPhilosophy: "Solidità & Identità di Club",
  },
  {
    id: "coach-pellegrini",
    name: "Manuel Pellegrini",
    nation: "Cile",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 1 },
    development: 1.1,
    hireCost: 3_800_000,
    severance: 2_700_000,
    reputation: 4,
    defaultClubId: "betis",
    tacticalPhilosophy: "Ingegneria Tattica & Palla a Terra",
  },
  {
    id: "coach-hutter",
    name: "Adi Hütter",
    nation: "Austria",
    formationId: "4-4-2",
    style: { attack: 2, defence: 1 },
    development: 1.3,
    hireCost: 3_500_000,
    severance: 2_500_000,
    reputation: 4,
    defaultClubId: "monaco",
    tacticalPhilosophy: "Verticalità & Gioventù al Potere",
  },
  {
    id: "coach-toppmoller",
    name: "Dino Toppmöller",
    nation: "Germania",
    formationId: "4-2-3-1",
    style: { attack: 3, defence: 0 },
    development: 1.5,
    hireCost: 3_300_000,
    severance: 2_400_000,
    reputation: 4,
    defaultClubId: "frankfurt",
    tacticalPhilosophy: "Ripartenze Fulminee & Ampiezza",
  },
  {
    id: "coach-alguacil",
    name: "Imanol Alguacil",
    nation: "Spagna",
    formationId: "4-3-3",
    style: { attack: 1, defence: 2 },
    development: 1.6,
    hireCost: 3_200_000,
    severance: 2_300_000,
    reputation: 4,
    defaultClubId: "real-sociedad",
    tacticalPhilosophy: "Cantera & Pressione Organizzata",
  },
  {
    id: "coach-ranieri",
    name: "Claudio Ranieri",
    nation: "Italia",
    formationId: "4-3-3",
    style: { attack: 1, defence: 2 },
    development: 1.1,
    hireCost: 3_000_000,
    severance: 2_200_000,
    reputation: 4,
    defaultClubId: "roma",
    tacticalPhilosophy: "Esperienza & Spogliatoio Compatto",
  },
  /* Svincolati di seconda fascia */
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
    tacticalPhilosophy: "Sarrismo & Passaggi a Un Tocco",
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
  {
    id: "coach-xavi",
    name: "Xavi Hernández",
    nation: "Spagna",
    formationId: "4-3-3",
    style: { attack: 3, defence: -1 },
    development: 1.6,
    hireCost: 4_200_000,
    severance: 3_000_000,
    reputation: 4,
    isFreeAgent: true,
    tacticalPhilosophy: "Possesso Totale & Cantera",
  },
  {
    id: "coach-lopetegui",
    name: "Julen Lopetegui",
    nation: "Spagna",
    formationId: "4-2-3-1",
    style: { attack: 1, defence: 2 },
    development: 1.2,
    hireCost: 3_400_000,
    severance: 2_400_000,
    reputation: 4,
    isFreeAgent: true,
    tacticalPhilosophy: "Blocco Medio & Palla Lunga Selettiva",
  },
  {
    id: "coach-mancini",
    name: "Roberto Mancini",
    nation: "Italia",
    formationId: "4-3-3",
    style: { attack: 2, defence: 1 },
    development: 1.2,
    hireCost: 4_600_000,
    severance: 3_300_000,
    reputation: 4,
    isFreeAgent: true,
    tacticalPhilosophy: "Estetica del Gioco & Palleggio",
  },
  {
    id: "coach-rangnick",
    name: "Ralf Rangnick",
    nation: "Germania",
    formationId: "4-2-4",
    style: { attack: 2, defence: 2 },
    development: 1.7,
    hireCost: 3_600_000,
    severance: 2_600_000,
    reputation: 4,
    isFreeAgent: true,
    tacticalPhilosophy: "Scuola di Pressing & Sviluppo Giovani",
  },

  /* ---------------- Tier 3: fascia media e progetti tattici ---------------- */
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
  {
    id: "coach-iraola",
    name: "Andoni Iraola",
    nation: "Spagna",
    formationId: "4-2-3-1",
    style: { attack: 3, defence: 0 },
    development: 1.6,
    hireCost: 2_400_000,
    severance: 1_600_000,
    reputation: 3,
    defaultClubId: "bournemouth",
    tacticalPhilosophy: "Pressing Ultra-Offensivo & Recuperi Alti",
  },
  {
    id: "coach-frank",
    name: "Thomas Frank",
    nation: "Danimarca",
    formationId: "4-3-3",
    style: { attack: 1, defence: 2 },
    development: 1.4,
    hireCost: 2_300_000,
    severance: 1_500_000,
    reputation: 3,
    defaultClubId: "brentford",
    tacticalPhilosophy: "Palle Inattive & Efficienza Statistica",
  },
  {
    id: "coach-hurzeler",
    name: "Fabian Hürzeler",
    nation: "Germania",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 0 },
    development: 1.8,
    hireCost: 2_200_000,
    severance: 1_500_000,
    reputation: 3,
    defaultClubId: "brighton",
    tacticalPhilosophy: "Giovanissimi al Comando & Coraggio",
  },
  {
    id: "coach-silva",
    name: "Marco Silva",
    nation: "Portogallo",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 1 },
    development: 1.3,
    hireCost: 2_500_000,
    severance: 1_700_000,
    reputation: 3,
    defaultClubId: "fulham",
    tacticalPhilosophy: "Organizzazione & Ripartenze Pulite",
  },
  {
    id: "coach-moyes",
    name: "David Moyes",
    nation: "Scozia",
    formationId: "4-4-2",
    style: { attack: 0, defence: 3 },
    development: 1.0,
    hireCost: 2_600_000,
    severance: 1_800_000,
    reputation: 3,
    defaultClubId: "everton",
    tacticalPhilosophy: "Blocco Basso & Solidità Britannica",
  },
  {
    id: "coach-nuno",
    name: "Nuno Espírito Santo",
    nation: "Portogallo",
    formationId: "3-4-3",
    style: { attack: 1, defence: 2 },
    development: 1.2,
    hireCost: 2_400_000,
    severance: 1_600_000,
    reputation: 3,
    defaultClubId: "nottingham",
    tacticalPhilosophy: "Difesa a Tre & Contropiede Letale",
  },
  {
    id: "coach-michel",
    name: "Míchel Sánchez",
    nation: "Spagna",
    formationId: "4-3-3",
    style: { attack: 3, defence: -1 },
    development: 1.5,
    hireCost: 2_200_000,
    severance: 1_500_000,
    reputation: 3,
    defaultClubId: "girona",
    tacticalPhilosophy: "Palleggio Ambizioso & Rischio Calcolato",
  },
  {
    id: "coach-marcelino",
    name: "Marcelino García",
    nation: "Spagna",
    formationId: "4-4-2",
    style: { attack: 1, defence: 2 },
    development: 1.1,
    hireCost: 2_100_000,
    severance: 1_400_000,
    reputation: 3,
    defaultClubId: "villarreal",
    tacticalPhilosophy: "4-4-2 Compatto & Coppe",
  },
  {
    id: "coach-corberan",
    name: "Carlos Corberán",
    nation: "Spagna",
    formationId: "4-4-2",
    style: { attack: 1, defence: 2 },
    development: 1.4,
    hireCost: 1_900_000,
    severance: 1_300_000,
    reputation: 3,
    defaultClubId: "valencia",
    tacticalPhilosophy: "Rigore Difensivo & Recupero Squadre",
  },
  {
    id: "coach-sahin",
    name: "Nuri Şahin",
    nation: "Turchia",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 0 },
    development: 1.5,
    hireCost: 2_300_000,
    severance: 1_600_000,
    reputation: 3,
    defaultClubId: "dortmund",
    tacticalPhilosophy: "Scuola Klopp & Palleggio Verticale",
  },
  {
    id: "coach-werner",
    name: "Ole Werner",
    nation: "Germania",
    formationId: "3-5-2",
    style: { attack: 1, defence: 2 },
    development: 1.4,
    hireCost: 1_600_000,
    severance: 1_100_000,
    reputation: 3,
    defaultClubId: "werder",
    tacticalPhilosophy: "Difesa a Tre & Crescita Interna",
  },
  {
    id: "coach-genesio",
    name: "Bruno Génésio",
    nation: "Francia",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 1 },
    development: 1.3,
    hireCost: 2_000_000,
    severance: 1_400_000,
    reputation: 3,
    defaultClubId: "lille",
    tacticalPhilosophy: "Equilibrio Francese & Talenti in Vetrina",
  },
  {
    id: "coach-haise",
    name: "Franck Haise",
    nation: "Francia",
    formationId: "3-4-2-1",
    style: { attack: 2, defence: 1 },
    development: 1.5,
    hireCost: 1_800_000,
    severance: 1_200_000,
    reputation: 3,
    defaultClubId: "nice",
    tacticalPhilosophy: "Difesa a Tre & Progetto Giovani",
  },
  {
    id: "coach-still",
    name: "Will Still",
    nation: "Belgio",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 0 },
    development: 1.6,
    hireCost: 1_500_000,
    severance: 1_000_000,
    reputation: 3,
    defaultClubId: "lens",
    tacticalPhilosophy: "Analisi Dati & Gestione Moderna",
  },
  {
    id: "coach-rosenior",
    name: "Liam Rosenior",
    nation: "Inghilterra",
    formationId: "4-3-3",
    style: { attack: 2, defence: 0 },
    development: 1.7,
    hireCost: 1_400_000,
    severance: 950_000,
    reputation: 3,
    defaultClubId: "strasbourg",
    tacticalPhilosophy: "Progetto Under 21 & Palleggio",
  },
  {
    id: "coach-vanoli",
    name: "Paolo Vanoli",
    nation: "Italia",
    formationId: "3-5-2",
    style: { attack: 1, defence: 2 },
    development: 1.3,
    hireCost: 1_300_000,
    severance: 900_000,
    reputation: 3,
    defaultClubId: "torino",
    tacticalPhilosophy: "Aggressività & Difesa a Tre",
  },
  {
    id: "coach-runjaic",
    name: "Kosta Runjaić",
    nation: "Germania",
    formationId: "3-5-2",
    style: { attack: 1, defence: 2 },
    development: 1.4,
    hireCost: 1_200_000,
    severance: 850_000,
    reputation: 3,
    defaultClubId: "udinese",
    tacticalPhilosophy: "Ordine Tattico & Valorizzazione",
  },
  /* Svincolati di fascia media */
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
    id: "coach-tudor",
    name: "Igor Tudor",
    nation: "Croazia",
    formationId: "3-4-2-1",
    style: { attack: 2, defence: 1 },
    development: 1.2,
    hireCost: 1_900_000,
    severance: 1_300_000,
    reputation: 3,
    isFreeAgent: true,
    tacticalPhilosophy: "Intensità Croata & Difesa a Tre",
  },
  {
    id: "coach-potter",
    name: "Graham Potter",
    nation: "Inghilterra",
    formationId: "3-4-2-1",
    style: { attack: 2, defence: 1 },
    development: 1.5,
    hireCost: 2_600_000,
    severance: 1_800_000,
    reputation: 3,
    isFreeAgent: true,
    tacticalPhilosophy: "Camaleontismo Tattico & Sviluppo",
  },
  {
    id: "coach-lampard",
    name: "Frank Lampard",
    nation: "Inghilterra",
    formationId: "4-3-3",
    style: { attack: 2, defence: 0 },
    development: 1.3,
    hireCost: 1_900_000,
    severance: 1_300_000,
    reputation: 3,
    isFreeAgent: true,
    tacticalPhilosophy: "Verticalità Inglese & Fiducia ai Giovani",
  },
  {
    id: "coach-vannistelrooy",
    name: "Ruud van Nistelrooy",
    nation: "Paesi Bassi",
    formationId: "4-4-2",
    style: { attack: 2, defence: 0 },
    development: 1.4,
    hireCost: 1_600_000,
    severance: 1_100_000,
    reputation: 3,
    isFreeAgent: true,
    tacticalPhilosophy: "Attacco Diretto & Lavoro sulle Punte",
  },

  /* ---------------- Tier 2: salvezza e club di provincia ---------------- */
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
    isFreeAgent: true,
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
    id: "coach-daversa",
    name: "Roberto D'Aversa",
    nation: "Italia",
    formationId: "4-3-1-2",
    style: { attack: 0, defence: 2 },
    development: 1.2,
    hireCost: 520_000,
    severance: 340_000,
    reputation: 2,
    defaultClubId: "empoli",
    tacticalPhilosophy: "Squadra Corta & Sacrificio",
  },
  {
    id: "coach-giampaolo",
    name: "Marco Giampaolo",
    nation: "Italia",
    formationId: "4-3-1-2",
    style: { attack: 1, defence: 1 },
    development: 1.2,
    hireCost: 560_000,
    severance: 370_000,
    reputation: 2,
    defaultClubId: "lecce",
    tacticalPhilosophy: "Rombo di Centrocampo & Fraseggio",
  },
  {
    id: "coach-pecchia",
    name: "Fabio Pecchia",
    nation: "Italia",
    formationId: "4-2-3-1",
    style: { attack: 1, defence: 1 },
    development: 1.4,
    hireCost: 540_000,
    severance: 350_000,
    reputation: 2,
    defaultClubId: "parma",
    tacticalPhilosophy: "Coraggio dei Giovani & Costruzione",
  },
  {
    id: "coach-zanetti",
    name: "Paolo Zanetti",
    nation: "Italia",
    formationId: "4-4-2",
    style: { attack: 0, defence: 2 },
    development: 1.3,
    hireCost: 500_000,
    severance: 330_000,
    reputation: 2,
    defaultClubId: "verona",
    tacticalPhilosophy: "Organizzazione & Ripartenza",
  },
  {
    id: "coach-difrancesco",
    name: "Eusebio Di Francesco",
    nation: "Italia",
    formationId: "4-3-3",
    style: { attack: 2, defence: -1 },
    development: 1.3,
    hireCost: 580_000,
    severance: 380_000,
    reputation: 2,
    defaultClubId: "venezia",
    tacticalPhilosophy: "4-3-3 Dogmatico & Gioco Corale",
  },
  {
    id: "coach-nesta",
    name: "Alessandro Nesta",
    nation: "Italia",
    formationId: "3-4-2-1",
    style: { attack: 1, defence: 1 },
    development: 1.4,
    hireCost: 620_000,
    severance: 400_000,
    reputation: 2,
    defaultClubId: "monza",
    tacticalPhilosophy: "Scuola Difensiva & Impostazione",
  },
  {
    id: "coach-henriksen",
    name: "Bo Henriksen",
    nation: "Danimarca",
    formationId: "4-4-2",
    style: { attack: 1, defence: 1 },
    development: 1.4,
    hireCost: 620_000,
    severance: 400_000,
    reputation: 2,
    defaultClubId: "mainz",
    tacticalPhilosophy: "Energia Scandinava & Spirito di Gruppo",
  },
  {
    id: "coach-schuster",
    name: "Julian Schuster",
    nation: "Germania",
    formationId: "4-2-3-1",
    style: { attack: 1, defence: 1 },
    development: 1.5,
    hireCost: 640_000,
    severance: 420_000,
    reputation: 2,
    defaultClubId: "freiburg",
    tacticalPhilosophy: "Continuità di Club & Settore Giovanile",
  },
  {
    id: "coach-hasenhuttl",
    name: "Ralph Hasenhüttl",
    nation: "Austria",
    formationId: "4-2-4",
    style: { attack: 2, defence: 0 },
    development: 1.4,
    hireCost: 900_000,
    severance: 600_000,
    reputation: 2,
    defaultClubId: "wolfsburg",
    tacticalPhilosophy: "Pressing a Uomo & Ritmo Forsennato",
  },
  {
    id: "coach-ilzer",
    name: "Christian Ilzer",
    nation: "Austria",
    formationId: "3-4-2-1",
    style: { attack: 1, defence: 2 },
    development: 1.4,
    hireCost: 700_000,
    severance: 460_000,
    reputation: 2,
    defaultClubId: "hoffenheim",
    tacticalPhilosophy: "Blocco Aggressivo & Organizzazione",
  },
  {
    id: "coach-baumgart",
    name: "Steffen Baumgart",
    nation: "Germania",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 0 },
    development: 1.3,
    hireCost: 680_000,
    severance: 450_000,
    reputation: 2,
    defaultClubId: "union",
    tacticalPhilosophy: "Cuore, Cross e Coppola",
  },
  {
    id: "coach-moreno",
    name: "Vicente Moreno",
    nation: "Spagna",
    formationId: "4-4-2",
    style: { attack: 0, defence: 2 },
    development: 1.2,
    hireCost: 560_000,
    severance: 370_000,
    reputation: 2,
    defaultClubId: "osasuna",
    tacticalPhilosophy: "Grinta & Palle Inattive",
  },
  {
    id: "coach-perez",
    name: "Íñigo Pérez",
    nation: "Spagna",
    formationId: "4-2-3-1",
    style: { attack: 1, defence: 1 },
    development: 1.5,
    hireCost: 520_000,
    severance: 340_000,
    reputation: 2,
    defaultClubId: "rayo",
    tacticalPhilosophy: "Idea di Gioco & Poche Risorse",
  },
  {
    id: "coach-arrasate",
    name: "Jagoba Arrasate",
    nation: "Spagna",
    formationId: "4-2-3-1",
    style: { attack: 1, defence: 1 },
    development: 1.3,
    hireCost: 540_000,
    severance: 350_000,
    reputation: 2,
    defaultClubId: "mallorca",
    tacticalPhilosophy: "Solidità Basca & Continuità",
  },
  {
    id: "coach-giraldez",
    name: "Claudio Giráldez",
    nation: "Spagna",
    formationId: "4-3-3",
    style: { attack: 2, defence: 0 },
    development: 1.7,
    hireCost: 480_000,
    severance: 320_000,
    reputation: 2,
    defaultClubId: "celta",
    tacticalPhilosophy: "Cantera Prima di Tutto",
  },
  {
    id: "coach-pimienta",
    name: "Francisco García Pimienta",
    nation: "Spagna",
    formationId: "4-3-3",
    style: { attack: 2, defence: 0 },
    development: 1.5,
    hireCost: 900_000,
    severance: 600_000,
    reputation: 2,
    defaultClubId: "sevilla",
    tacticalPhilosophy: "Scuola Barcellona & Palleggio",
  },
  {
    id: "coach-sage",
    name: "Pierre Sage",
    nation: "Francia",
    formationId: "4-4-2",
    style: { attack: 1, defence: 1 },
    development: 1.5,
    hireCost: 700_000,
    severance: 460_000,
    reputation: 2,
    defaultClubId: "lyon",
    tacticalPhilosophy: "Gestione Umana & Semplicità Efficace",
  },
  {
    id: "coach-stephan",
    name: "Julien Stéphan",
    nation: "Francia",
    formationId: "4-3-3",
    style: { attack: 1, defence: 1 },
    development: 1.4,
    hireCost: 660_000,
    severance: 430_000,
    reputation: 2,
    defaultClubId: "rennais",
    tacticalPhilosophy: "Formazione Bretone & Equilibrio",
  },
  {
    id: "coach-roy",
    name: "Éric Roy",
    nation: "Francia",
    formationId: "4-4-2",
    style: { attack: 0, defence: 2 },
    development: 1.2,
    hireCost: 460_000,
    severance: 300_000,
    reputation: 2,
    defaultClubId: "brest",
    tacticalPhilosophy: "Blocco Compatto & Sorpresa",
  },
  {
    id: "coach-novell",
    name: "Carles Martínez Novell",
    nation: "Spagna",
    formationId: "4-3-3",
    style: { attack: 2, defence: -1 },
    development: 1.6,
    hireCost: 440_000,
    severance: 290_000,
    reputation: 2,
    defaultClubId: "toulouse",
    tacticalPhilosophy: "Palleggio Audace & Under 23",
  },
  {
    id: "coach-mckenna",
    name: "Kieran McKenna",
    nation: "Irlanda del Nord",
    formationId: "4-2-3-1",
    style: { attack: 2, defence: 0 },
    development: 1.7,
    hireCost: 1_100_000,
    severance: 750_000,
    reputation: 2,
    defaultClubId: "ipswich",
    tacticalPhilosophy: "Doppie Promozioni & Idee Chiare",
  },
  {
    id: "coach-pereira",
    name: "Vítor Pereira",
    nation: "Portogallo",
    formationId: "3-4-3",
    style: { attack: 1, defence: 1 },
    development: 1.2,
    hireCost: 1_000_000,
    severance: 680_000,
    reputation: 2,
    defaultClubId: "wolverhampton",
    tacticalPhilosophy: "Disciplina Lusitana & Difesa a Tre",
  },

  /* ---------------- Tier 1: emergenti e scommesse ---------------- */
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
  {
    id: "coach-vitoria",
    name: "Rúben Vitória",
    nation: "Portogallo",
    formationId: "4-1-4-1",
    style: { attack: 1, defence: 1 },
    development: 1.6,
    hireCost: 320_000,
    severance: 210_000,
    reputation: 1,
    isFreeAgent: true,
    tacticalPhilosophy: "Blocco Medio & Crescita dei Ragazzi",
  },
  {
    id: "coach-lindqvist",
    name: "Anders Lindqvist",
    nation: "Svezia",
    formationId: "4-4-2",
    style: { attack: 0, defence: 2 },
    development: 1.5,
    hireCost: 280_000,
    severance: 180_000,
    reputation: 1,
    isFreeAgent: true,
    tacticalPhilosophy: "Ordine, Palle Inattive e Pazienza",
  },
  {
    id: "coach-dumont",
    name: "Léo Dumont",
    nation: "Francia",
    formationId: "5-3-2",
    style: { attack: -1, defence: 3 },
    development: 1.4,
    hireCost: 260_000,
    severance: 170_000,
    reputation: 1,
    isFreeAgent: true,
    tacticalPhilosophy: "Catenaccio Moderno & Cinque Dietro",
  },
  {
    id: "coach-varga",
    name: "Márton Varga",
    nation: "Ungheria",
    formationId: "4-1-4-1",
    style: { attack: 1, defence: 2 },
    development: 1.6,
    hireCost: 300_000,
    severance: 200_000,
    reputation: 1,
    isFreeAgent: true,
    tacticalPhilosophy: "Schermo Basso & Ripartenze",
  },
  {
    id: "coach-okafor",
    name: "Daniel Okafor",
    nation: "Inghilterra",
    formationId: "4-2-4",
    style: { attack: 3, defence: -2 },
    development: 1.7,
    hireCost: 340_000,
    severance: 220_000,
    reputation: 1,
    isFreeAgent: true,
    tacticalPhilosophy: "Attacco Totale & Nessuna Paura",
  },
  {
    id: "coach-marchetti",
    name: "Simone Marchetti",
    nation: "Italia",
    formationId: "4-4-1-1",
    style: { attack: 1, defence: 1 },
    development: 1.5,
    hireCost: 290_000,
    severance: 190_000,
    reputation: 1,
    isFreeAgent: true,
    tacticalPhilosophy: "Seconda Punta & Verticalizzazioni",
  },
  {
    id: "coach-berg",
    name: "Mikkel Berg",
    nation: "Danimarca",
    formationId: "3-4-3",
    style: { attack: 2, defence: 0 },
    development: 1.8,
    hireCost: 310_000,
    severance: 200_000,
    reputation: 1,
    isFreeAgent: true,
    tacticalPhilosophy: "Laboratorio Tattico & Under 21",
  },
];

/**
 * Alias degli id usati dai salvataggi precedenti (`c-01`..`c-24`).
 *
 * Vivono **fuori** da `COACHES` proprio perché la lista visibile non li debba mai vedere: il
 * catalogo resta senza omonimi e nessun consumatore deve ricordarsi di deduplicare.
 */
const LEGACY_COACH_IDS: Record<string, string> = {
  "c-01": "coach-inzaghi",
  "c-02": "coach-guardiola",
  "c-03": "coach-ancelotti",
  "c-04": "coach-flick",
  "c-05": "coach-arteta",
  "c-06": "coach-dezerbi",
  "c-07": "coach-conte",
  "c-08": "coach-gasperini",
  "c-09": "coach-motta",
  "c-10": "coach-italiano",
  "c-11": "coach-palladino",
  "c-12": "coach-baroni",
  "c-13": "coach-derossi",
  "c-14": "coach-hoeness",
  "c-15": "coach-fabregas",
  "c-16": "coach-nicola",
  "c-17": "coach-gilardino",
  "c-18": "coach-farioli",
  "c-19": "coach-glasner",
  "c-20": "coach-knutsen",
  "c-21": "coach-klopp",
  "c-22": "coach-allegri",
  "c-23": "coach-tuchel",
  "c-24": "coach-sarri",
};

export function findCoach(id: string): Coach | undefined {
  const diretto = COACHES.find((coach) => coach.id === id);
  if (diretto) return diretto;
  const alias = LEGACY_COACH_IDS[id];
  return alias ? COACHES.find((coach) => coach.id === alias) : undefined;
}

/**
 * L'id canonico di un allenatore, risolvendo gli alias dei salvataggi vecchi.
 *
 * Serve **all'ingresso** dello stato (`createCareer`, `hireCoach`): finché gli alias vivevano
 * dentro `COACHES` un `c-10` salvato restava un `c-10` anche a runtime, e `coach.id` coincideva
 * per caso con quello che lo stato aveva memorizzato. Ora `findCoach` restituisce sempre la voce
 * canonica, quindi chi confronta `coach.id` con `state.coachId` troverebbe due stringhe diverse:
 * si normalizza una volta sola, all'ingresso, invece di ricordarsene a ogni confronto.
 */
export function canonicalCoachId(id: string): string {
  return findCoach(id)?.id ?? id;
}

/* -------------------------------------------------------------------------- */
/* Abbinamento club → allenatore di default                                    */
/* -------------------------------------------------------------------------- */

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Trova l'allenatore reale assegnato di default a un club.
 *
 * **Tutti** i token dello slug devono comparire nel nome del club, non uno qualsiasi: con la
 * vecchia verifica a sottostringa lo slug `real-madrid` sarebbe stato indistinguibile da
 * `real-sociedad` non appena il catalogo ha smesso di avere un solo "Real". I token di una o due
 * lettere si scartano perché non discriminano nulla.
 */
export function getClubDefaultCoach(clubId: string, clubName?: string): Coach | undefined {
  const perId = COACHES.find((c) => c.defaultClubId && c.defaultClubId === clubId);
  if (perId) return perId;

  const target = normalize(clubName ?? clubId);
  if (!target) return undefined;
  const parole = new Set(target.split(" "));

  return COACHES.find((c) => {
    if (!c.defaultClubId) return false;
    const tokens = normalize(c.defaultClubId)
      .split(" ")
      .filter((t) => t.length >= 3);
    if (tokens.length === 0) return false;
    return tokens.every((t) => parole.has(t) || target.includes(t));
  });
}

/* -------------------------------------------------------------------------- */
/* Contratto dell'allenatore                                                   */
/* -------------------------------------------------------------------------- */

/** Durate proponibili alla firma, in stagioni intere. */
export const COACH_CONTRACT_LENGTHS = [1, 2, 3, 4, 5] as const;

/**
 * Quanto incide la durata sull'ingaggio annuo richiesto.
 *
 * Un contratto lungo dà sicurezza al tecnico, che in cambio si accontenta di meno all'anno; uno
 * corto glielo fa pagare. È ciò che rende la durata una scelta a due facce invece di un numero:
 * lungo costa meno all'anno ma la buonuscita diventa pesantissima, corto costa di più ma lo mandi
 * via quasi gratis — e a scadenza rischi che te lo portino via a zero.
 */
export const COACH_LENGTH_WAGE_FACTOR: Record<number, number> = {
  1: 1.25,
  2: 1.12,
  3: 1.0,
  4: 0.92,
  5: 0.86,
};

/** Quota dell'ingaggio residuo che si paga per liberarsi di un tecnico sotto contratto. */
export const COACH_SEVERANCE_SHARE = 0.6;

export interface CoachContract {
  coachId: string;
  /** Ultima stagione di validità: alla sua fine, se non rinnovato, il mister è libero. */
  until: number;
  /** Ingaggio **annuo**: confluisce nel monte ingaggi (`finances.ts`). */
  wage: number;
  signedSeason: number;
}

/** L'ingaggio annuo richiesto da un tecnico per una durata data. */
export function coachWageFor(coach: Coach, seasons: number): number {
  const fattore = COACH_LENGTH_WAGE_FACTOR[seasons] ?? 1;
  return Math.round((coach.hireCost * fattore) / 50_000) * 50_000;
}

/** Il contratto che nasce dalla firma. */
export function makeCoachContract(coach: Coach, seasons: number, season: number): CoachContract {
  const durata = Math.max(1, Math.min(5, Math.round(seasons)));
  return {
    coachId: coach.id,
    until: season + durata - 1,
    wage: coachWageFor(coach, durata),
    signedSeason: season,
  };
}

/** Stagioni ancora coperte dal contratto, contando quella in corso. */
export function coachSeasonsLeft(contract: CoachContract | undefined, season: number): number {
  if (!contract) return 0;
  return Math.max(0, contract.until - season + 1);
}

/**
 * Quanto costa liberarsi dell'allenatore adesso.
 *
 * Non è più un numero fisso: si paga la **parte residua** del contratto — la frazione di stagione
 * ancora da giocare più le stagioni intere che restano — scontata di `COACH_SEVERANCE_SHARE`.
 * Esonerare a marzo uno all'ultimo anno costa poco; farlo a settembre con quattro anni davanti
 * costa quanto un colpo di mercato, ed è esattamente il prezzo di un contratto lungo.
 */
export function severanceCost(
  coach: Coach,
  matchdaysPlayed: number,
  totalMatchdays: number,
  contract?: CoachContract,
  season?: number,
): number {
  const frazioneStagione = Math.max(0, 1 - matchdaysPlayed / Math.max(totalMatchdays, 1));
  if (!contract || season === undefined) {
    // Retrocompatibilità: senza contratto (salvataggi vecchi) si torna al vecchio campo fisso.
    return Math.round(coach.severance * frazioneStagione);
  }
  const stagioniIntereResidue = Math.max(0, coachSeasonsLeft(contract, season) - 1);
  const residuo = contract.wage * (frazioneStagione + stagioniIntereResidue);
  return Math.round((residuo * COACH_SEVERANCE_SHARE) / 50_000) * 50_000;
}

/**
 * Indennizzo per soffiare un tecnico **sotto contratto** a un altro club.
 *
 * Cresce con le stagioni che restano al suo attuale contratto: un mister appena rinnovato è di
 * fatto blindato, uno all'ultimo anno costa poco — e a scadenza si prende a zero, che è la
 * ragione per cui conviene tenere d'occhio anche le panchine altrui.
 */
export function computeCoachBuyoutFee(coach: Coach, seasonsLeft = 2): number {
  const stagioni = Math.max(0, seasonsLeft);
  if (stagioni === 0) return 0;
  return Math.round((coach.hireCost * (0.8 + 0.45 * stagioni)) / 50_000) * 50_000;
}

/* -------------------------------------------------------------------------- */
/* Elenco e ricerca                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Gli allenatori disposti ad allenare un club di un dato prestigio.
 *
 * Non serve più deduplicare per nome: `COACHES` non contiene omonimi (vedi l'intestazione del
 * file). Il filtro sul budget confronta ora l'**ingaggio annuo**.
 */
export function availableCoaches(clubPrestigeTier: number, budget = Infinity): Coach[] {
  return COACHES.filter(
    (coach) => coach.reputation <= clubPrestigeTier + 1 && coach.hireCost <= budget,
  ).sort((a, b) => b.reputation - a.reputation || b.development - a.development);
}

export type CoachStatusFilter = "tutti" | "svincolati" | "sotto_contratto";
export type CoachStyleFilter = "tutti" | "offensivo" | "equilibrato" | "difensivo";
export type CoachSortKey = "reputazione" | "sviluppo" | "attacco" | "difesa" | "nome";

export interface CoachSearchCriteria {
  /** Ricerca libera su nome, nazione o filosofia. */
  text?: string;
  /** Moduli accettati (id di `FORMATION_CODES`). Vuoto = tutti. */
  formations?: string[];
  status?: CoachStatusFilter;
  minReputation?: number;
  maxReputation?: number;
  style?: CoachStyleFilter;
  /** Solo chi è davvero bravo coi giovani (`development ≥ 1.45`). */
  youthOnly?: boolean;
  nation?: string;
  sort?: CoachSortKey;
}

export interface CoachSearchResult {
  coach: Coach;
  status: "libero" | "sotto_contratto" | "in_carica";
  currentClubId?: string;
  currentClubName?: string;
  /** Penale da pagare per strapparlo al suo club. Zero se è libero o già nostro. */
  buyoutFee: number;
}

export interface CoachSearchInput extends CoachSearchCriteria {
  /** Prestigio del nostro club: chi è troppo blasonato non ci verrebbe comunque. */
  clubPrestigeTier: number;
  /** Chi allena chi adesso, per sapere a chi va pagata la penale. */
  occupied?: Record<string, { clubId: string; clubName: string; seasonsLeft?: number }>;
  /** L'allenatore attualmente in carica da noi. */
  currentCoachId?: string | null;
}

/**
 * La ricerca allenatori: stesso spirito della ricerca giocatori (`scouting.ts`).
 *
 * **Non restituisce l'ingaggio richiesto**: le pretese economiche e le richieste tecniche si
 * scoprono al tavolo della trattativa, non nella lista — richiesta esplicita dell'utente. Qui si
 * vede chi è (modulo, stile, scuola, reputazione, stato contrattuale) e quanto costa **strapparlo**
 * al suo club, che è un fatto pubblico; quanto vuole per sé, no.
 */
export function searchCoaches({
  clubPrestigeTier,
  occupied = {},
  currentCoachId,
  text,
  formations,
  status = "tutti",
  minReputation,
  maxReputation,
  style = "tutti",
  youthOnly,
  nation,
  sort = "reputazione",
}: CoachSearchInput): CoachSearchResult[] {
  const query = text ? normalize(text) : "";
  const nazione = nation ? normalize(nation) : "";

  const risultati: CoachSearchResult[] = [];

  for (const coach of COACHES) {
    if (coach.reputation > clubPrestigeTier + 1) continue;
    if (minReputation !== undefined && coach.reputation < minReputation) continue;
    if (maxReputation !== undefined && coach.reputation > maxReputation) continue;
    if (formations && formations.length > 0 && !formations.includes(coach.formationId)) continue;
    if (youthOnly && coach.development < 1.45) continue;
    if (nazione && !normalize(coach.nation).includes(nazione)) continue;
    if (query) {
      const testo = normalize(`${coach.name} ${coach.nation} ${coach.tacticalPhilosophy ?? ""}`);
      if (!testo.includes(query)) continue;
    }
    if (style !== "tutti") {
      const scarto = coach.style.attack - coach.style.defence;
      if (style === "offensivo" && scarto < 1) continue;
      if (style === "difensivo" && scarto > -1) continue;
      if (style === "equilibrato" && Math.abs(scarto) > 1) continue;
    }

    const posto = occupied[coach.id];
    const inCarica = currentCoachId === coach.id;
    const libero = !inCarica && !posto && coach.isFreeAgent === true;
    const statoCorrente: CoachSearchResult["status"] = inCarica
      ? "in_carica"
      : libero
        ? "libero"
        : "sotto_contratto";

    if (status === "svincolati" && statoCorrente !== "libero") continue;
    if (status === "sotto_contratto" && statoCorrente !== "sotto_contratto") continue;

    risultati.push({
      coach,
      status: statoCorrente,
      currentClubId: posto?.clubId ?? coach.defaultClubId,
      currentClubName: posto?.clubName,
      buyoutFee:
        statoCorrente === "sotto_contratto"
          ? computeCoachBuyoutFee(coach, posto?.seasonsLeft ?? 2)
          : 0,
    });
  }

  const ordina: Record<CoachSortKey, (a: CoachSearchResult, b: CoachSearchResult) => number> = {
    reputazione: (a, b) =>
      b.coach.reputation - a.coach.reputation || b.coach.development - a.coach.development,
    sviluppo: (a, b) => b.coach.development - a.coach.development,
    attacco: (a, b) => b.coach.style.attack - a.coach.style.attack,
    difesa: (a, b) => b.coach.style.defence - a.coach.style.defence,
    nome: (a, b) => a.coach.name.localeCompare(b.coach.name, "it"),
  };

  return risultati.sort(ordina[sort]);
}
