-- Ruoli centrali unificati (CLAUDE.md sez. 3.1, Decision Log 2026-07-27): tutte le
-- caselle centrali di una stessa linea condividono ora un unico ruolo — DCD/DC/DCS -> DC,
-- MD/MS -> MED, CCD/CC/CCS -> CC, TRD/TRS -> TRQ, AD/ATT/AS -> ATT. Restano distinti
-- destra/sinistra solo i ruoli laterali (terzini, quinti, esterni, trequartisti larghi),
-- dove la fascia e' una caratteristica reale del giocatore.
--
-- Le label enum 'MED'/'TRQ' esistono gia' dalla migrazione iniziale (20260727000000), quindi
-- niente "alter type add value": update e ricostruzione della colonna generata possono
-- stare nello stesso file. Le label ormai orfane (DCD, DCS, MD, MS, CCD, CCS, TRD, TRS,
-- AD, AS, SP) restano definite a livello Postgres — niente DROP VALUE in Postgres — ma
-- nessuna riga le usa piu' e il codice TS non le referenzia.

-- 1. Ruolo principale.
update player_pool set role = case role
  when 'DCD' then 'DC'
  when 'DCS' then 'DC'
  when 'MD' then 'MED'
  when 'MS' then 'MED'
  when 'CCD' then 'CC'
  when 'CCS' then 'CC'
  when 'TRD' then 'TRQ'
  when 'TRS' then 'TRQ'
  when 'AD' then 'ATT'
  when 'AS' then 'ATT'
  when 'SP' then 'ATT'
  else role
end
where role in ('DCD', 'DCS', 'MD', 'MS', 'CCD', 'CCS', 'TRD', 'TRS', 'AD', 'AS', 'SP');

-- 2. Ruoli secondari: stessa mappatura, poi deduplica (due ruoli che collassano sullo
-- stesso valore) ed esclusione del ruolo principale (un ruolo non e' secondario di se stesso).
update player_pool p set secondary_roles = coalesce((
  select array_agg(distinct mapped order by mapped)
  from unnest(p.secondary_roles) as original,
  lateral (select (case original::text
    when 'DCD' then 'DC'
    when 'DCS' then 'DC'
    when 'MD' then 'MED'
    when 'MS' then 'MED'
    when 'CCD' then 'CC'
    when 'CCS' then 'CC'
    when 'TRD' then 'TRQ'
    when 'TRS' then 'TRQ'
    when 'AD' then 'ATT'
    when 'AS' then 'ATT'
    when 'SP' then 'ATT'
    else original::text
  end)::player_role) as m(mapped)
  where mapped <> p.role
), '{}'::player_role[])
where cardinality(p.secondary_roles) > 0;

-- 3. Colonna generata "department" ricostruita sui soli 14 ruoli rimasti: le vecchie label
-- non compaiono piu' nel CASE, quindi una riga non remappata darebbe department NULL —
-- impossibile dopo il punto 1. Postgres non permette di alterare l'espressione di una
-- generated column: va ricreata da zero, come nelle migrazioni ruoli precedenti.
alter table player_pool drop column department;

alter table player_pool add column department text generated always as (
  case role
    when 'POR' then 'POR'
    when 'TD' then 'DIF'
    when 'DC' then 'DIF'
    when 'TS' then 'DIF'
    when 'QD' then 'DIF'
    when 'QS' then 'DIF'
    when 'MED' then 'CC'
    when 'ED' then 'CC'
    when 'CC' then 'CC'
    when 'ES' then 'CC'
    when 'TQD' then 'CC'
    when 'TRQ' then 'CC'
    when 'TQS' then 'CC'
    when 'ATT' then 'ATT'
  end
) stored;

alter table player_pool
add constraint player_pool_department_check check (department in ('POR', 'DIF', 'CC', 'ATT'));

create index on player_pool (department);
