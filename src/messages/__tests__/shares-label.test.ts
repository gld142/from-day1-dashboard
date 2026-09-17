/**
 * Le panneau « part » bascule de namespace selon le persona :
 * `revenue.shares` (artiste, 2e personne) ↔ `revenue.shares.label` (vue
 * structure, 3e personne). next-intl n'a pas de repli par clé : le miroir
 * doit être exact, sinon une clé manquante s'affiche brute en démo.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

function shares(locale: "fr" | "en") {
  const file = fileURLToPath(new URL(`../${locale}/revenue.json`, import.meta.url));
  return JSON.parse(readFileSync(file, "utf-8")).shares as Record<string, unknown>;
}

describe.each(["fr", "en"] as const)("revenue.shares.label (%s)", (locale) => {
  it("reflète toutes les clés du panneau complet (hors compact)", () => {
    const s = shares(locale);
    const base = flattenKeys(s).filter(
      (k) => !k.startsWith("compact.") && !k.startsWith("label."),
    );
    const label = flattenKeys(s.label);
    expect(label.sort()).toEqual(base.sort());
  });
});
