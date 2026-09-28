import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "../index";

describe("isCronAuthorized", () => {
  it("n'ouvre qu'avec « Bearer <secret> » exact", () => {
    expect(isCronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(isCronAuthorized(null, "s3cret")).toBe(false);
    expect(isCronAuthorized("Bearer s3cre", "s3cret")).toBe(false);
    expect(isCronAuthorized("s3cret", "s3cret")).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false); // secret absent : fermé
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
  });
});
