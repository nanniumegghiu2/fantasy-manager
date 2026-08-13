import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, Handshake, MessagesSquare, ShieldAlert } from "lucide-react";
import {
  dressingRoom,
  type CareerState,
  type CareerWorld,
  type DressingRoomEntry,
} from "@app/game-engine";

/**
 * **Lo Spogliatoio: chi ha davvero qualcosa da dire.**
 *
 * Non è più "chi ha il morale sotto 55": è chi trova un **tema ammissibile** sui fatti
 * (`playerTopics.ts`). Chi non ha nulla che il club possa concedergli non compare, ed è la
 * differenza fra uno spogliatoio e un ufficio reclami.
 *
 * In coda, gli **impegni presi**: i debiti contratti in conversazione si vedevano solo quando
 * venivano infranti.
 */

function Urgenza({ n }: { n: number }) {
  const acceso = n >= 80 ? 3 : n >= 55 ? 2 : 1;
  return (
    <span className="flex items-center gap-0.5" aria-label={`Urgenza ${acceso} su 3`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: i < acceso ? (acceso === 3 ? "#ff4d4d" : acceso === 2 ? "#ff8a3d" : "#8fd4a4") : "var(--surface-border)" }}
        />
      ))}
    </span>
  );
}

function Barra({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[9px] font-bold tracking-wide text-[var(--text-secondary)] uppercase">{label}</span>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--surface)]">
        <span className="block h-full rounded-full" style={{ width: `${value}%`, backgroundColor: tone }} />
      </span>
      <span className="text-[10px] font-bold tabular-nums text-[var(--text-secondary)]">{value}</span>
    </span>
  );
}

function Riga({ voce, onApri }: { voce: DressingRoomEntry; onApri: () => void }) {
  return (
    <motion.button
      type="button"
      layout
      onClick={onApri}
      whileTap={{ scale: 0.985 }}
      className={`flex w-full flex-col gap-2 rounded-2xl border p-3 text-left transition-colors ${
        voce.feud
          ? "border-[#ff4d4d]/60 bg-[#ff4d4d]/5"
          : voce.blocking
            ? "border-[#ff8a3d]/50 bg-[#ff8a3d]/5"
            : "border-[var(--surface-border)] bg-[var(--surface-raised)]"
      }`}
    >
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-extrabold">{voce.name}</p>
        {voce.feud && (
          <span className="flex items-center gap-1 rounded-lg bg-[#ff4d4d]/20 px-1.5 py-0.5 text-[9px] font-extrabold text-[#ff4d4d]">
            <ShieldAlert size={10} /> ROTTURA
          </span>
        )}
        {voce.contractSeasonsLeft <= 1 && (
          <span className="flex items-center gap-1 rounded-lg bg-[#ff8a3d]/20 px-1.5 py-0.5 text-[9px] font-extrabold text-[#ff8a3d]">
            <Clock size={10} /> IN SCADENZA
          </span>
        )}
        <Urgenza n={voce.urgency} />
      </div>

      <p className="text-[11px] leading-snug text-[var(--text-secondary)]">▸ {voce.demand}</p>

      <div className="flex items-center gap-3">
        <Barra label="Fiducia" value={voce.trust} tone="#5aa9e6" />
        <Barra label="Morale" value={voce.morale} tone={voce.morale < 40 ? "#ff4d4d" : "#3ddc6b"} />
      </div>
    </motion.button>
  );
}

export function SpogliatoioPanel({
  state,
  world,
  chiuse,
  onApri,
}: {
  state: CareerState;
  world: CareerWorld;
  /**
   * Chi ha già avuto la sua conversazione in questa finestra.
   *
   * La tregua vera vive nel motore (`playerTopics.ts`, `inTregua`), ma copre solo le chat
   * **risolte**: chiudere la finestra senza rispondere non è una risposta, e senza questo
   * elenco il giocatore restava in lista — il difetto segnalato dall'utente.
   */
  chiuse?: ReadonlySet<string>;
  onApri: (playerId: string) => void;
}) {
  const voci = useMemo(
    () => dressingRoom(state, world).filter((v) => !chiuse?.has(v.playerId)),
    [state, world, chiuse],
  );
  const impegni = state.commitments ?? [];
  const nomeDi = (id?: string) =>
    id ? (voci.find((v) => v.playerId === id)?.name ?? world.players[id]?.name ?? "Un giocatore") : "Il mister";

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-extrabold">
          <MessagesSquare size={15} className="text-[var(--brand)]" /> Spogliatoio
        </h3>
        <span className="text-[11px] font-bold text-[var(--text-secondary)]">
          {voci.length === 0 ? "nessun argomento" : `${voci.length} argomenti`}
        </span>
      </header>

      {voci.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--surface-border)] p-5 text-center text-xs text-[var(--text-secondary)]">
          Nessuno ha niente da dirti adesso. È un buon segno.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {voci.map((v) => (
            <Riga key={v.playerId} voce={v} onApri={() => onApri(v.playerId)} />
          ))}
        </div>
      )}

      {impegni.length > 0 && (
        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3">
          <p className="flex items-center gap-2 text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
            <Handshake size={12} /> Impegni presi · {impegni.length}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {impegni.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-[11px]">
                <AlertTriangle size={11} className="mt-0.5 shrink-0 text-[#ff8a3d]" />
                <span className="min-w-0 flex-1">
                  <strong>{nomeDi(c.playerId)}</strong> — {c.description}
                  <span className="ml-1 text-[var(--text-secondary)]">
                    ({c.verifyAt === "matchday" ? `entro la ${c.deadline}ª giornata` : c.verifyAt === "window" ? "entro fine mercato" : "a fine stagione"})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
