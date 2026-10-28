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
    <div className="flex items-center gap-2 text-[12px]">
      <span className="text-muted-foreground">{t("grouping.label")}</span>
      <div className="bg-muted/70 inline-flex rounded-lg p-0.5" role="group" aria-label={t("grouping.label")}>
        {ORG_GROUPINGS.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={value === g}
            onClick={() => onChange(g)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors",
              value === g ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`grouping.${g}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
