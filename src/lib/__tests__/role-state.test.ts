import { describe, expect, it } from "vitest";
import { boundRole, parseRoleState, withDa } from "@/lib/role";

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

/* La doc de parseRoleState promet « jamais une erreur » ; mesuré le 24/10/2026 : un JSON
   invalide et la chaîne "null" levaient. Et `readRole` ne refabrique l'objet que si la chaîne
   change : la valeur par défaut doit être UNE référence, pas une copie à chaque appel. */
describe("parseRoleState — robuste au stockage abîmé", () => {
  const DEFAULT = parseRoleState(null);
  it("JSON invalide, « null », un tableau : la valeur par défaut, sans lever", () => {
    expect(parseRoleState("{bad")).toEqual({ persona: "artist", focusedArtistId: null, jobRole: null, daId: null });
    expect(parseRoleState("null")).toEqual(DEFAULT);
    expect(parseRoleState("[]")).toBe(DEFAULT);
    expect(parseRoleState("42")).toBe(DEFAULT);
  });
  it("la valeur par défaut est la même référence d'un appel à l'autre", () => {
    expect(parseRoleState(null)).toBe(DEFAULT);
    expect(parseRoleState("")).toBe(DEFAULT);
    expect(parseRoleState("{bad")).toBe(DEFAULT);
    expect(parseRoleState("null")).toBe(DEFAULT);
  });
});

/* Un `daId` inconnu avec le rôle DA donnait un périmètre de 0 artiste — Pulse aurait affiché
   `Math.round(0/0)` = NaN (mesuré le 24/10/2026). Le DA est validé contre la liste de démo.
   Et un rôle DA SANS DA valide ne vaut aucun rôle : relecture du 24/10/2026, `{ jobRole: "da",
   daId: null }` donnait tout le roster (roleScope) sous une barre du haut qui disait « DA ». */
describe("parseRoleState — le DA doit exister", () => {
  it("un daId inconnu est abandonné, un daId connu est gardé", () => {
    expect(parseRoleState(JSON.stringify({ persona: "label", jobRole: "da", daId: "da-inconnu" })).daId).toBeNull();
    expect(parseRoleState(JSON.stringify({ persona: "label", jobRole: "da", daId: "da-compos" })).daId).toBe("da-compos");
  });
  it("rôle DA sans DA valide (inconnu, absent, non textuel) : aucun rôle", () => {
    expect(parseRoleState(JSON.stringify({ persona: "label", jobRole: "da", daId: "da-inconnu" }))).toEqual({
      persona: "label",
      focusedArtistId: null,
      jobRole: null,
      daId: null,
    });
    expect(parseRoleState(JSON.stringify({ persona: "label", jobRole: "da" })).jobRole).toBeNull();
    expect(parseRoleState(JSON.stringify({ persona: "label", jobRole: "da", daId: 42 })).jobRole).toBeNull();
  });
  it("les autres rôles ne portent jamais de DA, même si le stockage en a un", () => {
    expect(parseRoleState(JSON.stringify({ persona: "label", jobRole: "finance", daId: "da-urbain" }))).toEqual({
      persona: "label",
      focusedArtistId: null,
      jobRole: "finance",
      daId: null,
    });
  });
});

/* La même règle au moment d'ÉCRIRE le rôle (setJobRole) : `withDa` est le point unique. */
describe("withDa — un rôle et son DA cohérents", () => {
  it("DA + DA connu : gardés ; DA sans DA : aucun rôle ; autre rôle : DA retiré", () => {
    expect(withDa("da", "da-urbain")).toEqual({ jobRole: "da", daId: "da-urbain" });
    expect(withDa("da", null)).toEqual({ jobRole: null, daId: null });
    expect(withDa("da", "da-inconnu")).toEqual({ jobRole: null, daId: null });
    expect(withDa("finance", "da-urbain")).toEqual({ jobRole: "finance", daId: null });
    expect(withDa(null, "da-urbain")).toEqual({ jobRole: null, daId: null });
  });
});

/* Dans la maison sans rôles (day1), un rôle resté en stockage ne doit changer ni la navigation
   ni la barre du haut : le fournisseur n'expose `jobRole` et `daId` que si la maison a des rôles. */
describe("boundRole — le rôle n'existe que dans la maison à rôles", () => {
  const stored = parseRoleState(JSON.stringify({ persona: "label", jobRole: "da", daId: "da-urbain" }));
  it("maison à rôles : le rôle et son DA passent", () => {
    expect(boundRole(stored, true)).toEqual({ jobRole: "da", daId: "da-urbain" });
  });
  it("maison sans rôles : aucun rôle, aucun DA — quoi que dise le stockage", () => {
    expect(boundRole(stored, false)).toEqual({ jobRole: null, daId: null });
  });
});
