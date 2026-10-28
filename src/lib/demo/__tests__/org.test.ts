/**
 * Organisation modulable de la maison (org.ts) : défaut = l'état d'avant, réattribution qui
 * déplace le périmètre DA, DA à plusieurs catégories, regroupements et sous-totaux, lecture
 * tolérante du stockage. Tourne dans les deux maisons (ARTISTS déjà filtré).
 */
import { describe, expect, it } from "vitest";
import { TENANT } from "@/lib/tenant";
import { ARTISTS, DAS } from "@/lib/demo/data";
import { rosterRows } from "@/lib/demo/api";
import {
  DEFAULT_ORG,
  addPerson,
  addPole,
  applyOrg,
  assignArtist,
  daCategories,
  groupRows,
  isOrgChanged,
  orgDas,
  parseGrouping,
  parseOrgState,
  personName,
  renamePerson,
  resolveAssignment,
} from "@/lib/demo/org";
import { effectiveScope, parseScope, scopeQuery, scopedArtists } from "@/lib/demo/scope";
import { ARTIST_CATEGORIES } from "@/lib/demo/types";

const ids = (list: { id: string }[]) => list.map((a) => a.id).sort();
const artist = (id: string) => {
  const a = ARTISTS.find((x) => x.id === id);
  if (!a) throw new Error(`artiste absent de la maison : ${id}`);
  return a;
};

describe("valeurs par défaut = l'état d'avant", () => {
  it("même DA et même catégorie pour chaque artiste", () => {
    for (const a of ARTISTS) {
      const r = resolveAssignment(a, DEFAULT_ORG);
      expect(r.daId, a.id).toBe(a.daId);
      expect(r.category, a.id).toBe(a.category);
    }
    expect(applyOrg(ARTISTS, DEFAULT_ORG)).toEqual(ARTISTS);
  });
  it("les trois DA de das.ts, mêmes ids, mêmes noms", () => {
    expect(orgDas(DEFAULT_ORG).map((d) => [d.id, d.name])).toEqual(DAS.map((d) => [d.id, d.name]));
  });
  it("le périmètre de chaque DA est inchangé avec l'organisation par défaut", () => {
    for (const d of DAS) {
      expect(ids(scopedArtists({ daId: d.id }, ARTISTS, DEFAULT_ORG))).toEqual(ids(scopedArtists({ daId: d.id })));
    }
    expect(scopedArtists({}, ARTISTS, DEFAULT_ORG)).toEqual(ARTISTS);
  });
  /* Urbain : 6 chez day1 (sans Kiko), 5 chez universal (sans Dadju ni Kiko, 28/10/2026). */
  const URBAIN = TENANT.id === "universal" ? 5 : 6;
  it("les comptes : urbain 6 (day1) ou 5 (universal), variété 2, compositeurs 3 ; un pôle par catégorie", () => {
    const by = Object.fromEntries(groupRows(rosterRows(), "categorie", DEFAULT_ORG).map((g) => [g.key, g.count]));
    expect(by).toEqual({ urbain: URBAIN, variete: 2, compositeur: 3 });
    const poles = Object.fromEntries(groupRows(rosterRows(), "pole", DEFAULT_ORG).map((g) => [g.key, g.count]));
    expect(poles).toEqual({ "pole-urbain": URBAIN, "pole-pop": 2, "pole-edition": 3 });
  });
  it("chaque artiste a une équipe complète (chef de projet, marketing, juriste) qui existe", () => {
    for (const a of ARTISTS) {
      const r = resolveAssignment(a, DEFAULT_ORG);
      for (const id of [r.projectLeadId, r.marketingId, r.legalId]) expect(personName(DEFAULT_ORG, id), `${a.id} ${id}`).toBeTruthy();
    }
    expect(personName(DEFAULT_ORG, resolveAssignment(artist("louane"), DEFAULT_ORG).legalId)).toBe("Camille");
  });
  it("aucun vrai nom de label dans les pôles par défaut (noms traduits, ids génériques)", () => {
    expect(DEFAULT_ORG.poles.map((p) => p.id)).toEqual(["pole-urbain", "pole-pop", "pole-edition"]);
    expect(DEFAULT_ORG.poles.every((p) => p.name === null)).toBe(true);
  });
});

describe("réattribution : le périmètre DA suit l'attribution réelle, pas la catégorie", () => {
  const louane = artist("louane");
  const moved = assignArtist(DEFAULT_ORG, louane, "daId", "da-urbain");

  it("témoin AVANT : Louane est chez Julien R. (variété), pas chez Inès M.", () => {
    expect(ids(scopedArtists({ daId: "da-variete" }, ARTISTS, DEFAULT_ORG))).toContain("louane");
    expect(ids(scopedArtists({ daId: "da-urbain" }, ARTISTS, DEFAULT_ORG))).not.toContain("louane");
  });
  it("APRÈS : Louane passe dans le périmètre d'Inès M. et sort de celui de Julien R.", () => {
    expect(ids(scopedArtists({ daId: "da-urbain" }, ARTISTS, moved))).toContain("louane");
    expect(ids(scopedArtists({ daId: "da-variete" }, ARTISTS, moved))).toEqual(["wamen"]);
  });
  it("le verrou DA de /roster suit aussi (effectiveScope + scopedArtists)", () => {
    const scope = effectiveScope({ category: null, daId: "da-variete" }, "da-urbain");
    expect(ids(scopedArtists(scope, ARTISTS, moved))).toContain("louane");
  });
  it("les lignes du roster portent le nouveau DA (colonne Équipe, export)", () => {
    const row = rosterRows(scopedArtists({}, ARTISTS, moved)).find((r) => r.id === "louane");
    expect(row?.daId).toBe("da-urbain");
    expect(row?.category).toBe("variete");
  });
  it("revenir au DA d'origine efface l'écart : l'état redevient celui par défaut", () => {
    const back = assignArtist(moved, louane, "daId", "da-variete");
    expect(back.assignments).toEqual({});
    expect(isOrgChanged(back)).toBe(false);
  });
  it("une attribution vers une personne inconnue ou du mauvais métier est ignorée", () => {
    expect(assignArtist(DEFAULT_ORG, louane, "daId", "da-inconnu")).toBe(DEFAULT_ORG);
    expect(assignArtist(DEFAULT_ORG, louane, "daId", "cp-urbain")).toBe(DEFAULT_ORG);
    expect(assignArtist(DEFAULT_ORG, louane, "category", "jazz")).toBe(DEFAULT_ORG);
  });
  it("vers un DA AJOUTÉ : il obtient un périmètre, accepté par ?da=", () => {
    const added = addPerson(DEFAULT_ORG, "da", "Nadia P.");
    expect(added.id).toBe("da-org-1");
    const org = assignArtist(added.org, louane, "daId", added.id!);
    expect(ids(scopedArtists({ daId: added.id }, ARTISTS, org))).toEqual(["louane"]);
    const daIds = orgDas(org).map((d) => d.id);
    expect(parseScope(new URLSearchParams(`da=${added.id}`), daIds).daId).toBe(added.id);
    expect(parseScope(new URLSearchParams(`da=${added.id}`)).daId).toBeNull(); // sans l'organisation : inconnu
  });
});

describe("un DA peut gérer plusieurs catégories", () => {
  it("Inès M. reçoit Louane (variété) : elle suit urbain ET variété, le filtre catégorie marche dans son périmètre", () => {
    expect(daCategories(DEFAULT_ORG, ARTISTS, "da-urbain")).toEqual(["urbain"]);
    const org = assignArtist(DEFAULT_ORG, artist("louane"), "daId", "da-urbain");
    expect(daCategories(org, ARTISTS, "da-urbain")).toEqual(["urbain", "variete"]);
    expect(ids(scopedArtists({ daId: "da-urbain", category: "variete" }, ARTISTS, org))).toEqual(["louane"]);
    expect(scopedArtists({ daId: "da-urbain", category: "urbain" }, ARTISTS, org)).toHaveLength(TENANT.id === "universal" ? 5 : 6);
  });
  it("changer la catégorie d'un artiste le déplace de groupe (et de catégorie du DA)", () => {
    const org = assignArtist(DEFAULT_ORG, artist("wamen"), "category", "urbain");
    expect(ids(scopedArtists({ category: "urbain" }, ARTISTS, org))).toContain("wamen");
    expect(daCategories(org, ARTISTS, "da-variete")).toEqual(["urbain", "variete"]);
  });
});

describe("regroupements du roster et sous-totaux", () => {
  const rows = rosterRows();
  const sum = (rs: typeof rows, k: "streams30d" | "revenue12m") => rs.reduce((s, r) => s + r[k], 0);

  for (const by of ["categorie", "da", "pole"] as const) {
    it(`${by} : chaque artiste dans un seul groupe, sous-totaux = somme des lignes, total = roster`, () => {
      const groups = groupRows(rows, by, DEFAULT_ORG);
      expect(groups.reduce((s, g) => s + g.count, 0)).toBe(rows.length);
      expect(ids(groups.flatMap((g) => g.rows))).toEqual(ids(rows));
      for (const g of groups) {
        expect(g.count).toBe(g.rows.length);
        expect(g.streams30d).toBe(sum(g.rows, "streams30d"));
        expect(g.revenue12m).toBe(sum(g.rows, "revenue12m"));
      }
      expect(groups.reduce((s, g) => s + g.revenue12m, 0)).toBeCloseTo(sum(rows, "revenue12m"), 6);
    });
  }
  it("par catégorie : le même calcul que l'en-tête de groupe d'avant (filtre par catégorie)", () => {
    for (const g of groupRows(rows, "categorie", DEFAULT_ORG)) {
      const before = rows.filter((r) => r.category === g.key);
      expect(g.count).toBe(before.length);
      expect(g.streams30d).toBe(sum(before, "streams30d"));
      expect(g.revenue12m).toBe(sum(before, "revenue12m"));
    }
    expect(groupRows(rows, "categorie", DEFAULT_ORG).map((g) => g.key)).toEqual([...ARTIST_CATEGORIES]);
  });
  it("les lignes gardent l'ordre reçu (le tri courant du tableau)", () => {
    const asc = [...rows].sort((a, b) => a.streams30d - b.streams30d);
    for (const g of groupRows(asc, "da", DEFAULT_ORG)) {
      expect(g.rows.map((r) => r.id)).toEqual(asc.filter((r) => r.daId === g.key).map((r) => r.id));
    }
  });
  it("par pôle : un pôle ajouté reçoit l'artiste qu'on y place ; groupes vides retirés", () => {
    const { org, id } = addPole(DEFAULT_ORG, "Pôle Nouveaux talents");
    const moved = assignArtist(org, artist("wamen"), "poleId", id!);
    const groups = groupRows(rosterRows(scopedArtists({}, ARTISTS, moved)), "pole", moved);
    expect(groups.map((g) => g.key)).toEqual(["pole-urbain", "pole-pop", "pole-edition", id]);
    expect(groups.find((g) => g.key === id)?.rows.map((r) => r.id)).toEqual(["wamen"]);
    expect(groupRows([], "pole", moved)).toEqual([]);
  });
  it("par DA après réattribution : sous-totaux recalculés", () => {
    const moved = assignArtist(DEFAULT_ORG, artist("louane"), "daId", "da-urbain");
    const movedRows = rosterRows(scopedArtists({}, ARTISTS, moved));
    const ines = groupRows(movedRows, "da", moved).find((g) => g.key === "da-urbain")!;
    expect(ines.count).toBe((TENANT.id === "universal" ? 5 : 6) + 1);
    expect(ines.revenue12m).toBe(sum(movedRows.filter((r) => r.daId === "da-urbain"), "revenue12m"));
  });
  it("?groupe= : da, pole ; tout le reste = par catégorie ; aller-retour avec les filtres", () => {
    const p = (q: string) => new URLSearchParams(q);
    expect(parseGrouping(p("groupe=da"))).toBe("da");
    expect(parseGrouping(p("groupe=pole"))).toBe("pole");
    expect(parseGrouping(p("groupe=x"))).toBe("categorie");
    expect(parseGrouping(p(""))).toBe("categorie");
    expect(scopeQuery({ category: "urbain", daId: null }, "pole")).toBe("?cat=urbain&groupe=pole");
    expect(scopeQuery({ category: null, daId: null }, "categorie")).toBe("");
    expect(scopeQuery({ category: null, daId: "da-compos" }, "da")).toBe("?da=da-compos&groupe=da");
  });
});

describe("écritures pures", () => {
  it("renommer un DA ; un nom vide ne fait rien", () => {
    const org = renamePerson(DEFAULT_ORG, "da-urbain", "  Inès Martin  ");
    expect(personName(org, "da-urbain")).toBe("Inès Martin");
    expect(renamePerson(DEFAULT_ORG, "da-urbain", "   ")).toBe(DEFAULT_ORG);
    expect(renamePerson(DEFAULT_ORG, "da-inconnu", "X")).toBe(DEFAULT_ORG);
  });
  it("ajouter : ids uniques, nom vide refusé", () => {
    const a = addPerson(DEFAULT_ORG, "da", "A");
    const b = addPerson(a.org, "da", "B");
    expect([a.id, b.id]).toEqual(["da-org-1", "da-org-2"]);
    expect(addPerson(DEFAULT_ORG, "marketing", " ").id).toBeNull();
    expect(addPole(DEFAULT_ORG, "").id).toBeNull();
  });
});

describe("parseOrgState : ne lève jamais", () => {
  it("absent, corrompu, « null », tableau, autre version → la MÊME référence par défaut", () => {
    for (const raw of [null, "", "{bad", "null", "[]", "42", JSON.stringify({ version: 2 })]) {
      expect(parseOrgState(raw)).toBe(DEFAULT_ORG);
    }
  });
  it("aller-retour d'un état modifié", () => {
    let org = renamePerson(DEFAULT_ORG, "da-variete", "Julien Roux");
    const added = addPerson(org, "da", "Nadia P.");
    org = assignArtist(added.org, artist("louane"), "daId", added.id!);
    expect(parseOrgState(JSON.stringify(org))).toEqual(org);
  });
  it("champs mal formés écartés un par un ; les personnes par défaut restent", () => {
    const raw = JSON.stringify({
      version: 1,
      people: [{ id: "da-urbain", name: 7 }, { id: "x", name: "Sans métier", kind: "stagiaire" }, "oops", { id: "mk-org-1", name: "Ok", kind: "marketing" }],
      poles: "pas une liste",
      assignments: { louane: { daId: "da-fantome", category: "variete", poleId: "pole-pop" }, wamen: "oops", leto: { marketingId: "mk-org-1" } },
    });
    const org = parseOrgState(raw);
    expect(personName(org, "da-urbain")).toBe("Inès M.");
    expect(personName(org, "x")).toBeNull();
    expect(personName(org, "mk-org-1")).toBe("Ok");
    expect(org.poles).toEqual(DEFAULT_ORG.poles);
    expect(org.assignments).toEqual({ louane: { category: "variete", poleId: "pole-pop" }, leto: { marketingId: "mk-org-1" } });
    for (const d of DEFAULT_ORG.people) expect(org.people.some((p) => p.id === d.id)).toBe(true);
  });
});
