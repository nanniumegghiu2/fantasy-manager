import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Flame, Layers, ListTree, Play, ShieldQuestion, Trophy, Users } from "lucide-react";
import { FORMATIONS, REDRAFT_ALLOWANCE, getFormation } from "@app/game-engine";
import type { DraftMode, Difficulty } from "@app/game-engine";
import { ROLE_LABELS } from "@app/shared-types";
import { Pitch, PitchDot } from "./Pitch";
import { getSlotPosition } from "./pitchLayouts";
import type { DraftPoolChoice, LeagueChoice, SetupConfig } from "./types";

const DIFFICULTIES: { value: Difficulty; label: string; hint: string; quality: string }[] = [
  { value: "facile", label: "Facile", hint: `${REDRAFT_ALLOWANCE.facile} redraft`, quality: "campioni frequenti" },
  { value: "normale", label: "Normale", hint: `${REDRAFT_ALLOWANCE.normale} redraft`, quality: "campioni rari" },
  { value: "difficile", label: "Difficile", hint: "0 redraft", quality: "pescata reale" },
];

const MODES: { value: DraftMode; label: string; description: string; icon: typeof Users }[] = [
  {
    value: "per_squadra",
    label: "Per squadra",
    description: "Ogni round un pacchetto di 5 club: scegline uno e pesca dalla sua rosa.",
    icon: Users,
  },
  {
    value: "per_ruolo",
    label: "Per ruolo",
    description: "Scegli una casella dal campo: 5 candidati da squadre ed epoche diverse.",
    icon: ListTree,
  },
];

/** Anteprima del modulo scelto: le 11 caselle vuote sul campo, aggiornate ad ogni cambio. */
function FormationPreview({ formationId }: { formationId: string }) {
  const formation = getFormation(formationId)!;
  return (
    <Pitch>
      {formation.slots.map((slot) => {
        const pos = getSlotPosition(formation, slot);
        return (
          <PitchDot
            key={slot.id}
            x={pos.x}
            y={pos.y}
            label={ROLE_LABELS[slot.role]}
                shortLabel={slot.role}
            state="empty"
          />
        );
      })}
    </Pitch>
  );
}

const sectionMotion = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: "easeOut" as const },
});

/** Voce del selettore competizione: `null` è la Superlega, cioè tutti i Big 5 insieme. */
interface LeagueOption {
  value: LeagueChoice;
  label: string;
  hint: string;
}

interface SetupScreenProps {
  /** Campionati presenti nel pool, ricavati dai giocatori caricati. */
  leagues: string[];
  onStart: (config: SetupConfig) => void;
  onExit: () => void;
}

export function SetupScreen({ leagues, onStart, onExit }: SetupScreenProps) {
  const [formationId, setFormationId] = useState(FORMATIONS[0].id);
  const [mode, setMode] = useState<DraftMode>("per_squadra");
  const [difficulty, setDifficulty] = useState<Difficulty>("normale");
  const [league, setLeague] = useState<LeagueChoice>(null);
  const [draftPool, setDraftPool] = useState<DraftPoolChoice>("campionato");

  const leagueOptions: LeagueOption[] = [
    {
      value: null,
      label: "Superlega",
      hint: "i 19 club più forti d'Europa · pool aperto a tutti i Big 5",
    },
    ...leagues.map((name) => ({
      value: name as LeagueChoice,
      label: name,
      hint: "pool e avversarie del solo campionato",
    })),
  ];

  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--surface-border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onExit}
          aria-label="Torna alla home"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-base font-extrabold">Modalità Classica Rapida</h1>
      </header>

      <main className="mx-auto grid w-full max-w-4xl flex-1 gap-7 px-4 py-6 md:grid-cols-[1fr_minmax(0,300px)] md:items-start">
        <div className="flex flex-col gap-7">
          <motion.section {...sectionMotion(0)}>
            <SectionTitle icon={Trophy}>Competizione</SectionTitle>
            <p className="mb-3 text-xs text-[var(--text-secondary)]">
              Decide da quale pool peschi nel draft e contro chi giochi le 38 giornate.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {leagueOptions.map(({ value, label, hint }) => {
                const active = league === value;
                return (
                  <motion.button
                    key={label}
                    type="button"
                    onClick={() => setLeague(value)}
                    whileTap={{ scale: 0.96 }}
                    aria-pressed={active}
                    title={hint}
                    className={`relative rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
                      active
                        ? "border-[var(--brand)] text-[var(--brand-contrast)]"
                        : "border-[var(--surface-border)] bg-[var(--surface-raised)] hover:border-[var(--brand)]"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="league-pill"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-xl bg-[var(--brand)]"
                      />
                    )}
                    <span className="relative">{label}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Con la Superlega il pool è già tutto il database: la scelta non avrebbe senso. */}
            {league !== null && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
                  Da dove peschi nel draft
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: "campionato", label: `Solo ${league}`, hint: "rosa fedele al campionato" },
                      { value: "tutti", label: "Tutto il database", hint: "pesca da tutta Europa" },
                    ] as const
                  ).map(({ value, label, hint }) => {
                    const active = draftPool === value;
                    return (
                      <motion.button
                        key={value}
                        type="button"
                        onClick={() => setDraftPool(value)}
                        whileTap={{ scale: 0.97 }}
                        aria-pressed={active}
                        className={`flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5 transition-colors ${
                          active
                            ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-contrast)]"
                            : "border-[var(--surface-border)] bg-[var(--surface-raised)] hover:border-[var(--brand)]"
                        }`}
                      >
                        <span className="truncate text-sm font-bold">{label}</span>
                        <span
                          className={`text-[10px] leading-tight ${
                            active ? "text-[var(--brand-contrast)]/75" : "text-[var(--text-secondary)]"
                          }`}
                        >
                          {hint}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.section>

          <motion.section {...sectionMotion(0.04)}>
            <SectionTitle icon={Layers}>Modulo</SectionTitle>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {FORMATIONS.map((formation) => {
                const active = formationId === formation.id;
                return (
                  <motion.button
                    key={formation.id}
                    type="button"
                    onClick={() => setFormationId(formation.id)}
                    whileTap={{ scale: 0.94 }}
                    aria-pressed={active}
                    className={`relative rounded-xl border px-3 py-3 text-sm font-bold transition-colors ${
                      active
                        ? "border-[var(--brand)] text-[var(--brand-contrast)]"
                        : "border-[var(--surface-border)] bg-[var(--surface-raised)] hover:border-[var(--brand)]"
                    }`}
                  >
                    {/* Il riquadro attivo scivola da un modulo all'altro invece di apparire di scatto. */}
                    {active && (
                      <motion.span
                        layoutId="formation-pill"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-xl bg-[var(--brand)]"
                      />
                    )}
                    <span className="relative">{formation.name}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.section>

          {/* Su mobile l'anteprima sta qui, subito sotto la scelta del modulo. */}
          <motion.div {...sectionMotion(0.06)} className="md:hidden">
            <PreviewPanel formationId={formationId} />
          </motion.div>

          <motion.section {...sectionMotion(0.12)}>
            <SectionTitle icon={ListTree}>Modalità di draft</SectionTitle>
            <div className="flex flex-col gap-2">
              {MODES.map(({ value, label, description, icon: Icon }) => {
                const active = mode === value;
                return (
                  <motion.button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    whileTap={{ scale: 0.98 }}
                    aria-pressed={active}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                      active
                        ? "border-[var(--brand)] bg-[var(--brand)]/8"
                        : "border-[var(--surface-border)] bg-[var(--surface-raised)] hover:border-[var(--brand)]"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                          : "bg-[var(--surface)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <Icon size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold">{label}</span>
                      <span className="block text-xs leading-relaxed text-[var(--text-secondary)]">
                        {description}
                      </span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.section>

          <motion.section {...sectionMotion(0.18)}>
            <SectionTitle icon={ShieldQuestion}>Difficoltà</SectionTitle>
            <p className="mb-3 text-xs text-[var(--text-secondary)]">
              Quanti redraft hai a disposizione e quanto spesso i pacchetti propongono giocatori forti.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map(({ value, label, hint, quality }, index) => {
                const active = difficulty === value;
                return (
                  <motion.button
                    key={value}
                    type="button"
                    onClick={() => setDifficulty(value)}
                    whileTap={{ scale: 0.94 }}
                    aria-pressed={active}
                    className={`relative flex flex-col items-center gap-1 rounded-xl border px-3 py-3 transition-colors ${
                      active
                        ? "border-[var(--brand)] text-[var(--brand-contrast)]"
                        : "border-[var(--surface-border)] bg-[var(--surface-raised)] hover:border-[var(--brand)]"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="difficulty-pill"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-xl bg-[var(--brand)]"
                      />
                    )}
                    <span className="relative flex items-center gap-1 text-sm font-bold">
                      {Array.from({ length: index + 1 }).map((_, i) => (
                        <Flame key={i} size={12} />
                      ))}
                      {label}
                    </span>
                    <span
                      className={`relative text-xs ${
                        active ? "text-[var(--brand-contrast)]/80" : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {hint}
                    </span>
                    <span
                      className={`relative text-[10px] leading-tight ${
                        active ? "text-[var(--brand-contrast)]/70" : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {quality}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.section>
        </div>

        <motion.aside {...sectionMotion(0.06)} className="hidden md:sticky md:top-20 md:block">
          <PreviewPanel formationId={formationId} />
        </motion.aside>
      </main>

      <footer className="sticky bottom-0 border-t border-[var(--surface-border)] bg-[var(--surface)]/95 px-4 py-4 backdrop-blur">
        <motion.button
          type="button"
          onClick={() =>
            onStart({
              formationId,
              mode,
              difficulty,
              league,
              // Con la Superlega il pool e gia' tutto il database.
              draftPool: league === null ? "tutti" : draftPool,
            })
          }
          whileTap={{ scale: 0.97 }}
          className="mx-auto flex w-full max-w-4xl items-center justify-center gap-2.5 rounded-2xl bg-[var(--brand)] px-5 py-4 text-base font-extrabold text-[var(--brand-contrast)] shadow-lg transition-transform"
        >
          <Play size={19} fill="currentColor" />
          Inizia il draft
        </motion.button>
      </footer>
    </div>
  );
}

function PreviewPanel({ formationId }: { formationId: string }) {
  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3">
      <p className="mb-2 text-center text-xs font-bold tracking-wide text-[var(--text-secondary)] uppercase">
        Anteprima {formationId}
      </p>
      <div className="mx-auto max-w-[240px] md:max-w-none">
        <FormationPreview formationId={formationId} />
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: typeof Layers;
  children: React.ReactNode;
}) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--text-secondary)] uppercase">
      <Icon size={15} />
      {children}
    </h2>
  );
}
