import type { ShowcaseLeague } from "./types";

/**
 * **Saudi Pro League 2025/26** — dove sono finiti i grandi nomi che il mercato europeo non ha
 * più.
 *
 * È la lega vetrina con il **tetto più alto** e il pavimento più incerto, ed è voluto: le prime
 * quattro squadre schierano gente da Champions, il resto del campionato no. Per il mercato della
 * DS mode è l'unico posto in cui trovare un fuoriclasse trentenne che in Europa nessuno vende —
 * costoso in ingaggio (§3.7.5ter), ma disponibile.
 *
 * Solo due club: sono quelli con una rosa davvero da database. Aggiungerne altri avrebbe
 * significato riempire il pool di giocatori sotto la banda utile.
 *
 * Banda dichiarata **62-86**.
 */
export const ARABIA_SAUDITA: ShowcaseLeague = {
  name: "Saudi Pro League",
  nation: "Arabia Saudita",
  prestigeTier: 3,
  overallRange: [62, 86],
  clubs: [
    {
      name: "Al-Hilal",
      prestigeTier: 4,
      players: [
        { name: "Yassine Bounou", nation: "Marocco", birthDate: "1991-04-05", role: "POR", overall: 81 },
        { name: "Mohammed Al-Yami", nation: "Arabia Saudita", birthDate: "1997-08-14", role: "POR", overall: 70 },
        { name: "Kalidou Koulibaly", nation: "Senegal", birthDate: "1991-06-20", role: "DC", overall: 80 },
        { name: "Pablo Marí", nation: "Spagna", birthDate: "1993-08-31", role: "DC", overall: 74 },
        { name: "Hassan Tambakti", nation: "Arabia Saudita", birthDate: "1999-02-09", role: "DC", overall: 73 },
        { name: "Ali Lajami", nation: "Arabia Saudita", birthDate: "1996-04-25", role: "DC", overall: 71 },
        { name: "Yusuf Akçiçek", nation: "Turchia", birthDate: "2006-01-25", role: "DC", overall: 74 },
        { name: "Moteb Al-Harbi", nation: "Arabia Saudita", birthDate: "2000-02-19", role: "TD", secondaryRoles: ["QD"], overall: 71 },
        { name: "Hamad Al-Yami", nation: "Arabia Saudita", birthDate: "1999-05-17", role: "TD", secondaryRoles: ["QD"], overall: 70 },
        { name: "Théo Hernández", nation: "Francia", birthDate: "1997-10-06", role: "TS", secondaryRoles: ["QS"], overall: 82 },
        { name: "Rayan Al-Ghamdi", nation: "Arabia Saudita", birthDate: "2006-01-03", role: "TS", secondaryRoles: ["QS"], overall: 66 },
        { name: "Rúben Neves", nation: "Portogallo", birthDate: "1997-03-13", role: "MED", secondaryRoles: ["CC"], overall: 82 },
        { name: "Sergej Milinković-Savić", nation: "Serbia", birthDate: "1995-02-27", role: "CC", overall: 82 },
        { name: "Mohamed Kanno", nation: "Arabia Saudita", birthDate: "1994-09-22", role: "MED", overall: 74 },
        { name: "Nasser Al-Dawsari", nation: "Arabia Saudita", birthDate: "1998-12-19", role: "CC", overall: 73 },
        { name: "Abdulkarim Darisi", nation: "Arabia Saudita", birthDate: "2003-04-18", role: "CC", overall: 68 },
        { name: "Murad Al-Hawsawi", nation: "Arabia Saudita", birthDate: "2001-06-03", role: "CC", overall: 67 },
        { name: "Saïmon Bouabré", nation: "Francia", birthDate: "2006-06-01", role: "TRQ", overall: 71 },
        { name: "Malcom", nation: "Brasile", birthDate: "1997-02-26", role: "TQD", overall: 80 },
        { name: "Salem Al-Dawsari", nation: "Arabia Saudita", birthDate: "1991-08-19", role: "TQS", overall: 78 },
        { name: "Sultan Mandash", nation: "Arabia Saudita", birthDate: "1994-10-16", role: "TQD", overall: 71 },
        { name: "Karim Benzema", nation: "Francia", birthDate: "1987-12-19", role: "ATT", overall: 82 },
        { name: "Darwin Núñez", nation: "Uruguay", birthDate: "1999-06-24", role: "ATT", overall: 80 },
        { name: "Marcos Leonardo", nation: "Brasile", birthDate: "2003-05-02", role: "ATT", overall: 78 },
      ],
    },
    {
      name: "Al-Nassr",
      prestigeTier: 4,
      players: [
        { name: "Bento", nation: "Brasile", birthDate: "1999-06-10", role: "POR", overall: 79 },
        { name: "Nawaf Al-Aqidi", nation: "Arabia Saudita", birthDate: "2000-05-10", role: "POR", overall: 71 },
        { name: "Íñigo Martínez", nation: "Spagna", birthDate: "1991-05-17", role: "DC", overall: 80 },
        { name: "Mohamed Simakan", nation: "Francia", birthDate: "2000-05-03", role: "DC", secondaryRoles: ["TD"], overall: 78 },
        { name: "Abdulelah Al-Amri", nation: "Arabia Saudita", birthDate: "1997-01-15", role: "DC", overall: 73 },
        { name: "Nader Al-Sharari", nation: "Arabia Saudita", birthDate: "1996-05-08", role: "DC", overall: 70 },
        { name: "Sultan Al-Ghannam", nation: "Arabia Saudita", birthDate: "1994-05-06", role: "TD", secondaryRoles: ["QD"], overall: 73 },
        { name: "Saad Al-Nasser", nation: "Arabia Saudita", birthDate: "2001-01-08", role: "TD", secondaryRoles: ["QD"], overall: 68 },
        { name: "Nawaf Bu-Washl", nation: "Arabia Saudita", birthDate: "1999-09-16", role: "TS", secondaryRoles: ["QS"], overall: 70 },
        { name: "Salem Al-Najdi", nation: "Arabia Saudita", birthDate: "2003-01-27", role: "TS", secondaryRoles: ["QS"], overall: 67 },
        { name: "Marcelo Brozović", nation: "Croazia", birthDate: "1992-11-16", role: "MED", secondaryRoles: ["CC"], overall: 80 },
        { name: "Abdullah Al-Khaibari", nation: "Arabia Saudita", birthDate: "1996-08-16", role: "MED", overall: 73 },
        { name: "Ali Al-Hassan", nation: "Arabia Saudita", birthDate: "1997-03-04", role: "CC", overall: 72 },
        { name: "Aiman Yahya", nation: "Arabia Saudita", birthDate: "2001-05-14", role: "CC", overall: 71 },
        { name: "Abdulmalik Al-Jaber", nation: "Arabia Saudita", birthDate: "2004-01-07", role: "CC", overall: 68 },
        { name: "Haydeer Abdulkareem", nation: "Iraq", birthDate: "2004-08-07", role: "CC", overall: 67 },
        { name: "João Félix", nation: "Portogallo", birthDate: "1999-11-10", role: "TRQ", secondaryRoles: ["ATT"], overall: 81 },
        { name: "Kingsley Coman", nation: "Francia", birthDate: "1996-06-13", role: "TQD", overall: 81 },
        { name: "Sadio Mané", nation: "Senegal", birthDate: "1992-04-10", role: "TQS", overall: 80 },
        { name: "Ângelo", nation: "Brasile", birthDate: "2004-12-21", role: "TQD", overall: 73 },
        { name: "Abdulrahman Ghareeb", nation: "Arabia Saudita", birthDate: "1997-03-31", role: "TQS", overall: 73 },
        { name: "Cristiano Ronaldo", nation: "Portogallo", birthDate: "1985-02-05", role: "ATT", overall: 82 },
        { name: "Abdullah Al-Hamddan", nation: "Arabia Saudita", birthDate: "1999-09-12", role: "ATT", overall: 72 },
        { name: "Mohammed Marran", nation: "Arabia Saudita", birthDate: "2001-02-15", role: "ATT", overall: 68 },
      ],
    },
  ],
};
