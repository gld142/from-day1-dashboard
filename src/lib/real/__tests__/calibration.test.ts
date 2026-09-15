import { describe, expect, it } from "vitest";
import { calibrationFromUserData } from "@/lib/real/calibration";
import type { UserData } from "@/lib/userdata/store";

const ud: UserData = {
  version: 1,
  artistName: "Kiko",
  importedAt: "2026-09-15",
  format: "distrokid",
  eurRate: 1,
  sourceCurrency: "EUR",
  months: ["2026-06", "2026-07"],
  streamsByMonth: {
    "2026-06": { spotify: 100_000, deezer: 20_000, apple: 10_000 },
    "2026-07": { spotify: 120_000, deezer: 25_000, apple: 12_000 },
  },
  revenueByMonth: { "2026-06": 480, "2026-07": 560 },
  trackStreams: {},
  countryStreams: {},
  totalStreams: 287_000,
  totalRevenueEur: 1_040,
  active: true,
};

describe("calibrationFromUserData", () => {
  it("déduit un taux moyen par stream et un mix réel", () => {
    const c = calibrationFromUserData(ud)!;
    expect(c.averageRate).toBeCloseTo(1_040 / 287_000, 8);
    expect(c.mix.spotify).toBeCloseTo(220_000 / 287_000, 6);
    expect(Object.values(c.mix).reduce((s, v) => s + (v ?? 0), 0)).toBeCloseTo(1, 6);
    expect(c.period).toEqual({ from: "2026-06", to: "2026-07" });
  });

  it("répartit le taux moyen par DSP au prorata des coefficients", () => {
    const c = calibrationFromUserData(ud)!;
    expect(c.ratePerStream.deezer!).toBeGreaterThan(c.ratePerStream.spotify!);
    const weighted = Object.entries(c.ratePerStream).reduce(
      (s, [dsp, r]) => s + (r ?? 0) * (c.mix[dsp as keyof typeof c.mix] ?? 0),
      0,
    );
    expect(weighted).toBeCloseTo(c.averageRate, 8);
  });

  it("renvoie null sans données actives ou sans streams", () => {
    expect(calibrationFromUserData(null)).toBeNull();
    expect(calibrationFromUserData({ ...ud, active: false })).toBeNull();
    expect(calibrationFromUserData({ ...ud, totalStreams: 0 })).toBeNull();
  });
});
