import { describe, expect, it } from "vitest";
import { FRANCE_2025_PER_1000 } from "../benchmarks";

describe("repère SNEP 2025 (€ pour 1 000 streams, valeur de gros)", () => {
  it("témoin à la main : 553,028 M€ ÷ 122 Mds ; 84,172 M€ ÷ 31 Mds ; 637,2 M€ ÷ 153 Mds", () => {
    expect(FRANCE_2025_PER_1000.premium).toBeCloseTo(4.533, 3);
    expect(FRANCE_2025_PER_1000.free).toBeCloseTo(2.715, 3);
    expect(FRANCE_2025_PER_1000.audio).toBeCloseTo(4.165, 3);
  });
});
