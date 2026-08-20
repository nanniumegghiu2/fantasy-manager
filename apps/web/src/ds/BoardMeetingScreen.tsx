import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  Coins,
  ShieldCheck,
  Target,
  TrendingDown,
  Trophy,
  TrendingUp,
  UserMinus,
} from "lucide-react";
import { boardConfidenceLabel, seasonYearLabel, type BoardMeeting, type BoardState } from "@app/game-engine";
import { Button, Stepper, type Step } from "./ui";
import { euro } from "./format";

/**
 * **Il colloquio con la società.**
 *
 * ⚠️ Segnalazione dell'utente: *"il meeting società è ancora troppo scarno, deve essere un
 * colloquio dove loro mi espongono il loro obiettivo minimo e si trova un accordo di obiettivi e
 * budget, se mantenere o meno il mister"*. Prima c'erano due cose separate — un avviso di esonero
 * che appariva solo dopo una stagione storta, e una schermata in cui l'obiettivo lo sceglieva il
 * DS da solo — e in nessuna delle due il presidente diceva mai cosa si aspettava. Non c'era una
 * controparte, quindi non c'era niente da negoziare.
 *
 * Tre passi, e sono **sequenziali e obbligati** (`Stepper`, non schede): prima si ascolta, poi si
 * concorda l'obiettivo e i mezzi, poi si decide della panchina. L'ordine non è estetico — quanto
 * si può promettere dipende da chi lo porterà in campo.
 */
export function BoardMeetingScreen({
  meeting,
  board,
  onAgree,
}: {
  meeting: BoardMeeting;
  board: BoardState;
  onAgree: (decision: {
    objectiveLabel: string;
    extraSteps: number;
    coachChoice?: "esonera" | "difendi";
    /**
     * ⚠️ **Le coppe si concordano qui**, non in una seconda schermata.
     *
     * Prima esistevano due tavoli: questo per campionato, mezzi e panchina, e subito dopo una
     * schermata a parte per le coppe — dove il presidente non c'era affatto, quindi erano una
     * dichiarazione unilaterale invece che un accordo. Un obiettivo è uno solo: si tratta in
     * un posto solo.
     */
    cupChoices?: Partial<Record<"continental" | "national", string>>;
  }) => void;
}) {
  const fiducia = boardConfidenceLabel(board.confidence);
  const [scelta, setScelta] = useState(
    () => meeting.options.find((o) => o.stance === "minimo")?.label ?? meeting.options[0]?.label ?? "",
  );
  const [extra, setExtra] = useState(0);
  /** Le fasce di coppa: si parte da quella pretesa, cioè da un accordo già valido. */
  const [coppe, setCoppe] = useState<Partial<Record<"continental" | "national", string>>>(() =>
    Object.fromEntries(meeting.cups.map((c) => [c.key, c.minimum.label])),
  );
  const [coach, setCoach] = useState<"esonera" | "difendi" | null>(null);
  const [passo, setPasso] = useState(0);
  const [massimo, setMassimo] = useState(0);

  const passi: Step[] = useMemo(() => {
    const out: Step[] = [{ key: "ascolto", label: "Il consiglio" }, { key: "accordo", label: "L'accordo" }];
    if (meeting.cups.length > 0) out.push({ key: "coppe", label: "Le coppe" });
    if (meeting.coachIssue) out.push({ key: "mister", label: "La panchina" });
    return out;
  }, [meeting.cups.length, meeting.coachIssue]);

  /** Gli indici dei passi variabili: dipendono da quante competizioni si giocano. */
  const passoCoppe = meeting.cups.length > 0 ? 2 : -1;
  const passoMister = meeting.coachIssue ? (meeting.cups.length > 0 ? 3 : 2) : -1;
  const chiudi = () =>
    onAgree({ objectiveLabel: scelta, extraSteps: extra, cupChoices: coppe });

  const opzione = meeting.options.find((o) => o.label === scelta);
  const passoExtra = meeting.extraBudget.max / meeting.extraBudget.step;
  const extraChiesto = Math.round(passoExtra * extra);
  const fatturatoStimato = Math.round(meeting.baseRevenue * (opzione?.budgetMultiplier ?? 1));

  function vai(indice: number) {
    setPasso(indice);
    setMassimo((m) => Math.max(m, indice));
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="flex max-h-[92svh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--surface-border)] bg-[var(--surface)] sm:rounded-card"
      >
        <header className="flex items-start gap-3 border-b border-[var(--surface-border)] p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-raised)]">
            <Building2 size={17} className="text-[var(--brand)]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-micro font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
              Colloquio con la società · Stagione {meeting.season} · {seasonYearLabel(meeting.season)}
            </p>
            <p className="text-body leading-tight font-extrabold">Obiettivi, mezzi e panchina</p>
          </div>
          <span className="shrink-0 text-right">
            <span className="block text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
              Fiducia
            </span>
            <span className="num block text-label font-extrabold" style={{ color: fiducia.tone }}>
              {board.confidence}%
            </span>
          </span>
        </header>

        <div className="border-b border-[var(--surface-border)] px-3 py-2">
          <Stepper steps={passi} current={passo} furthest={massimo} onGoTo={vai} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {passo === 0 && (
            <>
              {meeting.review && (
                <p className="rounded-card bg-[var(--surface-raised)] p-3 text-label leading-relaxed">
                  «{meeting.review}»
                </p>
              )}
              <p className="rounded-card border border-[var(--brand)]/30 bg-[var(--brand)]/8 p-3 text-body leading-relaxed">
                «{meeting.speech}»
              </p>

              {/* Il numero che il DS deve portarsi al passo dopo: qual è l'asticella. */}
              <div className="flex items-center gap-3 rounded-card border border-[var(--surface-border)] p-3">
                <Target size={18} className="shrink-0 text-[var(--accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                    Richiesta minima del consiglio
                  </span>
                  <span className="block text-title leading-tight font-extrabold">
                    {meeting.minimum.label}
                  </span>
                  <span className="block text-label text-[var(--text-secondary)]">
                    entro la {meeting.minimum.targetPosition}ª posizione
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between rounded-card border border-[var(--surface-border)] p-3">
                <span className="text-micro font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
                  Fatturato di partenza
                </span>
                <span className="num text-body font-extrabold">{euro(meeting.baseRevenue)}</span>
              </div>

              <Button onClick={() => vai(1)}>Passa all'accordo</Button>
            </>
          )}

          {passo === 1 && (
            <>
              <p className="text-label leading-relaxed text-[var(--text-secondary)]">
                Puoi accettare la loro richiesta, alzare l'asticella per avere più mezzi, o
                abbassarla — e in quel caso te ne ricorderanno.
              </p>

              <ul className="flex flex-col gap-2">
                {meeting.options.map((o) => {
                  const attiva = o.label === scelta;
                  const colore =
                    o.stance === "sopra" ? "#3ddc6b" : o.stance === "sotto" ? "#ff8a3d" : "var(--brand)";
                  return (
                    <li key={o.label}>
                      <button
                        type="button"
                        onClick={() => setScelta(o.label)}
                        className="flex w-full min-h-tap items-start gap-3 rounded-card border p-3 text-left transition-transform active:scale-98"
                        style={{
                          borderColor: attiva ? colore : "var(--surface-border)",
                          backgroundColor: attiva ? `${colore}14` : "var(--surface-raised)",
                        }}
                      >
                        <span className="mt-0.5 shrink-0" style={{ color: colore }}>
                          {o.stance === "sopra" ? (
                            <TrendingUp size={16} />
                          ) : o.stance === "sotto" ? (
                            <TrendingDown size={16} />
                          ) : (
                            <Target size={16} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-body font-extrabold">{o.label}</span>
                            <span
                              className="num shrink-0 text-label font-extrabold"
                              style={{ color: o.budgetMultiplier >= 1 ? "#3ddc6b" : "#ff8a3d" }}
                            >
                              {o.budgetMultiplier === 1
                                ? "fatturato invariato"
                                : `${o.budgetMultiplier > 1 ? "+" : ""}${Math.round((o.budgetMultiplier - 1) * 100)}% fatturato`}
                            </span>
                          </span>
                          <span className="block text-label text-[var(--text-secondary)]">
                            entro la {o.targetPosition}ª
                            {o.stance === "sotto" && " · sotto la richiesta del consiglio"}
                            {o.stance === "sopra" && " · più di quanto chiedano"}
                          </span>
                          {attiva && (
                            <span className="mt-1.5 block text-label leading-snug italic">{o.reply}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* La seconda metà dell'accordo: i mezzi. Chiederli costa fiducia a scalini, e il
                  presidente concede in proporzione a quanto in alto si è puntato — senza quel
                  legame sarebbe un pulsante "più soldi" da premere sempre. */}
              <div className="rounded-card border border-[var(--surface-border)] p-3">
                <div className="flex items-center gap-2">
                  <Coins size={15} className="shrink-0 text-[var(--accent)]" />
                  <span className="text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                    Fondi in più sul mercato
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {Array.from({ length: meeting.extraBudget.step + 1 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setExtra(i)}
                      className={`min-h-tap flex-1 rounded-control text-label font-extrabold ${
                        extra === i
                          ? "bg-[var(--accent)] text-[var(--brand-contrast)]"
                          : "border border-[var(--surface-border)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {i === 0 ? "no" : `+${Math.round((passoExtra * i) / 1_000_000)}M`}
                    </button>
                  ))}
                </div>
                <p className="num mt-2 text-label text-[var(--text-secondary)]">
                  {extra === 0
                    ? "Nessuna richiesta: la fiducia resta dov'è."
                    : `Chiedi ${euro(extraChiesto)} · costa ${extra * meeting.extraBudget.confidenceCostPerStep} punti di fiducia, e concedono solo in proporzione all'ambizione dichiarata.`}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-card bg-[var(--surface-raised)] p-3">
                <span className="text-micro font-extrabold tracking-widest text-[var(--text-secondary)] uppercase">
                  Fatturato concordato
                </span>
                <span className="num text-body font-extrabold">{euro(fatturatoStimato)}</span>
              </div>

              {passoCoppe >= 0 ? (
                <Button onClick={() => vai(passoCoppe)}>Passa alle coppe</Button>
              ) : passoMister >= 0 ? (
                <Button onClick={() => vai(passoMister)}>Passa alla panchina</Button>
              ) : (
                <Button onClick={chiudi}>Chiudi l'accordo</Button>
              )}
            </>
          )}

          {/* ⚠️ **Le coppe, allo stesso tavolo.** Il presidente dichiara il minimo anche qui:
              è ciò che le trasforma da dichiarazione d'intenti a pezzo dell'accordo. */}
          {passo === passoCoppe && (
            <>
              <p className="text-label leading-relaxed text-[var(--text-secondary)]">
                Anche in coppa il consiglio si aspetta qualcosa. Puntare più in alto porta mezzi e
                fiducia; puntare più in basso non è gratis.
              </p>

              {meeting.cups.map((coppa) => (
                <div key={coppa.key} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy size={15} className="shrink-0 text-[var(--accent)]" />
                    <span className="text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                      {coppa.competition}
                    </span>
                  </div>
                  <p className="text-label leading-relaxed italic text-[var(--text-secondary)]">
                    «{coppa.speech}»
                  </p>
                  <ul className="flex flex-col gap-2">
                    {coppa.options.map((o) => {
                      const attiva = coppe[coppa.key] === o.label;
                      const sopra = o.roundsFromWin < coppa.minimum.roundsFromWin;
                      const sotto = o.roundsFromWin > coppa.minimum.roundsFromWin;
                      const colore = sopra ? "#3ddc6b" : sotto ? "#ff8a3d" : "var(--brand)";
                      return (
                        <li key={o.label}>
                          <button
                            type="button"
                            onClick={() => setCoppe((c) => ({ ...c, [coppa.key]: o.label }))}
                            className="flex min-h-tap w-full items-center justify-between gap-3 rounded-card border p-3 text-left transition-transform active:scale-98"
                            style={{
                              borderColor: attiva ? colore : "var(--surface-border)",
                              backgroundColor: attiva ? `${colore}14` : "var(--surface-raised)",
                            }}
                          >
                            <span className="text-body font-extrabold">{o.label}</span>
                            <span className="text-label font-bold" style={{ color: colore }}>
                              {sopra ? "più di quanto chiedano" : sotto ? "sotto la richiesta" : "come chiedono"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              {passoMister >= 0 ? (
                <Button onClick={() => vai(passoMister)}>Passa alla panchina</Button>
              ) : (
                <Button onClick={chiudi}>Chiudi l'accordo</Button>
              )}
            </>
          )}

          {passo === passoMister && meeting.coachIssue && (
            <>
              <p className="rounded-card bg-[var(--surface-raised)] p-3 text-label leading-relaxed">
                «{meeting.coachIssue.reason}{" "}
                {meeting.coachIssue.severity === "ultimatum"
                  ? `L'anno scorso hai difeso ${meeting.coachIssue.coachName} e ti abbiamo dato retta. Adesso basta: o cambia lui, o cambiamo noi.`
                  : `Per noi ${meeting.coachIssue.coachName} ha finito il suo ciclo. Decidi tu, ma sappi come la pensiamo.»`}
              </p>

              <button
                type="button"
                onClick={() => setCoach("esonera")}
                className="flex w-full items-start gap-3 rounded-card border p-3 text-left transition-transform active:scale-98"
                style={{
                  borderColor: coach === "esonera" ? "var(--brand)" : "var(--surface-border)",
                  backgroundColor: coach === "esonera" ? "var(--brand)" : "var(--surface-raised)",
                  color: coach === "esonera" ? "var(--brand-contrast)" : undefined,
                }}
              >
                <UserMinus size={16} className="mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-body font-extrabold">
                    Esonera {meeting.coachIssue.coachName}
                  </span>
                  <span className="block text-label leading-snug opacity-80">
                    La dirigenza torna dalla tua parte. Dovrai scegliere subito un sostituto e
                    pagarne l'ingaggio — e il modulo cambierà con lui.
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCoach("difendi")}
                className="flex w-full items-start gap-3 rounded-card border p-3 text-left transition-transform active:scale-98"
                style={{
                  borderColor: coach === "difendi" ? "#ffc107" : "var(--surface-border)",
                  backgroundColor: coach === "difendi" ? "#ffc10718" : "var(--surface-raised)",
                }}
              >
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#ffc107]" />
                <span className="min-w-0">
                  <span className="block text-body font-extrabold">Difendilo davanti al presidente</span>
                  <span className="block text-label leading-snug text-[var(--text-secondary)]">
                    Lui non lo dimenticherà: la sintonia sale. Il presidente nemmeno: la fiducia in
                    te scende {meeting.coachIssue.severity === "ultimatum" ? "del doppio" : "parecchio"}.
                  </span>
                </span>
              </button>

              {meeting.coachIssue.severity === "ultimatum" && (
                <p className="flex items-start gap-2 rounded-control bg-[#ff4d4d]/15 px-3 py-2 text-label font-bold text-[#ff4d4d]">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  Difenderlo un'altra volta può costarti l'incarico: la carriera finirebbe qui.
                </p>
              )}

              {/* Il primario non descrive mai il problema (§8.2): o è abilitato, o dice l'azione
                  che lo sblocca. Qui la scelta è a portata di dito sopra, quindi basta guidarla. */}
              <Button
                disabled={!coach}
                onClick={() =>
                  coach &&
                  onAgree({ objectiveLabel: scelta, extraSteps: extra, cupChoices: coppe, coachChoice: coach })
                }
              >
                {coach ? "Chiudi il colloquio" : "Scegli cosa fare della panchina"}
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
