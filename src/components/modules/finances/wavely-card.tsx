"use client";

import { useTranslations } from "next-intl";
import { Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Card d'intégration Wavely — synchro automatique des dépenses. */
export function WavelyCard({ syncedCount }: { syncedCount: number }) {
  const t = useTranslations("finances.wavely");
  const tCommon = useTranslations("common");

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Waves className="size-5" aria-hidden />
        </span>
        <Badge variant="secondary">{tCommon("actions.soon")}</Badge>
      </div>
      <div>
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <p className="num text-xs text-muted-foreground">
        {t("syncedCount", { count: syncedCount })}
      </p>
      <Button variant="outline" size="sm" disabled className="w-fit">
        {t("connect")}
      </Button>
    </div>
  );
}
