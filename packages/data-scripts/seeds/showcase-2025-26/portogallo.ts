import type { ShowcaseLeague } from "./types";

/**
 * **Primeira Liga 2025/26** — il primo esportatore di talento verso i Big 5.
 *
 * È la lega vetrina che conta di più per il mercato: Benfica, Porto e Sporting comprano in
 * Sudamerica e rivendono in Premier, quindi le loro rose sono piene esattamente del profilo che
 * un DS dei Big 5 va a cercare. Le altre quindici squadre del campionato non sono qui: servono
 * i bacini, non la classifica (nessuno giocherà mai la Primeira Liga).
 *
 * Banda dichiarata **62-84**: il tetto sta sotto i fuoriclasse dei Big 5, perché anche il
 * migliore di questo campionato è un giocatore che una big europea comprerebbe per migliorarsi,
 * non un titolare già pronto del Real Madrid.
 */
export const PORTOGALLO: ShowcaseLeague = {
  name: "Primeira Liga",
  nation: "Portogallo",
  prestigeTier: 3,
  overallRange: [62, 84],
  clubs: [
    {
      // Rosa costruita sul mercato ucraino e sudamericano: Sudakov e Rios sono i due che
      // qualunque club di Premier guarderebbe per primi.
      name: "Benfica",
      prestigeTier: 4,
      players: [
        { name: "Anatoliy Trubin", nation: "Ucraina", birthDate: "2001-08-01", role: "POR", overall: 82 },
        { name: "Samuel Soares", nation: "Portogallo", birthDate: "2002-06-15", role: "POR", overall: 70 },
        { name: "Nicolás Otamendi", nation: "Argentina", birthDate: "1988-02-12", role: "DC", overall: 79 },
        { name: "António Silva", nation: "Portogallo", birthDate: "2003-10-30", role: "DC", overall: 78 },
        { name: "Tomás Araújo", nation: "Portogallo", birthDate: "2002-05-16", role: "DC", overall: 76 },
        { name: "Sidny Cabral", nation: "Capo Verde", birthDate: "2002-09-18", role: "DC", overall: 68 },
        { name: "Amar Dedić", nation: "Bosnia ed Erzegovina", birthDate: "2002-08-18", role: "TD", secondaryRoles: ["QD"], overall: 76 },
        { name: "Alexander Bah", nation: "Danimarca", birthDate: "1997-12-09", role: "TD", secondaryRoles: ["QD"], overall: 74 },
        { name: "Samuel Dahl", nation: "Svezia", birthDate: "2003-03-04", role: "TS", secondaryRoles: ["QS"], overall: 72 },
        { name: "Joshua Wynder", nation: "Stati Uniti", birthDate: "2005-05-02", role: "TS", secondaryRoles: ["QS"], overall: 66 },
        { name: "Fredrik Aursnes", nation: "Norvegia", birthDate: "1995-12-10", role: "CC", overall: 78 },
        { name: "Richard Rios", nation: "Colombia", birthDate: "2000-06-02", role: "MED", secondaryRoles: ["CC"], overall: 78 },
        { name: "Enzo Barrenechea", nation: "Argentina", birthDate: "2001-05-25", role: "MED", overall: 76 },
        { name: "Leandro Barreiro", nation: "Lussemburgo", birthDate: "2000-01-03", role: "CC", overall: 74 },
        { name: "Manu Silva", nation: "Portogallo", birthDate: "2001-06-12", role: "CC", overall: 70 },
        { name: "Heorhiy Sudakov", nation: "Ucraina", birthDate: "2002-09-01", role: "TRQ", secondaryRoles: ["CC"], overall: 81 },
        { name: "Dodi Lukebakio", nation: "Belgio", birthDate: "1997-09-24", role: "TQD", overall: 79 },
        { name: "Andreas Schjelderup", nation: "Norvegia", birthDate: "2004-06-01", role: "TQS", overall: 76 },
        { name: "Gianluca Prestianni", nation: "Argentina", birthDate: "2006-01-31", role: "TQD", overall: 74 },
        { name: "Rafa", nation: "Portogallo", birthDate: "1993-05-17", role: "TQD", secondaryRoles: ["TQS"], overall: 76 },
        { name: "Bruma", nation: "Portogallo", birthDate: "1994-10-24", role: "TQS", overall: 73 },
        { name: "Evangelos Pavlidis", nation: "Grecia", birthDate: "1998-11-21", role: "ATT", overall: 80 },
        { name: "Franjo Ivanović", nation: "Croazia", birthDate: "2003-10-01", role: "ATT", overall: 76 },
        { name: "Henrique Araújo", nation: "Portogallo", birthDate: "2002-01-19", role: "ATT", overall: 70 },
      ],
    },
    {
      // Il club più internazionale del Portogallo: due polacchi in difesa, spagnoli e argentini
      // a centrocampo, e Diogo Costa che è da anni il portiere migliore del campionato.
      name: "FC Porto",
      prestigeTier: 4,
      players: [
        { name: "Diogo Costa", nation: "Portogallo", birthDate: "1999-09-19", role: "POR", overall: 82 },
        { name: "Cláudio Ramos", nation: "Portogallo", birthDate: "1991-11-16", role: "POR", overall: 70 },
        { name: "Jan Bednarek", nation: "Polonia", birthDate: "1996-04-12", role: "DC", overall: 76 },
        { name: "Jakub Kiwior", nation: "Polonia", birthDate: "2000-02-15", role: "DC", secondaryRoles: ["TS"], overall: 76 },
        { name: "Nehuén Pérez", nation: "Argentina", birthDate: "2000-06-24", role: "DC", overall: 76 },
        { name: "Dominik Prpić", nation: "Croazia", birthDate: "2004-05-19", role: "DC", overall: 70 },
        { name: "Martim Fernandes", nation: "Portogallo", birthDate: "2006-01-18", role: "TD", secondaryRoles: ["QD"], overall: 74 },
        { name: "Alberto Costa", nation: "Portogallo", birthDate: "2003-09-29", role: "TD", secondaryRoles: ["QD"], overall: 73 },
        { name: "Zaidu Sanusi", nation: "Nigeria", birthDate: "1997-06-13", role: "TS", secondaryRoles: ["QS"], overall: 73 },
        { name: "Francisco Moura", nation: "Portogallo", birthDate: "1999-04-16", role: "TS", secondaryRoles: ["QS"], overall: 73 },
        { name: "Alan Varela", nation: "Argentina", birthDate: "2001-07-04", role: "MED", overall: 78 },
        { name: "Gabri Veiga", nation: "Spagna", birthDate: "2002-05-27", role: "CC", overall: 78 },
        { name: "Seko Fofana", nation: "Costa d'Avorio", birthDate: "1995-05-07", role: "CC", overall: 75 },
        { name: "Victor Froholdt", nation: "Danimarca", birthDate: "2006-02-25", role: "CC", overall: 74 },
        { name: "Pablo Rosario", nation: "Paesi Bassi", birthDate: "1997-01-07", role: "MED", overall: 73 },
        { name: "Rodrigo Mora", nation: "Portogallo", birthDate: "2007-05-05", role: "TRQ", overall: 76 },
        { name: "Pepê", nation: "Brasile", birthDate: "1997-02-24", role: "TQD", overall: 78 },
        { name: "Borja Sainz", nation: "Spagna", birthDate: "2001-02-01", role: "TQS", overall: 76 },
        { name: "Yann Karamoh", nation: "Francia", birthDate: "1998-07-08", role: "TQS", overall: 73 },
        { name: "William Gomes", nation: "Brasile", birthDate: "2006-03-15", role: "TQD", overall: 72 },
        { name: "Samu Omorodion", nation: "Spagna", birthDate: "2004-05-05", role: "ATT", overall: 78 },
        { name: "Terem Moffi", nation: "Nigeria", birthDate: "1999-05-25", role: "ATT", overall: 76 },
        { name: "Luuk de Jong", nation: "Paesi Bassi", birthDate: "1990-08-27", role: "ATT", overall: 74 },
        { name: "Deniz Gül", nation: "Turchia", birthDate: "2004-07-02", role: "ATT", overall: 70 },
      ],
    },
    {
      // La squadra che ha vinto e poi venduto: resta un centrocampo di livello europeo
      // (Hjulmand, Morita) e due esterni che i Big 5 seguono da tempo.
      name: "Sporting CP",
      prestigeTier: 4,
      players: [
        { name: "Rui Silva", nation: "Portogallo", birthDate: "1994-02-07", role: "POR", overall: 78 },
        { name: "João Virgínia", nation: "Portogallo", birthDate: "1999-10-10", role: "POR", overall: 70 },
        { name: "Gonçalo Inácio", nation: "Portogallo", birthDate: "2001-08-25", role: "DC", overall: 80 },
        { name: "Ousmane Diomandé", nation: "Costa d'Avorio", birthDate: "2003-12-04", role: "DC", overall: 78 },
        { name: "Zeno Debast", nation: "Belgio", birthDate: "2003-10-24", role: "DC", overall: 76 },
        { name: "Eduardo Quaresma", nation: "Portogallo", birthDate: "2002-03-02", role: "DC", overall: 72 },
        { name: "Giorgos Vagiannidis", nation: "Grecia", birthDate: "2001-09-12", role: "TD", secondaryRoles: ["QD"], overall: 74 },
        { name: "Iván Fresneda", nation: "Spagna", birthDate: "2004-09-28", role: "TD", secondaryRoles: ["QD"], overall: 73 },
        { name: "Maximiliano Araújo", nation: "Uruguay", birthDate: "2000-02-15", role: "TS", secondaryRoles: ["QS"], overall: 74 },
        { name: "Nuno Santos", nation: "Portogallo", birthDate: "1995-02-13", role: "TS", secondaryRoles: ["QS"], overall: 74 },
        { name: "Ricardo Mangas", nation: "Portogallo", birthDate: "1998-03-19", role: "TS", secondaryRoles: ["QS"], overall: 71 },
        { name: "Morten Hjulmand", nation: "Danimarca", birthDate: "1999-06-25", role: "MED", overall: 80 },
        { name: "Hidemasa Morita", nation: "Giappone", birthDate: "1995-05-10", role: "MED", secondaryRoles: ["CC"], overall: 77 },
        { name: "Giorgi Kochorashvili", nation: "Georgia", birthDate: "1999-06-29", role: "CC", overall: 74 },
        { name: "Daniel Bragança", nation: "Portogallo", birthDate: "1999-05-27", role: "CC", overall: 72 },
        { name: "Pedro Gonçalves", nation: "Portogallo", birthDate: "1998-06-28", role: "TRQ", secondaryRoles: ["TQD"], overall: 81 },
        { name: "Francisco Trincão", nation: "Portogallo", birthDate: "1999-12-29", role: "TQD", overall: 79 },
        { name: "Geovany Quenda", nation: "Portogallo", birthDate: "2007-04-30", role: "TQD", overall: 76 },
        { name: "Geny Catamo", nation: "Mozambico", birthDate: "2001-01-26", role: "TQS", overall: 73 },
        { name: "Luis Guilherme", nation: "Brasile", birthDate: "2006-02-09", role: "TQS", overall: 72 },
        { name: "Fotis Ioannidis", nation: "Grecia", birthDate: "2000-01-10", role: "ATT", overall: 77 },
        { name: "Luis Suárez", nation: "Colombia", birthDate: "1997-12-02", role: "ATT", overall: 76 },
        { name: "Souleymane Faye", nation: "Senegal", birthDate: "2003-02-08", role: "ATT", overall: 68 },
      ],
    },
    {
      // La quarta forza, e il posto in cui un DS va a cercare l'affare: Ricardo Horta e
      // Zalazar valgono più di quanto il Braga possa chiedere.
      name: "Sporting Braga",
      prestigeTier: 3,
      players: [
        { name: "Lukáš Horníček", nation: "Rep. Ceca", birthDate: "2002-07-13", role: "POR", overall: 74 },
        { name: "Tiago Sá", nation: "Portogallo", birthDate: "1995-01-11", role: "POR", overall: 70 },
        { name: "Sikou Niakaté", nation: "Mali", birthDate: "1999-07-10", role: "DC", overall: 74 },
        { name: "Paulo Oliveira", nation: "Portogallo", birthDate: "1992-01-08", role: "DC", overall: 72 },
        { name: "Bright Arrey-Mbi", nation: "Germania", birthDate: "2003-03-26", role: "DC", secondaryRoles: ["TS"], overall: 72 },
        { name: "Adrian Leon Barišić", nation: "Bosnia ed Erzegovina", birthDate: "2001-07-19", role: "DC", overall: 71 },
        { name: "Gustaf Lagerbielke", nation: "Svezia", birthDate: "2000-04-10", role: "DC", overall: 70 },
        { name: "Víctor Gómez", nation: "Spagna", birthDate: "2000-04-01", role: "TD", secondaryRoles: ["QD"], overall: 73 },
        { name: "Yanis Da Rocha", nation: "Portogallo", birthDate: "2004-05-10", role: "TD", secondaryRoles: ["QD"], overall: 68 },
        { name: "Leonardo Lelo", nation: "Portogallo", birthDate: "2000-03-30", role: "TS", secondaryRoles: ["QS"], overall: 72 },
        { name: "Florian Grillitsch", nation: "Austria", birthDate: "1995-08-07", role: "MED", overall: 74 },
        { name: "Gabriel Moscardo", nation: "Brasile", birthDate: "2005-09-28", role: "MED", overall: 73 },
        { name: "Vitor Carvalho", nation: "Brasile", birthDate: "1997-05-27", role: "MED", overall: 73 },
        { name: "João Moutinho", nation: "Portogallo", birthDate: "1986-09-08", role: "CC", overall: 72 },
        { name: "Jean-Baptiste Gorby", nation: "Francia", birthDate: "2002-07-25", role: "CC", overall: 71 },
        { name: "Demir Ege Tıknaz", nation: "Turchia", birthDate: "2004-08-17", role: "CC", overall: 68 },
        { name: "Rodrigo Zalazar", nation: "Uruguay", birthDate: "1999-08-12", role: "TRQ", overall: 75 },
        { name: "Ricardo Horta", nation: "Portogallo", birthDate: "1994-09-15", role: "TQS", secondaryRoles: ["ES"], overall: 77 },
        { name: "Mario Dorgeles", nation: "Costa d'Avorio", birthDate: "2004-08-07", role: "TQD", overall: 73 },
        { name: "Gabri Martínez", nation: "Spagna", birthDate: "2003-01-22", role: "TQD", overall: 72 },
        { name: "Samy Merheg", nation: "Libano", birthDate: "2006-12-06", role: "TQS", overall: 66 },
        { name: "Fran Navarro", nation: "Spagna", birthDate: "1998-02-03", role: "ATT", overall: 73 },
        { name: "Pau Víctor", nation: "Spagna", birthDate: "2001-11-26", role: "ATT", overall: 72 },
        { name: "Amine El Ouazzani", nation: "Marocco", birthDate: "2001-07-15", role: "ATT", overall: 71 },
      ],
    },
  ],
};
