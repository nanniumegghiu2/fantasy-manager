import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRIES } from "../data/countries";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function isValidCountry(value: string): boolean {
  return (COUNTRIES as readonly string[]).includes(value);
}

interface CountryAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

export function CountryAutocomplete({ value, onChange, id }: CountryAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const matches = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return COUNTRIES.slice(0, 8);
    return COUNTRIES.filter((country) => normalize(country).includes(normalizedQuery)).slice(
      0,
      8,
    );
  }, [query]);

  function selectCountry(country: string) {
    onChange(country);
    setQuery(country);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((i) => Math.min(i + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (matches[highlighted]) selectCountry(matches[highlighted]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function handleBlur() {
    window.setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setOpen(false);
        if (query !== value) setQuery(value);
      }
    }, 0);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlighted(0);
            setOpen(true);
            if (isValidCountry(e.target.value)) onChange(e.target.value);
            else onChange("");
          }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Inizia a scrivere..."
          autoComplete="off"
          className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-raised)] px-3 py-2 pr-9 text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
        />
        <ChevronDown
          size={16}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--text-secondary)]"
        />
      </div>

      {open && matches.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[var(--surface-border)] bg-[var(--surface-raised)] shadow-lg"
        >
          {matches.map((country, index) => (
            <li
              key={country}
              role="option"
              aria-selected={country === value}
              onMouseDown={(e) => {
                e.preventDefault();
                selectCountry(country);
              }}
              onMouseEnter={() => setHighlighted(index)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === highlighted
                  ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
                  : "text-[var(--text-primary)]"
              }`}
            >
              {country}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
