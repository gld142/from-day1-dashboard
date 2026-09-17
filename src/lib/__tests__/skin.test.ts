import { describe, expect, it } from "vitest";
import { skinFor } from "@/lib/skin";

describe("skinFor", () => {
  it("la persona label porte la skin structure", () => {
    expect(skinFor("label")).toBe("structure");
  });
  it("la persona artiste porte la skin artiste", () => {
    expect(skinFor("artist")).toBe("artist");
  });
});
