import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Search, Star, Wallet } from "lucide-react";
import { NationFlag } from "../classic/NationFlag";
import { overallTier } from "../classic/theme";
import { clubHighlights, clubRating, continentalEntrants, initialRoster, startingBudget } from "./buildCareerWorld";
import { euro } from "./format";
import type { DsClub, DsWorldData } from "./useDsWorld";

/**
 * Scelta del club: è la decisione che definisce l'intera carriera, quindi la schermata deve
 * far vedere subito **cosa cambia** — forza della rosa, mezzi economici e se si parte già in
 * Europa. Sceglierlo da un elenco di nomi sarebbe scegliere a caso.
 */

function Stars({ tier }: { tier: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Prestigio ${tier} su 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={11}
          className={i < tier ? "text-[var(--accent)]" : "text-[var(--surface-border)]"}
          fill={i < tier ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

interface ClubCardProps {
  club: DsClub;
  world: DsWorldData;
  inCup: boolean;
  selected: boolean;
  onSelect: () => void;
}

function ClubCard({ club, world, inCup, selected, onSelect }: ClubCardProps) {
  const rating = clubRating(world, club.id);
  const tier = overallTier(rating);
  const budget = startingBudget(initialRoster(world, club.id));
  const stelle = clubHighlights(world, club.id);

  return (
    <motion.button
      type="button"
      layout
      onClick={onSelect}
      whileTap={{ scale: 0.985 }}
      className={`relative flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition-colors ${
        selected
          ? "border-[var(--brand)] bg-[var(--brand)]/10"
          : "border-[var(--surface-border)] bg-[var(--surface-raised)] hover:border-[var(--brand)]/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-extrabold"
          style={{ backgroundColor: tier.dot, color: tier.dotText }}
        >
          {rating}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-extrabold">{club.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <Stars tier={club.prestigeTier} />
            <span className="text-[11px] text-[var(--text-secondary)]">
              {world.playersByClub.get(club.id)?.length ?? 0} in rosa
            </span>
          </div>
        </div>
      </div>

      {inCup && (
        <span className="flex w-fit items-center gap-1.5 rounded-full bg-[#f5c518]/15 px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#c9a10b] uppercase">
          <Crown size={11} />
          Ammessa alla Corona
        </span>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
        <span className="flex items-center gap-1 font-semibold">
          <Wallet size={12} />
          {euro(budget)} di budget
        </span>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {stelle.map((player) => (
          <li
            key={player.id}
            className="flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold"
          >
            <NationFlag nation={player.nation} />
            <span className="max-w-[110px] truncate">{player.name}</span>
            <span className="text-[var(--text-secondary)]">{player.overall}</span>
          </li>
        ))}
      </ul>
    </motion.button>
  );
}

interface ClubPickerScreenProps {
  world: DsWorldData;
  onPick: (clubId: string) => void;
  onExit: () => void;
}

export function ClubPickerScreen({ world, onPick, onExit }: ClubPickerScreenProps) {
  const [leagueId, setLeagueId] = useState(world.leagues[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const qualificate = useMemo(() => new Set(continentalEntrants(world).clubIds), [world]);

  const clubs = useMemo(() => {
    const termine = query.trim().toLowerCase();
    return world.clubs
      .filter((club) => (termine ? club.name.toLowerCase().includes(termine) : club.leagueId === leagueId))
      .map((club) => ({ club, rating: clubRating(world, club.id) }))
      .sort((a, b) => b.rating - a.rating)
      .map(({ club }) => club);
  }, [world, leagueId, query]);

  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onExit}
            aria-label="Torna alla home"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
              Direttore sportivo · Passo 1 di 2
            </p>
            <h1 className="truncate text-lg leading-tight font-extrabold">Scegli il club</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-4 pb-28">
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Dieci stagioni alla guida di una squadra vera. Un club forte parte in Europa e con
          più mezzi; uno piccolo si costruisce comprando giovani e facendoli crescere — ma
          <strong className="font-bold"> retrocedere chiude la carriera</strong>.
        </p>

        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-secondary)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca un club..."
            className="w-full rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] py-2.5 pr-4 pl-9 text-sm outline-none focus:border-[var(--brand)]"
          />
        </label>

        {!query.trim() && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {world.leagues.map((league) => (
              <button
                key={league.id}
                type="button"
                onClick={() => setLeagueId(league.id)}
                className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${
                  league.id === leagueId
                    ? "text-[var(--brand-contrast)]"
                    : "border border-[var(--surface-border)] text-[var(--text-secondary)]"
                }`}
              >
                {league.id === leagueId && (
                  <motion.span
                    layoutId="ds-league-pill"
                    className="absolute inset-0 rounded-full bg-[var(--brand)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{league.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-2.5 sm:grid-cols-2">
          {clubs.map((club) => (
            <ClubCard
              key={club.id}
              club={club}
              world={world}
              inCup={qualificate.has(club.id)}
              selected={selected === club.id}
              onSelect={() => setSelected(club.id)}
            />
          ))}
        </div>

        {clubs.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
            Nessun club trovato.
          </p>
        )}
      </main>

      {selected && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--surface-border)] bg-[var(--surface)]/95 backdrop-blur"
        >
          <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">
                {world.clubsById.get(selected)?.name}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {world.clubsById.get(selected)?.leagueName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onPick(selected)}
              className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-95"
            >
              Vedi la rosa
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
