import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Cloud,
  CloudOff,
  Crown,
  FastForward,
  History,
  ListOrdered,
  Play,
  Users,
  Wallet,
} from "lucide-react";
import {
  CAREER_SEASONS,
  advanceToNextStop,
  advanceWeek,
  applyMarket,
  applyPlayerDialogue,
  proposeCaptain,
  renewContract,
  signCoachContract,
  buildStandings,
  openPlayerDialogue,
  setWageShare,
  signFreeAgent,
  type Dialogue,
  type DialogueMove,
  closeNegotiation,
  confirmCoachSeasonPromises,
  declineCoachSeasonMeeting,
  negotiateLoanOffer,
  negotiateOffer,
  negotiatePurchase,
  openForcedStandoff,
  playNegotiation,
  proposePromiseAlternative,
  setGuaranteedStarter,
  resolveForcedStandoff,
  seasonObjectiveChoices,
  setSeasonObjective,
  coachChoices,
  currentLineup,
  findCoach,
  hireCoach,
  isKeyMatch,
  keyMatchReason,
  rebuildLeagueState,
  resolveIncidentDecision,
  searchMarket,
  seasonCalendar,
  type CareerState,
  type CareerWorld,
  type Coach,
  type CoachPromise,
  type Incident,
  type MarketAction,
  type MatchResult,
  type NegotiationMove,
  type MatchTheatreContext,
  type PlayerStandoff,
  type RoleCandidate,
  type SearchResult,
  type SearchCriteria,
  type SessionDeal,
  type SeasonSummary,
  type StandingRow,
  type StandoffMove,
  type WeekReport,
} from "@app/game-engine";
import type { Department } from "@app/shared-types";
import { ClubViewerModal } from "./ClubViewerModal";
import { CoachDepartureDialog } from "./CoachDepartureDialog";
import { CoachMarketMeetingModal } from "./CoachMarketMeetingModal";
import { CoachNegotiationChat } from "./CoachNegotiationChat";
import { PlayerStandoffChat } from "./PlayerStandoffChat";
import { PlayerDialogueChat } from "./PlayerDialogueChat";
import { RenewalModal } from "./RenewalModal";
import { SeasonObjectiveScreen } from "./SeasonObjectiveScreen";
import { StandingsTable } from "../classic/StandingsTable";
import { CupPanel } from "./CupPanel";
import { CupProgress } from "./CupProgress";
import { IncidentDialog } from "./IncidentDialog";
import { KeyMatchPrompt } from "./KeyMatchPrompt";
import { MatchTheatre } from "./MatchTheatre";
import { DealToast, dealKindOf, type Deal } from "./DealToast";
import { MarketPanel } from "./MarketPanel";
import { NegotiationChat } from "./NegotiationChat";
import type { DsWorldData } from "./useDsWorld";
import { MiniStandings } from "./MiniStandings";
import { SeasonEndOverlay } from "./SeasonEndOverlay";
import { SeasonSquadReportModal } from "./SeasonSquadReportModal";
import { TriumphScreen } from "./TriumphScreen";
import { SquadPanel } from "./SquadPanel";
import { WeekReportCard } from "./WeekReportCard";
import { OUTCOME_COLOR, euro, ordinale, outcomeOf } from "./format";

/**
 * La schermata di carriera.
 *
 * Il ritmo è cambiato rispetto alla prima versione, e la ragione è la natura della modalità:
 * il momento che conta è il **mercato**, non la singola giornata. Quindi il pulsante grande
 * non avanza di una settimana ma **corre fino alla prossima decisione**, facendo scorrere i
 * risultati; e la classifica resta **sempre a vista**, così l'andamento si legge senza cambiare
 * scheda mentre le giornate passano.
 *
 * Il motore è l'unica fonte di verità: qui non si calcola nulla (CLAUDE.md sez. 9).
 */

type Tab = "stagione" | "rosa" | "classifica" | "corona" | "storico";

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "stagione", label: "Stagione", icon: Play },
  { key: "rosa", label: "Rosa", icon: Users },
  { key: "classifica", label: "Classifica", icon: ListOrdered },
  { key: "corona", label: "Corona", icon: Crown },
  { key: "storico", label: "Storico", icon: History },
];

/** Quanto resta a schermo ogni risultato mentre la corsa scorre. */
const RITMO_MS = 260;

interface RisultatoScorso {
  key: string;
  opponent: string;
  gf: number;
  ga: number;
  coppa?: boolean;
}

interface CareerScreenProps {
  state: CareerState;
  world: CareerWorld;
  /** Catalogo di club e campionati: serve a dare un nome ai club nel mercato del mondo. */
  dsWorld: DsWorldData;
  onChange: (state: CareerState, immediate?: boolean) => void;
  onExit: () => void;
  saving: boolean;
  saveEnabled: boolean;
}

export function CareerScreen({
  state,
  world,
  dsWorld,
  onChange,
  onExit,
  saving,
  saveEnabled,
}: CareerScreenProps) {
  const [tab, setTab] = useState<Tab>("stagione");
  const [report, setReport] = useState<WeekReport | null>(null);
  const [results, setResults] = useState<RisultatoScorso[]>([]);
  const [deal, setDeal] = useState<Deal | null>(null);
  /** L'imprevisto da mostrare: arriva nel referto e si chiude a mano. */
  const [incident, setIncident] = useState<Incident | null>(null);
  /** Il club che si sta ispezionando (`ClubViewerModal`), aperto dalla classifica. */
  const [clubVisto, setClubVisto] = useState<{ id: string; name: string } | null>(null);
  /** La notizia di questa giornata (pressione sull'obiettivo, esonero IA...): passa da sola. */
  const [notizia, setNotizia] = useState<string | null>(null);
  useEffect(() => {
    if (!notizia) return;
    const timer = setTimeout(() => setNotizia(null), 4200);
    return () => clearTimeout(timer);
  }, [notizia]);
  /** Chiuso un imprevisto, la corsa riprende da sola alla prossima resa del componente. */
  const [ripartire, setRipartire] = useState(false);
  /** La partita decisiva su cui si è fermata la corsa, in attesa della risposta dell'utente. */
  const [keyMatch, setKeyMatch] = useState<PartitaChiave | null>(null);
  /** La partita che si sta guardando in 2D. */
  const [teatro, setTeatro] = useState<PartitaChiave | null>(null);
  const [seasonEnd, setSeasonEnd] = useState<number | null>(null);
  const [squadReportSummary, setSquadReportSummary] = useState<SeasonSummary | null>(null);
  /** L'ultima stagione per cui la schermata di trionfo è già stata mostrata e chiusa. */
  const [trionfoVisto, setTrionfoVisto] = useState<number | null>(null);
  const [correndo, setCorrendo] = useState(false);
  /** I referti ancora da mostrare della corsa in atto. */
  const coda = useRef<WeekReport[]>([]);

  const calendar = useMemo(() => seasonCalendar(state, world), [state, world]);
  const lineup = useMemo(() => currentLineup(state, world), [state, world]);
  const coach = state.coachId ? findCoach(state.coachId) : undefined;

  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, player] of Object.entries(world.players)) map[id] = player.name;
    for (const generated of state.generated) map[generated.id] = generated.name;
    return map;
  }, [world.players, state.generated]);

  /** La classifica corrente, ricostruita dai totali salvati: non si conserva, si deriva. */
  const standingsFinali: StandingRow[] = useMemo(
    () => (state.league.tallies.length > 0 ? buildStandings(rebuildLeagueState(state, world), 0) : []),
    [state, world],
  );

  /**
   * Durante la corsa la classifica è quella **della giornata mostrata**, non quella finale.
   *
   * Ogni referto porta con sé la classifica al momento in cui è stato prodotto: usarla è ciò
   * che rende la tabella viva mentre i risultati scorrono. Derivarla dallo stato darebbe invece
   * subito il quadro di fine corsa, togliendo senso a tutte le giornate mostrate dopo.
   */
  const [standingsLive, setStandingsLive] = useState<StandingRow[] | null>(null);
  const standings = standingsLive ?? standingsFinali;
  const nostraRiga = standings.find((r) => r.isUser);

  /**
   * Scorre la coda dei referti a ritmo costante.
   *
   * I risultati sono già tutti calcolati (il motore li ha restituiti insieme): qui si decide
   * solo *quando* mostrarli. Tenere separate le due cose significa che saltare l'animazione non
   * cambia una virgola di ciò che è successo.
   */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!correndo) return;
    const timer = setTimeout(() => {
      const prossimo = coda.current.shift();
      if (!prossimo) {
        setCorrendo(false);
        return;
      }
      setReport(prossimo);
      setResults((prev) => aggiungiRisultati(prev, prossimo));
      if (prossimo.standings) setStandingsLive(prossimo.standings);
      if (prossimo.incident) setIncident(prossimo.incident);
      // Notizie di giornata (pressione/entusiasmo sull'obiettivo, esoneri IA...): un fondo di
      // testo che passa mentre i risultati scorrono, non un'altra cosa da chiudere a mano.
      if (prossimo.messages.length > 0) setNotizia(prossimo.messages.join(" "));

      /**
       * Una partita che decide qualcosa merita la domanda: la si vuole vedere?
       *
       * Si valuta **mentre** i risultati scorrono, non dopo, perché l'invito ha senso solo
       * accanto alla partita a cui si riferisce.
       */
      const chiave = partitaChiave(prossimo, world.leagueRounds);
      if (chiave) setKeyMatch(chiave);
      if (coda.current.length === 0) {
        setCorrendo(false);
        // Finita la corsa si torna alla classifica derivata dallo stato: da lì in poi è quella
        // che deve restare aggiornata, anche dopo un'operazione di mercato.
        setStandingsLive(null);
      } else setTick((t) => t + 1);
    }, RITMO_MS);
    return () => clearTimeout(timer);
  }, [correndo, tick]);

  const corri = useCallback(() => {
    const { state: next, reports, reason } = advanceToNextStop(state, world);
    const fine = reason === "fine_stagione" || reason === "fine_carriera";
    coda.current = [...reports];
    setCorrendo(reports.length > 0);
    setTick((t) => t + 1);
    if (fine) {
      // Il verdetto di fine stagione si annuncia **dopo** che i risultati hanno finito di
      // scorrere: mostrarlo subito toglierebbe il senso all'ultima giornata.
      setSeasonEnd(state.season);
    }
    // Fine stagione e fine carriera si salvano **subito**: sono i momenti che nessuno vuole
    // rigiocare per aver chiuso la scheda un attimo prima dell'autosave.
    onChange(next, fine);
  }, [state, world, onChange]);

  /**
   * Chiuso il popup, la stagione **riparte da sola**.
   *
   * La notizia va letta prima di giocare le giornate successive — per questo il motore ferma
   * la corsa — ma una volta letta non ha senso chiedere all'utente di premere di nuovo
   * "avanza": non è una decisione, è un riscontro. Ripartire da soli è ciò che rende la pausa
   * un momento di attenzione invece di un intoppo.
   */
  const chiudiImprevisto = useCallback(() => {
    setIncident(null);
    setRipartire(true);
  }, []);

  /**
   * Il verdetto dei due imprevisti "con decisione" (`incident.requiresDecision`): a differenza
   * di tutti gli altri, l'effetto non era già scritto nell'oggetto — arriva solo qui, quando il
   * DS ha scelto se ignorare o punire. `IncidentDialog` chiama anche `chiudiImprevisto` subito
   * dopo, quindi la corsa riparte da sola come per ogni altro imprevisto.
   */
  const decidiImprevisto = useCallback(
    (scelta: "ignora" | "punizione", giorni?: number) => {
      if (!incident) return;
      onChange(resolveIncidentDecision(state, world, incident, scelta, giorni));
    },
    [incident, state, world, onChange],
  );

  const salta = useCallback(() => {
    const rimanenti = coda.current;
    coda.current = [];
    setCorrendo(false);
    setStandingsLive(null);
    if (rimanenti.length > 0) {
      setReport(rimanenti[rimanenti.length - 1]!);
      setResults((prev) => rimanenti.reduce(aggiungiRisultati, prev));
    }
  }, []);


  const [meetingData, setMeetingData] = useState<{
    coach?: Coach;
    promises: CoachPromise[];
    sessionDeals: SessionDeal[];
    oldHarmony: number;
    newHarmony: number;
    coachResigned: boolean;
    summaryMessage: string;
    nextState: CareerState;
  } | null>(null);

  const chiudiMercato = useCallback(() => {
    const coachBefore = state.coachId ? findCoach(state.coachId) : undefined;
    const oldHarmony = state.coachHarmony ?? 75;
    const { state: next, report } = advanceWeek(state, world, { closeMarket: true });

    const promises = next.coachPromises ?? state.coachPromises ?? [];
    const sessionDeals = state.sessionDeals ?? [];
    const coachResigned = !next.coachId && !!state.coachId;
    const newHarmony = next.coachHarmony ?? 75;
    const summaryMsg = report.messages.join(" ");

    setMeetingData({
      coach: coachBefore,
      promises,
      sessionDeals,
      oldHarmony,
      newHarmony,
      coachResigned,
      summaryMessage: summaryMsg,
      nextState: next,
    });
    // Nuova finestra, nuova occasione di parlargli: chi aveva già chiuso la sua chat torna
    // disponibile invece di restare "già sentito" per sempre.
    setStandoffChiuse(new Set());
  }, [state, world]);

  const eseguiAzione = useCallback(
    (action: MarketAction) => {
      const { state: next, result } = applyMarket(state, world, action);
      if (result.message) {
        setDeal({
          id: Date.now(),
          kind: dealKindOf(action.kind, result.rejected),
          message: result.message,
          delta: next.budget - state.budget,
        });
      }
      onChange(next);
    },
    [state, world, onChange],
  );

  /**
   * **Il faccia a faccia col giocatore**: vive nello stato locale (non in `CareerState`) perché
   * è una conversazione in corso, non un dato di carriera — la barra di pazienza e il log
   * esistono solo mentre la chat è aperta. Ogni mossa applica comunque i suoi effetti veri
   * (morale, liste, promesse, eventuale cessione) tramite `applyPlayerStandoff`.
   */
  /**
   * **Chi ha già chiuso la sua chat in questa finestra non deve restare nel badge.**
   * Il morale di un giocatore appena riappacificato può restare comunque sotto la soglia (una
   * conversazione risolta bene non guarisce tutto in un colpo), quindi senza questo elenco il
   * badge/l'elenco della scheda Chat lo riproponevano subito dopo averlo appena sentito — bug
   * segnalato dall'utente. Si azzera alla chiusura del mercato: la finestra successiva è una
   * nuova occasione di parlargli.
   */
  const [standoffChiuse, setStandoffChiuse] = useState<ReadonlySet<string>>(new Set());

  /**
   * **La conversazione nuova** (`playerDialogue.ts`), che sostituisce lo standoff volontario.
   *
   * Lo standoff vecchio resta in vita solo per la richiesta **forzata**, che ha ancora il suo
   * cancello in `pendingRequest`: le due strade convivono finché anche quella non passerà al
   * nuovo motore.
   */
  const [dialogo, setDialogo] = useState<Dialogue | null>(null);
  const apriStandoff = useCallback(
    (playerId: string) => setDialogo(openPlayerDialogue(state, world, playerId)),
    [state, world],
  );
  const mossaDialogo = useCallback(
    (move: DialogueMove) => {
      if (!dialogo) return;
      const budgetPrima = state.budget;
      const esito = applyPlayerDialogue(state, world, dialogo, move);
      if (esito.state.budget !== budgetPrima) {
        segnalaPremio(budgetPrima, esito.state.budget, dialogo.playerName);
      }
      setDialogo(esito.dialogue);
      onChange(esito.state);
    },
    [dialogo, state, world, onChange],
  );
  const chiudiDialogo = useCallback(() => {
    if (dialogo) setStandoffChiuse((prev) => new Set(prev).add(dialogo.playerId));
    setDialogo(null);
  }, [dialogo]);

  /** Ripartizione delle finanze e firma di uno svincolato: due azioni del pannello mercato. */
  const spostaFinanze = useCallback(
    (share: number) => {
      const esito = setWageShare(state, world, share);
      if (esito.ok) onChange(esito.state);
    },
    [state, world, onChange],
  );
  /** Il tavolo del rinnovo di un giocatore: aperto dalla pastiglia contratto nella Rosa. */
  const [rinnovoPer, setRinnovoPer] = useState<string | null>(null);
  const proponiRinnovo = useCallback(
    (offer: { wage: number; seasons: number; guaranteedStarter?: boolean; captain?: boolean }) => {
      if (!rinnovoPer) return { ok: false, message: "Nessun giocatore selezionato." };
      const esito = renewContract(state, world, rinnovoPer, offer);
      if (esito.ok) onChange(esito.state);
      return { ok: esito.ok, message: esito.message };
    },
    [rinnovoPer, state, world, onChange],
  );

  /** Rinnovo del mister: stessa firma dell'ingaggio, con lo stesso allenatore. */
  const rinnovaMister = useCallback(
    (seasons: number) => {
      if (!state.coachId) return;
      const esito = signCoachContract(state, world, state.coachId, seasons);
      if (esito.ok) onChange(esito.state);
    },
    [state, world, onChange],
  );

  /** La fascia la assegna il mister: qui si propone, e lui risponde. */
  const proponiCapitano = useCallback(
    (playerId: string) => {
      const esito = proposeCaptain(state, world, playerId);
      if (esito.ok) onChange(esito.state);
      else if (esito.state !== state) onChange(esito.state);
      return { ok: esito.ok, message: esito.message };
    },
    [state, world, onChange],
  );

  const firmaSvincolato = useCallback(
    (agentId: string, offer: { wage: number; seasons: number; guaranteedStarter: boolean }) => {
      const esito = signFreeAgent(state, world, agentId, offer);
      if (esito.ok) onChange(esito.state);
    },
    [state, world, onChange],
  );
  /**
   * Il premio in denaro promesso in chat (`premio_denaro`) scala davvero il budget
   * (`applyPlayerStandoff`, career.ts) — qui si dà lo stesso riscontro visivo delle operazioni
   * di mercato, altrimenti l'esborso resterebbe implicito nel solo testo della chat.
   */
  const [standoffDeal, setStandoffDeal] = useState<Deal | null>(null);
  const segnalaPremio = useCallback((budgetPrima: number, budgetDopo: number, playerName: string) => {
    if (budgetDopo >= budgetPrima) return;
    setStandoffDeal({
      id: Date.now(),
      kind: "premio",
      message: `Premio versato a ${playerName}`,
      delta: budgetDopo - budgetPrima,
    });
  }, []);
  useEffect(() => {
    if (!standoffDeal) return;
    const timer = setTimeout(() => setStandoffDeal(null), 2600);
    return () => clearTimeout(timer);
  }, [standoffDeal]);


  /**
   * **Alternativa a una promessa del mister, scelta dal database, a mercato aperto.**
   *
   * Una chiamata sola a `proposePromiseAlternative` (career.ts): il candidato arriva già
   * scelto dall'utente (dalla ricerca del mercato), quindi non serve una trattativa a più
   * turni come per l'ingaggio — il risultato aggiorna `coachPromises` nello stato di carriera
   * esattamente come farebbe la prossima verifica di fine finestra.
   */
  const proponiAlternativaPromessa = useCallback(
    (promise: CoachPromise, candidate: RoleCandidate) => {
      const esito = proposePromiseAlternative(state, promise.id, candidate);
      onChange(esito.state);
      return { accepted: esito.accepted, message: esito.message };
    },
    [state, onChange],
  );

  /**
   * **La richiesta di cessione forzata usa la stessa chat, non più il vecchio popup a 4
   * bottoni.** A differenza dello standoff volontario sopra, questo blocca la settimana
   * (`state.pendingRequest`) finché non si risolve — niente `onClose` libero mentre è aperta.
   * Si apre una sola volta quando la richiesta compare, non ad ogni render: altrimenti ogni
   * mossa (che aggiorna `state`) la ricostruirebbe daccapo, perdendo il log e la pazienza già
   * consumata.
   */
  const [standoffForzato, setStandoffForzato] = useState<PlayerStandoff | null>(null);
  useEffect(() => {
    if (state.pendingRequest && !standoffForzato) {
      setStandoffForzato(openForcedStandoff(state));
    }
    // Si chiude solo per mano dell'utente (`chiudiStandoffForzato`), mai in reazione allo stato:
    // appena la trattativa si risolve `pendingRequest` torna null, ma la chat deve restare
    // visibile finché non si legge l'esito e non si preme "Torna alla rosa".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pendingRequest]);

  const mossaStandoffForzato = useCallback(
    (move: StandoffMove) => {
      if (!standoffForzato) return;
      const { state: next, standoff: dopo } = resolveForcedStandoff(state, world, standoffForzato, move);
      if (move.kind === "premio_denaro") segnalaPremio(state.budget, next.budget, standoffForzato.playerName);
      onChange(next);
      setStandoffForzato(dopo);
    },
    [state, world, standoffForzato, onChange, segnalaPremio],
  );
  // Come per gli imprevisti: la stagione riparte da sola, ma solo quando l'utente ha letto
  // l'esito e chiude la chat — non nell'istante in cui la trattativa si risolve, altrimenti la
  // corsa ripartirebbe sotto un popup ancora aperto.
  const chiudiStandoffForzato = useCallback(() => {
    setStandoffForzato(null);
    setRipartire(true);
  }, []);

  const ingaggia = useCallback(
    (coachId: string, promises?: CoachPromise[], totalCost?: number) => {
      const { state: next, message, rejected } = hireCoach(state, world, coachId, promises, totalCost);
      setDeal({
        id: Date.now(),
        kind: rejected ? "errore" : "acquisto",
        message,
        delta: next.budget - state.budget,
      });
      onChange(next);
    },
    [state, world, onChange],
  );

  // Il riscontro sparisce da solo: è una conferma, non una decisione da chiudere a mano.
  useEffect(() => {
    if (!deal) return;
    const timer = setTimeout(() => setDeal(null), 2600);
    return () => clearTimeout(timer);
  }, [deal]);

  // La ripresa parte qui, non nel gestore del clic: `corri` legge lo stato aggiornato solo al
  // giro dopo, e chiamarla subito rigiocherebbe la stessa settimana. Le guardie servono perché
  // una risposta può aprire il mercato o un'altra richiesta: lì la corsa deve restare ferma.
  useEffect(() => {
    if (!ripartire) return;
    setRipartire(false);
    if (state.phase === "conclusa" || state.market || state.pendingRequest) return;
    corri();
  }, [ripartire, state.phase, state.market, state.pendingRequest, corri]);

  const cerca = useCallback(
    (criteria: SearchCriteria) => searchMarket(state, world, criteria),
    [state, world],
  );

  /* --- Trattative: aprirle, giocarle, chiuderle --- */

  const trattaOfferta = useCallback(
    (playerId: string) => onChange(negotiateOffer(state, playerId)),
    [state, onChange],
  );

  const trattaAcquisto = useCallback(
    (target: SearchResult) => onChange(negotiatePurchase(state, world, target)),
    [state, world, onChange],
  );

  const trattaPrestito = useCallback(
    (playerId: string) => onChange(negotiateLoanOffer(state, playerId)),
    [state, onChange],
  );

  const mossaTrattativa = useCallback(
    (move: NegotiationMove) => {
      const esito = playNegotiation(state, world, move);
      if (esito.message) {
        setDeal({
          id: Date.now(),
          kind: esito.stalled
            ? "errore"
            : state.negotiation?.kind === "cessione"
              ? "cessione"
              : "acquisto",
          message: esito.message,
          delta: esito.state.budget - state.budget,
        });
      }
      onChange(esito.state);
    },
    [state, world, onChange],
  );

  const chiudiTrattativa = useCallback(
    () => onChange(closeNegotiation(state)),
    [state, onChange],
  );

  const scelteMister = useMemo(() => coachChoices(state, world), [state, world]);

  /**
   * **Il mister rinnova il rapporto a ogni stagione, non solo alla prima.**
   *
   * `seasonNegotiationDone` viene azzerato a ogni cambio stagione (`closeSeason`) ma prima non
   * lo leggeva nessuno: dalla seconda stagione in poi non c'era mai un nuovo meeting, e le
   * promesse restavano quelle dell'ingaggio originale. Finché non si è negoziato, il mercato
   * estivo resta bloccato — è la stessa cosa del vecchio ingaggio, solo ripetuta ogni anno.
   */
  const bisognaRinnovare = !!state.coachId && state.seasonNegotiationDone === false;
  const bisognaObiettivo = state.seasonObjectiveSet === false;
  const coachAttuale = state.coachId ? findCoach(state.coachId) : undefined;
  const marketCandidatesRinnovo = useMemo(
    () =>
      (world.market?.transferPool ?? [])
        .map((p) => {
          const info = world.market!.players[p.playerId];
          return info
            ? {
                playerId: p.playerId,
                playerName: world.market!.nameOf(p.playerId),
                overall: p.overall,
                role: info.role,
                secondaryRoles: info.secondaryRoles,
              }
            : null;
        })
        .filter((c): c is NonNullable<typeof c> => c !== null),
    [world],
  );

  const inCorso = state.phase !== "conclusa";
  const settimane = calendar.length;
  const progresso = settimane > 0 ? Math.min(100, (state.week / settimane) * 100) : 0;
  const riepilogo = seasonEnd !== null ? state.history.find((h) => h.season === seasonEnd) : undefined;

  /**
   * La schermata di trionfo si apre **una volta per stagione**, e solo se c'è un trofeo.
   *
   * Il flag tiene la stagione già festeggiata invece di un booleano: un booleano resterebbe
   * acceso e alla stagione dopo il trionfo non si vedrebbe più.
   */
  const trofeiVinti = riepilogo?.trophies
    ? Number(riepilogo.trophies.league) +
      Number(riepilogo.trophies.continental) +
      Number(riepilogo.trophies.national)
    : 0;
  const mostraTrionfo = !!riepilogo && trofeiVinti > 0 && trionfoVisto !== riepilogo.season;
  const bloccato =
    !!state.market || !!state.pendingRequest || bisognaRinnovare || !!state.coachDeparture || bisognaObiettivo;

  const chiudiPartenzaMister = useCallback(() => {
    onChange({ ...state, coachDeparture: null });
    setRipartire(true);
  }, [state, onChange]);

  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onExit}
              aria-label="Torna alla home"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
            >
              <ArrowLeft size={17} />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-base leading-tight font-extrabold">{world.clubName}</p>
              <p className="truncate text-[11px] text-[var(--text-secondary)]">
                Stagione {state.season}/{CAREER_SEASONS}
                {coach ? ` · ${coach.name} (${coach.formationId})` : ""}
                {coach ? ` · Sintonia ${state.coachHarmony ?? 75}%` : ""}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="flex items-center justify-end gap-1 text-sm font-extrabold">
                <Wallet size={14} />
                {euro(state.budget)}
              </p>
              <p className="flex items-center justify-end gap-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                {saveEnabled ? (
                  <>
                    <Cloud size={11} className={saving ? "animate-pulse" : undefined} />
                    {saving ? "salvataggio…" : "salvata"}
                  </>
                ) : (
                  <>
                    <CloudOff size={11} />
                    non salvata
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-2.5">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-raised)]">
              <motion.span
                className="block h-full rounded-full bg-[var(--brand)]"
                animate={{ width: `${progresso}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </span>
            <span className="shrink-0 text-[11px] font-bold tabular-nums">
              {Math.min(state.week, settimane)}/{settimane}
            </span>
            {nostraRiga && (
              <span className="shrink-0 rounded-full bg-[var(--surface-raised)] px-2.5 py-0.5 text-[11px] font-extrabold">
                {ordinale(nostraRiga.position)} · {nostraRiga.points} pt
              </span>
            )}
          </div>
        </div>
      </header>

      <nav className="border-b border-[var(--surface-border)]">
        <div className="mx-auto flex w-full max-w-3xl gap-1 overflow-x-auto px-3 py-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
                tab === key ? "text-[var(--brand-contrast)]" : "text-[var(--text-secondary)]"
              }`}
            >
              {tab === key && (
                <motion.span
                  layoutId="ds-tab"
                  className="absolute inset-0 rounded-full bg-[var(--brand)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <Icon size={13} />
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-32">
        {tab === "stagione" && (
          /* Due colonne su schermo largo: i risultati scorrono a sinistra, la classifica resta
             ferma a destra. Su telefono la classifica sta sopra, compatta, perché è il dato che
             si vuole sotto controllo mentre le giornate passano. */
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="order-2 min-w-0 flex-1 lg:order-1">
              <AnimatePresence>
                {notizia && (
                  <motion.p
                    key={notizia}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-3 rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand)]/8 px-3.5 py-2.5 text-xs leading-relaxed text-[var(--text-primary)]"
                  >
                    {notizia}
                  </motion.p>
                )}
              </AnimatePresence>
              <WeekReportCard
                report={report}
                clubName={world.clubName}
                nameById={nameById}
                ultimatum={state.pendingUltimatum}
              />

              {results.length > 0 && (
                <section className="mt-4">
                  <h2 className="mb-2 text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                    Come è andata
                  </h2>
                  <ul className="flex flex-col gap-1">
                    <AnimatePresence initial={false}>
                      {results.map((r) => {
                        const esito = outcomeOf(r.gf, r.ga);
                        return (
                          <motion.li
                            key={r.key}
                            initial={{ opacity: 0, x: -14 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-2.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
                          >
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold"
                              style={{
                                backgroundColor: `${OUTCOME_COLOR[esito]}22`,
                                color: OUTCOME_COLOR[esito],
                              }}
                            >
                              {esito}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {r.opponent}
                              {r.coppa && (
                                <Crown size={11} className="ml-1.5 inline text-[#c9a10b]" />
                              )}
                            </span>
                            <span className="shrink-0 font-bold tabular-nums">
                              {r.gf}-{r.ga}
                            </span>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </section>
              )}
            </div>

            {(standings.length > 0 || state.cup) && (
              <div className="order-1 flex flex-col gap-3 lg:order-2 lg:w-72 lg:shrink-0">
                {/* Il cammino in coppa accanto alla classifica: le due competizioni si leggono
                    insieme, che è il modo in cui una stagione si vive davvero. */}
                <CupProgress state={state} world={world} />
                {standings.length > 0 && (
                  <MiniStandings standings={standings} state={state} world={world} />
                )}
              </div>
            )}
          </div>
        )}

        {tab === "rosa" && (
          <SquadPanel
            state={state}
            world={world}
            lineup={lineup}
            onAction={eseguiAzione}
            onRenew={setRinnovoPer}
            onProposeCaptain={proponiCapitano}
          />
        )}

        {tab === "classifica" &&
          (standings.length > 0 ? (
            <StandingsTable
              standings={standings}
              title={
                state.phase === "conclusa"
                  ? "Classifica finale"
                  : `Classifica · stagione ${state.season}`
              }
              onOpenClub={(id, name) => setClubVisto({ id, name })}
            />
          ) : (
            <p className="py-10 text-center text-sm text-[var(--text-secondary)]">
              La classifica compare dopo la prima giornata.
            </p>
          ))}

        {tab === "corona" && <CupPanel state={state} world={world} />}

        {tab === "storico" && (
          <ul className="flex flex-col gap-2">
            {[...state.history].reverse().map((summary) => (
              <li
                key={summary.season}
                className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-sm font-extrabold">
                  {summary.season}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {ordinale(summary.position)} posto · {summary.points} punti
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {summary.goalsFor} fatti · {summary.goalsAgainst} subiti
                    {summary.cupOutcome ? ` · Corona: ${summary.cupOutcome}` : ""}
                  </p>
                </div>
                {summary.position === 1 && <Crown size={18} className="shrink-0 text-[#f5c518]" />}
              </li>
            ))}
            {state.history.length === 0 && (
              <p className="py-10 text-center text-sm text-[var(--text-secondary)]">
                La prima stagione è ancora in corso.
              </p>
            )}
          </ul>
        )}
      </main>

      {inCorso && !bloccato && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--surface-border)] bg-[var(--surface)]/95 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl px-4 py-3">
            {correndo ? (
              <button
                type="button"
                onClick={salta}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[var(--surface-border)] py-4 text-base font-extrabold transition-transform active:scale-[0.98]"
              >
                Salta al risultato
              </button>
            ) : (
              <button
                type="button"
                onClick={corri}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--brand)] py-4 text-base font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-[0.98]"
              >
                <FastForward size={19} />
                {state.phase === "mercato_estivo"
                  ? "Apri il mercato estivo"
                  : "Gioca fino al mercato"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Le sovraimpressioni aspettano che i risultati abbiano finito di scorrere: aprirsi
          sopra la corsa significherebbe non farla vedere mai. */}
      <AnimatePresence>
        {teatro && (
          <MatchTheatre
            key="teatro"
            result={teatro.result}
            opponent={teatro.opponent}
            clubName={world.clubName}
            reason={teatro.reason}
            seed={`${state.seed}-${teatro.key}`}
            nameOf={(id) => (id ? (nameById[id] ?? "Un giocatore") : "Un giocatore")}
            context={buildTheatreContext(state, world, teatro.opponent)}
            penalties={teatro.penalties}
            onClose={() => setTeatro(null)}
          />
        )}

        {/* L'invito aspetta che i risultati abbiano finito di scorrere: chiedere mentre la
            corsa è in atto significherebbe interromperla a metà. */}
        {!teatro && !correndo && keyMatch && (
          <KeyMatchPrompt
            key="invito-partita"
            opponent={keyMatch.opponent}
            reason={keyMatch.reason}
            onWatch={() => {
              setTeatro(keyMatch);
              setKeyMatch(null);
            }}
            onSkip={() => setKeyMatch(null)}
          />
        )}

        {incident && !teatro && !keyMatch && (
          <IncidentDialog key="imprevisto" incident={incident} onClose={chiudiImprevisto} onDecide={decidiImprevisto} />
        )}

        {clubVisto && (
          <ClubViewerModal
            key="club-visto"
            clubId={clubVisto.id}
            clubName={clubVisto.name}
            state={state}
            world={world}
            onClose={() => setClubVisto(null)}
          />
        )}

        {!correndo && !incident && !teatro && !keyMatch && state.coachDeparture && (
          <CoachDepartureDialog
            key="partenza-mister"
            coachName={state.coachDeparture.coachName}
            clubName={state.coachDeparture.clubName}
            onClose={chiudiPartenzaMister}
          />
        )}

        {!correndo && !incident && !teatro && !keyMatch && !state.coachDeparture && standoffForzato && (
          <PlayerStandoffChat
            key="richiesta"
            standoff={standoffForzato}
            onMove={mossaStandoffForzato}
            onClose={chiudiStandoffForzato}
            forced
          />
        )}

        {/* Riscontro del premio in denaro: sopra a qualunque chat standoff sia aperta (contenitore
            dedicato perché `DealToast` è pensato per ancorarsi a un genitore `relative`, come già
            fa dentro `MarketPanel`). */}
        {standoffDeal && (
          <div key="premio-toast" className="pointer-events-none fixed inset-0 z-[60]">
            <div className="relative h-full w-full">
              <DealToast deal={standoffDeal} />
            </div>
          </div>
        )}

        {!correndo && !incident && !teatro && !keyMatch && state.market && !state.pendingRequest && (
          <MarketPanel
            key="mercato"
            state={state}
            world={world}
            dsWorld={dsWorld}
            snapshot={state.market}
            standings={standingsFinali}
            deal={deal}
            coachChoices={scelteMister}
            onAction={eseguiAzione}
            onHireCoach={ingaggia}
            onSearch={cerca}
            onNegotiateOffer={trattaOfferta}
            onNegotiatePurchase={trattaAcquisto}
            onNegotiateLoan={trattaPrestito}
            onOpenStandoff={apriStandoff}
            onShiftFinances={spostaFinanze}
            onRenewPlayer={setRinnovoPer}
            onRenewCoach={rinnovaMister}
            onProposeCaptain={proponiCapitano}
            onSignFreeAgent={firmaSvincolato}
            standoffChiuse={standoffChiuse}
            onProposePromiseAlternative={proponiAlternativaPromessa}
            onClose={chiudiMercato}
          />
        )}

        {rinnovoPer && (
          <RenewalModal
            key="rinnovo"
            state={state}
            world={world}
            playerId={rinnovoPer}
            onRenew={proponiRinnovo}
            onClose={() => setRinnovoPer(null)}
          />
        )}

        {dialogo && (
          <PlayerDialogueChat
            key="dialogo"
            state={state}
            world={world}
            dialogue={dialogo}
            onMove={mossaDialogo}
            onClose={chiudiDialogo}
          />
        )}

        {state.negotiation && (
          <NegotiationChat
            key="trattativa"
            negotiation={state.negotiation}
            budget={state.budget}
            onMove={mossaTrattativa}
            onClose={chiudiTrattativa}
          />
        )}

        {meetingData && (
          <CoachMarketMeetingModal
            key="meeting-mercato"
            coach={meetingData.coach}
            promises={meetingData.promises}
            sessionDeals={meetingData.sessionDeals}
            roster={state.roster}
            players={world.players}
            oldHarmony={meetingData.oldHarmony}
            newHarmony={meetingData.newHarmony}
            coachResigned={meetingData.coachResigned}
            summaryMessage={meetingData.summaryMessage}
            guaranteedStarters={meetingData.nextState.guaranteedStarters ?? {}}
            onSetGuaranteedStarter={(role, pId, slotId) => {
              setMeetingData((prev) =>
                prev
                  ? {
                      ...prev,
                      nextState: setGuaranteedStarter(prev.nextState, role, pId, slotId),
                    }
                  : null,
              );
            }}
            onClose={() => {
              setTab("stagione");
              onChange(meetingData.nextState, true);
              setMeetingData(null);
            }}
          />
        )}

        {!correndo && !incident && !teatro && !keyMatch && !riepilogo && bisognaRinnovare && coachAttuale && (
          <CoachNegotiationChat
            key="rinnovo-mister"
            coach={coachAttuale}
            clubName={world.clubName}
            clubNation="Italia"
            budget={state.budget}
            roster={state.roster}
            season={state.season}
            players={world.players}
            isDefaultCoach
            buyoutFee={0}
            seed={state.seed}
            marketCandidates={marketCandidatesRinnovo}
            onAgree={(_c, promises, cost) => onChange(confirmCoachSeasonPromises(state, world, promises, cost))}
            onCancel={() => onChange(declineCoachSeasonMeeting(state, world))}
          />
        )}

        {/* L'obiettivo si dichiara dopo il rinnovo col mister: stesso momento, la "sveglia" di
            inizio stagione, un passo alla volta. */}
        {!correndo && !incident && !teatro && !keyMatch && !riepilogo && !bisognaRinnovare && bisognaObiettivo && (
          <SeasonObjectiveScreen
            key="obiettivo-stagionale"
            season={state.season}
            choices={seasonObjectiveChoices(state, world)}
            onChoose={(tier) => onChange(setSeasonObjective(state, tier))}
          />
        )}

        {/* Il trionfo viene **prima** del resoconto: è il momento da festeggiare, e leggere i
            numeri di fine stagione prima toglierebbe la sorpresa. */}
        {!correndo && !teatro && !keyMatch && mostraTrionfo && riepilogo && (
          <TriumphScreen
            key="trionfo"
            data={{
              clubName: world.clubName,
              season: riepilogo.season,
              leagueName: riepilogo.leagueName ?? world.leagueName ?? "Campionato",
              trophies: riepilogo.trophies ?? {
                league: false,
                continental: false,
                national: false,
              },
              points: riepilogo.points,
              goalsFor: riepilogo.goalsFor,
              goalsAgainst: riepilogo.goalsAgainst,
              position: riepilogo.position,
              topScorer: capocannoniere(riepilogo),
            }}
            onClose={() => setTrionfoVisto(riepilogo.season)}
          />
        )}

        {!correndo && !teatro && !keyMatch && !mostraTrionfo && riepilogo && (
          <SeasonEndOverlay
            key="fine-stagione"
            state={state}
            summary={riepilogo}
            teamsInLeague={world.opponents.length + 1}
            onContinue={() => {
              setSquadReportSummary(riepilogo);
              setSeasonEnd(null);
              setResults([]);
            }}
            onExit={onExit}
          />
        )}

        {!correndo && !teatro && !keyMatch && !riepilogo && squadReportSummary && (
          <SeasonSquadReportModal
            key="report-rosa-ds"
            summary={squadReportSummary}
            clubName={world.clubName}
            onContinue={() => setSquadReportSummary(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Una partita che vale la pena di guardare, col perché già pronto. */
interface PartitaChiave {
  result: MatchResult;
  opponent: string;
  reason: string;
  key: string;
  /** Presente solo per una partita di Coppa decisa ai rigori. */
  penalties?: { weWon: boolean };
}

/**
 * La partita decisiva di questo referto, se ce n'è una.
 *
 * Prima la coppa: nel tabellone ogni gara è un'eliminazione, quindi conta sempre. Poi il
 * campionato — scontro diretto per il vertice, o volata scudetto — la regola vive nel motore
 * (`isKeyMatch`), qui si passano soltanto i dati, incluso dove sta in classifica l'avversaria.
 */
function partitaChiave(report: WeekReport, totalRounds: number): PartitaChiave | null {
  const nostra = report.standings?.find((r) => r.isUser);
  const primo = report.standings?.[0];

  if (report.cupMatch && isKeyMatch({ cupStage: report.cupMatch.stage, totalRounds })) {
    return {
      result: report.cupMatch.result,
      opponent: report.cupMatch.opponent,
      reason: keyMatchReason({ cupStage: report.cupMatch.stage, totalRounds }),
      key: `c-${report.season}-${report.week}`,
      penalties: report.cupMatch.wentToPenalties
        ? { weWon: !!report.cupMatch.weWonPenalties }
        : undefined,
    };
  }

  if (report.match && nostra) {
    const avversaria = report.standings?.find((r) => r.name === report.match!.opponent);
    const input = {
      leagueRound: report.week,
      totalRounds,
      position: nostra.position,
      gapFromFirst: (primo?.points ?? nostra.points) - nostra.points,
      opponentPosition: avversaria?.position,
    };
    if (isKeyMatch(input)) {
      return {
        result: report.match.result,
        opponent: report.match.opponent,
        reason: keyMatchReason(input),
        key: `l-${report.season}-${report.week}`,
      };
    }
  }

  return null;
}

/**
 * Le due formazioni **vere** per il Match Theatre 2D: la nostra rosa attuale (dagli slot
 * schierati, ognuno col proprio reparto) e l'undici migliore dell'avversaria.
 *
 * Per l'avversaria non serve una nuova fonte dati: `LeagueTeam.scorers` è già costruito da
 * `bestElevenByDepartment` + `buildScorerPool` (`squadStrength.ts`) in un ordine **fisso** —
 * 1 portiere, 4 difensori, 4 centrocampisti, 2 attaccanti (`OPPONENT_SHAPE`) — quindi si può
 * affettare posizionalmente senza bisogno di esporre il reparto di ognuno.
 */
function buildTheatreContext(
  state: CareerState,
  world: CareerWorld,
  opponentName: string,
): MatchTheatreContext | undefined {
  const lineup = currentLineup(state, world);
  const ourEleven = Object.values(lineup.starters)
    .map((playerId) => {
      const p = world.players[playerId];
      return p ? { playerId, department: p.department } : null;
    })
    .filter((p): p is { playerId: string; department: Department } => p !== null);

  const team = world.opponents.find((t) => t.name === opponentName);
  const scorers = team?.scorers ?? [];
  const shape: [Department, number][] = [
    ["POR", 1],
    ["DIF", 4],
    ["CC", 4],
    ["ATT", 2],
  ];
  const opponentEleven: { playerId: string; department: Department }[] = [];
  let cursore = 0;
  for (const [department, quanti] of shape) {
    for (let i = 0; i < quanti && cursore < scorers.length; i++, cursore++) {
      opponentEleven.push({ playerId: scorers[cursore]!.id, department });
    }
  }

  if (ourEleven.length === 0 || opponentEleven.length === 0) return undefined;
  return { ourEleven, opponentEleven };
}

/** Aggiunge in cima i risultati di un referto, tenendo la lista corta. */
function aggiungiRisultati(prev: RisultatoScorso[], report: WeekReport): RisultatoScorso[] {
  const nuovi: RisultatoScorso[] = [];
  if (report.cupMatch) {
    nuovi.push({
      key: `c-${report.season}-${report.week}`,
      opponent: report.cupMatch.opponent,
      gf: report.cupMatch.result.goalsFor,
      ga: report.cupMatch.result.goalsAgainst,
      coppa: true,
    });
  }
  if (report.match) {
    nuovi.push({
      key: `l-${report.season}-${report.week}`,
      opponent: report.match.opponent,
      gf: report.match.result.goalsFor,
      ga: report.match.result.goalsAgainst,
    });
  }
  if (nuovi.length === 0) return prev;
  return [...nuovi, ...prev].slice(0, 20);
}

/**
 * Il capocannoniere della rosa nella stagione appena chiusa.
 *
 * Si legge da `playerReports`, che il motore compila già a fine stagione con le statistiche
 * individuali: non serve un secondo calcolo, e soprattutto non serve tenere un'altra classifica
 * marcatori che potrebbe non concordare con quella.
 */
function capocannoniere(summary: SeasonSummary): { name: string; goals: number } | undefined {
  const migliore = (summary.playerReports ?? [])
    .filter((r) => r.stats.goals > 0)
    .sort((a, b) => b.stats.goals - a.stats.goals)[0];
  return migliore ? { name: migliore.name, goals: migliore.stats.goals } : undefined;
}
