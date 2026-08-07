import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, HeartHandshake, ShieldAlert, Sparkles } from "lucide-react";
import {
  derivedRandom,
  generateCoachPromises,
  getCoachAcceptanceQuote,
  getCoachGreeting,
  getCoachRejectionQuote,
  openCoachNegotiation,
  proposePromiseCompromise,
  type Coach,
  type CoachNegotiationState,
  type CoachPromise,
  type RoleCandidate,
  type RosterEntry,
} from "@app/game-engine";
import type { Role } from "@app/shared-types";
import { NationFlag } from "../classic/NationFlag";
import { euro } from "./format";

interface CoachNegotiationChatProps {
  coach: Coach;
  clubName: string;
  clubNation: string;
  budget: number;
  roster: RosterEntry[];
  season: number;
  players?: Record<string, { name: string; role: Role }>;
  isDefaultCoach?: boolean;
  buyoutFee?: number;
  /**
   * Seme della carriera: rende le promesse riproducibili da salvataggio (CLAUDE.md §3.7.13),
   * non solo varie. Senza, `generateCoachPromises` ripiega su `Math.random()`.
   */
  seed?: string;
  /** Candidati reali di mercato, per nominare uno specialista invece di una soglia generica. */
  marketCandidates?: RoleCandidate[];
  onAgree: (coach: Coach, promises: CoachPromise[], cost: number) => void;
  onCancel: () => void;
}

export function CoachNegotiationChat({
  coach,
  clubName,
  clubNation: _clubNation,
  budget,
  roster,
  season,
  players,
  isDefaultCoach = false,
  buyoutFee = 0,
  seed,
  marketCandidates,
  onAgree,
  onCancel,
}: CoachNegotiationChatProps) {


  // Inizializzazione delle promesse dal catalogo
  const initialPromises = useMemo(() => {
    const topPlayerOverall = roster.length > 0 ? Math.max(...roster.map((e) => e.overall)) : 75;
    const under22Count = roster.filter((e) => e.overall >= 70).length;
    const over30Count = roster.filter((e) => e.overall >= 78).length;
    // Fallback locale se non è stato passato il seme di carriera: coach+stagione bastano a
    // rendere la stessa combinazione riproducibile finché la trattativa resta aperta, anche
    // se non con la garanzia piena di un salvataggio ricaricato.
    const random = derivedRandom(seed ?? `${coach.id}-nogod`, "coachPromise", season, coach.id);

    return generateCoachPromises(
      coach,
      roster,
      {
        squadSize: roster.length,
        avgAge: 25,
        topPlayerOverall,
        under22Count,
        over30Count,
        domesticCount: 2,
        hasSecondKeeper: roster.length >= 18,
        missingRolesCount: 0,
      },
      season,
      players,
      random,
      marketCandidates,
    );
  }, [coach, roster, season, players, seed, marketCandidates]);

  // Stato trattativa con gestione delle reazioni umane del mister
  const [negState, setNegState] = useState<CoachNegotiationState>(() =>
    openCoachNegotiation(coach, initialPromises, isDefaultCoach, buyoutFee)
  );

  const [step, setStep] = useState<"greeting" | "demands" | "agreed" | "rejected">("greeting");

  const greetingMsg = useMemo(() => getCoachGreeting(coach, clubName), [coach, clubName]);
  const acceptMsg = useMemo(() => getCoachAcceptanceQuote(coach), [coach]);
  const rejectMsg = useMemo(() => getCoachRejectionQuote(coach), [coach]);

  // Stato ed umore dell'allenatore (senza percentuali visibili, ma descrittori umani)
  const attitudeLabel =
    negState.patience > 75
      ? "Disposto all'ascolto"
      : negState.patience > 45
        ? "Attento e Rigido"
        : negState.patience > 20
          ? "Irritato dalle richieste"
          : "Al limite della rottura";

  const attitudeTone =
    negState.patience > 75
      ? "#3ddc6b"
      : negState.patience > 45
        ? "#8fd4a4"
        : negState.patience > 20
          ? "#ffc107"
          : "#ff4d4d";

  // Gestione dell'azione di compromesso o del bonus ingaggio su una richiesta
  const handleAction = (
    promiseId: string,
    action: "reduce_target" | "remove_promise" | "boost_salary" | "offer_alternative" | "delay",
  ) => {
    const { state: newState } = proposePromiseCompromise(negState, promiseId, action, marketCandidates);
    setNegState(newState);

    if (newState.status === "arenata") {
      setStep("rejected");
    }
  };

  const currentTotalCost = negState.hireCost + buyoutFee;

  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      {/* Header Chat con Clima Umano della Trattativa */}
      <header className="sticky top-0 z-20 border-b border-[var(--surface-border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base leading-tight font-extrabold">{coach.name}</h1>
                <NationFlag nation={coach.nation} />
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">
                {coach.tacticalPhilosophy ?? `Modulo ${coach.formationId}`} · {coach.nation}
              </p>
            </div>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-extrabold">{euro(currentTotalCost)}</span>
              <span className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase">
                {isDefaultCoach && currentTotalCost === 0
                  ? "Mister Reale (€0)"
                  : buyoutFee > 0
                    ? "Ingaggio + Riscatto"
                    : "Costo Ingaggio"}
              </span>
            </span>
          </div>

          {/* Clima Emotivo della Trattativa */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <HeartHandshake size={16} style={{ color: attitudeTone }} className="shrink-0" />
              <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Atteggiamento del Mister:
              </span>
              <span className="text-[11px] font-extrabold" style={{ color: attitudeTone }}>
                {attitudeLabel}
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] font-semibold">
              Budget Disp: <strong className="font-extrabold text-[var(--text-primary)]">{euro(budget)}</strong>
            </span>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 pb-36">
        {/* Messaggio 1: Saluto del Mister */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/20 text-base font-extrabold text-[var(--brand)]">
            {coach.name[0]}
          </div>
          <div className="flex-1 rounded-2xl rounded-tl-sm border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4 shadow-sm">
            <p className="text-xs font-bold text-[var(--brand)] uppercase tracking-wider mb-1">
              {coach.name}
            </p>
            <p className="text-sm leading-relaxed">{greetingMsg}</p>
          </div>
        </motion.div>

        {/* Log dei messaggi di trattativa con risposte umane */}
        {negState.log.slice(1).map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-start gap-3 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-extrabold ${
                msg.sender === "user"
                  ? "bg-[var(--surface-raised)] text-[var(--brand)] border border-[var(--brand)]/40"
                  : "bg-[var(--brand)]/20 text-[var(--brand)]"
              }`}
            >
              {msg.sender === "user" ? "DS" : coach.name[0]}
            </div>
            <div
              className={`flex-1 rounded-2xl p-4 shadow-sm text-xs leading-relaxed border ${
                msg.sender === "user"
                  ? "rounded-tr-sm bg-[var(--brand)]/10 border-[var(--brand)]/30 text-[var(--text-primary)]"
                  : "rounded-tl-sm bg-[var(--surface-raised)] border-[var(--surface-border)]"
              }`}
            >
              <p className="font-bold mb-1 text-[11px] uppercase tracking-wider">
                {msg.sender === "user" ? "Tu (Direttore Sportivo)" : coach.name}
              </p>
              <p className="text-sm leading-relaxed">{msg.text}</p>
            </div>
          </motion.div>
        ))}

        {/* Scheda delle Promesse e Opzioni di Compromesso Singolo */}
        {step !== "greeting" && negState.status === "in_corso" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4 shadow-sm"
          >
            <p className="text-xs font-bold text-[var(--brand)] uppercase tracking-wider">
              Richieste del Mister sul Tavolo della Trattativa:
            </p>

            <div className="flex flex-col gap-3">
              {negState.promises.map((p) => {
                const bonusAmount = p.salaryBonusDemanded ?? 1000000;

                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/5 p-3 text-xs"
                  >
                    <div className="flex items-start gap-2">
                      <Sparkles size={16} className="shrink-0 text-[var(--brand)] mt-0.5" />
                      <div className="flex-1">
                        <span className="font-bold block text-[var(--text-primary)]">{p.description}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          Priorità del Mister: {p.priority === "imprescindibile" ? "🔴 Imprescindibile" : p.priority === "negoziabile" ? "🟡 Negoziabile" : "🟢 Flessibile"}
                        </span>
                      </div>
                    </div>

                    {/* Opzioni iniziali per ogni promessa */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--surface-border)]/50">
                      <button
                        type="button"
                        onClick={() => handleAction(p.id, "reduce_target")}
                        className="rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] px-3 py-1.5 text-[11px] font-bold transition-colors hover:border-[var(--brand)]"
                      >
                        💡 Proponi un compromesso
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(p.id, "remove_promise")}
                        className="rounded-lg bg-[var(--surface)] border border-rose-500/40 text-rose-400 px-3 py-1.5 text-[11px] font-bold transition-colors hover:bg-rose-500/10"
                      >
                        ❌ Chiedi di rimuovere la richiesta
                      </button>
                      {p.targetRole && (
                        <button
                          type="button"
                          onClick={() => handleAction(p.id, "offer_alternative")}
                          className="rounded-lg bg-[var(--surface)] border border-sky-500/40 text-sky-400 px-3 py-1.5 text-[11px] font-bold transition-colors hover:bg-sky-500/10"
                        >
                          🔄 Proponi un'alternativa
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAction(p.id, "delay")}
                        className="rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] px-3 py-1.5 text-[11px] font-bold transition-colors hover:border-[var(--brand)]"
                      >
                        ⏳ Rimanda alla prossima finestra
                      </button>

                      {/* Se la richiesta è stata RIFIUTATA dal mister, sblocca la proposta di aumento ingaggio */}
                      {p.rejectedOffer && (
                        <button
                          type="button"
                          disabled={budget < currentTotalCost + bonusAmount}
                          onClick={() => handleAction(p.id, "boost_salary")}
                          className="w-full mt-1 rounded-lg bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 px-3 py-2 text-xs font-extrabold transition-all hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          💰 Offri bonus sull'ingaggio di +{euro(bonusAmount)} per rimuovere questa richiesta
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Accordo raggiunto */}
        {step === "agreed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center"
          >
            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
            <h3 className="text-base font-extrabold text-emerald-400">Accordo Raggiunto!</h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{acceptMsg}</p>
          </motion.div>
        )}

        {/* Rifiuto / Trattativa Arenata */}
        {step === "rejected" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-center"
          >
            <ShieldAlert size={32} className="mx-auto mb-2 text-rose-400" />
            <h3 className="text-base font-extrabold text-rose-400">Trattativa Interrotta</h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{rejectMsg}</p>
          </motion.div>
        )}
      </main>

      {/* Controlli Chat in Basso */}
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--surface-border)] bg-[var(--surface)]/95 backdrop-blur p-4">
        <div className="mx-auto flex w-full max-w-2xl gap-3">
          {step === "greeting" && (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-full border border-[var(--surface-border)] py-3 text-sm font-extrabold text-[var(--text-secondary)] transition-colors hover:border-[var(--brand)]"
              >
                Abbandona
              </button>
              <button
                type="button"
                onClick={() => setStep("demands")}
                className="flex-1 rounded-full bg-[var(--brand)] py-3 text-sm font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-95"
              >
                Ascolta le richieste
              </button>
            </>
          )}

          {step === "demands" && negState.status === "in_corso" && (
            <>
              <button
                type="button"
                onClick={() => setStep("rejected")}
                className="flex-1 rounded-full border border-rose-500/40 bg-rose-500/10 py-3 text-sm font-extrabold text-rose-400 transition-colors hover:bg-rose-500/20"
              >
                Rifiuta Condizioni
              </button>
              <button
                type="button"
                disabled={budget < currentTotalCost}
                onClick={() => {
                  setStep("agreed");
                  setTimeout(() => {
                    onAgree(coach, negState.promises, currentTotalCost);
                  }, 1200);
                }}
                className="flex-1 rounded-full bg-[var(--brand)] py-3 text-sm font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-95 disabled:opacity-50"
              >
                Firma Contratto ({euro(currentTotalCost)})
              </button>
            </>
          )}

          {(step === "agreed" || step === "rejected" || negState.status === "arenata") && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-full border border-[var(--surface-border)] py-3 text-sm font-extrabold transition-colors hover:border-[var(--brand)]"
            >
              Chiudi Chat
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
