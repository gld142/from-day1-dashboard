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
