/**
 * Formatage des nombres — TOUJOURS via Intl, jamais de format en dur.
 * `locale` vient de useLocale() (next-intl).
 */

export function fmtCompact(locale: string, n: number): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function fmtInt(locale: string, n: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

export function fmtEur(locale: string, n: number, opts?: { compact?: boolean }): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    notation: opts?.compact ? "compact" : "standard",
    maximumFractionDigits: opts?.compact ? 1 : 0,
  }).format(n);
}

export function fmtPct(locale: string, n: number, digits = 1): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  }).format(n / 100);
}

export function fmtDate(locale: string, iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, opts ?? { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

export function fmtMonth(locale: string, isoMonth: string): string {
  return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }).format(
    new Date(`${isoMonth}-01T00:00:00Z`),
  );
}

/** Gradient de signature d'un artiste (identité chromatique). */
export function artistGradient(hue: number): string {
  return `linear-gradient(135deg, oklch(0.55 0.16 ${hue}) 0%, oklch(0.4 0.12 ${(hue + 40) % 360}) 100%)`;
}

export function artistColor(hue: number, opts?: { l?: number; c?: number }): string {
  return `oklch(${opts?.l ?? 0.62} ${opts?.c ?? 0.15} ${hue})`;
}
