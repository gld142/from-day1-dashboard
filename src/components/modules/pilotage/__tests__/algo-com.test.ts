import { describe, expect, it } from "vitest";
import { COM_DEFAULT, comNote } from "@/components/modules/pilotage/algo-trend-panel";
import { createNote } from "@/lib/userdata/feed-model";

describe("Lancer la com : la note envoyée au fil", () => {
  it("part au DA de l'artiste et à la direction par défaut, en « important », avec un lien vers Pulse", () => {
    const n = comNote({ artistId: "nono-la-grinta", text: "  « Son » perce.  ", to: COM_DEFAULT, from: "finance", fromName: "Finance" });
    expect(n).toMatchObject({ from: "finance", fromName: "Finance", to: ["da", "direction"], artistId: "nono-la-grinta", urgency: "important", text: "« Son » perce.", link: { kind: "page", href: "/pulse" } });
  });

  it("sans rôle, la note est signée Direction ; un destinataire en double n'est compté qu'une fois", () => {
    const n = comNote({ artistId: "leto", text: "x", to: ["da", "da", "juridique"], from: null, fromName: "Direction" });
    expect(n.from).toBe("direction");
    expect(n.to).toEqual(["da", "juridique"]);
  });

  it("le fil sait la créer pour l'artiste", () => {
    const n = comNote({ artistId: "leto", text: "x", to: COM_DEFAULT, from: null, fromName: "Direction" });
    const note = createNote(n, { id: "t", at: "2026-10-29T08:00:00.000Z", daOf: (id) => (id === "leto" ? "da-urbain" : null) });
    expect(note.to).toEqual(["da", "direction"]);
    expect(note.artistId).toBe("leto");
  });
});
