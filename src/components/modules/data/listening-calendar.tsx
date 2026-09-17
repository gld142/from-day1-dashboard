"use client";

/**
 * « 365 jours d'écoute » — calendrier de chaleur façon GitHub : un carré par
 * jour, 53 colonnes (semaines, lundi en haut) × 7 lignes, tous DSP confondus.
 *
 * Intensité = quintile des streams du jour sur l'année (5 crans, --heat-0 à
 * --heat-4 : rampe monochrome de la marque, ancrée sur la surface — elle suit
 * la skin). Grille CSS pure, pas de bibliothèque : le composant
 * @componentry/github-calendar ne prend qu'un `username` GitHub (fetch d'une
 * API distante, couleurs Tailwind en dur), pas des données arbitraires.
 *
 * Infobulle unique (délégation d'événements sur la grille : pas 365 gestionnaires),
 * texte accessible résumé sur la grille (`role="img"`), entrée en vague de
 * gauche à droite en CSS seule, neutralisée sous prefers-reduced-motion.
 */
import { useMemo, useState, type CSSProperties, type PointerEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { fmtCompact, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CalendarDay = { date: string; streams: number };

const COLUMNS = 53;
const LEVELS = 5;

/** Lundi = 0 … dimanche = 6 (convention française), à partir d'une date ISO. */
function weekdayMondayFirst(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * Seuils de quintiles : un jour de niveau k a des streams ≥ thresholds[k].
 * Sur des valeurs toutes égales, tout le monde est au cran 0.
 */
function quantileLevel(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0;
  let level = 0;
  for (let k = 1; k < LEVELS; k++) {
    const threshold = sorted[Math.floor((sorted.length * k) / LEVELS)];
    if (value >= threshold && threshold > sorted[0]) level = k;
  }
  return level;
}

type Cell = { index: number; day: CalendarDay; level: number; col: number; row: number };

export function ListeningCalendar({
  days,
  className,
}: {
  /** Série quotidienne triée par date croissante (365 jours attendus). */
  days: CalendarDay[];
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("streams.calendar");
  const [hover, setHover] = useState<Cell | null>(null);

  const { cells, months, weekdays, total, best } = useMemo(() => {
    const sorted = days.map((d) => d.streams).sort((a, b) => a - b);
    const offset = days.length > 0 ? weekdayMondayFirst(days[0].date) : 0;
    const cells: Cell[] = days.map((day, i) => ({
      index: i,
      day,
      level: quantileLevel(sorted, day.streams),
      col: Math.floor((i + offset) / 7),
      row: (i + offset) % 7,
    }));

    /* Étiquettes de mois : à la colonne qui contient le 1er du mois, si elle
       est assez loin de la précédente pour ne pas se chevaucher. */
    const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });
    const months: Array<{ col: number; label: string }> = [];
    for (const c of cells) {
      if (!c.day.date.endsWith("-01")) continue;
      const last = months[months.length - 1];
      if (last && c.col - last.col < 3) continue;
      months.push({ col: c.col, label: monthFmt.format(new Date(`${c.day.date}T00:00:00Z`)) });
    }

    /* Lun · Mer · Ven, calculés depuis une semaine de référence (2024-01-01 = lundi). */
    const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const weekdays = [0, 2, 4].map((row) => ({
      row,
      label: dayFmt.format(new Date(Date.UTC(2024, 0, 1 + row))).replace(/\.$/, ""),
    }));

    const total = days.reduce((s, d) => s + d.streams, 0);
    const best = days.reduce(
      (b, d) => (d.streams > b.streams ? d : b),
      days[0] ?? { date: "", streams: 0 },
    );
    return { cells, months, weekdays, total, best };
  }, [days, locale]);

  /* Délégation : la cellule survolée porte son index dans data-i. */
  const onPointerOver = (e: PointerEvent<HTMLDivElement>) => {
    const i = (e.target as HTMLElement).dataset.i;
    setHover(i === undefined ? null : cells[Number(i)] ?? null);
  };

  const dateLong = (iso: string) =>
    fmtDate(locale, iso, { weekday: "long", day: "numeric", month: "long" });

  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
    gridTemplateRows: "repeat(7, minmax(0, 1fr))",
  };

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="min-w-[640px]">
        {/* Mois — même grille de colonnes que les cellules, décalée des libellés de jours. */}
        <div
          className="ml-8 grid text-[10px] text-muted-foreground"
          style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
        >
          {months.map((m) => (
            <span key={m.col} className="truncate" style={{ gridColumn: `${m.col + 1} / span 3` }}>
              {m.label}
            </span>
          ))}
        </div>

        <div className="mt-1 flex gap-1">
          {/* Jours de la semaine (3 repères suffisent). */}
          <div
            className="grid w-7 shrink-0 text-[10px] text-muted-foreground"
            style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
          >
            {weekdays.map((w) => (
              <span key={w.row} className="leading-none" style={{ gridRow: w.row + 1 }}>
                {w.label}
              </span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            <div
              role="img"
              aria-label={t("aria", {
                total: fmtCompact(locale, total),
                date: best.date ? dateLong(best.date) : "—",
                best: fmtCompact(locale, best.streams),
              })}
              className="listening-grid grid gap-[3px]"
              style={gridStyle}
              onPointerOver={onPointerOver}
              onPointerLeave={() => setHover(null)}
            >
              {cells.map((c) => (
                <span
                  key={c.day.date}
                  data-i={c.index}
                  className="aspect-square rounded-[3px] hover:outline-2 hover:outline-foreground/60"
                  style={
                    {
                      gridColumn: c.col + 1,
                      gridRow: c.row + 1,
                      background: `var(--heat-${c.level})`,
                      "--col": c.col,
                    } as CSSProperties
                  }
                />
              ))}
            </div>

            {/* Infobulle unique, positionnée sur la cellule survolée : sous la
                cellule dans le haut de la grille, au-dessus sinon ; calée aux
                bords près des premières / dernières colonnes (le conteneur
                défile horizontalement et rognerait un débordement). */}
            {hover && (
              <div
                role="tooltip"
                className={cn(
                  "pointer-events-none absolute z-10 whitespace-nowrap rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md",
                  hover.row < 3 ? "translate-y-0" : "-translate-y-full",
                  hover.col < 8
                    ? "translate-x-0"
                    : hover.col > COLUMNS - 9
                      ? "-translate-x-full"
                      : "-translate-x-1/2",
                )}
                style={{
                  left: `${((hover.col + (hover.col < 8 ? 0 : hover.col > COLUMNS - 9 ? 1 : 0.5)) / COLUMNS) * 100}%`,
                  top:
                    hover.row < 3
                      ? `calc(${((hover.row + 1) / 7) * 100}% + 6px)`
                      : `calc(${(hover.row / 7) * 100}% - 6px)`,
                }}
              >
                <span className="num font-semibold">
                  {t("tooltip", { streams: fmtCompact(locale, hover.day.streams) })}
                </span>
                <span className="ml-1.5 text-muted-foreground">{dateLong(hover.day.date)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Légende de la rampe. */}
        <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          <span>{t("less")}</span>
          {Array.from({ length: LEVELS }, (_, k) => (
            <span
              key={k}
              aria-hidden
              className="size-2.5 rounded-[3px]"
              style={{ background: `var(--heat-${k})` }}
            />
          ))}
          <span>{t("more")}</span>
        </div>
      </div>
    </div>
  );
}
