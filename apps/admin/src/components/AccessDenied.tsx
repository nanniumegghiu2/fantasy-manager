import { supabase } from "../lib/supabaseClient";

export function AccessDenied({ nickname }: { nickname: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[var(--surface)] px-6 text-center text-[var(--text-primary)]">
      <h1 className="text-xl font-bold">Accesso non autorizzato</h1>
      <p className="max-w-sm text-sm text-[var(--text-secondary)]">
        {nickname}, il tuo account non ha i permessi di amministratore per Fantasy Manager.
      </p>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] px-5 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--brand)]"
      >
        Esci
      </button>
    </div>
  );
}
