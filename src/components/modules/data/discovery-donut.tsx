"use client";

/**
 * Sources de découverte — donut recharts + légende explicative i18n.
 * Parts fixes par artiste (hash déterministe), pondérées en vue agrégée.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fmtPct } from "@/lib/format";
import { discoveryFor, type DiscoverySource } from "./derive";

const COLORS: Record<DiscoverySource, string> = {
  algorithmic: "var(--chart-1)",
  editorial: "var(--chart-2)",
  playlists: "var(--chart-3)",
  ugc: "var(--chart-4)",
};

export function DiscoveryDonut({ ids }: { ids: string[] }) {
  const locale = useLocale();
  const t = useTranslations("audience");

  const parts = useMemo(() => discoveryFor(ids), [ids]);
  const top = useMemo(
    () => parts.reduce((a, b) => (b.pct > a.pct ? b : a), parts[0]),
    [parts],
  );

  const pct = (n: number) => fmtPct(locale, n).replace("+", "");

  return (
    <section className="rounded-xl border bg-card p-5">
      <header>
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {t("discovery.title")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("discovery.subtitle")}
        </p>
      </header>

      <div className="mt-5 flex flex-col items-center gap-8 lg:flex-row lg:items-start">
        {/* Donut */}
        <div className="relative size-52 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                formatter={(value, name) => [
                  pct(Number(value)),
                  t(`discovery.${String(name)}.label`),
                ]}
              />
              <Pie
                data={parts}
                dataKey="pct"
                nameKey="id"
                innerRadius="64%"
                outerRadius="90%"
                paddingAngle={3}
                cornerRadius={4}
                stroke="var(--card)"
                strokeWidth={2}
                animationDuration={600}
              >
                {parts.map((p) => (
                  <Cell key={p.id} fill={COLORS[p.id]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-xl font-semibold tracking-tight">
              {pct(top.pct)}
            </span>
            <span className="max-w-24 text-center text-[10px] leading-tight text-muted-foreground">
              {t(`discovery.${top.id}.label`)}
            </span>
          </div>
        </div>

        {/* Légende + explications */}
        <div className="grid flex-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {parts.map((p) => (
            <div key={p.id} className="flex gap-3">
              <span
                aria-hidden
                className="mt-1 size-2.5 shrink-0 rounded-full"
                style={{ background: COLORS[p.id] }}
              />
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">
                    {t(`discovery.${p.id}.label`)}
                  </span>
                  <span className="num text-sm">{pct(p.pct)}</span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {t(`discovery.${p.id}.desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
