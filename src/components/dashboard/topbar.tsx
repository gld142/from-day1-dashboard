"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState, useTransition } from "react";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Languages,
  MicVocal,
  Moon,
  Sun,
  Sunrise,
} from "lucide-react";
import { setLocale } from "@/i18n/actions";
import type { Locale } from "@/i18n/config";
import { ARTISTS, LABEL, getArtist } from "@/lib/demo/api";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { DailyBrief } from "@/components/dashboard/daily-brief";

const THEME_META = [
  { id: "night", icon: Moon },
  { id: "dawn", icon: Sunrise },
  { id: "day", icon: Sun },
] as const;

export function Topbar() {
  const t = useTranslations("common");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const {
    persona,
    artistId,
    setPersona,
    focusedArtistId,
    setFocusedArtistId,
    isLabel,
  } = useRole();
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();
  useEffect(() => setMounted(true), []);

  const focused = focusedArtistId ? getArtist(focusedArtistId) : null;
  const artist = getArtist(persona === "artist" ? artistId : "sky-lune");

  return (
    <header className="hairline-b sticky top-0 z-30 flex h-14 items-center gap-2 bg-background/80 px-4 backdrop-blur-md">
      <MobileNav />
      {/* Sélecteur d'identité : qui suis-je / qui je regarde */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2">
            {persona === "artist" ? (
              <>
                <ArtistAvatar artist={artist} size="sm" />
                <span className="text-sm font-medium">{artist.name}</span>
              </>
            ) : (
              <>
                <span className="flex size-6 items-center justify-center rounded-md bg-brand/15 text-brand">
                  <Building2 className="size-3.5" aria-hidden />
                </span>
                <span className="text-sm font-medium">
                  {focused ? focused.name : LABEL.name}
                </span>
              </>
            )}
            <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("roles.artist")} / {t("roles.label")}
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setPersona("artist")} className="gap-2">
            <MicVocal className="size-4" aria-hidden />
            <span className="flex-1">{t("roles.switchTo", { role: t("roles.artist") })}</span>
            {persona === "artist" && <Check className="size-4 text-brand" aria-hidden />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPersona("label")} className="gap-2">
            <Building2 className="size-4" aria-hidden />
            <span className="flex-1">{t("roles.switchTo", { role: t("roles.label") })}</span>
            {persona === "label" && <Check className="size-4 text-brand" aria-hidden />}
          </DropdownMenuItem>
          {isLabel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {LABEL.name}
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setFocusedArtistId(null)}
                className="gap-2"
              >
                <span className="flex size-5 items-center justify-center rounded bg-brand/15 text-brand">
                  <Building2 className="size-3" aria-hidden />
                </span>
                <span className="flex-1 text-sm">{LABEL.name}</span>
                {!focusedArtistId && <Check className="size-4 text-brand" aria-hidden />}
              </DropdownMenuItem>
              {ARTISTS.map((a) => (
                <DropdownMenuItem
                  key={a.id}
                  onClick={() => setFocusedArtistId(a.id)}
                  className="gap-2"
                >
                  <ArtistAvatar artist={a} size="sm" />
                  <span className="flex-1 text-sm">{a.name}</span>
                  {focusedArtistId === a.id && (
                    <Check className="size-4 text-brand" aria-hidden />
                  )}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Badge
        variant="outline"
        className="hidden rounded-full border-warning/50 text-[10px] uppercase tracking-wider text-warning sm:inline-flex"
      >
        {t("app.demo")}
      </Badge>

      <div className="ml-auto flex items-center gap-2">
        <CommandPalette />
        <DailyBrief />
        {/* Ambiance : nuit / aube / jour */}
        <div
          className="flex items-center rounded-full border p-0.5"
          role="radiogroup"
          aria-label={t("themes.switch")}
        >
          {THEME_META.map(({ id, icon: Icon }) => {
            const active = mounted && theme === id;
            return (
              <button
                key={id}
                role="radio"
                aria-checked={active}
                title={t(`themes.${id}`)}
                onClick={() => setTheme(id)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full transition-colors",
                  active
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
              </button>
            );
          })}
        </div>

        {/* Langue */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs font-medium uppercase"
              aria-label={t("locale.switch")}
            >
              <Languages className="size-4" aria-hidden />
              {locale}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["fr", "en"] as Locale[]).map((l) => (
              <DropdownMenuItem
                key={l}
                onClick={() => startTransition(() => setLocale(l))}
                className="gap-2"
              >
                <span className="flex-1">{t(`locale.${l}`)}</span>
                {locale === l && <Check className="size-4 text-brand" aria-hidden />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
