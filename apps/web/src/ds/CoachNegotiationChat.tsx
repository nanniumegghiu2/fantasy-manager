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
  /**
   * **Il contratto del mister, dentro il meeting delle sue richieste.**
   *
   * Prima non c'era da nessuna parte: `expireContracts` scriveva *"va rinnovato o lascia la
   * panchina"* e riapriva il meeting, ma il meeting negoziava solo le promesse tecniche — non
   * firmava nulla, non toccava `coachContract`, non aveva una durata. Il mister restava in
   * panchina a contratto scaduto, col suo ingaggio ancora sul monte e la buonuscita a zero,
   * cioè cambiarlo diventava gratis proprio quando non doveva.
   *
   * Assente = ingaggio di un mister nuovo, dove il contratto si firma comunque a valle.
   */
  contract?: {
    /** Stagioni ancora coperte, contando quella che comincia. Zero = già scaduto. */
    seasonsLeft: number;
    wage: number;
    /** Quanto costerebbe liberarsene oggi. */
    severance: number;
    /** Margine ingaggi disponibile: dice se il rinnovo è sostenibile. */
    wageRoom: number;
  };
  /**
   * Il rinnovo è **una delle sue richieste**, non un'opzione: senza, l'accordo non si chiude.
   * Vale quando restano zero o una stagione (richiesta esplicita dell'utente).
   */
  requiresRenewal?: boolean;
  onAgree: (coach: Coach, promises: CoachPromise[], cost: number, renewSeasons?: number) => void;
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
  contract,
  requiresRenewal = false,
  onAgree,
  onCancel,
}: CoachNegotiationChatProps) {
  /** Le due schede del meeting: cosa chiede in campo, e cosa chiede per sé. */
  const [scheda, setScheda] = useState<"richieste" | "contratto">("richieste");
  const [durataRinnovo, setDurataRinnovo] = useState(3);
  /** Finché il rinnovo è dovuto e non si è scelta una durata, l'accordo non si chiude. */
  const [rinnovoScelto, setRinnovoScelto] = useState(!requiresRenewal);


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

      {/* Le due schede: le richieste tecniche e il suo contratto. Il contratto sta qui e non
          altrove perché è una **sua** richiesta come le altre — e perché è l'unico posto in cui
          l'utente passa ogni anno, quindi l'unico in cui la scadenza non può sfuggirgli. */}
      {contract && (
        <div className="mx-auto flex w-full max-w-2xl gap-1 px-4 pt-3">
          {(["richieste", "contratto"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setScheda(key)}
              className={`relative min-h-10 flex-1 rounded-full px-3 text-xs font-bold transition-colors ${
                scheda === key
                  ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                  : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
              }`}
            >
              {key === "richieste" ? "Richieste" : "Contratto"}
              {key === "contratto" && requiresRenewal && !rinnovoScelto && (
                <span className="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-[#ff4d4d]" />
              )}
            </button>
          ))}
        </div>
      )}

      {contract && scheda === "contratto" && (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 py-6 pb-36">
          <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4">
            <p className="text-[10px] font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
              Contratto in essere
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p
                  className="text-lg leading-none font-extrabold tabular-nums"
                  style={{ color: contract.seasonsLeft <= 1 ? "#ff4d4d" : undefined }}
                >
                  {contract.seasonsLeft <= 0
                    ? "Scaduto"
                    : `${contract.seasonsLeft} ${contract.seasonsLeft === 1 ? "stagione" : "stagioni"}`}
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-secondary)]">durata residua</p>
              </div>
              <div>
                <p className="text-lg leading-none font-extrabold tabular-nums">
                  {euro(contract.wage)}
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-secondary)]">ingaggio annuo</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-[var(--text-secondary)]">
              Liberarsene oggi costerebbe <strong>{euro(contract.severance)}</strong> di
              buonuscita · margine ingaggi disponibile <strong>{euro(contract.wageRoom)}</strong>.
            </p>
          </section>

          {requiresRenewal ? (
            <section className="rounded-2xl border border-[#ff4d4d]/40 bg-[#ff4d4d]/8 p-4">
              <p className="flex items-center gap-2 text-xs font-extrabold text-[#ff4d4d]">
                <ShieldAlert size={14} /> Vuole il rinnovo, adesso
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed">
                «Direttore, il mio contratto è agli sgoccioli. Prima di parlare di mercato e di
                obiettivi voglio sapere se qui ci sarò ancora l'anno prossimo.»
              </p>

              <p className="mt-3 text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                Durata del rinnovo
              </p>
              <div className="mt-1.5 flex gap-1.5">
                {[1, 2, 3, 4, 5].map((anni) => (
                  <button
                    key={anni}
                    type="button"
                    onClick={() => {
                      setDurataRinnovo(anni);
                      setRinnovoScelto(true);
                    }}
                    className={`min-h-11 flex-1 rounded-xl text-sm font-extrabold transition-colors ${
                      rinnovoScelto && durataRinnovo === anni
                        ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                        : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {anni}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                {rinnovoScelto
                  ? `${euro(contract.wage)}/anno per ${durataRinnovo} ${durataRinnovo === 1 ? "stagione" : "stagioni"} — totale ${euro(contract.wage * durataRinnovo)}. Un contratto lungo costa meno all'anno ma lega; uno corto lo lascia corteggiabile a zero.`
                  : "Scegli una durata: senza rinnovo l'accordo non si chiude e a fine stagione la panchina è libera."}
              </p>
            </section>
          ) : (
            <p className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              Il contratto regge ancora: se ne riparlerà quando sarà in scadenza. Fino ad allora,
              mandarlo via costa la buonuscita qui sopra.
            </p>
          )}
        </main>
      )}

      {/* Chat Area */}
      <main
        className={`mx-auto w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 pb-36 ${
          contract && scheda === "contratto" ? "hidden" : "flex"
        }`}
      >
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
                disabled={budget < currentTotalCost || !rinnovoScelto}
                onClick={() => {
                  // Se il rinnovo è dovuto ma non si è ancora scelta la durata, la scheda si
                  // apre invece di chiudere l'accordo: il bottone dice cosa manca, non si limita
                  // a essere spento.
                  if (requiresRenewal && !rinnovoScelto) {
                    setScheda("contratto");
                    return;
                  }
                  setStep("agreed");
                  setTimeout(() => {
                    onAgree(
                      coach,
                      negState.promises,
                      currentTotalCost,
                      requiresRenewal ? durataRinnovo : undefined,
                    );
                  }, 1200);
                }}
                className="flex-1 rounded-full bg-[var(--brand)] py-3 text-sm font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-95 disabled:opacity-50"
              >
                {requiresRenewal && !rinnovoScelto
                  ? "Manca il rinnovo"
                  : `Firma Contratto (${euro(currentTotalCost)})`}
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
