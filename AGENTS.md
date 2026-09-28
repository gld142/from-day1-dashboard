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
→ ses pages (jamais /pulse, /valuation…) ; DEMO_MODE=on → porte /acces de retour.

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
