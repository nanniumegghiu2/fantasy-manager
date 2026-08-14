import type { ShowcaseLeague } from "./types";

/**
 * **Primera División argentina 2026 (Apertura)** — i due club che il mercato mondiale guarda.
 *
 * Solo Boca e River, e per una ragione dichiarata: sotto di loro il campionato argentino, in
 * termini di giocatori che un club europeo comprerebbe davvero, si assottiglia in fretta. Meglio
 * due rose intere che sei mezze piene di nomi che nessun DS cercherebbe mai.
 *
 * **Due giocatori della fonte sono stati scartati** — Aníbal Moreno e Matías Viña — perché in
 * questo dataset compaiono già in Brasile (Palmeiras e Flamengo, stagione 2025). Le due fonti
 * fotografano momenti diversi del loro trasferimento; tenerli in due rose contemporaneamente
 * sarebbe stato un errore vero, e infatti è **il controllo dell'importer a impedirlo**, non
 * l'attenzione di chi scrive.
 *
 * Banda dichiarata **61-80**: bacino giovane e di grande nome, ma il livello medio sta sotto a
 * quello brasiliano.
 */
export const ARGENTINA: ShowcaseLeague = {
  name: "Primera División",
  nation: "Argentina",
  prestigeTier: 3,
  overallRange: [61, 80],
  clubs: [
    {
      name: "Boca Juniors",
      prestigeTier: 4,
      players: [
        { name: "Agustín Marchesín", nation: "Argentina", birthDate: "1988-03-16", role: "POR", overall: 76 },
        { name: "Leandro Brey", nation: "Argentina", birthDate: "2002-09-21", role: "POR", overall: 71 },
        { name: "Nicolás Figal", nation: "Argentina", birthDate: "1994-04-03", role: "DC", overall: 73 },
        { name: "Marco Pellegrino", nation: "Argentina", birthDate: "2002-07-18", role: "DC", overall: 72 },
        { name: "Ayrton Costa", nation: "Argentina", birthDate: "1999-07-12", role: "DC", overall: 72 },
        { name: "Lautaro Di Lollo", nation: "Argentina", birthDate: "2004-03-10", role: "DC", overall: 71 },
        { name: "Marcelo Weigandt", nation: "Argentina", birthDate: "2000-01-11", role: "TD", secondaryRoles: ["QD"], overall: 72 },
        { name: "Juan Barinaga", nation: "Argentina", birthDate: "2000-10-10", role: "TD", secondaryRoles: ["QD"], overall: 71 },
        { name: "Lautaro Blanco", nation: "Argentina", birthDate: "1999-02-19", role: "TS", secondaryRoles: ["QS"], overall: 71 },
        { name: "Leandro Paredes", nation: "Argentina", birthDate: "1994-06-29", role: "MED", secondaryRoles: ["CC"], overall: 80 },
        { name: "Santiago Ascacibar", nation: "Argentina", birthDate: "1997-02-25", role: "MED", overall: 74 },
        { name: "Rodrigo Battaglia", nation: "Argentina", birthDate: "1991-07-12", role: "MED", secondaryRoles: ["DC"], overall: 72 },
        { name: "Milton Delgado", nation: "Argentina", birthDate: "2005-06-16", role: "MED", overall: 72 },
        { name: "Ander Herrera", nation: "Spagna", birthDate: "1989-08-14", role: "CC", overall: 74 },
        { name: "Tomás Belmonte", nation: "Argentina", birthDate: "1998-05-27", role: "CC", overall: 71 },
        { name: "Agustín Martegani", nation: "Argentina", birthDate: "2000-03-20", role: "CC", overall: 70 },
        { name: "Williams Alarcón", nation: "Cile", birthDate: "2000-11-29", role: "CC", overall: 70 },
        { name: "Carlos Palacios", nation: "Cile", birthDate: "2000-07-20", role: "TRQ", secondaryRoles: ["TQS"], overall: 74 },
        { name: "Kevin Zenón", nation: "Argentina", birthDate: "2001-07-29", role: "TQS", overall: 74 },
        { name: "Alan Velasco", nation: "Argentina", birthDate: "2002-07-27", role: "TQS", overall: 73 },
        { name: "Exequiel Zeballos", nation: "Argentina", birthDate: "2002-04-24", role: "TQD", overall: 73 },
        { name: "Ángel Romero", nation: "Paraguay", birthDate: "1992-07-04", role: "TQD", overall: 71 },
        { name: "Lucas Janson", nation: "Argentina", birthDate: "1994-08-16", role: "TQD", overall: 71 },
        { name: "Malcom Braida", nation: "Argentina", birthDate: "1997-05-17", role: "ES", secondaryRoles: ["TQS"], overall: 69 },
        { name: "Miguel Merentiel", nation: "Uruguay", birthDate: "1996-02-24", role: "ATT", overall: 76 },
        { name: "Edinson Cavani", nation: "Uruguay", birthDate: "1987-02-14", role: "ATT", overall: 74 },
        { name: "Milton Giménez", nation: "Argentina", birthDate: "1996-08-12", role: "ATT", overall: 72 },
        { name: "Adam Bareiro", nation: "Paraguay", birthDate: "1996-07-26", role: "ATT", overall: 71 },
      ],
    },
    {
      name: "River Plate",
      prestigeTier: 4,
      players: [
        { name: "Franco Armani", nation: "Argentina", birthDate: "1986-10-16", role: "POR", overall: 74 },
        { name: "Ezequiel Centurión", nation: "Argentina", birthDate: "1997-05-20", role: "POR", overall: 69 },
        { name: "Germán Pezzella", nation: "Argentina", birthDate: "1991-06-27", role: "DC", overall: 76 },
        { name: "Lucas Martínez Quarta", nation: "Argentina", birthDate: "1996-05-10", role: "DC", overall: 76 },
        { name: "Paulo Díaz", nation: "Cile", birthDate: "1994-08-25", role: "DC", overall: 76 },
        { name: "Lautaro Rivero", nation: "Argentina", birthDate: "2003-11-01", role: "DC", overall: 71 },
        { name: "Juan Carlos Portillo", nation: "Argentina", birthDate: "2000-05-18", role: "DC", secondaryRoles: ["MED"], overall: 70 },
        { name: "Facundo González", nation: "Argentina", birthDate: "2006-04-03", role: "DC", overall: 66 },
        { name: "Gonzalo Montiel", nation: "Argentina", birthDate: "1997-01-01", role: "TD", secondaryRoles: ["QD"], overall: 76 },
        { name: "Fabricio Bustos", nation: "Argentina", birthDate: "1996-04-28", role: "TD", secondaryRoles: ["QD"], overall: 72 },
        { name: "Marcos Acuña", nation: "Argentina", birthDate: "1991-10-28", role: "TS", secondaryRoles: ["QS"], overall: 76 },
        { name: "Kevin Castaño", nation: "Colombia", birthDate: "2000-09-29", role: "MED", overall: 75 },
        { name: "Fausto Vera", nation: "Argentina", birthDate: "2000-03-26", role: "MED", overall: 73 },
        { name: "Giuliano Galoppo", nation: "Argentina", birthDate: "1999-06-18", role: "CC", overall: 73 },
        { name: "Maximiliano Meza", nation: "Argentina", birthDate: "1992-01-15", role: "CC", secondaryRoles: ["TQD"], overall: 73 },
        { name: "Tomás Galván", nation: "Argentina", birthDate: "2000-04-11", role: "CC", overall: 70 },
        { name: "Santiago Lencina", nation: "Argentina", birthDate: "2005-09-04", role: "CC", overall: 70 },
        { name: "Juan Quintero", nation: "Colombia", birthDate: "1993-01-18", role: "TRQ", overall: 77 },
        { name: "Kendry Páez", nation: "Ecuador", birthDate: "2007-05-04", role: "TRQ", secondaryRoles: ["TQS"], overall: 74 },
        { name: "Ian Subiabre", nation: "Argentina", birthDate: "2007-01-01", role: "TQD", overall: 71 },
        { name: "Sebastián Driussi", nation: "Argentina", birthDate: "1996-02-09", role: "ATT", secondaryRoles: ["TQS"], overall: 77 },
        { name: "Maximiliano Salas", nation: "Argentina", birthDate: "1997-12-01", role: "ATT", overall: 75 },
        { name: "Facundo Colidio", nation: "Argentina", birthDate: "2000-01-04", role: "ATT", secondaryRoles: ["TQD"], overall: 74 },
        { name: "Agustín Ruberto", nation: "Argentina", birthDate: "2006-01-14", role: "ATT", overall: 70 },
      ],
    },
  ],
};
