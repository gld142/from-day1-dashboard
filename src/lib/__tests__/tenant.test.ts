import { describe, expect, it } from "vitest";
import { TENANT, TENANTS, excludeArtists, isTenantId, tenantFor } from "@/lib/tenant";

describe("tenantFor — la maison se choisit au build", () => {
  it("sans variable, ou avec une valeur inconnue : Day 1", () => {
    expect(tenantFor(undefined).id).toBe("day1");
    expect(tenantFor("").id).toBe("day1");
    expect(tenantFor("sony").id).toBe("day1");
  });
  it("« universal » : Day One × Universal, co-marque, rôles", () => {
    const t = tenantFor("universal");
    expect(t.id).toBe("universal");
    expect(t.name).toBe("Day One × Universal");
    expect(t.logo?.text).toBe("UNIVERSAL");
    expect(t.roles).toBe(true);
  });
  it("Day 1 : pas de co-marque, pas de sélecteur de rôle", () => {
    expect(TENANTS.day1.logo).toBeNull();
    expect(TENANTS.day1.roles).toBe(false);
    expect(TENANTS.day1.name).toBe("Day 1 Dashboard Pro");
  });
  it("chaque maison exclut exactement un artiste, et son artiste par défaut n'est pas exclu", () => {
    expect(TENANTS.day1.excludedArtists).toEqual(["kiko"]);
    expect(TENANTS.universal.excludedArtists).toEqual(["dadju"]);
    for (const t of Object.values(TENANTS)) expect(t.excludedArtists).not.toContain(t.defaultArtistId);
  });
  it("isTenantId n'accepte que les deux maisons", () => {
    expect(isTenantId("day1")).toBe(true);
    expect(isTenantId("universal")).toBe(true);
    expect(isTenantId("Universal")).toBe(false);
    expect(isTenantId(undefined)).toBe(false);
  });
});

describe("excludeArtists", () => {
  const roster = [{ id: "dadju" }, { id: "kiko" }, { id: "zeg-p" }];
  it("retire les exclus de la maison, garde l'ordre", () => {
    expect(excludeArtists(roster, TENANTS.day1).map((a) => a.id)).toEqual(["dadju", "zeg-p"]);
    expect(excludeArtists(roster, TENANTS.universal).map((a) => a.id)).toEqual(["kiko", "zeg-p"]);
  });
  it("par défaut, c'est la maison du build (day1 sous vitest)", () => {
    expect(TENANT.id).toBe("day1");
    expect(excludeArtists(roster).map((a) => a.id)).toEqual(["dadju", "zeg-p"]);
  });
});
