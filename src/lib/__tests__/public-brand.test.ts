import { describe, expect, it } from "vitest";
import { TENANTS, publicTitle } from "@/lib/tenant";
import { coBrandPillHtml, gateBrandHtml, gateTitle } from "@/lib/public-brand";

describe("pages publiques — la marque suit la maison", () => {
  it("Day 1 : titres inchangés, pas de pastille", () => {
    expect(gateTitle(TENANTS.day1)).toBe("From Day 1 — Accès");
    expect(publicTitle("Connexion", TENANTS.day1)).toBe("Day 1 Pro — Connexion");
    expect(gateBrandHtml(TENANTS.day1)).toBe("<h1>Day 1 Pro</h1>");
    expect(coBrandPillHtml(TENANTS.day1)).toBe("");
  });
  it("Universal : nom de la maison dans les titres, pastille UNIVERSAL noire sur la porte", () => {
    expect(gateTitle(TENANTS.universal)).toBe("Day One × Universal — Accès");
    expect(publicTitle("Ouvre ton espace", TENANTS.universal)).toBe("Day One × Universal — Ouvre ton espace");
    const brand = gateBrandHtml(TENANTS.universal);
    expect(brand).toContain("Day One × Universal");
    expect(brand).toContain("background:#000000;color:#ffffff");
    expect(brand).toContain(">UNIVERSAL</span>");
    expect(brand).not.toContain("Day 1 Pro");
  });
});
