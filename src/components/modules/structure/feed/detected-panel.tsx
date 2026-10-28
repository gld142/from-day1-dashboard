"use client";

/**
 * « Day One a repéré » en tête du fil : ce que les données disent déjà (écart d'audit, échéance
 * de contrat, chute de streams), rédigé, adressé, daté, lié. Un clic le pose dans le fil ; un
 * autre l'écarte. Logique : feed-detect.ts.
 */
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, BadgeEuro, FileSignature, Sparkles, TrendingDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getArtist } from "@/lib/demo/data";
import { fmtCompact, fmtDate, fmtEur, fmtPct } from "@/lib/format";
import type { Signal } from "@/lib/userdata/feed-detect";
import { cn } from "@/lib/utils";
import { roleLabel } from "./labels";

const KIND_ICON = { audit: BadgeEuro, contract: FileSignature, clause: FileSignature, streams: TrendingDown } as const;

/** Le texte du signal, tel qu'il sera posé dans la note (dans la langue de l'action). */
export function useSignalText() {
  const tp = useTranslations("filpage");
  const locale = useLocale();
  return (s: Signal) => {
    const artist = getArtist(s.artistId).name;
    switch (s.kind) {
      case "audit":
        return tp("detect.audit", { artist, amount: fmtEur(locale, s.amount ?? 0), source: s.source ?? "—", period: s.period ?? "—" });
      case "contract":
      case "clause":
        return tp(`detect.${s.kind}`, { artist, message: s.message?.[locale === "en" ? "en" : "fr"] ?? "" });
      case "streams":
        return tp("detect.streams", { artist, pct: fmtPct(locale, s.pct ?? 0), amount: fmtCompact(locale, s.amount ?? 0) });
    }
  };
}

export function DetectedPanel({
  signals,
  onPost,
  onDismiss,
}: {
  signals: Signal[];
  onPost: (s: Signal) => void;
  onDismiss: (s: Signal) => void;
}) {
  const tp = useTranslations("filpage");
  const tf = useTranslations("fil");
  const locale = useLocale();
  const text = useSignalText();
  if (signals.length === 0) return null;
  return (
    <section aria-labelledby="fil-detect" className="border-brand/30 bg-brand/[0.04] rounded-xl border border-dashed p-2.5">
      <h3 id="fil-detect" className="mb-2 flex flex-wrap items-center gap-2 px-0.5">
        <span className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase">
          <Sparkles className="size-3" aria-hidden />
          {tp("detect.title")}
          <span className="tabular-nums">{signals.length}</span>
        </span>
        <span className="text-muted-foreground text-[12px]">{tp("detect.hint")}</span>
      </h3>
      <ul className="space-y-1.5">
        {signals.map((s) => {
          const Icon = KIND_ICON[s.kind];
          return (
            <li
              key={s.id}
              className="bg-card flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2 text-[13px]"
            >
              <Icon
                className={cn("size-4 shrink-0", s.urgency === "urgent" ? "text-destructive" : s.urgency === "important" ? "text-warning" : "text-brand")}
                aria-hidden
              />
              <span className="min-w-0 flex-1 leading-snug">{text(s)}</span>
              {s.dueDate && (
                <span className="text-muted-foreground text-[12px] tabular-nums">
                  {fmtDate(locale, s.dueDate, { day: "numeric", month: "short" })}
                </span>
              )}
              <span className="text-muted-foreground inline-flex items-center gap-1 text-[12px]">
                <ArrowRight className="size-3" aria-hidden />
                {s.to.map((r) => roleLabel(tf, r)).join(", ")}
              </span>
              <span className="flex items-center gap-1">
                <Button size="sm" className="h-7 px-2.5 text-[12px]" onClick={() => onPost(s)}>
                  {tp("detect.post")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground h-7 px-1.5"
                  onClick={() => onDismiss(s)}
                  aria-label={tp("detect.dismiss")}
                  title={tp("detect.dismiss")}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
