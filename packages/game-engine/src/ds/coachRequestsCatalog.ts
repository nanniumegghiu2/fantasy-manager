/**
 * Catalogo ed Algoritmo di Selezione delle Richieste dell'Allenatore (DS Mode).
 *
 * Analizza il profilo dell'allenatore e lo stato attuale della rosa per generare
 * tra 2 e 3 richieste di mercato dinamiche con priorità umane ed opzioni di compromesso.
 */
import type { Role } from "@app/shared-types";
import { getFormation } from "../formations";
import { ROLE_NOME } from "./coachRequests";
import type { Coach, CoachPromise, CoachPromiseKind, RosterEntry } from "./types";

export interface SquadAnalysis {
  squadSize: number;
  avgAge: number;
  topPlayerOverall: number;
  under22Count: number;
  over30Count: number;
  domesticCount: number;
  hasSecondKeeper: boolean;
  missingRolesCount: number;
}

/** Un candidato reale di mercato, così la richiesta di uno specialista può nominarlo. */
export interface RoleCandidate {
  playerId: string;
  playerName: string;
  overall: number;
  role: Role;
  /** Ruoli secondari: un ruolo coperto solo da qui conta comunque come "coperto". */
  secondaryRoles?: Role[];
}

/** Genera id univoco breve per ogni promessa, dal random passato (riproducibile). */
function promiseId(kind: CoachPromiseKind, index: number, random: () => number): string {
  return `prom-${kind}-${index}-${Math.floor(random() * 46656).toString(36)}`;
}

/**
 * Mescola un array con Fisher-Yates, usando il random passato. Non muta l'originale.
 */
function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Seleziona 2 o 3 richieste vincolanti dal catalogo a 10 tipi basandosi su:
 * - Le caratteristiche della rosa (dimensione, età media, buchi in organico).
 * - La filosofia e reputazione dell'allenatore.
 * - Priorità e reazioni umane (imprescindibile, negoziabile, flessibile).
 *
 * `random` va **seedato dal chiamante** (`derivedRandom(seed, "coachPromise", season,
 * coach.id)`, stesso pattern usato ovunque nel motore): prima usava `Math.random()` per l'id
 * e poi lo trattava come se fosse deterministico nell'ordinamento — violava la promessa di
 * riproducibilità del salvataggio (CLAUDE.md §3.7.13). Il default a `Math.random` resta solo
 * per compatibilità con chi non passa un seme (es. anteprime non salvate).
 */
export function generateCoachPromises(
  coach: Coach,
  squad: RosterEntry[],
  analysis: SquadAnalysis,
  season: number,
  playerNames?: Record<string, { name: string; role: Role }>,
  random: () => number = Math.random,
  /** Candidati reali di mercato per il ruolo scoperto (sez. "specialisti nominati"). */
  roleCandidates?: RoleCandidate[],
  /**
   * Le caselle davvero deboli, in ordine di gravità (`coachReport.ts`).
   *
   * È ciò che impedisce al mister di chiedere ogni anno lo stesso ruolo: senza, il bersaglio si
   * prendeva dal primo elemento di una lista fissa e la rosa non contava nulla.
   */
  weakRoles?: Role[],
): CoachPromise[] {
  const candidates: CoachPromise[] = [];
  const repMultiplier = coach.reputation >= 4 ? 1.8 : 1.0;

  // Trova il miglior giocatore in rosa ed il suo nome per l'incedibilità
  let topPlayerEntry: RosterEntry | undefined;
  if (squad.length > 0) {
    topPlayerEntry = [...squad].sort((a, b) => b.overall - a.overall)[0];
  }

  // 1. TOP PLAYER (per mister di livello 4/5 o grandi club)
  if (coach.reputation >= 4 || analysis.topPlayerOverall >= 82) {
    const requiredOverall = Math.max(78, Math.min(88, analysis.topPlayerOverall + 1));
    candidates.push({
      id: promiseId("top_player", 1, random),
      kind: "top_player",
      targetValue: requiredOverall,
      description: "Un giocatore che sposti gli equilibri: uno che le partite le decide da solo",
      seasonAccepted: season,
      fulfilled: false,
      priority: "imprescindibile",
      salaryBonusDemanded: Math.round(2000000 * repMultiplier),
    });
  }

  // 2. SPECIALISTI DI RUOLO SPECIFICO PER IL MODULO (Analisi lacune reali di rosa)
  //
  // Il ruolo chiesto dev'essere una casella che il modulo di QUESTO allenatore schiera
  // davvero: un 3-5-2 gioca coi quinti (QD/QS), non con gli esterni di centrocampo puro
  // (ED/ES) — chiederne uno che il modulo non prevede è una richiesta che l'utente non può
  // prendere sul serio. Derivato dallo schema reale (`formations.ts`), non da una mappa a
  // mano formationId→ruolo che si disallinea ogni volta che uno schema cambia composizione.
  const formation = getFormation(coach.formationId);
  const roliInFormazione = new Set(formation?.slots.map((s) => s.role) ?? []);
  // Il ruolo scelto deve avere **almeno un candidato reale** (principale o secondario) nel
  // pool passato — altrimenti si chiede un ruolo che letteralmente nessuno in database sa
  // coprire (es. QD, rarissimo come ruolo naturale). Senza candidati passati (es. ingaggio
  // iniziale, prima che il mercato sia noto) si ripiega sul vecchio comportamento cieco,
  // meglio di bloccare la richiesta del tutto.
  const roliConCopertura = new Set(
    (roleCandidates ?? []).flatMap((c) => [c.role, ...(c.secondaryRoles ?? [])]),
  );

  /**
   * ⚠️ **Il ruolo richiesto esce dall'analisi della rosa, non da una lista fissa.**
   *
   * Segnalazione dell'utente, ripetuta: *"richieste continue nello stesso ruolo ad ogni stagione
   * nonostante sia già ampiamente coperto"*. La causa era una `priorita` scritta a mano
   * (`["ED","ES","QD",…]`) da cui si prendeva **il primo ruolo che il modulo schierasse**: la
   * rosa non veniva consultata affatto, quindi con un 4-4-2 usciva "esterno destro" ogni singola
   * stagione, per dieci anni, anche dopo averne comprati tre.
   *
   * ⚠️ Ed è un difetto **distinto** da quello già corretto in `coachRequests.ts`: sono due
   * generatori di richieste diversi, e sistemare il primo aveva lasciato intatto questo — la
   * ragione per cui l'utente ha visto il bug sopravvivere alla correzione precedente.
   *
   * `weakRoles` arriva dal report del mister (`coachReport.ts`), che le caselle le misura per
   * copertura esclusiva e qualità. Il ripiego sulla lista fissa resta solo per i chiamanti che
   * il report non ce l'hanno (l'ingaggio di un tecnico nuovo, dove la rosa non è ancora sua).
   */
  const prioritaDiRipiego: Role[] = ["ED", "ES", "QD", "QS", "TQD", "TQS", "CC", "MED", "DC"];
  const daAnalisi = (weakRoles ?? []).filter(
    (r) => roliInFormazione.has(r) && (roliConCopertura.size === 0 || roliConCopertura.has(r)),
  );
  const targetRole: Role =
    daAnalisi[0] ??
    (weakRoles ?? []).find((r) => roliInFormazione.has(r)) ??
    prioritaDiRipiego.find(
      (r) => roliInFormazione.has(r) && (roliConCopertura.size === 0 || roliConCopertura.has(r)),
    ) ??
    prioritaDiRipiego.find((r) => roliInFormazione.has(r)) ??
    "CC";

  const reqRoleOverall = Math.max(78, Math.min(85, analysis.topPlayerOverall - 1));

  // Se il mercato offre un candidato reale per quel ruolo, la richiesta lo nomina — non più
  // solo "un ruolo X da almeno Y", ma "quel giocatore lì". Accetta anche chi lo copre da
  // secondario: la verifica di soddisfacimento (`promiseSatisfiedNow`) fa lo stesso, quindi
  // la ricerca del nominato dev'essere coerente con cosa viene poi accettato davvero. Fra i
  // candidati adatti si sceglie col random passato, non sempre il migliore: altrimenti la
  // stessa richiesta nominerebbe sempre lo stesso nome ogni volta che il mercato propone la
  // stessa rosa di candidati.
  const adattiPerRuolo = (roleCandidates ?? []).filter(
    (c) => (c.role === targetRole || (c.secondaryRoles ?? []).includes(targetRole)) && c.overall >= reqRoleOverall,
  );
  const nominato =
    adattiPerRuolo.length > 0
      ? shuffle(adattiPerRuolo, random)[0]
      : undefined;

  candidates.push({
    id: promiseId("formation_fit", 2, random),
    kind: "formation_fit",
    targetRole,
    targetValue: reqRoleOverall,
    targetPlayerId: nominato?.playerId,
    targetPlayerName: nominato?.playerName,
    description: nominato
      ? `${nominato.playerName}: è il ${ROLE_NOME[targetRole]} che serve al ${coach.formationId}`
      : `Un ${ROLE_NOME[targetRole]} all'altezza, per non coprire quella casella con un adattato`,
    seasonAccepted: season,
    fulfilled: false,
    priority: "imprescindibile",
    salaryBonusDemanded: Math.round(1500000 * repMultiplier),
  });

  // 2b. UN GIOCATORE FUORI SISTEMA (speculare all'incedibilità del punto 6): il mister vuole
  // ceduto un giocatore specifico che il suo modulo non usa affatto — nessun ruolo, principale
  // o secondario, fra quelli schierati. Non è "sfoltire la rosa" (quello non nomina nessuno):
  // è "quello lì non rientra nel mio sistema", ed è per questo che nomina un giocatore preciso.
  const fuoriSistema = squad.find((e) => {
    const info = playerNames?.[e.playerId];
    return info && !roliInFormazione.has(info.role) && e.playerId !== topPlayerEntry?.playerId;
  });
  if (fuoriSistema) {
    const nome = playerNames?.[fuoriSistema.playerId]?.name ?? "Un giocatore";
    candidates.push({
      id: promiseId("sell_misfit", 10, random),
      kind: "sell_misfit",
      targetPlayerId: fuoriSistema.playerId,
      targetPlayerName: nome,
      description: `Cessione di ${nome}: nel ${coach.formationId} non ha una casella, e allenare chi non entra mai nello schema è tempo perso`,
      seasonAccepted: season,
      fulfilled: false,
      priority: "negoziabile",
      salaryBonusDemanded: Math.round(600000 * repMultiplier),
    });
  }

  // 3. PROGETTO GIOVANI (se l'allenatore ha alto sviluppo giovani)
  if (coach.development >= 1.4 || analysis.under22Count < 3) {
    candidates.push({
      id: promiseId("youth_prospect", 3, random),
      kind: "youth_prospect",
      targetValue: 1,
      description: "Un ragazzo su cui lavorare: non dev'essere pronto, deve avere qualcosa dentro",
      seasonAccepted: season,
      fulfilled: false,
      priority: "negoziabile",
      salaryBonusDemanded: Math.round(800000 * repMultiplier),
    });
  }

  // 4. LEADER ESPERTO (se l'età media è bassa o mancano senatori)
  if (analysis.avgAge < 25 || analysis.over30Count < 2) {
    candidates.push({
      id: promiseId("veteran_leadership", 4, random),
      kind: "veteran_leadership",
      targetValue: 30,
      description: "Un veterano che nello spogliatoio abbia già visto tutto, anche se non gioca ogni domenica",
      seasonAccepted: season,
      fulfilled: false,
      priority: "negoziabile",
      salaryBonusDemanded: Math.round(750000 * repMultiplier),
    });
  }

  // 5. SFOLTIMENTO ROSA (se la rosa è gonfia)
  if (analysis.squadSize > 24) {
    candidates.push({
      id: promiseId("trim_squad", 5, random),
      kind: "trim_squad",
      targetValue: 23,
      description: "Sfoltire la rosa: non riesco a dare campo a tutti, e chi non gioca non mi parla più",
      seasonAccepted: season,
      fulfilled: false,
      priority: "flessibile",
      salaryBonusDemanded: Math.round(500000 * repMultiplier),
    });
  }

  // 6. INCEDIBILITÀ PILASTRO (con NOME ESPLICITO DEL GIOCATORE STELIA)
  if (topPlayerEntry) {
    const topName = playerNames?.[topPlayerEntry.playerId]?.name ?? "Stella della Squadra";
    candidates.push({
      id: promiseId("key_player_retention", 6, random),
      kind: "key_player_retention",
      targetPlayerId: topPlayerEntry.playerId,
      targetPlayerName: topName,
      description: `${topName} non si tocca: senza di lui devo rifare tutto`,
      seasonAccepted: season,
      fulfilled: false,
      priority: "imprescindibile",
      salaryBonusDemanded: Math.round(2200000 * repMultiplier),
    });
  }

  // 7. COPERTURA REPARTO / SECONDO PORTIERE
  if (!analysis.hasSecondKeeper || analysis.missingRolesCount > 0) {
    candidates.push({
      id: promiseId("depth_backup", 7, random),
      kind: "depth_backup",
      description: "Coprire i buchi in organico: un secondo portiere, e ricambi veri dietro",
      seasonAccepted: season,
      fulfilled: false,
      priority: "flessibile",
      salaryBonusDemanded: Math.round(400000 * repMultiplier),
    });
  }

  // 8. BLOCCO NAZIONALE
  if (analysis.domesticCount < 4) {
    candidates.push({
      id: promiseId("domestic_core", 8, random),
      kind: "domestic_core",
      targetValue: 4,
      description: "Tenere un blocco di giocatori del posto: è quello che regge lo spogliatoio",
      seasonAccepted: season,
      fulfilled: false,
      priority: "flessibile",
      salaryBonusDemanded: Math.round(500000 * repMultiplier),
    });
  }

  // 9. DISCIPLINA DI BUDGET (niente contratti giocatori: qui non esistono — il mister chiede
  // solo di non spendere tutto il budget in un colpo solo, per arrivare con margine alla
  // finestra di riparazione o a un imprevisto).
  candidates.push({
    id: promiseId("budget_discipline", 9, random),
    kind: "budget_discipline",
    description: "Non spendere tutto il budget in un colpo solo: un margine per la finestra di riparazione",
    seasonAccepted: season,
    fulfilled: false,
    priority: "negoziabile",
    salaryBonusDemanded: Math.round(900000 * repMultiplier),
  });

  /**
   * Separazione priorità per garantire la presenza di una richiesta principale
   * (imprescindibile), ma **mescolata** — prima si prendevano sempre i primi due candidati
   * nell'ordine fisso in cui il catalogo li genera (`formation_fit`+`key_player_retention` a
   * ripetizione per una rosa stabile), la monotonia segnalata dall'utente. Il random passato è
   * lo stesso in tutta la funzione, quindi la selezione è varia ma riproducibile dal seme.
   */
  const impList = shuffle(
    candidates.filter((c) => c.priority === "imprescindibile"),
    random,
  );
  const secondary = shuffle(
    candidates.filter((c) => c.priority !== "imprescindibile"),
    random,
  );

  const selected = [...impList.slice(0, 2), ...secondary];
  // 2 o 3 in totale, deciso dal random invece che dalla sola parità di stagione (che dava
  // sempre lo stesso conteggio a stagioni alterne, indipendentemente da coach/rosa).
  const totale = random() < 0.5 ? 2 : 3;
  return selected.slice(0, Math.min(3, totale));
}
