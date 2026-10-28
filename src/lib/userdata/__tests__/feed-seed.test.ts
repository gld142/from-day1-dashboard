/**
 * Les exemples du fil (feed-seed.ts) et la migration du stockage v1 (feed-store.ts).
 *
 * - Aucun chiffre des réponses ne contredit la démo : chacun est relu ICI dans data.ts ou api.ts,
 *   indépendamment de feed-seed.ts.
 * - Les exemples ne changent pas les destinataires de la spec : « à traiter pour moi » et la
 *   pastille de chaque métier et de chaque DA restent ceux d'avant (feed-store.test.ts).
 * - Un navigateur qui a déjà le fil v1 (la version en ligne avant le 28/10) le garde : chaque
 *   champ stocké est relu tel quel, et ses exemples reçoivent leur vie.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_ARTISTS, ALL_CONTRACTS, ALL_PLACEMENTS } from "@/lib/demo/data";
import { auditFindings } from "@/lib/demo/api";
import { isRouteAllowedForTenant } from "@/lib/internal-routes";
import { JOB_ROLES } from "@/lib/roles";
import { TENANTS } from "@/lib/tenant";
import frSplits from "@/messages/fr/splits.json";
import { LINK_TARGETS, notesForRole, statusOf, type FeedNote } from "@/lib/userdata/feed-model";
import { SEED_IDS, seedDaOf, seedNotes } from "@/lib/userdata/feed-seed";
import { SRC } from "@/lib/__tests__/source-ast";

const TODAY = new Date("2026-10-24T00:00:00Z"); // DEMO_TODAY au 28/10/2026
const NOW = new Date("2026-10-28T12:00:00Z");
const notes = seedNotes(TODAY, NOW);
const byId = Object.fromEntries(notes.map((n) => [n.id, n])) as Record<string, FeedNote>;
const replies = (id: string) => byId[id].replies.map((r) => r.text).join("\n");
const fr = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

describe("exemples : six notes vivantes, cohérentes entre elles", () => {
  it("les six notes de la spec, aux mêmes identifiants, chacune avec des réponses et un historique qui commence par la création", () => {
    expect(notes.map((n) => n.id)).toEqual([...SEED_IDS]);
    expect(notes).toHaveLength(6);
    for (const n of notes) {
      expect(n.replies.length, n.id).toBeGreaterThan(0);
      expect(n.history[0], n.id).toMatchObject({ type: "created", at: n.createdAt });
      const times = n.history.map((e) => e.at);
      expect([...times].sort(), n.id).toEqual(times); // chronologique
      for (const t of [...times, ...n.replies.map((r) => r.at)]) expect(t <= NOW.toISOString(), `${n.id} ${t}`).toBe(true);
    }
  });

  it("statuts variés et responsables crédibles ; aucune note n'arrive traitée", () => {
    expect(Object.fromEntries(notes.map((n) => [n.id, [statusOf(n), n.assigneeId]]))).toEqual({
      "seed-recoupement-nono": ["doing", "thomas"],
      "seed-avance-leto": ["todo", null],
      "seed-option-louane": ["decided", "camille"],
      "seed-comite-catalogue": ["todo", "gael"],
      "seed-edition-gustave": ["doing", "da-compos"],
      "seed-deezer-q3": ["decided", "gael"],
    });
  });

  it("mentions et prises en charge ne visent que des services déjà destinataires : le « à traiter » de chaque rôle ne bouge pas", () => {
    expect(Object.fromEntries(notes.map((n) => [n.id, n.to]))).toEqual({
      "seed-recoupement-nono": ["finance"],
      "seed-avance-leto": ["da"],
      "seed-option-louane": ["juridique"],
      "seed-comite-catalogue": [...JOB_ROLES],
      "seed-edition-gustave": ["da"],
      "seed-deezer-q3": ["direction"],
    });
    for (const n of notes) {
      expect(n.toDas, n.id).toEqual([]);
      for (const e of n.history) if (e.type === "reply" || e.type === "assign") expect(e.added, `${n.id} ${e.type}`).toEqual([]);
    }
    // Au moins une mention s'affiche en pastille dans les exemples (Nono : @Finance ; comité : @Direction).
    expect(replies("seed-recoupement-nono")).toContain("@Finance");
    expect(replies("seed-comite-catalogue")).toContain("@Direction");
  });

  it("chaque réponse est signée par un métier qui a le droit d'agir sur la note (un DA : seulement ses artistes)", () => {
    for (const n of notes) {
      for (const r of n.replies) {
        if (r.by.role === "da" && n.artistId) expect(seedDaOf(n.artistId), `${n.id} · ${r.by.name}`).toBe(r.by.daId);
      }
    }
  });
});

describe("exemples : aucun chiffre qui contredise la démo (relu ici dans data.ts / api.ts)", () => {
  const c = (id: string) => ALL_CONTRACTS.find((x) => x.id === id)!;

  it("Nono La Grinta : l'avance et le recoupement de c-ng-artiste", () => {
    const k = c("c-ng-artiste");
    expect(k.artistId).toBe("nono-la-grinta");
    expect(replies("seed-recoupement-nono")).toContain(`${fr(k.advance)} €`);
    expect(replies("seed-recoupement-nono")).toContain(`${k.recoupedPct} %`);
    expect(k.alerts.some((a) => a.kind === "unusual-clause" && a.message.fr.includes("recoupement croisé"))).toBe(true);
  });

  it("Leto : avance de c-le-licence et reste à recouper = avance × (1 − recoupé)", () => {
    const k = c("c-le-licence");
    expect(k.recoupedPct).toBe(80); // le texte de la note (spec) dit 80 %
    const remaining = k.advance - (k.advance * k.recoupedPct) / 100;
    expect(replies("seed-avance-leto")).toContain(`Reste ${fr(remaining)} € à recouper sur une avance de ${fr(k.advance)} €`);
  });

  it("Louane : l'option du contrat (30/11) et son terme ; l'échéance de la note (le 30 à venir) est dite « interne »", () => {
    const k = c("c-lo-artiste");
    const option = k.alerts.find((a) => a.kind === "option")!.dueDate!;
    expect(option).toBe("2026-11-30");
    expect(byId["seed-option-louane"].dueDate).toBe("2026-10-30"); // inchangé (feed-store.test.ts)
    const text = replies("seed-option-louane");
    expect(text).toContain("avant le 30/11");
    expect(text).toContain(`jusqu'au ${k.endDate.slice(8, 10)}/${k.endDate.slice(5, 7)}/${k.endDate.slice(0, 4)}`);
    expect(text).toContain("On garde le 30/10 comme échéance interne");
  });

  it("Louane, fil posé en novembre : l'échéance tombe sur celle du contrat, plus de phrase « interne »", () => {
    const late = seedNotes(new Date("2026-11-02T00:00:00Z"), new Date("2026-11-05T00:00:00Z"));
    const louane = late.find((n) => n.id === "seed-option-louane")!;
    expect(louane.dueDate).toBe("2026-11-30");
    expect(louane.replies.map((r) => r.text).join()).not.toContain("échéance interne");
  });

  it("Gustave Rudman : la part éditeur de data.ts et ses œuvres sorties non déclarées", () => {
    const share = ALL_ARTISTS.find((a) => a.id === "gustave-rudman")!.publisher!.sharePct;
    const undeclared = ALL_PLACEMENTS.filter((p) => p.artistId === "gustave-rudman" && p.status === "released" && !p.declared);
    expect(undeclared.map((p) => p.title)).toEqual(["Lumière basse"]); // témoin : la liste lue est non vide
    const text = replies("seed-edition-gustave");
    expect(text).toContain(`${share} %`);
    for (const p of undeclared) expect(text).toContain(`« ${p.title} » (${p.performer})`);
    expect(ALL_CONTRACTS.some((x) => x.artistId === "gustave-rudman")).toBe(false); // « relecture en cours » : pas encore de contrat
  });

  it("ElGrandeToto : l'écart d'audit du dernier trimestre clos porte sur Spotify (lettre générée), aucun sur Deezer", () => {
    const findings = auditFindings("elgrandetoto");
    const spotify = findings.find((f) => f.source === "Spotify" && f.period === "2026-T3");
    expect(spotify?.status).toBe("letter-generated");
    expect(findings.some((f) => /deezer/i.test(f.source))).toBe(false);
    expect(replies("seed-deezer-q3")).toContain("l'écart du T3 porte sur Spotify, pas sur Deezer");
  });

  it("comité : les filtres cités existent dans Splits", () => {
    expect([frSplits.filters.pending, frSplits.filters.draft]).toEqual(["En attente", "Brouillons"]);
  });

  it("aucun artiste exclu d'une maison n'est nommé (Kiko chez day1, Dadju chez universal)", () => {
    const all = notes.flatMap((n) => [n.text, ...n.replies.map((r) => r.text)]).join("\n");
    for (const t of Object.values(TENANTS)) {
      for (const id of t.excludedArtists) {
        const name = ALL_ARTISTS.find((a) => a.id === id)!.name;
        expect(all, `${t.id} : ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`, "i"));
      }
    }
  });
});

describe("liens « Ouvrir » : chaque cible existe dans les deux maisons", () => {
  const hrefs = [...new Set([...notes.map((n) => n.link?.href), ...LINK_TARGETS.map((l) => l.href)])];
  it("une page app/(dashboard)/<cible>/page.tsx, ouverte dans day1 ET universal (aucune page interne)", () => {
    expect(hrefs.length).toBeGreaterThan(3);
    for (const href of hrefs) {
      expect(href, String(href)).toMatch(/^\/[a-z-]+$/);
      expect(existsSync(join(SRC, "app/(dashboard)", href!, "page.tsx")), `${href} : page absente`).toBe(true);
      for (const t of Object.values(TENANTS)) expect(isRouteAllowedForTenant(href!, t), `${t.id} ${href}`).toBe(true);
    }
    // Témoin : une page interne est bien refusée par la même règle dans la maison universal.
    expect(isRouteAllowedForTenant("/onboardings", TENANTS.universal)).toBe(false);
  });
  it("chaque exemple a un lien", () => {
    for (const n of notes) expect(n.link, n.id).not.toBeNull();
  });
});

describe("exemples posés au jour même, tôt le matin : jamais d'événement dans le futur", () => {
  it("l'histoire du jour (Louane) est avancée en bloc, l'échéance ne bouge pas", () => {
    const early = new Date("2026-10-24T07:30:00Z");
    const list = seedNotes(TODAY, early);
    for (const n of list) {
      for (const t of [n.createdAt, ...n.history.map((e) => e.at), ...n.replies.map((r) => r.at)]) {
        expect(t <= early.toISOString(), `${n.id} ${t}`).toBe(true);
      }
    }
    expect(list.find((n) => n.id === "seed-option-louane")!.dueDate).toBe("2026-10-30");
  });
});

/* ─── Migration : un navigateur qui a déjà le fil v1 ─── */

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => {
      map.delete(k);
    },
    setItem: (k, v) => {
      map.set(k, String(v));
    },
  };
}

/** Les exemples EXACTEMENT comme les posait feed-store.ts à e8a3294 (horloge réelle du navigateur). */
function v1Seeds(today: Date) {
  const isoDay = (d: Date) => d.toISOString().slice(0, 10);
  const shift = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
  const at = (daysAgo: number) => shift(today, -daysAgo).toISOString();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const day30 = isoDay(today.getUTCDate() < 30 ? new Date(Date.UTC(y, m, 30)) : new Date(Date.UTC(y, m + 1, 30)));
  const friday = isoDay(shift(today, (5 - today.getUTCDay() + 7) % 7));
  const base = { status: "open", doneAt: null };
  return [
    { ...base, id: "seed-recoupement-nono", createdAt: at(1), from: "juridique", fromName: "Juridique · Camille", to: ["finance"], artistId: "nono-la-grinta", urgency: "urgent", dueDate: isoDay(shift(today, 15)), text: "Clause de recoupement croisé de l'avance de Nono La Grinta : à faire retirer au prochain avenant. Échéance 15 jours." },
    { ...base, id: "seed-avance-leto", createdAt: at(2), from: "finance", fromName: "Finance · Thomas", to: ["da"], artistId: "leto", urgency: "important", dueDate: isoDay(shift(today, 30)), text: "Avance de Leto recoupée à 80 % : prévoir la renégociation avant la prochaine sortie." },
    { ...base, id: "seed-option-louane", createdAt: at(0), from: "da", fromName: "DA variété · Julien R.", to: ["juridique"], artistId: "louane", urgency: "urgent", dueDate: day30, text: "Option sur Louane à lever avant le 30." },
    { ...base, id: "seed-comite-catalogue", createdAt: at(3), from: "direction", fromName: "Direction · Gaël", to: ["da", "finance", "juridique", "direction", "presidence"], artistId: null, urgency: "info", dueDate: friday, text: "Comité catalogue vendredi : remonter les œuvres sans split signé." },
    { ...base, id: "seed-edition-gustave", createdAt: at(4), from: "juridique", fromName: "Juridique · Camille", to: ["da"], artistId: "gustave-rudman", urgency: "info", dueDate: null, text: "Contrat d'édition de Gustave Rudman reçu, relecture en cours." },
    { ...base, id: "seed-deezer-q3", createdAt: at(1), from: "finance", fromName: "Finance · Thomas", to: ["direction"], artistId: "elgrandetoto", urgency: "important", dueDate: isoDay(shift(today, 7)), text: "Relevé Deezer Q3 reçu : écart d'audit sur ElGrandeToto, à arbitrer." },
  ];
}

/** La règle « à traiter » de e8a3294, sur la forme v1 : le témoin des pastilles AVANT. */
function v1ForRole(list: ReturnType<typeof v1Seeds>, role: string | null, daId: string | null) {
  return list
    .filter((n) => {
      if (n.status !== "open") return false;
      if (!role) return true;
      if (!n.to.includes(role)) return false;
      if (role === "da" && daId && n.artistId) return seedDaOf(n.artistId) === daId;
      return true;
    })
    .map((n) => n.id)
    .sort();
}

describe("migration du stockage v1 (navigateur qui a déjà vu la version en ligne)", () => {
  type Store = typeof import("@/lib/userdata/feed-store");
  let store: Store;
  const FIRST_LOAD = new Date("2026-10-27T15:12:00Z"); // premier passage sur la version en ligne
  const USER_NOTE = {
    id: "note-user-1",
    createdAt: "2026-10-27T16:01:00.000Z",
    from: "finance",
    fromName: "Finance",
    to: ["juridique"],
    artistId: "zeg-p",
    urgency: "important",
    dueDate: "2026-10-26",
    text: "Note saisie à la main sur la version en ligne.",
    status: "open",
    doneAt: null,
  };
  const DONE_AT = "2026-10-27T15:20:00.000Z"; // « Traité » cliqué 8 minutes après la pose des exemples

  function v1State() {
    const seeds = v1Seeds(FIRST_LOAD).map((n) => (n.id === "seed-deezer-q3" ? { ...n, status: "done", doneAt: DONE_AT } : n));
    return { version: 1, seeded: true, notes: [USER_NOTE, ...seeds] };
  }

  beforeEach(async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    window.localStorage.setItem("day1-feed", JSON.stringify(v1State()));
    vi.resetModules();
    store = await import("@/lib/userdata/feed-store");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("réécrit en v2 ; aucune note perdue ; chaque champ v1 identique", () => {
    store.hydrateFeed(NOW, NOW);
    const saved = JSON.parse(window.localStorage.getItem("day1-feed")!);
    expect(saved.version).toBe(2);
    expect(saved.seeded).toBe(true);
    const after = store.getNotes();
    const before = v1State().notes;
    expect(after.map((n) => n.id)).toEqual(before.map((n) => n.id));
    for (const old of before) {
      const n = after.find((x) => x.id === old.id)!;
      for (const [k, v] of Object.entries(old)) expect(n[k as keyof FeedNote], `${old.id}.${k}`).toEqual(v);
    }
  });

  it("la note saisie à la main n'invente rien : à faire, sans réponse, historique « créée »", () => {
    store.hydrateFeed(NOW, NOW);
    const n = store.getNotes().find((x) => x.id === USER_NOTE.id)!;
    expect([statusOf(n), n.replies, n.assigneeId, n.link]).toEqual(["todo", [], null, null]);
    expect(n.history).toHaveLength(1);
  });

  it("les exemples reçoivent leur vie, rejouée depuis LEUR date de pose", () => {
    store.hydrateFeed(NOW, NOW);
    const nono = store.getNotes().find((x) => x.id === "seed-recoupement-nono")!;
    expect(nono.replies.length).toBeGreaterThan(0);
    expect(statusOf(nono)).toBe("doing");
    expect(nono.assigneeId).toBe("thomas");
    expect(nono.history[1].at > nono.createdAt).toBe(true);
    expect(nono.link).toEqual({ kind: "contract", href: "/contracts" });
  });

  it("un exemple traité en v1 le reste, à sa date ; il ne reçoit que les étapes d'avant", () => {
    store.hydrateFeed(NOW, NOW);
    const deezer = store.getNotes().find((x) => x.id === "seed-deezer-q3")!;
    expect(deezer.status).toBe("done");
    expect(deezer.doneAt).toBe(DONE_AT);
    expect(deezer.history.at(-1)).toMatchObject({ type: "status", to: "done", at: DONE_AT });
    for (const e of deezer.history) expect(e.at <= DONE_AT, e.type).toBe(true);
    for (const r of deezer.replies) expect(r.at <= DONE_AT).toBe(true);
  });

  it("pastilles : pour chaque métier et chaque DA, le « à traiter » migré = celui de la v1", () => {
    store.hydrateFeed(NOW, NOW);
    const v1 = v1State().notes as ReturnType<typeof v1Seeds>;
    const cases: Array<[string | null, string | null]> = [
      [null, null],
      ["finance", null],
      ["juridique", null],
      ["direction", null],
      ["presidence", null],
      ["da", "da-urbain"],
      ["da", "da-variete"],
      ["da", "da-compos"],
    ];
    for (const [role, da] of cases) {
      const now = notesForRole(store.getNotes(), role as never, da, seedDaOf).map((n) => n.id).sort();
      expect(now, `${role} ${da}`).toEqual(v1ForRole(v1, role, da));
    }
  });

  it("relire le stockage migré ne rejoue rien (idempotent)", async () => {
    store.hydrateFeed(NOW, NOW);
    const first = store.feedSnapshot();
    vi.resetModules();
    const again = await import("@/lib/userdata/feed-store");
    again.hydrateFeed(NOW, NOW);
    expect(again.feedSnapshot()).toBe(first);
  });

  it("actions du store : statut, réponse avec mention, prise en charge — persistées ; id inconnu : rien", () => {
    store.hydrateFeed(NOW, NOW);
    const me = { role: "finance" as const, daId: null, name: "Finance" };
    const before = store.feedSnapshot();
    store.setStatus("nulle-part", "doing", me, NOW);
    store.replyToNote("nulle-part", "x", me, seedDaOf, NOW);
    expect(store.feedSnapshot()).toBe(before);
    store.setStatus(USER_NOTE.id, "decided", me, NOW);
    store.replyToNote(USER_NOTE.id, "@Direction à valider", me, seedDaOf, NOW);
    store.assignNoteTo(USER_NOTE.id, "camille", me, seedDaOf, NOW);
    const saved = JSON.parse(window.localStorage.getItem("day1-feed")!).notes.find((n: FeedNote) => n.id === USER_NOTE.id) as FeedNote;
    expect(statusOf(saved)).toBe("decided");
    expect(saved.to).toEqual(["juridique", "direction"]);
    expect(saved.assigneeId).toBe("camille");
    expect(saved.history.map((e) => e.type)).toEqual(["created", "status", "reply", "assign"]);
  });
});
