/**
 * **La trattativa**: un botta e risposta col direttore sportivo dell'altra squadra.
 *
 * Perché esiste. Comprare e vendere premendo un pulsante è un'operazione contabile, non una
 * trattativa: il prezzo è dato, la risposta è certa, e non c'è niente da giocare. Qui invece
 * ogni mossa costa **pazienza** all'interlocutore, e la pazienza è la risorsa vera — si può
 * strappare qualche milione in più, ma tirando troppo la corda la trattativa **si arena** e il
 * giocatore non si muove. È la stessa tensione del redraft nella Modalità Classica: una risorsa
 * limitata che rende ogni tentativo una scelta invece di un tasto da ripremere.
 *
 * Tutto puro e deterministico dato un PRNG: una trattativa riaperta dopo un ricaricamento si
 * comporta allo stesso modo.
 */

/** Chi parla. */
export type Speaker = "loro" | "noi";

export interface NegotiationMessage {
  speaker: Speaker;
  text: string;
  /** Cifra a cui il messaggio si riferisce, se ce n'è una. */
  amount?: number;
}

/**
 * `"prestito"` negozia gli **stessi meccanismi** di `"cessione"` (vogliamo un numero alto,
 * loro lo tirano giù) ma su un'unità diversa: non un prezzo in euro, **minuti garantiti** al
 * giocatore dal club che lo ospita. Ogni punto del codice che distingue "chi vuole andare su" da
 * "chi vuole andare giù" tratta `"prestito"` come `"cessione"` (`kind !== "acquisto"`); solo la
 * formattazione del numero e il passo dei rilanci cambiano (sotto, `unitOf`/`stepFor`).
 */
export type NegotiationKind = "cessione" | "acquisto" | "prestito";
export type NegotiationStatus = "aperta" | "conclusa" | "arenata";

export interface Negotiation {
  kind: NegotiationKind;
  playerId: string;
  playerName: string;
  clubId: string;
  clubName: string;
  /** La cifra sul tavolo adesso: quella che si incassa (cessione) o si paga (acquisto). */
  amount: number;
  /** Il limite oltre il quale l'altro non va. Nascosto all'utente: è il gioco. */
  ceiling: number;
  /** 0-100. Ogni rilancio la consuma; a zero la trattativa si arena. */
  patience: number;
  round: number;
  status: NegotiationStatus;
  log: NegotiationMessage[];
  /** Quante volte si è preso tempo: oltre il limite non si può più. */
  stalls?: number;
  /**
   * Com'è finita, quando è finita male: serve alla UI per raccontarlo e al riduttore per
   * sapere che **non** deve eseguire l'operazione.
   */
  ending?: "accordo" | "rifiuto_giocatore" | "visite_mediche" | "soffiato" | "rottura";
}

/**
 * Quanta pazienza costa un rilancio, in funzione di quanto è esagerato.
 *
 * Un ritocco è quasi gratis, una richiesta fuori scala brucia la trattativa in due mosse. La
 * curva è volutamente ripida oltre il limite: dev'essere possibile *sentire* quando si sta
 * tirando troppo, non scoprirlo solo alla fine.
 */
export function patienceCost(richiesta: number, ceiling: number): number {
  if (ceiling <= 0) return 100;
  const eccesso = (richiesta - ceiling) / ceiling;
  // Un ritocco quasi non si paga: è ciò che rende possibile una trattativa **lunga**, fatta di
  // piccoli passi, invece di due mosse e via.
  if (eccesso <= 0) return 6;
  return Math.min(100, 6 + eccesso * 200);
}

/**
 * Quanto l'altro è disposto a salire, oltre la cifra di partenza.
 *
 * `noise` (default 0, atteso in [-0.04, 0.04]) è un piccolo scarto **seedato per stagione**:
 * senza, la stessa offerta allo stesso giocatore con lo stesso appetito dava sempre lo stesso
 * tetto nascosto, stagione dopo stagione — l'unica variabilità veniva dal tiro di accettazione,
 * non dal limite stesso. Con lo scarto il limite vero cambia leggermente anno per anno, quindi
 * anche una trattativa "identica" (stessa cifra, stesso giocatore, stagioni diverse) non deve
 * per forza andare a finire allo stesso modo.
 */
export function ceilingFrom(base: number, appetite: number, noise = 0): number {
  // Chi tiene molto al giocatore arriva al 45% in più; chi lo prende per riempire, al 10%.
  const scarto = Math.max(-0.04, Math.min(0.04, noise));
  return Math.round(base * (1 + 0.1 + Math.max(0, Math.min(1, appetite)) * 0.35 + scarto));
}

export interface OpenNegotiationInput {
  kind: NegotiationKind;
  playerId: string;
  playerName: string;
  clubId: string;
  clubName: string;
  /** La cifra di apertura: la loro offerta, o il prezzo che chiedono. */
  amount: number;
  /** Quanto tengono al giocatore, 0-1: decide fin dove si spingono. */
  appetite: number;
  /** Scarto stagionale sul tetto nascosto, in [-0.04, 0.04]. Default 0 (nessuna variazione). */
  noise?: number;
}

/** Apre la trattativa con il messaggio dell'altro direttore sportivo. */
export function openNegotiation(input: OpenNegotiationInput): Negotiation {
  const noise = input.noise ?? 0;
  const ceiling =
    input.kind !== "acquisto"
      ? ceilingFrom(input.amount, input.appetite, noise)
      : // In acquisto il "tetto" è al contrario: quanto **scendono** rispetto alla richiesta.
        // Lo stesso scarto stagionale si applica in senso inverso (segno cambiato) per lo
        // stesso motivo: il tetto in acquisto non deve essere più prevedibile di quello in
        // cessione solo perché la formula è diversa.
        Math.round(input.amount * (1 - 0.05 - Math.max(0, Math.min(1, input.appetite)) * 0.2 - noise));

  return {
    kind: input.kind,
    playerId: input.playerId,
    playerName: input.playerName,
    clubId: input.clubId,
    clubName: input.clubName,
    amount: input.amount,
    ceiling,
    patience: 100,
    round: 0,
    status: "aperta",
    log: [
      {
        speaker: "loro",
        text:
          input.kind === "acquisto"
            ? apertureAcquisto(input.playerName, input.appetite)
            : input.kind === "prestito"
              ? apertureRichiestaPrestito(input.playerName, input.appetite)
              : apertureCessione(input.playerName, input.appetite),
        amount: input.amount,
      },
    ],
  };
}

export type NegotiationMove =
  | { kind: "accetta" }
  | { kind: "rilancia"; amount: number }
  /**
   * **Prendere tempo**: recupera pazienza, ma apre la porta a un rivale.
   *
   * È la mossa che rende la trattativa tattica invece che una scala di numeri. Tirare per le
   * lunghe conviene — l'altro si riavvicina — ma ogni giro in più è un giro in cui qualcun
   * altro può inserirsi. In vendita l'inserimento è una fortuna (fa salire il prezzo), in
   * acquisto è la sconfitta: te lo portano via.
   */
  | { kind: "prendi_tempo" }
  /**
   * **Ultimatum**: chiude subito, bene o male.
   *
   * Alto rischio e alta ricompensa: se l'altro cede paghi/incassi la tua cifra anche fuori dal
   * suo limite, altrimenti si alza dal tavolo e non se ne parla più.
   */
  | { kind: "ultimatum"; amount: number }
  | { kind: "abbandona" };

/** Quante volte si può prendere tempo prima che diventi ridicolo. */
export const MAX_STALLS = 3;

/** Probabilità che, prendendo tempo, si inserisca un'altra squadra. */
export const RIVAL_INTERFERENCE_ODDS = 0.32;

/**
 * Applica una mossa e restituisce la trattativa aggiornata.
 *
 * La regola centrale: **rilanciare dentro il limite fa quasi sempre chiudere**, rilanciare
 * oltre consuma pazienza in fretta. Non c'è una soglia visibile — si intuisce dalle risposte,
 * che diventano via via più secche — perché è quella lettura a rendere la trattativa un gioco.
 */
export function applyNegotiationMove(
  negotiation: Negotiation,
  move: NegotiationMove,
  random: () => number,
): Negotiation {
  if (negotiation.status !== "aperta") return negotiation;

  if (move.kind === "abbandona") {
    return {
      ...negotiation,
      status: "arenata",
      log: [
        ...negotiation.log,
        { speaker: "noi", text: "Lasciamo perdere, non se ne fa niente." },
        { speaker: "loro", text: "Peccato. Sai dove trovarmi." },
      ],
    };
  }

  if (move.kind === "accetta") {
    return concludi(negotiation, negotiation.amount, random, [
      { speaker: "noi", text: "Affare fatto.", amount: negotiation.amount },
    ]);
  }

  if (move.kind === "prendi_tempo") {
    const usati = negotiation.stalls ?? 0;
    if (usati >= MAX_STALLS) {
      return {
        ...negotiation,
        status: "arenata",
        ending: "rottura",
        log: [
          ...negotiation.log,
          { speaker: "noi", text: "Fammici pensare ancora un po'." },
          { speaker: "loro", text: "Hai già pensato abbastanza. Chiudo qui." },
        ],
      };
    }

    // Un rivale può inserirsi: in vendita è una fortuna, in acquisto è la sconfitta.
    if (random() < RIVAL_INTERFERENCE_ODDS) {
      if (negotiation.kind === "acquisto") {
        return {
          ...negotiation,
          status: "arenata",
          ending: "soffiato",
          stalls: usati + 1,
          log: [
            ...negotiation.log,
            { speaker: "noi", text: "Dammi ancora un giorno." },
            {
              speaker: "loro",
              text: "Il giorno non ce l'ho più: è arrivata un'altra offerta e l'hanno chiuso stamattina.",
            },
          ],
        };
      }
      // In cessione l'inserimento fa salire l'asta.
      const rilancio = Math.round(negotiation.amount * 1.22);
      return {
        ...negotiation,
        amount: rilancio,
        ceiling: Math.max(negotiation.ceiling, rilancio),
        patience: Math.min(100, negotiation.patience + 8),
        round: negotiation.round + 1,
        stalls: usati + 1,
        log: [
          ...negotiation.log,
          { speaker: "noi", text: "Ci penso su." },
          {
            speaker: "loro",
            text: "Ho saputo che si è mosso anche qualcun altro. Alzo, ma chiudiamola.",
            amount: rilancio,
          },
        ],
      };
    }

    // Nessuno si è mosso: si recupera un po' di margine e basta.
    return {
      ...negotiation,
      patience: Math.min(100, negotiation.patience + 14),
      round: negotiation.round + 1,
      stalls: usati + 1,
      log: [
        ...negotiation.log,
        { speaker: "noi", text: "Ci penso e ti faccio sapere." },
        { speaker: "loro", text: scegli(["Fai con calma, ma non troppa.", "Ti aspetto."], random) },
      ],
    };
  }

  if (move.kind === "ultimatum") {
    const richiesta = Math.max(0, Math.round(move.amount));
    const dentro =
      negotiation.kind !== "acquisto" ? richiesta <= negotiation.ceiling : richiesta >= negotiation.ceiling;
    // Fuori dal limite si passa solo se sono ancora sereni: è la scommessa.
    const cedono = dentro || random() < negotiation.patience / 260;
    const log: NegotiationMessage[] = [
      ...negotiation.log,
      { speaker: "noi", text: "Questa è la mia ultima parola. Prendere o lasciare.", amount: richiesta },
    ];

    if (!cedono) {
      return {
        ...negotiation,
        status: "arenata",
        ending: "rottura",
        round: negotiation.round + 1,
        log: [...log, { speaker: "loro", text: "E allora lasciamo. Buona giornata." }],
      };
    }
    return concludi({ ...negotiation, round: negotiation.round + 1 }, richiesta, random, log);
  }

  const richiesta = Math.max(0, Math.round(move.amount));
  const costo = patienceCost(
    negotiation.kind !== "acquisto" ? richiesta : negotiation.amount + (negotiation.amount - richiesta),
    negotiation.kind !== "acquisto" ? negotiation.ceiling : negotiation.amount,
  );
  const patience = Math.max(0, negotiation.patience - costo);
  const round = negotiation.round + 1;

  const dentroIlLimite =
    negotiation.kind === "cessione" ? richiesta <= negotiation.ceiling : richiesta >= negotiation.ceiling;

  const log: NegotiationMessage[] = [
    ...negotiation.log,
    {
      speaker: "noi",
      text:
        negotiation.kind === "cessione"
          ? "Per meno non se ne parla."
          : negotiation.kind === "prestito"
            ? "Meno di così non lo mando in prestito."
            : "La mia offerta è questa.",
      amount: richiesta,
    },
  ];

  // Dentro il limite: accettano quasi sempre, e tanto più volentieri quanto più sono sereni.
  if (dentroIlLimite && random() < 0.75 + patience / 500) {
    return concludi({ ...negotiation, patience, round }, richiesta, random, log);
  }

  if (patience <= 0) {
    return {
      ...negotiation,
      patience: 0,
      round,
      status: "arenata",
      ending: "rottura",
      log: [...log, { speaker: "loro", text: rottura(random) }],
    };
  }

  // Controproposta: si incontrano a metà strada fra la loro posizione e la nostra.
  const incontro =
    negotiation.kind !== "acquisto"
      ? Math.round(Math.min(negotiation.ceiling, (negotiation.amount + richiesta) / 2))
      : Math.round(Math.max(negotiation.ceiling, (negotiation.amount + richiesta) / 2));

  return {
    ...negotiation,
    amount: incontro,
    patience,
    round,
    status: "aperta",
    log: [...log, { speaker: "loro", text: resistenza(patience, random), amount: incontro }],
  };
}

/** Probabilità che un accordo raggiunto salti per una sorpresa dell'ultimo momento. */
export const PLAYER_REFUSAL_ODDS = 0.09;
export const MEDICAL_FAILURE_ODDS = 0.06;

/**
 * Stretta la mano, resta l'ultimo scoglio.
 *
 * Due sorprese, rare ma non rarissime, che si vedono **solo in acquisto**: il giocatore può
 * dire di no (non è una merce, ha una volontà) e le visite mediche possono andare male. In
 * cessione non hanno senso — chi va via non deve convincere noi — e aggiungerle sarebbe una
 * penalità gratuita su una decisione già presa.
 *
 * Servono a togliere la certezza dall'ultimo passo: un mercato in cui ogni accordo si chiude è
 * un mercato senza rischio, e senza rischio non c'è tensione.
 */
function concludi(
  negotiation: Negotiation,
  amount: number,
  random: () => number,
  log: NegotiationMessage[],
): Negotiation {
  if (negotiation.kind === "acquisto") {
    if (random() < PLAYER_REFUSAL_ODDS) {
      return {
        ...negotiation,
        amount,
        status: "arenata",
        ending: "rifiuto_giocatore",
        log: [
          ...log,
          {
            speaker: "loro",
            text: "Con noi avevamo chiuso. Ma lui ha detto di no: aveva un'altra idea in testa. Mi dispiace.",
          },
        ],
      };
    }
    if (random() < MEDICAL_FAILURE_ODDS) {
      return {
        ...negotiation,
        amount,
        status: "arenata",
        ending: "visite_mediche",
        log: [
          ...log,
          {
            speaker: "loro",
            text: "Le visite mediche hanno trovato qualcosa che non ci aspettavamo. Meglio fermarsi qui, per tutti.",
          },
        ],
      };
    }
  }

  return {
    ...negotiation,
    amount,
    status: "conclusa",
    ending: "accordo",
    log: [...log, { speaker: "loro", text: accettazione(negotiation.kind, random) }],
  };
}

/**
 * Come si esprime il valore in trattativa: euro per cessione/acquisto, **partite** garantite
 * per un prestito — la stessa cifra interna (`amount`, in minuti) letta in un'unità leggibile.
 */
function formattaPerKind(kind: NegotiationKind, value: number): string {
  if (kind === "prestito") {
    const partite = Math.round(value / 90);
    return `${partite} ${partite === 1 ? "partita" : "partite"}`;
  }
  return formatta(value);
}

/** Le mosse suggerite, già pronte per i pulsanti: niente cifre da inventare al buio. */
export function suggestedMoves(negotiation: Negotiation): { label: string; move: NegotiationMove }[] {
  // Due passi di taglio diverso: il piccolo si può ripetere a lungo, il grande brucia in fretta.
  // Per il prestito il passo è in **partite intere** (multipli di 90 minuti), non in euro:
  // negoziare "270 minuti" non direbbe nulla, "3 partite" sì.
  const passo =
    negotiation.kind === "prestito"
      ? Math.max(90, Math.round((negotiation.amount * 0.12) / 90) * 90)
      : Math.max(300_000, Math.round((negotiation.amount * 0.08) / 100_000) * 100_000);
  const puoTemporeggiare = (negotiation.stalls ?? 0) < MAX_STALLS;
  const f = (v: number) => formattaPerKind(negotiation.kind, v);

  if (negotiation.kind === "cessione" || negotiation.kind === "prestito") {
    const ultimatum = negotiation.amount + passo * 4;
    const azioneVerbo = negotiation.kind === "prestito" ? "Chiedi" : "Accetta";
    return [
      { label: `${azioneVerbo} ${f(negotiation.amount)}`, move: { kind: "accetta" } },
      {
        label: `Ritocca a ${f(negotiation.amount + passo)}`,
        move: { kind: "rilancia", amount: negotiation.amount + passo },
      },
      {
        label: `Alza a ${f(negotiation.amount + passo * 3)}`,
        move: { kind: "rilancia", amount: negotiation.amount + passo * 3 },
      },
      ...(puoTemporeggiare
        ? [{ label: "Prendi tempo", move: { kind: "prendi_tempo" } as NegotiationMove }]
        : []),
      { label: `Ultimatum ${f(ultimatum)}`, move: { kind: "ultimatum", amount: ultimatum } },
      { label: "Chiudi la porta", move: { kind: "abbandona" } },
    ];
  }

  const giu = (n: number) => Math.max(0, negotiation.amount - n);
  const ultimatum = giu(passo * 4);
  return [
    { label: `Paga ${formatta(negotiation.amount)}`, move: { kind: "accetta" } },
    { label: `Lima a ${formatta(giu(passo))}`, move: { kind: "rilancia", amount: giu(passo) } },
    { label: `Scendi a ${formatta(giu(passo * 3))}`, move: { kind: "rilancia", amount: giu(passo * 3) } },
    ...(puoTemporeggiare
      ? [{ label: "Prendi tempo", move: { kind: "prendi_tempo" } as NegotiationMove }]
      : []),
    { label: `Ultimatum ${formatta(ultimatum)}`, move: { kind: "ultimatum", amount: ultimatum } },
    { label: "Lascia perdere", move: { kind: "abbandona" } },
  ];
}

/** Testo che spiega com'è finita: la UI lo mostra al posto di "trattativa arenata". */
export function endingLabel(negotiation: Negotiation): string {
  switch (negotiation.ending) {
    case "rifiuto_giocatore":
      return "Il giocatore ha detto no";
    case "visite_mediche":
      return "Visite mediche non superate";
    case "soffiato":
      return "Te l'hanno soffiato";
    case "accordo":
      return "Affare chiuso";
    default:
      return "Trattativa arenata";
  }
}

/* -------------------------------------------------------------------------- */
/* Le battute                                                                  */
/* -------------------------------------------------------------------------- */

function scegli(frasi: string[], random: () => number): string {
  return frasi[Math.floor(random() * frasi.length)] ?? frasi[0]!;
}

function apertureCessione(nome: string, appetite: number): string {
  if (appetite > 0.6) {
    return `${nome} ci interessa parecchio. Questa è la nostra offerta, e non è un tentativo.`;
  }
  return `Stiamo guardando ${nome}. Vediamo se c'è margine per lavorarci.`;
}

function apertureAcquisto(nome: string, appetite: number): string {
  if (appetite > 0.6) {
    return `${nome} per noi è incedibile, ma se il numero è giusto ne parliamo. Questo è il prezzo.`;
  }
  return `${nome} si può fare. Il prezzo è questo, poi discutiamo.`;
}

function accettazione(kind: NegotiationKind, random: () => number): string {
  if (kind === "prestito") {
    return scegli(
      [
        "Ci sta: gli garantiamo quei minuti, ha le qualità per meritarseli.",
        "Va bene così. Da noi giocherà, non farà panchina.",
        "Accetto: è il tipo di prestito che conviene a entrambi.",
      ],
      random,
    );
  }
  return scegli(
    kind === "cessione"
      ? [
          "Ci sta. Preparo i documenti.",
          "Va bene, chiudiamo qui. È stato un piacere.",
          "Accetto. Meglio chiudere che restare a guardarci.",
        ]
      : [
          "Affare fatto, è vostro.",
          "Ce lo facciamo andare bene. In bocca al lupo.",
          "Chiuso. Trattatelo bene.",
        ],
    random,
  );
}

function apertureRichiestaPrestito(nome: string, appetite: number): string {
  if (appetite > 0.6) {
    return `${nome} ci piace davvero. Possiamo garantirgli questi minuti in prestito.`;
  }
  return `Potremmo prenderlo in prestito. Questi i minuti che gli garantiamo, per ora.`;
}

function resistenza(patience: number, random: () => number): string {
  if (patience > 60) {
    return scegli(
      [
        "Siamo lontani, ma non lontanissimi. Ti dico dove possiamo arrivare.",
        "Capisco la richiesta. Io però mi fermo qui.",
        "Facciamo un passo per uno, altrimenti perdiamo solo tempo.",
      ],
      random,
    );
  }
  if (patience > 25) {
    return scegli(
      [
        "Guarda, comincio a stancarmi. Questa è quasi l'ultima parola.",
        "Non è che abbiamo tutta l'estate. Ultimo ritocco e poi basta.",
        "Sto già andando oltre quello che avevo in testa.",
      ],
      random,
    );
  }
  return scegli(
    [
      "Questa è l'ultima. Poi ci salutiamo.",
      "Prendere o lasciare, davvero.",
      "Non mi muovo più di così.",
    ],
    random,
  );
}

function rottura(random: () => number): string {
  return scegli(
    [
      "Basta così, ci abbiamo provato. Chiudo qui.",
      "Non se ne fa niente. Buona fortuna.",
      "Mi hai fatto perdere il pomeriggio. Lasciamo stare.",
    ],
    random,
  );
}


function formatta(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M€`;
  return `${Math.round(value / 1000)}k€`;
}
