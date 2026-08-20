-- **Punti di ripristino della DS mode.**
--
-- ⚠️ Richiesta esplicita dell'utente: poter tornare a un punto precedente della carriera, con al
-- massimo **due** salvataggi per stagione. Fino a qui esisteva una riga sola per carriera
-- (`ds_careers`), sovrascritta di continuo dall'autosave: si poteva riprendere da dove si era
-- rimasti, mai tornare indietro.
--
-- `ds_careers` resta la **testa** della carriera — lo stato corrente, quello che l'autosave
-- aggiorna — e questa tabella e la sua storia. Tenerle separate significa che caricare un punto
-- non e un caso particolare: si riscrive la testa e si riparte.
create table ds_career_saves (
  id uuid primary key default gen_random_uuid (),
  career_id uuid not null references ds_careers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version smallint not null,
  season smallint not null,
  week smallint not null,
  -- Come e nato: a mano (il tasto Salva) o dalla rete di sicurezza (chiusura scheda, perdita di
  -- connessione, fine stagione). Serve a chi legge l'elenco, non al motore.
  kind text not null default 'manuale' check (kind in ('manuale', 'automatico')),
  -- Etichetta leggibile ("2027/28 · giornata 19"): si compone al momento del salvataggio, cosi
  -- l'elenco non deve ricalcolarla e resta corretta anche se un domani cambia il formato.
  label text not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);

-- L'elenco dei punti di una carriera, dal piu recente: e l'unica query che si fa su questa
-- tabella, e il trigger qui sotto la usa a ogni inserimento.
create index on ds_career_saves (career_id, season, created_at desc);

alter table ds_career_saves enable row level security;

-- Stesse policy di `ds_careers`, per la stessa ragione dichiarata li: la DS mode e single-player
-- e **non alimenta punti livello ne classifiche**, quindi un salvataggio falsificabile non da
-- alcun vantaggio competitivo. Il trigger anti-tampering su `profiles` resta invalicato.
create policy "utente legge i propri punti di ripristino" on ds_career_saves for
select
  using (auth.uid () = user_id);

create policy "utente crea i propri punti di ripristino" on ds_career_saves for insert
with
  check (auth.uid () = user_id);

create policy "utente cancella i propri punti di ripristino" on ds_career_saves for delete using (auth.uid () = user_id);

-- **La regola dei due per stagione vive qui, non nel client.**
--
-- Nel client basterebbe una scheda chiusa a meta per lasciare il vincolo violato, e due schede
-- aperte insieme lo violerebbero comunque. Un trigger e l'unico posto in cui "al massimo due"
-- e una proprieta della tabella invece di una speranza.
create function public.prune_ds_career_saves () returns trigger as $$
begin
  delete from ds_career_saves
  where career_id = new.career_id
    and season = new.season
    and id not in (
      select id
      from ds_career_saves
      where career_id = new.career_id
        and season = new.season
      order by created_at desc
      limit 2
    );
  return null;
end;
$$ language plpgsql security definer;

create trigger trg_prune_ds_career_saves
after insert on ds_career_saves for each row
execute function public.prune_ds_career_saves ();
