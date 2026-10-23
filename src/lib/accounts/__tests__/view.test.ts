import { describe, expect, it } from "vitest";
import { KIND_LABEL, MEMBER_ROLES, WORKSPACE_KINDS, isMemberRole, isWorkspaceKind, viewFor } from "../view";

describe("viewFor — qui voit la vue label", () => {
  it("un espace « artiste » : vue artiste pour tous les rôles", () => {
    for (const role of ["owner", "member", "artist"] as const) expect(viewFor("artist", role)).toBe("artist");
  });
  it("tout autre type : vue label pour le propriétaire et l'équipe", () => {
    for (const kind of ["label", "management", "publisher", "distributor", "other"] as const) {
      expect(viewFor(kind, "owner")).toBe("label");
      expect(viewFor(kind, "member")).toBe("label");
    }
  });
  it("un artiste invité reste en vue artiste, quel que soit le type", () => {
    for (const kind of WORKSPACE_KINDS) expect(viewFor(kind, "artist")).toBe("artist");
  });
  it("isWorkspaceKind accepte les six types et rien d'autre", () => {
    for (const kind of WORKSPACE_KINDS) expect(isWorkspaceKind(kind)).toBe(true);
    expect(isWorkspaceKind("majeur")).toBe(false);
    expect(isWorkspaceKind("")).toBe(false);
  });
  it("isMemberRole accepte les trois rôles et rien d'autre", () => {
    for (const role of MEMBER_ROLES) expect(isMemberRole(role)).toBe(true);
    expect(isMemberRole("admin")).toBe(false);
    expect(isMemberRole("")).toBe(false);
  });
  it("chaque type a un libellé français", () => {
    for (const kind of WORKSPACE_KINDS) expect(KIND_LABEL[kind].length).toBeGreaterThan(0);
  });
});
