"use client";

/**
 * Widgets contrats : le panneau repliable, « Ce qui arrive », le tableau de tous les contrats,
 * et les trois étapes d'une avance.
 *
 * Refondus le 28/10/2026 (Gaël) : sur 9 contrats comme sur 150, l'œil doit suivre des COLONNES,
 * pas des cartes dont la taille dépend du texte. Donc un seul tableau trié (recherche, année, tri),
 * une liste d'échéances alignée et rangée par horizon, des contrôles qui disent ce qu'ils font, et
 * des surfaces neutres : seule la feuille du chiffre clé garde la teinte « argent » de la page.
 *
 * La sévérité se lit sur l'icône : elle n'a pas besoin d'un fond de plus.
 */
import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, CalendarClock, ChevronDown, ChevronRight, FileSearch, Flag, Search, ShieldAlert, X } from "lucide-react";
import type { Artist, Contract, ContractAlert } from "@/lib/demo/types";
import {
  DEFAULT_DIR,
  HORIZONS,
  contractYears,
  daysUntil,
  filterRows,
  horizonOf,
  sortRows,
  type ContractRow,
  type Horizon,
  type SortDir,
  type SortKey,
} from "@/lib/demo/contract-view";
import { fmtDate, fmtEur, fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { Progress } from "@/components/ui/progress";

const SEVERITY_INK: Record<ContractAlert["severity"], string> = {
  info: "text-brand",
  warning: "text-warning",
  danger: "text-destructive",
};

const KIND_ICONS: Record<ContractAlert["kind"], React.ComponentType<{ className?: string }>> = {
  expiry: CalendarClock,
  option: Flag,
  "audit-window": FileSearch,
  "unusual-clause": ShieldAlert,
};

const KINDS: readonly ContractAlert["kind"][] = ["option", "expiry", "audit-window", "unusual-clause"];

export const typeKey = (c: Contract) => (c.type === "édition" ? "edition" : c.type);

/* ─── Briques ─── */

/**
 * Section neutre repliable : le titre est le bouton (plier / déplier), le compte est à côté,
 * les contrôles à droite. Repliée, elle ne garde que sa ligne de titre.
 */
export function Panel({
  title,
  meta,
  actions,
  children,
  defaultOpen = true,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const t = useTranslations("contracts");
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section aria-labelledby={`${id}-t`} className="bg-card text-card-foreground overflow-hidden rounded-xl border">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
        <h2 id={`${id}-t`} className="min-w-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={`${id}-b`}
            title={open ? t("panel.collapse") : t("panel.expand")}
            className="hover:bg-muted/60 focus-visible:ring-ring/50 -mx-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[15px] font-semibold tracking-[-0.01em] outline-none focus-visible:ring-2"
          >
            <ChevronDown className={cn("text-muted-foreground size-4 transition-transform duration-200", !open && "-rotate-90")} aria-hidden />
            {title}
          </button>
        </h2>
        {meta && <span className="text-muted-foreground text-[12.5px] tabular-nums">{meta}</span>}
        {open && actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {open && (
        <div id={`${id}-b`} className="border-t">
          {children}
        </div>
      )}
    </section>
  );
}

/** Contrôle segmenté : chaque choix est écrit, le choix courant est en relief. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="bg-muted/70 inline-flex flex-wrap items-center rounded-lg p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="text-muted-foreground tabular-nums">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Ce qui arrive ─── */

export type UpcomingItem = { alert: ContractAlert; contract: Contract };

function Relative({ due, todayIso }: { due: string; todayIso: string }) {
  const t = useTranslations("contracts");
  const d = daysUntil(due, todayIso);
  if (d === 0) return <>{t("alerts.today")}</>;
  return <>{d > 0 ? t("alerts.inDays", { days: d }) : t("alerts.lateDays", { days: -d })}</>;
}

/**
 * Une échéance par ligne, en colonnes fixes (quand · quoi · ce que ça dit · pour qui), rangées
 * par horizon : sans date (à traiter), dépassées, 30 jours, 3 mois, plus tard. Un filtre par
 * nature, écrit, avec son compte.
 */
export function UpcomingPanel({
  items,
  todayIso,
  artistOf,
}: {
  items: readonly UpcomingItem[];
  todayIso: string;
  /** Vue label : l'artiste de chaque échéance. Absent en vue artiste. */
  artistOf?: (artistId: string) => Artist;
}) {
  const t = useTranslations("contracts");
  const locale = useLocale();
  const [kind, setKind] = useState<ContractAlert["kind"] | "all">("all");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const { alert } of items) m.set(alert.kind, (m.get(alert.kind) ?? 0) + 1);
    return m;
  }, [items]);

  const groups = useMemo(() => {
    const shown = kind === "all" ? items : items.filter((i) => i.alert.kind === kind);
    const by = new Map<Horizon, UpcomingItem[]>();
    for (const it of shown) {
      const h = horizonOf(it.alert, todayIso);
      by.set(h, [...(by.get(h) ?? []), it]);
    }
    return HORIZONS.map((h) => ({
      horizon: h,
      items: (by.get(h) ?? []).sort((a, b) => (a.alert.dueDate ?? "").localeCompare(b.alert.dueDate ?? "")),
    })).filter((g) => g.items.length > 0);
  }, [items, kind, todayIso]);

  const thisYear = todayIso.slice(0, 4);
  const options = [
    { value: "all" as const, label: t("alerts.filters.all"), count: items.length },
    ...KINDS.filter((k) => counts.has(k)).map((k) => ({ value: k, label: t(`alerts.filters.${k}`), count: counts.get(k) })),
  ];

  return (
    <Panel
      title={t("alerts.heading")}
      meta={t("alerts.count", { count: items.length })}
      actions={items.length > 0 ? <Segmented label={t("alerts.filters.label")} value={kind} options={options} onChange={setKind} /> : undefined}
    >
      {items.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-[13px]">{t("alerts.none")}</p>
      ) : (
        groups.map((g) => (
          <div key={g.horizon}>
            <p className="bg-muted/40 text-muted-foreground flex items-baseline gap-2 border-b px-4 py-1.5 text-[12px] font-medium sm:px-5">
              <span className={cn(g.horizon === "overdue" && "text-destructive", g.horizon === "undated" && "text-foreground/80")}>
                {t(`alerts.horizons.${g.horizon}`)}
              </span>
              <span className="tabular-nums">{g.items.length}</span>
            </p>
            <ul>
              {g.items.map(({ alert, contract }, i) => {
                const Icon = KIND_ICONS[alert.kind];
                const artist = artistOf?.(contract.artistId);
                return (
                  <li
                    key={`${contract.id}-${alert.kind}-${i}`}
                    className={cn(
                      "grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b px-4 py-3 last:border-b-0 sm:px-5",
                      artist
                        ? "md:grid-cols-[6.5rem_10.5rem_minmax(0,1fr)_11rem] md:items-start"
                        : "md:grid-cols-[6.5rem_10.5rem_minmax(0,1fr)] md:items-start",
                    )}
                  >
                    <p className="order-2 text-right md:order-none md:text-left">
                      {alert.dueDate ? (
                        <>
                          <span className="num block text-[13px] font-medium whitespace-nowrap">
                            {fmtDate(locale, alert.dueDate, {
                              day: "numeric",
                              month: "short",
                              ...(alert.dueDate.slice(0, 4) !== thisYear ? { year: "numeric" } : {}),
                            })}
                          </span>
                          <span
                            className={cn(
                              "block text-[11.5px] whitespace-nowrap",
                              g.horizon === "overdue" || (g.horizon === "soon" && alert.severity === "danger")
                                ? "text-destructive"
                                : "text-muted-foreground",
                            )}
                          >
                            <Relative due={alert.dueDate} todayIso={todayIso} />
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-[12.5px]">{t("alerts.noDate")}</span>
                      )}
                    </p>
                    <p className="order-1 flex items-center gap-2 text-[13px] font-semibold md:order-none">
                      <Icon className={cn("size-4 shrink-0", SEVERITY_INK[alert.severity])} aria-hidden />
                      {t(`alerts.kinds.${alert.kind}`)}
                    </p>
                    <div className="order-3 col-span-2 min-w-0 md:order-none md:col-span-1">
                      <p className="text-foreground/85 text-[13px] leading-snug">{alert.message[locale === "fr" ? "fr" : "en"]}</p>
                      <p className="text-muted-foreground mt-0.5 text-[11.5px]">
                        {t(`types.${typeKey(contract)}`)} · {contract.counterparty}
                      </p>
                    </div>
                    {artist && (
                      <div className="order-4 col-span-2 md:order-none md:col-span-1 md:justify-self-end">
                        <ArtistBadge artist={artist} size="sm" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </Panel>
  );
}

/* ─── Tous les contrats ─── */

const SORT_SHORTCUTS: readonly SortKey[] = ["artist", "next", "remaining"];

/** En-tête triable : le bouton dit par quoi il trie, `aria-sort` dit dans quel sens. */
function Th({
  k,
  sort,
  onSort,
  children,
  right = false,
  className,
}: {
  k: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
  children: ReactNode;
  right?: boolean;
  className?: string;
}) {
  const active = sort.key === k;
  const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("h-9 px-2 font-medium whitespace-nowrap", right ? "text-right" : "text-left", className)}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2",
          right && "flex-row-reverse",
          active ? "text-foreground" : "hover:text-foreground",
        )}
      >
        {children}
        <Arrow className={cn("size-3", active ? "opacity-100" : "opacity-0")} aria-hidden />
      </button>
    </th>
  );
}


/**
 * Un seul tableau pour tout le périmètre : recherche (artiste, contrepartie, type), année « en
 * cours », tri écrit (A → Z, échéance, reste à recouper) ou par en-tête, et une ligne qui se
 * déplie sur les échéances et les conditions du contrat.
 */
export function ContractsLedger({
  rows,
  todayIso,
  showArtist,
  artistOf,
  footer,
}: {
  rows: readonly ContractRow[];
  todayIso: string;
  showArtist: boolean;
  artistOf: (artistId: string) => Artist;
  footer?: ReactNode;
}) {
  const t = useTranslations("contracts");
  const locale = useLocale();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: showArtist ? "artist" : "next", dir: "asc" });
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const years = useMemo(() => contractYears(rows.map((r) => r.contract)), [rows]);
  const shown = useMemo(() => sortRows(filterRows(rows, query, year), sort.key, sort.dir), [rows, query, year, sort]);
  const filtered = query.trim() !== "" || year !== null;
  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });
  const month = (iso: string) => fmtDate(locale, iso, { month: "short", year: "numeric" });

  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: DEFAULT_DIR[key] }));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const cols = showArtist ? 10 : 9;

  return (
    <Panel
      title={t("table.heading")}
      meta={t("table.count", { shown: shown.length, total: rows.length })}
      actions={
        <Segmented
          label={t("table.sortLabel")}
          value={SORT_SHORTCUTS.includes(sort.key) ? sort.key : ("" as SortKey)}
          options={SORT_SHORTCUTS.filter((k) => showArtist || k !== "artist").map((k) => ({ value: k, label: t(`table.sort.${k}`) }))}
          onChange={(k) => setSort({ key: k, dir: DEFAULT_DIR[k] })}
        />
      }
    >
      {/* Recherche et année */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 sm:px-5">
        <label htmlFor={searchId} className="sr-only">
          {t("table.searchLabel")}
        </label>
        <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={showArtist ? t("table.search") : t("table.searchSelf")}
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-md border pr-2.5 pl-8 text-[13px] outline-none focus-visible:ring-2"
          />
        </div>
        <label className="text-muted-foreground inline-flex items-center gap-2 text-[12.5px]">
          {t("table.year")}
          <select
            value={year ?? ""}
            onChange={(e) => setYear(e.target.value === "" ? null : Number(e.target.value))}
            className="border-input bg-background text-foreground focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-[13px] outline-none focus-visible:ring-2"
          >
            <option value="">{t("table.allYears")}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {t("table.activeIn", { year: y })}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setYear(null);
            }}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px]"
          >
            <X className="size-3.5" aria-hidden />
            {t("table.reset")}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground px-5 py-6 text-[13px]">{rows.length === 0 ? t("empty") : t("table.noMatch")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-[13px]">
            <caption className="sr-only">{t("table.heading")}</caption>
            <thead className="text-muted-foreground border-b text-[12px]">
              <tr>
                <th scope="col" className="w-9">
                  <span className="sr-only">{t("table.details")}</span>
                </th>
                {showArtist && <Th k="artist" sort={sort} onSort={sortBy}>{t("table.artist")}</Th>}
                <Th k="type" sort={sort} onSort={sortBy}>{t("table.type")}</Th>
                <th scope="col" className="h-9 px-2 text-left font-medium">{t("table.counterparty")}</th>
                <Th k="end" sort={sort} onSort={sortBy}>{t("table.period")}</Th>
                <Th k="rate" sort={sort} onSort={sortBy} right>{t("table.rate")}</Th>
                <Th k="advance" sort={sort} onSort={sortBy} right>{t("table.advance")}</Th>
                <Th k="remaining" sort={sort} onSort={sortBy} right>{t("table.remaining")}</Th>
                <Th k="recouped" sort={sort} onSort={sortBy} className="w-36">{t("table.recoupment")}</Th>
                <Th k="next" sort={sort} onSort={sortBy} right className="pr-4 sm:pr-5">{t("table.next")}</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const c = r.contract;
                const expired = c.endDate < todayIso;
                const isOpen = open.has(c.id);
                const artist = showArtist ? artistOf(c.artistId) : null;
                const detailId = `${searchId}-${c.id}`;
                return (
                  <Fragment key={c.id}>
                    <tr className={cn("hover:bg-muted/40 border-b transition-colors", isOpen && "bg-muted/30", expired && "text-muted-foreground")}>
                      <td className="py-2 pl-2">
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                          aria-label={isOpen ? t("table.hideDetails") : t("table.showDetails")}
                          className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 inline-flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2"
                        >
                          <ChevronRight className={cn("size-4 transition-transform duration-150", isOpen && "rotate-90")} aria-hidden />
                        </button>
                      </td>
                      {artist && (
                        <td className="max-w-[12rem] px-2 py-2">
                          <ArtistBadge artist={artist} size="sm" />
                        </td>
                      )}
                      <td className="px-2 py-2 font-medium whitespace-nowrap">{r.typeLabel}</td>
                      <td className="text-muted-foreground max-w-[12rem] truncate px-2 py-2">{c.counterparty}</td>
                      <td className="num px-2 py-2 whitespace-nowrap">
                        <span className="text-muted-foreground">{month(c.startDate)} → </span>
                        {month(c.endDate)}
                        {expired && <span className="text-destructive ml-1.5 text-[11.5px] font-medium">{t("badges.expired")}</span>}
                      </td>
                      <td className="num px-2 py-2 text-right font-medium">{fmtInt(locale, c.royaltyRate)} %</td>
                      <td className="num px-2 py-2 text-right">{c.advance > 0 ? eur(c.advance) : "—"}</td>
                      <td className="num px-2 py-2 text-right font-medium">{c.advance > 0 ? (r.remaining > 0 ? eur(r.remaining) : t("table.recoupedDone")) : "—"}</td>
                      <td className="px-2 py-2">
                        {c.advance > 0 ? (
                          <div className="flex items-center gap-2">
                            <Progress
                              value={Math.min(100, c.recoupedPct)}
                              className={cn("h-1.5 flex-1", c.recoupedPct >= 100 && "[&>[data-slot=progress-indicator]]:bg-success")}
                            />
                            <span className="num text-muted-foreground w-9 text-right text-[12px]">{fmtInt(locale, c.recoupedPct)} %</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="num px-2 py-2 pr-4 text-right whitespace-nowrap sm:pr-5">
                        {r.nextDue ? fmtDate(locale, r.nextDue, { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr id={detailId} className="bg-muted/30 border-b">
                        <td />
                        <td colSpan={cols - 1} className="px-2 pt-1 pb-3 pr-4 sm:pr-5">
                          <dl className="text-muted-foreground grid gap-x-8 gap-y-1 text-[12.5px] sm:grid-cols-[auto_1fr]">
                            <dt>{t("table.territory")}</dt>
                            <dd className="text-foreground">
                              {c.territory} · {c.exclusive ? t("badges.exclusive") : t("badges.nonExclusive")}
                            </dd>
                            {c.advance > 0 && (
                              <>
                                <dt>{t("recoup.remaining")}</dt>
                                <dd className="text-foreground num">
                                  {t("table.remainingOf", { remaining: fmtEur(locale, r.remaining), advance: fmtEur(locale, c.advance) })}
                                </dd>
                              </>
                            )}
                            <dt>{t("table.events")}</dt>
                            <dd className="text-foreground">
                              {c.alerts.length === 0 ? (
                                <span className="text-muted-foreground">{t("table.noAlerts")}</span>
                              ) : (
                                <ul className="space-y-1">
                                  {c.alerts.map((a, i) => {
                                    const Icon = KIND_ICONS[a.kind];
                                    return (
                                      <li key={i} className="flex items-start gap-2">
                                        <Icon className={cn("mt-0.5 size-3.5 shrink-0", SEVERITY_INK[a.severity])} aria-hidden />
                                        <span>
                                          <b className="font-medium">{t(`alerts.kinds.${a.kind}`)}</b>
                                          {a.dueDate && <span className="num text-muted-foreground"> · {fmtDate(locale, a.dueDate)}</span>}
                                          <span className="text-muted-foreground"> — {a.message[locale === "fr" ? "fr" : "en"]}</span>
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </dd>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {footer && <div className="border-t px-4 py-2.5 sm:px-5">{footer}</div>}
    </Panel>
  );
}

/**
 * Les trois étapes d'une avance, sur le contrat le plus lourd du périmètre.
 * C'est de la pédagogie : elle se replie, parce qu'on ne la lit qu'une fois.
 */
export function RecoupmentSteps({ contract }: { contract: Contract }) {
  const t = useTranslations("contracts");
  const locale = useLocale();
  const recouped = Math.round((contract.advance * contract.recoupedPct) / 100);

  return (
    <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-3">
      {(
        [
          ["advance", { advance: fmtEur(locale, contract.advance) }],
          [
            "recoup",
            {
              rate: `${fmtInt(locale, contract.royaltyRate)} %`,
              recouped: fmtEur(locale, recouped),
            },
          ],
          ["payout", {}],
        ] as const
      ).map(([key, values]) => (
        <div key={key}>
          <p className="text-[12px] font-semibold">{t(`recoup.steps.${key}.title`)}</p>
          <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-relaxed">{t(`recoup.steps.${key}.body`, values)}</p>
        </div>
      ))}
    </div>
  );
}
