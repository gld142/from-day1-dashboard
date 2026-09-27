import { describe, expect, it } from "vitest";
import { sanitize } from "../lead";
import { toRow } from "../lead-row";

describe("sanitize", () => {
  it("refuse l'étape « paid » venue du navigateur", () => {
    expect(sanitize({ stage: "paid" }).stage).toBeUndefined();
    expect(sanitize({ stage: "checkout" }).stage).toBe("checkout");
  });
  it("rejette un email invalide et met en minuscules un email valide", () => {
    expect(sanitize({ email: "pas-un-email" }).email).toBeUndefined();
    expect(sanitize({ email: " Gael@Example.COM " }).email).toBe("gael@example.com");
  });
  it("borne le nombre d'artistes et filtre les valeurs inconnues", () => {
    expect(sanitize({ artistCount: 9999 }).artistCount).toBe(500);
    expect(sanitize({ artistCount: 0 }).artistCount).toBeUndefined();
    expect(sanitize({ roles: ["manager", "pirate"] }).roles).toEqual(["manager"]);
  });
  it("ignore les champs inconnus", () => {
    expect(sanitize({ id: "x", isAdmin: true, email: "a@b.fr" })).toEqual({ email: "a@b.fr" });
  });
});

describe("toRow", () => {
  it("renomme en colonnes et n'envoie pas les champs absents", () => {
    expect(toRow({ firstName: "Gaël", teamSize: "2-5", artistCount: 3 })).toEqual({
      first_name: "Gaël",
      team_size: "2-5",
      artist_count: 3,
    });
  });
});
