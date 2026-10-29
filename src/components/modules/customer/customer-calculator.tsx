"use client";

/**
 * /calculator en mode client — un CALCULATEUR sur les taux réels de l'artiste
 * (src/lib/userdata/calculator.ts), pas une projection : « avec X streams,
 * combien ? » et « pour X €, combien de streams ? », selon sa répartition réelle
 * entre plateformes (modifiable).
 */
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Input } from "@/components/ui/input";
import { useCustomer } from "@/lib/customer-mode";
import { platformRates, revenueFor, streamsFor, type Rate } from "@/lib/userdata/calculator";
import { monthSeries } from "@/lib/userdata/statement-insights";
import { getUserData, subscribeUserData } from "@/lib/userdata/store";
import { DSP_LABEL, Dot, SimpleTable, platformColor, statementLine, useFormats } from "./shared";

const toNumber = (v: string) => Number(v.replace(/[\s  €]/g, "").replace(",", ".")) || 0;

export function CustomerCalculator() {
  const f = useFormats();
  const customer = useCustomer();
  const data = useSyncExternalStore(subscribeUserData, getUserData, () => null);
  const real = useMemo(() => (data ? platformRates(data) : []), [data]);
  const avgStreams = useMemo(() => {
    if (!data) return 0;
    const pts = monthSeries(data).filter((p) => !p.missing);
    return pts.length ? Math.round(pts.reduce((s, p) => s + p.streams, 0) / pts.length) : 0;
  }, [data]);

  const [streamsInput, setStreamsInput] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState("1000");
  const [mix, setMix] = useState<Record<string, string>>({});
  const rates: Rate[] = real.map((r) => ({ ...r, share: mix[r.dsp] !== undefined ? toNumber(mix[r.dsp]) / 100 : r.share }));
  const streams = streamsInput === null ? avgStreams : toNumber(streamsInput);
  const result = revenueFor(rates, streams);
  const needed = streamsFor(rates, toNumber(targetInput));
  const mixTotal = Math.round(rates.reduce((s, r) => s + r.share, 0) * 1000) / 10;

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Calculateur" subtitle="Aucun relevé importé pour cet artiste." />
        <Link href="/import" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Importer un relevé</Link>
      </div>
    );
  }

  return (
    <div className="rise-in">
      <PageHeader title="Calculateur" subtitle={`${customer?.artistName ?? data.artistName} · aux taux de ton ${statementLine(data, f.month, f.locale).replace(/^Relevé/, "relevé")}`} />

      {real.length === 0 ? (
        <Sheet family="money">
          <SheetHeading>Taux indisponibles</SheetHeading>
          <p className="sheet-ink text-sm">
            Ce relevé n&apos;a pas le détail des revenus par plateforme (ou trop peu de streams).{" "}
            <Link href="/import" className="underline">Réimporte-le</Link> pour calculer sur tes vrais taux.
          </p>
        </Sheet>
      ) : (
        <div className="space-y-3">
          <Sheet family="money">
            <SheetHeading action="au taux réel de chaque plateforme">Avec combien de streams par mois ?</SheetHeading>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground text-xs">Streams par mois</span>
                <Input inputMode="numeric" className="w-40" value={streamsInput ?? String(avgStreams)} onChange={(e) => setStreamsInput(e.target.value)} />
              </label>
              <p className="text-muted-foreground pb-2 text-xs">Par défaut : ta moyenne mensuelle réelle ({f.compact(avgStreams)}).</p>
            </div>
            <p className="mt-4 text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{f.eurCents(result.total)}</p>
            <p className="sheet-ink mt-1.5 text-[13px]">par mois, soit {result.per1000 === null ? "—" : f.eurCents(result.per1000)} pour 1 000 streams avec cette répartition</p>
            <AffiliatedPoints
              points={result.lines.slice(0, 4).map((l) => ({ key: l.dsp, value: f.eurCents(l.revenue), label: DSP_LABEL[l.dsp] ?? l.dsp, note: `${f.compact(l.streams)} streams` }))}
            />
          </Sheet>

          <Sheet family="money">
            <SheetHeading>Pour toucher combien par mois ?</SheetHeading>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground text-xs">Revenu visé (€ / mois)</span>
                <Input inputMode="decimal" className="w-40" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} />
              </label>
              <p className="pb-2 text-sm">
                il faut environ <b className="num">{needed === null ? "—" : f.int(needed)}</b> streams par mois
                {needed !== null && avgStreams > 0 ? ` (${f.pct(needed / avgStreams)} de ta moyenne actuelle)` : ""}.
              </p>
            </div>
          </Sheet>

          <Sheet family="money">
            <SheetHeading action={mixTotal === 100 ? "répartition réelle de ton relevé" : `total ${mixTotal.toLocaleString(f.locale)} %, ramené à 100 %`}>Plateformes</SheetHeading>
            <SimpleTable
              head={["Plateforme", "Ton taux réel", "Part des streams (%)"]}
              rows={real.map((r) => ({
                key: r.dsp,
                cells: [
                  <span key="n" className="flex items-center gap-2"><Dot color={platformColor(r.dsp)} />{DSP_LABEL[r.dsp] ?? r.dsp}</span>,
                  `${f.eurCents(r.per1000)} / 1 000`,
                  <Input
                    key="m"
                    inputMode="decimal"
                    aria-label={`Part ${DSP_LABEL[r.dsp] ?? r.dsp}`}
                    className="ml-auto h-8 w-24 text-right"
                    value={mix[r.dsp] ?? String(Math.round(r.share * 1000) / 10).replace(".", ",")}
                    onChange={(e) => setMix((m) => ({ ...m, [r.dsp]: e.target.value }))}
                  />,
                ],
              }))}
            />
            <p className="sheet-ink mt-2 text-[11.5px]">
              Change les parts pour voir ce que rapporterait un public plus présent sur une plateforme. Plateformes à moins de 1 000 streams sur le relevé : non comptées.
            </p>
          </Sheet>
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <ProvenanceBadge provenance="declared" /> Calcul sur tes taux réels, qui varient d&apos;un mois à l&apos;autre (pays, abonnés gratuits ou payants) : un ordre de grandeur, pas une promesse.
          </p>
        </div>
      )}
    </div>
  );
}
