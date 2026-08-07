-- Ruolo granulare per giocatore (CLAUDE.md sez. 3.1/3.2, Decision Log 2026-07-27):
-- il reparto (POR/DIF/CC/ATT) da solo non basta per il draft "per ruolo" e per
-- una lavagna tattica realistica. Il ruolo diventa l'unica fonte di verita';
-- il reparto resta per compatibilita' con chemistry/rating/overall/valore di
-- mercato, ma ora e' una colonna GENERATA dal ruolo: non puo' piu' andare
-- fuori sincrono con esso.

create type player_role as enum ('POR', 'DC', 'TD', 'TS', 'MED', 'CC', 'TRQ', 'ED', 'ES', 'ATT', 'SP');

alter table player_pool add column role player_role;

-- Backfill dei 580 giocatori gia' inseriti: stima editoriale di partenza
-- (nessun dato di ruolo granulare era mai stato raccolto finora), un ruolo
-- rappresentativo per reparto, da rifinire nel tempo via pannello admin.
update player_pool set role = case department
  when 'POR' then 'POR'
  when 'DIF' then 'DC'
  when 'CC' then 'CC'
  when 'ATT' then 'ATT'
end::player_role;

alter table player_pool alter column role set not null;

alter table player_pool drop column department;

-- Colonna testuale generata (non enum): il cast testo->enum non e' immutable
-- in Postgres (dipende dal catalogo pg_enum), quindi non e' ammesso in una
-- generated column. Il check ricrea lo stesso dominio di valori dell'enum
-- "department" originale.
alter table player_pool add column department text generated always as (
  case role
    when 'POR' then 'POR'
    when 'DC' then 'DIF'
    when 'TD' then 'DIF'
    when 'TS' then 'DIF'
    when 'MED' then 'CC'
    when 'CC' then 'CC'
    when 'TRQ' then 'CC'
    when 'ED' then 'CC'
    when 'ES' then 'CC'
    when 'ATT' then 'ATT'
    when 'SP' then 'ATT'
  end
) stored;

alter table player_pool
add constraint player_pool_department_check check (department in ('POR', 'DIF', 'CC', 'ATT'));

create index on player_pool (role);
create index on player_pool (department);
