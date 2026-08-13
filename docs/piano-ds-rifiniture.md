# Piano — Rifinitura globale della modalità Direttore Sportivo

> Stato: **implementato** (2026-08-14) — tutte e otto le fasi, verificate con test, tipi, build e una sessione nel browser. Le voci qui sotto restano come registro di cosa si e perche.
>
> Approvato il 2026-08-13. Scritto prima di toccare il codice, come `piano-serie-b.md`
> e `piano-spogliatoio-contratti.md`. Undici segnalazioni dell'utente da una sessione di gioco
> reale, tutte sul cuore manageriale della modalità. Le otto decisioni aperte sono state prese
> dall'utente e sono registrate in **Parte C**; due di esse (D2 e le finanze) hanno **superato**
> la mia proposta iniziale, e il piano è stato riscritto di conseguenza.

---

## 0. Metodo, e cosa cambia rispetto a un elenco di correzioni

Ho letto il codice **prima** di pianificare, per ciascuna delle undici segnalazioni. Ne è uscito
un quadro diverso da "undici bug": tre di quei problemi non sono difetti indipendenti ma
**sintomi di due sistemi rimasti a metà migrazione**, e altri due sono conseguenze di una
costante di bilanciamento che satura. Questo cambia l'ordine del lavoro — si toglie la causa,
non si tappano i sintomi uno per uno — ed è la ragione per cui il piano ha otto fasi e non
undici.

Distinguo per ogni voce ciò che ho **misurato leggendo il codice** da ciò che resta da
**riprodurre con un test** prima di correggere.

---

## Parte A — Diagnosi

### A1. Coppa Tricolore: **si gioca davvero, ma è invisibile**

Segnalazione: *"non c'è traccia della coppa nazionale... non c'è un tab dedicato né vengono
giocate partite"*.

**Il motore la gioca.** `advanceWeek` ([career.ts:1334-1356](../packages/game-engine/src/ds/career.ts))
trova lo slot di calendario, chiama `playNationalCupWeek`, aggiorna `state.nationalCup` e
produce `report.nationalCupMatch`. Il calendario le riserva sei settimane
([calendar.ts:66-72](../packages/game-engine/src/season/calendar.ts)), il tabellone si salva, i
turni sono coperti da test (`nationalCup.test.ts`, `dsDivisions.test.ts`).

**Nessuno la mostra.** `WeekReportCard` disegna `report.match` e `report.cupMatch` e **si ferma
lì**: `report.nationalCupMatch` non è letto da nessuna riga del file
([WeekReportCard.tsx](../apps/web/src/ds/WeekReportCard.tsx)). Non esiste un pannello: `CupPanel`
e `CupProgress` parlano solo di Corona. L'unico punto dell'app che sa della Coppa Tricolore è
l'invito al Match Theatre dai quarti in poi
([CareerScreen.tsx:1244](../apps/web/src/ds/CareerScreen.tsx)) — che infatti compare, ma senza
contesto sembra una partita venuta dal nulla.

Quindi: **sei partite a stagione giocate in silenzio**, con i loro gol, i loro infortuni e il
loro effetto sulla fatica, e l'utente che legittimamente conclude che la competizione non esista.

Un secondo difetto, più sottile, va corretto insieme: su un salvataggio già avviato
`state.nationalCup` viene creato **a metà stagione** ([career.ts:967](../packages/game-engine/src/ds/career.ts)),
e il calendario si ricalcola da `!!state.nationalCup`. I turni la cui frazione è già passata
(il preliminare sta al 3% della stagione) non si giocano mai: quel club entra in coppa e ne
esce senza aver giocato. Va gestito esplicitamente, non lasciato al caso.

### A2. Il contratto del mister non si rinnova da nessuna parte

`expireContracts` ([career.ts:4940](../packages/game-engine/src/ds/career.ts)) rileva il mister a
fine contratto, scrive il messaggio *"va rinnovato o lascia la panchina"* e riapre il meeting
(`seasonNegotiationDone: false`). Ma il meeting — `CoachNegotiationChat` +
`confirmCoachSeasonPromises` — **negozia solo le promesse tecniche e un eventuale adeguamento
d'ingaggio**: non firma nulla, non tocca `coachContract`, non ha una durata. `signCoachContract`
esiste ed è completa (buonuscita, penale, controllo sul monte ingaggi) ma è raggiungibile
**solo** dal flusso di ingaggio di un mister nuovo.

Conseguenza: la promessa del messaggio non è mantenibile. Il mister resta in panchina con un
contratto scaduto, il suo ingaggio continua a pesare sul monte, e la buonuscita vale zero —
cioè cambiarlo diventa gratis proprio quando non dovrebbe.

Richiesta dell'utente, in tre parti: il contratto si discute **dentro** il meeting delle
richieste; il meeting ha un **tab dedicato**, dopo la dirigenza; ogni anno vi si legge la
**durata residua**; e a scadenza **una delle sue richieste è il rinnovo immediato**.

### A3. Budget / mercato / ingaggi: il modello è giusto, l'interfaccia lo nasconde

Il modello del motore è **già quello descritto dall'utente**: `seasonRevenue` è il fatturato
annuo, `finances.wageShare` lo divide, `state.budget` è la sola cassa mercato
([career.ts:3775](../packages/game-engine/src/ds/career.ts)), e `minShareForCommitments`
([finances.ts:88](../packages/game-engine/src/ds/finances.ts)) è esattamente il "non potrò mai
portarli sotto i 30M". Spostare verso gli ingaggi toglie liquidità al mercato e viceversa:
`shiftWageShare` lo fa già, con i tre argini giusti.

Il problema è **dove vive lo slider**. Sta nel pannello Finanze; `WageImpactPanel` lo replica nel
tavolo del rinnovo e sulle card degli svincolati (2026-08-13), ma **non c'è** in nessuna
trattativa d'acquisto. E in testata si legge solo `budget`, cioè la cassa mercato, senza mai
dire da quale fatturato viene. Chi gioca vede un numero che cala e non sa di avere una manopola.

Manca anche il momento in cui il fatturato viene **dichiarato**: l'utente lo immagina detto nel
meeting con la società ("riesco ad avere un budget annuale di 50mln") e il gioco non glielo dice
mai in chiaro.

### A4. Comprando un giocatore non si negozia nulla con lui

`playNegotiation`, ramo acquisto ([career.ts:2800-2860](../packages/game-engine/src/ds/career.ts)):
si controlla la rosa, si controlla il budget, si aggiunge la `RosterEntry`, si scala il
cartellino. **Nessun contratto**, nessun controllo sul margine ingaggi, nessuna trattativa col
giocatore. Il suo stipendio nasce derivato (`contractOf` → `baseWageOf`) e compare nel monte
ingaggi senza che nessuno l'abbia accettato.

È l'asimmetria più vistosa del sistema: un parametro zero si negozia su cinque assi
(`freeAgents.ts`), un rinnovo si negozia su cinque assi (`contracts.ts` → `renewalTerms`), un
acquisto da trenta milioni no.

Tutto il necessario però esiste già: `renewalTerms` / `renewalOfferScore` /
`RENEWAL_ACCEPT_SCORE` sono un motore di trattativa contrattuale completo e testato. Serve
collegarlo, non scriverlo.

### A5. Svincolati e Cedibili IA senza filtri

`FreeAgentsPanel` filtra per **solo reparto** ([FreeAgentsPanel.tsx:220](../apps/web/src/ds/FreeAgentsPanel.tsx)).
La sotto-scheda "Cedibili IA" del mercato mostra `snapshot.aiSellable` così com'è. La ricerca
globale ha invece `SearchCriteria` completa — ruoli multi-selezione, età min/max, Overall
min/max, prezzo, ordinamenti ([scouting.ts:36-56](../packages/game-engine/src/ds/scouting.ts)).
Il lavoro è riusare quel pannello di filtri su altre due liste, non inventarne uno.

### A6. Le offerte di prestito chiamano "Giocatore" chi abbiamo comprato — **causa isolata**

Questa l'ho tracciata fino in fondo, ed è una riga sola.

`evolveWorld` esclude dal mondo i giocatori che sono nostri —
`if (player.clubId === ownClubId || ownedByUser.has(player.id)) continue;`
([aiWorld.ts:716](../packages/game-engine/src/ds/aiWorld.ts)) — e lo fa **prima** di inserirli in
`byId`, che è l'indice "chi è". `buildMarketWorld` poi costruisce l'anagrafica da `byId`, e vi
riaggiunge a mano due gruppi: i giocatori del **nostro club secondo il database** e i **regen**
([buildCareerWorld.ts:468-497](../apps/web/src/ds/buildCareerWorld.ts)).

Chi manca? Chi abbiamo **comprato da un altro club**: non è più nel mondo (è nostro), non è nel
roster di database del nostro club (era del Milan), non è un regen. Quindi
`world.market.nameOf(id)` cade sul ripiego `"Giocatore"`.

Da lì il nome viene **congelato** dentro `snapshot.loanOffers[].playerName`
([careerMarket.ts:504](../packages/game-engine/src/ds/careerMarket.ts)) e finisce nel
salvataggio. Le proposte di prestito riguardano gli under 24 — cioè proprio i giovani che si
comprano — e non possono esistere prima di aver comprato qualcuno: ecco perché il difetto
compare **dalla seconda stagione in poi**, esattamente come descritto.

Il commento a [buildCareerWorld.ts:462](../apps/web/src/ds/buildCareerWorld.ts) dichiara
"l'anagrafica deve coprire tutti" — la regola è giusta, l'implementazione la manca per un caso.
Correzione: costruire l'anagrafica da **tutti** i giocatori del database più i regen, e lasciare
il filtro al solo `transferPool`. Una modifica al punto in cui l'invariante è già scritta.

### A7. I vecchi popup: **due sistemi di conversazione vivi insieme**

Nel gioco convivono:

| | vecchio | nuovo |
|---|---|---|
| motore | `playerStandoff.ts` (660 righe) | `playerFacts` → `playerTopics` → `playerDialogue` → `commitments` |
| UI | `PlayerStandoffChat.tsx` (428 righe) | `PlayerDialogueChat.tsx` |
| ingresso | `state.pendingRequest` → `openForcedStandoff` **durante la stagione** | scheda Spogliatoio, **dentro il mercato** |

Il commento a [CareerScreen.tsx:382](../apps/web/src/ds/CareerScreen.tsx) lo dice apertamente:
*"le due strade convivono finché anche quella non passerà al [nuovo sistema]"*. Non è mai
passata. Quello che l'utente vede aprirsi a stagione in corso è il sistema vecchio — quello con
i tre `if` e la categoria residuale, cioè proprio il difetto che la riscrittura del 2026-08-11
era andata a togliere.

### A8. I bonus economici sono finti — **solo nel sistema vecchio**

Nel sistema **nuovo** l'effetto è già reale: `premio_denaro` scala dalla cassa mercato
(`transferCashDelta`) e `adegua_ingaggio` scrive un **override di contratto**, quindi alza il
monte ingaggi e stringe il margine per tutti gli anni che restano
([career.ts:4300-4310](../packages/game-engine/src/ds/career.ts)).

Nel sistema **vecchio** il premio è una formula improvvisata sul posto
(`Math.max(200_000, val * 0.04)`, [career.ts:2253](../packages/game-engine/src/ds/career.ts)),
l'"adeguamento economico" è **testo** — la richiesta si chiama così ma non esiste nessuna mossa
che tocchi l'ingaggio — e nessuno controlla il margine.

Quindi A8 non è un lavoro a sé: **si chiude spegnendo A7**. Resta da aggiungere il controllo sul
`wageRoom` prima di concedere un adeguamento, che oggi manca anche nel nuovo.

### A9. La titolarità garantita è un ordine, non una preferenza

`playerSlotScore` somma **+100** al punteggio del garantito
([lineup.ts:145-155](../packages/game-engine/src/ds/lineup.ts)). Cento punti su una scala di
Overall 60-99: nessuna penalità può compensarli. Il garantito gioca sfinito, gioca demotivato,
gioca fuori ruolo, gioca al posto di un compagno più forte di venti punti. Lo stesso vale per
`anyRoleBoost`.

L'utente chiede la semantica giusta: *"a parità di condizione ottimale deve giocare il
prescelto"* — cioè un **peso in ballottaggio**, non un lasciapassare.

### A10. La fatica satura, e da lì nascono le richieste di riposo

`updateFatigue` ([events.ts:84](../packages/game-engine/src/ds/events.ts)):

```
played ? fatigue + 18 : fatigue - 22
```

Chi gioca **non recupera nulla**. Un titolare fisso fa +18 a giornata: 18, 36, 54, 72, 90, 100 —
e resta a 100 per tutta la stagione. Non è un caso limite, è il comportamento di ogni titolare
di ogni squadra, sempre, dalla quinta giornata in poi.

Da questa singola costante discendono tre cose che l'utente osserva come problemi separati:

1. il tema `sovraccarico` è ammissibile a `fatigue >= 78 && playedShare >= 0.8`
   ([playerTopics.ts:285](../packages/game-engine/src/ds/playerTopics.ts)): **tutti gli undici
   titolari lo soddisfano**, sempre. Ecco i "troppi giocatori che chiedono di riposare";
2. `fatiguePenalty` arriva al massimo (−8 di Overall effettivo) su tutta la formazione;
3. `fatigueTeamModifier` resta fisso a −3, e il rischio di infortunio a +67%.

La rotazione, che questa meccanica doveva rendere necessaria, è di fatto **impossibile**: non
esiste una scelta che eviti la saturazione, perché chi gioca sale e basta. Va rifatto il modello,
non alzata la soglia del tema — alzarla nasconderebbe il sintomo lasciando in piedi il malus
permanente su tutti.

---

## Parte B — Piano, in otto fasi

Ordinate per **rischio crescente** e per dipendenza: prima ciò che è isolato e verificabile, poi
ciò che tocca il bilanciamento, infine ciò che sposta interi flussi di interfaccia.

### Fase 1 — L'anagrafica copre tutti (A6)

La correzione più piccola e più isolata del piano.

- `buildMarketWorld`: costruire `anagrafica` da **tutti** i giocatori del database (`world.players`)
  più `generated`, invece che da `byId` più due rattoppi. `transferPool` resta filtrato.
- Test di regressione: comprare un giocatore in stagione 1, avanzare alla 2, verificare che
  `snapshot.loanOffers[].playerName` e `offers[].playerName` non siano mai `"Giocatore"`.
  Il test va scritto **prima** della correzione e deve fallire.
- Ripulire i salvataggi già rotti: le offerte congelate con il nome sbagliato si rigenerano da
  sole alla finestra successiva; non serve migrazione.

### Fase 2 — La Coppa Tricolore si vede (A1)

Nessuna modifica al motore della coppa: si gioca già correttamente. È lavoro di interfaccia più
un innesto di calendario.

1. **Referto di giornata**: `WeekReportCard` disegna `report.nationalCupMatch` con una fascia
   propria — riusa `CupNightBanner` con accento diverso dall'oro della Corona, così le due
   competizioni non si confondono a colpo d'occhio.
2. **Scheda *Coppe* unica con selettore** (D2). Le schede *Corona* e *Coppa Tricolore* diventano
   una sola voce di navigazione con un selettore interno fra le due competizioni, sullo stesso
   pattern di `MiniStandings` (che già commuta fra classifica di campionato e girone di Corona).
   `CupPanel` resta il contenuto della prima; nuovo `NationalCupPanel.tsx` per la seconda — turno
   corrente, avversaria, cammino (`save.log` filtrato sulle nostre gare), quaranta iscritte.
   Regole del selettore: compare **solo** se esistono entrambe le competizioni, e ogni voce
   assente non è disabilitata ma **non c'è** (una carriera estera non ha Tricolore, chi non si è
   qualificato non ha Corona). Con una sola competizione attiva la scheda si apre direttamente su
   quella, senza selettore: un selettore con una voce sola è rumore.
3. **Striscia di avanzamento**: `CupProgress` guadagna le sei tappe della Tricolore e segue il
   selettore, così *a che punto siamo / quanto manca* si legge senza cambiare schermata.
4. **Solo nelle nuove carriere** (D1). `buildNationalCup` viene chiamata **unicamente** in
   `closeSeason` (iscrizione per la stagione che comincia) e in `createCareer`; il ramo lazy di
   [career.ts:967](../packages/game-engine/src/ds/career.ts), che la creava a metà stagione, va
   **rimosso**. Un salvataggio in corso prosegue senza coppa e la trova dalla stagione dopo, con
   il preliminare al posto giusto. Il ramo lazy sembra un innesto gentile e invece è proprio ciò
   che produrrebbe un cammino già scritto che l'utente non ha giocato: il calendario si ricalcola
   da `!!state.nationalCup`, quindi i turni la cui frazione è già passata sparirebbero in
   silenzio. Test: una carriera ripresa a metà stagione **non** ha `nationalCup` quell'anno e ne
   ha una completa da 40 iscritte la successiva.
5. Verificare che il trofeo risulti in `SeasonSummary.trophies` e nella `TriumphScreen` — il
   codice c'è, va provato in una carriera vera, perché finora nessuno poteva accorgersene.

### Fase 3 — Il tavolo del contratto (A4, A5, e metà di A3)

Il blocco più grande, ed è tutto riuso.

**3a. Contratto dopo l'accordo col club.** `playNegotiation`, chiudendo un acquisto, non aggiunge
più il giocatore alla rosa: apre una **seconda fase** contrattuale.

- **Seconda fase della stessa chat** (D3): `NegotiationState` guadagna una `phase`
  (`"club"` → `"contratto"`), e l'interlocutore cambia — il direttore sportivo avversario lascia
  il posto all'agente, nella stessa finestra e con la stessa barra di pazienza. L'operazione è
  una sola: spezzarla in due superfici la farebbe sembrare due decisioni scollegate, ed è già
  successo una volta con il tasto "acquista subito" (Decision Log 2026-08-06d).
- La richiesta del giocatore viene da `renewalTerms`, alimentata dai fatti che già abbiamo (età,
  Overall, valore, ingaggio attuale nel club di provenienza, personalità).
- L'offerta si compone su ingaggio / durata / clausola / titolarità garantita / fascia, e si
  valuta con `renewalOfferScore` contro `RENEWAL_ACCEPT_SCORE`. Le stesse leve dei parametri zero
  e dei rinnovi: tre superfici, un motore solo.
- **Se non si trova l'accordo la trattativa salta**, il cartellino **non si paga**, e il giocatore
  entra in `negotiationBlocked` per **l'intera finestra di mercato** (D4) — stessa regola già
  adottata per la trattativa saltata col club, e l'unica che dà un prezzo al rifiuto invece di
  lasciar ritentare finché non esce il risultato voluto.
- Vale per **tutti** gli acquisti, senza soglia di valore (D8): un'eccezione per le operazioni
  piccole reintrodurrebbe la porta di servizio che il 2026-08-06 ha già dovuto chiudere.
- Il controllo sul `wageRoom` sta **qui**, non dopo: firmare oltre il tetto resta permesso
  (`overrun`), ma dev'essere una scelta dichiarata sullo slider, non una sorpresa.

**3b. Lo stesso tavolo per gli svincolati.** `FreeAgentsPanel` oggi ha un form d'offerta inline;
va sostituito dall'apertura della stessa superficie di trattativa contrattuale, con la
concorrenza IA (`rivalBidsFor`) che già esiste a fare da orologio.

**3c. Lo slider in ogni tavolo.** `WageImpactPanel` entra anche nella trattativa d'acquisto e in
quella dello svincolato, non solo nel rinnovo. Il permesso resta del motore (`setWageShare`
rifiuta e spiega), il pannello mostra soltanto: è la regola di confine di CLAUDE.md § 9.

**3d. Filtri su Svincolati e Cedibili IA.** Estrarre da `MarketPanel` il blocco dei filtri di
ricerca in un componente riusabile e montarlo sulle altre due liste, mappando su `SearchCriteria`.
Zero logica nuova.

### Fase 4 — Le finanze si semplificano a due numeri, e l'avanzo si porta tutto (resto di A3)

Due richieste esplicite dell'utente, entrambe superano quanto scritto oggi.

**4a. Lo slider parla in euro, non in percentuale.** La vista si riduce ai **due soli numeri** che
servono a decidere:

| | |
|---|---|
| **Costo annuale ingaggi** | quanto costano i contratti già firmati (giocatori + mister). **È il pavimento**: sotto non si scende. |
| **Budget mercato disponibile** | quel che resta, ed è la cifra con cui si compra. |

Lo slider sposta euro fra i due, con l'estremo sinistro **inchiodato al costo degli ingaggi
attuali**. Sparisce dall'interfaccia ogni riferimento a quote, percentuali e "ripartizione": la
percentuale resta nel motore come rappresentazione interna (`finances.wageShare`), perché è ciò
su cui `shiftWageShare` è costruita e testata, ma non compare più a schermo. Chi gioca vede
"posso alzare gli ingaggi fino a X, e mi restano Y per il mercato".

Conseguenza sul motore, da correggere insieme: `MAX_WAGE_SHARE = 0.75`
([finances.ts:33](../packages/game-engine/src/ds/finances.ts)) è un tetto **in quota**, e con un
pavimento espresso in euro le due cose possono entrare in conflitto — una rosa con un monte
ingaggi oltre il 75% del fatturato avrebbe un pavimento più alto del suo tetto, cioè uno slider
senza posizioni valide. Il tetto va reso cedevole verso il pavimento: **coprire gli impegni già
firmati non può mai essere vietato**. Test dedicato, perché è uno stato che si raggiunge solo
dopo qualche stagione di rinnovi generosi ed è esattamente il caso in cui l'utente ha più bisogno
dello strumento.

Restano visibili in due punti, perché sono contesto e non un'altra cosa da fare: nel **meeting
con la dirigenza** (`BoardDemandDialog`, primo gate di stagione), dove la società dichiara il
fatturato dell'anno — è il punto narrativo giusto, è chi dà i mezzi a dire quanti sono; e nella
**testata** della schermata carriera, dove oggi si legge solo la cassa mercato.

**4b. L'avanzo si riporta per intero.** `CARRY_OVER_SHARE` passa da **0,3 a 1,0**
([budget.ts:168](../packages/game-engine/src/ds/budget.ts)): quel che non spendi quest'anno si
somma al budget dell'anno prossimo, senza trattenute.

Segnalo il compromesso una volta sola, perché è dichiarato nel codice attuale e va rimisurato,
non ignorato: il 30% esisteva per impedire che **non spendere mai** diventasse la strategia
ottimale, dato che il tetto per difficoltà (`DIFFICULTY_BASE_BUDGET_CAP`) limita il budget *base*
ma non la somma accumulata. Con il riporto pieno, tre stagioni di parsimonia si sommano senza
alcun freno. Procedo come chiesto — è anche la versione più leggibile, e "i miei soldi non
spariscono" è una regola che un direttore sportivo si aspetta — e la verifico misurando con
`pnpm calibrate-piccola` su carriere da sei stagioni: se accumulare risulta dominante sul
comprare ogni anno, **la leva da ritoccare è il budget base, non il riporto**. Il riporto resta
pieno in ogni caso.

Nota di coerenza: l'avanzo che si riporta è la **cassa mercato** non spesa. La cassa ingaggi non
"avanza" — è un impegno annuale ricorrente, non un fondo — e questo va detto in chiaro nella
nuova vista, altrimenti il numero riportato l'anno dopo sembra sbagliato.

### Fase 5 — Il meeting col mister, con il contratto dentro (A2)

- `CoachNegotiationChat` guadagna un **tab dedicato "Contratto"**, accanto a quello delle
  richieste tecniche, aperto dopo il dialogo con la dirigenza. Vi si legge sempre: durata
  residua (`coachContractSeasonsLeft`), ingaggio annuo, buonuscita a oggi (`coachSeveranceNow`),
  peso sul monte ingaggi.
- Quando le stagioni residue sono **≤ 1**, `generateCoachPromises` emette una richiesta di tipo
  nuovo — `rinnovo_contratto` — che **non è negoziabile via compromesso**: o si rinnova, o il
  mister va a scadenza. È il modo in cui il messaggio già scritto da `expireContracts` diventa
  mantenibile.
- Rinnovare chiama `signCoachContract` con lo stesso mister: durata scelta (1-5, riusa
  `ContractLengthPicker`), nessuna penale, nessuna buonuscita, solo il nuovo ingaggio contro il
  margine.
- Non rinnovare ha una conseguenza dichiarata: a fine stagione la panchina è libera, e il
  meccanismo di corteggiamento (`maybePoachOurCoach`) si applica **a zero**, cioè senza soglia di
  sintonia — un tecnico in scadenza è merce di tutti.

### Fase 6 — Un solo sistema di conversazioni (A7, A8)

- `pendingRequest` smette di aprire `openForcedStandoff` e apre `openPlayerDialogue`, con il
  tema imposto dal motivo della richiesta e la chat marcata **bloccante** (niente X finché non si
  risolve) — `PlayerDialogueChat` ha già il `forced` come pattern in `PlayerStandoffChat`.
- I motivi del vecchio sistema che il nuovo non copre vanno aggiunti come **temi** in
  `playerTopics.ts`, non riportati come casi speciali: `bivio_mister` e la disciplina
  (`multa_disciplina`) sono i due da verificare uno per uno prima di cancellare.
- **Poi si cancella**: `playerStandoff.ts`, `PlayerStandoffChat.tsx`, `dsPlayerStandoff.test.ts`,
  e i campi di stato che restano orfani. Circa 1.100 righe. Se resta anche solo un ingresso al
  vecchio sistema il lavoro non è finito: il difetto che l'utente vede è proprio la
  sopravvivenza di un ingresso.
- **A8 si chiude qui**, più due aggiunte al nuovo: `adegua_ingaggio` rifiuta se il margine
  ingaggi non regge (con il motivo sulla mossa, non dopo il clic — regola già adottata dal
  dialogo), e ogni effetto economico produce un `DealToast` come le operazioni di mercato.

### Fase 7 — La fatica, rifatta (A10)

**Il modello.** La settimana è l'unità: tutti recuperano ogni settimana, e giocare costa.

```
fatigue' = clamp( fatigue − RECUPERO_SETTIMANALE + (partite giocate nella settimana) × COSTO )
```

Con una partita a settimana un titolare si assesta su un plateau **basso**; con due (turno di
coppa) sale; tre settimane doppie di fila lo portano in zona rossa. È la rotazione che il
progetto ha sempre dichiarato di voler rendere necessaria, e che oggi non è nemmeno possibile.

- I due valori si tarano **misurando** su una stagione reale con e senza coppe, non a occhio:
  bersaglio dichiarato in **D6**.
- `fatiguePenalty`, `fatigueTeamModifier` e il moltiplicatore di rischio infortuni restano dove
  sono: con un plateau sensato tornano a discriminare invece di essere costanti.

**Il tema.** `sovraccarico` diventa ammissibile solo con **congestione vera** (due partite nella
settimana appena giocata, o N giornate consecutive da titolare senza turno di riposo) e sopra una
soglia di fatica che il nuovo modello renda rara. Più tregua per argomento — che il tema già
eredita da `inTregua` — e il tetto `MAX_OPEN_CASES` che già esiste.

### Fase 8 — La titolarità garantita come ballottaggio (A9)

- Il `+100` diventa un **bonus di preferenza** piccolo (ordine di grandezza: 3-5 punti, cioè
  quanto basta a decidere un ballottaggio ma non a scavalcare un divario reale). Vedi **D7**.
- Chi è infortunato, squalificato o a riposo non gioca comunque: la preferenza non è
  un'eccezione alle indisponibilità.
- **Conseguenza da gestire, non da subire**: l'impegno `clausola_titolarita` (minStarts) e le
  promesse di minutaggio diventano più facili da infrangere. Vanno riverificate le soglie di
  `commitments.ts`, altrimenti si sposta un problema dall'undici allo spogliatoio. Il test che lo
  blocca: un garantito **alla pari** del rivale gioca; un garantito **molto sotto** non gioca, e
  la promessa si infrange con la conseguenza dichiarata.

---

## Parte C — Decisioni prese (utente, 2026-08-13)

| | Decisione | Effetto sul piano |
|---|---|---|
| **D1** | La Coppa Tricolore **solo nelle nuove carriere** | Fase 2.4: si **rimuove** il ramo lazy di `career.ts:967`; l'iscrizione avviene solo in `closeSeason` e `createCareer` |
| **D2** | **Scheda *Coppe* con selettore** (supera la mia proposta) | Fase 2.2: una voce di navigazione sola, selettore interno, voci assenti non mostrate |
| **D3** | **Seconda fase della stessa chat** | Fase 3a: `NegotiationState.phase` `"club"` → `"contratto"`, l'agente prende il posto del DS avversario |
| **D4** | Blocco per **l'intera finestra di mercato** | Fase 3a: `negotiationBlocked`, stessa regola della trattativa saltata col club |
| **D5** | Si **cancella** il vecchio sistema | Fase 6: via `playerStandoff.ts`, `PlayerStandoffChat.tsx`, `dsPlayerStandoff.test.ts` — nessun interruttore, nessun ingresso residuo |
| **D6** | Bersaglio della fatica **confermato** | Fase 7: senza coppe un titolare fisso resta sotto 40; con due coppe supera 70 solo nei doppi impegni; chi ruota non ci arriva mai |
| **D7** | **Peso piccolo** | Fase 8: preferenza di 3-5 punti al posto del +100, non regola di pareggio |
| **D8** | Tavolo contrattuale per **tutti** gli acquisti | Fase 3a: nessuna soglia di valore |

**Finanze** (richiesta aggiuntiva, supera l'impostazione attuale): la vista si riduce a **costo
annuale ingaggi** (pavimento invalicabile) e **budget mercato disponibile**; lo slider sposta euro
fra i due e la percentuale sparisce dall'interfaccia. L'avanzo di ogni stagione si somma **per
intero** al budget della successiva. Dettaglio e conseguenze in **Fase 4**.

---

## Parte D — Verifica

Per ogni fase, nell'ordine:

1. `pnpm --filter @app/game-engine test` verde (oggi 779 test; le fasi 1, 3, 5, 7 e 8 ne aggiungono);
2. `tsc -b --force` pulito su `apps/web`;
3. build di produzione;
4. **verifica nel browser** con dev server **unico sulla 5173** (CLAUDE.md § 9.2), su una carriera
   italiana vera: è l'unico posto dove la Coppa Tricolore, il tavolo del contratto e i popup
   dello spogliatoio si vedono davvero. Le fasi 2, 6 e 7 **non sono chiudibili senza**;
5. pubblicazione su Vercel a fine di ogni fase (CLAUDE.md § 9.3).

Due antipattern da non ripetere, entrambi già pagati in questo progetto:

- **un test che può non verificare nulla è peggio di nessun test** (Decision Log 2026-07-31,
  2026-08-07, 2026-08-13). Ogni test nuovo di questo piano va provato **invertendo
  l'asserzione**: se passa lo stesso, il fixture è sbagliato;
- **misurare, non stimare**, le due tarature del piano (fatica in Fase 7, peso del garantito in
  Fase 8). Sono gli stessi due tipi di costante che nel motore 2D erano sbagliati al primo
  tentativo tutte e tre le volte.

---

## Appendice — Aggiornamenti a CLAUDE.md previsti

- § 3.7.5ter: il contratto in acquisto, lo slider in ogni tavolo, e la vista finanze ridotta a
  due numeri (pavimento ingaggi + budget mercato) con la percentuale sparita dall'interfaccia;
- § 3.7.11 e voce del Decision Log 2026-08-09d: `CARRY_OVER_SHARE` da 0,3 a **1,0** — la riga che
  motiva il 30% ("riportare tutto renderebbe ottimale non spendere mai") è **superata** da una
  decisione esplicita dell'utente e va corretta, non lasciata a contraddire il codice;
- § 3.7.6: il contratto del mister dentro il meeting, con il tab dedicato;
- § 3.7.12bis: cancellazione del vecchio sistema di standoff, un canale solo;
- § 3.7.12ter: la Coppa Tricolore diventa visibile (la sezione la dà per esistente dal 2026-08-11,
  ed è vero nel motore ma non nell'app — la riga va corretta, non aggiunta);
- § 3.7.2: il nuovo modello di fatica;
- § 3.7.12: la titolarità garantita come preferenza in ballottaggio.
