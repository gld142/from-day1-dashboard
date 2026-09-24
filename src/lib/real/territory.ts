/**
 * Territoire d'écoute (spec §5.2) : villes Spotify → zones → coefficient de
 * taux, et villes → lignes pays (`CountryStreams`) pour la carte du monde.
 *
 * Les snapshots stockent `country` en code ISO2 MESURÉ (ex. "FR", "CI", "TG")
 * mais d'autres appelants peuvent passer un nom fr/en ("France",
 * "Côte d'Ivoire") : `findCountry` normalise et accepte les deux formes.
 */
import type { CountryStreams } from "@/lib/demo/types";
import { TERRITORY_COEF, ZONE_DEFAULTS, ZONES, type Zone } from "./params";
import type { SnapshotCity } from "./types";

export type CountryDef = { iso2: string; iso3: string; nameFr: string; nameEn: string; zone: Zone };

/**
 * Table des pays couverts. Loin d'être exhaustive : suffisante pour les
 * zones du modèle (France/Belgique/Suisse, Europe, Amérique du Nord,
 * Afrique francophone/anglophone la plus fréquente dans les audiences des
 * artistes de la démo) et pour classer le reste dans "rest".
 */
const COUNTRIES: CountryDef[] = [
  // ─── France, Belgique, Suisse + outre-mer (zone frbech) ───
  { iso2: "FR", iso3: "FRA", nameFr: "France", nameEn: "France", zone: "frbech" },
  { iso2: "BE", iso3: "BEL", nameFr: "Belgique", nameEn: "Belgium", zone: "frbech" },
  { iso2: "CH", iso3: "CHE", nameFr: "Suisse", nameEn: "Switzerland", zone: "frbech" },
  { iso2: "LU", iso3: "LUX", nameFr: "Luxembourg", nameEn: "Luxembourg", zone: "frbech" },
  { iso2: "RE", iso3: "REU", nameFr: "La Réunion", nameEn: "Réunion", zone: "frbech" },
  { iso2: "GP", iso3: "GLP", nameFr: "Guadeloupe", nameEn: "Guadeloupe", zone: "frbech" },
  { iso2: "MQ", iso3: "MTQ", nameFr: "Martinique", nameEn: "Martinique", zone: "frbech" },

  // ─── Reste de l'Europe (zone europe) ───
  { iso2: "DE", iso3: "DEU", nameFr: "Allemagne", nameEn: "Germany", zone: "europe" },
  { iso2: "GB", iso3: "GBR", nameFr: "Royaume-Uni", nameEn: "United Kingdom", zone: "europe" },
  { iso2: "ES", iso3: "ESP", nameFr: "Espagne", nameEn: "Spain", zone: "europe" },
  { iso2: "IT", iso3: "ITA", nameFr: "Italie", nameEn: "Italy", zone: "europe" },
  { iso2: "NL", iso3: "NLD", nameFr: "Pays-Bas", nameEn: "Netherlands", zone: "europe" },
  { iso2: "PT", iso3: "PRT", nameFr: "Portugal", nameEn: "Portugal", zone: "europe" },
  { iso2: "TR", iso3: "TUR", nameFr: "Turquie", nameEn: "Turkey", zone: "europe" },

  // ─── Amérique du Nord (zone northAmerica) ───
  { iso2: "US", iso3: "USA", nameFr: "États-Unis", nameEn: "United States", zone: "northAmerica" },
  { iso2: "CA", iso3: "CAN", nameFr: "Canada", nameEn: "Canada", zone: "northAmerica" },

  // ─── Afrique (zone africa) ───
  { iso2: "CI", iso3: "CIV", nameFr: "Côte d'Ivoire", nameEn: "Ivory Coast", zone: "africa" },
  { iso2: "SN", iso3: "SEN", nameFr: "Sénégal", nameEn: "Senegal", zone: "africa" },
  { iso2: "CM", iso3: "CMR", nameFr: "Cameroun", nameEn: "Cameroon", zone: "africa" },
  { iso2: "TG", iso3: "TGO", nameFr: "Togo", nameEn: "Togo", zone: "africa" },
  { iso2: "BJ", iso3: "BEN", nameFr: "Bénin", nameEn: "Benin", zone: "africa" },
  { iso2: "MA", iso3: "MAR", nameFr: "Maroc", nameEn: "Morocco", zone: "africa" },
  { iso2: "DZ", iso3: "DZA", nameFr: "Algérie", nameEn: "Algeria", zone: "africa" },
  { iso2: "TN", iso3: "TUN", nameFr: "Tunisie", nameEn: "Tunisia", zone: "africa" },
  { iso2: "CD", iso3: "COD", nameFr: "RD Congo", nameEn: "DR Congo", zone: "africa" },
  { iso2: "GA", iso3: "GAB", nameFr: "Gabon", nameEn: "Gabon", zone: "africa" },
  { iso2: "ML", iso3: "MLI", nameFr: "Mali", nameEn: "Mali", zone: "africa" },
  { iso2: "BF", iso3: "BFA", nameFr: "Burkina Faso", nameEn: "Burkina Faso", zone: "africa" },
  { iso2: "GN", iso3: "GIN", nameFr: "Guinée", nameEn: "Guinea", zone: "africa" },
  { iso2: "MG", iso3: "MDG", nameFr: "Madagascar", nameEn: "Madagascar", zone: "africa" },
  { iso2: "NG", iso3: "NGA", nameFr: "Nigeria", nameEn: "Nigeria", zone: "africa" },
  { iso2: "GH", iso3: "GHA", nameFr: "Ghana", nameEn: "Ghana", zone: "africa" },

  // ─── Reste du monde (zone rest) ───
  { iso2: "HT", iso3: "HTI", nameFr: "Haïti", nameEn: "Haiti", zone: "rest" },
  { iso2: "BR", iso3: "BRA", nameFr: "Brésil", nameEn: "Brazil", zone: "rest" },
  { iso2: "JP", iso3: "JPN", nameFr: "Japon", nameEn: "Japan", zone: "rest" },
  { iso2: "AU", iso3: "AUS", nameFr: "Australie", nameEn: "Australia", zone: "rest" },
  { iso2: "MX", iso3: "MEX", nameFr: "Mexique", nameEn: "Mexico", zone: "rest" },
];

/** Normalise un libellé pays : minuscule, sans diacritiques, ponctuation → espace. */
function normalize(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BY_ISO2 = new Map<string, CountryDef>();
const BY_NAME = new Map<string, CountryDef>();
for (const c of COUNTRIES) {
  BY_ISO2.set(c.iso2.toLowerCase(), c);
  BY_NAME.set(normalize(c.nameFr), c);
  BY_NAME.set(normalize(c.nameEn), c);
}

/** Résout un libellé pays (ISO2, nom fr ou en) vers sa fiche ; inconnu → null. */
export function findCountry(label: string): CountryDef | null {
  const norm = normalize(label);
  return BY_ISO2.get(norm) ?? BY_NAME.get(norm) ?? null;
}

/** Zone du pays ; un pays non reconnu est classé "rest" par défaut. */
export function zoneOfCountry(label: string): Zone {
  return findCountry(label)?.zone ?? "rest";
}

/**
 * Répartition par zone d'écoute d'un artiste.
 *
 * Sans villes (relevé absent), on retombe sur la répartition par défaut du pays
 * de l'artiste (`ZONE_DEFAULTS`). Avec des villes, on pondère par les auditeurs.
 *
 * `audience` — les auditeurs mensuels de l'artiste — change tout quand il est
 * fourni. Spotify ne publie que les CINQ premières villes : elles ne couvrent
 * qu'une fraction de l'audience, et cette fraction est par construction la plus
 * concentrée. Normaliser à 1 sur ces seules villes revient à prêter à toute
 * l'audience le mélange de sa pointe.
 *
 * Mesuré sur les artistes de la démo : les 5 villes de Kiko totalisent 10 157
 * auditeurs sur 23 888, soit 42,5 % — et elles sont toutes africaines. Son
 * coefficient tombait donc à 0,150, alors que le produit affirme par ailleurs
 * (ZONE_DEFAULTS.TG) qu'un artiste togolais a 35 % d'audience France/Belgique/
 * Suisse et 8 % d'Europe. Ses auditeurs européens existent ; ils sont seulement
 * trop dispersés pour entrer dans un top 5.
 *
 * On mélange donc ce qui est MESURÉ (la part couverte) et ce qui est SUPPOSÉ
 * (le défaut du pays, pour le reste), au prorata de la couverture. Chez Dadju
 * et Nono l'effet est nul à 6 % près, leur pointe ressemblant déjà au défaut
 * français ; chez Kiko le coefficient passe de 0,150 à 0,397.
 */
export function zoneDistribution(
  cities: SnapshotCity[] | null,
  artistCountry: string,
  audience?: number,
): Record<Zone, number> {
  const fallback = () => ({ ...(ZONE_DEFAULTS[artistCountry] ?? ZONE_DEFAULTS.default) });
  if (!cities || cities.length === 0) return fallback();

  const sums: Record<Zone, number> = { frbech: 0, europe: 0, northAmerica: 0, africa: 0, rest: 0 };
  let total = 0;
  for (const city of cities) {
    sums[zoneOfCountry(city.country)] += city.listeners;
    total += city.listeners;
  }
  if (total <= 0) return fallback();

  const mesure = {} as Record<Zone, number>;
  for (const zone of ZONES) mesure[zone] = sums[zone] / total;

  // Sans l'audience totale, on ne peut pas savoir ce que les villes couvrent :
  // on garde l'ancien comportement plutôt que d'inventer une couverture.
  if (!audience || audience <= total) return mesure;

  const couverture = total / audience;
  const defaut = fallback();
  const out = {} as Record<Zone, number>;
  for (const zone of ZONES) {
    out[zone] = couverture * mesure[zone] + (1 - couverture) * defaut[zone];
  }
  return out;
}

/** Coefficient de taux du territoire : moyenne des coefficients pondérée par la répartition. */
export function territoryCoefficient(dist: Record<Zone, number>): number {
  return ZONES.reduce((sum, zone) => sum + dist[zone] * TERRITORY_COEF[zone], 0);
}

/**
 * Regroupe les villes par pays (iso3) pour la carte du monde. Les pays non
 * reconnus sont ignorés (ni dans le groupement, ni dans le dénominateur des
 * parts). Les streams sont répartis au prorata des auditeurs puis arrondis ;
 * l'écart d'arrondi est absorbé sur la première ligne pour une somme exacte.
 */
export function countriesFromCities(cities: SnapshotCity[], totalStreams: number): CountryStreams[] {
  const groups = new Map<string, { iso3: string; nameFr: string; nameEn: string; listeners: number }>();
  let totalListeners = 0;
  for (const city of cities) {
    const def = findCountry(city.country);
    if (!def) continue; // pays inconnu : on l'ignore
    totalListeners += city.listeners;
    const existing = groups.get(def.iso3);
    if (existing) existing.listeners += city.listeners;
    else groups.set(def.iso3, { iso3: def.iso3, nameFr: def.nameFr, nameEn: def.nameEn, listeners: city.listeners });
  }

  const rows: CountryStreams[] = Array.from(groups.values())
    .map((g) => ({
      iso3: g.iso3,
      nameFr: g.nameFr,
      nameEn: g.nameEn,
      streams: totalListeners > 0 ? Math.round((g.listeners / totalListeners) * totalStreams) : 0,
    }))
    .sort((a, b) => b.streams - a.streams);

  if (rows.length > 0) {
    const roundedSum = rows.reduce((s, r) => s + r.streams, 0);
    rows[0] = { ...rows[0], streams: rows[0].streams + (totalStreams - roundedSum) };
  }
  return rows;
}
