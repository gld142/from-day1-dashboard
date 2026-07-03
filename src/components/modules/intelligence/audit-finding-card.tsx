"use client";

/**
 * Carte d'écart d'audit + Dialog de lettre pré-rédigée.
 * Le feature killer : chaque écart détecté devient une lettre prête à envoyer.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy, Download, FileText, ScanSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { DEMO_TODAY } from "@/lib/demo/seed";
import type { AuditFinding } from "@/lib/demo/types";
import { fmtDate, fmtEur, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AuditFindingCard({
  finding,
  artistName,
}: {
  finding: AuditFinding;
  artistName: string;
}) {
  const t = useTranslations("audit");
  const locale = useLocale();
  const [letterGenerated, setLetterGenerated] = useState(
    finding.status === "letter-generated",
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const gap = finding.expected - finding.reported;
  const confidencePct = Math.round(finding.confidence * 100);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{finding.source}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("finding.period", { period: finding.period })}
          </p>
        </div>
        {letterGenerated ? (
          <Badge className="shrink-0 bg-success/10 text-success">
            <FileText className="size-3" aria-hidden />
            {t("status.letterGenerated")}
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 text-muted-foreground">
            {t("status.open")}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{t("finding.expected")}</p>
          <p className="num mt-0.5 text-sm font-semibold">
            {fmtEur(locale, finding.expected)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{t("finding.reported")}</p>
          <p className="num mt-0.5 text-sm font-semibold text-muted-foreground">
            {fmtEur(locale, finding.reported)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{t("finding.gap")}</p>
          <p className="num mt-0.5 text-sm font-semibold text-destructive">
            −{fmtEur(locale, gap)}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ScanSearch className="size-3" aria-hidden />
            {t("finding.confidence")}
          </span>
          <span className="num font-medium text-foreground">{confidencePct} %</span>
        </div>
        <Progress value={confidencePct} className="h-1.5" />
      </div>

      <div className="mt-auto flex items-center gap-2">
        {letterGenerated ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setDialogOpen(true)}
          >
            <FileText className="size-3.5" aria-hidden />
            {t("finding.viewLetter")}
          </Button>
        ) : (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setLetterGenerated(true);
              setDialogOpen(true);
            }}
          >
            <FileText className="size-3.5" aria-hidden />
            {t("finding.generateLetter")}
          </Button>
        )}
      </div>

      <LetterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        finding={finding}
        artistName={artistName}
      />
    </div>
  );
}

function LetterDialog({
  open,
  onOpenChange,
  finding,
  artistName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finding: AuditFinding;
  artistName: string;
}) {
  const t = useTranslations("audit");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  const gap = finding.expected - finding.reported;

  const paragraphs = useMemo(() => {
    const values = {
      source: finding.source,
      period: finding.period,
      expected: fmtEur(locale, finding.expected),
      reported: fmtEur(locale, finding.reported),
      gap: fmtEur(locale, gap),
      confidence: `${Math.round(finding.confidence * 100)} %`,
      artist: artistName,
      date: fmtDate(locale, DEMO_TODAY.toISOString()),
    };
    return {
      date: t("letter.date", values),
      to: t("letter.to", values),
      subject: t("letter.subject", values),
      greeting: t("letter.greeting"),
      body: [t("letter.body1", values), t("letter.body2", values), t("letter.body3", values)],
      signoff: t("letter.signoff"),
      signature: t("letter.signature", values),
    };
  }, [t, locale, finding, artistName, gap]);

  const fullText = [
    paragraphs.date,
    paragraphs.to,
    paragraphs.subject,
    "",
    paragraphs.greeting,
    "",
    ...paragraphs.body.flatMap((p) => [p, ""]),
    paragraphs.signoff,
    "",
    paragraphs.signature,
  ].join("\n");

  const copyLetter = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard indisponible en démo */
    }
  };

  const downloadLetter = () => {
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${finding.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">{t("letter.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("letter.dialogSubtitle")}</DialogDescription>
        </DialogHeader>

        {/* Cadre document — la lettre elle-même */}
        <div className="rounded-lg border bg-surface-2/60 p-6">
          <div className="font-heading text-sm leading-relaxed">
            <p className="text-right text-muted-foreground">{paragraphs.date}</p>
            <p className="mt-4 font-medium">{paragraphs.to}</p>
            <p className="mt-4 font-semibold">{paragraphs.subject}</p>
            <p className="mt-5">{paragraphs.greeting}</p>
            {paragraphs.body.map((p, i) => (
              <p key={i} className="mt-3 text-foreground/90">
                {p}
              </p>
            ))}
            <p className="mt-3">{paragraphs.signoff}</p>
            <p className="mt-5 font-medium">{paragraphs.signature}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5", copied && "text-success")}
            onClick={copyLetter}
          >
            {copied ? (
              <Check className="size-3.5" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
            {copied ? t("letter.copied") : t("letter.copy")}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={downloadLetter}>
            <Download className="size-3.5" aria-hidden />
            {t("letter.download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
