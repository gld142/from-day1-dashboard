/**
 * Concerts saisis par le client : validation et bilan. Le CACHET (ce que
 * l'artiste ou la structure touche) entre dans le résultat (/finances) ; la
 * billetterie brute est une information, pas un revenu de la structure.
 */
import { UUID, date, fail, guard, intOrNull, money, round2, text, yearBefore } from "./common";

export type ShowInput = {
  artist_id: string;
  show_date: string;
  city: string;
  country: string | null;
  venue: string | null;
  capacity: number | null;
  tickets_sold: number | null;
  gross_eur: number | null;
  fee_eur: number | null;
  notes: string | null;
};
export type Show = ShowInput & { id: string; updated_at: string };

export function parseShow(raw: Record<string, string | undefined>) {
  return guard((): ShowInput => {
    if (!UUID.test(raw.artist_id ?? "")) fail("Choisis l'artiste concerné.");
    const country = (raw.country ?? "").trim().toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country)) fail("Le pays s'écrit en deux lettres (FR, BE, CH…).");
    const capacity = intOrNull(raw.capacity, 1_000_000);
    const tickets_sold = intOrNull(raw.tickets_sold, 1_000_000);
    if (capacity !== null && tickets_sold !== null && tickets_sold > capacity) fail("Plus de billets vendus que de places.");
    return {
      artist_id: raw.artist_id!,
      show_date: date(raw.show_date, "Indique la date du concert.")!,
      city: text(raw.city, 80, "Indique la ville.")!,
      country: country || null,
      venue: text(raw.venue, 120),
      capacity,
      tickets_sold,
      gross_eur: money(raw.gross_eur),
      fee_eur: money(raw.fee_eur),
      notes: text(raw.notes, 2000),
    };
  });
}

export function summarizeShows(shows: Show[], today: string) {
  const since = yearBefore(today);
  const past = shows.filter((s) => s.show_date < today);
  const past12 = past.filter((s) => s.show_date > since);
  const withFill = past12.filter((s) => s.capacity && s.tickets_sold !== null);
  const seats = withFill.reduce((n, s) => n + (s.capacity ?? 0), 0);
  const sold = withFill.reduce((n, s) => n + (s.tickets_sold ?? 0), 0);
  return {
    upcoming: shows.filter((s) => s.show_date >= today).sort((a, b) => a.show_date.localeCompare(b.show_date)),
    past: past.sort((a, b) => b.show_date.localeCompare(a.show_date)),
    count12: past12.length,
    /** Taux de remplissage sur les concerts des 12 derniers mois dont la jauge et les ventes sont connues. */
    fill: seats > 0 ? sold / seats : null,
    fillBase: withFill.length,
    gross12: round2(past12.reduce((n, s) => n + (s.gross_eur ?? 0), 0)),
    fees12: round2(past12.reduce((n, s) => n + (s.fee_eur ?? 0), 0)),
  };
}
