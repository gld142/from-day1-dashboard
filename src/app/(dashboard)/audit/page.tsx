"use client";

/**
 * /audit — l'écart entre ce que les streams devraient rapporter et ce qui est
 * déclaré. Refondue le 23/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Le héros s'appelait « montant récupérable détecté » et le seul démenti —
 * « estimations du modèle, pas des créances certaines » — vivait quinze cents
 * pixels plus bas, en onze pixels. Un écart n'est pas une créance : la page le
 * dit maintenant sous le chiffre, et l'attendu porte sa provenance.
 *
 * Le chiffre reste rouge, parce qu'il appelle une action ; il n'est plus
 * présenté comme de l'argent acquis.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { AuditFindingCard } from "@/components/modules/intelligence/audit-finding-card";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { ARTISTS, auditFindings, getArtist } from "@/lib/demo/api";
import type { Artist, AuditFinding } from "@/lib/demo/types";
import { fmtEur } from "@/lib/format";
import { useRole } from "@/lib/role";

type Group = { artist: Artist; findings: AuditFinding[]; gap: number };

export default function AuditPage() {
  const t = useTranslations("audit");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { artistId, focusedArtistId, isLabel } = useRole();

  const isRoster = isLabel && focusedArtistId === null;
  const focusedArtist = isLabel && focusedArtistId ? getArtist(focusedArtistId) : null;

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

  const facts = useMemo(() => {
    const all = groups.flatMap((g) => g.findings);
    const gap = all.reduce((s, f) => s + (f.expected - f.reported), 0);
    const expected = all.reduce((s, f) => s + f.expected, 0);
    const reported = all.reduce((s, f) => s + f.reported, 0);
    const confidences = all.map((f) => f.confidence);
    const biggest = all.reduce<AuditFinding | null>(
      (b, f) => (!b || f.expected - f.reported > b.expected - b.reported ? f : b),
      null,
    );
    const periods = Array.from(new Set(all.map((f) => f.period))).sort();
    return {
      all,
      gap,
      expected,
      reported,
      sourceCount: new Set(all.map((f) => f.source)).size,
      avgConfidence:
        confidences.length === 0
          ? 0
          : confidences.reduce((s, c) => s + c, 0) / confidences.length,
      lowConfidence: confidences.length === 0 ? 0 : Math.min(...confidences),
      biggest,
      from: periods[0] ?? null,
      to: periods[periods.length - 1] ?? null,
    };
  }, [groups]);

  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });
  const pct = (unit: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(unit);
  const gapPct = facts.expected === 0 ? 0 : (facts.gap / facts.expected) * 100;

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={isRoster ? t("subtitleLabel") : t("subtitle")}
      >
        {focusedArtist && <ArtistBadge artist={focusedArtist} meta={focusedArtist.genre} />}
      </PageHeader>

      {facts.all.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-1 rounded-xl border border-dashed">
          <ShieldCheck className="text-success mb-1 size-6" aria-hidden />
          <p className="text-sm font-medium">{t("empty.title")}</p>
          <p className="text-muted-foreground text-xs">{t("empty.hint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* L'écart, et ce qu'il n'est pas. */}
          <Sheet family="money">
            <SheetHeading>
              {isRoster ? t("hero.titleLabel") : t("hero.title")}
            </SheetHeading>
            <p className="text-destructive text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
              {eur(facts.gap)}
            </p>
            <p className="sheet-ink mt-1.5 text-[13px]">
              {t("hero.caption")}{" "}
              <ProvenanceBadge provenance="estimated" className="align-middle" />
            </p>

            {/* Ce qui est déclaré, et ce qui manque, sur la même base. */}
            <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full"
                style={{
                  width: `${100 - gapPct}%`,
                  background: "color-mix(in oklab, var(--sheet-line) 55%, transparent)",
                }}
                title={`${t("hero.barReported")} · ${eur(facts.reported)}`}
              />
              <div
                className="h-full"
                style={{ width: `${gapPct}%`, background: "var(--destructive)" }}
                title={`${t("hero.barGap")} · ${eur(facts.gap)}`}
              />
            </div>
            <p className="sheet-ink mt-1 flex flex-wrap justify-between gap-x-4 text-[11px]">
              <span>
                {t("hero.barReported")} {eur(facts.reported)}
              </span>
              <span>{t("hero.expectedTotal", { amount: eur(facts.expected) })}</span>
            </p>

            {/* Le démenti est sous le chiffre, pas au pied de la page. */}
            <p className="sheet-ink mt-2 text-[11.5px] leading-relaxed">
              {t("hero.notClaim")}
            </p>

            <AffiliatedPoints
              points={[
                {
                  key: "findings",
                  value: String(facts.all.length),
                  label: t("kpis.findings"),
                  note: t("kpis.findingsHint", { count: facts.sourceCount }),
                },
                {
                  key: "confidence",
                  value: pct(facts.avgConfidence),
                  label: t("kpis.confidence"),
                  note: t("kpis.confidenceHint", { low: pct(facts.lowConfidence) }),
                },
                {
                  key: "biggest",
                  value: facts.biggest
                    ? eur(facts.biggest.expected - facts.biggest.reported)
                    : "—",
                  label: t("kpis.biggest"),
                  note: facts.biggest
                    ? t("kpis.biggestHint", {
                        source: facts.biggest.source,
                        period: facts.biggest.period,
                      })
                    : undefined,
                },
                isRoster
                  ? {
                      key: "artists",
                      value: String(groups.length),
                      label: t("kpis.artists"),
                      note: t("kpis.artistsHint", { total: ARTISTS.length }),
                    }
                  : {
                      key: "window",
                      value:
                        facts.from && facts.to
                          ? facts.from === facts.to
                            ? facts.from
                            : t("kpis.windowHint", { from: facts.from, to: facts.to })
                          : "—",
                      label: t("kpis.window"),
                      note: t("kpis.windowNote"),
                    },
              ]}
            />
          </Sheet>

          {/* Un écart, une lettre. */}
          <section className="mt-1">
            <h2 className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
              {t("findingsHeading")}
            </h2>
            <div className="flex flex-col gap-5">
              {groups.map((g) => (
                <div key={g.artist.id}>
                  {isRoster && (
                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                      <ArtistBadge
                        artist={g.artist}
                        meta={t("hero.findings", { count: g.findings.length })}
                      />
                      <span className="num text-destructive text-sm font-semibold">
                        {t("label.artistTotal", { amount: fmtEur(locale, g.gap) })}
                      </span>
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {g.findings.map((f) => (
                      <AuditFindingCard
                        key={f.id}
                        finding={f}
                        artistName={g.artist.name}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* La règle du calcul, repliée : on la lit une fois. */}
          <Sheet family="money">
            <details className="text-[11.5px] leading-relaxed">
              <summary className="sheet-ink cursor-pointer font-medium">
                {t("method.title")}
              </summary>
              <p className="text-muted-foreground mt-2">{t("method.subtitle")}</p>
              <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                {(["step1", "step2", "step3", "step4"] as const).map((step) => (
                  <div key={step}>
                    <p className="text-[12px] font-semibold">{t(`method.${step}Title`)}</p>
                    <p className="text-muted-foreground mt-0.5">
                      {t(`method.${step}Desc`)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground mt-3">{t("method.disclaimer")}</p>
            </details>
          </Sheet>

          <Doors
            title={tc("blocks.doors")}
            doors={[
              {
                key: "import",
                family: "money",
                href: "/import",
                label: t("doors.import"),
                value: t("doors.importValue"),
              },
              {
                key: "rights",
                family: "money",
                href: "/rights",
                label: t("doors.rights"),
                value: t("doors.rightsValue"),
              },
              {
                key: "contracts",
                family: "money",
                href: "/contracts",
                label: t("doors.contracts"),
                value: t("doors.contractsValue"),
              },
              {
                key: "revenue",
                family: "money",
                href: "/revenue",
                label: t("doors.revenue"),
                value: t("doors.revenueValue"),
              },
              {
                key: "splits",
                family: "money",
                href: "/splits",
                label: t("doors.splits"),
                value: t("doors.splitsValue"),
              },
              {
                key: "streams",
                family: "streams",
                href: "/streams",
                label: t("doors.streams"),
                value: t("doors.streamsValue"),
              },
            ]}
          />
          <p className="text-muted-foreground mt-2 text-[11.5px]">
            {tc("blocks.legend")}
          </p>
        </div>
      )}
    </div>
  );
}
