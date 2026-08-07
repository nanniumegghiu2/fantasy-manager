-- Ruoli secondari con malus (CLAUDE.md sez. 3.1/3.2, Decision Log 2026-07-27):
-- ogni giocatore ha un ruolo principale (colonna "role", invariata) e puo'
-- avere ruoli secondari che gioca "fuori posizione" con un malus
-- sull'Overall effettivo (calcolato lato app in packages/game-engine/src/draft.ts,
-- non persistito). Aggiunti anche i ruoli larghi d'attacco AD/AS (ali offensive,
-- reparto ATT), distinti dagli esterni di centrocampo ED/ES (reparto CC).

alter type player_role add value 'AD';
alter type player_role add value 'AS';

alter table player_pool
add column secondary_roles player_role[] not null default '{}';
