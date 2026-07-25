import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { GoogleIcon } from "./GoogleIcon";
import { ThemeToggle } from "./ThemeToggle";

interface LoginScreenProps {
  onGuestPlay: () => void;
}

export function LoginScreen({ onGuestPlay }: LoginScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-10 bg-[var(--surface)] px-6 py-12 text-[var(--text-primary)]">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center gap-4 text-center">
        <img
          src="/logo-512.png"
          alt="Fantasy Manager"
          className="h-24 w-24 drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
        />
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
            Draft Game Calcistico
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Fantasy Manager</h1>
        </div>
        <p className="max-w-xs text-sm text-[var(--text-secondary)]">
          Costruisci la rosa perfetta, scala i livelli e sfida altri mister in tempo reale.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-4">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex items-center justify-center gap-3 rounded-full bg-[var(--brand)] px-6 py-3.5 text-sm font-semibold text-[var(--brand-contrast)] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <GoogleIcon />
          {loading ? "Accesso in corso..." : "Accedi con Google"}
        </button>

        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          <span className="h-px flex-1 bg-[var(--surface-border)]" />
          oppure
          <span className="h-px flex-1 bg-[var(--surface-border)]" />
        </div>

        <button
          type="button"
          onClick={onGuestPlay}
          className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] px-6 py-3.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--brand)]"
        >
          Gioca senza account
        </button>
        <p className="-mt-2 text-center text-xs text-[var(--text-secondary)]">
          Modalità rapida offline, solo per passatempo: nessun progresso salvato.
        </p>

        {error && <p className="text-center text-sm text-red-500">{error}</p>}
      </div>

      <p className="max-w-sm text-center text-[11px] text-[var(--text-secondary)]">
        Fantasy Manager è un gioco indipendente non affiliato, sponsorizzato o approvato da
        leghe, club o calciatori citati. I dati utilizzati hanno natura storica e statistica.
      </p>
    </div>
  );
}
