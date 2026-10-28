import { describe, expect, it } from "vitest";
import { DEFAULT_ORG, type OrgState } from "@/lib/demo/org";
import { daOf, daOfWith } from "@/lib/userdata/use-feed";

/* Le fil suit l'organisation de la maison : une note sur un artiste réattribué va au nouveau DA. */
describe("fil × organisation", () => {
  it("par défaut, le DA vu par le fil est celui de data.ts", () => {
    expect(daOfWith(DEFAULT_ORG)("louane")).toBe(daOf("louane"));
    expect(daOfWith(DEFAULT_ORG)("louane")).toBe("da-variete");
  });

  it("Louane réattribuée à Inès M. : le fil la voit chez Inès M.", () => {
    const org: OrgState = { ...DEFAULT_ORG, assignments: { louane: { daId: "da-urbain" } } };
    expect(daOfWith(org)("louane")).toBe("da-urbain");
    expect(daOfWith(org)("wamen")).toBe("da-variete"); // les autres ne bougent pas
  });

  it("une attribution vers un DA inconnu est ignorée (défaut gardé)", () => {
    const org: OrgState = { ...DEFAULT_ORG, assignments: { louane: { daId: "da-inexistant" } } };
    expect(daOfWith(org)("louane")).toBe("da-variete");
  });

  it("artiste inconnu : aucun DA", () => {
    expect(daOfWith(DEFAULT_ORG)("personne")).toBeNull();
  });
});
