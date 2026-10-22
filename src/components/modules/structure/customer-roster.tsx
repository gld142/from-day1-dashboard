"use client";

/**
 * /roster en mode client — la vue structure sur les VRAIS relevés importés.
 *
 * Même question que la démo (à quel point la structure tient à un seul nom ?),
 * mais seulement avec ce qu'un relevé distributeur permet de savoir : streams et
 * revenus déclarés, mois par mois. Pas de genre, de stade, de net, de marge ni
 * de valorisation. Tout se compare sur la même fenêtre de 12 mois (voir
 * src/lib/userdata/roster.ts) ; un relevé en retard est dit, pas maquillé.
 */
import { useMemo } from "react";
import { useLocale } from "next-intl";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ExportMenu } from "@/components/modules/exports/export-menu";
import { PrintStyles } from "@/components/modules/exports/print-styles";
import { LabelMonthSheet } from "@/components/modules/structure/label-month-sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { useCustomer, useCustomerRoster } from "@/lib/customer-mode";
import { downloadCsv, round2 } from "@/lib/export";
import { artistColor, fmtCompact, fmtEur, fmtMonth } from "@/lib/format";
import { DECLINE_ALERT, summarizeRoster, type RosterAlert, type RosterLine } from "@/lib/userdata/roster";

const FORMAT_LABEL: Record<string, string> = { distrokid: "DistroKid", tunecore: "TuneCore", believe: "Believe", generic: "CSV" };

/** Teinte stable par artiste : ordre d'ajout, à l'angle d'or, en partant du violet de la marque (jamais le rouge d'une baisse en premier). */
const hueAt = (i: number) => Math.round((i * 137.5 + 265) % 360);

const openHref = (id: string) => `/espace/ouvrir/${id}`;
const importHref = (id: string) => `/espace/ouvrir/${id}?vers=import`;

export function CustomerRoster() {
  const locale = useLocale();
  const customer = useCustomer();
  const artists = useCustomerRoster();
  const summary = useMemo(() => summarizeRoster(artists ?? []), [artists]);
  const hues = useMemo(() => new Map((artists ?? []).map((a, i) => [a.id, hueAt(i)])), [artists]);

  const pct = (share: number, sign = false) =>
    new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: sign ? "exceptZero" : "auto" }).format(share);
  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });
  const eurCents = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const month = (m: string) => fmtMonth(locale, m);

  const { window, lines, totals, top, alerts } = summary;
  const period = window ? `${month(window.from)} → ${month(window.to)}` : null;
  const missing = totals.artists - totals.withStatement;

  const exportCsv = () =>
    downloadCsv<RosterLine>("day1-roster", lines, [
      { header: "Artiste", cell: (l) => l.name },
      { header: "Relevé du", cell: (l) => l.firstMonth ?? "" },
      { header: "Relevé au", cell: (l) => l.lastMonth ?? "" },
      { header: `Streams (${period ?? "—"})`, cell: (l) => l.streams },
      { header: `Revenus EUR (${period ?? "—"})`, cell: (l) => round2(l.revenue) },
      { header: "Part des revenus %", cell: (l) => round2(l.share * 100) },
      { header: "EUR pour 1000 streams", cell: (l) => (l.per1000 === null ? "" : round2(l.per1000)) },
      { header: "Tendance 3 mois %", cell: (l) => (l.trend === null ? "" : round2(l.trend * 100)) },
    ]);

  return (
    <div className="rise-in">
      <PrintStyles />
      <PageHeader
        title="Roster"
        subtitle={`${totals.artists} artiste${totals.artists > 1 ? "s" : ""} · ${customer?.workspaceName ?? ""}${period ? ` · 12 mois, ${period}` : ""}`}
      >
        {totals.withStatement > 0 && (
          <ExportMenu label="Exporter" csvLabel="Tableau (CSV)" printLabel="Imprimer / PDF" onExportCsv={exportCsv} />
        )}
      </PageHeader>

      {totals.withStatement === 0 ? (
        <Sheet family="money">
          <SheetHeading>Aucun relevé importé</SheetHeading>
          <p className="sheet-ink text-sm">
            Le roster compare les artistes sur leurs relevés distributeur. Importe au moins un relevé pour le voir.
          </p>
          <ul className="mt-3 grid gap-2">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                <ArtistName name={l.name} hue={hues.get(l.id) ?? 0} />
                <a href={importHref(l.id)} className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">Importer un relevé</a>
              </li>
            ))}
          </ul>
        </Sheet>
      ) : (
        <div className="space-y-3">
          {customer?.view === "label" && summary.latest && (
            <LabelMonthSheet latest={summary.latest} totalArtists={totals.artists} alerts={alerts} />
          )}
          {/* À quel point la structure tient à un seul nom. */}
          <Sheet family="money">
            <SheetHeading action={period ? `12 mois · ${period}` : undefined}>Concentration des revenus</SheetHeading>
            <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">
              {top ? pct(top.share) : "—"}
            </p>
            <p className="sheet-ink mt-1.5 text-[13px]">
              {top ? `des revenus de la structure viennent de ${top.name}` : "aucun revenu déclaré sur la période"}
            </p>
            {totals.revenue > 0 && (
              <>
                <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full">
                  {lines
                    .filter((l) => l.revenue > 0)
                    .map((l) => (
                      <div
                        key={l.id}
                        className="h-full"
                        style={{ width: `${l.share * 100}%`, background: artistColor(hues.get(l.id) ?? 0) }}
                        title={`${l.name} · ${eur(l.revenue)}`}
                      />
                    ))}
                </div>
                <p className="sheet-ink mt-1 flex flex-wrap justify-between gap-x-4 text-[11px]">
                  <span>{totals.withStatement > 3 ? `Les trois premiers : ${pct(summary.topThreeShare)}` : "Revenus de la structure"}</span>
                  <span>{eur(totals.revenue)}</span>
                </p>
              </>
            )}
            <p className="sheet-ink mt-2 text-[11.5px] leading-relaxed">
              Plus cette part est haute, plus la structure dépend d&apos;un seul nom.
            </p>
            <AffiliatedPoints
              points={[
                {
                  key: "artists",
                  value: String(totals.artists),
                  label: "Artistes",
                  note: missing > 0 ? `dont ${missing} sans relevé` : undefined,
                },
                { key: "streams", value: fmtCompact(locale, totals.streams), label: "Streams sur 12 mois" },
                { key: "revenue", value: eur(totals.revenue), label: "Revenus sur 12 mois" },
                {
                  key: "per1000",
                  value: totals.per1000 === null ? "—" : eurCents(totals.per1000),
                  label: "Revenu pour 1 000 streams",
                },
              ]}
            />
          </Sheet>
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <ProvenanceBadge provenance="declared" /> Chiffres tels que déclarés par les distributeurs, convertis en euros à l&apos;import.
          </p>

          {/* Le tableau : chaque artiste sur la même fenêtre. */}
          <Sheet family="money">
            <SheetHeading action={period ? `Streams et revenus : ${period}` : undefined}>Artistes</SheetHeading>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sheet-ink text-left text-xs">
                  <tr>
                    <th className="px-1 py-1.5 font-medium">Artiste</th>
                    <th className="px-1 py-1.5 font-medium">Relevé</th>
                    <th className="px-1 py-1.5 text-right font-medium">Streams</th>
                    <th className="px-1 py-1.5 text-right font-medium">Revenus</th>
                    <th className="px-1 py-1.5 text-right font-medium">Part</th>
                    <th className="px-1 py-1.5 text-right font-medium">/ 1 000 streams</th>
                    <th className="px-1 py-1.5 text-right font-medium" title="Revenus des 3 derniers mois du relevé, contre les 3 mois d'avant">
                      Tendance 3 mois
                    </th>
                    <th className="px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-t border-current/10">
                      <td className="px-1 py-2">
                        <ArtistName name={l.name} hue={hues.get(l.id) ?? 0} />
                      </td>
                      <td className="px-1 py-2 text-xs">
                        {l.hasStatement && l.firstMonth && l.lastMonth ? (
                          <>
                            <span>{`${month(l.firstMonth)} → ${month(l.lastMonth)}`}</span>
                            <span className="text-muted-foreground block">
                              {l.format ? (FORMAT_LABEL[l.format] ?? l.format) : ""}
                              {l.behind ? " · en retard" : ""}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Aucun relevé</span>
                        )}
                      </td>
                      <td className="num px-1 py-2 text-right">{l.hasStatement ? fmtCompact(locale, l.streams) : "—"}</td>
                      <td className="num px-1 py-2 text-right">{l.hasStatement ? eur(l.revenue) : "—"}</td>
                      <td className="num px-1 py-2 text-right">{l.hasStatement ? pct(l.share) : "—"}</td>
                      <td className="num px-1 py-2 text-right">{l.per1000 === null ? "—" : eurCents(l.per1000)}</td>
                      <td className={`num px-1 py-2 text-right ${l.trend !== null && l.trend <= DECLINE_ALERT ? "text-destructive" : ""}`}>
                        {l.trend === null ? "—" : pct(l.trend, true)}
                      </td>
                      <td className="px-1 py-2 text-right">
                        {l.hasStatement ? (
                          <a href={openHref(l.id)} className="rounded-md border px-2.5 py-1 text-xs whitespace-nowrap hover:bg-muted">Ouvrir</a>
                        ) : (
                          <a href={importHref(l.id)} className="rounded-md border px-2.5 py-1 text-xs whitespace-nowrap hover:bg-muted">Importer</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Sheet>

          {/* Ce qui demande une action. */}
          <Sheet family="trends">
            <SheetHeading action="Tiré des relevés importés">À surveiller</SheetHeading>
            {alerts.length === 0 ? (
              <p className="sheet-ink text-sm">Rien à signaler : tous les relevés sont à jour, aucune baisse de 20 % ou plus.</p>
            ) : (
              <ul className="grid gap-2">
                {alerts.map((a) => (
                  <li key={`${a.kind}-${a.id}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>{alertText(a, month, pct)}</span>
                    <a
                      href={a.kind === "decline" ? openHref(a.id) : importHref(a.id)}
                      className="rounded-md border px-2.5 py-1 text-xs whitespace-nowrap hover:bg-muted"
                    >
                      {a.kind === "decline" ? "Ouvrir" : a.kind === "missing" ? "Importer" : "Mettre à jour"}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Sheet>
        </div>
      )}
    </div>
  );
}

function alertText(a: RosterAlert, month: (m: string) => string, pct: (s: number, sign?: boolean) => string): string {
  switch (a.kind) {
    case "missing":
      return `${a.name} : aucun relevé importé, absent des totaux.`;
    case "behind":
      return `${a.name} : relevé arrêté à ${month(a.lastMonth)}, les mois suivants ne sont pas comptés.`;
    case "decline":
      return `${a.name} : revenus ${pct(a.change, true)} sur ses 3 derniers mois, contre les 3 d'avant.`;
  }
}

function ArtistName({ name, hue }: { name: string; hue: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: artistColor(hue) }} aria-hidden />
      <span className="truncate font-medium">{name}</span>
    </span>
  );
}
