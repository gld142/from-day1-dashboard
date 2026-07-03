"use client";

/**
 * /urssaf — cotisations sociales artiste-auteur : simulateur,
 * échéances trimestrielles et déclaration pré-remplie (démo).
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Info } from "lucide-react";
import {
  ARTISTS,
  LABEL,
  getArtist,
  revenueBySource,
  revenueSeries,
} from "@/lib/demo/api";
import { DEMO_TODAY } from "@/lib/demo/seed";
import { fmtDate, fmtEur, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { KpiCard } from "@/components/dashboard/kpi";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  ContributionSimulator,
  DeadlinesTimeline,
  DeclarationCard,
  URSSAF_RATE,
  type Deadline,
} from "@/components/modules/droits/urssaf-widgets";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TODAY_ISO = DEMO_TODAY.toISOString().slice(0, 10);

/** Sources relevant du régime artiste-auteur (droits d'auteur). */
const AUTHOR_SOURCES = new Set(["sacem", "sync"]);

/** Mois du trimestre en cours de déclaration (T2 2026). */
const QUARTER_MONTHS = new Set(["2026-04", "2026-05", "2026-06"]);

const RAW_DEADLINES: Array<Pick<Deadline, "date" | "quarter" | "year">> = [
  { date: "2026-01-15", quarter: 4, year: 2025 },
  { date: "2026-04-15", quarter: 1, year: 2026 },
  { date: "2026-07-15", quarter: 2, year: 2026 },
  { date: "2026-10-15", quarter: 3, year: 2026 },
  { date: "2027-01-15", quarter: 4, year: 2026 },
];

function declarable12m(artistId: string): number {
  return revenueBySource(artistId, 12)
    .filter((r) => AUTHOR_SOURCES.has(r.source))
    .reduce((s, r) => s + r.amount, 0);
}

function declarableQuarter(artistId: string): number {
  return revenueSeries(artistId, 24)
    .filter((p) => QUARTER_MONTHS.has(p.month) && AUTHOR_SOURCES.has(p.source))
    .reduce((s, p) => s + p.amount, 0);
}

export default function UrssafPage() {
  const t = useTranslations("urssaf");
  const locale = useLocale();
  const { isLabel, artistId, focusedArtistId } = useRole();
  const grouped = isLabel && !focusedArtistId;

  const scopedIds = useMemo(
    () => (grouped ? ARTISTS.map((a) => a.id) : [artistId]),
    [grouped, artistId],
  );

  const declarable = useMemo(
    () => scopedIds.reduce((s, id) => s + declarable12m(id), 0),
    [scopedIds],
  );
  const quarterly = useMemo(
    () => scopedIds.reduce((s, id) => s + declarableQuarter(id), 0),
    [scopedIds],
  );
  const contributions = (declarable * URSSAF_RATE) / 100;

  const deadlines = useMemo<Deadline[]>(() => {
    let nextFound = false;
    return RAW_DEADLINES.map((d) => {
      if (d.date < TODAY_ISO) return { ...d, status: "paid" as const };
      if (!nextFound) {
        nextFound = true;
        const daysLeft = Math.round(
          (new Date(`${d.date}T00:00:00Z`).getTime() - DEMO_TODAY.getTime()) /
            86_400_000,
        );
        return { ...d, status: "next" as const, daysLeft };
      }
      return { ...d, status: "upcoming" as const };
    });
  }, []);

  const next = deadlines.find((d) => d.status === "next");
  const quarterLabel = next
    ? t("deadlines.quarter", { q: next.quarter, year: next.year })
    : "";
  const declarantName = grouped ? LABEL.name : getArtist(artistId).name;

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          id="urssaf-declarable"
          label={t("kpis.declarable")}
          value={declarable}
          format="eur"
          deltaLabel={t("kpis.declarableHint")}
        />
        <KpiCard
          id="urssaf-contributions"
          label={t("kpis.contributions")}
          value={contributions}
          format="eur"
          deltaLabel={t("kpis.rateNote", { rate: fmtPct(locale, URSSAF_RATE).replace("+", "") })}
        />
        <KpiCard
          id="urssaf-deadline"
          label={t("kpis.nextDeadline")}
          value={next?.daysLeft ?? 0}
          format="int"
          deltaLabel={
            next
              ? t("kpis.deadlineOn", {
                  date: fmtDate(locale, next.date),
                  quarter: quarterLabel,
                })
              : undefined
          }
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <ContributionSimulator
          key={grouped ? "roster" : artistId}
          initialAmount={declarable}
        />
        <div className="flex flex-col gap-4">
          <DeclarationCard
            declarantName={declarantName}
            quarterLabel={quarterLabel}
            quarterlyDeclarable={quarterly}
          />
          <section className="rounded-xl border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Info className="size-4 text-muted-foreground" aria-hidden />
              {t("note.title")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("note.body")}
            </p>
          </section>
        </div>
      </div>

      <div className="mt-6">
        <DeadlinesTimeline deadlines={deadlines} />
      </div>

      {grouped && (
        <section className="mt-6 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">{t("labelTable.heading")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("labelTable.sub")}</p>
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("labelTable.artist")}</TableHead>
                  <TableHead className="text-right">{t("labelTable.declarable")}</TableHead>
                  <TableHead className="text-right">
                    {t("labelTable.contributions")}
                  </TableHead>
                  <TableHead className="text-right">{t("labelTable.share")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ARTISTS.map((a) => {
                  const d = declarable12m(a.id);
                  return { artist: a, declarable: d };
                })
                  .sort((x, y) => y.declarable - x.declarable)
                  .map(({ artist, declarable: d }) => (
                    <TableRow key={artist.id}>
                      <TableCell>
                        <ArtistBadge artist={artist} size="sm" />
                      </TableCell>
                      <TableCell className="num text-right font-medium">
                        {fmtEur(locale, d)}
                      </TableCell>
                      <TableCell className="num text-right text-muted-foreground">
                        {fmtEur(locale, (d * URSSAF_RATE) / 100)}
                      </TableCell>
                      <TableCell className="num text-right text-muted-foreground">
                        {declarable === 0
                          ? "—"
                          : fmtPct(locale, (d / declarable) * 100).replace("+", "")}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
