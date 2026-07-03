"use client";

/**
 * Avatar membre d'équipe : initiales sur teinte déterministe dérivée du nom
 * (même grammaire visuelle que les artistes, hydration-safe).
 */
import { artistGradient } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Teinte 0-360 déterministe depuis une chaîne. */
export function hueForName(name: string): number {
  let h = 7;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function memberInitials(name: string): string {
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function TeamAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizes = {
    sm: "size-6 text-[10px]",
    md: "size-8 text-xs",
  } as const;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white/95",
        sizes[size],
        className,
      )}
      style={{ background: artistGradient(hueForName(name)) }}
    >
      {memberInitials(name)}
    </span>
  );
}
