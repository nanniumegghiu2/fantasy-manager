import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Briefcase, Handshake, TrendingDown } from "lucide-react";
import { Button } from "./ui";

/**
 * **Le tre cose da sapere prima di cominciare** (piano DS mobile, D4).
 *
 * I test sui giocatori nuovi sono andati male e la ragione non è solo di interfaccia: la
 * modalità non spiega **mai** che cos'è. Chi arriva si trova a scegliere un club senza sapere
 * che non allenerà, che il mercato è il gioco, e che una retrocessione chiude tutto.
 *
 * Le tre informazioni **esistevano già** — sparse in paragrafi da 11px che nessuno leggeva, in
 * fondo a schermate piene d'altro. Qui non si aggiunge contenuto: si mette al centro ciò che
 * era in nota, una volta sola e in tre schermate saltabili in un tocco.
 *
 * ⚠️ Lo stato «l'ho già vista» sta in `localStorage`, **fuori dal salvataggio della carriera**:
 * quello deve restare sotto i 100 KB (CLAUDE.md § 3.7.13) e non deve contenere stato di
 * interfaccia. Ed è giusto anche concettualmente — è una proprietà del *dispositivo*, non della
 * partita: chi ha già giocato non rivede l'introduzione nemmeno cominciando una carriera nuova.
 */

const CHIAVE = "ds-intro-vista";

export function introGiaVista(): boolean {
  try {
    return localStorage.getItem(CHIAVE) === "1";
  } catch {
    // Navigazione privata o storage negato: si mostra l'introduzione, che è il male minore
    // rispetto a rompere l'avvio della modalità.
    return false;
  }
}

function segnaVista() {
  try {
    localStorage.setItem(CHIAVE, "1");
  } catch {
    /* vedi sopra */
  }
}

const PASSI = [
  {
    icona: Briefcase,
    titolo: "Non alleni: costruisci",
    testo:
      "Sei il direttore sportivo. La formazione la sceglie il mister — tu decidi chi comprare, chi far crescere e chi lasciar partire. La squadra che vedi in campo è il risultato del tuo mercato.",
  },
  {
    icona: Handshake,
    titolo: "Il mercato è la partita",
    testo:
      "Ogni acquisto è una trattativa vera, con un altro direttore sportivo dall'altra parte: si tira sulla cifra finché la pazienza regge. Poi bisogna convincere anche il giocatore.",
  },
  {
    icona: TrendingDown,
    titolo: "Si può perdere tutto",
    testo:
      "Retrocedere chiude la carriera, e la dirigenza può esonerarti se manchi troppo gli obiettivi che hai dichiarato. Dieci stagioni per costruire qualcosa — o per rovinarlo.",
  },
];

export function IntroScreen({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const passo = PASSI[i];
  const ultimo = i === PASSI.length - 1;
  const Icona = passo.icona;

  const chiudi = () => {
    segnaVista();
    onDone();
  };

  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] pt-safe text-[var(--text-primary)]">
      <header className="flex items-center justify-end px-4 py-3">
        {/* Saltabile in un tocco, sempre: un'introduzione che si subisce è peggio di
            nessuna introduzione. */}
        <Button variant="ghost" onClick={chiudi}>
          Salta
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={passo.titolo}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22 }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--brand)]/12 text-[var(--brand)]">
              <Icona size={36} />
            </span>
            <h1 className="text-display leading-tight text-balance">{passo.titolo}</h1>
            <p className="text-body leading-relaxed text-[var(--text-secondary)] text-balance">
              {passo.testo}
            </p>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 pt-4 pb-safe-4">
        <div className="flex justify-center gap-1.5">
          {PASSI.map((p, idx) => (
            <span
              key={p.titolo}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-6 bg-[var(--brand)]" : "w-1.5 bg-[var(--surface-border)]"
              }`}
            />
          ))}
        </div>

        <Button
          size="lg"
          block
          icon={ultimo ? undefined : ArrowRight}
          onClick={() => (ultimo ? chiudi() : setI((v) => v + 1))}
        >
          {ultimo ? "Scegli il club" : "Avanti"}
        </Button>
      </footer>
    </div>
  );
}
