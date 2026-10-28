/**
 * Pièce jointe traduite par Day One (feed/attachment-card.tsx), rendue côté serveur
 * (react-dom/server, sans DOM) dans les deux langues : une clé de traduction absente fait ÉCHOUER
 * le rendu (onError). Plus : le namespace `filattach` ne part qu'avec /fil (avec `filpage`),
 * jamais avec la racine.
 *
 * Fichier en `.test.ts` (createElement, pas de JSX) : vitest n'inclut que `*.test.ts`.
 */
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { JOB_ROLES, type JobRole } from "@/lib/roles";
import { TENANTS } from "@/lib/tenant";
import { pageMessages, rootClientMessages } from "@/messages";
import frAttach from "@/messages/fr/filattach.json";
import enAttach from "@/messages/en/filattach.json";
import {
  isAttachmentError,
  translateContract,
  translateText,
  type AttachmentCtx,
  type AttachT,
  type FeedAttachment,
} from "@/lib/userdata/feed-attachment";
import { AttachmentCard, AttachmentPicker } from "../feed/attachment-card";

const MESSAGES = { fr: { filattach: frAttach }, en: { filattach: enAttach } } as const;
type Locale = keyof typeof MESSAGES;

function render(locale: Locale, child: ReactElement) {
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

function ctx(locale: Locale): AttachmentCtx {
  const tr = createTranslator({ locale, messages: MESSAGES[locale], namespace: "filattach", onError: (e) => { throw e; } });
  const t: AttachT = (k, v) => tr(k as never, v as never);
  return { t, locale, by: { role: "da", name: "DA · Inès M." }, now: new Date("2026-10-28T10:00:00Z"), today: "2026-10-24" };
}

/** Les trois sortes de pièce, telles que le fil les recevra. */
function samples(locale: Locale): FeedAttachment[] {
  const csv = `Sales Month;Platform;Artist;Track title;Country;Nb of streams;Net income (EUR)
2026-07;Spotify;Leto;GHALAT;FR;120000;18000.50
2026-08;Deezer;Leto;Nuit;BE;80000;9000
2026-09;Apple Music;Leto;GHALAT;FR;40000;7000`;
  const sheet = `Poste;Budget (€)\nClip;12 000\nPromo radio;8 500`;
  const out = [translateText("releve.csv", csv, ctx(locale)), translateText("budget.csv", sheet, ctx(locale)), translateContract("leto", ctx(locale))];
  return out.map((r) => {
    if (isAttachmentError(r)) throw new Error(r.error);
    return r;
  });
}

const decode = (html: string) =>
  html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

describe("AttachmentCard", () => {
  for (const locale of ["fr", "en"] as const) {
    const m = MESSAGES[locale].filattach;
    it(`${locale} : chaque sorte de pièce se rend pour chaque service et en vue d'ensemble, sans clé manquante`, () => {
      for (const a of samples(locale)) {
        for (const role of [...JOB_ROLES, null] as Array<JobRole | null>) {
          const html = decode(render(locale, createElement(AttachmentCard, { attachment: a, role })));
          expect(html).toContain(m.badge);
          expect(html).toContain(a.headline);
          for (const f of a.figures) expect(html).toContain(f.value);
          for (const p of a.points) expect(html).toContain(p);
          if (role) {
            expect(html).toContain(m.card.forMe.replace("{role}", m.roles[role]));
            expect(html).toContain(a.forRoles[role] ?? m.card.nothingForYou);
          } else {
            expect(html).not.toContain(m.card.forMe.replace(" ({role})", ""));
            expect(html).toContain(m.card.byService);
          }
        }
      }
    });

    it(`${locale} : la ligne du service courant passe devant, les autres sont repliées`, () => {
      const contract = samples(locale)[2];
      const html = decode(render(locale, createElement(AttachmentCard, { attachment: contract, role: "finance" })));
      const mine = html.indexOf(contract.forRoles.finance!);
      const others = html.indexOf(m.card.others);
      expect(mine).toBeGreaterThan(0);
      expect(others).toBeGreaterThan(mine);
      expect(html.indexOf(contract.forRoles.juridique!)).toBeGreaterThan(others);
      expect(html).toMatch(/<details\b/);
      expect(html).not.toMatch(/<details\b[^>]*\sopen/); // replié pour un service…
      const overview = render(locale, createElement(AttachmentCard, { attachment: contract, role: null }));
      expect(overview).toMatch(/<details\b[^>]*\sopen/); // … déplié en vue d'ensemble
      expect(html.split(contract.forRoles.finance!).length - 1).toBe(1); // pas répétée dans les autres
    });
  }
});

describe("AttachmentPicker", () => {
  for (const locale of ["fr", "en"] as const) {
    const m = MESSAGES[locale].filattach;
    it(`${locale} : bouton, zone de dépôt, et « traduire le contrat » seulement avec un artiste`, () => {
      const by = { role: "finance" as const, name: "Finance · Thomas" };
      const withArtist = decode(
        render(locale, createElement(AttachmentPicker, { onAttach: () => {}, ctx: { by }, artistId: "leto", artistName: "Leto" })),
      );
      expect(withArtist).toContain(m.picker.attach);
      expect(withArtist).toContain(m.picker.drop);
      expect(withArtist).toContain(m.picker.contract.replace("{artist}", "Leto"));
      expect(withArtist).toMatch(/type="file"[^>]*accept="[^"]*\.xlsx/);
      const without = decode(render(locale, createElement(AttachmentPicker, { onAttach: () => {}, ctx: { by } })));
      expect(without).toContain(m.picker.attach);
      const buttons = (html: string) => (html.match(/<button\b/g) ?? []).length;
      expect(buttons(withArtist)).toBe(2);
      expect(buttons(without)).toBe(1);
      expect(without).not.toContain("Leto");
    });
  }
});

describe("namespace filattach : il ne part qu'avec /fil", () => {
  for (const locale of ["fr", "en"] as const) {
    for (const house of ["day1", "universal"] as const) {
      it(`${locale} · ${house} : absent de la racine, envoyé avec filpage`, () => {
        const marker = MESSAGES[locale].filattach.badge;
        expect(JSON.stringify(rootClientMessages(locale, TENANTS[house]))).not.toContain(marker); // témoin : la racine ne le porte pas
        const page = pageMessages(locale, ["filpage"], TENANTS[house]) as Record<string, unknown>;
        expect(page.filattach).toBe(MESSAGES[locale].filattach);
        expect(page.filpage).toBeDefined();
        expect((pageMessages(locale, ["organisation"], TENANTS[house]) as Record<string, unknown>).filattach).toBeUndefined();
      });
    }
  }
});
