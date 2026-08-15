import { useState } from "react";
import { motion } from "framer-motion";
import { cupTable, type CareerState, type CareerWorld, type StandingRow } from "@app/game-engine";

/**
 * La classifica **sempre a vista** mentre i risultati scorrono.
 *
 * Non è una copia ridotta della tabella completa ma una vista diversa con uno scopo diverso:
 * durante la corsa serve sapere *dove sono adesso*, non i gol subiti di tutte e venti. Quindi
 * poche colonne, e soprattutto una **finestra** attorno alla propria riga invece dell'elenco
 * intero — se la propria squadra è quattordicesima, vederla richiederebbe altrimenti di
 * scorrere proprio mentre sta succedendo qualcosa.
 */

/** Quante squadre mostrare sopra e sotto la propria. */
const INTORNO = 2;

export function MiniStandings({
  standings,
  state,
  world,
}: {
  standings: StandingRow[];
  state: CareerState;
  world: CareerWorld;
}) {
  const inCorona = !!state.cup && !!world.cupTeams;
  const [vista, setVista] = useState<"campionato" | "corona">("campionato");

  // La classifica di Corona esiste solo finché si è nel girone: nel tabellone non c'è nulla da
  // classificare, e mostrarla ferma sarebbe fuorviante.
  const coronaAttiva = inCorona && state.cup!.stage === "girone";
  const mostraCorona = coronaAttiva && vista === "corona";

  if (mostraCorona) {
    const tabella = cupTable(state.cup!, world.cupTeams!, state.seed, state.season);
    const nostroIndiceCoppa = state.cup!.entrants.indexOf(state.clubId);
    return (
      <Riquadro
        titolo="Corona"
        sottotitolo={`girone · turno ${Math.min(state.cup!.groupRound, 6)}/6`}
        selettore={
          coronaAttiva ? <Selettore vista={vista} onChange={setVista} /> : undefined
        }
      >
        <ul className="divide-y divide-[var(--surface-border)]">
          {tabella.slice(0, 10).map((row) => (
            <li key={row.teamId}>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 text-body ${
                  row.teamIndex === nostroIndiceCoppa ? "bg-[var(--brand)]/10 font-extrabold" : ""
                }`}
              >
                <span
                  className="w-1 shrink-0 self-stretch rounded-full"
                  style={{ backgroundColor: row.position <= 8 ? "#f5c518" : "transparent" }}
                />
                <span className="w-5 shrink-0 text-label tabular-nums">{row.position}</span>
                <span className="min-w-0 flex-1 truncate text-label">{row.name}</span>
                <span className="shrink-0 text-label font-extrabold tabular-nums">{row.points}</span>
              </div>
            </li>
          ))}
        </ul>
      </Riquadro>
    );
  }

  const nostroIndice = standings.findIndex((r) => r.isUser);
  if (nostroIndice < 0) return null;

  const teams = standings.length;
  const retrocessioneDa = teams - 2;

  // Sempre la vetta, poi la finestra attorno a noi: la distanza dal primo è l'informazione che
  // dà senso alla propria posizione.
  const finestra = new Set<number>([0, 1]);
  for (let i = nostroIndice - INTORNO; i <= nostroIndice + INTORNO; i++) {
    if (i >= 0 && i < teams) finestra.add(i);
  }
  const indici = [...finestra].sort((a, b) => a - b);

  const nostra = standings[nostroIndice]!;
  const capolista = standings[0]!;
  const distacco = capolista.points - nostra.points;

  return (
    <Riquadro
      titolo="Classifica"
      sottotitolo={distacco === 0 ? "in testa" : `−${distacco} dal primo`}
      selettore={coronaAttiva ? <Selettore vista={vista} onChange={setVista} /> : undefined}
      piede={
        <div className="grid grid-cols-3 divide-x divide-[var(--surface-border)] border-t border-[var(--surface-border)] text-center">
          <Numero etichetta="V" valore={nostra.wins} />
          <Numero etichetta="N" valore={nostra.draws} />
          <Numero etichetta="P" valore={nostra.losses} />
        </div>
      }
    >
      <ul className="divide-y divide-[var(--surface-border)]">
        {indici.map((i, posizione) => {
          const row = standings[i]!;
          const saltoPrima = posizione > 0 && i - indici[posizione - 1]! > 1;
          return (
            <li key={row.teamId}>
              {saltoPrima && (
                <p className="px-3 py-0.5 text-center text-label leading-none text-[var(--text-secondary)]">
                  ···
                </p>
              )}
              <motion.div
                layout
                className={`flex items-center gap-2 px-3 py-1.5 text-body ${
                  row.isUser ? "bg-[var(--brand)]/10 font-extrabold" : ""
                }`}
              >
                <span
                  className="w-1 shrink-0 self-stretch rounded-full"
                  style={{
                    backgroundColor:
                      row.position <= 4
                        ? "#3ddc6b"
                        : row.position > retrocessioneDa
                          ? "#ff4d4d"
                          : "transparent",
                  }}
                />
                <span className="w-5 shrink-0 text-label tabular-nums">{row.position}</span>
                <span className="min-w-0 flex-1 truncate text-label">{row.name}</span>
                <span className="shrink-0 text-label font-extrabold tabular-nums">{row.points}</span>
              </motion.div>
            </li>
          );
        })}
      </ul>
    </Riquadro>
  );
}

function Riquadro({
  titolo,
  sottotitolo,
  selettore,
  piede,
  children,
}: {
  titolo: string;
  sottotitolo: string;
  selettore?: React.ReactNode;
  piede?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <aside className="overflow-hidden rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--surface-border)] px-3 py-2">
        <div className="min-w-0">
          <p className="text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            {titolo}
          </p>
          <p className="truncate text-label font-semibold text-[var(--text-secondary)]">
            {sottotitolo}
          </p>
        </div>
        {selettore}
      </div>
      {children}
      {piede}
    </aside>
  );
}

/** Passa fra campionato e Corona: la competizione "in corso" è quella che si vuole vedere. */
function Selettore({
  vista,
  onChange,
}: {
  vista: "campionato" | "corona";
  onChange: (v: "campionato" | "corona") => void;
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-full border border-[var(--surface-border)]">
      {(["campionato", "corona"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-2.5 py-1 text-label font-bold transition-colors ${
            vista === v
              ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
              : "text-[var(--text-secondary)]"
          }`}
        >
          {v === "campionato" ? "Camp." : "Corona"}
        </button>
      ))}
    </div>
  );
}

function Numero({ etichetta, valore }: { etichetta: string; valore: number }) {
  return (
    <div className="py-1.5">
      <p className="text-body leading-none font-extrabold tabular-nums">{valore}</p>
      <p className="mt-0.5 text-label font-semibold text-[var(--text-secondary)]">{etichetta}</p>
    </div>
  );
}
