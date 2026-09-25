/**
 * Porte d'accès provisoire (25/09/2026) : l'app n'a pas encore de connexion et
 * s'ouvrait à quiconque connaissait l'adresse. Un mot de passe partagé ferme la
 * porte en attendant la vraie ouverture. Seule l'empreinte SHA-256 est ici.
 */
export const GATE_COOKIE = "d1_gate";
export const GATE_HASH = "f570bb892c2ede62680589404b41706c9661fda9637ae8157e67333e1983c61c";
export const GATE_PATH = "/acces";

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
