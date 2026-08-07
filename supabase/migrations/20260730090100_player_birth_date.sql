-- Data di nascita: dato fattuale (CLAUDE.md sez. 2.1), importato dall'anagrafica del foglio
-- con `pnpm import-birthdates`.
--
-- Serve al ciclo di vita della DS mode: la crescita fino al picco 24-28, il declino e il ritiro
-- a 34 anni si calcolano dall'eta', che senza questa colonna non esiste nel database.
-- Nullable perche' non tutti i giocatori del pool sono agganciabili al foglio (soprannomi,
-- primavera assenti dai dataset di prime squadre) e perche' i regen generati in carriera
-- vivono solo nel salvataggio JSONB, non qui.
alter table player_pool
add column birth_date date;
