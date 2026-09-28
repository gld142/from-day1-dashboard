/**
 * Petites règles de gestion du compte client (espace, artistes, abonnement).
 */

/** Une suppression se confirme en retapant le nom : casse et espaces tolérés, rien d'autre. */
export function confirmMatches(typed: string, expected: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(typed) !== "" && norm(typed) === norm(expected);
}

/** Retirer un artiste retire une place payée (39 € HT / mois), sauf la place incluse dans l'abonnement. */
export function quantityAfterRemoval(paid: number): number {
  return Math.max(1, paid - 1);
}

/** Fin d'accès après une résiliation programmée (portail Stripe) ; null si l'abonnement continue. */
export function accessEndsAt(sub: { cancel_at: number | null; cancel_at_period_end: boolean; periodEnd: string | null }): string | null {
  if (sub.cancel_at) return new Date(sub.cancel_at * 1000).toISOString();
  return sub.cancel_at_period_end ? sub.periodEnd : null;
}
