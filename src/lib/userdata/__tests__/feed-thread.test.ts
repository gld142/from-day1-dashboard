import { describe, expect, it } from "vitest";
import { lastMessageAt, seenBy, threadItems } from "@/lib/userdata/feed-thread";
import { REACTIONS, toggleReaction } from "@/lib/userdata/feed-reactions";
import { seedNotes } from "@/lib/userdata/feed-seed";
import type { FeedAttachment } from "@/lib/userdata/feed-attachment";

const seeds = seedNotes(new Date("2026-10-24T00:00:00Z"), new Date("2026-10-28T12:00:00Z"));
const louane = seeds.find((n) => n.id.endsWith("louane"))!;

describe("la conversation d'une note, sur une seule ligne de temps", () => {
  it("la note en tête, puis réponses et gestes dans l'ordre, sans doublon de réponse", () => {
    const items = threadItems(louane);
    expect(items[0].kind).toBe("note");
    const dates = items.map((i) => i.at);
    expect([...dates].sort()).toEqual(dates);
    expect(items.filter((i) => i.kind === "reply")).toHaveLength(louane.replies.length);
    // les événements « created » et « reply » ne sont pas répétés en ligne d'événement
    const events = items.filter((i) => i.kind === "event");
    expect(events).toHaveLength(louane.history.filter((e) => e.type !== "created" && e.type !== "reply").length);
  });

  it("une pièce jointe prend sa place dans le temps, et devient le dernier message", () => {
    const a = { id: "a1", name: "x.csv", addedAt: "2030-01-01T00:00:00.000Z" } as FeedAttachment;
    const items = threadItems(louane, [a]);
    expect(items[items.length - 1].kind).toBe("attachment");
    expect(lastMessageAt(louane, [a])).toBe(a.addedAt);
  });

  it("« Vu par » : les autres lecteurs passés après le dernier message, pas moi, pas le point de départ", () => {
    const at = "2026-10-28T10:00:00.000Z";
    const state = {
      finance: { [louane.id]: "2026-10-28T11:00:00.000Z" },
      juridique: { [louane.id]: "2026-10-27T09:00:00.000Z" },
      direction: { [louane.id]: "2026-10-28T12:00:00.000Z", __since: "2026-10-28T00:00:00.000Z" },
      "da:da-variete": { autre: "2026-10-28T12:00:00.000Z" },
    };
    expect(seenBy(state, louane.id, at, "direction")).toEqual(["finance"]);
    expect(seenBy(state, louane.id, at, "structure")).toEqual(["direction", "finance"]);
  });
});

describe("réactions en un clic", () => {
  it("un clic ajoute, un second retire ; chacun la sienne", () => {
    let s = toggleReaction({}, "r1", REACTIONS[0], "finance");
    s = toggleReaction(s, "r1", REACTIONS[0], "juridique");
    expect(s.r1?.[REACTIONS[0]]).toEqual(["finance", "juridique"]);
    s = toggleReaction(s, "r1", REACTIONS[0], "finance");
    expect(s.r1?.[REACTIONS[0]]).toEqual(["juridique"]);
  });
});
