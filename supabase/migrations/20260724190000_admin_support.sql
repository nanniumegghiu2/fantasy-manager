-- Supporto pannello admin — vedi CLAUDE.md sez. 9.1 / 10.
alter table profiles
add column is_admin boolean not null default false;

create
or replace function public.is_admin () returns boolean as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$ language sql stable security definer
set
  search_path = public;

create policy "admin scrive player_pool" on player_pool for all using (is_admin ())
with
  check (is_admin ());

create policy "admin scrive clubs" on clubs for all using (is_admin ())
with
  check (is_admin ());

create policy "admin scrive formations" on formations for all using (is_admin ())
with
  check (is_admin ());

create policy "admin scrive tactical_cards" on tactical_cards for all using (is_admin ())
with
  check (is_admin ());

create policy "admin scrive levels" on levels for all using (is_admin ())
with
  check (is_admin ());

create policy "admin scrive daily_challenges" on daily_challenges for all using (is_admin ())
with
  check (is_admin ());
