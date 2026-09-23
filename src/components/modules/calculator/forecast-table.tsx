"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtEur, fmtMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ForecastRow = {
  month: string;
  low: number;
  projected: number;
  high: number;
};

/**
 * Détail mensuel projeté : bas / médian / haut, aligné droite.
 * `bare` le pose dans une feuille teintée, sans le padding de carte.
 */
export function ForecastTable({
  rows,
  bare = false,
}: {
  rows: ForecastRow[];
  bare?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("calculator.table");

  return (
    <div className="max-h-80 min-w-0 overflow-y-auto">
      <Table>
        <TableHeader
          className={
            bare ? "sticky top-0 bg-[var(--sheet-paper)]" : "sticky top-0 bg-card"
          }
        >
          <TableRow className="hover:bg-transparent">
            <TableHead className={bare ? undefined : "pl-5"}>{t("month")}</TableHead>
            <TableHead className="text-right">{t("low")}</TableHead>
            <TableHead className="text-right">{t("projected")}</TableHead>
            <TableHead className={cn("text-right", !bare && "pr-5")}>{t("high")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.month}>
              <TableCell className={cn("num whitespace-nowrap text-xs text-muted-foreground", !bare && "pl-5")}>
                {fmtMonth(locale, r.month)}
              </TableCell>
              <TableCell className="num text-right text-muted-foreground">
                {fmtEur(locale, r.low)}
              </TableCell>
              <TableCell className="num text-right font-medium">
                {fmtEur(locale, r.projected)}
              </TableCell>
              <TableCell className={cn("num text-right text-muted-foreground", !bare && "pr-5")}>
                {fmtEur(locale, r.high)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
