import { describe, expect, it } from "vitest";
import { auditGap, simulatedStatement } from "@/lib/real/audit-gap";

describe("auditGap", () => {
  const estimated = [
    { period: "2026-T2", dsp: "spotify" as const, mid: 10_000 },
    { period: "2026-T2", dsp: "deezer" as const, mid: 3_000 },
  ];

  it("produit un finding attribué au DSP quand l'écart dépasse les deux seuils", () => {
    const f = auditGap("dadju", estimated, [
      { period: "2026-T2", dsp: "spotify", amount: 8_000 },
      { period: "2026-T2", dsp: "deezer", amount: 2_950 },
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ artistId: "dadju", expected: 10_000, reported: 8_000, period: "2026-T2" });
    expect(f[0].source).toMatch(/Spotify/);
    expect(f[0].source).not.toMatch(/label|distrib/i);
    expect(f[0].confidence).toBeGreaterThan(0.6);
    expect(f[0].status).toBe("letter-generated");
  });

  it("ignore un écart relatif sous 12 % ou absolu sous 100 €", () => {
    expect(auditGap("x", estimated, [{ period: "2026-T2", dsp: "spotify", amount: 9_000 }])).toHaveLength(0);
    expect(
      auditGap("x", [{ period: "2026-T2", dsp: "spotify", mid: 500 }], [{ period: "2026-T2", dsp: "spotify", amount: 420 }]),
    ).toHaveLength(0);
  });

  it("n'inclut pas les périodes sans relevé et trie par écart décroissant", () => {
    expect(auditGap("y", estimated, [])).toHaveLength(0);
    const f = auditGap(
      "y",
      [
        { period: "2026-T1", dsp: "spotify", mid: 1_000 },
        { period: "2026-T2", dsp: "spotify", mid: 10_000 },
      ],
      [
        { period: "2026-T1", dsp: "spotify", amount: 700 },
        { period: "2026-T2", dsp: "spotify", amount: 8_000 },
      ],
    );
    expect(f.map((x) => x.expected - x.reported)).toEqual([2_000, 300]);
  });
});

describe("simulatedStatement", () => {
  it("crée un relevé plausible : Spotify sous-payé sur la dernière période, le reste proche de l'estimé", () => {
    const est = [
      { period: "2026-T1", dsp: "spotify" as const, mid: 10_000 },
      { period: "2026-T1", dsp: "deezer" as const, mid: 3_000 },
      { period: "2026-T2", dsp: "spotify" as const, mid: 11_000 },
      { period: "2026-T2", dsp: "deezer" as const, mid: 3_200 },
    ];
    const s = simulatedStatement("dadju", est);
    expect(s).toHaveLength(4);
    const gaps = auditGap("dadju", est, s);
    expect(gaps.length).toBeGreaterThanOrEqual(1);
    expect(gaps.every((g) => g.source.includes("Spotify"))).toBe(true);
    expect(JSON.stringify(simulatedStatement("dadju", est))).toBe(JSON.stringify(s));
  });
});
