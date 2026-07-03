"use client";

/**
 * /rights — droits d'auteur & droits voisins FR (SACEM, ADAMI, SPEDIDAM, SPRE).
 * Persona artiste : ses relevés. Persona label : agrégé roster (ou artiste zoomé).
 */
import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, TriangleAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ARTISTS, rightsStatements } from "@/lib/demo/api";
import { DEMO_TODAY } from "@/lib/demo/seed";
import type { RightsOrganism, RightsStatement } from "@/lib/demo/types";
import { fmtCompact, fmtDate, fmtEur } from "@/lib/format";
import { useRole } from "@/lib/role";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  ORGANISM_ORDER,
  OrganismCard,
  PaymentsTimeline,
  parsePeriod,
  type RightsRow,
  type ScheduledPayment,
} from "@/components/modules/droits/rights-widgets";
import { Button } from "@/components/ui/button";

const PERIODS = ["2025-T1", "2025-T2", "2025-T3", "2025-T4", "2026-T1", "2026-T2"];
const LAST_4 = new Set(PERIODS.slice(-4));

/** Calendrier des répartitions à venir (déterministe, relatif à DEMO_TODAY). */
const SCHEDULE: Array<Omit<ScheduledPayment, "estimated">> = [
  { organism: "spre", date: "2026-09-30", frequency: "semiannual" },
  { organism: "sacem", date: "2026-10-05", frequency: "quarterly" },
  { organism: "adami", date: "2026-12-15", frequency: "semiannual" },
  { organism: "spedidam", date: "2026-12-20", frequency: "semiannual" },
  { organism: "sacem", date: "2027-01-05", frequency: "quarterly" },
  { organism: "adami", date: "2027-06-15", frequency: "semiannual" },
];

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

export default function RightsPage() {
  const t = useTranslations("rights");
  const locale = useLocale();
  const { isLabel, artistId, focusedArtistId } = useRole();
  const grouped = isLabel && !focusedArtistId;

  /** Relevés agrégés par (organisme, période) sur le périmètre courant. */
  const rows = useMemo<RightsRow[]>(() => {
    const ids = grouped ? ARTISTS.map((a) => a.id) : [artistId];
    const map = new Map<string, RightsRow>();
    for (const id of ids) {
      for (const s of rightsStatements(id)) {
        const key = `${s.organism}:${s.period}`;
        const cur =
          map.get(key) ??
          ({
            organism: s.organism,
            period: s.period,
            expected: 0,
            received: 0,
            status: "received" as RightsStatement["status"],
          } satisfies RightsRow);
        cur.expected += s.expected;
        cur.received += s.received;
        if (s.status === "gap-detected") cur.status = "gap-detected";
        else if (s.status === "pending" && cur.status !== "gap-detected")
          cur.status = "pending";
        map.set(key, cur);
      }
    }
    return Array.from(map.values());
  }, [grouped, artistId]);

  const kpis = useMemo(() => {
    const received12m = rows
      .filter((r) => LAST_4.has(r.period))
      .reduce((s, r) => s + r.received, 0);
    const expectedPending = rows
      .filter((r) => r.status === "pending")
      .reduce((s, r) => s + r.expected, 0);
    const gapRows = rows.filter((r) => r.status === "gap-detected");
    const gapTotal = gapRows.reduce((s, r) => s + Math.max(0, r.expected - r.received), 0);
    return { received12m, expectedPending, gapTotal, gapCount: gapRows.length };
  }, [rows]);

  const payments = useMemo<ScheduledPayment[]>(() => {
    const pendingByOrg = new Map<RightsOrganism, number>();
    for (const r of rows) {
      if (r.status === "pending") {
        pendingByOrg.set(r.organism, (pendingByOrg.get(r.organism) ?? 0) + r.expected);
      }
    }
    return SCHEDULE.map((p) => ({
      ...p,
      estimated: pendingByOrg.get(p.organism) ?? 0,
    }));
  }, [rows]);

  const upcoming6m = useMemo(
    () =>
      payments.filter(
        (p) => new Date(p.date).getTime() - DEMO_TODAY.getTime() <= SIX_MONTHS_MS,
      ),
    [payments],
  );

  const chartData = useMemo(
    () =>
      PERIODS.map((period) => {
        const p = parsePeriod(period);
        const inPeriod = rows.filter((r) => r.period === period);
        return {
          period: t("periodShort", { q: p.q, year: p.year }),
          expected: inPeriod.reduce((s, r) => s + r.expected, 0),
          received: inPeriod.reduce((s, r) => s + r.received, 0),
        };
      }),
    [rows, t],
  );

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          id="rights-received"
          label={t("kpis.received12m")}
          value={kpis.received12m}
          format="eur"
          deltaLabel={t("kpis.last4Quarters")}
        />
        <KpiCard
          id="rights-expected"
          label={t("kpis.expected")}
          value={kpis.expectedPending}
          format="eur"
          deltaLabel={t("kpis.pendingPeriod")}
        />
        <KpiCard
          id="rights-gaps"
          label={t("kpis.gaps")}
          value={kpis.gapTotal}
          format="eur"
          deltaLabel={t("kpis.gapsHint")}
        />
        <KpiCard
          id="rights-upcoming"
          label={t("kpis.upcoming")}
          value={upcoming6m.length}
          format="int"
          deltaLabel={
            upcoming6m[0]
              ? t("kpis.nextOn", { date: fmtDate(locale, upcoming6m[0].date) })
              : undefined
          }
        />
      </div>

      {kpis.gapCount > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-l-4 border-l-warning/70 bg-card p-4">
          <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {t("gapsCallout.title", {
                count: kpis.gapCount,
                amount: fmtEur(locale, kpis.gapTotal),
              })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("gapsCallout.body")}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/audit">
              {t("gapsCallout.cta")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      )}

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">{t("chart.heading")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("chart.sub")}</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.07} />
              <XAxis
                dataKey="period"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                width={44}
                tickFormatter={(v: number) => fmtCompact(locale, v)}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                formatter={(value) => fmtEur(locale, Number(value ?? 0))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              <Bar
                dataKey="expected"
                name={t("chart.expected")}
                fill="var(--chart-2)"
                fillOpacity={0.45}
                radius={[4, 4, 0, 0]}
                animationDuration={600}
              />
              <Bar
                dataKey="received"
                name={t("chart.received")}
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                animationDuration={600}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {ORGANISM_ORDER.map((organism) => {
          const orgRows = rows
            .filter((r) => r.organism === organism)
            .sort((a, b) => a.period.localeCompare(b.period));
          const received12m = orgRows
            .filter((r) => LAST_4.has(r.period))
            .reduce((s, r) => s + r.received, 0);
          return (
            <OrganismCard
              key={organism}
              organism={organism}
              rows={orgRows}
              received12m={received12m}
            />
          );
        })}
      </div>

      <div className="mt-6">
        <PaymentsTimeline payments={payments} />
      </div>
    </div>
  );
}
