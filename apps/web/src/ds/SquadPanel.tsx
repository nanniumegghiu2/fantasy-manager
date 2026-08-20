import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  FileSignature,
  Goal,
  Handshake,
  LayoutGrid,
  List,
  Plane,
  Sprout,
  Tag,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { ROLE_LABELS } from "@app/shared-types";
import type { Department, Role } from "@app/shared-types";
import {
  ageInSeason,
  captainOf,
  computeAvgRating,
  contractFor,
  formatWage,
  findCoach,
  getCoachUntouchables,
  getFormation,
  harmonyLabel,
  isAtPeak,
  isDeveloping,
  type CareerState,
  type CareerWorld,
  type Lineup,
  type MarketAction,
} from "@app/game-engine";
import { Pitch, PitchDot } from "../classic/Pitch";
import { getSlotPosition } from "../classic/pitchLayouts";
import { NationFlag } from "../classic/NationFlag";
import { overallTier } from "../classic/theme";
import { CaptaincyCard } from "./CaptaincyCard";
import { DEPARTMENT_LABEL, RoleChips } from "./RoleChips";
import { moraleLabel } from "./format";

/**
 * La rosa.
 *
 * Tre viste per tre domande: **il campo** ("chi gioca"), **l'elenco** ("come sta la rosa") e
 * **i ruoli** ("cosa mi manca"). L'ultima è quella che serve a fare mercato, ed è nuova: senza
 * vedere quante caselle del modulo sono davvero coperte — contando anche i ruoli secondari —
 * la decisione su cosa comprare si prende a naso.
 */

type View = "campo" | "elenco" | "ruoli";

const ORDINE: Department[] = ["POR", "DIF", "CC", "ATT"];

interface SquadPanelProps {
  state: CareerState;
  world: CareerWorld;
  lineup: Lineup;
  /** Azioni di mercato disponibili anche fuori dalla finestra (liste). */
  onAction?: (action: MarketAction) => void;
  /** Apre il tavolo del rinnovo. Assente = la pastiglia contratto resta informativa. */
  onRenew?: (playerId: string) => void;
  /** Propone un nuovo capitano al mister. Assente = la fascia resta in sola lettura. */
  onProposeCaptain?: (playerId: string) => { ok: boolean; message: string };
}

export function SquadPanel({
  state,
  world,
  lineup,
  onAction,
  onRenew,
  onProposeCaptain,
}: SquadPanelProps) {
  const capitano = useMemo(() => captainOf(state, world), [state, world]);
  const [view, setView] = useState<View>("campo");
  // Stesso ripiego del motore ("4-3-3" se non c'è allenatore): la lavagna deve mostrare
  // esattamente il modulo con cui si gioca, non uno scelto dalla UI per conto suo.
  const formation = useMemo(() => {
    const coach = state.coachId ? findCoach(state.coachId) : undefined;
    return getFormation(coach?.formationId ?? "4-3-3") ?? getFormation("4-3-3")!;
  }, [state.coachId]);

  const titolari = new Set(Object.values(lineup.starters));
  const massimoMinuti = Math.max(1, ...state.roster.map((e) => e.stats.minutes));
  const inVendita = new Set(state.lists?.transferList ?? []);
  const inPrestito = new Set(state.lists?.loanList ?? []);
  const intoccabiliSet = useMemo(
    () => new Set(getCoachUntouchables(state.roster, state.coachId, world.players)),
    [state.roster, state.coachId, world.players],
  );
  const infoSintonia = useMemo(
    () => harmonyLabel(state.coachHarmony ?? 75),
    [state.coachHarmony],
  );
  const ruoliRichiesti = undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* Banner Sintonia col Mister */}
      <div className="flex items-center justify-between rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-3 w-3 rounded-full animate-pulse"
            style={{ backgroundColor: infoSintonia.tone }}
          />
          <div>
            <p className="text-label font-extrabold leading-tight">Sintonia DS - Mister</p>
            <p className="text-label font-semibold" style={{ color: infoSintonia.tone }}>
              {state.coachHarmony ?? 75}% · {infoSintonia.label}
            </p>
          </div>
        </div>
        <span className="text-label text-[var(--text-secondary)] font-medium">
          {intoccabiliSet.size} intoccabili in rosa
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* I tre selettori erano alti 30px e la riga «28 giocatori · 4-2-3-1» accanto andava a
            capo sopra di essi, sovrapponendosi all'etichetta «Ruoli». Ora i selettori occupano
            la riga per intero a 44px, e il conteggio sta sotto dove ha spazio. */}
        <div className="flex w-full overflow-hidden rounded-control border border-[var(--surface-border)]">
          {(["campo", "elenco", "ruoli"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`flex min-h-tap flex-1 items-center justify-center gap-1.5 text-label font-bold transition-colors ${
                view === v
                  ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {v === "campo" ? <LayoutGrid size={14} /> : v === "elenco" ? <List size={14} /> : <Tag size={14} />}
              {v === "campo" ? "Campo" : v === "elenco" ? "Elenco" : "Ruoli"}
            </button>
          ))}
        </div>
        <span className="num w-full text-label text-[var(--text-secondary)]">
          {state.roster.length} giocatori · {formation.name}
        </span>
      </div>

      <CaptaincyCard state={state} world={world} onPropose={onProposeCaptain} />

      {view === "campo" && (
        <div className="mx-auto w-full max-w-md">
          <Pitch>
            {formation.slots.map((slot) => {
              const playerId = lineup.starters[slot.id];
              const entry = state.roster.find((e) => e.playerId === playerId);
              const player = playerId ? world.players[playerId] : undefined;
              const { x, y } = getSlotPosition(formation, slot);
              return (
                <PitchDot
                  key={slot.id}
                  x={x}
                  y={y}
                  label={ROLE_LABELS[slot.role]}
                  shortLabel={slot.role}
                  playerName={player?.name}
                  overall={entry?.overall}
                  nation={player?.nation}
                  state={playerId ? "filled" : "empty"}
                />
              );
            })}
          </Pitch>
          {lineup.outOfPosition.length > 0 && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-label text-[#ffab2e]">
              <TriangleAlert size={12} />
              {lineup.outOfPosition.length} giocatori schierati fuori ruolo
            </p>
          )}
        </div>
      )}

      {view === "ruoli" && (
        <CoperturaRuoli formation={formation} state={state} world={world} />
      )}

      {view === "elenco" && (
        <ul className="flex flex-col gap-1.5">
          {[...state.roster]
            // Chi è in prestito altrove non è più "nella rosa" per questa stagione: si vede
            // solo nella sezione informativa sotto, non qui — altrimenti sembra un giocatore
            // disponibile quando invece sta giocando altrove.
            .filter((entry) => !entry.loan?.hostClubId)
            .sort((a, b) => b.overall - a.overall)
            .map((entry) => {
              const player = world.players[entry.playerId];
              const tier = overallTier(entry.overall);
              const morale = moraleLabel(entry.morale);
              const eta = ageInSeason(player?.birthDate, state.season);
              const quota = Math.round((entry.stats.minutes / massimoMinuti) * 100);
              const vendita = inVendita.has(entry.playerId);
              const prestito = inPrestito.has(entry.playerId);
              /**
               * **Chi è qui in prestito non è nostro da vendere.**
               *
               * Il motore lo rifiuta (`lista_trasferimenti`), ma offrire il pulsante e poi
               * negare l'azione è un bivio finto: al suo posto si dice di chi è.
               */
              const daAltroClub = entry.loan?.ownerClubId;

              return (
                <motion.li
                  key={entry.playerId}
                  layout
                  className={`flex flex-col gap-2 rounded-control border p-2.5 ${
                    vendita
                      ? "border-[#ff8a3d]/40 bg-[#ff8a3d]/5"
                      : titolari.has(entry.playerId)
                        ? "border-[var(--brand)]/40 bg-[var(--brand)]/5"
                        : "border-[var(--surface-border)] bg-[var(--surface-raised)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-body font-extrabold"
                      style={{ backgroundColor: tier.dot, color: tier.dotText }}
                    >
                      {entry.overall}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-body leading-tight font-bold">
                        {player?.nation && <NationFlag nation={player.nation} />}
                        <span className="truncate">{player?.name ?? "Giocatore"}</span>
                        {entry.injuryMatchdaysLeft > 0 && (
                          <Activity size={12} className="shrink-0 text-[#ff4d4d]" />
                        )}
                        {eta !== null && isDeveloping(eta) && (
                          <Sprout size={12} className="shrink-0 text-[#3ddc6b]" />
                        )}
                        {intoccabiliSet.has(entry.playerId) && (
                          <span className="shrink-0 rounded-control bg-[#f5c518]/20 px-1.5 py-0.5 text-label font-extrabold text-[#d69e00]">
                            <Zap size={11} className="inline" /> Intoccabile
                          </span>
                        )}
                        {entry.playerId === capitano && (
                          <span className="shrink-0 rounded-control bg-amber-500/20 px-1.5 py-px text-label font-extrabold text-amber-400">
                            © Capitano
                          </span>
                        )}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {player && (
                          <RoleChips
                            role={player.role}
                            secondary={player.secondaryRoles}
                            highlight={ruoliRichiesti}
                          />
                        )}
                        <span className="text-label text-[var(--text-secondary)]">
                          {eta !== null && (
                            <span className={isAtPeak(eta) ? "text-[var(--text-primary)]" : undefined}>
                              {eta} anni
                            </span>
                          )}
                        </span>
                        <span className="text-label" style={{ color: morale.color }}>
                          {morale.label}
                        </span>
                        {/* **La scadenza si vede qui**, non solo dentro il mercato: è ciò che
                            decide se il giocatore sarà ancora tuo l'anno prossimo. Toccarla apre
                            il tavolo del rinnovo, quando il mercato è aperto. */}
                        {(() => {
                          const c = contractFor(state, world, entry.playerId);
                          const residue = c ? c.until - state.season + 1 : 0;
                          const urgente = residue <= 1;
                          const colore = urgente ? "#ff4d4d" : residue === 2 ? "#ffab2e" : "var(--text-secondary)";
                          const etichetta =
                            residue <= 0 ? "scaduto" : urgente ? "in scadenza" : `${residue} anni`;
                          return (
                            <button
                              type="button"
                              disabled={!onRenew}
                              onClick={() => onRenew?.(entry.playerId)}
                              title={c ? `Contratto fino al ${c.until} · ${formatWage(c.wage)}` : "Senza contratto"}
                              className="flex items-center gap-1 rounded-full px-1.5 py-px text-label font-bold disabled:cursor-default"
                              style={{ backgroundColor: `${colore}1f`, color: colore }}
                            >
                              <FileSignature size={10} /> {etichetta}
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="w-20 shrink-0 text-right">
                      <p className="text-label font-bold tabular-nums">
                        {entry.stats.appearances}
                        <span className="font-normal text-[var(--text-secondary)]"> pres.</span>
                      </p>
                      {(() => {
                        const mv = computeAvgRating(entry);
                        const tone =
                          mv >= 7.0
                            ? "#3ddc6b"
                            : mv >= 6.0
                              ? "var(--text-primary)"
                              : mv > 0
                                ? "#ff4d4d"
                                : "var(--text-secondary)";
                        return (
                          <p className="text-label font-extrabold tabular-nums" style={{ color: tone }}>
                            MV {mv > 0 ? mv.toFixed(1) : "--"}
                          </p>
                        );
                      })()}
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--surface)]">
                        <span
                          className="block h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${quota}%` }}
                        />
                      </span>
                      {(entry.stats.goals > 0 || entry.stats.assists > 0) && (
                        <p className="mt-0.5 text-label font-bold text-emerald-400">
                          <Goal size={12} className="inline" /> {entry.stats.goals}
                          {/* ⚠️ Gli assist non comparivano perché non venivano **mai contati**:
                              restavano a zero per tutta la carriera. Ora esistono, e si leggono
                              accanto ai gol — un rifinitore non si giudica dai soli gol. */}
                          {entry.stats.assists > 0 && (
                            <span className="ml-1.5 text-[var(--accent)]">
                              <Handshake size={11} className="inline" /> {entry.stats.assists}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Le liste si compilano anche fuori dalla finestra: è programmazione, non
                      una trattativa, e a novembre si deve poter già decidere chi cedere. */}
                  {onAction && daAltroClub && (
                    <p className="flex items-center gap-1.5 rounded-control border border-[#5aa9e6]/30 bg-[#5aa9e6]/8 px-2.5 py-1.5 text-label font-semibold text-[#2f7fbd]">
                      <Plane size={12} className="shrink-0" />
                      In prestito da {world.market?.clubs[daAltroClub]?.name ?? "un altro club"}:
                      non è tuo da vendere o prestare.
                    </p>
                  )}
                  {onAction && !daAltroClub && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onAction({
                            kind: "lista_trasferimenti",
                            playerId: entry.playerId,
                            on: !vendita,
                          })
                        }
                        className={`flex-1 rounded-full px-3 py-1.5 text-label font-bold ${
                          vendita
                            ? "bg-[#ff8a3d]/20 text-[#c96a20]"
                            : "border border-[var(--surface-border)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {vendita ? "In vendita" : "Metti in vendita"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onAction({ kind: "lista_prestiti", playerId: entry.playerId, on: !prestito })
                        }
                        className={`flex-1 rounded-full px-3 py-1.5 text-label font-bold ${
                          prestito
                            ? "bg-[#5aa9e6]/20 text-[#2f7fbd]"
                            : "border border-[var(--surface-border)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {prestito ? "In lista prestiti" : "Lista prestiti"}
                      </button>
                    </div>
                  )}
                </motion.li>
              );
            })}
        </ul>
      )}

      {/* Chi è in prestito non è più "nella rosa" a vista (sopra), ma resta rintracciabile
          qui — solo informativo, nessuna azione: torna da solo a fine stagione. */}
      {view === "elenco" &&
        (() => {
          const inPrestitoAltrove = state.roster.filter((e) => e.loan?.hostClubId);
          if (inPrestitoAltrove.length === 0) return null;
          return (
            <details className="mt-3 rounded-control border border-[var(--surface-border)] bg-[var(--surface-raised)] p-2.5">
              <summary className="flex cursor-pointer items-center gap-1.5 text-label font-bold text-[var(--text-secondary)]">
                <Plane size={12} className="shrink-0 text-[#5aa9e6]" />
                In prestito altrove ({inPrestitoAltrove.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {inPrestitoAltrove.map((entry) => {
                  const player = world.players[entry.playerId];
                  const club = entry.loan?.hostClubId ? world.market?.clubs[entry.loan.hostClubId] : undefined;
                  return (
                    <li key={entry.playerId} className="flex items-center justify-between text-label">
                      <span className="truncate font-semibold">{player?.name ?? "Giocatore"}</span>
                      <span className="shrink-0 text-[var(--text-secondary)]">{club?.name ?? "altrove"}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })()}
    </div>
  );
}

/**
 * Quante caselle del modulo sono coperte, e da chi.
 *
 * Conta **anche i ruoli secondari**, perché è così che funziona il campo: tre difensori
 * centrali che sanno fare il terzino non lasciano scoperta la fascia. È l'unica vista che
 * risponde alla domanda "cosa devo comprare" senza dover leggere la rosa uno per uno.
 */
function CoperturaRuoli({
  formation,
  state,
  world,
}: {
  formation: ReturnType<typeof getFormation> & {};
  state: CareerState;
  world: CareerWorld;
}) {
  const richiesti = useMemo(() => {
    const conteggio = new Map<Role, number>();
    for (const slot of formation.slots) {
      conteggio.set(slot.role, (conteggio.get(slot.role) ?? 0) + 1);
    }
    return conteggio;
  }, [formation]);

  const copertura = useMemo(() => {
    const naturali = new Map<Role, number>();
    const adattati = new Map<Role, number>();
    for (const entry of state.roster) {
      if (entry.loan?.hostClubId) continue; // in prestito fuori: non è utilizzabile
      const player = world.players[entry.playerId];
      if (!player) continue;
      naturali.set(player.role, (naturali.get(player.role) ?? 0) + 1);
      for (const r of player.secondaryRoles) {
        adattati.set(r, (adattati.get(r) ?? 0) + 1);
      }
    }
    return { naturali, adattati };
  }, [state.roster, world.players]);

  // Nell'ordine in cui le caselle compaiono nel modulo, cioè dalla porta all'attacco: è la
  // stessa lettura del campo, e rende immediato capire *dove* la squadra è corta.
  const righe = [...richiesti.entries()].sort(
    (a, b) =>
      formation.slots.findIndex((s) => s.role === a[0]) -
      formation.slots.findIndex((s) => s.role === b[0]),
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-card border border-dashed border-[var(--surface-border)] p-3 text-label leading-relaxed text-[var(--text-secondary)]">
        Le caselle del <strong className="font-bold">{formation.name}</strong> e chi le sa
        coprire. In pieno chi ci gioca di ruolo, tratteggiato chi lo sa fare come ruolo
        secondario. Una casella con un solo uomo è dove un infortunio ti mette nei guai.
      </p>

      <ul className="flex flex-col gap-1.5">
        {righe.map(([role, quante]) => {
          const naturali = copertura.naturali.get(role) ?? 0;
          const adattati = copertura.adattati.get(role) ?? 0;
          const totale = naturali + adattati;
          const scoperto = totale < quante;
          const fragile = !scoperto && totale <= quante;

          return (
            <li
              key={role}
              className={`flex items-center gap-3 rounded-control border p-2.5 ${
                scoperto
                  ? "border-[#ff4d4d]/40 bg-[#ff4d4d]/5"
                  : fragile
                    ? "border-[#ffab2e]/40 bg-[#ffab2e]/5"
                    : "border-[var(--surface-border)] bg-[var(--surface-raised)]"
              }`}
            >
              <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-control bg-[var(--surface)] text-label font-extrabold">
                {role}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body leading-tight font-bold">{ROLE_LABELS[role]}</p>
                <p className="text-label text-[var(--text-secondary)]">
                  {quante === 1 ? "1 casella" : `${quante} caselle`} · {naturali} di ruolo
                  {adattati > 0 ? `, ${adattati} adattabili` : ""}
                </p>
              </div>
              <span
                className="shrink-0 text-body font-extrabold tabular-nums"
                style={{
                  color: scoperto ? "#ff4d4d" : fragile ? "#ffab2e" : "var(--text-secondary)",
                }}
              >
                {totale}/{quante}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-1 grid grid-cols-4 gap-2">
        {ORDINE.map((dep) => {
          const n = state.roster.filter((e) => {
            const p = world.players[e.playerId];
            return p && p.department === dep && !e.loan?.hostClubId;
          }).length;
          return (
            <div
              key={dep}
              className="rounded-control border border-[var(--surface-border)] bg-[var(--surface-raised)] p-2 text-center"
            >
              <p className="text-micro font-bold tracking-wide text-[var(--text-secondary)] uppercase">
                {DEPARTMENT_LABEL[dep]}
              </p>
              <p className="mt-0.5 text-body leading-none font-extrabold tabular-nums">{n}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
