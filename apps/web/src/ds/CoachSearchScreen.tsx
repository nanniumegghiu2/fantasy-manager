import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Filter,
  Lock,
  Search,
  Shield,
  Sprout,
  Star,
  Swords,
  Unlock,
  X,
} from "lucide-react";
import {
  FORMATION_CODES,
  searchCoaches,
  type Coach,
  type CoachSearchResult,
  type CoachSortKey,
  type CoachStatusFilter,
  type CoachStyleFilter,
} from "@app/game-engine";
import { NationFlag } from "../classic/NationFlag";
import { euro } from "./format";

/**
 * **La ricerca allenatori.**
 *
 * Due regole di prodotto, entrambe chieste dall'utente:
 *
 * 1. **le pretese non si vedono in lista.** Qui c'è chi è (modulo, stile, scuola, reputazione,
 *    stato contrattuale) e quanto costa **strapparlo** al suo club — che è un fatto pubblico.
 *    Quanto vuole per sé lo si scopre al tavolo, insieme alle sue richieste tecniche;
 * 2. **si cerca, non si scorre**: filtri per modulo, stato contrattuale, reputazione, stile e
 *    attitudine ai giovani, su un catalogo di oltre cento tecnici.
 */

const STATI: { id: CoachStatusFilter; label: string }[] = [
  { id: "tutti", label: "Tutti" },
  { id: "svincolati", label: "Svincolati" },
  { id: "sotto_contratto", label: "Sotto contratto" },
];

const STILI: { id: CoachStyleFilter; label: string }[] = [
  { id: "tutti", label: "Qualsiasi" },
  { id: "offensivo", label: "Offensivo" },
  { id: "equilibrato", label: "Equilibrato" },
  { id: "difensivo", label: "Difensivo" },
];

const ORDINI: { id: CoachSortKey; label: string }[] = [
  { id: "reputazione", label: "Reputazione" },
  { id: "sviluppo", label: "Giovani" },
  { id: "attacco", label: "Attacco" },
  { id: "difesa", label: "Difesa" },
  { id: "nome", label: "Nome" },
];

function Stelle({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Reputazione ${n} su 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={11}
          className={i < n ? "fill-amber-400 text-amber-400" : "text-[var(--surface-border)]"}
        />
      ))}
    </span>
  );
}

function CoachRow({
  result,
  isDefault,
  onOpen,
}: {
  result: CoachSearchResult;
  isDefault: boolean;
  onOpen: () => void;
}) {
  const { coach, status, buyoutFee, currentClubName } = result;

  return (
    <motion.button
      type="button"
      layout
      onClick={onOpen}
      whileTap={{ scale: 0.985 }}
      className="flex w-full flex-col gap-2.5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3.5 text-left transition-colors hover:border-[var(--brand)]/60"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[11px] font-extrabold tabular-nums">
          {coach.formationId}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-extrabold">{coach.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[var(--text-secondary)]">
            <NationFlag nation={coach.nation} />
            {coach.tacticalPhilosophy ?? coach.nation}
          </p>
        </div>
        <Stelle n={coach.reputation} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
        {isDefault ? (
          <span className="rounded-lg bg-emerald-500/20 px-2 py-1 text-emerald-400">
            Mister in carica
          </span>
        ) : status === "libero" ? (
          <span className="flex items-center gap-1 rounded-lg bg-[#5aa9e6]/20 px-2 py-1 text-[#5aa9e6]">
            <Unlock size={11} /> Svincolato
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-lg bg-[#ff8a3d]/20 px-2 py-1 text-[#ff8a3d]">
            <Lock size={11} /> Sotto contratto{currentClubName ? ` · ${currentClubName}` : ""}
          </span>
        )}

        <span className="flex items-center gap-1 rounded-lg bg-[var(--surface)] px-2 py-1 text-[var(--text-secondary)]">
          <Swords size={11} />
          {coach.style.attack > 0 ? `+${coach.style.attack}` : coach.style.attack}
          <Shield size={11} className="ml-1" />
          {coach.style.defence > 0 ? `+${coach.style.defence}` : coach.style.defence}
        </span>

        {coach.development >= 1.45 && (
          <span className="flex items-center gap-1 rounded-lg bg-[#3ddc6b]/15 px-2 py-1 text-[#3ddc6b]">
            <Sprout size={11} /> Bravo coi giovani
          </span>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--surface-border)] pt-2">
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
          {/* Le pretese economiche NON si mostrano qui: si scoprono in trattativa. */}
          Richieste da scoprire al tavolo
        </span>
        {buyoutFee > 0 ? (
          <span className="text-right">
            <span className="block text-sm font-extrabold text-[#ff8a3d]">{euro(buyoutFee)}</span>
            <span className="block text-[9px] font-bold tracking-wide text-[var(--text-secondary)] uppercase">
              penale al club
            </span>
          </span>
        ) : (
          <span className="text-[11px] font-extrabold text-[var(--brand)]">Tratta →</span>
        )}
      </div>
    </motion.button>
  );
}

interface CoachSearchScreenProps {
  clubPrestige: number;
  currentCoachId?: string | null;
  /** Chi allena chi adesso, per la penale di riscatto. */
  occupied?: Record<string, { clubId: string; clubName: string; seasonsLeft?: number }>;
  title?: string;
  subtitle?: string;
  onOpen: (coach: Coach, buyoutFee: number) => void;
  onBack: () => void;
}

export function CoachSearchScreen({
  clubPrestige,
  currentCoachId,
  occupied,
  title = "Mercato allenatori",
  subtitle,
  onOpen,
  onBack,
}: CoachSearchScreenProps) {
  const [testo, setTesto] = useState("");
  const [moduli, setModuli] = useState<string[]>([]);
  const [stato, setStato] = useState<CoachStatusFilter>("tutti");
  const [stile, setStile] = useState<CoachStyleFilter>("tutti");
  const [minRep, setMinRep] = useState(1);
  const [giovani, setGiovani] = useState(false);
  const [ordine, setOrdine] = useState<CoachSortKey>("reputazione");
  const [filtriAperti, setFiltriAperti] = useState(false);

  const risultati = useMemo(
    () =>
      searchCoaches({
        clubPrestigeTier: clubPrestige,
        currentCoachId,
        occupied,
        text: testo.trim() || undefined,
        formations: moduli.length > 0 ? moduli : undefined,
        status: stato,
        style: stile,
        minReputation: minRep > 1 ? minRep : undefined,
        youthOnly: giovani || undefined,
        sort: ordine,
      }),
    [clubPrestige, currentCoachId, occupied, testo, moduli, stato, stile, minRep, giovani, ordine],
  );

  const toggleModulo = (codice: string) =>
    setModuli((prev) => (prev.includes(codice) ? prev.filter((m) => m !== codice) : [...prev, codice]));

  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Indietro"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0 flex-1">
            {subtitle && (
              <p className="truncate text-[11px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                {subtitle}
              </p>
            )}
            <h1 className="truncate text-lg leading-tight font-extrabold">{title}</h1>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--surface-raised)] px-2.5 py-1 text-xs font-extrabold tabular-nums">
            {risultati.length}
          </span>
        </div>

        <div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-4 pb-3">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2">
            <Search size={15} className="shrink-0 text-[var(--text-secondary)]" />
            <input
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              placeholder="Nome, nazione o filosofia"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-secondary)]"
            />
            {testo && (
              <button type="button" onClick={() => setTesto("")} aria-label="Cancella ricerca">
                <X size={14} className="text-[var(--text-secondary)]" />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setFiltriAperti((v) => !v)}
            aria-expanded={filtriAperti}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              filtriAperti || moduli.length > 0 || stato !== "tutti" || stile !== "tutti" || minRep > 1 || giovani
                ? "border-[var(--brand)] bg-[var(--brand)]/15 text-[var(--brand)]"
                : "border-[var(--surface-border)] text-[var(--text-secondary)]"
            }`}
          >
            <Filter size={16} />
          </button>
        </div>

        {filtriAperti && (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 border-t border-[var(--surface-border)] px-4 py-3">
            <div>
              <p className="mb-1.5 text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
                Modulo
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FORMATION_CODES.map((codice) => (
                  <button
                    key={codice}
                    type="button"
                    onClick={() => toggleModulo(codice)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold tabular-nums transition-colors ${
                      moduli.includes(codice)
                        ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                        : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {codice}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
                  Contratto
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STATI.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStato(s.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                        stato === s.id
                          ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                          : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
                  Stile
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STILI.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStile(s.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                        stile === s.id
                          ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                          : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
                Reputazione min.
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={minRep}
                  onChange={(e) => setMinRep(Number(e.target.value))}
                  className="w-24 accent-[var(--brand)]"
                />
                <Stelle n={minRep} />
              </label>

              <button
                type="button"
                onClick={() => setGiovani((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                  giovani
                    ? "bg-[#3ddc6b]/20 text-[#3ddc6b]"
                    : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
                }`}
              >
                <Sprout size={12} /> Solo chi lancia i giovani
              </button>

              <label className="ml-auto flex items-center gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
                Ordina
                <select
                  value={ordine}
                  onChange={(e) => setOrdine(e.target.value as CoachSortKey)}
                  className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-raised)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]"
                >
                  {ORDINI.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto grid w-full max-w-4xl flex-1 gap-3 px-4 py-4 pb-24 sm:grid-cols-2">
        {risultati.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-[var(--surface-border)] p-6 text-center text-sm text-[var(--text-secondary)]">
            Nessun tecnico con questi criteri. Allarga i filtri.
          </p>
        )}
        {risultati.map((r) => (
          <CoachRow
            key={r.coach.id}
            result={r}
            isDefault={r.status === "in_carica"}
            onOpen={() => onOpen(r.coach, r.buyoutFee)}
          />
        ))}
      </main>
    </div>
  );
}
