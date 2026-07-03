"use client";

/**
 * Barres horizontales top territoires — densité maximale, zéro chrome.
 */
import { useLocale } from "next-intl";
import { fmtCompact, fmtInt } from "@/lib/format";

export function TerritoryBars({
  data,
}: {
  data: Array<{ iso3: string; name: string; streams: number }>;
}) {
  const locale = useLocale();
  const total = data.reduce((s, d) => s + d.streams, 0);
  const max = data.reduce((m, d) => Math.max(m, d.streams), 0);

  return (
    <ul className="space-y-3.5">
      {data.map((c) => {
        const share = total === 0 ? 0 : (c.streams / total) * 100;
        return (
          <li key={c.iso3}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{c.name}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="num font-medium">{fmtCompact(locale, c.streams)}</span>
                <span className="num w-10 text-right text-xs text-muted-foreground">
                  {fmtInt(locale, Math.round(share))} %
                </span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${max === 0 ? 0 : (c.streams / max) * 100}%`,
                  background: "var(--chart-1)",
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
