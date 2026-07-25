-- Statistiche fattuali per l'algoritmo Overall (CLAUDE.md sez. 2.2) + override editoriale admin.
alter table player_pool
add column appearances integer not null default 0,
add column goals integer not null default 0,
add column assists integer not null default 0,
add column trophies integer not null default 0,
add column caps integer not null default 0,
add column overall_override smallint,
add constraint player_pool_overall_override_range check (
  overall_override is null
  or overall_override between 60 and 99
);

alter table player_pool
drop constraint player_pool_overall_check,
add constraint player_pool_overall_check check (overall between 60 and 99);
