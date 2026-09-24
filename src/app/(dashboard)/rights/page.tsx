"use client";

/**
 * /rights — droits d'auteur & droits voisins FR (SACEM, ADAMI, SPEDIDAM, SPRE).
 * Refondue le 23/09. Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * La page répond à « qu'est-ce que les organismes m'ont versé, et qu'est-ce
 * qui manque ». Le reçu sur douze mois se pose au centre de la comparaison
 * attendu/reçu trimestre par trimestre.
 *
 * L'écart ne se développe pas ici : il a sa page (/audit). Le bandeau d'alerte
 * qui l'annonçait en gros devient un point affilié et une porte chiffrée — la
 * règle des portes d'entrée, tenue comme partout ailleurs.
 *
 * Chaque chiffre porte sa provenance : l'attendu vient de l'estimateur (part
 * auteur de l'édition sur le brut master — « estimé »), le reçu est un relevé
 * simulé pour la démo (« simulé ») tant qu'aucun vrai relevé de répartition
 * n'est importé ; les écarts comparent l'un à l'autre.
 */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ARTISTS,
  LABEL,
  RIGHTS_PERIODS,
  getArtist,
  rightsStatements,
} from "@/lib/demo/api";
import { DEMO_TODAY } from "@/lib/demo/seed";
import type { Provenance, RightsOrganism, RightsStatement } from "@/lib/demo/types";
import { fmtDate, fmtEur } from "@/lib/format";
import { weakest } from "@/lib/real";
import { useRole } from "@/lib/role";
import { ROSTER_SCOPE } from "@/lib/userdata/rights-store";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  AffiliatedPoints,
  CenteredValue,
  Sheet,
  SheetHeading,
} from "@/components/dashboard/sheet";
import {
  ArtistRightsBreakdown,
  ORGANISM_ORDER,
  OrganismCard,
  PaymentsTimeline,
  parsePeriod,
  type ArtistRightsRow,
  type RightsRow,
  type ScheduledPayment,
} from "@/components/modules/droits/rights-widgets";
import { StatementsPanel } from "@/components/modules/droits/statements-panel";
import { Doors } from "@/components/modules/pilotage/pulse-blocks";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

const PERIODS = RIGHTS_PERIODS;
const LAST_4 = new Set(PERIODS.slice(-4));

/** Calendrier des répartitions à venir (déterministe, relatif à DEMO_TODAY). */
const SCHEDULE: Array<Omit<ScheduledPayment, "estimated">> = [
  { organism: "spre", date: "2026-09-30", frequency: "semiannual" },
  { organism: "sacem", date: "2026-10-05", frequency: "quarterly" },
  { organism: "adami", date: "2026-12-15", frequency: "semiannual" },
  { organism: "spedidam", date: "2026-12-20", frequency: "semiannual" },
  { organism: "sacem", date: "2027-01-05", frequency: "quarterly" },
  { organism: "adami", date: "2027-06-15", frequency: "semiannual" },
];

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
} as const;

export default function RightsPage() {
  const t = useTranslations("rights");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { isLabel, artistId, focusedArtistId, setFocusedArtistId } = useRole();
  const grouped = isLabel && !focusedArtistId;
  const scope = grouped ? "roster" : "artist";
  const artistName = getArtist(artistId).name;

  /**
   * Les relevés du périmètre, à plat. Source UNIQUE de l'agrégat (organisme,
   * période) et de la ventilation par artiste : les deux ne peuvent donc pas
   * être cadrés sur des fenêtres différentes.
   */
  const statements = useMemo<RightsStatement[]>(() => {
    const ids = grouped ? ARTISTS.map((a) => a.id) : [artistId];
    return ids.flatMap((id) => rightsStatements(id));
  }, [grouped, artistId]);

  /** Relevés agrégés par (organisme, période) sur le périmètre courant. */
  const rows = useMemo<RightsRow[]>(() => {
    const map = new Map<string, RightsRow>();
    for (const s of statements) {
      const key = `${s.organism}:${s.period}`;
      const cur =
        map.get(key) ??
        ({
          organism: s.organism,
          period: s.period,
          expected: 0,
          received: 0,
          status: "received" as RightsStatement["status"],
          expectedProvenance: s.expectedProvenance ?? "simulated",
          receivedProvenance: s.receivedProvenance ?? "simulated",
        } satisfies RightsRow);
      cur.expected += s.expected;
      cur.received += s.received;
      // Plusieurs artistes agrégés : la provenance la plus faible l'emporte.
      cur.expectedProvenance = weakest([
        cur.expectedProvenance,
        s.expectedProvenance ?? "simulated",
      ]);
      cur.receivedProvenance = weakest([
        cur.receivedProvenance,
        s.receivedProvenance ?? "simulated",
      ]);
      if (s.status === "gap-detected") cur.status = "gap-detected";
      else if (s.status === "pending" && cur.status !== "gap-detected")
        cur.status = "pending";
      map.set(key, cur);
    }
    return Array.from(map.values());
  }, [statements]);

  const facts = useMemo(() => {
    const received12m = rows
      .filter((r) => LAST_4.has(r.period))
      .reduce((s, r) => s + r.received, 0);
    const expectedPending = rows
      .filter((r) => r.status === "pending")
      .reduce((s, r) => s + r.expected, 0);
    const gapRows = rows.filter((r) => r.status === "gap-detected");
    const gapTotal = gapRows.reduce(
      (s, r) => s + Math.max(0, r.expected - r.received),
      0,
    );

    /* Qui verse le plus, sur la même fenêtre que le chiffre du centre. */
    const byOrg = new Map<RightsOrganism, number>();
    for (const r of rows) {
      if (!LAST_4.has(r.period)) continue;
      byOrg.set(r.organism, (byOrg.get(r.organism) ?? 0) + r.received);
    }
    const top = Array.from(byOrg.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;

    return {
      received12m,
      expectedPending,
      gapTotal,
      gapCount: gapRows.length,
      top: top ? { organism: top[0], amount: top[1] } : null,
    };
  }, [rows]);

  /**
   * Ventilation par artiste — vue structure agrégée uniquement.
   *
   * Construite sur `statements`, donc sur EXACTEMENT les mêmes relevés que
   * l'agrégat (organisme, période) : même roster, mêmes six trimestres. Deux
   * contrôles le vérifient à l'écran — la somme des attendus « en cours » vaut
   * le point affilié « Attendu (en cours) », et l'écart d'un artiste vaut
   * l'écart que la page affiche quand on zoome sur lui.
   *
   * L'écart se compte relevé par relevé (attendu − reçu sur les relevés en
   * écart), comme sur la page zoomée et comme dans /audit : un montant qu'on
   * peut aller réclamer, pas un résidu d'agrégation.
   */
  const byArtist = useMemo<ArtistRightsRow[]>(() => {
    if (!grouped) return [];
    const map = new Map<string, ArtistRightsRow>();
    const gapByOrg = new Map<string, Map<RightsOrganism, number>>();
    for (const s of statements) {
      const cur =
        map.get(s.artistId) ??
        ({
          artist: getArtist(s.artistId),
          expected: 0,
          received: 0,
          gap: 0,
          gapCount: 0,
          gapByOrganism: [],
          pending: 0,
          expectedProvenance: s.expectedProvenance ?? "simulated",
          receivedProvenance: s.receivedProvenance ?? "simulated",
        } satisfies ArtistRightsRow);
      cur.expected += s.expected;
      cur.received += s.received;
      if (s.status === "pending") cur.pending += s.expected;
      if (s.status === "gap-detected") {
        const gap = Math.max(0, s.expected - s.received);
        cur.gap += gap;
        cur.gapCount += 1;
        const orgs = gapByOrg.get(s.artistId) ?? new Map<RightsOrganism, number>();
        orgs.set(s.organism, (orgs.get(s.organism) ?? 0) + gap);
        gapByOrg.set(s.artistId, orgs);
      }
      // Un artiste peut mélanger des provenances : la plus faible l'emporte.
      cur.expectedProvenance = weakest([
        cur.expectedProvenance,
        s.expectedProvenance ?? "simulated",
      ]);
      cur.receivedProvenance = weakest([
        cur.receivedProvenance,
        s.receivedProvenance ?? "simulated",
      ]);
      map.set(s.artistId, cur);
    }
    for (const [id, row] of map) {
      row.gapByOrganism = Array.from(gapByOrg.get(id) ?? [])
        .map(([organism, amount]) => ({ organism, amount }))
        .sort((a, b) => b.amount - a.amount);
    }
    // Trié par écart décroissant : ce qu'on va chercher en premier.
    return Array.from(map.values()).sort(
      (a, b) => b.gap - a.gap || b.expected - a.expected,
    );
  }, [grouped, statements]);

  /** Provenance affichée : la plus faible du périmètre (sans relevé : simulé). */
  const provenance = useMemo<{ expected: Provenance; received: Provenance }>(
    () => ({
      expected: weakest(rows.map((r) => r.expectedProvenance)),
      received: weakest(rows.map((r) => r.receivedProvenance)),
    }),
    [rows],
  );

  const payments = useMemo<ScheduledPayment[]>(() => {
    const pendingByOrg = new Map<RightsOrganism, number>();
    for (const r of rows) {
      if (r.status === "pending") {
        pendingByOrg.set(r.organism, (pendingByOrg.get(r.organism) ?? 0) + r.expected);
      }
    }
    return SCHEDULE.map((p) => ({
      ...p,
      estimated: pendingByOrg.get(p.organism) ?? 0,
    }));
  }, [rows]);

  /** Le prochain versement programmé après aujourd'hui. */
  const next = useMemo(
    () => payments.find((p) => new Date(p.date).getTime() >= DEMO_TODAY.getTime()) ?? null,
    [payments],
  );

  const chartData = useMemo(
    () =>
      PERIODS.map((period) => {
        const p = parsePeriod(period);
        const inPeriod = rows.filter((r) => r.period === period);
        return {
          period: t("periodShort", { q: p.q, year: p.year }),
          expected: inPeriod.reduce((s, r) => s + r.expected, 0),
          received: inPeriod.reduce((s, r) => s + r.received, 0),
        };
      }),
    [rows, t],
  );

  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });
  const pct = (points: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(points / 100);

  /** Les bornes de la fenêtre, lues sur PERIODS — celles du graphique. */
  const windowLabel = useMemo(() => {
    const first = parsePeriod(PERIODS[0]);
    const last = parsePeriod(PERIODS[PERIODS.length - 1]);
    return {
      from: t("periodShort", { q: first.q, year: first.year }),
      to: t("periodShort", { q: last.q, year: last.year }),
    };
  }, [t]);

  const seriesName: Record<string, string> = {
    expected: t("chart.expected", { provenance: provenance.expected }),
    received: t("chart.received", { provenance: provenance.received }),
  };

  return (
    <div className="rise-in">
      <PageHeader
        title={t("title")}
        subtitle={
          isLabel ? t("subtitleLabel", { scope, name: artistName }) : t("subtitle")
        }
      />

      <div className="space-y-3">
        {/* Ce qui est tombé, trimestre par trimestre, face à ce qu'on attendait. */}
        <Sheet family="money">
          <SheetHeading action={t("chart.heading")}>{t("hero.title")}</SheetHeading>
          <div className="group relative">
            <CenteredValue
              value={eur(facts.received12m)}
              caption={
                <>
                  {t("hero.caption")}{" "}
                  <ProvenanceBadge
                    provenance={provenance.received}
                    className="align-middle"
                  />
                  <span className="mt-0.5 block opacity-80">{t("hero.window")}</span>
                </>
              }
            />
            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 22, right: 4, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} strokeOpacity={0.12} />
                  <XAxis
                    dataKey="period"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--sheet-ink)" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--sheet-ink)" }}
                    width={52}
                    tickFormatter={(v: number) => fmtEur(locale, v, { compact: true })}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => [
                      fmtEur(locale, Number(value ?? 0)),
                      seriesName[String(name)] ?? String(name),
                    ]}
                  />
                  <Bar
                    dataKey="expected"
                    name="expected"
                    fill="var(--chart-2)"
                    fillOpacity={0.45}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="received"
                    name="received"
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="sheet-ink mt-1.5 flex flex-wrap items-center gap-4 text-[11.5px]">
            {(
              [
                ["expected", "var(--chart-2)", 0.45],
                ["received", "var(--chart-1)", 1],
              ] as const
            ).map(([key, color, opacity]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: color, opacity }}
                />
                {seriesName[key]}
              </span>
            ))}
          </div>

          <AffiliatedPoints
            points={[
              {
                key: "expected",
                value: eur(facts.expectedPending),
                label: t("kpis.expected"),
                note: t("kpis.pendingPeriod"),
              },
              {
                key: "gap",
                value: (
                  <span className={facts.gapTotal > 0 ? "text-warning" : undefined}>
                    {facts.gapTotal > 0 ? eur(facts.gapTotal) : "—"}
                  </span>
                ),
                label: t("kpis.gaps"),
                note:
                  facts.gapCount > 0
                    ? t("kpis.gapsHint", { count: facts.gapCount })
                    : t("kpis.gapsNone"),
              },
              {
                key: "next",
                value: next ? fmtDate(locale, next.date) : "—",
                label: t("kpis.nextPayment"),
                note: next
                  ? t("kpis.nextHint", {
                      organism: next.organism.toUpperCase(),
                      frequency: t(`timeline.frequency.${next.frequency}`),
                    })
                  : t("kpis.nextNone"),
              },
              {
                key: "top",
                value: facts.top ? facts.top.organism.toUpperCase() : "—",
                label: t("kpis.topOrganism"),
                note: facts.top
                  ? t("kpis.topOrganismHint", {
                      amount: eur(facts.top.amount),
                      share: pct(
                        facts.received12m === 0
                          ? 0
                          : (facts.top.amount / facts.received12m) * 100,
                      ),
                    })
                  : undefined,
              },
            ]}
          />
        </Sheet>

        {/* Qui porte quoi dans l'agrégat ci-dessus — vue structure seulement. */}
        {byArtist.length > 0 && (
          <Sheet family="money" testId="rights-by-artist">
            <SheetHeading action={t("byArtist.window", windowLabel)}>
              {t("byArtist.heading")}
            </SheetHeading>
            <ArtistRightsBreakdown rows={byArtist} onSelect={setFocusedArtistId} />
          </Sheet>
        )}

        {/* Le reçu est simulé : voici comment passer au vrai. */}
        <StatementsPanel
          scopeId={grouped ? ROSTER_SCOPE : artistId}
          scope={scope}
          name={artistName}
          signer={isLabel ? LABEL.name : artistName}
        />

        {/* Le détail par organisme : ce que chacun couvre, et ses périodes. */}
        <Sheet family="money">
          <SheetHeading>{t("organismsHeading")}</SheetHeading>
          <div className="mt-1 grid gap-4 xl:grid-cols-2">
            {ORGANISM_ORDER.map((organism) => {
              const orgRows = rows
                .filter((r) => r.organism === organism)
                .sort((a, b) => a.period.localeCompare(b.period));
              const received12m = orgRows
                .filter((r) => LAST_4.has(r.period))
                .reduce((s, r) => s + r.received, 0);
              return (
                <OrganismCard
                  key={organism}
                  organism={organism}
                  rows={orgRows}
                  received12m={received12m}
                  receivedProvenance={provenance.received}
                  bare
                />
              );
            })}
          </div>
        </Sheet>

        {/* Ce qui tombe ensuite. */}
        <Sheet family="money">
          <SheetHeading action={t("timeline.sub")}>{t("timeline.heading")}</SheetHeading>
          <PaymentsTimeline payments={payments} bare />
        </Sheet>

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "audit",
              family: "money",
              href: "/audit",
              label: t("doors.audit"),
              urgent: facts.gapTotal > 0,
              value:
                facts.gapTotal > 0
                  ? t("doors.auditValue", { amount: eur(facts.gapTotal) })
                  : t("doors.auditValueNone"),
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
              key: "contracts",
              family: "money",
              href: "/contracts",
              label: t("doors.contracts"),
              value: t("doors.contractsValue"),
            },
            {
              key: "catalog",
              family: "catalog",
              href: "/catalog",
              label: t("doors.catalog"),
              value: t("doors.catalogValue"),
            },
            {
              key: "urssaf",
              family: "money",
              href: "/urssaf",
              label: t("doors.urssaf"),
              value: t("doors.urssafValue"),
            },
          ]}
        />
        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}
