"use client";

/**
 * /audit — Audit royalties IA (feature killer).
 * Héro : montant total récupérable (NumberFlow + brand-glow).
 * Cards findings → lettre de vérification pré-rédigée en Dialog.
 */
import { useMemo } from "react";
import NumberFlow from "@number-flow/react";
import { useLocale, useTranslations } from "next-intl";
import {
  Database,
  FileText,
  GitCompareArrows,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { AuditFindingCard } from "@/components/modules/intelligence/audit-finding-card";
import { Badge } from "@/components/ui/badge";
import { ARTISTS, auditFindings, getArtist } from "@/lib/demo/api";
import type { Artist, AuditFinding } from "@/lib/demo/types";
import { fmtEur } from "@/lib/format";
import { useRole } from "@/lib/role";

type Group = { artist: Artist; findings: AuditFinding[]; gap: number };

export default function AuditPage() {
  const t = useTranslations("audit");
  const locale = useLocale();
  const { artistId, focusedArtistId, isLabel } = useRole();

  const isRoster = isLabel && focusedArtistId === null;

  const groups = useMemo<Group[]>(() => {
    const ids = isRoster ? ARTISTS.map((a) => a.id) : [artistId];
    return ids
      .map((id) => {
        const findings = auditFindings(id);
        return {
          artist: getArtist(id),
          findings,
          gap: findings.reduce((s, f) => s + (f.expected - f.reported), 0),
        };
      })
      .filter((g) => g.findings.length > 0)
      .sort((a, b) => b.gap - a.gap);
  }, [isRoster, artistId]);

  const allFindings = groups.flatMap((g) => g.findings);
  const totalGap = groups.reduce((s, g) => s + g.gap, 0);
  const avgConfidence =
    allFindings.length === 0
      ? 0
      : allFindings.reduce((s, f) => s + f.confidence, 0) / allFindings.length;
  const sourceCount = new Set(allFindings.map((f) => f.source)).size;

  const methodSteps = [
    { icon: Database, title: t("method.step1Title"), desc: t("method.step1Desc") },
    { icon: GitCompareArrows, title: t("method.step2Title"), desc: t("method.step2Desc") },
    { icon: ScanSearch, title: t("method.step3Title"), desc: t("method.step3Desc") },
    { icon: FileText, title: t("method.step4Title"), desc: t("method.step4Desc") },
  ];

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* ── Héro : montant récupérable ── */}
      <section className="brand-glow rounded-2xl border bg-gradient-to-b from-card to-surface-2 p-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {isRoster ? t("label.heroLabel") : t("hero.label")}
            </p>
            <p className="num mt-1 text-5xl font-semibold tracking-tight text-destructive">
              <NumberFlow
                value={totalGap}
                format={{
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                }}
                locales={locale}
              />
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{t("hero.scanned")}</p>
          </div>
          <div className="flex flex-col items-end gap-2 text-sm">
            <Badge variant="outline" className="num">
              {t("hero.findings", { count: allFindings.length })}
            </Badge>
            {isRoster && (
              <Badge variant="outline" className="num">
                {t("label.artistsWithFindings", { count: groups.length })}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {t("hero.avgConfidence")}{" "}
              <span className="num font-semibold text-foreground">
                {Math.round(avgConfidence * 100)} %
              </span>
            </span>
            <span className="num text-xs text-muted-foreground">
              {t("hero.sources", { count: sourceCount })}
            </span>
          </div>
        </div>
      </section>

      {/* ── Findings ── */}
      {allFindings.length === 0 ? (
        <div className="mt-6 flex h-48 flex-col items-center justify-center gap-1 rounded-xl border border-dashed">
          <ShieldCheck className="mb-1 size-6 text-success" aria-hidden />
          <p className="text-sm font-medium">{t("empty.title")}</p>
          <p className="text-xs text-muted-foreground">{t("empty.hint")}</p>
        </div>
      ) : isRoster ? (
        <div className="mt-8 space-y-8">
          {groups.map((g) => (
            <section key={g.artist.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <ArtistBadge
                  artist={g.artist}
                  meta={t("hero.findings", { count: g.findings.length })}
                />
                <span className="num text-sm font-semibold text-destructive">
                  {t("label.artistTotal", { amount: fmtEur(locale, g.gap) })}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {g.findings.map((f) => (
                  <AuditFindingCard key={f.id} finding={f} artistName={g.artist.name} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups[0]?.findings.map((f) => (
            <AuditFindingCard
              key={f.id}
              finding={f}
              artistName={groups[0].artist.name}
            />
          ))}
        </div>
      )}

      {/* ── Méthode ── */}
      <section className="mt-8 rounded-xl border bg-card p-5">
        <h2 className="font-heading text-base font-semibold">{t("method.title")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("method.subtitle")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {methodSteps.map((step, i) => (
            <div key={i} className="rounded-lg border bg-surface-2/50 p-4">
              <span className="flex size-8 items-center justify-center rounded-md bg-brand/10 text-brand">
                <step.icon className="size-4" aria-hidden />
              </span>
              <p className="mt-3 text-sm font-medium">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">
          {t("method.disclaimer")}
        </p>
      </section>
    </div>
  );
}
