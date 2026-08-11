# Piano unificato: **Spogliatoio, Contratti e Finanze**

> Documento di piano (non ancora implementato). Riscrive da zero il sistema di dialogo coi
> calciatori, introduce i contratti (durata annuale, ingaggi annui, rinnovi, svincoli, parametro
> zero) per la propria squadra, per le 95 squadre IA **e per gli allenatori**, e mette il DS a capo
> delle proprie finanze con una **ripartizione mercato/ingaggi decisa da lui**.
>
> **L'idea che unifica il tutto**: il contratto trasforma ogni giocatore — e ogni allenatore — in un
> **orologio**; la conversazione è l'unico modo di intervenire su quell'orologio; e la ripartizione
> delle finanze è la scelta che decide **con quali armi** puoi intervenire. Chi sposta tutto sul
> mercato compra cartellini ma non può permettersi i rinnovi; chi sposta tutto sugli ingaggi non
> compra nessuno ma vince le aste per i parametri zero e non perde mai un big a scadenza.

Regole fondative dichiarate dall'utente, non negoziabili nel seguito:

1. **Una conversazione può nascere solo da un fatto vero** — chi gioca sempre non può chiedere spazio.
2. **Ogni carriera deve essere unica**: mai gli stessi svincolati due carriere di fila.
3. **L'IA deve muoversi come un utente vero**, sfruttando le occasioni di mercato, non a caso.
4. **Ingaggi reali (variante B)**, **quello del mister incluso**.
5. **Il DS è padrone delle proprie finanze**: è lui a ripartire fra mercato e ingaggi.
6. **Tutto è annuale**: durate in stagioni intere, cifre proposte per anno.

---

# PARTE 0 — Le tre scoperte che vincolano il progetto

## 0.1 Il contratto va **derivato**, non salvato

CLAUDE.md § 3.7.10 e `aiWorld.ts` fissano il principio portante della DS mode: lo stato di 2.586
giocatori per dieci stagioni **non si salva**, si deriva dal seme. Invecchiamento, ritiri e regen
costano zero byte; solo i trasferimenti sono conservati, perché dipendono anche dall'utente.

Un sistema contratti ingenuo lo violerebbe: 2.586 record `{until, wage, signed}` ≈ 130 KB — oltre
il tetto dichiarato, da solo, prima del resto del salvataggio.

**La soluzione è la stessa già usata per l'età e i ritiri**:

```ts
// Zero byte. Deterministico per (seme di carriera, giocatore).
contractExpiryOf(playerId, birthDate, overall, careerSeed): number   // stagione di scadenza
baseWageOf(overall, age, clubPrestige): number                       // ingaggio annuo
```

Da questa singola riga discendono, senza altro codice, due proprietà richieste:

- **regola 2 soddisfatta per costruzione**: il seme è per carriera, quindi *chi* va in scadenza
  nella stagione 3 cambia da una carriera all'altra. Stesso database, svincolati diversi — non una
  lista di nomi a caso, ma lo stesso mondo reale che si sfalda in un ordine diverso;
- si salva **solo la decisione**, mai lo stato: `contractOverrides` contiene una riga per ciascun
  contratto **cambiato da qualcuno** (rinnovo mio, rinnovo IA, svincolo, firma a zero).

**Principio da scrivere in CLAUDE.md**: *il contratto è derivato, la decisione è salvata.*

## 0.2 Rischio già presente: il ledger del mondo è vicino al tetto dei 100 KB

Conto su `WorldTransfer` (`aiWorld.ts:50`) con `WORLD_TRANSFERS_PER_SEASON = 50`:

```
{"playerId":"<uuid 36>","playerName":"Marcus Thuram","fromClubId":"<uuid>",
 "toClubId":"<uuid>","fee":25000000,"season":3}          ≈ 175-190 byte
50 × 10 stagioni = 500 record  →  ~90 KB di solo ledger
```

Il salvataggio è **già oggi** al limite, prima di aggiungere qualunque cosa. **Fase 1 del piano
(obbligatoria, prima di tutto il resto)**: misurare la dimensione reale di un salvataggio a dieci
stagioni e compattare il ledger — via `playerName` e `fromClubId` (entrambi **derivabili**: sono
duplicazione, non informazione), formato a tupla `[playerId, toClubId, season, fee]`, riassunto per
stagione oltre le ultime due. Stima: **da ~180 a ~55 byte per riga**, da ~90 KB a ~28 KB. È ciò che
libera lo spazio per contratti e finanze: senza, il resto non ci sta.

## 0.3 L'IA non ha un bilancio, e coi parametri zero è insostenibile

`planWorldTransfers` (`aiWorld.ts:233`) **non ha alcun budget**: un club compra se trova un
giocatore migliore da un club più debole, punto. Con i parametri zero — dove la disponibilità
economica è *tutta* la partita — un'IA senza vincoli firmerebbe ogni svincolato interessante prima
di noi e la meccanica morirebbe. **L'IA con un bilancio (e un monte ingaggi) è un prerequisito.**

---

# PARTE 1 — Diagnosi del sistema conversazioni attuale

Difetti localizzati, col punto esatto nel codice.

### 1.1 Il difetto centrale — il motivo non nasce dai fatti

`openPlayerStandoff` (`career.ts:1809`) sceglie fra quattro motivi con tre `if` e un **fallback
generico**:

```ts
const reason = brokenTrust ? "tradito" : spinge ? "richiamato"
             : isTooGoodForBench(...) ? "vuole_giocare" : "scontento";
```

Chi non rientra nei primi tre diventa `"scontento"`, e per quel motivo `derivePlayerDemand`
(`playerStandoff.ts:178`) restituisce di default *"Richiede la conferma del suo ruolo principale da
titolare"*. **È esattamente il caso segnalato**: un titolare inamovibile con morale basso apre la
chat chiedendo di essere confermato titolare. La causa è strutturale — **il sistema non guarda mai
quanto uno gioca prima di decidere di cosa parlare**.

### 1.2 Il mister approva alla cieca

`applyPlayerStandoff` (`career.ts:1860`) passa `starterOverallInRole: 76`, **una costante scritta a
mano**: valuta la promessa di titolarità senza guardare chi c'è davvero in quel ruolo.

### 1.3 La conversazione che il gioco *impone* è quella scritta peggio

`openForcedStandoff` (`career.ts:2021`) non passa età, valore né offerta: personalità derivata su
un'età fittizia di 25 anni, richiesta economica su 5M finti, e per `"richiamato"` **la card
dell'offerta non compare mai**.

### 1.4 In stagione non si parla con nessuno

`apriStandoff` è passato **solo** a `MarketPanel` (`CareerScreen.tsx:929`).

### 1.5 Nessuna memoria

`brokenTrust` è l'unico ricordo e viene **cancellato alla conversazione successiva**
(`career.ts:1984`).

### 1.6 Mosse per motivo, non per situazione

`relevantMoves(reason)` non guarda i fatti: il leader chiede sempre `department: "ATT"`,
**hardcoded** (`playerStandoff.ts:172`).

### 1.7 Codice morto e triplicazione

`playerTalks.ts` (esportato, testato, **mai usato**), `events.ts::resolveTransferRequest` (morto), e
**tre canali per lo stesso concetto "promessa"**: `minutesPromises`, `playerPromises`,
`coachPromises`.

### 1.8 UI

Barra etichettata **"Tensione"** che mostra la **pazienza** (`PlayerStandoffChat.tsx:151`): verde
quando è alta, cioè quando la tensione sarebbe bassa. Mosse senza costo dichiarato. Nessuna traccia
visibile delle promesse contratte. Refuso `"But non deludetemi"` (`playerStandoff.ts:462`).

### 1.9 Il mister ha un'economia finta

`Coach.hireCost` (8,5M per un top, 4,2M per l'ultimo) è oggi un **costo una tantum** e `severance` un
numero fisso: pagare 8,5M una volta e tenerselo dieci stagioni. Non esiste una durata, quindi non
esiste una scadenza, quindi non esiste un rinnovo — e `computeCoachBuyoutFee` (`coaches.ts:536`) è
**scritta e mai usata**, perché senza contratto non c'è nulla da rilevare.

---

# PARTE 2 — Le finanze: un'unica cassa, due destinazioni, e sei tu a decidere

## 2.1 Il cambiamento concettuale

Oggi `budget.ts` produce **un** numero: il budget di mercato. Da qui in poi produce il
**fatturato stagionale**, e il DS lo ripartisce fra due casse:

```
                    FATTURATO STAGIONALE  110 M
                    (initialBudget / nextSeasonBudget, invariati nel calcolo)
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
        CASSA MERCATO 62 M                CASSA INGAGGI 48 M / anno
        cartellini, prestiti,             stipendi giocatori
        premi alla firma,                 + STIPENDIO DEL MISTER
        buonuscite                        + adeguamenti e rinnovi
```

**Perché è la scelta giusta di prodotto**: risolve da sola il rischio principale del sistema
contratti. Temevo che i parametri zero svuotassero di senso il budget, che è oggi l'unica leva della
difficoltà (`budget.ts`, CLAUDE.md § 3.7.11). Con la ripartizione, un parametro zero **non è
gratis**: non costa cartellino ma consuma cassa ingaggi, e quella cassa l'hai riempita togliendo
soldi al mercato. Il compromesso diventa esplicito, visibile e **tuo**, invece di essere un
parametro nascosto che devo tarare per te.

Ne nascono due stili di gioco legittimi e diversi, che è esattamente ciò che rende una scelta
interessante:

| Stile | Ripartizione | Come vince | Come perde |
|---|---|---|---|
| **Compratore** | mercato alto | prende cartellini, rivende con plusvalenza | non regge i rinnovi: perde i big a zero |
| **Contrattista** | ingaggi alti | vince le aste dei parametri zero, blinda tutti | non ha liquidità per il colpo che serve a gennaio |

## 2.2 Le regole della ripartizione (cinque, non una di più)

1. **Si sposta solo a finestra di mercato aperta.** È una decisione di bilancio, non una leva da
   girare a metà partita. In estate liberamente, a gennaio con un limite (§ 2.3).
2. **Pavimento invalicabile**: la cassa ingaggi non può scendere sotto gli **impegni già firmati**.
   Non puoi definanziare contratti in essere — lo slider si blocca lì, con l'importo scritto.
3. **Tetto morbido, non divieto.** Puoi *sforare* la cassa ingaggi firmando oltre: la differenza si
   sottrae dal fatturato della stagione successiva. Conseguenza, non impedimento — stessa filosofia
   già adottata per la dimensione della rosa (CLAUDE.md § 3.7.5).
4. **Ciò che liberi torna disponibile**: vendere o svincolare un giocatore libera il suo ingaggio
   nella cassa ingaggi; quello spazio si può spostare sul mercato **alla finestra successiva**, non
   subito (altrimenti la ripartizione sarebbe un cursore da riportare a zero ogni volta).
5. **La cassa mercato non si consuma da sola**: ciò che non spendi confluisce nel `CARRY_OVER_SHARE`
   già esistente (30%). La cassa ingaggi invece **si azzera e si ricalcola** ogni stagione: gli
   stipendi sono una spesa ricorrente, non un salvadanaio.

## 2.3 Lo slider

```
┌─────────────────────────────────────────────────────────────┐
│  FINANZE DELLA STAGIONE                Fatturato  110,0 M   │
│                                                             │
│   MERCATO                                       INGAGGI     │
│   62,0 M                                     48,0 M / anno  │
│   ◀━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━▶     │
│                     ╎                                       │
│                     ╎ impegni firmati: 41,2 M  ← non oltrepassabile
│                                                             │
│   Monte ingaggi   41,2 / 48,0 M      margine  6,8 M         │
│   ├ giocatori (24)                            36,7 M        │
│   └ allenatore  M. Rossi (fino al 2029)        4,5 M        │
│                                                             │
│   ⓘ Sposti 8M sugli ingaggi: potrai rinnovare Barella       │
│     (+1,3M) e firmare due svincolati di fascia media.       │
└─────────────────────────────────────────────────────────────┘
```

Dettagli che decidono se lo strumento è usabile o frustrante:

- **anteprima in tempo reale**: mentre trascini, sotto compare cosa quella cifra ti permette *davvero*
  (quanti rinnovi in sospeso copre, quanti svincolati di quale fascia). Un numero astratto non aiuta
  a decidere; "ti basta per Barella" sì;
- **il pavineto degli impegni è disegnato sul binario** (la tacca `╎`), non nascosto in un errore
  dopo il rilascio;
- **a gennaio lo spostamento è limitato al ±25%** della ripartizione estiva: rifare il bilancio a
  metà anno non è realistico, ma un aggiustamento per un'emergenza sì;
- **avviso di sforamento** esplicito, con l'importo che verrà tolto l'anno prossimo — mai una
  sorpresa a fine stagione.

## 2.4 Gli ingaggi: derivati, annuali, e con un solo parametro da tarare

```ts
// packages/game-engine/src/ds/contracts.ts
export function baseWageOf(overall: number, age: number, clubPrestige: number): number;  // €/anno
export const WAGE_BILL_RATIO = 0.45;   // quota di fatturato suggerita dagli ingaggi (default dello slider)
```

Gli ingaggi sono **derivati** come i contratti (zero byte) e **annuali**, come richiesto: ogni cifra
mostrata nel gioco è per anno, mai un totale opaco. Dove serve il totale, si mostrano entrambi:

```
5,5 M/anno × 4 anni  =  22,0 M complessivi
```

Curva proposta (placeholder di bilanciamento **dichiarato**, da tarare con `pnpm calibrate-contratti`):
esponenziale sull'Overall come già fa `marketValue.ts`, moltiplicata per prestigio del club e ridotta
per i giovanissimi. Riferimento: un 90 in un club di prestigio 5 sta intorno agli **8-11 M/anno**, un
72 in un club di prestigio 2 intorno ai **600-900 k/anno** — così il monte ingaggi di una rosa vera
risulta grosso modo il 40-50% del fatturato, che è il rapporto che rende sensato il default dello slider.

---

# PARTE 3 — I contratti dei giocatori

## 3.1 Il modello (tutto annuale)

```ts
export interface Contract {
  /** Ultima stagione di validità: alla sua fine, se non rinnovato, è svincolato. */
  until: number;
  /** Ingaggio ANNUO. */
  wage: number;
  signedSeason: number;
  /** Clausola di rescissione: chi la paga se lo prende senza trattare. */
  releaseClause?: number;
  /** Le clausole sono impegni Spogliatoio a tutti gli effetti (§ 5.4). */
  clauses?: CommitmentKind[];
}

export type ContractStatus =
  | "lungo"        // ≥ 2 stagioni residue
  | "in_scadenza"  // ultima stagione: rinnova, vendi, o lo perdi
  | "precontratto" // ultima stagione + finestra invernale: può già firmare altrove
  | "svincolato";
```

**La durata si misura in stagioni intere** (1-5): niente mesi, niente frazioni. È coerente con un
motore che avanza per giornate e stagioni, e rende la scelta leggibile — "tre anni" è una decisione,
"trenta mesi" è rumore.

## 3.2 La stagione dell'orologio

| Momento | Cosa succede |
|---|---|
| **Estate (mercato)** | Ripartizione finanze (slider). Rinnovi, svincolati, acquisti. Chi è all'ultimo anno va deciso adesso |
| **Autunno (g. 1-12)** | Chi rende sopra le attese **chiede il rinnovo** → conversazione |
| **Inverno (riparazione)** | **Precontratti**: i club IA legano a sé i miei in scadenza a zero per la stagione dopo. Ultima occasione per venderlo e incassare |
| **Primavera (g. 25-38)** | Chi ha rifiutato annuncia l'addio: morale della squadra, e per il DS la certezza della perdita |
| **Fine stagione** | I contratti scadono: chi non è stato rinnovato esce a zero, e **si forma il pool svincolati dell'anno dopo** |

Questo calendario risponde anche a un problema che avevi già segnalato: **le settimane fra un mercato
e l'altro non hanno niente da decidere**. Con i contratti, le trentotto giornate hanno una scadenza
che avanza.

## 3.3 Derivazione delle durate

| Profilo | Durata iniziale | Effetto voluto |
|---|---|---|
| ≥ 32 anni | 1-2 stagioni | I veterani sono la maggioranza degli svincolati: realistico, poco squilibrante |
| 29-31 | 2-3 | |
| 24-28, Overall ≥ 82 | 4-5 | I fuoriclasse nel pieno **non** finiscono a zero facilmente |
| 24-28, Overall < 82 | 2-4 | La fascia media è dove stanno le occasioni vere |
| ≤ 23 | 3-5 | Rubare un giovane a zero dev'essere raro e memorabile |

**Bersaglio da verificare con un test**: 9-14% del mondo in scadenza ogni stagione (≈ 230-360
giocatori), di cui **40-70 interessanti** (Overall ≥ 72).

## 3.4 Il pool svincolati: quattro sorgenti, tutte seedate

| Sorgente | Come nasce | Perché serve |
|---|---|---|
| **1. Contratti scaduti non rinnovati** | derivata (§ 3.3) + decisione IA (§ 6) | La principale: nomi **veri**, diversi in ogni carriera |
| **2. Svincoli** (rescissioni) | l'IA libera chi è fuori dai piani o pesa troppo sul suo monte ingaggi | Dà svincolati anche a metà contratto |
| **3. Regen senza squadra** | `generateName`, macchina già esistente con unicità dei nomi | Copre i ruoli lasciati scoperti dal caso |
| **4. Il caso clamoroso** | 1-3 a stagione: un forte in rottura totale col club rescinde | La notizia che rende memorabile una carriera. Raro di proposito |

**Uniche per carriera** perché tutte derivano da `derivedRandom(careerSeed, ...)`. Test: *due semi
diversi → sovrapposizione delle liste < 30%*.

**Il pool si consuma e decade**, altrimenti sarebbe un negozio sempre aperto:
- **decadimento**: −1 Overall a finestra da svincolato, fino a −4. Chi è ancora libero a gennaio non
  è lo stesso giocatore di agosto;
- **concorrenza**: i club IA firmano, e il colpo migliore **sparisce** se non lo prendi subito.

## 3.5 La trattativa con lo svincolato: dove si vede l'abilità del DS

Un parametro zero non costa cartellino: **il portafoglio non decide, decide chi convince**. Il
giocatore valuta le offerte su cinque assi, pesati dalla **sua** personalità (già in `types.ts`):

| Asse | Cosa offri | Chi lo pesa di più |
|---|---|---|
| **Ingaggio annuo** | cifra/anno — pesa sulla cassa ingaggi | `mercenario` |
| **Durata** | 1-5 anni | `professionista`, i veterani |
| **Minuti garantiti** | titolarità o rotazione — **è un impegno verificato** (§ 5.4) | `giovane_ambizioso` |
| **Ambizione** | Corona, piazzamento promesso | `leader` |
| **Ruolo** | capitano, rigorista, perno del progetto | `leader`, `insofferente` |

```
      IL COLPO A PARAMETRO ZERO
      ─────────────────────────
      Real Madrid  ── 9M/anno, 5 anni, zero minuti garantiti ──▶  punteggio 71
      Il tuo club  ── 5M/anno, 3 anni, TITOLARE + capitano   ──▶  punteggio 78  ✔
```

**È la meccanica che risponde a "deve mostrare l'abilità del DS"**: una piccola strappa un giocatore
a un club più ricco offrendo ciò che il ricco non può offrire — il campo. E siccome i minuti
garantiti sono un impegno verificato, **quel colpo è anche un debito**: tenerlo poi in panchina
produce la rottura, con gli interessi.

## 3.6 Precontratti: il mercato invernale cambia natura

Nella finestra di riparazione, chi è all'ultima stagione può firmare altrove per la stagione
successiva a costo zero.

- **Sui miei**: arriva la notizia → si apre la **conversazione** per convincerlo a rinnovare (§ 5).
  Se fallisce, la scelta è brutale e giusta: venderlo subito per qualcosa, o tenerlo fino a giugno e
  perderlo a zero. **È la decisione più bella che il sistema contratti porta in dote.**
- **Sugli altrui**: posso essere io a fare il colpo. Nuova scheda "In scadenza nel mondo" nella
  ricerca di mercato.

---

# PARTE 4 — I contratti degli allenatori

Il mister entra nello stesso sistema dei giocatori, con le stesse quattro proprietà: **durata annuale,
ingaggio annuo, rinnovo, promesse contrattuali**.

## 4.1 Reinterpretazione di ciò che esiste già

| Oggi | Da qui in poi |
|---|---|
| `Coach.hireCost` — costo una tantum (4,2-10 M) | **ingaggio annuo** del mister. Le cifre attuali sono già plausibili come stipendio annuo di un tecnico: nessuna nuova tabella da inventare |
| `Coach.severance` — numero fisso | **derivata**: `stagioni residue × ingaggio × SEVERANCE_SHARE`. Esonerare uno appena rinnovato per quattro anni costa moltissimo; uno all'ultimo anno quasi nulla |
| `severanceCost(coach, giornate, totali)` | resta, ma scala **su stagioni residue + frazione di stagione in corso** |
| `computeCoachBuyoutFee` — **scritta e mai usata** | finalmente ha senso: è ciò che paghi per **strappare** un mister sotto contratto a un altro club |
| `seasonNegotiationDone` + `CoachNegotiationChat` | diventano il **tavolo del rinnovo**, non solo un elenco di richieste |

## 4.2 Il modello

```ts
export interface CoachContract {
  coachId: string;
  until: number;         // stagione finale
  wage: number;          // ANNUO, confluisce nel monte ingaggi (§ 2.3)
  signedSeason: number;
  /** Le promesse contratte alla firma diventano clausole verificabili (§ 5.4). */
  clauses: Commitment[];
}
```

## 4.3 Alla firma si negozia un pacchetto, non si preme un tasto

```
┌─── INGAGGIO ALLENATORE — Marco Rossi ────────────────┐
│ Reputazione ★★★★☆   ·   3-5-2   ·   Gegenpressing    │
│                                                       │
│  Ingaggio      4,5 M/anno   [ − ][ + ]                │
│  Durata        3 anni       [ − ][ + ]                │
│                ↳ 13,5 M complessivi                   │
│                ↳ buonuscita se lo esoneri subito: 8,1M│
│                                                       │
│  LE SUE RICHIESTE CONTRATTUALI                        │
│  • un esterno destro entro fine mercato   [negoziabile]│
│  • Barella intoccabile                 [imprescindibile]│
│  • non svendere il monte ingaggi          [flessibile] │
│                                                       │
│  Pazienza ███████░░░ 66                               │
│  "Un anno solo non mi basta per costruire nulla."     │
└───────────────────────────────────────────────────────┘
```

**La durata è una vera scelta a due facce**, ed è la parte che rende il contratto del mister
interessante invece che burocratico:

| | Contratto lungo (4-5 anni) | Contratto corto (1-2 anni) |
|---|---|---|
| Ingaggio richiesto | **più basso** (vuole sicurezza) | più alto (si copre dal rischio) |
| Se lo esoneri | buonuscita **pesantissima** | quasi gratis |
| Rischio di scippo | protetto: serve il `buyoutFee` | **alto**: a scadenza se ne va gratis |
| Sintonia | parte più alta (progetto condiviso) | parte più bassa |

Così le due strategie sono entrambe difendibili: blindare un tecnico bravo costa poco all'anno ma ti
lega; tenerlo a scadenza ti lascia libero ma lo espone al corteggiamento (`COACH_POACH_ODDS`, già
esistente, va **legato al contratto** invece che alla sola sintonia: un mister con quattro anni
davanti non lo porta via nessuno senza pagare).

## 4.4 Rinnovo, scadenza, carosello

- **Rinnovo**: nella "sveglia di inizio stagione" già esistente. Se ha fatto bene, chiede di più e
  può pretendere più garanzie; se ha fatto male, sei tu ad avere il coltello dalla parte del manico.
  Riusa `CoachNegotiationChat`, che ha già pazienza, mosse e mediazione (`proposePromiseCompromise`).
- **Scadenza non rinnovata**: a fine stagione **se ne va a zero** ed entra nel pool degli allenatori
  liberi. Perdere un buon tecnico per distrazione dev'essere possibile quanto perdere un giocatore.
- **Il carosello IA**: `aiCoaches.ts` guadagna le scadenze — i club IA rinnovano, lasciano andare,
  esonerano pagando la buonuscita. Il risultato è che **il pool degli allenatori liberi cambia ogni
  stagione**, quindi anche la scelta del mister diventa diversa in ogni carriera (regola 2 estesa
  alle panchine).
- **Le sue promesse sono clausole**: ciò che concordi alla firma finisce in `commitments` come
  qualunque altra promessa, con la stessa verifica. Sparisce così il terzo canale separato
  (`coachPromises`, § 1.7).

---

# PARTE 5 — Il sistema Spogliatoio, riscritto e agganciato a contratti e finanze

Quattro livelli. Il livello 2 è quello che oggi **non esiste** ed è la ragione del caso assurdo.

```
   CareerState + CareerWorld + CONTRATTI + FINANZE
            │
            ▼
   ┌──────────────────────┐
   │ 1. FATTI             │  playerFacts.ts — cosa è VERO adesso
   ├──────────────────────┤
   │ 2. TEMI              │  playerTopics.ts — argomenti con PRECONDIZIONI VINCOLANTI
   ├──────────────────────┤
   │ 3. DIALOGO           │  playerDialogue.ts — turni, pazienza, fiducia, mosse, esiti
   ├──────────────────────┤
   │ 4. CONSEGUENZE       │  commitments.ts — impegni verificabili, feudi, contagio
   └──────────────────────┘
```

## 5.1 Livello 1 — I fatti (`ds/playerFacts.ts`)

Funzione pura, sola lettura.

```ts
export interface PlayerFacts {
  /* identità */ playerId; name; role; secondaryRoles; department; age; overall; potential; marketValue;
  /* impiego  */ playedShare; appearances; startsShare; lastSeasonPlayedShare?;
                 isGuaranteedStarter; isCoachBenched; isCoachUntouchable;
                 bestRivalOverallInRole;   // ← sostituisce il 76 hardcoded (§ 1.2)
                 depthInRole;
  /* rendimento */ goals; assists; per90; overUnderPerformance;
  /* squadra  */ squadAverage; positionsBelowTarget; teamFormLast5;
  /* carriera */ seasonsAtClub; arrivedThisSeason; isRegen;
  /* stato    */ morale; fatigue; injuryMatchdaysLeft;
  /* mercato  */ incomingOffer?; isOnTransferList; isOnLoanList; keyTeammateSold?;
  /* CONTRATTO */ contract: { until; wage; seasonsLeft; status };
                  wageVsPeers;              // quanto guadagna rispetto a chi ha il suo Overall in rosa
                  renewalDemand?: RenewalTerms;
                  preContractSuitor?: { clubId; clubName; prestige };
  /* FINANZE  */ wageRoomLeft;              // margine della cassa ingaggi: decide cosa PUOI offrire
  /* rapporto */ trust; openCommitments; brokenCommitments; lastTalkedWeek?; isFeuding;
  /* mister   */ coachHarmony; personality;
}
```

Due punti non ovvi:

- `playedShare` va **normalizzato per gli infortuni**: chi è stato fuori dieci giornate non ha
  "giocato poco per scelta del mister". Senza, ogni infortunato lungo aprirebbe un caso di minutaggio;
- `wageRoomLeft` entra nei fatti perché **le mosse economiche devono sapere se sono possibili prima
  di essere mostrate**: è ciò che permette alla UI di disabilitare "adegua l'ingaggio" con la cifra
  scritta invece di farla fallire dopo il clic.

## 5.2 Livello 2 — I temi, con precondizioni vincolanti (`ds/playerTopics.ts`)

```ts
export interface Topic {
  id: TopicId;
  eligible: (f: PlayerFacts) => boolean;   // se false, IL TEMA NON PUÒ APRIRSI. Punto.
  urgency: (f: PlayerFacts) => number;
  demand: (f: PlayerFacts) => PlayerDemand;
  moves: DialogueMoveKind[];
  opening: (f: PlayerFacts) => string;     // testo coi numeri veri dentro
}
```

### Catalogo — temi di campo

| # | Tema | Precondizione | Chiede |
|---|---|---|---|
| 1 | **poco_impiego** | `playedShare < 0.30` **e** ≥ 6 giornate disponibili **e** non infortunato lungo **e** `!arrivedThisSeason` | minuti |
| 2 | **gerarchia_persa** | `lastSeasonPlayedShare ≥ 0.60` **e** `playedShare < 0.45` | spiegazioni / titolarità |
| 3 | **corteggiato** | offerta sul tavolo **e** tiro su `offerPushProbability` | valutare l'offerta |
| 4 | **ambizione_progetto** | `playedShare ≥ 0.55` **e** (sotto obiettivo di ≥4 **o** `overall ≥ squadAverage + 6`) | rinforzi veri |
| 5 | **riconoscimento** | rende sopra le attese **e** `seasonsAtClub ≥ 2` **e** `wageVsPeers < 1` | adeguamento |
| 6 | **leadership** | `leader` **e** `seasonsAtClub ≥ 3` **e** non già capitano | fascia, voce in capitolo |
| 7 | **promessa_infranta** | `brokenCommitments > 0` non affrontata | riparazione o cessione |
| 8 | **bivio_mister** | (garantito ∨ intoccabile ∨ `coachBenched`) **e** `coachHarmony < 45` **e** `morale < 45` | scegli me o lui |
| 9 | **giovane_crescita** | `age ≤ 21` **e** `potential − overall ≥ 6` **e** `playedShare < 0.35` | prestito o minuti |
| 10 | **sovraccarico** | `fatigue ≥ 78` **e** `playedShare ≥ 0.8` | rotazione |
| 11 | **compagno_ceduto** | ceduto un compagno di reparto con Overall ≥ suo − 2 | garanzie sul progetto |
| 12 | **disciplina** | incidente aperto | *aperto dal DS*, non da lui |

### Catalogo — temi di contratto

| # | Tema | Precondizione | Chiede |
|---|---|---|---|
| 13 | **rinnovo_richiesto** | `seasonsLeft ≤ 2` **e** rende sopra le attese **e** `wageVsPeers < 1` | adeguamento + prolungamento |
| 14 | **ultimo_anno** | `seasonsLeft ≤ 1` **e** nessun rinnovo in trattativa | chiarezza sul futuro |
| 15 | **precontratto** | `preContractSuitor` presente (finestra invernale) | *"ho un accordo pronto: convincetemi"* |
| 16 | **rifiuto_rinnovo** | rinnovo già rifiutato una volta | andarsene a zero, o il prezzo sale |
| 17 | **addio_annunciato** | ultimo anno + rinnovo fallito + primavera | saluto: nessuna via d'uscita |
| 18 | **svincolato_in_arrivo** | trattativa con un parametro zero | i cinque assi del § 3.5 |
| 19 | **veterano_ultimo_contratto** | `age ≥ 33` **e** `seasonsLeft ≤ 1` | un anno da mentore, o l'addio |
| 20 | **squilibrio_ingaggi** ✦ | scopre di guadagnare molto meno di un compagno di pari livello arrivato dopo | parità di trattamento |

Il tema 20 è figlio diretto dello slider: appena gli ingaggi diventano una risorsa che il DS
distribuisce, **come li distribuisce diventa un fatto sociale dello spogliatoio**. Pagare troppo un
nuovo arrivato ha un costo che non sta solo nel bilancio.

**Tier A (prima consegna)**: 1-9, 13-15, 18. **Tier B**: il resto. Il catalogo è una tabella:
aggiungere una riga non tocca il motore.

### Le due regole che rendono impossibile il caso assurdo

1. **Se `eligibleTopics(f)` è vuoto, la conversazione non si apre.** Sparisce `"scontento"` come
   categoria residuale: è il buco da cui usciva il titolare che chiede la titolarità.
2. **Nessuna mossa può concedere ciò che il giocatore ha già** (filtro trasversale, § 5.3).

**Test bloccante, da scrivere per primo**:

```ts
it("un titolare fisso non riceve mai un tema di minutaggio", () => {
  // playedShare 0.92, titolare garantito, morale 20 (arrabbiato per la classifica)
  const temi = eligibleTopics(facts).map(t => t.id);
  expect(temi).not.toContain("poco_impiego");
  expect(temi).not.toContain("gerarchia_persa");
  expect(temi).not.toContain("giovane_crescita");
});
```

E il duale, altrettanto necessario — un sistema che non fa mai parlare nessuno passerebbe il primo:

```ts
it("un panchinaro forte apre sempre un caso di minutaggio", ...);
it("su 3 stagioni si aprono fra 6 e 14 conversazioni", ...);
```

## 5.3 Livello 3 — Il dialogo (`ds/playerDialogue.ts`)

Sostituisce `playerStandoff.ts`. **Non è persistito** (oggi vive solo come stato React): riscrittura
libera, nessuna migrazione dei salvataggi per questa parte.

### Due risorse invece di una

| | Cos'è | Dove vive | Come si muove |
|---|---|---|---|
| **Pazienza** | quanto regge *questa* conversazione | nel dialogo | scende a ogni mossa; ripetere la stessa raddoppia il costo |
| **Fiducia** | quanto crede alla tua parola **fra** le conversazioni | `relationships[id].trust`, salvata | sale mantenendo, crolla infrangendo |

```ts
patienceIniziale = clamp(0.5 * morale + 0.5 * trust, 10, 90)
```

### Le mosse dichiarano il proprio costo

```ts
export interface DialogueMove {
  kind: DialogueMoveKind;
  label: string;
  cost: string;              // "−1,3 M/anno sulla cassa ingaggi", "Richiede l'OK del mister"
  disabledReason?: string;   // mai un bottone morto e muto
  commitment?: { kind: CommitmentKind; verifyAt: "matchday" | "window" | "season"; deadline: number };
  risk?: "nessuno" | "medio" | "rottura";
}
```

| Mossa | Effetto | Impegno | Rischio |
|---|---|---|---|
| `ascolta` ✦ | +pazienza, rivela un fatto in più | — | nessuno |
| `rassicura` | morale + | — | nessuno |
| `garantisci_titolarita` | **OK del mister sul rivale vero** | minuti (a giornata) | rottura se rifiuta |
| `prometti_rotazione` ✦ | mezza via | minuti (soglia bassa) | medio |
| `premio_denaro` | **cassa mercato** −X, X mostrato prima | — | nessuno |
| **`adegua_ingaggio`** ✦ | **cassa ingaggi** −X/anno, per gli anni residui | — | nessuno |
| **`offri_rinnovo`** ✦ | apre il tavolo contratto (§ 5.5) | contratto | medio |
| **`clausola_addio`** ✦ | rinnova con clausola bassa: resta ora, parte l'anno prossimo | contratto | nessuno |
| `promessa_rinforzo` | reparto **suggerito dai fatti** | acquisto (a finestra) | medio |
| `promessa_trionfo` | ambizione | piazzamento (a stagione) | medio |
| `nomina_capitano` ✦ | `captainId`, uno solo | — | frizione col capitano attuale |
| `concedi_riposo` ✦ | fuori N giornate | — | nessuno |
| `lista_cessione` / `concedi_prestito` / `prometti_trattativa_cessione` / `accetta_cessione` | come oggi | — | — |
| `multa_disciplina` / `scegli_giocatore` / `scegli_mister` / `ignora` | come oggi | — | rottura |

La distinzione fra `premio_denaro` (una tantum, **cassa mercato**) e `adegua_ingaggio` (ricorrente,
**cassa ingaggi**) è il punto in cui lo slider entra nella conversazione: se hai messo tutto sul
mercato puoi comprare il silenzio una volta sola, ma non puoi permetterti di **tenerlo**.

### Il filtro trasversale (seconda regola anti-assurdo)

- `garantisci_titolarita` → disabilitata se già garantito, o se `playedShare > 0.75`
  (*"Gioca già praticamente sempre"*);
- `adegua_ingaggio` / `offri_rinnovo` con cifra oltre `wageRoomLeft` → disabilitata **con il margine
  scritto** (*"Restano 0,4 M/anno di margine: sposta le finanze o vendi prima"*);
- `offri_rinnovo` → disabilitata se `seasonsLeft ≥ 3` (*"Ha ancora tre anni: non ha motivo di
  ridiscuterne"*) — l'equivalente contrattuale del caso assurdo dei minuti;
- `promessa_rinforzo` → reparto davvero scoperto, col numero di uomini;
- `lista_cessione` → disabilitata se già in lista; sconsigliata se `arrivedThisSeason`;
- qualunque promessa → disabilitata se ne ha già una **aperta dello stesso tipo**.

### Gli esiti, e le conseguenze nette

| Esito | Conseguenze |
|---|---|
| **riappacificato** | morale +15/+25, `trust` +10, tregua 8 giornate. Se `leader`: **+3 morale al reparto** |
| **accordo** | come sopra, ma `trust` **non sale finché la promessa non è mantenuta** |
| **stallo** | morale −5, `trust` −5, il tema resta ammissibile: chiudere la finestra non risolve |
| **rottura** | morale ≤15, `trust` → 0, `feud`: malus maggiorato, **pazienza dimezzata a vita**, pretende la cessione ogni finestra, perde la titolarità garantita. Se leader: **−4 a tutto lo spogliatoio**. Se intoccabile del mister: `coachHarmony −15` |
| **bivio** | la scelta a due vie, ora raggiungibile anche in stagione |
| **rinnovo_firmato** ✦ | contratto aggiornato, monte ingaggi aggiornato, `trust` +15, morale +20 |
| **rinnovo_rifiutato** ✦ | entra in stato "andrà a zero": temi 16/17 in primavera, precontratti a gennaio |

## 5.4 Livello 4 — Impegni unificati (`ds/commitments.ts`)

Sostituisce i **tre** canali del § 1.7 e ospita le clausole contrattuali di giocatori **e mister**.

```ts
export type CommitmentKind =
  | "minuti" | "rinforzo" | "cessione" | "trionfo" | "riposo" | "capitano"
  | "rinnovo_promesso" | "clausola_titolarita" | "clausola_addio"
  | "coach_rinforzo" | "coach_intoccabile" | "coach_disciplina_budget";

export interface Commitment {
  id; playerId?: string; coachId?: string; kind: CommitmentKind;
  verifyAt: "matchday" | "window" | "season";
  deadline: number;
  payload?: { department?; minMatches?; minPosition?; wage? };
  madeSeason; madeWeek;
}
export function verifyCommitments(state, world, when): { kept; broken; moraleDelta; trustDelta; harmonyDelta; messages };
```

Aggiungere una promessa nuova diventa **una riga di catalogo** invece di un quarto canale con la
verifica sparsa in `career.ts`. Ed è il punto in cui i tre sistemi si saldano: le clausole firmate
con uno svincolato, quelle concordate col mister e le promesse fatte in chat vivono nello stesso
registro e si verificano allo stesso modo.

## 5.5 Il tavolo del rinnovo: dove Spogliatoio, Contratti e Finanze si incontrano

Non un sistema nuovo: **estende `negotiation.ts`**, che ha già pazienza, mosse, chat e UI.

```ts
export type NegotiationKind = "acquisto" | "cessione" | "prestito" | "rinnovo" | "svincolato" | "rinnovo_mister";
```

Non si negozia **una** cifra ma **un pacchetto**:

```
┌─── RINNOVO — Nicolò Barella ──────────────────────────┐
│ Attuale: scade 2027 · 4,2 M/anno                      │
│                                                       │
│  Ingaggio    4,2 ──[ − ][ + ]──▶  5,5 M/anno          │
│                                   ⚠ margine cassa: 6,8M│
│  Durata      2 ───────────────▶  4 anni               │
│                                   ↳ 22,0 M complessivi│
│  Clausola    nessuna ─────────▶  60 M                 │
│  Titolarità  [ ✔ garantita ]     ← impegno vero       │
│  Ruolo       [ capitano ]                             │
│                                                       │
│  Pazienza ██████░░░░ 58                               │
│  "L'ingaggio ci siamo. Ma se non sono titolare,       │
│   questa firma non ha senso."                         │
└───────────────────────────────────────────────────────┘
```

Il giocatore valuta il pacchetto con la **sua** scala (personalità), non con una soglia unica: al
`mercenario` interessa la cifra, al `giovane_ambizioso` i minuti, al `leader` il ruolo. È la ragione
per cui la personalità, oggi quasi decorativa, diventa un'informazione che il DS deve **leggere**
prima di sedersi.

---

# PARTE 6 — L'IA che si comporta come un direttore sportivo

## 6.1 Profilo strategico del club — derivato, zero byte

```ts
export type ClubStrategy = "assalto" | "consolidamento" | "ricostruzione" | "sopravvivenza";
export function strategyOf(club, squad, lastPosition, season, seed): ClubStrategy;
```

| Profilo | Quando | Comportamento |
|---|---|---|
| **assalto** | prestigio alto, vicino al vertice | rinnova tutti i big, compra caro, prende svincolati solo di livello top |
| **consolidamento** | metà classifica, conti sani | rinnova i titolari, lascia andare i 30+ in scadenza, **maggiore utente dei parametri zero** |
| **ricostruzione** | dopo una stagione deludente | lascia scadere i vecchi, **svincola gli ingaggi pesanti**, punta su giovani e regen |
| **sopravvivenza** | lotta salvezza o conti in rosso | non rinnova quasi nessuno, **vende i big in scadenza a gennaio**, riempie con svincolati |

Il profilo cambia ogni stagione in base ai risultati veri: è ciò che rende il mondo *leggibile*
("il Genoa sta ricostruendo") invece che casuale.

## 6.2 Il bilancio dell'IA — con le stesse due casse

```ts
export function aiFinances(club, strategy, lastPosition, season, seed): { transfer: number; wage: number };
```

Le squadre IA hanno **la stessa ripartizione mercato/ingaggi** che hai tu, decisa dal profilo (una
squadra in ricostruzione sposta sugli ingaggi per prendere svincolati; una in assalto sul mercato).
Ogni operazione scala la cassa giusta. Da qui in poi il mondo non compra all'infinito e — cosa che
conta di più — **può perdere un'asta con te**, sia sul cartellino sia sull'ingaggio.

## 6.3 Il piano stagionale, in ordine di priorità

Eseguito da ogni club IA a ogni finestra, **sempre nello stesso ordine**: è ciò che lo rende
coerente, cioè leggibile dall'utente.

```
1. RINNOVI       → giocatori in scadenza che servono al progetto (per profilo)
2. RINNOVO MISTER→ o lo lascia scadere: alimenta il pool allenatori liberi
3. SVINCOLI      → chi è fuori dai piani: libera monte ingaggi     ──▶ alimenta il pool
4. NECESSITÀ     → reparti scoperti (riusa repartoScoperto/eccedenzaReparto)
5. PARAMETRI ZERO→ prima i gratis: la mossa più efficiente         ◀── IN GARA CON L'UTENTE
6. ACQUISTI      → planWorldTransfers, ora con cassa mercato vera
7. PRECONTRATTI  → a gennaio, sui giocatori in scadenza altrui, ANCHE I TUOI
8. CESSIONI      → smaltisce eccedenze e ingaggi insostenibili
```

Il punto 5 prima del 6 non è un dettaglio: è **il comportamento di un DS vero**, che prima guarda
chi può prendere gratis e poi spende.

## 6.4 Come resta tutto derivabile

Il piano IA è una funzione pura di `(mondo derivato alla stagione N, seme, ledger salvato, id
posseduti dall'utente)`. Le firme dell'IA **non si salvano**: si ricalcolano identiche a ogni
caricamento. Si salva solo ciò che l'utente ha alterato — e questo mantiene intatto il § 0.1.

---

# PARTE 7 — Piano grafico

## 7.1 Dove si entra

| Momento | Ingresso | Comportamento |
|---|---|---|
| **Stagione** | scheda **Spogliatoio** (accanto a Stagione / Rosa / Corona), col badge degli argomenti aperti | l'utente entra quando vuole |
| **Stagione** | **notizia di giornata cliccabile** (*"Frattesi ha chiesto di parlarti"*) | non blocca la corsa |
| **Stagione** | casi gravi (bivio, promessa infranta, precontratto, disciplina) | **bloccanti**, come oggi |
| **Mercato** | **Finanze** — la prima scheda, con lo slider: si decide il bilancio prima di operare | nuova |
| **Mercato** | la scheda "Chat" di Rosa diventa **Spogliatoio** | invariata come porta |
| **Mercato** | nuova scheda **Svincolati** | il mercato dei parametri zero |
| **Rosa** | colonna **Contratto** (anni residui) e **Ingaggio** (€/anno) | sempre visibili |

## 7.2 `SpogliatoioPanel`

```
┌───────────────────────────────────────────────────────┐
│  SPOGLIATOIO                          4 argomenti     │
│  ───────────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────────────┐  │
│  │ (86) Barella   ⚠ SCADE FRA 6 MESI        ●●●    │  │
│  │ ▸ Il Bayern gli ha offerto il precontratto      │  │
│  │   4,2 M/anno · Fiducia ██████░░░░ 61            │  │
│  │                            [ Convincilo → ]     │  │
│  └─────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │ (79) Frattesi                            ●●○    │  │
│  │ ▸ Gioca il 18% dei minuti, era titolare         │  │
│  └─────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │ (84) Thuram    🔴 ROTTURA                ●●●    │  │
│  │ ▸ Pretende la cessione: promessa infranta       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  IMPEGNI PRESI                              3 aperti  │
│  • Frattesi — titolare entro la 12ª   (fra 3 gare)    │
│  • Lautaro  — rinforzo in ATT    (entro fine mercato) │
│  • Mister   — Barella intoccabile        (stagionale) │
└───────────────────────────────────────────────────────┘
```

## 7.3 `PlayerDialogue`

```
┌───────────────────────────────────────────────────────┐
│ (86) BARELLA            CC · 29 · Leader           ✕  │
│      Fiducia ██████░░░░ 61 · 2 promesse mantenute     │
├───────────────────────────────────────────────────────┤
│ IL SUO CASO                                           │
│ [ 27 pres. ][ 84% minuti ][ 6 gol ][ 6 anni al club ] │
│ ┌─ CONTRATTO ────────────────────────────────────┐    │
│ │ Scade giugno 2027  ◷ 6 MESI    4,2 M/anno      │    │
│ │ ⚠ Da gennaio può firmare gratis con un altro   │    │
│ └────────────────────────────────────────────────┘    │
├───────────────────────────────────────────────────────┤
│ CHIEDE: 5,5 M/anno e la fascia da capitano            │
├───────────────────────────────────────────────────────┤
│ Pazienza ██████░░░░ 58            ← etichetta CORRETTA│
├───────────────────────────────────────────────────────┤
│  ⬤ "Sono sei anni che sono qui. Il Bayern mi offre    │
│     il doppio. Ditemi perché dovrei restare."         │
│                    "Ti offro il rinnovo:              │
│                     5,5 M/anno fino al 2031." ⬤       │
├───────────────────────────────────────────────────────┤
│ ┌────────────────────┐ ┌────────────────────┐        │
│ │ 📄 Tavolo rinnovo  │ │ 🎖 Fascia capitano │        │
│ │ ✔ è ciò che chiede │ │ ✔ è ciò che chiede │        │
│ └────────────────────┘ └────────────────────┘        │
│ ┌────────────────────┐ ┌────────────────────┐        │
│ │ 💰 Adegua ingaggio │ │ ⚠ Garantisci posto │        │
│ │ −1,3 M/anno        │ │ ✕ Gioca già sempre │ ←motivo│
│ │ margine: 6,8 → 5,5 │ │                    │        │
│ └────────────────────┘ └────────────────────┘        │
│ [ Vendilo subito — incassi 38M invece di zero ]       │
│ [ Ignoralo — rischio: lo perdi a parametro zero ]     │
└───────────────────────────────────────────────────────┘
```

## 7.4 Scheda **Svincolati**

```
┌────────────────────────────────────────────────────────┐
│ SVINCOLATI            37 disponibili   ⏱ decadono      │
│ Margine cassa ingaggi: 6,8 M/anno                      │
├────────────────────────────────────────────────────────┤
│ (83) Marco Verratti   CC · 33   ⚠ 3 club interessati   │
│      Chiede: 6,0 M/anno · 2 anni · titolarità          │
│      ✕ oltre il tuo margine (6,8 → serve 6,0, ok 1 solo)│
│                                       [ Trattativa → ] │
├────────────────────────────────────────────────────────┤
│ (76) Kevin Danso      DIF · 27   ⚠ perde condizione    │
│      Chiede: 2,2 M/anno · 3 anni    (−1 OVR se resta   │
│                                      libero a gennaio) │
├────────────────────────────────────────────────────────┤
│ (68) Amine Chalfi     ATT · 19   svincolato · regen    │
│      Chiede: 0,3 M/anno · 4 anni · potenziale ★★★☆     │
└────────────────────────────────────────────────────────┘
```

Con **notifica quando un club IA ti soffia un obiettivo** (riusa "Mercato dal mondo"): *"Il Milan ha
tesserato Verratti a parametro zero"*. È ciò che rende la lista una gara.

## 7.5 Il resto

- **Colonna Contratto in rosa**: pastiglia con anni residui — gialla a 1 anno, rossa in scadenza,
  🔵 se c'è un precontratto altrui — accanto a ⚡ Intoccabile già esistente. Colonna **Ingaggio**
  in €/anno, ordinabile: serve a vedere a colpo d'occhio chi pesa.
- **Intestazione del mercato**: due contatori invece di uno — `Mercato 62,0 M` e
  `Ingaggi 41,2 / 48,0 M`.
- **Scheda mister**: contratto, scadenza, ingaggio annuo, buonuscita corrente calcolata.
- **`SeasonSquadReportModal`** (esiste): nuova sezione *"Contratti in scadenza"* + *"Monte ingaggi
  della prossima stagione"* — è il momento giusto per decidere, subito prima del mercato estivo.
- **Schermata d'esito del dialogo**: verdetto a tutta card con le conseguenze elencate (morale,
  fiducia, cassa toccata, impegno e scadenza), `CelebrationConfetti` per un rinnovo strappato,
  variante rossa per la rottura.
- **`DressingRoomToast`**: *"La rottura con Barella ha scosso lo spogliatoio: −4 morale al
  centrocampo"*.

---

# PARTE 8 — Stato, salvataggio, compatibilità

```ts
// tutto opzionale: i salvataggi esistenti si aprono senza migrazione
finances?: {
  /** Ripartizione decisa dal DS: la quota di fatturato destinata agli ingaggi. */
  wageShare: number;          // 0-1
  /** Sforamento della stagione scorsa, da scontare su questa. */
  wageOverrun?: number;
};
contracts?: {
  /** Solo i contratti CAMBIATI. Gli altri si derivano dal seme. */
  overrides: Record<string, { until: number; wage: number; signedSeason: number; clause?: number }>;
  released: string[];
  preContracts: { playerId: string; toClubId: string; season: number }[];
};
coachContract?: { coachId: string; until: number; wage: number; signedSeason: number };
relationships?: Record<string, { trust: number; feud?: true; brokenCount?: number; keptCount?: number; lastTalkedWeek?: number }>;
commitments?: Commitment[];
captainId?: string;
```

**Stima**: `contracts.overrides` cresce di ~25-40 righe a stagione (i rinnovi veri, non tutta la
rosa) ≈ 90 byte l'una → ~30 KB su dieci stagioni. `finances` e `coachContract` sono trascurabili.
**Ci sta solo se la Fase 1 (§ 0.2) è stata fatta**: da qui l'ordine delle fasi.

**Retrocompatibilità**: `minutesPromises`, `playerPromises` e `coachPromises` restano leggibili e
vengono convertiti in `commitments` al primo caricamento; i contratti mancanti si derivano, quindi
una carriera aperta oggi al quinto anno riceve contratti coerenti col suo seme; `wageShare` assente
= `WAGE_BILL_RATIO` di default; il mister senza contratto ne riceve uno di 2 anni al valore corrente.

---

# PARTE 9 — Fasi di implementazione

Ogni fase si chiude con test verdi, `tsc -b` pulito e — da regola CLAUDE.md § 9.3 — push su Vercel.

| Fase | Contenuto | File | Verifica |
|---|---|---|---|
| **1** | **Misura e compattazione del salvataggio** (§ 0.2) | `aiWorld.ts`, `useCareerSave.ts` | salvataggio a 10 stagioni < 60 KB |
| **2** | **Pulizia**: via `playerTalks.ts` e `resolveTransferRequest`; `starterOverallInRole` (§ 1.2); contesto in `openForcedStandoff` (§ 1.3); refuso | `career.ts`, `events.ts`, `index.ts` | test esistenti adeguati |
| **3** | `contracts.ts`: durate annuali, ingaggi annui, stati, calendario | nuovo | scadenze nel bersaglio 9-14%; **due semi → svincolati diversi** |
| **4** | **Finanze**: fatturato, due casse, `wageShare`, pavimento, sforamento | `budget.ts` + nuovo `finances.ts` | il pavimento non è mai violabile; lo sforamento si sconta |
| **5** | `playerFacts.ts` (fatti di campo, contratto e finanze) | nuovo | minuti normalizzati per infortunio; rivale reale |
| **6** | `playerTopics.ts` — Tier A | nuovo | **il test bloccante del § 5.2** + duale + ritmo |
| **7** | `playerDialogue.ts` — motore, pazienza da fiducia, mosse contestuali, esiti | sostituisce `playerStandoff.ts` | riscrive `dsPlayerStandoff.test.ts` |
| **8** | `commitments.ts` + migrazione dei **tre** canali (compreso `coachPromises`) | nuovo + `career.ts` | verifica ai tre momenti; retrocompatibilità |
| **9** | Conseguenze durature: `relationships`, feud, contagio, aggancio a `discontentPenalty`/`coachHarmony` | `career.ts`, `events.ts`, `coachSynergy.ts` | rottura con leader → morale reparto |
| **10** | **Contratti del mister**: durata alla firma, ingaggio annuo nel monte, buonuscita derivata, rinnovo, scadenza, `computeCoachBuyoutFee` finalmente usata | `coaches.ts`, `coachNegotiation.ts`, `career.ts`, `aiCoaches.ts` | buonuscita cala con le stagioni residue; il pool allenatori liberi cambia ogni stagione |
| **11** | `freeAgents.ts`: pool, decadimento, interesse a 5 assi, concorrenza | nuovo | il pool si svuota; le big non prendono tutto |
| **12** | `aiStrategy.ts`: profili, **due casse per l'IA**, piano a 8 passi | nuovo + `aiWorld.ts` | la gerarchia dei campionati regge a 10 stagioni |
| **13** | Rinnovi/svincolati/mister come trattativa a pacchetto | `negotiation.ts` | personalità diverse si convincono in modo diverso |
| **14** | Precontratti: gennaio, sui miei e sugli altrui | `career.ts`, `careerMarket.ts` | |
| **15** | **UI**: slider Finanze, Spogliatoio, dialogo, tracker impegni, Svincolati, colonne contratto/ingaggio, scheda mister | `apps/web/src/ds/` | verifica nel browser, desktop + mobile |
| **16** | **Bilanciamento misurato** (§ 10) e aggiornamento CLAUDE.md § 3.7 | `packages/data-scripts` | `pnpm calibrate-contratti` |

**Punti di consegna intermedi**, ognuno già giocabile:

- dopo la **2**: il caso assurdo sparisce, prima ancora della UI nuova;
- dopo la **4**: le finanze a due casse funzionano, con la UI provvisoria;
- dopo la **9**: Spogliatoio completo;
- dopo la **14**: contratti completi, giocatori e mister;
- dopo la **16**: il sistema come descritto qui.

---

# PARTE 10 — Bilanciamento: cosa misurare

Nuovo `pnpm calibrate-contratti` (sola lettura, stesso stampo di `calibrate-piccola`): queste cifre
vanno **misurate**, non stimate.

| Grandezza | Bersaglio | Perché |
|---|---|---|
| Giocatori in scadenza per stagione | 9-14% del mondo | Sotto: i parametri zero non esistono. Sopra: i cartellini perdono senso |
| Svincolati con Overall ≥ 72 | 40-70 per finestra estiva | Deve esserci **il colpo**, non un catalogo |
| Monte ingaggi di una rosa reale | 40-50% del fatturato | È il rapporto che rende sensato il default dello slider |
| Firme a zero dell'utente per stagione | 1-3 | Se sono 6, la cassa mercato è irrilevante |
| Big persi a zero per distrazione | ~1 ogni 2 stagioni | È la punizione che dà senso alle conversazioni |
| Conversazioni per stagione | 6-10, di cui 2-3 bloccanti | Sotto: spogliatoio muto. Sopra: ufficio reclami |
| **Entrambe le strategie dello slider sono vincenti** | salvezza raggiungibile sia a `wageShare` 0.30 sia a 0.60 | Se una domina, lo slider è finto |
| Gerarchia dei campionati dopo 10 stagioni | Premier ancora prima | Il mercato IA non deve rimescolare il mondo |
| Salvataggio a 10 stagioni | < 60 KB | Margine sul tetto di 100 KB |

La riga in grassetto è **il test di prodotto dello slider**: uno strumento che ha una posizione
ottimale non è una scelta, è un tutorial. Se la misura dicesse che conviene sempre spostare tutto da
una parte, la leva da girare è `WAGE_BILL_RATIO` o la curva degli ingaggi — non la rimozione della
meccanica.

---

# PARTE 11 — Decisioni ancora aperte

1. **Ampiezza della Fase 1**: la compattazione del ledger è obbligatoria, ma la potatura delle
   stagioni vecchie fa perdere lo storico completo di "Mercato dal mondo". Alternativa: riassunto
   per stagione invece dei singoli record.
2. **Lo sforamento della cassa ingaggi**: sconto sul fatturato successivo (proposta) oppure blocco
   duro alla firma? Il blocco è più semplice ma toglie al DS la possibilità di una scommessa
   consapevole, che è proprio ciò che lo slider vuole dargli.
3. **`captainId` e `concedi_riposo`** toccano `lineup.ts` (chi riposa va escluso come un infortunato):
   candidati naturali al Tier B se si vuole ridurre il rischio.
4. **Contratti per i regen**: sì per coerenza, ma con durate lunghe (4-5 anni) — un regen svincolato
   a 19 anni sarebbe una stranezza.
5. **Retroattività sul mister in carica**: a chi ha già una carriera aperta assegniamo 2 anni al
   valore corrente (proposta) o 3 come "contratto pieno"? Cambia poco, ma va deciso una volta.
6. **Cosa NON viene toccato**: `simulateMatch`, la calibrazione del campionato, la Corona
   Continentale, il draft della Modalità Classica.
