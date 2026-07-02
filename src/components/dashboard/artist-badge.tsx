"use client";

import { artistGradient } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Artist } from "@/lib/demo/types";

/**
 * Identité visuelle d'un artiste : pastille gradient signature + nom.
 * (façon Arc Spaces — chaque artiste a sa teinte, réutilisée dans ses charts)
 */
export function ArtistAvatar({
  artist,
  size = "md",
  className,
}: {
  artist: Pick<Artist, "hue" | "initials" | "name">;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "size-6 text-[10px]",
    md: "size-8 text-xs",
    lg: "size-11 text-sm",
    xl: "size-16 text-lg",
  } as const;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white/95",
        sizes[size],
        className,
      )}
      style={{ background: artistGradient(artist.hue) }}
    >
      {artist.initials}
    </span>
  );
}

export function ArtistBadge({
  artist,
  meta,
  size = "md",
  className,
}: {
  artist: Pick<Artist, "hue" | "initials" | "name">;
  meta?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <ArtistAvatar artist={artist} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium leading-tight">
          {artist.name}
        </span>
        {meta && (
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
            {meta}
          </span>
        )}
      </span>
    </span>
  );
}
