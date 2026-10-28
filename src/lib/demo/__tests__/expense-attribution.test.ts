import { describe, expect, it } from "vitest";
import { ARTISTS, TRACKS } from "@/lib/demo/data";
import { attachToTracks } from "@/lib/demo/expense-attribution";
import { expensesFor as genExpensesFor } from "@/lib/demo/generators";

/* Le rattachement au titre ne doit rien changer aux chiffres : seulement dire
   pour quel titre l'argent a été dépensé. */
describe("dépenses de démo rattachées au titre", () => {
  for (const a of ARTISTS) {
    it(`${a.name} : mêmes montants, mêmes dates, mêmes catégories`, () => {
      const brut = genExpensesFor(a.id, 24);
      const rattache = attachToTracks(a.id, brut);
      expect(rattache).toHaveLength(brut.length);
      rattache.forEach((e, i) => {
        const b = brut[i];
        expect([e.id, e.amount, e.date, e.category, e.label]).toEqual([
          b.id,
          b.amount,
          b.date,
          b.category,
          b.label,
        ]);
        if (b.trackId) expect(e.trackId).toBe(b.trackId);
        if (e.category !== "marketing") expect(e.trackId).toBe(b.trackId);
      });
    });
  }

  it("ne rattache qu'à un titre de l'artiste, cohérent avec son projet", () => {
    for (const a of ARTISTS) {
      for (const e of attachToTracks(a.id, genExpensesFor(a.id, 24))) {
        if (!e.trackId) continue;
        const t = TRACKS.find((x) => x.id === e.trackId)!;
        expect(t.artistId).toBe(a.id);
        expect(e.projectId).toBe(t.projectId);
      }
    }
  });

  it("la majorité du marketing trouve son titre, une part reste à l'artiste", () => {
    const all = ARTISTS.filter((a) => TRACKS.some((t) => t.artistId === a.id)).flatMap((a) =>
      attachToTracks(a.id, genExpensesFor(a.id, 24)).filter((e) => e.category === "marketing"),
    );
    const part = all.filter((e) => e.trackId).length / all.length;
    expect(part).toBeGreaterThan(0.6);
    expect(part).toBeLessThan(0.95);
  });

  it("déterministe : deux appels, le même résultat", () => {
    const a = ARTISTS[0].id;
    expect(attachToTracks(a, genExpensesFor(a, 24))).toEqual(attachToTracks(a, genExpensesFor(a, 24)));
  });
});
