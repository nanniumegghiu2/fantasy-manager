-- Salvataggi della DS mode (Direttore Sportivo): una riga per carriera, lo stato del mondo in
-- un JSONB versionato.
--
-- `version` e' il numero di schema del salvataggio (`CAREER_SAVE_VERSION` nel motore): serve a
-- far migrare i salvataggi vecchi quando la forma dello stato cambia, invece di romperli.
create table ds_careers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version smallint not null,
  club_id uuid not null references clubs (id),
  season smallint not null,
  week smallint not null,
  status text not null default 'in_corso',
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- La schermata "continua carriera" elenca i salvataggi dell'utente dal piu' recente.
create index on ds_careers (user_id, updated_at desc);

alter table ds_careers enable row level security;

-- ⚠️ Eccezione deliberata rispetto al resto dello schema: qui il client scrive davvero.
--
-- Nelle altre tabelle di gioco (`matches`, `squads`, `challenge_results`...) non esiste alcuna
-- policy di scrittura, perche' gli esiti alimentano punti e classifiche e devono nascere dalle
-- Edge Function (CLAUDE.md sez. 10/11). La DS mode e' single-player e **non alimenta punti
-- livello ne' classifiche**: e' storia personale, quindi un salvataggio falsificabile non da'
-- alcun vantaggio competitivo. Far passare ogni avanzamento di settimana da una Edge Function
-- costerebbe latenza e complessita' senza proteggere nulla. Il trigger anti-tampering su
-- `profiles` resta invalicato: da qui non si scrive un solo punto.
create policy "utente legge le proprie carriere" on ds_careers for
select
  using (auth.uid () = user_id);

create policy "utente crea le proprie carriere" on ds_careers for insert
with
  check (auth.uid () = user_id);

create policy "utente aggiorna le proprie carriere" on ds_careers
for update
  using (auth.uid () = user_id)
with
  check (auth.uid () = user_id);

create policy "utente cancella le proprie carriere" on ds_careers for delete using (auth.uid () = user_id);

-- L'autosave scrive di continuo: `updated_at` deve riflettere l'ultima partita giocata senza
-- che il client debba ricordarsi di mandarlo (e senza potersi inventare la data).
create function public.touch_ds_career_updated_at () returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_ds_careers_updated_at before
update on ds_careers for each row
execute function public.touch_ds_career_updated_at ();
