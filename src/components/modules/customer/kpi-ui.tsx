"use client";

/**
 * Liste d'indicateurs du mode client : chaque ligne dit la valeur ET comment elle
 * est calculée ; un indicateur non calculable dit pourquoi, au lieu d'afficher 0.
 */
import { cn } from "@/lib/utils";

export type KpiRow = {
  key: string;
  label: string;
  /** `null` = pas calculable : `missing` dit pourquoi. */
  value: React.ReactNode | null;
  formula: string;
  missing?: string;
};

export function KpiList({ rows, className }: { rows: KpiRow[]; className?: string }) {
  return (
    <ul className={cn("grid gap-2.5", className)}>
      {rows.map((r) => (
        <li key={r.key} className="grid gap-0.5 border-t border-current/10 pt-2 text-sm first:border-t-0 first:pt-0 sm:grid-cols-[14rem_9rem_1fr] sm:gap-3">
          <span className="font-medium">{r.label}</span>
          <span className={cn("num tabular-nums", r.value === null && "text-muted-foreground")}>{r.value ?? "—"}</span>
          <span className="text-muted-foreground text-xs leading-relaxed">{r.value === null ? r.missing : r.formula}</span>
        </li>
      ))}
    </ul>
  );
}
