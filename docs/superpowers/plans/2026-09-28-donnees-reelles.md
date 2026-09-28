# Données réelles — moteur de collecte, sources gratuites, 7 pages sans simulé

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (exécution en ligne, dans la session qui a écrit ce plan). Steps use checkbox (`- [ ]`) syntax.

**Goal :** ouvrir aux clients Pulse, Marché, Audience, Algo, A&R, Discovery et Day 1 Index avec
UNIQUEMENT des données réelles et sourcées — et une collecte automatique chaque nuit.

**Design validé par Gaël le 28/09/2026** (tableau des 7 pages) :

| Page | Version réelle | Source |
|---|---|---|
| Pulse | Ce qui a bougé : classements, TikTok, dernier relevé, fraîcheur des sources | tout ce qui suit |
| Audience | Pays (relevés), créateurs TikTok (liens collés), chiffres TikTok for Artists saisis | relevés + oEmbed + saisie |
| Algo | Rien d'inventé : page vide honnête tant que l'export Spotify for Artists n'est pas branché | (export S4A, plus tard) |
| Marché | Classements Apple Music, 10 pays, mouvements jour après jour, ton roster dedans | flux officiel Apple |
| A&R | Artistes qui entrent / montent dans ces classements (hors roster) + liste à suivre | Apple + saisie |
| Discovery | Rien d'inventé : page vide honnête tant que TikTok/YouTube connectés n'existent pas | (plus tard) |
| Day 1 Index | Note CALCULÉE sur les dimensions mesurées, formule affichée, comparaison dans le roster | relevés + registres |

**Mesures faites avant d'écrire ce plan (28/09 soir) :**
- Flux Apple `https://rss.marketingtools.apple.com/api/v2/{pays}/music/most-played/100/songs.json` :
  200 pour fr be ch ca us gb de ma ci sn (100 titres) MAIS instable (502/504/délais sur ~1 appel
  sur 3) → réessais obligatoires. Champs : id, name, artistName, artistId, url, genres, releaseDate.
  `feed.updated` = heure de génération, PAS la date du classement. Apple invite à « ajouter ces
  flux à votre site » (performance-partners.apple.com/tools).
- oEmbed TikTok `https://www.tiktok.com/oembed?url=…` : 200 sans clé ; faux id / autre site → 400 ;
  pas de vues ; miniature signée qui expire (~2 jours) ; le html contient le lien du son.
- TikTok for Artists : données « internal business analytics » ; tiers autorisé = prestataire qui
  traite pour l'artiste → saisies réservées à l'espace du client, jamais mutualisées.

**Architecture :** Vercel Cron (1×/nuit, 04:00 UTC) → `GET /api/cron/collect` protégé par
`CRON_SECRET` → collecteurs indépendants (`src/lib/collect/*`) → tables Supabase → journal
`collection_runs` (une ligne par source et par passage). Les pages lisent la base (RLS), jamais les
sources en direct. Un collecteur qui échoue n'empêche pas les autres.

**Tech :** Next.js 16 (route handler, server actions), Supabase (RLS `private.member_role`),
Vitest, navigateur intégré pour la vérification.

---

## Fichiers

- Create `supabase/migrations/20260929010000_collect.sql` — collection_runs, chart_entries,
  tiktok_videos, tiktok_stats, ar_watchlist (+ RLS).
- Create `src/lib/collect/fetch.ts` — `fetchWithRetry(url, {tries, timeoutMs, backoffMs})`.
- Create `src/lib/collect/run.ts` — `runCollectors(collectors, journal)` : journal start/fin, erreurs isolées.
- Create `src/lib/collect/apple-music.ts` — `APPLE_COUNTRIES`, `parseAppleChart(json, country, date)`, collecteur.
- Create `src/lib/collect/tiktok-refresh.ts` — collecteur : rafraîchit oEmbed des vidéos collées.
- Create `src/lib/collect/index.ts` — liste des collecteurs + journal Supabase.
- Create `src/app/api/cron/collect/route.ts` — point d'entrée protégé.
- Modify `src/proxy.ts` — `/api/cron` public (le secret est vérifié dans la route).
- Modify `vercel.json` — `crons`.
- Create `scripts/setup-cron-secret.sh`, `scripts/collect-now.sh`.
- Create `src/lib/tiktok/video.ts` — `parseTikTokUrl`, `parseOembed`, `fetchOembed`.
- Create `src/lib/tiktok/stats.ts` — `parseTikTokStats`, `latestStats`.
- Create `src/lib/market/charts.ts` — `normArtist`, `artistMatches`, `chartMovements`, `rosterInCharts`, `risers`.
- Create `src/lib/index/day1-index.ts` — `computeDay1Index`.
- Create `src/lib/collect/freshness.ts` — `sourceFreshness(runs)`.
- Modify `src/lib/accounts/customer.ts` — loaders `customerSignals` (charts, runs, tiktok, stats, watchlist).
- Modify `src/lib/customer-mode.tsx`, `src/app/(dashboard)/layout.tsx` — contexte « signaux ».
- Modify `src/lib/nav.ts`, `src/lib/userdata/use-modules.ts`, `src/messages/{fr,en}/nav.json` — section « Signaux ».
- Create `src/app/(dashboard)/audience/actions.ts`, `src/app/(dashboard)/ar-watch/actions.ts`.
- Create `src/components/modules/customer/customer-{pulse,market,audience,algo,ar,discovery,index}.tsx`, `source-freshness.tsx`.
- Modify les 7 `page.tsx` : `useCustomer() ? <CustomerX/> : <démo>`.
- Tests : `src/lib/collect/__tests__/*.test.ts`, `src/lib/tiktok/__tests__/*.test.ts`,
  `src/lib/market/__tests__/charts.test.ts`, `src/lib/index/__tests__/day1-index.test.ts`, `src/lib/__tests__/nav-customer.test.ts`.

## Tâches

### 1. Tables
- [ ] Écrire la migration (voir fichier) ; `bash scripts/db-migrate.sh` ; vérifier les tables.
- [ ] RLS dans une transaction ANNULÉE : un membre d'un autre espace ne lit AUCUNE ligne de
      tiktok_videos/tiktok_stats/ar_watchlist ; un authentifié lit chart_entries et collection_runs ;
      `authenticated` ne peut PAS écrire (insert refusé). Témoin : le propriétaire lit ses lignes.
- [ ] Commit.

### 2. Moteur
- [ ] Tests `fetchWithRetry` : 502 puis 200 → rend le 200 au 2e essai ; 3×502 → erreur qui cite le
      statut ; délai dépassé → réessaie. Tests `runCollectors` : A échoue, B passe → journal
      A=error (message), B=ok (rows) ; B tourne même si A lève.
- [ ] Implémenter ; tests verts ; commit.

### 3. Apple Music
- [ ] Fixture = 3 premières lignes du vrai flux FR du 28/09. Test `parseAppleChart` : positions 1..n
      dans l'ordre, champs mappés, genres sans « Musique/Music », date = date du passage (Paris).
- [ ] Collecteur : 10 pays, upsert `(source, chart, country, chart_date, position)` ; un pays en
      échec → détail « partial », les autres enregistrés.
- [ ] Commit.

### 4. Point d'entrée nocturne
- [ ] Route : sans en-tête → 401 (témoin), mauvais secret → 401, bon secret → JSON du passage.
- [ ] proxy : `/api/cron` public. vercel.json : `{"crons":[{"path":"/api/cron/collect","schedule":"0 4 * * *"}]}`.
- [ ] Scripts : secret généré localement (jamais affiché), passage manuel.
- [ ] MESURE : passage manuel en local → lignes dans chart_entries pour 10 pays + journal. Commit.

### 5. TikTok
- [ ] Fixture = vraie réponse oEmbed (@scout2015). Tests `parseTikTokUrl` : forme longue acceptée,
      `?lang=` retiré, vm.tiktok.com refusé avec message « ouvre le lien et copie l'adresse complète »,
      autre site refusé. `parseOembed` : créateur, pseudo, titre, son (titre + lien), miniature +
      expiration lue dans `x-expires`.
- [ ] Tests `parseTikTokStats` : date obligatoire, nombres à la française, au moins un chiffre.
      `latestStats` : dernier relevé et écart avec le précédent de MÊME portée (compte / titre).
- [ ] Actions serveur (ajout par lien → oEmbed → insert ; vues ; suppression ; saisie TikTok for
      Artists) via `editableWorkspace`. Collecteur de rafraîchissement (vidéo disparue → `gone`).
- [ ] Commit.

### 6. Marché, A&R
- [ ] Tests `artistMatches` : « Vacra & La Rvfleuze » contient « La Rvfleuze » ; « feat. », « x »,
      virgules ; accents/casse ignorés ; « Tiakola » ≠ « Tiakolaa ». `chartMovements` : nouveau,
      monte de n, descend de n, stable, et « pas d'historique » s'il n'y a pas de veille.
      `risers` : entrées et plus fortes montées, hors roster, dédupliquées par artiste.
- [ ] Commit.

### 7. Day 1 Index
- [ ] Tests (témoin calculé à la main dans le test) : taille (échelle log affichée : 10 k/mois=40,
      100 k=60, 1 M=80, 10 M=100), croissance (3 derniers mois vs 3 précédents : +20 % → 70),
      élan (dernier mois vs moyenne des 3 précédents), diversité (sources actives sur 12 mois parmi
      streaming, droits, concerts, sync ; /4). Dimension sans donnée → `null`, exclue de la
      moyenne, et la note dit « sur N dimensions mesurées ». Fidélité = null (pas de S4A).
- [ ] Commit.

### 8. Pages client
- [ ] Nav : section « Marché & signaux » (Pulse, Marché, Audience, Algo, Discovery, Day 1 Index ;
      A&R pour propriétaire/équipe). `isCustomerPath` ouvre ces pages ; aucune n'exige un relevé.
      Test de nav : artiste invité n'a pas A&R ; toutes les pages ouvertes au propriétaire.
- [ ] Layout : charge `customerSignals` sur ces chemins seulement.
- [ ] Composants (badge de provenance sur chaque bloc, fraîcheur de source, états vides qui disent
      QUOI brancher). Aucune import de `@/lib/demo` dans les composants client.
- [ ] Commit.

### 9. Vérification réelle
- [ ] AVANT (témoin) : client connecté sur /market → renvoyé ailleurs (page fermée).
- [ ] APRÈS : navigateur, compte `test.*@example.com` : Marché montre le classement FR du jour
      (comparé au flux brut) ; lien TikTok collé → créateur affiché ; saisie TikTok for Artists ;
      Day 1 Index = témoin Python ; Algo/Discovery sans aucun chiffre ; grep : aucun composant
      client n'importe la démo.
- [ ] Tests complets + build. Nettoyage des données de test. AGENTS.md + mémoire. Commit.
