import { describe, expect, it } from "vitest";
import { JOB_ROLES, ROLES, effectiveOverrides, hasUserOverrides, isJobRole, modulesState, roleLanding, roleOverrides, roleScope } from "@/lib/roles";

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

/*
 * use-modules.ts fusionne le préréglage du rôle et les choix de l'utilisateur. L'ordre de
 * la fusion n'était pas testé : un relecteur l'a inversé (préréglage PAR-DESSUS les choix)
 * et les 213 tests sont restés verts. Mesuré le 24/10/2026.
 */
describe("effectiveOverrides — le choix de l'utilisateur gagne sur le préréglage du rôle", () => {
  it("l'utilisateur ré-affiche une page cachée par le rôle, et cache une page que le rôle montre", () => {
    const eff = effectiveOverrides("finance", ALL, { "/roster": true, "/audit": false });
    expect(eff["/roster"]).toBe(true); // caché par le rôle, voulu par l'utilisateur
    expect(eff["/audit"]).toBe(false); // montré par le rôle, caché par l'utilisateur
    expect(eff["/revenue"]).toBe(true); // le préréglage reste là où l'utilisateur n'a rien dit
    expect(eff["/pulse"]).toBe(false);
  });
  it("sans choix utilisateur : exactement le préréglage du rôle", () => {
    expect(effectiveOverrides("juridique", ALL, {})).toEqual(roleOverrides("juridique", ALL));
  });
  it("sans rôle : exactement les choix de l'utilisateur", () => {
    const user = { "/tour": false, "/fans": true };
    expect(effectiveOverrides(null, ALL, user)).toEqual(user);
    expect(effectiveOverrides("direction", ALL, user)).toEqual(user);
  });
  it("hasUserOverrides : seuls les choix de l'utilisateur comptent — un rôle sans choix n'allume pas « Réinitialiser »", () => {
    expect(hasUserOverrides({})).toBe(false);
    expect(hasUserOverrides({ "/tour": false })).toBe(true);
    expect(hasUserOverrides(effectiveOverrides("finance", ALL, {}))).toBe(true); // ce serait l'erreur : passer la fusion
  });
});

/* use-modules.ts analysait `snap` et appelait `hasUserOverrides` sur les choix bruts — mais une
   mutation `hasUserOverrides(merged)` y aurait survécu à tous les tests (relecture du 24/10/2026).
   La paire { overrides, hasOverrides } est donc calculée par une fonction pure, testée ici. */
describe("modulesState — la paire que lit le hook des modules", () => {
  it("un rôle seul, sans choix : le préréglage du rôle, et « Réinitialiser » éteint", () => {
    const s = modulesState("{}", "finance", ALL);
    expect(s.overrides).toEqual(roleOverrides("finance", ALL));
    expect(s.hasOverrides).toBe(false);
  });
  it("un choix de l'utilisateur : fusionné par-dessus le rôle, et « Réinitialiser » allumé", () => {
    const s = modulesState(JSON.stringify({ "/roster": true }), "finance", ALL);
    expect(s.overrides["/roster"]).toBe(true);
    expect(s.overrides["/revenue"]).toBe(true);
    expect(s.hasOverrides).toBe(true);
  });
  it("sans rôle ni choix : rien", () => {
    expect(modulesState("{}", null, ALL)).toEqual({ overrides: {}, hasOverrides: false });
  });
});

/* « Vue d'ensemble » (barre du haut, maison à rôles) : revenir à « aucun rôle » — la vue structure
   neutre, tout le roster. Avant le 24/10/2026, le menu n'offrait aucun chemin retour : `setJobRole(null)`
   n'était jamais appelé. */
describe("vue d'ensemble — aucun rôle", () => {
  it("arrivée sur /pulse, quel que soit le DA resté en mémoire", () => {
    expect(roleLanding(null, null)).toBe("/pulse");
    expect(roleLanding(null, "da-urbain")).toBe("/pulse");
  });
  it("navigation structure complète et périmètre tout le roster", () => {
    expect(roleOverrides(null, ALL)).toEqual({});
    expect(roleScope(null, null)).toEqual({ daId: null });
    expect(modulesState("{}", null, ALL).overrides).toEqual({});
  });
});
