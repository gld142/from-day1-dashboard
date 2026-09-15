import { describe, expect, it } from "vitest";
import { reconstructTrack } from "@/lib/real/reconstruct";

const TODAY = new Date("2026-09-15T00:00:00Z");

describe("reconstructTrack", () => {
  it("est déterministe", () => {
    const a = reconstructTrack({ key: "dadju:Reine", total: 228_869_436, dailyNow: 82_112, days: 365, today: TODAY });
    const b = reconstructTrack({ key: "dadju:Reine", total: 228_869_436, dailyNow: 82_112, days: 365, today: TODAY });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("rend exactement `days` points, datés jusqu'à aujourd'hui, tous ≥ 0", () => {
    const s = reconstructTrack({ key: "x", total: 1_000_000, dailyNow: 3_000, days: 90, today: TODAY });
    expect(s).toHaveLength(90);
    expect(s[s.length - 1].date).toBe("2026-09-15");
    expect(s[0].date).toBe("2026-06-18");
    for (const p of s) expect(p.streams).toBeGreaterThanOrEqual(0);
  });

  it("le dernier jour est ancré sur le débit relevé, et marqué mesuré", () => {
    const s = reconstructTrack({ key: "x", total: 1_000_000, dailyNow: 3_000, days: 30, today: TODAY });
    expect(s[s.length - 1].streams).toBe(3_000);
    expect(s[s.length - 1].provenance).toBe("measured");
    expect(s[0].provenance).toBe("reconstructed");
  });

  it("ne dépasse jamais le total cumulé", () => {
    // Titre récent : 3 000/j sur 365 j ferait 1,1 M > total 400 k.
    const s = reconstructTrack({ key: "y", total: 400_000, dailyNow: 3_000, days: 365, today: TODAY });
    expect(s.reduce((acc, p) => acc + p.streams, 0)).toBeLessThanOrEqual(400_000);
  });

  it("un titre sorti dans la fenêtre est à zéro avant sa sortie et somme ≈ total", () => {
    const s = reconstructTrack({
      key: "z", total: 500_000, dailyNow: 2_000, days: 365, today: TODAY, releaseDate: "2026-07-01",
    });
    expect(s.filter((p) => p.date < "2026-07-01").every((p) => p.streams === 0)).toBe(true);
    const sum = s.reduce((acc, p) => acc + p.streams, 0);
    expect(sum).toBeGreaterThan(500_000 * 0.97);
    expect(sum).toBeLessThanOrEqual(500_000);
  });

  it("les jours mesurés fournis remplacent la reconstruction", () => {
    const s = reconstructTrack({
      key: "m", total: 1_000_000, dailyNow: 3_000, days: 10, today: TODAY,
      measured: { "2026-09-13": 2_500, "2026-09-14": 2_800 },
    });
    const d13 = s.find((p) => p.date === "2026-09-13")!;
    expect(d13.streams).toBe(2_500);
    expect(d13.provenance).toBe("measured");
  });

  it("la saisonnalité hebdo est visible : vendredi > lundi en moyenne", () => {
    const s = reconstructTrack({ key: "w", total: 50_000_000, dailyNow: 10_000, days: 364, today: TODAY });
    const avg = (dow: number) => {
      const xs = s.filter((p) => new Date(`${p.date}T00:00:00Z`).getUTCDay() === dow);
      return xs.reduce((a, p) => a + p.streams, 0) / xs.length;
    };
    expect(avg(5)).toBeGreaterThan(avg(1));
  });

  it("en mode plafond, la veille reste continue avec aujourd'hui", () => {
    // Même cas que « ne dépasse jamais le total » : la réduction se fait par une
    // rampe dans le temps, pas par un facteur uniforme qui ferait sauter le dernier jour.
    const s = reconstructTrack({ key: "y", total: 400_000, dailyNow: 3_000, days: 365, today: TODAY });
    const veille = s[s.length - 2].streams;
    expect(veille).toBeGreaterThanOrEqual(3_000 * 0.75);
    expect(veille).toBeLessThanOrEqual(3_000 * 1.25);
  });
});
