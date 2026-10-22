import { describe, expect, it } from "vitest";
import { skinFor, skinForView } from "@/lib/skin";

describe("skinFor", () => {
  it("la persona label porte la skin structure", () => {
    expect(skinFor("label")).toBe("structure");
  });
  it("la persona artiste porte la skin artiste", () => {
    expect(skinFor("artist")).toBe("artist");
  });
});

describe("skinForView — mode client", () => {
  it("la vue label porte la skin structure, la vue artiste la skin artiste", () => {
    expect(skinForView("label")).toBe("structure");
    expect(skinForView("artist")).toBe("artist");
  });
});
