-- Prestigio campionato/club per l'algoritmo del valore di mercato (CLAUDE.md sez. 2.2/10).
-- Scala 1 (minimo) - 5 (massimo), stima editoriale dichiarata (storia, palmares, valore rosa),
-- stesso principio del fallback editoriale gia' usato per l'Overall.
alter table leagues
add column prestige_tier smallint not null default 3 check (prestige_tier between 1 and 5);

alter table clubs
add column prestige_tier smallint not null default 3 check (prestige_tier between 1 and 5);
