import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  HeartCrack,
  MessagesSquare,
  ShieldAlert,
  Stethoscope,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  CAREER_SEASONS,
  dressingRoom,
  type CareerState,
  type CareerWorld,
  type StandingRow,
} from "@app/game-engine";

/**
 * **«E adesso cosa faccio?»** — la domanda a cui nessuna schermata rispondeva.
 *
 * È la causa dello spaesamento misurato sui giocatori nuovi, e non si risolve con un tutorial:
 * la modalità sa dire benissimo cosa *è successo* (referti, classifica, notizie) e non sa mai
 * dire cosa **conviene fare**. Un tutorial lo spiegherebbe una volta e poi sparirebbe, proprio
 * mentre la carriera diventa complicata.
 *
 * Questa card non insegna: **legge lo stato che il motore già produce** — fase, obiettivo
 * dichiarato, posizione, offerte in sospeso, infortunati, spogliatoio — e dice la cosa più
 * urgente in una frase. Per questo resta utile anche alla decima stagione, e per questo non ha
 * bisogno di nessuno stato nuovo da salvare.
 *
 * ⚠️ Vale la regola di confine di CLAUDE.md § 9: qui **non si calcola nulla di simulativo**. Si
 * legge e si ordina per urgenza, niente di più.
 */

interface Compito {
  icona: typeof Target;
  titolo: string;
  dettaglio: string;
  tono: string;
  /** Dove porta il tocco, quando c'è un posto dove andare. */
  vai?: () => void;
  vaiLabel?: string;
}

export function NextTaskCard({
  state,
  world,
  standings,
  onApriMercato,
  onVaiRosa,
}: {
  state: CareerState;
  world: CareerWorld;
  /** Già calcolata dalla schermata: qui non si ricalcola nulla (CLAUDE.md § 9). */
  standings: StandingRow[];
  onApriMercato?: () => void;
  onVaiRosa?: () => void;
}) {
  const compito = prossimoCompito(state, world, standings, onApriMercato, onVaiRosa);
  if (!compito) return null;

  const { icona: Icona, titolo, dettaglio, tono, vai, vaiLabel } = compito;

  const contenuto = (
    <>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `color-mix(in srgb, ${tono} 16%, transparent)`, color: tono }}
      >
        <Icona size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-micro text-[var(--text-secondary)] uppercase">
          Il tuo compito adesso
        </span>
        <span className="block text-body leading-tight font-bold text-balance">{titolo}</span>
        <span className="mt-0.5 block text-label leading-snug text-[var(--text-secondary)]">
          {dettaglio}
        </span>
      </span>
      {vai && (
        <span className="flex shrink-0 items-center gap-1 self-center text-label font-extrabold" style={{ color: tono }}>
          {vaiLabel}
          <ArrowRight size={14} />
        </span>
      )}
    </>
  );

  const classi =
    "mb-3 flex w-full items-start gap-3 rounded-card border p-3 text-left transition-transform active:scale-[0.99]";
  const stile = {
    borderColor: `color-mix(in srgb, ${tono} 35%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${tono} 7%, transparent)`,
  };

  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
      {vai ? (
        <button type="button" onClick={vai} className={classi} style={stile}>
          {contenuto}
        </button>
      ) : (
        <div className={classi} style={stile}>
          {contenuto}
        </div>
      )}
    </motion.div>
  );
}

/**
 * L'ordine è per **urgenza reale**, non per categoria: quello che chiude la carriera viene
 * prima di quello che la migliora.
 */
function prossimoCompito(
  state: CareerState,
  world: CareerWorld,
  standings: StandingRow[],
  onApriMercato?: () => void,
  onVaiRosa?: () => void,
): Compito | null {
  if (state.phase === "conclusa") return null;

  // 1. Il mercato è aperto: è il momento che decide la stagione, e ha una scadenza.
  if (state.market) {
    const offerte = state.market.offers.length + state.market.loanOffers.length;
    return {
      icona: CalendarClock,
      tono: "var(--accent)",
      titolo:
        state.market.window === "estiva"
          ? "Il mercato estivo è aperto"
          : "Il mercato di riparazione è aperto",
      dettaglio: offerte
        ? `${offerte} ${offerte === 1 ? "offerta" : "offerte"} sul tavolo, e puoi cercare chi ti serve. Finché è aperto il campionato non riparte.`
        : "Cerca chi ti serve e decidi chi lasciar partire. Finché è aperto il campionato non riparte.",
      vai: onApriMercato,
      vaiLabel: "Apri",
    };
  }

  // 2. Qualcuno vuole parlarti: se lo ignori, il rapporto si rompe per davvero.
  const spogliatoio = dressingRoom(state, world);
  const bloccanti = spogliatoio.filter((c) => c.blocking);
  if (bloccanti.length > 0) {
    return {
      icona: HeartCrack,
      tono: "var(--danger)",
      titolo: `${bloccanti[0].name} vuole parlarti, e non aspetta`,
      dettaglio:
        "Un caso aperto che non si chiude da solo: se resta senza risposta il rapporto si rompe.",
      vai: onVaiRosa,
      vaiLabel: "Vai",
    };
  }

  // 3. La classifica dice che l'obiettivo dichiarato sta scappando.
  const obiettivo = state.seasonObjective;
  const giornate = state.league?.round ?? 0;
  if (obiettivo && giornate >= 6 && standings.length > 0) {
    const nostra = standings.findIndex((r) => r.isUser) + 1;
    if (nostra > 0 && nostra > obiettivo.targetPosition + 3) {
      return {
        icona: ShieldAlert,
        tono: "var(--danger)",
        titolo: `Sei ${nostra - obiettivo.targetPosition} posizioni sotto l'obiettivo`,
        dettaglio: `Hai dichiarato «${obiettivo.label}» e la classifica dice altro. La dirigenza guarda proprio questo scarto.`,
      };
    }
  }

  // 4. Un reparto scoperto dagli infortuni: si vede in campo prima che sul mercato.
  const infortunati = state.roster.filter((e) => e.injuryMatchdaysLeft > 0).length;
  if (infortunati >= 3) {
    return {
      icona: Stethoscope,
      tono: "var(--draw)",
      titolo: `${infortunati} giocatori ai box`,
      dettaglio:
        "Con l'infermeria piena la rotazione si accorcia e la fatica pesa: guarda chi copre i buchi.",
      vai: onVaiRosa,
      vaiLabel: "Rosa",
    };
  }

  // 5. Qualcuno da ascoltare, ma senza urgenza.
  if (spogliatoio.length > 0) {
    return {
      icona: MessagesSquare,
      tono: "var(--brand)",
      titolo: `${spogliatoio.length} ${spogliatoio.length === 1 ? "giocatore ha" : "giocatori hanno"} qualcosa da dirti`,
      dettaglio: "Ascoltarli costa poco adesso; ignorarli costa molto più avanti.",
      vai: onVaiRosa,
      vaiLabel: "Rosa",
    };
  }

  // 6. Niente di urgente: si gioca. Ma va detto anche questo, altrimenti la card sparisce
  //    proprio quando l'utente nuovo si chiede se ha dimenticato qualcosa.
  return {
    icona: TrendingUp,
    tono: "var(--brand)",
    titolo: "Tutto a posto: si gioca",
    dettaglio: obiettivo
      ? `Obiettivo dichiarato: ${obiettivo.label}. Stagione ${state.season} di ${CAREER_SEASONS}.`
      : `Stagione ${state.season} di ${CAREER_SEASONS}. Manda avanti le giornate fino al prossimo mercato.`,
  };
}
