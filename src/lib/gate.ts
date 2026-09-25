/**
 * Porte d'accès provisoire (25/09/2026) : l'app n'a pas encore de connexion et
 * s'ouvrait à quiconque connaissait l'adresse. Un mot de passe partagé ferme la
 * porte en attendant la vraie ouverture.
 * Le cookie vaut sha256("d1-gate|" + mot de passe) ; le code ne garde que
 * l'empreinte de ce cookie : lire le code ne permet pas de fabriquer le cookie.
 */
export const GATE_COOKIE = "d1_gate";
export const GATE_CHECK = "b873781d426abd689f5df0f0283b48dfff07d6ccf29dbd7d9455feea4a815e64";
export const GATE_PATH = "/acces";

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const tokenFor = (password: string) => sha256(`d1-gate|${password}`);
export const isValidToken = async (token: string | undefined) => !!token && (await sha256(token)) === GATE_CHECK;
