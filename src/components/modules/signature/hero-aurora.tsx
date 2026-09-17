"use client";

/**
 * HeroAurora — fond WebGL du héros Pulse en skin artiste : rubans de soie
 * aux teintes de la marque, opacité 0,18, sans interaction souris.
 *
 * Chargé dynamiquement (ssr: false) par la page : jamais dans le bundle de la
 * skin structure. Le parent ne le monte que si la skin est « artist » et que
 * prefers-reduced-motion est inactif ; sans WebGL, SilkAurora ne rend rien
 * (fallback null) → fond plat.
 *
 * Composition par thème : en nuit / aube, base noire + mix-blend « screen »
 * (seuls les rubans s'ajoutent) ; en jour, la couche est inversée puis
 * multipliée (rubans violets sur blanc). La boucle de rendu se met en pause
 * quand le héros sort de l'écran.
 */
import { useRef } from "react";
import { useInView } from "framer-motion";
import { useTheme } from "next-themes";
import { SilkAurora } from "@/components/ui/silk-aurora";
import { invertHex, paletteFor } from "@/lib/skin-palette";

const BLACK = "#000000";

export function HeroAurora() {
  const { resolvedTheme } = useTheme();
  const palette = paletteFor(resolvedTheme);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.05 });

  const accent = palette.light ? invertHex(palette.accent) : palette.accent;
  const sheen = palette.light ? invertHex(palette.sheen) : palette.sheen;

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
      style={{
        /* Le multiply du thème clair marque davantage : un cran plus bas. */
        opacity: palette.light ? 0.14 : 0.18,
        mixBlendMode: palette.light ? "multiply" : "screen",
        filter: palette.light ? "invert(1)" : undefined,
      }}
    >
      <SilkAurora
        key={resolvedTheme}
        className="h-full min-h-0 bg-transparent"
        baseColor={BLACK}
        midColor={BLACK}
        accentColor={accent}
        sheenColor={sheen}
        speed={0.55}
        intensity={1}
        grain={0}
        vignette={0}
        interactive={false}
        mouseInfluence={0}
        overlays={false}
        fallback={null}
        paused={!inView}
      />
    </div>
  );
}
