-- Schema iniziale — vedi CLAUDE.md sez. 10 (Modello dati) per la spiegazione di ogni tabella.
create extension if not exists pgcrypto;

create type department as enum ('POR', 'DIF', 'CC', 'ATT');
create type draft_session_type as enum ('single', 'pvp', 'tournament');
create type match_type as enum ('pve', 'pvp', 'tournament', 'daily_challenge');
create type challenge_type as enum ('campionato', 'salvezza', 'mercato_gennaio');
create type tactical_card_phase as enum ('draft', 'match');
create type tactical_card_kind as enum ('malus', 'bonus');
create type leaderboard_scope as enum ('global', 'monthly');

-- Catalogo: livelli (sez. 5)
create table levels (
  id text primary key,
  name text not null,
  "order" smallint not null unique,
  points_threshold integer not null,
  base_budget integer not null
);

-- Catalogo: moduli/formazioni (sez. 3.1)
create table formations (
  id text primary key,
  name text not null,
  slots jsonb not null
);

-- Catalogo: carte tattiche draft/match (sez. 4.1, 4.2)
create table tactical_cards (
  id text primary key,
  name text not null,
  phase tactical_card_phase not null,
  kind tactical_card_kind not null,
  description text not null,
  base_cost integer not null
);

-- Profili utente (Auth Google + nickname/nazione, sez. 9)
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null unique,
  nazione text not null,
  avatar_url text,
  livello_id text not null default 'pulcini' references levels (id),
  punti_livello integer not null default 0,
  punti_globali integer not null default 0,
  punti_mensili integer not null default 0,
  perfect_38_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  crest_url text
);

create table player_pool (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  overall smallint not null check (overall between 1 and 99),
  market_value integer not null check (market_value >= 0),
  club_id uuid references clubs (id),
  era text not null,
  nation text not null,
  league text not null,
  department department not null
);

create table draft_sessions (
  id uuid primary key default gen_random_uuid(),
  type draft_session_type not null,
  status text not null default 'in_progress',
  created_at timestamptz not null default now()
);

create table draft_participants (
  id uuid primary key default gen_random_uuid(),
  draft_session_id uuid not null references draft_sessions (id) on delete cascade,
  profile_id uuid not null references profiles (id),
  budget_iniziale integer not null,
  budget_residuo integer not null,
  unique (draft_session_id, profile_id)
);

create table draft_picks (
  id uuid primary key default gen_random_uuid(),
  draft_session_id uuid not null references draft_sessions (id) on delete cascade,
  participant_id uuid not null references draft_participants (id) on delete cascade,
  player_id uuid not null references player_pool (id),
  slot_id text not null,
  is_reserve boolean not null default false,
  price_paid integer not null,
  created_at timestamptz not null default now()
);

create table tactical_card_purchases (
  id uuid primary key default gen_random_uuid(),
  draft_session_id uuid not null references draft_sessions (id) on delete cascade,
  buyer_profile_id uuid not null references profiles (id),
  card_id text not null references tactical_cards (id),
  cost_paid integer not null,
  target_profile_id uuid references profiles (id),
  played_at timestamptz,
  created_at timestamptz not null default now()
);

create table squads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles (id),
  draft_session_id uuid references draft_sessions (id),
  formation_id text not null references formations (id),
  challenge_type challenge_type not null default 'campionato',
  is_offline_classic boolean not null default false,
  result_wins smallint,
  result_draws smallint,
  result_losses smallint,
  created_at timestamptz not null default now()
);

create table squad_players (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references squads (id) on delete cascade,
  slot_id text not null,
  is_reserve boolean not null default false,
  player_id uuid not null references player_pool (id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  type match_type not null,
  draft_session_id uuid references draft_sessions (id),
  status text not null default 'pending',
  result jsonb,
  created_at timestamptz not null default now()
);

create table match_actions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  action_index smallint not null check (action_index between 1 and 6),
  owner_profile_id uuid references profiles (id),
  outcome jsonb,
  created_at timestamptz not null default now()
);

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  max_participants smallint not null default 4,
  status text not null default 'open',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  profile_id uuid not null references profiles (id),
  joined_at timestamptz not null default now(),
  unique (tournament_id, profile_id)
);

create table tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  match_id uuid references matches (id),
  round smallint not null,
  created_at timestamptz not null default now()
);

create table daily_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null unique,
  challenge_type challenge_type not null,
  seed jsonb not null,
  created_at timestamptz not null default now()
);

create table challenge_results (
  id uuid primary key default gen_random_uuid(),
  daily_challenge_id uuid not null references daily_challenges (id) on delete cascade,
  profile_id uuid not null references profiles (id),
  played_on date not null,
  points_awarded integer not null,
  decay_multiplier numeric(3, 2) not null default 1.0,
  created_at timestamptz not null default now(),
  unique (daily_challenge_id, profile_id)
);

create table monthly_challenge_progress (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id),
  month date not null,
  challenges_completed smallint not null default 0,
  challenges_total smallint not null,
  bonus_awarded boolean not null default false,
  unique (profile_id, month)
);

create table leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  scope leaderboard_scope not null,
  period text not null,
  profile_id uuid not null references profiles (id),
  points integer not null,
  rank integer not null,
  snapshot_at timestamptz not null default now()
);

create index on player_pool (department);
create index on player_pool (club_id);
create index on draft_participants (draft_session_id);
create index on draft_picks (draft_session_id);
create index on squad_players (squad_id);
create index on match_actions (match_id);
create index on tournament_participants (tournament_id);
create index on challenge_results (profile_id);
create index on leaderboard_snapshots (scope, period, rank);
