-- Seed dei dati catalogo per lo sviluppo locale (supabase db reset).
-- Livelli: valori placeholder di bilanciamento, vedi packages/game-engine/src/levels.ts
-- (stessa fonte di verita' — se cambi uno dei due file, aggiorna anche l'altro).
insert into
  levels (id, name, "order", points_threshold, base_budget)
values
  ('pulcini', 'Pulcini', 1, 0, 500),
  ('giovanissimi', 'Giovanissimi', 2, 100, 750),
  ('dilettanti', 'Dilettanti', 3, 300, 1000),
  (
    'semiprofessionisti',
    'Semiprofessionisti',
    4,
    600,
    1500
  ),
  ('professionisti', 'Professionisti', 5, 1000, 2000),
  ('nazionale', 'Nazionale', 6, 1600, 3000),
  (
    'internazionale',
    'Internazionale',
    7,
    2500,
    4500
  ),
  ('leggenda', 'Leggenda', 8, 4000, 6000);

-- Moduli: schema slot generato con la stessa formula di packages/game-engine/src/formations.ts
-- (DIF = primo numero, ATT = ultimo numero, CC = somma dei numeri intermedi).
insert into
  formations (id, name, slots)
values
  (
    '4-4-2',
    '4-4-2',
    '[{"id":"por-1","label":"Portiere","department":"POR","order":0},{"id":"dif-1","label":"Difensore 1","department":"DIF","order":1},{"id":"dif-2","label":"Difensore 2","department":"DIF","order":2},{"id":"dif-3","label":"Difensore 3","department":"DIF","order":3},{"id":"dif-4","label":"Difensore 4","department":"DIF","order":4},{"id":"cc-1","label":"Centrocampista 1","department":"CC","order":5},{"id":"cc-2","label":"Centrocampista 2","department":"CC","order":6},{"id":"cc-3","label":"Centrocampista 3","department":"CC","order":7},{"id":"cc-4","label":"Centrocampista 4","department":"CC","order":8},{"id":"att-1","label":"Attaccante 1","department":"ATT","order":9},{"id":"att-2","label":"Attaccante 2","department":"ATT","order":10}]'::jsonb
  ),
  (
    '4-3-3',
    '4-3-3',
    '[{"id":"por-1","label":"Portiere","department":"POR","order":0},{"id":"dif-1","label":"Difensore 1","department":"DIF","order":1},{"id":"dif-2","label":"Difensore 2","department":"DIF","order":2},{"id":"dif-3","label":"Difensore 3","department":"DIF","order":3},{"id":"dif-4","label":"Difensore 4","department":"DIF","order":4},{"id":"cc-1","label":"Centrocampista 1","department":"CC","order":5},{"id":"cc-2","label":"Centrocampista 2","department":"CC","order":6},{"id":"cc-3","label":"Centrocampista 3","department":"CC","order":7},{"id":"att-1","label":"Attaccante 1","department":"ATT","order":8},{"id":"att-2","label":"Attaccante 2","department":"ATT","order":9},{"id":"att-3","label":"Attaccante 3","department":"ATT","order":10}]'::jsonb
  ),
  (
    '4-2-3-1',
    '4-2-3-1',
    '[{"id":"por-1","label":"Portiere","department":"POR","order":0},{"id":"dif-1","label":"Difensore 1","department":"DIF","order":1},{"id":"dif-2","label":"Difensore 2","department":"DIF","order":2},{"id":"dif-3","label":"Difensore 3","department":"DIF","order":3},{"id":"dif-4","label":"Difensore 4","department":"DIF","order":4},{"id":"cc-1","label":"Centrocampista 1","department":"CC","order":5},{"id":"cc-2","label":"Centrocampista 2","department":"CC","order":6},{"id":"cc-3","label":"Centrocampista 3","department":"CC","order":7},{"id":"cc-4","label":"Centrocampista 4","department":"CC","order":8},{"id":"cc-5","label":"Centrocampista 5","department":"CC","order":9},{"id":"att-1","label":"Attaccante 1","department":"ATT","order":10}]'::jsonb
  ),
  (
    '4-1-4-1',
    '4-1-4-1',
    '[{"id":"por-1","label":"Portiere","department":"POR","order":0},{"id":"dif-1","label":"Difensore 1","department":"DIF","order":1},{"id":"dif-2","label":"Difensore 2","department":"DIF","order":2},{"id":"dif-3","label":"Difensore 3","department":"DIF","order":3},{"id":"dif-4","label":"Difensore 4","department":"DIF","order":4},{"id":"cc-1","label":"Centrocampista 1","department":"CC","order":5},{"id":"cc-2","label":"Centrocampista 2","department":"CC","order":6},{"id":"cc-3","label":"Centrocampista 3","department":"CC","order":7},{"id":"cc-4","label":"Centrocampista 4","department":"CC","order":8},{"id":"cc-5","label":"Centrocampista 5","department":"CC","order":9},{"id":"att-1","label":"Attaccante 1","department":"ATT","order":10}]'::jsonb
  ),
  (
    '3-5-2',
    '3-5-2',
    '[{"id":"por-1","label":"Portiere","department":"POR","order":0},{"id":"dif-1","label":"Difensore 1","department":"DIF","order":1},{"id":"dif-2","label":"Difensore 2","department":"DIF","order":2},{"id":"dif-3","label":"Difensore 3","department":"DIF","order":3},{"id":"cc-1","label":"Centrocampista 1","department":"CC","order":4},{"id":"cc-2","label":"Centrocampista 2","department":"CC","order":5},{"id":"cc-3","label":"Centrocampista 3","department":"CC","order":6},{"id":"cc-4","label":"Centrocampista 4","department":"CC","order":7},{"id":"cc-5","label":"Centrocampista 5","department":"CC","order":8},{"id":"att-1","label":"Attaccante 1","department":"ATT","order":9},{"id":"att-2","label":"Attaccante 2","department":"ATT","order":10}]'::jsonb
  ),
  (
    '3-4-3',
    '3-4-3',
    '[{"id":"por-1","label":"Portiere","department":"POR","order":0},{"id":"dif-1","label":"Difensore 1","department":"DIF","order":1},{"id":"dif-2","label":"Difensore 2","department":"DIF","order":2},{"id":"dif-3","label":"Difensore 3","department":"DIF","order":3},{"id":"cc-1","label":"Centrocampista 1","department":"CC","order":4},{"id":"cc-2","label":"Centrocampista 2","department":"CC","order":5},{"id":"cc-3","label":"Centrocampista 3","department":"CC","order":6},{"id":"cc-4","label":"Centrocampista 4","department":"CC","order":7},{"id":"att-1","label":"Attaccante 1","department":"ATT","order":8},{"id":"att-2","label":"Attaccante 2","department":"ATT","order":9},{"id":"att-3","label":"Attaccante 3","department":"ATT","order":10}]'::jsonb
  ),
  (
    '4-4-1-1',
    '4-4-1-1',
    '[{"id":"por-1","label":"Portiere","department":"POR","order":0},{"id":"dif-1","label":"Difensore 1","department":"DIF","order":1},{"id":"dif-2","label":"Difensore 2","department":"DIF","order":2},{"id":"dif-3","label":"Difensore 3","department":"DIF","order":3},{"id":"dif-4","label":"Difensore 4","department":"DIF","order":4},{"id":"cc-1","label":"Centrocampista 1","department":"CC","order":5},{"id":"cc-2","label":"Centrocampista 2","department":"CC","order":6},{"id":"cc-3","label":"Centrocampista 3","department":"CC","order":7},{"id":"cc-4","label":"Centrocampista 4","department":"CC","order":8},{"id":"cc-5","label":"Centrocampista 5","department":"CC","order":9},{"id":"att-1","label":"Attaccante 1","department":"ATT","order":10}]'::jsonb
  ),
  (
    '5-3-2',
    '5-3-2',
    '[{"id":"por-1","label":"Portiere","department":"POR","order":0},{"id":"dif-1","label":"Difensore 1","department":"DIF","order":1},{"id":"dif-2","label":"Difensore 2","department":"DIF","order":2},{"id":"dif-3","label":"Difensore 3","department":"DIF","order":3},{"id":"dif-4","label":"Difensore 4","department":"DIF","order":4},{"id":"dif-5","label":"Difensore 5","department":"DIF","order":5},{"id":"cc-1","label":"Centrocampista 1","department":"CC","order":6},{"id":"cc-2","label":"Centrocampista 2","department":"CC","order":7},{"id":"cc-3","label":"Centrocampista 3","department":"CC","order":8},{"id":"att-1","label":"Attaccante 1","department":"ATT","order":9},{"id":"att-2","label":"Attaccante 2","department":"ATT","order":10}]'::jsonb
  ),
  (
    '4-2-4',
    '4-2-4',
    '[{"id":"por-1","label":"Portiere","department":"POR","order":0},{"id":"dif-1","label":"Difensore 1","department":"DIF","order":1},{"id":"dif-2","label":"Difensore 2","department":"DIF","order":2},{"id":"dif-3","label":"Difensore 3","department":"DIF","order":3},{"id":"dif-4","label":"Difensore 4","department":"DIF","order":4},{"id":"cc-1","label":"Centrocampista 1","department":"CC","order":5},{"id":"cc-2","label":"Centrocampista 2","department":"CC","order":6},{"id":"att-1","label":"Attaccante 1","department":"ATT","order":7},{"id":"att-2","label":"Attaccante 2","department":"ATT","order":8},{"id":"att-3","label":"Attaccante 3","department":"ATT","order":9},{"id":"att-4","label":"Attaccante 4","department":"ATT","order":10}]'::jsonb
  ),
  (
    '3-4-2-1',
    '3-4-2-1',
    '[{"id":"por-1","label":"Portiere","department":"POR","order":0},{"id":"dif-1","label":"Difensore 1","department":"DIF","order":1},{"id":"dif-2","label":"Difensore 2","department":"DIF","order":2},{"id":"dif-3","label":"Difensore 3","department":"DIF","order":3},{"id":"cc-1","label":"Centrocampista 1","department":"CC","order":4},{"id":"cc-2","label":"Centrocampista 2","department":"CC","order":5},{"id":"cc-3","label":"Centrocampista 3","department":"CC","order":6},{"id":"cc-4","label":"Centrocampista 4","department":"CC","order":7},{"id":"cc-5","label":"Centrocampista 5","department":"CC","order":8},{"id":"cc-6","label":"Centrocampista 6","department":"CC","order":9},{"id":"att-1","label":"Attaccante 1","department":"ATT","order":10}]'::jsonb
  ),
  (
    '4-3-1-2',
    '4-3-1-2',
    '[{"id":"por-1","label":"Portiere","department":"POR","order":0},{"id":"dif-1","label":"Difensore 1","department":"DIF","order":1},{"id":"dif-2","label":"Difensore 2","department":"DIF","order":2},{"id":"dif-3","label":"Difensore 3","department":"DIF","order":3},{"id":"dif-4","label":"Difensore 4","department":"DIF","order":4},{"id":"cc-1","label":"Centrocampista 1","department":"CC","order":5},{"id":"cc-2","label":"Centrocampista 2","department":"CC","order":6},{"id":"cc-3","label":"Centrocampista 3","department":"CC","order":7},{"id":"cc-4","label":"Centrocampista 4","department":"CC","order":8},{"id":"att-1","label":"Attaccante 1","department":"ATT","order":9},{"id":"att-2","label":"Attaccante 2","department":"ATT","order":10}]'::jsonb
  );

-- Carte tattiche: esempi da CLAUDE.md sez. 4.1/4.2 — costo base, cresce ad ogni acquisto
-- nello stesso draft (logica applicata dalla Edge Function di risoluzione, non qui).
insert into
  tactical_cards (id, name, phase, kind, description, base_cost)
values
  (
    'pressing_mediatico',
    'Pressing mediatico',
    'draft',
    'malus',
    'Riduce il timer del prossimo pick dell''avversario.',
    80
  ),
  (
    'voce_di_mercato',
    'Voce di mercato',
    'draft',
    'malus',
    'Nasconde temporaneamente l''Overall di un pacchetto all''avversario.',
    80
  ),
  (
    'infortunio_lampo',
    'Infortunio lampo',
    'draft',
    'malus',
    'Costringe l''avversario a scartare e ripescare l''ultimo pick fatto.',
    120
  ),
  (
    'scout_esperto',
    'Scout esperto',
    'draft',
    'bonus',
    'Rivela in anticipo il pacchetto del prossimo round.',
    80
  ),
  (
    'pressing_alto',
    'Pressing alto',
    'match',
    'bonus',
    'Boost temporaneo al reparto difensivo durante un''azione saliente difensiva.',
    100
  ),
  (
    'contropiede_lampo',
    'Contropiede lampo',
    'match',
    'bonus',
    'Boost temporaneo al reparto offensivo durante un''azione saliente offensiva.',
    100
  ),
  (
    'cambio_modulo',
    'Cambio modulo',
    'match',
    'bonus',
    'Contrasta lo stile tattico dell''avversario in un''azione saliente.',
    120
  ),
  (
    'gestione_del_vantaggio',
    'Gestione del vantaggio',
    'match',
    'bonus',
    'Riduce le occasioni residue dell''avversario nel finale, se in vantaggio.',
    140
  );
