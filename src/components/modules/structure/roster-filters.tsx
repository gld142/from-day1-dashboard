"use client";

/**
 * Filtres du roster de démo : catégorie et DA, en pastilles. L'état vit dans
 * l'URL (`?cat=`, `?da=`) — partageable, et un rôle DA arrive déjà filtré.
 */
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { DAS } from "@/lib/demo/data";
import type { RosterScope } from "@/lib/demo/scope";
import { ARTIST_CATEGORIES } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
        active
          ? "border-brand bg-brand/10 text-brand"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function RosterFilters({
  scope,
  onChange,
}: {
  scope: RosterScope;
  onChange: (next: RosterScope) => void;
}) {
  const t = useTranslations("roster");
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label={t("filters.category")}
      >
        <span className="mr-1 text-muted-foreground">{t("filters.category")}</span>
        <Pill
          active={scope.category === null}
          onClick={() => onChange({ ...scope, category: null })}
        >
          {t("filters.all")}
        </Pill>
        {ARTIST_CATEGORIES.map((c) => (
          <Pill
            key={c}
            active={scope.category === c}
            // Recliquer la pastille active la retire : on revient à « Toutes ».
            onClick={() => onChange({ ...scope, category: scope.category === c ? null : c })}
          >
            {t(`category.${c}`)}
          </Pill>
        ))}
      </div>
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label={t("filters.da")}
      >
        <span className="mr-1 text-muted-foreground">{t("filters.da")}</span>
        <Pill active={scope.daId === null} onClick={() => onChange({ ...scope, daId: null })}>
          {t("filters.allDa")}
        </Pill>
        {DAS.map((d) => (
          <Pill
            key={d.id}
            active={scope.daId === d.id}
            onClick={() => onChange({ ...scope, daId: scope.daId === d.id ? null : d.id })}
          >
            {d.name}
          </Pill>
        ))}
      </div>
    </div>
  );
}
