import { describe, expect, it } from "vitest";
import { normTitle, parseSplit, splitPayouts, type Split } from "../split";

const ARTIST = "9693e109-1b8f-4269-ac0c-7e27b0576019";
const shares = (list: object[]) => JSON.stringify(list);
const base = { artist_id: ARTIST, title: " Titre Un ", status: "draft" };

describe("parseSplit", () => {
  it("valide une feuille : titre nettoyé, ISRC normalisé, parts à 100 % par couche", () => {
    const r = parseSplit({
      ...base,
      isrc: "fr-z03-26-00001",
      shares: shares([
        { name: " Alpha ", role: "interprète", master: "60", publishing: "0" },
        { name: "Beatmaker", role: "producteur", master: "40", publishing: "0" },
        { name: "Plume", role: "auteur", master: "0", publishing: "100" },
      ]),
    });
    expect(r).toEqual({
      ok: true,
      value: {
        artist_id: ARTIST, title: "Titre Un", isrc: "FRZ032600001", status: "draft", notes: null,
        shares: [
          { name: "Alpha", role: "interprète", email: null, master: 60, publishing: 0 },
          { name: "Beatmaker", role: "producteur", email: null, master: 40, publishing: 0 },
          { name: "Plume", role: "auteur", email: null, master: 0, publishing: 100 },
        ],
      },
    });
  });

  it("une couche peut rester vide (0 partout) — ex. seulement le master", () => {
    const r = parseSplit({ ...base, shares: shares([{ name: "A", role: "interprète", master: "50,5" }, { name: "B", role: "feat", master: "49,5" }]) });
    expect(r.ok && r.value.shares.map((s) => s.master)).toEqual([50.5, 49.5]);
  });

  it("refuse avec un message clair", () => {
    const two = (m1: string, m2: string) => shares([{ name: "A", role: "interprète", master: m1 }, { name: "B", role: "producteur", master: m2 }]);
    expect(parseSplit({ ...base, shares: two("60", "30") })).toEqual({ ok: false, error: "Les parts master font 90 % : il faut 100 %." });
    expect(parseSplit({ ...base, shares: shares([{ name: "A", role: "auteur", publishing: "70" }]) })).toEqual({ ok: false, error: "Les parts d'auteur font 70 % : il faut 100 %." });
    expect(parseSplit({ ...base, shares: shares([{ name: "A", role: "auteur" }]) })).toEqual({ ok: false, error: "Indique au moins une part (master ou auteur)." });
    expect(parseSplit({ ...base, shares: shares([{ name: " ", role: "auteur", master: "100" }]) })).toEqual({ ok: false, error: "Chaque participant a besoin d'un nom." });
    expect(parseSplit({ ...base, title: "", shares: two("50", "50") })).toEqual({ ok: false, error: "Indique le titre." });
    expect(parseSplit({ ...base, isrc: "FR123", shares: two("50", "50") })).toEqual({ ok: false, error: "L'ISRC n'a pas le bon format (ex. FR-Z03-26-00001)." });
    expect(parseSplit({ ...base, shares: "pas du json" }).ok).toBe(false);
    expect(parseSplit({ ...base, shares: two("150", "-50") }).ok).toBe(false);
    expect(parseSplit({ ...base, shares: shares(Array.from({ length: 21 }, (_, i) => ({ name: `P${i}`, role: "autre", master: "0" }))) }).ok).toBe(false);
  });
});

describe("normTitle", () => {
  it("rapproche les titres du relevé : casse, accents, espaces", () => {
    expect(normTitle("  Été   Indien ")).toBe(normTitle("ete indien"));
  });
});

describe("splitPayouts", () => {
  const split: Split = {
    id: "s1", updated_at: "2026-09-28", artist_id: ARTIST, title: "Titre Un", isrc: null, status: "agreed", notes: null,
    shares: [
      { name: "Alpha", role: "interprète", email: null, master: 60, publishing: 0 },
      { name: "Beatmaker", role: "producteur", email: null, master: 40, publishing: 0 },
      { name: "Plume", role: "auteur", email: null, master: 0, publishing: 100 },
    ],
  };
  it("revenus master du titre (relevé) × part de chacun", () => {
    const p = splitPayouts(split, { "titre un": 879.7 });
    expect(p).toEqual({ revenue: 879.7, amounts: [527.82, 351.88, 0] });
  });
  it("titre absent du relevé : montants inconnus (null), pas 0", () => {
    expect(splitPayouts(split, {})).toEqual({ revenue: null, amounts: [null, null, null] });
  });
});
