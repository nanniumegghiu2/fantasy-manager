import type { ShowcaseLeague } from "./types";

/**
 * **Süper Lig 2025/26** — il campionato che compra i trentenni dei Big 5.
 *
 * Profilo opposto a quello olandese, ed è la ragione per cui vale la pena averlo: qui non ci
 * sono ventenni da valorizzare, ci sono giocatori **già fatti** che i Big 5 hanno lasciato
 * andare e che tornerebbero volentieri. Per il mercato della DS mode è il posto dove un club di
 * media classifica trova il titolare pronto, non la scommessa.
 *
 * Banda dichiarata **62-83**: il tetto è alto perché Osimhen e Sané sono davvero di quel
 * livello, ma sotto le prime quattro squadre il campionato scende in fretta.
 *
 * Due righe della fonte sono state **scartate** invece di completate a memoria: una data di
 * nascita impossibile per un titolare (2011) e alcune caselle senza nome. È la regola dichiarata
 * in `types.ts` — un dato inventato qui sarebbe indistinguibile da uno vero.
 */
export const TURCHIA: ShowcaseLeague = {
  name: "Süper Lig",
  nation: "Turchia",
  prestigeTier: 3,
  overallRange: [62, 83],
  clubs: [
    {
      name: "Galatasaray",
      prestigeTier: 4,
      players: [
        { name: "Uğurcan Çakır", nation: "Turchia", birthDate: "1996-04-05", role: "POR", overall: 79 },
        { name: "Günay Güvenç", nation: "Germania", birthDate: "1991-07-25", role: "POR", overall: 70 },
        { name: "Davinson Sánchez", nation: "Colombia", birthDate: "1996-06-12", role: "DC", overall: 79 },
        { name: "Abdülkerim Bardakcı", nation: "Turchia", birthDate: "1994-09-07", role: "DC", overall: 76 },
        { name: "Kaan Ayhan", nation: "Turchia", birthDate: "1994-11-10", role: "DC", overall: 74 },
        { name: "Metehan Baltacı", nation: "Turchia", birthDate: "2002-11-03", role: "DC", overall: 70 },
        { name: "Wilfried Singo", nation: "Costa d'Avorio", birthDate: "2000-12-25", role: "TD", secondaryRoles: ["QD", "DC"], overall: 78 },
        { name: "Sacha Boey", nation: "Francia", birthDate: "2000-09-13", role: "TD", secondaryRoles: ["QD"], overall: 76 },
        { name: "Ismail Jakobs", nation: "Senegal", birthDate: "1999-08-17", role: "TS", secondaryRoles: ["QS"], overall: 74 },
        { name: "Arda Ünyay", nation: "Turchia", birthDate: "2007-01-18", role: "TS", secondaryRoles: ["QS"], overall: 64 },
        { name: "İlkay Gündoğan", nation: "Germania", birthDate: "1990-10-24", role: "CC", secondaryRoles: ["TRQ"], overall: 80 },
        { name: "Lucas Torreira", nation: "Uruguay", birthDate: "1996-02-11", role: "MED", overall: 79 },
        { name: "Gabriel Sara", nation: "Brasile", birthDate: "1999-06-26", role: "CC", overall: 77 },
        { name: "Mario Lemina", nation: "Gabon", birthDate: "1993-09-01", role: "MED", overall: 75 },
        { name: "Gökdeniz Gürpüz", nation: "Turchia", birthDate: "2006-02-25", role: "CC", overall: 68 },
        { name: "Yáser Asprilla", nation: "Colombia", birthDate: "2003-11-19", role: "TRQ", overall: 74 },
        { name: "Leroy Sané", nation: "Germania", birthDate: "1996-01-11", role: "TQS", secondaryRoles: ["TQD"], overall: 83 },
        { name: "Barış Alper Yılmaz", nation: "Turchia", birthDate: "2000-05-23", role: "TQS", secondaryRoles: ["ES"], overall: 77 },
        { name: "Roland Sallai", nation: "Ungheria", birthDate: "1997-05-22", role: "TQD", overall: 76 },
        { name: "Noa Lang", nation: "Paesi Bassi", birthDate: "1999-06-17", role: "TQS", overall: 76 },
        { name: "Yunus Akgün", nation: "Turchia", birthDate: "2000-07-07", role: "TQD", overall: 74 },
        { name: "Victor Osimhen", nation: "Nigeria", birthDate: "1998-12-29", role: "ATT", overall: 83 },
        { name: "Mauro Icardi", nation: "Argentina", birthDate: "1993-02-19", role: "ATT", overall: 79 },
        { name: "Ahmed Kutucu", nation: "Turchia", birthDate: "2000-03-01", role: "ATT", overall: 70 },
      ],
    },
    {
      name: "Fenerbahçe",
      prestigeTier: 4,
      players: [
        { name: "Ederson", nation: "Brasile", birthDate: "1993-08-17", role: "POR", overall: 81 },
        { name: "Mert Günok", nation: "Turchia", birthDate: "1989-03-01", role: "POR", overall: 73 },
        { name: "Milan Škriniar", nation: "Slovacchia", birthDate: "1995-02-11", role: "DC", overall: 80 },
        { name: "Çağlar Söyüncü", nation: "Turchia", birthDate: "1996-05-23", role: "DC", overall: 75 },
        { name: "Jayden Oosterwolde", nation: "Paesi Bassi", birthDate: "2001-04-26", role: "DC", secondaryRoles: ["TS"], overall: 74 },
        { name: "Yiğit Efe Demir", nation: "Turchia", birthDate: "2004-08-02", role: "DC", overall: 68 },
        { name: "Nélson Semedo", nation: "Portogallo", birthDate: "1993-11-16", role: "TD", secondaryRoles: ["QD"], overall: 75 },
        { name: "Mert Müldür", nation: "Turchia", birthDate: "1999-04-03", role: "TD", secondaryRoles: ["QD"], overall: 73 },
        { name: "Archie Brown", nation: "Inghilterra", birthDate: "2002-05-28", role: "TS", secondaryRoles: ["QS"], overall: 74 },
        { name: "Levent Mercan", nation: "Germania", birthDate: "2000-12-10", role: "TS", secondaryRoles: ["QS"], overall: 71 },
        { name: "N'Golo Kanté", nation: "Francia", birthDate: "1991-03-29", role: "MED", secondaryRoles: ["CC"], overall: 81 },
        { name: "Mattéo Guendouzi", nation: "Francia", birthDate: "1999-04-14", role: "CC", overall: 79 },
        { name: "Edson Álvarez", nation: "Messico", birthDate: "1997-10-24", role: "MED", secondaryRoles: ["DC"], overall: 78 },
        { name: "Fred", nation: "Brasile", birthDate: "1993-03-05", role: "CC", overall: 76 },
        { name: "İsmail Yüksek", nation: "Turchia", birthDate: "1999-01-26", role: "MED", overall: 73 },
        { name: "Mert Hakan Yandaş", nation: "Turchia", birthDate: "1994-08-19", role: "CC", overall: 70 },
        { name: "Marco Asensio", nation: "Spagna", birthDate: "1996-01-21", role: "TRQ", secondaryRoles: ["TQD"], overall: 79 },
        { name: "Anderson Talisca", nation: "Brasile", birthDate: "1994-02-01", role: "TRQ", secondaryRoles: ["ATT"], overall: 78 },
        { name: "Kerem Aktürkoğlu", nation: "Turchia", birthDate: "1998-10-21", role: "TQS", overall: 77 },
        { name: "Anthony Musaba", nation: "Paesi Bassi", birthDate: "2000-12-06", role: "TQD", overall: 72 },
        { name: "Oğuz Aydın", nation: "Turchia", birthDate: "2000-10-27", role: "TQD", overall: 71 },
        { name: "Dorgeles Nene", nation: "Mali", birthDate: "2002-12-23", role: "ATT", secondaryRoles: ["TQS"], overall: 74 },
        { name: "Sidiki Chérif", nation: "Francia", birthDate: "2006-12-15", role: "ATT", overall: 68 },
      ],
    },
    {
      name: "Beşiktaş",
      prestigeTier: 3,
      players: [
        { name: "Ersin Destanoğlu", nation: "Turchia", birthDate: "2001-01-01", role: "POR", overall: 74 },
        { name: "Devis Vásquez", nation: "Colombia", birthDate: "1998-05-12", role: "POR", overall: 71 },
        { name: "Emmanuel Agbadou", nation: "Costa d'Avorio", birthDate: "1997-06-17", role: "DC", overall: 75 },
        { name: "Felix Uduokhai", nation: "Germania", birthDate: "1997-09-09", role: "DC", overall: 74 },
        { name: "Tiago Djaló", nation: "Portogallo", birthDate: "2000-04-09", role: "DC", overall: 72 },
        { name: "Emir Han Topçu", nation: "Turchia", birthDate: "2000-10-11", role: "DC", overall: 70 },
        { name: "Yasin Özcan", nation: "Turchia", birthDate: "2006-04-20", role: "DC", overall: 69 },
        { name: "Michael Amir Murillo", nation: "Panama", birthDate: "1996-02-11", role: "TD", secondaryRoles: ["QD"], overall: 73 },
        { name: "Taylan Bulut", nation: "Germania", birthDate: "2006-01-19", role: "TD", secondaryRoles: ["QD"], overall: 70 },
        { name: "Rıdvan Yılmaz", nation: "Turchia", birthDate: "2001-05-21", role: "TS", secondaryRoles: ["QS"], overall: 73 },
        { name: "Gökhan Sazdağı", nation: "Turchia", birthDate: "1994-09-20", role: "TS", secondaryRoles: ["QS"], overall: 70 },
        { name: "Wilfred Ndidi", nation: "Nigeria", birthDate: "1996-12-16", role: "MED", overall: 78 },
        { name: "Orkun Kökçü", nation: "Turchia", birthDate: "2000-12-29", role: "CC", secondaryRoles: ["TRQ"], overall: 78 },
        { name: "Kristjan Asllani", nation: "Albania", birthDate: "2002-03-09", role: "MED", overall: 75 },
        { name: "Salih Uçan", nation: "Turchia", birthDate: "1994-01-06", role: "CC", overall: 70 },
        { name: "Necip Uysal", nation: "Turchia", birthDate: "1991-01-24", role: "MED", overall: 68 },
        { name: "Kartal Yılmaz", nation: "Turchia", birthDate: "2000-11-04", role: "CC", overall: 68 },
        { name: "Cengiz Ünder", nation: "Turchia", birthDate: "1997-07-14", role: "TQD", overall: 76 },
        { name: "Milot Rashica", nation: "Kosovo", birthDate: "1996-06-28", role: "TQS", overall: 74 },
        { name: "Václav Černý", nation: "Rep. Ceca", birthDate: "1997-10-17", role: "TQD", overall: 74 },
        { name: "Jota Silva", nation: "Portogallo", birthDate: "1999-08-01", role: "TQS", overall: 74 },
        { name: "Junior Olaitan", nation: "Benin", birthDate: "2002-05-09", role: "TQD", overall: 70 },
        { name: "El Bilal Touré", nation: "Mali", birthDate: "2001-10-03", role: "ATT", overall: 76 },
        { name: "Oh Hyeon-Gyu", nation: "Corea del Sud", birthDate: "2001-04-12", role: "ATT", overall: 74 },
      ],
    },
    {
      name: "Trabzonspor",
      prestigeTier: 3,
      players: [
        { name: "André Onana", nation: "Camerun", birthDate: "1996-04-02", role: "POR", overall: 78 },
        { name: "Onuralp Çevikkan", nation: "Turchia", birthDate: "2006-01-02", role: "POR", overall: 68 },
        { name: "Stefan Savić", nation: "Montenegro", birthDate: "1991-01-08", role: "DC", overall: 74 },
        { name: "Arseniy Batahov", nation: "Ucraina", birthDate: "2002-03-05", role: "DC", overall: 70 },
        { name: "Chibuike Nwaiwu", nation: "Nigeria", birthDate: "2003-07-23", role: "DC", overall: 69 },
        { name: "Taha Emre İnce", nation: "Turchia", birthDate: "2007-07-26", role: "DC", overall: 64 },
        { name: "Wagner Pina", nation: "Capo Verde", birthDate: "2002-11-03", role: "TD", secondaryRoles: ["QD"], overall: 71 },
        { name: "Mustafa Eskihellaç", nation: "Turchia", birthDate: "1997-05-05", role: "TD", secondaryRoles: ["QD"], overall: 70 },
        { name: "Mathias Fjørtoft Løvik", nation: "Norvegia", birthDate: "2003-12-06", role: "TS", secondaryRoles: ["QS"], overall: 70 },
        { name: "Arda Öztürk", nation: "Turchia", birthDate: "2007-03-10", role: "TS", secondaryRoles: ["QS"], overall: 64 },
        { name: "Okay Yokuşlu", nation: "Turchia", birthDate: "1994-03-09", role: "MED", overall: 74 },
        { name: "Ozan Tufan", nation: "Turchia", birthDate: "1995-03-23", role: "CC", overall: 74 },
        { name: "Christ Inao Oulaï", nation: "Costa d'Avorio", birthDate: "2006-04-06", role: "MED", overall: 72 },
        { name: "Tim Jabol-Folcarelli", nation: "Francia", birthDate: "1999-12-06", role: "CC", overall: 70 },
        { name: "Salih Malkoçoğlu", nation: "Turchia", birthDate: "2005-02-23", role: "CC", overall: 66 },
        { name: "Boran Başkan", nation: "Turchia", birthDate: "2006-03-29", role: "CC", overall: 66 },
        { name: "Ernest Muçi", nation: "Albania", birthDate: "2001-03-19", role: "TRQ", secondaryRoles: ["TQS"], overall: 74 },
        { name: "Edin Višća", nation: "Bosnia ed Erzegovina", birthDate: "1990-02-17", role: "TQD", overall: 73 },
        { name: "Oleksandr Zubkov", nation: "Ucraina", birthDate: "1996-08-03", role: "TQS", overall: 73 },
        { name: "Anthony Nwakaeme", nation: "Nigeria", birthDate: "1989-03-21", role: "TQS", overall: 70 },
        { name: "Paul Onuachu", nation: "Nigeria", birthDate: "1994-05-28", role: "ATT", overall: 76 },
        { name: "Felipe Augusto", nation: "Brasile", birthDate: "2004-02-18", role: "ATT", overall: 72 },
        { name: "Umut Nayir", nation: "Turchia", birthDate: "1993-06-28", role: "ATT", overall: 68 },
      ],
    },
  ],
};
