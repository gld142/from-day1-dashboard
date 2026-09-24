"use client";

/**
 * Widgets Droits FR : carte par organisme (SACEM, ADAMI, SPEDIDAM, SPRE)
 * et timeline des prochains versements.
 */
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CalendarDays, Check, Clock, TriangleAlert } from "lucide-react";
import type {
  Artist,
  Provenance,
  RightsOrganism,
  RightsStatement,
} from "@/lib/demo/types";
import { artistColor, fmtDate, fmtEur } from "@/lib/format";
import { weakest } from "@/lib/real";
import { cn } from "@/lib/utils";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { Badge } from "@/components/ui/badge";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type RightsRow = {
  organism: RightsOrganism;
  period: string;
  expected: number;
  received: number;
  status: RightsStatement["status"];
  /** La plus faible des provenances agrégées (roster) : « estimé » ou « simulé ». */
  expectedProvenance: Provenance;
  receivedProvenance: Provenance;
};

export const ORGANISM_ORDER: RightsOrganism[] = ["sacem", "adami", "spedidam", "spre"];

export const ORGANISM_COLORS: Record<RightsOrganism, string> = {
  sacem: "var(--chart-1)",
  adami: "var(--chart-2)",
  spedidam: "var(--chart-3)",
  spre: "var(--chart-4)",
};

/** "2025-T4" → { year: "2025", q: "4" } */
export function parsePeriod(period: string): { year: string; q: string } {
  const [year, t] = period.split("-T");
  return { year, q: t };
}

export function StatementStatusBadge({ status }: { status: RightsStatement["status"] }) {
  const t = useTranslations("rights");
  if (status === "received") {
    return (
      <Badge variant="outline" className="border-transparent bg-success/10 text-success">
        <Check aria-hidden />
        {t("status.received")}
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
        <Clock aria-hidden />
        {t("status.pending")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-transparent bg-warning/10 text-warning">
      <TriangleAlert aria-hidden />
      {t("status.gap")}
    </Badge>
  );
}

export function OrganismCard({
  organism,
  rows,
  received12m,
  receivedProvenance,
  bare = false,
}: {
  organism: RightsOrganism;
  rows: RightsRow[];
  received12m: number;
  /** Badge à côté de « Reçu 12 mois » : le reçu est un relevé simulé tant qu'aucun vrai relevé n'est importé. */
  receivedProvenance?: Provenance;
  /** Dans une feuille teintée : pas de carte, l'encre de la famille. */
  bare?: boolean;
}) {
  const t = useTranslations("rights");
  const locale = useLocale();
  const color = ORGANISM_COLORS[organism];

  return (
    <section
      className={cn(
        "min-w-0",
        bare ? "sheet-rule pt-3 first:border-t-0 first:pt-0" : "bg-card rounded-xl border p-5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: color }}
            />
            {organism.toUpperCase()}
          </h3>
          <p className={cn("mt-0.5 truncate text-[11px]", bare ? "sheet-ink" : "text-muted-foreground")}>
            {t(`organisms.${organism}.name`)}
          </p>
          <p className={cn("mt-1 text-xs leading-snug", bare ? "sheet-ink" : "text-muted-foreground")}>
            {t(`organisms.${organism}.desc`)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("flex items-center justify-end gap-1.5 text-[11px]", bare ? "sheet-ink" : "text-muted-foreground")}>
            {t("orgCard.received12m")}
            {receivedProvenance && <ProvenanceBadge provenance={receivedProvenance} />}
          </p>
          <p className="num text-lg font-semibold">{fmtEur(locale, received12m)}</p>
        </div>
      </div>

      <div className="mt-2 min-w-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("orgCard.period")}</TableHead>
              <TableHead className="text-right">{t("orgCard.expected")}</TableHead>
              <TableHead className="text-right">{t("orgCard.received")}</TableHead>
              <TableHead className="w-24" />
              <TableHead className="text-right">{t("orgCard.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const ratio =
                r.expected === 0 ? 0 : Math.min(100, (r.received / r.expected) * 100);
              const p = parsePeriod(r.period);
              return (
                <TableRow key={r.period}>
                  <TableCell className="num whitespace-nowrap font-medium">
                    {t("periodShort", { q: p.q, year: p.year })}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {fmtEur(locale, r.expected)}
                  </TableCell>
                  <TableCell className="num text-right font-medium">
                    {r.status === "pending" ? "—" : fmtEur(locale, r.received)}
                  </TableCell>
                  <TableCell>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${ratio}%`,
                          background:
                            r.status === "gap-detected" ? "var(--warning)" : color,
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <StatementStatusBadge status={r.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export type ScheduledPayment = {
  organism: RightsOrganism;
  date: string; // ISO
  frequency: "quarterly" | "semiannual";
  estimated: number;
};

export function PaymentsTimeline({
  payments,
  bare = false,
}: {
  payments: ScheduledPayment[];
  /** Dans une feuille teintée : le titre vient du `SheetHeading`. */
  bare?: boolean;
}) {
  const t = useTranslations("rights");
  const locale = useLocale();

  return (
    <section className={bare ? "min-w-0" : "bg-card rounded-xl border p-5"}>
      {!bare && (
        <>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="text-muted-foreground size-4" aria-hidden />
            {t("timeline.heading")}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">{t("timeline.sub")}</p>
        </>
      )}

      <ol className={cn("flex flex-col", bare ? "mt-2" : "mt-4")}>
        {payments.map((p, i) => (
          <li key={`${p.organism}-${p.date}`} className="relative flex gap-3 pb-4 last:pb-0">
            {i < payments.length - 1 && (
              <span
                aria-hidden
                className="bg-border absolute top-4 left-[5px] h-full w-px"
              />
            )}
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-[11px] shrink-0 rounded-full border-2",
                bare ? "border-[var(--sheet-paper)]" : "border-card",
              )}
              style={{ background: ORGANISM_COLORS[p.organism] }}
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="num text-sm font-medium">
                {fmtDate(locale, p.date)}
              </span>
              <span className="text-sm font-semibold">{p.organism.toUpperCase()}</span>
              <Badge variant="outline" className="text-muted-foreground">
                {t(`timeline.frequency.${p.frequency}`)}
              </Badge>
              <span className={cn("num ml-auto text-sm", bare ? "sheet-ink" : "text-muted-foreground")}>
                {t("timeline.estimated", {
                  amount: fmtEur(locale, p.estimated, { compact: true }),
                })}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Une ligne de la ventilation par artiste — l'attendu, le reçu et l'écart d'un
 * artiste sur la fenêtre de la page. Les montants sont calculés dans la page,
 * à partir des MÊMES relevés que l'agrégat (organisme, période) : une ligne ne
 * peut donc pas être cadrée sur une autre période que le reste de /rights.
 */
export type ArtistRightsRow = {
  artist: Pick<Artist, "id" | "hue" | "initials" | "name">;
  expected: number;
  received: number;
  /** Somme des sous-versements constatés — mêmes relevés que la page zoomée. */
  gap: number;
  gapCount: number;
  /** Répartition de l'écart par organisme, décroissante — « chez qui ». */
  gapByOrganism: Array<{ organism: RightsOrganism; amount: number }>;
  /** Part de l'attendu encore en cours de traitement (trimestre non réparti). */
  pending: number;
  expectedProvenance: Provenance;
  receivedProvenance: Provenance;
};

/**
 * Ventilation par artiste — vue structure agrégée uniquement.
 *
 * Répond à « quel artiste attend combien, et chez quel organisme » : l'agrégat
 * (organisme, période) du reste de la page ne le dit pas. Trié par écart
 * décroissant, c'est-à-dire par ce qu'on va chercher en premier.
 *
 * La barre reprend le langage des cartes organisme : le remplissage est le taux
 * de versement (reçu / attendu), en ambre dès qu'un écart est constaté.
 */
export function ArtistRightsBreakdown({
  rows,
  onSelect,
}: {
  rows: readonly ArtistRightsRow[];
  onSelect: (artistId: string) => void;
}) {
  const t = useTranslations("rights");
  const locale = useLocale();
  const eur = (n: number) => fmtEur(locale, n, { compact: Math.abs(n) >= 100_000 });

  return (
    <div className="mt-1 flex flex-col">
      {rows.map((r) => {
        const ratio = r.expected === 0 ? 0 : Math.min(100, (r.received / r.expected) * 100);
        return (
          <button
            key={r.artist.id}
            type="button"
            onClick={() => onSelect(r.artist.id)}
            className="sheet-rule group w-full border-t px-1 py-2.5 text-left transition-colors first:border-t-0 first:pt-0 hover:bg-[color-mix(in_oklab,var(--sheet-line)_8%,transparent)]"
          >
            <div className="flex items-center gap-3">
              <ArtistBadge
                artist={r.artist}
                size="md"
                meta={r.gapCount > 0 ? t("byArtist.gapCount", { count: r.gapCount }) : undefined}
                className="min-w-0 flex-1"
              />
              <span className="sheet-ink shrink-0 text-[11px]">{t("byArtist.gap")}</span>
              <span
                className={cn(
                  "num shrink-0 text-right text-base font-semibold",
                  r.gap > 0 && "text-warning",
                )}
              >
                {r.gap > 0 ? eur(r.gap) : "—"}
              </span>
              <ProvenanceBadge
                provenance={weakest([r.expectedProvenance, r.receivedProvenance])}
                className="hidden shrink-0 sm:inline-flex"
              />
              <ArrowRight
                className="sheet-ink hidden size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 sm:block"
                aria-hidden
              />
            </div>

            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${ratio}%`,
                  background: r.gap > 0 ? "var(--warning)" : artistColor(r.artist.hue),
                }}
              />
            </div>

            <div className="sheet-ink mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
              <span className="inline-flex items-center gap-1.5">
                {t("byArtist.expected")}
                <b className="num text-foreground font-semibold">{eur(r.expected)}</b>
                <ProvenanceBadge provenance={r.expectedProvenance} />
              </span>
              <span className="inline-flex items-center gap-1.5">
                {t("byArtist.received")}
                <b className="num text-foreground font-semibold">{eur(r.received)}</b>
                <ProvenanceBadge provenance={r.receivedProvenance} />
              </span>
              {r.pending > 0 && <span>{t("byArtist.pending", { amount: eur(r.pending) })}</span>}
            </div>

            <div className="sheet-ink mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
              {r.gapByOrganism.length === 0 ? (
                <span>{t("byArtist.noGap")}</span>
              ) : (
                <>
                  <span>{t("byArtist.gapAt")}</span>
                  {r.gapByOrganism.map((g) => (
                    <span key={g.organism} className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ background: ORGANISM_COLORS[g.organism] }}
                      />
                      <span className="font-medium">{g.organism.toUpperCase()}</span>
                      <b className="num text-foreground font-semibold">{eur(g.amount)}</b>
                    </span>
                  ))}
                </>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
