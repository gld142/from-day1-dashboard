"use client";

/**
 * Le repère d'audience — une foule en points.
 *
 * Même parti que `StreamGlyph` : contour seul, `currentColor`, purement
 * décoratif. Il nomme la famille sans promettre d'action et sans emprunter la
 * couleur d'une autre famille.
 *
 * Aucun personnage dessiné : à 30 px, une silhouette complète (tête, bras,
 * jambes) devient illisible — quatre traits se touchent et font une tache. Huit
 * ronds de tailles inégales, serrés et décalés, disent « beaucoup de gens, de
 * près et de loin » et restent nets en petit.
 */
import { cn } from "@/lib/utils";

export function AudienceGlyph({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const w = size === "lg" ? 44 : size === "md" ? 34 : 22;

  return (
    <svg
      aria-hidden
      width={w}
      height={w * 0.88}
      viewBox="0 0 34 30"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      className={cn("shrink-0", className)}
    >
      {/* Rang du fond : les plus loin, les plus petits. */}
      <circle cx="6" cy="9" r="3" />
      <circle cx="17" cy="6" r="3.8" />
      <circle cx="28" cy="9" r="3" />
      {/* Rang central */}
      <circle cx="11" cy="18" r="3.4" />
      <circle cx="23" cy="18" r="3.4" />
      {/* Premier rang */}
      <circle cx="5" cy="25" r="2.4" />
      <circle cx="17" cy="25.5" r="2.6" />
      <circle cx="29" cy="25" r="2.4" />
    </svg>
  );
}
