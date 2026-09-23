"use client";

/**
 * La pastille de rang — or, argent, bronze, puis neutre.
 *
 * Une liste triée ne dit pas qu'elle est triée : l'œil doit relire les valeurs
 * pour s'en rendre compte. Trois médailles en tête et le classement se comprend
 * avant d'avoir lu un chiffre.
 *
 * Au-delà du podium le numéro reste, sans métal : une 7ᵉ place n'est pas une
 * récompense. `awarded={false}` retire le métal d'une place du podium — on ne
 * décore pas un artiste qui recule, même s'il est le troisième moins pire.
 */
import { cn } from "@/lib/utils";

/** Les trois métaux, en dégradé clair→foncé pour l'effet de relief. */
const METAL: Record<1 | 2 | 3, { from: string; to: string; ink: string; ring: string }> = {
  1: {
    from: "oklch(0.88 0.12 92)",
    to: "oklch(0.72 0.14 83)",
    ink: "oklch(0.32 0.07 80)",
    ring: "oklch(0.78 0.13 88 / 45%)",
  },
  2: {
    from: "oklch(0.90 0.012 260)",
    to: "oklch(0.76 0.016 258)",
    ink: "oklch(0.34 0.012 258)",
    ring: "oklch(0.83 0.014 259 / 45%)",
  },
  3: {
    from: "oklch(0.82 0.08 58)",
    to: "oklch(0.66 0.10 48)",
    ink: "oklch(0.30 0.05 45)",
    ring: "oklch(0.74 0.09 53 / 45%)",
  },
};

export function RankMedal({
  rank,
  size = "md",
  awarded = true,
  className,
}: {
  /** 1-indexé : 1, 2, 3 reçoivent un métal, le reste un numéro neutre. */
  rank: number;
  size?: "sm" | "md";
  /** false = la place est tenue mais pas récompensée (valeur en recul). */
  awarded?: boolean;
  className?: string;
}) {
  const metal = awarded && rank <= 3 ? METAL[rank as 1 | 2 | 3] : null;
  const box = size === "sm" ? "size-4.5 text-[10px]" : "size-5.5 text-[11px]";

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums",
        box,
        !metal && "bg-[color-mix(in_oklab,currentColor_12%,transparent)] opacity-70",
        className,
      )}
      style={
        metal
          ? {
              background: `linear-gradient(145deg, ${metal.from}, ${metal.to})`,
              color: metal.ink,
              boxShadow: `0 0 0 1.5px ${metal.ring}`,
            }
          : undefined
      }
    >
      {rank}
    </span>
  );
}
