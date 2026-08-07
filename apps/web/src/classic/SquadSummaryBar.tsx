import { motion } from "framer-motion";
import type { Formation } from "@app/shared-types";
import { computeSquadChemistry, computeSquadOverallRating, departmentRatings } from "./engineHelpers";
import type { SquadAssignment } from "./types";
import { CHEMISTRY_LABEL, CHEMISTRY_LINE_COLOR } from "./theme";

/**
 * Riepilogo compatto sempre visibile durante il draft: Overall squadra, rating per reparto
 * e composizione dell'intesa. I pallini colorati sono anche la **legenda** delle linee sul
 * campo — verde/arancione/rosso qui e sul campo significano la stessa cosa, così non serve
 * spiegare a parole cosa vuol dire una linea rossa.
 */
export function SquadSummaryBar({
  formation,
  assignment,
}: {
  formation: Formation;
  assignment: SquadAssignment;
}) {
  const rating = computeSquadOverallRating(formation, assignment);
  const depts = departmentRatings(assignment);
  const { links, bonus } = computeSquadChemistry(formation, assignment);

  const counts = {
    green: links.filter((l) => l.color === "green").length,
    orange: links.filter((l) => l.color === "orange").length,
    red: links.filter((l) => l.color === "red").length,
  };

  return (
    <div className="flex shrink-0 items-center gap-3 overflow-x-auto border-b border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-2 sm:gap-4">
      <Stat label="Overall" value={rating} emphasis />
      <span className="h-6 w-px shrink-0 bg-[var(--surface-border)]" />
      <Stat label="POR" value={depts.POR} />
      <Stat label="DIF" value={depts.DIF} />
      <Stat label="CC" value={depts.CC} />
      <Stat label="ATT" value={depts.ATT} />
      <span className="h-6 w-px shrink-0 bg-[var(--surface-border)]" />
      <Stat label="Intesa" value={`+${bonus}`} />
      <span className="flex shrink-0 items-center gap-2">
        {(["green", "orange", "red"] as const).map((color) => (
          <span
            key={color}
            title={`Intesa ${CHEMISTRY_LABEL[color].toLowerCase()}`}
            className="flex items-center gap-1 text-xs font-bold"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CHEMISTRY_LINE_COLOR[color] }}
            />
            {counts[color]}
          </span>
        ))}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number | string | null;
  emphasis?: boolean;
}) {
  return (
    <span className="flex shrink-0 items-baseline gap-1 text-xs">
      <span className="font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
        {label}
      </span>
      {/* La chiave sul valore fa ripartire il "pop" ad ogni ricalcolo: il numero che cambia si nota. */}
      <motion.span
        key={String(value)}
        initial={{ scale: 1.35, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 24 }}
        className={`inline-block font-extrabold ${emphasis ? "text-base text-[var(--brand)]" : ""}`}
      >
        {value ?? "–"}
      </motion.span>
    </span>
  );
}
