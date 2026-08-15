import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Flame,
  Frown,
  Lightbulb,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { SeasonPlayerReport, SeasonSummary } from "@app/game-engine";
import { ROLE_DEPARTMENT, type Department } from "@app/shared-types";
import { ordinale } from "./format";

interface SeasonSquadReportModalProps {
  summary: SeasonSummary;
  clubName: string;
  onContinue: () => void;
}

type TabFilter = "tutti" | "crescita" | "declino" | "scontenti" | "stats";

export function SeasonSquadReportModal({
  summary,
  clubName,
  onContinue,
}: SeasonSquadReportModalProps) {
  const reports = useMemo(() => summary.playerReports ?? [], [summary]);
  const [filter, setFilter] = useState<TabFilter>("tutti");
  const [search, setSearch] = useState("");

  /* --- Analisi sintetica della rosa per il DS --- */
  const analytics = useMemo(() => {
    if (reports.length === 0) return null;

    let topScorer: SeasonPlayerReport | null = null;
    let topAssister: SeasonPlayerReport | null = null;
    let topGainer: SeasonPlayerReport | null = null;
    let topDecliner: SeasonPlayerReport | null = null;

    const deptStats: Record<Department, { count: number; sumBefore: number; sumAfter: number }> = {
      POR: { count: 0, sumBefore: 0, sumAfter: 0 },
      DIF: { count: 0, sumBefore: 0, sumAfter: 0 },
      CC: { count: 0, sumBefore: 0, sumAfter: 0 },
      ATT: { count: 0, sumBefore: 0, sumAfter: 0 },
    };

    for (const r of reports) {
      if (!topScorer || r.stats.goals > topScorer.stats.goals) topScorer = r;
      if (!topAssister || r.stats.assists > topAssister.stats.assists) topAssister = r;
      if (!topGainer || r.overallDelta > topGainer.overallDelta) topGainer = r;
      if (!topDecliner || r.overallDelta < topDecliner.overallDelta) topDecliner = r;

      const dept = (ROLE_DEPARTMENT[r.role] ?? "CC") as Department;
      deptStats[dept].count += 1;
      deptStats[dept].sumBefore += r.overallBefore;
      deptStats[dept].sumAfter += r.overallAfter;
    }

    const deptAverages = (Object.keys(deptStats) as Department[]).map((dept) => {
      const { count, sumBefore, sumAfter } = deptStats[dept];
      const avgBefore = count > 0 ? sumBefore / count : 0;
      const avgAfter = count > 0 ? sumAfter / count : 0;
      return { dept, count, avgBefore, avgAfter, delta: avgAfter - avgBefore };
    });

    // Reparto più debole o con maggiore perdita
    const weakestDept = [...deptAverages].sort((a, b) => a.avgAfter - b.avgAfter)[0];

    const retiringPlayers = reports.filter((r: SeasonPlayerReport) => r.retired);
    const unhappyPlayers = reports.filter((r: SeasonPlayerReport) => r.unhappy);
    const growingPlayers = reports.filter((r: SeasonPlayerReport) => r.overallDelta > 0);
    const decliningPlayers = reports.filter((r: SeasonPlayerReport) => r.overallDelta < 0);

    return {
      topScorer: topScorer && topScorer.stats.goals > 0 ? topScorer : null,
      topAssister: topAssister && topAssister.stats.assists > 0 ? topAssister : null,
      topGainer: topGainer && topGainer.overallDelta > 0 ? topGainer : null,
      topDecliner: topDecliner && topDecliner.overallDelta < 0 ? topDecliner : null,
      deptAverages,
      weakestDept,
      retiringPlayers,
      unhappyPlayers,
      growingPlayers,
      decliningPlayers,
    };
  }, [reports]);

  /* --- Filtraggio elenco giocatori --- */
  const filteredReports = useMemo(() => {
    return reports.filter((r: SeasonPlayerReport) => {
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchName = r.name.toLowerCase().includes(query);
        const matchRole = r.role.toLowerCase().includes(query);
        if (!matchName && !matchRole) return false;
      }

      if (filter === "crescita") return r.overallDelta > 0;
      if (filter === "declino") return r.overallDelta < 0 || r.retired;
      if (filter === "scontenti") return r.unhappy;
      if (filter === "stats") return r.stats.goals > 0 || r.stats.assists > 0;
      return true;
    });
  }, [reports, filter, search]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-md overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.9, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="relative my-auto w-full max-w-2xl overflow-hidden rounded-card border border-[var(--surface-border)] bg-[var(--surface)] shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header Scheda */}
        <div className="relative border-b border-[var(--surface-border)] bg-gradient-to-r from-[var(--brand)]/20 via-[var(--surface)] to-[var(--surface)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)]/15 px-3 py-1 text-micro font-extrabold text-[var(--brand)] uppercase tracking-wider">
                <Activity size={13} />
                Report Direttore Sportivo
              </span>
              <h2 className="mt-2 text-display font-extrabold leading-tight text-[var(--text-primary)]">
                Valutazione Rosa & Crescita
              </h2>
              <p className="mt-0.5 text-label text-[var(--text-secondary)] font-medium">
                {clubName} · Stagione {summary.season} ({ordinale(summary.position)} posto)
              </p>
            </div>
            <div className="text-right">
              <span className="text-label text-[var(--text-secondary)] block">Totale Rosa</span>
              <span className="text-title font-black text-[var(--text-primary)] tabular-nums">
                {reports.length}
              </span>
            </div>
          </div>
        </div>

        {/* Quadro Analitico Strategico (Base per il Mercato) */}
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {analytics && (
            <section className="rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#f5c518]" />
                <h3 className="text-micro font-black tracking-wider text-[var(--text-secondary)] uppercase">
                  Direttiva Strategica per il Mercato
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-label">
                {/* Top Performer */}
                <div className="rounded-control border border-[var(--surface-border)] bg-[var(--surface)] p-3 space-y-1">
                  <span className="text-micro font-bold text-[var(--text-secondary)] uppercase flex items-center gap-1">
                    <Trophy size={12} className="text-[#f5c518]" /> Top Scorer
                  </span>
                  <p className="font-extrabold text-body truncate">
                    {analytics.topScorer ? analytics.topScorer.name : "Nessun marcatore"}
                  </p>
                  <p className="text-label text-[var(--text-secondary)]">
                    {analytics.topScorer
                      ? `${analytics.topScorer.stats.goals} gol in ${analytics.topScorer.stats.appearances} presenze`
                      : "0 reti"}
                  </p>
                </div>

                {/* Gemma della stagione */}
                <div className="rounded-control border border-[var(--surface-border)] bg-[var(--surface)] p-3 space-y-1">
                  <span className="text-micro font-bold text-[var(--text-secondary)] uppercase flex items-center gap-1">
                    <Flame size={12} className="text-[#3ddc6b]" /> Major Growth
                  </span>
                  <p className="font-extrabold text-body truncate text-[#3ddc6b]">
                    {analytics.topGainer ? analytics.topGainer.name : "Stabile"}
                  </p>
                  <p className="text-label text-[var(--text-secondary)]">
                    {analytics.topGainer
                      ? `+${analytics.topGainer.overallDelta} Overall (${analytics.topGainer.overallBefore} → ${analytics.topGainer.overallAfter})`
                      : "Nessuna crescita"}
                  </p>
                </div>

                {/* Reparto critico */}
                <div className="rounded-control border border-[var(--surface-border)] bg-[var(--surface)] p-3 space-y-1">
                  <span className="text-micro font-bold text-[var(--text-secondary)] uppercase flex items-center gap-1">
                    <ShieldAlert size={12} className="text-[#ff4d4d]" /> Reparto Debole
                  </span>
                  <p className="font-extrabold text-body truncate text-[#ff4d4d]">
                    {analytics.weakestDept ? `Linea ${analytics.weakestDept.dept}` : "Equilibrato"}
                  </p>
                  <p className="text-label text-[var(--text-secondary)]">
                    {analytics.weakestDept
                      ? `Media Overall: ${analytics.weakestDept.avgAfter.toFixed(1)}`
                      : "Valori uniformi"}
                  </p>
                </div>
              </div>

              {/* Note di sintesi per il mercato */}
              <div className="rounded-control bg-[var(--surface)]/80 p-3 border border-[var(--surface-border)] text-label space-y-1">
                <p className="font-semibold text-[var(--text-primary)]">
                  <Lightbulb size={13} className="inline shrink-0" /> <strong>Consiglio del DS per la finestra estiva:</strong>
                </p>
                <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-0.5 pl-1">
                  {analytics.retiringPlayers.length > 0 && (
                    <li>
                      <strong className="text-[#ff4d4d]">{analytics.retiringPlayers.length} calciatori</strong> si ritirano: prioritario cercare sostituti di ruolo.
                    </li>
                  )}
                  {analytics.unhappyPlayers.length > 0 && (
                    <li>
                      <strong className="text-[#ffab2e]">{analytics.unhappyPlayers.length} scontenti</strong> chiedono cessione o garanzie tattiche.
                    </li>
                  )}
                  {analytics.growingPlayers.length > 0 && (
                    <li>
                      <strong className="text-[#3ddc6b]">{analytics.growingPlayers.length} giovani in crescita</strong> garantiscono un'ottima base su cui costruire.
                    </li>
                  )}
                </ul>
              </div>
            </section>
          )}

          {/* Filtri Rapidi & Ricerca */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca calciatore o ruolo..."
                  className="w-full rounded-full border border-[var(--surface-border)] bg-[var(--surface-raised)] pl-9 pr-3 py-1.5 text-label text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 text-label">
              <FilterChip
                active={filter === "tutti"}
                onClick={() => setFilter("tutti")}
                label={`Tutti (${reports.length})`}
              />
              <FilterChip
                active={filter === "crescita"}
                onClick={() => setFilter("crescita")}
                label={`Cresciuti (${analytics?.growingPlayers.length ?? 0})`}
              />
              <FilterChip
                active={filter === "declino"}
                onClick={() => setFilter("declino")}
                label={`Declino e ritiri (${(analytics?.decliningPlayers.length ?? 0) + (analytics?.retiringPlayers.length ?? 0)})`}
              />
              <FilterChip
                active={filter === "scontenti"}
                onClick={() => setFilter("scontenti")}
                label={`Scontenti (${analytics?.unhappyPlayers.length ?? 0})`}
              />
              <FilterChip
                active={filter === "stats"}
                onClick={() => setFilter("stats")}
                label={`Marcatori e assist`}
              />
            </div>
          </div>

          {/* Elenco Calciatori */}
          <div className="space-y-2">
            {filteredReports.map((player) => (
              <PlayerReportCard key={player.playerId} player={player} />
            ))}

            {filteredReports.length === 0 && (
              <p className="py-8 text-center text-label text-[var(--text-secondary)] font-medium">
                Nessun calciatore trovato per questo filtro.
              </p>
            )}
          </div>
        </div>

        {/* Footer con azione verso il Meeting col Mister */}
        <div className="border-t border-[var(--surface-border)] bg-[var(--surface)] p-4">
          <button
            type="button"
            onClick={onContinue}
            className="flex w-full items-center justify-center gap-2 rounded-card bg-[var(--brand)] py-3.5 text-body font-extrabold text-[var(--brand-contrast)] shadow-lg transition-transform active:scale-[0.98]"
          >
            <span>Prosegui al Meeting col Mister</span>
            <ArrowRight size={17} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-label font-bold transition-colors ${
        active
          ? "bg-[var(--brand)] text-[var(--brand-contrast)]"
          : "border border-[var(--surface-border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      {label}
    </button>
  );
}

function PlayerReportCard({ player }: { player: SeasonPlayerReport }) {
  const isPositive = player.overallDelta > 0;
  const isNegative = player.overallDelta < 0;

  return (
    <div className="flex items-center gap-3 rounded-card border border-[var(--surface-border)] bg-[var(--surface-raised)] p-3 text-label">
      {/* Badge Ruolo */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[var(--surface)] border border-[var(--surface-border)] font-extrabold text-label text-[var(--brand)]">
        {player.role}
      </div>

      {/* Dettagli Anagrafici & Stato */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-body truncate text-[var(--text-primary)]">
            {player.name}
          </span>
          <span className="text-label text-[var(--text-secondary)] font-medium">
            {player.age} anni
          </span>

          {player.retired && (
            <span className="rounded-full bg-[#ff4d4d]/20 px-2 py-0.5 text-micro font-black text-[#ff4d4d] uppercase">
              Ritiro
            </span>
          )}
          {player.loanReturn && (
            <span className="rounded-full bg-[#3ddc6b]/20 px-2 py-0.5 text-micro font-black text-[#3ddc6b] uppercase">
              Rientro Prestito
            </span>
          )}
          {player.unhappy && !player.retired && (
            <span className="rounded-full bg-[#ffab2e]/20 px-2 py-0.5 text-micro font-black text-[#ffab2e] uppercase flex items-center gap-0.5">
              <Frown size={11} /> Scontento
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-3 text-label text-[var(--text-secondary)]">
          <span>
            Pres: <strong className="text-[var(--text-primary)]">{player.stats.appearances}</strong>
          </span>
          <span>
            Gol: <strong className="text-[var(--text-primary)]">{player.stats.goals}</strong>
          </span>
          <span>
            Assist: <strong className="text-[var(--text-primary)]">{player.stats.assists}</strong>
          </span>
          <span>
            Pot: <strong className="text-[var(--text-primary)]">{player.potentialAfter}</strong>
          </span>
        </div>
      </div>

      {/* Diff Overall */}
      <div className="shrink-0 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <span className="text-label text-[var(--text-secondary)]">{player.overallBefore}</span>
          <ArrowRight size={13} className="shrink-0 text-[var(--text-secondary)]" />
          <span className="text-body font-black tabular-nums text-[var(--text-primary)]">
            {player.overallAfter}
          </span>
        </div>

        <div className="mt-0.5 flex justify-end">
          {isPositive && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#3ddc6b]/20 px-2 py-0.5 text-label font-black text-[#3ddc6b]">
              <TrendingUp size={11} /> +{player.overallDelta}
            </span>
          )}
          {isNegative && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#ff4d4d]/20 px-2 py-0.5 text-label font-black text-[#ff4d4d]">
              <TrendingDown size={11} /> {player.overallDelta}
            </span>
          )}
          {!isPositive && !isNegative && (
            <span className="inline-flex items-center rounded-full bg-[var(--surface)] px-2 py-0.5 text-label font-bold text-[var(--text-secondary)]">
              Stabile
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
