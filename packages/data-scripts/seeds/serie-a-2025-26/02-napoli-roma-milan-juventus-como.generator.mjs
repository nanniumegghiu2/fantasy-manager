// Batch 2: Napoli, Roma, Milan, Juventus, Como — Serie A 2025/26.
// Rose reali (Wikipedia). Statistiche: verificate dove trovate via ricerca, stima dichiarata
// per il resto (apps/goals/assists per tier di ruolo: titolare/rotazione/riserva).
import { writeFileSync } from "fs";

function P(name, dept, nation, tier, overrides = {}) {
  const base = {
    starter: { apps: 28, goals: { POR: 0, DIF: 1, CC: 2, ATT: 5 }[dept], assists: { POR: 0, DIF: 1, CC: 3, ATT: 3 }[dept], caps: 10 },
    rotation: { apps: 15, goals: { POR: 0, DIF: 0, CC: 1, ATT: 3 }[dept], assists: { POR: 0, DIF: 1, CC: 1, ATT: 1 }[dept], caps: 3 },
    fringe: { apps: 4, goals: 0, assists: 0, caps: 0 },
  }[tier];
  return { name, dept, nation, apps: base.apps, goals: base.goals, assists: base.assists, caps: base.caps, ...overrides };
}

const clubs = [
  {
    club: "Napoli", era: "2025/26", clubPrestige: 4, trophies: 1, // Supercoppa Italiana
    players: [
      P("Alex Meret", "POR", "Italia", "starter", { caps: 5 }),
      P("Nikita Contini", "POR", "Italia", "fringe"),
      P("Vanja Milinković-Savić", "POR", "Serbia", "rotation", { caps: 10 }),
      P("Giovanni Di Lorenzo", "DIF", "Italia", "starter", { caps: 40 }),
      P("Alessandro Buongiorno", "DIF", "Italia", "starter", { caps: 15 }),
      P("Juan Jesus", "DIF", "Brasile", "rotation"),
      P("Amir Rrahmani", "DIF", "Kosovo", "starter", { caps: 50 }),
      P("Miguel Gutiérrez", "DIF", "Spagna", "starter"),
      P("Mathías Olivera", "DIF", "Uruguay", "rotation", { caps: 30 }),
      P("Pasquale Mazzocchi", "DIF", "Italia", "rotation"),
      P("Sam Beukema", "DIF", "Paesi Bassi", "starter", { caps: 10 }),
      P("Leonardo Spinazzola", "DIF", "Italia", "rotation", { caps: 30 }),
      P("Stanislav Lobotka", "CC", "Slovacchia", "starter", { caps: 40 }),
      P("Billy Gilmour", "CC", "Scozia", "rotation", { caps: 20 }),
      P("Scott McTominay", "CC", "Scozia", "starter", { goals: 8, caps: 40 }),
      P("André-Frank Zambo Anguissa", "CC", "Camerun", "starter", { caps: 60 }),
      P("Eljif Elmas", "CC", "Macedonia del Nord", "rotation", { caps: 50 }),
      P("Antonio Vergara", "CC", "Italia", "fringe"),
      P("Kevin De Bruyne", "ATT", "Belgio", "starter", { goals: 8, assists: 12, caps: 100 }),
      P("Romelu Lukaku", "ATT", "Belgio", "starter", { apps: 20, goals: 8, caps: 110 }),
      P("Rasmus Højlund", "ATT", "Danimarca", "starter", { apps: 30, goals: 12, assists: 4, caps: 20 }),
      P("David Neres", "ATT", "Brasile", "rotation", { apps: 20, goals: 4, assists: 5 }),
      P("Matteo Politano", "ATT", "Italia", "starter", { apps: 25, goals: 5, assists: 6, caps: 5 }),
      P("Giovane", "ATT", "Brasile", "fringe"),
      P("Alisson Santos", "ATT", "Brasile", "fringe"),
    ],
  },
  {
    club: "Roma", era: "2025/26", clubPrestige: 4, trophies: 0,
    players: [
      P("Mile Svilar", "POR", "Serbia", "starter", { apps: 33, caps: 5 }),
      P("Pierluigi Gollini", "POR", "Italia", "fringe"),
      P("Radosław Żelezny", "POR", "Polonia", "fringe"),
      P("Devyne Rensch", "DIF", "Paesi Bassi", "starter", { caps: 5 }),
      P("Angeliño", "DIF", "Spagna", "starter", { caps: 5 }),
      P("Evan Ndicka", "DIF", "Costa d'Avorio", "starter", { caps: 30 }),
      P("Kostas Tsimikas", "DIF", "Grecia", "rotation", { caps: 40 }),
      P("Zeki Çelik", "DIF", "Turchia", "rotation", { caps: 30 }),
      P("Mario Hermoso", "DIF", "Spagna", "starter", { caps: 15 }),
      P("Gianluca Mancini", "DIF", "Italia", "starter", { caps: 5 }),
      P("Jan Ziółkowski", "DIF", "Polonia", "fringe"),
      P("Wesley", "DIF", "Brasile", "rotation"),
      P("Daniele Ghilardi", "DIF", "Italia", "rotation"),
      P("Bryan Cristante", "CC", "Italia", "starter", { caps: 10 }),
      P("Lorenzo Pellegrini", "CC", "Italia", "starter", { goals: 5, assists: 5, caps: 30 }),
      P("Neil El Aynaoui", "CC", "Marocco", "starter", { goals: 3, assists: 3, caps: 15 }),
      P("Manu Koné", "CC", "Francia", "starter", { caps: 10 }),
      P("Niccolò Pisilli", "CC", "Italia", "rotation", { goals: 2 }),
      P("Artem Dovbyk", "ATT", "Ucraina", "starter", { goals: 10, caps: 30 }),
      P("Evan Ferguson", "ATT", "Irlanda", "rotation", { apps: 15, goals: 4, caps: 15 }),
      P("Donyell Malen", "ATT", "Paesi Bassi", "starter", { apps: 30, goals: 14, assists: 6, caps: 10 }),
      P("Matías Soulé", "ATT", "Argentina", "starter", { goals: 6, assists: 4, caps: 15 }),
      P("Paulo Dybala", "ATT", "Argentina", "rotation", { apps: 18, goals: 7, assists: 5, caps: 35 }),
      P("Stephan El Shaarawy", "ATT", "Italia", "rotation", { goals: 2, caps: 40 }),
      P("Antonio Arena", "ATT", "Italia", "fringe"),
      P("Robinio Vaz", "ATT", "Francia", "fringe"),
      P("Lorenzo Venturino", "ATT", "Italia", "fringe"),
      P("Bryan Zaragoza", "ATT", "Spagna", "fringe"),
    ],
  },
  {
    club: "Milan", era: "2025/26", clubPrestige: 5, trophies: 0,
    players: [
      P("Pietro Terracciano", "POR", "Italia", "fringe"),
      P("Mike Maignan", "POR", "Francia", "starter", { apps: 32, caps: 35 }),
      P("Lorenzo Torriani", "POR", "Italia", "fringe"),
      P("Pervis Estupiñán", "DIF", "Ecuador", "rotation", { apps: 22, caps: 30 }),
      P("Koni De Winter", "DIF", "Belgio", "starter", { caps: 10 }),
      P("Fikayo Tomori", "DIF", "Inghilterra", "starter", { caps: 5 }),
      P("Zachary Athekame", "DIF", "Svizzera", "rotation"),
      P("David Odogu", "DIF", "Germania", "fringe"),
      P("Strahinja Pavlović", "DIF", "Serbia", "rotation", { caps: 10 }),
      P("Davide Bartesaghi", "DIF", "Italia", "fringe"),
      P("Matteo Gabbia", "DIF", "Italia", "starter", { caps: 5 }),
      P("Samuele Ricci", "CC", "Italia", "starter", { apps: 34, caps: 10 }),
      P("Ruben Loftus-Cheek", "CC", "Inghilterra", "starter", { caps: 15 }),
      P("Christian Pulisic", "CC", "Stati Uniti", "starter", { goals: 10, assists: 6, caps: 70 }),
      P("Adrien Rabiot", "CC", "Francia", "starter", { caps: 60 }),
      P("Luka Modrić", "CC", "Croazia", "rotation", { apps: 37, goals: 2, assists: 4, caps: 180 }),
      P("Youssouf Fofana", "CC", "Francia", "starter", { caps: 5 }),
      P("Ardon Jashari", "CC", "Svizzera", "rotation", { caps: 10 }),
      P("Alexis Saelemaekers", "CC", "Belgio", "rotation", { goals: 3, assists: 3, caps: 15 }),
      P("Santiago Giménez", "ATT", "Messico", "starter", { apps: 37, goals: 7, caps: 30 }),
      P("Niclas Füllkrug", "ATT", "Germania", "rotation", { goals: 4, caps: 15 }),
      P("Rafael Leão", "ATT", "Portogallo", "starter", { goals: 9, assists: 5, caps: 30 }),
      P("Christopher Nkunku", "ATT", "Francia", "starter", { goals: 6, assists: 4, caps: 5 }),
    ],
  },
  {
    club: "Juventus", era: "2025/26", clubPrestige: 5, trophies: 0,
    players: [
      P("Mattia Perin", "POR", "Italia", "rotation"),
      P("Michele Di Gregorio", "POR", "Italia", "starter", { caps: 5 }),
      P("Carlo Pinsoglio", "POR", "Italia", "fringe"),
      P("Emil Holm", "DIF", "Svezia", "rotation", { caps: 5 }),
      P("Bremer", "DIF", "Brasile", "starter", { caps: 5 }),
      P("Federico Gatti", "DIF", "Italia", "starter", { caps: 5 }),
      P("Lloyd Kelly", "DIF", "Inghilterra", "rotation"),
      P("Pierre Kalulu", "DIF", "Francia", "starter", { caps: 5 }),
      P("Juan Cabal", "DIF", "Colombia", "rotation"),
      P("Manuel Locatelli", "CC", "Italia", "starter", { caps: 30 }),
      P("Teun Koopmeiners", "CC", "Paesi Bassi", "starter", { goals: 3, assists: 3, caps: 30 }),
      P("Vasilije Adžić", "CC", "Montenegro", "fringe"),
      P("Filip Kostić", "CC", "Serbia", "rotation", { assists: 4, caps: 60 }),
      P("Khéphren Thuram", "CC", "Francia", "starter", { goals: 3, caps: 10 }),
      P("Fabio Miretti", "CC", "Italia", "rotation"),
      P("Weston McKennie", "CC", "Stati Uniti", "starter", { goals: 4, assists: 3, caps: 70 }),
      P("Andrea Cambiaso", "CC", "Italia", "starter", { assists: 4, caps: 10 }),
      P("Kenan Yıldız", "CC", "Turchia", "starter", { goals: 10, assists: 4, caps: 15 }),
      P("Francisco Conceição", "ATT", "Portogallo", "starter", { goals: 5, assists: 5, caps: 10 }),
      P("Dušan Vlahović", "ATT", "Serbia", "starter", { goals: 9, caps: 40 }),
      P("Edon Zhegrova", "ATT", "Kosovo", "rotation", { goals: 3, assists: 3, caps: 15 }),
      P("Jérémie Boga", "ATT", "Costa d'Avorio", "fringe"),
      P("Arkadiusz Milik", "ATT", "Polonia", "fringe", { caps: 60 }),
      P("Loïs Openda", "ATT", "Belgio", "starter", { goals: 6, caps: 15 }),
      P("Jonathan David", "ATT", "Canada", "rotation", { goals: 4, caps: 60 }),
    ],
  },
  {
    club: "Como", era: "2025/26", clubPrestige: 2, trophies: 0,
    players: [
      P("Jean Butez", "POR", "Belgio", "starter"),
      P("Henrique Menke", "POR", "Brasile", "fringe"),
      P("Noel Törnqvist", "POR", "Svezia", "fringe"),
      P("Mauro Vigorito", "POR", "Italia", "fringe"),
      P("Nikola Čavlina", "POR", "Croazia", "fringe"),
      P("Marc-Oliver Kempf", "DIF", "Germania", "starter"),
      P("Álex Valle", "DIF", "Spagna", "rotation"),
      P("Edoardo Goldaniga", "DIF", "Italia", "rotation"),
      P("Jacobo Ramón", "DIF", "Spagna", "fringe"),
      P("Alberto Moreno", "DIF", "Spagna", "rotation", { caps: 15 }),
      P("Ivan Smolčić", "DIF", "Croazia", "fringe"),
      P("Mërgim Vojvoda", "DIF", "Kosovo", "starter", { caps: 20 }),
      P("Diego Carlos", "DIF", "Brasile", "rotation", { caps: 15 }),
      P("Ignace Van Der Brempt", "DIF", "Belgio", "rotation"),
      P("Maxence Caqueret", "CC", "Francia", "starter"),
      P("Sergi Roberto", "CC", "Spagna", "rotation", { caps: 10 }),
      P("Nico Paz", "CC", "Argentina", "starter", { goals: 6, assists: 6, caps: 5 }),
      P("Adrian Lahdo", "CC", "Svezia", "fringe"),
      P("Martin Baturina", "CC", "Croazia", "starter", { goals: 4, assists: 4, caps: 5 }),
      P("Máximo Perrone", "CC", "Argentina", "rotation"),
      P("Lucas Da Cunha", "CC", "Francia", "rotation"),
      P("Álvaro Morata", "ATT", "Spagna", "starter", { goals: 6, caps: 45 }),
      P("Anastasios Douvikas", "ATT", "Grecia", "starter", { apps: 32, goals: 14, assists: 3, caps: 10 }),
      P("Jesús Rodríguez", "ATT", "Spagna", "rotation"),
      P("Nicolas Kühn", "ATT", "Germania", "rotation", { goals: 3, assists: 2 }),
      P("Assane Diao", "ATT", "Senegal", "rotation", { goals: 2 }),
      P("Jayden Addai", "ATT", "Paesi Bassi", "fringe"),
    ],
  },
];

function esc(s) { return s.replace(/'/g, "''"); }

let sql = "-- Batch 2: Napoli, Roma, Milan, Juventus, Como (Serie A 2025/26)\n";
for (const c of clubs) {
  sql += `insert into clubs (name, league_id, era, prestige_tier) select '${esc(c.club)}', id, '${c.era}', ${c.clubPrestige} from leagues where name = 'Serie A';\n`;
  for (const p of c.players) {
    sql += `insert into player_pool (name, department, club_id, nation, market_value, appearances, goals, assists, trophies, caps, overall) select '${esc(p.name)}', '${p.dept}', cl.id, '${esc(p.nation)}', 1000000, ${p.apps}, ${p.goals}, ${p.assists}, ${c.trophies}, ${p.caps}, 70 from clubs cl where cl.name = '${esc(c.club)}' and cl.era = '${c.era}';\n`;
  }
}

writeFileSync("C:\\Users\\Giovanni\\AppData\\Local\\Temp\\claude\\c--Users-Giovanni-Desktop-Manager-League\\fe78feab-82e2-43b1-9c25-babd508eab4f\\scratchpad\\seed-batch2.sql", sql);

const totalPlayers = clubs.reduce((sum, c) => sum + c.players.length, 0);
console.log(`Generato SQL per ${clubs.length} club, ${totalPlayers} giocatori.`);
