/**
 * Les textes qu'une maison envoie au navigateur (`getMessages`, hérités par le
 * NextIntlClientProvider racine) ne nomment jamais un artiste qu'elle exclut :
 * day1 → pas de Kiko, universal → pas de Dadju. Un nom d'artiste dans une phrase
 * d'exemple se dérive du roster (paramètre ICU), il ne s'écrit pas en dur.
 *
 * MESURÉ le 24/10/2026 avant correction : onboardings.json (« démo Dadju / Nono /
 * Kiko ») faisait échouer les deux maisons.
 */
import { describe, expect, it } from "vitest";
import { ALL_ARTISTS } from "@/lib/demo/data";
import { TENANTS } from "@/lib/tenant";
import { getMessages } from "@/messages";
import { mentionsName } from "@/lib/__tests__/name-search";

describe.each(Object.values(TENANTS))("maison $id : les messages ne nomment aucun artiste exclu", (tenant) => {
  const names = ALL_ARTISTS.filter((a) => tenant.excludedArtists.includes(a.id)).map((a) => a.name);
  it.each(["fr", "en"] as const)("%s", (locale) => {
    expect(names).toHaveLength(tenant.excludedArtists.length);
    const text = JSON.stringify(getMessages(locale, tenant));
    expect(text.length).toBeGreaterThan(10_000);
    for (const name of names) expect(mentionsName(text, name), `${locale} nomme ${name}`).toBe(false);
  });
});

/* Témoin de la recherche (name-search.ts), partagée avec roster-data.test.ts. Groupe témoin :
   l'ancienne recherche (`new RegExp(`\\b${name}\\b`, "i")`) ratait « Kiko_x » et « Kikó », et
   levait sur un nom contenant une parenthèse. */
describe("mentionsName — le nom est trouvé quelle que soit son écriture", () => {
  it("collé à « _ », en capitales, accentué ; jamais lu comme un motif", () => {
    const old = (text: string, name: string) => new RegExp(`\\b${name}\\b`, "i").test(text);
    expect(old('{"a":"Kiko_x"}', "Kiko")).toBe(false);
    expect(old("Kikó", "Kiko")).toBe(false);
    expect(() => old("a(b", "a(b")).toThrow(SyntaxError);

    expect(mentionsName('{"a":"Kiko_x"}', "Kiko")).toBe(true);
    expect(mentionsName("Kikó en live", "Kiko")).toBe(true);
    expect(mentionsName("feat. DADJU", "Dadju")).toBe(true);
    expect(mentionsName("Dadju", "Dádju")).toBe(true);
    expect(mentionsName("a(b", "a(b")).toBe(true);
    expect(mentionsName("Nono La Grinta", "Kiko")).toBe(false);
  });
});
