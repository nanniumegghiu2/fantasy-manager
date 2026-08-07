-- Ricostruisce la colonna generata "department" con la mappatura completa a 22 rami
-- (nuovo scacchiere tattico, sez. CLAUDE.md 3.1) — il vecchio CASE copriva solo i 13
-- ruoli precedenti. Va eseguita DOPO remapRolesToBoard.ts, quando nessuna riga ha più
-- un ruolo del vecchio schema non coperto dal nuovo CASE (altrimenti department
-- risulterebbe NULL per quelle righe). Postgres non permette di alterare l'espressione
-- di una generated column: va ricreata da zero, come nelle migrazioni ruoli precedenti.
alter table player_pool drop column department;

alter table player_pool add column department text generated always as (
  case role
    when 'POR' then 'POR'
    when 'TD' then 'DIF'
    when 'DCD' then 'DIF'
    when 'DC' then 'DIF'
    when 'DCS' then 'DIF'
    when 'TS' then 'DIF'
    when 'QD' then 'DIF'
    when 'QS' then 'DIF'
    when 'MD' then 'CC'
    when 'MS' then 'CC'
    when 'ED' then 'CC'
    when 'CCD' then 'CC'
    when 'CC' then 'CC'
    when 'CCS' then 'CC'
    when 'ES' then 'CC'
    when 'TQD' then 'CC'
    when 'TRD' then 'CC'
    when 'TRS' then 'CC'
    when 'TQS' then 'CC'
    when 'AD' then 'ATT'
    when 'ATT' then 'ATT'
    when 'AS' then 'ATT'
  end
) stored;

alter table player_pool
add constraint player_pool_department_check check (department in ('POR', 'DIF', 'CC', 'ATT'));

create index on player_pool (department);
