# Piano — dieci correzioni risolutive alla DS mode

> Scritto prima di toccare il codice, come da prassi del progetto. Otto segnalazioni dell'utente
> dopo una sessione di gioco, più due richieste aggiunte in corso di pianificazione (salvataggi,
> annata). Tutte diagnosticate leggendo il codice: sotto, per ciascuna, la **causa misurata** (non
> ipotizzata), l'intervento e come si verifica che sia davvero risolta.
>
> **Decisioni dell'utente già acquisite.** 2D sul modello **FM09**, con **due modalità entrambe a
> highlight** — *Salienti* (solo gol) ed *Estesa* (gol più le azioni importanti) — e **meno
> possessi, ognuno un'azione vera**; fase stagione con **tutte e quattro** le aggiunte; la società
> pretende un minimo **anche in coppa**; il mister **non dice mai un no secco**; svincolati con
> **interesse visibile prima** della trattativa; i venduti **vanno davvero nel club che li compra**
> e non sono riacquistabili nella stessa finestra; le medie voto **contano** sulla crescita;
> salvataggi come **punti di ripristino, massimo 2 per stagione**, con tasto Salva e rete di
> sicurezza automatica; **stagione 1 = 2026/27**; consegna **tutto insieme con un push finale**.

---

## 0. Due scoperte che cambiano la forma del lavoro

**Le segnalazioni 4 e 5 sono un bug solo.** Quando un giocatore lascia la nostra rosa — per
clausola (`career.ts`, `eseguiClausole`) **o per cessione normale** (`playNegotiation`, ramo
`cessione`, e la vendita rapida) — nessuno registra il movimento in `state.worldTransfers`.
`evolveWorld` ricostruisce quindi il mondo dal database e lo rimette **al suo club d'origine**;
siccome non è più in `ownedByUser`, `buildMarketWorld` lo rimette anche fra gli **acquistabili**.
Da qui entrambe le segnalazioni: «lo ritrovo nella squadra di origine» e «si può ricomprare
subito». Una riga di causa, due sintomi.

**Il 2D non è "peggiorato": è una regressione con una riga precisa.** L'ultimo commit ha reso
`PlayPhase.notable` vero **solo per i gol** (richiesta precedente dell'utente: "voglio vedere solo
i gol"). Ma `RATE_SKIP = 330` era tarato quando le fasi notevoli erano ~20 e il salto copriva solo
i buchi fra una e l'altra. Ora **5.300 secondi su 5.400** scorrono a 330×: a 60 fps sono 5,5
secondi di gioco per fotogramma — il pallone teletrasporta, e con `intensity: 0.45` i ventidue
restano alle posizioni base con la sola oscillazione individuale. È letteralmente "non c'è più il
pallone, pallini che si muovono a caso".

---

## 1. Un solo tavolo con la società: campionato **e** coppe

**Causa.** `CareerScreen` apre due cancelli in sequenza: `BoardMeetingScreen` (obiettivo di
campionato, fondi, panchina) e poi `SeasonObjectiveScreen` (solo le coppe). Il presidente non ha
mai una posizione sulle coppe, quindi quelle restano una dichiarazione unilaterale in una
schermata a parte.

**Intervento.**
- `board.ts` — `BoardMeeting` guadagna `cupMinimums: { key, competitionName, minimum, options }[]`,
  costruite da `suggestCupObjectiveTiers` con lo stesso scostamento di impazienza già usato per il
  campionato (fiducia alta → si accontenta di una fascia sotto la stima, fiducia bassa → pretende
  sopra). `agreeWithBoard` accetta le fasce di coppa insieme a quella di campionato e le pesa nel
  `confidenceDelta` e nell'apertura sui fondi, con `OBJECTIVE_WEIGHTS` che già esiste — chi promette
  la Corona ottiene più mezzi di chi promette il campionato.
- `BoardMeetingScreen.tsx` — passa allo `Stepper` (primitiva già in `ds/ui`), quattro passi
  obbligati: **Il consiglio** → **Gli obiettivi** (campionato e ogni coppa a cui si partecipa, sulla
  stessa schermata) → **I mezzi** → **La panchina**. Nessun passo comincia senza una scelta valida
  già in campo (regola § 8.2).
- `SeasonObjectiveScreen.tsx` — **eliminato**, insieme al suo cancello in `CareerScreen`.
  `setSeasonObjective` e `setSeasonCupObjectives` vengono chiamate entrambe da `settleBoardMeeting`.

**Verifica.** Test: con una coppa in corso il meeting espone un minimo di coppa; l'accordo scrive
sia `seasonObjective` sia `seasonCupObjectives`; `seasonObjectiveSet` diventa vero in un passaggio
solo. Nel browser: dal colloquio si arriva al mercato senza una seconda schermata.

---

## 2. Il mister: ogni mossa ha un esito, nessun no secco

**Causa.** `proposePromiseCompromise`, ramo `reduce_target` con priorità `negoziabile` e promessa
**senza `targetValue` numerico**: il mister risponde *"accetto un compromesso ragionevole su questo
punto"* e `updatedPromises` resta **identico**. Zero effetto, e sono la maggioranza delle promesse
(`sell_misfit`, `youth_prospect`, `veteran_leadership`, `key_player_retention`, `domestic_core`,
`budget_discipline` non hanno tutte una soglia). Su `imprescindibile` è sempre un no che non apre
nulla se non il bonus d'ingaggio.

**Intervento.** Ogni promessa dichiara **come si ammorbidisce**, e ogni mossa produce un
cambiamento visibile sulla scheda:
- nuova `softenPromise(promise)` in `coachNegotiation.ts`: una scala di ammorbidimento per `kind`
  — soglia più bassa dove c'è un numero; **restringimento di ambito** dove non c'è (`domestic_core`
  3→2 nazionali; `trim_squad` 23→25; `youth_prospect` "un giovane" → "un giovane o un under 23 già
  in rosa"; `key_player_retention` "non cedibile" → "non cedibile in questa finestra";
  `top_player` "un titolare da …" → "un titolare per quella casella"). Una promessa che ha già
  consumato tutti i gradini diventa `stralciabile`, cioè si può togliere;
- **l'imprescindibile si ammorbidisce anche lui**, una volta sola, e il testo lo dice
  (*"Le vengo incontro su questo, ma non me lo chieda due volte"*);
- **il rifiuto porta sempre la contropartita.** Nuovo campo `counterDemand` sull'esito: quando il
  mister non cede, dichiara cosa gli serve — un bonus d'ingaggio (già esiste), **oppure** stralciare
  un'altra richiesta di sua scelta, **oppure** accettare la scadenza rimandata. Il pannello mostra
  quel bottone accanto al no, non un muro;
- `remove_promise` su una `flessibile` funziona già; su una `negoziabile` diventa "la tolgo, ma in
  cambio…" invece di un rifiuto.

**Verifica.** Test che scorre **tutte** le mosse su **tutti** i `kind` del catalogo e pretende, per
ognuna, che lo stato dopo sia diverso da quello prima (promessa cambiata, tolta, rimandata, o
`hireCost` salito, o `counterDemand` presente). È la formulazione letterale della richiesta: *tutte
le opzioni a schermo devono portare a un risultato tangibile*.

---

## 3. Svincolati: interesse dichiarato prima, e numeri ritarati sui dati

**Causa: da misurare, non da indovinare.** Ci sono tre punti in cui un giocatore può risultare
"disinteressato" (`wouldConsider` come veto d'ingresso; punteggio sotto `FREE_AGENT_MIN_SCORE` senza
controproposta; rivale davanti e `buildCounter` che non trova una leva sostenibile). Con un club di
prestigio 5 il primo quasi non scatta, quindi il colpevole è uno degli altri due — ma **quale**, e
con che frequenza, non lo so ancora.

**Intervento.**
1. **Prima si misura.** Nuovo `packages/data-scripts/src/probeFreeAgents.ts` (`pnpm probe-svincolati`,
   sola lettura, stesso stampo di `probeCup.ts`): costruisce carriere reali dal database per club di
   prestigio diverso, apre le finestre, e stampa la distribuzione dei tre esiti su qualche migliaio
   di trattative, separando le tre cause. Si ritara **dopo** aver visto i numeri.
2. **L'interesse si vede prima di trattare.** Nuova `freeAgentInterest(agent, club)` in
   `freeAgents.ts` — pura, quindi testabile: restituisce un livello 0-4, la ragione dominante
   (`soldi` / `campo` / `ambizione` / `progetto`) e la frase dell'agente. Si calcola con gli stessi
   pesi di `freeAgentBidScore` valutati su un'offerta di riferimento (la sua richiesta piena, senza
   garanzie), quindi non è un secondo modello che può divergere dal primo. `FreeAgentsPanel` la
   mostra su ogni card: pallini, una riga di motivo, e cosa chiede.
3. **`wouldConsider` smette di essere un veto muto**: quando blocca, dice quale delle sue due
   condizioni ha fallito, così l'interfaccia può mostrarlo prima invece che dopo il clic.

**Verifica.** La probe rigirata dopo la modifica, con i numeri prima/dopo nel commit. Test: per un
club dominante la quota di `disinteressato` sta sotto una soglia dichiarata; l'interesse mostrato
concorda con l'esito reale (chi è dato "molto interessato" firma quasi sempre a richiesta piena).

---

## 4-5. Chi lascia il club se ne va davvero (clausole e rivendite)

**Causa.** Vedi § 0: nessuna uscita dalla rosa registra un `WorldTransfer`.

**Intervento.** Un punto solo, non quattro copie.
- Nuova funzione `registraPartenza(state, playerId, playerName, toClubId, fee, kind)` in `career.ts`,
  che aggiunge il `WorldTransfer` **e** l'id a un nuovo `state.market.soldThisWindow`.
- La chiamano tutte le uscite: clausola (`eseguiClausole`), cessione in trattativa
  (`playNegotiation`), accettazione di un'offerta, vendita rapida.
- `searchMarket`, `aiSellableListings` e l'apertura di una trattativa **escludono**
  `soldThisWindow`: nella stessa finestra non è riacquistabile in nessun modo, come richiesto.
  `soldThisWindow` si azzera all'apertura della finestra successiva — da lì si può ritrattare, ma
  col **nuovo** club e al suo prezzo, che è esattamente la scelta dell'utente.
- La clausola guadagna anche `toClubId` reale nel messaggio del recap (già c'è `toClubName`).

**Verifica.** Test end-to-end su due finestre: si vende un giocatore, si controlla che (a) sparisca
dal `transferPool` della finestra corrente, (b) alla finestra dopo compaia **nella rosa del
compratore** e non in quella del club d'origine, (c) la stessa cosa valga per una clausola pagata.
Il caso della clausola è quello segnalato, quindi ha un test suo.

---

## 6. La fase stagione diventa importante quanto il mercato

**Causa.** Non è un bug: manca il contenuto. `SeasonStats` ha solo `appearances/minutes/goals/assists`,
e **gli assist non vengono nemmeno mai incrementati** (`applyMatchdayToRoster` scrive solo presenze,
minuti e gol — `assists` resta 0 per tutta la carriera). Le medie voto non esistono. Le partite fra
squadre IA (`simulateOpponentMatch`) restituiscono solo due numeri, senza marcatori: una classifica
capocannonieri di lega oggi è impossibile.

**Vincolo che decide l'architettura.** `simulateMatch`/`simulateMatchday` sono condivise con la
Modalità Classica, protette da un characterization test che congela l'esatta sequenza del generatore
casuale. **Non si toccano.** Marcatori IA, assist e voti si derivano quindi nello strato DS, da
flussi casuali separati (`derivedRandom(seed, "assist"|"voti"|"marcatoriIA", …)`): zero impatto sul
consumo del generatore, characterization test valido senza modifiche, e la calibrazione del 38-0-0
resta intatta.

**Intervento.**

*Motore*
- `SeasonStats` += `assists` (finalmente incrementato), `ratingSum` + `ratedAppearances` (da cui la
  media), `cleanSheets` (portieri).
- Nuovo `ds/matchRatings.ts`, puro: `matchRating(input)` → voto 4.0-10.0 da ruolo, esito, gol
  fatti/subiti, gol e assist personali, forza dell'avversaria, più un piccolo scarto seedato. Le
  regole sono quelle che un lettore riconosce: un attaccante che non segna in una sconfitta prende
  poco, un portiere che tiene la porta inviolata prende molto, chi segna la decide.
- Assist: si attribuiscono nello strato DS a ogni gol nostro, pescando dal pool pesato per ruolo
  (chi ha segnato non si assiste da solo) — con probabilità che un gol non abbia assist.
- Nuovo `ds/leagueStats.ts`: accumula marcatori/assist/voti **di tutta la lega**, attribuendo i gol
  delle partite IA-contro-IA ai loro `scorers` (che `LeagueTeam` già porta). Vive in `CareerState`
  come una mappa compatta `playerId → {g, a, ratingSum, apps}` azzerata a ogni stagione — poche
  centinaia di voci, ben sotto il tetto dei 100 KB del salvataggio.
- Stessa cosa per le due coppe (`careerCup.ts`, `careerNationalCup.ts`), con un accumulatore separato.
- `aging.ts` — `statLineOf` smette di dire "media voto e clean sheet non esistono in DS mode" e passa
  i valori veri ad `applySeasonAdjustment`. È l'ingrediente che CLAUDE.md § 2.2 dichiara mancante da
  sempre.

*Interfaccia* — **niente sesta scheda**: cinque voci a 360px lasciano 72px l'una, una sesta le porta
a 60 e "Statistiche" verrebbe troncata (§ 8.2). Le statistiche entrano come sotto-selettore dove già
appartengono:
- scheda **Classifica** → `Classifica | Marcatori | Assist | Medie voto`, con i risultati completi di
  ogni giornata (non solo il nostro) sotto la classifica;
- scheda **Coppe** → stesso sotto-selettore per la competizione scelta, più il tabellone completo con
  gli altri accoppiamenti;
- scheda **Rosa** → nuova colonna voto e **forma** (andamento ultime 5), con l'indicatore di chi sta
  crescendo e chi sta calando;
- `ClubViewerModal` diventa raggiungibile **anche** dal calendario, dal referto di giornata e dal
  tabellone di coppa, non solo dalla classifica, e mostra le statistiche stagionali della rosa
  avversaria.

**Verifica.** Il characterization test della Modalità Classica deve restare verde **senza
modifiche**: è la prova che non ho toccato il consumo del generatore. Test sul motore: la somma dei
gol dei marcatori di lega coincide coi gol della classifica; i voti stanno nella banda dichiarata;
un portiere con la porta inviolata prende più di uno che ne subisce quattro. Poi `pnpm
calibrate-piccola` rigirato, perché le medie voto ora entrano nella crescita: se la scalata della
piccola squadra si sposta, il numero va nel commit.

---

## 7. Il 2D riscritto sul modello FM09: azioni vere, non pallini

**Riferimento dichiarato dall'utente**: il motore 2D di *Football Manager 2009*
(`youtube.com/watch?v=2hMtktGwhzM`, "Amusan Goal vs France WC2014 — FM09 (2D)"). ⚠️ Il video
**non l'ho visto** — non ho accesso ai contenuti video: ho identificato il gioco dal titolo e
concordato con l'utente cosa prenderne. Quello che segue è quindi la specifica concordata, non
una trascrizione del filmato.

**Causa della regressione attuale.** Vedi § 0: `notable` è diventato vero solo per i gol, ma
`RATE_SKIP = 330` era tarato per coprire i buchi fra ~20 fasi notevoli. Con la riproduzione a
highlight (sotto) quella costante **sparisce del tutto**: non esiste più riempitivo da
attraversare, quindi non esiste più il blur.

**Causa della povertà delle azioni** — quattro cose che il motore oggi non modella affatto:

| Cosa manca | Cosa c'è oggi |
|---|---|
| **Contrasti** | `PhaseOutcome: "recupero"` (il **58%** dei possessi) significa solo "il possesso finisce e la palla passa all'altra squadra". Nessun difensore converge, nessuno tocca il pallone, non c'è il momento del contatto. |
| **Ripartenze** | Il possesso dopo un recupero è costruito come tutti gli altri: nessuna nozione di "l'ho vinta alta e vado". |
| **Cross** | Esiste come `TouchKind`, ma è un tocco di passaggio scelto quando la palla è larga e profonda — mai un cross *verso qualcuno* che stacca di testa. |
| **Filtranti** | Non modellati. C'è `lancio`, scelto per soglia di avanzamento, che è un'altra cosa. |

### 7.1 Riproduzione: due modalità, entrambe a highlight

Scelta dell'utente, e supera l'"ibrido" indicato prima: **entrambe** le modalità sono a
highlight in stile FM — velocità reale durante l'azione, orologio che salta fra una e l'altra.
Cambia solo *cosa* è un highlight:

- **Salienti** — solo i gol. Chi vuole il verdetto e l'emozione della rete, niente altro.
- **Estesa** — i gol **più** le azioni importanti: conclusioni, parate decisive, pali, espulsioni,
  e i contrasti che generano una ripartenza pericolosa.

Meccanica: `MatchTheatre` costruisce da `flow.phases` una lista di **finestre** (l'azione, più
qualche secondo di rincorsa sulla fase precedente, perché in FM si vede *come nasce* l'occasione,
non solo come finisce). Si riproduce ogni finestra a `RATE_LIVE ≈ 1`, poi si salta con una
transizione **dichiarata a schermo** (`23′ ⏭ 31′`). `RATE_SKIP` viene rimossa.

Durata attesa: ~60-90 secondi in *Salienti*, ~3 minuti in *Estesa*, con 2× e 4× disponibili.
La modalità si sceglie nell'invito (`KeyMatchPrompt`) e si può cambiare in corsa.

### 7.2 Motore: il vocabolario delle azioni

`matchSim.ts` riscritto attorno a un possesso che ha un **disegno**, non solo un esito.

- **Meno possessi, più veri** (scelta dell'utente): da ~280 a ~140, ognuno più lungo. Costo
  dichiarato: `OUTCOME_WEIGHTS` va ritarato, perché tiri, falli, angoli e fuorigioco per partita
  sono calibrati su 280 — un test misura i totali e li tiene nella banda di una partita vera.
- **`pattern` di possesso**: `costruzione_dal_basso`, `manovra`, `ripartenza`, `palla_lunga`,
  `pressing_alto`, `palla_inattiva`. Decide lunghezza della catena, velocità della palla,
  direzione e vocabolario dei tocchi. È da qui che nasce la differenza fra un'azione manovrata e
  una ripartenza, che oggi non esiste.
- **Il duello è un evento con due nomi.** `recupero` si sdoppia in `contrasto`, `intercetto` e
  `dribbling_riuscito`, ciascuno con `winnerId` e `loserId`: il difensore **converge davvero sul
  pallone e lo tocca**, e la cronaca dice *"Bastoni recupera su Leão"* invece di una palla che
  cambia colore.
- **La ripartenza nasce dal duello**: un pallone vinto nella metà avversaria marca il possesso
  successivo come `ripartenza` — catena corta, pochi tocchi, palla veloce in avanti, attaccanti
  già lanciati. È la conseguenza che oggi manca del tutto.
- **Cross → stacco**: quando la palla arriva larga e profonda, il cross **ha un bersaglio** (una
  punta in area), e il tocco successivo è un `colpo_di_testa`. Due tocchi legati, non uno isolato.
- **Filtrante**: un passaggio il cui ricevente sta **oltre la linea difensiva avversaria** diventa
  `filtrante` — raso, veloce, e il ricevente ci corre incontro. È la condizione che lo distingue
  da un lancio, e oggi non viene mai valutata.
- `TouchKind` += `filtrante`, `contrasto`, `intercetto`, `uno_due`, `sponda`.

### 7.3 Movimento senza palla di tutti e 22

`ShapeContext` guadagna `carrierId`, `receiverId`, `pattern` e `presserId`, e `tacticalPosition`
tre comportamenti che oggi non ha:

- **il pressing ha un nome**: l'avversario più vicino al portatore gli va addosso davvero, gli
  altri coprono invece di convergere tutti (era il difetto già misurato: raggio troppo largo →
  ventidue pallini rannicchiati attorno alla palla);
- **il supporto**: due compagni del portatore si smarcano, uno in ampiezza e uno in profondità,
  così il passaggio arriva a qualcuno che *si stava muovendo*;
- **l'area si attacca**: sul cross le punte vanno al primo e al secondo palo, e la difesa
  avversaria si stringe fra loro e la porta.

`intensity` smette di dipendere da `notable` (0,45 nei possessi normali, cioè quasi immobili) e
diventa funzione di prossimità del pallone e possesso.

### 7.4 Vista

Numeri di maglia (`MatchTheatre.tsx:760`) e cronaca (`:979`) **esistono già**: si migliorano, non
si costruiscono. Si aggiunge:

- **velocità della palla per tipo di tocco** — appoggio raso lento, filtrante teso e rapido, cross
  alto e lento, tiro rapidissimo — con la scia che ne mostra la direzione. Oggi la palla si muove
  con la stessa legge qualunque cosa sia;
- **nome sul portatore** e sul ricevente, per seguire l'azione senza andare a memoria;
- la cronaca scende **sotto il campo** come in FM, con il tabellone e l'orologio sopra;
- la transizione fra highlight (`23′ ⏭ 31′`) come momento dichiarato, non un taglio muto.

**Invariante, invariata e non negoziabile**: niente di tutto questo decide un risultato. Il flusso
si costruisce attorno al `MatchResult` già deciso; l'esito di ogni possesso non programmato si
estrae da una distribuzione in cui "gol" non compare. Test su molti semi, come oggi.

**Verifica.** Test sul motore: ogni partita produce almeno un duello con due nomi, almeno una
ripartenza nata da un recupero alto, e i cross hanno sempre un bersaglio; totali di tiri, falli e
angoli nella banda di una partita vera dopo la ritaratura. Nel browser: durata reale delle due
modalità misurata, e scatti lungo l'azione per verificare che passaggi, contrasti e cross si
leggano.

---

## 8. Nessuno spoiler prima del 2D

**Due cause, non una.**
1. Il guard copre **solo** `tab === "stagione"`. Le schede **Coppe** e **Classifica** si disegnano
   normalmente con lo stato già aggiornato (tabellone avanzato, eliminazione compresa) — visibili
   dietro il velo del modale, e comunque appena si chiude il prompt.
2. La UI decide cos'è una partita chiave con criteri **diversi** dal motore: `partitaChiave` passa
   `opponentPosition`, `advanceToNextStop` no. La UI può quindi marcare come chiave una partita a
   metà coda che il motore non ha usato come punto di arresto; le settimane successive continuano a
   scorrere, e il prompt arriva alla fine — per una partita di dodici giornate prima, con tutto il
   resto già successo.

**Intervento.**
- **Il criterio è uno solo.** `isKeyMatch` si sposta interamente nel motore: `WeekReport` guadagna un
  campo `keyMatch?: { reason, opponent, … }` compilato da `advanceWeek` con i dati che ha
  (`opponentPosition` compreso, che il motore conosce), e la UI **legge** quel campo invece di
  ricalcolarlo. Due implementazioni della stessa regola non possono più divergere.
- **Il velo copre tutto.** Finché `keyMatch` o `teatro` sono attivi, `main` mostra la sola frase di
  attesa qualunque sia la scheda, e la `TabBar` è disabilitata. Non è un espediente: è l'unico modo
  perché la domanda «vuoi vederla?» abbia senso quando la risposta è già nello stato.
- Il referto della giornata chiave (`setReport`/`setResults`) si accoda **dopo** la chiusura del
  teatro, non prima: oggi entra nella lista dei risultati nello stesso istante in cui si apre
  l'invito.

**Verifica.** Test sul motore: `advanceToNextStop` si ferma esattamente sulle partite per cui
`report.keyMatch` è presente, e quel referto è **sempre l'ultimo** della coda. Nel browser: si
arriva a un turno di Corona e si controlla che nessuna scheda mostri l'esito prima del fischio
finale del teatro.

---


---

## 9. Salvataggi: punti di ripristino, tasto Salva, rete di sicurezza

**Stato attuale.** `ds_careers` ha **una riga per carriera**, aggiornata sul posto, e
`useCareerPersistence` scrive 2,5 secondi dopo ogni azione. Non esiste alcun concetto di punto di
ripristino: si può solo riprendere da dove si era.

**Cosa vuole l'utente** (deciso esplicitamente): punti di ripristino veri a cui tornare, **al
massimo 2 per stagione**; un **tasto Salva** che scrive quando lo decide lui; e una rete di
sicurezza automatica per non perdere niente.

**Intervento.**

*Database* — nuova migrazione `ds_career_saves`: `career_id` (FK su `ds_careers`, `on delete
cascade`), `season`, `week`, `label`, `kind` (`manuale` | `automatico`), `state jsonb`,
`created_at`. RLS come `ds_careers` (l'utente vede e scrive solo i propri). La riga di
`ds_careers` resta la **testa** della carriera, cioè lo stato corrente: i punti di ripristino
sono la sua storia.

*La regola dei due per stagione* vive in un **trigger Postgres**, non nel client: dopo ogni
insert, i punti della stessa `(career_id, season)` oltre i 2 più recenti vengono cancellati.
Metterla nel client significherebbe che una scheda chiusa a metà lascia il vincolo violato — e
che due schede aperte insieme lo violano comunque.

*Scritture* — tre momenti, non più uno continuo:
- **Salva partita**, nella `TabBar` come azione contestuale: crea un punto `manuale` e aggiorna
  la testa. Con conferma visiva ("Salvato · 2027/28, giornata 19").
- **Rete di sicurezza automatica** (scelta dell'utente): `visibilitychange`/`pagehide` (chiusura
  o passaggio in secondo piano della scheda, l'unico evento affidabile su mobile), perdita di
  connessione (`offline`/`online`), e **fine stagione** — quest'ultimo crea anche il punto
  `automatico` della stagione, che è quello che uno vuole davvero ritrovare.
- L'autosave a 2,5 secondi **resta**, ma scrive solo la testa e non crea punti: è ciò che rende
  la rete di sicurezza vera senza riempire la tabella.

*Interfaccia* — l'elenco "continua carriera" (`DsMode`) mostra la carriera e, sotto, i suoi punti
di ripristino con annata e giornata; caricarne uno chiede conferma, perché sovrascrive la testa.

⚠️ **Il bug delle righe duplicate va chiuso comunque**: `useCareerPersistence` commenta il rischio
di creare due righe per la stessa carriera quando due scritture partono con `saveId` ancora
`null`. Con i punti di ripristino la tabella cresce, quindi il difetto diventa più visibile: si
serializza la prima scrittura (una promessa in `ref`, non un flag booleano, che non basta).

**Verifica.** Test SQL sul trigger: inserendo 5 punti nella stessa stagione ne restano 2, e i più
recenti. Nel browser: salvo, chiudo la scheda a metà giornata, riapro e ritrovo il punto; stacco
la rete e verifico che lo stato non si perda.

---

## 10. L'annata accanto al numero di stagione

**Scelta dell'utente**: stagione 1 = **2026/27**, poi 2027/28 fino a 2035/36 alla decima.

**Intervento.** Una funzione sola nel motore — `seasonLabel(season)` — e nessun calcolo sparso nei
componenti. Sostituisce "Stagione 3" con "Stagione 3 · 2028/29" nei nove punti che oggi stampano
il solo numero: testata della carriera, colloquio con la società, classifica, `NextTaskCard`,
resoconto di fine stagione, report della rosa, notiziario di mercato, schermata di trionfo, e la
card di condivisione (`shareCard.ts`).

⚠️ **Nota dichiarata**: le rose in database sono quelle reali **2025/26**, quindi la prima annata
giocata risulta un anno avanti rispetto ai dati. È una scelta consapevole dell'utente — l'annata è
un'etichetta di carriera, non una dichiarazione sulla provenienza dei dati — e va scritta in
CLAUDE.md, perché fra sei mesi sembrerebbe un errore.

**Verifica.** Test sulla funzione (stagione 1 → "2026/27", stagione 10 → "2035/36"). Nel browser:
l'annata compare ovunque compaia il numero di stagione, e cambia al cambio stagione.

---

## Ordine di lavoro

1. **Le uscite dal club** (§ 4-5) — il bug più netto, e il più veloce da chiudere.
2. **Lo spoiler** (§ 8) — piccolo, e va fatto prima del 2D perché ne condiziona il flusso.
3. **L'annata** (§ 10) — una funzione e nove punti di lettura: si fa subito e toglie di mezzo un
   dettaglio che altrimenti andrebbe ricordato dentro ogni schermata toccata dopo.
4. **Il 2D** (§ 7) — il blocco più grande insieme al § 6, e quello con la riscrittura di motore.
5. **Società** (§ 1) e **mister** (§ 2).
6. **Probe svincolati, poi ritaratura** (§ 3) — nell'ordine: prima si misura, poi si tocca.
7. **I salvataggi** (§ 9) — richiede una migrazione, quindi va dopo che la forma di `CareerState`
   ha smesso di cambiare (il § 6 le aggiunge campi).
8. **La fase stagione** (§ 6) — l'unico blocco che tocca la crescita: per ultimo, così le
   ricalibrazioni si fanno su un motore già fermo.

Verifica finale prima del push unico: `pnpm --filter @app/game-engine test`, `tsc -b --force` su
`apps/web`, `pnpm --filter web build`, `pnpm --filter web check:design`, e una carriera vera nel
browser sul dev server unico della 5173.

## Rischi dichiarati

- **La crescita cambia** (§ 6): con le medie voto dentro `applySeasonAdjustment`, chi rende cresce
  più di prima e chi non rende cala di più. Va rimisurato con `pnpm calibrate-piccola`, e se la
  scalata della piccola squadra si sposta il numero va dichiarato, non nascosto.
- **La riscrittura del motore 2D è la parte più rischiosa** (§ 7): l'invariante «guardare o saltare
  dà lo stesso esito» è ciò che tiene insieme tutta la modalità. Resta strutturale — l'esito di un
  possesso non programmato si estrae da una distribuzione in cui "gol" non compare — e va coperta
  da test su molti semi **prima** di toccare il resto del file.
- **La ritaratura delle statistiche** (§ 7.2): passando da ~280 a ~140 possessi, tiri, falli,
  angoli e fuorigioco raddoppierebbero di probabilità a parità di pesi. È già successo due volte in
  questo file di finire con 51 tiri o 38 falli a partita, e in entrambi i casi l'ha colto una
  misura, non un'occhiata: il test sui totali si scrive prima della ritaratura.
- **`simulateMatch`/`simulateMatchday` non si toccano** (§ 6): sono condivise con la Modalità
  Classica e protette dal characterization test che congela la sequenza del generatore casuale, su
  cui poggia la calibrazione del 38-0-0. Se quel test diventa rosso, ho toccato qualcosa che non
  dovevo.
- **La dimensione del salvataggio** (§ 6 e § 9): le statistiche di lega aggiungono qualche centinaio
  di voci, e i punti di ripristino moltiplicano lo stato per tre. Va misurata, non assunta — il
  tetto dichiarato è 100 KB per riga.
- **Il video di riferimento non l'ho visto** (§ 7): ho identificato FM09 dal titolo e concordato la
  specifica con l'utente. Se il risultato non somiglia a quello che aveva in mente, la causa più
  probabile è qui, ed è meglio saperlo prima di cercarla nel codice.
