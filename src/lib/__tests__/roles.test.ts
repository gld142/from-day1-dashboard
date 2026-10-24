import { describe, expect, it } from "vitest";
import { JOB_ROLES, ROLES, isJobRole, roleLanding, roleOverrides, roleScope } from "@/lib/roles";

const ALL = ["/pulse", "/roster", "/fil", "/streams", "/market", "/revenue", "/audience", "/algo-position", "/finances", "/calculator", "/valuation", "/splits", "/contracts", "/rights", "/placements", "/urssaf", "/audit", "/day1-index", "/copilot", "/ar-watch", "/fans", "/discovery", "/sync", "/tour", "/catalog", "/team", "/import", "/settings"];

describe("roles — la table de la spec (§4)", () => {
  it("cinq rôles", () => {
    expect(JOB_ROLES).toEqual(["da", "finance", "juridique", "direction", "presidence"]);
    expect(isJobRole("finance")).toBe(true);
    expect(isJobRole("stagiaire")).toBe(false);
    expect(isJobRole(null)).toBe(false);
  });
  it("page d'arrivée : le DA arrive sur son roster filtré", () => {
    expect(roleLanding("da", "da-urbain")).toBe("/roster?da=da-urbain");
    expect(roleLanding("da", null)).toBe("/roster");
    expect(roleLanding("finance", null)).toBe("/revenue");
    expect(roleLanding("juridique", null)).toBe("/contracts");
    expect(roleLanding("direction", null)).toBe("/pulse");
    expect(roleLanding("presidence", null)).toBe("/pulse");
  });
  it("navigation : les pages du rôle visibles, les autres cachées ; direction voit tout", () => {
    const fin = roleOverrides("finance", ALL);
    expect(Object.entries(fin).filter(([, v]) => v).map(([h]) => h).sort()).toEqual(["/audit", "/fil", "/finances", "/revenue", "/rights", "/valuation"]);
    expect(fin["/roster"]).toBe(false);
    expect(roleOverrides("direction", ALL)).toEqual({});
    expect(roleOverrides(null, ALL)).toEqual({});
    expect(Object.entries(roleOverrides("presidence", ALL)).filter(([, v]) => v).map(([h]) => h).sort()).toEqual(["/fil", "/pulse", "/roster", "/valuation"]);
    expect(Object.entries(roleOverrides("juridique", ALL)).filter(([, v]) => v).map(([h]) => h).sort()).toEqual(["/contracts", "/fil", "/placements", "/rights", "/splits"]);
    expect(Object.entries(roleOverrides("da", ALL)).filter(([, v]) => v).map(([h]) => h).sort()).toEqual(["/ar-watch", "/audience", "/contracts", "/fil", "/pulse", "/roster", "/streams"]);
  });
  it("chaque rôle a le Fil dans sa navigation", () => {
    for (const r of JOB_ROLES) expect(ROLES[r].nav === "all" || ROLES[r].nav.includes("/fil"), r).toBe(true);
  });
  it("périmètre : seul le DA est restreint, à son DA", () => {
    expect(roleScope("da", "da-compos")).toEqual({ daId: "da-compos" });
    expect(roleScope("da", null)).toEqual({ daId: null });
    expect(roleScope("finance", "da-compos")).toEqual({ daId: null });
    expect(roleScope(null, "da-compos")).toEqual({ daId: null });
  });
});
