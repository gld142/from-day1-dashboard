"use client";

/**
 * « Qui bouge · 30 derniers jours » (Pulse, vue structure) : trois qui montent, trois qui
 * décrochent, le nombre de stables. Chaque ligne dit combien de streams l'artiste a gagnés ou
 * perdus (c'est ce qui pèse dans le revenu), le pourcentage, et son titre en tête sur la
 * période. Un clic zoome tout le dashboard sur l'artiste. Logique : `splitMovers`.
 */
import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { TrendingDown, TrendingUp } from "lucide-react";
import { SheetHeading } from "@/components/dashboard/sheet";
import { topTracks } from "@/lib/demo/api";
import { splitMovers, type Mover, type MoverRow } from "@/lib/demo/movers";
import { fmtCompact, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = MoverRow & { name: string };

function MoversGroup({
  kind,
  items,
  count,
  onFocus,
}: {
  kind: "up" | "down";
  items: Mover<Row>[];
  count: number;
  onFocus: (artistId: string) => void;
}) {
  const t = useTranslations("pulse.movers");
  const locale = useLocale();
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmtCompact(locale, Math.abs(n))}`;
  const Icon = kind === "up" ? TrendingUp : TrendingDown;
  return (
    <div>
      <p className="sheet-ink mt-2 mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
        <Icon className={cn("size-3.5", kind === "up" ? "text-success" : "text-destructive")} aria-hidden />
        {t(kind)} <span className="font-normal tabular-nums">{count}</span>
      </p>
      {items.length === 0 ? (
        <p className="sheet-ink py-1.5 text-[12px]">{t("none")}</p>
      ) : (
        items.map((r) => {
          const lead = topTracks(r.id, 30, 1)[0]?.title;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onFocus(r.id)}
              className="border-border/30 hover:bg-foreground/[0.03] grid w-full grid-cols-[minmax(0,1fr)_auto_3.5rem] items-center gap-3 rounded-md border-t px-1 py-1.5 text-left text-[12.5px] transition-colors"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.name}</span>
                {lead && <span className="sheet-ink block truncate text-[11px]">{t("lead", { title: lead })}</span>}
              </span>
              <b
                className={cn(
                  "font-semibold tabular-nums",
                  kind === "up" ? "text-success" : "text-destructive",
                )}
                title={t("gainHint")}
              >
                {signed(r.gain)}
              </b>
              <span className="sheet-ink text-right text-[11.5px] tabular-nums">{fmtPct(locale, r.delta30d)}</span>
            </button>
          );
        })
      )}
    </div>
  );
}

export function MoversPanel({ rows, onFocus }: { rows: Row[]; onFocus: (artistId: string) => void }) {
  const t = useTranslations("pulse.movers");
  const m = useMemo(() => splitMovers(rows), [rows]);

  return (
    <div>
      <SheetHeading action={<Link href="/roster">{t("seeAll", { count: rows.length })}</Link>}>
        {t("title")}
      </SheetHeading>
      <MoversGroup kind="up" items={m.up} count={m.upCount} onFocus={onFocus} />
      <MoversGroup kind="down" items={m.down} count={m.downCount} onFocus={onFocus} />
      {m.stableCount > 0 && <p className="sheet-ink mt-2 text-[11.5px]">{t("stable", { count: m.stableCount })}</p>}
    </div>
  );
}
