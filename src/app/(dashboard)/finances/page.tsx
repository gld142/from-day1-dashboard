"use client";

/**
 * /finances — Dépenses & P&L. Refondue le 23/09.
 * Spec : docs/superpowers/specs/2026-09-22-pulse-refonte-design.md
 *
 * Ce que cette page dit et qu'aucune autre ne dit : **ce qu'il reste**. Revenus
 * appartient à /revenue et y vit sur 12 mois glissants ; ici la fenêtre est
 * l'année civile, et le revenu n'apparaît que comme terme d'une soustraction —
 * jamais comme un chiffre clé de plus.
 *
 * Deux périmètres, volontairement distincts :
 *  - le résultat net, sa marge et sa courbe portent sur **toute l'année** ;
 *  - le filtre de catégorie ne touche que le registre.
 * L'ancienne page filtrait les dépenses sans filtrer les revenus : choisir
 * « Studio » retirait toutes les autres dépenses du calcul et le « résultat
 * net » gonflait d'autant. Un chiffre qui s'améliore quand on filtre n'est pas
 * un résultat.
 */
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  AffiliatedPoints,
  CenteredValue,
  Sheet,
  SheetHeading,
  SheetSegments,
} from "@/components/dashboard/sheet";
import { AddExpenseDialog } from "@/components/modules/finances/add-expense-dialog";
import { CategoryDonut } from "@/components/modules/finances/category-donut";
import {
  ExpenseRegister,
  useExpenseLabel,
} from "@/components/modules/finances/expense-register";
import {
  PnlComparisons,
  type SpendRow,
  type YearPnlRow,
} from "@/components/modules/finances/pnl-comparisons";
import {
  PNL_SERIES,
  PnlMonthlyChart,
  type MonthlyPnlPoint,
} from "@/components/modules/finances/pnl-monthly-chart";
import { Doors, RestRow } from "@/components/modules/pilotage/pulse-blocks";
import { ExportMenu } from "@/components/modules/exports/export-menu";
import { PrintStyles } from "@/components/modules/exports/print-styles";
import { Button } from "@/components/ui/button";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ARTISTS,
  PROJECTS,
  TEAM,
  TRACKS,
  expenses as fetchExpenses,
  getArtist,
  monthlyRevenueTotals,
  monthsBasis,
} from "@/lib/demo/api";
import type { Expense, ExpenseCategory } from "@/lib/demo/types";
import { downloadCsv } from "@/lib/export";
import { fmtEur, fmtMonth, fmtMonthName, fmtPct } from "@/lib/format";
import { useRole } from "@/lib/role";

const ALL = "__all__";
const YEARS = [2025, 2026] as const;

export default function FinancesPage() {
  const locale = useLocale();
  const t = useTranslations("finances");
  const tc = useTranslations("common");
  /** Le CSV exporte ce que le tableau affiche : le même libellé traduit. */
  const expenseLabel = useExpenseLabel();
  const { artistId, focusedArtistId, isLabel } = useRole();

  const [year, setYear] = useState<number>(2026);
  /** Filtres du **registre seul** — jamais du résultat net. */
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [projectId, setProjectId] = useState<string>(ALL);
  /** Dépenses saisies à la main dans la session (préfixées au registre). */
  const [added, setAdded] = useState<Expense[]>([]);

  // Périmètre artistes : label sans zoom = tout le roster.
  const scopeAll = isLabel && !focusedArtistId;
  const artistIds = useMemo(
    () => (scopeAll ? ARTISTS.map((a) => a.id) : [artistId]),
    [scopeAll, artistId],
  );
  const focusedArtist = scopeAll ? null : getArtist(artistId);

  const projectOptions = useMemo(
    () => (scopeAll ? PROJECTS : PROJECTS.filter((p) => p.artistId === artistId)),
    [scopeAll, artistId],
  );

  /* ── Toutes les dépenses de l'année : la base de tout calcul ────────── */
  const yearExpenses = useMemo(() => {
    const base = fetchExpenses({
      artistId: scopeAll ? undefined : artistId,
      year,
    });
    const manual = added.filter(
      (e) => artistIds.includes(e.artistId) && e.date.startsWith(String(year)),
    );
    return [...manual, ...base];
  }, [scopeAll, artistId, artistIds, year, added]);

  /* ── Ce que le registre montre : l'année, vue par un bout ───────────── */
  const registerExpenses = useMemo(
    () =>
      yearExpenses.filter(
        (e) =>
          (category === null || e.category === category) &&
          (projectId === ALL || e.projectId === projectId),
      ),
    [yearExpenses, category, projectId],
  );

  const totalExpenses = useMemo(
    () => yearExpenses.reduce((s, e) => s + e.amount, 0),
    [yearExpenses],
  );

  /* ── Revenus et dépenses mois par mois, sur toute la profondeur ──────
   *
   * Les générateurs de démo produisent 24 mois : la fenêtre s'arrête en cours
   * d'année de l'autre côté. Une année de bord n'a donc que quelques mois de
   * données, et la comparer entière à une année pleine fabrique une chute qui
   * n'existe pas. On garde ici les deux cartes mensuelles complètes et on
   * découpe ensuite des périmètres comparables.
   *
   * On ne demande pas plus de 24 mois : le générateur consomme son RNG mois par
   * mois, si bien qu'élargir la fenêtre change aussi le passé. */
  const monthMaps = useMemo(() => {
    const rev = new Map<string, number>();
    for (const id of artistIds) {
      for (const m of monthlyRevenueTotals(id, 24)) {
        rev.set(m.month, (rev.get(m.month) ?? 0) + m.amount);
      }
    }
    const exp = new Map<string, number>();
    const all = [
      ...added.filter((e) => artistIds.includes(e.artistId)),
      ...fetchExpenses({ artistId: scopeAll ? undefined : artistId }),
    ];
    for (const e of all) {
      const mo = e.date.slice(0, 7);
      exp.set(mo, (exp.get(mo) ?? 0) + e.amount);
    }
    const months = Array.from(rev.keys()).sort();
    return {
      rev,
      exp,
      /** Le dernier mois de la série est en cours : il n'est jamais comparé. */
      current: months[months.length - 1] ?? null,
    };
  }, [artistIds, scopeAll, artistId, added]);

  /** Le même mois, l'année précédente. */
  const lastYearOf = (month: string) =>
    `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;

  /* ── La série de l'année affichée ───────────────────────────────────── */
  const monthly = useMemo<MonthlyPnlPoint[]>(() => {
    const months = Array.from(
      new Set([...monthMaps.rev.keys(), ...monthMaps.exp.keys()]),
    )
      .filter((m) => m.startsWith(String(year)))
      .sort();
    return months.map((month) => {
      const revenue = monthMaps.rev.get(month) ?? 0;
      const exp = monthMaps.exp.get(month) ?? 0;
      return { month, revenue, expenses: exp, net: revenue - exp };
    });
  }, [monthMaps, year]);

  const totalRevenueYear = monthly.reduce((s, m) => s + m.revenue, 0);
  const net = totalRevenueYear - totalExpenses;
  const margin = totalRevenueYear === 0 ? 0 : (net / totalRevenueYear) * 100;

  /* ── Le périmètre comparable : les mois complets présents des deux côtés ── */
  const span = useMemo(
    () =>
      monthly
        .map((m) => m.month)
        .filter((m) => m !== monthMaps.current && monthMaps.rev.has(lastYearOf(m))),
    [monthly, monthMaps],
  );

  const sumOver = (months: readonly string[], map: Map<string, number>) =>
    months.reduce((s, m) => s + (map.get(m) ?? 0), 0);

  const spanRows = useMemo<YearPnlRow[]>(() => {
    if (span.length === 0) return [];
    const row = (months: readonly string[], y: number): YearPnlRow => {
      const revenue = sumOver(months, monthMaps.rev);
      const expensesSum = sumOver(months, monthMaps.exp);
      return { year: y, revenue, expenses: expensesSum, net: revenue - expensesSum };
    };
    return [row(span.map(lastYearOf), year - 1), row(span, year)];
  }, [span, monthMaps, year]);

  const deltaPct = (cur: number, prev: number) =>
    prev === 0 ? undefined : ((cur - prev) / Math.abs(prev)) * 100;
  const prevSpan = spanRows[0];
  const curSpan = spanRows[1];
  const netDelta =
    prevSpan && curSpan ? deltaPct(curSpan.net, prevSpan.net) : undefined;
  const expensesDelta =
    prevSpan && curSpan ? deltaPct(curSpan.expenses, prevSpan.expenses) : undefined;

  /** « janv. → août » : le périmètre de comparaison, écrit en clair. Sans
   *  l'année, que la phrase qui l'entoure pose une seule fois. */
  const spanLabel =
    span.length === 0
      ? null
      : span.length === 1
        ? fmtMonthName(locale, span[0])
        : `${fmtMonthName(locale, span[0])} → ${fmtMonthName(locale, span[span.length - 1])}`;
  /** Le mois en cours, quand il tombe dans l'année affichée. */
  const partialMonth =
    monthMaps.current && monthMaps.current.startsWith(String(year))
      ? monthMaps.current
      : null;

  /* ── Sur quoi repose la comparaison d'année ─────────────────────────────
   *
   * « Résultat net 2026 · −56,9 % vs 2025 » se lit comme une chute constatée.
   * Elle ne l'est pas : les deux termes couvrent des mois antérieurs aux
   * relevés réels, donc un historique reconstitué puis converti en euros. Le
   * chiffre est fidèle à ce modèle — la page doit dire lequel. */
  const spanBasis = useMemo(
    () => (span.length === 0 ? null : monthsBasis(artistIds, [...span, ...span.map(lastYearOf)])),
    [span, artistIds],
  );
  /** Les mois comparés qui contiennent une vraie mesure, écrits en clair. */
  const measuredSpanLabel = spanBasis?.measuredMonths.length
    ? spanBasis.measuredMonths.map((m) => fmtMonth(locale, m)).join(", ")
    : null;

  /* ── Répartition par catégorie, sur l'année entière ─────────────────── */
  const byCategory = useMemo(() => {
    const acc = new Map<ExpenseCategory, number>();
    for (const e of yearExpenses) {
      acc.set(e.category, (acc.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(acc.entries())
      .map(([cat, amount]) => ({ category: cat, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [yearExpenses]);

  const heaviest = byCategory[0] ?? null;

  /** Le mois où il est le plus sorti d'argent — un total d'année ne se situe pas. */
  const worstMonth = useMemo(
    () =>
      monthly.reduce<MonthlyPnlPoint | null>(
        (b, m) => (!b || m.expenses > b.expenses ? m : b),
        null,
      ),
    [monthly],
  );

  /* ── Comparaisons par projet / titre, sur l'année entière ───────────── */
  const { byProject, byTrack } = useMemo(() => {
    const projTitle = new Map(PROJECTS.map((p) => [p.id, p.title]));
    const trkTitle = new Map(TRACKS.map((tr) => [tr.id, tr.title]));
    const proj = new Map<string, number>();
    const trk = new Map<string, number>();
    for (const e of yearExpenses) {
      if (e.projectId) proj.set(e.projectId, (proj.get(e.projectId) ?? 0) + e.amount);
      if (e.trackId) trk.set(e.trackId, (trk.get(e.trackId) ?? 0) + e.amount);
    }
    const toRows = (
      m: Map<string, number>,
      titles: Map<string, string>,
    ): SpendRow[] =>
      Array.from(m.entries())
        .map(([id, amount]) => ({ id, name: titles.get(id) ?? id, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);
    return {
      byProject: toRows(proj, projTitle),
      byTrack: toRows(trk, trkTitle),
    };
  }, [yearExpenses]);

  const wavelyCount = useMemo(
    () => yearExpenses.filter((e) => e.source === "wavely").length,
    [yearExpenses],
  );

  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });
  /** Une part, sans signe : « +5,6 % de marge » ne veut rien dire. */
  const pct = (points: number) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(points / 100);

  /* ── Export CSV du registre filtré, tel qu'affiché ──────────────────── */
  const exportExpensesCsv = () => {
    const projectTitle = new Map(PROJECTS.map((p) => [p.id, p.title]));
    const trackTitle = new Map(TRACKS.map((tr) => [tr.id, tr.title]));
    const memberName = new Map(TEAM.map((m) => [m.id, m.name]));
    downloadCsv<Expense>(`day1-expenses-${year}`, registerExpenses, [
      { header: t("register.date"), cell: (e) => e.date },
      { header: t("register.label"), cell: (e) => expenseLabel(e) },
      { header: t("register.category"), cell: (e) => t(`categories.${e.category}`) },
      {
        header: t("register.project"),
        cell: (e) => (e.projectId ? (projectTitle.get(e.projectId) ?? "") : ""),
      },
      {
        header: t("register.track"),
        cell: (e) => (e.trackId ? (trackTitle.get(e.trackId) ?? "") : ""),
      },
      { header: t("register.amount"), cell: (e) => e.amount },
      {
        header: t("register.addedBy"),
        cell: (e) => memberName.get(e.addedBy) ?? e.addedBy,
      },
      {
        header: t("register.source"),
        cell: (e) =>
          e.source === "wavely" ? t("register.wavely") : t("register.manual"),
      },
    ]);
  };

  return (
    <div className="rise-in">
      <PrintStyles />
      <PageHeader
        title={t("title")}
        subtitle={
          scopeAll
            ? t("subtitleLabel")
            : isLabel && focusedArtist
              ? t("subtitleFocused", { name: focusedArtist.name })
              : t("subtitle")
        }
      >
        {isLabel && focusedArtist && (
          <ArtistBadge artist={focusedArtist} meta={focusedArtist.genre} />
        )}
        <ExportMenu
          label={t("export.button")}
          csvLabel={t("export.csv")}
          printLabel={t("export.print")}
          onExportCsv={exportExpensesCsv}
        />
        <AddExpenseDialog
          isLabel={isLabel}
          defaultArtistId={artistId}
          onAdd={(e) => setAdded((prev) => [e, ...prev])}
        />
      </PageHeader>

      <div className="space-y-3">
        {/* Ce qu'il reste : le net au centre de sa composition mensuelle. */}
        <Sheet family="money">
          <SheetHeading
            action={
              <SheetSegments
                value={year}
                onChange={setYear}
                label={t("filters.year")}
                options={YEARS.map((y) => ({ value: y as number, label: y }))}
              />
            }
          >
            {t("kpis.net")}
          </SheetHeading>

          <div className="group relative">
            <CenteredValue
              value={
                <span className={net < 0 ? "text-destructive" : undefined}>
                  {eur(net)}
                </span>
              }
              caption={
                <>
                  {t("hero.caption", { year })}
                  {netDelta === undefined ? (
                    <> · {t("hero.noPrevYear")}</>
                  ) : (
                    <>
                      {" · "}
                      <b className={netDelta >= 0 ? "text-success" : "text-destructive"}>
                        {fmtPct(locale, netDelta)}
                      </b>{" "}
                      {t("hero.vsPrevYear", { year: year - 1 })}
                    </>
                  )}
                  <span className="mt-0.5 block opacity-80">
                    {t("hero.formula", {
                      revenue: eur(totalRevenueYear),
                      expenses: eur(totalExpenses),
                    })}
                  </span>
                </>
              }
            />
            <PnlMonthlyChart data={monthly} centeredValue />
          </div>

          <div className="sheet-ink mt-1.5 flex flex-wrap items-center gap-4 text-[11.5px]">
            {PNL_SERIES.map(([key, color]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: color }}
                />
                {t(`chart.${key}`)}
              </span>
            ))}
          </div>

          {/* Sur quoi porte la comparaison, et ce qu'elle écarte. Sans ces deux
              phrases, un « −66 % » qui ne dit que « neuf mois contre douze »
              se lit comme un effondrement. */}
          <p className="sheet-ink mt-1.5 text-[11.5px] leading-relaxed">
            {spanLabel &&
              t("hero.spanNote", { span: spanLabel, prev: year - 1, year })}
            {partialMonth && (
              <>
                {" "}
                {t("hero.partialNote", {
                  month: fmtMonthName(locale, partialMonth, "long"),
                })}
              </>
            )}
            {spanBasis && (
              <>
                {" "}
                {measuredSpanLabel
                  ? t("hero.basisMixed", { months: measuredSpanLabel })
                  : t("hero.basisReconstructed")}{" "}
                <ProvenanceBadge
                  provenance={spanBasis.provenance}
                  className="align-middle"
                />
              </>
            )}
          </p>

          <AffiliatedPoints
            points={[
              {
                key: "expenses",
                value: eur(totalExpenses),
                label: t("kpis.expensesShort", { year }),
                note:
                  expensesDelta === undefined
                    ? undefined
                    : `${fmtPct(locale, expensesDelta)} ${t("hero.vsPrevYear", { year: year - 1 })}`,
              },
              {
                key: "margin",
                value: pct(margin),
                label: t("kpis.margin"),
                note: t("kpis.marginHint"),
              },
              {
                key: "heaviest",
                value: heaviest ? t(`categories.${heaviest.category}`) : "—",
                label: t("kpis.heaviest"),
                note: heaviest
                  ? t("kpis.heaviestHint", {
                      amount: eur(heaviest.amount),
                      share: pct(
                        totalExpenses === 0
                          ? 0
                          : (heaviest.amount / totalExpenses) * 100,
                      ),
                    })
                  : undefined,
              },
              {
                key: "worst",
                value: worstMonth ? fmtMonth(locale, worstMonth.month) : "—",
                label: t("kpis.worstMonth"),
                note: worstMonth ? eur(worstMonth.expenses) : undefined,
              },
            ]}
          />
        </Sheet>

        {/* Où part l'argent, et comment ça évolue. */}
        <div className="grid gap-3 xl:grid-cols-[1fr_1.15fr]">
          <Sheet family="money" className="flex flex-col">
            <SheetHeading action={t("donut.filterHint")}>
              {t("donut.title")}
            </SheetHeading>
            <div className="flex flex-1 flex-col justify-center">
              <CategoryDonut
                data={byCategory}
                selected={category}
                onSelect={setCategory}
              />
            </div>
          </Sheet>

          <Sheet family="money">
            <SheetHeading action={t("compare.subtitle")}>
              {t("compare.title")}
            </SheetHeading>
            <PnlComparisons
              byYear={spanRows}
              byProject={byProject}
              byTrack={byTrack}
              yearNote={
                spanLabel ? t("compare.yearNote", { span: spanLabel }) : null
              }
            />
          </Sheet>
        </div>

        {/* Le détail, ligne à ligne — le seul bloc que les filtres touchent. */}
        <Sheet family="money">
          <SheetHeading
            action={
              <span className="flex flex-wrap items-center gap-2">
                {category && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setCategory(null)}
                  >
                    {t("register.filteredBy", {
                      category: t(`categories.${category}`),
                    })}{" "}
                    · {t("register.reset")}
                  </Button>
                )}
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger
                    size="sm"
                    className="w-44"
                    aria-label={t("filters.project")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("filters.allProjects")}</SelectItem>
                    {projectOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </span>
            }
          >
            {t("register.title")}
          </SheetHeading>
          <ExpenseRegister items={registerExpenses} bare />
          <p className="sheet-ink mt-3 text-[11.5px] leading-relaxed">
            {t("register.scopeNote")}
          </p>
          <p className="sheet-rule mt-3 pt-2.5 text-[11.5px]">
            <span className="sheet-ink">{t("wavely.inline", { count: wavelyCount })}</span>{" "}
            <span className="text-muted-foreground">{t("wavely.inlineCta")}</span>{" "}
            <span className="text-muted-foreground">({tc("actions.soon")})</span>
          </p>
        </Sheet>

        <Doors
          title={tc("blocks.doors")}
          doors={[
            {
              key: "revenue",
              family: "money",
              href: "/revenue",
              label: t("doors.revenue"),
              value: t("doors.revenueValue"),
            },
            {
              key: "calculator",
              family: "money",
              href: "/calculator",
              label: t("doors.calculator"),
              value: t("doors.calculatorValue"),
            },
            {
              key: "urssaf",
              family: "money",
              href: "/urssaf",
              label: t("doors.urssaf"),
              value: t("doors.urssafValue"),
            },
            {
              key: "contracts",
              family: "money",
              href: "/contracts",
              label: t("doors.contracts"),
              value: t("doors.contractsValue"),
            },
            {
              key: "splits",
              family: "money",
              href: "/splits",
              label: t("doors.splits"),
              value: t("doors.splitsValue"),
            },
            {
              key: "audit",
              family: "money",
              href: "/audit",
              label: t("doors.audit"),
              value: t("doors.auditValue"),
            },
          ]}
        />

        <RestRow
          title={scopeAll ? tc("blocks.restLabel") : tc("blocks.rest")}
          items={[
            { key: "pulse", href: "/pulse", label: t("rest.pulse") },
            { key: "valuation", href: "/valuation", label: t("rest.valuation") },
            { key: "import", href: "/import", label: t("rest.import") },
            { key: "catalog", href: "/catalog", label: t("rest.catalog") },
            { key: "team", href: "/team", label: t("rest.team") },
            { key: "tour", href: "/tour", label: t("rest.tour") },
          ]}
        />

        <p className="text-muted-foreground mt-2 text-[11.5px]">{tc("blocks.legend")}</p>
      </div>
    </div>
  );
}
