import type { ReactNode } from "react";

/**
 * La riga di lista: il mattone della DS mode.
 *
 * Giocatori, club, mister, offerte, notizie, storico — sono tutte la stessa
 * forma («qualcosa a sinistra, due righe di testo, un dato o un'azione a
 * destra»), ed erano riscritte a mano una quindicina di volte con misure,
 * raggi e spaziature ogni volta diverse.
 *
 * ⚠️ **`title` non si taglia mai.** È la regola della fase 4 del piano: un
 * nome, un club, un ruolo identificano qualcosa, e un dato identificante
 * tagliato non è denso, è inutile. Le misure lo dicevano: la card del capitano
 * mostrava «4 anni al club · è nettamente il più forte della r…» con 175px su
 * 381 necessari, cioè **il 54% del testo perso**. Il taglio resta permesso
 * solo su `subtitle`, che è davvero accessorio, e comunque su due righe.
 */

interface ListRowProps {
  /** Pastiglia, stemma, numero: l'ancora visiva a sinistra. */
  leading?: ReactNode;
  /** Il dato identificante. Va a capo, non si taglia. */
  title: ReactNode;
  /** Contesto: club, età, ruolo. Al massimo due righe, poi si taglia. */
  subtitle?: ReactNode;
  /** Il dato allineato a destra: un prezzo, un Overall, una data. */
  trailing?: ReactNode;
  /** Azione a tutta larghezza sotto la riga: su telefono è la forma leggibile. */
  action?: ReactNode;
  /** Riga sotto il sottotitolo: pastiglie di ruolo, badge di stato. */
  meta?: ReactNode;
  /** Accento sul bordo sinistro: competizione, esito, urgenza. */
  accent?: string;
  onClick?: () => void;
}

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  action,
  meta,
  accent,
  onClick,
}: ListRowProps) {
  const contenuto = (
    <>
      <div className="flex items-start gap-3">
        {leading}

        <div className="min-w-0 flex-1">
          {/* `text-balance` invece di `truncate`: un nome lungo occupa due
              righe equilibrate invece di sparire a metà. */}
          <div className="text-body leading-tight font-bold text-balance">{title}</div>
          {subtitle && (
            <div className="mt-0.5 line-clamp-2 text-label text-[var(--text-secondary)]">
              {subtitle}
            </div>
          )}
          {meta && <div className="mt-1.5 flex flex-wrap items-center gap-1">{meta}</div>}
        </div>

        {trailing && <div className="shrink-0 text-right">{trailing}</div>}
      </div>

      {action && <div className="mt-2.5">{action}</div>}
    </>
  );

  const classi = `w-full rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3 text-left ${
    accent ? "border-l-[3px]" : ""
  }`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${classi} transition-transform active:scale-[0.99]`}
        style={accent ? { borderLeftColor: accent } : undefined}
      >
        {contenuto}
      </button>
    );
  }

  return (
    <div className={classi} style={accent ? { borderLeftColor: accent } : undefined}>
      {contenuto}
    </div>
  );
}
