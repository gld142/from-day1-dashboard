<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Invariants à ne pas défaire

Ce qui suit a été mesuré, corrigé, et verrouillé par des tests. Avant de toucher
au code concerné, lancer les tests nommés. S'ils passent au rouge, c'est la
modification qui est en cause, pas le test.

## /rights — l'écart se compte relevé par relevé, jamais sur l'agrégat

Dans `src/app/(dashboard)/rights/page.tsx`, bloc `facts` : `gapTotal` et
`gapCount` se calculent sur `statements` (les relevés à plat), **pas** sur `rows`
(l'agrégat par organisme × période).

Pourquoi : une case agrégée bascule en `gap-detected` dès qu'UN artiste y est
sous-versé, et son « attendu − reçu » embarque alors les résidus des artistes
normalement payés de la même case. Mesuré le 24/09/2026 sur le roster de démo :
**167 316 € au lieu de 160 002 €**, soit 7 314 € (4,6 %) qu'on ne peut réclamer à
personne. Le bon chiffre réconcilie à l'euro avec la ventilation par artiste
(118 324 + 41 672 + 6) et avec la part organismes de /audit, sur 11 relevés.

Le compteur du KPI compte donc des RELEVÉS, pas des périodes :
`rights.kpis.gapsHint` dit « sur # relevé(s) » / « across # statement(s) », la
même unité que `rights.byArtist.gapCount`. Ne pas y remettre « période » /
« period » — le montant et le compte décriraient deux choses différentes.

Vérifier :

    npx vitest run src/lib/demo/__tests__/rights.test.ts src/messages/__tests__/rights-gaps-hint.test.ts
    NEXT_DIST_DIR=.next-e2e npm run build
    E2E_SERVER=prod NEXT_DIST_DIR=.next-e2e npx playwright test e2e/rights-ecarts.spec.ts

`e2e/rights-ecarts.spec.ts` compare à l'euro, à l'écran : KPI = somme de la
ventilation = somme des pages zoomées = porte vers /audit. Témoin fait : avec
l'ancien calcul réinjecté, il échoue en nommant les deux chiffres.

## La suite e2e tourne sur le build de prod, pas en dev

Mesuré : en mode dev sur le port 3100, le WebSocket HMR est bloqué
(`allowedDevOrigins`) et /rights n'est JAMAIS hydratée — ni un clic, ni un
`reload`, ni `?persona=` n'y changent quoi que ce soit. Les specs lisent alors le
rendu serveur (persona par défaut, montants compactés) et mesurent autre chose
que ce qu'elles croient. Toujours passer par `E2E_SERVER=prod` avec un build
préalable dans `.next-e2e`, comme documenté dans `playwright.config.ts`.

## Comparer au dashboard EN LIGNE : refaire le témoin

**Ne pas supposer que `origin/main` est ce qui tourne.** Le 25/09/2026, la
production était `demo-universal@a1f74ab` (déployée le 18/09 à 11h51), pas
`main`. Le déploiement se fait au CLI depuis la branche courante, sans passer
par git. Toujours demander à Vercel ce qui est réellement en ligne :

    vercel ls                                  # le dernier déploiement Production
    vercel inspect <url>                        # sa date, ses alias
    # puis retrouver le commit par sa date : git log --since=... --until=...

Attention : le site répond 200 sur N'IMPORTE QUELLE adresse, y compris
inexistante. Un code HTTP ne prouve donc rien — lire le CONTENU.

Pour vérifier qu'une refonte n'enlève rien, servir l'ancienne version à côté
plutôt que lire des diffs :

    git worktree add /tmp/day1-prod origin/main
    cp -a node_modules /tmp/day1-prod/node_modules   # un lien symbolique casse Turbopack
    # puis une entrée launch.json sur le port 3003, retirée après usage

Le 24/09/2026, ce témoin a montré que tout ce qui avait disparu de /overview
existait ailleurs — sauf trois blocs, depuis remis : le graphique « Revenus ×
streams » (/revenue), le panneau « Brief du jour » (barre du haut) et la
« Répartition projetée par source » (/calculator). Les trois avaient la même
signature : composant supprimé, clés de traduction restées orphelines. Ne pas laisser l'entrée launch.json derrière
soi : le chemin `/tmp` n'est pas portable.

## La démo de présentation est FIGÉE — ne jamais déployer le produit par-dessus

Décidé avec Gaël le 28/09/2026 : la démo sert aux présentations et ne bouge plus.
- En ligne : https://deploy-one-tawny-59.vercel.app (mot de passe), projet Vercel
  `_deploy`, déploiement `dpl_9aWB8EN71TCNnVeAnd64XpnJhhWL` du 25/09/2026 17h42.
- Code : branche `demo` et étiquette `demo-2026-09-25` (commit c276112) sur GitHub.
- Le dossier `from-day1-dashboard` est lié à ce projet Vercel : un `vercel --prod`
  lancé depuis là REMPLACE la démo. Ne le faire que pour la démo elle-même.
- Le vrai produit (cette branche `achat` et la suite) se déploie dans un AUTRE
  projet Vercel, à créer au moment de la mise en ligne.
- Une adresse `*.vercel.app` ajoutée à la main tombe derrière la connexion Vercel
  (protection du compte) : essayé le 28/09, inutilisable pour une présentation.

Dans le produit, la démo est ÉTEINTE par défaut (décidé le 28/09 : « plus rien
de démo ou de simulé pour le client ») : tout visiteur non connecté va sur
/connexion, /acces et /welcome n'existent plus, le cookie de la porte n'ouvre
rien. `DEMO_MODE=on` (src/lib/demo-mode.ts) la rallume pour travailler dessus en
local ; les pages gardent leur branche démo derrière `useCustomer()`.
Vérifié le 28/09 : anonyme, ancien cookie de démo → /connexion ; client connecté
→ ses pages (jamais /valuation, /copilot… ; /pulse et les pages « Marché & signaux »
s'ouvrent depuis le 29/09 dans leur version réelle, voir plus bas) ; DEMO_MODE=on →
porte /acces de retour.

## Marché & signaux (29/09/2026) — collecte de la nuit et sources réelles

Pulse, Marché, Audience, Algo, A&R, Discovery et Day 1 Index sont ouverts aux clients
avec des données RÉELLES uniquement (aucun composant `customer-*` n'importe `@/lib/demo`).

- Collecte : Vercel Cron 04:00 UTC → `GET /api/cron/collect` (en-tête
  `Authorization: Bearer $CRON_SECRET`, sinon 401) → collecteurs `src/lib/collect/*` →
  journal `collection_runs`. En ligne : mettre `CRON_SECRET` dans le projet Vercel.
  Local : `bash scripts/setup-cron-secret.sh` puis `bash scripts/collect-now.sh`.
- Apple Music : flux officiel `rss.marketingtools.apple.com`, 10 pays, 100 titres.
  Mesuré instable (502/504 ~1 appel sur 3) → `fetchWithRetry`. Texte normalisé NFC
  (« Fille à Papa » arrive décomposé). La date du classement = jour du passage à Paris.
- TikTok : JAMAIS de robot qui lit les pages (CGU TikTok EEE art. 4.5). Les vidéos sont
  COLLÉES par l'équipe ; Day 1 lit la fiche oEmbed officielle (pas de vues : saisies).
  La miniature est une URL signée qui expire (~2 j) : relue chaque nuit, jamais figée.
- TikTok for Artists : chiffres recopiés, réservés à l'espace du client (CGU §5.c) —
  ne jamais les mutualiser (Day 1 Index, A&R, comparaisons entre clients).
- « Titres » ≠ « places » : un titre classé dans 3 pays = 1 titre, 3 places (mesuré :
  122 places pour 26 titres).
- JSX : SWC retire l'espace après `</b>` quand le texte qui suit va jusqu'au retour à
  la ligne (mesuré au DOM le 29/09) → écrire `</b>{" "}texte`.

Vérifier :

    npx vitest run src/lib/collect src/lib/tiktok src/lib/market src/lib/index src/lib/__tests__/nav-customer.test.ts

## Relevés, taux et KPI (29/09/2026) — ce qui a été mesuré faux, et verrouillé

- **Change** : plus de taux fixe deviné. L'import convertit chaque ligne au taux BCE du mois
  de vente (`fx_monthly`, collecte « ecb_fx », `/api/fx`). Mesuré : l'ancien défaut 0,92 €/$
  gonflait un relevé DistroKid d'août 2026 d'environ 6 %. Mention « source : BCE, taux
  inversés » obligatoire (conditions de réutilisation de la BCE).
- **Pays** : jamais `slice(0, 2)`. `toIso2` (table CLDR `iso3.ts` + noms fr/en via Intl).
  Mesuré : SEN devenait la Suède, AUT l'Australie, « Allemagne » l'Albanie.
- **Mois** : « Activity Period » / « Sale(s) Month » = mois d'écoute, avant « Reporting ».
  Mesuré : « Sales Month » tombait sur le mois du relevé (2 mois de décalage).
- **Annulations** : quantités nettes, compteurs de streams ≤ 0 retirés, revenus mensuels signés
  acceptés. Mesuré : une annulation isolée ou un mois négatif faisait refuser TOUT le relevé.
- **Détail gardé** (relevés importés depuis le 29/09) : titre × mois (300 titres max), pays ×
  mois, ISRC, mois de vente → mois du relevé, streams Spotify 12 mois par titre, retenues.
- **KPI** : `src/lib/kpi/statement.ts` (relevé), `src/lib/kpi/business.ts` (registres × relevé),
  `src/lib/kpi/benchmarks.ts` (repères publics cités). Chaque KPI affiche sa formule ; non
  calculable = `null` + la raison, jamais 0.
- **Day 1 Index v2** : streams au jour, croissance sur un an dès 15 mois, échelle log symétrique
  (×1,5 = 100, ÷1,5 = 0), diversité = 1 − Herfindahl des montants. Wikipédia n'y entre PAS.
- **Attention Wikipédia** : Wikidata (personne à métier musical ou groupe — « Tiakola » renvoie
  aussi un village indien) puis Pageviews, User-Agent descriptif sans e-mail (403 sans UA).

Vérifier :

    npx vitest run src/lib/userdata src/lib/kpi src/lib/index src/lib/collect src/lib/attention

## Vue label (22-23/10/2026) — invariants

- **Qui voit quoi** : `viewFor(kind, role)` (`src/lib/accounts/view.ts`). C'est le TYPE D'ESPACE
  déclaré à l'achat (`workspaces.kind`) qui tranche, jamais le nombre d'artistes ; un artiste
  invité (rôle « artist ») est toujours en vue artiste. `CustomerRoleProvider` garde la persona
  `artist` ; la peau lit la vue du client (`skinForView`, `src/lib/skin.ts`).
- **Arrivée et changement d'artiste** : un label arrive sur `/roster` (`customerHome`). Rouvrir un
  artiste passe par `/espace/ouvrir/[id]?vers=` et `returnPath` juge le chemin RÉSOLU, pas le texte
  reçu : les points-segments encodés contournaient un contrôle naïf de `..` (mesuré). Le paramètre
  `perimetre` est retiré au passage.
- **Relevé fusionné** (`mergeStatements`, `src/lib/userdata/merge.ts`) : titres clés « Titre · Artiste »
  (homonymes « #1 », « #2 »). Un détail facultatif est OMIS dès qu'UN artiste en manque, et l'artiste
  est nommé (`missingDetail`) ; le témoin du « détail » = les cinq champs mois par mois.
  `totalRevenueEur` = somme des `revenueByMonth` fusionnés ; `scope.coverage` marque les mois partiels.
- **Chargement** : `customerLabelStatement` lit le DERNIER relevé de chaque artiste (`limit(1)`),
  jamais tout l'historique ; seulement en vue label, sur /revenue et /streams, et seulement avec
  `?perimetre=label` (le proxy transmet la query dans `x-d1-search`).
- **Navigation vers `?perimetre=label` ou vers un autre artiste = TOUJOURS une navigation complète**
  (`<a href>`, `window.location.assign`), jamais `<Link>` / `router.push` : le layout `(dashboard)`
  n'est pas re-rendu en navigation client (lu dans la source de Next 16,
  `walk-tree-with-flight-router-state.js`), le relevé label resterait `null`.
- **Streams en périmètre label** : pas de notes « titres / pays » (elles décrivent le détail des
  REVENUS) ; demi-vie et seuil Spotify « non calculables » quand les relevés couvrent des périodes
  ou des fenêtres différentes (un titre dont le relevé s'arrête tôt aurait l'air de tomber à zéro —
  mesuré sur une fixture).
- **Avatar de la barre du haut** (client réel) : construit depuis l'artiste OUVERT (initiales du nom,
  `rosterHue(rang)` = même teinte que le roster). `getArtist` retombe sur le premier artiste de démo
  (`ARTISTS[0]`) quand l'artiste n'a pas de relevé importé : ne jamais l'utiliser pour un client.

Vérifier :

    npx vitest run src/lib/accounts src/lib/userdata/__tests__/merge.test.ts src/lib/userdata/__tests__/roster.test.ts src/lib/__tests__/nav-customer.test.ts src/lib/__tests__/skin.test.ts src/components/modules/customer/__tests__/shared-label.test.ts

Vérification en navigateur : les scripts de seed et de nettoyage vivent dans
`.superpowers/qa/seed-label.mjs` et `clean-label.mjs` (dossier ignoré par git : ils n'existent que
dans ce worktree ; leur contenu est recopié dans le plan, Task 13 Step 2). Les chiffres attendus sont
dans le plan, Task 13 Step 4 (déduits du seed). Le 23/10/2026, l'hôte Supabase
`tzjgcyqlxbczeoeqgolh.supabase.co` ne se résolvait pas (NXDOMAIN depuis le Mac, le reste d'Internet
répondant) : la mesure avant/après dans le navigateur reste À FAIRE, aucun chiffre de ce paragraphe
n'a donc été lu à l'écran.
