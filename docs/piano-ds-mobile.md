# Piano — Rinnovo grafico totale della modalità DS su mobile

> Stato: **implementato** (2026-08-15) — tutte e sette le fasi, con la misura di controllo in
> **Parte D**. Scritto prima di toccare il codice, come `piano-serie-b.md` e
> `piano-ds-rifiniture.md`. Le cinque decisioni aperte sono state prese dall'utente e sono
> registrate in **Parte C**.
>
> Richiesta dell'utente: *«su schermi piccoli ci sono frasi tagliate, passaggi poco intuitivi,
> grafiche non ottimizzate che rendono l'esperienza d'uso davvero faticosa e poco piacevole… i
> test fatti su giocatori alla loro prima esperienza d'uso sono andati malissimo, la gente
> faceva davvero tanta difficoltà a capire cosa fare trovandosi altamente spaesata»*. Più, in
> corso di analisi: *«le sezioni richieste e contratto del mister per esempio sono poco
> intuitive, deve essere una sequenza di azioni, prima le richieste, poi ingaggio e durata di
> contratto»*.

---

## 0. Metodo — misurato, non ipotizzato

Non ho giudicato le schermate a occhio. Ho **pilotato la modalità in un browser reale a
360×740** (Android piccolo, il caso peggiore realistico ma comunissimo) sul dev server già in
ascolto sulla 5173, e a ogni schermata ho misurato dal DOM: quali nodi di testo sono davvero
troncati e di quanto, quanti stanno sotto i 12px, quali bersagli tattili stanno sotto i 44px,
se la pagina scrolla in orizzontale. I numeri qui sotto vengono da lì, non da una stima.

**La scoperta che cambia la forma del piano**: le tre lamentele dell'utente — frasi tagliate,
passaggi poco intuitivi, grafiche non ottimizzate — **non sono tre problemi**. Sono tre sintomi
di una causa sola: *non esiste un sistema di design*. Ci sono 43 schermate scritte in nove mesi,
ognuna con la sua scala tipografica, i suoi raggi, le sue altezze di modale, le sue regole di
densità. Il testo si taglia perché ogni schermata ha inventato la propria dimensione minima; i
passaggi sono poco intuitivi perché ogni schermata ha inventato la propria grammatica di
navigazione; l'insieme sembra non ottimizzato perché *lo è*, ma non nel senso di "brutto": nel
senso di non progettato come un insieme.

Per questo il piano **non è un elenco di correzioni**. La fase 0 costruisce il sistema che manca,
e da lì in poi il lavoro è applicarlo. Correggere le 98 troncature una per una lascerebbe in
piedi la causa, e la novantanovesima nascerebbe la settimana dopo.

**Una cosa che il rinnovo non tocca**: il motore. Tutta la logica sta in
`packages/game-engine` ed è coperta da 799 test — questo è un lavoro su `apps/web/src/ds/`
soltanto, e la regola di confine di CLAUDE.md § 9 (la UI non calcola nulla di simulativo) resta
invariata. È anche ciò che rende il rinnovo sicuro: si può rifare tutta la presentazione senza
rischiare una riga di bilanciamento.

---

# Parte A — Diagnosi

## A1. La causa di tutto: non c'è un sistema di design, ci sono 43 improvvisazioni

`apps/web/src/index.css` definisce **solo colori**. Nessuna scala tipografica, nessuna scala di
spaziatura, nessuna scala di raggi, nessuna elevazione, nessuna misura di bersaglio tattile.
Ogni schermata se le è inventate, e si vede:

| Dimensione | Cosa dovrebbe esserci | Cosa c'è davvero in `ds/` |
|---|---|---|
| Testo | 4-5 misure dichiarate | **353 usi di misure arbitrarie sotto i 12px**: 175 × `text-[11px]`, 150 × `text-[10px]`, 28 × `text-[9px]` — più `8px` misurati a runtime nella scheda Rosa |
| Raggi | 2-3 | **7** (`full`, `2xl`, `xl`, `lg`, `3xl`, `md`, `sm`) mescolati senza regola |
| Altezza modale | 1 | **9 diverse** (68, 72, 75, 78, 80, 85, 86, 90, 92 svh) |
| Bersaglio minimo | 44px, sempre | `min-h-11` compare in **5 file su 43** |

Le nove altezze di modale meritano una riga a parte, perché sono la ragione per cui l'app
"salta": aprendo il mercato, poi una trattativa, poi il rinnovo di un contratto, il foglio
cambia dimensione tre volte. Non è un difetto che si sa nominare guardandolo — si sente come
sciatteria generale, ed è esattamente la sensazione che l'utente descrive.

**Il testo sotto i 12px è il problema singolo più grave dell'intera modalità.** 11px è la
misura *dominante* del corpo del testo (175 usi), non un'eccezione per le note a margine. Su un
telefono, con luce forte o vista non perfetta, 11px non si legge: si indovina. E quando non si
legge, si smette di leggere — che è il primo passo verso "non capisco cosa devo fare".

## A2. La navigazione del mercato è **illeggibile**, e non per poco

Il mercato è dichiarato in CLAUDE.md § 3.7.5 come *il cuore della modalità*. Ecco cos'è la sua
barra di navigazione su 360px, misurata:

| Voce | Larghezza disponibile | Larghezza necessaria | Cosa si legge |
|---|---|---|---|
| Finanze | 26px | 41px | `Fi…` |
| Offerte | **3px** | 40px | *niente* — solo l'icona e il numero |
| Mercato | 26px | 45px | `M…` |
| Rosa | 4px | 26px | *niente* |
| Notizie | 26px | 39px | `N…` |

**Quattro voci su cinque non hanno un'etichetta leggibile.** La causa è strutturale, non di
taratura: `SegmentedNav` mette cinque voci `flex-1` dentro un foglio da 360px, ognuna con icona
(14px) + gap + etichetta + badge. Restano ~26px per la parola. Nessuna parola italiana utile ci
sta. La sotto-barra ha lo stesso difetto (`C..` per "Cedibili IA", `Svinc…` per "Svincolati").

Nella stessa schermata ho contato **139 nodi di testo sotto i 12px e 58 bersagli sotto i 44px**.
Nella scheda Notizie: **178 nodi sotto i 12px, di cui 46 a 9px**.

E sopra il contenuto ci sono **sei livelli di cromo**: intestazione del foglio → briefing →
barra principale → scheda promesse → sotto-barra → campo di ricerca. Su 740px di altezza
restano visibili **una card e mezza di giocatore**. Il cuore della modalità si guarda da una
feritoia.

## A3. Il primo cancello della carriera **non ha una via d'uscita visibile** — è qui che nasce lo spaesamento

Questa è la scoperta più importante dell'analisi, ed è la risposta diretta al *«non capivano
cosa fare»*.

Appena scelto il club, si apre la trattativa col mister. Lo stato in cui arriva un giocatore
nuovo, misurato:

- il pulsante primario in basso a destra è **disabilitato** e recita **«Manca il rinnovo»** — non
  è una chiamata all'azione, è un messaggio d'errore vestito da bottone;
- l'**unica** azione abilitata e vistosa è rossa e recita **«Rifiuta Condizioni»** — cioè l'unica
  cosa che si può ovviamente premere è quella che manda tutto a monte;
- ciò che sblocca la situazione sta in **un'altra scheda** (`Contratto`), e l'unico segnale è un
  **pallino rosso da 6px** sull'etichetta;
- dentro quella scheda, la soluzione sono **cinque bottoni nudi «1 2 3 4 5»** sotto la scritta
  "DURATA DEL RINNOVO", senza stato selezionato, con lo stesso stile delle scatole di statistica
  immediatamente sopra — quindi non sembrano nemmeno premibili.

**Prova concreta, non impressione**: ho scritto tre versioni di uno script che clicca
automaticamente qualunque bottone la cui etichetta contenga *Accetta, Firma, Conferma, Prosegui,
Continua, Va bene, Ho capito*. **Nessuna delle tre è riuscita a superare questa schermata.** Ci
sono passato solo alla quarta, dopo aver letto il codice e istruito lo script a premere il
numero «3». Se un automa che prova tutte le parole di conferma della lingua italiana resta
bloccato al primo cancello, un essere umano al primo contatto non ha alcuna possibilità.

Su questa schermata l'utente ha già dato la direzione, e coincide con la diagnosi: **deve essere
una sequenza — prima le richieste, poi ingaggio e durata**. Il difetto vero delle due schede non
è come sono disegnate: è che presentano come *paralleli e opzionali* due passi che sono
*sequenziali e obbligatori*. Una barra a schede dice "guarda dove vuoi"; qui la verità è "prima
questo, poi quello, e senza il secondo non si chiude".

Lo stesso vizio, in forma più lieve, sta in altri quattro punti: il meeting di mercato, la scelta
dell'obiettivo, il tavolo del contratto in acquisto, il faccia a faccia coi giocatori.

## A4. Frasi tagliate: 98 punti nel codice, fino al **54% del testo perso**

`truncate` compare 98 volte in `ds/`. I casi peggiori misurati a runtime:

| Dove | Testo | Spazio / Necessario | Perso |
|---|---|---|---|
| `CaptaincyCard` | «4 anni al club · è nettamente il più forte della rosa» | 175 / 381px | **54%** |
| `MarketPanel` | «Promesse Contrattuali · Nuri Şahin» | 168 / 267px | 37% |
| `CareerScreen` (testata) | «Stagione 1/10 · Nuri Şahin (4-2-3-1) · Sintonia 75%» | 200 / 245px | 18% |
| `CupPanel` | «Olympique de Marseille» | 104 / 154px | 32% |
| `ClubPickerScreen` | «Jonathan Michael Burkardt» | 110 / 134px | 18% |

Due cause diverse, e vanno separate perché le soluzioni sono opposte:

1. **Righe che vogliono dire troppo su una riga sola.** La testata della carriera impila club,
   stagione, mister, modulo e sintonia in una riga di 200px. Non è un problema di font: è che
   quella riga sta facendo il lavoro di quattro. Va **ristrutturata**, non rimpicciolita.
2. **Nomi legali completi al posto dei cognomi.** Il club picker mostra «Joshua Walter Kimmich»,
   «Serhou Yadaly Guirassy», «Alejandro Grimaldo García» dove servirebbe «Kimmich». Il progetto
   ha **già** la funzione che serve — `cognome()` in `MatchTheatre.tsx:648`, `shortName()` in
   `classic/Pitch.tsx:124` — scritta due volte e non usata dove serve di più. Va promossa in
   `format.ts` e applicata a tutte le liste.

## A5. Bersagli tattili sotto la soglia, ovunque

Misurato: **58 bersagli sotto i 44px** nella sola scheda Mercato. I casi sistematici:

- le schede della carriera (Stagione, Rosa, Classifica, Coppe, Storico) sono alte **28px**;
- le mosse della trattativa col mister sono alte **29px** — e sono le decisioni più importanti
  della schermata;
- la fila delle leghe nel club picker è alta **38px**;
- i tondini di chiusura/indietro sono **36×36px** in tutte e 43 le schermate.

44×44px non è una preferenza estetica: è la soglia sotto la quale il dito sbaglia. Un tocco
sbagliato su un bottone rosso «Rifiuta» non è un fastidio, è una decisione di gioco presa per
errore.

## A6. Il cromo mangia lo schermo, il contenuto sta sotto la piega

- **Dossier del club**: tre numeri (budget, giocatori in rosa, prestigio) occupano tre schede
  impilate da ~150px l'una. La prima schermata del dossier mostra **tre numeri**. La rosa — che è
  la ragione per cui il dossier esiste (CLAUDE.md § 3.7.9) — è molto sotto la piega, e niente
  dice che ci sia.
- **Trattativa col mister**: ~500px di vuoto assoluto in mezzo alla schermata, mentre il testo
  attorno è a 10-11px.
- **Scheda Rosa**: il campo tattico è **tagliato in basso dalla barra fissa** — due giocatori si
  vedono a metà. La formazione, cioè l'oggetto della schermata, non è mai visibile per intero.
- **Club picker**: paragrafo introduttivo di cinque righe in cima, sempre, a ogni visita. Sotto,
  una card e mezza.

## A7. La safe area è gestita in **1 overlay su 19**

`env(safe-area-inset-bottom)` compare in un solo file della modalità
(`CoachNegotiationChat.tsx`, aggiunto dopo una segnalazione). Tutte le altre barre fisse — inclusa
quella che porta **il pulsante principale dell'intera modalità** in `CareerScreen` — finiscono
sotto la barra gestuale su iPhone e sui Pixel moderni.

## A8. Zero onboarding, 19 overlay diversi

Non esiste **una sola riga** di guida, di primo avvio, di suggerimento contestuale in tutta la
modalità. Un giocatore nuovo incontra, senza preparazione: dirigenza, obiettivo stagionale,
rinnovo del mister, cambio modulo, mercato a cinque schede, trattativa a sei mosse, faccia a
faccia coi giocatori, imprevisti, partita chiave, fine stagione, report rosa. **Diciannove tipi
di sovraimpressione diversi.**

Ognuno di questi, preso da solo, è ben progettato dal punto di vista del *gioco*. Il problema è
che arrivano tutti insieme, senza che niente abbia mai spiegato che cos'è un direttore sportivo
in questo gioco, e senza che nessuna schermata risponda mai alla domanda **«e adesso cosa
faccio?»**. La modalità sa dire cosa *è successo*; non sa mai dire cosa *conviene fare*.

## A9. Emoji in interfaccia: 28, vietate dal progetto stesso

CLAUDE.md § 8 dice, come vincolo permanente: *«Niente emoji in UI»*. In `ds/` ce ne sono **28**
in testo visibile, concentrate proprio nei punti peggiori: le mosse della trattativa col mister
(💡 ❌ ⏳ 🔄 💰), i filtri del report di fine stagione (📈 📉 😠 ⚽), la copertura ruoli (❌ ⚠️),
il titolo di fine stagione (👑🏆). Su Android e iOS si disegnano con due font di sistema
diversi: la stessa schermata cambia aspetto fra due telefoni.

---

# Parte B — Il piano

Sette fasi, in ordine di dipendenza reale. Le fasi 0-2 sono quelle che spostano l'ago sul
problema dichiarato (spaesamento e fatica); le 3-6 rendono il risultato presentabile.

## Fase 0 — Le fondamenta: il sistema di design che manca

**Non produce nulla di visibile, e va fatta per prima**: è ciò che rende le sei fasi successive
un lavoro di applicazione invece che sei nuove improvvisazioni.

**0a. Token in `index.css`**, accanto ai colori che già ci sono:

- **Tipografia** — cinque misure, non ventisette. `--fs-display: 28px` (numeri protagonisti,
  budget, risultato), `--fs-title: 19px`, `--fs-body: 15px` (**il corpo del testo, oggi 11px**),
  `--fs-label: 13px` (**il minimo assoluto**, oggi 9-10px), `--fs-micro: 12px` (solo per
  etichette maiuscole di una-due parole). Interlinea e peso dichiarati con ognuna.
- **Spaziatura** — scala a 4px: 4, 8, 12, 16, 24, 32.
- **Raggi** — tre: `--r-card: 16px`, `--r-control: 12px`, `--r-pill: 999px`. Le altre quattro
  spariscono.
- **Bersaglio** — `--tap: 44px`, e diventa il minimo di ogni cosa premibile.
- **Elevazione** — tre livelli dichiarati per superficie/foglio/sovraimpressione, invece di
  bordi e sfondi decisi caso per caso.

**0b. Primitive condivise** in `apps/web/src/ds/ui/`, che oggi non esistono e sono riscritte a
mano in ogni file:

| Primitiva | Sostituisce | Perché |
|---|---|---|
| `Sheet` | **19** overlay scritti a mano | Un'altezza sola, una animazione sola, safe-area **dentro la primitiva**, chiusura per trascinamento, intestazione con titolo e azione singola |
| `Button` | ~200 bottoni artigianali | Varianti (primario/secondario/fantasma/distruttivo), `--tap` garantito, e **stato disabilitato che dice cosa fare, non cosa manca** |
| `ListRow` | ~15 copie di "riga con avatar, due righe di testo, azione" | La riga di lista è il mattone della modalità: giocatori, club, mister, offerte, notizie |
| `StatRow` | 3-4 layout diversi di statistiche | Numeri affiancati e leggibili invece di card impilate (fase 3) |
| `Stepper` | *niente* | La sequenza a passi della fase 2 |
| `Chip` | 4 stili diversi di etichetta | Ruoli, filtri, stati |

**0c. La regola che impedisce la ricaduta.** Una regola ESLint che **vieta `text-[Npx]`
arbitrario** dentro `ds/`. Senza, fra tre mesi ci sarà un `text-[9px]` nuovo, ed è esattamente
così che si è arrivati a 353. La regola è il sistema; il resto è documentazione.

## Fase 1 — La navigazione: da pillole tagliate a barra da app vera

**1a. Carriera → barra inferiore fissa.** Le cinque schede (Stagione, Rosa, Classifica, Coppe,
Storico) lasciano la fila che scorre in cima e diventano una **tab bar inferiore da 56px + safe
area**, icona sopra ed etichetta a 12px sotto — la forma che ogni giocatore ha già nel pollice da
qualunque altra app. Risolve tre cose insieme: i bersagli passano da 28px a 56, le etichette
smettono di scorrere fuori schermo (oggi "Storico" è invisibile), e la navigazione arriva dove
sta il pollice invece che in cima allo schermo.

Il pulsante grande («Gioca fino al mercato») sale **sopra** la tab bar come barra d'azione
contestuale, con la safe area gestita una volta sola dalla primitiva.

**1b. Mercato → da cinque voci a quattro, e le etichette si leggono.** *Finanze* non è un posto
dove si va: è un dato che serve **mentre** si decide. Sparisce come scheda e diventa (i) due
numeri sempre visibili in testata — cassa mercato e margine ingaggi — e (ii) il pannello
completo dietro il tocco su quei numeri. Restano **Offerte, Cerca, Rosa, Notizie**: quattro
parole corte che a 90px l'una si leggono per intero.

**1c. La regola generale, che vale per il futuro.** *Se l'etichetta non ci sta, non è una barra a
segmenti.* Sotto le cinque voci si usa una barra; sopra, un menù. La sotto-barra del mercato
(Ricerca / Cedibili IA / Svincolati / Mister) diventa un **filtro a chip scorrevoli** con
sfumatura di bordo che dice che c'è dell'altro — non quattro segmenti compressi che si tagliano.

## Fase 2 — I momenti di decisione diventano **sequenze** (richiesta esplicita dell'utente)

È la fase che risponde direttamente al *«la gente non capiva cosa fare»*, ed è la più importante
delle sette.

**2a. Trattativa col mister: da due schede parallele a tre passi.**

```
 ①  RICHIESTE          ②  CONTRATTO           ③  ACCORDO
 ●━━━━━━━━━━━━━━━━━━━━━━━○━━━━━━━━━━━━━━━━━━━━━○
 Cosa vuole il mister    Ingaggio e durata     Firma
```

- Uno **stepper in cima** che dice sempre dove si è, quanti passi restano, e cosa manca.
- **Una sola azione primaria per passo**, sempre in fondo, sempre nella stessa posizione:
  «Passa al contratto» → «Proponi il contratto» → «Chiudi l'accordo».
- I cinque numeri nudi «1 2 3 4 5» diventano una **fila di opzioni con etichetta e conseguenza
  dichiarata**: *«3 stagioni — 2,3M€/anno · 6,9M€ in totale»*, con lo stato selezionato evidente
  e un valore preselezionato di default. **Nessun passo può cominciare senza una scelta valida
  già in campo**: si può cambiare idea, non si può restare bloccati per omissione.
- «Rifiuta Condizioni» smette di essere l'unica cosa vistosa: diventa un'azione secondaria di
  testo, dove vanno le uscite.

**2b. La regola che nasce da qui, e vale per tutta la modalità.** Un pulsante primario
**disabilitato non descrive mai il problema**: o è abilitato, o dice *l'azione che lo sblocca*.
«Manca il rinnovo» diventa «Scegli la durata del contratto» e porta lì. Questa singola regola,
applicata ai sette punti in cui oggi ci sono CTA disabilitate mute, elimina la classe di difetto
che ha bloccato i tester.

**2c. Stessa forma per gli altri tre cancelli sequenziali**: il meeting di fine mercato
(richieste → titolarità → chiusura), il tavolo del contratto in acquisto (club → contratto →
firma: lo stepper esiste già come testo «1 · CLUB ✓ / 2 · CONTRATTO», diventa il componente
vero), l'obiettivo stagionale (campionato → coppe → conferma).

## Fase 3 — Il mercato respira

- **Da sei livelli di cromo a due.** Il briefing («La stagione non è ancora cominciata» + numeri)
  si comprime in **una riga sola** toccabile per espandersi; la scheda promesse del mister si
  chiude in un accordion, aperto solo quando c'è qualcosa di scaduto. Guadagno misurato sulla
  struttura attuale: **~260px**, cioè da 1,5 a 4 card di giocatore visibili.
- **Card giocatore ridisegnata** con la gerarchia giusta per la domanda vera («lo prendo o no?»):
  cognome grande, Overall come pastiglia, età e ruolo come dati secondari, prezzo allineato a
  destra, azione a tutta larghezza sotto. Oggi cognome e club stanno alla stessa misura.
- **Filtri in un foglio inferiore.** Oggi otto controlli (ricerca, reparto, ruoli multi, prezzo,
  età min/max, Overall min/max, prestiti, ordinamento) stanno sopra i risultati e li spingono
  fuori schermo. Vanno dietro un bottone «Filtri» con il conteggio di quelli attivi, e i
  risultati si prendono lo schermo.

## Fase 4 — Il testo si legge per intero

- **Cognomi nelle liste**: `cognome()` sale in `format.ts` (oggi duplicata in due file) e si
  applica a club picker, ricerca, offerte, rosa, coppe. Il nome completo resta nel dettaglio,
  dove c'è spazio.
- **Niente `truncate` sui dati che identificano qualcosa.** Un nome, un club, un ruolo: due righe
  sono permesse, il taglio no. Il taglio resta solo dove il testo è davvero accessorio.
- **Le righe che dicono troppo si dividono.** La testata della carriera passa da una riga
  impilata a due livelli: club e stagione sopra; mister, modulo e sintonia come pastiglie sotto,
  che vanno a capo invece di tagliarsi.
- **Le 28 emoji** sostituite con icone Lucide, che è la regola già scritta del progetto (§ 8) e
  in più si disegna uguale su ogni telefono.

## Fase 5 — La prima esperienza: da «e adesso?» a «ecco cosa fare»

Le fasi 0-4 tolgono la fatica. Questa toglie lo **spaesamento**, ed è la ragione per cui i test
sono andati male.

**5a. «Il tuo compito adesso»** — una card in cima alla scheda Stagione che risponde sempre alla
domanda che nessuna schermata risponde oggi: cosa conviene fare, e perché. Non è un tutorial ed è
per questo che funziona: **legge lo stato che il motore già produce** (fase, obiettivo dichiarato,
posizione, offerte in sospeso, richieste del mister, scontenti). *«Il mercato chiude fra 3
giornate. Il mister aspetta ancora un difensore centrale.»* Utile anche alla decima stagione, non
solo alla prima.

**5b. Tre schermate di introduzione**, una volta sola, saltabili, prima della scelta del club:
cosa fa un direttore sportivo qui (non alleni: costruisci), cosa chiude la carriera
(retrocessione ed esonero), dove si vince (il mercato). Oggi queste tre informazioni ci sono —
sparse in paragrafi di 11px che nessuno legge.

**5c. Suggerimenti contestuali al primo incontro**, uno per sistema (mercato, spogliatoio,
dirigenza, coppe), mostrati una volta e archiviati in `localStorage` — **fuori dal salvataggio
della carriera**, che deve restare sotto i 100 KB (§ 3.7.13) e non deve contenere stato di
interfaccia.

**5d. Stati vuoti che insegnano.** Oggi: «La classifica compare dopo la prima giornata.» Dice
cosa manca, non cosa fare. Diventa un invito con l'azione dentro.

## Fase 6 — Rifinitura, e le regole che impediscono la ricaduta

- **Safe area** dentro `Sheet` e nella barra d'azione: risolta in un posto, non in diciannove.
- **Movimento coerente**: una durata, una curva, e rispetto di `prefers-reduced-motion`, che oggi
  non è considerato da nessuna parte.
- **Riscontro tattile e visivo** su ogni azione che cambia lo stato (oggi solo il mercato ha il
  suo `DealToast`).
- **Verifica finale su tre viewport reali** — 360×740, 390×844 (iPhone), 430×932 — con lo stesso
  strumento di misura usato per questa diagnosi, e i numeri messi accanto a quelli di partenza.

---

## Ordine, e cosa si vede quando

| Fase | Cosa cambia per chi gioca | Rischio |
|---|---|---|
| 0 — Sistema | *Niente* (fondamenta) | Nullo: solo aggiunte |
| 1 — Navigazione | Si capisce dove si è e dove si va | Basso |
| 2 — Sequenze | **Si capisce cosa fare** | Medio: tocca i flussi |
| 3 — Mercato | Il cuore del gioco si guarda bene | Medio |
| 4 — Testo | Si legge tutto | Basso |
| 5 — Prima esperienza | Non ci si perde più | Basso: sopra lo stato esistente |
| 6 — Rifinitura | Sembra un prodotto finito | Basso |

**Se la presentazione fosse domani** e si potesse fare una cosa sola: la **fase 2** (le
sequenze), che è la causa diretta del fallimento dei test. Se se ne potessero fare due: 2 + 1.
Le fasi 0 e 4 sono però quelle che fanno la differenza fra "hanno sistemato dei bug" e "è
un'altra app", perché agiscono su tutte le 43 schermate insieme.

---

# Parte C — Decisioni prese dall'utente (2026-08-15)

| | Decisione | Esito |
|---|---|---|
| **D1** | Ampiezza | **Rinnova tutto** — tutte e 43 le schermate |
| **D2** | Desktop | **Mobile-first, il desktop eredita** (raccomandazione accolta) |
| **D3** | Tono visivo | **(b) Editoriale sportivo** — numeri protagonisti, palette del logo invariata |
| **D4** | Introduzione | **Entrambe** — le tre schermate saltabili *e* i suggerimenti contestuali |
| **D5** | Misura finale | **Sì** — stessa misura automatica a fine lavoro, numeri accanto a quelli di partenza |

Il testo originale delle cinque domande resta qui sotto come registro del perché.

**D1 — Ampiezza.** Il piano copre **tutte e 43 le schermate** della modalità. Alternativa: le 12
del percorso principale (elenco, club, dossier, mister, carriera, rosa, mercato, trattativa,
obiettivo, fine stagione) e le altre in un secondo giro. *La mia raccomandazione: tutte* — con il
sistema della fase 0 in piedi, le 31 restanti sono lavoro rapido, e lasciarne metà vecchie
riprodurrebbe esattamente l'incoerenza che stiamo togliendo.

**D2 — Il desktop.** La modalità oggi ha due layout in due punti (`lg:flex-row` nella carriera).
Rifaccio mobile-first e il desktop eredita, oppure li tratto come due progetti? *Raccomandazione:
mobile-first con il desktop che eredita*, coerente con il pilastro «mobile-first reale» (§ 1).

**D3 — Il tono visivo.** Tre strade, e cambiano molto il risultato finale:
- **(a) Evoluzione** — stessa palette, densità e gerarchia sistemate. Sicuro, meno "wow".
- **(b) Editoriale sportivo** *(raccomandata)* — la palette resta quella del logo (§ 8.1), ma i
  numeri diventano protagonisti (budget, Overall, risultato in cifre grandi e tabulari), le
  superfici si appiattiscono, l'oro e il rame restano riservati a coppe e trofei. È il linguaggio
  delle app sportive moderne, ed è già dove il progetto tende.
- **(c) Rifacimento espressivo** — gradienti, illustrazioni, transizioni fra schermate. Il più
  vistoso e il più rischioso: è anche la strada che porta più facilmente all'aspetto generico che
  § 8 vieta esplicitamente.

**D4 — L'introduzione (5b).** Tre schermate saltabili prima della scelta del club, o niente
introduzione e solo i suggerimenti contestuali (5c)? *Raccomandazione: entrambe* — visto l'esito
dei test, e visto che è saltabile in un tocco.

**D5 — Quando misuriamo di nuovo.** Rifaccio girare la stessa misura automatica a fine lavoro e
metto i numeri accanto a questi (troncature, testo sotto i 12px, bersagli sotto i 44px, per
schermata). *Raccomandazione: sì* — è l'unico modo di dimostrare che il rinnovo ha funzionato
invece di affermarlo.

---

# Parte D — Esito misurato (2026-08-15)

Stessa misura automatica della diagnosi, stesso percorso, tre viewport (decisione D5). **17
schermate** attraversate a ciascuna larghezza.

| | Prima | Dopo (360px) | 390px | 430px |
|---|---|---|---|---|
| Frasi tagliate | **41** | **5** | 3 | 2 |
| Testo sotto i 12px | 353 nel codice, fino a **8px** a schermo | **34, tutti a 11px** (eccezione dichiarata) | 34 | 34 |
| Bersagli sotto i 44px | 91 | **32** (30 sono i gettoni del campo) | 32 | 32 |
| Overflow orizzontale | 0 | **0** | 0 | 0 |
| Errori in console | 0 | **0** | 0 | 0 |
| Misure arbitrarie nel codice | **665** | **15** (solo altezze di modale, fase futura) | | |
| Emoji in interfaccia | **28** | **0** | | |

**Il numero che conta più di tutti.** Il primo cancello della carriera — quello che nessuno dei
tre automi riusciva a superare — ora si supera in **3 tocchi ciechi**: *Ascolta le sue richieste*
→ *Passa a ingaggio e durata* → *Chiudi l'accordo*. Lo stesso script, senza alcuna conoscenza del
codice.

**L'eccezione dichiarata.** I 34 nodi sotto i 12px e 30 dei 32 bersagli piccoli sono tutti i
**gettoni della lavagna tattica**: il campo è largo ~330px e regge cinque giocatori affiancati,
quindi una targhetta a 13px si sovrapporrebbe a quella accanto. Sono etichette di un diagramma —
come i nomi su una mappa — non testo che si legge di seguito, e stanno accanto al numero grande
dell'Overall che è il dato che si cerca davvero. Alzate comunque **da 8-9px a 10-11px**. È
l'unico posto in tutta la modalità dove la scala non si applica, ed è scritto nel codice.

## Difetti veri trovati strada facendo (non pianificati)

Tre non erano nella diagnosi: li ha fatti emergere il lavoro.

1. **`backgroundColor: "var(--brand)18"`** in `SeasonObjectiveScreen`: non è CSS valido — un
   `var()` non si concatena con l'alfa — quindi quella fascia non ha **mai** avuto lo sfondo che
   l'autore intendeva. Stessa famiglia del `copper-700` inesistente già registrato nel Decision
   Log: Tailwind e CSS falliscono in silenzio, e il difetto sopravvive perché nessuno vede un
   errore.
2. **La schermata dell'obiettivo non scorreva**: nessuna altezza massima, nessun `overflow`. Con
   finanze, due coppe da dichiarare e tre fasce il contenuto supera i 740px di un telefono
   piccolo, e le ultime scelte finivano fuori schermo **senza modo di raggiungerle** — cioè la
   stessa classe di vicolo cieco del cancello del mister, in una schermata che compare ogni
   stagione.
3. **Un difetto introdotto da me, e colto guardando** (non da un test): `cognome()` prendendo
   l'ultima parola trasformava «Virgil van Dijk» in **«Dijk»**. Non una semplificazione
   imperfetta: un nome sbagliato, in un gioco di calcio. Corretto con la tabella delle particelle
   (`van`, `de`, `dos`, `van der`…). Resta il limite dichiarato dei doppi cognomi iberici, dove
   si sceglie l'ultimo e non sempre è quello d'uso.

## Cosa resta

- **Le 15 altezze di modale** scritte a mano: spariscono man mano che i restanti overlay passano
  alla primitiva `Sheet`. La guardia `pnpm --filter web check:design` le tiene contate.
- **Nessuna verifica su iOS reale**: le misure vengono da Chromium con `isMobile`. Safari, safe
  area vera e dimensione minima del testo nei campi restano da vedere su un dispositivo.
- **I suggerimenti contestuali (5c)** non sono stati costruiti: ci sono l'introduzione (5b) e la
  card «Il tuo compito adesso» (5a), che è quella che lavora a ogni stagione e non solo alla
  prima.

---

## Nota di metodo — cosa non ho fatto

- **Non ho toccato una riga di codice.** Questo documento è da approvare prima.
- **Non ho verificato su iOS reale.** Le misure vengono da Chromium a 360×740 con `isMobile`. Le
  differenze note (Safari, safe area, dimensione minima del testo nei campi) restano da vedere su
  un dispositivo vero, e la fase 6 le mette in conto.
- **Il percorso misurato è la prima stagione.** Schermate che vivono più avanti — dirigenza,
  esonero, trionfo, teatro della partita — le ho lette nel codice ma non fotografate in
  esecuzione: la diagnosi su quelle è per lettura, e lo dichiaro.

---

# Parte E — Il difetto di prestazioni (2026-08-15, dopo la segnalazione)

Segnalazione dell'utente dopo il rinnovo: *«graficamente è molto godibile ma lento e macchinoso
nella navigazione e nei click dei tasti»*.

## La causa: `careerPlayers` ricostruita dentro un ciclo

`careerPlayers(state, world)` fa `{ ...world.players }` — copia l'**intero indice del mondo**,
3.564 giocatori nel database reale. È chiamata in fondo a decine di funzioni di lettura
(`playerFactsOf`, `playerValue`, `peerWage`, `contractFor`…), che a loro volta girano **una volta
per giocatore** dentro cicli come `dressingRoom`.

Misurato (`perf.bench.test.ts`, mondo da 3.526 giocatori, rosa da 26):

| | prima | dopo |
|---|---|---|
| `dressingRoom` senza regen | 9,1ms | 3,0ms |
| `dressingRoom` con **un** regen | **1.817ms** | **2,8ms** |
| copie dell'indice per chiamata | **1.902** | **1** |

Quasi **due secondi di JavaScript bloccante** per consultare lo spogliatoio, e la funzione è
consultata a ogni render.

## Perché non si era mai visto prima, e perché si vede adesso

Il difetto è **preesistente al rinnovo**, ma era silente per una ragione precisa: con
`state.generated` vuoto la funzione esce subito senza copiare nulla. `generated` si popola col
primo regen, cioè **dalla seconda stagione in poi**. Chi giocava una stagione non lo incontrava
mai.

Il rinnovo l'ha reso visibile in due modi, e il secondo è colpa mia:
- `NextTaskCard` consulta lo spogliatoio, e sta nella scheda Stagione, che si ri-renderizza **a
  ogni referto mostrato** durante la corsa — uno ogni 260ms;
- l'avevo scritta **senza `useMemo`**, quindi ogni giornata pagava il conto daccapo.

⚠️ **La mia verifica non poteva coglierlo**: la misura di Parte D percorre 17 schermate ma non
supera mai la **prima stagione**, dove `careerPlayers` esce subito. È il limite dichiarato di
quella misura, non un caso sfortunato — e la lezione è che un percorso di prova che si ferma
all'inizio non prova ciò che succede dopo.

## La correzione

Due cache per identità (`WeakMap`), su `careerPlayers` e su `dressingRoom`. Sono corrette perché
nessuno dei loro ingredienti viene mai mutato sul posto — `world.players` si ricostruisce a ogni
stagione, `state` e `state.generated` si riassegnano a ogni azione (verificato: nessun
`.push`/`.splice` in tutto il motore, e nessun chiamante scrive nel risultato). Più il `useMemo`
mancante in `NextTaskCard`.

Fatte **al posto giusto**: 26 punti chiamano `careerPlayers`, e correggerli uno per uno avrebbe
lasciato in piedi la trappola per il prossimo che la chiama dentro un ciclo.

⚠️ **Il benchmark è stato riscritto per battere la propria cache** — cronometra uno `state` nuovo
a ogni giro. Misurando lo stesso oggetto avrebbe misurato la memoizzazione e non il calcolo, e
sarebbe restato verde anche con il costo vero tornato a mille millisecondi: lo stesso antipattern
già registrato nel Decision Log (2026-07-31, 2026-08-13).

## Cosa resta, misurato e non risolto

Con CPU rallentata 4× (telefono di fascia media), in **prima stagione** — dove le cache non
c'entrano perché il difetto non si manifestava:

| azione | al fotogramma | JavaScript bloccante |
|---|---|---|
| cambio scheda della carriera | 85-245ms | 0-113ms |
| **apertura del mercato** | **568ms** | **454ms** |
| scheda Notizie | 434ms | 352ms |
| scheda Cerca | 305ms | 238ms |

Le letture del motore in quel pannello costano ormai ~3ms in tutto: il resto è **disegno** — la
finestra monta 466 nodi in un colpo, fra la lavagna tattica, la rosa e le sue righe. A riposo la
modalità sta a 165 fps senza un solo long task, quindi non c'è nessun ciclo che gira a vuoto: è
il costo di montare un pannello grande tutto insieme.

La strada, se l'apertura del mercato resta fastidiosa: montare **solo la scheda attiva** e
rimandare la lavagna tattica a quando la si guarda davvero.
