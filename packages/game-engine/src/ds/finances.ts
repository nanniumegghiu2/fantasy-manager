/**
 * **Le finanze: un'unica cassa, due destinazioni, e a decidere è il DS.**
 *
 * Prima `budget.ts` produceva un solo numero — il budget di mercato — e gli ingaggi non
 * esistevano. Con i contratti gli stipendi diventano inevitabili (un rinnovo senza cifra è un
 * pulsante, non una decisione), e allora quel numero diventa il **fatturato stagionale**, che il
 * direttore sportivo ripartisce fra:
 *
 *  - **cassa mercato** — cartellini, premi alla firma, buonuscite;
 *  - **cassa ingaggi** — stipendi dei giocatori **e dell'allenatore**, adeguamenti, rinnovi.
 *
 * ## Perché la ripartizione è una scelta di prodotto, non un dettaglio contabile
 *
 * Risolve da sola il rischio principale del sistema contratti: che i parametri zero svuotino di
 * senso il budget, che è oggi l'unica leva della difficoltà (`budget.ts`, CLAUDE.md § 3.7.11).
 * Con la ripartizione un parametro zero **non è gratis** — non costa cartellino ma consuma cassa
 * ingaggi, e quella cassa l'hai riempita togliendo soldi al mercato. Il compromesso diventa
 * esplicito, visibile e **dell'utente**, invece di essere una costante nascosta da tarare.
 *
 * Ne nascono due stili entrambi legittimi, che è ciò che rende una scelta interessante:
 *  - **compratore** (mercato alto): prende cartellini, ma non regge i rinnovi e perde i big a zero;
 *  - **contrattista** (ingaggi alti): blinda tutti e vince le aste dei parametri zero, ma a
 *    gennaio non ha liquidità per il colpo che serve.
 *
 * Il test di prodotto corrispondente sta in `dsFinances.test.ts`: **nessuna delle due posizioni
 * dev'essere dominante**. Uno slider con un ottimo unico non è una scelta, è un tutorial.
 */

/** Quota di fatturato destinata agli ingaggi se il DS non tocca nulla. */
export const DEFAULT_WAGE_SHARE = 0.45;

/** Estremi della ripartizione: nemmeno agli estremi si può azzerare una delle due casse. */
export const MIN_WAGE_SHARE = 0.2;
export const MAX_WAGE_SHARE = 0.75;

/**
 * Di quanto si può spostare la ripartizione nella finestra invernale.
 *
 * Rifare il bilancio a metà anno non è realistico; un aggiustamento per un'emergenza sì.
 */
export const WINTER_SHIFT_LIMIT = 0.25;

export interface FinancesState {
  /** Quota del fatturato destinata agli ingaggi, decisa dal DS. */
  wageShare: number;
  /** Ripartizione dell'estate: a gennaio ci si può discostare al più di `WINTER_SHIFT_LIMIT`. */
  summerShare?: number;
  /** Sforamento della stagione scorsa, da scontare su questa. */
  overrun?: number;
}

export interface FinancesView {
  /** Fatturato della stagione (da `budget.ts`). */
  revenue: number;
  wageShare: number;
  /** Tetto della cassa ingaggi, in €/anno. */
  wageBudget: number;
  /** Somma degli ingaggi già firmati (giocatori + allenatore). */
  committedWages: number;
  /** Quanto resta per rinnovi e nuove firme. Negativo = si sta sforando. */
  wageRoom: number;
  /** Dotazione iniziale della cassa mercato (non la liquidità residua). */
  transferBudget: number;
  /** Sotto quale quota non si può scendere senza definanziare contratti già firmati. */
  minShareForCommitments: number;
  /** Si sta sforando il tetto? La differenza si sconta dal fatturato dell'anno prossimo. */
  overrunNow: number;
}

export function defaultFinances(): FinancesState {
  return { wageShare: DEFAULT_WAGE_SHARE, summerShare: DEFAULT_WAGE_SHARE };
}

/** La fotografia delle finanze adesso. */
export function financesView(
  revenue: number,
  finances: FinancesState | undefined,
  committedWages: number,
): FinancesView {
  const share = clampShare(finances?.wageShare ?? DEFAULT_WAGE_SHARE);
  const wageBudget = Math.round(revenue * share);
  return {
    revenue,
    wageShare: share,
    wageBudget,
    committedWages,
    wageRoom: wageBudget - committedWages,
    transferBudget: revenue - wageBudget,
    minShareForCommitments: revenue > 0 ? Math.min(MAX_WAGE_SHARE, committedWages / revenue) : MIN_WAGE_SHARE,
    overrunNow: Math.max(0, committedWages - wageBudget),
  };
}

function clampShare(share: number): number {
  return Math.max(MIN_WAGE_SHARE, Math.min(MAX_WAGE_SHARE, share));
}

export interface ShiftRequest {
  revenue: number;
  finances: FinancesState;
  /** Liquidità di mercato **residua** (quella che il gioco chiama `state.budget`). */
  transferCash: number;
  committedWages: number;
  /** La nuova quota richiesta dallo slider. */
  newShare: number;
  /** Nella finestra invernale lo spostamento è limitato rispetto alla ripartizione estiva. */
  winter?: boolean;
}

export interface ShiftResult {
  ok: boolean;
  /** Motivo del rifiuto, da mostrare **sullo slider**, non in un errore dopo il rilascio. */
  reason?: string;
  finances: FinancesState;
  /** La nuova liquidità di mercato: spostare sugli ingaggi la riduce, e viceversa. */
  transferCash: number;
  view: FinancesView;
}

/**
 * Sposta la ripartizione.
 *
 * Tre argini, tutti pensati perché lo strumento sia usabile e non frustrante:
 *  1. **pavimento invalicabile** agli impegni già firmati — non si definanziano contratti in essere;
 *  2. la liquidità di mercato non può andare sotto zero: se hai già speso, non puoi spostare
 *     indietro soldi che non ci sono più;
 *  3. a gennaio lo scostamento dalla ripartizione estiva è limitato.
 *
 * Il tetto della cassa ingaggi, invece, **non è un divieto**: si può firmare oltre, e la
 * differenza si sconta dal fatturato dell'anno dopo (`overrun`). È la scommessa consapevole che
 * lo slider vuole dare al DS — stessa filosofia con cui CLAUDE.md § 3.7.5 ha tolto i vincoli
 * sulla dimensione della rosa.
 */
export function shiftWageShare(req: ShiftRequest): ShiftResult {
  const attuale = clampShare(req.finances.wageShare);
  const richiesta = clampShare(req.newShare);
  const estiva = req.finances.summerShare ?? attuale;

  const fallisci = (reason: string): ShiftResult => ({
    ok: false,
    reason,
    finances: req.finances,
    transferCash: req.transferCash,
    view: financesView(req.revenue, req.finances, req.committedWages),
  });

  if (req.winter && Math.abs(richiesta - estiva) > WINTER_SHIFT_LIMIT + 1e-9) {
    return fallisci(
      `A stagione in corso puoi spostare al massimo ${Math.round(WINTER_SHIFT_LIMIT * 100)} punti rispetto al bilancio estivo.`,
    );
  }

  const nuovoTetto = Math.round(req.revenue * richiesta);
  if (nuovoTetto < req.committedWages) {
    return fallisci(
      `Non puoi scendere sotto gli impegni già firmati (${formatMln(req.committedWages)}/anno).`,
    );
  }

  const vecchioTetto = Math.round(req.revenue * attuale);
  // Spostare verso gli ingaggi toglie liquidità al mercato, e viceversa.
  const nuovaLiquidita = req.transferCash - (nuovoTetto - vecchioTetto);
  if (nuovaLiquidita < 0) {
    return fallisci("Hai già speso quella parte del fatturato: non c'è liquidità da spostare.");
  }

  const finances: FinancesState = {
    ...req.finances,
    wageShare: richiesta,
    summerShare: req.winter ? estiva : richiesta,
  };

  return {
    ok: true,
    finances,
    transferCash: nuovaLiquidita,
    view: financesView(req.revenue, finances, req.committedWages),
  };
}

/**
 * Lo sforamento da scontare dal fatturato della stagione successiva.
 *
 * Si applica **una volta sola**, all'apertura della nuova stagione: firmare oltre il tetto è una
 * scommessa, non un debito perpetuo.
 */
export function overrunPenalty(view: FinancesView): number {
  return view.overrunNow;
}

function formatMln(value: number): string {
  return `€ ${(value / 1_000_000).toFixed(1).replace(".0", "")}M`;
}
