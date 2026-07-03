"use client";

/**
 * Carte split d'un titre : barre segmentée des parts, ayants droit,
 * relance de signature (démo) et dialog de détail.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BellRing, Check, Clock, FileText } from "lucide-react";
import type { Project, SplitShare, Track, TrackSplit } from "@/lib/demo/types";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Clés i18n (sans accents) pour les rôles du modèle de données. */
const ROLE_KEYS: Record<SplitShare["role"], string> = {
  auteur: "author",
  compositeur: "composer",
  interprète: "performer",
  producteur: "producer",
  feat: "feat",
};

export function shareColor(index: number): string {
  return `var(--chart-${(index % 5) + 1})`;
}

export function SplitStatusBadge({ status }: { status: TrackSplit["status"] }) {
  const t = useTranslations("splits");
  const styles: Record<TrackSplit["status"], string> = {
    signed: "bg-success/10 text-success",
    pending: "bg-warning/10 text-warning",
    draft: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("border-transparent", styles[status])}>
      {status === "signed" ? (
        <Check aria-hidden />
      ) : status === "pending" ? (
        <Clock aria-hidden />
      ) : (
        <FileText aria-hidden />
      )}
      {t(`status.${status}`)}
    </Badge>
  );
}

export function SplitBar({ shares }: { shares: SplitShare[] }) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {shares.map((s, i) => (
        <div
          key={`${s.name}-${i}`}
          className={cn("h-full", !s.signed && "opacity-40")}
          style={{ width: `${s.share}%`, background: shareColor(i) }}
        />
      ))}
    </div>
  );
}

export function SplitTrackCard({
  track,
  project,
  split,
}: {
  track: Track;
  project: Project;
  split: TrackSplit;
}) {
  const t = useTranslations("splits");
  const locale = useLocale();
  const [reminded, setReminded] = useState(false);
  const hasPending = split.shares.some((s) => !s.signed);

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{track.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {project.title} · {project.year}
          </p>
        </div>
        <SplitStatusBadge status={split.status} />
      </div>

      <SplitBar shares={split.shares} />

      <ul className="flex flex-col gap-1.5">
        {split.shares.map((s, i) => (
          <li key={`${s.name}-${i}`} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: shareColor(i) }}
            />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{s.name}</span>{" "}
              <span className="text-muted-foreground">
                · {t(`roles.${ROLE_KEYS[s.role]}`)}
              </span>
            </span>
            {s.signed ? (
              <Check className="size-3.5 text-success" aria-hidden />
            ) : (
              <Clock className="size-3.5 text-warning" aria-hidden />
            )}
            <span className="num w-10 text-right font-medium">{s.share} %</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-[11px] text-muted-foreground">
          {t("card.updatedAt", { date: fmtDate(locale, split.updatedAt) })}
        </span>
        <div className="flex items-center gap-1.5">
          {hasPending && (
            <Button
              size="sm"
              variant="outline"
              disabled={reminded}
              onClick={() => setReminded(true)}
            >
              {reminded ? <Check aria-hidden /> : <BellRing aria-hidden />}
              {reminded ? t("card.reminded") : t("card.remind")}
            </Button>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost">
                {t("card.detail")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("dialog.title", { track: track.title })}</DialogTitle>
                <DialogDescription>
                  {t("dialog.description", {
                    project: project.title,
                    isrc: track.isrc,
                  })}
                </DialogDescription>
              </DialogHeader>
              <SplitBar shares={split.shares} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dialog.holder")}</TableHead>
                    <TableHead>{t("dialog.role")}</TableHead>
                    <TableHead className="text-right">{t("dialog.share")}</TableHead>
                    <TableHead className="text-right">{t("dialog.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {split.shares.map((s, i) => (
                    <TableRow key={`${s.name}-${i}`}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2 rounded-full"
                            style={{ background: shareColor(i) }}
                          />
                          {s.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t(`roles.${ROLE_KEYS[s.role]}`)}
                      </TableCell>
                      <TableCell className="num text-right">{s.share} %</TableCell>
                      <TableCell className="text-right">
                        {s.signed ? (
                          <span className="inline-flex items-center gap-1 text-xs text-success">
                            <Check className="size-3.5" aria-hidden />
                            {t("status.signed")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-warning">
                            <Clock className="size-3.5" aria-hidden />
                            {t("status.pending")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium">{t("dialog.total")}</TableCell>
                    <TableCell />
                    <TableCell className="num text-right font-semibold">
                      {split.shares.reduce((s, x) => s + x.share, 0)} %
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
