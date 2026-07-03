"use client";

/**
 * Aperçu de la page publique de l'artiste : ce que voient les pros.
 * Les Switches contrôlent en direct les stats affichées dans la preview.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BadgeCheck, Check, Link2 } from "lucide-react";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Artist } from "@/lib/demo/types";
import { artistGradient, fmtCompact, fmtPct } from "@/lib/format";

type StatKey = "listeners" | "index" | "growth" | "genre";

export function PublicPreview({ artist }: { artist: Artist }) {
  const t = useTranslations("day1index");
  const locale = useLocale();
  const [visible, setVisible] = useState<Record<StatKey, boolean>>({
    listeners: true,
    index: true,
    growth: false,
    genre: true,
  });
  const [copied, setCopied] = useState(false);

  const toggle = (key: StatKey) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://fromday1.app/a/${artist.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard indisponible en démo */
    }
  };

  const stats: Array<{ key: StatKey; label: string; value: string }> = [
    {
      key: "listeners",
      label: t("public.statListeners"),
      value: fmtCompact(locale, artist.monthlyListeners),
    },
    {
      key: "index",
      label: t("public.statIndex"),
      value: `${artist.day1Index}`,
    },
    {
      key: "growth",
      label: t("public.statGrowth"),
      value: fmtPct(locale, artist.growthRate * 100),
    },
    {
      key: "genre",
      label: t("public.statGenre"),
      value: `${artist.genre} · ${artist.country}`,
    },
  ];

  const toggles: Array<{ key: StatKey; label: string }> = [
    { key: "listeners", label: t("public.statListeners") },
    { key: "index", label: t("public.statIndex") },
    { key: "growth", label: t("public.statGrowth") },
    { key: "genre", label: t("public.statGenre") },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-heading text-base font-semibold">{t("public.title")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("public.subtitle")}</p>
      </div>

      {/* Preview façon page publique */}
      <div className="overflow-hidden rounded-lg border bg-surface-2/50">
        <div className="h-16" style={{ background: artistGradient(artist.hue) }} />
        <div className="-mt-8 px-4 pb-4">
          <ArtistAvatar artist={artist} size="xl" className="ring-4 ring-card" />
          <div className="mt-2 flex items-center gap-1.5">
            <span className="font-heading text-lg font-semibold">{artist.name}</span>
            <BadgeCheck className="size-4 text-brand" aria-hidden />
          </div>
          <p className="text-[11px] text-muted-foreground">{t("public.verified")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {stats
              .filter((s) => visible[s.key])
              .map((s) => (
                <div key={s.key} className="rounded-md border bg-card px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className="num text-sm font-semibold">{s.value}</p>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Contrôles de visibilité */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {t("public.toggles")}
        </p>
        <div className="flex flex-col gap-2">
          {toggles.map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-center justify-between gap-3 text-sm"
            >
              <span>{item.label}</span>
              <Switch
                checked={visible[item.key]}
                onCheckedChange={() => toggle(item.key)}
              />
            </label>
          ))}
        </div>
      </div>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
        {copied ? (
          <Check className="size-3.5 text-success" aria-hidden />
        ) : (
          <Link2 className="size-3.5" aria-hidden />
        )}
        {copied ? t("public.copied") : t("public.copy")}
      </Button>
    </div>
  );
}
