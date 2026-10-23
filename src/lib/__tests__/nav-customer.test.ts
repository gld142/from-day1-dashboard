import { describe, expect, it } from "vitest";
import { FileUp } from "lucide-react";
import { customerHome, customerSections, isCustomerPath, isStructurePath, needsStatement, returnPath } from "../nav";
import type { NavItem } from "../nav";
import type { CustomerInfo } from "@/lib/customer-mode";

describe("isCustomerPath — pages ouvertes aux clients", () => {
  it("relevé, revenus, streams et import : ouverts à tous les rôles", () => {
    for (const role of ["owner", "member", "artist"] as const) {
      for (const path of ["/mon-releve", "/revenue", "/streams", "/audit", "/contracts", "/splits", "/rights", "/finances", "/catalog", "/calculator", "/tour", "/placements", "/sync", "/import"]) expect(isCustomerPath(path, role)).toBe(true);
    }
  });

  it("roster : propriétaire et équipe, JAMAIS l'artiste invité", () => {
    expect(isCustomerPath("/roster", "owner")).toBe(true);
    expect(isCustomerPath("/roster", "member")).toBe(true);
    expect(isCustomerPath("/roster", "artist")).toBe(false);
  });

  it("marché & signaux (réels depuis le 29/09) : ouverts à tous les rôles ; A&R pour la structure seulement", () => {
    for (const role of ["owner", "member", "artist"] as const) {
      for (const path of ["/pulse", "/market", "/audience", "/algo-position", "/discovery", "/day1-index"]) expect(isCustomerPath(path, role)).toBe(true);
    }
    expect(isCustomerPath("/ar-watch", "owner")).toBe(true);
    expect(isCustomerPath("/ar-watch", "member")).toBe(true);
    expect(isCustomerPath("/ar-watch", "artist")).toBe(false);
  });

  it("les pages encore en démo restent fermées, même au propriétaire", () => {
    for (const path of ["/valuation", "/urssaf", "/copilot", "/fans", "/rosterx"]) {
      expect(isCustomerPath(path, "owner")).toBe(false);
    }
  });

  it("vue structure = /roster et ses sous-pages seulement", () => {
    expect(isStructurePath("/roster")).toBe(true);
    expect(isStructurePath("/roster/detail")).toBe(true);
    expect(isStructurePath("/rosterx")).toBe(false);
    expect(isStructurePath("/mon-releve")).toBe(false);
  });
});

describe("needsStatement — renvoi vers /import quand l'artiste n'a pas de relevé", () => {
  it("pages qui lisent le relevé : oui ; import, roster, contrats : non", () => {
    for (const path of ["/mon-releve", "/revenue", "/streams", "/audit"]) expect(needsStatement(path)).toBe(true);
    for (const path of ["/import", "/roster", "/contracts", "/splits", "/rights", "/finances", "/catalog", "/tour", "/placements", "/sync"]) expect(needsStatement(path)).toBe(false);
    for (const path of ["/pulse", "/market", "/audience", "/algo-position", "/discovery", "/day1-index", "/ar-watch"]) expect(needsStatement(path)).toBe(false);
  });
});

describe("customerHome — page d'arrivée selon la vue", () => {
  it("vue label : le roster ; vue artiste : le relevé", () => {
    expect(customerHome("label")).toBe("/roster");
    expect(customerHome("artist")).toBe("/mon-releve");
  });
});

describe("returnPath — revenir sur la page d'origine après avoir changé d'artiste", () => {
  it("sans indication : l'accueil de la vue", () => {
    expect(returnPath(null, "owner", "label")).toBe("/roster");
    expect(returnPath(null, "owner", "artist")).toBe("/mon-releve");
  });
  it("« import » (lien historique de /espace) reste accepté", () => {
    expect(returnPath("import", "owner", "label")).toBe("/import");
  });
  it("une page ouverte au rôle est rendue telle quelle, query comprise", () => {
    expect(returnPath("/revenue", "owner", "label")).toBe("/revenue");
    expect(returnPath("/streams?periode=12", "member", "label")).toBe("/streams?periode=12");
  });
  it("le périmètre label est retiré : on rouvre un artiste", () => {
    expect(returnPath("/revenue?perimetre=label", "owner", "label")).toBe("/revenue");
    expect(returnPath("/revenue?perimetre=label&periode=6", "owner", "label")).toBe("/revenue?periode=6");
  });
  it("la query est coupée au premier « ? » seulement : un second « ? » en fait partie", () => {
    expect(returnPath("/revenue?q=a?b&periode=6", "owner", "label")).toBe("/revenue?q=a%3Fb&periode=6");
  });
  it("les segments-points encodés sont résolus AVANT le contrôle, et rejetés", () => {
    expect(returnPath("/revenue/%2e%2e/valuation", "owner", "label")).toBe("/roster");
    expect(returnPath("/revenue/.%2e/espace", "owner", "label")).toBe("/roster");
    expect(returnPath("/revenue/%2e%2e/%2e%2e//evil.example", "owner", "label")).toBe("/roster");
    expect(returnPath("/revenue?x=1#frag", "owner", "label")).toBe("/revenue?x=1");
  });
  it("une page fermée au rôle, un chemin externe ou douteux : l'accueil", () => {
    expect(returnPath("/roster", "artist", "artist")).toBe("/mon-releve");
    expect(returnPath("https://evil.example/x", "owner", "label")).toBe("/roster");
    expect(returnPath("//evil.example", "owner", "label")).toBe("/roster");
    expect(returnPath("/revenue/../valuation", "owner", "label")).toBe("/roster");
    expect(returnPath("/valuation", "owner", "label")).toBe("/roster");
    expect(returnPath("revenue", "owner", "label")).toBe("/roster");
  });
});

const info = (over: Partial<CustomerInfo>): CustomerInfo => ({
  userId: "u", workspaceId: "w", email: "a@b.fr", workspaceName: "Label Nord", workspaceKind: "label", view: "label",
  role: "owner", artistId: "a1", artistName: "Dadju", artists: [{ id: "a1", name: "Dadju" }, { id: "a2", name: "Kiko" }], ...over,
});
const importItem: NavItem = { href: "/import", labelKey: "items.importer", icon: FileUp };

describe("customerSections — le menu du client", () => {
  it("vue label : Roster en tête, puis « Relevé de {artiste} », puis Catalogue", () => {
    const [overview] = customerSections(info({}), importItem);
    expect(overview.items.map((i) => i.href)).toEqual(["/roster", "/mon-releve", "/catalog"]);
    expect(overview.items[1].label).toBe("Relevé de Dadju");
  });
  it("vue artiste, propriétaire : Mon relevé, Roster, Catalogue ; sans libellé résolu", () => {
    const [overview] = customerSections(info({ view: "artist", workspaceKind: "artist" }), importItem);
    expect(overview.items.map((i) => i.href)).toEqual(["/mon-releve", "/roster", "/catalog"]);
    expect(overview.items[0].label).toBeUndefined();
  });
  it("artiste invité : ni Roster ni A&R", () => {
    const sections = customerSections(info({ view: "artist", role: "artist" }), importItem);
    const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).not.toContain("/roster");
    expect(hrefs).not.toContain("/ar-watch");
  });
});
