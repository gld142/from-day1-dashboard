/**
 * Classification par groupe à partir des lignes ℗ / © Spotify (market/groups.ts).
 * Les lignes d'exemple sont celles mesurées le 17/09/2026 sur le Top 200 France.
 */
import { describe, expect, it } from "vitest";
import { classifyLabel, distributorOf, groupFromText, INDIES, MAJORS, MARKET_GROUPS } from "../market/groups";

describe("groupFromText — mots-clés sur mot entier", () => {
  it("reconnaît les divisions des majors, insensible à la casse", () => {
    expect(groupFromText("Universal Music Division Capitol Music France")?.group).toBe("universal");
    expect(groupFromText("Rec. 118 / Warner Music France")?.group).toBe("warner");
    expect(groupFromText("Columbia, a division of SONY MUSIC ENTERTAINMENT")?.group).toBe("sony");
    expect(groupFromText("Because Music")?.group).toBe("because");
    expect(groupFromText("Play Two")?.group).toBe("playtwo");
    expect(groupFromText("Wagram Music")?.group).toBe("wagram");
  });

  it("ne matche pas un mot-clé au milieu d'un mot (« emi » dans « Premier », « epic » dans « Epicerie »)", () => {
    expect(groupFromText("Premier Cru Records")).toBeNull();
    expect(groupFromText("Epicerie Fine")).toBeNull();
    expect(groupFromText("EMI Records")?.group).toBe("universal");
  });

  it("retourne null sans mot-clé", () => {
    expect(groupFromText("Caliente Records")).toBeNull();
    expect(groupFromText("")).toBeNull();
  });
});

describe("distributorOf — formules de distribution / licence exclusive", () => {
  it("extrait le distributeur après la formule, coupé à la virgule", () => {
    expect(distributorOf("© Distribution Exclusive Warner Music France, © 2026 Nakamura Industrie")).toBe(
      "Warner Music France",
    );
    expect(distributorOf("℗ 2025 Bendo Music, sous licence exclusive Believe")).toBe("Believe");
    expect(distributorOf("℗ 2025 92i under exclusive license to Universal Music Division Capitol")).toBe(
      "Universal Music Division Capitol",
    );
    expect(distributorOf("℗ 2024 XYZ, distributed by Believe")).toBe("Believe");
  });

  it("ne mange pas la première lettre d'un distributeur commençant par « a »", () => {
    expect(distributorOf("Licence exclusive Atlantic Records")).toBe("Atlantic Records");
  });

  it("retourne null sans formule", () => {
    expect(distributorOf("℗ 2026 Caliente Records")).toBeNull();
  });
});

describe("classifyLabel", () => {
  it("sans ligne : unknown, estimé, sans preuve", () => {
    expect(classifyLabel([])).toEqual({ group: "unknown", provenance: "estimated", evidence: null });
    expect(classifyLabel(["  "])).toEqual({ group: "unknown", provenance: "estimated", evidence: null });
  });

  it("le distributeur exclusif décide, même si le ℗ cite un label propre", () => {
    const lines = [
      "© Distribution Exclusive Warner Music France, © 2026 Nakamura Industrie",
      "℗ Distribution Exclusive Warner Music France, ℗ 2025 Nakamura Industrie",
    ];
    const c = classifyLabel(lines);
    expect(c.group).toBe("warner");
    expect(c.provenance).toBe("measured");
    // Les lignes ℗ passent avant les © : la preuve est la ligne ℗.
    expect(c.evidence).toBe(lines[1]);
  });

  it("un distributeur exclusif inconnu l'emporte sur un mot-clé cité ailleurs", () => {
    const c = classifyLabel(["© 2025 Universal Music Publishing", "℗ 2025 Bendo Music, distribué exclusivement par Bendo Distribution"]);
    expect(c.group).toBe("other");
    expect(c.provenance).toBe("measured");
  });

  it("premier mot-clé, ℗ avant ©", () => {
    expect(classifyLabel(["© 2025 Caliente Records", "℗ 2025 Rec. 118"]).group).toBe("warner");
    expect(classifyLabel(["© 2025 Sony Music Entertainment", "℗ 2025 Polydor (France)"]).group).toBe("universal");
  });

  it("ignore les segments d'édition (publishing / éditions)", () => {
    const c = classifyLabel(["℗ 2025 YPDP / Universal Music Publishing", "© 2025 YPDP"]);
    expect(c.group).toBe("other");
    expect(c.evidence).toBe("℗ 2025 YPDP / Universal Music Publishing");
  });

  it("des lignes sans aucun groupe : other, mesuré, preuve = première ligne ℗", () => {
    expect(classifyLabel(["© 2026 Caliente Records", "℗ 2026 Caliente Records"])).toEqual({
      group: "other",
      provenance: "measured",
      evidence: "℗ 2026 Caliente Records",
    });
  });

  it("grands indés", () => {
    expect(classifyLabel(["℗ 2025 Believe"]).group).toBe("believe");
    expect(classifyLabel(["℗ 2025 TuneCore"]).group).toBe("believe");
    expect(classifyLabel(["℗ 2025 IDOL"]).group).toBe("idol");
    expect(classifyLabel(["℗ 2025 Kuroneko"]).group).toBe("kuroneko");
  });

  it("normalise les espaces multiples et insécables", () => {
    expect(classifyLabel(["℗ 2025 Warner  Music   France"]).group).toBe("warner");
  });
});

describe("listes de groupes", () => {
  it("majors et indés sont des groupes connus, disjoints, hors other/unknown", () => {
    for (const g of [...MAJORS, ...INDIES]) expect(MARKET_GROUPS).toContain(g);
    expect(MAJORS.filter((g) => INDIES.includes(g))).toEqual([]);
    expect([...MAJORS, ...INDIES]).not.toContain("other");
    expect([...MAJORS, ...INDIES]).not.toContain("unknown");
  });
});
