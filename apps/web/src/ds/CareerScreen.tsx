import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Cloud,
  CloudOff,
  Save,
  Crown,
  FastForward,
  History,
  ListOrdered,
  Play,
  Shield,
  Trophy,
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
  coachContractSeasonsLeft,
  coachSeveranceNow,
  buildStandings,
  financesOf,
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
  signIncomingPlayer,
  signingDemandOf,
  abandonSigning,
  openForcedDialogue,
  playNegotiation,
  proposePromiseAlternative,
  setGuaranteedStarter,
  boardMeeting,
  careerPlayers,
  coachSquadReport,
  resignCoach,
  settleBoardMeeting,
  answerFormationChange,
  FORMATION_RESIGN_HARMONY,
  FORMATION_REFUSAL_HARMONY_COST,
  defaultBoard,
  inSecondDivision,
  coachChoices,
  currentLineup,
  findCoach,
  hireCoach,
  rebuildLeagueState,
  resolveIncidentDecision,
  searchMarket,
  seasonYearLabel,
  type MatchViewMode,
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
  type RoleCandidate,
  type SearchResult,
  type SearchCriteria,
  type SessionDeal,
  type SeasonSummary,
  type StandingRow,
  type WeekReport,
} from "@app/game-engine";
import type { Department } from "@app/shared-types";
import { ClubViewerModal } from "./ClubViewerModal";
import { CoachDepartureDialog } from "./CoachDepartureDialog";
import { FormationChangeDialog } from "./FormationChangeDialog";
import { CoachMarketMeetingModal } from "./CoachMarketMeetingModal";
import { CoachNegotiationChat } from "./CoachNegotiationChat";
import { PlayerDialogueChat } from "./PlayerDialogueChat";
import { RenewalModal } from "./RenewalModal";
import { ContractOfferForm } from "./ContractOfferForm";
import { BoardMeetingScreen } from "./BoardMeetingScreen";
import { CoachPickerScreen } from "./CoachPickerScreen";
import { StandingsTable } from "../classic/StandingsTable";
import { CupPanel } from "./CupPanel";
import { CupProgress, NationalCupProgress } from "./CupProgress";
import { NationalCupPanel } from "./NationalCupPanel";
import { IncidentDialog } from "./IncidentDialog";
import { KeyMatchPrompt } from "./KeyMatchPrompt";
import { MatchTheatre } from "./MatchTheatre";
import { DealToast, dealKindOf, type Deal } from "./DealToast";
import { MarketPanel } from "./MarketPanel";
import { NegotiationChat } from "./NegotiationChat";
import type { DsWorldData } from "./useDsWorld";
import { MiniStandings } from "./MiniStandings";
import { StatsPanel } from "./StatsPanel";
import { NextTaskCard } from "./NextTaskCard";
import { SeasonEndOverlay } from "./SeasonEndOverlay";
import { SeasonSquadReportModal } from "./SeasonSquadReportModal";
import { SquadPanel } from "./SquadPanel";
import { WeekReportCard } from "./WeekReportCard";
import { Button, TabBar } from "./ui";
import {
  COMPETITION_ACCENT,
  OUTCOME_COLOR,
  euro,
  ordinale,
  outcomeOf,
  type Competition,
} from "./format";

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

type Tab = "stagione" | "rosa" | "classifica" | "coppe" | "storico";

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "stagione", label: "Stagione", icon: Play },
  { key: "rosa", label: "Rosa", icon: Users },
  { key: "classifica", label: "Classifica", icon: ListOrdered },
  { key: "coppe", label: "Coppe", icon: Trophy },
  { key: "storico", label: "Storico", icon: History },
];

/**
 * Le coppe stanno **sotto una scheda sola con un selettore** (piano DS, D2).
 *
 * Due voci separate nella barra sarebbero costate un quinto della larghezza su schermo stretto
 * a una competizione che in mezzo mondo non esiste nemmeno. La regola del selettore: le voci
 * assenti **non ci sono**, non sono disabilitate — una carriera estera non ha Coppa Tricolore,
 * chi non si è qualificato non ha Corona — e con una competizione sola il selettore sparisce,
 * perché un selettore con una voce è rumore.
 */
type Coppa = "corona" | "tricolore";

/** Quanto resta a schermo ogni risultato mentre la corsa scorre. */
const RITMO_MS = 260;

interface RisultatoScorso {
  key: string;
  opponent: string;
  gf: number;
  ga: number;
  /** Assente = campionato. Serve a marcare la riga con l'icona e il colore giusti. */
  competizione?: Competition;
  /** Solo per le coppe finite ai rigori: dice se il turno è passato. */
  passatoAiRigori?: boolean;
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
  /**
   * **Salva la partita adesso**, creando un punto di ripristino.
   *
   * Scelta dell'utente: il salvataggio principale lo decide lui. L'autosave resta come rete di
   * sicurezza (`useCareerPersistence`) ma **non crea punti** — se lo facesse, la tabella si
   * riempirebbe di istantanee che nessuno ha chiesto e i due per stagione sarebbero sempre gli
   * ultimi due secondi giocati.
   */
  onSaveCheckpoint?: () => Promise<{ ok: boolean; message: string }> | void;
}

export function CareerScreen({
  state,
  world,
  dsWorld,
  onChange,
  onExit,
  saving,
  saveEnabled,
  onSaveCheckpoint,
}: CareerScreenProps) {
  const [tab, setTab] = useState<Tab>("stagione");
  const [report, setReport] = useState<WeekReport | null>(null);
  const [results, setResults] = useState<RisultatoScorso[]>([]);
  /** Squadre o individuali nella scheda *Classifica*. */
  const [vistaClassifica, setVistaClassifica] = useState<"squadre" | "individuali">("squadre");
  /** Quale coppa si sta guardando nella scheda *Coppe*. */
  const [coppa, setCoppa] = useState<Coppa>("corona");
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
  /** La partita che si sta guardando in 2D, e come la si sta guardando. */
  const [teatro, setTeatro] = useState<PartitaChiave | null>(null);
  const [modalitaTeatro, setModalitaTeatro] = useState<MatchViewMode>("salienti");
  /**
   * **Sotto il velo non si guarda niente.**
   *
   * C'è un invito da accettare o una partita in scena: lo stato dietro contiene già il
   * tabellino, la riga nei risultati, la classifica e il tabellone di coppa aggiornati — perché
   * il motore ha già simulato, ed è la garanzia che guardare o saltare non cambi nulla. Finché
   * la domanda «vuoi vederla?» è aperta, la risposta non deve essere leggibile da nessuna parte.
   */
  const sottoVelo = !!keyMatch || !!teatro;
  const [seasonEnd, setSeasonEnd] = useState<number | null>(null);
  const [squadReportSummary, setSquadReportSummary] = useState<SeasonSummary | null>(null);
  const [correndo, setCorrendo] = useState(false);
  /** I referti ancora da mostrare della corsa in atto. */
  const coda = useRef<WeekReport[]>([]);

  const calendar = useMemo(() => seasonCalendar(state, world), [state, world]);
  const lineup = useMemo(() => currentLineup(state, world), [state, world]);
  /** Le due casse: il margine ingaggi sta in testata accanto al budget, non dietro una scheda. */
  const finanze = useMemo(() => financesOf(state, world), [state, world]);
  const coach = state.coachId ? findCoach(state.coachId) : undefined;

  /**
   * I nomi di **chiunque** possa comparire in un referto o sul campo 2D.
   *
   * Le tre fonti si sovrappongono di proposito, ed è la stessa regola di `marketPlayerIndex`:
   * il database non conosce i regen, il mondo del mercato non conosce i nostri, e chi abbiamo
   * comprato da un altro club sta solo nel secondo. Chi arriva dopo aggiorna, nessuno azzera —
   * l'unica cosa che potrebbe far ricomparire i "Giocatore" è cambiare l'ordine.
   */
  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, player] of Object.entries(world.players)) map[id] = player.name;
    for (const [id, player] of Object.entries(world.market?.players ?? {})) map[id] = player.name;
    for (const generated of state.generated) map[generated.id] = generated.name;
    return map;
  }, [world.players, world.market, state.generated]);

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
   * Quali coppe esistono davvero in questa carriera, in questa stagione.
   *
   * Le voci assenti non compaiono affatto: una scheda disabilitata prometterebbe un contenuto
   * che non arriverà mai. Se la coppa scelta sparisce (eliminati e stagione nuova senza Corona)
   * si ripiega sulla prima disponibile invece di mostrare un pannello vuoto.
   */
  const coppeDisponibili = useMemo<Coppa[]>(() => {
    const out: Coppa[] = [];
    if (state.cup && world.cupTeams) out.push("corona");
    if (state.nationalCup && world.divisions) out.push("tricolore");
    return out;
  }, [state.cup, state.nationalCup, world.cupTeams, world.divisions]);
  const coppaAttiva = coppeDisponibili.includes(coppa) ? coppa : coppeDisponibili[0];


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
      const chiave = partitaChiave(prossimo);
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
    (scelta: "ignora" | "punizione" | "tieni_primo" | "tieni_secondo", giorni?: number) => {
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
      // La promessa di rinnovo si tratta **qui**, non da ricordare in Rosa piu tardi.
      if (esito.openRenewal) setRinnovoPer(dialogo.playerId);
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
    (offer: {
      wage: number;
      seasons: number;
      // La clausola fa parte del pacchetto che il giocatore valuta (`renewalOfferScore`):
      // lasciarla fuori dalla firma significherebbe farla comparire al tavolo e poi ignorarla.
      clause?: number;
      guaranteedStarter?: boolean;
      captain?: boolean;
    }) => {
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
      return { ok: esito.ok, message: esito.message };
    },
    [state, world, onChange],
  );

  const firmaSvincolato = useCallback(
    (agentId: string, offer: { wage: number; seasons: number; guaranteedStarter: boolean }) => {
      const esito = signFreeAgent(state, world, agentId, offer);
      // Anche un no puo cambiare lo stato: chi non convinci e stato preso da un altro club, e
      // il motore lo toglie dalla vetrina. Applicare solo i si lo avrebbe lasciato li.
      if (esito.state !== state) onChange(esito.state);
      // Il tavolo mostra l'esito lì dove si è deciso: un rifiuto silenzioso sembrerebbe un bug.
      // I tre esiti (disinteressato / accordo / conteso) arrivano fino alla scheda, che su
      // ciascuno mostra una risposta diversa invece dello stesso "no" indistinto.
      return {
        ok: esito.ok,
        message: esito.message,
        counter: esito.counter,
        outcome: esito.outcome,
        rivalClubName: esito.rivalClubName,
      };
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
   * **La richiesta che ferma le giornate apre la stessa chat di tutte le altre.**
   *
   * Fino a ieri apriva il *vecchio* sistema (`playerStandoff`), quello con i tre `if` e la
   * categoria residuale che la riscrittura dello Spogliatoio era andata a togliere: è il popup
   * che l'utente vedeva riaprirsi a stagione in corso. Ora è un `Dialogue` come gli altri,
   * marcato `forced` perché blocca la settimana finché non si risolve.
   *
   * Si apre una sola volta quando la richiesta compare, non ad ogni render: altrimenti ogni
   * mossa (che aggiorna `state`) la ricostruirebbe daccapo, perdendo il filo e la pazienza già
   * consumata.
   */
  const [dialogoForzato, setDialogoForzato] = useState<Dialogue | null>(null);
  useEffect(() => {
    if (state.pendingRequest && !dialogoForzato) {
      const { dialogue, state: next } = openForcedDialogue(state, world);
      if (dialogue) setDialogoForzato(dialogue);
      // Nessun tema ammissibile: il motore annulla la richiesta invece di bloccare il calendario
      // su una schermata che non esiste.
      else if (next !== state) onChange(next);
    }
    // Si chiude solo per mano dell'utente (`chiudiDialogoForzato`), mai in reazione allo stato:
    // appena la conversazione si risolve `pendingRequest` torna null, ma la chat deve restare
    // visibile finché non si legge l'esito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pendingRequest]);

  const mossaDialogoForzato = useCallback(
    (move: DialogueMove) => {
      if (!dialogoForzato) return;
      const budgetPrima = state.budget;
      const esito = applyPlayerDialogue(state, world, dialogoForzato, move);
      if (esito.state.budget !== budgetPrima) {
        segnalaPremio(budgetPrima, esito.state.budget, dialogoForzato.playerName);
      }
      onChange(esito.state);
      setDialogoForzato(esito.dialogue);
      if (esito.openRenewal) setRinnovoPer(dialogoForzato.playerId);
    },
    [state, world, dialogoForzato, onChange, segnalaPremio],
  );
  // Come per gli imprevisti: la stagione riparte da sola, ma solo quando l'utente ha letto
  // l'esito e chiude la chat — non nell'istante in cui la conversazione si risolve, altrimenti
  // la corsa ripartirebbe sotto un popup ancora aperto.
  const chiudiDialogoForzato = useCallback(() => {
    setDialogoForzato(null);
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

  /**
   * **La seconda fase dell'acquisto**: trovato l'accordo col club, si tratta il contratto.
   *
   * Finché non si firma il cartellino non è pagato e la rosa è invariata — se il giocatore
   * dice di no, salta tutta l'operazione. La richiesta si calcola solo quando serve, perché
   * dipende dalla cifra concordata poco fa.
   */
  const richiestaContrattuale = useMemo(() => {
    const tratt = state.negotiation;
    if (!tratt?.awaitingContract) return null;
    return signingDemandOf(state, world, tratt.playerId, tratt.amount, tratt.clubId);
  }, [state, world]);

  const firmaAcquisto = useCallback(
    (offer: { wage: number; seasons: number; clause?: number; guaranteedStarter?: boolean; captain?: boolean }) => {
      const esito = signIncomingPlayer(state, world, offer);
      onChange(esito.state);
      if (esito.ok || esito.state.negotiation?.status === "arenata") {
        setDeal({
          id: Date.now(),
          kind: esito.ok ? "acquisto" : "errore",
          message: esito.message,
          delta: esito.state.budget - state.budget,
        });
      }
      return { ok: esito.ok, message: esito.message };
    },
    [state, world, onChange],
  );

  const rinunciaAllaFirma = useCallback(() => {
    onChange(abandonSigning(state));
  }, [state, onChange]);

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

  /**
   * **Il colloquio con la società** (`board.ts`), primo gate di ogni stagione.
   *
   * Non è più un avviso che compare solo dopo un'annata storta: è il tavolo in cui il presidente
   * dichiara l'obiettivo minimo, si concordano ambizione e mezzi, e — quando la questione è
   * aperta — si decide della panchina. Viene prima del rinnovo col mister proprio perché da qui
   * il mister può uscire esonerato.
   */
  const colloquio = useMemo(() => boardMeeting(state, world), [state, world]);
  /** La lettura della rosa che il mister porta al tavolo (`coachReport.ts`). */
  const analisiMister = useMemo(() => coachSquadReport(state, world), [state, world]);
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
  const bloccato =
    !!state.market ||
    !!state.pendingRequest ||
    bisognaRinnovare ||
    !!state.coachDeparture ||
    !!state.coachFormationRequest ||
    bisognaObiettivo;

  const chiudiPartenzaMister = useCallback(() => {
    onChange({ ...state, coachDeparture: null });
    setRipartire(true);
  }, [state, onChange]);

  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      {/* **La testata, ristrutturata.**

          Prima impilava club, stagione, mister, modulo e sintonia in **una riga di 200px**, e
          la misura diceva che ne servivano 245: si leggeva «Stagione 1/10 · Nuri Şahin
          (4-2-3-1) · Si…». Non era un problema di font — era una riga che faceva il lavoro di
          quattro. Ora sono due livelli: identità sopra, contesto come pastiglie sotto, che
          vanno a capo invece di tagliarsi. */}
      <header className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface)]/95 pt-safe backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExit}
              aria-label="Torna alla home"
              className="-ml-2 flex h-tap w-tap shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-title leading-tight">{world.clubName}</p>
              <p className="text-label text-[var(--text-secondary)]">
                {/* L'annata accanto al numero: «Stagione 3/10» dice a che punto sei della
                    carriera, «2028/29» dice in che anno stai giocando. Servono entrambe. */}
                <span className="num">
                  {seasonYearLabel(state.season)} · {state.season}/{CAREER_SEASONS}
                </span>
                {" · "}
                {/* A settimana zero «0ª di 34» non vuol dire niente: il campionato non è
                    cominciato, e va detto così. */}
                {state.week < 1 ? (
                  "non cominciata"
                ) : (
                  <span className="num">
                    {Math.min(state.week, settimane)}ª di {settimane}
                  </span>
                )}
              </p>
            </div>

            {/* **Le due casse.** Il margine ingaggi decide se un rinnovo è possibile quanto il
                budget decide se lo è un cartellino: nasconderne uno faceva sembrare il sistema
                più opaco di quanto sia. Toccarle apre le finanze per intero. */}
            <div className="shrink-0 text-right">
              <p className="num flex items-center justify-end gap-1 text-title">
                <Wallet size={15} className="text-[var(--text-secondary)]" />
                {euro(state.budget)}
              </p>
              <p
                className="num flex items-center justify-end gap-1 text-label font-bold"
                title="Margine ancora disponibile per nuovi ingaggi"
                style={{
                  color: finanze.wageRoom < 0 ? "var(--danger)" : "var(--text-secondary)",
                }}
              >
                <Users size={11} />
                {euro(finanze.wageRoom)}
              </p>
            </div>
          </div>

          {/* Il contesto come pastiglie: vanno a capo, quindi nessuna di queste informazioni
              può più sparire per mancanza di spazio. */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {nostraRiga && (
              <span className="num rounded-full bg-[var(--brand)]/12 px-2 py-0.5 text-label font-extrabold text-[var(--brand)]">
                {ordinale(nostraRiga.position)} · {nostraRiga.points} pt
              </span>
            )}
            {coach && (
              <span className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-label font-bold">
                {coach.name}
              </span>
            )}
            {coach && (
              <span className="num rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-label font-bold text-[var(--text-secondary)]">
                {state.coachFormationId ?? coach.formationId}
              </span>
            )}
            {coach && (
              <span
                className="num rounded-full px-2 py-0.5 text-label font-bold"
                title="Sintonia col mister"
                style={{
                  backgroundColor:
                    (state.coachHarmony ?? 75) < 45
                      ? "color-mix(in srgb, var(--danger) 14%, transparent)"
                      : "var(--surface-raised)",
                  color:
                    (state.coachHarmony ?? 75) < 45 ? "var(--danger)" : "var(--text-secondary)",
                }}
              >
                Sintonia {state.coachHarmony ?? 75}%
              </span>
            )}
            {/* Il tasto Salva sta accanto allo stato del salvataggio: è lì che si guarda per
                sapere se il lavoro è al sicuro. */}
            {saveEnabled && onSaveCheckpoint && (
              <button
                type="button"
                onClick={async () => {
                  const esito = await onSaveCheckpoint();
                  if (esito) {
                    setDeal({
                      id: Date.now(),
                      kind: esito.ok ? "acquisto" : "errore",
                      message: esito.message,
                      delta: 0,
                    });
                  }
                }}
                className="ml-auto flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--brand)]/50 bg-[var(--brand)]/10 px-2.5 text-label font-bold text-[var(--brand)] active:scale-95"
              >
                <Save size={12} />
                Salva
              </button>
            )}
            <span
              className={`${saveEnabled && onSaveCheckpoint ? "" : "ml-auto "}flex items-center gap-1 text-label text-[var(--text-secondary)]`}
            >
              {saveEnabled ? (
                <>
                  <Cloud size={12} className={saving ? "animate-pulse" : undefined} />
                  {saving ? "salvataggio…" : "salvata"}
                </>
              ) : (
                <>
                  <CloudOff size={12} />
                  non salvata
                </>
              )}
            </span>
          </div>

          <span className="mt-2 flex h-1 overflow-hidden rounded-full bg-[var(--surface-raised)]">
            <motion.span
              className="block h-full rounded-full bg-[var(--brand)]"
              animate={{ width: `${progresso}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </span>
        </div>
      </header>

      {/* Le schede sono scese in fondo (`TabBar`): erano alte 28px, «Coppe» arrivava tagliata
          al bordo e «Storico» non si vedeva affatto. Lo spazio in fondo lascia posto alla barra
          più l'azione contestuale. */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-[13rem]">
        {/* ⚠️ **Niente spoiler mentre si decide se guardare.**

            Segnalazione dell'utente: *"capita di vedere prima il risultato o l'esito nei
            tabelloni delle coppe della selezione se guardare o meno le azioni, perdendo la
            voglia stessa di guardarle"*. La causa è strutturale: quando la corsa si ferma per
            una partita chiave il motore l'ha **già simulata** — è la garanzia che guardare o
            saltare non cambi nulla — quindi lo stato dietro l'invito contiene già il tabellino,
            la riga nella lista dei risultati e, peggio, la striscia della coppa aggiornata con
            l'eliminazione. Il velo del modale non basta: la striscia si legge lo stesso.

            ⚠️ **Il velo copriva solo la scheda Stagione**, e non bastava: il tabellone di coppa
            vive nella scheda *Coppe* e la classifica nella sua, entrambe già aggiornate. Bastava
            trovarsi lì — o arrivarci — per leggere l'esito. Adesso, finché l'invito è aperto o il
            teatro è in scena, **nessuna** scheda si disegna e la barra in fondo è disattivata.
            Non è un espediente visivo: è l'unico modo per cui la domanda «vuoi vederla?» abbia
            ancora senso quando la risposta è già scritta nello stato. */}
        {sottoVelo && (
          <div className="flex items-center justify-center px-6 py-16 text-center">
            <p className="text-body leading-relaxed text-[var(--text-secondary)] text-balance">
              Il campo ti aspetta. Il risultato lo scoprirai guardando.
            </p>
          </div>
        )}

        {tab === "stagione" && !sottoVelo && (
          /* Due colonne su schermo largo: i risultati scorrono a sinistra, la classifica resta
             ferma a destra. Su telefono la classifica sta sopra, compatta, perché è il dato che
             si vuole sotto controllo mentre le giornate passano. */
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="order-2 min-w-0 flex-1 lg:order-1">
              {/* **«E adesso cosa faccio?»** — la domanda a cui nessuna schermata rispondeva, ed
                  è la causa dello spaesamento dei giocatori nuovi. Sta in cima alla scheda
                  Stagione perché è la prima cosa che si guarda arrivando. */}
              <NextTaskCard
                state={state}
                world={world}
                standings={standings}
                onApriMercato={inCorso && !bloccato ? corri : undefined}
                onVaiRosa={() => setTab("rosa")}
              />
              <AnimatePresence>
                {notizia && (
                  <motion.p
                    key={notizia}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mb-3 rounded-card border border-[var(--brand)]/30 bg-[var(--brand)]/8 px-3.5 py-2.5 text-label leading-relaxed text-[var(--text-primary)]"
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
                  <h2 className="mb-2 text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                    Come è andata
                  </h2>
                  <ul className="flex flex-col gap-1">
                    <AnimatePresence initial={false}>
                      {results.map((r) => {
                        const esito =
                          r.passatoAiRigori === undefined
                            ? outcomeOf(r.gf, r.ga)
                            : r.passatoAiRigori
                              ? "V"
                              : "P";
                        return (
                          <motion.li
                            key={r.key}
                            initial={{ opacity: 0, x: -14 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-2.5 rounded-control border border-l-3 border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2 text-body"
                            style={
                              r.competizione
                                ? { borderLeftColor: COMPETITION_ACCENT[r.competizione] }
                                : undefined
                            }
                          >
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-label font-extrabold"
                              style={{
                                backgroundColor: `${OUTCOME_COLOR[esito]}22`,
                                color: OUTCOME_COLOR[esito],
                              }}
                            >
                              {esito}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {r.opponent}
                              {r.competizione === "corona" && (
                                <Crown
                                  size={11}
                                  className="ml-1.5 inline"
                                  style={{ color: COMPETITION_ACCENT.corona }}
                                />
                              )}
                              {r.competizione === "tricolore" && (
                                <Shield
                                  size={11}
                                  className="ml-1.5 inline"
                                  style={{ color: COMPETITION_ACCENT.tricolore }}
                                />
                              )}
                            </span>
                            <span className="shrink-0 font-bold tabular-nums">
                              {r.gf}-{r.ga}
                              {r.passatoAiRigori !== undefined && (
                                <span className="ml-1 text-label font-semibold text-[var(--text-secondary)]">
                                  dcr
                                </span>
                              )}
                            </span>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </section>
              )}
            </div>

            {(standings.length > 0 || state.cup || state.nationalCup) && (
              <div className="order-1 flex flex-col gap-3 lg:order-2 lg:w-72 lg:shrink-0">
                {/* Il cammino in coppa accanto alla classifica: le competizioni si leggono
                    insieme, che è il modo in cui una stagione si vive davvero. Impilate e non
                    dietro un selettore: qui la domanda non è "quale coppa guardo" ma "a che
                    punto sono", e due strisce da sei caselle stanno in mezzo schermo. */}
                <CupProgress state={state} world={world} />
                <NationalCupProgress state={state} world={world} />
                {standings.length > 0 && (
                  <MiniStandings
                    standings={standings}
                    state={state}
                    world={world}
                    onOpenClub={(id, name) => setClubVisto({ id, name })}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {tab === "rosa" && !sottoVelo && (
          <SquadPanel
            state={state}
            world={world}
            lineup={lineup}
            onAction={eseguiAzione}
            onRenew={setRinnovoPer}
            onProposeCaptain={proponiCapitano}
          />
        )}

        {tab === "classifica" && !sottoVelo && (
          <div className="flex flex-col gap-3">
            {/* ⚠️ **Le statistiche individuali stanno qui, non in una sesta scheda.**
                Cinque voci a 360px lasciano 72px l'una; una sesta le porta a 60 e l'etichetta
                verrebbe troncata (§ 8.2). E poi è il posto giusto: si guardano accanto alla
                classifica di squadra, non in un'altra sezione. */}
            <div className="flex gap-1 rounded-full bg-[var(--surface-raised)] p-1">
              {(["squadre", "individuali"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVistaClassifica(v)}
                  className={`relative min-h-9 flex-1 rounded-full px-3 py-1.5 text-label font-bold transition-colors ${
                    vistaClassifica === v ? "text-[var(--brand-contrast)]" : "text-[var(--text-secondary)]"
                  }`}
                >
                  {vistaClassifica === v && (
                    <motion.span
                      layoutId="ds-classifica-tab"
                      className="absolute inset-0 rounded-full bg-[var(--brand)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">{v === "squadre" ? "Classifica" : "Individuali"}</span>
                </button>
              ))}
            </div>

            {vistaClassifica === "individuali" ? (
              <StatsPanel stats={state.leagueStats} state={state} world={world} />
            ) : standings.length > 0 ? (
              <StandingsTable
                standings={standings}
                title={
                  state.phase === "conclusa"
                    ? "Classifica finale"
                    : `Classifica · ${seasonYearLabel(state.season)}`
                }
                onOpenClub={(id, name) => setClubVisto({ id, name })}
              />
            ) : (
              <p className="py-10 text-center text-body text-[var(--text-secondary)]">
                La classifica compare dopo la prima giornata.
              </p>
            )}
          </div>
        )}

        {tab === "coppe" && !sottoVelo && (
          <div className="flex flex-col gap-3">
            {coppeDisponibili.length > 1 && (
              <div className="flex gap-1 rounded-full bg-[var(--surface-raised)] p-1">
                {coppeDisponibili.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCoppa(key)}
                    className={`relative min-h-9 flex-1 rounded-full px-3 py-1.5 text-label font-bold transition-colors ${
                      coppaAttiva === key ? "text-[var(--brand-contrast)]" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {coppaAttiva === key && (
                      <motion.span
                        layoutId="ds-coppa-tab"
                        className="absolute inset-0 rounded-full bg-[var(--brand)]"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative flex items-center justify-center gap-1.5">
                      {key === "corona" ? <Crown size={13} /> : <Shield size={13} />}
                      {key === "corona" ? "Corona" : "Tricolore"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {coppeDisponibili.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-[var(--surface-border)] px-4 py-10 text-center">
                <Trophy size={22} className="text-[var(--text-secondary)]" />
                <p className="text-body font-semibold">Quest'anno niente coppe</p>
                <p className="max-w-xs text-label leading-relaxed text-[var(--text-secondary)]">
                  Alla Corona ci si qualifica arrivando fra le prime quattro del campionato.
                </p>
              </div>
            ) : coppaAttiva === "tricolore" ? (
              <>
                <NationalCupPanel state={state} world={world} />
                <StatsPanel
                  stats={state.nationalCupStats}
                  state={state}
                  world={world}
                  soloNostri
                />
              </>
            ) : (
              <>
                <CupPanel state={state} world={world} />
                <StatsPanel stats={state.cupStats} state={state} world={world} soloNostri />
              </>
            )}
          </div>
        )}

        {tab === "storico" && !sottoVelo && (
          <ul className="flex flex-col gap-2">
            {[...state.history].reverse().map((summary) => (
              <li
                key={summary.season}
                className="flex items-center gap-3 rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-[var(--surface)] text-body font-extrabold">
                  {summary.season}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-bold">
                    {ordinale(summary.position)} posto · {summary.points} punti
                  </p>
                  <p className="text-label text-[var(--text-secondary)]">
                    {summary.goalsFor} fatti · {summary.goalsAgainst} subiti
                  </p>
                  {/* Il cammino nelle coppe come etichette e non come coda di testo: erano una
                      riga sola che su schermo stretto veniva troncata proprio in fondo, cioè
                      dove stava la Coppa Tricolore. */}
                  {(summary.cupOutcome || summary.nationalCupOutcome) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {summary.cupOutcome && (
                        <span
                          className="rounded-full px-1.5 py-px text-label font-bold"
                          style={{
                            backgroundColor: `${COMPETITION_ACCENT.corona}1f`,
                            color: COMPETITION_ACCENT.corona,
                          }}
                        >
                          Corona: {summary.cupOutcome}
                        </span>
                      )}
                      {summary.nationalCupOutcome && summary.nationalCupOutcome !== "assente" && (
                        <span
                          className="rounded-full px-1.5 py-px text-label font-bold"
                          style={{
                            backgroundColor: `${COMPETITION_ACCENT.tricolore}1f`,
                            color: COMPETITION_ACCENT.tricolore,
                          }}
                        >
                          Tricolore: {summary.nationalCupOutcome}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {summary.position === 1 && <Crown size={18} className="shrink-0 text-[#f5c518]" />}
              </li>
            ))}
            {state.history.length === 0 && (
              <p className="py-10 text-center text-body text-[var(--text-secondary)]">
                La prima stagione è ancora in corso.
              </p>
            )}
          </ul>
        )}
      </main>

      {/* **La navigazione dove sta il pollice**, con l'azione del momento subito sopra.

          La safe area vive dentro `TabBar`: era gestita in 1 overlay su 19, quindi il pulsante
          principale dell'intera modalità finiva sotto la barra gestuale di iPhone. */}
      <TabBar
        items={TABS}
        value={tab}
        onChange={setTab}
        /* Sotto il velo la barra è spenta: senza, bastava toccare *Coppe* per leggere il
           tabellone aggiornato con l'eliminazione, che è metà della segnalazione. */
        disabled={sottoVelo}
        action={
          inCorso && !bloccato ? (
            correndo ? (
              <Button variant="secondary" size="lg" block onClick={salta}>
                Salta al risultato
              </Button>
            ) : (
              <Button variant="primary" size="lg" block icon={FastForward} onClick={corri}>
                {state.phase === "mercato_estivo"
                  ? "Apri il mercato estivo"
                  : "Gioca fino al mercato"}
              </Button>
            )
          ) : undefined
        }
      />

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
            mode={modalitaTeatro}
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
            onWatch={(mode) => {
              setModalitaTeatro(mode);
              setTeatro(keyMatch);
              setKeyMatch(null);
            }}
            onSkip={() => setKeyMatch(null)}
          />
        )}

        {incident && !teatro && !keyMatch && (
          <IncidentDialog
            key="imprevisto"
            incident={incident}
            nomePrimo={incident.playerId ? nameById[incident.playerId] : undefined}
            nomeSecondo={incident.secondPlayerId ? nameById[incident.secondPlayerId] : undefined}
            onClose={chiudiImprevisto}
            onDecide={decidiImprevisto}
          />
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

        {!correndo && !incident && !teatro && !keyMatch && !state.coachDeparture && dialogoForzato && (
          <PlayerDialogueChat
            key="richiesta"
            state={state}
            world={world}
            dialogue={dialogoForzato}
            onMove={mossaDialogoForzato}
            onClose={chiudiDialogoForzato}
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
            onShiftFinances={spostaFinanze}
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
            contractPhase={
              richiestaContrattuale && (
                <ContractOfferForm
                  state={state}
                  world={world}
                  demand={richiestaContrattuale}
                  /* Chi arriva da fuori non ha un ingaggio da noi: l'intera cifra è nuova, e
                     usare il suo stipendio attuale proietterebbe un impatto sul monte che il
                     motore poi non verifica. */
                  currentWage={0}
                  submitLabel="Fagli firmare"
                  onSubmit={firmaAcquisto}
                  onShiftFinances={spostaFinanze}
                  onCancel={rinunciaAllaFirma}
                  cancelLabel="Rinuncia"
                />
              )
            }
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

        {/* **La dirigenza parla per prima.** Se ha chiesto un esonero, quella decisione viene
            prima del rinnovo col mister — che potrebbe non esserci più — e prima dell'obiettivo,
            che si dichiara con la panchina già assegnata. */}
        {/* Il cambio di modulo viene **prima** del mercato: rifare la squadra attorno a un
            sistema nuovo e la prima decisione della finestra, non un ripensamento a meta. */}
        {!correndo && !incident && !teatro && !keyMatch && !riepilogo && state.coachFormationRequest && coachAttuale && (
          <FormationChangeDialog
            key="cambio-modulo"
            coach={coachAttuale}
            currentFormationId={state.coachFormationId ?? coachAttuale.formationId}
            request={state.coachFormationRequest}
            harmony={state.coachHarmony ?? 75}
            resignRisk={(state.coachHarmony ?? 75) - FORMATION_REFUSAL_HARMONY_COST < FORMATION_RESIGN_HARMONY}
            onAnswer={(accept) => {
              const esito = answerFormationChange(state, accept);
              onChange(esito.state);
              setDeal({ id: Date.now(), kind: esito.coachResigned ? "errore" : "acquisto", message: esito.message, delta: 0 });
            }}
          />
        )}

        {/* **Il colloquio con la società apre la stagione**, ogni anno e non solo dopo un'annata
            storta: è lì che si concordano obiettivo, mezzi e sorte della panchina. Viene prima
            del rinnovo col mister — che potrebbe non esserci più dopo questo tavolo — e prima
            delle coppe, che si dichiarano sapendo già quanto si è promesso in campionato. */}
        {!correndo && !incident && !teatro && !keyMatch && !riepilogo && !state.market && bisognaObiettivo && (
          <BoardMeetingScreen
            key="colloquio-societa"
            meeting={colloquio}
            board={state.board ?? defaultBoard()}
            onAgree={(decisione) => {
              const esito = settleBoardMeeting(state, world, decisione);
              onChange(esito.state);
              setDeal({ id: Date.now(), kind: "acquisto", message: esito.message, delta: 0 });
            }}
          />
        )}

        {/* **Mai due sovraimpressioni insieme.** Il meeting non si apre sopra il mercato: erano
            i due pannelli sovrapposti a bloccare la partita quando si assumeva un mister a
            finestra aperta. La condizione sul mercato e una rete di sicurezza — la causa vera e
            corretta in `hireCoach` — perche un blocco totale non deve poter tornare da un altro
            percorso. */}
        {!correndo && !incident && !teatro && !keyMatch && !riepilogo && !bisognaObiettivo && !state.market && bisognaRinnovare && coachAttuale && (
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
            contract={{
              seasonsLeft: coachContractSeasonsLeft(state),
              wage: state.coachContract?.wage ?? 0,
              severance: coachSeveranceNow(state, world),
              wageRoom: finanze.wageRoom,
            }}
            /* A una stagione dalla fine il rinnovo diventa **una delle sue richieste**: senza,
               il messaggio "va rinnovato o lascia la panchina" restava una frase che nessun
               flusso poteva mantenere. */
            requiresRenewal={coachContractSeasonsLeft(state) <= 1}
            /* La sua lettura della rosa: punti deboli, intoccabili, i nomi che fa, e — quando la
               stagione è andata storta — perché e cosa gli servirebbe. È il primo passo del
               tavolo, ed è ciò che rende leggibili le richieste che arrivano dopo. */
            report={analisiMister}
            /* Se il rinnovo era la sua condizione e non si trova l'accordo, lascia davvero: la
               panchina resta vuota e il gate qui sotto costringe a cercarne subito un altro. */
            onResign={
              coachContractSeasonsLeft(state) <= 1
                ? () => {
                    const esito = resignCoach(state);
                    onChange(esito.state);
                    setDeal({ id: Date.now(), kind: "errore", message: esito.message, delta: 0 });
                  }
                : undefined
            }
            onAgree={(_c, promises, cost, renewSeasons) => {
              let next = state;
              if (renewSeasons) {
                const firma = signCoachContract(next, world, state.coachId!, renewSeasons, promises);
                // Se la firma non passa (margine o cassa), il meeting resta aperto e lo dice:
                // chiudere l'accordo lasciando il contratto scaduto sarebbe lo stato incoerente
                // da cui è nata tutta questa fase.
                if (!firma.ok) {
                  setDeal({ id: Date.now(), kind: "errore", message: firma.message, delta: 0 });
                  return;
                }
                next = firma.state;
              }
              onChange(confirmCoachSeasonPromises(next, world, promises, cost));
            }}
            onCancel={() => onChange(declineCoachSeasonMeeting(state, world))}
          />
        )}

        {/* ⚠️ **La panchina vuota si riempie subito.**

            Richiesta dell'utente: *"se si dimette si deve immediatamente cercare un sostituto"*.
            Prima un mister che lasciava (dimissioni, esonero della dirigenza, promesse infrante)
            lasciava la carriera senza guida, e l'unico modo di sostituirlo era aprire il mercato
            e trovare la scheda giusta — cioè si poteva giocare intere giornate senza allenatore.
            Questo gate non ha una via d'uscita perché una squadra senza tecnico non scende in
            campo. */}
        {!correndo && !incident && !teatro && !keyMatch && !riepilogo && !state.market && !state.coachId && (
          <div
            key="sostituto-mister"
            className="fixed inset-0 z-[55] overflow-y-auto bg-[var(--surface)]"
          >
            <CoachPickerScreen
              clubId={state.clubId}
              clubName={world.clubName}
              clubPrestige={world.market?.valuation.clubPrestige[state.clubId] ?? 3}
              budget={state.budget}
              roster={state.roster}
              season={state.season}
              players={world.players}
              onPick={(coachId, promises, totalCost) => ingaggia(coachId, promises, totalCost)}
              onBack={() => {
                /* Non c'è un indietro: senza allenatore la squadra non gioca. */
              }}
            />
          </div>
        )}

        {/**
         * ⚠️ **Una sola schermata di fine stagione** (segnalazione dell utente).
         *
         * Ce n erano due, una condivisibile e una no: erano nate per scopi diversi — la festa
         * e i numeri — ma per chi gioca sono la stessa cosa vista due volte, e la seconda
         * arrivava quando la prima aveva gia detto tutto. Il resoconto e ora uno solo, con la
         * condivisione accanto ai numeri che raccontano il trionfo.
         */}
        {!correndo && !teatro && !keyMatch && riepilogo && (
          <SeasonEndOverlay
            key="fine-stagione"
            state={state}
            summary={riepilogo}
            teamsInLeague={world.opponents.length + 1}
            secondDivision={inSecondDivision(state, world)}
            shareData={{
              clubName: world.clubName,
              season: riepilogo.season,
              leagueName: riepilogo.leagueName ?? world.leagueName ?? "Campionato",
              trophies: riepilogo.trophies ?? { league: false, continental: false, national: false },
              points: riepilogo.points,
              goalsFor: riepilogo.goalsFor,
              goalsAgainst: riepilogo.goalsAgainst,
              position: riepilogo.position,
              topScorer: capocannoniere(riepilogo),
            }}
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
 * ⚠️ **Non decide più niente: legge.** La regola viveva in due posti — qui e in
 * `advanceToNextStop` — con criteri diversi: questa passava anche la posizione dell'avversaria
 * (lo scontro diretto), quella del motore no. Due versioni della stessa regola divergono
 * sempre, e qui divergevano in modo visibile: la UI marcava come chiave una partita a metà
 * coda che il motore non aveva usato come punto d'arresto, la corsa proseguiva, e l'invito
 * arrivava alla fine per una gara di dodici giornate prima — con tutto il resto già a schermo.
 *
 * Ora il motore decide (`WeekReport.keyMatch`) e qui si aggiunge soltanto la chiave React, che
 * è l'unica cosa di cui il motore non ha bisogno.
 */
function partitaChiave(report: WeekReport): PartitaChiave | null {
  const chiave = report.keyMatch;
  if (!chiave) return null;
  const prefisso =
    chiave.competition === "corona" ? "c" : chiave.competition === "tricolore" ? "t" : "l";
  return {
    result: chiave.result,
    opponent: chiave.opponent,
    reason: chiave.reason,
    penalties: chiave.penalties,
    key: `${prefisso}-${report.season}-${report.week}`,
  };
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
  /**
   * ⚠️ **L'anagrafica fusa, non `world.players`.**
   *
   * Segnalazione dell'utente: *"è capitato di non vedere i nomi dei giocatori in campo ma una
   * dicitura generica «giocatore»"*. `world.players` è il pool del database: non contiene i
   * **regen** nati in carriera, quindi un nostro titolare cresciuto in casa non veniva
   * riconosciuto, cadeva fuori dall'undici e — con l'undici incompleto — l'intero contesto
   * saltava, mandando in campo ventidue anonimi. È lo stesso difetto già corretto altrove
   * (`careerPlayers` esiste apposta), ricomparso qui perché questa funzione era stata scritta
   * dopo.
   */
  const anagrafica = careerPlayers(state, world);
  const ourEleven = Object.values(lineup.starters)
    .map((playerId) => {
      const p = anagrafica[playerId];
      return p ? { playerId, department: p.department } : null;
    })
    .filter((p): p is { playerId: string; department: Department } => p !== null);

  /**
   * ⚠️ **L'avversaria può non essere di campionato.**
   *
   * `world.opponents` sono le 19 di lega: in Corona e in Coppa Tricolore la ricerca falliva
   * sempre, `opponentEleven` restava vuoto e il contesto tornava `undefined` — cioè proprio
   * nelle partite che il gioco propone di guardare si finiva con gli undici generici. Si
   * cercano quindi anche fra le iscritte alla Corona e fra i club delle due divisioni.
   */
  const team =
    world.opponents.find((t) => t.name === opponentName) ??
    Object.values(world.cupTeams ?? {}).find((t) => t.name === opponentName) ??
    Object.values(world.divisions?.teams ?? {}).find((t) => t.name === opponentName);
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
      competizione: "corona",
    });
  }
  if (report.nationalCupMatch) {
    nuovi.push({
      key: `n-${report.season}-${report.week}`,
      opponent: report.nationalCupMatch.opponent,
      gf: report.nationalCupMatch.result.goalsFor,
      ga: report.nationalCupMatch.result.goalsAgainst,
      competizione: "tricolore",
      // Nel tabellone un 1-1 non è un pareggio: è il turno passato o l'eliminazione.
      passatoAiRigori: report.nationalCupMatch.wentToPenalties
        ? !!report.nationalCupMatch.weWonPenalties
        : undefined,
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
