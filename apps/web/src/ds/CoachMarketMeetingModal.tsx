import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Crown,
  HeartHandshake,
  ShieldAlert,
  Sparkles,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { getFormation, type Coach, type CoachPromise, type RosterEntry, type SessionDeal } from "@app/game-engine";
import { ROLE_LABELS, type Role } from "@app/shared-types";
import { NationFlag } from "../classic/NationFlag";
import { Pitch, PitchDot } from "../classic/Pitch";
import { getSlotPosition } from "../classic/pitchLayouts";
import { euro } from "./format";

interface CoachMarketMeetingModalProps {
  coach?: Coach;
  promises: CoachPromise[];
  sessionDeals: SessionDeal[];
  roster: RosterEntry[];
  players: Record<string, { name: string; role: Role; secondaryRoles?: Role[]; nation?: string }>;
  oldHarmony: number;
  newHarmony: number;
  coachResigned: boolean;
  summaryMessage: string;
  /** Chi acconsente sostituisce l'entry per quel ruolo: il primo scelto perde lo status. */
  onSetGuaranteedStarter?: (role: Role, playerId: string, slotId?: string) => void;
  /** Una casella (slot o ruolo) → al più un titolare garantito. */
  guaranteedStarters?: Record<string, string>;
  onClose: () => void;
}

export function CoachMarketMeetingModal({
  coach,
  promises,
  sessionDeals,
  roster,
  players,
  oldHarmony,
  newHarmony,
  coachResigned,
  summaryMessage,
  onSetGuaranteedStarter,
  guaranteedStarters = {},
  onClose,
}: CoachMarketMeetingModalProps) {
  const inboundDeals = sessionDeals.filter((d) => d.kind === "acquisto");
  const outboundDeals = sessionDeals.filter((d) => d.kind === "cessione" || d.kind === "prestito");

  const totalSpent = inboundDeals.reduce((sum, d) => sum + d.amount, 0);
  const totalEarned = outboundDeals.reduce((sum, d) => sum + d.amount, 0);
  const netSpend = totalSpent - totalEarned;

  const fulfilledCount = promises.filter((p) => p.fulfilled).length;
  const totalPromises = promises.length;

  const harmonyDelta = newHarmony - oldHarmony;

  /**
   * **Prima la casella, poi il nome.**
   *
   * Il selettore era un menu piatto su tutta la rosa senza filtro: si poteva "chiedere
   * titolarità" per un portiere in un ruolo d'attacco. Le caselle vengono dal modulo del
   * mister — la stessa fonte di `coachRequests.ts` — così l'elenco giocatori si restringe a
   * chi sa davvero coprire quel ruolo (principale o secondario).
   */
  const formation = useMemo(() => (coach ? getFormation(coach.formationId) : undefined), [coach]);
  const ruoliModulo = useMemo(
    () => (formation ? [...new Set(formation.slots.map((s) => s.role))] : []),
    [formation],
  );
  const [selectedRole, setSelectedRole] = useState<Role | "">(ruoliModulo[0] ?? "");
  const [selectedSlotId, setSelectedSlotId] = useState<string>(formation?.slots[0]?.id ?? "");

  const idoneiPerRuolo = useMemo(
    () =>
      roster.filter((r) => {
        const p = players[r.playerId];
        if (!p || !selectedRole) return false;
        return p.role === selectedRole || (p.secondaryRoles ?? []).includes(selectedRole);
      }),
    [roster, players, selectedRole],
  );

  const acquistoIdoneo = inboundDeals.find((d) => idoneiPerRuolo.some((r) => r.playerId === d.playerId));
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    acquistoIdoneo?.playerId ?? idoneiPerRuolo[0]?.playerId ?? "",
  );
  const [dsDemandResponse, setDsDemandResponse] = useState<string | null>(null);
  const [demandSuccess, setDemandSuccess] = useState<boolean | null>(null);

  // Citazione procedurale del mister per il meeting
  const coachQuote = coachResigned
    ? `Il mio tempo a ${coach?.name ?? "questo club"} finisce qui, Direttore. Avevamo stretto un patto chiaro sul mercato e le mie richieste sono state disattese. Rassegno le mie dimissioni irrevocabili.`
    : fulfilledCount === totalPromises
      ? `Direttore, sono estremamente soddisfatto del vostro operato in questa sessione di mercato! Avete mantenuto ogni singola promessa. La squadra ha la struttura ideale per fare bene sul campo.`
      : fulfilledCount > 0
        ? `Abbiamo fatto qualche buon passo sul mercato, Direttore, ma non tutte le mie indicazioni sono state seguite. Servirà massimo impegno da parte di tutti per colmare le lacune.`
        : `Sono molto preoccupato per il prosieguo della stagione. Il mercato si è chiuso senza che la società abbia risposto alle mie esigenze minime. Il clima in spogliatoio ne risentirà.`;

  const handleDsDemand = () => {
    if (!selectedPlayerId || coachResigned) return;
    const playerObj = players[selectedPlayerId];
    const rosterEntry = roster.find((r) => r.playerId === selectedPlayerId);
    if (!rosterEntry) return;

    /**
     * **Rifiuto realistico: relativo al titolare vero di quella casella, non una soglia
     * assoluta.** Un mister non si fa scavalcare nelle scelte se il nominato non regge il
     * paragone con la migliore alternativa per lo stesso ruolo, a meno di fedeltà molto alta o
     * di un giovane di prospettiva (se il mister sa lavorare coi giovani) — soglie più strette
     * di prima: la richiesta era "quasi sempre accolta", segno che il margine era troppo largo.
     *
     * **Sostituire un pupillo è un caso a parte.** Se per quel ruolo c'è già un titolare
     * garantito diverso dal nominato, non è "chiedere una titolarità": è chiedere al mister di
     * dare meno spazio a chi si è già impegnato a schierare fisso. Qui la sola sintonia media
     * non basta — serve un vantaggio di Overall netto, altrimenti il mister protegge il suo
     * pupillo anche a costo di una frizione con la società.
     */
    const alternative = idoneiPerRuolo.filter((r) => r.playerId !== selectedPlayerId);
    const migliorAlternativa =
      alternative.length > 0 ? Math.max(...alternative.map((r) => r.overall)) : rosterEntry.overall;
    const scarto = migliorAlternativa - rosterEntry.overall;
    const prospettoDiFuturo =
      (coach?.development ?? 1) >= 1.3 && rosterEntry.potential - migliorAlternativa >= 4;

    // Chi è già garantito per QUESTA casella: la chiave dello slotId (o del ruolo) dà direttamente l'eventuale
    // titolare protetto.
    const pupilloId =
      selectedSlotId && guaranteedStarters[selectedSlotId] && guaranteedStarters[selectedSlotId] !== selectedPlayerId
        ? guaranteedStarters[selectedSlotId]
        : selectedRole && guaranteedStarters[selectedRole] !== selectedPlayerId
          ? guaranteedStarters[selectedRole]
          : undefined;
    const pupillo = pupilloId ? roster.find((r) => r.playerId === pupilloId) : undefined;
    const pupilloObj = pupillo ? players[pupillo.playerId] : undefined;

    let accepts: boolean;
    if (pupillo) {
      const vantaggioNetto = rosterEntry.overall - pupillo.overall;
      accepts = vantaggioNetto >= 5 || (vantaggioNetto >= 2 && newHarmony >= 88);
    } else {
      accepts = scarto <= 3 || newHarmony >= 85 || prospettoDiFuturo;
    }

    if (accepts) {
      setDemandSuccess(true);
      setDsDemandResponse(
        pupillo
          ? `«Va bene, Direttore, avete ragione voi: ${playerObj?.name ?? "il giocatore"} si merita la maglia da titolare più di ${pupilloObj?.name ?? "chi gioca ora"}. Glielo dico io stesso.»`
          : `«Accetto la vostra direttiva, Direttore! ${playerObj?.name ?? "Il giocatore"} ha le qualità giuste e sarà il titolare fisso nel mio modulo.»`,
      );
      if (onSetGuaranteedStarter && selectedRole) {
        onSetGuaranteedStarter(selectedRole, selectedPlayerId, selectedSlotId);
      }
    } else {
      setDemandSuccess(false);
      setDsDemandResponse(
        pupillo
          ? `«Con tutto il rispetto, Direttore, ma ${pupilloObj?.name ?? "chi gioca ora"} se lo è guadagnato sul campo e non gli tolgo spazio per un nome sulla carta. Se volete convincermi, portatemi un vantaggio vero, non una sfumatura.»`
          : `«Con tutto il rispetto Direttore, ma non mi faccio scavalcare nelle scelte: per quella casella ho gente più pronta di ${playerObj?.name ?? "questo giocatore"} in rosa. La formazione la decido io in base al campo.»`,
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-2xl my-auto"
      >
        {/* Header Meeting col Mister */}
        <div
          className={`flex items-center justify-between border-b px-6 py-4 ${
            coachResigned
              ? "border-rose-500/40 bg-rose-500/10"
              : fulfilledCount === totalPromises
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-[var(--brand)]/40 bg-[var(--brand)]/10"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-extrabold shadow-sm ${
                coachResigned
                  ? "bg-rose-500 text-white"
                  : fulfilledCount === totalPromises
                    ? "bg-emerald-500 text-black"
                    : "bg-[var(--brand)] text-[var(--brand-contrast)]"
              }`}
            >
              {coachResigned ? <UserX size={24} /> : coach?.name[0] ?? "M"}
            </span>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-secondary)]">
                Vertice di Chiusura Mercato
              </p>
              <h2 className="text-lg font-extrabold leading-tight">
                Meeting con {coach?.name ?? "l'Allenatore"}
              </h2>
            </div>
          </div>

          <div className="text-right">
            <span className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Esito Promesse
            </span>
            <span
              className={`text-sm font-extrabold ${
                coachResigned
                  ? "text-rose-400"
                  : fulfilledCount === totalPromises
                    ? "text-emerald-400"
                    : "text-amber-400"
              }`}
            >
              {fulfilledCount}/{totalPromises} Mantenute
            </span>
          </div>
        </div>

        {/* Corpo del Meeting */}
        <div className="flex flex-col gap-6 p-6 overflow-y-auto max-h-[75vh]">
          {/* Sezione 1: Dialogo e Morale Mister */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {coach?.nation && <NationFlag nation={coach.nation} />}
                <span className="text-xs font-extrabold text-[var(--brand)] uppercase tracking-wider">
                  Dichiarazione dell'Allenatore
                </span>
              </div>

              {/* Indicatore Sintonia */}
              <div className="flex items-center gap-2 text-xs font-extrabold">
                <HeartHandshake size={16} className="text-[var(--brand)]" />
                <span>Sintonia:</span>
                <span className="tabular-nums">{newHarmony}/100</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                    harmonyDelta >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                  }`}
                >
                  {harmonyDelta >= 0 ? `+${harmonyDelta}` : harmonyDelta}
                </span>
              </div>
            </div>

            <p className="text-sm leading-relaxed italic text-[var(--text-primary)]">
              «{coachQuote}»
            </p>

            {coachResigned && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-400 font-bold">
                <ShieldAlert size={18} className="shrink-0" />
                <span>{summaryMessage}</span>
              </div>
            )}
          </div>

          {/* Sezione 2: Richiesta Bilaterale del DS al Mister */}
          {!coachResigned && (
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--brand)]/40 bg-[var(--brand)]/5 p-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[var(--brand)]">
                  <Crown size={15} />
                  Richiesta Bilaterale del DS: Titolarità Garantita
                </h3>
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                  Direttiva Societaria
                </span>
              </div>

              <p className="text-xs text-[var(--text-secondary)]">
                Tocca una casella del modulo, poi il nome in rosa: se il mister acconsente, sarà
                lui il titolare fisso lì. Un giocatore può essere garantito in un solo ruolo alla
                volta — sceglierne un altro sposta la garanzia, non la aggiunge.
              </p>

              {formation && (
                <div className="mx-auto w-full max-w-[280px]">
                  <Pitch>
                    {formation.slots.map((slot) => {
                      const { x, y } = getSlotPosition(formation, slot);
                      const garantitoId = guaranteedStarters[slot.id] ?? guaranteedStarters[slot.role];
                      const garantito = garantitoId ? players[garantitoId] : undefined;
                      const garantitoEntry = garantitoId ? roster.find((r) => r.playerId === garantitoId) : undefined;
                      return (
                        <PitchDot
                          key={slot.id}
                          x={x}
                          y={y}
                          label={ROLE_LABELS[slot.role]}
                          shortLabel={slot.role}
                          playerName={garantito?.name}
                          overall={garantitoEntry?.overall}
                          nation={garantito?.nation}
                          state={selectedSlotId === slot.id ? "lit" : garantitoId ? "filled" : "empty"}
                          guaranteed={!!garantitoId}
                          onClick={() => {
                            setSelectedRole(slot.role);
                            setSelectedSlotId(slot.id);
                            const primoIdoneo = roster.find((r) => {
                              const p = players[r.playerId];
                              return p && (p.role === slot.role || (p.secondaryRoles ?? []).includes(slot.role));
                            });
                            setSelectedPlayerId(primoIdoneo?.playerId ?? "");
                            setDsDemandResponse(null);
                          }}
                        />
                      );
                    })}
                  </Pitch>
                </div>
              )}

              {selectedRole && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                    Chi schierare come {ROLE_LABELS[selectedRole]}:
                  </p>
                  {idoneiPerRuolo.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--surface-border)] p-3 text-center text-xs text-[var(--text-secondary)]">
                      Nessuno idoneo in rosa per questo ruolo.
                    </p>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {idoneiPerRuolo.map((r) => {
                        const pl = players[r.playerId];
                        const isGuaranteed =
                          (selectedSlotId && guaranteedStarters[selectedSlotId] === r.playerId) ||
                          (selectedRole && guaranteedStarters[selectedRole] === r.playerId);
                        const isSelected = selectedPlayerId === r.playerId;
                        return (
                          <button
                            key={r.playerId}
                            type="button"
                            onClick={() => {
                              setSelectedPlayerId(r.playerId);
                              setDsDemandResponse(null);
                            }}
                            className={`flex shrink-0 flex-col items-center gap-1 rounded-xl border px-3 py-2 text-center transition-colors ${
                              isSelected
                                ? "border-[var(--brand)] bg-[var(--brand)]/10"
                                : "border-[var(--surface-border)] bg-[var(--surface-raised)]"
                            }`}
                          >
                            <span className="flex items-center gap-1 text-xs font-extrabold">
                              {pl?.nation && <NationFlag nation={pl.nation} />}
                              {pl?.name ?? r.playerId}
                              {isGuaranteed && <span className="text-[#f5c518]">★</span>}
                            </span>
                            <span className="text-[10px] font-semibold text-[var(--text-secondary)] tabular-nums">
                              Overall {r.overall}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleDsDemand}
                disabled={!selectedRole || idoneiPerRuolo.length === 0 || !selectedPlayerId}
                className="w-full rounded-xl bg-[var(--brand)] px-4 py-2.5 text-xs font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-95 disabled:opacity-50"
              >
                Chiedi Titolarità Garantita
              </button>

              {dsDemandResponse && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-2 flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                    demandSuccess
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-semibold"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-300 font-semibold"
                  }`}
                >
                  {demandSuccess ? (
                    <UserCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                  ) : (
                    <UserX size={16} className="mt-0.5 shrink-0 text-rose-400" />
                  )}
                  <span>{dsDemandResponse}</span>
                </motion.div>
              )}
            </div>
          )}

          {/* Sezione 3: Stato delle Promesse Concordate */}
          {promises.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                <Sparkles size={14} className="text-[var(--brand)]" />
                Verifica Promesse Contrattuali Concordate
              </h3>

              <div className="flex flex-col gap-2">
                {promises.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
                      p.fulfilled
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-rose-500/30 bg-rose-500/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {p.fulfilled ? (
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                      ) : (
                        <XCircle size={16} className="shrink-0 text-rose-400" />
                      )}
                      <span className="font-bold">{p.description}</span>
                    </div>

                    <span
                      className={`text-[11px] font-extrabold ${
                        p.fulfilled ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {p.fulfilled ? "MANTENUTA" : "INFRANTA"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sezione 4: Riassunto Mercato (In Entrata ed In Uscita) */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
              Riassunto Operazioni di Mercato
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Acquisti in Entrata */}
              <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                  <span className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                    <ArrowDownLeft size={16} /> Entrate ({inboundDeals.length})
                  </span>
                  <span className="text-xs font-extrabold text-emerald-400">{euro(totalSpent)}</span>
                </div>

                {inboundDeals.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[var(--text-secondary)]">
                    Nessun acquisto concluso in questa sessione.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {inboundDeals.map((d, i) => (
                      <li key={i} className="flex items-center justify-between text-xs font-medium">
                        <span className="truncate font-bold">{d.playerName}</span>
                        <span className="shrink-0 font-extrabold text-emerald-400">{euro(d.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Cessioni ed Uscite */}
              <div className="flex flex-col gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3.5">
                <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                  <span className="flex items-center gap-1.5 text-xs font-extrabold text-blue-400 uppercase tracking-wider">
                    <ArrowUpRight size={16} /> Uscite ({outboundDeals.length})
                  </span>
                  <span className="text-xs font-extrabold text-blue-400">{euro(totalEarned)}</span>
                </div>

                {outboundDeals.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[var(--text-secondary)]">
                    Nessuna cessione effettuata in questa sessione.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {outboundDeals.map((d, i) => (
                      <li key={i} className="flex items-center justify-between text-xs font-medium">
                        <span className="truncate font-bold">{d.playerName}</span>
                        <span className="shrink-0 font-extrabold text-blue-400">{euro(d.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Saldo Netto */}
            <div className="flex items-center justify-between rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-2.5 text-xs font-bold">
              <span>Saldo Netto Mercato:</span>
              <span
                className={`text-sm font-extrabold ${
                  netSpend > 0 ? "text-rose-400" : netSpend < 0 ? "text-emerald-400" : "text-[var(--text-primary)]"
                }`}
              >
                {netSpend > 0 ? `-${euro(netSpend)}` : netSpend < 0 ? `+${euro(-netSpend)}` : "€0"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Conclusione Meeting */}
        <div className="border-t border-[var(--surface-border)] bg-[var(--surface-raised)] p-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full px-6 py-3 text-sm font-extrabold transition-transform active:scale-95 ${
              coachResigned
                ? "bg-rose-500 text-white hover:bg-rose-600"
                : "bg-[var(--brand)] text-[var(--brand-contrast)] hover:opacity-90"
            }`}
          >
            {coachResigned ? "Accetta Dimissioni & Prosegui" : "Concludi Meeting & Inizia la Stagione"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
