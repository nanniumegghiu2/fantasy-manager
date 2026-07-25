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

### 2.2 Algoritmo Overall (60-99, originale — non copiato da FM)

L'Overall di FM è un giudizio proprietario/editoriale di Sports Interactive (non un fatto): il nostro va **derivato da zero** con una formula nostra applicata a statistiche fattuali pubbliche (sez. 2.1), coerente con la scelta di avere solo un Overall singolo per giocatore (sez. 3.3).

- **Input fattuali per giocatore** (con fallback se mancanti): presenze, gol, assist (dove pertinente), trofei vinti (count), presenze in nazionale, longevità della carriera al top livello.
- **Pesi per reparto** (indicativi, tarabili in implementazione):
  - **ATT**: gol (peso alto), assist, presenze/longevità, trofei, caps.
  - **CC**: assist/creatività, presenze/longevità, trofei, caps.
  - **DIF**: presenze/longevità, record difensivo di squadra nel periodo, trofei, caps, piccolo bonus gol/assist.
  - **POR**: presenze/longevità, trofei, caps, record di squadra (clean sheet dove disponibile).
- **Normalizzazione**: punteggio grezzo pesato → **percentile all'interno del pool raccolto** (non scala assoluta arbitraria, perché le statistiche grezze cambiano molto tra epoche/leghe) → mappato linearmente su **60-99**.
- **Fallback editoriale dichiarato**: per giocatori con dati incompleti (comune per epoche più vecchie), stima basata su trofei/caps/reputazione storica accertata — dichiarata come stima nostra, non spacciata per fatto oggettivo.
- Implementato come funzione pura in `packages/game-engine` (stesso pattern di `rating.ts`/`chemistry.ts`), ricalcolabile in automatico se si aggiornano le fonti dati — mai un calcolo one-off fuori dal codice.

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
  - `apps/web` — React app (prodotto per i giocatori, mobile-first)
  - `apps/admin` — React app interna (desktop-oriented, non mobile-first) per gestione `player_pool`/`clubs` e creazione sfide giornaliere — vedi sez. 9.1
  - `packages/game-engine` — draft, rating, chemistry, moduli, sistema livelli, algoritmo Overall (logica pura, testabile, condivisa tra `apps/web` e `apps/admin`)
  - `packages/shared-types` — tipi TS condivisi client/edge functions
  - `supabase/` — migrazioni SQL + edge functions

### 9.1 Pannello admin (`apps/admin`)

Strumento interno per mantenere aggiornato il pool giocatori/club e creare le sfide giornaliere, senza scrivere SQL a mano.

- **Autenticazione**: stesso Supabase Auth/login Google del prodotto principale.
- **Autorizzazione**: colonna `profiles.is_admin` (impostata a mano da noi via dashboard Supabase, non self-service) + funzione SQL `is_admin()` usata in policy RLS dedicate (sez. 10) che permettono scrittura su `player_pool`, `clubs`, `formations`, `tactical_cards`, `levels`, `daily_challenges` solo agli admin. Tabelle di punteggio/esito match restano riservate alle Edge Function, invariato — l'admin non le tocca.
- **Funzionalità v1**:
  1. **Giocatori**: elenco/ricerca `player_pool`, creazione/modifica con i campi statistici (gol, presenze, assist, trofei, caps) usati dall'algoritmo Overall (sez. 2.2) — l'Overall si **calcola in automatico** con la stessa funzione di `packages/game-engine`, con **override manuale** per i casi con dati incompleti.
  2. **Club**: creazione/modifica (nome, lega, crest — grafica originale, mai stemmi ufficiali).
  3. **Sfide giornaliere**: form per creare la sfida di una data (data, tipo sfida dal pool variabile — sez. 3.6 — e selezione dei pacchetti club+epoca del seed).
- **Non incluso in v1**: gestione utenti/ban, editing moduli (fissi via seed), analytics.

---

## 10. Modello dati (bozza — da raffinare in fase di migrazione)

`profiles` (nickname, nazione, avatar generico, livello_attuale, punti_livello, punti_globali, punti_mensili, **is_admin**), `levels` (nome a tema calcistico, soglia punti, budget_mercato_base), `formations` (moduli con schema slot per ruolo), `clubs` (crest originale, non ufficiale), `player_pool` (nome reale, overall singolo **calcolato dall'algoritmo sez. 2.2 + eventuale override manuale**, **statistiche fattuali: presenze, gol, assist, trofei, caps**, valore di mercato, club_id, era/decennio, nazione, campionato), `draft_sessions` (single|pvp|tournament, budget_iniziale derivato dal livello), `draft_participants` (mister, budget_residuo), `draft_picks` (prezzo pagato), `squads` (formation_id, obiettivo/challenge_type), `squad_players` (slot titolare/riserva), `challenge_types` (campionato|salvezza|mercato_gennaio|...), `matches` (type: pve|pvp|tournament|daily_challenge), `match_actions` (le 6 azioni salienti per match, log per replay/anti-cheat), `tactical_cards` (catalogo: fase draft|match, tipo malus|bonus, effetto, costo base crescente), `tactical_card_purchases` (acquisti per mister, privati/non visibili all'avversario finché non giocati, target_mister per i malus), `tournaments` (max 4 partecipanti), `tournament_matches`, `daily_challenges` (persistenti, recuperabili con decadimento punti), `monthly_challenge_progress` (completamento cumulativo giornaliere del mese), `leaderboard_snapshots` (globale + mensile).

**RLS**: utenti leggono/scrivono solo i propri dati diretti (squad in corso, draft picks propri); esiti match/classifiche/punti livello scritti solo da Edge Function con service role. Tabelle catalogo (`player_pool`, `clubs`, `formations`, `tactical_cards`, `levels`, `daily_challenges`) in sola lettura per tutti tranne gli admin (`profiles.is_admin = true`, verificato con funzione SQL `is_admin()` — sez. 9.1), che possono scrivere direttamente da `apps/admin`.

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

**Stato attuale (2026-07-24)**: punto 1 della roadmap in corso. Fatto: monorepo pnpm, `apps/web` (Vite+React 19+TS+Tailwind v4+Zustand+Framer Motion, tema chiaro/scuro selezionabile e persistito), `packages/shared-types` (include ora il tipo `Profile`), `packages/game-engine` (moduli, rating, chemistry, livelli — 14 test vitest verdi), progetto Supabase cloud creato (project ref `krgmwufeshbdlqyivimy`) e **migrazioni + RLS + seed applicati con successo** (8 livelli, 11 moduli, 8 carte tattiche verificati in tabella), colonna `profiles.is_admin` + funzione `is_admin()` + policy admin sulle tabelle catalogo. `apps/web/.env.local` collegato. **Flusso auth client completo e verificato**: `LoginScreen` (Google), `OnboardingScreen` (nickname+nazione, vincolo univocità gestito dal DB), `HomeScreen` (profilo/livello). Google OAuth configurato dall'utente (Google Cloud Console + provider Supabase) e verificato end-to-end con browser headless: il click su "Accedi con Google" reindirizza correttamente alla pagina di login Google reale con redirect URI verso il progetto Supabase, nessun errore console. Il login effettivo (credenziali reali) va completato dall'utente in prima persona. **Rebrand completato**: nome prodotto "Fantasy Manager", logo integrato (favicon/apple-touch-icon/header), palette ricampionata dal logo, `LoginScreen` ridisegnata con CTA "Gioca senza account" (modalità ospite, `HomeScreen` con `profile` nullable) e selettore tema. **Nazione in onboarding**: sostituito il testo libero con `CountryAutocomplete` (combobox su elenco chiuso di nazioni reali in italiano, validazione lato client) — verificato con test Playwright (ricerca, selezione, blocco di valori non presenti in elenco). Mancante: draft/match realtime, UI del draft/match, Edge Functions, `apps/admin`.

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
