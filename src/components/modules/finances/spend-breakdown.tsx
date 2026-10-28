"use client";

/**
 * Vue éclatée d'un budget de dépenses (le marketing par défaut) : on ouvre un
 * artiste, puis un titre, et on lit chaque dépense — date, poste, qui l'a
 * saisie, montant. Fermée, la feuille ne montre que le poids de chaque
 * artiste : le « gros » reste lisible d'un coup d'œil, le détail se demande.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, ListTree, Waves } from "lucide-react";
import { ArtistAvatar } from "@/components/dashboard/artist-badge";
import { SheetHeading } from "@/components/dashboard/sheet";
import { Button } from "@/components/ui/button";
import { CATEGORY_COLOR } from "@/components/modules/finances/category-badge";
import { useExpenseLabel } from "@/components/modules/finances/expense-register";
import { PROJECTS, TEAM, TRACKS, getArtist } from "@/lib/demo/api";
import { buildSpendTree, type SpendTitleNode } from "@/lib/demo/spend-tree";
import type { Expense, ExpenseCategory } from "@/lib/demo/types";
import { fmtDate, fmtEur } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Une part n'a pas de signe : `fmtPct` écrirait « +38 % ». */
const fmtShare = (locale: string, ratio: number) =>
  new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(ratio);

const projectTitle = new Map(PROJECTS.map((p) => [p.id, p.title]));
const trackTitle = new Map(TRACKS.map((t) => [t.id, t.title]));
const memberName = new Map(TEAM.map((m) => [m.id, m.name]));

/** Barre de poids, relative au plus gros de son niveau. */
function Weight({ ratio, color }: { ratio: number; color: string }) {
  return (
    <span aria-hidden className="bg-foreground/[0.07] relative block h-1.5 w-full overflow-hidden rounded-full">
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.max(2, Math.round(ratio * 100))}%`, background: color }}
      />
    </span>
  );
}

/** Ligne dépliable : chevron, libellé, barre, montant, part. */
function DisclosureRow({
  open,
  onToggle,
  controls,
  depth,
  label,
  ratio,
  color,
  amount,
  aside,
}: {
  open: boolean;
  onToggle: () => void;
  controls: string;
  depth: 0 | 1;
  label: ReactNode;
  ratio: number;
  color: string;
  amount: string;
  aside: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className={cn(
        "hover:bg-foreground/[0.03] focus-visible:ring-ring grid w-full grid-cols-[1rem_minmax(0,1fr)_minmax(4rem,9rem)_auto] items-center gap-3 rounded-md py-2 pr-2 text-left text-[12.5px] transition-colors focus-visible:ring-2 focus-visible:outline-none sm:grid-cols-[1rem_minmax(0,1fr)_minmax(6rem,14rem)_6.5rem_6.5rem]",
        depth === 0 ? "pl-1" : "pl-7",
      )}
    >
      <ChevronRight
        aria-hidden
        className={cn("text-muted-foreground size-3.5 transition-transform", open && "rotate-90")}
      />
      <span className="flex min-w-0 items-center gap-2">{label}</span>
      <Weight ratio={ratio} color={color} />
      <span className="text-right font-semibold tabular-nums">{amount}</span>
      <span className="sheet-ink hidden text-right text-[11.5px] whitespace-nowrap tabular-nums sm:block">{aside}</span>
    </button>
  );
}

export function SpendBreakdown({
  items,
  year,
  category = "marketing",
}: {
  /** Les dépenses du périmètre affiché (année, artiste zoomé, saisies du jour). */
  items: Expense[];
  year: number;
  category?: ExpenseCategory;
}) {
  const locale = useLocale();
  const t = useTranslations("finances.breakdown");
  const tf = useTranslations("finances");
  const expenseLabel = useExpenseLabel();
  const tree = useMemo(() => buildSpendTree(items, category), [items, category]);
  const color = CATEGORY_COLOR[category];

  /* Ouverture : un jeu de clés (`a:<artiste>`, `t:<artiste>:<groupe>`). « Vue
     éclatée » ouvre tout d'un coup ; chaque ligne s'ouvre aussi seule. */
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const allKeys = useMemo(
    () =>
      tree.artists.flatMap((a) => [
        `a:${a.artistId}`,
        ...a.titles.map((n) => `t:${a.artistId}:${n.key}`),
      ]),
    [tree],
  );
  const exploded = allKeys.length > 0 && allKeys.every((k) => open.has(k));
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Un seul artiste (zoom ou vue artiste) : on saute le premier niveau.
  const single = tree.artists.length === 1;
  const maxArtist = tree.artists[0]?.amount ?? 0;

  const titleLabel = (n: SpendTitleNode) => {
    if (n.kind === "track") {
      const title = trackTitle.get(n.trackId!) ?? n.trackId!;
      // Un single porte le nom de son projet : ne pas l'écrire deux fois.
      const project = n.projectId ? projectTitle.get(n.projectId) : undefined;
      return (
        <>
          <span className="truncate font-medium">{title}</span>
          {project && project !== title && (
            <span className="sheet-ink hidden truncate text-[11.5px] md:inline">{project}</span>
          )}
        </>
      );
    }
    return n.kind === "project" ? (
      <span className="truncate">
        {t("projectOnly", { project: projectTitle.get(n.projectId!) ?? n.projectId! })}
      </span>
    ) : (
      <span className="sheet-ink truncate">{t("noRelease")}</span>
    );
  };

  const renderTitles = (artistId: string, titles: SpendTitleNode[], depth: 0 | 1) => {
    const max = titles[0]?.amount ?? 0;
    return titles.map((n) => {
      const key = `t:${artistId}:${n.key}`;
      const id = `spend-${artistId}-${n.key}`.replace(/[^a-zA-Z0-9_-]/g, "-");
      const isOpen = open.has(key);
      return (
        <div key={key}>
          <DisclosureRow
            open={isOpen}
            onToggle={() => toggle(key)}
            controls={id}
            depth={depth}
            label={titleLabel(n)}
            ratio={max ? n.amount / max : 0}
            color={color}
            amount={fmtEur(locale, n.amount)}
            aside={t("lines", { count: n.items.length })}
          />
          {isOpen && (
            <ul id={id} className={cn("border-border/40 mb-1 border-l", depth === 0 ? "ml-3 pl-4" : "ml-10 pl-4")}>
              {n.items.map((e) => (
                <li
                  key={e.id}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-baseline gap-3 py-1 text-[12px] sm:grid-cols-[4.5rem_minmax(0,1fr)_8rem_6.5rem]"
                >
                  <span className="sheet-ink tabular-nums">
                    {fmtDate(locale, e.date, { day: "2-digit", month: "short" })}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{expenseLabel(e)}</span>
                    {e.source === "wavely" && (
                      <Waves className="text-brand size-3 shrink-0" aria-label={tf("register.wavely")} />
                    )}
                  </span>
                  <span className="sheet-ink hidden truncate sm:block">
                    {t("by", { name: memberName.get(e.addedBy) ?? e.addedBy })}
                  </span>
                  <span className="text-right tabular-nums">{fmtEur(locale, e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    });
  };

  return (
    <div>
      <SheetHeading
        action={
          tree.count > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-[11.5px]"
              aria-pressed={exploded}
              onClick={() => setOpen(exploded ? new Set() : new Set(allKeys))}
            >
              <ListTree className="size-3.5" aria-hidden />
              {exploded ? t("collapse") : t("explode")}
            </Button>
          )
        }
      >
        {t("title", { category: tf(`categories.${category}`) })}
      </SheetHeading>

      {tree.count === 0 ? (
        <p className="sheet-ink py-6 text-center text-[12.5px]">{t("empty", { year })}</p>
      ) : (
        <>
          <p className="sheet-ink mt-1 mb-2 text-[12px]">
            <b className="text-foreground font-semibold tabular-nums">{fmtEur(locale, tree.total)}</b>{" "}
            {t("summary", { year, count: tree.count })} · {t("hint")}
          </p>
          <div className="divide-border/30 divide-y">
            {single
              ? renderTitles(tree.artists[0].artistId, tree.artists[0].titles, 0)
              : tree.artists.map((a) => {
                  const key = `a:${a.artistId}`;
                  const id = `spend-${a.artistId}`;
                  const isOpen = open.has(key);
                  const artist = getArtist(a.artistId);
                  return (
                    <div key={key}>
                      <DisclosureRow
                        open={isOpen}
                        onToggle={() => toggle(key)}
                        controls={id}
                        depth={0}
                        label={
                          <>
                            <ArtistAvatar artist={artist} size="sm" />
                            <span className="truncate font-medium">{artist.name}</span>
                          </>
                        }
                        ratio={maxArtist ? a.amount / maxArtist : 0}
                        color={color}
                        amount={fmtEur(locale, a.amount)}
                        aside={t("share", { pct: fmtShare(locale, a.amount / tree.total) })}
                      />
                      {isOpen && <div id={id}>{renderTitles(a.artistId, a.titles, 1)}</div>}
                    </div>
                  );
                })}
          </div>
        </>
      )}
    </div>
  );
}
