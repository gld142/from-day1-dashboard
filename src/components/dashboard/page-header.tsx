"use client";

import type { Transition } from "framer-motion";
import { KineticTextReveal } from "@/components/ui/kinetic-text-reveal";
import { useEntryReveal, useSkin, type Skin } from "@/lib/skin";
import { cn } from "@/lib/utils";

const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as const;

/**
 * Signature de mouvement du titre, par skin :
 *  - structure : mots, vers le haut, 280 ms, décalage 25 ms — net, sans flou ;
 *  - artiste : caractères, 400 ms, décalage 18 ms, léger flou — plus doux.
 * Une seule fois par navigation client (le composant rejoue au changement de
 * texte) ; au chargement initial, le titre est du texte brut, visible dès le
 * HTML serveur. Sous prefers-reduced-motion, le composant fond le texte en
 * 10 ms.
 */
const TITLE_REVEAL: Record<
  Skin,
  {
    splitBy: "words" | "characters";
    stagger: number;
    distance: number;
    blur: boolean;
    transition: Transition;
  }
> = {
  structure: {
    splitBy: "words",
    stagger: 0.025,
    distance: 10,
    blur: false,
    transition: { duration: 0.28, ease: EASE_OUT_QUART },
  },
  artist: {
    splitBy: "characters",
    stagger: 0.018,
    distance: 12,
    blur: true,
    transition: { duration: 0.4, ease: EASE_OUT_QUART },
  },
};

/**
 * En-tête standard de page : titre (font-heading, révélé en cinétique selon
 * la skin), sous-titre, actions à droite. Le h1 garde son texte accessible
 * (aria-label + sr-only) : les tests et les lecteurs d'écran lisent le titre
 * tel quel.
 */
export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const skin = useSkin();
  const kinetic = useEntryReveal();
  const reveal = TITLE_REVEAL[skin];
  return (
    <header
      className={cn(
        "rise-in mb-6 flex flex-wrap items-end justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {kinetic ? (
            <KineticTextReveal
              key={skin}
              text={title}
              splitBy={reveal.splitBy}
              direction="up"
              distance={reveal.distance}
              stagger={reveal.stagger}
              blur={reveal.blur}
              transition={reveal.transition}
              maskClassName="pb-0.5"
            />
          ) : (
            title
          )}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {/* Les actions passent à la ligne entre elles si l'écran est étroit
          (badge artiste + onglets de période sur mobile). */}
      {children && (
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{children}</div>
      )}
    </header>
  );
}
