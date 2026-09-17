"use client";

/**
 * WelcomeGlow — dégradé animé (WebGL) derrière le bandeau co-brandé de
 * /welcome, variante artiste : très léger, fondu vers le bas, aux teintes de
 * la marque du thème courant. Chargé dynamiquement (ssr: false) par
 * CobrandScreen, jamais sous prefers-reduced-motion ; sans WebGL, rien.
 *
 * Pas de mask-image ni de transparence dans le canvas (le shader n'est pas
 * prémultiplié et un canvas WebGL transparent se compose mal) : couleurs
 * opaques sur fond couleur de carte, opacité CSS, fondu par un voile dégradé
 * posé par-dessus, couche rognée par overflow-hidden.
 */
import { useRef } from "react";
import { useInView } from "framer-motion";
import { useTheme } from "next-themes";
import { AnimatedGradient } from "@/components/ui/animated-gradient";
import { paletteFor } from "@/lib/skin-palette";


export function WelcomeGlow() {
  const { resolvedTheme } = useTheme();
  const palette = paletteFor(resolvedTheme);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.05 });

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-52 overflow-hidden"
      style={{ opacity: palette.light ? 0.2 : 0.28 }}
    >
      <AnimatedGradient
        key={resolvedTheme}
        paused={!inView}
        fallback={null}
        config={{
          preset: "custom",
          /* Couleurs opaques (canvas sans alpha) : le « vide » est la couleur
             de la carte, donc invisible ; seules les nappes d'accent ressortent. */
          color1: palette.card,
          color2: palette.accent,
          color3: palette.sheen,
          /* Grandes nappes lentes, peu tordues : un souffle, pas des taches. */
          rotation: -30,
          proportion: 40,
          scale: 0.3,
          speed: 6,
          distortion: 12,
          swirl: 25,
          swirlIterations: 5,
          softness: 100,
          shape: "Checks",
          shapeSize: 70,
        }}
      />
      {/* Voile : la couleur s'éteint vers le contenu. */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/60 to-card" />
    </div>
  );
}
