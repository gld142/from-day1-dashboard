import { afterEach, describe, expect, it } from "vitest";
import { demosFor, hasOwnDemos } from "@/components/modules/algo/discovery-data";
import { USER_ARTIST_ID, clearCustomerData, setCustomerDataSilently, type UserData } from "@/lib/userdata/store";

/* Relevé importé minimal : ce qui suffit à `userArtist()` pour dériver une fiche. */
const IMPORT: UserData = {
  version: 1,
  artistName: "Mon Projet",
  importedAt: "2026-10-24T00:00:00Z",
  format: "generic",
  eurRate: 1,
  sourceCurrency: "EUR",
  months: ["2026-08", "2026-09"],
  streamsByMonth: { "2026-08": { spotify: 12_000 }, "2026-09": { spotify: 15_000 } },
  revenueByMonth: { "2026-08": 40, "2026-09": 50 },
  trackStreams: {},
  countryStreams: {},
  totalStreams: 27_000,
  totalRevenueEur: 90,
  active: true,
};

afterEach(() => clearCustomerData());

/*
 * Depuis f997e92, un id hors d'ALL_ARTISTS lève. Or en démo avec un import actif,
 * role.tsx sert `artistId = "my-project"` et discovery/page.tsx appelle
 * `demosFor(artistId)` sans garde : la page plantait. Le profil importé reçoit
 * ses inédits simulés (bâtis sur son nom et sa catégorie) ; tout autre id
 * inconnu reste un état impossible.
 */
describe("demosFor et le profil importé", () => {
  it("« my-project » avec un import actif : trois inédits simulés à son nom, sans lever", () => {
    setCustomerDataSilently(IMPORT);
    expect(hasOwnDemos(USER_ARTIST_ID)).toBe(false);
    const demos = demosFor(USER_ARTIST_ID);
    expect(demos).toHaveLength(3);
    for (const d of demos) {
      expect(d.artistId).toBe(USER_ARTIST_ID);
      expect(d.title).toMatch(/^Inédit [123] · Mon Projet$/);
    }
    expect(demos.map((d) => d.rank)).toEqual([1, 2, 3]);
  });
  it("« my-project » SANS import actif : ce n'est l'id de personne, lève", () => {
    expect(() => demosFor(USER_ARTIST_ID)).toThrow(/roster complet/);
  });
  it("un id inconnu lève toujours", () => {
    setCustomerDataSilently(IMPORT);
    expect(() => demosFor("inconnu")).toThrow(/roster complet/);
  });
});
