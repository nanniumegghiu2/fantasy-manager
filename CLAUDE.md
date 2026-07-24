# CLAUDE.md — Bibbia del progetto "38-0-0 Potenziato"

> **Istruzione permanente**: questo file va **letto integralmente all'inizio di ogni sessione** di lavoro su questo progetto e **aggiornato ad ogni implementazione, correzione o scelta** (architetturale, di design o di prodotto). Non è documentazione statica: è la fonte di verità corrente del progetto. Se una decisione presa qui viene superata da una scelta successiva, questo file va corretto — non lasciare sezioni obsolete.
>
> Lingua: la documentazione di progetto (questo file, commit, discussioni) è in italiano, coerente con il team. Il codice (nomi variabili/funzioni, commenti se strettamente necessari) è in inglese, per convenzione standard.

---

## 0. Cos'è questo progetto

Web app React, ottimizzata al massimo per mobile, ispirata al gioco virale **38-0-0** (draft-game calcistico dove si costruisce una rosa pescando giocatori da club/decenni reali, ottenendo un record simulato su 38 partite — l'obiettivo perfetto è 38 vittorie, 0 pareggi, 0 sconfitte). Il gioco originale non ha account, non ha PvP reale, non ha classifiche persistenti ed è in una zona grigia legale (nomi reali senza licenza esplicita).

Questo progetto ne costruisce una versione potenziata: account persistenti, PvP 1v1 in tempo reale con vera componente tattica, sistema di livelli in stile Clash Royale, mini tornei tra amici, classifiche globali/mensili con sfide variabili — il tutto con attenzione esplicita agli aspetti legali.

**Nome prodotto**: provvisorio, da definire (evitare marchi registrati esistenti — vedi sez. 2).

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

---

## 3. Meccaniche core

### 3.1 Moduli (formazioni)
Libreria di **tutti i moduli più famosi del calcio a 11**, selezionabile prima del draft: 4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1, 3-5-2, 3-4-3, 4-4-1-1, 5-3-2, 4-2-4, 3-4-2-1, 4-3-1-2, ecc. Ogni modulo = schema di slot tipizzati per ruolo, riusabile in single-player, PvP e tornei.

### 3.2 Draft: 11 titolari + 4 riserve (15 pick totali)
- 11 slot del modulo scelto + **4 riserve, una per reparto** (1 POR, 1 DIF, 1 CC, 1 ATT).
- Formato fedele all'originale: ogni round propone un pacchetto (club + epoca + lista giocatori compatibili con gli slot liberi); il giocatore assegna il pick a UNO slot compatibile (titolare o riserva) — non un ordine fisso.
- Timer per round per il ritmo frenetico (anche in single-player).

### 3.3 Rating: solo Overall + rating di reparto
- Ogni giocatore ha **un solo valore Overall** (niente sotto-attributi tipo pace/dribbling — semplificazione voluta).
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
- Nessun account richiesto (guest play); se loggato, il risultato conta ai fini dello storico.
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
- **Tema chiaro/scuro**: selezionabile dall'utente (non solo `prefers-color-scheme`), variabili CSS/Tailwind dark mode, persistito nel profilo/localStorage.
- **Leggibilità**: contrasti AA, gerarchia tipografica chiara tra titoli/dati/numeri (Overall, rating, risultati) e testo secondario.
- **Bottoni e componenti**: gerarchia visiva chiara (primario/secondario/ghost/distruttivo), stati hover/pressed/disabled curati, touch target ≥44px.

---

## 9. Stack tecnico e architettura

- **Frontend**: React 18 + Vite + TypeScript, Tailwind CSS mobile-first, Zustand per stato, Framer Motion per animazioni leggere (grafo chemistry, simulazione 2D match), PWA installabile.
- **Backend/infra**: **Supabase** — Postgres, Auth (**solo provider Google**, niente email/password nell'MVP), Realtime (broadcast/presence per draft condivisi e match PvP), Storage per asset generati, RLS su tutte le tabelle sensibili.
- **Edge Functions** (Deno) per logica che non deve fidarsi del client: risoluzione draft condiviso (aste, carte tattiche), risoluzione azioni salienti e risultato match PvP, calcolo Punti Livello/classifiche, generazione sfide giornaliere/mensili, risoluzione bracket torneo.
- **Onboarding account**: login Google → schermata rapida con **nickname** + **nazione** → profilo creato.
- **Hosting**: Vercel (frontend), CI/CD da repo git.
- **Monorepo**: pnpm workspaces
  - `apps/web` — React app
  - `packages/game-engine` — draft, rating, chemistry, moduli, sistema livelli (logica pura, testabile)
  - `packages/shared-types` — tipi TS condivisi client/edge functions
  - `supabase/` — migrazioni SQL + edge functions

---

## 10. Modello dati (bozza — da raffinare in fase di migrazione)

`profiles` (nickname, nazione, avatar generico, livello_attuale, punti_livello, punti_globali, punti_mensili), `levels` (nome a tema calcistico, soglia punti, budget_mercato_base), `formations` (moduli con schema slot per ruolo), `clubs` (crest originale, non ufficiale), `player_pool` (nome reale, overall singolo, valore di mercato, club_id, era/decennio, nazione, campionato), `draft_sessions` (single|pvp|tournament, budget_iniziale derivato dal livello), `draft_participants` (mister, budget_residuo), `draft_picks` (prezzo pagato), `squads` (formation_id, obiettivo/challenge_type), `squad_players` (slot titolare/riserva), `challenge_types` (campionato|salvezza|mercato_gennaio|...), `matches` (type: pve|pvp|tournament|daily_challenge), `match_actions` (le 6 azioni salienti per match, log per replay/anti-cheat), `tactical_cards` (catalogo: fase draft|match, tipo malus|bonus, effetto, costo base crescente), `tactical_card_purchases` (acquisti per mister, privati/non visibili all'avversario finché non giocati, target_mister per i malus), `tournaments` (max 4 partecipanti), `tournament_matches`, `daily_challenges` (persistenti, recuperabili con decadimento punti), `monthly_challenge_progress` (completamento cumulativo giornaliere del mese), `leaderboard_snapshots` (globale + mensile).

**RLS**: utenti leggono/scrivono solo i propri dati diretti (squad in corso, draft picks propri); esiti match/classifiche/punti livello scritti solo da Edge Function con service role.

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

**Stato attuale (2026-07-24)**: punto 1 della roadmap in corso. Fatto: monorepo pnpm, `apps/web` (Vite+React 19+TS+Tailwind v4+Zustand+Framer Motion, tema chiaro/scuro selezionabile e persistito), `packages/shared-types`, `packages/game-engine` (moduli, rating, chemistry, livelli — 14 test vitest verdi), migrazioni SQL + RLS per Supabase scritte (non ancora applicate, serve un progetto Supabase reale). Mancante: Auth Google, draft/match realtime, UI del draft/match, Edge Functions.

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

- **2026-07-24 — Niente Docker locale, si parte da un progetto Supabase cloud**: l'ambiente di sviluppo non ha Docker Desktop installato (necessario per `supabase start`, lo stack locale). Invece di richiedere l'installazione di Docker, si procede creando direttamente un progetto Supabase cloud (piano free) e collegandolo via `supabase link` + `supabase db push`. Motivazione: l'Auth Google richiede comunque configurazione lato Google Cloud Console + dashboard Supabase (passaggi manuali via browser), quindi il progetto cloud serve in ogni caso; evitiamo un doppio setup (locale poi cloud).
- **2026-07-24 — Creazione riga `profiles` lato client dopo onboarding, non via trigger su `auth.users`**: dopo il login Google, l'app mostra la schermata nickname/nazione (sez. 9) e il client stesso inserisce la riga in `profiles` (permesso da RLS solo per `id = auth.uid()`). Motivazione: più semplice da debuggare in questa fase iniziale rispetto a un trigger Postgres; da rivalutare se in futuro serve garantire che ogni utente Auth abbia sempre un profilo anche senza completare l'onboarding.
- **2026-07-24 — Trigger anti-tampering su `profiles`**: i campi punteggio/livello (`punti_livello`, `punti_globali`, `punti_mensili`, `livello_id`, `perfect_38_count`) sono protetti da un trigger BEFORE UPDATE che blocca modifiche non provenienti da `service_role`, anche se la riga appartiene all'utente stesso. Motivazione: coerenza con l'anti-cheat richiesto in sez. 10/11 — un utente autenticato non deve poter alterare direttamente i propri punteggi via client.
- **2026-07-24 — Formula moduli**: nel `game-engine`, per ogni modulo (es. "4-3-3") il primo numero è sempre DIF, l'ultimo sempre ATT, e la somma dei numeri intermedi è CC. Semplificazione necessaria per restare coerenti con le sole 4 categorie di reparto (sez. 3.3) anche per moduli con centrocampisti/trequartisti su più linee (es. 4-2-3-1, 3-4-2-1).
- **2026-07-24 — Formula chemistry bonus**: bonus squadra = media dei pesi delle linee (verde=1, arancione=0.5, rosso=0) moltiplicata per un tetto massimo di 10 punti sommati al rating squadra. Valore placeholder di bilanciamento, non specificato dall'utente — da tarare quando si avranno partite reali da osservare.
- **2026-07-24 — Valori numerici di `LEVELS` (soglie punti, budget base)**: placeholder di bilanciamento in `packages/game-engine/src/levels.ts` e replicati in `supabase/seed.sql`. Da tarare in base ai dati di gioco reali; se uno dei due file viene aggiornato, aggiornare anche l'altro finché non esiste un'unica fonte di verità (es. generare il seed dal codice invece di duplicarlo a mano).
