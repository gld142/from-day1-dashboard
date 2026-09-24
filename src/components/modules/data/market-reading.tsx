"use client";

/**
 * « Lecture du matin » : les faits structurés de la couche marché mis en
 * phrases (règles, pas de LLM) — majors, indés, sans-label, genres, leader,
 * roster Day One. Badge « estimé » : une lecture automatique reste une lecture.
 */
import { useLocale, useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import type { MorningReading } from "@/lib/demo/api";
import type { MarketGroup } from "@/lib/real";
import { fmtInt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { fmtPoints, fmtShare } from "./market-shared";

export function MarketReading({ reading }: { reading: MorningReading }) {
  const locale = useLocale();
  const t = useTranslations("market");
  const pct = (share: number) => fmtShare(locale, share / 100);
  const g = (group: MarketGroup) => t(`groups.${group}`);
  const [first, second, third] = reading.majors;

  const sentences: string[] = [
    t("reading.majors", {
      leader: g(first.group),
      leaderShare: pct(first.share),
      leaderDelta: fmtPoints(locale, first.delta7d),
      second: g(second.group),
      secondShare: pct(second.share),
      third: g(third.group),
      thirdShare: pct(third.share),
    }),
    t("reading.indies", { share: pct(reading.indies.share), other: pct(reading.other.share) }),
    t("reading.unknown", { count: reading.unknown.tracks, share: pct(reading.unknown.share) }),
    reading.genres.top === "rap"
      ? t("reading.genre", { rap: pct(reading.genres.rap) })
      : `${t("reading.genre", { rap: pct(reading.genres.rap) })} ${t("reading.genreTop", {
          genre: t(`genres.${reading.genres.top}`),
          share: pct(reading.genres.topShare),
        })}`,
  ];
  if (reading.leader) {
    sentences.push(
      t("reading.leader", {
        artist: reading.leader.artist,
        title: reading.leader.title,
        streams: fmtInt(locale, reading.leader.streams),
      }),
    );
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
          <Sparkles className="size-4 text-brand" aria-hidden />
          {t("reading.title")}
        </h2>
        <span className="flex items-center gap-1.5">
          <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px] text-muted-foreground">
            {t("reading.badge")}
          </Badge>
          <ProvenanceBadge provenance={reading.provenance} />
        </span>
      </header>

      <ul className="mt-3 space-y-2 text-sm leading-relaxed">
        {sentences.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand/70" />
            <span>{s}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-lg border border-brand/20 bg-brand/5 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand">{t("reading.rosterTitle")}</h3>
        <ul className="mt-1.5 space-y-1 text-sm">
          {reading.roster.map((r) => (
            <li key={r.id} className={r.tracks === 0 ? "text-muted-foreground" : undefined}>
              {r.tracks > 0 && r.bestRank !== null
                ? t("reading.rosterPresent", {
                    name: r.name,
                    count: r.tracks,
                    /* Dire les featurings : sans ça, additionner les lignes
                       donnait un total supérieur au KPI, un même titre pouvant
                       être compté chez le principal et chez l'invité. */
                    featured: r.featured,
                    rank: fmtInt(locale, r.bestRank),
                    title: r.bestTitle ?? "",
                  })
                : t("reading.rosterAbsent", { name: r.name })}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{t("reading.method")}</p>
    </section>
  );
}
