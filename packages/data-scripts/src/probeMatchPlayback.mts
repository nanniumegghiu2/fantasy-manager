/**
 * **Quanto dura davvero una partita guardata, e il pallone si vede muovere?**
 *
 * Simula l'anello di riproduzione del teatro (`MatchTheatre`) senza browser: stesso orologio,
 * stesse costanti, sessanta fotogrammi al secondo. Misura le due cose che contano e che a occhio
 * non si giudicano — la durata reale e lo **spostamento del pallone fra due fotogrammi**, che è
 * esattamente il numero da cui nasceva il difetto segnalato (a 330× erano 5,5 secondi di gioco
 * per fotogramma, cioè un teletrasporto).
 */
import { simulateMatchFlow, buildHighlightReel, ballAt, phaseIndexAt } from "@app/game-engine";

const RATE_LIVE = 1;
const RATE_GOAL = 0.75;
const GOAL_SLOWDOWN_LEAD = 3;
const JUMP_SECONDS = 1.1;
const FPS = 60;

function partita(gf, gs) {
  const events = [];
  for (let i = 0; i < gf; i++)
    events.push({ minute: 9 + i * 21, team: "for", kind: "goal", scorerId: `noi-a${(i % 2) + 1}` });
  for (let i = 0; i < gs; i++)
    events.push({ minute: 17 + i * 23, team: "against", kind: "goal", scorerId: `loro-a${(i % 2) + 1}` });
  events.sort((a, b) => a.minute - b.minute);
  return {
    outcome: gf > gs ? "win" : gf === gs ? "draw" : "loss",
    goalsFor: gf,
    goalsAgainst: gs,
    scorerIds: events.filter((e) => e.team === "for").map((e) => e.scorerId),
    events,
  };
}

/** Riproduce il reel esattamente come fa il componente, e restituisce le misure. */
function riproduci(flow, reel, velocita) {
  const dt = 1 / FPS;
  let realSec = 0;
  let orologio = reel[0]?.from ?? 0;
  let finestra = 0;
  let salto = 0;
  const passi = [];
  let prev = null;

  while (finestra < reel.length && realSec < 60 * 30) {
    realSec += dt;
    const f = reel[finestra];

    if (salto > 0) {
      salto -= dt * velocita;
      if (salto <= 0) {
        salto = 0;
        orologio = f.from;
      }
      continue;
    }

    const fase = flow.phases[f.phaseIndex];
    const versoIlGol =
      fase &&
      fase.goalSecond !== undefined &&
      orologio >= fase.goalSecond - GOAL_SLOWDOWN_LEAD &&
      orologio <= fase.endSecond;
    orologio += dt * (versoIlGol ? RATE_GOAL : RATE_LIVE) * velocita;

    if (orologio >= f.to) {
      if (finestra + 1 >= reel.length) break;
      finestra += 1;
      salto = JUMP_SECONDS;
      prev = null;
      continue;
    }

    const idx = phaseIndexAt(flow.phases, orologio);
    const ph = flow.phases[idx];
    if (ph && orologio <= ph.endSecond) {
      const b = ballAt(ph, orologio);
      if (prev) passi.push(Math.hypot(b.x - prev.x, b.y - prev.y));
      prev = b;
    } else prev = null;
  }

  passi.sort((a, b) => a - b);
  return {
    durata: realSec,
    mediana: passi.length ? passi[Math.floor(passi.length / 2)] : null,
    p95: passi.length ? passi[Math.floor(passi.length * 0.95)] : null,
    massimo: passi.length ? passi[passi.length - 1] : null,
    fermi: passi.filter((v) => v < 0.005).length / Math.max(1, passi.length),
  };
}

const N = 30;
for (const modo of ["salienti", "estesa"]) {
  const agg = { durata: 0, mediana: 0, p95: 0, massimo: 0, fermi: 0, finestre: 0, vuoti: 0 };
  for (let i = 0; i < N; i++) {
    const flow = simulateMatchFlow(partita((i % 3) + 1, i % 3), `rip-${i}`, (id) => id ?? "x");
    const reel = buildHighlightReel(flow, modo);
    if (reel.length === 0) {
      agg.vuoti++;
      continue;
    }
    const m = riproduci(flow, reel, 1);
    agg.durata += m.durata;
    agg.mediana += m.mediana ?? 0;
    agg.p95 += m.p95 ?? 0;
    agg.massimo = Math.max(agg.massimo, m.massimo ?? 0);
    agg.fermi += m.fermi;
    agg.finestre += reel.length;
  }
  const n = N - agg.vuoti;
  console.log(`
MODALITÀ "${modo}" — media su ${n} partite (velocità 1×)
  durata reale          ${(agg.durata / n).toFixed(0)}s  (${((agg.durata / n) / 60).toFixed(1)} min)   →  2× ${(agg.durata / n / 2).toFixed(0)}s   4× ${(agg.durata / n / 4).toFixed(0)}s
  finestre per partita  ${(agg.finestre / n).toFixed(1)}
  spostamento pallone   mediana ${(agg.mediana / n).toFixed(3)} · 95° perc. ${(agg.p95 / n).toFixed(3)} · max ${agg.massimo.toFixed(2)}  (unità di campo per fotogramma)
  fotogrammi immobili   ${((agg.fermi / n) * 100).toFixed(1)}%`);
}

/**
 * Il riferimento: prima della correzione il riempitivo scorreva a 330×, cioè 5,5 secondi di
 * gioco per fotogramma. Con un possesso lungo ~18 secondi significava tre fotogrammi per
 * possesso, e il pallone che compare in punti scollegati del campo.
 */
console.log(`
Per confronto, il difetto segnalato: a 330× erano ${(330 / 60).toFixed(1)}s di gioco per fotogramma.
Ora il gioco scorre a 1× (0.017s per fotogramma): ${(330 / 1).toFixed(0)} volte più lento.`);
