-- Correzione di sicurezza: `profiles.is_admin` non era protetta dal trigger anti-tampering.
--
-- La colonna e' stata aggiunta da `20260724190000_admin_support.sql`, cioe' DOPO la funzione
-- creata in `20260724180100_rls_policies.sql`, e non era mai stata inclusa nel controllo.
-- La policy "utente aggiorna il proprio profilo" permette pero' l'update sulla propria riga:
-- un qualunque utente autenticato poteva quindi eseguire
--   update profiles set is_admin = true where id = auth.uid()
-- con la sola chiave anonima, auto-promuoversi ad amministratore e ottenere scrittura su tutto
-- il catalogo (giocatori, club, campionati) via le policy `is_admin()`.
--
-- La promozione ad admin resta possibile solo dalla dashboard Supabase (service role), che e'
-- il comportamento previsto da CLAUDE.md sez. 9.1: "impostata a mano da noi, non self-service".
create
or replace function public.prevent_profile_score_tampering () returns trigger as $$
begin
  if auth.role() <> 'service_role' then
    if new.punti_livello <> old.punti_livello
      or new.punti_globali <> old.punti_globali
      or new.punti_mensili <> old.punti_mensili
      or new.livello_id <> old.livello_id
      or new.perfect_38_count <> old.perfect_38_count
      or new.is_admin <> old.is_admin then
      raise exception 'Solo le Edge Function possono modificare i punteggi del profilo';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;
