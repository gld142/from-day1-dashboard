"use client";

/**
 * Micro-motion d'entrée des KpiCards, une seule fois au mount, désactivé si
 * prefers-reduced-motion. La signature dépend de la skin :
 *  - structure : opacité seule (aucune translation), décalage 40 ms ;
 *  - artiste : fondu + montée de 12 px, décalage 60 ms.
 *
 * Usage :
 *   <KpiStagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 *     <KpiStaggerItem><KpiCard … /></KpiStaggerItem>
 *   </KpiStagger>
 */
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useSkin, type Skin } from "@/lib/skin";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const GROUP: Record<Skin, Variants> = {
  structure: { hidden: {}, show: { transition: { staggerChildren: 0.04 } } },
  artist: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
};

const ITEM: Record<Skin, Variants> = {
  structure: {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.35, ease: "easeOut" } },
  },
  artist: {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: EASE_OUT_EXPO },
    },
  },
};

export function KpiStagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const skin = useSkin();
  return (
    <motion.div
      className={className}
      variants={GROUP[skin]}
      initial={reduceMotion ? false : "hidden"}
      animate="show"
    >
      {children}
    </motion.div>
  );
}

export function KpiStaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const skin = useSkin();
  return (
    <motion.div className={className} variants={ITEM[skin]}>
      {children}
    </motion.div>
  );
}
