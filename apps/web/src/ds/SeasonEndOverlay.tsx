import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpCircle, Check, Crown, Handshake, Home, MessagesSquare, Share2, Smile, Swords, Target, TrendingDown, Trophy, Wallet } from "lucide-react";
import { PROMOTION_SLOTS, type CareerState, type SeasonSummary } from "@app/game-engine";
import { CUP_STAGE_LABEL, euro, ordinale } from "./format";
import { CelebrationConfetti } from "./CelebrationConfetti";
import { shareTriumph, type ShareCardData } from "./shareCard";

/**
 * Fine stagione (e fine carriera).
 *
 * Il verdetto è **commentato**, non solo numerico: dopo trentotto giornate l'utente vuole
 * sapere se è andata bene, e "7º posto" da solo non lo dice — dipende da dove si era partiti.
 * La retrocessione chiude la carriera, quindi ha un trattamento suo: non è una stagione storta,
 * è la fine della partita.
 */

/**
 * Il verdetto dell annata, **nella lingua del campionato che si gioca**.
 *
 * ⚠️ Segnalazione dell utente: arrivando secondi o terzi in Serie B la schermata annunciava
 * "In Europa", che da quella categoria non vuol dire niente — dalla B non ci si qualifica alle
 * coppe europee, ci si **promuove**. La scala era scritta per la Serie A e applicata a entrambe.
 *
 * Le soglie vere vivono gia nel motore (`tierFor`, che conosce le due divisioni): qui si traduce
 * il piazzamento nella frase giusta invece di reinventare i numeri.
 */
function verdetto(summary: SeasonSummary, teamsInLeague: number, secondDivision: boolean) {
  if (summary.position > teamsInLeague - 3) {
    return { titolo: "Retrocessione", tono: "#ff4d4d", icona: TrendingDown };
  }

  if (secondDivision) {
    if (summary.position <= PROMOTION_SLOTS) {
      return { titolo: summary.position === 1 ? "Promossi da campioni" : "Promossi", tono: "#3ddc6b", icona: ArrowUpCircle };
    }
    if (summary.position <= 8) {
      return { titolo: "Ai playoff", tono: "#8fd4a4", icona: Swords };
    }
    return { titolo: "Salvezza tranquilla", tono: "#ffab2e", icona: Trophy };
  }

  if (summary.position === 1) {
    return { titolo: "Campione", tono: "#f5c518", icona: Trophy };
  }
  if (summary.position <= 4) {
    return { titolo: "In Europa", tono: "#3ddc6b", icona: Crown };
  }
  if (summary.position <= 8) {
    return { titolo: "Stagione solida", tono: "#8fd4a4", icona: Trophy };
  }
  return { titolo: "Salvezza tranquilla", tono: "#ffab2e", icona: Trophy };
}

interface SeasonEndOverlayProps {
  state: CareerState;
  summary: SeasonSummary;
  teamsInLeague: number;
  /** In Serie B il verdetto parla di promozione e playoff, non di Europa. */
  secondDivision?: boolean;
  /** I dati della card condivisibile: il resoconto e il trionfo sono ora una schermata sola. */
  shareData?: ShareCardData;
  onContinue: () => void;
  onExit: () => void;
}

export function SeasonEndOverlay({
  state,
  summary,
  teamsInLeague,
  secondDivision = false,
  shareData,
  onContinue,
  onExit,
}: SeasonEndOverlayProps) {
  const [condivisione, setCondivisione] = useState<"idle" | "in-corso" | "fatto" | "errore">("idle");
  const trofei = summary.trophies
    ? Number(summary.trophies.league) + Number(summary.trophies.continental) + Number(summary.trophies.national)
    : 0;
  const { titolo, tono, icona: Icona } = verdetto(summary, teamsInLeague, secondDivision);
  const finita = state.phase === "conclusa";
  const vintaCoppa = summary.cupOutcome === "vittoria";
  const vintoCampionato = summary.position === 1;
  const festeggia = vintoCampionato || vintaCoppa;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      {festeggia && <CelebrationConfetti />}

      <motion.div
        initial={{ scale: 0.85, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className={`relative z-10 w-full max-w-sm overflow-hidden rounded-card border ${
          festeggia
            ? "border-[#f5c518] shadow-[0_0_50px_rgba(245,197,24,0.35)]"
            : "border-[var(--surface-border)]"
        } bg-[var(--surface)]`}
      >
        <div
          className="relative flex flex-col items-center gap-2 overflow-hidden px-6 py-7 text-center"
          style={{ backgroundColor: `${tono}18` }}
        >
          {festeggia && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-1 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#f5c518] via-[#ffe066] to-[#f5c518] px-3.5 py-1 text-micro font-black tracking-widest text-black uppercase shadow-md"
            >
              {/* Le coppe disegnate, non le emoji: 👑🏆 si rendono con font di sistema diversi
                  su Android e iOS, quindi il momento più celebrativo della carriera cambiava
                  aspetto da telefono a telefono (e § 8 le vieta comunque). */}
              {vintoCampionato && vintaCoppa ? (
                <>
                  <Crown size={13} />
                  <Trophy size={13} />
                  Doppietta storica
                </>
              ) : vintoCampionato ? (
                <>
                  <Trophy size={13} />
                  Campioni d'Italia
                </>
              ) : (
                <>
                  <Crown size={13} />
                  Vincitori della Corona
                </>
              )}
            </motion.div>
          )}

          <motion.span
            initial={{ scale: 0.4, rotate: -12 }}
            animate={{ scale: [0.4, 1.2, 1], rotate: [ -12, 6, 0] }}
            transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.12 }}
            className="flex h-16 w-16 items-center justify-center rounded-full shadow-lg"
            style={{ backgroundColor: `${tono}28`, color: tono }}
          >
            <Icona size={34} />
          </motion.span>
          <p className="text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            Stagione {summary.season}
          </p>
          <h2 className="text-display leading-tight font-extrabold" style={{ color: tono }}>
            {titolo}
          </h2>
          <p className="text-body font-semibold">
            {ordinale(summary.position)} posto · {summary.points} punti
          </p>
          {summary.cupOutcome && (
            <p className="flex items-center gap-1.5 text-label font-semibold text-[#c9a10b]">
              <Crown size={13} />
              {vintaCoppa
                ? "Corona Continentale vinta"
                : `Corona: ${CUP_STAGE_LABEL[summary.cupOutcome] ?? summary.cupOutcome}`}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 divide-x divide-[var(--surface-border)] border-y border-[var(--surface-border)]">
          <Numero label="Fatti" value={summary.goalsFor} />
          <Numero label="Subiti" value={summary.goalsAgainst} />
          <Numero
            label="Differenza"
            value={
              summary.goalsFor - summary.goalsAgainst > 0
                ? `+${summary.goalsFor - summary.goalsAgainst}`
                : `${summary.goalsFor - summary.goalsAgainst}`
            }
          />
        </div>

        {/* Il resoconto completo: da qui si riparte per la stagione nuova, non solo il
            risultato sportivo — obiettivo, umore dello spogliatoio, mercato, rapporto col
            mister. */}
        <div className="flex flex-col gap-2 px-4 py-3 text-label">
          {summary.objective && (
            <div
              className="flex items-center gap-2.5 rounded-control border p-2.5"
              style={{
                borderColor: summary.objective.met ? "#3ddc6b40" : "#ff8a3d40",
                backgroundColor: summary.objective.met ? "#3ddc6b12" : "#ff8a3d12",
              }}
            >
              <Target size={15} className="shrink-0" style={{ color: summary.objective.met ? "#2a9b4d" : "#c96a1f" }} />
              <span className="flex-1">
                Obiettivo <strong>{summary.objective.label}</strong> (entro la {summary.objective.targetPosition}ª)
              </span>
              <span className="font-extrabold" style={{ color: summary.objective.met ? "#2a9b4d" : "#c96a1f" }}>
                {summary.objective.met ? "Raggiunto" : "Mancato"}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-control border border-[var(--surface-border)] p-2.5">
              <Smile size={15} className="shrink-0 text-[var(--text-secondary)]" />
              <span>
                Morale medio <strong className="tabular-nums">{summary.avgMorale}</strong>
                {summary.unhappyCount > 0 && (
                  <span className="text-[var(--text-secondary)]"> · {summary.unhappyCount} scontenti</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-control border border-[var(--surface-border)] p-2.5">
              <Wallet size={15} className="shrink-0 text-[var(--text-secondary)]" />
              <span>
                Saldo mercato{" "}
                <strong className="tabular-nums" style={{ color: summary.netBudget >= 0 ? "#2a9b4d" : "#c96a1f" }}>
                  {summary.netBudget >= 0 ? "+" : "-"}
                  {euro(Math.abs(summary.netBudget))}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-control border border-[var(--surface-border)] p-2.5">
            <Handshake size={15} className="shrink-0 text-[var(--text-secondary)]" />
            <span>
              Sintonia col mister{" "}
              <strong style={{ color: summary.coachHarmonyDelta >= 0 ? "#2a9b4d" : "#c96a1f" }}>
                {summary.coachHarmonyDelta >= 0 ? "+" : ""}
                {summary.coachHarmonyDelta}
              </strong>{" "}
              in stagione
            </span>
          </div>

          {summary.standoffQueue.length > 0 && (
            <div className="flex items-start gap-2 rounded-control border border-[#ff4d4d]/30 bg-[#ff4d4d]/5 p-2.5">
              <MessagesSquare size={15} className="mt-0.5 shrink-0 text-[#ff4d4d]" />
              <span>
                {summary.standoffQueue.length === 1
                  ? `${summary.standoffQueue[0]!.name} vuole ancora andarsene.`
                  : `${summary.standoffQueue.length} giocatori vogliono ancora andarsene: ${summary.standoffQueue
                      .slice(0, 3)
                      .map((s) => s.name)
                      .join(", ")}${summary.standoffQueue.length > 3 ? "…" : ""}`}
              </span>
            </div>
          )}
        </div>

        {finita && (
          <p className="px-6 pt-4 text-center text-body leading-relaxed text-[var(--text-secondary)]">
            {state.ending === "retrocessione"
              ? "La retrocessione chiude la carriera: la società ha scelto un'altra strada."
              : `Dieci stagioni completate. ${state.history.filter((h) => h.position === 1).length} titoli in bacheca.`}
          </p>
        )}

        <div className="flex flex-col gap-2 p-4">
          {!finita && (
            <button
              type="button"
              onClick={onContinue}
              className="w-full rounded-card bg-[var(--brand)] py-3.5 text-body font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-[0.98]"
            >
              Guarda come è cresciuta la rosa
            </button>
          )}
          {/**
           * **La condivisione sta qui, non in una seconda schermata.**
           *
           * Segnalazione dell'utente: a ogni fine stagione comparivano **due** riepiloghi, uno
           * condivisibile e uno no. Erano nati per scopi diversi — la festa e i numeri — ma per
           * chi gioca sono la stessa cosa vista due volte, e la seconda arriva quando la prima ha
           * già detto tutto. Ora il resoconto è uno solo, e il tasto per portare fuori il trionfo
           * vive accanto ai numeri che lo raccontano.
           *
           * Compare **solo se c'è qualcosa da festeggiare**: una card di una stagione senza
           * trofei non è un trionfo, è un tabellino.
           */}
          {trofei > 0 && shareData && (
            <button
              type="button"
              disabled={condivisione === "in-corso"}
              onClick={async () => {
                setCondivisione("in-corso");
                const esito = await shareTriumph(shareData, "storia");
                setCondivisione(esito === "errore" || esito === "annullato" ? "errore" : "fatto");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-card border py-3 text-body font-extrabold transition-transform active:scale-[0.98]"
              style={{ borderColor: "#f5c51866", backgroundColor: "#f5c51814", color: "#f5c518" }}
            >
              {condivisione === "in-corso" ? (
                <>Preparo l'immagine…</>
              ) : condivisione === "fatto" ? (
                <>
                  <Check size={15} /> Immagine pronta
                </>
              ) : (
                <>
                  <Share2 size={15} /> Condividi il trionfo
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onExit}
            className="flex w-full items-center justify-center gap-2 rounded-card border border-[var(--surface-border)] py-3 text-body font-bold"
          >
            <Home size={15} />
            {finita ? "Torna alla home" : "Riprendi più tardi"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Numero({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-2 py-3 text-center">
      <p className="text-title leading-none font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-micro font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
        {label}
      </p>
    </div>
  );
}
