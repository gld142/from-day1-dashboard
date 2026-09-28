"use client";

/**
 * /day1-index en mode client — la note Day 1 CALCULÉE sur des mesures (relevés
 * importés, droits, concerts et sync saisis), formule affichée, dimension par
 * dimension. Une dimension sans donnée n'est pas devinée : elle est exclue et
 * la note dit sur combien de dimensions elle repose. Comparaison limitée au
 * roster de l'espace — aucune donnée d'un autre client n'entre dans le calcul.
 */
import { useMemo } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { parisDate } from "@/lib/collect/dates";
import { useCustomer, useCustomerFinances, useCustomerRoster } from "@/lib/customer-mode";
import { computeDay1Index, type Day1Index } from "@/lib/index/day1-index";
import { cn } from "@/lib/utils";

export function CustomerIndex() {
  const customer = useCustomer();
  const roster = useCustomerRoster();
  const finances = useCustomerFinances();

  const scores = useMemo(() => {
    const today = parisDate(new Date());
    return (roster ?? []).map((a) => {
      const streamsByMonth: Record<string, number> = {};
      for (const [m, byDsp] of Object.entries(a.statement?.streamsByMonth ?? {})) {
        streamsByMonth[m] = Object.values(byDsp ?? {}).reduce<number>((t, v) => t + (v ?? 0), 0);
      }
      const mine = <T extends { artistId: string }>(xs: T[] | undefined) => (xs ?? []).filter((x) => x.artistId === a.id);
      const index = computeDay1Index({ streamsByMonth, rights: mine(finances?.rights), shows: mine(finances?.shows), sync: mine(finances?.sync) }, today);
      return { id: a.id, name: a.name, index };
    });
  }, [roster, finances]);

  const current = scores.find((s) => s.id === customer?.artistId) ?? scores[0];
  const ranking = [...scores].sort((a, b) => (b.index.score ?? -1) - (a.index.score ?? -1));

  return (
    <div className="rise-in">
      <PageHeader title="Day 1 Index" subtitle={`Une note calculée sur tes données, formule à l'appui · ${customer?.workspaceName ?? ""}`} />
      <div className="space-y-3">
        {current ? <IndexSheet name={current.name} index={current.index} /> : <Sheet family="catalog"><p className="text-sm">Aucun artiste dans cet espace.</p></Sheet>}
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ProvenanceBadge provenance="measured" /> Calculé sur tes relevés importés et tes saisies (droits, concerts, sync). Rien n&apos;est estimé ; une dimension sans donnée est exclue.
        </p>

        {ranking.length > 1 && (
          <Sheet family="catalog">
            <SheetHeading action="dans ton roster seulement">Classement du roster</SheetHeading>
            <ol className="grid gap-1.5 text-sm">
              {ranking.map((s, i) => (
                <li key={s.id} className={cn("flex items-baseline justify-between gap-3 border-t border-current/10 pt-1.5 first:border-t-0 first:pt-0", s.id === current?.id && "font-medium")}>
                  <span>
                    <span className="sheet-ink mr-2 tabular-nums">{s.index.score === null ? "–" : i + 1}</span>
                    {s.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    <b className="text-foreground num text-sm">{s.index.score ?? "—"}</b> {s.index.score === null ? "pas assez de données" : `sur ${s.index.measured} dimension${s.index.measured > 1 ? "s" : ""}`}
                  </span>
                </li>
              ))}
            </ol>
          </Sheet>
        )}
        <p className="text-muted-foreground text-xs">
          Formule : moyenne des dimensions mesurées. Deux notes calculées sur un nombre différent de dimensions ne se comparent qu&apos;avec prudence.
        </p>
      </div>
    </div>
  );
}

function IndexSheet({ name, index }: { name: string; index: Day1Index }) {
  return (
    <Sheet family="catalog">
      <SheetHeading>Day 1 Index · {name}</SheetHeading>
      <p className="text-5xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-6xl">
        {index.score ?? "—"}
        {index.score !== null ? <span className="text-muted-foreground text-xl font-normal"> /100</span> : null}
      </p>
      <p className="sheet-ink mt-1.5 text-[13px]">
        {index.score === null ? "Pas encore de donnée mesurée pour calculer une note." : `calculé sur ${index.measured} dimension${index.measured > 1 ? "s" : ""} mesurée${index.measured > 1 ? "s" : ""} sur 5`}
      </p>
      <ul className="sheet-rule mt-4 grid gap-3 pt-3">
        {index.dimensions.map((d) => (
          <li key={d.key} className="grid gap-0.5 text-sm sm:grid-cols-[12rem_4rem_1fr] sm:gap-3">
            <span className="font-medium">{d.label}</span>
            <span className={cn("num tabular-nums", d.score === null && "text-muted-foreground")}>{d.score === null ? "—" : Math.round(d.score)}</span>
            <span className="text-xs leading-relaxed">
              {d.score === null ? (
                <span className="text-muted-foreground">Non mesurée : {d.missing}</span>
              ) : (
                <>
                  {d.measure}
                  <span className="text-muted-foreground block">
                    {d.formula} · source : {d.source}
                  </span>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
