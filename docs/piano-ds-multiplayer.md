# Piano — DS Mode multigiocatore in tempo reale

> Stato: **impianto approvato**. Nessuna riga di codice scritta. Le decisioni prese sono in §0bis;
> restano aperte solo `D13`, `D14`, `D15` (§10), tutte di taratura o rinviabili — nessuna blocca
> l'inizio della fase 0.

---

## 0. Cosa chiede l'utente

1. **Account obbligatorio** per creare o entrare in una stanza (niente ospiti).
2. **Due club dello stesso campionato**, oppure delle due leghe gemelle (Serie A / Serie B).
3. **Vittoria**: chi fa per primo il **triplete**; se nessuno ci riesce, chi ha vinto **più trofei**
   nelle dieci stagioni.
4. **Mercato incrociato**: inserirsi nelle trattative dell'altro e **rubargli l'acquisto**;
   inviare **offerte per i suoi giocatori** con trattativa di prezzo dal vivo; **rubargli il mister**.
5. **2D solo** per le finali e per gli scontri diretti fra i due giocatori.
6. **Cammino pari**: quando a uno arriva una decisione si ferma anche l'altro, e si riparte insieme.

Il punto 6 non è un dettaglio di comodità: è la specifica di un gioco **a passo bloccato**
(*lockstep*), ed è la cosa che rende questa modalità realizzabile senza riscrivere il motore.
Torna utile più avanti.

---

## 0bis. Decisioni prese dall'utente (2026-08-14)

**① Architettura: lockstep con log dei comandi** (§2, opzione B). Confermata.

**② Dieci stagioni, solo in tempo reale.** Entrambi online per l'intera partita; il gioco asincrono
come *modo di giocare* è escluso (`D3`/`D4` chiusi). Tre conseguenze, adeguate nel piano:

- il **numero di barriere va tenuto basso** e ognuna deve scorrere in fretta: chi aspetta non deve
  restare fermo a guardare una rotella (§3.3);
- il **timeout alla barriera** diventa breve e visibile — minuti, non giorni (`D12`, §10);
- gli **snapshot restano**, ma cambiano scopo: non servono più a riprendere domani, servono a
  sopravvivere a una **disconnessione** (browser che si chiude, telefonata, rete che cade). Una
  partita in tempo reale che muore per un tab chiuso dopo sei stagioni non è accettabile, quindi
  la macchina di ripresa si costruisce comunque — non come modalità, come rete di sicurezza (§7).

Nota dichiarata, già sollevata una volta e superata dalla scelta dell'utente: dieci stagioni con
entrambi collegati sono una sessione molto lunga. Se all'atto pratico si rivelasse ingestibile, la
leva da toccare è il **numero di stagioni**, non l'architettura — il log dei comandi non cambia.

**③ Trofei: campionato, Corona, Coppa Tricolore.** La promozione dalla Serie B non conta.
Spareggi: campionati → Corone → Tricolori → scontri diretti → punti totali (`D5`/`D6` chiusi).

**④ Eliminazione = vittoria immediata dell'altro** (`D7` chiuso). Retrocessione dalla Serie B,
esonero della dirigenza e rosa sotto gli undici schierabili chiudono la partita sul posto.

**⑤ Nessun vincolo di equilibrio fra i due club** (`D1`). Piena libertà di scelta: si può scegliere
la corazzata contro la neopromossa, e il rating resta visibile nel selettore come informazione, non
come limite. *(Resta valida la specifica iniziale: stessa lega **oppure** la coppia Serie A ↔ Serie
B, che è l'unico accoppiamento con lo stesso numero di giornate — §1⑦.)*

**⑥ Difficoltà unica** per la stanza (`D2`), scelta da chi la crea: agisce solo sul budget, e due
budget diversi sarebbero uno svantaggio strutturale invece di una scelta.

**⑦ Il mercato si gioca a due passi** (`D8`, `D9`) — è la decisione più densa e ha una sezione
tutta sua: §5.

**⑧ Niente punti livello né classifiche** (`D11`), come la DS single-player: è la condizione che
rende accettabile il modello anti-cheat (§8).

**⑨ Timeout alla barriera e pausa alla disconnessione** (`D12`), che sono **due cose diverse** e
vanno distinte in modo esplicito, perché a separarle è la sola *presenza*:

- **presente ma fermo** → contatore visibile di 2-3 minuti, poi la decisione si risolve col
  comportamento neutro (mercato chiuso senza operazioni, richiesta ignorata) e la corsa riprende:
  nessuno può tenere l'altro in ostaggio restando immobile;
- **disconnesso** → la partita **si salva e va in pausa** fino al rientro di entrambi. Non si
  risolve nulla in sua assenza.

⚠️ Da questa distinzione nasce un abuso possibile e va detto ora: **staccare la rete diventa il modo
di non subire mai un timeout**. Rimedio proposto, minimo e senza contraddire la pausa: la pausa
protegge la partita per un tempo dichiarato (es. 72 ore); oltre, l'altro può **chiudere la partita a
proprio favore** invece di restare appeso per sempre. *(→ `D13`)*

---

## 1. Cosa ho verificato nel codice prima di pianificare

Otto accertamenti, tutti fatti leggendo il codice, non assunti. Tre cambiano il piano.

**① Infrastruttura di rete: non esiste nulla.** Zero occorrenze di `.channel(`, `broadcast`,
`presence` in `apps/web/src`; `supabase/` contiene solo `config.toml`, `migrations/` e `seed.sql` —
**nessuna Edge Function**, nonostante CLAUDE.md §9 le preveda dalla roadmap punto 3. Tutta la parte
di rete è terreno vergine: non c'è niente da riusare e niente da rompere.

**② Il motore è deterministico, con una falla vera.** `packages/game-engine/src/ds/aiWorld.ts:811`
costruisce un id con `Math.random().toString(36)`. In single-player è innocuo (è solo l'id di un
avviso); in lockstep **è una bomba**: due client produrrebbero stati diversi alla prima notizia di
mercato IA. Restano poi i parametri di default `random: () => number = Math.random` in
`championship.ts`, `draft.ts`, `coachRequestsCatalog.ts`: nei percorsi DS i chiamanti passano
sempre un PRNG seedato, ma **finché è un default nessuno se ne accorge se un giorno un chiamante
lo dimentica**. Vanno resi obbligatori sui percorsi DS.

**③ La forza di una squadra è già iniettabile.** `LeagueTeam.strength` esiste e `strengthOf()`
lo legge con ripiego su `rating`. Mettere in classifica la forza **reale** della rosa dell'altro
umano, aggiornata a ogni giornata, non richiede alcun modello nuovo: è un campo che c'è già.

**④ `simulateMatchday` segue una squadra sola.** `options.followedIndex` è singolo, e la sua
partita è l'unica simulata in dettaglio (le altre nove usano `simulateOpponentMatch`, che non
produce marcatori). Con due umani servono **due seguiti**, e il caso in cui i due si incontrano va
risolto **una volta sola** con entrambe le forze vere.

**⑤ I due client costruirebbero due calendari diversi.** `rebuildLeagueState` mette il proprio club
**all'indice 0** e poi le 19 avversarie. Il sorteggio `derivedRandom(seed, "league", leagueId,
season)` produce gli stessi *indici*, ma quegli indici puntano a club diversi nei due client.
Con lo stesso seme, i due giocatori vedrebbero due campionati che non concordano su chi gioca
contro chi. Serve **un ordinamento canonico dei club**, condiviso.

**⑥ `buildCareerWorld` è scritto per un solo umano.** `ownClubId`, `ownedByUser`, `evolveWorld`,
`planWorldTransfers` e `aiCoaches` assumono tutti **un** club privilegiato. Il club dell'altro
giocatore, se non lo si dichiara, verrebbe trattato dall'IA come qualunque altro: gli
venderebbe i giocatori, gli assegnerebbe un allenatore, e la sua forza in classifica sarebbe quella
del database invece che della rosa che l'altro sta costruendo.

**⑦ Il vincolo dell'utente sui campionati è tecnicamente necessario, non estetico.** Serie A e
Serie B hanno **entrambe 20 club → 38 giornate**, quindi i due calendari si allineano settimana per
settimana e la barriera del "cammino pari" ha senso. Bundesliga e Ligue 1 ne hanno 18 → 34: una
carriera in Bundesliga e una in Serie A **non potrebbero mai** procedere di pari passo. La regola
generale che ne esce: *stessa lega, oppure coppia di divisioni con lo stesso numero di giornate* —
che oggi significa esattamente Serie A ↔ Serie B.

**⑧ Il salvataggio attuale non è riusabile, e il suo stesso commento lo dice.** La migrazione
`20260730090200_ds_careers.sql` motiva per iscritto l'eccezione che permette al client di scrivere:
*«La DS mode è single-player e non alimenta punti livello né classifiche: un salvataggio
falsificabile non dà alcun vantaggio competitivo»*. In PvP quella frase diventa falsa. `ds_careers`
non va riusata: serve uno schema nuovo con policy proprie.

---

## 2. Il problema centrale: oggi sono due universi paralleli

Se due utenti avviassero oggi due carriere con lo stesso seme nello stesso campionato, **non
starebbero giocando la stessa partita**. Ognuno simula il proprio mondo per intero: il club
dell'altro è, per lui, una delle diciannove avversarie con la forza congelata del database. Se A
compra un attaccante da 88, nel campionato di B quel club continua a valere quanto valeva ad agosto.
Le due classifiche divergono dalla prima giornata, e lo scontro diretto verrebbe simulato **due
volte, con esiti diversi**.

Le strade possibili sono tre.

| | Come funziona | Costo | Anti-cheat |
|---|---|---|---|
| **A — Server autorevole** | Una Edge Function avanza il mondo e restituisce lo stato | Molto alto: il motore va portato su Deno, ogni decisione è una chiamata di rete | Pieno |
| **B — Lockstep con log dei comandi** | Il server custodisce l'**elenco ordinato delle decisioni**; ogni client ricostruisce lo stato eseguendole | Basso: il motore resta dov'è, la rete trasporta comandi da poche centinaia di byte | Parziale |
| **C — Sincronizzazione dello stato** | Ogni client manda il proprio stato all'altro | Medio, ma i due stati possono contraddirsi e non c'è un arbitro | Nullo |

**Raccomando B**, per tre ragioni concrete e una di forma:

- il motore è **già** puro, seedato e senza effetti collaterali — è la precondizione del lockstep,
  ed è già soddisfatta (salvo il punto ② sopra);
- il progetto **deriva già tutto dal seme** invece di salvarlo (calendario, coppa, contratti,
  invecchiamento IA): il lockstep è la stessa filosofia estesa a due giocatori, non una filosofia
  nuova;
- il traffico è minuscolo, quindi la modalità regge anche su rete lenta o mobile;
- e un effetto collaterale che vale molto: **il log dei comandi rende possibile il gioco asincrono**
  (§7).

Il prezzo di B è dichiarato: un client modificato può barare. Vedi §8.

### L'idea che semplifica tutto

Nel modello lockstep **ogni client simula entrambe le carriere** e mostra soltanto la propria. Non
c'è nulla da sincronizzare — né rose, né classifiche, né forze — perché i due client calcolano gli
stessi numeri dagli stessi comandi. Sparisce l'intera categoria di problemi "il mio client crede X,
il tuo crede Y": resta solo il dovere di garantire che il calcolo sia identico, che è una proprietà
verificabile con un test.

Costo: circa il doppio del lavoro di simulazione per client. Da misurare, ma una stagione intera
oggi gira in millisecondi.

---

## 3. Architettura proposta

### 3.1 Lo stato della partita

Nuovo pacchetto `packages/game-engine/src/mp/` (logica pura, testabile senza rete e senza React —
stessa regola di confine di CLAUDE.md §9).

```ts
interface MpMatchState {
  version: number;
  seed: string;                    // uno solo, condiviso: da qui nasce tutto il mondo
  turn: number;                    // numero di barriera
  seats: [MpSeat, MpSeat];
  /** I campionati che contengono almeno un umano: **condivisi**, non uno per seat. */
  leagues: Record<string, LeagueState>;
  barrier: BarrierState;           // chi deve ancora agire, e perché
  auctions: Auction[];             // aste incrociate aperte
  crossDeals: CrossDeal[];         // trattative fra i due umani
  ledger: [TrophyLedger, TrophyLedger];
  outcome?: { winner: SeatId; reason: "triplete" | "trofei" | "eliminazione" };
}

interface MpSeat {
  userId: string;
  nickname: string;
  career: CareerState;             // esattamente il tipo di oggi, invariato
}
```

`CareerState` **non cambia forma**. È importante: significa che tutta la DS mode
single-player continua a funzionare, e che ogni futura correzione al motore vale per entrambe le
modalità senza doppio lavoro.

### 3.2 I comandi

```ts
type MpCommand =
  | { kind: "scegli_club";       seat; clubId }
  | { kind: "scegli_mister";     seat; coachId }
  | { kind: "pronto";            seat }                    // esce dalla barriera
  | { kind: "mercato";           seat; action: MarketAction }
  | { kind: "trattativa";        seat; playerId; move: NegotiationMove }
  | { kind: "offerta_incrociata";seat; playerId; amount }   // §5.2
  | { kind: "rilancio_asta";     seat; auctionId; amount }  // §5.1
  | { kind: "offerta_mister";    seat; coachId; ingaggio }  // §5.3
  | { kind: "risposta_richiesta";seat; response }
  | { kind: "chiudi_mercato";    seat }
```

Ogni comando porta `(turn, seq)`. Il server garantisce che il log sia **append-only, ordinato e
scrivibile solo dal proprio seat**; il client li applica in ordine con un riduttore puro
`applyMpCommand(state, cmd): MpMatchState`. Stesso log ⇒ stesso stato.

### 3.3 La barriera — "il cammino deve essere pari"

Quando entrambi i seat hanno mandato `pronto`, il riduttore chiama `mpAdvanceToNextStop(state)`:
avanza **una settimana alla volta per entrambe le carriere insieme**, e si ferma appena **uno
qualunque dei due** incontra uno stop (`StopReason` esiste già: mercato, richiesta, imprevisto,
partita chiave, fine stagione).

Chi non ha nulla da decidere vede *"In attesa di \<nickname\>"* e, sotto, **cosa** sta facendo
l'altro in forma generica (*"sta trattando sul mercato"*), mai il contenuto.

**Chi aspetta non deve stare fermo.** Con dieci stagioni in tempo reale (§0bis) l'attesa è la cosa
che può rendere la modalità sgradevole, quindi è un vincolo di progetto e non una rifinitura: alla
barriera restano sempre disponibili le schermate di **sola lettura e pianificazione** — rosa,
classifica, notiziario, liste di cessione, ricerca di mercato senza impegno — mentre sono bloccate
solo le azioni che scrivono un comando. Più un **timer visibile** (`D12`): l'attesa dev'essere
misurabile, non indefinita.

Corollario di progetto: **le barriere vanno tenute poche**. Ogni stop è un'attesa per due persone,
quindi conviene raggrupparle (un imprevisto e una richiesta nella stessa settimana sono una
barriera sola, non due) e non introdurne di nuove senza una ragione forte.

Conseguenza voluta: le finestre di mercato dei due giocatori **coincidono sempre**, perché il
calendario è lo stesso. È ciò che rende il mercato incrociato (§5) una cosa naturale invece di un
sistema di messaggi asincroni da inventare.

### 3.4 Il campionato condiviso

Al posto di due `LeagueState` indipendenti, **uno solo** per ciascun campionato che contiene un
umano:

- **ordinamento canonico** dei club (per `id`, non per punto di vista): risolve ⑤;
- i club umani hanno `strength` presa da `squadStrengthOf(seat.career, world)` e **ricalcolata a
  ogni giornata**: risolve il congelamento della forza (§2) usando un campo che esiste già (③);
- `simulateMatchday` guadagna `followedIndexes: number[]` al posto di `followedIndex`, e un ramo
  **derby**: quando i due seguiti si incontrano, la partita si simula **una volta** con entrambe le
  forze e i marcatori veri, e i due `MatchResult` sono l'uno lo specchio dell'altro (risolve ④).

Se i due giocano in Serie A e Serie B, i campionati condivisi sono due, uno per divisione, e
`siblingLeague.ts` — che oggi simula la lega gemella con forze statiche — deve ricevere la forza
vera dell'umano che gioca lì.

### 3.5 Il mondo IA a due umani

`buildCareerWorld` diventa consapevole di due club privilegiati (risolve ⑥):

- `evolveWorld({ ownClubIds: [a, b], ownedByUser: unione delle due rose })`;
- `planWorldTransfers` **esclude entrambi**: nessuna squadra IA compra o vende i giocatori di un
  umano — quei giocatori si muovono solo per decisione di chi li possiede;
- `aiCoaches` non assegna un allenatore a nessuno dei due club;
- Corona Continentale e Coppa Tricolore possono contenerli entrambi: nessun caso speciale, si
  qualificano come chiunque.

---

## 4. Vittoria, sconfitta ed eliminazione

**Triplete = vittoria immediata.** `SeasonSummary.treble` esiste già ed è derivato dai tre booleani
in un campo solo — quindi non serve nuova logica, solo leggerlo alla chiusura di ogni stagione.

Una nota che vale la pena aver visto prima: **un pareggio sul triplete è impossibile per
costruzione**. Nello stesso campionato lo scudetto lo vince uno solo; in divisioni diverse, chi sta
in Serie B non gioca la Corona (regola già esistente, CLAUDE.md §3.7.12ter).

**Altrimenti, dopo dieci stagioni, chi ha più trofei** (deciso, §0bis③). Paniere: campionato, Corona
Continentale, Coppa Tricolore — la promozione dalla Serie B **non** conta. Spareggi a cascata:
campionati vinti → Corone → Tricolori → scontri diretti → punti totali nelle dieci stagioni.

`TrophyLedger` si costruisce leggendo `SeasonSummary.trophies`, che è già l'unica fonte da cui
`treble` si deriva: nessun contatore parallelo che possa andare fuori sincrono con la bacheca.

**Eliminazione anticipata: l'altro vince subito** (deciso, §0bis④). Le tre fini già previste dal
single-player — retrocessione dalla Serie B, esonero della dirigenza (`BOARD_CONFIDENCE_FLOOR`),
rosa sotto gli undici schierabili alla chiusura del mercato — chiudono la partita sul posto con
`outcome.reason = "eliminazione"`. Non serve inventare nulla: sono già condizioni terminali del
riduttore, va solo propagata la fine dal seat alla partita.

---

## 5. Il mercato incrociato: una finestra a due passi

È la parte che l'utente ha descritto con più dettaglio, ed è coerente con la regola di CLAUDE.md
§3.7.5: *«il calciomercato è il cuore della DS mode»*. Tutto vive **dentro la finestra di mercato**,
che per costruzione (§3.3) è aperta per entrambi nello stesso momento.

### 5.0 La struttura, e perché è una sola

Le risposte dell'utente a `D8` e `D9` descrivono la **stessa forma**: *primo passo l'offerta, secondo
passo la risoluzione*. Vale la pena prenderla sul serio come struttura unica invece di costruire tre
meccaniche separate che si somigliano — sarebbero tre insiemi di regole da tenere d'accordo per
sempre, e la prima divergenza sarebbe un difetto che nessuno riesce a spiegarsi.

Quindi **ogni finestra di mercato ha due passi**, e ogni cosa che si può fare all'altro passa di lì.

```
┌─ PASSO 1 — OFFERTE ──────────────────────────────────────────────┐
│ In cieco. Nessuno vede nulla dell'altro.                         │
│  • offerte ai club IA        (bersagli del proprio mercato)      │
│  • offerte ai giocatori dell'altro DS                            │
│  • offerta al mister dell'altro DS                               │
│ Entrambi chiudono il passo → barriera                            │
└──────────────────────────────────────────────────────────────────┘
                               ↓
┌─ PASSO 2 — RISOLUZIONE ──────────────────────────────────────────┐
│  • le offerte ricevute si aprono: accetta / controfferta         │
│  • i bersagli IA diventano scopribili → inserimento → asta       │
└──────────────────────────────────────────────────────────────────┘
```

Il passo 1 è **in cieco** perché è ciò che rende il mercato una scommessa invece di una reazione: si
decide dove puntare senza sapere dove punta l'altro.

**Il budget si impegna al passo 1.** Una cifra offerta è vincolata finché l'offerta è aperta: senza,
si potrebbe puntare su otto giocatori con i soldi per due e scegliere comodamente al passo 2, e il
passo 1 non sarebbe più una scelta. *(→ `D14`)*

### 5.1 Rubare l'acquisto (bersagli dei club IA)

Esiste già un precedente: `RIVAL_INTERFERENCE_ODDS = 0.32` — quando prendi tempo, un rivale IA può
soffiarti il giocatore. Qui il rivale ha un nome.

**La scoperta è per bersaglio, non per elenco.** Non esiste un cruscotto con tutto ciò che sta
trattando l'altro: aprendo la scheda di un giocatore in ricerca compare *«Un altro club sta
trattando»*. È la lettura letterale della richiesta (*«se giocatore due **cerca** un giocatore
trattato da giocatore 1»*) ed è anche la versione migliore — con un elenco globale, guardare il
cruscotto renderebbe più che scoutare, e tutto il mercato si ridurrebbe a inseguire l'altro.

**Si vede *che* tratta, mai *quanto*.** La cifra è il segreto su cui si regge l'intero sistema della
pazienza: mostrarla svuoterebbe `negotiation.ts` di senso.

Da lì, **l'inserimento**: la trattativa diventa un'**asta a due** con rilanci alternati, e a quel
punto — solo a quel punto — **le offerte sono in chiaro**, perché è ciò che distingue un'asta da una
trattativa.

Due regole che la tengono onesta:

- **inserirsi costa**, e costa a chi arriva dopo: chi si aggiunge al passo 2 paga un sovrapprezzo
  d'ingresso. Una guerra di offerte alza il prezzo — è realistico, e impedisce di inserirsi per
  dispetto su ogni bersaglio dell'avversario;
- **la pazienza del venditore resta**: se tirano troppo la corda tutti e due, **il giocatore non si
  muove e non lo prende nessuno**. Senza, l'asta sarebbe solo una gara di portafogli, cioè una
  meccanica in cui chi ha il club più ricco vince a prescindere.

### 5.2 Comprare i giocatori dell'altro — tre mosse, poi si chiude

`Negotiation` guadagna `counterpart: "ia" | "umano"`. Con un umano dall'altra parte, `ceiling` e
`patience` **non servono**: non c'è un limite nascosto da indovinare, c'è una persona che risponde.
Al loro posto una macchina a stati corta e decisa, esattamente come chiesto:

```
A offre  →  B riceve  →  ┬─ accetta            → operazione conclusa
                         └─ controfferta  →  A ─┬─ accetta → conclusa
                                                └─ rifiuta → TRATTATIVA SALTATA
```

**Una controfferta sola, e il rifiuto è definitivo.** La trattativa saltata resta saltata per tutta
la finestra — riusa `negotiationBlocked`, che esiste già proprio per impedire di riprovare finché
non esce il risultato voluto. In una sessione da dieci stagioni in tempo reale (§0bis②) questa
brevità non è un limite: è ciò che tiene la finestra di mercato di una lunghezza sopportabile.

Due cose non cambiano rispetto al single-player, ed è importante che non cambino:

- **il secondo accordo, quello col giocatore**: comprare da un umano richiede comunque la firma del
  contratto (`signIncomingPlayer`). Se il contratto salta, salta l'operazione e il giocatore resta
  dov'era — nessuna eccezione perché dall'altra parte c'è una persona;
- **rifiutare un'offerta costa morale**: il giocatore sapeva di essere cercato, e questo è vero
  tanto quanto lo era con un club IA.

### 5.3 Rubare il mister — stessa forma

Il meccanismo esiste già in forma IA: `COACH_POACH_HARMONY_THRESHOLD = 40`, `COACH_POACH_ODDS = 0.25`,
valutati **solo al rinnovo di inizio stagione**. Qui il tiro di dado lascia il posto alla stessa
macchina a tre mosse di §5.2, che è il motivo per cui questa meccanica non ha bisogno di regole sue:

- se la sintonia dell'altro col suo mister è sotto la soglia, il mister compare fra i corteggiabili;
- **passo 1**: A offre ingaggio e si accolla la buonuscita (`coachSeveranceNow`, già scritta);
- **passo 2**: B riceve la notizia e può **controffrire** — alzare l'ingaggio, o convincerlo con le
  garanzie del meeting;
- decide il mister, confrontando le due offerte con `renewalOfferScore` e la sintonia. Deterministico.

Il meccanismo esiste già in forma IA: `COACH_POACH_HARMONY_THRESHOLD = 40`, `COACH_POACH_ODDS = 0.25`,
valutati **solo al rinnovo di inizio stagione**. Qui il tiro di dado lascia il posto a una
decisione:

- se la sintonia dell'altro col suo mister è sotto la soglia, il mister compare fra i corteggiabili;
- A offre ingaggio e si accolla la buonuscita (`coachSeveranceNow`, già scritta);
- **B può controffrire** — alzare l'ingaggio, o convincerlo con le garanzie del meeting;
- decide il mister, confrontando le due offerte con `renewalOfferScore` e la sintonia. Deterministico.

---

## 6. Il 2D: solo derby e finali

`isKeyMatch` guadagna una variante multigiocatore che restringe invece di allargare:

- **ogni** incontro fra i due umani (campionato, Coppa Tricolore, Corona);
- le **finali** di Corona e Coppa Tricolore in cui c'è un umano.

Sparisce tutto il resto (scontri diretti con l'IA, volata scudetto, quarti e semifinali): in una
partita a due, la partita che conta è quella contro l'altro.

Il motore 2D (`matchSim.ts`) **non simula il risultato** — lo riceve già deciso e ci costruisce
attorno una partita coerente. Quindi in lockstep i due client mostrano **la stessa identica
partita**, senza alcuna sincronizzazione: proprietà gratuita di un'invariante già esistente.

**Ognuno la guarda per conto suo** (`D10` chiuso): sincronizzare l'orologio costerebbe parecchio per
un guadagno quasi nullo, dato che i due stanno già guardando la stessa identica partita. Resta la
presenza — *«\<nickname\> sta guardando»* — che è quasi tutto il valore della visione condivisa a una
frazione del costo.

---

## 7. Infrastruttura Supabase

```
mp_rooms      (id, code, host_user_id, seed, mode, difficulty, seasons,
               status, current_turn, created_at)
mp_seats      (room_id, seat_index, user_id, nickname, club_id,
               ready_turn, state_hash, last_seen)
mp_commands   (room_id, turn, seq, seat_index, user_id, kind, payload, created_at)
               unique(room_id, turn, seq)
mp_snapshots  (room_id, turn, season, state)
```

**RLS**: si legge una stanza solo se ci si è seduti; si inserisce un comando solo per **il proprio
seat** e solo per il **turno corrente** (un trigger lo verifica: senza, il seat A potrebbe scrivere
comandi a nome di B). `mp_commands` non ammette `update` né `delete` da nessuno: è un registro.

**Realtime**: `postgres_changes` su `mp_commands` per i **fatti** (è la stessa fonte autorevole che
verrà rigiocata, quindi non può divergere da ciò che si è visto); `broadcast` solo per l'**effimero**
(sta scrivendo, sta guardando la partita); `presence` per online/offline.

La separazione conta: **broadcast = chiacchiere, log = fatti**. Un messaggio di chat perso non fa
danni; un comando perso spaccherebbe la partita.

**Snapshot: rete di sicurezza, non modalità.** A ogni fine stagione si scrive lo stato completo.
Con la scelta "solo in tempo reale" (§0bis②) non serve più a riprendere domani, ma serve **di più**,
non di meno: una partita di dieci stagioni con entrambi collegati è lunga abbastanza da garantire
che prima o poi qualcuno perda la rete, chiuda il tab per sbaglio o riceva una telefonata.
Rientrare significa caricare l'ultimo snapshot e rigiocare i comandi da lì, non i dieci anni
dall'inizio.

Il fatto che la verità sia il log rende questa ripresa **quasi gratuita**: è una proprietà
dell'architettura, non un pezzo da costruire a parte. Se un domani si volesse riaprire il gioco
asincrono, non ci sarebbe nulla da riscrivere — solo da permetterlo.

---

## 8. Anti-cheat: cosa protegge e cosa no

Onestamente:

- il **log dei comandi** è sul server, append-only, e ogni riga è firmata dal seat che l'ha scritta:
  nessuno può giocare al posto dell'altro né riscrivere il passato;
- a ogni barriera ciascun client scrive l'**hash del proprio stato**: se i due divergono la partita
  si **congela** con un messaggio esplicito invece di proseguire su due realtà diverse. Questo
  intercetta sia i bug di determinismo sia le manomissioni ingenue;
- **non** protegge da chi modifica il motore in modo coerente su un client (potrebbe farsi vincere
  ogni partita e l'hash resterebbe... diverso, in realtà — quindi verrebbe colto; ma potrebbe
  falsificare informazioni che non entrano nell'hash, come il radar del mercato).

Questo è accettabile **a condizione che la modalità non alimenti punti livello né classifiche
globali** (`D11` chiuso: non lo fa), esattamente come già stabilito per la DS mode single-player. Se
un domani si volesse renderla competitiva/classificata, la strada è l'opzione A di §2 — un progetto
diverso e molto più grande.

Un caso che il mercato a due passi introduce e che va detto: al **passo 1 le offerte sono in cieco**,
quindi vivono nello stato di entrambi i client prima di essere rivelate. Un client modificato
potrebbe **leggerle in anticipo** — l'hash non se ne accorgerebbe, perché lo stato è corretto, è la
*visualizzazione* a essere disonesta. È il limite strutturale del lockstep: tutto ciò che è segreto
ma presente sul dispositivo dell'avversario è leggibile. Rimediarlo richiederebbe che il passo 1
vivesse solo sul server (una Edge Function per il solo mercato), che è l'unica parte del modello A
che varrebbe forse la pena recuperare. *(→ `D15`, da valutare dopo la fase 2, non ora)*

---

## 9. La UI, e il rischio di duplicazione

`CareerScreen.tsx` è 1.706 righe e `MarketPanel.tsx` 1.830, entrambe costruite attorno a *una*
carriera con callback che chiamano direttamente i riduttori. Ci sono due strade e una sola è
sostenibile.

Duplicarle per il multigiocatore significherebbe che ogni futura correzione alla DS mode va fatta
**due volte** — ed è precisamente l'errore che CLAUDE.md §9 registra come debito già pagato una
volta (`computeSquadStrength` che stava per diventare due copie divergenti della stessa formula
calibrata).

Proposta: estrarre un'interfaccia **`CareerActions`** — un oggetto di callback che le schermate
ricevono come prop. Il single-player la implementa chiamando i riduttori come oggi; il
multigiocatore la implementa **emettendo comandi**. Le schermate non sanno in quale modalità stanno.
È un rifacimento a rischio contenuto ma va fatto **prima**, e validato dal fatto che il
single-player continui a funzionare identico.

---

## 10. Decisioni aperte

| | Domanda | Raccomandazione |
|---|---|---|
| ~~D1~~ | ~~Le due squadre devono essere di forza comparabile?~~ | **Chiusa**: piena libertà, rating solo informativo (§0bis⑤) |
| ~~D2~~ | ~~Difficoltà unica per la stanza?~~ | **Chiusa**: sì, la sceglie chi crea (§0bis⑥) |
| ~~D3~~ | ~~Quante stagioni?~~ | **Chiusa**: dieci, sempre (§0bis②) |
| ~~D4~~ | ~~Gioco asincrono ammesso?~~ | **Chiusa**: no, solo tempo reale (§0bis②) |
| ~~D5~~ | ~~Cosa conta come trofeo?~~ | **Chiusa**: le tre coppe, promozione esclusa (§0bis③) |
| ~~D6~~ | ~~Ordine degli spareggi~~ | **Chiusa**: campionati → Corone → Tricolori → scontri diretti → punti (§0bis③) |
| ~~D7~~ | ~~Se uno viene eliminato~~ | **Chiusa**: l'altro vince subito (§0bis④) |
| ~~D8~~ | ~~Quando l'altro vede che stai trattando~~ | **Chiusa**: mercato a due passi, scoperta per bersaglio, poi asta (§5.1) |
| ~~D9~~ | ~~Limite di una trattativa fra umani~~ | **Chiusa**: offerta → controfferta → accetta/rifiuta, poi saltata (§5.2) |
| ~~D10~~ | ~~2D sincronizzato o ognuno per sé?~~ | **Chiusa**: ognuno per sé (§6) |
| ~~D11~~ | ~~Alimenta punti livello / classifiche?~~ | **Chiusa**: no (§8) |
| ~~D12~~ | ~~Timeout alla barriera~~ | **Chiusa**: timer 2-3 min se presente, pausa se disconnesso (§0bis⑨) |
| ~~D13~~ | ~~Fino a quando si aspetta un disconnesso?~~ | **Chiusa**: pausa protetta **72 ore**, oltre le quali l'altro può chiudere la partita a proprio favore |
| ~~D14~~ | ~~Il budget si impegna sulle offerte del passo 1?~~ | **Chiusa**: sì, la cifra offerta è vincolata finché l'offerta è aperta |
| ~~D15~~ | ~~Le offerte in cieco vanno protette lato server?~~ | **Rinviata a dopo la fase 2** — è l'unico punto in cui una Edge Function varrebbe il suo costo (§8) |

Nessuna decisione aperta: si può cominciare.

---

## 11. Fasi di lavoro

Ordinate per **rischio decrescente**, non per visibilità: la parte che non si vede è quella che può
far fallire tutto il resto.

**Fase 0 — La rete di sicurezza (nessuna funzionalità nuova). ✅ FATTA (2026-08-14).**

- **Falla tappata**: `aiWorld.ts` costruiva l'id delle notizie di mercato allenatori con un suffisso
  `Math.random()`. Non serviva a nulla — un club produce al più una notizia per stagione, quindi
  `club.id + season` è già univoco — ed era l'unica fonte di casualità non seedata sul percorso DS.
- **Audit dei PRNG di default**: i restanti `random = Math.random` stanno in `championship.ts` e
  `draft.ts`, che sono **solo Modalità Classica** e non raggiungibili dalla DS; l'unico su un
  percorso DS (`generateCoachPromises`) riceve già un PRNG seedato dal suo unico chiamante di
  produzione (`CoachNegotiationChat.tsx`). Nessun altro intervento necessario — e la garanzia forte
  non è comunque la firma di una funzione ma il test qui sotto, che coglie una fuga *ovunque* sia.
- **`dsDeterminism.test.ts`** (4 test): due mondi e due stati costruiti **indipendentemente** —
  cioè due client — avanzati con le stesse decisioni. Confronto di **stato e referto settimana per
  settimana**, di `advanceToNextStop`, e di una carriera intera stagione per stagione. Più la
  regressione diretta sull'id delle notizie.
- **Verificato che i test abbiano denti**, non solo che passino: reintroducendo la falla il test
  mirato diventa rosso, e iniettando una casualità nel percorso di `advanceWeek` i test di carriera
  la individuano **alla settimana esatta** con l'estratto della divergenza. Un test di determinismo
  che non è stato visto fallire non è una rete di sicurezza.

Due cose imparate scrivendolo, entrambe da errori miei nelle asserzioni e non del motore:
`league.round` **si azzera a fine stagione** (leggerlo dopo il `break` misura la stagione nuova e
dà sempre zero), e una carriera appena avviata ha spesso **già una decisione in sospeso**, quindi
`advanceToNextStop` si ferma subito con zero referti — comportamento corretto che però rende il
test vuoto se non lo si porta prima in un punto senza decisioni aperte.

Corretto per strada un **import duplicato con percorso rotto** in `helpers/dsWorld.ts` (`LeagueTeam`
importato due volte, la seconda da un percorso inesistente): invisibile a vitest, che con esbuild
non controlla i tipi.

**Fase 1 — Il mondo a due umani** (motore puro, zero rete).
`evolveWorld` plurale, `planWorldTransfers` che esclude entrambi, `simulateMatchday` a due seguiti
col ramo derby, campionato condiviso con ordinamento canonico, forze umane iniettate a ogni
giornata. Verifica: due carriere avanzate insieme per una stagione intera producono **una** classifica
coerente, e il derby è lo stesso fatto visto da due lati.

**Fase 2 — Il riduttore multigiocatore** (ancora zero rete).
`MpMatchState`, i comandi, la barriera, `applyMpCommand`, l'hash. Si prova con due seat in memoria
nello stesso test: è lì che si dimostra il lockstep, non nel browser.

**Fase 3 — Infrastruttura.** Tabelle, RLS, trigger di turno, Realtime, lobby con codice d'invito,
snapshot, riconnessione.

**Fase 4 — La UI.** Estrazione di `CareerActions` (§9), schermo multigiocatore, stato di attesa,
radar, doppia classifica.

**Fase 5 — Il mercato a due passi (§5).** La parte divertente, e la più grande dopo la fase 1: la
finestra si sdoppia in offerte e risoluzione, nascono l'asta e la trattativa fra umani, e il budget
impegnato cambia il modo in cui si spende. Viene per ultima perché poggia su tutte le altre — ma è
anche quella su cui vale la pena tornare a tarare dopo la prima partita vera (sovrapprezzo
d'ingresso all'asta, pazienza del venditore, quante offerte per passo).

**Fase 6 — Vittoria e spettacolo.** Trofei, condizioni di fine, 2D dei derby e delle finali,
schermata di trionfo a due (`TriumphScreen` + `shareCard` esistono già).

---

## 12. Rischi dichiarati

1. **Desync.** Il rischio numero uno. Mitigato dall'hash a ogni barriera, ma una divergenza a metà
   carriera si recupera solo ricaricando l'ultimo snapshot: va progettato **prima**, non dopo.
2. **Durata — il rischio principale di prodotto, accettato consapevolmente.** Dieci stagioni con
   entrambi collegati sono decine di barriere in un'unica sessione. Le contromisure previste
   (attesa produttiva, barriere raggruppate, timer visibile, ripresa dopo disconnessione) lo
   attenuano ma non lo tolgono. Se dopo la prima partita reale si rivelasse eccessivo, la leva è il
   **numero di stagioni** — un parametro, non un rifacimento: l'architettura non cambia di una riga.
3. **Costo di simulare due carriere per client.** Probabilmente trascurabile, ma **da misurare** in
   fase 1, non da assumere.
4. **Divergenza della UI** fra single e multi (§9): il motivo per cui l'estrazione di `CareerActions`
   è una fase e non un dettaglio.
5. **Il segreto sul dispositivo altrui.** Le offerte in cieco del passo 1 sono leggibili da un client
   modificato e l'hash non lo rileva (§8). Non è un difetto risolvibile dentro il lockstep: o si
   accetta, o quel singolo passo va sul server (`D15`).
6. **L'abuso della pausa.** Staccare la rete non deve diventare la mossa che salva sempre (`D13`).
7. **Ampiezza.** È di gran lunga il lavoro più grande fatto finora su questo progetto: infrastruttura
   di rete che oggi non esiste, un riduttore nuovo, un mercato a due passi, e modifiche a un motore
   da 5.400 righe già calibrato. Le fasi 0-2 sono le uniche che si possono stimare con onestà prima
   di averle fatte.
