import type { Department, Role } from "@app/shared-types";
import { ROLE_LABELS } from "@app/shared-types";

/**
 * I ruoli di un giocatore: quello naturale e quelli che sa coprire.
 *
 * Servono a decidere il mercato e il modulo, non a decorare. Con un cambio di allenatore cambia
 * lo schema, e sapere che tre difensori centrali sanno fare anche il terzino è la differenza fra
 * "devo comprare un terzino" e "posso spostare qualcuno". Mostrare solo il ruolo principale
 * nasconde proprio l'informazione che rende la scelta interessante.
 */

export const DEPARTMENT_LABEL: Record<Department, string> = {
  POR: "Porta",
  DIF: "Difesa",
  CC: "Centrocampo",
  ATT: "Attacco",
};

export const DEPARTMENT_COLOR: Record<Department, string> = {
  POR: "#f0b429",
  DIF: "#5aa9e6",
  CC: "#3ddc6b",
  ATT: "#ff8a3d",
};

export function RoleChips({
  role,
  secondary = [],
  /** Ruoli da evidenziare (es. quelli richiesti dal modulo in uso). */
  highlight,
}: {
  role: Role;
  secondary?: Role[];
  highlight?: Set<Role>;
}) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span
        title={ROLE_LABELS[role]}
        className={`rounded px-1.5 py-0.5 text-label leading-none font-extrabold ${
          highlight && !highlight.has(role) ? "opacity-50" : ""
        }`}
        style={{ backgroundColor: "var(--surface)", color: "var(--text-primary)" }}
      >
        {role}
      </span>
      {secondary.map((r) => (
        <span
          key={r}
          title={`${ROLE_LABELS[r]} (ruolo secondario)`}
          className={`rounded border border-dashed border-[var(--surface-border)] px-1.5 py-0.5 text-label leading-none font-semibold text-[var(--text-secondary)] ${
            highlight && !highlight.has(r) ? "opacity-45" : ""
          }`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}
