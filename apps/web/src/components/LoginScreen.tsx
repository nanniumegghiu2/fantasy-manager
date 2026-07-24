import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { GoogleIcon } from "./GoogleIcon";

export function LoginScreen() {
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
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-[var(--surface)] px-6 text-center text-[var(--text-primary)]">
      <div>
        <p className="text-xs font-semibold tracking-wide text-[var(--brand)] uppercase">
          Draft Game Calcistico
        </p>
        <h1 className="text-2xl font-bold">38-0-0 Potenziato</h1>
        <p className="mt-2 max-w-xs text-sm text-[var(--text-secondary)]">
          Accedi per salvare il tuo storico, il tuo livello e sfidare altri mister in tempo
          reale.
        </p>
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="flex items-center gap-3 rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--brand)] disabled:opacity-60"
      >
        <GoogleIcon />
        {loading ? "Accesso in corso..." : "Accedi con Google"}
      </button>

      {error && <p className="max-w-xs text-sm text-red-500">{error}</p>}
    </div>
  );
}
