/**
 * Palette hex de la couche WebGL du bandeau /welcome (AnimatedGradient) : les shaders
 * ne lisent pas les tokens oklch de globals.css, on leur donne l'équivalent
 * sRGB de l'accent « artiste » de chaque thème (--brand-base +8° / +10 % de
 * chroma) et d'une teinte claire de la même famille (sheen).
 *
 * Valeurs calculées depuis les tokens : accent night oklch(0.62 0.209 293),
 * dawn oklch(0.72 0.165 48), day oklch(0.51 0.209 290) ; card = --surface-1.
 */
export type ThemeId = "night" | "dawn" | "day";

export type WebglPalette = {
  /** Accent artiste du thème. */
  accent: string;
  /** Teinte claire de la même famille (reflets). */
  sheen: string;
  /** Fond de carte (--surface-1) : base opaque des canvas, invisible sur la carte. */
  card: string;
  /** Thème clair : la couche s'inverse et se multiplie (rubans foncés sur blanc). */
  light: boolean;
};

export const WEBGL_PALETTE: Record<ThemeId, WebglPalette> = {
  night: { accent: "#8f63f6", sheen: "#b6b3ff", card: "#0d1116", light: false },
  dawn: { accent: "#f57f3a", sheen: "#ffbc9d", card: "#18131f", light: false },
  day: { accent: "#6b41d2", sheen: "#a2a4f8", card: "#ffffff", light: true },
};

function isThemeId(theme: string | undefined): theme is ThemeId {
  return theme !== undefined && theme in WEBGL_PALETTE;
}

/** Palette du thème courant ; nuit par défaut (thème inconnu ou pas encore monté). */
export function paletteFor(theme: string | undefined): WebglPalette {
  return WEBGL_PALETTE[isThemeId(theme) ? theme : "night"];
}
