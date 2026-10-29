"use client";

/**
 * Croissance × marge, en quatre cases écrites (remplace la matrice à bulles, jugée illisible
 * pour un board, Gaël 29/10/2026 : deux axes, une médiane et dix couleurs à décoder).
 *
 * « En croissance » = au-dessus de la médiane des interprètes (croissance mensuelle des streams) ;
 * « rentable » = marge nette 12 mois positive. Les compositeurs n'y entrent pas : leurs revenus
 * passent par la SACEM (diffusion), leur marge calculée sur les streams ne se compare pas.
 * Les marges reposent sur des dépenses de démonstration : badge « Simulé ».
 */
import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { RosterRow } from "@/lib/demo/api";
import { fmtEur, fmtPct } from "@/lib/format";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

type Box = "growingProfitable" | "slowProfitable" | "growingLoss" | "watch";
const BOXES: readonly Box[] = ["slowProfitable", "growingProfitable", "watch", "growingLoss"];

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** La case d'un interprète (pur, testé). */
export function boxOf(growth: number, margin: number, medianGrowth: number): Box {
  const growing = growth > medianGrowth;
  const profitable = margin > 0;
  if (profitable) return growing ? "growingProfitable" : "slowProfitable";
  return growing ? "growingLoss" : "watch";
}

export function RosterQuadrants({ rows, onFocus }: { rows: RosterRow[]; onFocus?: (id: string) => void }) {
  const t = useTranslations("roster");
  const locale = useLocale();
  const performers = useMemo(() => rows.filter((r) => r.kind !== "composer"), [rows]);
  const composers = useMemo(() => rows.filter((r) => r.kind === "composer"), [rows]);
  const med = useMemo(() => median(performers.map((r) => r.growthRate)), [performers]);
  const byBox = useMemo(() => {
    const m = new Map<Box, RosterRow[]>();
    for (const r of performers) {
      const b = boxOf(r.growthRate, r.margin, med);
      m.set(b, [...(m.get(b) ?? []), r]);
    }
    for (const list of m.values()) list.sort((a, b) => b.revenue12m - a.revenue12m);
    return m;
  }, [performers, med]);

  return (
    <div>
      <p className="sheet-ink -mt-1 text-[12.5px]">
        {t("quadrants.rule", { median: fmtPct(locale, med * 100, 1).replace(/^\+/, "") })}{" "}
        <ProvenanceBadge provenance="simulated" className="align-middle" />
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {BOXES.map((b) => {
          const list = byBox.get(b) ?? [];
          return (
            <section key={b} aria-labelledby={`q-${b}`} className="bg-background/70 rounded-xl border px-3.5 py-3">
              <h3 id={`q-${b}`} className="text-[14px] font-semibold tracking-[-0.01em]">
                {t(`quadrants.${b}`)} <span className="text-muted-foreground font-normal tabular-nums">{list.length}</span>
              </h3>
              {list.length === 0 ? (
                <p className="text-muted-foreground mt-1.5 text-[12.5px]">{t("quadrants.nobody")}</p>
              ) : (
                <table className="mt-1.5 w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="text-muted-foreground text-[11.5px]">
                      <th scope="col" className="sr-only">
                        {t("quadrants.colArtist")}
                      </th>
                      <th scope="col" className="pb-1 pl-3 text-right font-normal">
                        {t("quadrants.colRevenue")}
                      </th>
                      <th scope="col" className="pb-1 pl-3 text-right font-normal">
                        {t("quadrants.colGrowth")}
                      </th>
                      <th scope="col" className="pb-1 pl-3 text-right font-normal">
                        {t("quadrants.colMargin")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.slice(0, 6).map((r) => (
                      <tr key={r.id}>
                        <td className="py-0.5">
                          <button type="button" onClick={() => onFocus?.(r.id)} className="text-left font-medium underline-offset-2 hover:underline">
                            {r.name}
                          </button>
                        </td>
                        <td className="text-muted-foreground py-0.5 pl-3 text-right whitespace-nowrap tabular-nums">{fmtEur(locale, r.revenue12m, { compact: true })}</td>
                        <td className="text-muted-foreground py-0.5 pl-3 text-right whitespace-nowrap tabular-nums">{fmtPct(locale, r.growthRate * 100, 1)}</td>
                        <td className="text-muted-foreground py-0.5 pl-3 text-right whitespace-nowrap tabular-nums">{Math.round(r.margin)} %</td>
                      </tr>
                    ))}
                    {list.length > 6 && (
                      <tr>
                        <td colSpan={4} className="text-muted-foreground pt-1 text-[12px]">
                          {t("quadrants.more", { count: list.length - 6 })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>
      {composers.length > 0 && (
        <p className="sheet-ink mt-3 text-[12.5px]">
          {t("quadrants.composers", { names: composers.map((c) => c.name).join(", ") })}{" "}
          <Link href="/placements" className="text-foreground font-medium underline-offset-4 hover:underline">
            {t("quadrants.composersLink")}
          </Link>
        </p>
      )}
    </div>
  );
}
