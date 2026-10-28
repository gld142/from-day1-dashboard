"use client";

/**
 * Filtres du roster de démo : catégorie et DA, en pastilles. L'état vit dans
 * l'URL (`?cat=`, `?da=`) — partageable. Sous un rôle DA (`lockedDaId`), le
 * groupe DA disparaît : un DA ne parcourt pas le roster des autres, il ne
 * filtre que par catégorie.
 */
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { DAS } from "@/lib/demo/data";
import { isFullScope, type RosterScope } from "@/lib/demo/scope";
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
  lockedDaId = null,
  das = DAS,
}: {
  scope: RosterScope;
  onChange: (next: RosterScope) => void;
  /** Le DA du rôle : son groupe de pastilles est caché, et « Réinitialiser » ne touche que la catégorie. */
  lockedDaId?: string | null;
  /** Les DA proposés : ceux de l'organisation de la maison (renommés, ajoutés) ; défaut das.ts. */
  das?: readonly { id: string; name: string }[];
}) {
  const t = useTranslations("roster");
  const canReset = lockedDaId ? scope.category !== null : !isFullScope(scope);
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
      {!lockedDaId && (
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={t("filters.da")}
        >
          <span className="mr-1 text-muted-foreground">{t("filters.da")}</span>
          <Pill active={scope.daId === null} onClick={() => onChange({ ...scope, daId: null })}>
            {t("filters.allDa")}
          </Pill>
          {das.map((d) => (
            <Pill
              key={d.id}
              active={scope.daId === d.id}
              onClick={() => onChange({ ...scope, daId: scope.daId === d.id ? null : d.id })}
            >
              {d.name}
            </Pill>
          ))}
        </div>
      )}
      {/* Hors périmètre complet : un seul geste pour revenir à tout le roster (le sien, sous le verrou). */}
      {canReset && (
        <button
          type="button"
          onClick={() => onChange({ category: null, daId: lockedDaId })}
          className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          {t("filters.reset")}
        </button>
      )}
    </div>
  );
}
