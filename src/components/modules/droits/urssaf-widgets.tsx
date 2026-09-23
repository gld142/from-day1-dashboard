"use client";

/**
 * Widgets URSSAF artiste-auteur : simulateur de cotisations en direct,
 * timeline des échéances trimestrielles et déclaration pré-remplie (démo).
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarCheck,
  Check,
  Download,
  FileText,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { fmtDate, fmtEur } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Taux global indicatif artiste-auteur (constante produit). */
export const URSSAF_RATE = 16.3;

/** Détail des lignes de cotisation (somme = 16,3 %). */
export const URSSAF_LINES = [
  { key: "pension", rate: 6.15 },
  { key: "csg", rate: 9.2 },
  { key: "crds", rate: 0.5 },
  { key: "cfp", rate: 0.35 },
  { key: "pensionUncapped", rate: 0.1 },
] as const;

function fmtRate(locale: string, rate: number): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(rate)} %`;
}

export function ContributionSimulator({
  initialAmount,
  bare = false,
}: {
  initialAmount: number;
  /** Dans une feuille teintée : le titre vient du `SheetHeading`. */
  bare?: boolean;
}) {
  const t = useTranslations("urssaf");
  const locale = useLocale();
  const [raw, setRaw] = useState(() => String(Math.max(0, Math.round(initialAmount))));
  const amount = useMemo(() => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [raw]);

  const total = (amount * URSSAF_RATE) / 100;

  return (
    <section className={bare ? "min-w-0" : "bg-card rounded-xl border p-5"}>
      {!bare && (
        <>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="text-muted-foreground size-4" aria-hidden />
            {t("sim.heading")}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">{t("sim.sub")}</p>
        </>
      )}

      <div className={cn("max-w-xs", bare ? "mt-1" : "mt-4")}>
        <Label
          htmlFor="urssaf-amount"
          className={cn("text-xs", bare ? "sheet-ink" : "text-muted-foreground")}
        >
          {t("sim.amountLabel")}
        </Label>
        <div className="mt-1 flex items-center gap-2">
          <Input
            id="urssaf-amount"
            type="number"
            min={0}
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="num"
          />
          <span className="text-sm text-muted-foreground">€</span>
        </div>
      </div>

      <div className="mt-3 min-w-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("sim.line")}</TableHead>
              <TableHead className="text-right">{t("sim.rate")}</TableHead>
              <TableHead className="text-right">{t("sim.amount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {URSSAF_LINES.map((line) => (
              <TableRow key={line.key}>
                <TableCell className="font-medium">{t(`sim.lines.${line.key}`)}</TableCell>
                <TableCell className="num text-right text-muted-foreground">
                  {fmtRate(locale, line.rate)}
                </TableCell>
                <TableCell className="num text-right">
                  {fmtEur(locale, (amount * line.rate) / 100)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold">{t("sim.total")}</TableCell>
              <TableCell className="num text-right font-semibold">
                {fmtRate(locale, URSSAF_RATE)}
              </TableCell>
              <TableCell className="num text-right font-semibold">
                {fmtEur(locale, total)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-muted-foreground">{t("sim.net")}</TableCell>
              <TableCell />
              <TableCell className="num text-right font-medium text-success">
                {fmtEur(locale, amount - total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <p
        className={cn(
          "mt-3 flex items-center gap-1.5 text-[11px]",
          bare ? "sheet-ink" : "text-muted-foreground",
        )}
      >
        <Info className="size-3.5 shrink-0" aria-hidden />
        {t("sim.note")}
      </p>
    </section>
  );
}

export type Deadline = {
  date: string; // ISO — le 15 du mois suivant le trimestre
  quarter: number;
  year: number;
  status: "paid" | "next" | "upcoming";
  daysLeft?: number;
};

export function DeadlinesTimeline({
  deadlines,
  bare = false,
}: {
  deadlines: Deadline[];
  /** Dans une feuille teintée : le titre vient du `SheetHeading`. */
  bare?: boolean;
}) {
  const t = useTranslations("urssaf");
  const locale = useLocale();

  return (
    <section className={bare ? "min-w-0" : "bg-card rounded-xl border p-5"}>
      {!bare && (
        <>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarCheck className="text-muted-foreground size-4" aria-hidden />
            {t("deadlines.heading")}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">{t("deadlines.sub")}</p>
        </>
      )}

      <div className={cn("min-w-0 overflow-x-auto pb-1", bare ? "mt-3" : "mt-5")}>
        <div className="relative grid min-w-[600px] grid-cols-5">
          <span
            aria-hidden
            className="absolute left-[10%] right-[10%] top-[5px] h-px bg-border"
          />
          {deadlines.map((d) => (
            <div key={d.date} className="relative flex flex-col items-center gap-1.5 text-center">
              <span
                aria-hidden
                className={cn(
                  "z-10 flex size-[11px] items-center justify-center rounded-full",
                  d.status === "paid" && "bg-success",
                  d.status === "next" && "bg-brand ring-4 ring-brand/20",
                  d.status === "upcoming" &&
                    (bare
                      ? "border-border border-2 bg-[var(--sheet-paper)]"
                      : "border-border bg-card border-2"),
                )}
              />
              <span className="num text-xs font-medium">
                {fmtDate(locale, d.date, { day: "numeric", month: "short", year: "2-digit" })}
              </span>
              <span
                className={cn(
                  "num text-[11px]",
                  bare ? "sheet-ink" : "text-muted-foreground",
                )}
              >
                {t("deadlines.quarter", { q: d.quarter, year: d.year })}
              </span>
              {d.status === "paid" && (
                <Badge variant="outline" className="border-transparent bg-success/10 text-success">
                  <Check aria-hidden />
                  {t("deadlines.paid")}
                </Badge>
              )}
              {d.status === "next" && (
                <Badge className="num bg-brand text-brand-foreground">
                  {t("deadlines.next", { days: d.daysLeft ?? 0 })}
                </Badge>
              )}
              {d.status === "upcoming" && (
                <Badge variant="outline" className="text-muted-foreground">
                  {t("deadlines.upcoming")}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * La déclaration pré-remplie — une bande, pas une carte : c'est une action, pas
 * un bloc de données. Le libellé des mois est calculé par l'appelant à partir
 * du trimestre réellement concerné : il était écrit en dur dans les traductions
 * et continuait d'annoncer « avril – juin » un trimestre plus tard.
 */
export function DeclarationBand({
  declarantName,
  quarterLabel,
  monthsLabel,
  quarterlyDeclarable,
}: {
  declarantName: string;
  quarterLabel: string;
  /** « juillet – septembre 2026 », déduit du trimestre déclaré. */
  monthsLabel: string;
  quarterlyDeclarable: number;
}) {
  const t = useTranslations("urssaf");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const contributions = (quarterlyDeclarable * URSSAF_RATE) / 100;

  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-xl border px-4.5 py-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
          <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <b className="font-semibold">{t("declaration.title")}</b>
          <Badge variant="outline" className="bg-brand/10 text-brand border-transparent">
            {tCommon("actions.beta")}
          </Badge>
        </p>
        <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-relaxed">
          {t("declaration.band")}
        </p>
      </div>

      <div className="shrink-0">
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">
              <FileText aria-hidden />
              {t("declaration.cta")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("declaration.dialogTitle", { quarter: quarterLabel })}
              </DialogTitle>
              <DialogDescription>{t("declaration.dialogSub")}</DialogDescription>
            </DialogHeader>
            <dl className="divide-y rounded-lg border">
              <div className="flex items-center justify-between gap-4 p-3">
                <dt className="text-xs text-muted-foreground">
                  {t("declaration.rows.declarant")}
                </dt>
                <dd className="text-sm font-medium">{declarantName}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 p-3">
                <dt className="text-xs text-muted-foreground">
                  {t("declaration.rows.period")}
                </dt>
                <dd className="num text-sm font-medium">
                  {t("declaration.periodValue", {
                    quarter: quarterLabel,
                    months: monthsLabel,
                  })}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 p-3">
                <dt className="text-xs text-muted-foreground">
                  {t("declaration.rows.declarable")}
                </dt>
                <dd className="num text-sm font-semibold">
                  {fmtEur(locale, quarterlyDeclarable)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 p-3">
                <dt className="text-xs text-muted-foreground">
                  {t("declaration.rows.contributions", {
                    rate: fmtRate(locale, URSSAF_RATE),
                  })}
                </dt>
                <dd className="num text-sm font-semibold text-brand">
                  {fmtEur(locale, contributions)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 p-3">
                <dt className="text-xs text-muted-foreground">
                  {t("declaration.rows.net")}
                </dt>
                <dd className="num text-sm font-semibold text-success">
                  {fmtEur(locale, quarterlyDeclarable - contributions)}
                </dd>
              </div>
            </dl>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button className="w-full">
                <Download aria-hidden />
                {t("declaration.download")}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                {t("declaration.disclaimer")}
              </p>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
