/**
 * **La fascia di capitano.**
 *
 * Prima `captainId` era un campo che una mossa della chat scriveva: nessuno la desiderava,
 * nessuno se la vedeva togliere, e il club poteva restare senza capitano per dieci stagioni.
 *
 * Qui la fascia ha tre proprietà che la rendono una cosa vera:
 *
 * 1. **La sceglie il mister**, non il direttore sportivo. Il DS può *discuterla* — ed è una
 *    conversazione col mister, con il suo prezzo in sintonia se lo si forza.
 * 2. **La vogliono in due categorie precise**: le **bandiere** (chi è al club da anni) e i
 *    **leader tecnici** (chi è nettamente più forte del resto della rosa e vuole prendersi il
 *    gruppo). Non un desiderio generico: un buon gregario appena arrivato non la chiede, e questo
 *    è ciò che impedisce alla meccanica di diventare rumore.
 * 3. **Toglierla ha un costo**, e darla a chi non se l'aspetta ne ha un altro: chi la perde apre
 *    un faccia a faccia che può finire in rottura totale.
 */
import type { PlayerPersonality, RosterEntry } from "./types";

/** Sopra questo punteggio un giocatore **vuole** la fascia, e se non l'ha se ne lamenta. */
export const CAPTAIN_DESIRE_THRESHOLD = 55;

/** Anni al club oltre i quali si è una bandiera. */
export const BANDIERA_SEASONS = 4;

/** Quanto bisogna essere più forti della media della rosa per sentirsi il leader tecnico. */
export const LEADER_OVERALL_GAP = 5;

export interface CaptaincyInput {
  entry: RosterEntry;
  age: number;
  seasonsAtClub: number;
  squadAverage: number;
  /** Quota di minuti giocati: un capitano che non gioca non è credibile, e lo sa anche lui. */
  playedShare: number;
  personality: PlayerPersonality;
}

export interface CaptaincyClaim {
  playerId: string;
  /** 0-100: quanto la vuole e quanto se la merita agli occhi dello spogliatoio. */
  score: number;
  /** Perché: la UI li mostra, e servono a rendere comprensibile la scelta del mister. */
  reasons: string[];
  isBandiera: boolean;
  isLeaderTecnico: boolean;
}

/**
 * Quanto un giocatore aspira alla fascia.
 *
 * Le due strade sono deliberatamente diverse: la **bandiera** la vuole per anzianità e
 * appartenenza, il **leader tecnico** perché è il più forte e vuole il gruppo. Chi non è né l'una
 * né l'altro cosa non la chiede — la soglia esiste proprio per questo.
 */
export function captaincyClaimOf(input: CaptaincyInput): CaptaincyClaim {
  const { entry, age, seasonsAtClub, squadAverage, playedShare, personality } = input;
  const reasons: string[] = [];
  let score = 0;

  const isBandiera = seasonsAtClub >= BANDIERA_SEASONS;
  if (isBandiera) {
    score += 30 + Math.min(15, (seasonsAtClub - BANDIERA_SEASONS) * 4);
    reasons.push(`${seasonsAtClub} anni al club`);
  } else if (seasonsAtClub >= 2) {
    score += 10;
  }

  const scarto = entry.overall - squadAverage;
  const isLeaderTecnico = scarto >= LEADER_OVERALL_GAP;
  if (isLeaderTecnico) {
    score += 25 + Math.min(15, (scarto - LEADER_OVERALL_GAP) * 3);
    reasons.push("è nettamente il più forte della rosa");
  }

  // L'età dà autorevolezza, ma da sola non basta a farla desiderare.
  if (age >= 30) {
    score += 12;
    reasons.push("è uno dei senatori");
  } else if (age >= 27) {
    score += 6;
  } else if (age <= 22) {
    score -= 12;
  }

  // Un capitano deve giocare: chi sta in panchina non la rivendica, e non la otterrebbe.
  if (playedShare >= 0.7) {
    score += 12;
    reasons.push("gioca sempre");
  } else if (playedShare < 0.35) {
    score -= 20;
  }

  const perCarattere: Record<PlayerPersonality, number> = {
    leader: 22,
    professionista: 6,
    insofferente: 2,
    giovane_ambizioso: -4,
    mercenario: -12,
  };
  score += perCarattere[personality];
  if (personality === "leader") reasons.push("ha il carisma da spogliatoio");

  return {
    playerId: entry.playerId,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    isBandiera,
    isLeaderTecnico,
  };
}

/** Le candidature alla fascia, dalla più forte alla più debole. */
export function captaincyClaims(inputs: readonly CaptaincyInput[]): CaptaincyClaim[] {
  return inputs.map(captaincyClaimOf).sort((a, b) => b.score - a.score);
}

/**
 * Chi sceglierebbe il mister.
 *
 * Sceglie la candidatura più forte, ma **solo fra chi la vuole davvero**: se nessuno supera la
 * soglia il club resta senza capitano, ed è un esito legittimo (una rosa di ragazzi appena
 * assemblata non ha un leader designato). Chi è infortunato o in prestito non è eleggibile: la
 * fascia la porta chi scende in campo.
 */
export function coachCaptainPick(
  claims: readonly CaptaincyClaim[],
  eligible: (playerId: string) => boolean,
): string | null {
  const candidato = claims.find((c) => c.score >= CAPTAIN_DESIRE_THRESHOLD && eligible(c.playerId));
  return candidato?.playerId ?? null;
}

export interface CaptaincyChangeVerdict {
  approved: boolean;
  /** Testo del mister: la UI lo mostra come sua risposta, non come messaggio di sistema. */
  message: string;
  /** Costo in sintonia col mister se il DS forza comunque la mano. */
  harmonyCost: number;
}

/**
 * Il mister accetta di spostare la fascia?
 *
 * Non è un capriccio: confronta la candidatura del proposto con quella dell'attuale capitano. Se
 * il proposto è chiaramente meno titolato il mister si oppone — e la sintonia alta può convincerlo,
 * perché in fondo è una scelta di spogliatoio e il DS ha voce in capitolo, ma non gratis.
 */
export function evaluateCaptaincyChange(
  proposto: CaptaincyClaim | undefined,
  attuale: CaptaincyClaim | undefined,
  coachHarmony: number,
): CaptaincyChangeVerdict {
  if (!proposto) {
    return { approved: false, message: "Non è un giocatore su cui costruire uno spogliatoio.", harmonyCost: 0 };
  }

  if (!attuale) {
    if (proposto.score >= CAPTAIN_DESIRE_THRESHOLD - 15) {
      return { approved: true, message: `D'accordo: ${"la fascia"} va a lui, se la merita.`, harmonyCost: 0 };
    }
    return {
      approved: false,
      message: "Non ha ancora il peso per portare la fascia in questo spogliatoio.",
      harmonyCost: 6,
    };
  }

  const scarto = proposto.score - attuale.score;
  const bonusSintonia = (coachHarmony - 50) / 8;

  if (scarto + bonusSintonia >= -8) {
    return { approved: true, message: "Va bene, cambiamo capitano. Me ne assumo io la responsabilità.", harmonyCost: 0 };
  }
  return {
    approved: false,
    message: "Togliere la fascia a chi se l'è guadagnata spaccherebbe lo spogliatoio. Non ci sto.",
    harmonyCost: 10,
  };
}

/** Quanto crolla il morale di chi si vede togliere la fascia: non è un dettaglio, è un'umiliazione. */
export const CAPTAIN_LOST_MORALE = -28;
/** Quanto sale quello di chi la riceve. */
export const CAPTAIN_GAINED_MORALE = 18;
/** Il malcontento per stagione di chi la desidera e non la ottiene, applicato a ogni giornata. */
export const CAPTAIN_DENIED_DRIFT = -1;
