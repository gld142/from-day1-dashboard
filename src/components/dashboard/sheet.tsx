"use client";

/**
 * Feuille teintée — l'unité de base de Pulse.
 *
 * La couleur code la famille d'information (streams / argent / audience /
 * tendances / catalogue), pas la décoration : un chiffre se reconnaît à la couleur de sa
 * feuille, sur toutes les pages. Les tokens vivent dans globals.css et sont
 * déclinés sur les trois thèmes.
 *
 * Deux gabarits, validés le 22/09 :
 *  - H (Pulse) : le chiffre clé au centre, ses points affiliés dessous,
 *    rattachés par un filet de la couleur de la famille — `AffiliatedPoints`.
 *  - I (autres pages) : le chiffre clé à gauche, ses lignes à droite —
 *    `AttachedLines`.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SheetFamily = "streams" | "money" | "audience" | "trends" | "catalog";

const FAMILY_CLASS: Record<SheetFamily, string> = {
  streams: "sheet-streams",
  money: "sheet-money",
  audience: "sheet-audience",
  trends: "sheet-trends",
  catalog: "sheet-catalog",
};

export function Sheet({
  family,
  className,
  children,
}: {
  family: SheetFamily;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("sheet", FAMILY_CLASS[family], className)}>
      {children}
    </section>
  );
}

/**
 * Le nom de la famille, en capitales fines dans l'encre de la feuille.
 * `action` pose un lien discret aligné à droite (« voir le détail → »).
 */
export function SheetHeading({
  children,
  action,
  centered = false,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  centered?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "sheet-ink mb-1.5 flex items-baseline gap-3 text-[11px] font-semibold tracking-[0.08em] uppercase",
        centered ? "justify-center" : "justify-between",
        className,
      )}
    >
      <span>{children}</span>
      {action ? (
        <span className="text-[11px] font-medium tracking-normal normal-case opacity-75">
          {action}
        </span>
      ) : null}
    </p>
  );
}

/**
 * Le chiffre clé posé au centre de son graphique, dans une réserve à la teinte
 * de la feuille — le gabarit H. Sous 640 px il repasse en titre au-dessus :
 * au centre d'un écran étroit, il recouvrirait toute la courbe.
 *
 * S'utilise autour d'un graphique : le parent porte `relative`, ce bloc se
 * place en absolu par-dessus, sans capter le pointeur (le tooltip du graphique
 * continue de fonctionner).
 */
export function CenteredValue({
  value,
  caption,
  className,
}: {
  value: ReactNode;
  caption: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none z-10 mb-1 text-center sm:absolute sm:top-1/2 sm:left-1/2 sm:mb-0 sm:-translate-x-1/2 sm:-translate-y-1/2",
        className,
      )}
    >
      <div className="sheet-reserve rounded-2xl px-4 py-1.5">
        <p className="text-4xl leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-5xl lg:text-6xl">
          {value}
        </p>
        <p className="sheet-ink mt-1 text-[12.5px]">{caption}</p>
      </div>
    </div>
  );
}

export type AffiliatedPoint = {
  key: string;
  /** Le chiffre, en gras — ce que l'œil accroche. */
  value: ReactNode;
  /** Ce que le chiffre est, dans l'encre de la famille. */
  label: ReactNode;
  /** Précision facultative, en gris. */
  note?: ReactNode;
};

/**
 * Gabarit H — les points affiliés d'un chiffre clé. Un point est affilié parce
 * qu'il est dans la feuille, sous le filet : c'est le filet qui fait le lien,
 * pas une boîte de plus.
 */
export function AffiliatedPoints({
  points,
  className,
}: {
  points: readonly AffiliatedPoint[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sheet-rule mt-3 grid gap-x-4 gap-y-3 pt-2.5 min-[380px]:grid-cols-2",
        points.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
        className,
      )}
    >
      {points.map((p) => (
        <div key={p.key}>
          <b className="block text-base leading-tight font-semibold tabular-nums">
            {p.value}
          </b>
          <span className="sheet-ink mt-0.5 block text-xs">{p.label}</span>
          {p.note ? (
            <small className="text-muted-foreground mt-0.5 block text-[11px]">
              {p.note}
            </small>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Gabarit I — des lignes attachées à un chiffre clé (pages autres que Pulse,
 * et blocs secondaires de Pulse). La première ligne porte le filet de la
 * famille, les suivantes une séparation discrète.
 */
export function AttachedLines({
  lines,
  className,
}: {
  lines: ReadonlyArray<{ key: string; label: ReactNode; value: ReactNode }>;
  className?: string;
}) {
  return (
    <div className={cn("mt-2", className)}>
      {lines.map((l, i) => (
        <div
          key={l.key}
          className={cn(
            "flex items-baseline justify-between gap-3 py-2 text-[13px]",
            i === 0 ? "sheet-rule" : "border-border/40 border-t",
          )}
        >
          <span className="text-foreground/80">{l.label}</span>
          <b className="font-semibold tabular-nums">{l.value}</b>
        </div>
      ))}
    </div>
  );
}
