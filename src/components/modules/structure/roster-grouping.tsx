"use client";

/**
 * Sélecteur de regroupement du tableau roster : par catégorie (défaut), par DA, par pôle.
 * L'état vit dans l'URL (`?groupe=da|pole`), comme les filtres. Des boutons à `aria-pressed`
 * dans un groupe nommé : Tab pour entrer, Entrée / Espace pour choisir.
 */
import { useTranslations } from "next-intl";
import { ORG_GROUPINGS, type OrgGrouping } from "@/lib/demo/org";
import { cn } from "@/lib/utils";

export function RosterGrouping({
  value,
  onChange,
}: {
  value: OrgGrouping;
  onChange: (next: OrgGrouping) => void;
}) {
  const t = useTranslations("organisation");
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12px]" role="group" aria-label={t("grouping.label")}>
      <span className="mr-1 text-muted-foreground">{t("grouping.label")}</span>
      {ORG_GROUPINGS.map((g) => (
        <button
          key={g}
          type="button"
          aria-pressed={value === g}
          onClick={() => onChange(g)}
          className={cn(
            "rounded-full border px-2.5 py-1 transition-colors",
            value === g ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(`grouping.${g}`)}
        </button>
      ))}
    </div>
  );
}
