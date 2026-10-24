# Universal v2 — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un seul code, deux adresses : la démo Day 1 (`_deploy`, maison `day1`, sans Kiko) et « Day One × Universal » (`day1-universal`, maison `universal`, sans Dadju), avec un roster de 12 artistes classés en trois catégories et suivis par un DA, cinq rôles métier (DA, finance, juridique, direction, présidence) qui changent l'arrivée, la navigation et le périmètre, et un fil de notes entre services visible dans Pulse, sur le roster et dans une page `/fil`.

**Architecture:** La maison est une variable de build (`NEXT_PUBLIC_TENANT`) lue par un module pur `src/lib/tenant.ts` ; `data.ts` exporte `ARTISTS` déjà filtrés, et tout ce qui en dérive (projets, titres, splits, contrats, accès de l'équipe) suit. Les agrégats label d'`api.ts` acceptent une liste d'artistes en option ; `scope.ts` la calcule depuis `?cat=` / `?da=` ou depuis le DA du rôle. Le rôle vit dans `RoleState` (localStorage, comme la persona) ; `roles.ts` dit pour chaque rôle sa page d'arrivée, ses modules visibles et son périmètre, et `use-modules` pose ce préréglage SOUS les choix de l'utilisateur. Le fil est un store localStorage (`feed-store.ts`, motif `shares-store`) avec des exemples posés une fois. Rien en base, aucune migration, aucun email.

**Tech Stack:** Next.js 16 (app router), React 19, next-intl, Tailwind, framer-motion, lucide-react, vitest (environnement node, shim `window.localStorage`), Playwright (e2e sur build de prod), Vercel CLI 54. Spec : `docs/superpowers/specs/2026-10-23-universal-v2-design.md`.

**Base mesurée le 24/10/2026 (ac4f3f8, `npx vitest run`) :** 68 fichiers, **703 tests**, tous verts, 19 s. Chaque tâche ci-dessous doit laisser la suite verte avec ses tests en plus.

**Règles du dépôt à respecter (AGENTS.md + mémoire) :** `git add -- <fichiers>` explicite, jamais `-A` (une autre session a déjà emporté du travail). Ne jamais lancer `vercel --prod` depuis `from-day1-dashboard` ni depuis un dossier où une session travaille : un worktree PROPRE. La démo figée (`_deploy`, `dpl_9aWB8EN71TCNnVeAnd64XpnJhhWL`) ne se remplace qu'en Task 16, après la comparaison de la Task 14. Les e2e tournent sur le build de prod (`E2E_SERVER=prod`). Lire `node_modules/next/dist/docs/01-app/**/use-search-params.md` avant la Task 6 (frontière `<Suspense>` obligatoire autour d'un composant client qui lit `useSearchParams`). Pas de `git stash` (pile partagée) : un worktree pour tout témoin. Séparer MESURÉ et DÉDUIT dans chaque compte rendu.

**Pourquoi l'ordre des tâches 3 et 4 compte :** `DEMO_TODAY` = `LATEST_DATE` de l'index des relevés (`src/lib/demo/seed.ts`). Le premier `npm run snapshot` (Task 4) avance « aujourd'hui » du 25/09 à la date du relevé, pour TOUS les artistes : les chiffres des cinq artistes conservés bougent alors par construction. Le témoin chiffré de la Task 14 se prend donc sur le commit de la Task 3 (avant relevé), où ils doivent être strictement identiques à la base.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| Create `src/lib/tenant.ts` | `Tenant`, `TENANTS`, `tenantFor()`, `excludeArtists()`, `TENANT` (pur, lu partout) |
| Create `src/lib/__tests__/tenant.test.ts` | Maison par défaut, maison inconnue, exclusions |
| Modify `src/lib/demo/data.ts` | `LABEL` ← tenant ; `DAS` ; 12 artistes (`ALL_ARTISTS`) → `ARTISTS` filtrés ; projets, contrats, placements, accès équipe filtrés |
| Modify `src/lib/demo/types.ts` | `ARTIST_CATEGORIES`, `ArtistCategory`, `DA` ; `Artist.category`, `Artist.daId` |
| Modify `src/lib/userdata/store.ts` | `userArtist()` porte les deux champs |
| Create `src/lib/demo/__tests__/roster-data.test.ts` | Catégorie, DA, ids, cohérence `scripts/artists.json`, exclusions par maison |
| Modify `scripts/artists.json` | Six artistes pour le relevé quotidien |
| Create `src/lib/real/snapshots/{leto,dakeez,louane,wamen,gustave-rudman,brice-davoli}/<date>.json` + `index.ts` régénéré | Premier relevé réel (généré par `npm run snapshot`) |
| Create `src/lib/demo/scope.ts` | `scopedArtists()`, `parseScope()`, `scopeQuery()` |
| Create `src/lib/demo/__tests__/scope.test.ts` | Filtres catégorie / DA, URL, agrégats sur une liste |
| Modify `src/lib/demo/api.ts` | `rosterRows`, `labelTotals`, `pnlByArtist`, `rosterDspEstimates`, `rosterEstimateSummary(-ies)` acceptent une liste |
| Modify `src/app/(dashboard)/roster/page.tsx` | Filtres dans l'URL, `<Suspense>`, totaux et sous-titre au périmètre, compteur de notes |
| Create `src/components/modules/structure/roster-filters.tsx` | Pastilles catégorie / DA |
| Modify `src/components/modules/structure/roster-table.tsx` | Groupes par catégorie avec totaux, colonnes catégorie / DA / notes |
| Modify `src/components/modules/structure/roster-pnl-bars.tsx`, `roster-alerts.tsx` | Respectent la liste d'artistes |
| Create `src/lib/roles.ts` | `JobRole`, `ROLES`, `roleLanding()`, `roleOverrides()`, `roleScope()` |
| Create `src/lib/__tests__/roles.test.ts` | Arrivée, navigation, périmètre par rôle |
| Modify `src/lib/role.tsx` | `RoleState.jobRole`, `daId` ; `setJobRole` ; `DEMO_ARTIST_ID` ← tenant ; persona forcée `label` quand la maison a des rôles |
| Modify `src/components/dashboard/topbar.tsx` | Sélecteur de rôle (maison `universal`), liste d'artistes au périmètre DA |
| Modify `src/components/dashboard/sidebar.tsx`, `mobile-nav.tsx` | Marque et co-marque du tenant, compteur du fil |
| Modify `src/app/layout.tsx` | `metadata.title` ← tenant |
| Modify `src/lib/nav.ts` | Item `/fil`, parcours structure |
| Modify `src/lib/userdata/use-modules.ts` | Préréglage du rôle sous les choix utilisateur |
| Modify `src/lib/__tests__/nav.test.ts` | Item Fil, préréglages par rôle |
| Create `src/lib/userdata/feed-store.ts` | Notes du fil : store, tri, filtres, exemples |
| Create `src/lib/userdata/__tests__/feed-store.test.ts` | Tri, filtres par rôle / DA, exemples posés une fois, « traité », compteurs |
| Create `src/lib/userdata/use-feed.ts` | Abonnement React + périmètre du rôle courant |
| Create `src/app/(dashboard)/fil/page.tsx` | Page « Fil entre services » |
| Create `src/components/dashboard/feed-count.tsx` | Pastille « notes à traiter » dans la navigation |
| Modify `src/app/(dashboard)/pulse/page.tsx` | Périmètre DA ; ligne « notes à traiter » dans « À faire aujourd'hui » |
| Modify `src/messages/index.ts`, `src/messages/{fr,en}/{common,nav,roster,pulse}.json`, Create `src/messages/{fr,en}/fil.json` | Textes FR/EN (parité testée) |
| Modify `src/lib/demo/__tests__/{api-real,forecast,valuation}.test.ts`, `e2e/demo-path.spec.ts`, `e2e/visual-audit.spec.ts` | Kiko n'est plus dans la maison `day1` |
| Modify `.gitignore` | Dossiers de build des deux maisons (`.next-universal/`, `.next-um/`) |
| Modify `AGENTS.md` | Section « Universal v2 » : deux maisons, deux projets Vercel, relevé du matin, retour arrière |

---

### Task 1 : la maison (tenant) et ses consommateurs

**Files:**
- Create: `src/lib/tenant.ts`
- Create: `src/lib/__tests__/tenant.test.ts`
- Modify: `src/lib/demo/data.ts` (`LABEL`, lignes 22-26)
- Modify: `src/lib/role.tsx` (`DEMO_ARTIST_ID`, ligne 28)
- Modify: `src/components/dashboard/sidebar.tsx` (bloc « Marque », lignes 32-45)
- Modify: `src/components/dashboard/mobile-nav.tsx` (lignes 38 et 49)
- Modify: `src/app/layout.tsx` (`metadata`, lignes 22-26)

- [ ] **Step 1 : écrire le test qui échoue**

`src/lib/__tests__/tenant.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { TENANT, TENANTS, excludeArtists, isTenantId, tenantFor } from "@/lib/tenant";

describe("tenantFor — la maison se choisit au build", () => {
  it("sans variable, ou avec une valeur inconnue : Day 1", () => {
    expect(tenantFor(undefined).id).toBe("day1");
    expect(tenantFor("").id).toBe("day1");
    expect(tenantFor("sony").id).toBe("day1");
  });
  it("« universal » : Day One × Universal, co-marque, rôles", () => {
    const t = tenantFor("universal");
    expect(t.id).toBe("universal");
    expect(t.name).toBe("Day One × Universal");
    expect(t.logo?.text).toBe("UNIVERSAL");
    expect(t.roles).toBe(true);
  });
  it("Day 1 : pas de co-marque, pas de sélecteur de rôle", () => {
    expect(TENANTS.day1.logo).toBeNull();
    expect(TENANTS.day1.roles).toBe(false);
    expect(TENANTS.day1.name).toBe("Day 1 Dashboard Pro");
  });
  it("chaque maison exclut exactement un artiste, et son artiste par défaut n'est pas exclu", () => {
    expect(TENANTS.day1.excludedArtists).toEqual(["kiko"]);
    expect(TENANTS.universal.excludedArtists).toEqual(["dadju"]);
    for (const t of Object.values(TENANTS)) expect(t.excludedArtists).not.toContain(t.defaultArtistId);
  });
  it("isTenantId n'accepte que les deux maisons", () => {
    expect(isTenantId("day1")).toBe(true);
    expect(isTenantId("universal")).toBe(true);
    expect(isTenantId("Universal")).toBe(false);
    expect(isTenantId(undefined)).toBe(false);
  });
});

describe("excludeArtists", () => {
  const roster = [{ id: "dadju" }, { id: "kiko" }, { id: "zeg-p" }];
  it("retire les exclus de la maison, garde l'ordre", () => {
    expect(excludeArtists(roster, TENANTS.day1).map((a) => a.id)).toEqual(["dadju", "zeg-p"]);
    expect(excludeArtists(roster, TENANTS.universal).map((a) => a.id)).toEqual(["kiko", "zeg-p"]);
  });
  it("par défaut, c'est la maison du build (day1 sous vitest)", () => {
    expect(TENANT.id).toBe("day1");
    expect(excludeArtists(roster).map((a) => a.id)).toEqual(["dadju", "zeg-p"]);
  });
});
```

- [ ] **Step 2 : vérifier qu'il échoue**

Run : `npx vitest run src/lib/__tests__/tenant.test.ts`
Attendu : FAIL, `Cannot find module '@/lib/tenant'`.

- [ ] **Step 3 : écrire `tenant.ts`**

```ts
/**
 * La « maison » (tenant) : choisie AU BUILD par NEXT_PUBLIC_TENANT, elle règle
 * le nom, la co-marque, le roster (artistes exclus) et le sélecteur de rôle
 * métier. Deux projets Vercel, un seul code (spec Universal v2, §1).
 *
 * Pur et sans import : lu par data.ts (roster), la sidebar, le layout racine
 * (metadata) et role.tsx (artiste ouvert par défaut).
 */
export type TenantId = "day1" | "universal";

export type Tenant = {
  id: TenantId;
  /** « Day 1 Dashboard Pro » / « Day One × Universal » — le nom du label de démo. */
  name: string;
  /** Marque de la sidebar et du menu mobile. */
  shortName: string;
  tagline: string;
  /** Co-marque (null = Day 1 seul). */
  logo: { text: string; bg: string; fg: string } | null;
  /** Artistes du roster complet que cette maison ne montre pas. */
  excludedArtists: string[];
  /** Sélecteur de rôle métier dans la barre du haut (à la place des personas). */
  roles: boolean;
  /** Artiste ouvert par défaut en persona artiste (role.tsx) — jamais un exclu. */
  defaultArtistId: string;
};

export const TENANTS: Record<TenantId, Tenant> = {
  day1: {
    id: "day1",
    name: "Day 1 Dashboard Pro",
    shortName: "Day 1",
    tagline: "Dashboard 360°",
    logo: null,
    excludedArtists: ["kiko"],
    roles: false,
    defaultArtistId: "dadju",
  },
  universal: {
    id: "universal",
    name: "Day One × Universal",
    shortName: "Day One × Universal",
    tagline: "Un dashboard par métier",
    logo: { text: "UNIVERSAL", bg: "#000000", fg: "#ffffff" },
    excludedArtists: ["dadju"],
    roles: true,
    defaultArtistId: "nono-la-grinta",
  },
};

export function isTenantId(v: string | undefined): v is TenantId {
  return v === "day1" || v === "universal";
}

export function tenantFor(raw: string | undefined): Tenant {
  return TENANTS[isTenantId(raw) ? raw : "day1"];
}

/**
 * La maison du build. Lecture LITTÉRALE de `process.env.NEXT_PUBLIC_TENANT` :
 * Next ne remplace la variable côté client que sous cette forme exacte.
 */
export const TENANT: Tenant = tenantFor(process.env.NEXT_PUBLIC_TENANT);

/** Retire de `list` les artistes exclus par la maison (ordre conservé). */
export function excludeArtists<T extends { id: string }>(list: T[], tenant: Tenant = TENANT): T[] {
  return list.filter((a) => !tenant.excludedArtists.includes(a.id));
}
```

- [ ] **Step 4 : vérifier que le test passe**

Run : `npx vitest run src/lib/__tests__/tenant.test.ts`
Attendu : PASS (7 tests).

- [ ] **Step 5 : `LABEL` et `DEMO_ARTIST_ID` lisent la maison**

Dans `src/lib/demo/data.ts`, ajouter l'import et remplacer `LABEL` :

```ts
import { TENANT } from "@/lib/tenant";

/** Le label de démo porte le nom de la maison : « Day 1 Dashboard Pro » ou « Day One × Universal ». */
export const LABEL = {
  id: TENANT.id === "universal" ? "day-one-universal" : "day1-dashboard-pro",
  name: TENANT.name,
  foundedYear: 2026,
};
```

Dans `src/lib/role.tsx`, remplacer `export const DEMO_ARTIST_ID = "dadju";` par :

```ts
import { TENANT } from "@/lib/tenant";

/** L'artiste ouvert par défaut en persona artiste : celui de la maison (Dadju n'existe pas chez Universal). */
export const DEMO_ARTIST_ID = TENANT.defaultArtistId;
```

- [ ] **Step 6 : marque de la sidebar et du menu mobile**

Dans `src/components/dashboard/sidebar.tsx`, ajouter `import { TENANT } from "@/lib/tenant";` et remplacer le bloc « Marque » :

```tsx
      {/* Marque — celle de la maison du build ; la co-marque s'affiche en pastille. */}
      <div className="flex h-14 items-center gap-2.5 px-4">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <Sunrise className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 leading-none">
          <div className="truncate font-heading text-[15px] font-semibold tracking-tight">{TENANT.shortName}</div>
          <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{TENANT.tagline}</div>
        </div>
        {TENANT.logo && (
          <span
            className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-[0.12em]"
            style={{ background: TENANT.logo.bg, color: TENANT.logo.fg }}
            aria-label={`Co-marque ${TENANT.logo.text}`}
          >
            {TENANT.logo.text}
          </span>
        )}
      </div>
```

`tc` reste utilisé plus bas (`states.upToDate`, `actions.*`) : ne pas retirer l'import.

Dans `src/components/dashboard/mobile-nav.tsx`, ajouter `import { TENANT } from "@/lib/tenant";`, puis `aria-label={tc("app.name")}` → `aria-label={TENANT.shortName}` et, dans `SheetTitle`, `{tc("app.name")}` → `{TENANT.shortName}`. Si `tc` n'est plus utilisé ensuite dans ce fichier, retirer `const tc = useTranslations("common");` (eslint le signalera).

- [ ] **Step 7 : titre des pages**

Dans `src/app/layout.tsx` :

```ts
import { TENANT } from "@/lib/tenant";

export const metadata: Metadata = {
  title: `${TENANT.name} — ${TENANT.tagline}`,
  description:
    "Streams, revenus, droits, contrats — tout le business d'un artiste, en live, en un seul endroit.",
};
```

- [ ] **Step 8 : typer, tester, commiter**

```bash
npx tsc --noEmit -p . | head
npx vitest run src/lib/__tests__/tenant.test.ts src/lib/demo/__tests__/pnl.test.ts
git add -- src/lib/tenant.ts src/lib/__tests__/tenant.test.ts src/lib/demo/data.ts src/lib/role.tsx src/components/dashboard/sidebar.tsx src/components/dashboard/mobile-nav.tsx src/app/layout.tsx
git commit -m "maison : NEXT_PUBLIC_TENANT choisit le nom, la co-marque et l'artiste par défaut (day1 | universal)"
```

---

### Task 2 : catégories et DA sur le roster existant

**Files:**
- Modify: `src/lib/demo/types.ts` (`Artist`, lignes 34-66)
- Modify: `src/lib/demo/data.ts` (`DAS`, les six artistes)
- Modify: `src/lib/userdata/store.ts` (`userArtist`, lignes 245-265)
- Create: `src/lib/demo/__tests__/roster-data.test.ts`

- [ ] **Step 1 : le test**

`src/lib/demo/__tests__/roster-data.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { ARTISTS, DAS, getDa } from "@/lib/demo/data";
import { ARTIST_CATEGORIES, isArtistCategory } from "@/lib/demo/types";

describe("catégories et DA", () => {
  it("trois catégories, un DA par catégorie", () => {
    expect(ARTIST_CATEGORIES).toEqual(["urbain", "variete", "compositeur"]);
    expect(DAS.map((d) => d.category).sort()).toEqual([...ARTIST_CATEGORIES].sort());
    expect(new Set(DAS.map((d) => d.id)).size).toBe(DAS.length);
  });
  it("chaque artiste a une catégorie connue et le DA de sa catégorie", () => {
    for (const a of ARTISTS) {
      expect(isArtistCategory(a.category), a.id).toBe(true);
      const da = getDa(a.daId);
      expect(da, `${a.id} : DA ${a.daId} inconnu`).not.toBeNull();
      expect(da!.category, `${a.id} suit un DA d'une autre catégorie`).toBe(a.category);
    }
  });
  it("un compositeur est de la catégorie compositeur, et réciproquement", () => {
    for (const a of ARTISTS) expect(a.category === "compositeur", a.id).toBe(a.kind === "composer");
  });
  it("ids et teintes uniques", () => {
    expect(new Set(ARTISTS.map((a) => a.id)).size).toBe(ARTISTS.length);
    expect(new Set(ARTISTS.map((a) => a.hue)).size).toBe(ARTISTS.length);
  });
  it("getDa : null pour un id inconnu", () => {
    expect(getDa("da-nulle-part")).toBeNull();
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `npx vitest run src/lib/demo/__tests__/roster-data.test.ts`
Attendu : FAIL (`DAS`, `getDa`, `ARTIST_CATEGORIES` n'existent pas).

- [ ] **Step 3 : les types**

Dans `src/lib/demo/types.ts`, avant `export type Artist`, ajouter :

```ts
/** Catégorie de roster : un DA (directeur artistique) suit chaque catégorie (spec Universal v2, §2). */
export const ARTIST_CATEGORIES = ["urbain", "variete", "compositeur"] as const;
export type ArtistCategory = (typeof ARTIST_CATEGORIES)[number];

export function isArtistCategory(v: string | null | undefined): v is ArtistCategory {
  return (ARTIST_CATEGORIES as readonly string[]).includes(v ?? "");
}

export type DA = { id: string; name: string; category: ArtistCategory };
```

Dans `Artist`, après `country: string;` :

```ts
  category: ArtistCategory;
  /** DA (directeur artistique) qui suit l'artiste — id de DAS. */
  daId: string;
```

- [ ] **Step 4 : `DAS` et les six artistes existants**

Dans `src/lib/demo/data.ts`, importer le type (`import type { Artist, DA, … } from "./types";`) et ajouter avant `ARTISTS` :

```ts
/**
 * Les DA de démo. Prénoms FICTIFS (à remplacer par les vrais si Gaël les donne) ;
 * chaque artiste est rattaché au DA de sa catégorie.
 */
export const DAS: DA[] = [
  { id: "da-urbain", name: "Inès M.", category: "urbain" },
  { id: "da-variete", name: "Julien R.", category: "variete" },
  { id: "da-compos", name: "Sofia K.", category: "compositeur" },
];

export function getDa(id: string): DA | null {
  return DAS.find((d) => d.id === id) ?? null;
}
```

Puis, dans chaque entrée d'`ARTISTS`, après `country`, ajouter :
- `dadju`, `nono-la-grinta`, `november-ultra`, `kiko`, `elgrandetoto` : `category: "urbain", daId: "da-urbain",`
- `zeg-p` : `category: "compositeur", daId: "da-compos",`

- [ ] **Step 5 : `userArtist()` porte les deux champs**

Dans `src/lib/userdata/store.ts`, dans l'objet renvoyé par `userArtist()`, après `signedSince:` ajouter :

```ts
    // Client réel : pas de catégorie de roster ni de DA de démo. « urbain » est
    // la valeur neutre du type ; le DA vide ne correspond à aucun filtre.
    category: "urbain",
    daId: "",
```

- [ ] **Step 6 : typer, tester, commiter**

```bash
npx tsc --noEmit -p . | head      # si un autre endroit construit un Artist : grep -rn "): Artist\b" src
npx vitest run src/lib/demo/__tests__/roster-data.test.ts
git add -- src/lib/demo/types.ts src/lib/demo/data.ts src/lib/userdata/store.ts src/lib/demo/__tests__/roster-data.test.ts
git commit -m "roster : trois catégories (urbain, variété, compositeur) et un DA par artiste"
```

---

### Task 3 : six artistes, exclusions à la source, relevé préparé

**Files:**
- Modify: `src/lib/demo/data.ts` (`ARTISTS`, `PROJECT_SEEDS`, `CONTRACTS`, `TEAM`, `PLACEMENTS`)
- Modify: `scripts/artists.json`
- Modify: `src/lib/demo/__tests__/roster-data.test.ts`
- Modify: `src/lib/demo/__tests__/api-real.test.ts` (lignes 143-149), `forecast.test.ts` (ligne 54), `valuation.test.ts` (lignes 66-67)
- Modify: `e2e/demo-path.spec.ts` (lignes 19-20, 48, 157-168)

- [ ] **Step 1 : les tests d'abord**

Ajouter à `src/lib/demo/__tests__/roster-data.test.ts` :

```ts
import { readFileSync } from "node:fs";
import { afterEach, vi } from "vitest";
import { ALL_ARTISTS, CONTRACTS, PROJECTS, TEAM } from "@/lib/demo/data";

type Seed = { id: string; spotifyId?: string; deezerId?: string; youtubeChannelId?: string };
const SEEDS: Seed[] = JSON.parse(readFileSync(new URL("../../../../scripts/artists.json", import.meta.url), "utf8"));

describe("le roster complet et la maison", () => {
  it("douze artistes, sept urbain, deux variété, trois compositeurs", () => {
    expect(ALL_ARTISTS).toHaveLength(12);
    const count = (c: string) => ALL_ARTISTS.filter((a) => a.category === c).length;
    expect([count("urbain"), count("variete"), count("compositeur")]).toEqual([7, 2, 3]);
  });
  it("day1 (défaut) : onze artistes, Kiko absent, Dadju présent", () => {
    expect(ARTISTS).toHaveLength(11);
    expect(ARTISTS.map((a) => a.id)).not.toContain("kiko");
    expect(ARTISTS.map((a) => a.id)).toContain("dadju");
  });
  it("tout ce qui dérive du roster suit l'exclusion", () => {
    const ids = new Set(ARTISTS.map((a) => a.id));
    for (const p of PROJECTS) expect(ids.has(p.artistId), p.id).toBe(true);
    for (const c of CONTRACTS) expect(ids.has(c.artistId), c.id).toBe(true);
    for (const m of TEAM) if (Array.isArray(m.artistAccess)) for (const id of m.artistAccess) expect(ids.has(id), m.id).toBe(true);
  });
});

describe("scripts/artists.json — le relevé quotidien lit les mêmes identifiants", () => {
  it("chaque artiste du roster complet y figure, avec les mêmes ids", () => {
    for (const a of ALL_ARTISTS) {
      const s = SEEDS.find((x) => x.id === a.id);
      expect(s, `${a.id} absent de scripts/artists.json`).toBeDefined();
      expect(s!.spotifyId ?? undefined).toBe(a.spotifyId);
      expect(s!.deezerId ?? undefined).toBe(a.deezerId);
      expect(s!.youtubeChannelId ?? undefined).toBe(a.youtubeChannelId);
    }
  });
  it("les ids ont la forme attendue (Spotify : 22 caractères base62 ; Deezer : chiffres ; YouTube : UC…)", () => {
    for (const a of ALL_ARTISTS) {
      if (a.spotifyId) expect(a.spotifyId, a.id).toMatch(/^[0-9A-Za-z]{22}$/);
      if (a.deezerId) expect(a.deezerId, a.id).toMatch(/^\d+$/);
      if (a.youtubeChannelId) expect(a.youtubeChannelId, a.id).toMatch(/^UC[0-9A-Za-z_-]{22}$/);
    }
  });
});

describe("maison universal", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("onze artistes, Dadju absent, Kiko présent, LABEL au nom de la maison", async () => {
    vi.stubEnv("NEXT_PUBLIC_TENANT", "universal");
    vi.resetModules();
    const data = await import("@/lib/demo/data");
    expect(data.ARTISTS).toHaveLength(11);
    expect(data.ARTISTS.map((a) => a.id)).not.toContain("dadju");
    expect(data.ARTISTS.map((a) => a.id)).toContain("kiko");
    expect(data.LABEL.name).toBe("Day One × Universal");
    expect(data.CONTRACTS.map((c) => c.artistId)).not.toContain("dadju");
  });
});
```

Run : `npx vitest run src/lib/demo/__tests__/roster-data.test.ts` → FAIL (`ALL_ARTISTS` inexistant, 6 artistes).

- [ ] **Step 2 : les six artistes dans `data.ts`**

Renommer le tableau `export const ARTISTS: Artist[] = [` en `export const ALL_ARTISTS: Artist[] = [` et, avant son `];` final, ajouter les six entrées. Identifiants vérifiés le 23/10 (API Deezer, oEmbed Spotify, MusicBrainz, Wikidata ; Brice Davoli lu dans le navigateur). Auditeurs de secours, stade, index, contrat, dates : HYPOTHÈSES de démonstration, badge « simulé » tant que le relevé n'existe pas.

```ts
  {
    /* Rap, PSO Thug. Ids vérifiés le 23/10/2026. Auditeurs de secours ~2 M (ordre de grandeur,
       remplacé par le premier relevé). */
    id: "leto",
    name: "Leto",
    genre: "Rap",
    hue: 15,
    initials: "LE",
    monthlyListeners: listenersFromSnapshot("leto", 2_000_000),
    growthRate: 0.02,
    careerStage: "established",
    day1Index: 79,
    signedSince: "2018-09-14",
    dealType: "licence",
    country: "FR",
    category: "urbain",
    daId: "da-urbain",
    spotifyId: "6HCBnyTBSLdb3TFn2ayulY",
    deezerId: "455796",
    youtubeChannelId: "UCP9zhgBhlIwgF5UEf3Pmj8Q",
  },
  {
    /* R&B / trapsoul, Lyon. Pas de chaîne YouTube identifiée : le relevé passe la source. */
    id: "dakeez",
    name: "Dakeez",
    genre: "R&B / trapsoul",
    hue: 300,
    initials: "DK",
    monthlyListeners: listenersFromSnapshot("dakeez", 150_000),
    growthRate: 0.07,
    careerStage: "emerging",
    day1Index: 48,
    signedSince: "2025-03-01",
    dealType: "distribution",
    country: "FR",
    category: "urbain",
    daId: "da-urbain",
    spotifyId: "63TYAXPLsZ7A3AFeGiGGGu",
    deezerId: "53565962",
  },
  {
    /* Pop / variété. La chaîne YouTube est INCERTAINE (recherche du 23/10, non confirmée par
       une page officielle) : vérifier le titre de chaîne dans le premier relevé (Task 4, Step 3)
       et vider le champ si ce n'est pas elle. */
    id: "louane",
    name: "Louane",
    genre: "Pop / variété",
    hue: 345,
    initials: "LO",
    monthlyListeners: listenersFromSnapshot("louane", 3_000_000),
    growthRate: 0.015,
    careerStage: "established",
    day1Index: 84,
    signedSince: "2015-03-02",
    dealType: "artiste",
    country: "FR",
    category: "variete",
    daId: "da-variete",
    spotifyId: "7wjeXCtRND2ZdKfMJFu6JC",
    deezerId: "4453455",
    youtubeChannelId: "UCxROfILs1ORiiUWCDdkfqaA",
  },
  {
    /* R&B / soul, Paris. Pas de chaîne YouTube identifiée. */
    id: "wamen",
    name: "Wamen",
    genre: "R&B / soul",
    hue: 190,
    initials: "WA",
    monthlyListeners: listenersFromSnapshot("wamen", 170_000),
    growthRate: 0.06,
    careerStage: "developing",
    day1Index: 51,
    signedSince: "2024-06-01",
    dealType: "distribution",
    country: "FR",
    category: "variete",
    daId: "da-variete",
    spotifyId: "3IrNp8pf0ugwmIEiGJCRse",
    deezerId: "182945357",
  },
  {
    /* Compositeur-producteur (orthographe : Gustave). Comme Zeg P : ce qu'il gagne se passe sur
       les disques des autres (PLACEMENTS). Contrat d'édition « reçu, relecture en cours » dans
       le fil : il n'a donc PAS encore de contrat dans CONTRACTS. */
    id: "gustave-rudman",
    name: "Gustave Rudman",
    genre: "Composition · Pop / variété",
    hue: 60,
    initials: "GR",
    monthlyListeners: listenersFromSnapshot("gustave-rudman", 100_000),
    growthRate: 0.02,
    careerStage: "established",
    day1Index: 66,
    signedSince: "2019-01-15",
    dealType: "indé",
    kind: "composer",
    publisher: { name: "Day 1 Édition", sharePct: 25 },
    country: "FR",
    category: "compositeur",
    daId: "da-compos",
    spotifyId: "2yGaqlHUHvNEpdRlmQCMEC",
    deezerId: "4722593",
  },
  {
    /* Compositeur-arrangeur, musique à l'image. « Grand catalogue Sacem » selon Gaël, NON vérifié.
       Page Spotify lue dans le navigateur le 23/10 : le relevé peut la lire ; les auditeurs de
       secours (~5 k) ne servent qu'avant lui. */
    id: "brice-davoli",
    name: "Brice Davoli",
    genre: "Composition · musique à l'image",
    hue: 120,
    initials: "BD",
    monthlyListeners: listenersFromSnapshot("brice-davoli", 5_000),
    growthRate: 0.005,
    careerStage: "established",
    day1Index: 58,
    signedSince: "2016-05-10",
    dealType: "indé",
    kind: "composer",
    publisher: { name: "Day 1 Édition", sharePct: 25 },
    country: "FR",
    category: "compositeur",
    daId: "da-compos",
    spotifyId: "27kwwOnjG09lmLHv3zle84",
    deezerId: "1570143",
  },
```

Juste après `];`, ajouter :

```ts
/**
 * Le roster de LA MAISON : le roster complet moins ses exclus (day1 : Kiko ;
 * universal : Dadju). Tout ce qui dérive du roster (projets, titres, splits,
 * contrats, accès de l'équipe, placements) est filtré par `inRoster` : un
 * artiste exclu n'apparaît nulle part, ses fichiers de relevés restent.
 */
export const ARTISTS: Artist[] = excludeArtists(ALL_ARTISTS);
const inRoster = (artistId: string) => ARTISTS.some((a) => a.id === artistId);
```

et compléter l'import : `import { TENANT, excludeArtists } from "@/lib/tenant";`. Mettre à jour le commentaire d'en-tête du fichier (lignes 1-7) : « 12 artistes RÉELS (Dadju, Nono La Grinta, November Ultra, Zeg P, Kiko, ElGrandeToto, Leto, Dakeez, Louane, Wamen, Gustave Rudman, Brice Davoli) ; la maison retire le sien ».

- [ ] **Step 3 : filtrer ce qui dérive du roster**

`PROJECTS` et `TRACKS` : remplacer les deux `Object.entries(PROJECT_SEEDS).flatMap(` par `Object.entries(PROJECT_SEEDS).filter(([artistId]) => inRoster(artistId)).flatMap(`.

`CONTRACTS` : renommer `export const CONTRACTS: Contract[] = [` en `const ALL_CONTRACTS: Contract[] = [`, ajouter les contrats des nouveaux avant le `];` final, puis après : `export const CONTRACTS: Contract[] = ALL_CONTRACTS.filter((c) => inRoster(c.artistId));`

```ts
  {
    /* Avance recoupée à 80 % : c'est la note « finance → DA urbain » du fil (feed-store). */
    id: "c-le-licence",
    artistId: "leto",
    type: "licence",
    counterparty: "Label",
    startDate: "2022-09-14",
    endDate: "2027-09-14",
    royaltyRate: 21,
    advance: 300_000,
    recoupedPct: 80,
    territory: "World",
    exclusive: true,
    alerts: [
      {
        kind: "audit-window",
        severity: "info",
        dueDate: "2027-03-31",
        message: {
          fr: "Fenêtre d'audit contractuelle : exercice 2026 auditable jusqu'au 31/03/2027",
          en: "Contractual audit window: FY2026 auditable until 31/03/2027",
        },
      },
    ],
  },
  {
    id: "c-dk-distribution",
    artistId: "dakeez",
    type: "distribution",
    counterparty: "Believe Digital",
    startDate: "2025-03-01",
    endDate: "2027-03-01",
    royaltyRate: 85,
    advance: 15_000,
    recoupedPct: 35,
    territory: "World",
    exclusive: false,
    alerts: [],
  },
  {
    /* Option à lever avant le 30 : c'est la note « DA variété → juridique » du fil. */
    id: "c-lo-artiste",
    artistId: "louane",
    type: "licence",
    counterparty: "Label",
    startDate: "2020-03-02",
    endDate: "2027-03-02",
    royaltyRate: 24,
    advance: 600_000,
    recoupedPct: 100,
    territory: "World",
    exclusive: true,
    alerts: [
      {
        kind: "option",
        severity: "warning",
        dueDate: "2026-11-30",
        message: {
          fr: "Option de prolongation à lever avant le 30/11 — sinon le contrat court jusqu'à son terme sans album supplémentaire",
          en: "Extension option to exercise before Nov 30 — otherwise the deal runs to term with no extra album",
        },
      },
    ],
  },
  {
    id: "c-wa-distribution",
    artistId: "wamen",
    type: "distribution",
    counterparty: "Distro",
    startDate: "2024-06-01",
    endDate: "2026-12-01",
    royaltyRate: 85,
    advance: 0,
    recoupedPct: 100,
    territory: "World",
    exclusive: false,
    alerts: [
      {
        kind: "expiry",
        severity: "warning",
        dueDate: "2026-12-01",
        message: {
          fr: "Contrat de distribution à échéance le 01/12 — préavis de 60 jours, soit avant le 02/10",
          en: "Distribution deal expires on 01/12 — 60-day notice, i.e. before 02/10",
        },
      },
    ],
  },
  {
    /* Édition : le même 25 % que `publisher.sharePct` (un seul fait, deux endroits — comme Zeg P). */
    id: "c-bd-edition",
    artistId: "brice-davoli",
    type: "édition",
    counterparty: "Day 1 Édition",
    startDate: "2016-05-10",
    endDate: "2028-05-10",
    royaltyRate: 75,
    advance: 0,
    recoupedPct: 100,
    territory: "World",
    exclusive: true,
    alerts: [],
  },
```

`TEAM` : dans l'entrée `lisa`, remplacer `artistAccess: ["nono-la-grinta", "kiko"],` par `artistAccess: ["nono-la-grinta", "kiko", "dakeez"].filter(inRoster),` (l'id d'un exclu renverrait sur `ARTISTS[0]` à l'affichage de /team).

`PLACEMENTS` : renommer en `const ALL_PLACEMENTS: Placement[] = [`, ajouter avant `];` les œuvres des deux nouveaux compositeurs (entièrement SIMULÉES : titres, interprètes, parts — sans elles, leur page /placements serait vide), puis `export const PLACEMENTS: Placement[] = ALL_PLACEMENTS.filter((p) => inRoster(p.artistId));` :

```ts
  /* Gustave Rudman et Brice Davoli : œuvres SIMULÉES (aucune source publique ne donne les crédits
     d'écriture). Les interprètes sont ceux du roster pour que le dashboard se recoupe. */
  { id: "pl-gr-rivage", artistId: "gustave-rudman", title: "Rivage", performer: "Louane",
    roles: ["auteur", "compositeur"], writerSharePct: 50, producerPointsPct: 0,
    status: "released", date: "2025-02-14", declared: true, streams: 12_400_000 },
  { id: "pl-gr-lumiere", artistId: "gustave-rudman", title: "Lumière basse", performer: "Wamen",
    roles: ["compositeur", "producteur"], writerSharePct: 35, producerPointsPct: 3,
    status: "released", date: "2025-10-03", declared: false, streams: 1_850_000 },
  { id: "pl-gr-hiver", artistId: "gustave-rudman", title: "Hiver", performer: "Louane",
    roles: ["auteur", "compositeur"], writerSharePct: 50, producerPointsPct: 0,
    status: "unreleased", date: "2026-11-21", declared: false, streams: 0 },
  { id: "pl-bd-generique", artistId: "brice-davoli", title: "Générique — Les Heures claires", performer: "Orchestre de studio",
    roles: ["compositeur", "producteur"], writerSharePct: 100, producerPointsPct: 0,
    status: "released", date: "2024-09-06", declared: true, streams: 420_000 },
  { id: "pl-bd-theme", artistId: "brice-davoli", title: "Thème principal — Nuit sur la ville", performer: "Orchestre de studio",
    roles: ["compositeur"], writerSharePct: 100, producerPointsPct: 0,
    status: "released", date: "2025-05-16", declared: true, streams: 95_000 },
  { id: "pl-bd-serie", artistId: "brice-davoli", title: "Habillage — série (saison 2)", performer: "Studio Palier",
    roles: ["compositeur", "producteur"], writerSharePct: 100, producerPointsPct: 0,
    status: "unreleased", date: "2027-01-10", declared: false, streams: 0 },
```

- [ ] **Step 4 : `scripts/artists.json`**

Ajouter, en fin de tableau, six entrées (sans chaîne pour Dakeez, Wamen, Gustave Rudman et Brice Davoli : le script passe YouTube et Deezer quand l'id manque) :

```json
  {
    "id": "leto",
    "name": "Leto",
    "country": "FR",
    "spotifyId": "6HCBnyTBSLdb3TFn2ayulY",
    "deezerId": "455796",
    "youtubeChannelId": "UCP9zhgBhlIwgF5UEf3Pmj8Q",
    "youtubeVideos": []
  },
  {
    "id": "dakeez",
    "name": "Dakeez",
    "country": "FR",
    "spotifyId": "63TYAXPLsZ7A3AFeGiGGGu",
    "deezerId": "53565962",
    "youtubeVideos": []
  },
  {
    "id": "louane",
    "name": "Louane",
    "country": "FR",
    "spotifyId": "7wjeXCtRND2ZdKfMJFu6JC",
    "deezerId": "4453455",
    "youtubeChannelId": "UCxROfILs1ORiiUWCDdkfqaA",
    "youtubeVideos": []
  },
  {
    "id": "wamen",
    "name": "Wamen",
    "country": "FR",
    "spotifyId": "3IrNp8pf0ugwmIEiGJCRse",
    "deezerId": "182945357",
    "youtubeVideos": []
  },
  {
    "id": "gustave-rudman",
    "name": "Gustave Rudman",
    "country": "FR",
    "spotifyId": "2yGaqlHUHvNEpdRlmQCMEC",
    "deezerId": "4722593",
    "youtubeVideos": []
  },
  {
    "id": "brice-davoli",
    "name": "Brice Davoli",
    "country": "FR",
    "spotifyId": "27kwwOnjG09lmLHv3zle84",
    "deezerId": "1570143",
    "youtubeVideos": []
  }
```

Vérifier : `node -e 'JSON.parse(require("fs").readFileSync("scripts/artists.json","utf8")).forEach(a=>console.log(a.id))'` → 12 ids.

- [ ] **Step 5 : les tests qui nommaient Kiko**

Kiko n'est plus dans la maison `day1` : `getArtist("kiko")` retomberait sur `ARTISTS[0]` (Dadju) et ces trois tests mentiraient. Dakeez prend sa place d'artiste émergent.

`src/lib/demo/__tests__/api-real.test.ts`, lignes 143-149 :

```ts
    expect(sumStreams("dakeez", 30)).toBeGreaterThan(0);
  });

  it("les dépenses sont dimensionnées à la taille réelle de l'artiste", () => {
    const dakeez = expensesFor("dakeez", 12).reduce((s, e) => s + e.amount, 0);
    const dadju = expensesFor("dadju", 12).reduce((s, e) => s + e.amount, 0);
    // Dakeez (~150 k auditeurs, émergent) contre Dadju (~6,5 M, établi) : le rapport de taille
    // (sizeFactor, generators.ts) est d'au moins 1 à 5. Seuil MESURÉ au premier passage : si le
    // test échoue, lire les deux montants qu'il affiche et poser le rapport observé, arrondi vers le bas.
    expect(dakeez).toBeLessThan(80_000);
    expect(dadju).toBeGreaterThan(dakeez * 5);
  });
```

`forecast.test.ts` ligne 54 : `revenueForecast("kiko")` → `revenueForecast("dakeez")`. `valuation.test.ts` lignes 66-67 : `catalogValuation("kiko")` → `catalogValuation("dakeez")` (deux occurrences).

`e2e/demo-path.spec.ts` : lignes 19-20 du commentaire (« clic Kiko → /pulse (Kiko) » → « clic Nono La Grinta → /pulse (Nono) »), ligne 48 (`|Kiko|` → `|Nono|` déjà présent : retirer `Kiko|`), et l'étape 9 (lignes 157-168) :

```ts
        /* 9. Retour structure → /roster → clic Nono La Grinta → /pulse (Nono). Kiko n'est plus
           dans la maison day1 (tenant.ts). */
        await switchPersona(page, "label");
        await page.goto("/roster", { waitUntil: "domcontentloaded" });
        await ready(page, theme);
        await page.locator("main tr", { hasText: "Nono La Grinta" }).first().click();
        await expect(page.locator("main tr[aria-selected='true']")).toContainText("Nono La Grinta");
        await page.waitForTimeout(400);
        await step("roster-nono");
        await page.goto("/pulse", { waitUntil: "domcontentloaded" });
        await ready(page, theme);
        await expect(topbar(page)).toContainText("Nono La Grinta");
        await step("pulse-nono");
```

- [ ] **Step 6 : suite complète, puis commit (c'est LE commit témoin « avant relevé » de la Task 14)**

```bash
npx tsc --noEmit -p . | head
npx vitest run
```

Attendu : 703 + 18 nouveaux (tenant 7, roster-data 11 au total après cette tâche) — tous verts. Si `api-real` échoue sur le seuil des dépenses, appliquer la consigne du commentaire (seuil mesuré) et relancer.

```bash
git add -- src/lib/demo/data.ts scripts/artists.json src/lib/demo/__tests__/roster-data.test.ts src/lib/demo/__tests__/api-real.test.ts src/lib/demo/__tests__/forecast.test.ts src/lib/demo/__tests__/valuation.test.ts e2e/demo-path.spec.ts
git commit -m "roster : Leto, Dakeez, Louane, Wamen, Gustave Rudman, Brice Davoli ; la maison retire son exclu à la source (projets, contrats, équipe, placements suivent)"
git rev-parse --short HEAD   # noter ce SHA : témoin « avant relevé » (Task 14, Step 2)
```

---

### Task 4 : premier relevé réel des six artistes, titres depuis le relevé

**Files:**
- Create: `src/lib/real/snapshots/{leto,dakeez,louane,wamen,gustave-rudman,brice-davoli}/<AAAA-MM-JJ>.json` (générés)
- Modify: `src/lib/real/snapshots/index.ts` (régénéré), `src/lib/real/snapshots/market/<date>.json` (généré)
- Modify: `src/lib/demo/data.ts` (`PROJECT_SEEDS`)

- [ ] **Step 1 : lancer le relevé — RÉSEAU, hors du bac à sable**

Le script ouvre un Chromium Playwright et interroge open.spotify.com, kworb.net, api.deezer.com et youtube.com : il doit tourner avec le réseau (le bac à sable du Bash de la session le bloque — lancer dans le terminal de Gaël ou avec le bac à sable désactivé). Il relève TOUS les artistes d'`artists.json` (les 12), écrit un fichier par artiste à la date du jour (heure de Paris) et régénère l'index.

```bash
npm run snapshot 2>&1 | tee /tmp/snapshot-$(date +%F).log
```

Attendu : `Relevé du AAAA-MM-JJ — 12 artistes`, une ligne `▶ …` par artiste, puis `Index régénéré : …`. Lignes `⚠` attendues et acceptées : `deezer null (deezerId absent)` / `youtube null (youtubeChannelId absent)` pour Dakeez, Wamen, Gustave Rudman, Brice Davoli ; `kworb … (artiste non suivi par Kworb ?)` possible pour Brice Davoli et Gustave Rudman. Une ligne `auditeurs mensuels Spotify non obtenus` sur un des six est un ÉCHEC à relire (id faux ?) : vérifier l'URL `https://open.spotify.com/artist/<id>` dans le navigateur.

Si le relevé du jour existe déjà (session relancée) : `npm run snapshot -- --force`.

- [ ] **Step 2 : lire ce qui a été relevé**

```bash
D=$(ls src/lib/real/snapshots/leto | tail -1)
for a in leto dakeez louane wamen gustave-rudman brice-davoli; do
  node -e 'const s=require(process.argv[1]);console.log(process.argv[2], "auditeurs="+s.spotify.monthlyListeners, "abonnés="+s.spotify.followers, "top="+s.spotify.topTracks.map(t=>t.name).join(" | "), "deezerFans="+(s.deezer?s.deezer.fans:"—"), "yt="+(s.youtube?s.youtube.videos.length+" vidéos":"—"))' "./src/lib/real/snapshots/$a/$D" "$a"
done
grep -n "LATEST_DATE" src/lib/real/snapshots/index.ts
```

Noter les auditeurs mensuels relevés de chacun (ils remplacent les valeurs de secours via `listenersFromSnapshot`, et c'est désormais `hasRealData()` qui répond vrai : badge « mesuré » au lieu de « simulé » là où un fichier existe). `LATEST_DATE` est maintenant la date du jour : `DEMO_TODAY` a avancé pour toute la démo (voir l'en-tête du plan).

- [ ] **Step 3 : Louane — la chaîne YouTube incertaine**

```bash
node -e 'const s=require("./src/lib/real/snapshots/louane/'"$D"'");console.log(s.youtube && (s.youtube.channelTitle ?? s.youtube.subscribers ?? JSON.stringify(s.youtube).slice(0,300)))'
```

Lire le nom de chaîne / les titres des vidéos : si ce n'est pas la chaîne officielle de Louane (titres d'une autre artiste, ou `null`), retirer `youtubeChannelId` de son entrée dans `data.ts` ET dans `scripts/artists.json`, supprimer le bloc `youtube` du fichier de relevé (`"youtube": null`), et relancer `npx vitest run src/lib/demo/__tests__/roster-data.test.ts` (cohérence des ids). Sinon, remplacer « INCERTAINE » par « confirmée le <date> (nom de chaîne lu dans le relevé) » dans le commentaire de `data.ts`.

- [ ] **Step 4 : titres relevés → `PROJECT_SEEDS`**

Comme pour ElGrandeToto et November Ultra (commentaire « Titres RELEVÉS … sur sa page Spotify »), donner à chaque nouvel artiste un projet dont les titres sont les `topTracks` du relevé (regroupement et dates : hypothèses de démonstration). Ajouter dans `PROJECT_SEEDS`, en remplaçant les `<…>` par les titres lus au Step 2 (garder l'ordre du relevé ; 3 à 5 titres) :

```ts
  /* Titres RELEVÉS le <date> sur la page Spotify (Task 4 du plan Universal v2). Projets et dates :
     HYPOTHÈSES de démonstration. */
  leto: [
    { id: "le-releve", title: "Titres les plus écoutés", type: "album", releaseDate: "2025-10-10",
      tracks: ["<titre 1>", "<titre 2>", "<titre 3>", "<titre 4>", "<titre 5>"] },
  ],
  dakeez: [
    { id: "dk-releve", title: "Titres les plus écoutés", type: "ep", releaseDate: "2025-11-07",
      tracks: ["<titre 1>", "<titre 2>", "<titre 3>"] },
  ],
  louane: [
    { id: "lo-releve", title: "Titres les plus écoutés", type: "album", releaseDate: "2025-02-14",
      tracks: ["<titre 1>", "<titre 2>", "<titre 3>", "<titre 4>", "<titre 5>"] },
  ],
  wamen: [
    { id: "wa-releve", title: "Titres les plus écoutés", type: "ep", releaseDate: "2025-09-19",
      tracks: ["<titre 1>", "<titre 2>", "<titre 3>"] },
  ],
  /* Compositeurs : ce qu'ils sortent SOUS LEUR NOM ; l'essentiel est dans PLACEMENTS. */
  "gustave-rudman": [
    { id: "gr-releve", title: "Sous son nom", type: "ep", releaseDate: "2024-05-17",
      tracks: ["<titre 1>", "<titre 2>", "<titre 3>"] },
  ],
  "brice-davoli": [
    { id: "bd-releve", title: "Bandes originales", type: "album", releaseDate: "2024-09-06",
      tracks: ["<titre 1>", "<titre 2>", "<titre 3>"] },
  ],
```

Si un artiste n'a AUCUN titre relevé (`top=` vide au Step 2), prendre les titres de `deezer.topTracks` du même fichier (`s.deezer.topTracks.map(t => t.title)`) ; si Deezer manque aussi, laisser l'artiste sans projet : il garde ses streams (générés depuis `monthlyListeners`), n'a ni splits ni titres — l'écrire dans le commentaire.

- [ ] **Step 5 : suite complète, commit**

```bash
npx vitest run
```

Attendu : tous verts. `determinism.test.ts` et `rights.test.ts` dépendent de `DEMO_TODAY` par des fenêtres relatives, pas par des dates absolues : s'ils rougissent, lire la différence AVANT de toucher au test (AGENTS.md : « c'est la modification qui est en cause, pas le test »), et vérifier d'abord que le relevé du 25/09 → aujourd'hui n'a pas de trou de données inattendu (`node -e 'console.log(Object.keys(require("./src/lib/real/snapshots/index.ts")))'` ne marche pas sur du TS : lire le fichier).

```bash
git add -- src/lib/real/snapshots scripts/artists.json src/lib/demo/data.ts
git commit -m "relevé : premier relevé réel des six artistes (auditeurs, titres, Deezer, YouTube) ; titres des projets repris du relevé"
```

---

### Task 5 : périmètre — `scope.ts` et agrégats sur une liste d'artistes

**Files:**
- Create: `src/lib/demo/scope.ts`
- Create: `src/lib/demo/__tests__/scope.test.ts`
- Modify: `src/lib/demo/api.ts` (`rosterDspEstimates` l. 292, `rosterEstimateSummary` l. 305, `rosterEstimateSummaries` l. 328, `pnlByArtist` l. 952, `rosterRows` l. 1051, `labelTotals` l. 1068)

- [ ] **Step 1 : le test**

`src/lib/demo/__tests__/scope.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { ARTISTS, DAS } from "@/lib/demo/data";
import { labelTotals, pnlByArtist, rosterDspEstimates, rosterEstimateSummaries, rosterRows } from "@/lib/demo/api";
import { FULL_SCOPE, isFullScope, parseScope, scopeQuery, scopedArtists } from "@/lib/demo/scope";

const ids = (list: { id: string }[]) => list.map((a) => a.id).sort();

describe("scopedArtists", () => {
  it("sans filtre : tout le roster de la maison", () => {
    expect(scopedArtists()).toEqual(ARTISTS);
    expect(scopedArtists(FULL_SCOPE)).toEqual(ARTISTS);
  });
  it("par catégorie", () => {
    expect(ids(scopedArtists({ category: "compositeur" }))).toEqual(["brice-davoli", "gustave-rudman", "zeg-p"]);
    expect(ids(scopedArtists({ category: "variete" }))).toEqual(["louane", "wamen"]);
    expect(scopedArtists({ category: "urbain" })).toHaveLength(6); // day1 : sans Kiko
  });
  it("par DA : les artistes de sa catégorie, et rien d'autre", () => {
    for (const da of DAS) {
      const mine = scopedArtists({ daId: da.id });
      expect(mine.length).toBeGreaterThan(0);
      for (const a of mine) expect(a.daId).toBe(da.id);
    }
  });
  it("catégorie ET DA incompatibles : vide, pas d'erreur", () => {
    expect(scopedArtists({ category: "variete", daId: "da-compos" })).toEqual([]);
  });
});

describe("parseScope / scopeQuery — l'état vit dans l'URL", () => {
  const p = (q: string) => new URLSearchParams(q);
  it("lit ?cat= et ?da= ; une valeur inconnue vaut « tout »", () => {
    expect(parseScope(p("cat=variete&da=da-variete"))).toEqual({ category: "variete", daId: "da-variete" });
    expect(parseScope(p("cat=jazz&da=da-inconnu"))).toEqual({ category: null, daId: null });
    expect(parseScope(p(""))).toEqual(FULL_SCOPE);
  });
  it("aller-retour", () => {
    expect(scopeQuery({ category: "urbain", daId: null })).toBe("?cat=urbain");
    expect(scopeQuery({ category: null, daId: "da-compos" })).toBe("?da=da-compos");
    expect(scopeQuery(FULL_SCOPE)).toBe("");
    expect(parseScope(p(scopeQuery({ category: "compositeur", daId: "da-compos" }).slice(1)))).toEqual({ category: "compositeur", daId: "da-compos" });
    expect(isFullScope(FULL_SCOPE)).toBe(true);
    expect(isFullScope({ category: "urbain", daId: null })).toBe(false);
  });
});

describe("agrégats label sur une liste", () => {
  const compos = scopedArtists({ category: "compositeur" });
  it("rosterRows et labelTotals ne comptent que la liste", () => {
    expect(ids(rosterRows(compos))).toEqual(ids(compos));
    const t = labelTotals(compos);
    expect(t.artists).toBe(3);
    expect(t.revenue12m).toBe(rosterRows(compos).reduce((s, r) => s + r.revenue12m, 0));
  });
  it("pnlByArtist sur la liste = les mêmes lignes que sur tout le roster (même fenêtre de mois)", () => {
    const all = pnlByArtist(12);
    for (const p of pnlByArtist(12, compos)) expect(p).toEqual(all.find((x) => x.artistId === p.artistId));
  });
  it("estimations roster : la somme des parties ≤ le tout, et le défaut vaut tout le roster", () => {
    expect(rosterEstimateSummaries(ARTISTS)).toEqual(rosterEstimateSummaries());
    const whole = rosterEstimateSummaries()["30d"].streams;
    const parts = rosterEstimateSummaries(compos)["30d"].streams;
    expect(parts).toBeLessThanOrEqual(whole);
    expect(rosterDspEstimates("30d", compos).reduce((s, d) => s + d.streams, 0)).toBe(parts);
  });
});
```

Run : `npx vitest run src/lib/demo/__tests__/scope.test.ts` → FAIL (`@/lib/demo/scope` absent).

- [ ] **Step 2 : `scope.ts`**

```ts
/**
 * Le périmètre du roster : une catégorie, un DA, ou tout. Il vient de l'URL
 * (`?cat=`, `?da=` — partageable, et un rôle DA arrive déjà filtré) ou du rôle
 * (roles.ts). Les agrégats label d'api.ts acceptent la liste qu'il produit.
 */
import { ARTISTS, DAS } from "./data";
import { isArtistCategory, type Artist, type ArtistCategory } from "./types";

export type RosterScope = { category: ArtistCategory | null; daId: string | null };
export const FULL_SCOPE: RosterScope = { category: null, daId: null };

export function scopedArtists(scope: Partial<RosterScope> = {}, artists: Artist[] = ARTISTS): Artist[] {
  const { category = null, daId = null } = scope;
  if (!category && !daId) return artists;
  return artists.filter((a) => (!category || a.category === category) && (!daId || a.daId === daId));
}

/** `?cat=` et `?da=` : une valeur inconnue vaut « tout » — jamais une erreur, l'URL est partageable. */
export function parseScope(params: { get(name: string): string | null }): RosterScope {
  const cat = params.get("cat");
  const da = params.get("da");
  return {
    category: isArtistCategory(cat) ? cat : null,
    daId: da && DAS.some((d) => d.id === da) ? da : null,
  };
}

export function scopeQuery(scope: RosterScope): string {
  const p = new URLSearchParams();
  if (scope.category) p.set("cat", scope.category);
  if (scope.daId) p.set("da", scope.daId);
  const q = p.toString();
  return q ? `?${q}` : "";
}

export function isFullScope(scope: RosterScope): boolean {
  return !scope.category && !scope.daId;
}
```

- [ ] **Step 3 : les agrégats d'`api.ts` acceptent une liste**

Chaque fonction garde son comportement par défaut (tout le roster). Remplacer :

```ts
/** Par plateforme du roster (ou d'une liste d'artistes) : somme des artistes réels. */
export function rosterDspEstimates(period: EstimatePeriod, artists: Artist[] = ARTISTS): DspEstimate[] {
  return dspEstimatesOf(artists.map((a) => a.id), PERIOD_DAYS[period]);
}
```

```ts
export function rosterEstimateSummary(period: EstimatePeriod, artists: Artist[] = ARTISTS): EstimateSummary {
  const parts = artists.filter((a) => hasRealData(a.id)).map((a) => estimateSummary(a.id, period));
```

```ts
export function rosterEstimateSummaries(artists: Artist[] = ARTISTS): Record<EstimatePeriod, EstimateSummary> {
  return summariesOf((p) => rosterEstimateSummary(p, artists));
}
```

`pnlByArtist` : signature `export function pnlByArtist(months = 12, artists: Artist[] = ARTISTS): PnL[] {` ; la fenêtre de mois reste calculée sur `ARTISTS[0].id` (le périmètre ne doit pas déplacer la fenêtre) ; `return ARTISTS.map((a) => {` → `return artists.map((a) => {`.

`rosterRows` : `export function rosterRows(artists: Artist[] = ARTISTS): RosterRow[] { const pnl = pnlByArtist(12, artists); return artists.map((a) => {`.

`labelTotals` : `export function labelTotals(artists: Artist[] = ARTISTS) { const rows = rosterRows(artists);`.

- [ ] **Step 4 : tester, commiter**

```bash
npx tsc --noEmit -p . | head
npx vitest run src/lib/demo/__tests__/scope.test.ts src/lib/demo/__tests__/pnl.test.ts
git add -- src/lib/demo/scope.ts src/lib/demo/__tests__/scope.test.ts src/lib/demo/api.ts
git commit -m "périmètre : scopedArtists (catégorie, DA, URL) ; les agrégats label acceptent une liste d'artistes"
```

---

### Task 6 : roster filtré (URL) et groupé par catégorie

**Files:**
- Modify: `src/app/(dashboard)/roster/page.tsx`
- Create: `src/components/modules/structure/roster-filters.tsx`
- Modify: `src/components/modules/structure/roster-table.tsx`
- Modify: `src/components/modules/structure/roster-pnl-bars.tsx` (lignes 17-36)
- Modify: `src/components/modules/structure/roster-alerts.tsx` (lignes 27-35)
- Modify: `src/messages/fr/roster.json`, `src/messages/en/roster.json`

Lire d'abord `node_modules/next/dist/docs/01-app/**/use-search-params.md` (`find node_modules/next/dist/docs -name "use-search-params.md"`) : un composant client qui lit `useSearchParams` doit être sous une frontière `<Suspense>`, sinon `next build` échoue (« Missing Suspense boundary with useSearchParams »).

- [ ] **Step 1 : les textes (fr puis en, la parité est testée)**

`src/messages/fr/roster.json` — ajouter :

```json
  "scopeSubtitle": "{count, plural, one {# artiste} other {# artistes}} · {scope} — qui porte {label}, et qui décroche.",
  "filters": {
    "category": "Catégorie",
    "da": "DA",
    "all": "Toutes",
    "allDa": "Tous"
  },
  "category": {
    "urbain": "Urbain",
    "variete": "Variété",
    "compositeur": "Compositeurs"
  },
  "group": {
    "summary": "{count, plural, one {# artiste} other {# artistes}} · {streams} streams 30 j · {revenue} sur 12 mois"
  },
```

et dans `table` : `"category": "Catégorie", "da": "DA", "notes": "Notes"` ; dans `export` : `"category": "Catégorie", "da": "DA"`.

`src/messages/en/roster.json` — les mêmes clés :

```json
  "scopeSubtitle": "{count, plural, one {# artist} other {# artists}} · {scope} — who carries {label}, and who's slipping.",
  "filters": { "category": "Category", "da": "A&R", "all": "All", "allDa": "All" },
  "category": { "urbain": "Urban", "variete": "Pop", "compositeur": "Songwriters" },
  "group": { "summary": "{count, plural, one {# artist} other {# artists}} · {streams} streams 30d · {revenue} over 12 months" },
```

`table` : `"category": "Category", "da": "A&R", "notes": "Notes"` ; `export` : `"category": "Category", "da": "A&R"`.

Run : `npx vitest run src/messages/__tests__/parity.test.ts` → PASS.

- [ ] **Step 2 : les pastilles de filtre**

`src/components/modules/structure/roster-filters.tsx` :

```tsx
"use client";

/**
 * Filtres du roster de démo : catégorie et DA, en pastilles. L'état vit dans
 * l'URL (`?cat=`, `?da=`) — partageable, et un rôle DA arrive déjà filtré.
 */
import { useTranslations } from "next-intl";
import { DAS } from "@/lib/demo/data";
import type { RosterScope } from "@/lib/demo/scope";
import { ARTIST_CATEGORIES } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
        active ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function RosterFilters({ scope, onChange }: { scope: RosterScope; onChange: (next: RosterScope) => void }) {
  const t = useTranslations("roster");
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("filters.category")}>
        <span className="mr-1 text-muted-foreground">{t("filters.category")}</span>
        <Pill active={scope.category === null} onClick={() => onChange({ ...scope, category: null })}>{t("filters.all")}</Pill>
        {ARTIST_CATEGORIES.map((c) => (
          <Pill key={c} active={scope.category === c} onClick={() => onChange({ ...scope, category: scope.category === c ? null : c })}>
            {t(`category.${c}`)}
          </Pill>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("filters.da")}>
        <span className="mr-1 text-muted-foreground">{t("filters.da")}</span>
        <Pill active={scope.daId === null} onClick={() => onChange({ ...scope, daId: null })}>{t("filters.allDa")}</Pill>
        {DAS.map((d) => (
          <Pill key={d.id} active={scope.daId === d.id} onClick={() => onChange({ ...scope, daId: scope.daId === d.id ? null : d.id })}>
            {d.name}
          </Pill>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : la page lit l'URL, sous `<Suspense>`**

Dans `src/app/(dashboard)/roster/page.tsx` :

Imports à ajouter / modifier :

```ts
import { Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RosterFilters } from "@/components/modules/structure/roster-filters";
import { DAS, getDa } from "@/lib/demo/data";
import { isFullScope, parseScope, scopeQuery, scopedArtists, type RosterScope } from "@/lib/demo/scope";
```

Le composant par défaut :

```tsx
export default function RosterPage() {
  const customer = useCustomer();
  if (customer) return <CustomerRoster />;
  // `useSearchParams` dans un composant client : frontière Suspense obligatoire (docs Next 16).
  return (
    <Suspense fallback={null}>
      <DemoRoster />
    </Suspense>
  );
}
```

Dans `DemoRoster`, remplacer les deux `useMemo` de `rows` / `totals` :

```ts
  const router = useRouter();
  const params = useSearchParams();
  const scope = useMemo(() => parseScope(params), [params]);
  const artists = useMemo(() => scopedArtists(scope), [scope]);
  const rows = useMemo(() => rosterRows(artists), [artists]);
  const totals = useMemo(() => labelTotals(artists), [artists]);
  const setScope = useCallback(
    (next: RosterScope) => router.replace(`/roster${scopeQuery(next)}`, { scroll: false }),
    [router],
  );
  const scopeText = [scope.category ? t(`category.${scope.category}`) : null, scope.daId ? getDa(scope.daId)?.name : null]
    .filter(Boolean)
    .join(" · ");
```

Le `PageHeader` :

```tsx
      <PageHeader
        title={t("title")}
        subtitle={
          isFullScope(scope)
            ? t("subtitle", { count: totals.artists, label: LABEL.name })
            : t("scopeSubtitle", { count: totals.artists, scope: scopeText, label: LABEL.name })
        }
      >
```

Juste après `<PrintStyles />`, avant le `PageHeader`… non : après le `PageHeader` et avant `<div className="space-y-3">`, insérer :

```tsx
      <div className="mb-3">
        <RosterFilters scope={scope} onChange={setScope} />
      </div>
```

Export CSV — ajouter après la colonne `export.genre` :

```ts
      { header: t("export.category"), cell: (r) => t(`category.${r.category}`) },
      { header: t("export.da"), cell: (r) => getDa(r.daId)?.name ?? r.daId },
```

Composants : `<RosterTable rows={rows} grouped … />` (ajouter la prop `grouped`), `<RosterPnlBars artists={artists} bare />`, `RosterMatrix` et `RosterAlerts` reçoivent déjà `rows` filtrées. Le point affilié `artists` garde `totals.artists` (il suit le périmètre). `DAS` sert au Step 4 ; s'il n'est pas utilisé dans la page, ne pas l'importer (eslint).

- [ ] **Step 4 : tableau groupé, colonnes catégorie et DA**

Dans `src/components/modules/structure/roster-table.tsx` :

Imports : `import { DAS } from "@/lib/demo/data";`, `import { ARTIST_CATEGORIES, type ArtistCategory, type CareerStage } from "@/lib/demo/types";`, et `import Link from "next/link";` (la colonne notes vient en Task 11 ; l'import est posé ici pour ne pas y revenir — si eslint se plaint d'un import inutilisé avant la Task 11, le poser en Task 11).

Props :

```ts
export function RosterTable({
  rows,
  focusedArtistId,
  onFocus,
  bare = false,
  grouped = false,
  notesByArtist = {},
}: {
  rows: RosterRow[];
  focusedArtistId: string | null;
  onFocus: (id: string | null) => void;
  /** Dans une feuille teintée : le titre vient du `SheetHeading`. */
  bare?: boolean;
  /** Un en-tête par catégorie (nom, nombre, streams et revenus du groupe), les lignes dessous. */
  grouped?: boolean;
  /** Notes ouvertes du fil par artiste (Task 11) ; absent = colonne vide. */
  notesByArtist?: Record<string, number>;
}) {
```

Après `sorted`, les groupes (ordre fixe des catégories, chaque groupe gardant le tri courant) :

```ts
  const groups = useMemo(() => {
    if (!grouped) return [{ category: null as ArtistCategory | null, rows: sorted }];
    return ARTIST_CATEGORIES.map((category) => ({ category, rows: sorted.filter((r) => r.category === category) })).filter((g) => g.rows.length > 0);
  }, [grouped, sorted]);
  const daName = (id: string) => DAS.find((d) => d.id === id)?.name ?? id;
```

En-tête : après `<TableHead>{t("table.stage")}</TableHead>` ajouter `<TableHead>{t("table.da")}</TableHead>` ; avant le dernier `SortHead` (index), ajouter `<TableHead className="text-right">{t("table.notes")}</TableHead>`. Compter les colonnes : 11 → `COLS = 11` pour le `colSpan`.

Corps : remplacer `{sorted.map((r) => {` par

```tsx
              {groups.flatMap((g) => [
                g.category && (
                  <TableRow key={`group-${g.category}`} className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={11} className="py-1.5 pl-5 text-[11px]">
                      <span className="font-semibold uppercase tracking-[0.12em]">{t(`category.${g.category}`)}</span>
                      <span className="ml-3 text-muted-foreground">
                        {t("group.summary", {
                          count: g.rows.length,
                          streams: fmtCompact(locale, g.rows.reduce((s, r) => s + r.streams30d, 0)),
                          revenue: fmtEur(locale, g.rows.reduce((s, r) => s + r.revenue12m, 0), { compact: true }),
                        })}
                      </span>
                    </TableCell>
                  </TableRow>
                ),
                ...g.rows.map((r) => {
```

et fermer en conséquence : la fin du `map` des lignes devient `}),\n              ])}` (le `flatMap` renvoie l'en-tête puis les lignes ; `false`/`null` pour le groupe sans catégorie est ignoré par React).

Dans la ligne : `meta={r.genre}` → `meta={`${r.genre} · ${t(`category.${r.category}`)}`}` ; après la cellule « Stade » :

```tsx
                    <TableCell className="text-[12px] text-muted-foreground">{daName(r.daId)}</TableCell>
```

et avant la cellule « Index » :

```tsx
                    <TableCell className="num text-right">
                      {(notesByArtist[r.id] ?? 0) > 0 ? (
                        <Link
                          href={`/fil?artist=${encodeURIComponent(r.id)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex min-w-5 justify-center rounded-full bg-brand/15 px-1.5 text-[11px] font-medium text-brand"
                          aria-label={`${notesByArtist[r.id]} ${t("table.notes").toLowerCase()} · ${r.name}`}
                        >
                          {notesByArtist[r.id]}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
```

(La page ne passe `notesByArtist` qu'en Task 11 ; d'ici là la colonne montre « — ».)

- [ ] **Step 5 : P&L et alertes au périmètre**

`roster-pnl-bars.tsx` : `export function RosterPnlBars({ artists = ARTISTS, bare = false }: { artists?: Artist[]; bare?: boolean } = {}) {` avec `import type { Artist } from "@/lib/demo/types";` ; `pnlByArtist(12)` → `pnlByArtist(12, artists)` ; `ARTISTS.find(` → `artists.find(` ; ajouter `artists` aux dépendances du `useMemo`.

`roster-alerts.tsx`, le `useMemo` de `contractAlerts` :

```ts
  const contractAlerts = useMemo(() => {
    const ids = new Set(rows.map((r) => r.id));
    return CONTRACTS.filter((c) => ids.has(c.artistId)).flatMap((c) =>
      c.alerts.filter((a) => a.severity === "warning" || a.severity === "danger").map((a) => ({ contract: c, alert: a })),
    );
  }, [rows]);
```

- [ ] **Step 6 : typer, lint, vérifier à l'œil, commiter**

```bash
npx tsc --noEmit -p . | head
npx eslint "src/app/(dashboard)/roster" src/components/modules/structure
```

Lancer `day1-universal` (port 3005, `.env.local` porte `DEMO_MODE=on`), passer la porte, persona structure, ouvrir `/roster` : trois en-têtes de groupe (Urbain 6, Variété 2, Compositeurs 3), pastilles ; cliquer « Variété » → l'URL devient `/roster?cat=variete`, 2 lignes, sous-titre « 2 artistes · Variété — … », point affilié « 2 » ; `/roster?da=da-compos` → 3 lignes, barres P&L à 3 artistes, alertes sans contrat d'un autre groupe.

```bash
git add -- "src/app/(dashboard)/roster/page.tsx" src/components/modules/structure/roster-filters.tsx src/components/modules/structure/roster-table.tsx src/components/modules/structure/roster-pnl-bars.tsx src/components/modules/structure/roster-alerts.tsx src/messages/fr/roster.json src/messages/en/roster.json
git commit -m "roster : filtres catégorie / DA dans l'URL, tableau groupé par catégorie avec totaux, colonnes catégorie et DA"
```

---

### Task 7 : `roles.ts` — arrivée, navigation et périmètre par rôle

**Files:**
- Create: `src/lib/roles.ts`
- Create: `src/lib/__tests__/roles.test.ts`

- [ ] **Step 1 : le test**

```ts
import { describe, expect, it } from "vitest";
import { JOB_ROLES, ROLES, isJobRole, roleLanding, roleOverrides, roleScope } from "@/lib/roles";

const ALL = ["/pulse", "/roster", "/fil", "/streams", "/market", "/revenue", "/audience", "/algo-position", "/finances", "/calculator", "/valuation", "/splits", "/contracts", "/rights", "/placements", "/urssaf", "/audit", "/day1-index", "/copilot", "/ar-watch", "/fans", "/discovery", "/sync", "/tour", "/catalog", "/team", "/import", "/settings"];

describe("roles — la table de la spec (§4)", () => {
  it("cinq rôles", () => {
    expect(JOB_ROLES).toEqual(["da", "finance", "juridique", "direction", "presidence"]);
    expect(isJobRole("finance")).toBe(true);
    expect(isJobRole("stagiaire")).toBe(false);
    expect(isJobRole(null)).toBe(false);
  });
  it("page d'arrivée : le DA arrive sur son roster filtré", () => {
    expect(roleLanding("da", "da-urbain")).toBe("/roster?da=da-urbain");
    expect(roleLanding("da", null)).toBe("/roster");
    expect(roleLanding("finance", null)).toBe("/revenue");
    expect(roleLanding("juridique", null)).toBe("/contracts");
    expect(roleLanding("direction", null)).toBe("/pulse");
    expect(roleLanding("presidence", null)).toBe("/pulse");
  });
  it("navigation : les pages du rôle visibles, les autres cachées ; direction voit tout", () => {
    const fin = roleOverrides("finance", ALL);
    expect(Object.entries(fin).filter(([, v]) => v).map(([h]) => h).sort()).toEqual(["/audit", "/fil", "/finances", "/revenue", "/rights", "/valuation"]);
    expect(fin["/roster"]).toBe(false);
    expect(roleOverrides("direction", ALL)).toEqual({});
    expect(roleOverrides(null, ALL)).toEqual({});
    expect(Object.entries(roleOverrides("presidence", ALL)).filter(([, v]) => v).map(([h]) => h).sort()).toEqual(["/fil", "/pulse", "/roster", "/valuation"]);
    expect(Object.entries(roleOverrides("juridique", ALL)).filter(([, v]) => v).map(([h]) => h).sort()).toEqual(["/contracts", "/fil", "/placements", "/rights", "/splits"]);
    expect(Object.entries(roleOverrides("da", ALL)).filter(([, v]) => v).map(([h]) => h).sort()).toEqual(["/ar-watch", "/audience", "/contracts", "/fil", "/pulse", "/roster", "/streams"]);
  });
  it("chaque rôle a le Fil dans sa navigation", () => {
    for (const r of JOB_ROLES) expect(ROLES[r].nav === "all" || ROLES[r].nav.includes("/fil"), r).toBe(true);
  });
  it("périmètre : seul le DA est restreint, à son DA", () => {
    expect(roleScope("da", "da-compos")).toEqual({ daId: "da-compos" });
    expect(roleScope("da", null)).toEqual({ daId: null });
    expect(roleScope("finance", "da-compos")).toEqual({ daId: null });
    expect(roleScope(null, "da-compos")).toEqual({ daId: null });
  });
});
```

Run : `npx vitest run src/lib/__tests__/roles.test.ts` → FAIL (module absent).

- [ ] **Step 2 : `roles.ts`**

```ts
/**
 * Rôles métier de la maison Universal (spec Universal v2, §4) : un rôle = une
 * page d'arrivée, une navigation (préréglage de modules, comme Réglages →
 * Modules) et, pour le DA, un périmètre (ses artistes). Le sélecteur de rôle
 * est un outil de DÉMO, pas une authentification.
 *
 * Pur : aucun import de nav.ts (qui importe le type Persona de role.tsx, qui
 * importe JobRole d'ici). Les hrefs du catalogue sont passés par l'appelant.
 */
import type { ModuleOverrides } from "@/lib/nav";

export const JOB_ROLES = ["da", "finance", "juridique", "direction", "presidence"] as const;
export type JobRole = (typeof JOB_ROLES)[number];

export function isJobRole(v: unknown): v is JobRole {
  return typeof v === "string" && (JOB_ROLES as readonly string[]).includes(v);
}

export type RoleConfig = {
  id: JobRole;
  /** Page d'arrivée (le DA : voir `roleLanding`, qui ajoute `?da=`). */
  landing: string;
  /** Hrefs visibles dans la navigation, ou « all » (direction). Réglages reste toujours (verrouillé dans nav.ts). */
  nav: readonly string[] | "all";
  /** « da » : ses artistes partout où un agrégat label existe ; « all » : tout le roster. */
  scope: "da" | "all";
};

export const ROLES: Record<JobRole, RoleConfig> = {
  da: {
    id: "da",
    landing: "/roster",
    nav: ["/roster", "/pulse", "/streams", "/audience", "/ar-watch", "/contracts", "/fil"],
    scope: "da",
  },
  finance: {
    id: "finance",
    landing: "/revenue",
    nav: ["/revenue", "/finances", "/rights", "/valuation", "/audit", "/fil"],
    scope: "all",
  },
  juridique: {
    id: "juridique",
    landing: "/contracts",
    nav: ["/contracts", "/splits", "/rights", "/placements", "/fil"],
    scope: "all",
  },
  direction: { id: "direction", landing: "/pulse", nav: "all", scope: "all" },
  presidence: {
    id: "presidence",
    /* Pulse en vue structure s'ouvre déjà sur la synthèse (streams, revenus, valorisation, alertes). */
    landing: "/pulse",
    nav: ["/pulse", "/roster", "/valuation", "/fil"],
    scope: "all",
  },
};

/** Page d'arrivée : le DA arrive sur son roster déjà filtré. */
export function roleLanding(role: JobRole, daId: string | null): string {
  if (role === "da" && daId) return `/roster?da=${encodeURIComponent(daId)}`;
  return ROLES[role].landing;
}

/**
 * Préréglage de modules du rôle, dans le format des choix utilisateur
 * (`ModuleOverrides`) : visible = dans la liste du rôle, caché sinon. Les choix
 * explicites de l'utilisateur se posent PAR-DESSUS (use-modules.ts).
 */
export function roleOverrides(role: JobRole | null, catalogHrefs: readonly string[]): ModuleOverrides {
  if (!role || ROLES[role].nav === "all") return {};
  const keep = new Set(ROLES[role].nav as readonly string[]);
  return Object.fromEntries(catalogHrefs.map((h) => [h, keep.has(h)]));
}

/** Périmètre du rôle : les artistes du DA, sinon tout le roster. */
export function roleScope(role: JobRole | null, daId: string | null): { daId: string | null } {
  return role === "da" && daId ? { daId } : { daId: null };
}
```

- [ ] **Step 3 : tester, commiter**

Run : `npx vitest run src/lib/__tests__/roles.test.ts` → PASS (5 tests).

```bash
git add -- src/lib/roles.ts src/lib/__tests__/roles.test.ts
git commit -m "rôles : DA, finance, juridique, direction, présidence — arrivée, navigation et périmètre (roles.ts, pur)"
```

---

### Task 8 : le rôle dans `RoleState`, le sélecteur de la barre du haut, le périmètre DA

**Files:**
- Modify: `src/lib/role.tsx`
- Modify: `src/components/dashboard/topbar.tsx` (sélecteur d'identité, lignes 131-212)
- Modify: `src/app/(dashboard)/pulse/page.tsx` (vue structure : `ARTISTS` → `roster`)
- Modify: `src/messages/fr/common.json`, `src/messages/en/common.json` (`roles`)

- [ ] **Step 1 : textes**

`src/messages/fr/common.json`, dans `roles`, ajouter :

```json
    "jobTitle": "Mon métier",
    "chooseDa": "Je suis DA de…",
    "job": {
      "da": "DA",
      "finance": "Finance",
      "juridique": "Juridique",
      "direction": "Direction",
      "presidence": "Présidence"
    }
```

`src/messages/en/common.json` :

```json
    "jobTitle": "My role",
    "chooseDa": "I'm the A&R of…",
    "job": { "da": "A&R", "finance": "Finance", "juridique": "Legal", "direction": "Management", "presidence": "Chairman's office" }
```

- [ ] **Step 2 : `RoleState` gagne `jobRole` et `daId`**

Dans `src/lib/role.tsx` :

```ts
import { isJobRole, roleScope, type JobRole } from "@/lib/roles";
import { TENANT } from "@/lib/tenant";
```

```ts
type RoleContextValue = {
  persona: Persona;
  artistId: string;
  focusedArtistId: string | null;
  setPersona: (p: Persona) => void;
  setFocusedArtistId: (id: string | null) => void;
  isLabel: boolean;
  hasUserData: boolean;
  /** Rôle métier (maison Universal) ; null = aucun rôle choisi, ou maison sans rôles. */
  jobRole: JobRole | null;
  /** Le DA incarné quand `jobRole === "da"`. */
  daId: string | null;
  /** Périmètre effectif : l'id du DA quand le rôle restreint, sinon null (tout le roster). */
  scopeDaId: string | null;
  /** Choisir un rôle passe en persona structure et repart de la vue roster ; null retire le rôle. */
  setJobRole: (role: JobRole | null, daId?: string | null) => void;
};
```

`CustomerRoleProvider` : ajouter `jobRole: null, daId: null, scopeDaId: null, setJobRole: noop,` dans l'objet mémorisé.

```ts
type RoleState = { persona: Persona; focusedArtistId: string | null; jobRole: JobRole | null; daId: string | null };
const DEFAULT_ROLE: RoleState = { persona: "artist", focusedArtistId: null, jobRole: null, daId: null };
```

Dans le bloc `?persona=` : `JSON.stringify({ persona: fromUrl, focusedArtistId: null, jobRole: null, daId: null })`.

Dans `readRole`, l'objet `next` :

```ts
        next = {
          persona: saved.persona === "artist" || saved.persona === "label" ? saved.persona : "artist",
          focusedArtistId: saved.focusedArtistId ?? null,
          jobRole: isJobRole(saved.jobRole) ? saved.jobRole : null,
          daId: typeof saved.daId === "string" ? saved.daId : null,
        };
```

Dans `RoleProvider` :

```ts
  const role = useSyncExternalStore(subscribeRole, readRole, () => DEFAULT_ROLE);
  /* Maison à rôles : la persona reste « structure » — le sélecteur propose des métiers, pas des personas. */
  const persona: Persona = TENANT.roles ? "label" : role.persona;
  const { focusedArtistId, jobRole, daId } = role;

  const setPersona = useCallback((p: Persona) => {
    // Changement de persona = on repart de la vue par défaut, sans rôle.
    writeRole({ persona: p, focusedArtistId: null, jobRole: null, daId: null });
  }, []);

  const setFocusedArtistId = useCallback((id: string | null) => {
    writeRole({ ...roleValue, focusedArtistId: id });
  }, []);

  const setJobRole = useCallback((next: JobRole | null, nextDaId: string | null = null) => {
    writeRole({ persona: "label", focusedArtistId: null, jobRole: next, daId: next === "da" ? nextDaId : null });
  }, []);

  const scopeDaId = TENANT.roles ? roleScope(jobRole, daId).daId : null;
```

et dans la valeur du contexte : `jobRole, daId, scopeDaId, setJobRole,` (+ dépendances du `useMemo` : `jobRole, daId, scopeDaId, setJobRole`).

- [ ] **Step 3 : le sélecteur de la barre du haut**

Dans `src/components/dashboard/topbar.tsx`, imports à ajouter :

```ts
import { useRouter } from "next/navigation";
import { Briefcase } from "lucide-react";
import { DAS, getDa } from "@/lib/demo/data";
import { scopedArtists } from "@/lib/demo/scope";
import { JOB_ROLES, roleLanding, type JobRole } from "@/lib/roles";
import { TENANT } from "@/lib/tenant";
```

Dans le composant, après `useRole()` (ajouter `jobRole, daId, scopeDaId, setJobRole` à la déstructuration) :

```ts
  const tr = useTranslations("roster");
  const router = useRouter();
  const pickRole = (role: JobRole, nextDaId: string | null) => {
    setJobRole(role, nextDaId);
    router.push(roleLanding(role, nextDaId));
  };
  const da = daId ? getDa(daId) : null;
  const roleTitle = jobRole ? `${t(`roles.job.${jobRole}`)}${jobRole === "da" && da ? ` · ${da.name}` : ""}` : null;
  /* En vue structure, la liste d'artistes du menu suit le périmètre du rôle (le DA ne voit que les siens). */
  const menuArtists = scopeDaId ? scopedArtists({ daId: scopeDaId }) : ARTISTS;
```

Dans le bouton déclencheur (branche `persona === "label"`), remplacer `{focused ? focused.name : LABEL.name}` par `{focused ? focused.name : (roleTitle ?? LABEL.name)}`.

Dans `DropdownMenuContent` du sélecteur d'identité, remplacer le bloc du libellé « Artiste / Structure » et les deux `DropdownMenuItem` de persona par :

```tsx
            {TENANT.roles ? (
              <>
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("roles.jobTitle")}
                </DropdownMenuLabel>
                {JOB_ROLES.filter((r) => r !== "da").map((r) => (
                  <DropdownMenuItem key={r} onClick={() => pickRole(r, null)} className="gap-2">
                    <Briefcase className="size-4" aria-hidden />
                    <span className="flex-1">{t(`roles.job.${r}`)}</span>
                    {jobRole === r && <Check className="size-4 text-brand" aria-hidden />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("roles.chooseDa")}
                </DropdownMenuLabel>
                {DAS.map((d) => (
                  <DropdownMenuItem key={d.id} onClick={() => pickRole("da", d.id)} className="gap-2">
                    <span className="flex size-5 items-center justify-center rounded bg-brand/15 text-[10px] font-semibold text-brand">{d.name[0]}</span>
                    <span className="flex-1 text-sm">{d.name} <span className="text-muted-foreground">· {tr(`category.${d.category}`)}</span></span>
                    {jobRole === "da" && daId === d.id && <Check className="size-4 text-brand" aria-hidden />}
                  </DropdownMenuItem>
                ))}
              </>
            ) : (
              <>
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("roles.artist")} / {t("roles.label")}
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setPersona("artist")} className="gap-2">
                  <MicVocal className="size-4" aria-hidden />
                  <span className="flex-1">{t("roles.switchTo", { role: t("roles.artist") })}</span>
                  {persona === "artist" && <Check className="size-4 text-brand" aria-hidden />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPersona("label")} className="gap-2">
                  <Building2 className="size-4" aria-hidden />
                  <span className="flex-1">{t("roles.switchTo", { role: t("roles.label") })}</span>
                  {persona === "label" && <Check className="size-4 text-brand" aria-hidden />}
                </DropdownMenuItem>
              </>
            )}
```

Plus bas, `{ARTISTS.map((a) => (` → `{menuArtists.map((a) => (`. Le libellé de section `{LABEL.name}` au-dessus de la liste reste.

- [ ] **Step 4 : Pulse en vue structure suit le périmètre**

Dans `src/app/(dashboard)/pulse/page.tsx` : `grep -n "ARTISTS" "src/app/(dashboard)/pulse/page.tsx"` liste l'import (ligne 50) et onze usages (vers les lignes 110, 156, 184, 371, 387, 392, 402, 403, 409, 419, 422, 983, 1146, 1159, 1296 — relire après les tâches précédentes). Ajouter l'import `import { scopedArtists } from "@/lib/demo/scope";`, récupérer `scopeDaId` dans la déstructuration de `useRole()` et, juste après :

```ts
  /* Le périmètre du rôle (DA : ses artistes). Sans rôle : tout le roster de la maison. */
  const roster = useMemo(() => scopedArtists({ daId: scopeDaId }), [scopeDaId]);
```

Puis remplacer CHAQUE usage d'`ARTISTS` dans le composant par `roster` (pas l'import, pas la fonction utilitaire de la ligne ~110 si elle est hors composant : lui passer `roster` en paramètre). Dans le `useMemo` de la vue structure (`labelView`, vers les lignes 355-443) : `labelTotals()` → `labelTotals(roster)`, `rosterRows()` → `rosterRows(roster)`, et pour les contrats et les splits :

```ts
    const rosterIds = new Set(roster.map((a) => a.id));
    const alertCount = CONTRACTS.filter((c) => rosterIds.has(c.artistId)).flatMap((c) => c.alerts).filter(
```

```ts
    const splitsPending = SPLITS.filter((s) => s.status !== "signed" && rosterIds.has(TRACKS.find((t) => t.id === s.trackId)?.artistId ?? "")).length;
```

(`TRACKS` est exporté par `@/lib/demo/api` ; l'ajouter à l'import s'il n'y est pas.) Ajouter `roster` aux dépendances des `useMemo` concernés (eslint `react-hooks/exhaustive-deps` les nomme).

- [ ] **Step 5 : typer, lint, vérifier, commiter**

```bash
npx tsc --noEmit -p . | head
npx eslint src/lib/role.tsx src/components/dashboard/topbar.tsx "src/app/(dashboard)/pulse/page.tsx"
npx vitest run src/lib/__tests__
```

Vérification à l'œil, maison universal : `NEXT_PUBLIC_TENANT=universal NEXT_DIST_DIR=.next-um npm run dev -- -p 3006` (dossier `.next-um` pour ne pas verrouiller le `.next` du serveur 3005 ; ajouter `.next-um/` à `.gitignore`, voir Task 12). Le menu de la barre propose « Mon métier » (Finance, Juridique, Direction, Présidence) puis « Je suis DA de… » (Inès M. · Urbain, Julien R. · Variété, Sofia K. · Compositeurs) ; choisir Inès M. → URL `/roster?da=da-urbain`, bouton « DA · Inès M. », liste d'artistes du menu limitée aux urbains ; `/pulse` compte « 6 artistes ». Maison day1 (3005) : menu inchangé (Vue Artiste / Vue Structure).

```bash
git add -- src/lib/role.tsx src/components/dashboard/topbar.tsx "src/app/(dashboard)/pulse/page.tsx" src/messages/fr/common.json src/messages/en/common.json .gitignore
git commit -m "rôles : jobRole et daId dans l'état de rôle, sélecteur de métier dans la barre (maison universal), Pulse et menu au périmètre du DA"
```

---

### Task 9 : préréglage de navigation par rôle, item « Fil »

**Files:**
- Modify: `src/lib/nav.ts` (`NAV_SECTIONS` daily, `LABEL_LAYOUT` daily)
- Modify: `src/lib/userdata/use-modules.ts`
- Modify: `src/lib/__tests__/nav.test.ts`
- Modify: `src/messages/fr/nav.json`, `src/messages/en/nav.json`
- Modify: `e2e/visual-audit.spec.ts` (`ROUTES`, ligne 25)

- [ ] **Step 1 : tests**

Dans `src/lib/__tests__/nav.test.ts`, le premier `it` attend `["sections.daily", ["/roster", "/pulse"]]` : remplacer par `["sections.daily", ["/roster", "/pulse", "/fil"]]` (et toute autre attente de la section `daily` dans ce fichier : `grep -n '"/pulse"' src/lib/__tests__/nav.test.ts`). Ajouter en fin de fichier :

```ts
import { roleOverrides } from "@/lib/roles";

describe("navigation d'un rôle métier (préréglage sous les choix utilisateur)", () => {
  const hrefsOf = (persona: "label" | "artist") => navCatalogForPersona(persona).flatMap((s) => s.items.map((i) => i.href));

  it("finance : ses six pages et Réglages, rien d'autre", () => {
    const nav = navForPersona("label", roleOverrides("finance", hrefsOf("label")));
    expect(flat(nav).sort()).toEqual(["/audit", "/fil", "/finances", "/revenue", "/rights", "/settings", "/valuation"]);
  });
  it("direction : la navigation structure complète", () => {
    expect(flat(navForPersona("label", roleOverrides("direction", hrefsOf("label"))))).toEqual(flat(navForPersona("label")));
  });
  it("un choix utilisateur passe par-dessus le préréglage", () => {
    const nav = navForPersona("label", { ...roleOverrides("presidence", hrefsOf("label")), "/team": true });
    expect(flat(nav).sort()).toEqual(["/fil", "/pulse", "/roster", "/settings", "/team", "/valuation"]);
  });
  it("le Fil est visible pour les deux personas sans rôle", () => {
    expect(flat(navForPersona("label"))).toContain("/fil");
    expect(flat(navForPersona("artist"))).toContain("/fil");
  });
});
```

Run : `npx vitest run src/lib/__tests__/nav.test.ts` → FAIL (`/fil` absent).

- [ ] **Step 2 : l'item dans `nav.ts`**

Import : ajouter `MessagesSquare` à la liste lucide. Dans `NAV_SECTIONS`, section `sections.daily`, après l'item `/roster` :

```ts
      {
        // Fil entre services : une info posée par un service, vue par le service concerné (spec Universal v2, §5).
        href: "/fil",
        labelKey: "items.feed",
        icon: MessagesSquare,
      },
```

Dans `LABEL_LAYOUT` : `{ labelKey: "sections.daily", hrefs: ["/roster", "/pulse", "/fil"] },`.

Textes : `src/messages/fr/nav.json` → `"feed": "Fil entre services"` dans `items` ; `src/messages/en/nav.json` → `"feed": "Cross-team feed"`.

- [ ] **Step 3 : `use-modules` pose le préréglage SOUS les choix**

```ts
import { roleOverrides } from "@/lib/roles";
```

```ts
export function useModules() {
  const { persona, jobRole } = useRole();
  useEffect(() => {
    hydrateModules();
  }, []);
  const snap = useSyncExternalStore(subscribeModules, modulesSnapshot, () => SERVER_SNAPSHOT);
  const catalog = useMemo(() => navCatalogForPersona(persona), [persona]);
  /* Préréglage du rôle (roles.ts) sous les choix explicites de l'utilisateur : un rôle règle la
     navigation comme Réglages → Modules l'aurait fait, et l'utilisateur garde le dernier mot. */
  const overrides = useMemo<ModuleOverrides>(() => {
    const user = JSON.parse(snap) as ModuleOverrides;
    return { ...roleOverrides(jobRole, catalog.flatMap((s) => s.items.map((i) => i.href))), ...user };
  }, [snap, jobRole, catalog]);
  const hasOverrides = snap !== SERVER_SNAPSHOT && Object.keys(JSON.parse(snap) as ModuleOverrides).length > 0;
```

Le reste du hook est inchangé, sauf `hasOverrides: Object.keys(overrides).length > 0` → `hasOverrides` (sinon « Réinitialiser » s'allumerait pour un rôle sans choix utilisateur). Retirer le `useMemo` de `catalog` qui suivait (il est remonté).

`e2e/visual-audit.spec.ts` : ajouter `"fil"` dans `ROUTES` (lire la forme des entrées à la ligne 25 et suivre la même).

- [ ] **Step 4 : tester, lint, commiter**

```bash
npx vitest run src/lib/__tests__/nav.test.ts src/lib/userdata/__tests__/modules-store.test.ts src/messages/__tests__/parity.test.ts
npx eslint src/lib/nav.ts src/lib/userdata/use-modules.ts
git add -- src/lib/nav.ts src/lib/userdata/use-modules.ts src/lib/__tests__/nav.test.ts src/messages/fr/nav.json src/messages/en/nav.json e2e/visual-audit.spec.ts
git commit -m "navigation : item « Fil entre services » ; le rôle métier pose un préréglage de modules sous les choix de l'utilisateur"
```

(La route `/fil` n'existe pas encore : l'item mène à une 404 jusqu'à la Task 11 — acceptable entre deux commits d'une même branche de travail.)

---

### Task 10 : `feed-store` — les notes du fil

**Files:**
- Create: `src/lib/userdata/feed-store.ts`
- Create: `src/lib/userdata/__tests__/feed-store.test.ts`

- [ ] **Step 1 : le test**

```ts
/**
 * Fil entre services : store local (localStorage simulé), tri, filtres par rôle
 * et DA, exemples posés une fois, « traité », compteurs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => { map.delete(k); },
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}

type Store = typeof import("@/lib/userdata/feed-store");
const TODAY = new Date("2026-10-24T09:00:00Z");
/** DA de démo : Leto et Nono → urbain ; Louane → variété ; Gustave Rudman → compositeurs ; ElGrandeToto → urbain. */
const daOf = (id: string) =>
  ({ leto: "da-urbain", "nono-la-grinta": "da-urbain", elgrandetoto: "da-urbain", louane: "da-variete", "gustave-rudman": "da-compos" })[id] ?? null;

describe("feed-store", () => {
  let store: Store;
  beforeEach(async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    vi.resetModules();
    store = await import("@/lib/userdata/feed-store");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fil vide au premier chargement : six exemples, datés par rapport à aujourd'hui", () => {
    store.hydrateFeed(TODAY);
    const notes = store.getNotes();
    expect(notes).toHaveLength(6);
    expect(notes.every((n) => n.status === "open")).toBe(true);
    expect(notes.find((n) => n.artistId === "nono-la-grinta")?.dueDate).toBe("2026-11-08"); // +15 jours
    expect(notes.find((n) => n.artistId === "louane")?.dueDate).toBe("2026-10-30"); // le 30 à venir
    expect(notes.find((n) => n.from === "direction")?.to).toEqual(["da", "finance", "juridique", "direction", "presidence"]);
    expect(JSON.parse(window.localStorage.getItem("day1-feed")!).notes).toHaveLength(6);
  });

  it("les exemples ne sont posés qu'une fois, même si tout est traité", () => {
    store.hydrateFeed(TODAY);
    for (const n of store.getNotes()) store.markDone(n.id, TODAY);
    vi.resetModules();
    return import("@/lib/userdata/feed-store").then((again) => {
      again.hydrateFeed(TODAY);
      expect(again.getNotes()).toHaveLength(6);
      expect(again.getNotes().every((n) => n.status === "done")).toBe(true);
    });
  });

  it("addNote : identifiant, date, texte borné à 500 caractères, persisté", () => {
    store.hydrateFeed(TODAY);
    const n = store.addNote(
      { from: "finance", fromName: "Finance · Thomas", to: ["direction"], artistId: null, urgency: "info", dueDate: null, text: "x".repeat(600) },
      TODAY,
    );
    expect(n.text).toHaveLength(500);
    expect(n.status).toBe("open");
    expect(n.createdAt).toBe(TODAY.toISOString());
    expect(store.getNotes()).toHaveLength(7);
    expect(store.feedSnapshot()).toContain(n.id);
  });

  it("markDone : statut et date ; une note inconnue ne change rien", () => {
    store.hydrateFeed(TODAY);
    const id = store.getNotes()[0].id;
    const before = store.feedSnapshot();
    store.markDone("nulle-part", TODAY);
    expect(store.feedSnapshot()).toBe(before);
    store.markDone(id, TODAY);
    const n = store.getNotes().find((x) => x.id === id)!;
    expect(n.status).toBe("done");
    expect(n.doneAt).toBe(TODAY.toISOString());
  });

  it("sortNotes : urgence, puis échéance (sans échéance en dernier), puis plus récente d'abord", () => {
    store.hydrateFeed(TODAY);
    const sorted = store.sortNotes(store.getNotes());
    expect(sorted.map((n) => n.urgency)).toEqual(["urgent", "urgent", "important", "important", "info", "info"]);
    expect(sorted[0].dueDate! <= sorted[1].dueDate!).toBe(true);
    expect(sorted.at(-1)!.dueDate).toBeNull();
  });

  it("notesForRole : ce qui est adressé à mon service ; le DA ne voit que ses artistes (et les notes sans artiste)", () => {
    store.hydrateFeed(TODAY);
    const all = store.getNotes();
    const texts = (list: typeof all) => list.map((n) => n.artistId ?? "—").sort();
    expect(texts(store.notesForRole(all, "finance", null, daOf))).toEqual(["nono-la-grinta", "—"]);
    expect(texts(store.notesForRole(all, "da", "da-urbain", daOf))).toEqual(["leto", "—"]);
    expect(texts(store.notesForRole(all, "da", "da-compos", daOf))).toEqual(["gustave-rudman", "—"]);
    expect(texts(store.notesForRole(all, "da", "da-variete", daOf))).toEqual(["—"]);
    expect(texts(store.notesForRole(all, "juridique", null, daOf))).toEqual(["louane", "—"]);
    expect(texts(store.notesForRole(all, "direction", null, daOf))).toEqual(["elgrandetoto", "—"]);
    expect(texts(store.notesForRole(all, "presidence", null, daOf))).toEqual(["—"]);
    // Sans rôle (maison day1) : tout ce qui est ouvert.
    expect(store.notesForRole(all, null, null, daOf)).toHaveLength(6);
    // Une note traitée sort du « à traiter ».
    store.markDone(all.find((n) => n.artistId === "louane")!.id, TODAY);
    expect(store.notesForRole(store.getNotes(), "juridique", null, daOf)).toHaveLength(1);
  });

  it("openCountByArtist : notes ouvertes par artiste", () => {
    store.hydrateFeed(TODAY);
    expect(store.openCountByArtist(store.getNotes())).toEqual({ "nono-la-grinta": 1, leto: 1, louane: 1, "gustave-rudman": 1, elgrandetoto: 1 });
  });

  it("côté serveur (pas de window) : hydrateFeed est un no-op, le snapshot vaut []", async () => {
    vi.unstubAllGlobals();
    vi.resetModules();
    const ssr = await import("@/lib/userdata/feed-store");
    ssr.hydrateFeed(TODAY);
    expect(ssr.getNotes()).toEqual([]);
    expect(ssr.feedSnapshot()).toBe("[]");
  });
});
```

Run : `npx vitest run src/lib/userdata/__tests__/feed-store.test.ts` → FAIL (module absent).

- [ ] **Step 2 : `feed-store.ts`**

```ts
/**
 * Fil entre services (spec Universal v2, §5) : une note posée par un service,
 * adressée à d'autres, rattachée ou non à un artiste, avec urgence et échéance.
 *
 * Démo : localStorage `day1-feed`, cache module, `subscribe/snapshot` pour
 * `useSyncExternalStore`, hydratation explicite (`hydrateFeed()`, depuis un
 * effet — cf. use-feed.ts) : le rendu d'hydratation produit le même HTML que
 * le serveur (aucune note), les notes arrivent juste après. Des exemples sont
 * posés au premier chargement si le fil est vide — une seule fois.
 *
 * Hors périmètre ici : emails, base, pièces jointes (produit).
 */
import type { JobRole } from "@/lib/roles";

const STORAGE_KEY = "day1-feed";
export const FEED_TEXT_MAX = 500;

export type Urgency = "info" | "important" | "urgent";
export const URGENCIES: Urgency[] = ["urgent", "important", "info"];

export type FeedNote = {
  id: string;
  createdAt: string;
  from: JobRole;
  /** « Juridique · Camille » — le service et la personne, tel qu'affiché. */
  fromName: string;
  /** Services visés. */
  to: JobRole[];
  artistId: string | null;
  urgency: Urgency;
  /** AAAA-MM-JJ, ou null. */
  dueDate: string | null;
  /** 500 caractères max. */
  text: string;
  status: "open" | "done";
  doneAt: string | null;
};

export type NewNote = Pick<FeedNote, "from" | "fromName" | "to" | "artistId" | "urgency" | "dueDate" | "text">;

type FeedState = { version: 1; seeded: boolean; notes: FeedNote[] };

let cache: FeedNote[] = [];
let seeded = false;
let hydrated = false;
let snapshot = "[]";
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function persist() {
  snapshot = JSON.stringify(cache);
  try {
    const state: FeedState = { version: 1, seeded, notes: cache };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota ou stockage indisponible — les notes restent en mémoire pour la session */
  }
  notify();
}

function isNote(v: unknown): v is FeedNote {
  const n = v as Partial<FeedNote> | null;
  return !!n && typeof n.id === "string" && typeof n.text === "string" && Array.isArray(n.to) && (n.status === "open" || n.status === "done");
}

/**
 * Relit localStorage une fois (idempotent) ; pose les exemples si le fil n'a
 * jamais été rempli. Sans window (serveur) : no-op, le cache reste vide.
 */
export function hydrateFeed(today: Date = new Date()): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<FeedState>) : null;
    cache = parsed?.version === 1 && Array.isArray(parsed.notes) ? parsed.notes.filter(isNote) : [];
    seeded = parsed?.seeded === true;
  } catch {
    cache = [];
    seeded = false;
  }
  if (!seeded && cache.length === 0) {
    cache = seedNotes(today);
    seeded = true;
    persist();
    return;
  }
  const next = JSON.stringify(cache);
  if (next === snapshot) return;
  snapshot = next;
  notify();
}

export function getNotes(): FeedNote[] {
  return cache;
}

export function addNote(input: NewNote, now: Date = new Date()): FeedNote {
  hydrateFeed(now);
  const note: FeedNote = {
    id: `note-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now.toISOString(),
    from: input.from,
    fromName: input.fromName,
    to: [...new Set(input.to)],
    artistId: input.artistId,
    urgency: input.urgency,
    dueDate: input.dueDate,
    text: input.text.trim().slice(0, FEED_TEXT_MAX),
    status: "open",
    doneAt: null,
  };
  cache = [note, ...cache];
  persist();
  return note;
}

export function markDone(id: string, now: Date = new Date()): void {
  hydrateFeed(now);
  if (!cache.some((n) => n.id === id && n.status === "open")) return;
  cache = cache.map((n) => (n.id === id ? { ...n, status: "done", doneAt: now.toISOString() } : n));
  persist();
}

export function subscribeFeed(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Clé de cache stable (JSON des notes) : "[]" côté serveur et avant hydratation. */
export function feedSnapshot(): string {
  return snapshot;
}

/* ─── Helpers purs (testables sans store) ─── */

const URGENCY_RANK: Record<Urgency, number> = { urgent: 0, important: 1, info: 2 };

/** Urgence, puis échéance croissante (sans échéance en dernier), puis la plus récente d'abord. */
export function sortNotes(notes: FeedNote[]): FeedNote[] {
  return [...notes].sort((a, b) => {
    const u = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (u !== 0) return u;
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export type DaOf = (artistId: string) => string | null;

/**
 * Les notes OUVERTES à traiter par un rôle : adressées à son service ; pour un
 * DA, seulement celles de ses artistes (une note sans artiste s'adresse à tous
 * les DA). Sans rôle (maison day1) : tout ce qui est ouvert.
 */
export function notesForRole(notes: FeedNote[], role: JobRole | null, daId: string | null, daOf: DaOf): FeedNote[] {
  return notes.filter((n) => {
    if (n.status !== "open") return false;
    if (!role) return true;
    if (!n.to.includes(role)) return false;
    if (role === "da" && daId && n.artistId) return daOf(n.artistId) === daId;
    return true;
  });
}

export function openCountByArtist(notes: FeedNote[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of notes) if (n.status === "open" && n.artistId) out[n.artistId] = (out[n.artistId] ?? 0) + 1;
  return out;
}

/* ─── Exemples (spec §5), datés par rapport à `today` ─── */

const ALL_ROLES: JobRole[] = ["da", "finance", "juridique", "direction", "presidence"];
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const shift = (today: Date, days: number) => new Date(today.getTime() + days * 86_400_000);
/** Le prochain « 30 » du calendrier : ce mois-ci s'il n'est pas passé, sinon le mois suivant. */
function nextDay30(today: Date): string {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const thisMonth = new Date(Date.UTC(y, m, 30));
  return isoDay(today.getUTCDate() < 30 ? thisMonth : new Date(Date.UTC(y, m + 1, 30)));
}
/** Le prochain vendredi (aujourd'hui si c'en est un). */
function nextFriday(today: Date): string {
  const delta = (5 - today.getUTCDay() + 7) % 7;
  return isoDay(shift(today, delta));
}

export function seedNotes(today: Date): FeedNote[] {
  const at = (daysAgo: number) => shift(today, -daysAgo).toISOString();
  const base = { status: "open" as const, doneAt: null };
  return [
    { ...base, id: "seed-recoupement-nono", createdAt: at(1), from: "juridique", fromName: "Juridique · Camille", to: ["finance"], artistId: "nono-la-grinta", urgency: "urgent", dueDate: isoDay(shift(today, 15)),
      text: "Clause de recoupement croisé de l'avance de Nono La Grinta : à faire retirer au prochain avenant. Échéance 15 jours." },
    { ...base, id: "seed-avance-leto", createdAt: at(2), from: "finance", fromName: "Finance · Thomas", to: ["da"], artistId: "leto", urgency: "important", dueDate: isoDay(shift(today, 30)),
      text: "Avance de Leto recoupée à 80 % : prévoir la renégociation avant la prochaine sortie." },
    { ...base, id: "seed-option-louane", createdAt: at(0), from: "da", fromName: "DA variété · Julien R.", to: ["juridique"], artistId: "louane", urgency: "urgent", dueDate: nextDay30(today),
      text: "Option sur Louane à lever avant le 30." },
    { ...base, id: "seed-comite-catalogue", createdAt: at(3), from: "direction", fromName: "Direction · Gaël", to: ALL_ROLES, artistId: null, urgency: "info", dueDate: nextFriday(today),
      text: "Comité catalogue vendredi : remonter les œuvres sans split signé." },
    { ...base, id: "seed-edition-gustave", createdAt: at(4), from: "juridique", fromName: "Juridique · Camille", to: ["da"], artistId: "gustave-rudman", urgency: "info", dueDate: null,
      text: "Contrat d'édition de Gustave Rudman reçu, relecture en cours." },
    { ...base, id: "seed-deezer-q3", createdAt: at(1), from: "finance", fromName: "Finance · Thomas", to: ["direction"], artistId: "elgrandetoto", urgency: "important", dueDate: isoDay(shift(today, 7)),
      text: "Relevé Deezer Q3 reçu : écart d'audit sur ElGrandeToto, à arbitrer." },
  ];
}
```

- [ ] **Step 3 : tester, commiter**

Run : `npx vitest run src/lib/userdata/__tests__/feed-store.test.ts` → PASS (8 tests). Si le test du tri échoue sur l'ordre des deux « urgent » (Nono +15 j vs Louane le 30) selon la date du jour, c'est le test qui suppose un ordre : il compare `sorted[0].dueDate <= sorted[1].dueDate`, vrai dans les deux cas — relire la sortie avant de toucher au code.

```bash
git add -- src/lib/userdata/feed-store.ts src/lib/userdata/__tests__/feed-store.test.ts
git commit -m "fil entre services : store local des notes (tri, filtres par rôle et DA, exemples posés une fois, traité, compteurs)"
```

---

### Task 11 : page `/fil`, compteurs dans la navigation, Pulse et le roster

**Files:**
- Create: `src/lib/userdata/use-feed.ts`
- Create: `src/app/(dashboard)/fil/page.tsx`
- Create: `src/components/dashboard/feed-count.tsx`
- Modify: `src/components/dashboard/sidebar.tsx`, `mobile-nav.tsx` (après le `<span className="truncate">` du libellé)
- Modify: `src/app/(dashboard)/pulse/page.tsx` (les deux blocs `key: "todo"`)
- Modify: `src/app/(dashboard)/roster/page.tsx` (`notesByArtist`)
- Create: `src/messages/fr/fil.json`, `src/messages/en/fil.json` ; Modify: `src/messages/index.ts`, `src/messages/{fr,en}/pulse.json`

- [ ] **Step 1 : le hook**

`src/lib/userdata/use-feed.ts` :

```ts
"use client";

/**
 * Abonnement React au fil (feed-store) + périmètre du rôle courant : « à traiter
 * pour moi » suit `jobRole` / `daId` ; sans rôle (maison day1), tout est pour moi.
 * "[]" côté serveur et pendant l'hydratation (HTML identique), les notes juste après.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { ARTISTS } from "@/lib/demo/data";
import { useRole } from "@/lib/role";
import { addNote, feedSnapshot, hydrateFeed, markDone, notesForRole, openCountByArtist, subscribeFeed, type FeedNote } from "./feed-store";

const SERVER_SNAPSHOT = "[]";
const daOf = (artistId: string) => ARTISTS.find((a) => a.id === artistId)?.daId ?? null;

export function useFeed() {
  const { jobRole, daId } = useRole();
  useEffect(() => {
    hydrateFeed();
  }, []);
  const snap = useSyncExternalStore(subscribeFeed, feedSnapshot, () => SERVER_SNAPSHOT);
  const notes = useMemo(() => JSON.parse(snap) as FeedNote[], [snap]);
  const forMe = useMemo(() => notesForRole(notes, jobRole, daId, daOf), [notes, jobRole, daId]);
  const byArtist = useMemo(() => openCountByArtist(notes), [notes]);
  const add = useCallback((input: Parameters<typeof addNote>[0]) => addNote(input), []);
  const done = useCallback((id: string) => markDone(id), []);
  return { notes, forMe, openForMe: forMe.length, byArtist, add, done, jobRole, daId };
}
```

- [ ] **Step 2 : textes du fil**

`src/messages/fr/fil.json` :

```json
{
  "title": "Fil entre services",
  "subtitle": "Une info posée par un service au moment où il l'a, vue par le service concerné au bon moment — sans attendre la réunion.",
  "filters": {
    "mine": "À traiter pour moi",
    "all": "Tout",
    "artist": "Artiste",
    "anyArtist": "Tous les artistes",
    "count": "{count, plural, =0 {Aucune note} one {# note} other {# notes}}"
  },
  "note": {
    "from": "{from} → {to}",
    "everyone": "tous les services",
    "noArtist": "Sans artiste",
    "due": "Échéance {date}",
    "done": "Traitée le {date}",
    "markDone": "Traité",
    "created": "{date}"
  },
  "urgency": { "urgent": "Urgent", "important": "Important", "info": "Info" },
  "roles": { "da": "DA", "finance": "Finance", "juridique": "Juridique", "direction": "Direction", "presidence": "Présidence" },
  "author": { "structure": "Structure", "me": "moi" },
  "empty": { "mine": "Rien à traiter pour toi.", "all": "Le fil est vide." },
  "new": {
    "button": "Nouvelle note",
    "title": "Nouvelle note",
    "description": "Ce que tu sais maintenant, pour le service qui en a besoin.",
    "text": "Note",
    "textHint": "{count}/500",
    "artist": "Artiste concerné",
    "to": "Services visés",
    "urgency": "Urgence",
    "dueDate": "Échéance",
    "submit": "Publier",
    "cancel": "Annuler",
    "needTo": "Choisis au moins un service.",
    "needText": "Écris la note."
  }
}
```

`src/messages/en/fil.json` (mêmes clés) :

```json
{
  "title": "Cross-team feed",
  "subtitle": "A fact posted by one team the moment it has it, seen by the team that needs it at the right time — without waiting for the meeting.",
  "filters": { "mine": "For me to handle", "all": "Everything", "artist": "Artist", "anyArtist": "All artists", "count": "{count, plural, =0 {No notes} one {# note} other {# notes}}" },
  "note": { "from": "{from} → {to}", "everyone": "all teams", "noArtist": "No artist", "due": "Due {date}", "done": "Handled on {date}", "markDone": "Handled", "created": "{date}" },
  "urgency": { "urgent": "Urgent", "important": "Important", "info": "Info" },
  "roles": { "da": "A&R", "finance": "Finance", "juridique": "Legal", "direction": "Management", "presidence": "Chairman's office" },
  "author": { "structure": "Label", "me": "me" },
  "empty": { "mine": "Nothing for you to handle.", "all": "The feed is empty." },
  "new": { "button": "New note", "title": "New note", "description": "What you know now, for the team that needs it.", "text": "Note", "textHint": "{count}/500", "artist": "Artist", "to": "Teams", "urgency": "Urgency", "dueDate": "Due date", "submit": "Post", "cancel": "Cancel", "needTo": "Pick at least one team.", "needText": "Write the note." }
}
```

`src/messages/index.ts` : ajouter `import frFil from "./fr/fil.json"; import enFil from "./en/fil.json";` et `fil: frFil,` / `fil: enFil,` dans les deux blocs.

`src/messages/fr/pulse.json`, bloc `night.todo` : ajouter `"feed": "<em>{count, plural, one {# note} other {# notes}}</em> à traiter dans le fil."` ; `src/messages/en/pulse.json` : `"feed": "<em>{count, plural, one {# note} other {# notes}}</em> to handle in the feed."`.

Run : `npx vitest run src/messages/__tests__/parity.test.ts` → PASS.

- [ ] **Step 3 : la page**

`src/app/(dashboard)/fil/page.tsx` :

```tsx
"use client";

/**
 * /fil — le fil entre services (spec Universal v2, §5). Liste triée urgence puis
 * échéance ; filtres « à traiter pour moi / tout / par artiste » ; nouvelle note ;
 * « Traité ». Démo : localStorage (feed-store). Sans rôle choisi (maison day1),
 * tout est « pour moi » et l'auteur est « Structure ».
 */
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Plus } from "lucide-react";
import { ArtistBadge } from "@/components/dashboard/artist-badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { Sheet, SheetHeading } from "@/components/dashboard/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ARTISTS, getArtist, getDa } from "@/lib/demo/data";
import { fmtDate } from "@/lib/format";
import { JOB_ROLES, type JobRole } from "@/lib/roles";
import { FEED_TEXT_MAX, URGENCIES, sortNotes, type FeedNote, type Urgency } from "@/lib/userdata/feed-store";
import { useFeed } from "@/lib/userdata/use-feed";
import { cn } from "@/lib/utils";

const URGENCY_TONE: Record<Urgency, string> = {
  urgent: "border-transparent bg-destructive/10 text-destructive",
  important: "border-transparent bg-warning/10 text-warning",
  info: "border-transparent bg-muted text-muted-foreground",
};

export default function FeedPage() {
  // `useSearchParams` dans un composant client : frontière Suspense obligatoire (docs Next 16).
  return (
    <Suspense fallback={null}>
      <Feed />
    </Suspense>
  );
}

function Feed() {
  const t = useTranslations("fil");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { notes, forMe, add, done, jobRole, daId } = useFeed();

  const [mode, setMode] = useState<"mine" | "all">("mine");
  const artistParam = params.get("artist");
  const artistFilter = artistParam && ARTISTS.some((a) => a.id === artistParam) ? artistParam : null;
  const setArtistFilter = (id: string | null) => router.replace(id ? `/fil?artist=${encodeURIComponent(id)}` : "/fil", { scroll: false });

  const shown = useMemo(() => {
    const base = mode === "mine" ? forMe : notes;
    return sortNotes(artistFilter ? base.filter((n) => n.artistId === artistFilter) : base);
  }, [mode, forMe, notes, artistFilter]);

  const roleName = (r: JobRole) => t(`roles.${r}`);
  const toLabel = (to: JobRole[]) => (to.length === JOB_ROLES.length ? t("note.everyone") : to.map(roleName).join(", "));

  return (
    <div className="rise-in">
      <PageHeader title={t("title")} subtitle={t("subtitle")}>
        <NewNoteDialog onSubmit={add} jobRole={jobRole} daId={daId} />
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
        <div className="flex items-center gap-1.5" role="group" aria-label={t("filters.mine")}>
          {(["mine", "all"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn("rounded-full border px-2.5 py-1 transition-colors", mode === m ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground")}
            >
              {t(`filters.${m}`)} <span className="num opacity-70">{m === "mine" ? forMe.length : notes.filter((n) => n.status === "open").length}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">{t("filters.artist")}</span>
          <select
            value={artistFilter ?? ""}
            onChange={(e) => setArtistFilter(e.target.value || null)}
            className="h-8 rounded-lg border bg-background px-2 text-[12px]"
          >
            <option value="">{t("filters.anyArtist")}</option>
            {ARTISTS.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
      </div>

      <Sheet family="catalog">
        <SheetHeading action={t("filters.count", { count: shown.length })}>{mode === "mine" ? t("filters.mine") : t("filters.all")}</SheetHeading>
        {shown.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
            {t(mode === "mine" ? "empty.mine" : "empty.all")}
          </p>
        ) : (
          <ul className="mt-2 divide-y">
            {shown.map((n) => (
              <li key={n.id} className={cn("flex flex-wrap items-start gap-3 py-3", n.status === "done" && "opacity-60")}>
                <Badge className={URGENCY_TONE[n.urgency]}>{t(`urgency.${n.urgency}`)}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{n.text}</p>
                  <p className="sheet-ink mt-1 flex flex-wrap gap-x-3 text-[11px]">
                    <span>{t("note.from", { from: n.fromName, to: toLabel(n.to) })}</span>
                    <span>{fmtDate(locale, n.createdAt.slice(0, 10), { day: "numeric", month: "short" })}</span>
                    {n.dueDate && <span className={n.urgency === "urgent" ? "text-destructive" : undefined}>{t("note.due", { date: fmtDate(locale, n.dueDate, { day: "numeric", month: "long" }) })}</span>}
                    {n.doneAt && <span>{t("note.done", { date: fmtDate(locale, n.doneAt.slice(0, 10), { day: "numeric", month: "short" }) })}</span>}
                  </p>
                </div>
                {n.artistId ? (
                  <Link href={`/fil?artist=${encodeURIComponent(n.artistId)}`} className="shrink-0">
                    <ArtistBadge artist={getArtist(n.artistId)} size="sm" />
                  </Link>
                ) : (
                  <span className="shrink-0 text-[11px] text-muted-foreground">{t("note.noArtist")}</span>
                )}
                {n.status === "open" && (
                  <Button size="sm" variant="outline" onClick={() => done(n.id)}>
                    {t("note.markDone")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}

function NewNoteDialog({ onSubmit, jobRole, daId }: { onSubmit: ReturnType<typeof useFeed>["add"]; jobRole: JobRole | null; daId: string | null }) {
  const t = useTranslations("fil");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [artistId, setArtistId] = useState<string>("");
  const [to, setTo] = useState<JobRole[]>([]);
  const [urgency, setUrgency] = useState<Urgency>("info");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* Auteur : mon rôle (« Finance · moi », « DA · Inès M. »), ou « Structure » sans rôle. */
  const daName = jobRole === "da" && daId ? (getDa(daId)?.name ?? null) : null;
  const fromName = jobRole ? `${t(`roles.${jobRole}`)} · ${daName ?? t("author.me")}` : t("author.structure");
  const artistsForMe = jobRole === "da" && daId ? ARTISTS.filter((a) => a.daId === daId) : ARTISTS;

  const reset = () => { setText(""); setArtistId(""); setTo([]); setUrgency("info"); setDueDate(""); setError(null); };
  const submit = () => {
    if (!text.trim()) return setError(t("new.needText"));
    if (to.length === 0) return setError(t("new.needTo"));
    onSubmit({ from: jobRole ?? "direction", fromName, to, artistId: artistId || null, urgency, dueDate: dueDate || null, text });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="size-4" aria-hidden />{t("new.button")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("new.title")}</DialogTitle>
          <DialogDescription>{t("new.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="fil-text">{t("new.text")}</Label>
            <Textarea id="fil-text" value={text} maxLength={FEED_TEXT_MAX} onChange={(e) => setText(e.target.value)} rows={4} className="mt-1" />
            <p className="num mt-1 text-right text-[11px] text-muted-foreground">{t("new.textHint", { count: text.length })}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="fil-artist">{t("new.artist")}</Label>
              <select id="fil-artist" value={artistId} onChange={(e) => setArtistId(e.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm">
                <option value="">{t("note.noArtist")}</option>
                {artistsForMe.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="fil-urgency">{t("new.urgency")}</Label>
              <select id="fil-urgency" value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)} className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm">
                {URGENCIES.map((u) => <option key={u} value={u}>{t(`urgency.${u}`)}</option>)}
              </select>
            </div>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">{t("new.to")}</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {JOB_ROLES.map((r) => {
                const on = to.includes(r);
                return (
                  <button key={r} type="button" aria-pressed={on} onClick={() => setTo(on ? to.filter((x) => x !== r) : [...to, r])}
                    className={cn("rounded-full border px-2.5 py-1 text-[12px]", on ? "border-brand bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground")}>
                    {t(`roles.${r}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div>
            <Label htmlFor="fil-due">{t("new.dueDate")}</Label>
            <input id="fil-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 h-9 rounded-lg border bg-background px-2 text-sm" />
          </div>
          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("new.cancel")}</Button>
          <Button onClick={submit}>{t("new.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4 : la pastille dans la navigation**

`src/components/dashboard/feed-count.tsx` :

```tsx
"use client";

import { useFeed } from "@/lib/userdata/use-feed";

/** Notes ouvertes à traiter pour mon rôle — rien tant qu'il n'y en a pas (et rien côté serveur). */
export function FeedCount() {
  const { openForMe } = useFeed();
  if (openForMe === 0) return null;
  return (
    <span className="num ml-auto shrink-0 rounded-full bg-brand/15 px-1.5 text-[10px] font-medium leading-4 text-brand" aria-label={`${openForMe} notes`}>
      {openForMe}
    </span>
  );
}
```

Dans `sidebar.tsx` et `mobile-nav.tsx`, importer `FeedCount` et, juste après `<span className="truncate">{item.label ?? t(item.labelKey)}</span>` (sidebar) / `{item.label ?? t(item.labelKey)}` (mobile), ajouter `{item.href === "/fil" && <FeedCount />}`.

- [ ] **Step 5 : Pulse, « À faire aujourd'hui »**

Dans `src/app/(dashboard)/pulse/page.tsx` : `import { useFeed } from "@/lib/userdata/use-feed";` ; dans le composant, `const feed = useFeed();`. Dans le bloc `key: "todo"` de la vue artiste (vers la ligne 814), remplacer le contenu de `body` :

```tsx
                  body: (
                    <>
                      {v.night.alert ? (
                        <>
                          {v.night.alert.message[locale === "fr" ? "fr" : "en"]}
                          {v.night.alert.dueDate ? (
                            <>
                              {" "}
                              <Emph tone="alert">
                                {fmtDate(locale, v.night.alert.dueDate, { day: "numeric", month: "long" })}
                              </Emph>
                            </>
                          ) : null}{" "}
                        </>
                      ) : null}
                      {v.doors.splitsPending > 0 ? t.rich("night.todo.splits", { ...tags, count: v.doors.splitsPending }) : null}
                      {feed.openForMe > 0 ? (
                        <>
                          {" "}
                          <Link href="/fil" className="underline decoration-dotted underline-offset-2">
                            {t.rich("night.todo.feed", { ...tags, count: feed.openForMe })}
                          </Link>
                        </>
                      ) : null}
                      {!v.night.alert && v.doors.splitsPending === 0 && feed.openForMe === 0 ? t("night.todo.none") : null}
                    </>
                  ),
```

Dans le bloc `key: "todo"` de la vue structure (vers la ligne 1273), après `{t.rich("night.todo.splitsLabel", …)}` ajouter :

```tsx
                      {feed.openForMe > 0 ? (
                        <>
                          {" "}
                          <Link href="/fil" className="underline decoration-dotted underline-offset-2">
                            {t.rich("night.todo.feed", { ...tags, count: feed.openForMe })}
                          </Link>
                        </>
                      ) : null}
```

(`Link` est déjà importé ligne 20.) Si `feed` est lu dans un `useMemo`, l'y mettre en dépendance ; ici il est lu dans le JSX.

- [ ] **Step 6 : compteur sur le roster**

Dans `src/app/(dashboard)/roster/page.tsx` : `import { useFeed } from "@/lib/userdata/use-feed";`, `const { byArtist } = useFeed();` dans `DemoRoster`, et `<RosterTable rows={rows} grouped notesByArtist={byArtist} … />`.

- [ ] **Step 7 : typer, lint, vérifier, commiter**

```bash
npx tsc --noEmit -p . | head
npx eslint "src/app/(dashboard)/fil" src/lib/userdata/use-feed.ts src/components/dashboard "src/app/(dashboard)/pulse/page.tsx" "src/app/(dashboard)/roster/page.tsx"
npx vitest run src/messages/__tests__/parity.test.ts src/lib/userdata/__tests__/feed-store.test.ts
```

À l'œil (3005, maison day1, persona structure) : item « Fil entre services » avec pastille **6** ; `/fil` → 6 notes triées (deux Urgent en tête) ; « Nouvelle note » → texte, Direction, Important, publier → pastille **7** ; « Traité » sur une note → **6** ; `/pulse` « À faire aujourd'hui » : « 6 notes à traiter dans le fil. » (lien vers /fil) ; `/roster` : colonne Notes « 1 » sur Nono La Grinta, Leto, Louane, Gustave Rudman, ElGrandeToto, lien vers `/fil?artist=leto` filtré sur Leto.

```bash
git add -- src/lib/userdata/use-feed.ts "src/app/(dashboard)/fil/page.tsx" src/components/dashboard/feed-count.tsx src/components/dashboard/sidebar.tsx src/components/dashboard/mobile-nav.tsx "src/app/(dashboard)/pulse/page.tsx" "src/app/(dashboard)/roster/page.tsx" src/messages/fr/fil.json src/messages/en/fil.json src/messages/index.ts src/messages/fr/pulse.json src/messages/en/pulse.json
git commit -m "fil entre services : page /fil (filtres, nouvelle note, traité), compteurs dans la navigation, Pulse et le roster"
```

---

### Task 12 : lint i18n, parité, build des deux maisons, suite complète, e2e sur le build de prod

**Files:**
- Modify: `.gitignore` (`.next-universal/`, `.next-um/`)

- [ ] **Step 1 : les dossiers de build des deux maisons sont ignorés**

Ajouter à `.gitignore`, sous `.next-e2e/` :

```
.next-universal/
.next-um/
```

- [ ] **Step 2 : lint et parité**

```bash
npx eslint src e2e
npx vitest run src/messages/__tests__/parity.test.ts
```

Attendu : aucune erreur. `eslint-plugin-i18next` signale les chaînes en dur dans le JSX : les textes de `/fil`, du roster et du sélecteur passent tous par `messages/<locale>/` — si une chaîne est signalée, la mettre dans le namespace concerné (fr ET en).

- [ ] **Step 3 : suite complète**

```bash
npx vitest run
```

Attendu : 703 (base) + tenant 7 + roster-data 11 + scope 9 + roles 5 + nav 4 + feed-store 8 = **747 tests** environ, tous verts (le compte exact dépend des `it` ajoutés aux tests existants : le noter dans le compte rendu).

- [ ] **Step 4 : build des deux maisons**

```bash
npm run build                                                        # maison day1 (défaut)
NEXT_PUBLIC_TENANT=universal NEXT_DIST_DIR=.next-universal npm run build
```

Attendu : deux builds sans erreur ni avertissement « Missing Suspense boundary with useSearchParams » (sinon : Task 6 Step 3 / Task 11 Step 3). Vérifier que la maison est bien dans le bundle client :

```bash
grep -rl "Day One × Universal" .next-universal/static | head -2     # au moins un fichier
grep -rl "Day One × Universal" .next/static | head -2               # aucun
```

- [ ] **Step 5 : e2e sur le build de prod (règle AGENTS.md)**

```bash
NEXT_DIST_DIR=.next-e2e npm run build
E2E_SERVER=prod NEXT_DIST_DIR=.next-e2e npx playwright test e2e/demo-path.spec.ts e2e/rights-ecarts.spec.ts
```

Attendu : les deux specs vertes (demo-path clique désormais Nono La Grinta sur le roster). Un échec de `rights-ecarts` est un invariant AGENTS.md qui casse : lire avant de toucher.

- [ ] **Step 6 : commit**

```bash
git add -- .gitignore
git commit -m "build : dossiers des deux maisons ignorés ; suite, lint, e2e verts sur les deux builds"
```

(Si le lint a demandé des corrections de textes, les ajouter au même commit avec leur chemin explicite.)

---

### Task 13 : vérification mesurée en navigateur, les deux maisons

**Files:** aucun fichier versionné. Entrée temporaire dans `/Users/cluzelgael/DAY 2/.claude/launch.json` (retirée au Step 5).

- [ ] **Step 1 : deux serveurs de dev**

`day1-universal` (port 3005, maison day1 : `.env.local` porte `DEMO_MODE=on`, pas de `NEXT_PUBLIC_TENANT`) existe déjà dans `launch.json`. Ajouter, le temps de la vérification, l'entrée de la maison universal (dossier de build séparé pour ne pas verrouiller `.next`) :

```json
    {
      "name": "day1-universal-um",
      "runtimeExecutable": "env",
      "runtimeArgs": [
        "NEXT_PUBLIC_TENANT=universal",
        "NEXT_DIST_DIR=.next-um",
        "npm",
        "run",
        "dev",
        "--prefix",
        "from-day1-dashboard-universal",
        "--",
        "-p",
        "3006"
      ],
      "port": 3006
    }
```

Lancer les deux. Passer la porte `/acces` sur chacun (mot de passe de la démo, connu de Gaël — il n'est écrit nulle part dans le dépôt). Avant chaque lecture : `localStorage.clear()` dans la console puis recharger, pour partir d'un état connu (persona artiste, aucun rôle, fil non posé).

- [ ] **Step 2 : maison day1 (3005) — lire, et comparer à l'attendu**

Chaque valeur « attendu » est DÉDUITE du code ; la valeur MESURÉE est ce que l'écran affiche. Toute différence est un bug à corriger avant de conclure.

1. `document.title` → `Day 1 Dashboard Pro — Dashboard 360°`. Sidebar : « Day 1 » / « DASHBOARD 360° », aucune pastille UNIVERSAL.
2. Barre du haut, persona artiste : avatar **Dadju** (`DEMO_ARTIST_ID`). Menu : « Artiste / Structure », deux entrées de persona, PAS de « Mon métier ».
3. Vue structure → `/roster` : sous-titre « … les **11** artistes comparés » ; trois en-têtes de groupe : **Urbain** (6 : Dadju, Nono La Grinta, November Ultra, ElGrandeToto, Leto, Dakeez), **Variété** (2 : Louane, Wamen), **Compositeurs** (3 : Zeg P, Gustave Rudman, Brice Davoli) ; **aucune ligne Kiko** ; colonne DA : Inès M. / Julien R. / Sofia K. selon le groupe ; colonne Notes : 1 sur Nono La Grinta, Leto, Louane, Gustave Rudman, ElGrandeToto.
4. Pastille « Variété » → URL `/roster?cat=variete`, 2 lignes, sous-titre « 2 artistes · Variété — … », point affilié Artistes = 2, barres P&L à 2 noms. Pastille « Sofia K. » (DA) en plus → 0 ligne (variété ∩ compositeurs), pas d'erreur ; « Toutes » → 3 lignes compositeurs.
5. `/fil` : 6 notes ; ordre : les deux **Urgent** (Nono La Grinta, Louane) puis **Important** (Leto, ElGrandeToto) puis **Info** (comité catalogue, Gustave Rudman en dernier : sans échéance) ; « À traiter pour moi » = 6 = « Tout » (sans rôle). Nouvelle note (texte, Direction, Important) → 7 ; pastille « Fil » de la sidebar passe de 6 à **7** ; « Traité » sur la nouvelle → pastille **6** ; recharger la page → les 6 exemples + la note traitée (opacité réduite) sont toujours là (localStorage `day1-feed`).
6. `/pulse`, vue structure, bloc « À faire aujourd'hui » : « … **6 notes à traiter dans le fil.** » avec lien vers `/fil` ; vue artiste (Dadju) : même ligne (sans rôle, tout est pour moi).
7. `/team` : Lisa M. n'a plus « kiko » dans ses accès (sinon le nom affiché serait Dadju, repli `ARTISTS[0]`).
8. `/contracts` et `/splits` en vue structure : aucun contrat ni titre de Kiko ; contrats de Leto (recoupé 80 %), Louane (option 30/11), Dakeez, Wamen, Brice Davoli présents ; Gustave Rudman sans contrat.
9. Menu langue → EN : sidebar « Cross-team feed », roster « Urban / Pop / Songwriters », aucune clé brute (`items.feed`, `fil.…`) à l'écran.

- [ ] **Step 3 : maison universal (3006)**

1. `document.title` → `Day One × Universal — Un dashboard par métier`. Sidebar : « Day One × Universal » + pastille noire **UNIVERSAL**.
2. Barre du haut : persona structure d'office (pas de « Vue artiste ») ; bouton « Day One × Universal » ; menu : « Mon métier » (Finance, Juridique, Direction, Présidence) puis « Je suis DA de… » (Inès M. · Urbain, Julien R. · Variété, Sofia K. · Compositeurs).
3. `/roster` sans rôle : 11 artistes, **aucune ligne Dadju**, Kiko dans Urbain (Nono La Grinta, November Ultra, ElGrandeToto, Kiko, Leto, Dakeez).
4. Choisir **Finance** → URL `/revenue` ; sidebar : Revenus, Dépenses & P&L, Droits FR, Valorisation, Audit royalties, Fil entre services, Réglages — et rien d'autre ; pastille Fil = **2** (Nono La Grinta, comité) ; `/fil` « À traiter pour moi » = 2, « Tout » = 6.
5. **Juridique** → `/contracts` ; pastille **2** (Louane, comité). **Direction** → `/pulse`, navigation complète, pastille **2** (ElGrandeToto, comité). **Présidence** → `/pulse`, sidebar : Pulse, Roster, Fil, Valorisation, Réglages ; pastille **1** (comité).
6. **DA Inès M.** → URL `/roster?da=da-urbain`, 6 lignes, bouton « DA · Inès M. » ; liste d'artistes du menu : les 6 urbains ; `/pulse` : « 6 artistes », totaux sur 6 ; pastille Fil **2** (Leto, comité) ; Nouvelle note : la liste d'artistes du dialogue ne propose que les 6 urbains, auteur « DA · Inès M. ». **DA Sofia K.** → 3 lignes (Zeg P, Gustave Rudman, Brice Davoli), pastille **2** (Gustave Rudman, comité). **DA Julien R.** → 2 lignes, pastille **1** (comité).
7. Réglages → Modules avec le rôle Finance : les interrupteurs reflètent le préréglage (Roster éteint…) ; allumer « Équipe & accès » → il apparaît dans la sidebar ; « Réinitialiser » n'est actif que s'il y a un choix utilisateur.
8. `localStorage.getItem("day1-role")` → JSON avec `jobRole` et `daId` ; recharger : le rôle est conservé.
9. Mobile (`resize_window` preset mobile) : menu hamburger → marque « Day One × Universal », pastille UNIVERSAL, compteur Fil.

- [ ] **Step 4 : si un écart est trouvé**

Le corriger dans la tâche concernée (un commit par correctif, ajout explicite), relancer `npx vitest run`, puis re-mesurer le point en navigateur : AVANT (l'écart) / APRÈS (sa disparition) dans le compte rendu.

- [ ] **Step 5 : nettoyage**

Retirer l'entrée `day1-universal-um` de `launch.json` (le fichier n'est pas dans ce dépôt ; ne pas la laisser derrière soi). Les deux serveurs peuvent rester pour la Task 14.

---

### Task 14 : comparaison avec la démo figée

**Files:** aucun fichier versionné. Worktrees temporaires sous `/tmp`, entrée `launch.json` temporaire (retirée au Step 5).

Ce qui est en ligne (`_deploy`, `dpl_9aWB8EN71TCNnVeAnd64XpnJhhWL`) est l'étiquette `demo-2026-09-25` = **c276112** (AGENTS.md ; `demo-universal` a un commit de plus, db8e8e0 « droits d'auteur 15/55 », qui n'est PAS en ligne). Le témoin est donc c276112.

- [ ] **Step 1 : servir la démo figée à côté**

```bash
git worktree add /tmp/day1-demo demo-2026-09-25
cp -a node_modules /tmp/day1-demo/node_modules      # un lien symbolique casse Turbopack (AGENTS.md)
```

Entrée temporaire dans `launch.json` (la démo du 25/09 n'a pas de `DEMO_MODE` : elle est allumée d'office) :

```json
    { "name": "day1-demo-figee", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev", "--prefix", "/tmp/day1-demo", "--", "-p", "3003"], "port": 3003 }
```

- [ ] **Step 2 : témoin CHIFFRÉ des cinq artistes conservés (script, pas à l'œil)**

Les chiffres par artiste ne dépendent que de l'artiste et de `DEMO_TODAY`. Trois mesures, par un test jetable identique dans trois worktrees :

```ts
// src/lib/demo/__tests__/zz-figures.test.ts — JETABLE, ne pas commiter
import { it } from "vitest";
import { rosterRows } from "@/lib/demo/api";
it("chiffres des cinq conservés", () => {
  const keep = ["dadju", "nono-la-grinta", "november-ultra", "zeg-p", "elgrandetoto"];
  console.log("FIGURES " + JSON.stringify(rosterRows().filter((r) => keep.includes(r.id)).map((r) => [r.id, r.streams30d, Math.round(r.revenue12m), Math.round(r.net12m), r.valuationMid])));
});
```

```bash
SHA3=<SHA noté à la fin de la Task 3>
git worktree add /tmp/day1-base b201e96 && cp -a node_modules /tmp/day1-base/node_modules
git worktree add /tmp/day1-t3 "$SHA3" && cp -a node_modules /tmp/day1-t3/node_modules
for d in /tmp/day1-demo /tmp/day1-base /tmp/day1-t3; do
  cp src/lib/demo/__tests__/zz-figures.test.ts "$d/src/lib/demo/__tests__/"
  (cd "$d" && npx vitest run src/lib/demo/__tests__/zz-figures.test.ts 2>&1 | grep "^FIGURES" | sed "s|^|$d |")
done
```

Attendu :
- **/tmp/day1-base == /tmp/day1-t3** à l'identique : nos tâches 1-3 n'ont rien changé aux cinq conservés (si une valeur diffère, c'est un bug du chantier — chercher dans `data.ts` : un paramètre d'un artiste existant touché par erreur).
- **/tmp/day1-demo vs /tmp/day1-base** : des différences sont POSSIBLES et ne sont pas de ce chantier (commits entre le 25/09 et `achat`, ex. db8e8e0 « droits d'auteur 15/55 du brut master »). Les lister telles quelles dans le compte rendu, avec le commit qui les explique (`git log --oneline c276112..b201e96 -- src/lib/demo src/lib/real | head`), SANS les « corriger ».
- Le build final (après Task 4) a un autre `DEMO_TODAY` : ses chiffres bougent par construction. Ne pas les comparer à la démo figée au chiffre près ; comparer la STRUCTURE (Step 3).

Supprimer `zz-figures.test.ts` des quatre dossiers (`rm`), et les deux worktrees `day1-base`, `day1-t3` (`git worktree remove … --force`).

- [ ] **Step 3 : comparaison visuelle page par page (3003 démo figée ↔ 3005 maison day1)**

Même persona (structure), même langue (FR), même thème (« jour »), même largeur (1440). Pour chaque page, lire les titres de blocs (`document.querySelectorAll("h1, h2, [class*=sheet] h3")` dans la console donne la liste) et vérifier :

| Page | Doit être identique | Doit avoir changé |
|---|---|---|
| `/pulse` | tous les blocs (héros, bandes, « Cette nuit », « À faire aujourd'hui », portes, bande d'import) | « 11 artistes » au lieu de 6 ; ligne « 6 notes à traiter » ; Kiko absent des top movers |
| `/roster` | héros concentration, matrice, alertes, P&L, portes | filtres, groupes, colonnes DA / Notes, Kiko absent, six de plus |
| `/streams`, `/revenue`, `/audience`, `/finances`, `/valuation`, `/audit`, `/rights`, `/contracts`, `/splits`, `/placements`, `/team`, `/ar-watch` | tous les blocs présents, mêmes titres | Kiko absent partout (contrats, splits, équipe, menus d'artistes) ; les six présents là où le roster est listé |
| Sidebar | sections et items | « Day 1 » au lieu de « From Day 1 » ; item « Fil entre services » |
| Barre du haut, vue artiste Dadju : `/pulse`, `/streams`, `/revenue`, `/audit` | tous les blocs | — |

Un bloc présent le 25/09 et absent aujourd'hui = régression (voir AGENTS.md, le 24/09 trois blocs avaient disparu de cette façon) : la corriger avant la mise en ligne. Capturer une image par page des deux côtés (`.superpowers/qa/compare/<page>-{avant,apres}.png`, dossier ignoré par git) pour le compte rendu.

- [ ] **Step 4 : maison universal (3006) — ce qui doit différer, et seulement ça**

Même parcours sur 3006 : identique à 3005 sauf la marque (nom, pastille), le sélecteur de métier, Dadju absent / Kiko présent, et l'artiste par défaut (Nono La Grinta) en persona… il n'y a pas de persona artiste : vérifier que `/pulse` sans rôle s'ouvre en vue structure.

- [ ] **Step 5 : nettoyage**

```bash
git worktree remove /tmp/day1-demo --force
git worktree prune
```

Retirer l'entrée `day1-demo-figee` de `launch.json`. Compte rendu : MESURÉ (chiffres du Step 2, liste des pages du Step 3 avec « identique / différent attendu / régression ») et DÉDUIT séparés.

---

### Task 15 : mise en ligne de `day1-universal`

**Files:** aucun fichier versionné (le lien Vercel vit dans le worktree de déploiement, hors dépôt).

Règles : jamais depuis ce dossier de travail (un `vercel --prod` embarque l'arbre, modifications non commitées comprises) ; aucune valeur de variable n'est affichée ni collée dans le terminal — elles passent de `.env.local` à Vercel par un tuyau.

- [ ] **Step 1 : worktree propre**

```bash
git status --short                      # vide : tout est commité
git worktree add /tmp/day1-universal-deploy universal-v2
cd /tmp/day1-universal-deploy
vercel whoami                           # le compte attendu (gld142s)
```

- [ ] **Step 2 : créer et lier le projet**

```bash
vercel project add day1-universal --scope gld142s-projects
vercel link --yes --project day1-universal --scope gld142s-projects
cat .vercel/project.json | sed 's/"orgId": *"[^"]*"/"orgId": "…"/'    # projectName = day1-universal
```

- [ ] **Step 3 : variables de production (par tuyau, jamais affichées)**

```bash
SRC="/Users/cluzelgael/DAY 2/from-day1-dashboard-universal/.env.local"
for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY SUPABASE_DB_URL STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET CRON_SECRET; do
  grep "^$k=" "$SRC" | cut -d= -f2- | tr -d '"\n' | vercel env add "$k" production --scope gld142s-projects
done
printf 'on'        | vercel env add DEMO_MODE production --scope gld142s-projects
printf 'universal' | vercel env add NEXT_PUBLIC_TENANT production --scope gld142s-projects
printf 'https://day1-universal-gld142s-projects.vercel.app' | vercel env add APP_URL production --scope gld142s-projects
vercel env ls production --scope gld142s-projects      # dix noms, valeurs masquées
```

Les sept premières sont celles de `day1-pro` (le layout appelle Supabase même pour la démo : sans `NEXT_PUBLIC_SUPABASE_URL`, `createServerClient` lève). `APP_URL` suppose l'adresse canonique du projet (`<projet>-gld142s-projects.vercel.app`, même motif que `day1-pro`) : la confirmer au Step 5 et la corriger si elle diffère (`vercel env rm APP_URL production` puis re-`add`, puis redéployer — une variable ajoutée après le début d'un build n'y est pas). Le webhook Stripe n'est pas déclaré pour cette adresse : l'achat n'est pas un parcours de la démo Universal (hors périmètre, à noter).

- [ ] **Step 4 : désactiver la protection Vercel Authentication**

```bash
vercel api --help | head -30            # confirmer les noms d'options (--method / -X, --data / -d) de cette version du CLI (54.2.0)
vercel api "/v9/projects/day1-universal" -X PATCH -d '{"ssoProtection": null}' --scope gld142s-projects
vercel api "/v9/projects/day1-universal" --scope gld142s-projects | grep -o '"ssoProtection":[^,}]*'
```

Attendu : `"ssoProtection":null`. (Rappel AGENTS.md : une adresse `*.vercel.app` derrière la connexion Vercel est inutilisable pour une présentation.)

- [ ] **Step 5 : déployer, puis LIRE le contenu**

```bash
vercel --prod --yes --scope gld142s-projects
vercel ls --scope gld142s-projects | head -5
vercel inspect <url-affichée> --scope gld142s-projects          # alias : day1-universal-gld142s-projects.vercel.app attendu
curl -s -o /dev/null -w "%{http_code}\n" https://day1-universal-gld142s-projects.vercel.app/acces   # 200 (pas 401 : protection levée)
```

Un code HTTP ne prouve rien (AGENTS.md) : ouvrir l'adresse dans le navigateur, passer la porte, et relire les points 1 à 3 du Step 3 de la Task 13 (marque, sélecteur de métier, roster sans Dadju). Si `APP_URL` différait de l'alias réel : corriger (Step 3) et redéployer.

- [ ] **Step 6 : nettoyage**

```bash
cd "/Users/cluzelgael/DAY 2/from-day1-dashboard-universal"
git worktree remove /tmp/day1-universal-deploy --force
```

Noter dans le compte rendu : l'id du projet (`vercel project ls --scope gld142s-projects | grep day1-universal`), l'adresse, l'id du déploiement (`dpl_…`).

---

### Task 16 : `_deploy` redéployé, AGENTS.md, retour arrière

**Files:**
- Modify: `AGENTS.md`

Pré-requis : Task 14 terminée sans régression ouverte (c'est la condition posée par la spec pour toucher à la démo figée).

- [ ] **Step 1 : worktree propre lié à `_deploy`**

```bash
git status --short                      # vide
git worktree add /tmp/day1-demo-deploy universal-v2
mkdir -p /tmp/day1-demo-deploy/.vercel
cp "/Users/cluzelgael/DAY 2/from-day1-dashboard/.vercel/project.json" /tmp/day1-demo-deploy/.vercel/
cd /tmp/day1-demo-deploy
sed 's/"orgId": *"[^"]*"/"orgId": "…"/' .vercel/project.json      # projectName = _deploy
vercel env ls production --scope gld142s-projects
```

- [ ] **Step 2 : variables manquantes**

Le projet `_deploy` date d'avant Supabase : poser ce qui manque dans la liste du Step 1 (mêmes dix noms que la Task 15, avec `NEXT_PUBLIC_TENANT=day1` et `APP_URL=https://deploy-one-tawny-59.vercel.app`) — même boucle qu'en Task 15 Step 3, en remplaçant les deux `printf` :

```bash
printf 'day1' | vercel env add NEXT_PUBLIC_TENANT production --scope gld142s-projects
printf 'https://deploy-one-tawny-59.vercel.app' | vercel env add APP_URL production --scope gld142s-projects
```

Si `DEMO_MODE` existe déjà avec une autre valeur : `vercel env rm DEMO_MODE production` puis `printf 'on' | vercel env add DEMO_MODE production --scope gld142s-projects`.

- [ ] **Step 3 : déployer, lire, garder la porte de sortie**

```bash
vercel --prod --yes --scope gld142s-projects
vercel ls --scope gld142s-projects | head -5
vercel inspect https://deploy-one-tawny-59.vercel.app --scope gld142s-projects
```

Dans le navigateur, sur https://deploy-one-tawny-59.vercel.app : porte, puis sidebar « Day 1 », `/roster` 11 artistes sans Kiko, `/fil` 6 notes. Un ancien cookie de porte reste valable (`gate.ts` inchangé).

**Retour arrière** (si Gaël le demande, ou si une régression apparaît pendant une présentation), depuis ce même dossier lié à `_deploy` :

```bash
vercel rollback dpl_9aWB8EN71TCNnVeAnd64XpnJhhWL --scope gld142s-projects
```

(remet en ligne le déploiement du 25/09/2026 17h42 — code c276112 ; les variables du projet ne changent pas, la démo du 25/09 ne les lit pas).

- [ ] **Step 4 : AGENTS.md**

Remplacer, dans la section « La démo de présentation est FIGÉE… », les deux premières puces par :

```markdown
- En ligne : https://deploy-one-tawny-59.vercel.app (mot de passe), projet Vercel `_deploy`.
  Depuis le <date de la Task 16>, c'est la branche `universal-v2` (maison `day1`, `DEMO_MODE=on`,
  `NEXT_PUBLIC_TENANT=day1`) ; la démo du 25/09 (`dpl_9aWB8EN71TCNnVeAnd64XpnJhhWL`, étiquette
  `demo-2026-09-25`, commit c276112) reste la porte de sortie :
  `vercel rollback dpl_9aWB8EN71TCNnVeAnd64XpnJhhWL --scope gld142s-projects` depuis un dossier lié à `_deploy`.
- « Day One × Universal » : projet Vercel `day1-universal` (<id et adresse notés en Task 15>),
  même code, `NEXT_PUBLIC_TENANT=universal`, protection Vercel désactivée, porte `/acces` conservée.
```

et ajouter en fin de fichier :

```markdown
## Universal v2 (24/10/2026) — deux maisons, un code

- **Maison** = `NEXT_PUBLIC_TENANT` (`day1` défaut | `universal`), lue dans `src/lib/tenant.ts`.
  Elle règle le nom, la co-marque, les exclus du roster (day1 : Kiko ; universal : Dadju) et le
  sélecteur de rôle. `ARTISTS` (`src/lib/demo/data.ts`) est DÉJÀ filtré ; projets, contrats, splits,
  accès équipe et placements suivent. Les fichiers de relevés d'un exclu restent.
- **Rôles** (maison universal seulement) : `src/lib/roles.ts` (arrivée, navigation, périmètre) ;
  l'état vit dans `day1-role` (localStorage) avec la persona, qui reste « structure ». Le périmètre
  du DA passe par `scopedArtists({ daId })` et les agrégats d'`api.ts` acceptent une liste.
- **Fil** : `src/lib/userdata/feed-store.ts`, localStorage `day1-feed`, exemples posés une fois.
  Rien en base, aucun email (produit, plus tard).
- **`DEMO_TODAY` = `LATEST_DATE`** : un `npm run snapshot` avance « aujourd'hui » pour toute la démo.
  Relevé du matin : `npm run snapshot` (hors bac à sable : réseau), commit des relevés, puis
  redéploiement des DEUX projets depuis un worktree propre (`_deploy` lié par
  `from-day1-dashboard/.vercel/project.json`, `day1-universal` par `vercel link`).
- Les deux builds doivent passer : `npm run build` et
  `NEXT_PUBLIC_TENANT=universal NEXT_DIST_DIR=.next-universal npm run build`.

Vérifier :

    npx vitest run src/lib/__tests__/tenant.test.ts src/lib/__tests__/roles.test.ts src/lib/__tests__/nav.test.ts src/lib/demo/__tests__/roster-data.test.ts src/lib/demo/__tests__/scope.test.ts src/lib/userdata/__tests__/feed-store.test.ts
```

- [ ] **Step 5 : commit, nettoyage**

```bash
cd "/Users/cluzelgael/DAY 2/from-day1-dashboard-universal"
git add -- AGENTS.md
git commit -m "AGENTS.md : Universal v2 — deux maisons, deux projets Vercel, relevé du matin, retour arrière vers la démo du 25/09"
git worktree remove /tmp/day1-demo-deploy --force
git worktree prune
```

Compte rendu final : ce qui est MESURÉ (adresses lues dans le navigateur, chiffres du témoin de la Task 14, nombre de tests), ce qui est DÉDUIT, et les angles morts (ex. : ids YouTube non confirmés, auditeurs des compositeurs si le relevé n'a rien lu, chiffres de la démo figée vs `achat` qui diffèrent pour des raisons antérieures au chantier).

---

## Hors plan (déjà hors périmètre dans la spec)

Fil en base avec emails ; droits d'accès réels par rôle ; vrais prénoms des DA ; vue label du produit pour Universal ; nouveaux artistes dans la version produit ; webhook Stripe pour l'adresse `day1-universal`.
