-- Il CASE della colonna generata "department" (20260727000000_player_roles.sql) e' stato
-- scritto prima di aggiungere i ruoli AD/AS (20260727010000_secondary_roles.sql): per quei
-- ruoli non c'era alcun branch, quindi department risultava NULL. Postgres non permette di
-- alterare l'espressione di una generated column: va ricreata da zero.
alter table player_pool drop column department;

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
    when 'AD' then 'ATT'
    when 'AS' then 'ATT'
    when 'ATT' then 'ATT'
    when 'SP' then 'ATT'
  end
) stored;

alter table player_pool
add constraint player_pool_department_check check (department in ('POR', 'DIF', 'CC', 'ATT'));

create index on player_pool (department);
