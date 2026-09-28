"use client";

/**
 * /catalog en mode client — chaque titre des relevés importés, ce qu'il
 * rapporte et l'état de son split (src/lib/splits/catalog.ts). Pour le
 * propriétaire et l'équipe, tous les artistes de l'espace ; pour l'artiste
 * invité, les siens (RLS).
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { AffiliatedPoints, Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Input } from "@/components/ui/input";
import { useCustomer, useCustomerSplits } from "@/lib/customer-mode";
import { catalogRows } from "@/lib/splits/catalog";
import { normTitle } from "@/lib/splits/split";
import { SimpleTable, useFormats } from "./shared";

const SPLIT_LABEL = { none: "à faire", draft: "en cours", agreed: "confirmé" } as const;

export function CustomerCatalog() {
  const f = useFormats();
  const customer = useCustomer();
  const data = useCustomerSplits();
  const [query, setQuery] = useState("");
  const rows = useMemo(() => (data ? catalogRows(data) : []), [data]);
  const shown = useMemo(() => {
    const q = normTitle(query);
    return q ? rows.filter((r) => normTitle(r.title).includes(q) || normTitle(r.artistName).includes(q)) : rows;
  }, [rows, query]);

  const withRevenue = rows.filter((r) => r.revenue !== null);
  const total = withRevenue.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const top = withRevenue[0];
  const noSplit = rows.filter((r) => r.split === "none").length;
  const artists = new Set(rows.map((r) => r.artistId)).size;

  return (
    <div className="rise-in">
      <PageHeader title="Catalogue" subtitle={`${rows.length} titre${rows.length > 1 ? "s" : ""} dans les relevés · ${customer?.workspaceName ?? ""}`} />

      <div className="space-y-3">
        <Sheet family="catalog">
          <SheetHeading action="sur la période de chaque relevé">Répertoire</SheetHeading>
          <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl">{rows.length}</p>
          <p className="sheet-ink mt-1.5 text-[13px]">
            {rows.length === 0 ? "Aucun titre : importe un relevé pour voir ton catalogue." : `titre${rows.length > 1 ? "s" : ""} déclaré${rows.length > 1 ? "s" : ""} par les distributeurs, ${artists} artiste${artists > 1 ? "s" : ""}`}
          </p>
          <AffiliatedPoints
            points={[
              { key: "revenue", value: withRevenue.length ? f.eur(total) : "—", label: "Revenus du catalogue" },
              {
                key: "top",
                value: top && total > 0 ? f.pct((top.revenue ?? 0) / total) : "—",
                label: "Part du premier titre",
                note: top ? top.title : undefined,
              },
              { key: "nosplit", value: String(noSplit), label: "Titres sans split", note: noSplit ? "à définir dans Splits" : undefined },
              { key: "streams", value: f.compact(rows.reduce((s, r) => s + r.streams, 0)), label: "Streams" },
            ]}
          />
        </Sheet>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="declared" /> Titres et chiffres tels que déclarés dans les relevés importés ; l&apos;ISRC vient du split quand il est saisi.
        </p>

        {rows.length > 0 && (
          <Sheet family="catalog">
            <SheetHeading action={`${shown.length} / ${rows.length}`}>Titres</SheetHeading>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un titre ou un artiste" aria-label="Chercher un titre ou un artiste" className="mb-3 max-w-sm" />
            <SimpleTable
              head={["Titre", "Artiste", "Revenus", "Streams", "Pour 1 000", "Part artiste", "Split"]}
              rows={shown.map((r) => ({
                key: `${r.artistId}:${r.title}`,
                cells: [
                  <span key="t" className="block max-w-[16rem] truncate" title={r.isrc ? `ISRC ${r.isrc}` : undefined}>{r.title}</span>,
                  r.artistName,
                  r.revenue === null ? "—" : f.eurCents(r.revenue),
                  f.compact(r.streams),
                  r.per1000 === null || r.streams < 1_000 ? "—" : f.eurCents(r.per1000),
                  r.artistShare === null ? "—" : f.pct(r.artistShare),
                  <Link key="s" href="/splits" className={`font-sans text-xs underline-offset-2 hover:underline ${r.split === "none" ? "text-destructive" : r.split === "draft" ? "text-warning" : "text-success"}`}>
                    {SPLIT_LABEL[r.split]}
                  </Link>,
                ],
              }))}
            />
          </Sheet>
        )}
      </div>
    </div>
  );
}
