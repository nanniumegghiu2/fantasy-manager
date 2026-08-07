import { motion } from "framer-motion";
import { Crown, Trophy } from "lucide-react";
import { GROUP_ROUNDS, KNOCKOUT_TEAMS, cupTable, type CareerState, type CareerWorld } from "@app/game-engine";

/**
 * **Il cammino in Corona, sempre a vista.**
 *
 * La coppa era relegata a una scheda che nessuno apriva, e giocandola non ci si accorgeva
 * nemmeno di essere in Europa: nove turni si mescolavano alle trentotto giornate senza lasciare
 * traccia. Qui il percorso è una striscia di tappe — sei di girone, poi quarti, semifinale,
 * finale — che si accendono man mano. È l'unico modo per rispondere a colpo d'occhio alle due
 * domande che contano: *a che punto siamo* e *quanto manca*.
 */

const TAPPE = [
  ...Array.from({ length: GROUP_ROUNDS }, (_, i) => ({ etichetta: `G${i + 1}`, titolo: `Girone, turno ${i + 1}` })),
  { etichetta: "Q", titolo: "Quarti di finale" },
  { etichetta: "S", titolo: "Semifinale" },
  { etichetta: "F", titolo: "Finale" },
];

export function CupProgress({ state, world }: { state: CareerState; world: CareerWorld }) {
  if (!state.cup || !world.cupTeams) return null;

  const nostroIndice = state.cup.entrants.indexOf(state.clubId);
  const tabella = cupTable(state.cup, world.cupTeams, state.seed, state.season);
  const nostraRiga = tabella.find((r) => r.teamIndex === nostroIndice);

  // Quante tappe sono state giocate: i turni di girone più quelli di tabellone già disputati.
  const turniGiocati = state.cup.groupRound;
  const turniTabellone = state.cup.knockoutLog.filter(
    (m) => m.home === nostroIndice || m.away === nostroIndice,
  ).length;
  const completate = Math.min(TAPPE.length, turniGiocati + turniTabellone);

  const fuori =
    state.cup.stage !== "girone" &&
    !state.cup.bracket.includes(nostroIndice) &&
    state.cup.winner !== nostroIndice;
  const vinta = state.cup.winner === nostroIndice;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#f5c518]/30 bg-[#f5c518]/5">
      <div className="flex items-center gap-2 px-3 py-2">
        <Crown size={15} className="shrink-0 text-[#c9a10b]" />
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold tracking-wide text-[#c9a10b] uppercase">
          Corona Continentale
        </p>
        {vinta ? (
          <span className="flex items-center gap-1 text-[11px] font-extrabold text-[#c9a10b]">
            <Trophy size={12} />
            Vinta
          </span>
        ) : fuori ? (
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Eliminati</span>
        ) : nostraRiga && state.cup.stage === "girone" ? (
          <span className="text-[11px] font-semibold text-[var(--text-secondary)] tabular-nums">
            {nostraRiga.position}º · {nostraRiga.points} pt
            {nostraRiga.position <= KNOCKOUT_TEAMS ? " · passa" : ""}
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">In corsa</span>
        )}
      </div>

      <div className="flex gap-1 px-3 pb-3">
        {TAPPE.map((tappa, i) => {
          const fatta = i < completate;
          const corrente = i === completate && !fuori && !vinta;
          return (
            <motion.span
              key={tappa.etichetta}
              title={tappa.titolo}
              initial={false}
              animate={{
                backgroundColor: fatta
                  ? "#f5c518"
                  : corrente
                    ? "rgba(245,197,24,0.28)"
                    : "var(--surface-raised)",
                color: fatta ? "#3a2c00" : "var(--text-secondary)",
              }}
              transition={{ duration: 0.35 }}
              className={`flex h-6 flex-1 items-center justify-center rounded-md text-[10px] font-extrabold ${
                corrente ? "ring-1 ring-[#f5c518]" : ""
              }`}
            >
              {tappa.etichetta}
            </motion.span>
          );
        })}
      </div>
    </section>
  );
}

/**
 * L'annuncio che questa settimana si gioca in Europa.
 *
 * Compare **prima** del risultato e sparisce da solo: senza, un turno di coppa si distingueva
 * da una giornata di campionato solo leggendo l'etichetta, e la differenza fra le due
 * competizioni — che è tutto il senso di qualificarsi — non si sentiva.
 */
export function CupNightBanner({ stage }: { stage: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 360, damping: 24 }}
      className="relative overflow-hidden rounded-2xl border border-[#f5c518]/40 bg-gradient-to-r from-[#f5c518]/18 to-transparent px-4 py-3"
    >
      {/* Riflesso che scorre una volta sola: dà l'idea della serata di coppa senza rubare
          l'attenzione al tabellino che arriva subito dopo. */}
      <motion.span
        aria-hidden
        initial={{ x: "-120%" }}
        animate={{ x: "220%" }}
        transition={{ duration: 1.1, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-y-0 w-1/3 bg-white/12 blur-md"
      />
      <p className="relative flex items-center gap-2 text-[11px] font-bold tracking-widest text-[#c9a10b] uppercase">
        <Crown size={13} />
        Serata di Corona
      </p>
      <p className="relative mt-0.5 text-sm font-extrabold">{stage}</p>
    </motion.div>
  );
}
