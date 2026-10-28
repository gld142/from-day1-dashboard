"use client";

/**
 * « Day One a repéré » en tête du fil : ce que les données disent déjà (écart d'audit, échéance
 * de contrat, chute de streams), rédigé, adressé, daté, lié. Un clic le pose dans le fil ; un
 * autre l'écarte. Logique : feed-detect.ts.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, BadgeEuro, ChevronDown, FileSignature, Sparkles, TrendingDown, X } from "lucide-react";
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
  /* Replié par défaut : une ligne, pour laisser la place aux urgences ; un clic déplie. */
  const [open, setOpen] = useState(false);
  if (signals.length === 0) return null;
  return (
    <section aria-labelledby="fil-detect" className="bg-card rounded-lg border px-3 py-2">
      <h3 id="fil-detect" className={cn("flex flex-wrap items-center gap-2", open && "mb-2")}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 flex-wrap items-center gap-2 text-left"
        >
          <span className="text-foreground inline-flex items-center gap-1.5 text-[13px] font-semibold">
            <Sparkles className="text-brand size-3.5" aria-hidden />
            {tp("detect.title")}
            <span className="text-muted-foreground font-normal tabular-nums">{signals.length}</span>
          </span>
          <span className="text-muted-foreground text-[12px]">{open ? tp("detect.hint") : tp("detect.summary", { count: signals.length })}</span>
          <span className="text-foreground/80 ml-auto inline-flex items-center gap-1 text-[12px] font-medium">
            {open ? tp("detect.hide") : tp("detect.show")}
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
          </span>
        </button>
      </h3>
      {open && (
      <ul className="divide-border/70 -mx-3 divide-y border-t">
        {signals.map((s) => {
          const Icon = KIND_ICON[s.kind];
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-[13px]"
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
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-[12px]" onClick={() => onPost(s)}>
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
      )}
    </section>
  );
}
