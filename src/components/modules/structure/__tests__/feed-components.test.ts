/**
 * /fil, rendu côté serveur (react-dom/server, sans DOM), dans les deux langues : carte de note
 * (statut, pastille d'échéance, prise en charge, « Ouvrir », réponses, mentions, historique) et
 * ordre du jour du comité. Une clé de traduction absente fait ÉCHOUER le rendu (onError).
 * Plus : les textes ajoutés (namespace `filpage`) ne partent qu'avec /fil.
 *
 * Fichier en `.test.ts` (createElement, pas de JSX) : vitest n'inclut que `*.test.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { getArtist } from "@/lib/demo/data";
import { TENANTS } from "@/lib/tenant";
import { getMessages, pageMessages, rootClientMessages } from "@/messages";
import frFil from "@/messages/fr/fil.json";
import enFil from "@/messages/en/fil.json";
import frFilPage from "@/messages/fr/filpage.json";
import enFilPage from "@/messages/en/filpage.json";
import frNav from "@/messages/fr/nav.json";
import enNav from "@/messages/en/nav.json";
import { addReply, changeStatus, committeeAgenda, type FeedNote } from "@/lib/userdata/feed-model";
import { seedDaOf, seedNotes } from "@/lib/userdata/feed-seed";
import { SRC } from "@/lib/__tests__/source-ast";
import { NoteCard, type NoteCardProps } from "../feed/note-card";
import { CommitteeAgenda } from "../feed/committee-agenda";

const MESSAGES = { fr: { fil: frFil, filpage: frFilPage, nav: frNav }, en: { fil: enFil, filpage: enFilPage, nav: enNav } } as const;
const TODAY = "2026-10-24";
const seeds = seedNotes(new Date(`${TODAY}T00:00:00Z`), new Date("2026-10-28T12:00:00Z"));
const seed = (id: string) => seeds.find((n) => n.id.endsWith(id))!;
const noop = () => {};

function render(locale: "fr" | "en", child: ReactElement) {
  return renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop
    createElement(NextIntlClientProvider, {
      locale,
      timeZone: "Europe/Paris",
      messages: MESSAGES[locale],
      onError: (e: Error) => {
        throw e;
      },
      children: child,
    }),
  );
}

function card(locale: "fr" | "en", note: FeedNote, over: Partial<NoteCardProps> = {}) {
  const props: NoteCardProps = {
    note,
    today: TODAY,
    canAct: true,
    canSeeArtist: true,
    artist: note.artistId ? getArtist(note.artistId) : null,
    daOf: seedDaOf,
    onStatus: noop,
    onDone: noop,
    onReply: noop,
    onAssign: noop,
    onOpen: noop,
    onFilterArtist: noop,
    ...over,
  };
  return render(locale, createElement(NoteCard, props));
}

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe("NoteCard", () => {
  for (const locale of ["fr", "en"] as const) {
    it(`${locale} : chaque exemple se rend, dans chaque panneau, sans clé manquante`, () => {
      for (const n of seeds) {
        for (const panel of [null, "replies", "history"] as const) {
          expect(card(locale, n, { defaultPanel: panel }).length, `${n.id} ${panel}`).toBeGreaterThan(100);
        }
      }
    });
  }

  it("Louane : statut « Décidé », prise en charge par Camille, pastille « Cette semaine », « Ouvrir le contrat »", () => {
    const html = card("fr", seed("louane"));
    expect(html).toContain('<option value="decided" selected="">Décidé</option>');
    expect(html).toContain("Pris en charge par Camille (Juridique)");
    expect(html).toContain('data-due="soon"');
    expect(html).toContain("Cette semaine");
    expect(html).toContain("Ouvrir le contrat");
    expect(html).toContain("Traité"); // « Traité » reste un clic direct
  });

  it("pastille « En retard » quand l'échéance est passée au jour de la démo ; aucune une fois traitée", () => {
    const late = { ...seed("louane"), dueDate: "2026-10-20" };
    expect(card("fr", late)).toContain('data-due="overdue"');
    expect(card("fr", late)).toContain("En retard");
    expect(card("fr", changeStatus(late, "done", null, "2026-10-24T10:00:00.000Z"))).not.toContain("data-due=");
  });

  it("compteur de réponses visible ; panneau ouvert : les réponses, leurs auteurs, les mentions en pastilles", () => {
    const n = seed("nono");
    expect(card("fr", n)).toContain(`data-replies="${n.replies.length}"`);
    expect(card("fr", n)).toContain(`${n.replies.length} réponses`);
    const open = card("fr", n, { defaultPanel: "replies" });
    for (const r of n.replies) expect(open).toContain(r.by.name);
    expect(open).toContain('data-mention="on"');
    expect(open).toContain("@Finance");
    expect(open).toContain('aria-label="Ta réponse"');
  });

  it("mention d'un DA hors périmètre : pastille barrée, rien d'envoyé", () => {
    const n = addReply(seed("leto"), "@DA Julien tu peux regarder ?", {
      id: "r-x",
      at: "2026-10-24T12:00:00.000Z",
      by: { role: "finance", daId: null, name: "Finance" },
      daOf: seedDaOf,
    });
    expect(card("fr", n, { defaultPanel: "replies" })).toContain('data-mention="out-of-scope"');
  });

  it("historique : une ligne datée par événement", () => {
    const n = seed("louane");
    const html = card("fr", n, { defaultPanel: "history" });
    expect(count(html, /<li>/g)).toBe(n.history.length);
    expect(html).toContain("Créée par DA variété · Julien R.");
    expect(html).toContain("En cours → Décidé, par Direction · Gaël");
  });

  it("DA hors périmètre : lecture seule (pas de sélecteur de statut, ni « Ouvrir », ni zone de réponse)", () => {
    const html = card("fr", seed("louane"), { canAct: false, canSeeArtist: false, defaultPanel: "replies" });
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Ouvrir le contrat");
    expect(html).not.toContain('aria-label="Ta réponse"');
    expect(html).toContain("Lecture seule");
  });

  it("comité (sans artiste) : « Ouvrir Splits » ; anglais : libellés anglais", () => {
    expect(card("fr", seed("comite-catalogue"))).toContain("Ouvrir Splits");
    const en = card("en", seed("louane"));
    expect(en).toContain("Open the contract");
    expect(en).toContain("This week");
    expect(en).toContain("Owned by Camille (Legal)");
  });
});

describe("CommitteeAgenda", () => {
  const props = (notes: FeedNote[]) => ({
    groups: committeeAgenda(notes),
    today: TODAY,
    houseName: "Day One × Universal",
    artistName: (id: string) => getArtist(id).name,
    onPrint: noop,
  });

  for (const locale of ["fr", "en"] as const) {
    it(`${locale} : se rend sans clé manquante`, () => {
      expect(render(locale, createElement(CommitteeAgenda, props(seeds))).length).toBeGreaterThan(200);
    });
  }

  it("les six exemples non traités, par urgence puis par service, avec responsables et bouton Imprimer masqué à l'impression", () => {
    const html = render("fr", createElement(CommitteeAgenda, props(seeds)));
    expect(count(html, /class="agenda-item/g)).toBe(6);
    expect(html.indexOf('data-urgency="urgent"')).toBeLessThan(html.indexOf('data-urgency="important"'));
    expect(html.indexOf('data-urgency="important"')).toBeLessThan(html.indexOf('data-urgency="info"'));
    expect(html).toContain("Responsable : Thomas (Finance)");
    expect(html).toContain("Responsable : à attribuer"); // Leto
    expect(html).toContain('data-print="hide"');
    expect(html).toContain("6 points");
  });

  it("une note traitée sort de l'ordre du jour ; tout traité : message vide", () => {
    const one = seeds.map((n) => (n.id === "seed-avance-leto" ? changeStatus(n, "done", null, "2026-10-24T10:00:00.000Z") : n));
    expect(count(render("fr", createElement(CommitteeAgenda, props(one))), /class="agenda-item/g)).toBe(5);
    const none = seeds.map((n) => changeStatus(n, "done", null, "2026-10-24T10:00:00.000Z"));
    expect(render("fr", createElement(CommitteeAgenda, props(none)))).toContain("Rien à l&#x27;ordre du jour");
  });
});

describe("namespace filpage : il ne part qu'avec /fil", () => {
  const MARKERS = { fr: "Ordre du jour du comité", en: "Committee agenda" } as const;
  for (const locale of ["fr", "en"] as const) {
    for (const tenant of Object.values(TENANTS)) {
      it(`${locale} · ${tenant.id} : ni la racine (pages publiques comprises) ni la requête ; la page, oui`, () => {
        for (const m of [rootClientMessages(locale, tenant), getMessages(locale, tenant)]) {
          expect(Object.keys(m)).not.toContain("filpage");
          expect(JSON.stringify(m)).not.toContain(MARKERS[locale]);
        }
        const page = pageMessages(locale, ["filpage"], tenant) as Record<string, unknown>;
        expect(page.filpage).toBe(MESSAGES[locale].filpage);
        expect(JSON.stringify(page)).toContain(MARKERS[locale]); // témoin : le marqueur trouve le texte quand il y est
        expect(page.fil).toBeDefined(); // les messages racine restent
      });
    }
  }

  it("app/(dashboard)/fil/page.tsx enveloppe la vue dans PageIntlProvider avec filpage", () => {
    const text = readFileSync(join(SRC, "app/(dashboard)/fil/page.tsx"), "utf8");
    expect(text).toMatch(/<PageIntlProvider namespaces=\{\["filpage"\]\}>/);
    expect(text).not.toMatch(/^"use client"/m);
  });
});
