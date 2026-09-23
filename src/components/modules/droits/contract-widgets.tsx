"use client";

/**
 * Widgets contrats : la ligne d'alerte, le tableau des contrats, et les trois
 * étapes d'une avance.
 *
 * La carte d'alerte est devenue une ligne : une alerte tient en une phrase et
 * une date, et huit cartes côte à côte donnaient à un rappel d'échéance le
 * poids visuel d'un bloc de données.
 *
 * L'ancienne « visualisation du recoupement » affichait avance, recoupé et
 * reste pour un seul contrat — les mêmes chiffres que le héros de la page, et
 * la même barre. Il n'en reste que ce qu'elle seule disait : les trois étapes.
 */
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarClock,
  FileSearch,
  Flag,
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

/** La sévérité se lit sur l'icône : elle n'a pas besoin d'un fond de plus. */
const SEVERITY_INK: Record<ContractAlert["severity"], string> = {
  info: "text-brand",
  warning: "text-warning",
  danger: "text-destructive",
};

const KIND_ICONS: Record<
  ContractAlert["kind"],
  React.ComponentType<{ className?: string }>
> = {
  expiry: CalendarClock,
  option: Flag,
  "audit-window": FileSearch,
  "unusual-clause": ShieldAlert,
};

/** Une alerte : son icône, ce qu'elle est, ce qu'elle dit, et pour quand. */
export function AlertRow({
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
  const Icon = KIND_ICONS[alert.kind];
  const message = alert.message[locale === "fr" ? "fr" : "en"];

  return (
    <div className="border-border/50 flex items-start gap-3 border-t py-2.5 first:border-t-0">
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", SEVERITY_INK[alert.severity])}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug">
          <b className="font-semibold">{t(`alerts.kinds.${alert.kind}`)}</b>
          <span className="sheet-ink"> — {message}</span>
        </p>
        <p className="sheet-ink mt-0.5 text-[11px]">
          {t(`types.${contract.type === "édition" ? "edition" : contract.type}`)} ·{" "}
          {contract.counterparty}
          {alert.dueDate && (
            <>
              {" · "}
              <span
                className={cn(
                  "font-medium",
                  alert.severity === "danger" && "text-destructive",
                )}
              >
                {t("alerts.due", { date: fmtDate(locale, alert.dueDate) })}
              </span>
            </>
          )}
        </p>
      </div>
      {artist && <ArtistBadge artist={artist} size="sm" className="shrink-0" />}
    </div>
  );
}

export function ContractsTable({
  contracts,
  todayIso,
  bare = false,
}: {
  contracts: Contract[];
  todayIso: string;
  /** Dans une feuille teintée : pas de carte, pas de padding de bord. */
  bare?: boolean;
}) {
  const t = useTranslations("contracts");
  const locale = useLocale();

  return (
    <div className={cn("min-w-0 overflow-x-auto", bare && "mt-1")}>
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
                        className="bg-destructive/10 text-destructive border-transparent"
                      >
                        {t("badges.expired")}
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.counterparty}
                </TableCell>
                <TableCell className="num text-muted-foreground whitespace-nowrap">
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
                        c.recoupedPct >= 100 &&
                          "[&>[data-slot=progress-indicator]]:bg-success",
                      )}
                    />
                    <span className="num text-muted-foreground w-10 text-right text-xs">
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

/**
 * Les trois étapes d'une avance, sur le contrat le plus lourd du périmètre.
 * C'est de la pédagogie : elle se replie, parce qu'on ne la lit qu'une fois.
 */
export function RecoupmentSteps({ contract }: { contract: Contract }) {
  const t = useTranslations("contracts");
  const locale = useLocale();
  const recouped = Math.round((contract.advance * contract.recoupedPct) / 100);

  return (
    <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-3">
      {(
        [
          ["advance", { advance: fmtEur(locale, contract.advance) }],
          [
            "recoup",
            {
              rate: `${fmtInt(locale, contract.royaltyRate)} %`,
              recouped: fmtEur(locale, recouped),
            },
          ],
          ["payout", {}],
        ] as const
      ).map(([key, values]) => (
        <div key={key}>
          <p className="text-[12px] font-semibold">
            {t(`recoup.steps.${key}.title`)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-relaxed">
            {t(`recoup.steps.${key}.body`, values)}
          </p>
        </div>
      ))}
    </div>
  );
}
