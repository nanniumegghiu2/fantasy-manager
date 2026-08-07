import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  CalendarDays,
  ChevronRight,
  Layers,
  LogIn,
  Play,
  Swords,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { CAREER_SEASONS, FORMATIONS, LEVELS } from "@app/game-engine";
import type { Profile } from "@app/shared-types";
import { ClassicMode } from "../classic/ClassicMode";
import { DsMode } from "../ds/DsMode";
import { ThemeToggle } from "./ThemeToggle";
import { ProfileMenu } from "./ProfileMenu";

const SEASON_MATCHES = 38;

/**
 * Le 38 giornate come striscia di tacche che si accendono in sequenza: rende visibile a
 * colpo d'occhio l'obiettivo del gioco (38 vittorie su 38) senza spiegarlo a parole.
 */
function SeasonStrip() {
  return (
    <div
      aria-hidden
      className="grid max-w-xs gap-1"
      // 19 colonne = girone di andata sopra, ritorno sotto: due righe piene su qualsiasi
      // larghezza, invece di un a capo casuale dettato dallo spazio disponibile.
      style={{ gridTemplateColumns: `repeat(${SEASON_MATCHES / 2}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: SEASON_MATCHES }).map((_, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0.15, scaleY: 0.4 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: 0.35 + i * 0.025, duration: 0.28, ease: "easeOut" }}
          className="h-5 rounded-full bg-emerald-400"
        />
      ))}
    </div>
  );
}

/** Fondo del pannello hero: linee di campo originali, nessun asset ufficiale (sez. 2). */
function PitchBackdrop() {
  return (
    <svg
      viewBox="0 0 100 60"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]"
    >
      <g stroke="#ffffff" strokeWidth="0.4" fill="none">
        <line x1="50" y1="0" x2="50" y2="60" />
        <circle cx="50" cy="30" r="9" />
        
        <rect x="-1" y="17" width="15" height="26" />
        <rect x="-1" y="25" width="5.5" height="10" />
        <rect x="86" y="17" width="15" height="26" />
        <rect x="95.5" y="25" width="5.5" height="10" />
      </g>
    </svg>
  );
}

/**
 * Card livello con barra di avanzamento verso il livello successivo: dà un senso di
 * progressione visibile appena si apre l'app, invece del solo numero di punti.
 */
function LevelCard({ profile }: { profile: Profile }) {
  const current = LEVELS.find((l) => l.id === profile.livelloId);
  const next = current ? LEVELS.find((l) => l.order === current.order + 1) : undefined;
  const from = current?.pointsThreshold ?? 0;
  const progress = next
    ? Math.min(100, Math.max(0, ((profile.puntiLivello - from) / (next.pointsThreshold - from)) * 100))
    : 100;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4 sm:col-span-2">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-contrast)]">
          <Trophy size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
            Livello attuale
          </p>
          <p className="truncate text-lg leading-tight font-extrabold">
            {current?.name ?? profile.livelloId}
          </p>
        </div>
        <span className="ml-auto shrink-0 text-right text-sm font-extrabold">
          {profile.puntiLivello}
          <span className="block text-[10px] font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
            punti
          </span>
        </span>
      </div>

      <div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
            className="h-full rounded-full bg-[var(--accent)]"
          />
        </div>
        <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
          {next
            ? `${next.pointsThreshold - profile.puntiLivello} punti a ${next.name}`
            : "Hai raggiunto il livello massimo"}
        </p>
      </div>
    </div>
  );
}

const UPCOMING_MODES = [
  {
    icon: Swords,
    label: "Sfida 1v1",
    description: "Draft con budget di mercato e aste segrete, poi match a 90 secondi.",
  },
  {
    icon: Users,
    label: "Mini torneo",
    description: "Fino a 4 mister, semifinali e finale con codice invito.",
  },
  {
    icon: CalendarDays,
    label: "Sfide giornaliere",
    description: "Un obiettivo nuovo ogni giorno, recuperabile per tutto il mese.",
  },
];

/**
 * Quale modalità si sta giocando. Era un booleano `playing` quando ne esisteva una sola:
 * con due modalità un booleano non basta più, e un discriminante rende gratuito aggiungerne
 * una terza.
 */
type Mode = "home" | "classica" | "ds";

/**
 * Una delle due modalità offline.
 *
 * Le due card condividono struttura e altezza (`h-full` su una griglia a due colonne): il peso
 * visivo è la cosa che l'occhio legge per prima, e renderle diverse comunicherebbe una
 * gerarchia che non c'è.
 */
function ModeCard({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  title,
  description,
  cta,
  ctaIcon: CtaIcon,
  onClick,
  footer,
  delay,
  copper,
}: {
  eyebrow: string;
  eyebrowIcon: typeof Zap;
  title: string;
  description: string;
  cta: string;
  ctaIcon: typeof Play;
  onClick: () => void;
  footer: ReactNode;
  delay: number;
  copper?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      whileTap={{ scale: 0.985 }}
      // `min-h` oltre a `h-full`: in colonna singola (telefono) ogni riga della griglia ha
      // altezza propria, quindi senza un minimo le due card risulterebbero diverse proprio
      // dove si vedono una sotto l'altra.
      className={`group relative flex h-full min-h-[21rem] flex-col overflow-hidden rounded-3xl p-6 text-left text-white shadow-lg ${
        // Rame contro verde muschio: le due modalità si distinguono a colpo d'occhio senza
        // introdurre colori estranei alla palette del logo (sez. 8).
        copper
          ? "bg-gradient-to-br from-copper-500 to-pitch-950"
          : "bg-gradient-to-br from-pitch-700 to-pitch-950"
      }`}
    >
      <PitchBackdrop />

      <div className="relative flex flex-1 flex-col gap-4">
        <span className="flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold tracking-widest text-copper-300 uppercase">
          <EyebrowIcon size={12} />
          {eyebrow}
        </span>

        <div>
          <h2 className="text-2xl leading-[1.1] font-extrabold tracking-tight text-balance">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{description}</p>
        </div>

        <div className="mt-auto flex flex-col gap-4">
          {footer}
          <span className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-5 py-3.5 text-base font-extrabold text-pitch-900 shadow-md">
            <CtaIcon size={18} fill={CtaIcon === Play ? "currentColor" : "none"} />
            {cta}
            <ChevronRight size={17} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </motion.button>
  );
}

interface HomeScreenProps {
  profile: Profile | null;
  onExitGuest?: () => void;
}

export function HomeScreen({ profile, onExitGuest }: HomeScreenProps) {
  const [mode, setMode] = useState<Mode>("home");

  if (mode === "classica") {
    return <ClassicMode onExit={() => setMode("home")} />;
  }
  if (mode === "ds") {
    return <DsMode userId={profile?.id ?? null} onExit={() => setMode("home")} />;
  }

  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src="/logo-512.png" alt="" className="h-8 w-8" />
          <span className="text-base font-extrabold tracking-tight">Fantasy Manager</span>
        </div>

        {profile ? (
          <ProfileMenu profile={profile} />
        ) : (
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={onExitGuest}
              className="flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-semibold transition-colors hover:border-[var(--brand)]"
            >
              <LogIn size={16} />
              Accedi
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-4 py-5">
        {/* Le due modalità offline, con lo **stesso peso visivo**: sono due modi diversi di
            giocare, non uno principale e uno secondario. Una card più piccola dell'altra
            direbbe implicitamente quale delle due conta, e non è così. */}
        <section className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            delay={0}
            eyebrow="Partita rapida"
            eyebrowIcon={Zap}
            title="38-0-0"
            description="Pesca 11 titolari a pacchetti, cura l'intesa e prova a vincerle tutte. Dieci minuti."
            cta="Gioca ora"
            ctaIcon={Play}
            onClick={() => setMode("classica")}
            footer={
              <div className="flex flex-col gap-2">
                <SeasonStrip />
                <p className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-white/60 uppercase">
                  <Target size={13} className="text-emerald-400" />
                  38 vinte · 0 pari · 0 perse
                </p>
              </div>
            }
          />

          <ModeCard
            delay={0.08}
            eyebrow="Carriera"
            eyebrowIcon={Briefcase}
            title="Direttore sportivo"
            description={`${CAREER_SEASONS} stagioni alla guida di un club vero. Il mercato è il cuore: compra, vendi, fai crescere i giovani.`}
            cta="Inizia la carriera"
            ctaIcon={Briefcase}
            onClick={() => setMode("ds")}
            copper
            footer={
              <ul className="flex flex-wrap gap-1.5">
                {["Mercato libero", "Prestiti", "Corona Continentale", "Giovani da valorizzare"].map(
                  (voce) => (
                    <li
                      key={voce}
                      className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/75"
                    >
                      {voce}
                    </li>
                  ),
                )}
              </ul>
            }
          />
        </section>

        {/* Profilo: numeri in evidenza per chi ha un account, invito all'accesso per gli ospiti. */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
        >
          {profile ? (
            <div className="grid gap-2.5 sm:grid-cols-3">
              <LevelCard profile={profile} />
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4 sm:flex-col sm:items-start sm:justify-center">
                <Target size={20} className="shrink-0 text-[var(--accent)]" />
                <div className="sm:mt-1">
                  <p className="text-2xl leading-none font-extrabold">
                    {profile.perfect38Count}
                  </p>
                  <p className="mt-1 text-[11px] leading-tight font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
                    Stagioni perfette 38-0-0
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold">Stai giocando come ospite</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Accedi per salvare i risultati e sbloccare livelli, classifiche e sfide.
                </p>
              </div>
              <button
                type="button"
                onClick={onExitGuest}
                className="flex shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-bold transition-colors hover:border-[var(--brand)]"
              >
                <LogIn size={16} />
                Accedi
              </button>
            </div>
          )}
        </motion.section>

        {/* Roadmap visibile: dà profondità alla home senza promettere cose già pronte. */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16, ease: "easeOut" }}
        >
          <h2 className="mb-3 text-sm font-bold tracking-wide text-[var(--text-secondary)] uppercase">
            In arrivo
          </h2>
          <ul className="grid gap-2.5 sm:grid-cols-3">
            {UPCOMING_MODES.map(({ icon: Icon, label, description }) => (
              <li
                key={label}
                className="relative flex flex-col gap-2 rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-raised)]/60 p-4"
              >
                <span className="absolute top-3 right-3 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--accent)] uppercase">
                  Presto
                </span>
                <Icon size={19} className="text-[var(--text-secondary)]" />
                <span className="text-sm font-bold">{label}</span>
                <span className="text-xs leading-relaxed text-[var(--text-secondary)]">
                  {description}
                </span>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.24, ease: "easeOut" }}
        >
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--text-secondary)] uppercase">
            <Layers size={15} />
            {FORMATIONS.length} moduli disponibili
          </h2>
          <p className="mb-3 text-sm text-[var(--text-secondary)]">
            Scegli lo schema prima del draft: cambia le caselle da riempire e le linee
            d'intesa in campo.
          </p>
          <ul className="flex flex-wrap gap-2">
            {FORMATIONS.map((formation) => (
              <li
                key={formation.id}
                className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3.5 py-1.5 text-sm font-bold"
              >
                {formation.name}
              </li>
            ))}
          </ul>
        </motion.section>
      </main>

      <footer className="mx-auto w-full max-w-3xl border-t border-[var(--surface-border)] px-4 py-4 text-xs leading-relaxed text-[var(--text-secondary)]">
        Fantasy Manager è un gioco indipendente non affiliato, sponsorizzato o approvato da
        leghe, club o calciatori citati. I dati utilizzati hanno natura storica e statistica.
      </footer>
    </div>
  );
}
