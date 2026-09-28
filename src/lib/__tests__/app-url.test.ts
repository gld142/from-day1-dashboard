import { afterEach, describe, expect, it } from "vitest";
import { appUrl } from "../app-url";

const saved = process.env.APP_URL;
afterEach(() => {
  process.env.APP_URL = saved;
});

describe("appUrl", () => {
  it("construit les liens sortants sur l'adresse configurée, jamais ailleurs", () => {
    process.env.APP_URL = "https://app.from-day1.com";
    expect(appUrl("/invitation/abc")).toBe("https://app.from-day1.com/invitation/abc");
    expect(() => appUrl("//evil.com/x")).toThrow(/chemin invalide/);
    expect(() => appUrl("https://evil.com/x")).toThrow(/chemin invalide/);
  });
  it("refuse de fabriquer un lien sans adresse configurée", () => {
    delete process.env.APP_URL;
    expect(() => appUrl("/x")).toThrow(/APP_URL/);
    process.env.APP_URL = "https://app.from-day1.com/";
    expect(() => appUrl("/x")).toThrow(/APP_URL/);
  });
});
