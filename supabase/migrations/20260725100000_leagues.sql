-- Campionati come entita' catalogo di primo livello: i club appartengono a un campionato
-- e ora rappresentano un'istanza per epoca (un club puo' essere duplicato per epoche diverse).
-- L'epoca/campionato del giocatore si deriva quindi dal club, non e' piu' testo libero
-- sul giocatore (evita disallineamenti tra club_id e i campi era/league).
create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nation text not null,
  crest_url text,
  created_at timestamptz not null default now()
);

alter table clubs
add column league_id uuid references leagues (id),
add column era text;

alter table clubs
alter column league_id
set not null,
alter column era
set not null;

alter table player_pool
drop column era,
drop column league;

alter table leagues enable row level security;

create policy "catalogo leggibile da tutti" on leagues for select using (true);

create policy "admin scrive leagues" on leagues for all using (is_admin ())
with
  check (is_admin ());

create index on clubs (league_id);
