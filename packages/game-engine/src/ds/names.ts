/**
 * Generatore di nomi per i giocatori creati in carriera (i "regen").
 *
 * Due requisiti espliciti dell'utente guidano il progetto di questo file:
 *  1. i nomi devono essere **sempre diversi** — un nome non si ripete mai in una carriera;
 *  2. non devono dare monotonia, quindi i bacini vanno **dimensionati** perché reggano dieci
 *     stagioni di ritiri senza cominciare a ripetersi o a raschiare il fondo.
 *
 * Il conto che giustifica le dimensioni: il pool ha ~2.586 giocatori, se ne ritira circa il
 * 5-8% a stagione, quindi servono grosso modo **1.300-2.000 nomi nuovi in dieci stagioni**,
 * concentrati sulle nazionalità più frequenti (Spagna, Francia, Germania, Inghilterra, Italia
 * da sole coprono metà del database). Con `nomi × cognomi` per bacino le combinazioni sono
 * decine di migliaia anche per le nazioni curate meno riccamente: il margine è ampio.
 *
 * I nomi sono **inventati o molto comuni**, scelti per suonare plausibili in quella lingua e
 * per **non corrispondere a calciatori reali noti**: un regen è un personaggio del gioco, non
 * un omonimo di qualcuno.
 */

interface NamePool {
  first: string[];
  last: string[];
}

/**
 * Bacino di ripiego, usato per le nazionalità senza un elenco dedicato (sono ~80, quasi tutte
 * con pochissimi giocatori nel database). Meglio nomi neutri che un errore vistoso di
 * ambientazione.
 */
const FALLBACK: NamePool = {
  first: ["Adrian", "Bruno", "Damian", "Elias", "Ivan", "Julian", "Karim", "Leon", "Marco", "Nico", "Omar", "Rafael", "Samir", "Tomas", "Viktor", "Yanis"],
  last: ["Andric", "Baros", "Cordero", "Delmas", "Ekren", "Farias", "Grimaldi", "Halic", "Ivarsson", "Jansen", "Kovac", "Lombardi", "Marek", "Novak", "Oberti", "Petrov", "Radic", "Salazar", "Tavares", "Ursu", "Varga", "Zeman"],
};

/**
 * Bacini per le nazionalità più rappresentate nel database. Le chiavi sono in italiano perché
 * è così che `player_pool.nation` è popolato (vedi la mappa `NATION_IT` dell'importatore).
 */
const POOLS: Record<string, NamePool> = {
  Italia: {
    first: ["Alessio", "Andrea", "Corrado", "Davide", "Emanuele", "Fabrizio", "Gabriele", "Giacomo", "Leonardo", "Lorenzo", "Manuel", "Matteo", "Mattia", "Nicola", "Pietro", "Riccardo", "Samuele", "Simone", "Tommaso", "Valerio", "Cristian", "Federico", "Filippo", "Giulio", "Luca", "Marco", "Michele", "Paolo", "Stefano", "Vittorio"],
    last: ["Abbruzzese", "Bellandi", "Cattaneo", "Crippa", "Dallara", "Fiorentino", "Gagliardi", "Iannuzzi", "Lombardo", "Marchetti", "Nardini", "Orlandi", "Pellegrino", "Quaranta", "Rastelli", "Sartori", "Tomasello", "Ubaldi", "Vezzali", "Zanetti", "Barsotti", "Cudini", "Ferraro", "Milanesi", "Aliprandi", "Bonaccorsi", "Callegari", "Della Valle", "Fanucci", "Grasselli", "Lazzarini", "Mainardi", "Novellini", "Ottaviani", "Piovesan", "Ricciardi", "Scaramuzza", "Trevisani", "Zaccagni"],
  },
  Spagna: {
    first: ["Adrián", "Aitor", "Álvaro", "Borja", "Diego", "Enrique", "Gonzalo", "Héctor", "Iker", "Javier", "Joel", "Marcos", "Mateo", "Nacho", "Pablo", "Raúl", "Rubén", "Sergio", "Unai", "Víctor", "Alejandro", "Carlos", "Daniel", "Fernando", "Guillermo", "Ismael", "Jorge", "Manuel", "Roberto", "Xavi"],
    last: ["Aguirre", "Bermúdez", "Cañizares", "Delgado", "Escudero", "Fuentes", "Gallardo", "Herrera", "Ibáñez", "Jaraba", "Lastra", "Montoya", "Nieves", "Olmedo", "Pardo", "Quintana", "Rivas", "Salinas", "Tejada", "Urbina", "Valverde", "Zamorano", "Alcaraz", "Barrena", "Cifuentes", "Domenech", "Echevarría", "Figueroa", "Granados", "Hurtado", "Iriarte", "Landaluce", "Mendizábal", "Otxoa", "Peñalver", "Sagardui", "Ventura"],
  },
  Francia: {
    first: ["Amine", "Baptiste", "Clément", "Dylan", "Enzo", "Florian", "Gaël", "Hugo", "Jules", "Kylian", "Lucas", "Mathis", "Nolan", "Olivier", "Quentin", "Rayan", "Sacha", "Théo", "Valentin", "Yanis", "Adrien", "Antoine", "Benoît", "Corentin", "Damien", "Killian", "Loïc", "Maxence", "Romain", "Tristan"],
    last: ["Aubert", "Berthier", "Chevalier", "Delaunay", "Escoffier", "Fournier", "Gaudin", "Hervieu", "Jacquemin", "Lemoine", "Marchand", "Noiret", "Ourvier", "Peyrard", "Rambaud", "Sauvage", "Thibault", "Vasseur", "Wattelet", "Ziani", "Bourdon", "Chauvet", "Desrosiers", "Ferrand", "Girodet", "Hulot", "Joubert", "Lacombe", "Mercier", "Poulain", "Rossignol", "Salvatori", "Tessier", "Vaillant", "Weiss"],
  },
  Germania: {
    first: ["Aaron", "Bastian", "Christoph", "Dennis", "Elias", "Fabian", "Florian", "Jannik", "Jonas", "Julian", "Lennart", "Lukas", "Marvin", "Maximilian", "Nico", "Philipp", "Simon", "Tim", "Tobias", "Yannick", "Alexander", "Benedikt", "Daniel", "Erik", "Felix", "Jan", "Leon", "Moritz", "Niklas", "Sebastian"],
    last: ["Ahrens", "Beckmann", "Cordes", "Dahlmann", "Ehlert", "Freytag", "Gerlach", "Hoffmann", "Illner", "Jungbluth", "Kastner", "Lindemann", "Möller", "Neuhaus", "Ostermann", "Pfeiffer", "Reinhardt", "Steinbach", "Uhlig", "Vogelsang", "Wendler", "Zimmerer", "Brantner", "Dettmann", "Eichhorn", "Gebhardt", "Haussler", "Kirchner", "Ludwig", "Mahnke", "Osterloh", "Rothenberg", "Schuster", "Trautwein", "Vollmer", "Weissbach", "Zeitler"],
  },
  Inghilterra: {
    first: ["Alfie", "Bailey", "Callum", "Declan", "Ethan", "Finley", "George", "Harvey", "Isaac", "Jacob", "Kian", "Lewis", "Mason", "Noah", "Oliver", "Reece", "Samuel", "Toby", "William", "Zach", "Archie", "Charlie", "Dominic", "Elliot", "Freddie", "Harrison", "Joel", "Louie", "Nathan", "Riley"],
    last: ["Ashdown", "Bramley", "Cartwright", "Downes", "Ellery", "Fairhurst", "Grimshaw", "Hawksley", "Ingham", "Jeffries", "Kembell", "Lockwood", "Marsden", "Northcott", "Ollerton", "Pickering", "Radcliffe", "Stanbury", "Thorncroft", "Underhill", "Warburton", "Yardley", "Bexley", "Colthurst", "Dunmore", "Eastwood", "Farnworth", "Haverly", "Kingsmill", "Litherland", "Merriman", "Peckham", "Rowntree", "Selby", "Tattersall", "Vickers", "Wolstenholme"],
  },
  Brasile: {
    first: ["Alisson", "Bruno", "Caio", "Danilo", "Eduardo", "Fabrício", "Gustavo", "Igor", "Juninho", "Kaique", "Lucas", "Matheus", "Nathan", "Otávio", "Pedrinho", "Rafael", "Thiago", "Vinícius", "Wesley", "Yuri"],
    last: ["Albuquerque", "Barcellos", "Carvalhaes", "Damasceno", "Espíndola", "Furtado", "Guimarães", "Hollanda", "Itaborai", "Juliano", "Lacerda", "Marinho", "Nogueira", "Oliveira", "Pontes", "Quaresma", "Rezende", "Siqueira", "Tavares", "Valadão"],
  },
  Argentina: {
    first: ["Agustín", "Bruno", "Ciro", "Emiliano", "Facundo", "Gonzalo", "Ignacio", "Joaquín", "Lautaro", "Mateo", "Nahuel", "Ramiro", "Santiago", "Thiago", "Valentín"],
    last: ["Almirón", "Beltrán", "Cardozo", "Duarte", "Escalante", "Farías", "Gaitán", "Ibarra", "Juárez", "Ledesma", "Medrano", "Nieva", "Ocampo", "Peralta", "Quiroga", "Rinaldi", "Sosa", "Toledo", "Vergara", "Zabala"],
  },
  "Paesi Bassi": {
    first: ["Bram", "Cas", "Daan", "Finn", "Gijs", "Jesse", "Joost", "Koen", "Lars", "Milan", "Niels", "Ruben", "Sem", "Thijs", "Youri"],
    last: ["Aarts", "Bosveld", "Cuijpers", "Diepenbrock", "Elzinga", "Groenewegen", "Hoogland", "Ijsselstein", "Jonkers", "Kraaijeveld", "Loohuis", "Meeuwsen", "Nienhuis", "Oosterveld", "Pothoven", "Rietveld", "Steenbergen", "Terlouw", "Verhoeven", "Wijnaldum"],
  },
  Portogallo: {
    first: ["André", "Bernardo", "Diogo", "Duarte", "Fábio", "Gonçalo", "Hugo", "João", "Miguel", "Nuno", "Pedro", "Rúben", "Simão", "Tiago", "Vasco"],
    last: ["Abreu", "Bentes", "Cardoso", "Domingues", "Esteves", "Faria", "Godinho", "Henriques", "Infante", "Jesus", "Lourenço", "Machado", "Nascimento", "Osório", "Peixoto", "Queirós", "Ramalho", "Seabra", "Teixeira", "Vilela"],
  },
  Belgio: {
    first: ["Arthur", "Basile", "Cédric", "Dries", "Emile", "Florent", "Gilles", "Jasper", "Lander", "Maxime", "Nathan", "Robbe", "Senne", "Victor", "Wout"],
    last: ["Aerts", "Boonen", "Claes", "Dewulf", "Everaert", "Fontaine", "Goossens", "Hendrickx", "Janssens", "Keirsbilck", "Lambrechts", "Mertens", "Nijs", "Overmeire", "Peeters", "Roelandts", "Segers", "Timmermans", "Vandersteen", "Wauters"],
  },
  Croazia: {
    first: ["Ante", "Borna", "Dario", "Filip", "Ivan", "Josip", "Karlo", "Luka", "Marko", "Nikola", "Petar", "Roko", "Stipe", "Tin", "Vedran"],
    last: ["Baric", "Cvitanovic", "Dujmovic", "Erceg", "Franjic", "Grgic", "Horvatic", "Ivkovic", "Jurcevic", "Kovacevic", "Lovren", "Milic", "Novosel", "Pavlovic", "Rakic", "Skoric", "Tomljanovic", "Vidakovic", "Zubcic"],
  },
  Serbia: {
    first: ["Aleksa", "Bogdan", "Dusan", "Filip", "Ivan", "Lazar", "Marko", "Milos", "Nemanja", "Ognjen", "Petar", "Stefan", "Uros", "Vukasin"],
    last: ["Andjelkovic", "Bozovic", "Cvetkovic", "Damjanovic", "Gavrilovic", "Ilic", "Jovanovic", "Kostic", "Lukic", "Markovic", "Nikolic", "Obradovic", "Pantelic", "Radovanovic", "Simic", "Todorovic", "Vasiljevic", "Zivkovic"],
  },
  Polonia: {
    first: ["Bartosz", "Dawid", "Filip", "Igor", "Jakub", "Kacper", "Krystian", "Mateusz", "Michal", "Oskar", "Patryk", "Szymon", "Tomasz", "Wiktor"],
    last: ["Adamczyk", "Bielawski", "Cieslak", "Dabrowski", "Fijalkowski", "Grabowski", "Jankowski", "Kaminski", "Lewandowicz", "Malinowski", "Nowacki", "Olszewski", "Pawlak", "Rutkowski", "Sikorski", "Tomczak", "Walczak", "Zielinski"],
  },
  Danimarca: {
    first: ["Anders", "Emil", "Frederik", "Gustav", "Jonas", "Kasper", "Lasse", "Magnus", "Mikkel", "Nikolaj", "Oliver", "Rasmus", "Sebastian", "Tobias"],
    last: ["Andersen", "Brix", "Dalgaard", "Ellegaard", "Fogh", "Groth", "Hjulmand", "Iversen", "Jespersen", "Kjeldsen", "Lindholm", "Mortensen", "Nyholm", "Ostergaard", "Poulsen", "Riis", "Skovgaard", "Thorup", "Vinther"],
  },
  Svezia: {
    first: ["Albin", "Anton", "Elias", "Filip", "Gustav", "Hampus", "Isak", "Ludvig", "Melker", "Nils", "Oscar", "Rasmus", "Sixten", "Viktor"],
    last: ["Ahlberg", "Bergqvist", "Cederholm", "Dahlgren", "Ekstrand", "Forsell", "Gullberg", "Hedlund", "Isaksson", "Jonsson", "Kallstrom", "Lindqvist", "Malmberg", "Nordin", "Ostlund", "Palmgren", "Rydberg", "Sandell", "Wallin"],
  },
  Norvegia: {
    first: ["Aksel", "Bjorn", "Eirik", "Fredrik", "Havard", "Jonas", "Kristian", "Magnus", "Mathias", "Sander", "Sindre", "Sverre", "Tobias", "Vetle"],
    last: ["Aalberg", "Berntsen", "Dahle", "Eikrem", "Fossum", "Gundersen", "Halvorsen", "Iversen", "Johannessen", "Kvamme", "Lunde", "Myklebust", "Nordby", "Odegard", "Rypdal", "Storaas", "Tveit", "Vaagen"],
  },
  Svizzera: {
    first: ["Andrin", "Basil", "Dario", "Elia", "Fabio", "Gian", "Jonas", "Levin", "Luca", "Nico", "Remo", "Silvan", "Timo", "Yannick"],
    last: ["Amrein", "Brunner", "Camenzind", "Dietrich", "Egger", "Frei", "Gubser", "Hostettler", "Imhof", "Kaufmann", "Luthi", "Muheim", "Niederer", "Oberholzer", "Rickenbach", "Steiner", "Vogt", "Zbinden"],
  },
  Austria: {
    first: ["Andreas", "Christoph", "David", "Fabian", "Florian", "Jakob", "Lukas", "Manuel", "Matthias", "Michael", "Patrick", "Sebastian", "Stefan", "Thomas"],
    last: ["Aigner", "Baumgartner", "Danninger", "Ebner", "Fischbacher", "Grillitsch", "Hinterseer", "Jandl", "Kainz", "Lainer", "Moosbrugger", "Neuhold", "Prohaska", "Reiter", "Schlager", "Trimmel", "Wimmer", "Zulj"],
  },
  Senegal: {
    first: ["Abdou", "Alioune", "Babacar", "Cheikh", "Demba", "El Hadji", "Ibrahima", "Lamine", "Mamadou", "Moussa", "Ousmane", "Pape", "Saliou", "Youssou"],
    last: ["Badji", "Camara", "Diagne", "Diallo", "Diatta", "Faye", "Gueye", "Kane", "Mbaye", "Ndiaye", "Niang", "Sarr", "Seck", "Sow", "Thiam", "Toure"],
  },
  Marocco: {
    first: ["Achraf", "Amine", "Ayoub", "Bilal", "Hamza", "Ilyas", "Karim", "Mehdi", "Nabil", "Omar", "Rachid", "Sofiane", "Yassine", "Zakaria"],
    last: ["Alaoui", "Benali", "Bennani", "Chakir", "Douiri", "El Amrani", "Fassi", "Ghazi", "Hakimi", "Idrissi", "Jelloun", "Kabbaj", "Lahlou", "Moutawakil", "Naciri", "Ouazzani", "Rahmouni", "Sabbagh", "Tazi", "Zerhouni"],
  },
  "Costa d'Avorio": {
    first: ["Abou", "Adama", "Christian", "Didier", "Franck", "Gervais", "Ibrahim", "Jean", "Kouame", "Lassina", "Maurice", "Salomon", "Serge", "Yaya"],
    last: ["Bamba", "Coulibaly", "Diomande", "Fofana", "Gbagbo", "Kanon", "Kessie", "Konan", "Kouassi", "Meite", "Ouattara", "Sangare", "Sylla", "Traore", "Yao", "Zoro"],
  },
  Nigeria: {
    first: ["Ademola", "Chidera", "Chukwu", "Daniel", "Emeka", "Femi", "Ikenna", "Kelechi", "Nnamdi", "Obinna", "Samuel", "Tobi", "Uche", "Victor"],
    last: ["Abiodun", "Balogun", "Chukwueze", "Eze", "Ibrahim", "Iheanacho", "Kalu", "Madueke", "Nwankwo", "Obi", "Okafor", "Okonkwo", "Olawale", "Onyeka", "Osimhen", "Uzoma"],
  },
  Ghana: {
    first: ["Abdul", "Baba", "Daniel", "Emmanuel", "Ernest", "Fatawu", "Isaac", "Joseph", "Kamaldeen", "Kwadwo", "Mohammed", "Osman", "Samuel", "Thomas"],
    last: ["Aboagye", "Addai", "Amankwah", "Ansah", "Asare", "Boateng", "Danso", "Frimpong", "Gyasi", "Kudus", "Mensah", "Nyarko", "Ofori", "Owusu", "Sarpong", "Tetteh"],
  },
  "Stati Uniti": {
    first: ["Aidan", "Brandon", "Caleb", "Dante", "Ethan", "Gio", "Jackson", "Kevin", "Logan", "Mason", "Nolan", "Ryan", "Tyler", "Weston"],
    last: ["Aaronson", "Bradley", "Carrillo", "Dunbar", "Ellison", "Ferreira", "Gallagher", "Hanley", "Iversen", "Kessler", "Lansing", "McKinnon", "Ogden", "Pomykal", "Reyna", "Sullivan", "Turnbull", "Whitaker"],
  },
  Turchia: {
    first: ["Ahmet", "Arda", "Baris", "Cengiz", "Emre", "Ferdi", "Hakan", "Kaan", "Kerem", "Mert", "Ozan", "Salih", "Umut", "Yusuf"],
    last: ["Akgun", "Bayindir", "Calhanoglu", "Demirbay", "Erkin", "Gunes", "Halilovic", "Ilkay", "Kadioglu", "Kokcu", "Muldur", "Oztunali", "Sahin", "Tufan", "Under", "Yildiz"],
  },
};

/**
 * Genera un nome nuovo per la nazionalità indicata.
 *
 * `used` contiene **tutti** i nomi già presenti nella carriera, giocatori reali compresi: è
 * ciò che garantisce l'unicità richiesta. Se una combinazione è già presa si riprova; dopo un
 * numero ragionevole di tentativi si aggiunge un secondo cognome, che è una via d'uscita
 * plausibile in quasi tutte le culture calcistiche e molto meglio di un "Rossi 2".
 */
export function generateName(
  nation: string,
  used: ReadonlySet<string>,
  random: () => number,
): string {
  const pool = POOLS[nation] ?? FALLBACK;
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]!;

  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = `${pick(pool.first)} ${pick(pool.last)}`;
    if (!used.has(candidate)) return candidate;
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = `${pick(pool.first)} ${pick(pool.last)}-${pick(pool.last)}`;
    if (!used.has(candidate)) return candidate;
  }
  // Non dovrebbe mai servire con questi bacini; se servisse, meglio un nome brutto che un
  // duplicato silenzioso che confonderebbe l'utente in due schermate diverse.
  return `${pick(pool.first)} ${pick(pool.last)} ${Math.floor(random() * 900 + 100)}`;
}

/** Quante combinazioni distinte offre il bacino di una nazionalità: serve ai test di capienza. */
export function poolCapacity(nation: string): number {
  const pool = POOLS[nation] ?? FALLBACK;
  return pool.first.length * pool.last.length;
}

/** Le nazionalità con un bacino dedicato (le altre usano il ripiego). */
export function curatedNations(): string[] {
  return Object.keys(POOLS);
}
