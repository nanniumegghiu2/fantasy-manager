/**
 * **Prestiti stagionali**.
 *
 * Chiudono un cerchio che la crescita legata ai minuti apriva da sola: un giovane forte in un
 * club grande **non cresce**, perché non gioca. Mandarlo dove giocherà è la soluzione
 * realistica, ed è anche ciò che dà a un club piccolo accesso a talento che non potrebbe
 * comprare.
 *
 * L'asimmetria fra le due direzioni è ciò che rende la meccanica interessante:
 *  - **in uscita** il giocatore resta di proprietà, e a fine stagione torna con i minuti
 *    giocati e la crescita che ne è derivata: è un investimento;
 *  - **in entrata** costa poco ma non è tuo — a fine anno lo perdi, e la crescita l'hai
 *    regalata a un altro. È un aiuto immediato, non un patrimonio.
 *
 * Senza questa asimmetria i prestiti diventerebbero la scorciatoia universale: si costruirebbe
 * una rosa intera in prestito senza spendere nulla.
 */
import type { LoanState, RosterEntry } from "./types";

/** Età massima per andare in prestito: oltre, non è più un percorso di crescita. */
export const MAX_LOAN_AGE = 23;

/** Quanti prestiti si possono avere aperti, per direzione. */
export const MAX_LOANS_OUT = 4;
export const MAX_LOANS_IN = 2;

/** Costo del prestito in entrata, come frazione del valore del giocatore. */
export const LOAN_FEE_SHARE = 0.08;

export interface LoanCandidate {
  playerId: string;
  age: number;
  overall: number;
  potential: number;
}

export interface LoanCheck {
  ok: boolean;
  reason?: string;
}

/** Si può mandare in prestito questo giocatore? */
export function canLoanOut(
  roster: readonly RosterEntry[],
  candidate: LoanCandidate,
): LoanCheck {
  if (candidate.age > MAX_LOAN_AGE) {
    return { ok: false, reason: `Il prestito è riservato agli under ${MAX_LOAN_AGE + 1}` };
  }
  const entry = roster.find((e) => e.playerId === candidate.playerId);
  if (!entry) return { ok: false, reason: "Non è un tuo giocatore" };
  if (entry.loan) return { ok: false, reason: "È già coinvolto in un prestito" };
  if (entry.injuryMatchdaysLeft > 0) {
    return { ok: false, reason: "Infortunato: nessun club lo vuole in prestito, aspetta il rientro" };
  }
  if (loansOut(roster).length >= MAX_LOANS_OUT) {
    return { ok: false, reason: `Massimo ${MAX_LOANS_OUT} prestiti in uscita` };
  }
  return { ok: true };
}

/** Si può accettare un giocatore in prestito? */
export function canLoanIn(roster: readonly RosterEntry[]): LoanCheck {
  if (loansIn(roster).length >= MAX_LOANS_IN) {
    return { ok: false, reason: `Massimo ${MAX_LOANS_IN} prestiti in entrata` };
  }
  return { ok: true };
}

export function loansOut(roster: readonly RosterEntry[]): RosterEntry[] {
  return roster.filter((e) => e.loan?.hostClubId);
}

export function loansIn(roster: readonly RosterEntry[]): RosterEntry[] {
  return roster.filter((e) => e.loan?.ownerClubId);
}

/**
 * Quanti minuti giocherà un prestito al club che lo ospita.
 *
 * **Semplificazione dichiarata**: i campionati diversi dal proprio girano in modalità "solo
 * risultato", quindi non esistono minuti individuali da leggere. Si stimano confrontando
 * l'Overall del giocatore con l'undici del club ospitante — se là sarebbe titolare gioca
 * quasi sempre, se sarebbe il dodicesimo gioca a spezzoni. È una stima onesta e costa nulla;
 * l'alternativa sarebbe simulare 96 rose nel dettaglio per un effetto che l'utente vede solo
 * come un numero a fine anno.
 */
export function estimateLoanMinutes(
  playerOverall: number,
  hostStartingElevenOveralls: number[],
  totalRounds: number,
): number {
  if (hostStartingElevenOveralls.length === 0) return totalRounds * 45;
  const sorted = [...hostStartingElevenOveralls].sort((a, b) => b - a);
  const weakestStarter = sorted[sorted.length - 1] ?? 0;
  const gap = playerOverall - weakestStarter;

  // Titolare pieno se è meglio del peggiore dei titolari; a scalare fino a poche apparizioni.
  const share = clamp(0.5 + gap * 0.08, 0.1, 0.95);
  return Math.round(totalRounds * 90 * share);
}

/** Un club è un buon approdo per un prestito? Serve a proporre destinazioni sensate. */
export function isGoodLoanDestination(
  playerOverall: number,
  hostStartingElevenOveralls: number[],
): boolean {
  if (hostStartingElevenOveralls.length === 0) return true;
  const weakest = Math.min(...hostStartingElevenOveralls);
  // Deve giocare: se non scalzerebbe nemmeno il peggiore dei titolari, il prestito è inutile.
  return playerOverall >= weakest - 1;
}

export interface LoanProposal {
  playerId: string;
  clubId: string;
  /** Direzione dal punto di vista dell'utente. */
  direction: "uscita" | "entrata";
  fee: number;
  /** Minuti stimati che il giocatore accumulerà. */
  expectedMinutes: number;
}

/** Apre un prestito, marcando la voce di rosa. */
export function openLoan(
  entry: RosterEntry,
  proposal: LoanProposal,
  currentSeason: number,
): RosterEntry {
  // `untilSeason` è la stagione **corrente**: il prestito è stagionale, quindi scade alla fine
  // di questo campionato anche se è stato aperto a gennaio.
  const loan: LoanState =
    proposal.direction === "uscita"
      ? {
          hostClubId: proposal.clubId,
          untilSeason: currentSeason,
          expectedMinutes: proposal.expectedMinutes,
        }
      : {
          ownerClubId: proposal.clubId,
          untilSeason: currentSeason,
          expectedMinutes: proposal.expectedMinutes,
        };
  return { ...entry, loan };
}

export interface LoanSettlement {
  /** Giocatori che rientrano alla base e restano in rosa. */
  returning: RosterEntry[];
  /** Giocatori presi in prestito che se ne vanno: non erano nostri. */
  leaving: RosterEntry[];
  /** Il resto della rosa, invariato. */
  remaining: RosterEntry[];
}

/**
 * Chiude i prestiti scaduti a fine stagione.
 *
 * I nostri rientrano (con i minuti accumulati, che il ciclo di vita userà per farli crescere),
 * quelli altrui se ne vanno. È qui che si paga il prezzo del prestito in entrata: la crescita
 * di quel ragazzo se la porta via il suo club.
 */
export function settleLoans(
  roster: readonly RosterEntry[],
  currentSeason: number,
): LoanSettlement {
  const returning: RosterEntry[] = [];
  const leaving: RosterEntry[] = [];
  const remaining: RosterEntry[] = [];

  for (const entry of roster) {
    if (!entry.loan || entry.loan.untilSeason > currentSeason) {
      remaining.push(entry);
      continue;
    }
    if (entry.loan.ownerClubId) {
      leaving.push(entry);
      continue;
    }
    // Rientra con i minuti giocati altrove: è **questa** riga a far crescere il prestito, perché
    // il ciclo di vita legge `stats.minutes` per decidere quanto del margine di età è meritato.
    const minutes = entry.loan.expectedMinutes ?? 0;
    returning.push({
      ...entry,
      loan: undefined,
      stats: {
        ...entry.stats,
        minutes: entry.stats.minutes + minutes,
        appearances: entry.stats.appearances + Math.round(minutes / 90),
      },
    });
  }

  return { returning, leaving, remaining };
}

/** Costo di un prestito in entrata: una frazione del valore, non il cartellino. */
export function loanFee(playerValue: number): number {
  return Math.max(50_000, Math.round((playerValue * LOAN_FEE_SHARE) / 50_000) * 50_000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
