"use client";

/**
 * /placements — Œuvres & placements.
 *
 * La page d'un auteur-compositeur. Tout le reste du dashboard raconte ce que
 * rapportent LES STREAMS D'UN ARTISTE ; ici on raconte ce que rapportent LES
 * ŒUVRES QU'IL A ÉCRITES POUR D'AUTRES — ce n'est pas la même économie, et
 * ça ne se lit nulle part ailleurs.
 *
 * Trois choses qu'aucune autre page ne dit :
 *   · le carnet de commandes (œuvres signées, pas encore sorties) ;
 *   · les œuvres non déclarées, et l'argent qu'elles ne vont pas chercher ;
 *   · le partage entre droits d'édition et points de production.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { ARTISTS, isComposer, placementFacts, placementMoney } from "@/lib/demo/api";
import { fmtCompact, fmtDate, fmtEur } from "@/lib/format";
import { useRole } from "@/lib/role";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Badge } from "@/components/ui/badge";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";

export default function PlacementsPage() {
  const t = useTranslations("placements");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { artistId, isLabel, focusedArtistId, setFocusedArtistId } = useRole();

  /* Les auteurs-compositeurs du roster : la page n'a de sens que pour eux. */
  const composers = useMemo(() => ARTISTS.filter((a) => isComposer(a.id)), []);
  const composer = isComposer(artistId) ? artistId : null;

  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });

  const facts = useMemo(() => (composer ? placementFacts(composer) : null), [composer]);
  const lignes = useMemo(() => (composer ? placementMoney(composer) : []), [composer]);

  /* Ni l'artiste courant ni le zoom ne portent d'œuvres : on le dit, et on
     donne le chemin plutôt qu'une page vide. */
  if (!composer || !facts) {
    return (
      <div className="rise-in">
        <PageHeader title={t("title")} subtitle={t("subtitleEmpty")} />
        <Sheet family="money">
          <SheetHeading>{t("empty.title")}</SheetHeading>
          <p className="sheet-ink mt-1 text-[13px]">{t("empty.body")}</p>
          {composers.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {composers.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setFocusedArtistId(a.id)}
                    className="border-border hover:border-ring rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
                  >
                    {t("empty.open", { name: a.name })}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      </div>
    );
  }

  const released = lignes.filter((l) => l.placement.status === "released");
  const pipeline = lignes
    .filter((l) => l.placement.status !== "released")
    .sort((a, b) => a.placement.date.localeCompare(b.placement.date));
  const undeclared = released.filter((l) => !l.placement.declared);

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        {isLabel && focusedArtistId && (
          <ArtistBadge artist={ARTISTS.find((a) => a.id === composer)!} size="sm" />
        )}
      </PageHeader>

      <div className="space-y-3">
        {/* Ce que les œuvres rapportent, et d'où ça vient. */}
        <Sheet family="money">
          <SheetHeading action={t("hero.caption")}>{t("hero.title")}</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
            {eur(facts.earned)}
          </p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {t("hero.sub", {
              works: facts.released,
              streams: fmtCompact(locale, facts.streams),
            })}{" "}
            <ProvenanceBadge provenance="estimated" className="align-middle" />
          </p>
          <AffiliatedPoints
            points={[
              {
                key: "publishing",
                value: eur(facts.publishing),
                label: t("points.publishing"),
                note: facts.publisher
                  ? t("points.publishingNote", {
                      name: facts.publisher.name,
                      pct: facts.publisher.sharePct,
                    })
                  : t("points.publishingSelf"),
              },
              {
                key: "producer",
                value: eur(facts.producer),
                label: t("points.producer"),
                note: t("points.producerNote"),
              },
              {
                key: "pipeline",
                value: String(facts.unreleased),
                label: t("points.pipeline"),
                note: facts.next
                  ? t("points.pipelineNote", {
                      title: facts.next.title,
                      date: fmtDate(locale, facts.next.date, {
                        day: "numeric",
                        month: "short",
                      }),
                    })
                  : t("points.pipelineNone"),
              },
              {
                key: "pitched",
                value: String(facts.pitched),
                label: t("points.pitched"),
                note: t("points.pitchedNote"),
              },
            ]}
          />
        </Sheet>

        {/* L'argent qu'on laisse par terre : une œuvre non déposée ne peut pas
            être payée, et rien d'autre dans le dashboard ne le signale. */}
        {undeclared.length > 0 && (
          <Sheet family="money">
            <SheetHeading action={t("undeclared.caption")}>
              {t("undeclared.title")}
            </SheetHeading>
            <p className="text-warning text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
              {eur(facts.undeclaredAtStake)}
            </p>
            <p className="sheet-ink mt-1.5 text-[13px]">
              {t("undeclared.sub", { count: undeclared.length })}
            </p>
            <ul className="sheet-rule mt-3 space-y-1.5 pt-2.5 text-[12.5px]">
              {undeclared.map((l) => (
                <li
                  key={l.placement.id}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="min-w-0 truncate">
                    <b className="font-medium">{l.placement.title}</b>{" "}
                    <span className="text-muted-foreground">
                      · {l.placement.performer}
                    </span>
                  </span>
                  <span className="num shrink-0 tabular-nums">{eur(l.publishing)}</span>
                </li>
              ))}
            </ul>
          </Sheet>
        )}

        {/* Le carnet de commandes : signé mais pas sorti. */}
        {pipeline.length > 0 && (
          <Sheet family="catalog">
            <SheetHeading action={t("pipeline.caption")}>
              {t("pipeline.title")}
            </SheetHeading>
            <ul className="mt-2 space-y-2.5">
              {pipeline.map((l) => (
                <li
                  key={l.placement.id}
                  className="flex min-w-0 items-baseline justify-between gap-3 text-[13px]"
                >
                  <span className="min-w-0">
                    <b className="font-medium">{l.placement.title}</b>{" "}
                    <span className="text-muted-foreground">
                      · {l.placement.performer}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className="sheet-ink num tabular-nums">
                      {fmtDate(locale, l.placement.date, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <Badge
                      variant="outline"
                      className="h-5 border-transparent bg-[color-mix(in_oklab,var(--sheet-line)_22%,transparent)] text-[10px] uppercase"
                    >
                      {t(`status.${l.placement.status}`)}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 text-[11.5px]">
              {t("pipeline.legend")}
            </p>
          </Sheet>
        )}

        {/* Le détail, œuvre par œuvre. */}
        <Sheet family="money">
          <SheetHeading action={t("table.caption")}>{t("table.title")}</SheetHeading>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead className="sheet-ink">
                <tr className="sheet-rule text-left">
                  <th className="pb-2 font-medium">{t("table.work")}</th>
                  <th className="pb-2 font-medium">{t("table.performer")}</th>
                  <th className="pb-2 font-medium">{t("table.roles")}</th>
                  <th className="pb-2 text-right font-medium">{t("table.share")}</th>
                  <th className="pb-2 text-right font-medium">{t("table.streams")}</th>
                  <th className="pb-2 text-right font-medium">{t("table.net")}</th>
                  <th className="pb-2 text-right font-medium">{t("table.declared")}</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.placement.id} className="border-line/40 border-t">
                    <td className="max-w-[180px] truncate py-2 font-medium">
                      {l.placement.title}
                    </td>
                    <td className="text-muted-foreground max-w-[140px] truncate py-2">
                      {l.placement.performer}
                    </td>
                    <td className="text-muted-foreground py-2">
                      {l.placement.roles.map((r) => t(`roles.${r}`)).join(" · ")}
                    </td>
                    <td className="num py-2 text-right tabular-nums">
                      {l.placement.writerSharePct} %
                      {l.placement.producerPointsPct > 0 && (
                        <span className="text-muted-foreground">
                          {" "}
                          + {l.placement.producerPointsPct} pts
                        </span>
                      )}
                    </td>
                    <td className="num py-2 text-right tabular-nums">
                      {l.placement.streams > 0
                        ? fmtCompact(locale, l.placement.streams)
                        : "—"}
                    </td>
                    <td className="num py-2 text-right font-medium tabular-nums">
                      {l.net > 0 ? eur(l.net) : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {l.placement.status !== "released" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : l.placement.declared ? (
                        <span className="text-success">{t("table.yes")}</span>
                      ) : (
                        <span className="text-warning">{t("table.no")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-3 text-[11.5px] leading-relaxed">
            {t("table.method")}
          </p>
        </Sheet>

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "rights",
              family: "money",
              href: "/rights",
              label: t("doors.rights"),
              value: t("doors.rightsValue"),
            },
            {
              key: "splits",
              family: "money",
              href: "/splits",
              label: t("doors.splits"),
              value: t("doors.splitsValue"),
            },
            {
              key: "catalog",
              family: "catalog",
              href: "/catalog",
              label: t("doors.catalog"),
              value: t("doors.catalogValue"),
            },
            {
              key: "sync",
              family: "money",
              href: "/sync",
              label: t("doors.sync"),
              value: t("doors.syncValue"),
            },
          ]}
        />

        <p className="text-muted-foreground mt-2 text-[11.5px]">
          <Link href="/audit" className="text-brand hover:underline">
            {tc("blocks.legend")}
          </Link>
        </p>
      </div>
    </div>
  );
}
