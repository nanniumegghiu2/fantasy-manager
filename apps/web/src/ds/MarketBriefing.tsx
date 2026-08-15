import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Building2,
  ChevronDown,
  HeartCrack,
  ShieldAlert,
  Sprout,
  TrendingUp,
} from "lucide-react";
import {
  ageInSeason,
  boardConfidenceLabel,
  defaultBoard,
  findCoach,
  getFormation,
  type CareerState,
  type CareerWorld,
  type StandingRow,
} from "@app/game-engine";
import type { Role } from "@app/shared-types";
import { ordinale } from "./format";

/** Caselle del modulo coperte da un solo uomo (naturale o adattato): nessun vero ricambio. */
function repartiSenzaRicambio(state: CareerState, world: CareerWorld): number {
  const coach = state.coachId ? findCoach(state.coachId) : undefined;
  const formation = getFormation(coach?.formationId ?? "4-3-3");
  if (!formation) return 0;

  const richiesti = new Map<Role, number>();
  for (const slot of formation.slots) richiesti.set(slot.role, (richiesti.get(slot.role) ?? 0) + 1);

  const copertura = new Map<Role, number>();
  for (const entry of state.roster) {
    if (entry.loan?.hostClubId) continue;
    const player = world.players[entry.playerId];
    if (!player) continue;
    copertura.set(player.role, (copertura.get(player.role) ?? 0) + 1);
    for (const r of player.secondaryRoles) copertura.set(r, (copertura.get(r) ?? 0) + 1);
  }

  let senzaRicambio = 0;
  for (const [role, quante] of richiesti) {
    const totale = copertura.get(role) ?? 0;
    if (totale === quante) senzaRicambio++;
  }
  return senzaRicambio;
}

/**
 * **Dove sei, prima di decidere.**
 *
 * Nel mercato di riparazione la domanda non è "chi compro" ma "cosa mi serve", e la risposta
 * dipende da come sta andando la stagione: chi lotta per non retrocedere compra in modo diverso
 * da chi insegue il titolo. Aprire la finestra senza avere sotto gli occhi classifica e stato
 * della rosa costringerebbe a chiuderla, andare a guardare e riaprirla.
 *
 * Sta in cima al pannello e non in una scheda proprio perché è **contesto**, non un'altra cosa
 * da fare: si legge di sfuggita mentre si decide.
 */

interface MarketBriefingProps {
  state: CareerState;
  world: CareerWorld;
  standings: StandingRow[];
}

export function MarketBriefing({ state, world, standings }: MarketBriefingProps) {
  const [aperto, setAperto] = useState(false);
  const nostra = standings.find((r) => r.isUser);
  const teams = standings.length;

  const disponibili = state.roster.filter((e) => !e.loan?.hostClubId);
  const media =
    disponibili.length > 0
      ? Math.round(disponibili.reduce((s, e) => s + e.overall, 0) / disponibili.length)
      : 0;
  const infortunati = disponibili.filter((e) => e.injuryMatchdaysLeft > 0).length;
  const scontenti = disponibili.filter((e) => e.morale < 40).length;
  const giovani = disponibili.filter((e) => {
    const eta = ageInSeason(world.players[e.playerId]?.birthDate, state.season);
    return eta !== null && eta <= 21;
  }).length;
  const senzaRicambio = repartiSenzaRicambio(state, world);

  const board = state.board ?? defaultBoard();
  const fiducia = { ...boardConfidenceLabel(board.confidence), valore: board.confidence };

  return (
    <div className="border-b border-[var(--surface-border)] bg-[var(--surface-raised)]/60">
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        className="flex min-h-tap w-full items-center gap-3 px-4 py-2 text-left"
      >
        {nostra ? (
          <>
            <span className="shrink-0 text-body font-extrabold">
              {ordinale(nostra.position)}
              <span className="ml-1 font-semibold text-[var(--text-secondary)]">
                su {teams}
              </span>
            </span>
            <span className="shrink-0 text-label font-semibold text-[var(--text-secondary)]">
              {nostra.points} pt · {nostra.wins}V {nostra.draws}N {nostra.losses}P
            </span>
          </>
        ) : (
          <span className="text-label font-semibold text-[var(--text-secondary)]">
            La stagione non è ancora cominciata
          </span>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-2.5 text-label font-semibold">
          <span className="flex items-center gap-1 text-[var(--text-secondary)]">
            <TrendingUp size={12} />
            {media}
          </span>
          {infortunati > 0 && (
            <span className="flex items-center gap-1 text-[#ff4d4d]">
              <Activity size={12} />
              {infortunati}
            </span>
          )}
          {scontenti > 0 && (
            <span className="flex items-center gap-1 text-[#ff8a3d]">
              <HeartCrack size={12} />
              {scontenti}
            </span>
          )}
          {giovani > 0 && (
            <span className="flex items-center gap-1 text-[#3ddc6b]">
              <Sprout size={12} />
              {giovani}
            </span>
          )}
          {senzaRicambio > 0 && (
            <span className="flex items-center gap-1 text-[#ffab2e]">
              <ShieldAlert size={12} />
              {senzaRicambio}
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-[var(--text-secondary)] transition-transform ${aperto ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {aperto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {/* **La dirigenza è parte del contesto**, non una sorpresa di fine stagione: se la
                  fiducia sta scendendo lo si deve poter leggere mentre si decide come spendere. */}
              <div className="mb-2 flex items-center justify-between gap-2 rounded-control border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-2">
                <span className="flex items-center gap-1.5 text-micro font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
                  <Building2 size={11} /> Dirigenza
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${fiducia.valore}%`, backgroundColor: fiducia.tone }}
                    />
                  </span>
                  <span className="text-label font-extrabold" style={{ color: fiducia.tone }}>
                    {fiducia.label}
                  </span>
                </span>
              </div>

              <Legenda
                infortunati={infortunati}
                scontenti={scontenti}
                giovani={giovani}
                senzaRicambio={senzaRicambio}
              />

              {standings.length > 0 && (
                <ul className="mt-2 max-h-52 overflow-y-auto rounded-control border border-[var(--surface-border)] bg-[var(--surface)]">
                  {standings.map((row) => (
                    <li
                      key={row.teamId}
                      className={`flex items-center gap-2 px-2.5 py-1 text-label ${
                        row.isUser ? "bg-[var(--brand)]/12 font-extrabold" : ""
                      }`}
                    >
                      <span
                        className="w-1 shrink-0 self-stretch rounded-full"
                        style={{
                          backgroundColor:
                            row.position <= 4
                              ? "#3ddc6b"
                              : row.position > teams - 3
                                ? "#ff4d4d"
                                : "transparent",
                        }}
                      />
                      <span className="w-5 shrink-0 text-label tabular-nums">{row.position}</span>
                      <span className="min-w-0 flex-1 truncate">{row.name}</span>
                      <span className="shrink-0 text-label tabular-nums text-[var(--text-secondary)]">
                        {row.goalsFor}:{row.goalsAgainst}
                      </span>
                      <span className="w-7 shrink-0 text-right font-extrabold tabular-nums">
                        {row.points}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Legenda({
  infortunati,
  scontenti,
  giovani,
  senzaRicambio,
}: {
  infortunati: number;
  scontenti: number;
  giovani: number;
  senzaRicambio: number;
}) {
  const voci = [
    { n: infortunati, testo: infortunati === 1 ? "infortunato" : "infortunati", colore: "#ff4d4d" },
    { n: scontenti, testo: scontenti === 1 ? "scontento" : "scontenti", colore: "#ff8a3d" },
    { n: giovani, testo: giovani === 1 ? "under 22" : "under 22", colore: "#3ddc6b" },
    {
      n: senzaRicambio,
      testo: senzaRicambio === 1 ? "casella senza ricambio" : "caselle senza ricambio",
      colore: "#ffab2e",
    },
  ].filter((v) => v.n > 0);

  if (voci.length === 0) {
    return (
      <p className="text-label text-[var(--text-secondary)]">
        Rosa al completo e serena: nessun infortunio, nessun malumore.
      </p>
    );
  }

  return (
    <p className="text-label text-[var(--text-secondary)]">
      {voci.map((v, i) => (
        <span key={v.testo}>
          {i > 0 && " · "}
          <strong className="font-bold" style={{ color: v.colore }}>
            {v.n}
          </strong>{" "}
          {v.testo}
        </span>
      ))}
    </p>
  );
}
