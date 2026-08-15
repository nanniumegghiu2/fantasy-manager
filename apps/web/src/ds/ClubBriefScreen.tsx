import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Flame, Signature, Star, Users, Wallet } from "lucide-react";
import type { Department } from "@app/shared-types";
import { ageInSeason, type DsDifficulty } from "@app/game-engine";
import { NationFlag } from "../classic/NationFlag";
import { overallTier } from "../classic/theme";
import { clubRating, continentalEntrants, initialRoster, startingBudget } from "./buildCareerWorld";
import { DEPARTMENT_LABEL, RoleChips } from "./RoleChips";
import { euro } from "./format";
import { Stat, StatRow } from "./ui";
import type { DsWorldData } from "./useDsWorld";

/**
 * Il dossier del club, prima di firmare.
 *
 * Accettare un incarico senza aver visto la rosa è come firmare un contratto senza leggerlo:
 * la scelta del club decide dieci stagioni, e la sola forza media non dice **dove** quella
 * squadra è forte. Qui si vedono i giocatori uno per uno, la copertura per reparto e il budget
 * con cui si comincia — cioè tutto quello che serve per capire cosa andrà comprato.
 */

const ORDINE: Department[] = ["POR", "DIF", "CC", "ATT"];

/**
 * Le tre difficoltà, con la conseguenza scritta accanto.
 *
 * La leva è **solo il budget**, ed è dichiarato: in una modalità da direttore sportivo il
 * mercato è la partita, quindi dare più mezzi allarga le possibilità senza falsificare il
 * campionato — indebolire le avversarie, invece, renderebbe finta la classifica.
 */
const DIFFICOLTA: { id: DsDifficulty; nome: string; effetto: string; icone: number }[] = [
  { id: "facile", nome: "Facile", effetto: "+70% di budget: c'è margine per sbagliare un colpo.", icone: 1 },
  { id: "normale", nome: "Normale", effetto: "+30% di budget: una via di mezzo.", icone: 2 },
  { id: "difficile", nome: "Difficile", effetto: "Budget pieno di merito: ogni errore si paga.", icone: 3 },
];

interface ClubBriefScreenProps {
  world: DsWorldData;
  clubId: string;
  difficulty: DsDifficulty;
  onDifficulty: (d: DsDifficulty) => void;
  onAccept: () => void;
  onBack: () => void;
}

export function ClubBriefScreen({
  world,
  clubId,
  difficulty,
  onDifficulty,
  onAccept,
  onBack,
}: ClubBriefScreenProps) {
  const club = world.clubsById.get(clubId);
  const [reparto, setReparto] = useState<Department | "tutti">("tutti");

  const rosa = useMemo(
    () =>
      [...(world.playersByClub.get(clubId) ?? [])].sort(
        (a, b) => ORDINE.indexOf(a.department) - ORDINE.indexOf(b.department) || b.overall - a.overall,
      ),
    [world, clubId],
  );

  const budget = useMemo(
    () => startingBudget(initialRoster(world, clubId), difficulty),
    [world, clubId, difficulty],
  );
  const rating = clubRating(world, clubId);
  const inCorona = useMemo(() => continentalEntrants(world).clubIds.includes(clubId), [world, clubId]);

  const perReparto = useMemo(() => {
    const conteggio: Record<Department, { n: number; media: number }> = {
      POR: { n: 0, media: 0 },
      DIF: { n: 0, media: 0 },
      CC: { n: 0, media: 0 },
      ATT: { n: 0, media: 0 },
    };
    for (const p of rosa) {
      const voce = conteggio[p.department];
      voce.media = (voce.media * voce.n + p.overall) / (voce.n + 1);
      voce.n += 1;
    }
    return conteggio;
  }, [rosa]);

  const mostrati = reparto === "tutti" ? rosa : rosa.filter((p) => p.department === reparto);

  return (
    <div className="flex min-h-svh flex-col bg-[var(--surface)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Torna all'elenco dei club"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] transition-colors hover:border-[var(--brand)]"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-label font-bold tracking-widest text-[var(--text-secondary)] uppercase">
              {club?.leagueName}
            </p>
            <h1 className="truncate text-title leading-tight font-extrabold">{club?.name}</h1>
          </div>
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-body font-extrabold"
            style={{ backgroundColor: overallTier(rating).dot, color: overallTier(rating).dotText }}
          >
            {rating}
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4 pb-28">
        {/* ⚠️ **Tre numeri, una riga — non tre schermate.**

            Erano tre schede impilate da ~150px l'una: la prima schermata del dossier mostrava
            *tre numeri*, e la rosa — che è la ragione per cui il dossier esiste (CLAUDE.md
            § 3.7.9) — restava molto sotto la piega senza che niente dicesse che c'era. Numeri
            che si confrontano fra loro vanno affiancati, non impilati. */}
        <StatRow>
          <Stat icon={Wallet} label="Budget" value={euro(budget)} tone="gold" />
          <Stat icon={Users} label="In rosa" value={rosa.length} />
          <Stat icon={Star} label="Prestigio" value={`${club?.prestigeTier ?? 3}/5`} />
        </StatRow>

        {inCorona && (
          <p className="flex items-center gap-2 rounded-card border border-[#f5c518]/30 bg-[#f5c518]/5 p-3 text-body font-semibold text-[#c9a10b]">
            <Crown size={16} className="shrink-0" />
            Parte già ammessa alla Corona Continentale.
          </p>
        )}

        {/* La difficoltà si sceglie qui, dove si vede subito quanto cambia il budget. */}
        <section>
          <h2 className="mb-2 text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            Difficoltà
          </h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {DIFFICOLTA.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onDifficulty(d.id)}
                className={`relative rounded-card border p-3 text-left transition-colors ${
                  difficulty === d.id
                    ? "border-[var(--brand)] bg-[var(--brand)]/10"
                    : "border-[var(--surface-border)] bg-[var(--surface-raised)] hover:border-[var(--brand)]/50"
                }`}
              >
                <span className="flex items-center gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Flame
                      key={i}
                      size={13}
                      className={i < d.icone ? "text-[var(--accent)]" : "text-[var(--surface-border)]"}
                      fill={i < d.icone ? "currentColor" : "none"}
                    />
                  ))}
                </span>
                <p className="mt-1.5 text-body font-extrabold">{d.nome}</p>
                <p className="mt-0.5 text-label leading-relaxed text-[var(--text-secondary)]">
                  {d.effetto}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Copertura per reparto: è ciò che dice dove servirà comprare. */}
        <section>
          <h2 className="mb-2 text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            Come è fatta la rosa
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {ORDINE.map((dep) => (
              <button
                key={dep}
                type="button"
                onClick={() => setReparto(reparto === dep ? "tutti" : dep)}
                className={`rounded-card border p-2.5 text-center transition-colors ${
                  reparto === dep
                    ? "border-[var(--brand)] bg-[var(--brand)]/10"
                    : "border-[var(--surface-border)] bg-[var(--surface-raised)]"
                }`}
              >
                <p className="text-micro font-bold tracking-wide text-[var(--text-secondary)] uppercase">
                  {DEPARTMENT_LABEL[dep]}
                </p>
                <p className="mt-1 text-title leading-none font-extrabold tabular-nums">
                  {perReparto[dep].n}
                </p>
                <p className="mt-0.5 text-label text-[var(--text-secondary)] tabular-nums">
                  media {Math.round(perReparto[dep].media) || "—"}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 text-micro font-bold tracking-widest text-[var(--text-secondary)] uppercase">
            {reparto === "tutti" ? "Rosa completa" : DEPARTMENT_LABEL[reparto]}
            {reparto !== "tutti" && (
              <button
                type="button"
                onClick={() => setReparto("tutti")}
                className="font-semibold text-[var(--brand)] normal-case"
              >
                mostra tutti
              </button>
            )}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {mostrati.map((player) => {
              const tier = overallTier(player.overall);
              const eta = ageInSeason(player.birthDate, 1);
              return (
                <li
                  key={player.id}
                  className="flex items-center gap-2.5 rounded-control border border-[var(--surface-border)] bg-[var(--surface-raised)] p-2.5"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-body font-extrabold"
                    style={{ backgroundColor: tier.dot, color: tier.dotText }}
                  >
                    {player.overall}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-body leading-tight font-bold">
                      <NationFlag nation={player.nation} />
                      <span className="truncate">{player.name}</span>
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <RoleChips role={player.role} secondary={player.secondaryRoles} />
                      {eta !== null && (
                        <span className="text-label text-[var(--text-secondary)] tabular-nums">
                          {eta}a
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--surface-border)] bg-[var(--surface)]/95 backdrop-blur"
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <button
            type="button"
            onClick={onAccept}
            className="flex w-full items-center justify-center gap-2.5 rounded-card bg-[var(--brand)] py-4 text-body font-extrabold text-[var(--brand-contrast)] transition-transform active:scale-[0.98]"
          >
            <Signature size={19} />
            Accetta l'incarico
          </button>
        </div>
      </motion.div>
    </div>
  );
}

