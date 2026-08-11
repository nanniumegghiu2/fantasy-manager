/**
 * **Il registro unico degli impegni.**
 *
 * Prima esistevano **tre** canali paralleli per lo stesso concetto "promessa", ognuno con la sua
 * verifica sparsa altrove: `minutesPromises` (a giornata, dentro `career.ts`), `playerPromises`
 * (a fine finestra, dentro `playerStandoff.ts`) e `coachPromises` (a fine finestra, dentro
 * `coachNegotiation.ts`). Aggiungerne una quarta significava scrivere un quarto meccanismo.
 *
 * Qui una promessa nuova è **una riga di catalogo**: dice quando si verifica (`verifyAt`) e cosa
 * la soddisfa. Ci finiscono dentro anche le **clausole contrattuali** — ciò che si firma con uno
 * svincolato o si concorda col mister è una promessa a tutti gli effetti, e non c'era ragione di
 * verificarla con un altro codice.
 */
import type { Department } from "@app/shared-types";
import type { RosterEntry } from "./types";

export type CommitmentKind =
  /* — promesse ai giocatori — */
  | "minuti"
  | "rinforzo"
  | "cessione"
  | "trionfo"
  | "riposo"
  | "capitano"
  | "rinnovo_promesso"
  /* — clausole sottoscritte alla firma — */
  | "clausola_titolarita"
  | "clausola_addio"
  /* — impegni presi col mister — */
  | "coach_rinforzo"
  | "coach_intoccabile";

/** Quando si verifica un impegno. */
export type CommitmentWhen = "matchday" | "window" | "season";

export interface Commitment {
  id: string;
  kind: CommitmentKind;
  /** A chi è stata fatta la promessa (giocatore) — assente per gli impegni col mister. */
  playerId?: string;
  /** Con quale allenatore è stata contratta. */
  coachId?: string;
  verifyAt: CommitmentWhen;
  /** Giornata (per `matchday`) o stagione (per `window`/`season`) entro cui va onorata. */
  deadline: number;
  payload?: {
    department?: Department;
    /** Quante presenze da titolare servono per considerarla mantenuta. */
    minStarts?: number;
    /** Posizione minima in classifica. */
    minPosition?: number;
    /** Il giocatore che va tenuto/ceduto. */
    targetPlayerId?: string;
  };
  madeSeason: number;
  madeWeek: number;
  /** Testo leggibile: la UI lo mostra nel tracker "Impegni presi". */
  description: string;
  /** Progresso parziale, per gli impegni a giornata. */
  progress?: number;
}

export interface CommitmentContext {
  season: number;
  matchday: number;
  roster: readonly RosterEntry[];
  /** Chi è sceso in campo da titolare nell'ultima giornata. */
  startersIds: ReadonlySet<string>;
  /** Reparto di ciascun giocatore, per gli impegni "rinforzo". */
  departmentOf: (playerId: string) => Department | undefined;
  /** Nome leggibile, per i messaggi. */
  nameOf: (playerId: string) => string;
  leaguePosition: number | null;
  leagueSize: number;
  captainId?: string;
  /** Chi non è più in rosa: serve a "cessione" e a scartare gli impegni orfani. */
  soldIds?: ReadonlySet<string>;
}

export interface CommitmentOutcome {
  /** Gli impegni ancora aperti dopo la verifica. */
  open: Commitment[];
  kept: Commitment[];
  broken: Commitment[];
  moraleDelta: Record<string, number>;
  trustDelta: Record<string, number>;
  /** Variazione di sintonia col mister, per gli impegni presi con lui. */
  harmonyDelta: number;
  messages: string[];
}

/** Quanto vale mantenere o infrangere: un impegno tradito costa molto più di quanto renda tenerlo. */
export const KEEP_MORALE = 8;
export const KEEP_TRUST = 12;
export const BREAK_MORALE = -30;
export const BREAK_TRUST = -45;

/**
 * Verifica gli impegni la cui scadenza è arrivata.
 *
 * Chi non è ancora scaduto **resta aperto**: la funzione si può chiamare a ogni giornata, a ogni
 * chiusura di finestra e a fine stagione senza doversi ricordare quali riguardano quel momento.
 */
export function verifyCommitments(
  commitments: readonly Commitment[],
  when: CommitmentWhen,
  ctx: CommitmentContext,
): CommitmentOutcome {
  const open: Commitment[] = [];
  const kept: Commitment[] = [];
  const broken: Commitment[] = [];
  const moraleDelta: Record<string, number> = {};
  const trustDelta: Record<string, number> = {};
  const messages: string[] = [];
  let harmonyDelta = 0;

  for (const impegno of commitments) {
    // Un impegno verso chi non è più in rosa non ha più oggetto: si archivia senza conseguenze.
    if (impegno.playerId && ctx.soldIds?.has(impegno.playerId)) continue;
    if (impegno.playerId && !ctx.roster.some((e) => e.playerId === impegno.playerId)) continue;

    if (impegno.verifyAt !== when) {
      open.push(avanzaProgresso(impegno, ctx));
      continue;
    }

    const scaduto =
      when === "matchday" ? ctx.matchday >= impegno.deadline : ctx.season >= impegno.deadline;

    const esito = valuta(impegno, ctx);

    // Mantenuto in anticipo: si chiude subito, non si aspetta la scadenza per dare la buona notizia.
    if (esito === "mantenuto") {
      kept.push(impegno);
      applica(impegno, KEEP_MORALE, KEEP_TRUST, moraleDelta, trustDelta);
      if (impegno.coachId) harmonyDelta += 4;
      messages.push(`Impegno mantenuto: ${impegno.description}`);
      continue;
    }

    if (!scaduto) {
      open.push(avanzaProgresso(impegno, ctx));
      continue;
    }

    if (esito === "in_sospeso") {
      // Non c'è ancora nulla da giudicare (es. "trionfo" a campionato non iniziato): si rimanda.
      open.push(impegno);
      continue;
    }

    broken.push(impegno);
    applica(impegno, BREAK_MORALE, BREAK_TRUST, moraleDelta, trustDelta);
    if (impegno.coachId) harmonyDelta -= 12;
    messages.push(
      impegno.playerId
        ? `${ctx.nameOf(impegno.playerId)} si sente tradito: ${impegno.description.toLowerCase()}`
        : `Impegno non onorato col mister: ${impegno.description.toLowerCase()}`,
    );
  }

  return { open, kept, broken, moraleDelta, trustDelta, harmonyDelta, messages };
}

type Esito = "mantenuto" | "infranto" | "in_sospeso";

function valuta(impegno: Commitment, ctx: CommitmentContext): Esito {
  switch (impegno.kind) {
    case "minuti":
    case "clausola_titolarita": {
      if (!impegno.playerId) return "infranto";
      const richieste = impegno.payload?.minStarts ?? 1;
      const fatte = (impegno.progress ?? 0) + (ctx.startersIds.has(impegno.playerId) ? 1 : 0);
      return fatte >= richieste ? "mantenuto" : "infranto";
    }

    case "rinforzo":
    case "coach_rinforzo": {
      const reparto = impegno.payload?.department;
      if (!reparto) return "infranto";
      const arrivato = ctx.roster.some(
        (e) =>
          e.playerId !== impegno.playerId &&
          e.sinceSeason === impegno.madeSeason &&
          ctx.departmentOf(e.playerId) === reparto,
      );
      return arrivato ? "mantenuto" : "infranto";
    }

    case "cessione":
    case "clausola_addio": {
      const bersaglio = impegno.payload?.targetPlayerId ?? impegno.playerId;
      if (!bersaglio) return "infranto";
      // Se è ancora in rosa alla scadenza, la promessa di lasciarlo partire è stata disattesa.
      return ctx.roster.some((e) => e.playerId === bersaglio) ? "infranto" : "mantenuto";
    }

    case "coach_intoccabile": {
      const bersaglio = impegno.payload?.targetPlayerId;
      if (!bersaglio) return "infranto";
      return ctx.roster.some((e) => e.playerId === bersaglio) ? "mantenuto" : "infranto";
    }

    case "trionfo": {
      if (ctx.leaguePosition === null) return "in_sospeso";
      const soglia = impegno.payload?.minPosition ?? Math.max(1, Math.ceil(ctx.leagueSize / 2));
      return ctx.leaguePosition <= soglia ? "mantenuto" : "infranto";
    }

    case "capitano":
      return ctx.captainId && ctx.captainId === impegno.playerId ? "mantenuto" : "infranto";

    case "riposo":
      return !impegno.playerId || !ctx.startersIds.has(impegno.playerId) ? "mantenuto" : "infranto";

    case "rinnovo_promesso":
      // Si giudica alla finestra: se il contratto è stato rinnovato, chi l'ha fatto ha già chiuso
      // l'impegno rimuovendolo. Arrivare qui significa che non è successo.
      return "infranto";
  }
}

function avanzaProgresso(impegno: Commitment, ctx: CommitmentContext): Commitment {
  if ((impegno.kind !== "minuti" && impegno.kind !== "clausola_titolarita") || !impegno.playerId) {
    return impegno;
  }
  if (!ctx.startersIds.has(impegno.playerId)) return impegno;
  return { ...impegno, progress: (impegno.progress ?? 0) + 1 };
}

function applica(
  impegno: Commitment,
  morale: number,
  trust: number,
  moraleDelta: Record<string, number>,
  trustDelta: Record<string, number>,
): void {
  if (!impegno.playerId) return;
  moraleDelta[impegno.playerId] = (moraleDelta[impegno.playerId] ?? 0) + morale;
  trustDelta[impegno.playerId] = (trustDelta[impegno.playerId] ?? 0) + trust;
}

/** Costruisce un impegno con un id stabile — nessun `Math.random`, per la riproducibilità. */
export function makeCommitment(
  kind: CommitmentKind,
  opts: Omit<Commitment, "id" | "kind">,
): Commitment {
  const chi = opts.playerId ?? opts.coachId ?? "club";
  return { id: `${kind}-${chi}-${opts.madeSeason}-${opts.madeWeek}`, kind, ...opts };
}

/** Gli impegni aperti verso un giocatore: entrano nei suoi "fatti" (`playerFacts.ts`). */
export function commitmentsFor(
  commitments: readonly Commitment[] | undefined,
  playerId: string,
): Commitment[] {
  return (commitments ?? []).filter((c) => c.playerId === playerId);
}
