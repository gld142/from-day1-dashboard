/**
 * Splits saisis par le client : validation d'une feuille de split et calcul de
 * ce qui revient à chacun sur les revenus MASTER déclarés par le distributeur.
 *
 * Deux couches : `master` (l'enregistrement, payé par les plateformes via le
 * distributeur — c'est ce que les relevés importés contiennent) et
 * `publishing` (droits d'auteur, via la SACEM — absents de ces relevés, donc
 * aucun montant calculé dessus). Une couche entièrement à 0 = non renseignée ;
 * sinon elle doit faire 100 %.
 */

export const SPLIT_ROLES = ["interprète", "feat", "producteur", "auteur", "compositeur", "autre"] as const;
export type SplitRole = (typeof SPLIT_ROLES)[number];

export type SplitShare = { name: string; role: SplitRole; email: string | null; master: number; publishing: number };
export type SplitInput = {
  artist_id: string;
  title: string;
  isrc: string | null;
  status: "draft" | "agreed";
  notes: string | null;
  shares: SplitShare[];
};
export type Split = SplitInput & { id: string; updated_at: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISRC = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SHARES = 20;

class FormError extends Error {}
const fail = (m: string): never => {
  throw new FormError(m);
};

/** « 50,5 » → 50.5 ; vide → 0 ; hors 0–100 → erreur. */
function percent(v: unknown): number {
  const t = String(v ?? "").replace(/[\s%  ]/g, "").replace(",", ".");
  if (!t) return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) fail("Une part doit être entre 0 et 100 %.");
  return Math.round(n * 100) / 100;
}

const total = (shares: SplitShare[], layer: "master" | "publishing") =>
  Math.round(shares.reduce((s, x) => s + x[layer], 0) * 100) / 100;

export function parseSplit(raw: Record<string, string | undefined>): { ok: true; value: SplitInput } | { ok: false; error: string } {
  try {
    if (!UUID.test(raw.artist_id ?? "")) fail("Choisis l'artiste concerné.");
    const title = (raw.title ?? "").trim();
    if (!title) fail("Indique le titre.");
    if (title.length > 300) fail("Le titre est trop long.");
    const isrcRaw = (raw.isrc ?? "").replace(/[\s-]/g, "").toUpperCase();
    if (isrcRaw && !ISRC.test(isrcRaw)) fail("L'ISRC n'a pas le bon format (ex. FR-Z03-26-00001).");
    const status = raw.status === "agreed" ? "agreed" : "draft";
    const notes = (raw.notes ?? "").trim();
    if (notes.length > 2000) fail("Les notes sont trop longues.");

    let list: unknown;
    try {
      list = JSON.parse(raw.shares ?? "[]");
    } catch {
      fail("La liste des participants est illisible.");
    }
    if (!Array.isArray(list) || list.length === 0) fail("Ajoute au moins un participant.");
    if ((list as unknown[]).length > MAX_SHARES) fail(`${MAX_SHARES} participants au maximum.`);
    const shares: SplitShare[] = (list as Record<string, unknown>[]).map((s) => {
      const name = String(s?.name ?? "").trim();
      if (!name) fail("Chaque participant a besoin d'un nom.");
      if (name.length > 120) fail("Un nom est trop long.");
      if (!SPLIT_ROLES.includes(s.role as SplitRole)) fail("Choisis le rôle de chaque participant.");
      const email = String(s?.email ?? "").trim();
      if (email && (email.length > 200 || !EMAIL.test(email))) fail("Un email n'est pas valide.");
      return { name, role: s.role as SplitRole, email: email || null, master: percent(s.master), publishing: percent(s.publishing) };
    });

    const master = total(shares, "master");
    const publishing = total(shares, "publishing");
    if (master === 0 && publishing === 0) fail("Indique au moins une part (master ou auteur).");
    if (master !== 0 && master !== 100) fail(`Les parts master font ${master.toLocaleString("fr-FR")} % : il faut 100 %.`);
    if (publishing !== 0 && publishing !== 100) fail(`Les parts d'auteur font ${publishing.toLocaleString("fr-FR")} % : il faut 100 %.`);

    return { ok: true, value: { artist_id: raw.artist_id!, title: title!, isrc: isrcRaw || null, status, notes: notes || null, shares } };
  } catch (e) {
    if (e instanceof FormError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Rapproche un titre de split d'un titre de relevé : casse, accents, espaces. */
export function normTitle(t: string): string {
  return t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Ce qui revient à chacun sur les revenus MASTER du titre (relevé importé).
 * `revenueByTitle` est indexé par `normTitle`. Titre absent : null, pas 0.
 */
export function splitPayouts(split: Split, revenueByTitle: Record<string, number>) {
  const revenue = revenueByTitle[normTitle(split.title)];
  if (revenue === undefined) return { revenue: null, amounts: split.shares.map(() => null) };
  return { revenue, amounts: split.shares.map((s) => Math.round(revenue * s.master) / 100) };
}
