import { afterEach, describe, expect, it } from "vitest";
import { GATE_CHECK, isValidToken, tokenFor } from "@/lib/gate";
import { cookiePorte, verifierPorte } from "../../../e2e/porte";

/* Les outils e2e de la porte (e2e/porte.ts) : ils vivent hors de src/, mais la formule du jeton
   est celle de src/lib/gate.ts (importée, plus recopiée) — ce test tient les deux ensemble. */

const BASE = "http://127.0.0.1:3100";
const redirection = (location: string, status = 307) => async () => new Response(null, { status, headers: { location } });
const reponse = (status: number) => async () => new Response("ok", { status });

describe("e2e — cookie de la porte", () => {
  const saved = { c: process.env.E2E_GATE_COOKIE, p: process.env.E2E_GATE_PASSWORD };
  afterEach(() => {
    for (const [k, v] of [["E2E_GATE_COOKIE", saved.c], ["E2E_GATE_PASSWORD", saved.p]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("dérive le jeton du mot de passe avec la formule de src/lib/gate.ts", async () => {
    delete process.env.E2E_GATE_COOKIE;
    process.env.E2E_GATE_PASSWORD = "mot-de-passe-factice";
    expect(await cookiePorte()).toBe(await tokenFor("mot-de-passe-factice"));
  });
  it("E2E_GATE_COOKIE prime sur le mot de passe", async () => {
    process.env.E2E_GATE_COOKIE = "valeur-telle-quelle";
    process.env.E2E_GATE_PASSWORD = "autre";
    expect(await cookiePorte()).toBe("valeur-telle-quelle");
  });
  it("aucune des deux variables : erreur française explicite", async () => {
    delete process.env.E2E_GATE_COOKIE;
    delete process.env.E2E_GATE_PASSWORD;
    await expect(cookiePorte()).rejects.toThrow(/E2E_GATE_COOKIE[\s\S]*E2E_GATE_PASSWORD/);
  });
  it("la formule importée est bien celle que le proxy contrôle (empreinte GATE_CHECK)", async () => {
    // Un mot de passe factice n'a pas l'empreinte de la prod : le contrôle doit le refuser.
    expect(await isValidToken(await tokenFor("mot-de-passe-factice"))).toBe(false);
    expect(GATE_CHECK).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("e2e — vérification unique de la porte (globalSetup)", () => {
  it("200 avec le cookie : la porte est franchie", async () => {
    await expect(verifierPorte(BASE, "jeton", reponse(200))).resolves.toBeUndefined();
  });
  it("transmet le cookie d1_gate, sans suivre les redirections", async () => {
    let vu: { url: string; init?: RequestInit } | null = null;
    await verifierPorte(BASE, "jeton-x", async (url, init) => {
      vu = { url: String(url), init };
      return new Response("ok", { status: 200 });
    });
    expect(vu!.url).toBe(`${BASE}/pulse`);
    expect(vu!.init?.redirect).toBe("manual");
    expect((vu!.init?.headers as Record<string, string>).cookie).toBe("d1_gate=jeton-x");
  });
  it("redirection vers /acces : mauvais mot de passe — erreur française, sans le secret", async () => {
    const secret = "jeton-secret-0123456789";
    const err = await verifierPorte(BASE, secret, redirection("/acces?next=%2Fpulse")).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/mot de passe/i);
    expect((err as Error).message).toMatch(/\/acces/);
    expect((err as Error).message).not.toContain(secret);
  });
  it("redirection absolue vers /acces : détectée aussi", async () => {
    await expect(verifierPorte(BASE, "j", redirection(`${BASE}/acces?next=%2Fpulse`, 307))).rejects.toThrow(/mot de passe/i);
  });
  it("redirection vers /connexion : démo éteinte côté serveur — message distinct", async () => {
    await expect(verifierPorte(BASE, "j", redirection("/connexion"))).rejects.toThrow(/DEMO_MODE/);
  });
  it("réponse inattendue (500) : erreur avec le statut", async () => {
    await expect(verifierPorte(BASE, "j", reponse(500))).rejects.toThrow(/500/);
  });
});
