"use client";

/**
 * Le brief du jour : l'essentiel quotidien, accessible depuis toutes les
 * pages via la topbar. Pastille tant qu'il n'a pas été ouvert aujourd'hui.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  FileWarning,
  Newspaper,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  CONTRACTS,
  dailyTotals,
  getArtist,
  labelTotals,
  monthlyRevenueTotals,
  rightsStatements,
  rosterRows,
  topTracks,
  tourDates,
} from "@/lib/demo/api";
import { DEMO_TODAY, isoDay } from "@/lib/demo/seed";
import { fmtCompact, fmtDate, fmtEur, fmtPct } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeltaChip } from "@/components/dashboard/kpi";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";
import { AskBar } from "@/components/dashboard/ask-bar";
import { cn } from "@/lib/utils";

function BriefRow({
  icon: Icon,
  tone,
  children,
  href,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "danger" | "success";
  children: React.ReactNode;
  href?: string;
  action?: string;
}) {
  const toneCls =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-brand";
  return (
    <div className="flex items-start gap-2.5 rounded-lg border bg-card p-3">
      <Icon className={cn("mt-0.5 size-4 shrink-0", toneCls)} aria-hidden />
      <div className="min-w-0 flex-1 text-[13px] leading-snug">{children}</div>
      {href && action && (
        <Link
          href={href}
          className="shrink-0 text-[11px] font-medium text-brand hover:underline"
        >
          {action}
        </Link>
      )}
    </div>
  );
}

export function DailyBrief() {
  const t = useTranslations("brief");
  const locale = useLocale();
  const { persona, artistId, isLabel, focusedArtistId } = useRole();
  const { briefOpenedOn, markBriefOpened } = usePrefs();
  const [open, setOpen] = useState(false);

  const today = isoDay(DEMO_TODAY);
  const unread = briefOpenedOn !== today;

  const data = useMemo(() => {
    const aggregated = isLabel && !focusedArtistId;
    const id = artistId;
    const daily = dailyTotals(id, 2);
    const yesterday = daily[daily.length - 2]?.streams ?? 0;
    const dayBefore = daily[daily.length - 1]?.streams ?? 0;
    const months = monthlyRevenueTotals(id, 24);
    const monthRevenue = months[months.length - 1]?.amount ?? 0;
    const top = topTracks(id, 7, 1)[0];
    const nextShow = tourDates(id).find((d) => d.status === "upcoming");
    const contractAlerts = CONTRACTS.filter((c) =>
      aggregated ? true : c.artistId === id,
    ).flatMap((c) => c.alerts.filter((a) => a.severity !== "info"));
    const gaps = rightsStatements(id).filter((s) => s.status === "gap-detected");
    const gapTotal = gaps.reduce((s, g) => s + (g.expected - g.received), 0);
    const roster = aggregated ? rosterRows() : [];
    const movers = [...roster].sort((a, b) => b.delta30d - a.delta30d);
    return {
      aggregated,
      yesterday,
      deltaVsDayBefore:
        dayBefore === 0 ? 0 : ((yesterday - dayBefore) / dayBefore) * 100,
      monthRevenue,
      top,
      nextShow,
      contractAlerts,
      gapTotal,
      totals: aggregated ? labelTotals() : null,
      rising: movers[0],
      falling: movers[movers.length - 1],
    };
  }, [artistId, isLabel, focusedArtistId]);

  const artist = getArtist(artistId);

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) markBriefOpened(today);
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 gap-1.5 px-2 text-xs font-medium"
        >
          <Newspaper className="size-4" aria-hidden />
          <span className="hidden xl:inline">{t("open")}</span>
          {unread && (
            <span
              className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-brand"
              aria-hidden
            />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="hairline-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2 font-heading text-lg">
            <Newspaper className="size-4.5 text-brand" aria-hidden />
            {t("title")}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {data.aggregated ? t("subtitleLabel") : t("subtitle")} ·{" "}
            <span className="num">{fmtDate(locale, today)}</span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 p-5">
            {/* Question directe */}
            <AskBar compact />

            {/* Les chiffres de la nuit */}
            <section className="flex flex-col gap-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {t("sections.numbers")}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[11px] text-muted-foreground">
                    {data.aggregated ? t("items.rosterStreams") : t("items.streamsYesterday")}
                  </p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="num text-lg font-semibold">
                      {fmtCompact(
                        locale,
                        data.aggregated ? data.totals!.streams30d : data.yesterday,
                      )}
                    </span>
                    {!data.aggregated && <DeltaChip value={data.deltaVsDayBefore} />}
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[11px] text-muted-foreground">
                    {data.aggregated ? t("items.rosterNet") : t("items.monthRevenue")}
                  </p>
                  <div className="mt-1">
                    <span className="num text-lg font-semibold">
                      {fmtEur(
                        locale,
                        data.aggregated ? data.totals!.net12m : data.monthRevenue,
                        { compact: true },
                      )}
                    </span>
                  </div>
                </div>
              </div>
              {!data.aggregated && data.top && (
                <BriefRow icon={TrendingUp} tone="success">
                  <span className="text-muted-foreground">{t("items.topTrack")} : </span>
                  <span className="font-medium">{data.top.title}</span>{" "}
                  <span className="num text-muted-foreground">
                    ({fmtCompact(locale, data.top.streams)})
                  </span>
                </BriefRow>
              )}
            </section>

            {/* En mouvement (vue label agrégée) */}
            {data.aggregated && data.rising && data.falling && (
              <section className="flex flex-col gap-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {t("sections.movers")}
                </h3>
                <BriefRow icon={TrendingUp} tone="success" href="/roster" action={t("actions.seeRoster")}>
                  <span className="inline-flex items-center gap-1.5">
                    <ArtistAvatar artist={data.rising} size="sm" />
                    {t("items.risingArtist", {
                      name: data.rising.name,
                      delta: fmtPct(locale, data.rising.delta30d),
                    })}
                  </span>
                </BriefRow>
                <BriefRow icon={TrendingDown} tone="danger" href="/roster" action={t("actions.seeRoster")}>
                  <span className="inline-flex items-center gap-1.5">
                    <ArtistAvatar artist={data.falling} size="sm" />
                    {t("items.risingArtist", {
                      name: data.falling.name,
                      delta: fmtPct(locale, data.falling.delta30d),
                    })}
                  </span>
                </BriefRow>
              </section>
            )}

            {/* À traiter */}
            <section className="flex flex-col gap-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {t("sections.alerts")}
              </h3>
              <BriefRow
                icon={FileWarning}
                tone={data.contractAlerts.length ? "warning" : "default"}
                href="/contracts"
                action={t("actions.seeContracts")}
              >
                {t("items.contractAlert", { count: data.contractAlerts.length })}
              </BriefRow>
              {data.gapTotal > 0 ? (
                <BriefRow
                  icon={AlertTriangle}
                  tone="danger"
                  href="/audit"
                  action={t("actions.seeAudit")}
                >
                  {t("items.rightsGap", {
                    amount: fmtEur(locale, data.gapTotal),
                  })}
                </BriefRow>
              ) : (
                <BriefRow icon={ShieldCheck} tone="success">
                  {t("items.rightsOk")}
                </BriefRow>
              )}
            </section>

            {/* À venir */}
            <section className="flex flex-col gap-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {t("sections.agenda")}
              </h3>
              <BriefRow
                icon={CalendarDays}
                href="/tour"
                action={t("actions.seeTour")}
              >
                {data.nextShow
                  ? t("items.nextShow", {
                      venue: data.nextShow.venue,
                      city: data.nextShow.city,
                    }) + ` · ${fmtDate(locale, data.nextShow.date)}`
                  : t("items.nextShowEmpty")}
              </BriefRow>
              {!data.aggregated && (
                <BriefRow icon={CircleDollarSign}>
                  <span className="inline-flex items-center gap-1.5">
                    <ArtistAvatar artist={artist} size="sm" />
                    <span className="num font-medium">
                      {fmtCompact(locale, artist.monthlyListeners)}
                    </span>
                    <span className="text-muted-foreground">
                      {persona === "artist" ? "" : artist.name}
                    </span>
                  </span>
                </BriefRow>
              )}
            </section>
          </div>
        </ScrollArea>

        <div className="hairline-t p-4">
          <Button className="w-full" variant="secondary" onClick={() => setOpen(false)}>
            {t("actions.gotIt")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
