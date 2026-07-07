"use client";

/**
 * Micro-motion d'entrée des KpiCards : stagger 40 ms par card, une seule
 * fois au mount, désactivé si prefers-reduced-motion.
 *
 * Usage :
 *   <KpiStagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 *     <KpiStaggerItem><KpiCard … /></KpiStaggerItem>
 *   </KpiStagger>
 */
import { motion, useReducedMotion, type Variants } from "framer-motion";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const groupVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_OUT_EXPO },
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
  return (
    <motion.div
      className={className}
      variants={groupVariants}
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
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
