"use client";

/**
 * Garde-fou persona : les pages structure (/roster, /ar-watch) sont réservées
 * à la vue label. En vue artiste, on affiche un état vide élégant avec un
 * raccourci pour basculer de persona. Purement présentationnel : les textes
 * viennent du namespace de la page appelante.
 */
import { Building2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LabelGuard({
  title,
  description,
  cta,
  onSwitch,
}: {
  title: string;
  description: string;
  cta: string;
  onSwitch: () => void;
}) {
  return (
    <div className="rise-in flex min-h-[60vh] items-center justify-center">
      <div className="brand-glow relative flex max-w-md flex-col items-center gap-4 rounded-2xl border bg-card p-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <Building2 className="size-7" aria-hidden />
        </span>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <Button onClick={onSwitch} className="mt-2 gap-2">
          <ArrowRightLeft className="size-4" aria-hidden />
          {cta}
        </Button>
      </div>
    </div>
  );
}
