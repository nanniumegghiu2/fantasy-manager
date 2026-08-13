# Piano — Leghe vetrina (club non giocabili) per la varietà del mercato DS

> Richiesta dell'utente (2026-08-13): *"Voglio aumentare il database della modalità ds con nuove
> squadre non giocabili e le loro rose, queste squadre serviranno ad aumentare il numero di
> giocatori in database per rendere il mercato più variegato ed evitare che si acquistino sempre
> gli stessi giocatori. Analizza sul web quali sono le squadre degne di nota non per forza
> europee e aggiungile al database"*.

## 1. Il problema, in una riga

Il pool acquistabile della DS mode è **lo stesso identico** di quello giocabile: 116 club dei
Big 5 più la Serie B. Chi cerca un attaccante da 84 trova sempre gli stessi venti nomi, e dopo
due carriere il mercato è memorizzato.

## 2. La scelta di disegno: leghe **vetrina**, non giocabili

Le nuove leghe entrano nel database ma **non** diventano selezionabili. Serve un concetto
esplicito, perché oggi tre punti del codice leggono "tutte le leghe del database" e si
autopopolerebbero il giorno stesso dell'import:

| Punto | File | Cosa farebbe senza filtro |
|---|---|---|
| Selettore club | `ClubPickerScreen.tsx` | proporrebbe di allenare il Flamengo |
| Corona Continentale | `buildCareerWorld.ts` → `continentalEntrants` | iscriverebbe le prime 4 di ogni lega nuova |
| Modalità Classica | `ClassicMode` | aggiungerebbe le nuove leghe al selettore competizione |

È **esattamente** lo stesso problema già affrontato con la Serie B (CLAUDE.md §3.7.12ter): le
esclusioni vanno **attive, non per omissione**. Quindi la politica vive in `divisions.ts`, che
è già "il modulo che sa che rango ha un campionato", accanto a `isSecondDivision`.

Nuovo predicato: `isShowcaseLeague(name)` + `isPlayableLeague(name)`.
`isContinentalEligible` e `isClassicEligible` diventano `!secondDivision && !showcase`.

### Perché non giocabili

Tre ragioni, tutte concrete:

1. **Il calendario non regge**: Brasile e Argentina giocano ad anno solare con formati diversi
   (Apertura/Clausura), MLS ha le conference. Il motore ha un solo formato, l'italiana a 18/20.
2. **Le coppe non esistono** per quei continenti: niente Libertadores, niente AFC Champions
   League. Un club brasiliano in Corona Continentale sarebbe assurdo.
3. **Non è ciò che è stato chiesto**: servono a fornire *giocatori*, non carriere.

## 3. Cosa entra automaticamente, senza scrivere codice

Verificato leggendo `buildCareerWorld.ts`: il mondo del mercato (`buildMarketWorld`) e il
mercato IA (`planWorldTransfers`) ricevono **tutti** i club del database, non solo quelli della
propria lega. Quindi i club vetrina sono da subito:

- acquistabili nella ricerca libera;
- esposti come "Cedibili IA" quando hanno eccedenze;
- **soggetti attivi del mercato IA riscritto** (comprano, vendono, rimpiazzano).

Quest'ultimo punto è il vero moltiplicatore di varietà: trenta club in più che si muovono ogni
stagione rimescolano il pool molto più di trenta club fermi.

### Nessun effetto collaterale sui valori di mercato — verificato

`eraDensityMultiplier` (`marketValue.ts`) satura a **20 club per epoca**
(`Math.min(clubsInEra / 20, 1)`), e nell'epoca `2025/26` ce ne sono già 116. Il moltiplicatore
è quindi già al massimo: aggiungere club **non muove di un euro** i valori esistenti. Andava
controllato prima di importare, non dopo — una carriera in corso che vede i prezzi cambiare da
sola sarebbe stata una regressione grave.

## 4. Scope: 8 campionati, 30 club, ~600 giocatori

Scelti per **diversità del bacino**, non per forza: aggiungere un sesto campionato europeo di
alto livello darebbe altri profili simili a quelli che già ci sono.

| Campionato | Nazione | Prestigio | Club |
|---|---|---|---|
| Primeira Liga | Portogallo | 3 | Benfica, Porto, Sporting CP, Braga |
| Eredivisie | Paesi Bassi | 3 | Ajax, PSV, Feyenoord, AZ Alkmaar |
| Süper Lig | Turchia | 3 | Galatasaray, Fenerbahçe, Beşiktaş, Trabzonspor |
| Brasileirão | Brasile | 3 | Flamengo, Palmeiras, Botafogo, São Paulo |
| Primera División | Argentina | 3 | Boca Juniors, River Plate, Racing, Estudiantes |
| Saudi Pro League | Arabia Saudita | 3 | Al Hilal, Al Nassr, Al Ittihad, Al Ahli |
| Liga MX | Messico | 2 | Club América, Monterrey, Tigres |
| Major League Soccer | Stati Uniti | 2 | Inter Miami, LAFC, Seattle Sounders |

Portogallo, Paesi Bassi e Turchia sono i tre grandi **esportatori** di talento verso i Big 5:
sono il bacino da cui il mercato pesca davvero. Brasile e Argentina portano un profilo di
giocatore che il database oggi ha solo di riflesso (i sudamericani già emigrati). Arabia Saudita
porta i trentenni di grande nome a cifre alte. Messico e MLS portano varietà anagrafica e
nazionalità nuove.

## 5. Fonte dati e onestà del dato (CLAUDE.md §2.1/2.3)

- **Fatti**: nome, data di nascita, nazionalità, posizione grossa (G/D/M/F) da
  [footballsquads.co.uk](https://www.footballsquads.co.uk), la stessa fonte già usata per la
  Serie B e per i club di Serie A senza pagina Wikipedia dedicata. Riporta solo rosa e
  anagrafica: nessuna statistica, nessuna valutazione proprietaria di terzi.
- **Stime editoriali nostre, dichiarate**: la casella puntuale sui 14 ruoli dello scacchiere
  (la fonte distingue solo quattro lettere) e l'**Overall**.
- **Mai** FM, mai EA FC, mai API a pagamento.

### Bande di Overall dichiarate

Tarate perché ogni lega si collochi dove sta davvero rispetto ai Big 5, e perché nessuna
diventi una scorciatoia per trovare fuoriclasse a poco prezzo:

| Campionato | Banda | Riferimento |
|---|---|---|
| Primeira Liga | 62-84 | i tre grandi giocano la Champions; il resto è fondo rosa |
| Eredivisie | 62-82 | stessa logica, tetto un punto più basso |
| Süper Lig | 62-83 | rose costruite su stranieri d'esperienza |
| Brasileirão | 62-83 | i top brasiliani valgono la Serie A |
| Primera División | 61-80 | bacino giovane, tetto più basso |
| Saudi Pro League | 62-86 | il tetto più alto: ci sono ex-fuoriclasse veri |
| Liga MX | 61-79 | |
| MLS | 60-80 | Messi è l'eccezione dichiarata |

## 6. Ordine di lavoro

1. `divisions.ts`: `SHOWCASE_LEAGUES`, `isShowcaseLeague`, `isPlayableLeague`; aggiornare
   `isContinentalEligible`/`isClassicEligible`. **Con i test prima dell'import**, altrimenti
   non c'è modo di sapere che le esclusioni funzionano.
2. `ClubPickerScreen` + `ClassicMode`: filtrare le leghe.
3. `seeds/showcase-2025-26/`: un file per campionato.
4. `src/importShowcase.ts`: validazioni (nessun doppione fra club, banda di Overall, due
   portieri, copertura ruoli), dry run di default, `--apply` per scrivere.
5. `pnpm recompute` **non** va rilanciato con la potatura sotto 65 (`prune-roles`), che
   cancellerebbe metà dei club vetrina — stessa avvertenza già valida per la Serie B.

## 7. Rischi dichiarati

- **Volume di dati scritto a mano**: ~600 righe di anagrafica. È il grosso del lavoro ed è dove
  si annidano gli errori di trascrizione. Mitigato dai controlli dell'importer, che sono gli
  stessi che hanno già intercettato tre difetti nell'import della Serie B.
- **Gli Overall sono nostri**: nessuna pretesa di oggettività, come per Serie A e Serie B.
- **Le rose sono curate, non complete**: si tengono 20-24 giocatori per club, senza i ragazzi
  del vivaio — stessa regola della Serie B, per la stessa ragione (allungano le liste senza
  essere mai una scelta sensata).
