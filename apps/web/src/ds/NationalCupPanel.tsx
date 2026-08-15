import { motion } from "framer-motion";
import { Shield, Trophy } from "lucide-react";
import { NATIONAL_CUP_STAGES, type CareerState, type CareerWorld } from "@app/game-engine";
import { COMPETITION_ACCENT, NATIONAL_CUP_STAGE_LABEL, OUTCOME_COLOR, outcomeOf } from "./format";

/**
 * **La Coppa Tricolore.**
 *
 * Quaranta squadre, sorteggio libero a ogni turno, nessuna testa di serie: è ciò che rende la
 * coppa interessante per chi sta in Serie B, e senza cui non ci sarebbe mai la serata della
 * piccola.
 *
 * Il pannello risponde a tre domande, in quest'ordine — **dove siamo**, **contro chi giochiamo
 * adesso**, **come ci siamo arrivati**. È l'ordine in cui le si guarda davvero, e su schermo
 * stretto significa che le prime due stanno sopra la piega senza dover scorrere.
 */

const ACCENTO = COMPETITION_ACCENT.tricolore;

export function NationalCupPanel({ state, world }: { state: CareerState; world: CareerWorld }) {
  const save = state.nationalCup;
  const divisions = world.divisions;

  if (!save || !divisions) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-[var(--surface-border)] px-4 py-10 text-center">
        <Shield size={22} className="text-[var(--text-secondary)]" />
        <p className="text-body font-semibold">Nessuna Coppa Tricolore</p>
        <p className="max-w-xs text-label leading-relaxed text-[var(--text-secondary)]">
          Si gioca solo nelle carriere italiane, dove Serie A e Serie B sono collegate.
        </p>
      </div>
    );
  }

  const nomeDi = (index: number) =>
    divisions.teams[save.entrants[index] ?? ""]?.name ?? "Squadra";

  const nostroIndice = save.entrants.indexOf(state.clubId);
  const nostrePartite = save.log.filter(
    (t) => t.home === nostroIndice || t.away === nostroIndice,
  );
  const vinta = save.winner === nostroIndice;
  const inCorsa = save.bracket.includes(nostroIndice) || save.byes.includes(nostroIndice);
  const fuori = !vinta && !inCorsa;

  // L'avversaria del turno che si sta per giocare: il tabellone è già accoppiato, quindi si
  // legge senza doverla indovinare. È la domanda che ci si fa aprendo il pannello.
  const posizione = save.bracket.indexOf(nostroIndice);
  const prossimaAvversaria =
    posizione >= 0
      ? nomeDi(save.bracket[posizione % 2 === 0 ? posizione + 1 : posizione - 1] ?? -1)
      : null;

  const turniRimasti =
    NATIONAL_CUP_STAGES.length - NATIONAL_CUP_STAGES.indexOf(save.stage) - (vinta ? 0 : 1);

  return (
    <div className="flex flex-col gap-3">
      {/* Intestazione: stato in una riga sola, perché è ciò che si legge per primo. */}
      <div
        className="flex items-center gap-2.5 rounded-card border p-3"
        style={{ borderColor: `${ACCENTO}4d`, backgroundColor: `${ACCENTO}0d` }}
      >
        {vinta ? (
          <Trophy size={18} className="shrink-0" style={{ color: ACCENTO }} />
        ) : (
          <Shield size={18} className="shrink-0" style={{ color: ACCENTO }} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-body leading-tight font-extrabold">Coppa Tricolore</p>
          <p className="text-label text-[var(--text-secondary)]">
            {vinta
              ? "L'abbiamo vinta."
              : fuori
                ? "Eliminati: il cammino finisce qui."
                : `${NATIONAL_CUP_STAGE_LABEL[save.stage] ?? save.stage} · ${save.bracket.length / 2} sfide in programma`}
          </p>
        </div>
        {!vinta && !fuori && turniRimasti > 0 && (
          <span
            className="shrink-0 rounded-full px-2 py-1 text-label font-extrabold tabular-nums"
            style={{ backgroundColor: `${ACCENTO}24`, color: ACCENTO }}
          >
            {turniRimasti} al titolo
          </span>
        )}
      </div>

      {/* Il prossimo avversario, in evidenza: è l'informazione più deperibile della schermata. */}
      {prossimaAvversaria && !vinta && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3 text-center"
        >
          <p className="text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            Prossimo turno
          </p>
          <p className="mt-1 text-body font-extrabold">{prossimaAvversaria}</p>
          <p className="text-label text-[var(--text-secondary)]">
            {NATIONAL_CUP_STAGE_LABEL[save.stage] ?? save.stage} · si gioca tutto in una partita
          </p>
        </motion.div>
      )}

      {/* Il nostro cammino: una riga per turno, con l'esito colorato. */}
      <section>
        <h3 className="mb-1.5 px-1 text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
          Il nostro cammino
        </h3>
        {nostrePartite.length === 0 ? (
          <p className="rounded-card border border-dashed border-[var(--surface-border)] px-3 py-6 text-center text-label text-[var(--text-secondary)]">
            {save.byes.includes(nostroIndice)
              ? "Esentati dal preliminare: si entra ai sedicesimi."
              : "Il cammino comincia al primo turno."}
          </p>
        ) : (
          <ul className="overflow-hidden rounded-card border border-[var(--surface-border)]">
            {nostrePartite.map((tie, i) => {
              const inCasa = tie.home === nostroIndice;
              const nostri =
                (inCasa ? tie.goalsHome : tie.goalsAway) +
                (inCasa ? (tie.extraTime?.goalsHome ?? 0) : (tie.extraTime?.goalsAway ?? 0));
              const loro =
                (inCasa ? tie.goalsAway : tie.goalsHome) +
                (inCasa ? (tie.extraTime?.goalsAway ?? 0) : (tie.extraTime?.goalsHome ?? 0));
              const passato = tie.winner === nostroIndice;
              const esito = tie.penalties ? (passato ? "V" : "P") : outcomeOf(nostri, loro);

              return (
                <li
                  key={i}
                  className="flex items-center gap-2.5 border-b border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2 last:border-b-0"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-label font-extrabold"
                    style={{
                      backgroundColor: `${OUTCOME_COLOR[esito]}22`,
                      color: OUTCOME_COLOR[esito],
                    }}
                  >
                    {esito}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-label leading-tight font-bold text-balance">
                      {nomeDi(inCasa ? tie.away : tie.home)}
                    </p>
                    <p className="text-label text-[var(--text-secondary)]">
                      {NATIONAL_CUP_STAGE_LABEL[tie.stage] ?? tie.stage}
                      {inCasa ? " · in casa" : " · in trasferta"}
                      {tie.penalties ? " · ai rigori" : tie.extraTime ? " · dopo i supplementari" : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-body font-extrabold tabular-nums">
                    {nostri}-{loro}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Le sfide del turno in corso: chi resta, e chi gioca contro chi. */}
      {save.bracket.length >= 2 && !vinta && (
        <section>
          <h3 className="mb-1.5 px-1 text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            Sorteggio del turno · {save.bracket.length} squadre
          </h3>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {Array.from({ length: Math.floor(save.bracket.length / 2) }, (_, i) => {
              const casa = save.bracket[i * 2]!;
              const fuoriCasa = save.bracket[i * 2 + 1]!;
              const nostra = casa === nostroIndice || fuoriCasa === nostroIndice;
              return (
                <li
                  key={i}
                  className="flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-label"
                  style={{
                    borderColor: nostra ? `${ACCENTO}66` : "var(--surface-border)",
                    backgroundColor: nostra ? `${ACCENTO}12` : "var(--surface-raised)",
                  }}
                >
                  <span className={`min-w-0 flex-1 text-right leading-tight text-balance ${casa === nostroIndice ? "font-extrabold" : ""}`}>
                    {nomeDi(casa)}
                  </span>
                  <span className="shrink-0 text-label text-[var(--text-secondary)]">vs</span>
                  <span className={`min-w-0 flex-1 leading-tight text-balance ${fuoriCasa === nostroIndice ? "font-extrabold" : ""}`}>
                    {nomeDi(fuoriCasa)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="px-1 text-label leading-relaxed text-[var(--text-secondary)]">
        Quaranta squadre, Serie A e Serie B insieme, e a ogni turno un sorteggio libero: nessuna
        testa di serie, nessun tabellone deciso in partenza. È il motivo per cui qui una piccola
        può arrivare lontano.
      </p>
    </div>
  );
}
