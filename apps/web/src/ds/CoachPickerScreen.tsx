import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MessageSquare, Search, Shield, Sprout, Swords, UserCheck } from "lucide-react";
import {
  computeCoachBuyoutFee,
  getClubDefaultCoach,
  getFormation,
  type Coach,
  type CoachPromise,
  type RosterEntry,
} from "@app/game-engine";
import { NationFlag } from "../classic/NationFlag";
import { CoachNegotiationChat } from "./CoachNegotiationChat";
import { CoachSearchScreen } from "./CoachSearchScreen";
import { euro } from "./format";

function StyleBar({
  icon: Icon,
  label,
  value,
  max,
  color,
}: {
  icon: typeof Swords;
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const share = Math.min(Math.abs(value) / max, 1) * 50;
  return (
    <div className="flex items-center gap-2">
      <Icon size={13} className="shrink-0 text-[var(--text-secondary)]" />
      <span className="w-16 shrink-0 text-micro font-bold tracking-wide text-[var(--text-secondary)] uppercase">
        {label}
      </span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface)]">
        <span className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--surface-border)]" />
        <span
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            backgroundColor: value < 0 ? "#ff8a3d" : color,
            left: value < 0 ? `${50 - share}%` : "50%",
            width: `${share}%`,
          }}
        />
      </span>
      <span className="w-7 shrink-0 text-right text-label font-bold tabular-nums">
        {value > 0 ? `+${value}` : value}
      </span>
    </div>
  );
}

function CoachCard({
  coach,
  isDefault,
  selected,
  affordable,
  buyoutFee = 0,
  onSelect,
}: {
  coach: Coach;
  isDefault?: boolean;
  selected: boolean;
  affordable: boolean;
  buyoutFee?: number;
  onSelect: () => void;
}) {
  const formation = getFormation(coach.formationId);
  const cost = isDefault ? 0 : coach.hireCost + buyoutFee;

  return (
    <motion.button
      type="button"
      layout
      disabled={!affordable}
      onClick={onSelect}
      whileTap={affordable ? { scale: 0.985 } : undefined}
      className={`flex w-full flex-col gap-3 rounded-card border p-4 text-left transition-colors relative ${
        selected
          ? "border-[var(--brand)] bg-[var(--brand)]/10"
          : isDefault
            ? "border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500"
            : "border-[var(--surface-border)] bg-[var(--surface-raised)] hover:border-[var(--brand)]/50"
      } ${affordable ? "" : "cursor-not-allowed opacity-45"}`}
    >
      {isDefault && (
        <span className="absolute -top-2.5 right-4 rounded-full bg-emerald-500 px-2.5 py-0.5 text-micro font-extrabold text-black uppercase tracking-wider shadow-sm flex items-center gap-1">
          <UserCheck size={12} /> Mister Reale (€0)
        </span>
      )}

      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-[var(--surface)] text-body font-extrabold">
          {formation?.name ?? coach.formationId}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body leading-tight font-extrabold">{coach.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-label text-[var(--text-secondary)]">
            <NationFlag nation={coach.nation} />
            {coach.nation} {coach.tacticalPhilosophy ? `· ${coach.tacticalPhilosophy}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-body font-extrabold">{isDefault ? "GRATUITO" : euro(cost)}</span>
          <span className="block text-micro font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
            {isDefault ? "di default" : buyoutFee > 0 ? "ingaggio + riscatto" : "ingaggio"}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <StyleBar icon={Swords} label="Attacco" value={coach.style.attack} max={3} color="#ff8a3d" />
        <StyleBar icon={Shield} label="Difesa" value={coach.style.defence} max={3} color="#5aa9e6" />
      </div>

      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-label font-semibold text-[var(--text-secondary)]">
          <Sprout size={13} className="text-[#3ddc6b]" />
          {coach.development >= 1.5
            ? "Eccellente coi giovani"
            : coach.development >= 1.25
              ? "Bravo coi giovani"
              : coach.development >= 1.05
                ? "Discreto coi giovani"
                : "Preferisce i giocatori pronti"}
        </p>

        <span className="flex items-center gap-1 text-label font-bold text-[var(--brand)]">
          <MessageSquare size={13} /> Tratta in Chat
        </span>
      </div>
    </motion.button>
  );
}

interface CoachPickerScreenProps {
  clubId: string;
  clubName: string;
  clubPrestige: number;
  budget: number;
  roster?: RosterEntry[];
  season?: number;
  players?: Record<string, { name: string; role: any }>;
  onPick: (coachId: string, promises?: CoachPromise[], totalCost?: number, seasons?: number) => void;
  onBack: () => void;
}

export function CoachPickerScreen({
  clubId,
  clubName,
  clubPrestige,
  budget,
  roster = [],
  season = 1,
  players,
  onPick,
  onBack,
}: CoachPickerScreenProps) {
  const defaultCoach = useMemo(() => getClubDefaultCoach(clubId, clubName), [clubId, clubName]);

  /**
   * Tre passi, non tre schede: **scegli chi** (dossier o ricerca), **per quanto** (durata), e poi
   * **a quali condizioni** (trattativa). Le pretese economiche compaiono solo all'ultimo passo,
   * mai nella lista — richiesta esplicita dell'utente.
   */
  const [vista, setVista] = useState<"scelta" | "ricerca">("scelta");
  const [chatCoach, setChatCoach] = useState<Coach | null>(null);
  const [penale, setPenale] = useState(0);
  const [candidato, setCandidato] = useState<Coach | null>(null);

  // Dal candidato si va **dritti al tavolo**: la durata si sceglie li dentro, nella scheda
  // Contratto, che e anche il posto in cui la si rinegozia ogni anno.
  const apri = (coach: Coach, buyout: number) => {
    setCandidato(coach);
    setPenale(buyout);
    setChatCoach(coach);
  };

  if (vista === "ricerca" && !candidato && !chatCoach) {
    return (
      <CoachSearchScreen
        clubPrestige={clubPrestige}
        currentCoachId={defaultCoach?.id ?? null}
        title="Mercato allenatori"
        subtitle={clubName}
        onOpen={apri}
        onBack={() => setVista("scelta")}
      />
    );
  }

  /**
   * ⚠️ **La schermata intermedia del contratto e stata rimossa** (segnalazione dell utente).
   *
   * Mostrava importo, durata e totale, e subito dopo si apriva il meeting in cui si discute il
   * contratto vero: due tavoli per la stessa firma, e il primo senza alcun potere. La durata si
   * sceglie ora dentro il meeting, nella scheda *Contratto*, che e anche il posto in cui la si
   * rinegozia ogni anno — una decisione, un posto solo.
   */
  if (chatCoach) {
    const isDefault = defaultCoach?.id === chatCoach.id;
    const buyoutFee = isDefault || chatCoach.isFreeAgent ? 0 : penale || computeCoachBuyoutFee(chatCoach, 2);

    return (
      <CoachNegotiationChat
        coach={chatCoach}
        clubName={clubName}
        clubNation="Italia"
        budget={budget}
        roster={roster}
        season={season}
        players={players}
        isDefaultCoach={isDefault}
        buyoutFee={buyoutFee}
        contract={{ seasonsLeft: 0, wage: chatCoach.hireCost ?? 0, severance: buyoutFee, wageRoom: budget }}
        requiresRenewal
        onAgree={(c, promises, cost, seasons) => {
          onPick(c.id, promises, cost, seasons ?? 3);
        }}
        onCancel={() => {
          setChatCoach(null);
          setCandidato(null);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Torna alla scelta del club"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
              {clubName} · Passo 2 di 2
            </p>
            <h1 className="truncate text-title leading-tight font-extrabold">Scelta & Mercato Allenatori</h1>
          </div>
          <span className="shrink-0 text-right">
            <span className="block text-body font-extrabold">{euro(budget)}</span>
            <span className="block text-micro font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
              budget
            </span>
          </span>
        </div>

      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-4 pb-28">
        <p className="text-body leading-relaxed text-[var(--text-secondary)]">
          Puoi confermare il tecnico di <strong>{clubName}</strong>, oppure cercarne un altro fra
          oltre cento allenatori: svincolati o sotto contratto, questi ultimi pagando una penale al
          loro club. <strong>Le richieste economiche e tecniche si scoprono al tavolo</strong>, non
          nella lista.
        </p>

        {defaultCoach && (
          <CoachCard
            coach={defaultCoach}
            isDefault
            selected={false}
            affordable
            onSelect={() => apri(defaultCoach, 0)}
          />
        )}

        <button
          type="button"
          onClick={() => setVista("ricerca")}
          className="flex items-center justify-center gap-2 rounded-card border border-[var(--brand)]/60 bg-[var(--brand)]/10 py-3.5 text-body font-extrabold text-[var(--brand)] transition-transform active:scale-98"
        >
          <Search size={16} /> Cerca nel mercato allenatori
        </button>
      </main>
    </div>
  );
}
