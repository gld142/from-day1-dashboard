/**
 * Skeleton de navigation : calqué sur le gabarit type des pages du
 * dashboard — PageHeader fantôme, grille de 4 KpiCards fantômes,
 * grand chart fantôme. Purement décoratif (aria-hidden).
 */
import { Skeleton } from "@/components/ui/skeleton";

function KpiCardGhost() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export default function Loading() {
  return (
    <div aria-hidden className="space-y-6">
      {/* PageHeader fantôme */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </header>

      {/* Grille KPI fantôme */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCardGhost />
        <KpiCardGhost />
        <KpiCardGhost />
        <KpiCardGhost />
      </div>

      {/* Grand chart fantôme */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-7 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-[320px] w-full" />
      </div>
    </div>
  );
}
