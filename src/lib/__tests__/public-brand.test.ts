import { describe, expect, it } from "vitest";
import { TENANTS, type Tenant } from "@/lib/tenant";
import { coBrandPillHtml, esc, gateBrandHtml, gateTitleText, safeColor } from "@/lib/public-brand";

describe("pages publiques — la marque suit la maison", () => {
  it("Day 1 : titre inchangé, pas de pastille", () => {
    expect(gateTitleText(TENANTS.day1)).toBe("From Day 1 — Accès");
    expect(gateBrandHtml(TENANTS.day1)).toBe("<h1>Day 1 Pro</h1>");
    expect(coBrandPillHtml(TENANTS.day1)).toBe("");
  });
  it("Universal : nom de la maison dans le titre, pastille UNIVERSAL noire sur la porte", () => {
    expect(gateTitleText(TENANTS.universal)).toBe("Day One × Universal — Accès");
    const brand = gateBrandHtml(TENANTS.universal);
    expect(brand).toContain("Day One × Universal");
    expect(brand).toContain("background:#000000;color:#ffffff");
    expect(brand).toContain(">UNIVERSAL</span>");
    expect(brand).not.toContain("Day 1 Pro");
  });
  it("Universal : le cartouche noir a un liseré visible sur le fond sombre de la porte", () => {
    expect(coBrandPillHtml(TENANTS.universal)).toContain("box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)");
  });
});

describe("pages publiques — échappement et garde-fous", () => {
  const hostile: Tenant = {
    ...TENANTS.universal,
    publicName: `A<b>&"x"`,
    logo: { text: `U<i>&"y"`, bg: `#000" onmouseover="alert(1)`, fg: `red;background:url(x)` },
  };
  it("esc échappe &, <, > et \" une seule fois", () => {
    expect(esc(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
    expect(esc("&amp;")).toBe("&amp;amp;");
  });
  it("nom public et texte de co-marque hostiles : échappés, aucune balise ni attribut injecté", () => {
    const html = gateBrandHtml(hostile);
    expect(html).toContain("A&lt;b&gt;&amp;&quot;x&quot;");
    expect(html).toContain("U&lt;i&gt;&amp;&quot;y&quot;");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<i>");
    expect(html).not.toContain("onmouseover");
    expect(html).not.toContain("url(x)");
    // un seul attribut style et un seul title dans la pastille
    const pill = coBrandPillHtml(hostile);
    expect(pill.match(/ style="/g)).toHaveLength(1);
    expect(pill.match(/ title="/g)).toHaveLength(1);
  });
  it("couleurs invalides : repli sur les couleurs par défaut de la pastille", () => {
    const pill = coBrandPillHtml(hostile);
    expect(pill).toContain("background:#000000;color:#ffffff");
  });
  it("safeColor n'accepte que #hex valide en CSS (3, 4, 6 ou 8 chiffres)", () => {
    expect(safeColor("#000", "#111")).toBe("#000");
    expect(safeColor("#7B5CF0", "#111")).toBe("#7B5CF0");
    expect(safeColor("#7B5CF0AA", "#111")).toBe("#7B5CF0AA");
    expect(safeColor("#fff0", "#111")).toBe("#fff0");
    for (const bad of ["red", "#12", "#12345", "#1234567", "#123456789", "#zzz", "#000;x:y", 'a"b', "", "url(x)"]) {
      expect(safeColor(bad, "#111")).toBe("#111");
    }
  });
});
