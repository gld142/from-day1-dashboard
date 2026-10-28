import { describe, expect, it } from "vitest";
import { isMine, seenBaseline, unreadOf, viewerKey } from "@/lib/userdata/feed-seen";
import { stakeFor, waitingFor } from "@/lib/userdata/feed-stakes";
import { seedNotes } from "@/lib/userdata/feed-seed";

const TODAY = new Date("2026-10-24T00:00:00Z");
const NOW = new Date("2026-10-28T12:00:00Z");
const seeds = seedNotes(TODAY, NOW);
const seed = (id: string) => seeds.find((n) => n.id.endsWith(id))!;

describe("fil : ce qui est nouveau pour moi", () => {
  it("un DA est un lecteur à part ; sans rôle, « structure »", () => {
    expect(viewerKey("da", "da-urbain")).toBe("da:da-urbain");
    expect(viewerKey("finance", null)).toBe("finance");
    expect(viewerKey(null, null)).toBe("structure");
    expect(isMine({ role: "da", daId: "da-urbain" }, "da", "da-variete")).toBe(false);
  });

  it("ce que j'écris n'est jamais nouveau pour moi ; ce qu'un autre écrit après mon passage, oui", () => {
    const n = seed("nono");
    const last = n.replies[n.replies.length - 1];
    const before = new Date(Date.parse(last.at) - 60_000).toISOString();
    const author = last.by.role;
    expect(unreadOf(n, before, before, author, last.by.daId)).toBe(0);
    const other = author === "finance" ? "juridique" : "finance";
    expect(unreadOf(n, before, before, other, null)).toBeGreaterThanOrEqual(1);
    // après mon passage : plus rien
    expect(unreadOf(n, NOW.toISOString(), before, other, null)).toBe(0);
  });

  it("première visite : seules les 12 dernières heures s'allument, pas tout l'historique", () => {
    const base = seenBaseline(seeds);
    const total = seeds.reduce((s, n) => s + unreadOf(n, undefined, base, "direction", null), 0);
    const all = seeds.reduce((s, n) => s + n.replies.length + 1, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(all);
  });
});

describe("fil : l'enjeu en chiffres et chez qui ça attend", () => {
  it("contrat : l'avance et son recoupement ; audit : ce qui reste à réclamer", () => {
    const leto = stakeFor(seed("leto"));
    expect(leto?.kind).toBe("advance");
    if (leto?.kind === "advance") expect(leto.pct).toBe(80);
    const audit = seeds.find((n) => n.link?.kind === "audit")!;
    const s = stakeFor(audit);
    if (s) expect(s.kind).toBe("claim");
  });

  it("sans lien ni artiste : aucun enjeu inventé", () => {
    expect(stakeFor({ artistId: null, link: null })).toBeNull();
  });

  it("attente : depuis la prise en charge actuelle, rien une fois traitée", () => {
    const n = seed("louane");
    const w = waitingFor(n, NOW.getTime());
    expect(w?.personId).toBe(n.assigneeId);
    expect(w!.days).toBeGreaterThanOrEqual(0);
    expect(waitingFor({ ...n, status: "done" }, NOW.getTime())).toBeNull();
  });
});
