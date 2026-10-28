import { describe, expect, it } from "vitest";
import { splitMovers } from "@/lib/demo/movers";

/* Les chiffres de la capture du 28/10 (Pulse, maison Universal). */
const ROWS = [
  { id: "elgrandetoto", streams30d: 61_300_000, delta30d: 2.6 },
  { id: "wamen", streams30d: 816_600, delta30d: 2.1 },
  { id: "leto", streams30d: 60_300_000, delta30d: 1.7 },
  { id: "zeg-p", streams30d: 3_600_000, delta30d: 1.2 },
  { id: "brice", streams30d: 1_000_000, delta30d: -0.4 },
  { id: "november", streams30d: 2_000_000, delta30d: -1.7 },
  { id: "nono", streams30d: 48_300_000, delta30d: -1.7 },
  { id: "gustave", streams30d: 219_100, delta30d: -5 },
  { id: "louane", streams30d: 15_100_000, delta30d: -5.2 },
  { id: "kiko", streams30d: 386_900, delta30d: -5.4 },
  { id: "dakeez", streams30d: 1_300_000, delta30d: -7.9 },
];

describe("qui bouge : en hausse, à surveiller, stables", () => {
  it("classe au nombre de streams gagnés, pas au pourcentage", () => {
    const m = splitMovers(ROWS);
    expect(m.up.map((r) => r.id)).toEqual(["elgrandetoto", "leto", "zeg-p"]);
    // +2,6 % sur 61,3 M ≈ 1,55 M d'écoutes de plus
    expect(Math.round(m.up[0].gain / 10_000) * 10_000).toBe(1_550_000);
  });

  it("à surveiller : les plus grosses pertes d'abord", () => {
    expect(splitMovers(ROWS).down.map((r) => r.id)).toEqual(["nono", "louane", "dakeez"]);
  });

  it("compte tout le monde une fois : en hausse + à surveiller + stables = roster", () => {
    const m = splitMovers(ROWS);
    expect([m.upCount, m.downCount, m.stableCount]).toEqual([4, 6, 1]);
    expect(m.upCount + m.downCount + m.stableCount).toBe(ROWS.length);
  });

  it("une variation de −100 % ne casse pas le calcul", () => {
    const m = splitMovers([{ id: "x", streams30d: 0, delta30d: -100 }]);
    expect(m.down[0].gain).toBe(0);
  });
});
