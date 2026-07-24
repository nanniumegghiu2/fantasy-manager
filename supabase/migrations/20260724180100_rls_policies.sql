-- RLS — vedi CLAUDE.md sez. 10/11: gli utenti leggono/scrivono solo i propri dati diretti;
-- esiti match/classifiche/punti livello sono scritti solo dalle Edge Function (service role,
-- che bypassa RLS). Le tabelle catalogo sono in sola lettura per i client.

alter table levels enable row level security;
alter table formations enable row level security;
alter table tactical_cards enable row level security;
alter table clubs enable row level security;
alter table player_pool enable row level security;
alter table profiles enable row level security;
alter table draft_sessions enable row level security;
alter table draft_participants enable row level security;
alter table draft_picks enable row level security;
alter table tactical_card_purchases enable row level security;
alter table squads enable row level security;
alter table squad_players enable row level security;
alter table matches enable row level security;
alter table match_actions enable row level security;
alter table tournaments enable row level security;
alter table tournament_participants enable row level security;
alter table tournament_matches enable row level security;
alter table daily_challenges enable row level security;
alter table challenge_results enable row level security;
alter table monthly_challenge_progress enable row level security;
alter table leaderboard_snapshots enable row level security;

-- Tabelle catalogo: lettura pubblica, nessuna scrittura da client
create policy "catalogo leggibile da tutti" on levels for select using (true);
create policy "catalogo leggibile da tutti" on formations for select using (true);
create policy "catalogo leggibile da tutti" on tactical_cards for select using (true);
create policy "catalogo leggibile da tutti" on clubs for select using (true);
create policy "catalogo leggibile da tutti" on player_pool for select using (true);

-- Profili: lettura pubblica (nickname/livello/punti visibili in classifica), scrittura solo
-- sulla propria riga; i campi punteggio sono protetti dal trigger sotto.
create policy "profili leggibili da tutti" on profiles for select using (true);
create policy "utente crea il proprio profilo" on profiles for insert with check (auth.uid () = id);
create policy "utente aggiorna il proprio profilo" on profiles for update using (auth.uid () = id);

create function public.prevent_profile_score_tampering () returns trigger as $$
begin
  if auth.role() <> 'service_role' then
    if new.punti_livello <> old.punti_livello
      or new.punti_globali <> old.punti_globali
      or new.punti_mensili <> old.punti_mensili
      or new.livello_id <> old.livello_id
      or new.perfect_38_count <> old.perfect_38_count then
      raise exception 'Solo le Edge Function possono modificare i punteggi del profilo';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_prevent_profile_score_tampering before
update on profiles for each row
execute function public.prevent_profile_score_tampering ();

-- Draft, match, squadre: lettura riservata ai partecipanti diretti. Nessuna scrittura da
-- client: aste, esiti e punteggi sono risolti esclusivamente dalle Edge Function.
create policy "partecipante legge le proprie draft session" on draft_sessions for select using (
  exists (
    select 1
    from draft_participants dp
    where
      dp.draft_session_id = draft_sessions.id
      and dp.profile_id = auth.uid ()
  )
);

create policy "partecipante legge i partecipanti della propria sessione" on draft_participants for select using (
  exists (
    select 1
    from draft_participants dp
    where
      dp.draft_session_id = draft_participants.draft_session_id
      and dp.profile_id = auth.uid ()
  )
);

create policy "partecipante legge i pick della propria sessione" on draft_picks for select using (
  exists (
    select 1
    from draft_participants dp
    where
      dp.draft_session_id = draft_picks.draft_session_id
      and dp.profile_id = auth.uid ()
  )
);

create policy "partecipante legge i propri acquisti carte" on tactical_card_purchases for select using (
  buyer_profile_id = auth.uid ()
  or target_profile_id = auth.uid ()
);

create policy "utente legge le proprie squadre" on squads for select using (profile_id = auth.uid ());

create policy "utente legge i giocatori delle proprie squadre" on squad_players for select using (
  exists (
    select 1
    from squads s
    where
      s.id = squad_players.squad_id
      and s.profile_id = auth.uid ()
  )
);

create policy "partecipante legge i propri match" on matches for select using (
  exists (
    select 1
    from draft_participants dp
    where
      dp.draft_session_id = matches.draft_session_id
      and dp.profile_id = auth.uid ()
  )
);

create policy "partecipante legge le azioni dei propri match" on match_actions for select using (
  exists (
    select 1
    from matches m
      join draft_participants dp on dp.draft_session_id = m.draft_session_id
    where
      m.id = match_actions.match_id
      and dp.profile_id = auth.uid ()
  )
);

-- Tornei: visibili/joinabili da chi ha il codice invito; la creazione e l'iscrizione sono
-- azioni dirette dell'utente (non punteggi), quindi permesse dal client.
create policy "tornei leggibili da tutti" on tournaments for select using (true);
create policy "utente crea un torneo" on tournaments for insert with check (created_by = auth.uid ());

create policy "partecipanti torneo leggibili da tutti" on tournament_participants for select using (true);
create policy "utente si iscrive a un torneo" on tournament_participants for insert with check (profile_id = auth.uid ());

create policy "match torneo leggibili da tutti" on tournament_matches for select using (true);

-- Sfide e classifiche: lettura pubblica, scrittura solo da Edge Function.
create policy "sfide giornaliere leggibili da tutti" on daily_challenges for select using (true);

create policy "utente legge i propri risultati sfida" on challenge_results for select using (profile_id = auth.uid ());

create policy "utente legge il proprio progresso mensile" on monthly_challenge_progress for select using (profile_id = auth.uid ());

create policy "classifiche leggibili da tutti" on leaderboard_snapshots for select using (true);
