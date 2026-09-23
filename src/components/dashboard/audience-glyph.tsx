"use client";

/**
 * Le repère d'audience — trois silhouettes bras levés, la foule.
 *
 * Même parti que `StreamGlyph` : contour seul, `currentColor`, purement
 * décoratif. Il nomme la famille sans promettre d'action et sans emprunter la
 * couleur d'une autre famille.
 *
 * Trois figures plutôt qu'une : une silhouette isolée dit « un profil », un
 * groupe dit « ceux qui écoutent ». Celle du milieu est un peu plus haute —
 * c'est ce décalage qui fait lire une foule plutôt qu'une frise.
 */
import { cn } from "@/lib/utils";

export function AudienceGlyph({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const w = size === "lg" ? 44 : size === "md" ? 32 : 20;

  return (
    <svg
      aria-hidden
      width={w}
      height={w * 0.82}
      viewBox="0 0 44 36"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
    >
      {/* Silhouette gauche */}
      <circle cx="8" cy="13" r="3.4" />
      <path d="M8 17v8" />
      <path d="M8 19.5 3.4 14.6M8 19.5l4.6-4.9" />
      <path d="M8 25l-2.8 7M8 25l2.8 7" />
      {/* Silhouette centrale, plus haute : c'est elle qui fait la foule */}
      <circle cx="22" cy="8.6" r="3.8" />
      <path d="M22 13v9" />
      <path d="M22 16 16.6 10.4M22 16l5.4-5.6" />
      <path d="M22 22l-3.2 10M22 22l3.2 10" />
      {/* Silhouette droite */}
      <circle cx="36" cy="13" r="3.4" />
      <path d="M36 17v8" />
      <path d="M36 19.5 31.4 14.6M36 19.5l4.6-4.9" />
      <path d="M36 25l-2.8 7M36 25l2.8 7" />
    </svg>
  );
}
