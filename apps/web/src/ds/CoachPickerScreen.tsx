import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MessageSquare, Shield, Sprout, Swords, UserCheck } from "lucide-react";
import {
  COACHES,
  availableCoaches,
  computeCoachBuyoutFee,
  getClubDefaultCoach,
  getFormation,
  type Coach,
  type CoachPromise,
  type RosterEntry,
} from "@app/game-engine";
import { NationFlag } from "../classic/NationFlag";
import { CoachNegotiationChat } from "./CoachNegotiationChat";
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
      <span className="w-16 shrink-0 text-[10px] font-bold tracking-wide text-[var(--text-secondary)] uppercase">
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
      <span className="w-7 shrink-0 text-right text-[11px] font-bold tabular-nums">
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
      className={`flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition-colors relative ${
        selected
          ? "border-[var(--brand)] bg-[var(--brand)]/10"
          : isDefault
            ? "border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500"
            : "border-[var(--surface-border)] bg-[var(--surface-raised)] hover:border-[var(--brand)]/50"
      } ${affordable ? "" : "cursor-not-allowed opacity-45"}`}
    >
      {isDefault && (
        <span className="absolute -top-2.5 right-4 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-extrabold text-black uppercase tracking-wider shadow-sm flex items-center gap-1">
          <UserCheck size={12} /> Mister Reale (€0)
        </span>
      )}

      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-sm font-extrabold">
          {formation?.name ?? coach.formationId}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-extrabold">{coach.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
            <NationFlag nation={coach.nation} />
            {coach.nation} {coach.tacticalPhilosophy ? `· ${coach.tacticalPhilosophy}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-extrabold">{isDefault ? "GRATUITO" : euro(cost)}</span>
          <span className="block text-[10px] font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
            {isDefault ? "di default" : buyoutFee > 0 ? "ingaggio + riscatto" : "ingaggio"}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <StyleBar icon={Swords} label="Attacco" value={coach.style.attack} max={3} color="#ff8a3d" />
        <StyleBar icon={Shield} label="Difesa" value={coach.style.defence} max={3} color="#5aa9e6" />
      </div>

      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
          <Sprout size={13} className="text-[#3ddc6b]" />
          {coach.development >= 1.5
            ? "Eccellente coi giovani"
            : coach.development >= 1.25
              ? "Bravo coi giovani"
              : coach.development >= 1.05
                ? "Discreto coi giovani"
                : "Preferisce i giocatori pronti"}
        </p>

        <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--brand)]">
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
  onPick: (coachId: string, promises?: CoachPromise[], totalCost?: number) => void;
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

  const [tab, setTab] = useState<"default" | "free" | "all">("default");
  const [chatCoach, setChatCoach] = useState<Coach | null>(null);

  const freeAgents = useMemo(() => COACHES.filter((c) => c.isFreeAgent), []);
  const allCoaches = useMemo(() => availableCoaches(clubPrestige), [clubPrestige]);

  if (chatCoach) {
    const isDefault = defaultCoach?.id === chatCoach.id;
    const buyoutFee = isDefault || chatCoach.isFreeAgent ? 0 : computeCoachBuyoutFee(chatCoach);

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
        onAgree={(c, promises, cost) => {
          onPick(c.id, promises, cost);
        }}
        onCancel={() => setChatCoach(null)}
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
            <p className="text-[11px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
              {clubName} · Passo 2 di 2
            </p>
            <h1 className="truncate text-lg leading-tight font-extrabold">Scelta & Mercato Allenatori</h1>
          </div>
          <span className="shrink-0 text-right">
            <span className="block text-sm font-extrabold">{euro(budget)}</span>
            <span className="block text-[10px] font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
              budget
            </span>
          </span>
        </div>

        {/* Schede Filtro */}
        <div className="mx-auto flex w-full max-w-4xl gap-2 px-4 pb-3 pt-1">
          <button
            type="button"
            onClick={() => setTab("default")}
            className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition-colors ${
              tab === "default"
                ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Mister Reale {defaultCoach ? `(${defaultCoach.name})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setTab("free")}
            className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition-colors ${
              tab === "free"
                ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Svincolati ({freeAgents.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`flex-1 rounded-xl py-2 text-xs font-extrabold transition-colors ${
              tab === "all"
                ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Tutti i Tecnici ({allCoaches.length})
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-4 pb-28">
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Puoi confermare l'allenatore reale di <strong>{clubName}</strong> gratuitamente, oppure trattare con uno Svincolato o soffiare un tecnico a un altro club pagando l'indennizzo. Clicca su un mister per avviare la trattativa in chat!
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {tab === "default" && defaultCoach && (
            <CoachCard
              coach={defaultCoach}
              isDefault
              selected={false}
              affordable={true}
              onSelect={() => setChatCoach(defaultCoach)}
            />
          )}

          {tab === "free" &&
            freeAgents.map((coach) => (
              <CoachCard
                key={coach.id}
                coach={coach}
                selected={false}
                affordable={coach.hireCost <= budget}
                onSelect={() => setChatCoach(coach)}
              />
            ))}

          {tab === "all" &&
            allCoaches.map((coach) => {
              const isDef = defaultCoach?.id === coach.id;
              const buyout = isDef || coach.isFreeAgent ? 0 : computeCoachBuyoutFee(coach);
              const totalCost = isDef ? 0 : coach.hireCost + buyout;

              return (
                <CoachCard
                  key={coach.id}
                  coach={coach}
                  isDefault={isDef}
                  selected={false}
                  affordable={totalCost <= budget}
                  buyoutFee={buyout}
                  onSelect={() => setChatCoach(coach)}
                />
              );
            })}
        </div>
      </main>
    </div>
  );
}
