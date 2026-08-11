# Piano — Serie B, promozioni/retrocessioni e Coppa Nazionale

> Stato: **bozza da approvare**. Nessuna riga di codice scritta prima dell'ok dell'utente,
> stessa procedura di `docs/piano-spogliatoio-contratti.md`.

## 0. Cosa chiede l'utente

1. Popolare il database con la **Serie B italiana** (club + rose).
2. Legare Serie A e Serie B con **promozioni e retrocessioni: 3 salgono, 3 scendono**.
3. Aggiungere una **Coppa Nazionale** fra squadre di A e B.
4. Rendere così possibile il **triplete**: campionato + Corona Continentale + Coppa Nazionale.

---

## 1. Cosa ho verificato nel codice prima di pianificare

Non sono ipotesi: ognuna è stata letta.

| Fatto | Dove | Perché conta |
|---|---|---|
| `Cartel1.xlsx` contiene **solo i Big 5** (Bundesliga 866, Serie A 687, Premier 609, Liga 554, Ligue 1 488 righe). **Nessuna riga di Serie B.** | ispezione diretta del foglio | I dati Serie B **non esistono**: vanno compilati da zero, non importati. È il pezzo di lavoro più grande del progetto. |
| La retrocessione **chiude la carriera** (`ending: "retrocessione"`, ultimi tre posti) | `ds/career.ts:2978` | Con la Serie B in gioco questa riga cambia significato: è la decisione di prodotto centrale. |
| La lega della carriera è **fissa** (`CareerState.leagueId`), le avversarie sono `clubsOfLeague(leagueId)` | `career.ts:277`, `buildCareerWorld.ts:44` | Promozione/retrocessione significa che il club **cambia lega**, e che la composizione delle due leghe cambia ogni anno: serve un modello di appartenenza che oggi non esiste. |
| La Corona prende le **prime 3 di ogni lega presente in `world.leagues`** + 1 ripescata | `buildCareerWorld.ts:69` | Aggiungendo la Serie B come sesta lega, **tre club di Serie B entrerebbero in Corona**. Difetto certo se non lo si previene. |
| Le partecipanti alla Corona dalla 2ª stagione sono l'**élite fissa** del mondo, non ricalcolate | `career.ts:3295` (`nextSeasonCup`) | Semplificazione già dichiarata: non va toccata, va solo esclusa la Serie B dal pool. |
| Il calendario ha **un solo tipo di slot coppa** e vieta due turni di coppa nella stessa settimana (`taken`) | `season/calendar.ts:78-89` | Una seconda coppa richiede di estendere lo slot e di rivedere la congestione: oggi 9 turni di Corona su 38 settimane, con 1 settimana occupata dal mercato. |
| `CareerState.cup` è **una sola** `CupSave` | `career.ts:288` | Serve un secondo campo salvato per la Coppa Nazionale. |
| Il motore di coppa è **girone + tabellone**, con sorteggio a cerchio anti-connazionali | `season/cup.ts` | Riusabile per intero il **tabellone** (`simulateKnockoutRound`, supplementari, rigori 50/50); il girone e il vincolo di lega **non servono** a una coppa nazionale. |
| La Classica ricava le competizioni **dai campionati presenti nel pool** | `classic/SetupScreen.tsx:81` | La Serie B comparirà **da sola** nel selettore della Classica appena entra nel database, e i suoi giocatori entreranno nel pool "tutto il database". Va deciso, non subìto. |
| `pnpm recompute` ricalcola Overall e valore di **tutti** i giocatori | `data-scripts/recompute.ts` | Obbligatorio dopo il popolamento (CLAUDE.md §2.3). |
| Serie A in database: **20 club, 472 giocatori** (dopo la potatura sotto 65) | CLAUDE.md §2.3 | È il metro dimensionale per la Serie B. |

### La conseguenza non ovvia: chi retrocede dalla Serie A quando io gioco in Serie B?

Oggi **si simula una sola lega**: la nostra. Gli altri campionati non esistono come
competizione, esistono solo come rose. Se la carriera prosegue in Serie B, la Serie A deve
comunque produrre una classifica per sapere chi scende — e viceversa.

Serve quindi una **simulazione leggera della lega gemella**, una volta a fine stagione: 380
partite con lo stesso `expectedGoals`/Poisson già calibrato, seedate dal seme di carriera.
Costo trascurabile (una volta l'anno, non a ogni clic) e riusa il motore esistente.

---

## 2. Decisioni prese dall'utente (2026-08-11)

| | Decisione | Conseguenza |
|---|---|---|
| **D1** | **Overall editoriale completo, prima di tutto il resto** | ~500 giocatori valutati uno per uno, come i 1.777 dei Big 5. La Fase 1 è quindi lunga e va **completata prima** di scrivere il motore: niente prior-ponte. |
| **D2** | **La carriera continua in Serie B** | Retrocedere dalla A porta in B; retrocedere **dalla B** chiude la carriera. È il cambiamento più profondo al cuore della carriera. |
| **D3** | **Coppa Nazionale a 40 squadre con preliminare** | 8 club di B al turno preliminare → 32 → 16 → 8 → 4 → finale. Tutti dentro. |
| **D4** | **Nessun posto in Corona per il vincitore della coppa** | La Corona resta solo per piazzamento in Serie A. Semplifica: `nextSeasonCup` non va toccata nella sua logica di qualificazione, solo esclusa la Serie B. |
| **D5** | La coppa si chiama **Coppa Tricolore** | Nome originale, nessun marchio reale. |
| **D6** | **La Serie B non entra nella Modalità Classica** | Va esclusa esplicitamente: oggi comparirebbe da sola nel selettore, che si costruisce dai campionati del pool. |
| **D7** | **Schermata di trionfo a scala di livelli**, non solo per il triplete | Un trofeo → card sobria, due → doppietta, tre → trattamento pieno. Stessa implementazione, visibile in ogni carriera vincente. Vedi §5bis. |
| **D8** | Sulla card condivisibile: **trofei + numeri chiave** | Punti, differenza reti, capocannoniere, finali vinte. |

**Assunzioni che applico se non dici altro:**

- `era = "2025/26"`, coerente con tutto il resto del database.
- Serie B a **20 club**, 38 giornate, come la Serie A.
- Promozione **diretta secca: prime 3**. Niente playoff/playout (aggiungibili dopo: sono
  un tabellone in più, non un cambio di modello).
- Le altre quattro leghe **non hanno seconda divisione**: la coppia promozione/retrocessione
  è una proprietà della sola Italia, dichiarata nel modello e non generalizzata a vuoto.
- La **Serie B è esclusa dalla Corona Continentale** in ogni caso (confermato esplicitamente
  dall'utente). Va escluso il *campionato*, non i singoli club: un club **retrocesso** in B non
  gioca la Corona nemmeno se l'anno prima si era qualificato, e uno **promosso** in A vi accede
  solo col piazzamento della stagione successiva. Conseguenza diretta: **il triplete è
  irraggiungibile dalla Serie B**, dove i trofei in palio sono due.
- `leagues.prestige_tier` della Serie B = **1**; `clubs.prestige_tier` fra 1 e 2.
  Conseguenza automatica: valori di mercato bassi, budget bassi, allenatori di fascia bassa.
- In **Classica la Serie B non esiste** (decisione dell'utente): il selettore resta ai Big 5 +
  Superlega, e i suoi giocatori restano fuori sia dal pool per competizione sia da "tutto il
  database". **Non è un non-fare**: oggi la Classica ricava le competizioni dai campionati
  presenti nel pool, quindi la Serie B comparirebbe da sola — va esclusa esplicitamente in
  `ClassicMode`/`useDraftPool`, con un test che lo blocca.
- Il **triplete** è riconosciuto solo dalla Serie A (in B la Corona non si gioca).

---

## 3. Fase 1 — I dati (il pezzo più lungo)

**Non esiste una scorciatoia legale**: niente FM, niente EA FC/SoFIFA, niente API a pagamento
(CLAUDE.md §2.1/2.2). Fonte: pagine Wikipedia "2025–26 <club> season" e, per i club senza
pagina dedicata (la norma in Serie B), [footballsquads.co.uk](https://www.footballsquads.co.uk)
— solo rosa, ruolo, nazionalità, data di nascita: fatti, mai valutazioni altrui.

Volume stimato: **20 club × 23-26 giocatori ≈ 480-520 righe**.

**Overall: editoriale completo (D1).** Valutazione scritta uno per uno, stesso statuto
dichiarato dei Big 5 — stima nostra, in `overall_override`, così un `recompute` non la
sovrascrive. Banda di riferimento **58-74**, con pochissimi 75+ (tipicamente i retrocessi
dalla Serie A e i prestiti dei club di A). Vincolo di coerenza da verificare a valle: la
**mediana Serie B deve stare sotto il 25° percentile della Serie A**, altrimenti il mercato
fra le due leghe diventa incoerente.

Conseguenza sull'ordine di lavoro: la Fase 1 **non è parallelizzabile** con le altre e va
chiusa per prima.

**Deliverable**
- `packages/data-scripts/seeds/serie-b-clubs.ts` — 20 club, prestigio, rose fattuali.
- `packages/data-scripts/src/importSerieB.ts` — `pnpm import-serie-b` (dry run di default,
  `--apply` per scrivere), stesso schema di `importBig5Leagues.ts`: transazione unica,
  rieseguibile senza duplicati.
- `packages/data-scripts/seeds/editorial-overalls-serie-b.ts` (se opzione A).
- `pnpm recompute` obbligatorio a valle.
- Verifica: ogni casella dei 14 ruoli ha candidati sufficienti in Serie B, altrimenti il
  draft della Classica su quella competizione è irriempibile (è già successo una volta, vedi
  Decision Log 2026-07-28 sui Quinti).

---

## 4. Fase 2 — Promozioni e retrocessioni (il modello)

Nuovo modulo `packages/game-engine/src/ds/divisions.ts`.

**Modello di appartenenza.** Non si salvano 40 club per 10 stagioni: si salva **solo lo
scostamento**, cioè chi è salito e chi è sceso, stagione per stagione — poche decine di byte,
stesso principio già usato per `worldTransfers` e per i contratti.

```
CareerState.divisions?: {
  /** Movimenti stagione per stagione: 3 su, 3 giù. Il resto si deriva dal database. */
  moves: { season: number; promoted: string[]; relegated: string[] }[];
}
```

`leagueOfClub(clubId, season)` applica i movimenti al `league_id` del database. **Tutti** i
punti che oggi leggono `club.leagueId` passano da qui: avversarie di campionato, prestigio di
lega nel calcolo del valore di mercato, filtri di ricerca del mercato, `ClubViewerModal`.

**La lega gemella.** A fine stagione, `simulateSiblingLeague` produce la classifica della lega
in cui *non* siamo, con lo stesso modello attacco-contro-difesa già calibrato, seedato da
`derivedRandom(seed, "sibling", season)`. Da lì escono le sue 3 promosse o 3 retrocesse.
Riproducibile da salvataggio, come tutto il resto.

**La carriera continua in Serie B (D2).** `closeSeason` non chiude più la carriera sugli ultimi
tre posti: cambia `leagueId`, registra il movimento, e la stagione dopo si gioca in B con
avversarie, budget e allenatori di quella lega. La carriera finisce (`ending: "retrocessione"`)
**solo** retrocedendo dalla Serie B, perché sotto non c'è nulla.

Due conseguenze che vanno progettate insieme, non dopo:

- **Il budget deve fare male.** Retrocedere taglia il fatturato, promuovere lo finanzia:
  moltiplicatori espliciti in `budget.ts`, tarati con un nuovo `pnpm calibrate-promozione` in
  sola lettura — stesso metodo di `calibrate-piccola`, che è ciò che ha reso giocabile la
  piccola squadra. Senza misura, o si risale al primo colpo o non si risale mai.
- **La rosa non regge il salto**, in nessuna delle due direzioni. Retrocessi: i migliori
  ricevono offerte (`MAX_BUYER_GAP` li rende plausibili per i club di A) e il monte ingaggi
  sfora. Promossi: la rosa che ha dominato la B è sotto il livello della A. È esattamente il
  mercato che questa implementazione deve rendere interessante, non un effetto collaterale
  da smorzare.

**Deliverable**: `ds/divisions.ts`, modifiche a `closeSeason`, `buildCareerWorld`, `budget.ts`,
overlay di fine stagione con l'esito (promosso / salvo / retrocesso), test su: i movimenti
sommano sempre 3+3, nessun club finisce in due leghe, una carriera ripresa da salvataggio
riproduce gli stessi movimenti.

---

## 5. Fase 3 — La Coppa Nazionale

Nome scelto: **Coppa Tricolore**. Originale, come impone CLAUDE.md §2 — mai "Coppa Italia".

Nuovo `packages/game-engine/src/season/nationalCup.ts` + `ds/careerNationalCup.ts`, gemelli di
quelli della Corona. Si riusa `simulateKnockoutRound` per intero: partita secca, supplementari
a λ ridotta, rigori 50/50. Nessun girone, nessun vincolo di lega (è tutta la stessa lega).

**Formato: 40 squadre con preliminare (D3).** Entrano tutte — 20 di A e 20 di B.

| Turno | Squadre in campo | Chi entra |
|---|---|---|
| Preliminare | 16 (8 partite) | le 16 peggio classificate di Serie B |
| Primo turno | 32 | 8 qualificate + 4 di B esentate + 20 di A |
| Ottavi | 16 | |
| Quarti | 8 | |
| Semifinale | 4 | |
| Finale | 2 | |

Cinque turni per un club di Serie A, sei per uno di B partito dal preliminare. Sorteggio
**libero** a ogni turno: è lì che nasce la sorpresa della piccola che elimina la grande, ed è
il motivo per cui la coppa è interessante per chi gioca in B.

**Congestione del calendario.** Chi fa Corona + Coppa Nazionale arriva a **14 turni
infrasettimanali** su 38 settimane. `buildSeasonCalendar` va esteso a due tipi di coppa, con la
regola: mai due coppe nella stessa settimana, mai una coppa nella settimana di mercato. I turni
nazionali si collocano nelle frazioni lasciate libere dalla Corona. Effetto voluto e da
dichiarare: **la rotazione della rosa diventa davvero necessaria** — la fatica esiste già nel
motore (`fatigueTeamModifier`) e finora pesava poco.

**Nessun posto in Corona per il vincitore (D4).** La Corona resta riservata al piazzamento in
Serie A: `nextSeasonCup` non cambia logica, va solo esclusa la Serie B dal pool delle iscritte.
La coppa vale per sé stessa — e per il triplete.

**Triplete.** `SeasonSummary` guadagna `treble?: true` quando nella stessa stagione si vincono
campionato + Corona + Coppa Tricolore. Non è però solo un flag: ha una schermata sua — §5bis.

**Deliverable**: motore coppa, `CareerState.nationalCup`, slot di calendario, `CupProgress` a
due strisce, pannello coppa con selettore, `isKeyMatch` esteso ai turni secchi dai quarti in su
(coerente col filtro già stretto della Corona), `pnpm probe-coppa-nazionale` per misurare che
la forza conti davvero — è la misura che ha già corretto una volta il formato della Corona.

---

## 5bis. La schermata di trionfo, condivisibile (richiesta dell'utente)

> "Se si riesce a fare il triplete voglio un festeggiamento speciale per condividere il trionfo
> con gli amici sui social, una bella schermata di trionfo."

### Cosa c'è già, e cosa manca davvero

`CelebrationConfetti.tsx` (109 righe) e i banner dorati di `SeasonEndOverlay.tsx` esistono e si
riusano. **Non esiste invece nulla per la condivisione**: nel progetto non c'è una sola
occorrenza di `navigator.share`, `canvas`, `toBlob` o `clipboard`, e non c'è alcuna dipendenza
tipo `html2canvas`. Questa parte si costruisce da zero.

### Come si genera l'immagine — e perché non con una libreria

Tre strade, ne scelgo una e dichiaro il perché:

| | Verdetto |
|---|---|
| `html2canvas` / `dom-to-image` | **Scartata.** Nuova dipendenza pesante su un bundle che deve restare piccolo (§1), e resa notoriamente incerta su gradienti, filtri e font — cioè esattamente tutto quello che rende bella questa schermata. |
| SVG serializzato → `Image` → canvas | **Scartata.** Richiede il font Manrope **incorporato in base64** dentro l'SVG, altrimenti il testo esce con un ripiego di sistema. Decine di KB e un punto di rottura silenzioso. |
| **Canvas imperativo** | **Scelta.** Zero dipendenze nuove, controllo totale, output identico ovunque. Il font non è un problema: Manrope è già caricato nella pagina e il canvas lo usa, a patto di attendere `document.fonts.ready` prima di disegnare — dettaglio che, se dimenticato, produce una card col font sbagliato solo al primo tentativo, cioè il tipo di difetto che sfugge in fase di test. |

Nuovo `apps/web/src/ds/shareCard.ts`: funzione pura-ish che riceve i dati del trionfo e
restituisce un `Blob` PNG. Sta in `apps/web` e non nel motore perché è disegno, non
simulazione (§9).

**Due formati**, entrambi generati dallo stesso codice cambiando le proporzioni:
- **1080×1350** (verticale da feed): il formato che non viene tagliato da nessuna parte.
- **1080×1920** (storie): a tutto schermo su Instagram/WhatsApp.

### Come si condivide

1. `navigator.canShare({ files })` → **Web Share API** con il file allegato: su mobile apre il
   foglio di condivisione nativo con WhatsApp, Instagram, Telegram. È il percorso principale,
   perché l'app è mobile-first.
2. Se non supportata (desktop, browser vecchi): **scarica il PNG** + **copia il testo** negli
   appunti, con conferma visibile.

Nessuna integrazione con SDK di terze parti, nessuna chiamata di rete: l'immagine nasce e
resta sul dispositivo finché non è l'utente a mandarla. Nessun dato lascia l'app da solo.

### Cosa c'è sulla card (D8: trofei + numeri chiave)

Nome del club, stagione, i trofei vinti disegnati da noi, e i numeri che rendono il trionfo
raccontabile a un amico che al gioco non ha mai giocato: **punti in campionato, differenza
reti, capocannoniere della rosa, finali vinte**. Più il **wordmark Fantasy Manager con il
logo**, e in piccolo la riga di disclaimer di §2.

I numeri vengono da `SeasonSummary`, che li ha già tutti tranne il capocannoniere: quello si
ricava dalla rosa a fine stagione (`stats.goals`), dove `playerReports` lo espone già.

Il disclaimer sulla card **non è pedanteria**: l'immagine porta il nome di un club reale
**fuori** dall'app, dove non c'è più il contesto che lo qualifica come gioco indipendente.
In app quel contesto c'è, in un post su Instagram no. Nessuno stemma, nessuna foto: solo
grafica originale, come sempre. E il wordmark che viaggia con l'immagine è anche l'unica
promozione gratuita che questa funzione si porta dietro.

### Quando appare: una scala a livelli (D7)

Non una schermata per il solo triplete, ma **la stessa schermata a intensità crescente** —
decisione dell'utente dopo aver visto il rischio qui sotto:

| Trofei nella stagione | Trattamento |
|---|---|
| 1 | Card sobria, un trofeo, coriandoli leggeri. Titolo: il nome del trofeo vinto. |
| 2 | Due coppe affiancate, coriandoli più densi, accento rame/oro. Titolo: "Doppietta". |
| 3 | Trattamento completo: oro pieno, coriandoli al massimo, i tre trofei in sequenza a molla, fasci di luce. Titolo: "TRIPLETE". |

È una sola implementazione con tre gradi di intensità, non tre schermate — così il lavoro si
vede in ogni carriera che vinca qualcosa, e il triplete resta comunque riconoscibile a colpo
d'occhio come la cosa più rara.

### Il rischio che ha portato a quella scelta: quanto spesso si vedrebbe il solo triplete?

Il triplete richiede campionato + Corona + Coppa Tricolore **nella stessa stagione**. Con i
numeri già misurati nel progetto (una rosa da titolo vince il campionato nel ~59% dei casi, la
Corona nell'ordine del ~10% anche partendo fortissimi dopo il girone, e una coppa a
eliminazione secca su cinque turni sta nella stessa fascia) l'ordine di grandezza è **~1% a
stagione**, cioè circa **una carriera su dieci** ne vede uno.

Costruire una schermata elaborata che quasi nessuno vedrà sarebbe un cattivo affare — ed è
esattamente perché la macchina è **identica** per qualunque trofeo che si adotta la scala a
livelli qui sopra.

### Deliverable

- `apps/web/src/ds/shareCard.ts` — generazione PNG su canvas, due formati.
- `apps/web/src/ds/TriumphScreen.tsx` — presa a tutto schermo: trofei in ingresso a molla,
  numeri che salgono, coriandoli, e i due pulsanti (condividi / salva immagine).
- Estensione di `CelebrationConfetti` per il livello "triplete" (più denso, oro pieno).
- `SeasonSummary.trophies: { league: boolean; continental: boolean; national: boolean }`,
  con `treble` derivato — un solo campo che risponde a tutte le domande, invece di tre flag
  sparsi che poi non concordano.
- Test sul motore: `treble` è vero **solo** con tutti e tre, e mai raggiungibile dalla Serie B
  (dove la Corona non si gioca) — il caso limite che un flag booleano scritto a mano
  sbaglierebbe.

---

## 6. Ordine di lavoro e verifiche

| Fase | Contenuto | Rischio |
|---|---|---|
| 1 | Club + rose Serie B, **Overall editoriali uno per uno**, import, `recompute` | Basso tecnicamente, **molto lungo**. Da chiudere per prima: le fasi 2-5 la presuppongono |
| 2 | `divisions.ts`, lega gemella, carriera che continua in B, budget di promozione/retrocessione | **Alto**: tocca il cuore della carriera |
| 3 | Coppa Tricolore a 40, calendario a due coppe, flag trofei | Medio |
| 4 | UI (club picker, classifiche, overlay promozione/retrocessione, pannello coppa) + **schermata di trionfo condivisibile** (§5bis) | Basso il primo gruppo, medio la card su canvas |
| 5 | Calibrazione (`calibrate-promozione`, `probe-coppa-nazionale`), test, pubblicazione | Medio |

La Fase 1 è la sola non parallelizzabile: con Overall editoriali completi (D1) la Serie B non
esiste finché non è valutata, e calibrare promozione/retrocessione contro dati provvisori
significherebbe tarare due volte.

Cancelli di verifica, gli stessi di sempre: `pnpm --filter @app/game-engine test` verde,
`tsc -b --force` pulito su `apps/web`, build di produzione, e infine **push su `origin master`**
(regola permanente §9.3 — il lavoro non è concluso finché non è online).

Test che scriverò **prima** di toccare `closeSeason`, perché è la parte che può rompere
carriere già salvate: un characterization test che congela una stagione completa (risultati,
classifica, budget di fine anno) con seme fisso, sullo stesso modello di
`championshipCharacterization.test.ts`.

---

## 7. Rischi dichiarati

1. **La Serie B in Corona**: certo se non si esclude esplicitamente in `continentalEntrants`.
2. **Salvataggi esistenti**: `divisions` e `nationalCup` sono opzionali e assenti nei vecchi
   salvataggi — vanno trattati come "carriera senza promozioni", non come errore.
3. **Il pool della Classica**: la Serie B entra da sola nel selettore. Va gestita, non subìta.
4. **Overall della Serie B troppo alti**: valutando 500 giocatori in blocco è facile scivolare
   verso l'alto e ritrovarsi la Serie B sopra il fondo rosa della Serie A. Verifica obbligatoria
   dopo l'applicazione: la mediana Serie B **sotto** il 25° percentile della Serie A, e nessun
   club di B con undici titolari sopra il peggiore di A.
6. **La retrocessione non deve diventare indolore**: se il budget di Serie B resta troppo
   generoso si risale al primo colpo e la retrocessione smette di far paura — il rischio
   opposto a quello di oggi, dove chiude la carriera. È il motivo per cui la Fase 5 esiste.
5. **Congestione**: 14 turni di coppa più 38 giornate possono rendere la stagione lunga da
   scorrere. Se succede, il rimedio è accorpare turni nella stessa settimana, non tagliare
   competizioni.
