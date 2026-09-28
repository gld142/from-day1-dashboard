/**
 * Grille Day 1 Pro (décidée le 25/09/2026 avec Gaël).
 * Un abonnement = la vue structure + un premier artiste (et sa vue à lui) ;
 * chaque artiste de plus s'ajoute au même prix ; les invités sont gratuits.
 * Tarif de lancement jusqu'au 31/01/2027 inclus, puis prix public.
 * Au-delà de 15 artistes : sur devis.
 *
 * Tous ces montants sont HORS TAXES (décidé le 28/09/2026 : Day 1 Pro ne
 * s'adresse qu'à des pros). La TVA, si Day 1 y est soumis, s'ajoute par-dessus
 * au paiement (prix Stripe en `tax_behavior: "exclusive"`, voir stripe.ts).
 */
export const LAUNCH_END = new Date("2027-02-01T00:00:00+01:00");
export const BASE_LAUNCH_EUR = 99;
export const BASE_PUBLIC_EUR = 149;
export const EXTRA_ARTIST_EUR = 39;
export const QUOTE_ABOVE = 15;

/** Un montant de la grille tel qu'on l'affiche : « 99 € HT », insécable (« HT » ne part jamais seul à la ligne). */
export const eurHT = (n: number) => `${n.toLocaleString("fr-FR")}\u00a0€\u00a0HT`;

export type Quote =
  | { kind: "price"; artists: number; base: number; extras: number; monthly: number; launch: boolean }
  | { kind: "quote"; artists: number };

export function quoteFor(artists: number, now: Date = new Date()): Quote {
  const n = Math.max(1, Math.floor(artists));
  if (n > QUOTE_ABOVE) return { kind: "quote", artists: n };
  const launch = now < LAUNCH_END;
  const base = launch ? BASE_LAUNCH_EUR : BASE_PUBLIC_EUR;
  const extras = (n - 1) * EXTRA_ARTIST_EUR;
  return { kind: "price", artists: n, base, extras, monthly: base + extras, launch };
}
