import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function AdminLoginScreen() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
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
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[var(--surface)] px-6 text-center text-[var(--text-primary)]">
      <img src="/logo-512.png" alt="Fantasy Manager" className="h-16 w-16" />
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          Fantasy Manager
        </p>
        <h1 className="mt-1 text-2xl font-bold">Pannello Admin</h1>
      </div>
      <button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-[var(--brand-contrast)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Accesso in corso..." : "Accedi con Google"}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
