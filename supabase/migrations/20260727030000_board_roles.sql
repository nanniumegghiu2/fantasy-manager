-- Nuovo scacchiere tattico a 22 caselle (CLAUDE.md sez. 3.1, Decision Log 2026-07-27):
-- aggiunti i 12 ruoli mancanti per completare le 6 linee del tabellone. I dati esistenti
-- vengono remappati dal ruolo largo precedente al nuovo ruolo puntuale con uno script
-- separato (packages/data-scripts/src/remapRolesToBoard.ts), non in questa migrazione:
-- una nuova label enum non è utilizzabile nella stessa transazione in cui viene aggiunta.
alter type player_role add value 'DCD';
alter type player_role add value 'DCS';
alter type player_role add value 'QD';
alter type player_role add value 'MD';
alter type player_role add value 'MS';
alter type player_role add value 'QS';
alter type player_role add value 'CCD';
alter type player_role add value 'CCS';
alter type player_role add value 'TQD';
alter type player_role add value 'TRD';
alter type player_role add value 'TRS';
alter type player_role add value 'TQS';
