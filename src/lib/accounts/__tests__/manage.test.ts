import { describe, expect, it } from "vitest";
import { accessEndsAt, confirmMatches, quantityAfterRemoval } from "../manage";

describe("confirmMatches — suppression confirmée en retapant le nom", () => {
  it("tolère la casse et les espaces, pas une autre chaîne", () => {
    expect(confirmMatches("  label   test ", "Label Test")).toBe(true);
    expect(confirmMatches("Label", "Label Test")).toBe(false);
    expect(confirmMatches("", "Label Test")).toBe(false);
  });
});

describe("quantityAfterRemoval — retirer un artiste retire une place payée", () => {
  it("sauf la place incluse dans l'abonnement", () => {
    expect(quantityAfterRemoval(3)).toBe(2);
    expect(quantityAfterRemoval(1)).toBe(1);
  });
});

describe("accessEndsAt — résiliation programmée", () => {
  const end = Date.parse("2026-10-28T00:00:00Z") / 1000;
  it("date de résiliation explicite, ou fin de période si résilié en fin de période, sinon rien", () => {
    expect(accessEndsAt({ cancel_at: end, cancel_at_period_end: false, periodEnd: null })).toBe("2026-10-28T00:00:00.000Z");
    expect(accessEndsAt({ cancel_at: null, cancel_at_period_end: true, periodEnd: "2026-10-28T00:00:00.000Z" })).toBe("2026-10-28T00:00:00.000Z");
    expect(accessEndsAt({ cancel_at: null, cancel_at_period_end: false, periodEnd: "2026-10-28T00:00:00.000Z" })).toBeNull();
  });
});
