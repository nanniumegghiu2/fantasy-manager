import { useId, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { CountryAutocomplete, isValidCountry } from "./CountryAutocomplete";

interface OnboardingScreenProps {
  userId: string;
  onComplete: () => void;
}

export function OnboardingScreen({ userId, onComplete }: OnboardingScreenProps) {
  const [nickname, setNickname] = useState("");
  const [nazione, setNazione] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const countryFieldId = useId();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedNickname = nickname.trim();
    if (trimmedNickname.length < 3) {
      setError("Il nickname deve avere almeno 3 caratteri.");
      return;
    }
    if (!isValidCountry(nazione)) {
      setError("Seleziona una nazione dall'elenco.");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
      nickname: trimmedNickname,
      nazione,
    });
    setSubmitting(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setError("Questo nickname è già in uso, provane un altro.");
      } else {
        setError(insertError.message);
      }
      return;
    }

    onComplete();
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[var(--surface)] px-6 text-[var(--text-primary)]">
      <div className="text-center">
        <h1 className="text-xl font-bold">Crea il tuo profilo mister</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Nickname e nazione sono visibili nelle classifiche.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nickname
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            placeholder="es. Mister_Rossi"
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2 text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
          />
        </label>

        <label htmlFor={countryFieldId} className="flex flex-col gap-1 text-sm font-medium">
          Nazione
          <CountryAutocomplete id={countryFieldId} value={nazione} onChange={setNazione} />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-[var(--brand-contrast)] transition-opacity disabled:opacity-60"
        >
          {submitting ? "Creazione..." : "Inizia a giocare"}
        </button>
      </form>
    </div>
  );
}
