/** Petits lecteurs de formulaire communs aux registres saisis (concerts, placements, sync). */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class FormError extends Error {}
export const fail = (m: string): never => {
  throw new FormError(m);
};

export function text(v: string | undefined, max: number, required?: string): string | null {
  const t = (v ?? "").trim();
  if (!t && required) fail(required);
  if (t.length > max) fail("Un texte est trop long.");
  return t || null;
}
/** « 10 000 », « 2500,50 » → nombre ≥ 0 ; vide → null. */
export function money(v: string | undefined): number | null {
  const t = (v ?? "").replace(/[\s  €]/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) fail("Un montant n'est pas valide.");
  return Math.round(n * 100) / 100;
}
export function intOrNull(v: string | undefined, max: number): number | null {
  const t = (v ?? "").replace(/[\s  ]/g, "");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0 || n > max) fail("Un nombre n'est pas valide.");
  return n;
}
export function percentOrNull(v: string | undefined): number | null {
  const t = (v ?? "").replace(/[\s%  ]/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) fail("Un pourcentage doit être entre 0 et 100.");
  return Math.round(n * 100) / 100;
}
export function date(v: string | undefined, required?: string): string | null {
  const t = (v ?? "").trim();
  if (!t) return required ? fail(required) : null;
  const d = new Date(`${t}T00:00:00Z`);
  if (!DATE.test(t) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) fail("Une date n'est pas valide.");
  return t;
}
export const checked = (v: string | undefined) => v === "on" || v === "1" || v === "true";
export const round2 = (n: number) => Math.round(n * 100) / 100;
/** La même date un an plus tôt (« 2026-09-28 » → « 2025-09-28 »). */
export const yearBefore = (d: string) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;

export function guard<T>(f: () => T): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: f() };
  } catch (e) {
    if (e instanceof FormError) return { ok: false, error: e.message };
    throw e;
  }
}
