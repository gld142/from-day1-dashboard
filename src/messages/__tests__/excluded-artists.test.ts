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

describe.each(Object.values(TENANTS))("maison $id : les messages ne nomment aucun artiste exclu", (tenant) => {
  const names = ALL_ARTISTS.filter((a) => tenant.excludedArtists.includes(a.id)).map((a) => a.name);
  it.each(["fr", "en"] as const)("%s", (locale) => {
    expect(names).toHaveLength(tenant.excludedArtists.length);
    const text = JSON.stringify(getMessages(locale, tenant));
    expect(text.length).toBeGreaterThan(10_000);
    for (const name of names) expect(text, `${locale} nomme ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`, "i"));
  });
});
