"use client";

/**
 * /placements — Œuvres & placements.
 *
 * Pour une maison d'édition, la page dit l'ACTIVITÉ du roster : qui a placé quoi, chez qui, et où
 * ça en est (Gaël, 28/10/2026). Un seul suivi pour tout le roster (`PlacementsTracker`) : vues
 * écrites (nouveautés, en cours, signées, sorties, à déclarer), recherche, année, tri ; l'étape se
 * pose à la main, chaque changement est daté et signé, et peut prévenir le fil entre services.
 * L'état suivi alimente les montants : déclarer une œuvre la retire de « Non déclaré » ici et sur Pulse.
 *
 * Zoom sur un compositeur : ce que ses œuvres placées lui rapportent (estimé), puis ses placements.
 * Zoom sur un auteur-interprète : ses placements chez d'autres ; ses droits d'auteur sur SES titres
 * restent sur Revenus (un lien, pas un second chiffre).
 */
import { CustomerPlacements } from "@/components/modules/customer/customer-placements";
import { useCustomer } from "@/lib/customer-mode";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { ARTISTS, getArtist, isComposer, isWriter, ownWorksFacts, placementFacts } from "@/lib/demo/api";
import { getDa } from "@/lib/demo/das";
import { fmtCompact, fmtEur } from "@/lib/format";
import { useRole } from "@/lib/role";
import { getActivity, getTrackedPlacements } from "@/lib/userdata/placements-store";
import { useScopedRoster } from "@/lib/userdata/use-org";
import { usePlacementsSnapshot } from "@/lib/userdata/use-placements";
import { useSharesSnapshot } from "@/lib/userdata/use-shares";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
import { PlacementsActivity, PlacementsTracker } from "@/components/modules/structure/placements-tracker";

/** Mode client : le registre saisi dans l'espace ; sinon la démo, intacte. */
export default function PlacementsPage() {
  return useCustomer() ? <CustomerPlacements /> : <DemoPlacementsPage />;
}

function DemoPlacementsPage() {
  const t = useTranslations("placements");
  const tc = useTranslations("common");
  const tf = useTranslations("fil");
  const locale = useLocale();
  const { artistId, isLabel, focusedArtistId, setFocusedArtistId, jobRole, daId, scopeDaId } = useRole();
  const roster = useScopedRoster(scopeDaId);
  const placementsKey = usePlacementsSnapshot();
  const sharesKey = useSharesSnapshot();

  const grouped = isLabel && !focusedArtistId;
  const focus = grouped ? null : artistId;
  const focusArtist = focus ? getArtist(focus) : null;

  /* Qui agit, figé dans l'historique et dans le fil (comme l'auteur d'une note). */
  const actor = jobRole
    ? jobRole === "da" && daId
      ? `${tf("roles.da")} · ${getDa(daId)?.name ?? ""}`.trim()
      : tf(`roles.${jobRole}`)
    : tf("roles.direction");

  const all = useMemo(() => {
    void placementsKey;
    return getTrackedPlacements();
  }, [placementsKey]);
  const events = useMemo(() => {
    void placementsKey;
    return getActivity();
  }, [placementsKey]);

  const inScope = useMemo(() => {
    if (focus) return all.filter((p) => p.artistId === focus);
    const ids = new Set(roster.map((a) => a.id));
    return all.filter((p) => ids.has(p.artistId));
  }, [all, focus, roster]);
  const byId = useMemo(() => new Map(inScope.map((p) => [p.id, p])), [inScope]);

  const writers = useMemo(
    () => (focusArtist ? [focusArtist] : roster.filter((a) => isWriter(a.id))),
    [focusArtist, roster],
  );
  const composers = useMemo(() => ARTISTS.filter((a) => isComposer(a.id)), []);

  /* Zoom compositeur : ce que ses œuvres placées lui rapportent (suit les étapes posées à la main). */
  const facts = useMemo(() => {
    void placementsKey;
    return focus && isComposer(focus) ? placementFacts(focus) : null;
  }, [focus, placementsKey]);
  /* Zoom auteur-interprète : le chiffre de Revenus, en une ligne et un lien. */
  const own = useMemo(() => {
    void sharesKey;
    return focus && !isComposer(focus) && isWriter(focus) ? ownWorksFacts(focus) : null;
  }, [focus, sharesKey]);

  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });

  /* Maison sans édition (day1) : un interprète n'a pas d'œuvres à suivre ici. */
  if (focus && !isWriter(focus)) {
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

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitleTracker")}>
        {isLabel && focusArtist && <ArtistBadge artist={focusArtist} size="sm" />}
      </PageHeader>

      <div className="space-y-3">
        {facts && (
          <Sheet family="money">
            <SheetHeading action={t("hero.caption")}>{t("hero.title")}</SheetHeading>
            <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{eur(facts.earned)}</p>
            <p className="sheet-ink mt-1.5 text-[13px]">
              {t("hero.sub", { works: facts.released, streams: fmtCompact(locale, facts.streams) })}{" "}
              <ProvenanceBadge provenance="estimated" className="align-middle" />
            </p>
            <AffiliatedPoints
              points={[
                {
                  key: "publishing",
                  value: eur(facts.publishing),
                  label: t("points.publishing"),
                  note: facts.publisher
                    ? t("points.publishingNote", { name: facts.publisher.name, pct: facts.publisher.sharePct })
                    : t("points.publishingSelf"),
                },
                { key: "producer", value: eur(facts.producer), label: t("points.producer"), note: t("points.producerNote") },
                {
                  key: "undeclared",
                  value: eur(facts.undeclaredAtStake),
                  label: t("points.undeclared"),
                  note: t("points.undeclaredNote", { count: facts.undeclared }),
                },
              ]}
            />
          </Sheet>
        )}

        {own && focusArtist && (
          <p className="text-muted-foreground text-[13px]">
            {t("ownLine", { name: focusArtist.name, amount: eur(own.publishing) })}{" "}
            <ProvenanceBadge provenance={own.provenance} className="align-middle" />{" "}
            <Link href="/revenue" className="text-foreground font-medium underline-offset-4 hover:underline">
              {t("ownLink")}
            </Link>
          </p>
        )}

        <PlacementsTracker
          placements={inScope}
          artistOf={getArtist}
          writers={writers}
          showAuthor={!focus}
          actor={actor}
          jobRole={jobRole}
          footer={
            <>
              {focusArtist && inScope.length === 0 && <span className="text-foreground/80 block">{t("noneFor", { name: focusArtist.name })}</span>}
              {t("table.provenance")} {t("tracker.saveNote")}
            </>
          }
        />

        <PlacementsActivity events={events} byId={byId} artistOf={getArtist} />

        <Doors
          title={tc("blocks.doors")}
          doors={[
            { key: "rights", family: "money", href: "/rights", label: t("doors.rights"), value: t("doors.rightsValue") },
            { key: "splits", family: "money", href: "/splits", label: t("doors.splits"), value: t("doors.splitsValue") },
            { key: "catalog", family: "catalog", href: "/catalog", label: t("doors.catalog"), value: t("doors.catalogValue") },
            { key: "sync", family: "money", href: "/sync", label: t("doors.sync"), value: t("doors.syncValue") },
          ]}
        />
      </div>
    </div>
  );
}
