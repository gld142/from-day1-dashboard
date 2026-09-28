"use client";

import { conversionNote } from "@/components/modules/customer/shared";

/**
 * Mon relevé — l'accueil du mode client. Tout vient du relevé distributeur
 * importé (mensuel) : pas de « hier » ni de « mois en cours » inventés, la
 * période couverte est dite, chaque chiffre est « renseigné » (déclaré par le
 * distributeur). Aucune donnée de démonstration ne peut apparaître ici.
 */
import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { FileUp } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { useCustomer } from "@/lib/customer-mode";
import { fmtCompact, fmtEur, fmtInt, fmtMonth } from "@/lib/format";
import { getUserData, subscribeUserData, type UserData } from "@/lib/userdata/store";

const DSP_LABEL: Record<string, string> = {
  spotify: "Spotify", apple: "Apple Music", youtube: "YouTube", deezer: "Deezer",
  tiktok: "TikTok", amazon: "Amazon Music", other: "Autres",
};
const FORMAT_LABEL: Record<string, string> = { distrokid: "DistroKid", tunecore: "TuneCore", believe: "Believe", generic: "CSV" };

const sum = (o: Record<string, number | undefined>) => Object.values(o).reduce<number>((s, v) => s + (v ?? 0), 0);
const top = (o: Record<string, number>, n: number) => Object.entries(o).sort(([, a], [, b]) => b - a).slice(0, n);

export default function MonRelevePage() {
  const locale = useLocale();
  const customer = useCustomer();
  const data = useSyncExternalStore(subscribeUserData, getUserData, () => null);
  const view = useMemo(() => (data ? summarize(data) : null), [data]);

  if (!data || !view) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Mon relevé" subtitle="Aucun relevé importé pour cet artiste." />
        <Link href="/import" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
          <FileUp className="size-4" aria-hidden /> Importer un relevé
        </Link>
      </div>
    );
  }

  const first = data.months[0];
  const last = data.months[data.months.length - 1];
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <PageHeader
        title={customer?.artistName ?? data.artistName}
        subtitle={`Relevé ${FORMAT_LABEL[data.format] ?? data.format} · ${fmtMonth(locale, first)} → ${fmtMonth(locale, last)} · importé le ${new Date(data.importedAt).toLocaleDateString(locale)}`}
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/revenue" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">Revenus en détail</Link>
          <Link href="/streams" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">Streams en détail</Link>
          <Link href="/import" className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted">Importer un nouveau relevé</Link>
        </div>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Streams sur la période" value={fmtCompact(locale, data.totalStreams)} />
        <Tile label="Revenus sur la période" value={fmtEur(locale, data.totalRevenueEur)} />
        <Tile label="Mois couverts" value={String(data.months.length)} />
        <Tile label="Revenu pour 1 000 streams" value={view.per1000 === null ? "—" : new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(view.per1000)} />
      </section>
      <p className="-mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <ProvenanceBadge provenance="declared" /> Chiffres tels que déclarés par ton distributeur
        {conversionNote(data)}.
      </p>

      <Card title="Mois par mois">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr><th className="py-1.5 font-medium">Mois</th><th className="py-1.5 text-right font-medium">Streams</th><th className="py-1.5 text-right font-medium">Revenus</th></tr>
          </thead>
          <tbody>
            {[...data.months].reverse().map((m) => (
              <tr key={m} className="border-t">
                <td className="py-1.5">{fmtMonth(locale, m)}</td>
                <td className="num py-1.5 text-right">{fmtInt(locale, sum(data.streamsByMonth[m] ?? {}))}</td>
                <td className="num py-1.5 text-right">{fmtEur(locale, data.revenueByMonth[m] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Par plateforme"><Bars rows={view.byDsp.map(([k, v]) => [DSP_LABEL[k] ?? k, v])} total={data.totalStreams} locale={locale} /></Card>
        <Card title="Pays d'écoute"><Bars rows={view.countries} total={data.totalStreams} locale={locale} /></Card>
      </div>
      <Card title="Tes titres les plus écoutés"><Bars rows={view.tracks} total={data.totalStreams} locale={locale} /></Card>
    </div>
  );
}

function summarize(d: UserData) {
  const byDsp: Record<string, number> = {};
  for (const perDsp of Object.values(d.streamsByMonth)) {
    for (const [dsp, n] of Object.entries(perDsp)) byDsp[dsp] = (byDsp[dsp] ?? 0) + (n ?? 0);
  }
  const regionName = (code: string) => {
    try {
      return new Intl.DisplayNames(["fr"], { type: "region" }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  return {
    per1000: d.totalStreams > 0 ? (d.totalRevenueEur / d.totalStreams) * 1000 : null,
    byDsp: top(byDsp, 8),
    countries: top(d.countryStreams, 8).map(([c, n]) => [regionName(c), n] as [string, number]),
    tracks: top(d.trackStreams, 10),
  };
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Bars({ rows, total, locale }: { rows: [string, number][]; total: number; locale: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Pas d&apos;information dans ce relevé.</p>;
  return (
    <ul className="grid gap-2.5">
      {rows.map(([name, n]) => (
        <li key={name} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">{name}</span>
            <span className="num shrink-0 text-muted-foreground">{fmtCompact(locale, n)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${total ? Math.max(2, (n / total) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
