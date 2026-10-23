"use client";

/**
 * « Le label ce mois-ci » — en tête du Roster, vue label seulement : le dernier
 * mois couvert, additionné sur les artistes qui le couvrent, et qui manque.
 * Tout vient des relevés déjà chargés par le roster (RosterArtist[]).
 */
import { useLocale } from "next-intl";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { fmtCompact, fmtEur, fmtMonth } from "@/lib/format";
import { addMonths, type LatestMonth, type RosterAlert } from "@/lib/userdata/roster";

export function LabelMonthSheet({ latest, totalArtists, alerts }: { latest: LatestMonth; totalArtists: number; alerts: RosterAlert[] }) {
  const locale = useLocale();
  const month = (m: string) => fmtMonth(locale, m);
  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });
  const eurCents = (n: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const pct = (n: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(n);
  const n = latest.covered.length;
  const covered = (what: string) => `${what}, ${n} artiste${n > 1 ? "s" : ""} couvert${n > 1 ? "s" : ""}`;
  const change = latest.previous?.change ?? null;
  const behind = latest.uncovered.filter((u) => u.reason === "behind");
  const missing = latest.uncovered.filter((u) => u.reason === "missing");
  const declines = alerts.filter((a): a is Extract<RosterAlert, { kind: "decline" }> => a.kind === "decline");

  return (
    <Sheet family="money" testId="label-month">
      <SheetHeading action={`${month(latest.month)} · dernier mois couvert`}>Le label ce mois-ci</SheetHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{eur(latest.revenue)}</p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {covered("revenus déclarés")}
            {change !== null && latest.previous
              ? ` · ${pct(change)} vs ${month(addMonths(latest.month, -1))}${latest.previous.onArtists < n ? ` (sur ${latest.previous.onArtists} artiste${latest.previous.onArtists > 1 ? "s" : ""})` : ""}`
              : ""}
          </p>
        </div>
        <div>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{fmtCompact(locale, latest.streams)}</p>
          <p className="sheet-ink mt-1.5 text-[13px]">{covered("streams")}</p>
        </div>
      </div>
      <AffiliatedPoints
        points={[
          {
            key: "covered",
            value: `${latest.covered.length} sur ${totalArtists}`,
            label: `artistes avec un relevé pour ${month(latest.month)}`,
            note: missing.length ? `${missing.map((u) => u.name).join(", ")} : aucun relevé importé` : undefined,
          },
          { key: "per1000", value: latest.per1000 === null ? "—" : eurCents(latest.per1000), label: `pour 1 000 streams en ${month(latest.month)}` },
          {
            key: "behind",
            value: String(behind.length),
            label: behind.length > 1 ? "relevés en retard" : "relevé en retard",
            note: behind.length ? behind.map((u) => u.name).join(", ") : "tous les relevés vont jusqu'au dernier mois",
          },
          {
            key: "declines",
            value: String(declines.length),
            label: declines.length > 1 ? "alertes de baisse (≥ 20 % sur 3 mois)" : "alerte de baisse (≥ 20 % sur 3 mois)",
            note: declines.length ? declines.map((a) => a.name).join(", ") : undefined,
          },
        ]}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Navigation complète : le relevé du label est chargé par le layout (dashboard), que Next ne re-rend pas sur une navigation client. */}
        <a href="/revenue?perimetre=label" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">Revenus du label →</a>
        <a href="/streams?perimetre=label" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">Streams du label →</a>
      </div>
    </Sheet>
  );
}
