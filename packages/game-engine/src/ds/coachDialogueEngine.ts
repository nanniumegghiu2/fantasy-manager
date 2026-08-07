/**
 * Motore di Dialogo Procedurale per la Chat di Trattativa con l'Allenatore (DS Mode).
 *
 * Genera battute di dialogo dinamiche e personalizzate in base a:
 * - Filosofia tattica e personalità dell'allenatore.
 * - Nazionalità e reputazione.
 * - Le promesse richieste al Direttore Sportivo.
 */
import type { Coach, CoachPromise } from "./types";

export interface CoachMessage {
  id: string;
  sender: "coach" | "user";
  text: string;
  timestamp: string;
  promises?: CoachPromise[];
}

/** Genera la battuta iniziale di benvenuto del mister in chat. */
export function getCoachGreeting(coach: Coach, clubName: string): string {
  const philosophy = coach.tacticalPhilosophy ?? `modulo ${coach.formationId}`;

  if (coach.reputation >= 5) {
    return `Buonasera Direttore, sono ${coach.name}. La piazza di ${clubName} ha grande storia, ma se volete portare a casa trofei dobbiamo lavorare secondo le mie idee: ${philosophy}. Prima di firmare il contratto voglio garanzie chiare sul mercato.`;
  }
  if (coach.development >= 1.5) {
    return `Salve Direttore, sono ${coach.name}! Il progetto di ${clubName} mi affascina. Credo nel valore dei giovani e nel mio ${coach.formationId}. Però per accettare devo assicurarmi che la società mi segua su alcuni punti chiave.`;
  }
  return `Buongiorno Direttore, sono ${coach.name}. Sono pronto a sposare il progetto di ${clubName} con il mio ${philosophy}. Ma per mettere la firma voglio essere sicuro che avremo gli uomini giusti per fare bene.`;
}

/** Genera la spiegazione dettagliata delle promesse pretese dal mister. */
export function getCoachDemandsText(coach: Coach, promises: CoachPromise[]): string {
  const intro = `Io, ${coach.name}, pongo le seguenti condizioni imprescindibili a contratto:`;
  const items = promises.map((p) => `• ${p.description}`).join("\n");
  const outro = "Se mi garantite questi impegni scritto a contratto, sono pronto a firmare subito.";

  return `${intro}\n\n${items}\n\n${outro}`;
}

/** Genera la risposta del mister in caso di accettazione delle promesse e firma. */
export function getCoachAcceptanceQuote(coach: Coach): string {
  if (coach.reputation >= 5) {
    return `Ottimo lavoro Direttore! Da oggi ${coach.name} è ufficialmente il vostro mister. Mettiamoci subito al lavoro sul campo!`;
  }
  return `Accordo trovato! ${coach.name} ha firmato. Manteniamo le promesse fatte e faremo una stagione straordinaria.`;
}

/** Genera la risposta del mister in caso di rottura della trattativa. */
export function getCoachRejectionQuote(coach: Coach): string {
  return `Mi dispiace Direttore, ma ${coach.name} non accetta un contratto senza queste garanzie. Auguro il meglio al club.`;
}
