#!/usr/bin/env node
/**
 * Guardia del sistema di design della DS mode.
 *
 * Perché esiste: la diagnosi di `docs/piano-ds-mobile.md` ha misurato **353
 * usi di misure tipografiche arbitrarie sotto i 12px** dentro `src/ds/` (175 a
 * 11px, 150 a 10px, 28 a 9px), più 8px trovati a runtime. Non ci si è arrivati
 * per una decisione sbagliata: ci si è arrivati **una riga alla volta**, perché
 * `index.css` dichiarava solo colori e nessuna scala, quindi ogni schermata si
 * inventava la sua misura ed era sempre la scelta più comoda sul momento.
 *
 * Rimettere le 353 a posto senza questa guardia significherebbe rifare lo
 * stesso percorso fra tre mesi. Il sistema non è il documento: è il controllo
 * che rende impossibile ricaderci in silenzio.
 *
 * Il progetto usa `oxlint`, che non accetta regole custom in JavaScript: da qui
 * uno script, agganciato a `pnpm --filter web check:design`.
 *
 * Uso:
 *   node scripts/check-design-tokens.mjs           verifica e fallisce
 *   node scripts/check-design-tokens.mjs --report  solo il conteggio, non fallisce
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "ds");
const SOLO_REPORT = process.argv.includes("--report");

/** Le regole. Ognuna dice cosa è vietato **e con cosa si sostituisce**. */
const REGOLE = [
  {
    id: "testo-arbitrario",
    re: /text-\[\d+(?:\.\d+)?px\]/g,
    messaggio:
      "misura di testo arbitraria — usa text-micro (12) / text-label (13) / text-body (15) / text-title (19) / text-display (28)",
  },
  {
    id: "raggio-fuori-scala",
    re: /\brounded-(?:sm|md|lg|xl|2xl|3xl)\b/g,
    messaggio: "raggio fuori scala — usa rounded-card (16) / rounded-control (12) / rounded-full",
  },
  {
    id: "altezza-modale",
    re: /(?:max-)?h-\[\d+(?:svh|dvh|vh)\]/g,
    messaggio:
      "altezza di modale scritta a mano (ne esistevano nove diverse) — usa la primitiva <Sheet>",
  },
];

/** Le primitive possono usare i valori grezzi: sono loro a definirli. */
const ESENTI = new Set(["ui"]);

function fileDaControllare(dir) {
  const out = [];
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    if (voce.isDirectory()) {
      if (!ESENTI.has(voce.name)) out.push(...fileDaControllare(path.join(dir, voce.name)));
    } else if (voce.name.endsWith(".tsx")) {
      out.push(path.join(dir, voce.name));
    }
  }
  return out;
}

const violazioni = [];
for (const file of fileDaControllare(ROOT)) {
  const righe = fs.readFileSync(file, "utf8").split("\n");
  righe.forEach((riga, i) => {
    // I commenti raccontano la storia del rinnovo e citano le misure vecchie:
    // citarle non è usarle.
    const testo = riga.trim();
    if (testo.startsWith("*") || testo.startsWith("//") || testo.startsWith("/*")) return;

    for (const regola of REGOLE) {
      regola.re.lastIndex = 0;
      for (const trovato of riga.matchAll(regola.re)) {
        violazioni.push({
          file: path.relative(process.cwd(), file),
          riga: i + 1,
          testo: trovato[0],
          regola,
        });
      }
    }
  });
}

if (violazioni.length === 0) {
  console.log("Sistema di design: nessuna violazione in src/ds/.");
  process.exit(0);
}

const perRegola = new Map();
for (const v of violazioni) {
  if (!perRegola.has(v.regola.id)) perRegola.set(v.regola.id, []);
  perRegola.get(v.regola.id).push(v);
}

console.log(`Sistema di design: ${violazioni.length} violazioni in src/ds/.\n`);
for (const [id, lista] of perRegola) {
  console.log(`  ${id} — ${lista.length}`);
  console.log(`    ${lista[0].regola.messaggio}`);
  for (const v of lista.slice(0, 6)) console.log(`    ${v.file}:${v.riga}  ${v.testo}`);
  if (lista.length > 6) console.log(`    …e altre ${lista.length - 6}`);
  console.log("");
}

process.exit(SOLO_REPORT ? 0 : 1);
