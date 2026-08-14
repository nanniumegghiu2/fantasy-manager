import type { ShowcaseLeague } from "./types";

/**
 * **Brasileirão Série A 2025** — il bacino che il database aveva solo di riflesso.
 *
 * Fino a qui i brasiliani in database erano quelli **già emigrati** in Europa: mancava del tutto
 * il profilo del giocatore che in Brasile ci gioca ancora, cioè esattamente quello che un DS
 * europeo va a comprare. Da qui viene anche il pezzo di varietà anagrafica più utile — i
 * ventenni con potenziale alto e prezzo ancora basso.
 *
 * Nota sulla stagione: il campionato brasiliano si gioca ad **anno solare**, quindi la fonte
 * parla del 2025 mentre il resto del database è "2025/26". I club sono comunque marcati con
 * l'epoca `2025/26` del progetto: l'alternativa sarebbe stata una seconda epoca in database, che
 * avrebbe spezzato la chemistry per "anno" (§3.4) senza dare nulla in cambio.
 *
 * Banda dichiarata **62-83**: i migliori valgono la Serie A italiana, il fondo rosa no.
 */
export const BRASILE: ShowcaseLeague = {
  name: "Brasileirão",
  nation: "Brasile",
  prestigeTier: 3,
  overallRange: [62, 83],
  clubs: [
    {
      // La rosa più cara del continente: campioni d'America con una spina dorsale di ex Serie A
      // ed ex Premier, e Pedro come riferimento offensivo.
      name: "Flamengo",
      prestigeTier: 4,
      players: [
        { name: "Agustín Rossi", nation: "Argentina", birthDate: "1995-08-21", role: "POR", overall: 78 },
        { name: "Matheus Cunha", nation: "Brasile", birthDate: "2001-05-24", role: "POR", overall: 72 },
        { name: "Léo Ortiz", nation: "Brasile", birthDate: "1996-01-03", role: "DC", overall: 78 },
        { name: "Léo Pereira", nation: "Brasile", birthDate: "1996-01-31", role: "DC", overall: 77 },
        { name: "Danilo", nation: "Brasile", birthDate: "1991-07-15", role: "DC", secondaryRoles: ["TD"], overall: 77 },
        { name: "Cleiton", nation: "Brasile", birthDate: "2003-04-25", role: "DC", overall: 68 },
        { name: "Emerson Royal", nation: "Brasile", birthDate: "1999-01-14", role: "TD", secondaryRoles: ["QD"], overall: 76 },
        { name: "Guillermo Varela", nation: "Uruguay", birthDate: "1993-03-24", role: "TD", secondaryRoles: ["QD"], overall: 74 },
        { name: "Ayrton Lucas", nation: "Brasile", birthDate: "1997-06-19", role: "TS", secondaryRoles: ["QS"], overall: 76 },
        { name: "Alex Sandro", nation: "Brasile", birthDate: "1991-01-26", role: "TS", secondaryRoles: ["QS"], overall: 74 },
        { name: "Matías Viña", nation: "Uruguay", birthDate: "1997-11-09", role: "TS", secondaryRoles: ["QS"], overall: 73 },
        { name: "Jorginho", nation: "Italia", birthDate: "1991-12-21", role: "MED", secondaryRoles: ["CC"], overall: 79 },
        { name: "Erick Pulgar", nation: "Cile", birthDate: "1994-01-15", role: "MED", overall: 76 },
        { name: "Nicolás De La Cruz", nation: "Uruguay", birthDate: "1997-06-01", role: "CC", secondaryRoles: ["TRQ"], overall: 79 },
        { name: "Saúl Ñíguez", nation: "Spagna", birthDate: "1994-11-21", role: "CC", overall: 76 },
        { name: "Allan", nation: "Brasile", birthDate: "1997-03-03", role: "MED", overall: 73 },
        { name: "Evertton Araújo", nation: "Brasile", birthDate: "2003-02-28", role: "CC", overall: 69 },
        { name: "Giorgian De Arrascaeta", nation: "Uruguay", birthDate: "1994-06-01", role: "TRQ", overall: 81 },
        { name: "Jorge Carrascal", nation: "Colombia", birthDate: "1998-05-25", role: "TRQ", secondaryRoles: ["TQD"], overall: 75 },
        { name: "Samuel Lino", nation: "Brasile", birthDate: "1999-12-23", role: "TQS", overall: 77 },
        { name: "Gonzalo Plata", nation: "Ecuador", birthDate: "2000-11-01", role: "TQD", overall: 76 },
        { name: "Luiz Araújo", nation: "Brasile", birthDate: "1996-06-02", role: "TQD", overall: 75 },
        { name: "Bruno Henrique", nation: "Brasile", birthDate: "1990-12-30", role: "TQS", secondaryRoles: ["ATT"], overall: 75 },
        { name: "Everton", nation: "Brasile", birthDate: "1996-03-22", role: "TQS", overall: 73 },
        { name: "Pedro", nation: "Brasile", birthDate: "1997-06-20", role: "ATT", overall: 80 },
        { name: "Juninho", nation: "Brasile", birthDate: "1996-11-21", role: "ATT", overall: 70 },
        { name: "Wallace Yan", nation: "Brasile", birthDate: "2005-02-08", role: "ATT", overall: 68 },
      ],
    },
    {
      // Il club che produce e rivende: Vitor Roque e Estêvão sono passati di qui, e la fabbrica
      // non si è fermata.
      name: "Palmeiras",
      prestigeTier: 4,
      players: [
        { name: "Carlos Miguel", nation: "Brasile", birthDate: "1998-10-09", role: "POR", overall: 75 },
        { name: "Weverton", nation: "Brasile", birthDate: "1987-12-13", role: "POR", overall: 74 },
        { name: "Gustavo Gómez", nation: "Paraguay", birthDate: "1993-06-06", role: "DC", overall: 79 },
        { name: "Murilo Cerqueira", nation: "Brasile", birthDate: "1997-03-27", role: "DC", overall: 76 },
        { name: "Bruno Fuchs", nation: "Brasile", birthDate: "1999-04-01", role: "DC", overall: 73 },
        { name: "Micael", nation: "Brasile", birthDate: "2000-08-12", role: "DC", overall: 72 },
        { name: "Agustín Giay", nation: "Argentina", birthDate: "2004-01-16", role: "TD", secondaryRoles: ["QD"], overall: 73 },
        { name: "Khellven", nation: "Brasile", birthDate: "2001-02-25", role: "TD", secondaryRoles: ["QD"], overall: 73 },
        { name: "Joaquín Piquerez", nation: "Uruguay", birthDate: "1998-08-24", role: "TS", secondaryRoles: ["QS"], overall: 77 },
        { name: "Jefté", nation: "Brasile", birthDate: "2003-12-21", role: "TS", secondaryRoles: ["QS"], overall: 72 },
        { name: "Aníbal Moreno", nation: "Argentina", birthDate: "1999-05-13", role: "MED", overall: 77 },
        { name: "Andreas Pereira", nation: "Brasile", birthDate: "1996-01-01", role: "CC", secondaryRoles: ["TRQ"], overall: 77 },
        { name: "Lucas Evangelista", nation: "Brasile", birthDate: "1995-05-06", role: "MED", overall: 73 },
        { name: "Emiliano Martínez", nation: "Uruguay", birthDate: "1999-08-17", role: "MED", overall: 72 },
        { name: "Allan", nation: "Brasile", birthDate: "2004-04-19", role: "CC", overall: 70 },
        { name: "Raphael Veiga", nation: "Brasile", birthDate: "1995-06-19", role: "TRQ", overall: 78 },
        { name: "Maurício", nation: "Brasile", birthDate: "2001-06-22", role: "TRQ", secondaryRoles: ["TQS"], overall: 75 },
        { name: "Felipe Anderson", nation: "Brasile", birthDate: "1993-04-15", role: "TQD", overall: 76 },
        { name: "Facundo Torres", nation: "Uruguay", birthDate: "2000-04-13", role: "TQD", overall: 76 },
        { name: "Ramón Sosa", nation: "Paraguay", birthDate: "1999-08-31", role: "TQS", overall: 75 },
        { name: "Paulinho", nation: "Brasile", birthDate: "2000-07-15", role: "TQS", secondaryRoles: ["ATT"], overall: 77 },
        { name: "Bruno Rodrigues", nation: "Brasile", birthDate: "1997-03-07", role: "TQS", overall: 70 },
        { name: "Vitor Roque", nation: "Brasile", birthDate: "2005-02-28", role: "ATT", overall: 78 },
        { name: "José Manuel López", nation: "Argentina", birthDate: "2000-12-06", role: "ATT", overall: 74 },
        { name: "Luighi", nation: "Brasile", birthDate: "2006-04-30", role: "ATT", overall: 68 },
      ],
    },
    {
      // Il progetto Textor: rosa costruita comprando in Sudamerica e in Europa, con Correa e
      // Cabral a dare un profilo che in Brasile non è comune.
      name: "Botafogo",
      prestigeTier: 3,
      players: [
        { name: "Raul", nation: "Brasile", birthDate: "1997-07-28", role: "POR", overall: 74 },
        { name: "Neto", nation: "Brasile", birthDate: "1989-07-19", role: "POR", overall: 70 },
        { name: "Alexander Barboza", nation: "Argentina", birthDate: "1995-03-16", role: "DC", overall: 75 },
        { name: "Bastos", nation: "Angola", birthDate: "1991-11-23", role: "DC", overall: 73 },
        { name: "David Ricardo", nation: "Brasile", birthDate: "2002-12-21", role: "DC", overall: 71 },
        { name: "Kaio", nation: "Brasile", birthDate: "1995-09-18", role: "DC", overall: 70 },
        { name: "Gabriel Bahia", nation: "Brasile", birthDate: "1998-11-24", role: "DC", overall: 69 },
        { name: "Vitinho", nation: "Brasile", birthDate: "1999-07-23", role: "TD", secondaryRoles: ["QD"], overall: 73 },
        { name: "Mateo Ponte", nation: "Uruguay", birthDate: "2003-05-24", role: "TD", secondaryRoles: ["QD"], overall: 72 },
        { name: "Alex Telles", nation: "Brasile", birthDate: "1992-12-15", role: "TS", secondaryRoles: ["QS"], overall: 75 },
        { name: "Cuiabano", nation: "Brasile", birthDate: "2003-02-16", role: "TS", secondaryRoles: ["QS"], overall: 73 },
        { name: "Marçal", nation: "Brasile", birthDate: "1989-02-19", role: "TS", secondaryRoles: ["QS"], overall: 69 },
        { name: "Marlon Freitas", nation: "Brasile", birthDate: "1995-03-27", role: "MED", overall: 75 },
        { name: "Allan", nation: "Brasile", birthDate: "1991-01-08", role: "MED", overall: 73 },
        { name: "Danilo", nation: "Brasile", birthDate: "2001-04-29", role: "CC", overall: 72 },
        { name: "Newton", nation: "Brasile", birthDate: "2000-03-12", role: "CC", overall: 70 },
        { name: "Gabriel Justino", nation: "Brasile", birthDate: "2006-04-16", role: "CC", overall: 67 },
        { name: "Santiago Rodríguez", nation: "Uruguay", birthDate: "2000-01-08", role: "TRQ", overall: 75 },
        { name: "Jefferson Savarino", nation: "Venezuela", birthDate: "1996-11-11", role: "TQD", secondaryRoles: ["TRQ"], overall: 77 },
        { name: "Artur", nation: "Brasile", birthDate: "1998-02-15", role: "TQD", overall: 74 },
        { name: "Jeffinho", nation: "Brasile", birthDate: "1999-12-30", role: "TQS", overall: 72 },
        { name: "Matheus Martins", nation: "Brasile", birthDate: "2003-07-16", role: "TQS", overall: 71 },
        { name: "Nathan Fernandes", nation: "Brasile", birthDate: "2005-02-16", role: "TQS", overall: 69 },
        { name: "Arthur Cabral", nation: "Brasile", birthDate: "1998-04-25", role: "ATT", overall: 76 },
        { name: "Joaquín Correa", nation: "Argentina", birthDate: "1994-08-13", role: "ATT", secondaryRoles: ["TRQ"], overall: 74 },
        { name: "Gonzalo Mastriani", nation: "Uruguay", birthDate: "1993-04-28", role: "ATT", overall: 72 },
        { name: "Chris Ramos", nation: "Spagna", birthDate: "1997-01-16", role: "ATT", overall: 71 },
      ],
    },
    {
      // La rosa dei ritorni: Oscar e Lucas Moura sono due che il database europeo conosceva già,
      // e che qui tornano acquistabili.
      name: "São Paulo",
      prestigeTier: 3,
      players: [
        { name: "Rafael", nation: "Brasile", birthDate: "1989-06-23", role: "POR", overall: 75 },
        { name: "Young", nation: "Brasile", birthDate: "2002-03-07", role: "POR", overall: 68 },
        { name: "Rafael Tolói", nation: "Italia", birthDate: "1990-10-10", role: "DC", overall: 75 },
        { name: "Robert Arboleda", nation: "Ecuador", birthDate: "1991-10-22", role: "DC", overall: 74 },
        { name: "Alan Franco", nation: "Argentina", birthDate: "1996-10-11", role: "DC", overall: 73 },
        { name: "Nahuel Ferraresi", nation: "Venezuela", birthDate: "1998-11-19", role: "DC", overall: 72 },
        { name: "Sabino", nation: "Brasile", birthDate: "1996-10-25", role: "DC", overall: 71 },
        { name: "Cédric Soares", nation: "Portogallo", birthDate: "1991-08-31", role: "TD", secondaryRoles: ["QD"], overall: 73 },
        { name: "Maílton", nation: "Brasile", birthDate: "1998-05-31", role: "TD", secondaryRoles: ["QD"], overall: 70 },
        { name: "Wendell", nation: "Brasile", birthDate: "1993-07-20", role: "TS", secondaryRoles: ["QS"], overall: 74 },
        { name: "Enzo Díaz", nation: "Argentina", birthDate: "1995-12-07", role: "TS", secondaryRoles: ["QS"], overall: 73 },
        { name: "Patryck", nation: "Brasile", birthDate: "2003-01-18", role: "TS", secondaryRoles: ["QS"], overall: 70 },
        { name: "Pablo Maia", nation: "Brasile", birthDate: "2002-01-10", role: "MED", overall: 75 },
        { name: "Luiz Gustavo", nation: "Brasile", birthDate: "1987-07-23", role: "MED", overall: 72 },
        { name: "Marcos Antônio", nation: "Brasile", birthDate: "2000-06-13", role: "CC", overall: 73 },
        { name: "Damián Bobadilla", nation: "Paraguay", birthDate: "2001-07-11", role: "CC", overall: 71 },
        { name: "Luan", nation: "Brasile", birthDate: "1999-05-14", role: "CC", overall: 70 },
        { name: "Rodriguinho", nation: "Brasile", birthDate: "2004-03-16", role: "CC", overall: 68 },
        { name: "Oscar", nation: "Brasile", birthDate: "1991-09-09", role: "TRQ", overall: 76 },
        { name: "Lucas Moura", nation: "Brasile", birthDate: "1992-08-13", role: "TQD", secondaryRoles: ["TRQ"], overall: 77 },
        { name: "Emiliano Rigoni", nation: "Argentina", birthDate: "1993-02-04", role: "TQD", overall: 72 },
        { name: "Ferreira", nation: "Brasile", birthDate: "1997-12-31", role: "TQS", overall: 72 },
        { name: "Alisson", nation: "Brasile", birthDate: "1993-06-25", role: "TQS", overall: 71 },
        { name: "Luciano", nation: "Brasile", birthDate: "1993-05-18", role: "ATT", secondaryRoles: ["TRQ"], overall: 75 },
        { name: "Jonathan Calleri", nation: "Argentina", birthDate: "1993-09-23", role: "ATT", overall: 75 },
        { name: "André Silva", nation: "Brasile", birthDate: "1997-06-03", role: "ATT", overall: 71 },
        { name: "Gonzalo Tapia", nation: "Cile", birthDate: "2002-02-18", role: "ATT", overall: 70 },
      ],
    },
  ],
};
