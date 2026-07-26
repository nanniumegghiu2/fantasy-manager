// Demo: Serie A + Inter (2025/26), dati reali verificati + stime dichiarate.
// Genera un file SQL da eseguire con supabase db query -f.

const NATION_PRESTIGE = {
  Italia: 5, Francia: 5, Argentina: 5, Spagna: 5, Germania: 5,
  "Paesi Bassi": 4, Croazia: 4,
  Svizzera: 3, Polonia: 3, Turchia: 3, Armenia: 3, "Costa d'Avorio": 3, Brasile: 5,
};

function nationTier(n) { return NATION_PRESTIGE[n] ?? 3; }

// confidence: "verificato" = statistiche trovate via ricerca reale; "stima" = stima dichiarata
const players = [
  // Portieri
  { name: "Yann Sommer", dept: "POR", nation: "Svizzera", era: "2025/26", apps: 28, goals: 0, assists: 0, caps: 95, confidence: "stima (caps noto, presenze stimate)" },
  { name: "Raffaele Di Gennaro", dept: "POR", nation: "Italia", era: "2025/26", apps: 2, goals: 0, assists: 0, caps: 0, confidence: "stima" },
  { name: "Josep Martínez", dept: "POR", nation: "Spagna", era: "2025/26", apps: 8, goals: 0, assists: 0, caps: 0, confidence: "stima" },
  // Difensori
  { name: "Denzel Dumfries", dept: "DIF", nation: "Paesi Bassi", era: "2025/26", apps: 30, goals: 4, assists: 5, caps: 50, confidence: "stima" },
  { name: "Stefan de Vrij", dept: "DIF", nation: "Paesi Bassi", era: "2025/26", apps: 15, goals: 1, assists: 0, caps: 40, confidence: "stima" },
  { name: "Francesco Acerbi", dept: "DIF", nation: "Italia", era: "2025/26", apps: 20, goals: 1, assists: 0, caps: 10, confidence: "stima" },
  { name: "Manuel Akanji", dept: "DIF", nation: "Svizzera", era: "2025/26", apps: 15, goals: 0, assists: 1, caps: 45, confidence: "stima" },
  { name: "Carlos Augusto", dept: "DIF", nation: "Brasile", era: "2025/26", apps: 18, goals: 1, assists: 2, caps: 0, confidence: "stima" },
  { name: "Yann Bisseck", dept: "DIF", nation: "Germania", era: "2025/26", apps: 22, goals: 1, assists: 1, caps: 0, confidence: "stima" },
  { name: "Federico Dimarco", dept: "DIF", nation: "Italia", era: "2025/26", apps: 33, goals: 6, assists: 16, caps: 15, confidence: "verificato (gol/assist/presenze)" },
  { name: "Matteo Darmian", dept: "DIF", nation: "Italia", era: "2025/26", apps: 20, goals: 1, assists: 2, caps: 10, confidence: "stima" },
  { name: "Alessandro Bastoni", dept: "DIF", nation: "Italia", era: "2025/26", apps: 30, goals: 2, assists: 2, caps: 30, confidence: "stima" },
  // Centrocampisti
  { name: "Piotr Zieliński", dept: "CC", nation: "Polonia", era: "2025/26", apps: 28, goals: 6, assists: 3, caps: 95, confidence: "verificato (gol)" },
  { name: "Petar Sučić", dept: "CC", nation: "Croazia", era: "2025/26", apps: 20, goals: 2, assists: 3, caps: 15, confidence: "stima" },
  { name: "Luis Henrique", dept: "CC", nation: "Brasile", era: "2025/26", apps: 18, goals: 2, assists: 3, caps: 0, confidence: "stima" },
  { name: "Davide Frattesi", dept: "CC", nation: "Italia", era: "2025/26", apps: 25, goals: 4, assists: 3, caps: 15, confidence: "stima" },
  { name: "Andy Diouf", dept: "CC", nation: "Francia", era: "2025/26", apps: 10, goals: 0, assists: 1, caps: 0, confidence: "stima" },
  { name: "Hakan Çalhanoğlu", dept: "CC", nation: "Turchia", era: "2025/26", apps: 30, goals: 9, assists: 5, caps: 60, confidence: "verificato (gol)" },
  { name: "Henrikh Mkhitaryan", dept: "CC", nation: "Armenia", era: "2025/26", apps: 25, goals: 3, assists: 4, caps: 100, confidence: "stima" },
  { name: "Nicolò Barella", dept: "CC", nation: "Italia", era: "2025/26", apps: 33, goals: 3, assists: 8, caps: 50, confidence: "verificato (assist/presenze)" },
  // Attaccanti
  { name: "Marcus Thuram", dept: "ATT", nation: "Francia", era: "2025/26", apps: 30, goals: 13, assists: 6, caps: 25, confidence: "verificato (gol/assist)" },
  { name: "Lautaro Martínez", dept: "ATT", nation: "Argentina", era: "2025/26", apps: 32, goals: 17, assists: 5, caps: 75, confidence: "verificato (gol)" },
  { name: "Ange-Yoan Bonny", dept: "ATT", nation: "Costa d'Avorio", era: "2025/26", apps: 22, goals: 5, assists: 2, caps: 0, confidence: "verificato (gol)" },
  { name: "Francesco Pio Esposito", dept: "ATT", nation: "Italia", era: "2025/26", apps: 33, goals: 6, assists: 2, caps: 0, confidence: "verificato (gol/presenze)" },
];

const TROPHIES = 2; // Serie A + Coppa Italia 2025/26, verificato

// --- Algoritmo Overall (replica semplificata di packages/game-engine/src/overall.ts) ---
const STAT_KEYS = ["appearances", "goals", "assists", "trophies", "caps"];
const DEPARTMENT_WEIGHTS = {
  ATT: { goals: 0.35, assists: 0.2, appearances: 0.15, trophies: 0.15, caps: 0.15 },
  CC: { goals: 0.1, assists: 0.3, appearances: 0.2, trophies: 0.2, caps: 0.2 },
  DIF: { goals: 0.05, assists: 0.1, appearances: 0.3, trophies: 0.3, caps: 0.25 },
  POR: { goals: 0, assists: 0, appearances: 0.35, trophies: 0.35, caps: 0.3 },
};

function computeOveralls(pool) {
  const stats = (p) => ({ appearances: p.apps, goals: p.goals, assists: p.assists, trophies: TROPHIES, caps: p.caps });
  const ranges = {};
  for (const key of STAT_KEYS) {
    const values = pool.map((p) => stats(p)[key]);
    ranges[key] = { min: Math.min(...values), max: Math.max(...values) };
  }
  function normalized(value, key) {
    const { min, max } = ranges[key];
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  }
  const composites = pool.map((p) => {
    const w = DEPARTMENT_WEIGHTS[p.dept];
    const s = stats(p);
    const score = STAT_KEYS.reduce((sum, k) => sum + w[k] * normalized(s[k], k), 0);
    return { p, score };
  });
  const sorted = [...composites].map((c) => c.score).sort((a, b) => a - b);
  return composites.map(({ p, score }) => {
    const idx = sorted.findIndex((s) => s === score);
    const percentile = idx / (sorted.length - 1);
    const overall = Math.round(60 + percentile * (99 - 60));
    return { ...p, overall };
  });
}

// --- Algoritmo Market Value (replica di packages/game-engine/src/marketValue.ts) ---
const LEAGUE_PRESTIGE = 4; // Serie A
const CLUB_PRESTIGE = 5; // Inter, campione in carica
const LEAGUE_MULT = [0.8, 0.9, 1.0, 1.15, 1.3];
const CLUB_MULT = [0.7, 0.85, 1.0, 1.2, 1.5];
const NATION_MULT = [0.97, 0.99, 1.0, 1.05, 1.1];
const CLUBS_IN_ERA = 1; // solo Inter per ora in questo demo

function tierMult(tier, scale) { return scale[Math.min(Math.max(Math.round(tier), 1), scale.length) - 1]; }
function baseValue(overall) {
  const progress = (Math.min(Math.max(overall, 60), 99) - 60) / (99 - 60);
  const ratio = 200_000_000 / 300_000;
  return 300_000 * Math.pow(ratio, progress);
}
function eraDensityMult(clubs) {
  const progress = Math.min(Math.max(clubs, 0) / 20, 1);
  return 0.85 + progress * (1.15 - 0.85);
}
function marketValue(overall, nation) {
  const raw = baseValue(overall) * tierMult(LEAGUE_PRESTIGE, LEAGUE_MULT) * tierMult(CLUB_PRESTIGE, CLUB_MULT) * tierMult(nationTier(nation), NATION_MULT) * eraDensityMult(CLUBS_IN_ERA);
  return Math.round(raw / 50_000) * 50_000;
}

// Come nell'app reale (PlayerForm.tsx): l'Overall si calcola SOLO nel pool dello stesso
// reparto, non mescolando portieri con attaccanti.
const withOveralls = ["POR", "DIF", "CC", "ATT"].flatMap((dept) =>
  computeOveralls(players.filter((p) => p.dept === dept)),
);

console.log("=== ANTEPRIMA (nome | reparto | overall | valore | confidenza) ===");
for (const p of withOveralls) {
  const mv = marketValue(p.overall, p.nation);
  console.log(`${p.name.padEnd(26)} ${p.dept}  OVR ${p.overall}  €${mv.toLocaleString("it-IT")}  [${p.confidence}]`);
}

// --- Genera SQL ---
function esc(s) { return s.replace(/'/g, "''"); }

let sql = "";
sql += `insert into leagues (name, nation, prestige_tier) values ('Serie A', 'Italia', ${LEAGUE_PRESTIGE}) returning id;\n`;
console.log("\n--- SQL generato in seed-inter-demo.sql ---");

let fullSql = `-- Demo popolamento: Serie A + Inter, stagione 2025/26\n`;
fullSql += `insert into leagues (name, nation, prestige_tier) values ('Serie A', 'Italia', ${LEAGUE_PRESTIGE});\n`;
fullSql += `insert into clubs (name, league_id, era, prestige_tier) select 'Inter', id, '2025/26', ${CLUB_PRESTIGE} from leagues where name = 'Serie A';\n`;

for (const p of withOveralls) {
  const mv = marketValue(p.overall, p.nation);
  fullSql += `insert into player_pool (name, department, club_id, nation, market_value, appearances, goals, assists, trophies, caps, overall) select '${esc(p.name)}', '${p.dept}', c.id, '${esc(p.nation)}', ${mv}, ${p.apps}, ${p.goals}, ${p.assists}, ${TROPHIES}, ${p.caps}, ${p.overall} from clubs c where c.name = 'Inter' and c.era = '2025/26';\n`;
}

import { writeFileSync } from "fs";
writeFileSync("C:\\Users\\Giovanni\\AppData\\Local\\Temp\\claude\\c--Users-Giovanni-Desktop-Manager-League\\fe78feab-82e2-43b1-9c25-babd508eab4f\\scratchpad\\seed-inter-demo.sql", fullSql);
console.log("Scritto seed-inter-demo.sql");
