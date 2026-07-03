"use client";

/**
 * Widgets Droits FR : carte par organisme (SACEM, ADAMI, SPEDIDAM, SPRE)
 * et timeline des prochains versements.
 */
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Check, Clock, TriangleAlert } from "lucide-react";
import type { RightsOrganism, RightsStatement } from "@/lib/demo/types";
import { fmtDate, fmtEur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type RightsRow = {
  organism: RightsOrganism;
  period: string;
  expected: number;
  received: number;
  status: RightsStatement["status"];
};

export const ORGANISM_ORDER: RightsOrganism[] = ["sacem", "adami", "spedidam", "spre"];

export const ORGANISM_COLORS: Record<RightsOrganism, string> = {
  sacem: "var(--chart-1)",
  adami: "var(--chart-2)",
  spedidam: "var(--chart-3)",
  spre: "var(--chart-4)",
};

/** "2025-T4" → { year: "2025", q: "4" } */
export function parsePeriod(period: string): { year: string; q: string } {
  const [year, t] = period.split("-T");
  return { year, q: t };
}

export function StatementStatusBadge({ status }: { status: RightsStatement["status"] }) {
  const t = useTranslations("rights");
  if (status === "received") {
    return (
      <Badge variant="outline" className="border-transparent bg-success/10 text-success">
        <Check aria-hidden />
        {t("status.received")}
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
        <Clock aria-hidden />
        {t("status.pending")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-transparent bg-warning/10 text-warning">
      <TriangleAlert aria-hidden />
      {t("status.gap")}
    </Badge>
  );
}

export function OrganismCard({
  organism,
  rows,
  received12m,
}: {
  organism: RightsOrganism;
  rows: RightsRow[];
  received12m: number;
}) {
  const t = useTranslations("rights");
  const locale = useLocale();
  const color = ORGANISM_COLORS[organism];

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: color }}
            />
            {organism.toUpperCase()}
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {t(`organisms.${organism}.name`)}
          </p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {t(`organisms.${organism}.desc`)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-muted-foreground">{t("orgCard.received12m")}</p>
          <p className="num text-lg font-semibold">{fmtEur(locale, received12m)}</p>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("orgCard.period")}</TableHead>
              <TableHead className="text-right">{t("orgCard.expected")}</TableHead>
              <TableHead className="text-right">{t("orgCard.received")}</TableHead>
              <TableHead className="w-24" />
              <TableHead className="text-right">{t("orgCard.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const ratio =
                r.expected === 0 ? 0 : Math.min(100, (r.received / r.expected) * 100);
              const p = parsePeriod(r.period);
              return (
                <TableRow key={r.period}>
                  <TableCell className="num whitespace-nowrap font-medium">
                    {t("periodShort", { q: p.q, year: p.year })}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {fmtEur(locale, r.expected)}
                  </TableCell>
                  <TableCell className="num text-right font-medium">
                    {r.status === "pending" ? "—" : fmtEur(locale, r.received)}
                  </TableCell>
                  <TableCell>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${ratio}%`,
                          background:
                            r.status === "gap-detected" ? "var(--warning)" : color,
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <StatementStatusBadge status={r.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export type ScheduledPayment = {
  organism: RightsOrganism;
  date: string; // ISO
  frequency: "quarterly" | "semiannual";
  estimated: number;
};

export function PaymentsTimeline({ payments }: { payments: ScheduledPayment[] }) {
  const t = useTranslations("rights");
  const locale = useLocale();

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
        {t("timeline.heading")}
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("timeline.sub")}</p>

      <ol className="mt-4 flex flex-col">
        {payments.map((p, i) => (
          <li key={`${p.organism}-${p.date}`} className="relative flex gap-3 pb-4 last:pb-0">
            {i < payments.length - 1 && (
              <span
                aria-hidden
                className="absolute left-[5px] top-4 h-full w-px bg-border"
              />
            )}
            <span
              aria-hidden
              className="mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-card"
              style={{ background: ORGANISM_COLORS[p.organism] }}
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="num text-sm font-medium">
                {fmtDate(locale, p.date)}
              </span>
              <span className="text-sm font-semibold">{p.organism.toUpperCase()}</span>
              <Badge variant="outline" className="text-muted-foreground">
                {t(`timeline.frequency.${p.frequency}`)}
              </Badge>
              <span className="num ml-auto text-sm text-muted-foreground">
                {t("timeline.estimated", {
                  amount: fmtEur(locale, p.estimated, { compact: true }),
                })}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
