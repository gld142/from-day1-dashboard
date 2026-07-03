"use client";

/**
 * Comparateur roster (vue label) — une ligne par artiste, couleur signature.
 * Les chips-légende zooment sur l'artiste (setFocusedArtistId).
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ARTISTS, dailyTotals, getArtist } from "@/lib/demo/api";
import { artistColor, fmtCompact, fmtDate } from "@/lib/format";
import { useRole } from "@/lib/role";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";
import { aggregateWeekly } from "./derive";

export function RosterCompare({ days }: { days: number }) {
  const locale = useLocale();
  const t = useTranslations("streams");
  const { setFocusedArtistId } = useRole();
  const weekly = days >= 90;

  const artists = useMemo(
    () =>
      ARTISTS.map((artist) => {
        const series = dailyTotals(artist.id, days);
        return {
          artist,
          pts: weekly ? aggregateWeekly(series) : series,
          total: series.reduce((s, p) => s + p.streams, 0),
        };
      }).sort((a, b) => b.total - a.total),
    [days, weekly],
  );

  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const { artist, pts } of artists) {
      for (const p of pts) {
        const row = byDate.get(p.date) ?? { date: p.date };
        row[artist.id] = p.streams;
        byDate.set(p.date, row);
      }
    }
    return Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [artists]);

  return (
    <section className="rounded-xl border bg-card p-5">
      <header>
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {t("compare.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("compare.subtitle", { count: artists.length })}
        </p>
      </header>

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} strokeOpacity={0.07} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              minTickGap={32}
              tickFormatter={(d: string) =>
                fmtDate(locale, d, { day: "numeric", month: "short" })
              }
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              width={44}
              tickFormatter={(v: number) => fmtCompact(locale, v)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 12,
              }}
              labelFormatter={(d) => fmtDate(locale, String(d))}
              formatter={(value, name) => [
                fmtCompact(locale, Number(value)),
                getArtist(String(name)).name,
              ]}
            />
            {artists.map(({ artist }) => (
              <Line
                key={artist.id}
                type="monotone"
                dataKey={artist.id}
                stroke={artistColor(artist.hue)}
                strokeWidth={2}
                dot={false}
                animationDuration={600}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {artists.map(({ artist, total }) => (
          <button
            key={artist.id}
            type="button"
            onClick={() => setFocusedArtistId(artist.id)}
            className="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-surface-2"
          >
            <ArtistAvatar artist={artist} size="sm" />
            <span className="font-medium">{artist.name}</span>
            <span className="num text-muted-foreground">
              {fmtCompact(locale, total)}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {t("compare.focusHint")}
      </p>
    </section>
  );
}
