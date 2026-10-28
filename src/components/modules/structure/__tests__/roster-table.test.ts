/**
 * Garde-fous du tableau roster, rendu côté serveur (react-dom/server, sans DOM) :
 * - le nombre d'en-têtes de colonne égale `COLS`, que les lignes d'en-tête de
 *   groupe et l'état vide utilisent en `colSpan` — ajouter une colonne sans
 *   toucher `COLS` casserait la mise en page sans erreur ;
 * - un périmètre vide affiche un message, pas un tableau muet.
 *
 * Fichier en `.test.ts` (createElement, pas de JSX) : `vitest.config.ts`
 * n'inclut que `**\/__tests__/**\/*.test.ts`.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import enOrganisation from "@/messages/en/organisation.json";
import enRoster from "@/messages/en/roster.json";
import frOrganisation from "@/messages/fr/organisation.json";
import frRoster from "@/messages/fr/roster.json";
import { ARTISTS, rosterRows } from "@/lib/demo/api";
import { DEFAULT_ORG, addPerson, assignArtist, type OrgGrouping, type OrgState } from "@/lib/demo/org";
import { scopedArtists } from "@/lib/demo/scope";
import { COLS, RosterTable } from "../roster-table";

const HOUSES = { fr: frRoster, en: enRoster } as const;
/* La colonne « Équipe » et les regroupements lisent le namespace de page `organisation`. */
const ORGANISATION = { fr: frOrganisation, en: enOrganisation } as const;

function render(
  locale: "fr" | "en",
  rows: ReturnType<typeof rosterRows>,
  grouped: boolean,
  extra: { groupBy?: OrgGrouping; org?: OrgState } = {},
) {
  return renderToStaticMarkup(
    // Le typage de NextIntlClientProvider exige `children` dans les props (3e argument refusé par tsc).
    // eslint-disable-next-line react/no-children-prop
    createElement(NextIntlClientProvider, {
      locale,
      timeZone: "Europe/Paris",
      messages: { roster: HOUSES[locale], organisation: ORGANISATION[locale] },
      children: createElement(RosterTable, {
        rows,
        grouped,
        focusedArtistId: null,
        onFocus: () => {},
        ...extra,
      }),
    }),
  );
}

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe.each(["fr", "en"] as const)("RosterTable (%s)", (locale) => {
  it("a autant d'en-têtes <th> que COLS", () => {
    expect(count(render(locale, [], true), /<th[\s>]/g)).toBe(COLS);
  });

  it("périmètre vide : une seule ligne, le message d'état vide, sur COLS colonnes", () => {
    const html = render(locale, [], true);
    const body = html.slice(html.indexOf("<tbody"));
    expect(count(body, /<tr[\s>]/g)).toBe(1);
    expect(body).toMatch(new RegExp(`colspan="${COLS}"`, "i"));
    expect(body).toContain((HOUSES[locale] as { table: { empty: string } }).table.empty);
  });

  it("roster complet groupé : un en-tête par catégorie, colspan = COLS, pas de message vide", () => {
    const rows = rosterRows();
    const html = render(locale, rows, true);
    expect(count(html, new RegExp(`<td[^>]*colspan="${COLS}"`, "gi"))).toBe(3);
    expect(html).not.toContain((HOUSES[locale] as { table: { empty: string } }).table.empty);
    // 3 en-têtes de groupe + une ligne par artiste.
    expect(count(html.slice(html.indexOf("<tbody")), /<tr[\s>]/g)).toBe(3 + rows.length);
  });

  it("regroupé par DA puis par pôle : 3 en-têtes (défaut), lignes inchangées", () => {
    const rows = rosterRows();
    for (const groupBy of ["da", "pole"] as const) {
      const html = render(locale, rows, true, { groupBy });
      expect(count(html, new RegExp(`<td[^>]*colspan="${COLS}"`, "gi"))).toBe(3);
      expect(count(html.slice(html.indexOf("<tbody")), /<tr[\s>]/g)).toBe(3 + rows.length);
    }
    expect(render(locale, rows, true, { groupBy: "pole" })).toContain(
      (ORGANISATION[locale] as { poles: Record<string, string> }).poles["pole-urbain"],
    );
  });

  it("colonne Équipe : DA et chef de projet ; un DA ajouté reçoit son groupe", () => {
    const html = render(locale, rosterRows(), true);
    expect(html).toContain("Inès M.");
    expect(html).toContain("Karim B.");
    const added = addPerson(DEFAULT_ORG, "da", "Nadia P.");
    const louane = ARTISTS.find((a) => a.id === "louane")!;
    const org = assignArtist(added.org, louane, "daId", added.id!);
    const byDa = render(locale, rosterRows(scopedArtists({}, ARTISTS, org)), true, { groupBy: "da", org });
    expect(count(byDa, new RegExp(`<td[^>]*colspan="${COLS}"`, "gi"))).toBe(4);
    expect(byDa).toContain("Nadia P.");
  });
});
