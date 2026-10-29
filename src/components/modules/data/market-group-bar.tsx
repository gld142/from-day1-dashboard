"use client";

/**
 * Barre horizontale empilée des parts par groupe (une teinte par groupe, cf. market-shared)
 * + légende avec part et nombre de titres. Les groupes absents du relevé ne
 * sont pas dessinés.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MarketShareRow } from "@/lib/demo/api";
import type { MarketGroup } from "@/lib/real";
import { fmtCompact } from "@/lib/format";
import { GROUP_ORDER, fmtShare, groupColor } from "./market-shared";

export function MarketGroupBar({ rows }: { rows: MarketShareRow[] }) {
  const locale = useLocale();
  const t = useTranslations("market");

  const ordered = useMemo(
    () =>
      GROUP_ORDER.flatMap((g) => {
        const r = rows.find((x) => x.key === g);
        return r ? [{ ...r, group: g }] : [];
      }),
    [rows],
  );
  // Une seule « ligne » de données : chaque groupe est une série empilée.
  const data = useMemo(
    () => [Object.fromEntries(ordered.map((r) => [r.group, Math.round(r.share * 1000) / 10]))],
    [ordered],
  );

  return (
    <div>
      <div className="h-11 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey={() => ""} hide />
            {/* Infobulle lisible : le texte reste à l'encre normale, la couleur est dans le carré. */}
            <Tooltip
              cursor={false}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="bg-popover text-popover-foreground rounded-xl border px-3 py-2 text-[12.5px] shadow-[0_8px_24px_rgb(0_0_0/0.12)]">
                    <ul className="space-y-1">
                      {payload.map((p) => (
                        <li key={String(p.dataKey)} className="flex items-center gap-2">
                          <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: groupColor(String(p.dataKey) as MarketGroup) }} />
                          <span className="font-medium">{t(`groups.${String(p.dataKey) as MarketGroup}`)}</span>
                          <span className="num text-muted-foreground ml-auto pl-3">{fmtShare(locale, Number(p.value) / 100)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              }
            />
            {ordered.map((r, i) => (
              <Bar
                key={r.group}
                dataKey={r.group}
                stackId="shares"
                fill={groupColor(r.group)}
                stroke="var(--card)"
                strokeWidth={2}
                radius={i === 0 ? [6, 0, 0, 6] : i === ordered.length - 1 ? [0, 6, 6, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {ordered.map((r) => (
          <li key={r.group} className="flex items-center gap-1.5 text-xs">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: groupColor(r.group) }} />
            <span className="font-medium">{t(`groups.${r.group}`)}</span>
            <span className="num text-muted-foreground">
              {fmtShare(locale, r.share)} · {fmtCompact(locale, r.streams)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
