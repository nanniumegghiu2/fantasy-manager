import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Armchair, ChevronDown, ShieldQuestion } from "lucide-react";
import {
  CAPTAIN_DESIRE_THRESHOLD,
  captainOf,
  careerPlayers,
  squadCaptaincyClaims,
  type CareerState,
  type CareerWorld,
} from "@app/game-engine";

/**
 * **La fascia, sempre a vista nella Rosa.**
 *
 * Chi la porta è un'informazione di spogliatoio, non un dettaglio: decide chi si sente leader e
 * chi si sente scavalcato. Prima `captainId` esisteva nello stato ma non compariva da nessuna
 * parte, quindi il giocatore non poteva nemmeno sapere di averla data a qualcuno.
 *
 * La scelta è **del mister**: qui si può proporre un altro nome, e lui risponde. Le candidature
 * sono mostrate col loro motivo (bandiera o leader tecnico), perché è quello a rendere
 * comprensibile un rifiuto.
 */
export function CaptaincyCard({
  state,
  world,
  onPropose,
}: {
  state: CareerState;
  world: CareerWorld;
  /** Propone un nuovo capitano al mister; torna la sua risposta. */
  onPropose?: (playerId: string) => { ok: boolean; message: string };
}) {
  const [aperto, setAperto] = useState(false);
  const [risposta, setRisposta] = useState<{ ok: boolean; message: string } | null>(null);

  const capitano = useMemo(() => captainOf(state, world), [state, world]);
  const claims = useMemo(() => squadCaptaincyClaims(state, world), [state, world]);
  const anagrafica = useMemo(() => careerPlayers(state, world), [state, world]);
  const nomeDi = (id: string) => anagrafica[id]?.name ?? "Giocatore";

  const aspiranti = claims.filter(
    (c) => c.playerId !== capitano && c.score >= CAPTAIN_DESIRE_THRESHOLD,
  );
  const claimCapitano = claims.find((c) => c.playerId === capitano);

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
          <Armchair size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold tracking-widest text-amber-300/80 uppercase">
            Fascia di capitano
          </p>
          <p className="truncate text-sm font-extrabold">
            {capitano ? nomeDi(capitano) : "Nessun capitano designato"}
          </p>
          <p className="truncate text-[11px] text-[var(--text-secondary)]">
            {claimCapitano && claimCapitano.reasons.length > 0
              ? claimCapitano.reasons.join(" · ")
              : "Il mister non ha trovato un leader riconosciuto in questo spogliatoio."}
          </p>
        </div>
        {onPropose && (
          <button
            type="button"
            onClick={() => setAperto((v) => !v)}
            aria-expanded={aperto}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/40 px-2 py-1 text-[10px] font-extrabold text-amber-300"
          >
            Discuti <ChevronDown size={11} className={aperto ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        )}
      </div>

      {aspiranti.length > 0 && !aperto && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#ff8a3d]">
          <ShieldQuestion size={12} />
          {aspiranti.length === 1
            ? `${nomeDi(aspiranti[0]!.playerId)} la vorrebbe.`
            : `${aspiranti.length} giocatori la vorrebbero.`}
        </p>
      )}

      {aperto && onPropose && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 flex flex-col gap-1.5 overflow-hidden border-t border-amber-500/20 pt-3"
        >
          <p className="text-[11px] leading-snug text-[var(--text-secondary)]">
            La fascia la assegna il mister. Puoi proporgli un altro nome: se toglie la fascia a chi
            se l'è guadagnata, quello **non la prenderà bene**.
          </p>

          {claims.slice(0, 6).map((c) => {
            const attuale = c.playerId === capitano;
            return (
              <button
                key={c.playerId}
                type="button"
                disabled={attuale}
                onClick={() => setRisposta(onPropose(c.playerId))}
                className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                  attuale
                    ? "cursor-default bg-amber-500/15"
                    : "bg-[var(--surface-raised)] hover:bg-[var(--surface)]"
                }`}
              >
                <span className="w-8 shrink-0 text-center text-[11px] font-extrabold tabular-nums text-amber-300">
                  {c.score}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold">{nomeDi(c.playerId)}</span>
                  <span className="block truncate text-[10px] text-[var(--text-secondary)]">
                    {c.reasons.length > 0 ? c.reasons.join(" · ") : "nessuna candidatura forte"}
                  </span>
                </span>
                {attuale && (
                  <span className="shrink-0 text-[9px] font-extrabold text-amber-300 uppercase">
                    capitano
                  </span>
                )}
              </button>
            );
          })}

          {risposta && (
            <p
              className="rounded-xl px-2.5 py-2 text-[11px] font-bold"
              style={{
                backgroundColor: risposta.ok ? "#3ddc6b22" : "#ff4d4d22",
                color: risposta.ok ? "#2a9b4d" : "#ff4d4d",
              }}
            >
              «{risposta.message}»
            </p>
          )}
        </motion.div>
      )}
    </section>
  );
}
