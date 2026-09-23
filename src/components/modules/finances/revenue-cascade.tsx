"use client";

/**
 * La cascade d'un euro de streaming : ce que la plateforme verse, ce qui
 * revient à l'artiste, ce que touche l'auteur.
 *
 * Un tableau de trois lignes dit les mêmes montants, mais il ne fait pas
 * *voir* que la part artiste est une fraction du brut. Des barres alignées sur
 * une base commune le montrent d'un coup — c'est la raison d'être de ce bloc.
 *
 * Les largeurs sont proportionnelles au brut master, jamais renormalisées :
 * une barre courte doit rester courte.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CascadeStep = {
  key: string;
  label: ReactNode;
  amount: number;
  /** Fourchette basse / haute, affichée sous le montant quand elle existe. */
  range?: { low: number; high: number };
  /** Provenance ou précision, à droite du libellé. */
  note?: ReactNode;
  /** L'étape mise en avant : trait plein, libellé en encre pleine. */
  emphasis?: boolean;
};

export function RevenueCascade({
  steps,
  format,
  className,
}: {
  steps: readonly CascadeStep[];
  format: (n: number) => string;
  className?: string;
}) {
  const base = Math.max(1, ...steps.map((s) => s.amount));

  return (
    <div className={cn("mt-3 space-y-2.5", className)}>
      {steps.map((s) => {
        const width = Math.max(1.5, (s.amount / base) * 100);
        const share = base === 0 ? 0 : (s.amount / base) * 100;
        return (
          <div key={s.key}>
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className={cn("sheet-ink", s.emphasis && "text-foreground font-semibold")}>
                {s.label}
                {s.note ? <span className="ml-1.5 opacity-75">{s.note}</span> : null}
              </span>
              <span className="flex items-baseline gap-2 whitespace-nowrap tabular-nums">
                <b className={cn("font-semibold", s.emphasis && "text-base")}>
                  {format(s.amount)}
                </b>
                <span className="sheet-ink w-10 text-right text-[11px] opacity-75">
                  {Math.round(share)} %
                </span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[color-mix(in_oklab,var(--sheet-line)_14%,transparent)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${width}%`,
                  background: s.emphasis
                    ? "var(--sheet-line)"
                    : "color-mix(in oklab, var(--sheet-line) 55%, transparent)",
                }}
              />
            </div>
            {s.range ? (
              <p className="sheet-ink mt-0.5 text-[10.5px] tabular-nums opacity-75">
                {format(s.range.low)} – {format(s.range.high)}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
