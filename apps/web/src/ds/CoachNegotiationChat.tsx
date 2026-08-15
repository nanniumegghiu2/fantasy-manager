import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  HeartHandshake,
  Hourglass,
  Lightbulb,
  Repeat,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
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
  type CoachReport,
  type RoleCandidate,
  type RosterEntry,
} from "@app/game-engine";
import type { Role } from "@app/shared-types";
import { NationFlag } from "../classic/NationFlag";
import { euro } from "./format";
import { Button, Stepper, type Step } from "./ui";

/**
 * I due passi dell'accordo, nell'ordine in cui si fanno davvero: prima si sente cosa vuole,
 * poi si parla di soldi e di durata. Erano due schede parallele — vedi il commento sulla
 * sequenza più sotto.
 */
const PASSI: Step[] = [
  { key: "analisi", label: "La sua analisi" },
  { key: "richieste", label: "Richieste" },
  { key: "contratto", label: "Ingaggio e durata" },
];

/** Senza contratto da discutere (ingaggio di un mister nuovo) i passi sono due. */
const PASSI_SENZA_CONTRATTO: Step[] = [
  { key: "analisi", label: "La sua analisi" },
  { key: "richieste", label: "Richieste" },
];

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
  /**
   * **La sua lettura della rosa** (`coachReport.ts`), primo passo del tavolo.
   *
   * ⚠️ Richiesta dell'utente: *"non voglio più richieste con Overall, voglio una sua analisi
   * sulla squadra"*. Senza questo passo il mister apriva parlando per soglie numeriche — il
   * linguaggio del motore, non quello di un allenatore — e non diceva mai *perché* chiedeva
   * quello che chiedeva. Assente per un tecnico che ancora non conosce la squadra.
   */
  report?: CoachReport | null;
  /** Le dimissioni si annunciano qui: chi si alza dal tavolo lascia la panchina davvero. */
  onResign?: () => void;
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
  report,
  onResign,
  onAgree,
  onCancel,
}: CoachNegotiationChatProps) {
  /** Le due schede del meeting: cosa chiede in campo, e cosa chiede per sé. */
  const [scheda, setScheda] = useState<"analisi" | "richieste" | "contratto">(
    report ? "analisi" : "richieste",
  );
  /** Se il primo passo è stato affrontato: serve allo stepper per dire cosa è già fatto. */
  const [, setPassoRichiesteFatto] = useState(false);
  const [durataRinnovo, setDurataRinnovo] = useState(3);
  /**
   * ⚠️ Nasce **già scelta**, e non è un dettaglio: era `!requiresRenewal`, cioè falsa proprio
   * quando il rinnovo serviva, e da lì veniva il vicolo cieco del primo cancello della carriera
   * (`docs/piano-ds-mobile.md`, A3). La regola è "si può cambiare idea, non restare bloccati per
   * omissione": la durata è preselezionata, visibile ed evidenziata, e il passo la mostra col
   * costo totale prima di firmare — informata, non subita.
   */
  const [rinnovoScelto, setRinnovoScelto] = useState(true);


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
      {/* **Testata compattata.**

          Prima prendeva 250px per dire cinque cose, e due di quelle andavano a capo su 360px:
          la filosofia tattica col paese in coda, e «ATTEGGIAMENTO DEL MISTER:» su due righe
          per introdurre una parola sola. Il costo era doppio — spazio rubato alla
          conversazione, che restava con 500px di vuoto sotto, e nessuna delle cinque
          informazioni comunque leggibile in un colpo d'occhio.

          Ora: identità su una riga, e le tre informazioni di contesto (atteggiamento, budget,
          costo) come pastiglie che vanno a capo invece di comprimersi. */}
      <header className="sticky top-0 z-20 border-b border-[var(--surface-border)] bg-[var(--surface)]/95 pt-safe backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              aria-label="Torna indietro"
              className="-ml-2 flex h-tap w-tap shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-1.5 text-title leading-tight">
                <NationFlag nation={coach.nation} />
                <span className="truncate">{coach.name}</span>
              </h1>
              <p className="line-clamp-1 text-label text-[var(--text-secondary)]">
                {coach.tacticalPhilosophy ?? `Modulo ${coach.formationId}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-label font-bold"
              style={{ backgroundColor: `${attitudeTone}1f`, color: attitudeTone }}
            >
              <HeartHandshake size={12} />
              {attitudeLabel}
            </span>
            <span className="num rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-label font-bold text-[var(--text-secondary)]">
              Cassa {euro(budget)}
            </span>
            {currentTotalCost > 0 && (
              <span className="num rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-label font-bold text-[var(--accent)]">
                {buyoutFee > 0 ? "Ingaggio + riscatto" : "Ingaggio"} {euro(currentTotalCost)}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ⚠️ **Una sequenza, non due schede** — richiesta esplicita dell'utente: *«deve essere
          una sequenza di azioni, prima le richieste, poi ingaggio e durata di contratto»*.

          Ed è anche il difetto peggiore trovato dalla diagnosi (`docs/piano-ds-mobile.md`, A3).
          Le due schede presentavano come **paralleli e opzionali** due passi che sono
          **sequenziali e obbligatori**: una barra a schede dice "guarda dove vuoi", mentre la
          verità qui è "prima questo, poi quello, e senza il secondo non si chiude". Il prezzo
          era misurabile — il blocco («scegli la durata») era comunicato da un **pallino rosso
          di 6px**, e uno script che prova tutte le parole di conferma della lingua italiana non
          è riuscito a superare questa schermata in tre tentativi.

          Si può tornare indietro su un passo già fatto — cambiare idea è legittimo — ma non
          saltare avanti: sarebbe di nuovo la barra a schede, con lo stesso difetto. */}
      {(contract || report) && (
        <div className="mx-auto w-full max-w-2xl px-4 pt-3">
          {(() => {
            const passi = contract ? PASSI : PASSI_SENZA_CONTRATTO;
            const offset = report ? 0 : 1; // senza analisi il primo passo è "richieste"
            const indice = scheda === "analisi" ? 0 : scheda === "richieste" ? 1 : 2;
            const visibili = report ? passi : passi.slice(1);
            return (
              <Stepper
                steps={visibili}
                current={Math.max(0, indice - offset)}
                furthest={visibili.length - 1}
                onGoTo={(i) => {
                  const chiave = visibili[i]?.key;
                  if (chiave === "analisi") setScheda("analisi");
                  else if (chiave === "richieste") setScheda("richieste");
                  else setScheda("contratto");
                }}
              />
            );
          })()}
        </div>
      )}

      {/* **La sua analisi**: cosa vede lui guardando questa rosa. Viene prima di tutto perché è
          il motivo delle richieste che arrivano dopo — leggerle senza sapere da dove nascono era
          esattamente ciò che le faceva sembrare arbitrarie. */}
      {report && scheda === "analisi" && (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 py-5 pb-44">
          <p className="rounded-card rounded-tl-sm border border-[var(--brand)]/30 bg-[var(--brand)]/8 p-4 text-body leading-relaxed">
            «{report.headline}»
          </p>

          {report.objectiveTalk && (
            <section className="rounded-card border border-[#ffc107]/40 bg-[#ffc107]/8 p-4">
              <p className="flex items-center gap-2 text-micro font-extrabold tracking-widest text-[#b8860b] uppercase">
                <ShieldAlert size={13} /> Perché non ci stiamo arrivando
              </p>
              <p className="mt-1.5 text-label leading-relaxed">«{report.objectiveTalk.diagnosis}»</p>
              <p className="mt-2 text-label leading-relaxed font-semibold">
                «{report.objectiveTalk.needed}»
              </p>
            </section>
          )}

          {report.weakSpots.length > 0 && (
            <section>
              <p className="mb-1.5 text-micro font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
                Dove siamo corti
              </p>
              <ul className="flex flex-col gap-1.5">
                {report.weakSpots.map((w) => (
                  <li
                    key={w.role}
                    className="rounded-control border-l-3 border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2 text-label leading-relaxed"
                    style={{ borderLeftColor: w.kind === "scoperto" ? "#ff4d4d" : "#ffab2e" }}
                  >
                    «{w.text}»
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.untouchables.length > 0 && (
            <section>
              <p className="mb-1.5 text-micro font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
                Chi non si tocca
              </p>
              <ul className="flex flex-col gap-1.5">
                {report.untouchables.map((u) => (
                  <li
                    key={u.playerId}
                    className="rounded-control border-l-3 border-[#f5c518] bg-[var(--surface-raised)] px-3 py-2 text-label leading-relaxed"
                  >
                    «{u.text}»
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(report.wanted || report.unwanted) && (
            <section>
              <p className="mb-1.5 text-micro font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
                I nomi che fa
              </p>
              <ul className="flex flex-col gap-1.5">
                {report.wanted && (
                  <li className="rounded-control border-l-3 border-[#3ddc6b] bg-[var(--surface-raised)] px-3 py-2 text-label leading-relaxed">
                    «{report.wanted.text}»
                  </li>
                )}
                {report.unwanted && (
                  <li className="rounded-control border-l-3 border-[#ff8a3d] bg-[var(--surface-raised)] px-3 py-2 text-label leading-relaxed">
                    «{report.unwanted.text}»
                  </li>
                )}
              </ul>
            </section>
          )}

          <section>
            <p className="mb-1.5 text-micro font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
              Sul gruppo
            </p>
            <ul className="flex flex-col gap-1.5">
              {report.wishes.map((w) => (
                <li
                  key={w.kind}
                  className="rounded-control bg-[var(--surface-raised)] px-3 py-2 text-label leading-relaxed"
                >
                  «{w.text}»
                </li>
              ))}
            </ul>
          </section>

          <Button onClick={() => setScheda("richieste")}>Passa alle sue richieste</Button>
        </main>
      )}

      {contract && scheda === "contratto" && (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 py-6 pb-44">
          <section className="rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4">
            <p className="text-micro font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
              Contratto in essere
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p
                  className="text-title leading-none font-extrabold tabular-nums"
                  style={{ color: contract.seasonsLeft <= 1 ? "#ff4d4d" : undefined }}
                >
                  {contract.seasonsLeft <= 0
                    ? "Scaduto"
                    : `${contract.seasonsLeft} ${contract.seasonsLeft === 1 ? "stagione" : "stagioni"}`}
                </p>
                <p className="mt-1 text-label text-[var(--text-secondary)]">durata residua</p>
              </div>
              <div>
                <p className="text-title leading-none font-extrabold tabular-nums">
                  {euro(contract.wage)}
                </p>
                <p className="mt-1 text-label text-[var(--text-secondary)]">ingaggio annuo</p>
              </div>
            </div>
            <p className="mt-3 text-label text-[var(--text-secondary)]">
              Liberarsene oggi costerebbe <strong>{euro(contract.severance)}</strong> di
              buonuscita · margine ingaggi disponibile <strong>{euro(contract.wageRoom)}</strong>.
            </p>
          </section>

          {requiresRenewal ? (
            <section className="rounded-card border border-[#ff4d4d]/40 bg-[#ff4d4d]/8 p-4">
              <p className="flex items-center gap-2 text-label font-extrabold text-[#ff4d4d]">
                <ShieldAlert size={14} /> Vuole il rinnovo, adesso
              </p>
              <p className="mt-1.5 text-label leading-relaxed">
                «Direttore, il mio contratto è agli sgoccioli. Prima di parlare di mercato e di
                obiettivi voglio sapere se qui ci sarò ancora l'anno prossimo.»
              </p>

              {/* ⚠️ Erano **cinque bottoni nudi «1 2 3 4 5»**, senza stato selezionato e con lo
                  stesso stile delle scatole di statistica appena sopra: non sembravano nemmeno
                  premibili, ed erano l'unica cosa che sbloccava l'intera schermata. Ora ogni
                  opzione dichiara la sua **conseguenza** — quanto costa in tutto — perché è
                  quella l'informazione su cui si sceglie, non il numero di anni in sé. */}
              <p className="mt-3 text-micro text-[var(--text-secondary)] uppercase">
                Quanto lo leghi al club
              </p>
              <div className="mt-1.5 flex gap-1.5">
                {[1, 2, 3, 4, 5].map((anni) => {
                  const scelto = rinnovoScelto && durataRinnovo === anni;
                  return (
                    <button
                      key={anni}
                      type="button"
                      aria-pressed={scelto}
                      onClick={() => {
                        setDurataRinnovo(anni);
                        setRinnovoScelto(true);
                      }}
                      className={`flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5 rounded-control border-2 transition-colors ${
                        scelto
                          ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-contrast)]"
                          : "border-transparent bg-[var(--surface-raised)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <span className="num text-title leading-none">{anni}</span>
                      <span className="text-micro tracking-normal">
                        {anni === 1 ? "anno" : "anni"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-label text-[var(--text-secondary)]">
                {rinnovoScelto ? (
                  <>
                    <strong className="num text-[var(--text-primary)]">
                      {euro(contract.wage)}/anno
                    </strong>{" "}
                    per {durataRinnovo} {durataRinnovo === 1 ? "stagione" : "stagioni"} — in tutto{" "}
                    <strong className="num text-[var(--text-primary)]">
                      {euro(contract.wage * durataRinnovo)}
                    </strong>
                    . Un contratto lungo costa meno all'anno ma lega; uno corto lo lascia
                    corteggiabile a zero.
                  </>
                ) : (
                  "Tocca una durata qui sopra: senza rinnovo l'accordo non si chiude e a fine stagione la panchina resta libera."
                )}
              </p>
            </section>
          ) : (
            <p className="rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4 text-label leading-relaxed text-[var(--text-secondary)]">
              Il contratto regge ancora: se ne riparlerà quando sarà in scadenza. Fino ad allora,
              mandarlo via costa la buonuscita qui sopra.
            </p>
          )}
        </main>
      )}

      {/* Chat Area — **ancorata in basso**, come una conversazione vera.

          Con `justify-end` i messaggi crescono verso l'alto e restano attaccati alle risposte:
          prima erano incollati in cima e lasciavano ~500px di vuoto assoluto fra l'ultima
          battuta e i pulsanti, mentre il testo attorno era a 10-11px. Il vuoto stava nel posto
          sbagliato — fra ciò che si legge e ciò che si tocca. */}
      <main
        className={`mx-auto w-full max-w-2xl flex-1 flex-col justify-end gap-4 px-4 py-5 pb-44 ${
          scheda !== "richieste" ? "hidden" : "flex"
        }`}
      >
        {/* Messaggio 1: Saluto del Mister */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/20 text-body font-extrabold text-[var(--brand)]">
            {coach.name[0]}
          </div>
          <div className="flex-1 rounded-card rounded-tl-sm border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4 shadow-sm">
            <p className="text-micro font-bold text-[var(--brand)] uppercase tracking-wider mb-1">
              {coach.name}
            </p>
            <p className="text-body leading-relaxed">{greetingMsg}</p>
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
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-body font-extrabold ${
                msg.sender === "user"
                  ? "bg-[var(--surface-raised)] text-[var(--brand)] border border-[var(--brand)]/40"
                  : "bg-[var(--brand)]/20 text-[var(--brand)]"
              }`}
            >
              {msg.sender === "user" ? "DS" : coach.name[0]}
            </div>
            <div
              className={`flex-1 rounded-card p-4 shadow-sm text-label leading-relaxed border ${
                msg.sender === "user"
                  ? "rounded-tr-sm bg-[var(--brand)]/10 border-[var(--brand)]/30 text-[var(--text-primary)]"
                  : "rounded-tl-sm bg-[var(--surface-raised)] border-[var(--surface-border)]"
              }`}
            >
              <p className="font-bold mb-1 text-micro uppercase tracking-wider">
                {msg.sender === "user" ? "Tu (Direttore Sportivo)" : coach.name}
              </p>
              <p className="text-body leading-relaxed">{msg.text}</p>
            </div>
          </motion.div>
        ))}

        {/* Scheda delle Promesse e Opzioni di Compromesso Singolo */}
        {step !== "greeting" && negState.status === "in_corso" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3 rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4 shadow-sm"
          >
            <p className="text-micro text-[var(--brand)] uppercase">Cosa chiede</p>

            <div className="flex flex-col gap-3">
              {negState.promises.map((p) => {
                const bonusAmount = p.salaryBonusDemanded ?? 1000000;
                /* La priorità come colore e parola, non come pallino emoji: 🔴🟡🟢 sono
                   vietate da CLAUDE.md § 8 e per giunta si disegnano con font di sistema
                   diversi su Android e iOS, quindi la stessa schermata cambiava aspetto fra
                   due telefoni. */
                const priorita =
                  p.priority === "imprescindibile"
                    ? { testo: "Imprescindibile", colore: "var(--danger)" }
                    : p.priority === "negoziabile"
                      ? { testo: "Negoziabile", colore: "var(--draw)" }
                      : { testo: "Flessibile", colore: "var(--win)" };

                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-2.5 rounded-control border border-[var(--brand)]/30 bg-[var(--brand)]/5 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <Sparkles size={16} className="mt-0.5 shrink-0 text-[var(--brand)]" />
                      <div className="min-w-0 flex-1">
                        <span className="block text-body font-bold text-balance">
                          {p.description}
                        </span>
                        <span
                          className="mt-1 inline-flex rounded-full px-2 py-0.5 text-label font-bold"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${priorita.colore} 15%, transparent)`,
                            color: priorita.colore,
                          }}
                        >
                          {priorita.testo}
                        </span>
                      </div>
                    </div>

                    {/* Le mosse erano alte **29px** e tagliate a metà («❌ Chiedi di rimuovere
                        la r…»), pur essendo le decisioni più importanti della schermata. Ora
                        stanno in colonna, a piena larghezza e a 44px. */}
                    <div className="flex flex-col gap-1.5 border-t border-[var(--surface-border)]/50 pt-2.5">
                      <Button
                        variant="secondary"
                        icon={Lightbulb}
                        block
                        onClick={() => handleAction(p.id, "reduce_target")}
                      >
                        Proponi un compromesso
                      </Button>
                      {p.targetRole && (
                        <Button
                          variant="secondary"
                          icon={Repeat}
                          block
                          onClick={() => handleAction(p.id, "offer_alternative")}
                        >
                          Proponi un'alternativa
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        icon={Hourglass}
                        block
                        onClick={() => handleAction(p.id, "delay")}
                      >
                        Rimanda alla prossima finestra
                      </Button>
                      <Button
                        variant="danger"
                        icon={X}
                        block
                        onClick={() => handleAction(p.id, "remove_promise")}
                      >
                        Chiedi di toglierla
                      </Button>

                      {/* Se la richiesta è stata RIFIUTATA dal mister, sblocca la proposta di aumento ingaggio */}
                      {p.rejectedOffer && (
                        <Button
                          variant="secondary"
                          icon={Banknote}
                          block
                          onClick={() => handleAction(p.id, "boost_salary")}
                          blockedReason={
                            budget < currentTotalCost + bonusAmount
                              ? `La cassa non copre il bonus: mancano ${euro(currentTotalCost + bonusAmount - budget)}.`
                              : undefined
                          }
                        >
                          Bonus di {euro(bonusAmount)} per toglierla
                        </Button>
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
            className="rounded-card border border-emerald-500/40 bg-emerald-500/10 p-4 text-center"
          >
            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
            <h3 className="text-body font-extrabold text-emerald-400">Accordo Raggiunto!</h3>
            <p className="mt-1 text-label text-[var(--text-secondary)]">{acceptMsg}</p>
          </motion.div>
        )}

        {/* Rifiuto / Trattativa Arenata */}
        {step === "rejected" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-card border border-rose-500/40 bg-rose-500/10 p-4 text-center"
          >
            <ShieldAlert size={32} className="mx-auto mb-2 text-rose-400" />
            <h3 className="text-body font-extrabold text-rose-400">Trattativa Interrotta</h3>
            <p className="mt-1 text-label text-[var(--text-secondary)]">{rejectMsg}</p>
          </motion.div>
        )}
      </main>

      {/* Controlli Chat in Basso */}
      {/**
       * ⚠️ **La barra dei bottoni finiva sotto il bordo dello schermo su mobile.**
       *
       * Era ancorata a `bottom-0` con un padding fisso: sui telefoni, dove la barra di sistema
       * (o l indicatore home) occupa gli ultimi millimetri, il tasto per chiudere il meeting
       * risultava tagliato e difficile da centrare col pollice. `env(safe-area-inset-bottom)`
       * e la sola misura che conosce quello spazio; il contenuto sopra ha un margine di pari
       * misura, altrimenti l ultima riga della trattativa resterebbe nascosta dietro la barra.
       */}
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--surface-border)] bg-[var(--surface)]/95 px-4 pt-4 backdrop-blur pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {/* ⚠️ **Una sola azione primaria per passo, sempre nella stessa posizione.**

            Prima qui convivevano un rosso vistoso («Rifiuta Condizioni») e un pulsante spento
            che recitava «Manca il rinnovo»: l'unica cosa ovviamente premibile era quella che
            mandava tutto a monte. La regola che ne nasce, e che vale per tutta la modalità: un
            primario **non descrive mai il problema** — o è abilitato, o dice *l'azione che lo
            sblocca* e ci porta. L'uscita scende a testo secondario, dove vanno le uscite. */}
        <div className="mx-auto w-full max-w-2xl">
          {/* Sul passo dell'analisi l'unica azione è passare oltre: il footer non deve offrire
              «ascolta le sue richieste» mentre le si sta ancora leggendo. */}
          {scheda === "analisi" && (
            <Button size="lg" block onClick={() => setScheda("richieste")}>
              Passa alle sue richieste
            </Button>
          )}

          {scheda !== "analisi" && step === "greeting" && (
            <div className="flex flex-col gap-2">
              <Button size="lg" block onClick={() => setStep("demands")}>
                Ascolta le sue richieste
              </Button>
              <Button variant="ghost" block onClick={onCancel}>
                Abbandona la trattativa
              </Button>
            </div>
          )}

          {scheda !== "analisi" && step === "demands" && negState.status === "in_corso" && (
            <div className="flex flex-col gap-2">
              {/* ⚠️ **Il primario avanza, non si blocca.**

                  Il primo tentativo di rinnovo faceva navigare il pulsante bloccato al passo
                  mancante — meglio del muto «Manca il rinnovo», ma la verifica automatica ha
                  mostrato il difetto residuo: arrivati al passo 2 il pulsante continuava a dire
                  «Passa a ingaggio e durata», cioè invitava dov'era già. Un anello.

                  La regola giusta era già scritta nel piano e non l'avevo applicata: *nessun
                  passo comincia senza una scelta valida in campo — si può cambiare idea, non
                  restare bloccati per omissione*. La durata nasce quindi preselezionata e
                  visibile, e il primario dice sempre **il passo successivo**. */}
              {requiresRenewal && scheda === "richieste" ? (
                <Button size="lg" block onClick={() => { setPassoRichiesteFatto(true); setScheda("contratto"); }}>
                  Passa a ingaggio e durata
                </Button>
              ) : (
                <Button
                  size="lg"
                  block
                  onClick={() => {
                    setPassoRichiesteFatto(true);
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
                  blockedReason={
                    budget < currentTotalCost
                      ? `Servono ${euro(currentTotalCost - budget)} in più: togli una richiesta o proponi un compromesso.`
                      : undefined
                  }
                  onBlockedClick={
                    budget < currentTotalCost ? () => setScheda("richieste") : undefined
                  }
                >
                  {`Chiudi l'accordo · ${euro(currentTotalCost)}`}
                </Button>
              )}
              <Button variant="ghost" block onClick={() => setStep("rejected")}>
                Rifiuta le sue condizioni
              </Button>
            </div>
          )}

          {/**
           * ⚠️ **Chi si alza dal tavolo lascia la panchina.**
           *
           * Richiesta dell'utente: *"nella stessa schermata si deve discutere il suo rinnovo o le
           * sue dimissioni se non si trova un accordo, e se si dimette si deve immediatamente
           * cercare un sostituto"*. Prima rifiutare le condizioni chiudeva la schermata e basta:
           * il mister restava in panchina con quindici punti di sintonia in meno, cioè il
           * "rifiuto" non era una decisione ma un modo di uscire. Ora, quando il rinnovo è la
           * sua condizione, il no è una separazione — e la panchina resta vuota finché non se
           * ne trova un altro.
           */}
          {(step === "rejected" || negState.status === "arenata") && onResign ? (
            <Button variant="danger" size="lg" block onClick={onResign}>
              Prendi atto delle dimissioni
            </Button>
          ) : (
            (step === "agreed" || step === "rejected" || negState.status === "arenata") && (
              <Button variant="secondary" size="lg" block onClick={onCancel}>
                Chiudi
              </Button>
            )
          )}
        </div>
      </footer>
    </div>
  );
}
