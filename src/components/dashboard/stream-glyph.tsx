"use client";

/**
 * Le triangle de lecture, en contour — le repère qui dit « ce sont des
 * lectures » à côté d'un chiffre de streams.
 *
 * Deux décisions tenues ici :
 *  - **contour, pas plein** : un triangle plein se lit comme un bouton, et un
 *    bouton promet de lancer quelque chose. Celui-ci ne lance rien, il nomme.
 *  - **`currentColor`** : il prend l'encre du texte voisin, donc il suit les
 *    trois thèmes sans variante, et ne vole sa couleur à aucune famille de
 *    données (le violet appartient aux streams, l'or à l'argent…).
 *
 * Purement décoratif : `aria-hidden`, le libellé dit déjà « streams ».
 */
import { cn } from "@/lib/utils";

export function StreamGlyph({
  size = "md",
  className,
}: {
  /** `lg` pour un chiffre héros, `md` en ligne, `sm` dans un libellé. */
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const px = size === "lg" ? 30 : size === "md" ? 22 : 14;

  return (
    <svg
      aria-hidden
      width={px}
      height={px * 1.28}
      viewBox="0 0 28 36"
      className={cn("shrink-0", className)}
    >
      <path
        d="M3 3 L25 18 L3 33 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}
