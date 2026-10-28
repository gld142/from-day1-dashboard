"use client";

/**
 * Briques des pages « opération » (Contrats, Œuvres & placements) : la section neutre repliable et
 * le contrôle segmenté écrit. Surfaces neutres : la teinte de famille reste au chiffre clé de la
 * page (Gaël, 28/10/2026 : pas de « plaques jaunes » en série).
 */
import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Section neutre repliable : le titre est le bouton (plier / déplier), le compte est à côté,
 * les contrôles à droite. Repliée, elle ne garde que sa ligne de titre.
 */
export function Panel({
  title,
  meta,
  actions,
  children,
  defaultOpen = true,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const t = useTranslations("common");
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section aria-labelledby={`${id}-t`} className="bg-card text-card-foreground overflow-hidden rounded-xl border">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
        <h2 id={`${id}-t`} className="min-w-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={`${id}-b`}
            title={open ? t("panel.collapse") : t("panel.expand")}
            className="hover:bg-muted/60 focus-visible:ring-ring/50 -mx-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[15px] font-semibold tracking-[-0.01em] outline-none focus-visible:ring-2"
          >
            <ChevronDown className={cn("text-muted-foreground size-4 transition-transform duration-200", !open && "-rotate-90")} aria-hidden />
            {title}
          </button>
        </h2>
        {meta && <span className="text-muted-foreground text-[12.5px] tabular-nums">{meta}</span>}
        {open && actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {open && (
        <div id={`${id}-b`} className="border-t">
          {children}
        </div>
      )}
    </section>
  );
}

/** Contrôle segmenté : chaque choix est écrit, le choix courant est en relief. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="bg-muted/70 inline-flex flex-wrap items-center rounded-lg p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="text-muted-foreground tabular-nums">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

