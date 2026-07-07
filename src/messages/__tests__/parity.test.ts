/**
 * Filet de sécurité i18n : parité STRICTE des clés fr/en.
 * Pour chaque namespace, l'ensemble des clés aplaties de fr/<ns>.json
 * doit être identique à celui de en/<ns>.json — diff lisible sinon.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MESSAGES_DIR = fileURLToPath(new URL("..", import.meta.url));
const FR_DIR = join(MESSAGES_DIR, "fr");
const EN_DIR = join(MESSAGES_DIR, "en");

function listNamespaces(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

function loadJson(dir: string, file: string): unknown {
  return JSON.parse(readFileSync(join(dir, file), "utf-8"));
}

/** Aplati récursivement : { a: { b: "x" } } → ["a.b"]. */
function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

const frFiles = listNamespaces(FR_DIR);
const enFiles = listNamespaces(EN_DIR);

describe("parité des namespaces fr/en", () => {
  it("les deux locales exposent exactement les mêmes fichiers", () => {
    expect(frFiles).toEqual(enFiles);
  });

  describe.each(frFiles.filter((f) => enFiles.includes(f)))("%s", (file) => {
    it("les clés fr et en sont identiques", () => {
      const frKeys = flattenKeys(loadJson(FR_DIR, file));
      const enKeys = flattenKeys(loadJson(EN_DIR, file));
      const frSet = new Set(frKeys);
      const enSet = new Set(enKeys);

      const missingInEn = frKeys.filter((k) => !enSet.has(k));
      const missingInFr = enKeys.filter((k) => !frSet.has(k));

      expect(
        missingInEn,
        `[${file}] clés présentes en fr mais absentes en en :\n  - ${missingInEn.join("\n  - ")}`,
      ).toEqual([]);
      expect(
        missingInFr,
        `[${file}] clés présentes en en mais absentes en fr :\n  - ${missingInFr.join("\n  - ")}`,
      ).toEqual([]);
    });
  });
});
