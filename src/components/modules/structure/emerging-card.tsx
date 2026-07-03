"use client";

/**
 * Carte du feed A&R Watch : identité chromatique, momentum en avant,
 * mini Index Day 1 et toggle watchlist. La carte "signal fort" (hero)
 * est mise en avant avec le halo de marque.
 */
import { useLocale, useTranslations } from "next-intl";
import { Flame, MapPin, Star, Users } from "lucide-react";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EmergingArtist } from "@/lib/demo/types";
import { fmtCompact, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Initiales déterministes depuis le nom (EmergingArtist n'en porte pas). */
export function initialsOf(name: string): string {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function EmergingCard({
  artist,
  watchlisted,
  onToggleWatch,
  onScore,
  hero,
}: {
  artist: EmergingArtist;
  watchlisted: boolean;
  onToggleWatch: () => void;
  onScore: () => void;
  hero?: boolean;
}) {
  const t = useTranslations("arwatch");
  const locale = useLocale();

  return (
    <article
      className={cn(
        "relative flex flex-col gap-4 rounded-xl border bg-card p-5 transition-colors",
        hero && "brand-glow bg-gradient-to-b from-card to-surface-2",
      )}
    >
      {hero && (
        <Badge className="absolute -top-2.5 left-4 gap-1 border-transparent bg-brand text-brand-foreground">
          <Flame aria-hidden />
          {t("signal.badge")}
        </Badge>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ArtistAvatar
            artist={{ hue: artist.hue, initials: initialsOf(artist.name), name: artist.name }}
            size={hero ? "lg" : "md"}
          />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight">
              {artist.name}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="truncate">{artist.genre}</span>
              <span aria-hidden>·</span>
              <MapPin className="size-3 shrink-0" aria-hidden />
              {artist.country}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleWatch}
          aria-pressed={watchlisted}
          aria-label={watchlisted ? t("card.watching") : t("card.watch")}
          className={cn(watchlisted && "text-warning hover:text-warning")}
        >
          <Star className={cn("size-4", watchlisted && "fill-current")} aria-hidden />
        </Button>
      </div>

      {/* Momentum très visible */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p
            className={cn(
              "num font-semibold tracking-tight",
              hero ? "text-4xl" : "text-3xl",
              artist.momentum30d >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {fmtPct(locale, artist.momentum30d, 0)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("card.momentum")}
          </p>
        </div>
        <div className="text-right">
          <p className="num flex items-center justify-end gap-1 text-sm font-medium">
            <Users className="size-3.5 text-muted-foreground" aria-hidden />
            {fmtCompact(locale, artist.monthlyListeners)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("card.listeners")}
          </p>
        </div>
      </div>

      {/* Mini Index Day 1 */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{t("card.index")}</span>
          <span className="num font-medium text-foreground">{artist.day1Index}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${artist.day1Index}%` }}
          />
        </div>
      </div>

      <Button
        variant={hero ? "default" : "outline"}
        size="sm"
        onClick={onScore}
        className="mt-auto w-full"
      >
        {t("scoring.open")}
      </Button>
    </article>
  );
}
