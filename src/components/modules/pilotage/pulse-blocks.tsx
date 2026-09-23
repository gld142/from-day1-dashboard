"use client";

/**
 * Les bandes basses de Pulse (design validé le 22/09).
 *
 * Trois principes tenus ici :
 *  - **Zéro jargon d'indicateur** : on écrit le fait et sa cause, jamais le nom
 *    de la métrique. Les chiffres et noms propres sont en encre pleine, les
 *    urgences en rouge, le reste en gris — l'œil accroche la valeur avant de
 *    lire la phrase (`Emph`).
 *  - **Porte d'entrée** : une feature qui a sa propre page n'est jamais
 *    développée sur Pulse. Elle y tient sur une ligne : libellé, chiffre de
 *    base, flèche (`Doors`, `RestRow`).
 *  - **Aucun repli** : c'est un pouls, tout se lit d'un coup.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Le mot ou le chiffre que l'œil doit accrocher dans une phrase.
 * `tone="alert"` pour une échéance ou une perte, `"good"` pour un gain.
 */
export function Emph({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: "plain" | "alert" | "good";
}) {
  return (
    <b
      className={cn(
        "font-semibold",
        tone === "alert" && "text-destructive",
        tone === "good" && "text-success",
        tone === "plain" && "text-foreground",
      )}
    >
      {children}
    </b>
  );
}

export type NightItem = {
  key: string;
  /** Titre court, en capitales fines : ce que la colonne raconte. */
  kicker: ReactNode;
  body: ReactNode;
  /** Comptes, liens ou note de provenance sous le texte. */
  footer?: ReactNode;
};

/** La nuit et la journée qui vient, en quatre colonnes de texte — plus de cartes. */
export function NightStrip({ items }: { items: readonly NightItem[] }) {
  return (
    <section className="border-border/60 mt-4 grid gap-x-6 gap-y-4 border-t pt-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.key} className="text-[13px] leading-relaxed">
          <b className="text-foreground mb-0.5 block text-[11px] font-semibold tracking-[0.06em] uppercase">
            {i.kicker}
          </b>
          <span className="text-foreground/75">{i.body}</span>
          {i.footer ? <div className="mt-1">{i.footer}</div> : null}
        </div>
      ))}
    </section>
  );
}

/**
 * Les deux fichiers qui rendraient les chiffres exacts — relevé distributeur
 * (calibre les euros, rend l'écart d'audit exact) et contrat (remplace
 * l'hypothèse de part). Une seule bande : deux appels à importer côte à côte
 * fatiguent sans rien ajouter.
 */
export function ImportBand({
  title,
  status,
  body,
  actions,
}: {
  title: ReactNode;
  status?: ReactNode;
  body: ReactNode;
  actions: ReactNode;
}) {
  return (
    <section className="border-border bg-card mt-3 flex flex-col gap-3 rounded-xl border px-4.5 py-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div>
        <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
          <b className="font-semibold">{title}</b>
          {status}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-relaxed">
          {body}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
    </section>
  );
}

export type MoneyLead = {
  key: string;
  href: string;
  label: ReactNode;
  amount: ReactNode;
  /** Échéance : c'est elle qui fait revenir demain matin. */
  deadline?: ReactNode;
};

/**
 * « De l'argent à aller chercher » — le seul bloc tourné vers le gain, quand
 * tout le reste de Pulse constate. L'écart d'audit y vit plutôt que dans les
 * portes : c'est l'argument n° 1 du produit, pas une destination parmi douze.
 */
export function MoneyToCollect({
  title,
  leads,
}: {
  title: ReactNode;
  leads: readonly MoneyLead[];
}) {
  if (leads.length === 0) return null;
  return (
    <section className="border-border bg-card mt-3 rounded-xl border px-4.5 py-3.5">
      <h2 className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
        {title}
      </h2>
      <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {leads.map((l) => (
          <Link
            key={l.key}
            href={l.href}
            className="group hover:border-border/80 flex items-baseline justify-between gap-3 border-t border-transparent py-1.5 text-[12.5px] sm:border-t-0"
          >
            <span className="text-foreground/80">
              {l.label}
              {l.deadline ? (
                <span className="text-destructive mt-0.5 block text-[11px]">
                  {l.deadline}
                </span>
              ) : null}
            </span>
            <b className="font-semibold whitespace-nowrap tabular-nums group-hover:underline">
              {l.amount}
              <ArrowRight
                className="text-muted-foreground ml-1 inline size-3"
                aria-hidden
              />
            </b>
          </Link>
        ))}
      </div>
    </section>
  );
}

export type Door = {
  key: string;
  href: string;
  label: ReactNode;
  value: ReactNode;
  /** Met la valeur en rouge : une échéance, un écart, une alerte. */
  urgent?: boolean;
};

/** Les portes : l'info de base, le détail d'un clic. */
export function Doors({
  title,
  doors,
}: {
  title: ReactNode;
  doors: readonly Door[];
}) {
  return (
    <section className="mt-4">
      <h2 className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
        {title}
      </h2>
      <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {doors.map((d) => (
          <Link
            key={d.key}
            href={d.href}
            className="group border-border/60 flex items-baseline justify-between gap-3 border-t py-2 text-[12.5px]"
          >
            <span className="text-foreground/80">{d.label}</span>
            <b
              className={cn(
                "font-semibold whitespace-nowrap tabular-nums group-hover:underline",
                d.urgent && "text-destructive",
              )}
            >
              {d.value}
              <ArrowRight
                className="text-muted-foreground ml-1 inline size-3"
                aria-hidden
              />
            </b>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Ce qu'on ne regarde pas chaque matin mais qu'il ne faut pas oublier :
 * une ligne, un chiffre chacun. Rien n'est caché, rien ne bombarde.
 */
export function RestRow({
  title,
  items,
}: {
  title: ReactNode;
  items: ReadonlyArray<{ key: string; href: string; label: ReactNode }>;
}) {
  return (
    <section className="border-border/60 mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t pt-2.5 text-[11.5px]">
      <span className="text-muted-foreground text-[10.5px] font-semibold tracking-[0.08em] uppercase">
        {title}
      </span>
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className="text-brand hover:bg-brand/10 rounded-md px-1.5 py-0.5 font-medium transition-colors"
        >
          {i.label}
          <ArrowRight className="ml-0.5 inline size-3" aria-hidden />
        </Link>
      ))}
    </section>
  );
}
