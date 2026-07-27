# CLAUDE.md — Bibbia del progetto "Fantasy Manager"

> **Istruzione permanente**: questo file va **letto integralmente all'inizio di ogni sessione** di lavoro su questo progetto e **aggiornato ad ogni implementazione, correzione o scelta** (architetturale, di design o di prodotto). Non è documentazione statica: è la fonte di verità corrente del progetto. Se una decisione presa qui viene superata da una scelta successiva, questo file va corretto — non lasciare sezioni obsolete.
>
> Lingua: la documentazione di progetto (questo file, commit, discussioni) è in italiano, coerente con il team. Il codice (nomi variabili/funzioni, commenti se strettamente necessari) è in inglese, per convenzione standard.

---

## 0. Cos'è questo progetto

Web app React, ottimizzata al massimo per mobile, ispirata al gioco virale **38-0-0** (draft-game calcistico dove si costruisce una rosa pescando giocatori da club/decenni reali, ottenendo un record simulato su 38 partite — l'obiettivo perfetto è 38 vittorie, 0 pareggi, 0 sconfitte). Il gioco originale non ha account, non ha PvP reale, non ha classifiche persistenti ed è in una zona grigia legale (nomi reali senza licenza esplicita).

Questo progetto ne costruisce una versione potenziata: account persistenti, PvP 1v1 in tempo reale con vera componente tattica, sistema di livelli in stile Clash Royale, mini tornei tra amici, classifiche globali/mensili con sfide variabili — il tutto con attenzione esplicita agli aspetti legali.

**Nome prodotto**: **Fantasy Manager**. ⚠️ Esistono già più app/giochi calcistici con questo esatto nome (es. "Fantasy Manager Soccer" su Play Store) — rischio di sovrapposizione di naming/possibile conflitto di marchio, segnalato all'utente. Non blocca lo sviluppo ma va rivalutato nella revisione legale prima del lancio pubblico (sez. 2).

**Identità visiva**: logo fornito dall'utente (scudo verde muschio/rame con schema tattico stilizzato, in `logo.png` alla root e `apps/web/public/logo-512.png` ottimizzato). Palette del tema derivata campionando i colori dominanti del logo — vedi sez. 8.

---

## 1. Visione e pilastri di design

- **Velocità**: draft a tempo, match PvP max 90 secondi totali.
- **Mobile-first reale**: touch target grandi, one-thumb play, PWA installabile.
- **Tattica reale in PvP**: scelte a tempo che pesano concretamente sul risultato — mai pura simulazione statistica passiva.
- **Legalmente difendibile**: nessun asset ufficiale, disclaimer chiaro, dati trattati come fatti storici/statistici.
- **Design moderno e originale**: mai "AI-generated look" — vedi sez. 8 (Linee guida UI/UX).

---

## 2. Vincoli legali e gestione dati (permanenti — non negoziabili senza revisione esplicita)

- **Nessun asset ufficiale**: stemmi club, loghi di lega, kit, font ufficiali → sempre grafica originale.
- **Nessuna foto reale di giocatori** → avatar generici/silhouette. Mai immagini reali.
- **Naming prodotto e modalità**: evitare marchi registrati (es. niente "Champions League" reale, niente wordmark di leghe ufficiali) nel branding di app/modalità/livelli.
- **Disclaimer visibile** in app: "Questo prodotto è un gioco indipendente non affiliato, sponsorizzato o approvato da leghe, club o calciatori citati. I dati utilizzati hanno natura storica e statistica."
- **Dati come fatti**: nomi e statistiche reali trattati come dati storici/fattuali (non protetti da copyright); evitare di copiare testi editoriali da fonti terze (bio, descrizioni) — generare contenuti originali o usare solo numeri.
- **Revisione legale prima di lancio pubblico/monetizzazione**: todo permanente, non ancora fatto.

### 2.1 Strategia dati giocatori/club (permanente)

**Niente Football Manager, niente database di videogiochi/terzi**: verificato che l'EULA di Sports Interactive vieta esplicitamente l'estrazione/riuso dei dati di FM fuori dal gioco, e i nomi dei giocatori sono concessi in licenza a SI in modo specifico (accordo con FIFPRO) e non trasferibile a terzi. Usare il database di FM sarebbe una violazione diretta, non una zona grigia. Fonti: [SI — FMDB Data Supply License Terms](https://cdn.sports-interactive.com/site/2024-11/SI%20-%20FMDB%20Portal%20-%20Data%20Supply%20License%20Terms%20-%2015%20November%202024%20-%20JC%20(FINAL).pdf), [FM Legal](https://community.sports-interactive.com/sigames-manual/football-manager-2023/legal-r4739/).

**Niente API sportive a pagamento o "gratuite" senza vero diritto di pubblicazione**: verificato che API-Football/api-sports.io non concede diritti di pubblicazione nemmeno sul piano free, e football-data.org riserva l'uso commerciale ai piani a pagamento. L'utente ha confermato di volere solo soluzioni gratuite e legalmente pulite, quindi niente API di terzi come fonte per `player_pool`/`clubs`.

**Fonte dati adottata — dataset originale compilato da noi**:
- **Fonte primaria strutturata (gratuita, CC0/dominio pubblico)**: [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing), via SPARQL Query Service o REST API, per i fatti anagrafici/di carriera (nome, anno di nascita → era/decennio, nazionalità, ruolo, squadre per cui ha giocato e periodo).
- **Statistiche di dettaglio** (gol, presenze, assist, trofei) dove Wikidata non ha il dato strutturato: compilazione/verifica manuale incrociando più fonti pubbliche — mai estrazione massiva automatizzata di un singolo database altrui (es. niente scraping bulk di Transfermarkt, protetto da diritto sui generis sulle banche dati).
- **Niente testi editoriali copiati** da Wikipedia o altre fonti: solo numeri/fatti: i testi descrittivi in-app sono sempre scritti originali.
- **Conseguenza sullo scope**: pool v1 **curato**, non esaustivo come FM — club iconici per lega/epoca con rosa credibile (15-25 giocatori), non l'intero campionato.

**Scope leghe/epoche v1** (confermato con l'utente):
- **Leghe**: Big 5 europee — Serie A, Premier League, Liga, Bundesliga, Ligue 1.
- **Epoche per lega**: 3-4 decadi rappresentative (es. anni '90, 2000, 2010, 2020), per preservare la dimensione "epoca" della chemistry (sez. 3.4).
- **Club per epoca**: sottoinsieme curato di club iconici/vincenti (indicativamente 4-8 per epoca per lega), non l'intera lega.
- Scope deliberatamente incrementale: si parte più piccoli di FM ma reali e puliti, si amplia nel tempo aggiungendo club/epoche/leghe.

**Gerarchia dati — Campionato → Club (per epoca) → Giocatore**: un `Campionato` (`leagues`, es. "Serie A") è un'entità catalogo era-agnostica. Un `Club` è invece **un'istanza per epoca**: la stessa squadra reale in epoche diverse è **duplicata come righe distinte** (es. "Milan 1990s" e "Milan 2010s" sono due righe `clubs` separate, entrambe collegate allo stesso campionato). Un `Giocatore` referenzia un `club_id` specifico, quindi eredita automaticamente campionato ed epoca dal club — **non ha più campi `era`/`campionato` liberi**. Lo stesso giocatore reale in epoche diverse è, allo stesso modo, **duplicato come righe `player_pool` distinte** (stesso nome, `club_id` ed eventualmente statistiche/Overall diversi) — coerente col fatto che un giocatore, a seconda dell'anno, può essere stato in club diversi. Il pannello admin (sez. 9.1) offre un'azione "Duplica" su campionati/club/giocatori proprio per velocizzare la creazione di questi cloni per-epoca senza reinserire tutti i campi da zero.

### 2.2 Algoritmo Overall (60-99, originale — non copiato da FM)

L'Overall di FM è un giudizio proprietario/editoriale di Sports Interactive (non un fatto): il nostro va **derivato da zero** con una formula nostra applicata a statistiche fattuali pubbliche (sez. 2.1), coerente con la scelta di avere solo un Overall singolo per giocatore (sez. 3.3). **La stessa regola vale per gli Overall di EA Sports FC** (e siti che li rispecchiano, es. FutBin/SoFIFA): sono anch'essi un giudizio proprietario di un terzo, mai fonte — nemmeno come "punto di partenza da poi modificare", perché la contraffazione avviene già nella copia iniziale.

⚠️ **Il percentile richiede un pool ampio per essere significativo**: con pochi giocatori nello stesso reparto, il migliore del gruppetto schizza automaticamente a 99 e il peggiore crolla a 60, indipendentemente dal livello reale (osservato concretamente popolando il primo club: un giocatore buono ma non fenomenale risultava 99 solo per essere "il migliore dei 9 difensori" disponibili). Non è un bug: è l'effetto atteso finché il pool è piccolo, e si attenua man mano che si aggiungono più club/leghe. Per questo l'Overall va **ricalcolato in blocco** (sez. 2.3) dopo ogni gruppo di inserimenti, non lasciato "congelato" al valore calcolato al momento dell'inserimento.

- **Input fattuali per giocatore** (con fallback se mancanti): presenze, gol, assist (dove pertinente), trofei vinti (count), presenze in nazionale, longevità della carriera al top livello.
- **Pesi per reparto** (indicativi, tarabili in implementazione):
  - **ATT**: gol (peso alto), assist, presenze/longevità, trofei, caps.
  - **CC**: assist/creatività, presenze/longevità, trofei, caps.
  - **DIF**: presenze/longevità, record difensivo di squadra nel periodo, trofei, caps, piccolo bonus gol/assist.
  - **POR**: presenze/longevità, trofei, caps, record di squadra (clean sheet dove disponibile).
- **Normalizzazione**: punteggio grezzo pesato → **percentile all'interno del pool raccolto** (non scala assoluta arbitraria, perché le statistiche grezze cambiano molto tra epoche/leghe) → mappato linearmente su **60-99**.
- **Fallback editoriale dichiarato**: per giocatori con dati incompleti (comune per epoche più vecchie), stima basata su trofei/caps/reputazione storica accertata — dichiarata come stima nostra, non spacciata per fatto oggettivo.
- Implementato come funzione pura in `packages/game-engine` (stesso pattern di `rating.ts`/`chemistry.ts`), ricalcolabile in automatico se si aggiornano le fonti dati — mai un calcolo one-off fuori dal codice.

### 2.3 Valore di mercato + metodologia e stato del popolamento dati

**Formula valore di mercato** (`packages/game-engine/src/marketValue.ts`, `computeMarketValue`): curva **non lineare** sull'Overall (da 300k a 60 di Overall fino a 200M a 99, crescita esponenziale — i migliori valgono molto più che proporzionalmente) moltiplicata per: prestigio campionato (1-5, campo `leagues.prestige_tier`), prestigio club (1-5, campo `clubs.prestige_tier`), prestigio della **nazionalità del giocatore** (1-5, piccolo bonus ±10-30%, lookup `nationPrestigeTier` nel codice — nazioni calcisticamente blasonate = tier più alto), e un moltiplicatore di **densità dell'epoca** (quanti club sono già presenti nel database per la stessa `era` del giocatore — più club nella stessa epoca = più potenziale di chemistry tra loro = giocatore più "utile" in-game, non un'inflazione storica reale). Arrotondato a multipli di 50.000€. I tier di prestigio sono **stime editoriali dichiarate** (storia, palmarès, valore rosa), stesso principio del fallback per l'Overall.

**Fonte dati per il popolamento**: mai FM/EA FC (sez. 2.1/2.2), mai API a pagamento (sez. 2.1). Per ogni club: rosa reale dalla pagina Wikipedia della stagione specifica del club (es. "2025–26 Inter Milan season") — **non** dalla pagina "squad" generica di siti come ESPN, che di default mostra la rosa **corrente** (es. mercato estivo successivo), non quella storica della stagione richiesta. Statistiche (presenze/gol/assist): **verificate** via ricerca mirata per i giocatori più rilevanti/rintracciabili, **stimate** (dichiarate, per tier di ruolo: titolare/rotazione/riserva) per gli altri — a questa scala non è possibile verificare individualmente ogni giocatore.

**Convenzioni adottate**:
- `era` = **stagione specifica** (es. `"2025/26"`), non decade generica, quando si popolano dati di una singola stagione reale — più preciso e già coerente con "club come istanza per epoca" (sez. 2.1).
- `trophies` per un giocatore = **trofei vinti dalla squadra in quella stagione specifica** (es. Inter 2025/26 = 2, Scudetto + Coppa Italia), non il totale carriera del giocatore — altrimenti richiederebbe ricerca individuale per ogni giocatore, non sostenibile su larga scala.

**Ricalcolo massivo obbligatorio dopo ogni batch**: `packages/data-scripts` (`pnpm recompute` dalla cartella del pacchetto) — si connette al database via `SUPABASE_DB_URL` (da `.env` alla root, connessione diretta Postgres che bypassa le RLS), ricalcola l'Overall di **tutti** i giocatori per reparto (rispettando `overall_override` dove impostato) usando `computeOverallRatings`, poi ricalcola il valore di mercato di **tutti** i giocatori con `computeMarketValue`. Va eseguito dopo ogni inserimento massivo di nuovi club, non solo la prima volta.

**Stato del popolamento (aggiornato ad ogni sessione)**: **Serie A 2025/26 completa — 20 di 20 club, 580 giocatori** (`packages/data-scripts/seeds/serie-a-2025-26/`, 3 batch). Mancano le altre 4 leghe Big 5 (Premier League, Liga, Bundesliga, Ligue 1) per lo scope completo richiesto dall'utente ("tutte le squadre dei 5 campionati, rose della prima squadra al completo").

**Nota metodologica aggiuntiva**: per i club senza pagina Wikipedia "stagione specifica" dedicata (comune per squadre neopromosse o meno seguite), usata [footballsquads.co.uk](https://www.footballsquads.co.uk) come fonte alternativa — riporta solo rosa/ruolo/nazionalità/data di nascita (fatti), non statistiche o valutazioni proprietarie, quindi compatibile con la stessa strategia dati (sez. 2.1). Attenzione quando le tabelle sorgente riportano colonne "Apps/Goals" **senza specificare la stagione**: spesso sono totali-carriera-al-club, non della stagione richiesta (es. "241 presenze, 66 gol" per un giocatore in una tabella "2025-26" — numero impossibile per una singola stagione) — vanno scartate e sostituite con stime dichiarate, non prese per buone.

---

## 3. Meccaniche core

### 3.1 Moduli (formazioni)
Libreria di **tutti i moduli più famosi del calcio a 11**, selezionabile prima del draft: 4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1, 3-5-2, 3-4-3, 4-4-1-1, 5-3-2, 4-2-4, 3-4-2-1, 4-3-1-2, ecc. Ogni modulo = schema di slot tipizzati per ruolo, riusabile in single-player, PvP e tornei.

### 3.2 Draft: 11 titolari + 4 riserve (15 pick totali)
- 11 slot del modulo scelto + **4 riserve, una per reparto** (1 POR, 1 DIF, 1 CC, 1 ATT).
- Formato fedele all'originale: ogni round propone un pacchetto (club + epoca + lista giocatori compatibili con gli slot liberi); il giocatore assegna il pick a UNO slot compatibile (titolare o riserva) — non un ordine fisso.
- Timer per round per il ritmo frenetico (anche in single-player).

### 3.3 Rating: solo Overall + rating di reparto
- Ogni giocatore ha **un solo valore Overall** (niente sotto-attributi tipo pace/dribbling — semplificazione voluta). Calcolato con l'algoritmo originale in sez. 2.2 (mai copiato da database di terzi).
- **Rating di reparto** (Portiere, Difesa, Centrocampo, Attacco) = aggregazione degli Overall dei titolari di quel reparto. Le riserve non contribuiscono al rating titolare.
- Rating squadra complessivo = rating di reparto + bonus chemistry (3.4).

### 3.4 Chemistry — grafo a linee colorate
- Layout campo con giocatori come nodi; linee **solo tra giocatori dello stesso reparto** (niente linee tra reparti diversi, niente per il portiere da solo).
- Colore linea in base a quante caratteristiche tra **campionato, anno (decennio), nazione** condividono i due giocatori:
  - **0 in comune → rosso**
  - **1 in comune (una qualsiasi tra campionato/anno/nazione) → arancione**
  - **2 o più in comune → verde**
- Bonus chemistry squadra = funzione del numero di linee verdi/arancioni/rosse, sommato al rating squadra.
- Elemento visivo chiave della UI durante il draft (feedback immediato).

### 3.5 Modalità Classica Rapida Offline
- Setup: scelta **modulo**, scelta **difficoltà** (facile/normale/difficile), scelta pool **campionato singolo/nazione unica** oppure **misto**.
- Nessun account richiesto (guest play, CTA "Gioca senza account" nella `LoginScreen`); se loggato, il risultato conta ai fini dello storico.
- Obiettivo di riferimento: il record perfetto **38-0-0**.
- **Storico semplificato**: mostra solo il **contatore di quanti 38-0-0 perfetti** l'utente ha ottenuto — non il dettaglio di ogni partita.

### 3.6 Sfide variabili (non solo "vinci il campionato")
Pool di obiettivi per modalità classica e sfide giornaliere/mensili:
- **Campionato perfetto** (38-0-0 classico).
- **Salvezza**: rosa scarsa/sbilanciata data, obiettivo evitare la retrocessione.
- **Mercato di gennaio**: rosa imperfetta data, numero limitato di "swap" (mini-draft di aggiustamento) prima del risultato finale.
- Estendibile in futuro (coppa a eliminazione simulata, vincoli tipo "solo giocatori dello stesso decennio", ecc.).

---

## 4. PvP 1v1 — draft e match (cuore della sfida frenetica)

### 4.1 Draft 1v1: budget di mercato in tre momenti di spesa
Il "chi conferma per primo vince" (click race) è stato **scartato**: premia solo latenza di rete/riflesso puro, non tattica. Design adottato: **un unico budget di mercato per ogni "mister"**, speso in tre momenti successivi sulla stessa risorsa.

- Ogni mister riceve un **budget di mercato iniziale**, scalato dal proprio livello (sez. 5). Rosa da **15 scelte** (11 titolari + 4 riserve).

**1. Pre-draft — acquisto carte tattiche (nascosto)**: prima di scegliere i giocatori, si può spendere budget per comprare carte tattiche usabili durante il draft — malus verso l'avversario (es. *Pressing mediatico*: riduce il timer del prossimo pick avversario; *Voce di mercato*: nasconde temporaneamente l'Overall di un pacchetto all'avversario; *Infortunio lampo*: costringe l'avversario a scartare e ripescare l'ultimo pick) o bonus per sé. **Costo crescente ad ogni acquisto** nello stesso draft (scoraggia lo spam). **Acquisti privati**: l'avversario non vede cosa/quanto hai comprato, solo l'effetto quando lo giochi.

**2. Draft giocatori — 15 pick col budget residuo**: ogni giocatore ha, oltre all'Overall, un **valore di mercato** (correlato ma non identico all'Overall — spazio per scelte value-for-money). **Pick contesi** (stesso giocatore per slot compatibile in entrambi): risolti con **asta a offerta segreta** entro il timer del round — offerta nascosta fino al budget residuo; chi offre di più paga esattamente la propria offerta; chi perde non spende nulla. I malus con effetto economico colpiscono direttamente il budget residuo avversario.

**3. Post-draft — acquisto bonus match**: a rosa completata, il budget rimasto si spende per comprare i **bonus tattici della fase match** (4.2) — acquisto anch'esso privato/nascosto.

- Trade-off centrale: ogni credito su un giocatore forte è un credito in meno per sabotare l'avversario o per i bonus match — un'unica risorsa su tre fronti.
- Timer stretto in tutte e tre le fasi.

### 4.2 Match 1v1: simulazione 2D con azioni salienti (max 90 secondi)
- Simulazione 2D rapida del campo: fasi "normali" in fast-forward (contesto visivo, nessun input), **rallenta solo nelle azioni salienti**.
- **6 azioni salienti totali, 3 per squadra**, distribuite lungo la simulazione.
- Ogni azione saliente dura **~15 secondi reali** (6 × 15s = 90s totali).
- Durante la finestra, **entrambi i giocatori possono giocare un bonus tattico monouso** per cambiare la storia dell'azione (bonus offensivo se l'azione è della propria squadra in attacco, difensivo/di reazione se dell'avversario). Una volta giocato, il bonus non è più disponibile.
- **Esito di ogni azione saliente** = mix di: rating di reparto pertinente + bonus chemistry + scelta tattica/bonus giocato + piccola componente di fortuna (RNG limitato).
- Somma degli esiti delle 6 azioni → risultato finale (V/N/P).
- Risoluzione **sempre server-side** (Edge Function); il client invia solo l'intento (quale bonus giocare) — mai il risultato.
- I bonus match sono quelli comprati nel post-draft (4.1, punto 3), acquisto privato.

---

## 5. Sistema di Livelli e Progressione (stile Clash Royale)

Determina sia il budget di mercato in PvP (4.1) sia la Classifica Globale (7.1). Nomi a tema calcistico, originali (nessun richiamo a competizioni/marchi reali — coerente con sez. 2).

### 5.1 Livelli (provvisori, da rifinire in UI)
1. Pulcini
2. Giovanissimi
3. Dilettanti
4. Semiprofessionisti
5. Professionisti
6. Nazionale
7. Internazionale
8. Leggenda

### 5.2 Budget di mercato scalato per livello
- Il budget iniziale del draft PvP (4.1) **cresce ad ogni livello**. In una sfida tra livelli diversi, ciascuno gioca col **proprio** budget (nessuna normalizzazione) — vantaggio economico reale al livello più alto, come i livelli carte in Clash Royale.

### 5.3 Punti Livello asimmetrici (promozione/retrocessione)
- Punteggio ("Punti Livello") che determina il livello attuale — soglia superata → **promozione**.
- Asimmetria esplicita:
  - Vinci contro **livello superiore** → guadagni **molti più** Punti Livello del normale.
  - Perdi contro **livello inferiore** → perdi **molti più** Punti Livello del normale (rischio **retrocessione**).
  - Comportamento simmetrico inverso (vincere contro inferiore vale meno, perdere contro superiore costa meno) trattato come estensione naturale — **da confermare in implementazione** (vedi sez. 11, Assunzioni aperte).
- Alimenta la Classifica Globale (7.1) e il livello mostrato sul profilo.

---

## 6. Mini torneo (max 4 giocatori)

- Limite **4 partecipanti** per restare leggero.
- **Draft potenziato diviso in 4**: stesso principio di budget di mercato e asta segreta del draft 1v1 (4.1), tra 4 mister. Le carte malus si comprano allo stesso modo, ma **si sceglie esplicitamente contro quale dei 3 avversari usarla** al momento dell'acquisto.
- Dopo il draft: mini-bracket **2 semifinali + finale** (fase match come in 4.2).
- Torneo privato via codice/link invito, bracket live via Realtime.

---

## 7. Classifiche e sfide giornaliere/mensili

### 7.1 Classifiche: solo Globale e Mensile
Niente classifica giornaliera separata.
- **Classifica Globale**: all-time, basata sui Punti Livello (sez. 5) — 1v1 e tornei — + punti totali dalle sfide.
- **Classifica Mensile**: reset ogni mese, basata sui punti accumulati nel mese (sfide giornaliere + bonus completamento, 7.3). Hall of Fame con "Campione del mese".

### 7.2 Sfide giornaliere — persistenti e recuperabili
- Ogni giorno si sblocca **una nuova sfida** (obiettivo a rotazione dal pool 3.6), stesso seed per tutti.
- **Non scompaiono a mezzanotte**: restano disponibili tutto il mese, recuperabili.
- **Decadimento punti per recupero tardivo**: 100% il giorno stesso, moltiplicatore decrescente per ogni giorno di ritardo (es. -10%/giorno, da bilanciare in implementazione).

### 7.3 Sfida mensile = completare tutte le giornaliere
- Non è un obiettivo a parte: consiste nel **completare tutte le sfide giornaliere del mese** (anche in recupero).
- Completarle tutte entro fine mese → **bonus punti extra** + badge speciale.
- Streak/badge secondari per chi gioca il giorno stesso più giorni consecutivi.

---

## 8. Linee guida UI/UX (vincolo di design permanente)

Richiesta esplicita dell'utente: design moderno, **non riconoscibile come "AI-generated"**, tema chiaro/scuro selezionabile, testi leggibili, pulsanti chiari e curati.

- **Niente emoji in UI**: libreria di icone moderna e coerente (es. Lucide o Phosphor Icons) per ruoli, azioni, badge, navigazione.
- **Estetica distintiva**: palette e tipografia proprie (non il default "Inter + gradiente viola/blu" da progetti AI-generated), ispirata al mondo calcio ma con identità originale — coerente con sez. 2 (nessun richiamo a brand ufficiali).
- **Tema chiaro/scuro**: selezionabile dall'utente (non solo `prefers-color-scheme`), variabili CSS/Tailwind dark mode, persistito in localStorage. Il selettore tema è disponibile **anche nella `LoginScreen`** (non solo dopo il login), coerente col fatto che l'app è utilizzabile anche senza account (modalità ospite).
- **Leggibilità**: contrasti AA, gerarchia tipografica chiara tra titoli/dati/numeri (Overall, rating, risultati) e testo secondario.
- **Bottoni e componenti**: gerarchia visiva chiara (primario/secondario/ghost/distruttivo), stati hover/pressed/disabled curati, touch target ≥44px.

### 8.1 Palette (derivata dal logo)
Campionata dai colori dominanti del logo (`logo.png`, scudo verde/rame) via script, non scelta a mano — vedi Decision Log per il dettaglio del campionamento.
- **Verde muschio** (`--color-pitch-*`, base `#455d59`): colore brand primario, bottoni/CTA principali, testo di enfasi.
- **Rame/bronzo** (`--color-copper-*`, base `#805e56`): colore accent, badge/etichette secondarie, evidenziazioni.
- **Superfici**: chiaro = bianco/verde chiarissimo; scuro = verde quasi nero (`#0e1614`), non un nero neutro — coerente col tono del logo.
- Font: **Manrope** (sans-serif moderno, non il default "Inter" da progetti AI-generated).
- Implementata in `apps/web/src/index.css` (Tailwind v4 `@theme` + variabili CSS per tema chiaro/scuro).

---

## 9. Stack tecnico e architettura

- **Frontend**: React 18 + Vite + TypeScript, Tailwind CSS mobile-first, Zustand per stato, Framer Motion per animazioni leggere (grafo chemistry, simulazione 2D match), PWA installabile.
- **Backend/infra**: **Supabase** — Postgres, Auth (**solo provider Google**, niente email/password nell'MVP), Realtime (broadcast/presence per draft condivisi e match PvP), Storage per asset generati, RLS su tutte le tabelle sensibili.
- **Edge Functions** (Deno) per logica che non deve fidarsi del client: risoluzione draft condiviso (aste, carte tattiche), risoluzione azioni salienti e risultato match PvP, calcolo Punti Livello/classifiche, generazione sfide giornaliere/mensili, risoluzione bracket torneo.
- **Onboarding account**: login Google → schermata rapida con **nickname** (testo libero) + **nazione** (autocomplete su elenco chiuso di nazioni reali, `apps/web/src/data/countries.ts` — non testo libero, valore validato lato client contro l'elenco prima dell'insert) → profilo creato.
- **Hosting**: Vercel (frontend), CI/CD da repo git.
- **Monorepo**: pnpm workspaces
  - `apps/web` — unica app React (prodotto per i giocatori, mobile-first + pannello admin lazy-loaded su `/admin`, vedi sez. 9.1)
  - `packages/game-engine` — draft, rating, chemistry, moduli, sistema livelli, algoritmo Overall, algoritmo valore di mercato (logica pura, testabile)
  - `packages/shared-types` — tipi TS condivisi
  - `packages/data-scripts` — script Node one-off per il popolamento dati: ricalcolo massivo Overall/valore di mercato (`pnpm recompute`, sez. 2.3), esecuzione di file SQL contro il DB via connessione diretta Postgres
  - `supabase/` — migrazioni SQL + edge functions

### 9.1 Pannello admin (`apps/web/src/admin`) — implementato, unificato con l'app principale

Strumento interno per mantenere aggiornato il pool giocatori/club e creare le sfide giornaliere, senza scrivere SQL a mano. **Non è un'app separata**: vive dentro `apps/web` come modulo caricato a runtime solo per chi naviga su `/admin`, con un **unico login** condiviso con il prodotto (niente doppia schermata di accesso, niente duplicazione di tema/store/client Supabase — vedi Decision Log per il perché del cambio rispetto alla versione iniziale con `apps/admin` come app a parte).

- **Code-splitting**: `AdminApp` è importato con `React.lazy()`/`import()` dinamico in `App.tsx` — Vite lo compila in un chunk JS separato, scaricato dal browser solo quando si visita `/admin`. Gli utenti normali non scaricano mai questo codice: il bundle mobile resta piccolo (vincolo permanente sez. 1).
- **Routing minimale**: nessuna libreria di routing (troppo poco per giustificarla) — `App.tsx` controlla `window.location.pathname.startsWith("/admin")` dopo aver risolto sessione/profilo. Se il profilo non è admin, `/admin` mostra `AccessDenied`. Se è admin, dalla `HomeScreen` compare un'icona scudo che porta a `/admin` (navigazione piena, non SPA-routing).
- **Responsive**: nonostante l'uso principale resti da desktop, il pannello è ora pienamente utilizzabile da mobile — sidebar a scomparsa (`hidden md:flex`), barra di navigazione inferiore fissa su mobile, form/liste/tabelle a singola colonna sotto `sm`/`md`, tabella giocatori sostituita da una lista a card sotto `md`. Include anche il selettore tema chiaro/scuro (prima assente), sia nel login sia nel pannello.

- **Autenticazione**: identica al prodotto — stessa `LoginScreen`, nessun login dedicato. Dopo l'accesso, se il profilo è admin e il path è `/admin`, si carica `AdminApp`.
- **Autorizzazione**: colonna `profiles.is_admin` (impostata a mano da noi via dashboard Supabase, non self-service) + funzione SQL `is_admin()` usata in policy RLS dedicate (sez. 10) che permettono scrittura su `leagues`, `player_pool`, `clubs`, `formations`, `tactical_cards`, `levels`, `daily_challenges` solo agli admin. Tabelle di punteggio/esito match restano riservate alle Edge Function, invariato — l'admin non le tocca.
- **Funzionalità v1** (4 sezioni di navigazione):
  1. **Campionati**: CRUD `leagues` (nome, nazione, crest). Entità era-agnostica — i club vengono creati "dentro" un campionato.
  2. **Club**: CRUD `clubs`, ciascuno legato a un campionato (`league_id`) e a un'**epoca** (`era`) — un club è un'istanza per epoca (sez. 2.1).
  3. **Giocatori**: elenco/ricerca `player_pool`, creazione/modifica con i campi statistici (gol, presenze, assist, trofei, caps) usati dall'algoritmo Overall (sez. 2.2) — l'Overall si **calcola in automatico** con la stessa funzione di `packages/game-engine`, con **override manuale** per i casi con dati incompleti. Campionato ed epoca **non sono più campi liberi**: si derivano dal club selezionato.
  4. **Sfide giornaliere**: form per creare la sfida di una data (data, tipo sfida dal pool variabile — sez. 3.6 — e selezione dei club/pacchetti del seed, ogni club essendo già un'istanza club+epoca).
- **Duplica**: campionati, club e giocatori hanno un'azione "Duplica" che apre il form pre-compilato con gli stessi valori ma come **nuovo record** — pensata apposta per creare velocemente varianti per epoca (stesso club/giocatore, epoca e statistiche/Overall diverse, eventualmente club diverso per il giocatore).
- **Non incluso in v1**: gestione utenti/ban, editing moduli (fissi via seed), analytics.

---

## 10. Modello dati (bozza — da raffinare in fase di migrazione)

`profiles` (nickname, nazione, avatar generico, livello_attuale, punti_livello, punti_globali, punti_mensili, **is_admin**), `levels` (nome a tema calcistico, soglia punti, budget_mercato_base), `formations` (moduli con schema slot per ruolo), **`leagues`** (nome, nazione, crest originale — era-agnostica), `clubs` (nome, crest originale, **`league_id`, `era`** — un club è un'istanza per epoca, duplicabile), `player_pool` (nome reale, overall singolo **calcolato dall'algoritmo sez. 2.2 + eventuale override manuale**, **statistiche fattuali: presenze, gol, assist, trofei, caps**, valore di mercato, club_id — campionato ed epoca **derivati dal club, non più colonne dirette**, nazionalità del giocatore), `draft_sessions` (single|pvp|tournament, budget_iniziale derivato dal livello), `draft_participants` (mister, budget_residuo), `draft_picks` (prezzo pagato), `squads` (formation_id, obiettivo/challenge_type), `squad_players` (slot titolare/riserva), `challenge_types` (campionato|salvezza|mercato_gennaio|...), `matches` (type: pve|pvp|tournament|daily_challenge), `match_actions` (le 6 azioni salienti per match, log per replay/anti-cheat), `tactical_cards` (catalogo: fase draft|match, tipo malus|bonus, effetto, costo base crescente), `tactical_card_purchases` (acquisti per mister, privati/non visibili all'avversario finché non giocati, target_mister per i malus), `tournaments` (max 4 partecipanti), `tournament_matches`, `daily_challenges` (persistenti, recuperabili con decadimento punti), `monthly_challenge_progress` (completamento cumulativo giornaliere del mese), `leaderboard_snapshots` (globale + mensile).

**RLS**: utenti leggono/scrivono solo i propri dati diretti (squad in corso, draft picks propri); esiti match/classifiche/punti livello scritti solo da Edge Function con service role. Tabelle catalogo (`leagues`, `player_pool`, `clubs`, `formations`, `tactical_cards`, `levels`, `daily_challenges`) in sola lettura per tutti tranne gli admin (`profiles.is_admin = true`, verificato con funzione SQL `is_admin()` — sez. 9.1), che possono scrivere direttamente dal pannello admin (`apps/web/src/admin`).

---

## 11. Requisiti non funzionali

- Performance mobile: bundle piccolo, 60fps target, animazioni GPU-friendly.
- Resilienza rete: riconnessione automatica ai canali Realtime durante draft/match PvP.
- Anti-cheat: risoluzione server-side per ogni esito (draft conteso, azioni salienti, risultato finale); rate-limiting Edge Functions.
- GDPR: consenso minimo, cancellazione account, privacy policy.
- Login Google gestito da Supabase Auth, nessuna gestione password custom.

---

## 12. Roadmap / ordine tecnico di costruzione

Costruzione **parallela/feature-complete** (non fasi sequenziali con gate di validazione), ma con un ordine di dipendenze tecniche reali:

1. Monorepo, schema Postgres base, Auth Google, `game-engine` package (moduli, draft, overall/rating reparto, chemistry a grafo, sistema livelli).
2. UI mobile core loop: Modalità Classica Rapida Offline completa (moduli, difficoltà, pool singolo/misto, sfide variabili, 38-0-0) + storico account (contatore 38-0-0) + livello/progressione base.
3. Draft/match condiviso in tempo reale (budget di mercato, aste segrete, carte tattiche draft/match, simulazione 2D con azioni salienti, Edge Functions di risoluzione) → sblocca PvP 1v1, con budget scalato per livello e Punti Livello asimmetrici.
4. Mini torneo a 4 (riusa draft condiviso + match engine, aggiunge bracket e scelta bersaglio malus).
5. Classifica Globale/Mensile, sfide giornaliere persistenti/recuperabili, sfida mensile (completamento), Hall of Fame.

**Stato attuale (2026-07-26)**: punto 1 della roadmap in corso, infrastruttura dati/admin costruita prima del gioco vero e proprio (scelta esplicita dell'utente). Fatto: monorepo pnpm, `apps/web` (Vite+React 19+TS+Tailwind v4+Zustand+Framer Motion, tema chiaro/scuro selezionabile anche in login, modalità ospite, `CountryAutocomplete`), `packages/shared-types` (`Profile`, `PlayerStats`), `packages/game-engine` (moduli, rating, chemistry, livelli, **algoritmo Overall sez. 2.2** — 21 test vitest verdi), progetto Supabase cloud (project ref `krgmwufeshbdlqyivimy`) con **migrazioni + RLS + seed applicati** (8 livelli, 11 moduli, 8 carte tattiche, colonne statistiche/`overall_override` su `player_pool`, `profiles.is_admin` + `is_admin()` + policy admin sulle tabelle catalogo). Auth Google verificata end-to-end (login reale completato dall'utente). Rebrand "Fantasy Manager" completo con logo/palette dal logo.

**Pannello admin implementato e unificato in `apps/web`** (`/admin`, lazy-loaded — sez. 9.1, non più un'app separata): stesso login del prodotto, `AccessDenied` per chi non è admin, 4 sezioni — **Campionati** (`leagues`, entità era-agnostica), **Club** (legati a un campionato + un'**epoca**, un club è un'istanza per epoca), **Giocatori** (lista/ricerca — vista a tabella da tablet in su, a card sotto — form con statistiche fattuali e **Overall calcolato in tempo reale** via `computeOverallRatings`, override manuale 60-99, campionato/epoca derivati dal club selezionato), **Sfide giornaliere** (data, tipo sfida, selezione club/pacchetti). **Duplica** su campionati/club/giocatori per creare rapidamente varianti per epoca. **Interamente responsive** (sidebar desktop / barra inferiore mobile, form e liste a colonna singola sotto `sm`/`md`) e con selettore tema chiaro/scuro anche qui. Verificato: build pulita con `AdminApp` in chunk JS separato (~35KB, mai scaricato dagli utenti normali), `/` e `/admin` senza errori console senza sessione; le schermate autenticate (CRUD reale) vanno verificate dall'utente in prima persona (servono le sue credenziali Google, non replicabili in automatico).

**Header `HomeScreen` ridisegnato**: sostituita la fila di 3-4 icone separate (nickname, admin, tema, logout) con un unico componente `ProfileMenu` — avatar/nickname compatto in alto a destra che apre un dropdown con tema, link admin (se admin) e logout. Header sticky minimale (logo + wordmark a sinistra). Card "Livello attuale" e sezione moduli aggiornate con gerarchia visiva più chiara (icona trofeo, badge arrotondati) per un look più da gioco mobile. Pannello admin: aggiunto pulsante "Torna al gioco" (sidebar desktop e barra mobile) per il percorso inverso admin → giocatore, mancante prima.

**Popolamento dati in corso** (sez. 2.3): niente più pipeline Wikidata automatizzata — sostituita da ricerca web mirata per club/stagione (Wikipedia season-specific o footballsquads.co.uk come alternativa, mai pagine "squad" generiche) + `packages/data-scripts` per il ricalcolo massivo. Fatto: `leagues` (Serie A), **Serie A 2025/26 completa — 20 club, 580 giocatori**, colonne `prestige_tier` su `leagues`/`clubs`. Mancano le altre 4 leghe Big 5 (Premier League, Liga, Bundesliga, Ligue 1) per completare lo scope "tutte le squadre delle Big 5" richiesto dall'utente — lavoro sostanziale, prosegue su più sessioni.

Mancante oltre ai dati: draft/match realtime, UI del gioco vero e proprio (Modalità Classica Rapida Offline).

---

## 13. Idee future (fuori dallo scope attuale)

- **Champions League del gioco**: competizione stagionale tra i migliori mister (rimossa dallo scope attuale su richiesta esplicita dell'utente). Se ripresa in futuro, va progettata con naming originale (mai il marchio reale "Champions League") e integrata col sistema di Livelli (sez. 5) e la Classifica Globale (sez. 7.1).
- Espansione riserve (infortuni/cambi che attivano il rating delle riserve durante il match).
- Licenza dati sportivi ufficiale, se il progetto scala e il budget lo consente (vedi sez. 2).

---

## 14. Assunzioni aperte da confermare

Punti interpretati in modo ragionevole ma non confermati esplicitamente dall'utente — da validare quando si arriva a implementarli:

- **Rosa da 15 scelte** (11 titolari + 4 riserve): in un messaggio l'utente ha scritto "14 scelte" parlando del budget di mercato — possibile refuso rispetto alla correzione esplicita precedente (da 3 a 4 riserve). Trattato come 15 finché non diversamente specificato.
- **Simmetria dei Punti Livello**: vincere contro un livello inferiore vale meno punti del normale, perdere contro un livello superiore costa meno punti del normale — estensione naturale non esplicitamente dichiarata dall'utente.
- **Bonus match vs carte malus draft**: numero esatto di bonus match acquistabili, tipologie ed eventuale legame con la qualità della rosa/chemistry — da definire in fase di bilanciamento/implementazione.
- **Torneo a 4 — target del malus**: confermato che si sceglie esplicitamente l'avversario bersaglio tra i 3 disponibili al momento dell'acquisto.

---

## 15. Decision Log

> Ogni scelta architetturale, di design o di prodotto presa durante l'implementazione va registrata qui, in ordine cronologico (più recente in cima), con data, decisione e motivazione breve.

- **2026-07-27 — Serie A 2025/26 completata (20/20 club, 580 giocatori)**: completati i 14 club mancanti dopo il primo batch di 6. Per i club senza pagina Wikipedia "stagione specifica" (tipicamente neopromosse/meno seguite: Sassuolo, Torino, Parma, Genoa, Lecce, Cremonese, Hellas Verona, Pisa) usata footballsquads.co.uk come fonte alternativa per rosa/ruolo/nazionalità (fatti pubblici, coerente con sez. 2.1). Scoperta ricorrente da tenere a mente: alcune tabelle sorgente riportano colonne "Apps/Goals" che sono in realtà totali-carriera-al-club, non della stagione — vanno riconosciute e scartate (numeri come "241 presenze" in una singola stagione sono impossibili), sostituite da stime dichiarate.
- **2026-07-26 — Niente EA Sports FC/FutBin come fonte, nemmeno come "punto di partenza"**: l'utente ha proposto di usare gli Overall di EA FC (via FutBin) come base da modificare in seguito. Rifiutato: e' lo stesso identico problema di FM (sez. 2.2) — la contraffazione avviene nella copia iniziale, non e' sanata da modifiche successive, e a scala di migliaia di giocatori la somiglianza con la banca dati EA sarebbe evidente. Continuato con `computeOverallRatings` (dati fattuali) come unica fonte per l'Overall.
- **2026-07-26 — Scope "tutte le 96 squadre delle Big 5, rose complete" e implicazioni**: l'utente ha chiesto la copertura completa (5 leghe × tutti i club × rose intere ≈ 2.400 giocatori) invece di un sottoinsieme curato. Segnalato il compromesso reale: a questa scala non e' possibile verificare individualmente le statistiche di ogni giocatore nella sessione — si procede con rosa **reale** (nomi/ruoli/nazionalita' da Wikipedia, sempre verificati) ma statistiche **verificate per i giocatori piu' rilevanti e stimate (dichiarate) per gli altri**, popolando a blocchi (un'intera lega/gruppo di club alla volta, mai un club isolato) per mantenere i pool abbastanza grandi da rendere l'Overall percentile-based significativo (sez. 2.2).
- **2026-07-26 — Formula valore di mercato**: implementata in `packages/game-engine/src/marketValue.ts` — curva esponenziale sull'Overall, moltiplicatori di prestigio campionato/club (nuovi campi `prestige_tier` su `leagues`/`clubs`, stima editoriale) e nazionalita' del giocatore (bonus contenuto), e moltiplicatore di "densita' di club nella stessa epoca" — reinterpretazione dell'utente del fattore "anno": non inflazione storica del mercato reale, ma quanto quel giocatore e' database-utile/ricco di potenziale chemistry in base a quanti club della stessa era sono gia' presenti.
- **2026-07-26 — `packages/data-scripts` per il ricalcolo massivo**: creato un nuovo pacchetto nel monorepo (non parte di `apps/web`) con connessione diretta Postgres (bypassa le RLS, usa la password del DB da `.env`) per eseguire ricalcoli/inserimenti massivi. Necessario perche' l'Overall percentile-based va **ricalcolato su tutto il pool** ad ogni batch di inserimenti, non calcolato una volta sola per player al momento dell'inserimento (altrimenti i primi giocatori inseriti restano con valori congelati e via via piu' sbagliati man mano che il pool cresce).
- **2026-07-26 — Rosa da pagina Wikipedia "stagione specifica", non pagina "squad" generica**: le pagine "squad" di siti come ESPN mostrano di default la rosa **corrente** (che puo' gia' riflettere il mercato estivo successivo alla stagione richiesta), non quella storica. Per popolare la stagione 2025/26 servono le pagine Wikipedia tipo "20XX–YY [Club] season", che riportano la rosa **di quella stagione specifica**.
- **2026-07-25 — Header `HomeScreen` riprogettato in stile "menu profilo" da gioco mobile**: l'utente ha segnalato che l'header era confusionario (nickname + icona admin + tema + logout, quattro elementi separati sulla destra, poco leggibile su mobile) e ha chiesto una grafica più professionale. Sostituiti i bottoni sparsi con un unico `ProfileMenu` (avatar con iniziale + nickname, tap per aprire un dropdown con tema/admin/logout) — pattern comune nei giochi mobile per tenere l'header pulito. Aggiunto anche il percorso di ritorno mancante: un pulsante "Torna al gioco" nel pannello admin (prima si poteva andare da giocatore ad admin ma non viceversa se non digitando manualmente l'URL).
- **2026-07-25 — Pannello admin: da app separata a modulo lazy-loaded dentro `apps/web`**: l'utente ha fatto notare che due login separati (prodotto e admin) non hanno senso quando basta controllare `profiles.is_admin` dopo un unico accesso — e nel farlo aveva ragione: stavamo già duplicando `index.css`, `ThemeToggle`, `useThemeStore` e la configurazione del client Supabase tra le due app, un costo di manutenzione reale (l'ho toccato con mano dovendo ricopiare tema/store una seconda volta per sistemare il tema mancante lato admin). **Ripensata l'architettura**: `apps/admin` eliminata, il suo codice spostato in `apps/web/src/admin/`, montato come route `/admin` **caricata con `React.lazy()`** — Vite lo compila in un chunk JS a parte (verificato: ~35KB gzip 7KB), scaricato dal browser solo da chi naviga su `/admin`. Questo preserva l'obiettivo originale (niente peso extra sul bundle mobile dei giocatori, sez. 1) **senza** pagare il costo di due app/due login/due copie di codice condiviso. `App.tsx` fa un controllo minimale di path (`window.location.pathname`), niente libreria di routing (non ce n'è bisogno per una sola route protetta). Questa decisione **sostituisce** quella del 2026-07-25 più sotto ("`apps/admin` implementato... app separata") e quella del 2026-07-24 ("Aggiunto `apps/admin`... nuova app nel monorepo") — lasciate nel log come storia, non più valide.
- **2026-07-25 — Pannello admin reso responsive + selettore tema aggiunto**: su richiesta dell'utente, tutte le schermate admin (liste, form, tabelle) sono ora utilizzabili da mobile: sidebar `hidden md:flex` su desktop, barra di navigazione fissa in basso su mobile, griglie a colonna singola sotto `sm`/`md`, tabella Giocatori sostituita da una lista a card sotto `md`. Aggiunto anche il `ThemeToggle` (mancava del tutto lato admin, sia nel login sia nel pannello) — riusa lo stesso store del prodotto, non più una copia separata dopo la fusione sopra.
- **2026-07-25 — Campionati come entità catalogo + club/giocatori come istanze per epoca**: l'utente ha chiesto un tab "Campionati" (i club vengono creati al suo interno) e la possibilità di duplicare campionati/club/giocatori per assegnarli a epoche diverse, con Overall diversi e — per i giocatori — anche club diversi a seconda dell'anno. Nuova tabella `leagues` (era-agnostica: nome, nazione, crest). `clubs` guadagna `league_id` (obbligatorio) ed `era` (obbligatorio): **un club è ora un'istanza per epoca**, non più un'entità unica riusata per tutte le epoche — la stessa squadra reale in epoche diverse è duplicata come righe `clubs` distinte. Di conseguenza `player_pool.era` e `player_pool.league` (testo libero, potenzialmente disallineato dal club referenziato) sono stati **rimossi**: campionato ed epoca di un giocatore si derivano sempre dal suo `club_id`. Migrazione applicata su tabelle vuote (nessun dato reale ancora inserito), quindi nessun backfill necessario. Aggiunta azione "Duplica" in `apps/admin` su tutte e tre le entità (apre il form pre-compilato come nuovo record) per rendere pratica la creazione di varianti per epoca.
- **2026-07-25 — Ordine di lavoro: infrastruttura (admin + dati) prima del gioco vero**: invece di costruire subito la Modalità Classica Rapida Offline (roadmap punto 2), l'utente ha scelto di costruire prima `apps/admin` e poi la pipeline dati da Wikidata, per avere l'ossatura di gestione dati pronta prima di dover popolare/testare il gioco vero e proprio.
- **2026-07-25 — Algoritmo Overall implementato**: `packages/game-engine/src/overall.ts`, `computeOverallRatings` — normalizzazione min-max per statistica sul pool passato, poi pesi di reparto (sez. 2.2), poi percentile del punteggio composito mappato linearmente su 60-99. Pool con un solo giocatore → valore centrale (nessun percentile calcolabile). 7 test dedicati.
- **2026-07-25 — Migrazione `player_pool`**: aggiunte le colonne `appearances`, `goals`, `assists`, `trophies`, `caps`, `overall_override` (mancavano nello schema iniziale, la sez. 2.2/9.1 di CLAUDE.md le presupponeva già). Range di `overall`/`overall_override` ristretto a 60-99 (era 1-99 nello schema iniziale, placeholder pre-algoritmo).
- **2026-07-25 — `apps/admin` implementato**: app separata (porta 5174 in dev) invece che una sezione dentro `apps/web`, per non appesantire il bundle mobile con codice/dipendenze admin-only e per riflettere che è uno strumento desktop-oriented (sez. 9.1). Riusa lo stesso tema (stessa `index.css`) e lo stesso progetto Supabase. Nessun router (troppo poche schermate per giustificarlo): switch di sezione con semplice stato React in `AdminLayout`. Il profilo dell'utente (unico esistente al momento) è stato promosso `is_admin = true` via query diretta, per poter accedere subito al pannello.
- **2026-07-25 — Sfide giornaliere: seed come lista di pacchetti (club, epoca)**: dato che `era` è una colonna per-giocatore (non per-club — uno stesso club può avere piu' epoche), il seed di una sfida giornaliera è un array di coppie `{clubId, era}` derivate dalle combinazioni distinte già presenti in `player_pool`, non semplicemente una lista di club.
- **2026-07-25 — Nazione via autocomplete, non testo libero**: `OnboardingScreen` usa ora `CountryAutocomplete` (nuovo componente) su un elenco statico di ~195 nazioni in italiano (`apps/web/src/data/countries.ts`), non un `<input>` libero. Validazione: il submit è bloccato se il valore non corrisponde esattamente a una voce dell'elenco (`isValidCountry`). Motivazione: dato usato nelle classifiche/filtri futuri, deve essere normalizzato per essere filtrabile/aggregabile in modo affidabile.
- **2026-07-25 — Selettore tema anche in `LoginScreen`**: prima era disponibile solo in `HomeScreen` (post-login). Spostato/duplicato in alto a destra anche nella login page, dato che l'app è utilizzabile anche senza account (modalità ospite) fin dalla primissima schermata.
- **2026-07-24 — Rebrand a "Fantasy Manager" + palette dal logo**: l'utente ha fornito un logo (`logo.png`, scudo verde muschio/rame con schema tattico) e chiesto di rinominare il prodotto e derivarne i colori tema. Verificato che esistono già app "Fantasy Manager Soccer" sugli store — segnalato come rischio di naming, non bloccante, da rivalutare in sede di revisione legale pre-lancio (sez. 0/2). Palette campionata programmaticamente dal PNG (script Node + `sharp`: media pixel non-trasparenti/non-bianchi/non-neri per metà sinistra e destra dello scudo) invece di scelta a occhio, per fedeltà al logo reale. Asset ottimizzati generati con `sharp` (trim + resize) invece di usare il PNG originale da 1.6MB direttamente in produzione.
- **2026-07-24 — Modalità ospite in `LoginScreen`/`HomeScreen`**: aggiunta CTA "Gioca senza account" che porta a `HomeScreen` con `profile = null` (stato locale `guestMode` in `App.tsx`, non persistito). Coerente con la Modalità Classica Rapida Offline già prevista in sez. 3.5 (guest play, nessun account richiesto). `HomeScreen` ora gestisce sia il profilo autenticato sia lo stato ospite (CTA "Accedi" al posto di nickname/livello/logout).
- **2026-07-24 — Connessione Supabase via Session Pooler, non connessione diretta**: la connessione diretta (`db.<ref>.supabase.co:5432`) è IPv6-only lato Supabase e non risolveva sulla rete di sviluppo (router ISP la reindirizzava a un indirizzo locale). Usata invece la stringa **Session Pooler IPv4** (`aws-0-eu-west-1.pooler.supabase.com:5432`, utente `postgres.<project-ref>`) per `supabase db push`. Password del DB e connection string salvate solo in `.env` locale (gitignored), mai committate. Se in futuro serve riconfigurare, usare questo stesso pooler.
- **2026-07-24 — Niente Football Manager, niente API sportive: dataset originale da Wikidata (CC0) + compilazione manuale**: l'utente voleva usare il database di FM26 per popolare `player_pool`. Verificato via ricerca che l'EULA di Sports Interactive vieta esplicitamente l'estrazione/riuso dei dati fuori dal gioco (violazione diretta, non zona grigia) e che le API sportive commerciali (API-Football, football-data.org) non concedono diritto di pubblicazione sui piani gratuiti. L'utente ha confermato di volere una soluzione gratuita, quindi si adotta un dataset originale compilato da noi: Wikidata (CC0/dominio pubblico) per i fatti anagrafici/di carriera, compilazione manuale verificata per le statistiche di dettaglio. Conseguenza: scope v1 curato (Big 5 leghe, poche epoche/club per lega), non esaustivo come FM.
- **2026-07-24 — Overall calcolato con algoritmo originale, non con il metodo di FM**: dato che l'Overall di FM è un giudizio editoriale proprietario di SI, il nostro va derivato da zero da statistiche fattuali pubbliche (gol, presenze, assist, trofei, caps), pesate per reparto e normalizzate a percentile su scala 60-99. Vedi sez. 2.2.
- **2026-07-24 — Aggiunto `apps/admin`**: su richiesta dell'utente, serve un pannello interno per gestire `player_pool`/`clubs` (inclusa correzione Overall) e creare le sfide giornaliere senza SQL manuale. Nuova app nel monorepo, autorizzazione via `profiles.is_admin` + RLS dedicate (sez. 9.1, sez. 10). Non ancora implementata, solo decisione architetturale.
- **2026-07-24 — Niente Docker locale, si parte da un progetto Supabase cloud**: l'ambiente di sviluppo non ha Docker Desktop installato (necessario per `supabase start`, lo stack locale). Invece di richiedere l'installazione di Docker, si procede creando direttamente un progetto Supabase cloud (piano free) e collegandolo via `supabase link` + `supabase db push`. Motivazione: l'Auth Google richiede comunque configurazione lato Google Cloud Console + dashboard Supabase (passaggi manuali via browser), quindi il progetto cloud serve in ogni caso; evitiamo un doppio setup (locale poi cloud).
- **2026-07-24 — Creazione riga `profiles` lato client dopo onboarding, non via trigger su `auth.users`**: dopo il login Google, l'app mostra la schermata nickname/nazione (sez. 9) e il client stesso inserisce la riga in `profiles` (permesso da RLS solo per `id = auth.uid()`). Motivazione: più semplice da debuggare in questa fase iniziale rispetto a un trigger Postgres; da rivalutare se in futuro serve garantire che ogni utente Auth abbia sempre un profilo anche senza completare l'onboarding.
- **2026-07-24 — Trigger anti-tampering su `profiles`**: i campi punteggio/livello (`punti_livello`, `punti_globali`, `punti_mensili`, `livello_id`, `perfect_38_count`) sono protetti da un trigger BEFORE UPDATE che blocca modifiche non provenienti da `service_role`, anche se la riga appartiene all'utente stesso. Motivazione: coerenza con l'anti-cheat richiesto in sez. 10/11 — un utente autenticato non deve poter alterare direttamente i propri punteggi via client.
- **2026-07-24 — Formula moduli**: nel `game-engine`, per ogni modulo (es. "4-3-3") il primo numero è sempre DIF, l'ultimo sempre ATT, e la somma dei numeri intermedi è CC. Semplificazione necessaria per restare coerenti con le sole 4 categorie di reparto (sez. 3.3) anche per moduli con centrocampisti/trequartisti su più linee (es. 4-2-3-1, 3-4-2-1).
- **2026-07-24 — Formula chemistry bonus**: bonus squadra = media dei pesi delle linee (verde=1, arancione=0.5, rosso=0) moltiplicata per un tetto massimo di 10 punti sommati al rating squadra. Valore placeholder di bilanciamento, non specificato dall'utente — da tarare quando si avranno partite reali da osservare.
- **2026-07-24 — Valori numerici di `LEVELS` (soglie punti, budget base)**: placeholder di bilanciamento in `packages/game-engine/src/levels.ts` e replicati in `supabase/seed.sql`. Da tarare in base ai dati di gioco reali; se uno dei due file viene aggiornato, aggiornare anche l'altro finché non esiste un'unica fonte di verità (es. generare il seed dal codice invece di duplicarlo a mano).
