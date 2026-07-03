"use client";

/**
 * Widgets contrats : cartes d'alerte, tableau des contrats,
 * visualisation pédagogique du recoupement.
 */
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarClock,
  CircleCheck,
  FileSearch,
  Flag,
  Hourglass,
  ShieldAlert,
} from "lucide-react";
import type { Artist, Contract, ContractAlert } from "@/lib/demo/types";
import { fmtDate, fmtEur, fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SEVERITY_STYLES: Record<ContractAlert["severity"], { border: string; icon: string }> = {
  info: { border: "border-l-brand/60", icon: "text-brand" },
  warning: { border: "border-l-warning/70", icon: "text-warning" },
  danger: { border: "border-l-destructive/70", icon: "text-destructive" },
};

const KIND_ICONS: Record<ContractAlert["kind"], React.ComponentType<{ className?: string }>> = {
  expiry: CalendarClock,
  option: Flag,
  "audit-window": FileSearch,
  "unusual-clause": ShieldAlert,
};

export function AlertCard({
  alert,
  contract,
  artist,
}: {
  alert: ContractAlert;
  contract: Contract;
  artist?: Artist;
}) {
  const t = useTranslations("contracts");
  const locale = useLocale();
  const style = SEVERITY_STYLES[alert.severity];
  const Icon = KIND_ICONS[alert.kind];
  const message = alert.message[locale === "fr" ? "fr" : "en"];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-l-4 bg-card p-4",
        style.border,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.icon)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-semibold">{t(`alerts.kinds.${alert.kind}`)}</span>
          <span className="text-[11px] text-muted-foreground">
            {t(`types.${contract.type === "édition" ? "edition" : contract.type}`)} ·{" "}
            {contract.counterparty}
          </span>
          {artist && (
            <ArtistBadge artist={artist} size="sm" className="ml-auto" />
          )}
        </div>
        <p className="mt-1 text-sm leading-snug">{message}</p>
        {alert.dueDate && (
          <p className="num mt-1 text-[11px] text-muted-foreground">
            {t("alerts.due", { date: fmtDate(locale, alert.dueDate) })}
          </p>
        )}
      </div>
    </div>
  );
}

export function ContractsTable({
  contracts,
  todayIso,
}: {
  contracts: Contract[];
  todayIso: string;
}) {
  const t = useTranslations("contracts");
  const locale = useLocale();

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.type")}</TableHead>
            <TableHead>{t("table.counterparty")}</TableHead>
            <TableHead>{t("table.period")}</TableHead>
            <TableHead className="text-right">{t("table.rate")}</TableHead>
            <TableHead className="text-right">{t("table.advance")}</TableHead>
            <TableHead className="w-40">{t("table.recoupment")}</TableHead>
            <TableHead>{t("table.territory")}</TableHead>
            <TableHead className="text-right">{t("table.exclusivity")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((c) => {
            const expired = c.endDate < todayIso;
            return (
              <TableRow key={c.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-2 font-medium">
                    {t(`types.${c.type === "édition" ? "edition" : c.type}`)}
                    {expired && (
                      <Badge
                        variant="outline"
                        className="border-transparent bg-destructive/10 text-destructive"
                      >
                        {t("badges.expired")}
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.counterparty}</TableCell>
                <TableCell className="num whitespace-nowrap text-muted-foreground">
                  {fmtDate(locale, c.startDate, { month: "short", year: "numeric" })} →{" "}
                  {fmtDate(locale, c.endDate, { month: "short", year: "numeric" })}
                </TableCell>
                <TableCell className="num text-right font-medium">
                  {fmtInt(locale, c.royaltyRate)} %
                </TableCell>
                <TableCell className="num text-right">
                  {c.advance > 0 ? fmtEur(locale, c.advance) : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={c.recoupedPct}
                      className={cn(
                        "flex-1",
                        c.recoupedPct >= 100 && "[&>[data-slot=progress-indicator]]:bg-success",
                      )}
                    />
                    <span className="num w-10 text-right text-xs text-muted-foreground">
                      {fmtInt(locale, c.recoupedPct)} %
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.territory}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={c.exclusive ? "secondary" : "outline"}>
                    {c.exclusive ? t("badges.exclusive") : t("badges.nonExclusive")}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Visualisation pédagogique : où en est l'avance, étape par étape. */
export function RecoupmentViz({
  contract,
  artist,
}: {
  contract: Contract;
  artist?: Artist;
}) {
  const t = useTranslations("contracts");
  const locale = useLocale();

  const recouped = Math.round((contract.advance * contract.recoupedPct) / 100);
  const remaining = Math.max(0, contract.advance - recouped);
  const done = contract.recoupedPct >= 100;
  const rateLabel = `${fmtInt(locale, contract.royaltyRate)} %`;

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t("recoup.heading")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("recoup.sub", {
              type: t(`types.${contract.type === "édition" ? "edition" : contract.type}`),
              counterparty: contract.counterparty,
            })}
          </p>
        </div>
        {artist && <ArtistBadge artist={artist} size="sm" />}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-surface-2 p-3">
          <p className="text-[11px] text-muted-foreground">{t("recoup.advance")}</p>
          <p className="num mt-0.5 text-lg font-semibold">
            {fmtEur(locale, contract.advance)}
          </p>
        </div>
        <div className="rounded-lg bg-surface-2 p-3">
          <p className="text-[11px] text-muted-foreground">{t("recoup.recouped")}</p>
          <p className="num mt-0.5 text-lg font-semibold text-success">
            {fmtEur(locale, recouped)}
          </p>
        </div>
        <div className="rounded-lg bg-surface-2 p-3">
          <p className="text-[11px] text-muted-foreground">{t("recoup.remaining")}</p>
          <p
            className={cn(
              "num mt-0.5 text-lg font-semibold",
              done ? "text-success" : "text-warning",
            )}
          >
            {fmtEur(locale, remaining)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, contract.recoupedPct)}%`,
              background: "linear-gradient(90deg, var(--chart-1), var(--chart-2))",
            }}
          />
        </div>
        <div className="num mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>0</span>
          <span>{fmtInt(locale, contract.recoupedPct)} %</span>
          <span>{fmtEur(locale, contract.advance, { compact: true })}</span>
        </div>
      </div>

      <p
        className={cn(
          "mt-3 flex items-center gap-2 text-sm",
          done ? "text-success" : "text-muted-foreground",
        )}
      >
        {done ? (
          <CircleCheck className="size-4 shrink-0" aria-hidden />
        ) : (
          <Hourglass className="size-4 shrink-0 text-warning" aria-hidden />
        )}
        {done
          ? t("recoup.done")
          : t("recoup.left", { remaining: fmtEur(locale, remaining) })}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-xs font-semibold">{t("recoup.steps.advance.title")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("recoup.steps.advance.body", { advance: fmtEur(locale, contract.advance) })}
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-xs font-semibold">{t("recoup.steps.recoup.title")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("recoup.steps.recoup.body", {
              rate: rateLabel,
              recouped: fmtEur(locale, recouped),
            })}
          </p>
        </div>
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-xs font-semibold">{t("recoup.steps.payout.title")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("recoup.steps.payout.body")}
          </p>
        </div>
      </div>
    </section>
  );
}
