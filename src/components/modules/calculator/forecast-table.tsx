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

export type ForecastRow = {
  month: string;
  low: number;
  projected: number;
  high: number;
};

/** Détail mensuel projeté : bas / médian / haut, aligné droite. */
export function ForecastTable({ rows }: { rows: ForecastRow[] }) {
  const locale = useLocale();
  const t = useTranslations("calculator.table");

  return (
    <div className="max-h-80 overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-5">{t("month")}</TableHead>
            <TableHead className="text-right">{t("low")}</TableHead>
            <TableHead className="text-right">{t("projected")}</TableHead>
            <TableHead className="pr-5 text-right">{t("high")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.month}>
              <TableCell className="num whitespace-nowrap pl-5 text-xs text-muted-foreground">
                {fmtMonth(locale, r.month)}
              </TableCell>
              <TableCell className="num text-right text-muted-foreground">
                {fmtEur(locale, r.low)}
              </TableCell>
              <TableCell className="num text-right font-medium">
                {fmtEur(locale, r.projected)}
              </TableCell>
              <TableCell className="num pr-5 text-right text-muted-foreground">
                {fmtEur(locale, r.high)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
