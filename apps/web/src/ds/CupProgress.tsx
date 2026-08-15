import { motion } from "framer-motion";
import { Crown, Shield, Trophy } from "lucide-react";
import {
  GROUP_ROUNDS,
  KNOCKOUT_TEAMS,
  NATIONAL_CUP_STAGES,
  cupTable,
  type CareerState,
  type CareerWorld,
} from "@app/game-engine";
import { COMPETITION_ACCENT, NATIONAL_CUP_STAGE_LABEL, type Competition } from "./format";

/**
 * **Il cammino nelle coppe, sempre a vista.**
 *
 * Le coppe erano relegate a una scheda che nessuno apriva, e giocandole non ci si accorgeva
 * nemmeno di essere in corsa: i turni si mescolavano alle trentotto giornate senza lasciare
 * traccia. Qui il percorso è una striscia di tappe che si accendono man mano — l'unico modo per
 * rispondere a colpo d'occhio alle due domande che contano: *a che punto siamo* e *quanto manca*.
 *
 * Le due competizioni hanno **la stessa forma e colori diversi** (`COMPETITION_ACCENT`). La
 * Coppa Tricolore è arrivata dopo ed era completamente invisibile in app: il motore ne giocava
 * sei turni a stagione, con i loro gol e i loro infortuni, e nessuna schermata li mostrava.
 */

interface Tappa {
  etichetta: string;
  titolo: string;
}

const TAPPE_CORONA: Tappa[] = [
  ...Array.from({ length: GROUP_ROUNDS }, (_, i) => ({
    etichetta: `G${i + 1}`,
    titolo: `Girone, turno ${i + 1}`,
  })),
  { etichetta: "Q", titolo: "Quarti di finale" },
  { etichetta: "S", titolo: "Semifinale" },
  { etichetta: "F", titolo: "Finale" },
];

/** Sei turni, tutti a eliminazione: l'iniziale della fase basta a riconoscerli. */
const TAPPE_TRICOLORE: Tappa[] = NATIONAL_CUP_STAGES.map((stage) => ({
  etichetta:
    stage === "preliminare" ? "P"
    : stage === "sedicesimi" ? "16"
    : stage === "ottavi" ? "8"
    : stage === "quarti" ? "Q"
    : stage === "semifinale" ? "S"
    : "F",
  titolo: NATIONAL_CUP_STAGE_LABEL[stage] ?? stage,
}));

/**
 * La striscia, senza sapere di quale coppa si tratti.
 *
 * Tenere una forma sola per due competizioni non è solo economia di codice: è ciò che le rende
 * confrontabili a colpo d'occhio, che è il punto di averle entrambe sotto la classifica.
 */
function Striscia({
  competition,
  titolo,
  tappe,
  completate,
  stato,
  fuori,
  vinta,
}: {
  competition: Competition;
  titolo: string;
  tappe: Tappa[];
  completate: number;
  stato: string;
  fuori: boolean;
  vinta: boolean;
}) {
  const accento = COMPETITION_ACCENT[competition];
  const Icona = competition === "corona" ? Crown : Shield;

  return (
    <section
      className="overflow-hidden rounded-card border"
      style={{ borderColor: `${accento}4d`, backgroundColor: `${accento}0d` }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Icona size={15} className="shrink-0" style={{ color: accento }} />
        <p
          className="min-w-0 flex-1 truncate text-micro font-bold tracking-wide uppercase"
          style={{ color: accento }}
        >
          {titolo}
        </p>
        {vinta ? (
          <span
            className="flex items-center gap-1 text-label font-extrabold"
            style={{ color: accento }}
          >
            <Trophy size={12} />
            Vinta
          </span>
        ) : (
          <span className="text-label font-semibold text-[var(--text-secondary)] tabular-nums">
            {stato}
          </span>
        )}
      </div>

      <div className="flex gap-1 px-3 pb-3">
        {tappe.map((tappa, i) => {
          const fatta = i < completate;
          const corrente = i === completate && !fuori && !vinta;
          return (
            <motion.span
              key={tappa.etichetta}
              title={tappa.titolo}
              initial={false}
              animate={{
                backgroundColor: fatta
                  ? accento
                  : corrente
                    ? `${accento}47`
                    : "var(--surface-raised)",
                color: fatta ? "#241a08" : "var(--text-secondary)",
              }}
              transition={{ duration: 0.35 }}
              className={`flex h-6 flex-1 items-center justify-center rounded-control text-label font-extrabold ${
                corrente ? "ring-1" : ""
              }`}
              style={corrente ? { boxShadow: `inset 0 0 0 1px ${accento}` } : undefined}
            >
              {tappa.etichetta}
            </motion.span>
          );
        })}
      </div>
    </section>
  );
}

/** Il cammino in Corona Continentale. */
export function CupProgress({ state, world }: { state: CareerState; world: CareerWorld }) {
  if (!state.cup || !world.cupTeams) return null;

  const nostroIndice = state.cup.entrants.indexOf(state.clubId);
  const tabella = cupTable(state.cup, world.cupTeams, state.seed, state.season);
  const nostraRiga = tabella.find((r) => r.teamIndex === nostroIndice);

  // Quante tappe sono state giocate: i turni di girone più quelli di tabellone già disputati.
  const completate = Math.min(
    TAPPE_CORONA.length,
    state.cup.groupRound +
      state.cup.knockoutLog.filter((m) => m.home === nostroIndice || m.away === nostroIndice)
        .length,
  );

  const fuori =
    state.cup.stage !== "girone" &&
    !state.cup.bracket.includes(nostroIndice) &&
    state.cup.winner !== nostroIndice;
  const vinta = state.cup.winner === nostroIndice;

  const stato =
    fuori ? "Eliminati"
    : nostraRiga && state.cup.stage === "girone" ?
      `${nostraRiga.position}º · ${nostraRiga.points} pt${nostraRiga.position <= KNOCKOUT_TEAMS ? " · passa" : ""}`
    : "In corsa";

  return (
    <Striscia
      competition="corona"
      titolo="Corona Continentale"
      tappe={TAPPE_CORONA}
      completate={completate}
      stato={stato}
      fuori={fuori}
      vinta={vinta}
    />
  );
}

/**
 * Il cammino in Coppa Tricolore.
 *
 * Il conteggio delle tappe si fa sulle **nostre** partite nel log, non sulla fase raggiunta dal
 * tabellone: chi salta il preliminare (le ventiquattro esentate) entra ai sedicesimi, e leggere
 * la fase corrente lo farebbe risultare avanti di un turno senza aver giocato.
 */
export function NationalCupProgress({ state, world }: { state: CareerState; world: CareerWorld }) {
  if (!state.nationalCup || !world.divisions) return null;

  const nostroIndice = state.nationalCup.entrants.indexOf(state.clubId);
  if (nostroIndice < 0) return null;

  const nostrePartite = state.nationalCup.log.filter(
    (t) => t.home === nostroIndice || t.away === nostroIndice,
  );
  const vinta = state.nationalCup.winner === nostroIndice;
  const fuori =
    !vinta &&
    !state.nationalCup.bracket.includes(nostroIndice) &&
    !state.nationalCup.byes.includes(nostroIndice);

  // Le tappe si allineano alla fase: chi è esentato dal preliminare parte già dai sedicesimi,
  // quindi la prima casella resta spenta invece di risultare "giocata".
  const primaTappa = NATIONAL_CUP_STAGES.indexOf(nostrePartite[0]?.stage ?? "preliminare");
  const completate = Math.min(
    TAPPE_TRICOLORE.length,
    Math.max(0, primaTappa) + nostrePartite.length,
  );

  const prossima = NATIONAL_CUP_STAGES[Math.min(completate, NATIONAL_CUP_STAGES.length - 1)];
  const stato =
    fuori ? "Eliminati"
    : nostrePartite.length === 0 ? "Al via"
    : (NATIONAL_CUP_STAGE_LABEL[prossima ?? ""] ?? "In corsa");

  return (
    <Striscia
      competition="tricolore"
      titolo="Coppa Tricolore"
      tappe={TAPPE_TRICOLORE}
      completate={completate}
      stato={stato}
      fuori={fuori}
      vinta={vinta}
    />
  );
}

/**
 * L'annuncio che questa settimana si gioca una coppa.
 *
 * Compare **prima** del risultato e sparisce da solo: senza, un turno di coppa si distingueva
 * da una giornata di campionato solo leggendo l'etichetta, e la differenza fra le competizioni —
 * che è tutto il senso di qualificarsi — non si sentiva.
 */
export function CompetitionNightBanner({
  competition,
  stage,
}: {
  competition: Competition;
  stage: string;
}) {
  const accento = COMPETITION_ACCENT[competition];
  const Icona = competition === "corona" ? Crown : Shield;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 360, damping: 24 }}
      className="relative overflow-hidden rounded-card px-4 py-3"
      style={{
        border: `1px solid ${accento}66`,
        background: `linear-gradient(to right, ${accento}2e, transparent)`,
      }}
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
      <p
        className="relative flex items-center gap-2 text-micro font-bold tracking-widest uppercase"
        style={{ color: accento }}
      >
        <Icona size={13} />
        {competition === "corona" ? "Serata di Corona" : "Serata di Coppa Tricolore"}
      </p>
      <p className="relative mt-0.5 text-body font-extrabold">{stage}</p>
    </motion.div>
  );
}

/** Compatibilità con i chiamanti che annunciano solo la Corona. */
export function CupNightBanner({ stage }: { stage: string }) {
  return <CompetitionNightBanner competition="corona" stage={stage} />;
}
