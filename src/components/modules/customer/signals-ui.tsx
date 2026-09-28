"use client";

/**
 * Briques des pages « Marché & signaux » du mode client : fraîcheur d'une source
 * (journal de la collecte), mouvement dans un classement, et bloc « ce qu'il
 * manque » — une page dit ce qu'elle attend plutôt que d'inventer un chiffre.
 */
import { ArrowDown, ArrowUp, Minus, Sparkles } from "lucide-react";
import { Sheet, SheetHeading, type SheetFamily } from "@/components/dashboard/sheet";
import { partialNote, sourceFreshness, type SourceRun } from "@/lib/collect/freshness";
import type { Movement } from "@/lib/market/charts";
import { cn } from "@/lib/utils";

export const SOURCE_LABEL: Record<string, string> = {
  apple_music: "Classements Apple Music",
  tiktok_oembed: "Fiches des vidéos TikTok",
  wikipedia: "Vues Wikipédia",
  ecb_fx: "Taux de change BCE",
};

export const parisDateTime = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
export const longDate = (d: string, locale: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** « Classements Apple Music · relevés le 29 septembre à 06:02 » (+ retard ou échec, dits franchement). */
export function SourceLine({ source, runs, locale, className }: { source: string; runs: SourceRun[]; locale: string; className?: string }) {
  const f = sourceFreshness(runs, source);
  return (
    <p className={cn("text-muted-foreground text-xs", className)}>
      {SOURCE_LABEL[source] ?? source} ·{" "}
      {f.lastSuccess ? <>mis à jour automatiquement le {parisDateTime(f.lastSuccess.started_at, locale)}</> : <>pas encore mis à jour</>}
      {f.lastSuccess?.status === "partial" ? <> ({partialNote(source, f.lastSuccess.detail)})</> : null}
      {f.failing ? <span className="text-destructive"> · dernier essai en échec le {parisDateTime(f.failing.started_at, locale)}</span> : null}
      {f.stale && f.lastSuccess && !f.failing ? <span className="text-destructive"> · en retard</span> : null}
    </p>
  );
}

export function MovementBadge({ m }: { m: Movement | undefined }) {
  if (!m || m.kind === "unknown") return <span className="text-muted-foreground text-xs">—</span>;
  if (m.kind === "new")
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <Sparkles className="size-3" aria-hidden /> entrée
      </span>
    );
  if (m.kind === "same") return <Minus className="text-muted-foreground size-3.5" aria-label="stable" />;
  const up = m.kind === "up";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", up ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
      {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      {m.by}
      <span className="sr-only">{up ? " places gagnées" : " places perdues"}</span>
    </span>
  );
}

/** Ce que la page attend pour se remplir : la source, et qui doit faire quoi. */
export function Needs({ family, title, children }: { family: SheetFamily; title: string; children: React.ReactNode }) {
  return (
    <Sheet family={family}>
      <SheetHeading>{title}</SheetHeading>
      <div className="grid gap-2 text-sm leading-relaxed">{children}</div>
    </Sheet>
  );
}
