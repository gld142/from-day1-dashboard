"use client";

/**
 * /market en mode client — les classements Apple Music « les plus écoutés »
 * (100 titres, 10 pays) relevés chaque nuit depuis le flux officiel d'Apple :
 * ton roster dedans, et chaque classement avec ses mouvements depuis la veille.
 * Rien d'estimé : des positions mesurées. Remplace le Top 200 Spotify de la
 * démo (relevé sur Kworb, source exclue du produit).
 */
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { APPLE_COUNTRIES, APPLE_COUNTRY_LABEL, type AppleCountry } from "@/lib/collect/apple-music";
import { useCustomer, useCustomerSignals } from "@/lib/customer-mode";
import { artistMatches, chartMovements, rosterInCharts, type ChartRow } from "@/lib/market/charts";
import { cn } from "@/lib/utils";
import { MovementBadge, SourceLine, longDate } from "./signals-ui";
import { useFormats } from "./shared";

/** Entrées d'un artiste regroupées par pays : nombre de titres et meilleure place. */
function byCountry(entries: ChartRow[]) {
  const m = new Map<string, { country: string; count: number; best: ChartRow }>();
  for (const e of entries) {
    const c = m.get(e.country);
    if (!c) m.set(e.country, { country: e.country, count: 1, best: e });
    else {
      c.count++;
      if (e.position < c.best.position) c.best = e;
    }
  }
  return [...m.values()].sort((a, b) => a.best.position - b.best.position || b.count - a.count);
}

export function CustomerMarket() {
  const f = useFormats();
  const customer = useCustomer();
  const signals = useCustomerSignals();
  const charts = signals?.charts ?? null;
  const [country, setCountry] = useState<AppleCountry>("fr");

  const view = useMemo(() => {
    if (!charts?.latestDate) return null;
    const roster = rosterInCharts(charts.latest, signals?.artists ?? []);
    const rows = charts.latest.filter((r) => r.country === country);
    const moves = chartMovements(rows, charts.previous.filter((r) => r.country === country));
    const countries = new Set(charts.latest.map((r) => r.country));
    return { roster, rows, moves, countries };
  }, [charts, country, signals?.artists]);

  const runs = signals?.runs ?? [];
  if (!charts?.latestDate || !view) {
    return (
      <div className="rise-in">
        <PageHeader title="Marché" subtitle="Classements Apple Music · 10 pays" />
        <Sheet family="trends">
          <SheetHeading>Classements</SheetHeading>
          <p className="text-sm">Aucun classement relevé pour l&apos;instant. La collecte tourne chaque nuit : les 100 titres les plus écoutés sur Apple Music dans 10 pays.</p>
        </Sheet>
        <SourceLine source="apple_music" runs={runs} locale={f.locale} className="mt-3" />
      </div>
    );
  }

  const isRoster = (artist: string) => (signals?.artists ?? []).some((a) => artistMatches(artist, a.name));
  const entries = view.roster.reduce((n, a) => n + a.entries.length, 0);
  const best = view.roster.flatMap((a) => a.entries.map((e) => ({ ...e, who: a.artistName }))).sort((a, b) => a.position - b.position)[0];

  return (
    <div className="rise-in">
      <PageHeader title="Marché" subtitle={`Classements Apple Music du ${longDate(charts.latestDate, f.locale)} · ${view.countries.size} pays · ${customer?.workspaceName ?? ""}`} />
      <div className="space-y-3">
        <Sheet family="trends">
          <SheetHeading action={`100 titres × ${view.countries.size} pays`}>Ton roster dans les classements</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{entries}</p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {entries === 0
              ? "Aucun de tes artistes dans les 100 titres les plus écoutés sur Apple Music aujourd'hui, dans ces 10 pays."
              : `place${entries > 1 ? "s" : ""} occupée${entries > 1 ? "s" : ""} par ton roster aujourd'hui (un titre classé dans 3 pays compte 3 places)`}
          </p>
          {entries > 0 && (
            <AffiliatedPoints
              points={[
                { key: "titles", value: String(new Set(view.roster.flatMap((a) => a.entries.map((e) => e.item_id))).size), label: "Titres différents", note: `${view.roster.length} artiste${view.roster.length > 1 ? "s" : ""}` },
                { key: "best", value: best ? `n° ${best.position}` : "—", label: "Meilleure place", note: best ? `${best.who} · ${APPLE_COUNTRY_LABEL[best.country as AppleCountry] ?? best.country}` : undefined },
                { key: "countries", value: String(new Set(view.roster.flatMap((a) => a.entries.map((e) => e.country))).size), label: "Pays" },
              ]}
            />
          )}
          {view.roster.map((a) => (
            <div key={a.artistId} className="mt-4">
              <p className="mb-1 text-sm font-medium">{a.artistName}</p>
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sheet-ink text-left text-xs">
                    <tr>
                      <th className="px-1 py-1 font-medium">Pays</th>
                      <th className="px-1 py-1 text-right font-medium">Titres dans le top 100</th>
                      <th className="px-1 py-1 text-right font-medium">Meilleure place</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCountry(a.entries).map((c) => (
                      <tr key={c.country} className="border-t border-current/10">
                        <td className="px-1 py-1">
                          <button type="button" className="hover:underline" onClick={() => setCountry(c.country as AppleCountry)}>
                            {APPLE_COUNTRY_LABEL[c.country as AppleCountry] ?? c.country}
                          </button>
                        </td>
                        <td className="num px-1 py-1 text-right">{c.count}</td>
                        <td className="px-1 py-1 text-right">
                          <span className="num">n° {c.best.position}</span> <span className="text-muted-foreground">« {c.best.title} »</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Sheet>
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <ProvenanceBadge provenance="measured" /> Positions relevées dans le flux officiel d&apos;Apple Music. Un artiste est reconnu quand son nom est crédité sur le titre (featurings compris).
        </p>

        <Sheet family="trends">
          <SheetHeading action={charts.previousDate ? `mouvements depuis le ${longDate(charts.previousDate, f.locale)}` : "mouvements dès le 2e jour de collecte"}>
            Top 100 · {APPLE_COUNTRY_LABEL[country]}
          </SheetHeading>
          <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Pays">
            {APPLE_COUNTRIES.filter((c) => view.countries.has(c)).map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={c === country}
                onClick={() => setCountry(c)}
                className={cn("rounded-full border px-2.5 py-1 text-xs", c === country ? "bg-foreground text-background border-foreground" : "hover:bg-muted")}
              >
                {APPLE_COUNTRY_LABEL[c]}
              </button>
            ))}
          </div>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sheet-ink text-left text-xs">
                <tr>
                  <th className="px-1 py-1.5 font-medium">N°</th>
                  <th className="px-1 py-1.5 font-medium">Évol.</th>
                  <th className="px-1 py-1.5 font-medium">Titre</th>
                  <th className="px-1 py-1.5 font-medium">Artiste</th>
                  <th className="hidden px-1 py-1.5 font-medium sm:table-cell">Genre</th>
                  <th className="hidden px-1 py-1.5 text-right font-medium md:table-cell">Sortie</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r.item_id} className={cn("border-t border-current/10", isRoster(r.artist_name) && "bg-brand/10 font-medium")}>
                    <td className="num px-1 py-1.5">{r.position}</td>
                    <td className="px-1 py-1.5">
                      <MovementBadge m={view.moves.get(r.item_id)} />
                    </td>
                    <td className="px-1 py-1.5">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {r.title}
                        </a>
                      ) : (
                        r.title
                      )}
                    </td>
                    <td className="px-1 py-1.5">{r.artist_name}</td>
                    <td className="text-muted-foreground hidden px-1 py-1.5 sm:table-cell">{r.genres[0] ?? ""}</td>
                    <td className="text-muted-foreground num hidden px-1 py-1.5 text-right md:table-cell">{r.release_date ? longDate(r.release_date, f.locale) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Sheet>
        <SourceLine source="apple_music" runs={runs} locale={f.locale} />
        <p className="text-muted-foreground text-xs">
          Source : Apple Music (flux officiel des classements). Le classement est daté du jour de la collecte : Apple ne publie pas l&apos;heure de mise à jour de ses classements. Chaque titre renvoie vers Apple Music.
        </p>
      </div>
    </div>
  );
}
