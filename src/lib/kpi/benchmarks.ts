/**
 * Repères de marché PUBLICS, cités avec leur source et leur calcul. Ce sont des
 * repères indicatifs, jamais des mesures sur les données du client.
 *
 * Bilan SNEP du marché de la musique enregistrée en France, 2025 (publié le 18/03/2026),
 * lu le 29/09/2026 : https://snepmusique.com/wp-content/uploads/2026/03/Dossier-de-Presse-Bilan-du-Marche-de-la-Musique-2025-en-France.pdf
 *  - p. 2 (en milliers d'€, valeur de gros HT nette de remises) : abonnement streaming audio
 *    553 028 ; streaming audio financé par la publicité 84 172 ;
 *  - p. 6 : 122 Mds de streams audio premium, 31 Mds de streams audio freemium (arrondis au milliard).
 */
export const SNEP_2025 = {
  source: "SNEP, bilan du marché 2025 (valeur de gros HT, revenus des producteurs)",
  url: "https://snepmusique.com/wp-content/uploads/2026/03/Dossier-de-Presse-Bilan-du-Marche-de-la-Musique-2025-en-France.pdf",
  premiumRevenueK: 553_028,
  freeRevenueK: 84_172,
  premiumStreamsBn: 122,
  freeStreamsBn: 31,
} as const;

/** € pour 1 000 streams = (k€ × 1 000) ÷ (milliards × 1 000 000 000) × 1 000. */
const per1000 = (revenueK: number, streamsBn: number) => (revenueK * 1_000) / (streamsBn * 1e9) * 1_000;

export const FRANCE_2025_PER_1000 = {
  premium: per1000(SNEP_2025.premiumRevenueK, SNEP_2025.premiumStreamsBn),
  free: per1000(SNEP_2025.freeRevenueK, SNEP_2025.freeStreamsBn),
  audio: per1000(SNEP_2025.premiumRevenueK + SNEP_2025.freeRevenueK, SNEP_2025.premiumStreamsBn + SNEP_2025.freeStreamsBn),
};
