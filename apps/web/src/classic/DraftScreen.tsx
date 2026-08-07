import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, RefreshCcw, Shield, Shuffle } from "lucide-react";
import {
  candidatesForRequirement,
  drawClubPack,
  canRedraft,
  getFormation,
  isSquadComplete,
  openRequirements,
  playerMatchesRequirement,
  REDRAFT_ALLOWANCE,
} from "@app/game-engine";
import type { ClubPackage, DraftRequirement } from "@app/game-engine";
import { ROLE_LABELS } from "@app/shared-types";
import type { Player } from "@app/shared-types";
import type { useDraftPool } from "../hooks/useDraftPool";
import { TacticalBoard } from "./TacticalBoard";
import { PackReveal } from "./PackReveal";
import {
  assignPlayer,
  filterPackagesByLeague,
  filterPoolByLeague,
  remainingPackages,
  remainingPlayers,
  toProgress,
} from "./engineHelpers";
import { OriginBadge } from "./NationFlag";
import { SquadSummaryBar } from "./SquadSummaryBar";
import { overallTier } from "./theme";
import { EMPTY_ASSIGNMENT, type SetupConfig, type SquadAssignment } from "./types";

interface DraftScreenProps {
  config: SetupConfig;
  pool: ReturnType<typeof useDraftPool>;
  onComplete: (assignment: SquadAssignment) => void;
  onExit: () => void;
}

function byOverallDesc(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.overall - a.overall);
}

export function DraftScreen({ config, pool, onComplete, onExit }: DraftScreenProps) {
  const formation = getFormation(config.formationId)!;
  const [assignment, setAssignment] = useState<SquadAssignment>(EMPTY_ASSIGNMENT);
  const [redraftsUsed, setRedraftsUsed] = useState(0);

  /** Per squadra: pacchetto di 5 club tra cui scegliere, poi la rosa del club scelto (escluso dai pacchetti successivi). */
  const [teamOptions, setTeamOptions] = useState<ClubPackage[]>([]);
  const [chosenTeam, setChosenTeam] = useState<ClubPackage | null>(null);
  const [excludedClubIds, setExcludedClubIds] = useState<Set<string>>(new Set());

  /** Per ruolo: pacchetto di 5 candidati; i 4 scartati sono esclusi per il resto del draft. */
  const [currentRequirement, setCurrentRequirement] = useState<DraftRequirement | null>(null);
  const [candidateOptions, setCandidateOptions] = useState<Player[]>([]);
  const [excludedPlayerIds, setExcludedPlayerIds] = useState<Set<string>>(new Set());

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  /** Casella da cui si sta spostando un titolare già schierato, per riordinare la squadra. */
  const [movingSlotId, setMovingSlotId] = useState<string | null>(null);

  /**
   * Sposta un titolare in un'altra casella, scambiandolo con chi la occupa. Serve a
   * migliorare l'intesa dopo il draft: la stessa rosa, disposta diversamente, cambia i
   * vicini sullo scacchiere e quindi le linee (sez. 3.4). Toccare di nuovo la casella di
   * partenza annulla lo spostamento.
   */
  function handleMoveTo(toSlotId: string) {
    const fromSlotId = movingSlotId;
    setMovingSlotId(null);
    if (!fromSlotId || fromSlotId === toSlotId) return;
    setAssignment((current) => {
      const mover = current.starters[fromSlotId];
      if (!mover) return current;
      const starters = { ...current.starters };
      const occupant = starters[toSlotId];
      starters[toSlotId] = mover;
      if (occupant) starters[fromSlotId] = occupant;
      else delete starters[fromSlotId];
      return { ...current, starters };
    });
  }
  /** Solo mobile: "list" = si sceglie il nome, "pitch" = si posiziona sul campo (sez. CLAUDE.md 3.5). */
  const [mobilePhase, setMobilePhase] = useState<"list" | "pitch">("list");

  /** Pool ristretto alla competizione scelta: si pesca solo da quel campionato (sez. 3.5). */
  const leaguePlayers = useMemo(
    () => filterPoolByLeague(pool.players, config.draftPool === "tutti" ? null : config.league),
    [pool.players, config.league, config.draftPool],
  );
  const leaguePackages = useMemo(
    () => filterPackagesByLeague(pool.packages, config.draftPool === "tutti" ? null : config.league),
    [pool.packages, config.league, config.draftPool],
  );

  const progress = useMemo(() => toProgress(formation, assignment), [formation, assignment]);
  const openReqs = openRequirements(progress);
  const picksDone = formation.slots.length - openReqs.length;
  const redraftAllowance = REDRAFT_ALLOWANCE[config.difficulty];
  const canUseRedraft = canRedraft(config.difficulty, redraftsUsed);

  function drawTeamPack(currentAssignment: SquadAssignment, excluded: Set<string>): ClubPackage[] {
    const currentProgress = toProgress(formation, currentAssignment);
    const available = remainingPackages(leaguePackages, currentAssignment).filter(
      (pkg) => !excluded.has(pkg.clubId),
    );
    // La difficolta sbilancia il pacchetto verso i club forti (sez. 3.2): in facile escono
    // molto piu spesso, in difficile la pescata e uniforme.
    return drawClubPack(available, currentProgress, config.difficulty);
  }

  useEffect(() => {
    if (config.mode !== "per_squadra") return;
    if (chosenTeam) return;
    if (teamOptions.length > 0) return;
    setTeamOptions(drawTeamPack(assignment, excludedClubIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.mode, leaguePackages, assignment, excludedClubIds, chosenTeam, teamOptions.length]);

  function completeOrAdvance(next: SquadAssignment, nextProgress = toProgress(formation, next)) {
    setAssignment(next);
    setSelectedPlayer(null);
    setMobilePhase("list");
    if (isSquadComplete(nextProgress)) {
      onComplete(next);
      return;
    }
    if (config.mode === "per_squadra") {
      setChosenTeam(null);
      setTeamOptions([]);
    } else {
      setCurrentRequirement(null);
      setCandidateOptions([]);
    }
  }

  function handleChooseTeam(team: ClubPackage) {
    setExcludedClubIds((prev) => new Set(prev).add(team.clubId));
    setChosenTeam(team);
    setTeamOptions([]);
  }

  function handleToggleSelection(player: Player) {
    if (selectedPlayer?.id === player.id) {
      setSelectedPlayer(null);
      return;
    }
    setSelectedPlayer(player);
    setMobilePhase("pitch");
  }

  function handleBackToList() {
    setSelectedPlayer(null);
    setMobilePhase("list");
  }

  function handlePickForSelectedPlayer(req: DraftRequirement) {
    if (!selectedPlayer) return;
    completeOrAdvance(assignPlayer(assignment, req, selectedPlayer));
  }

  function handleSelectRequirement(req: DraftRequirement) {
    setCurrentRequirement(req);
    const available = remainingPlayers(leaguePlayers, assignment).filter(
      (p) => !excludedPlayerIds.has(p.id),
    );
    setCandidateOptions(
      candidatesForRequirement(available, req, Math.random, undefined, config.difficulty),
    );
  }

  function handleChooseCandidate(player: Player) {
    setExcludedPlayerIds((prev) => {
      const next = new Set(prev);
      for (const other of candidateOptions) if (other.id !== player.id) next.add(other.id);
      return next;
    });
    setCandidateOptions([]);

    // In modalità "per ruolo" la casella è già stata scelta prima di vedere i candidati:
    // il giocatore ci va dentro subito. Chiedere di ritoccarla sul campo sarebbe una
    // ripetizione della scelta appena fatta.
    if (currentRequirement) {
      completeOrAdvance(assignPlayer(assignment, currentRequirement, player));
      return;
    }

    setSelectedPlayer(player);
    setMobilePhase("pitch");
  }

  function handleRedraft() {
    if (!canUseRedraft) return;
    setRedraftsUsed((n) => n + 1);
    if (config.mode === "per_squadra") {
      if (chosenTeam) return;
      setTeamOptions(drawTeamPack(assignment, excludedClubIds));
    } else if (currentRequirement) {
      const available = remainingPlayers(leaguePlayers, assignment).filter(
        (p) => !excludedPlayerIds.has(p.id),
      );
      setCandidateOptions(
        candidatesForRequirement(available, currentRequirement, Math.random, undefined, config.difficulty),
      );
    }
  }

  const redraftDisabled =
    !canUseRedraft ||
    (config.mode === "per_squadra" ? !!chosenTeam || teamOptions.length === 0 : !currentRequirement);

  /** Cambia ad ogni passo del draft: fa uscire il pannello vecchio ed entrare il nuovo. */
  const panelKey =
    config.mode === "per_squadra"
      ? chosenTeam
        ? `club-${chosenTeam.clubId}`
        : `pack-${teamOptions.map((t) => t.clubId).join("-")}`
      : currentRequirement
        ? `cand-${currentRequirement.id}`
        : "slots";

  /**
   * Il redraft vive **dentro** il blocco delle scelte, non nell'header: è un'azione sul
   * pacchetto che si sta guardando, e lassù passava inosservato. Acceso (pieno, con alone
   * pulsante) quando è usabile, spento quando i redraft sono finiti o quando non c'è nulla
   * da ripescare — con il conteggio degli usi rimasti sempre in vista.
   */
  function RedraftButton() {
    const remaining = Math.max(redraftAllowance - redraftsUsed, 0);
    const exhausted = !canUseRedraft;
    return (
      <motion.button
        type="button"
        onClick={handleRedraft}
        disabled={redraftDisabled}
        whileTap={redraftDisabled ? undefined : { scale: 0.97 }}
        animate={
          redraftDisabled
            ? { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
            : {
                boxShadow: [
                  "0 0 0 0 rgba(128,94,86,0)",
                  "0 0 0 8px rgba(128,94,86,0.22)",
                  "0 0 0 0 rgba(128,94,86,0)",
                ],
              }
        }
        transition={{ duration: 2.2, repeat: redraftDisabled ? 0 : Infinity, ease: "easeInOut" }}
        className={`flex min-h-[46px] w-full shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition-colors ${
          redraftDisabled
            ? "cursor-not-allowed border-2 border-[var(--surface-border)] bg-transparent text-[var(--text-secondary)] opacity-50"
            : "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30 hover:brightness-110"
        }`}
      >
        <RefreshCcw size={17} />
        {exhausted ? "Redraft esauriti" : "Cambia pacchetto"}
        <span
          className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
            redraftDisabled ? "bg-[var(--surface-border)]" : "bg-black/25"
          }`}
        >
          {remaining}/{redraftAllowance}
        </span>
      </motion.button>
    );
  }

  function ListPanel({ showSlotPicker }: { showSlotPicker: boolean }) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="min-h-0 flex-1">{renderAnimatedPanel(showSlotPicker)}</div>
        <RedraftButton />
      </div>
    );
  }

  function renderAnimatedPanel(showSlotPicker: boolean) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={panelKey}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="h-full"
        >
          {renderListPanel(showSlotPicker)}
        </motion.div>
      </AnimatePresence>
    );
  }

  function renderListPanel(showSlotPicker: boolean) {
    if (config.mode === "per_squadra") {
      if (!chosenTeam) {
        return (
          <PackReveal
            key={teamOptions.map((t) => t.clubId).join("-") || "empty"}
            items={teamOptions}
            getKey={(team) => team.clubId}
            subtitle={`${teamOptions.length} squadre pronte: scegline una`}
            renderItem={(team) => (
              <TeamCard team={team} clubName={pool.clubNames[team.clubId]} onClick={() => handleChooseTeam(team)} />
            )}
          />
        );
      }
      return (
        <PackagePanel
          pkg={chosenTeam}
          progress={progress}
          selectedPlayer={selectedPlayer}
          onToggle={handleToggleSelection}
          clubNames={pool.clubNames}
        />
      );
    }

    if (!currentRequirement) {
      if (showSlotPicker) {
        return <SlotPickerPanel requirements={openReqs} onSelect={handleSelectRequirement} />;
      }
      return (
        <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-[var(--surface-border)] bg-[var(--surface-raised)] p-6 text-center text-sm text-[var(--text-secondary)]">
          <div>
            <motion.span
              animate={{ y: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand)]/10 text-[var(--brand)]"
            >
              <Shuffle size={19} />
            </motion.span>
            Tocca una casella vuota sul campo
            <span className="mt-1 block text-xs">per vedere i 5 candidati per quel ruolo.</span>
          </div>
        </div>
      );
    }

    const label = ROLE_LABELS[currentRequirement.role];

    return (
      <PackReveal
        key={candidateOptions.map((p) => p.id).join("-") || "empty"}
        items={candidateOptions}
        getKey={(player) => player.id}
        subtitle={`${candidateOptions.length} candidati per ${label}`}
        renderItem={(player) => (
          <PlayerCard
            player={player}
            disabled={false}
            selected={false}
            onClick={() => handleChooseCandidate(player)}
            secondary={player.role !== currentRequirement.role}
            clubName={pool.clubNames[player.clubId]}
          />
        )}
      />
    );
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="shrink-0 border-b border-[var(--surface-border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onExit}
              aria-label="Abbandona il draft"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-sm font-extrabold">Draft — {formation.name}</h1>
              <p className="text-xs text-[var(--text-secondary)]">
                {picksDone}/{formation.slots.length} scelte
              </p>
            </div>
          </div>
        </div>

        {/* Avanzamento del draft: 11 tacche che si riempiono ad ogni scelta confermata. */}
        <div className="flex gap-0.5 px-4 pb-2">
          {formation.slots.map((slot, i) => (
            <motion.span
              key={slot.id}
              initial={false}
              animate={{
                backgroundColor:
                  i < picksDone ? "var(--brand)" : "var(--surface-border)",
              }}
              transition={{ duration: 0.3 }}
              className="h-1 flex-1 rounded-full"
            />
          ))}
        </div>
      </header>

      <SquadSummaryBar formation={formation} assignment={assignment} />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Desktop/tablet: campo e lista sempre entrambi visibili, solo la lista scrolla */}
        <div className="hidden min-h-0 flex-1 gap-4 overflow-hidden p-4 md:flex">
          <div className="min-h-0 w-[40%] min-w-[300px]">
            <TacticalBoard
              formation={formation}
              assignment={assignment}
              selectedPlayer={selectedPlayer}
              onPickForSelectedPlayer={handlePickForSelectedPlayer}
              onSelectEmptySlot={config.mode === "per_ruolo" ? handleSelectRequirement : undefined}
              movingSlotId={movingSlotId}
              onStartMove={setMovingSlotId}
              onMoveTo={handleMoveTo}
              onCancelMove={() => setMovingSlotId(null)}
            />
          </div>
          <div className="min-h-0 flex-1">
            <ListPanel showSlotPicker={false} />
          </div>
        </div>

        {/* Mobile: due schermate separate (lista poi campo), per non affollare lo spazio */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:hidden">
          {mobilePhase === "list" ? (
            <div className="min-h-0 flex-1">
              <ListPanel showSlotPicker />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-bold transition-colors hover:border-[var(--brand)]"
                >
                  <ArrowLeft size={13} />
                  Cambia
                </button>
                {selectedPlayer && (
                  <motion.p
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="min-w-0 truncate text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    <strong className="text-[var(--text-primary)]">{selectedPlayer.name}</strong> —
                    tocca una casella accesa
                  </motion.p>
                )}
              </div>
              <div className="min-h-0 flex-1">
                <TacticalBoard
                  formation={formation}
                  assignment={assignment}
                  selectedPlayer={selectedPlayer}
                  onPickForSelectedPlayer={handlePickForSelectedPlayer}
                  movingSlotId={movingSlotId}
                  onStartMove={setMovingSlotId}
                  onMoveTo={handleMoveTo}
                  onCancelMove={() => setMovingSlotId(null)}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TeamCard({
  team,
  clubName,
  onClick,
}: {
  team: ClubPackage;
  clubName?: string;
  onClick: () => void;
}) {
  const best = Math.max(...team.players.map((p) => p.overall));
  const tier = overallTier(best);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full flex-col items-center gap-1 rounded-2xl border-2 border-[var(--surface-border)] bg-[var(--surface)] px-4 py-5 text-center shadow-sm transition-colors hover:border-[var(--brand)]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-contrast)]">
        <Shield size={20} />
      </span>
      <span className="mt-1 text-sm leading-tight font-extrabold">{clubName ?? "Club"}</span>
      <span className="text-xs text-[var(--text-secondary)]">
        {team.players[0]?.league} {team.players[0]?.era}
      </span>
      <span className={`mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${tier.badge}`}>
        Top {best}
      </span>
      <span className="text-[11px] text-[var(--text-secondary)]">
        {team.players.length} giocatori
      </span>
    </button>
  );
}

function SlotPickerPanel({
  requirements,
  onSelect,
}: {
  requirements: DraftRequirement[];
  onSelect: (req: DraftRequirement) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)]">
      <p className="shrink-0 border-b border-[var(--surface-border)] px-4 py-3 text-xs font-bold tracking-wide text-[var(--text-secondary)] uppercase">
        Scegli uno slot da riempire
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {requirements.map((req, index) => (
            <motion.button
              key={req.id}
              type="button"
              onClick={() => onSelect(req)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-between rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-3 text-left text-sm font-bold transition-colors hover:border-[var(--brand)]"
            >
              {ROLE_LABELS[req.role]}
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {req.department}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PackagePanel({
  pkg,
  progress,
  selectedPlayer,
  onToggle,
  clubNames,
}: {
  pkg: ClubPackage;
  progress: ReturnType<typeof toProgress>;
  selectedPlayer: Player | null;
  onToggle: (player: Player) => void;
  clubNames: Record<string, string>;
}) {
  const reqs = openRequirements(progress);
  const usable = byOverallDesc(
    pkg.players.filter((player) => reqs.some((req) => playerMatchesRequirement(player, req))),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)]">
      <p className="shrink-0 border-b border-[var(--surface-border)] px-4 py-3 text-xs font-bold tracking-wide text-[var(--text-secondary)] uppercase">
        {clubNames[pkg.clubId] ?? "Club"} — {pkg.players[0]?.league} {pkg.players[0]?.era}
        <span className="ml-2 font-normal normal-case text-[var(--accent)]">
          esclusa dai prossimi pacchetti
        </span>
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {usable.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 12) * 0.025, duration: 0.22 }}
            >
              <PlayerCard
                player={player}
                disabled={false}
                selected={selectedPlayer?.id === player.id}
                onClick={() => onToggle(player)}
                clubName={clubNames[player.clubId]}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Riga di un giocatore nelle liste del draft. Mostra tutto ciò che serve a decidere:
 * **club** (perché i compagni di club danno intesa piena), **ruolo in sigla** (le etichette
 * per esteso venivano troncate), e **provenienza** con bandierina, codice nazione e sigla
 * del campionato — nazione ed epoca sono due dei tre tratti che accendono le linee (sez. 3.4).
 */
function PlayerCard({
  player,
  disabled,
  selected,
  onClick,
  secondary,
  clubName,
}: {
  player: Player;
  disabled: boolean;
  selected: boolean;
  onClick: () => void;
  secondary?: boolean;
  clubName?: string;
}) {
  const tier = overallTier(player.overall);
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={`flex h-full w-full items-center justify-between gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${
        disabled
          ? "border-[var(--surface-border)] opacity-40"
          : selected
            ? "border-[var(--accent)] bg-[var(--accent)]/10 shadow-md"
            : "border-[var(--surface-border)] bg-[var(--surface)] hover:border-[var(--brand)]"
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{player.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[var(--text-secondary)]">
          <span className="rounded bg-[var(--surface-raised)] px-1 py-px text-[10px] font-extrabold tracking-wide text-[var(--text-primary)]">
            {player.role}
          </span>
          {clubName && <span className="min-w-0 max-w-[10rem] truncate font-semibold">{clubName}</span>}
          <OriginBadge nation={player.nation} league={player.league} size={9} />
        </span>
        {secondary && (
          <span className="mt-1 inline-block rounded-full bg-[var(--accent)]/15 px-1.5 py-px text-[10px] font-bold text-[var(--accent)]">
            Ruolo secondario
          </span>
        )}
      </span>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold ${tier.badge}`}
      >
        {player.overall}
      </span>
    </motion.button>
  );
}
