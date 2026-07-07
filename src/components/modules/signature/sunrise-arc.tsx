"use client";

/**
 * SunriseArc — signature visuelle "le jour se lève".
 * Deux demi-arcs qui se dessinent depuis l'horizon (bas) vers le zénith (haut)
 * au mount (framer-motion pathLength), + halo radial très doux.
 * Dégradé du thème : var(--brand) → transparent. Pensé comme fond de card
 * héro : absolu, non interactif (pointer-events-none), discret (opacité ~0.35).
 */
import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/** Demi-arc gauche : de l'horizon (30,200) au zénith (200,30). */
const LEFT_ARC = "M 30 200 A 170 170 0 0 1 200 30";
/** Demi-arc droit : de l'horizon (370,200) au zénith (200,30). */
const RIGHT_ARC = "M 370 200 A 170 170 0 0 0 200 30";

export function SunriseArc({ className }: { className?: string }) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const reduceMotion = useReducedMotion();

  const strokeId = `sunrise-stroke-${id}`;
  const glowId = `sunrise-glow-${id}`;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-xl opacity-35",
        className,
      )}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMax meet"
        fill="none"
      >
        <defs>
          <linearGradient
            id={strokeId}
            x1="0"
            y1="0"
            x2="0"
            y2="200"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.9" />
            <stop offset="70%" stopColor="var(--brand)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="100%" r="70%">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Halo du soleil levant, ancré à l'horizon */}
        <motion.rect
          x="0"
          y="0"
          width="400"
          height="200"
          fill={`url(#${glowId})`}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
        />

        {/* Les deux demi-arcs montent de l'horizon vers le zénith */}
        <motion.path
          d={LEFT_ARC}
          stroke={`url(#${strokeId})`}
          strokeWidth="1.5"
          strokeLinecap="round"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: EASE_OUT_EXPO, delay: 0.15 }}
        />
        <motion.path
          d={RIGHT_ARC}
          stroke={`url(#${strokeId})`}
          strokeWidth="1.5"
          strokeLinecap="round"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: EASE_OUT_EXPO, delay: 0.15 }}
        />
      </svg>
    </div>
  );
}
