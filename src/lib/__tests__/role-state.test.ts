import { describe, expect, it } from "vitest";
import { parseRoleState } from "@/lib/role";

/* L'état de rôle lu depuis le stockage : ce que la Task 8 ajoute (jobRole, daId)
   doit survivre à un ancien stockage sans ces champs et à des valeurs inconnues. */
describe("parseRoleState — l'état de rôle depuis le stockage", () => {
  it("stockage vide : persona artiste, aucun rôle", () => {
    expect(parseRoleState(null)).toEqual({ persona: "artist", focusedArtistId: null, jobRole: null, daId: null });
    expect(parseRoleState("")).toEqual({ persona: "artist", focusedArtistId: null, jobRole: null, daId: null });
  });
  it("ancien stockage (persona + artiste zoomé) : les champs de rôle valent null", () => {
    expect(parseRoleState(JSON.stringify({ persona: "label", focusedArtistId: "dadju" }))).toEqual({
      persona: "label",
      focusedArtistId: "dadju",
      jobRole: null,
      daId: null,
    });
  });
  it("un rôle connu et son DA sont relus tels quels", () => {
    expect(parseRoleState(JSON.stringify({ persona: "label", focusedArtistId: null, jobRole: "da", daId: "da-urbain" }))).toEqual({
      persona: "label",
      focusedArtistId: null,
      jobRole: "da",
      daId: "da-urbain",
    });
    expect(parseRoleState(JSON.stringify({ persona: "label", jobRole: "finance" })).jobRole).toBe("finance");
  });
  it("un rôle inconnu, une persona inconnue ou un daId non textuel retombent sur la valeur par défaut", () => {
    const s = parseRoleState(JSON.stringify({ persona: "admin", jobRole: "stagiaire", daId: 42, focusedArtistId: 7 }));
    expect(s).toEqual({ persona: "artist", focusedArtistId: null, jobRole: null, daId: null });
  });
});
