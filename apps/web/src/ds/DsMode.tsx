import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, Briefcase, Play, Trash2 } from "lucide-react";
import {
  careerPlayers,
  createCareer,
  findCoach,
  getClubDefaultCoach,
  type CareerState,
  type DsDifficulty,
} from "@app/game-engine";
import { ClubBriefScreen } from "./ClubBriefScreen";
import { ClubPickerScreen } from "./ClubPickerScreen";
import { CoachPickerScreen } from "./CoachPickerScreen";
import { CareerScreen } from "./CareerScreen";
import {
  buildCareerWorld,
  continentalEntrants,
  initialRoster,
  startingBudget,
} from "./buildCareerWorld";
import { euro, ordinale } from "./format";
import { deleteCareerSave, useCareerPersistence, useCareerSaves } from "./useCareerSave";
import { useDsWorld } from "./useDsWorld";

/**
 * **DS Mode** (Direttore Sportivo): dieci stagioni alla guida di un club reale.
 *
 * Macchina a stati in quattro passi — carriere salvate → club → allenatore → carriera — sullo
 * stesso schema della Modalità Classica, così le due modalità si somigliano invece di essere
 * due app diverse dentro la stessa app.
 */

type Step =
  | { kind: "elenco" }
  | { kind: "club" }
  | { kind: "dossier"; clubId: string }
  | { kind: "allenatore"; clubId: string }
  | { kind: "carriera"; state: CareerState; saveId: string | null };

export function DsMode({ userId, onExit }: { userId: string | null; onExit: () => void }) {
  const { data: world, loading, error } = useDsWorld();
  const { saves, loading: savesLoading, refetch } = useCareerSaves(!!userId);
  const [step, setStep] = useState<Step>({ kind: "elenco" });
  /**
   * La difficoltà si sceglie nel dossier e vale per tutta la carriera: entra in
   * `createCareer` e da lì nel budget di ogni stagione.
   */
  const [difficulty, setDifficulty] = useState<DsDifficulty>("normale");

  const saveId = step.kind === "carriera" ? step.saveId : null;
  const persistence = useCareerPersistence(userId, saveId);

  const aggiornaCarriera = useCallback(
    (next: CareerState, immediate = false) => {
      setStep((current) =>
        current.kind === "carriera" ? { ...current, state: next } : current,
      );
      persistence.persist(next, immediate);
    },
    [persistence],
  );

  /**
   * Il mondo si ricostruisce **a ogni stagione**, non una volta sola: le età cambiano, e un
   * mondo congelato alla prima stagione terrebbe tutti ventenni per dieci anni.
   */
  const careerWorld = useMemo(() => {
    if (!world || step.kind !== "carriera") return null;
    const base = buildCareerWorld({
      world,
      clubId: step.state.clubId,
      season: step.state.season,
      seed: step.state.seed,
      transfers: step.state.worldTransfers ?? [],
      // Chi è passato da noi non appartiene più al mondo: senza questo insieme comparirebbe
      // sia in rosa sia fra gli acquistabili del suo vecchio club.
      ownedByUser: new Set(step.state.roster.map((e) => e.playerId)),
      difficulty: step.state.difficulty ?? "normale",
      generated: step.state.generated ?? [],
      // Promozioni e retrocessioni già avvenute: decidono in quale delle due divisioni si
      // gioca adesso e chi sono le avversarie.
      divisionMoves: step.state.divisionMoves ?? [],
    });
    /**
     * L'anagrafica deve includere i **regen**, che non esistono nel database.
     *
     * Il motore li fonde già per conto suo (`careerPlayers`), ma la UI legge `world.players`
     * direttamente in mezza dozzina di punti: senza questa fusione qui, un giovane nato in
     * carriera comparirebbe in rosa come "Giocatore" senza nome, nazione né ruolo. Farlo una
     * volta sola nel punto in cui il mondo si costruisce evita di doversene ricordare in ogni
     * componente.
     */
    return { ...base, players: careerPlayers(step.state, base) };
  }, [world, step]);

  if (loading) {
    return <Messaggio testo="Caricamento del mondo..." />;
  }
  if (error || !world) {
    return <Messaggio testo={error ?? "Nessun dato disponibile."} onExit={onExit} />;
  }

  if (step.kind === "club") {
    return (
      <ClubPickerScreen
        world={world}
        onPick={(clubId) => setStep({ kind: "dossier", clubId })}
        onExit={() => setStep({ kind: "elenco" })}
      />
    );
  }

  if (step.kind === "dossier") {
    return (
      <ClubBriefScreen
        world={world}
        clubId={step.clubId}
        difficulty={difficulty}
        onDifficulty={setDifficulty}
        onAccept={() => setStep({ kind: "allenatore", clubId: step.clubId })}
        onBack={() => setStep({ kind: "club" })}
      />
    );
  }

  if (step.kind === "allenatore") {
    const club = world.clubsById.get(step.clubId);
    const roster = initialRoster(world, step.clubId);
    const budget = startingBudget(roster, difficulty);

    const playersMap: Record<string, { name: string; role: any }> = {};
    for (const p of world.players) {
      playersMap[p.id] = { name: p.name, role: p.role };
    }

    return (
      <CoachPickerScreen
        clubId={step.clubId}
        clubName={club?.name ?? "Il tuo club"}
        clubPrestige={club?.prestigeTier ?? 3}
        budget={budget}
        roster={roster}
        season={1}
        players={playersMap}
        onBack={() => setStep({ kind: "dossier", clubId: step.clubId })}
        onPick={(coachId, promises, totalCost, coachSeasons) => {
          const defCoach = getClubDefaultCoach(step.clubId, club?.name);
          const isDefault = defCoach?.id === coachId;
          const defaultHireCost = isDefault ? 0 : (findCoach(coachId)?.hireCost ?? 0);
          const effectiveHireCost = typeof totalCost === "number" ? totalCost : defaultHireCost;
          const entrants = continentalEntrants(world);
          const iniziale = createCareer({
            // Il seme deriva da club, allenatore e istante di creazione: due carriere con lo
            // stesso club hanno calendari diversi, ma la stessa carriera ricaricata no.
            seed: `${step.clubId}-${coachId}-${Date.now().toString(36)}`,
            clubId: step.clubId,
            leagueId: club?.leagueId ?? "",
            coachId,
            roster,
            budget: Math.max(0, budget - effectiveHireCost),
            cupEntrants: entrants,
            difficulty,
            coachSeasons,
          });
          if (promises && promises.length > 0) {
            iniziale.coachPromises = promises;
          }
          setStep({ kind: "carriera", state: iniziale, saveId: null });
          persistence.persist(iniziale, true);
        }}
      />
    );
  }

  if (step.kind === "carriera" && careerWorld) {
    return (
      <CareerScreen
        state={step.state}
        world={careerWorld}
        dsWorld={world}
        onChange={aggiornaCarriera}
        onExit={() => {
          persistence.persist(step.state, true);
          void refetch();
          setStep({ kind: "elenco" });
        }}
        saving={persistence.saving}
        saveEnabled={!!userId}
      />
    );
  }

  // Elenco: continua una carriera o cominciane una nuova.
  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onExit}
            aria-label="Torna alla home"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
              Modalità carriera
            </p>
            <h1 className="truncate text-lg leading-tight font-extrabold">Direttore sportivo</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pitch-700 to-pitch-950 p-6 text-white">
          <Briefcase size={22} className="text-copper-300" />
          <h2 className="mt-3 text-2xl leading-tight font-extrabold text-balance">
            Dieci stagioni per costruire una squadra
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Scegli il club e l'allenatore, poi fai il mercato, dai spazio ai giovani e portali a
            crescere. Le prime quattro vanno in Corona Continentale; le ultime tre retrocedono, e
            con la retrocessione la carriera finisce.
          </p>
          <button
            type="button"
            onClick={() => setStep({ kind: "club" })}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-extrabold text-pitch-900 transition-transform active:scale-[0.98] sm:w-fit sm:px-8"
          >
            <Play size={17} fill="currentColor" />
            Nuova carriera
          </button>
        </section>

        {!userId && (
          <p className="rounded-2xl border border-dashed border-[var(--surface-border)] p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
            Stai giocando come ospite: la carriera resta in questa sessione e non viene salvata.
            Accedi per riprenderla quando vuoi.
          </p>
        )}

        {userId && saves.length > 0 && (
          <section>
            <h2 className="mb-2 text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
              Riprendi
            </h2>
            <ul className="flex flex-col gap-2">
              {saves.map((save) => {
                const club = world.clubsById.get(save.clubId);
                const ultima = save.state.history[save.state.history.length - 1];
                return (
                  <li
                    key={save.id}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setStep({ kind: "carriera", state: save.state, saveId: save.id })
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-sm font-extrabold">
                        {save.season}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">
                          {club?.name ?? "Club"}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--text-secondary)]">
                          {save.status === "conclusa"
                            ? "Carriera conclusa"
                            : `Settimana ${save.week}`}
                          {ultima ? ` · ultima ${ordinale(ultima.position)}` : ""}
                          {` · ${euro(save.state.budget)}`}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Elimina questa carriera"
                      onClick={async () => {
                        await deleteCareerSave(save.id);
                        void refetch();
                      }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--text-secondary)] transition-colors hover:border-[#ff4d4d] hover:text-[#ff4d4d]"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {userId && savesLoading && (
          <p className="text-sm text-[var(--text-secondary)]">Caricamento delle carriere...</p>
        )}
      </main>
    </div>
  );
}

function Messaggio({ testo, onExit }: { testo: string; onExit?: () => void }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[var(--surface)] px-6 text-center">
      <p className="text-sm text-[var(--text-secondary)]">{testo}</p>
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-2 rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold"
        >
          <ArrowLeft size={16} />
          Torna alla home
        </button>
      )}
    </div>
  );
}
