# Audit visuel pré-démo — 2026-09-17

Démo Universal : **vendredi 19 septembre 2026**.
Point de départ : branche `demo-universal`, commit `d628a65`. Corrections : `e47c71b` → `efda472` (10 commits, détail en bas).
Build de prod servi localement (le dev server meurt après de longues sessions HMR ; le prod est la référence).

## Commandes

```bash
# build de prod dans un distDir dédié, serveur sur :3100
NEXT_DIST_DIR=.next-e2e npm run build
NEXT_DIST_DIR=.next-e2e npx next start -p 3100 &

# audit : 105 captures (30 routes × 3 thèmes en vue structure, + 5 pages du
# parcours en persona artiste) + parcours de démo cliqué (3 thèmes × desktop
# 1440×900 + mobile 390×844) + Pulse à 1280 px + spot-check EN
E2E_SERVER=prod npx playwright test            # 116 passed (3.8 min)

npm test            # 238 passed (236 + 2 : miroir des clés revenue.shares.label)
npx tsc --noEmit    # OK
npm run lint        # 9 erreurs pré-existantes (react-hooks), 0 nouvelle ; .next-e2e désormais ignoré
NEXT_DIST_DIR=.next-e2e npm run build   # OK
```

Captures dans `e2e/screenshots/` (ignoré par git et par Vercel ; à régénérer avec la commande ci-dessus).

## Ce que vérifie le harnais (mesuré, pas déduit)

À chaque page / étape : aucune erreur console ni exception (`pageerror`), aucun `MISSING_MESSAGE` next-intl, `scrollWidth ≤ clientWidth` (pas de défilement horizontal de la page), aucun nœud texte visible contenant `NaN`, `undefined`, `[object`, ni clé i18n brute (`^[a-z]+\.[a-zA-Z.]+$`). Le parcours de démo clique vraiment : CTA du welcome, Dadju dans les top movers, onglets de période sur Revenus, les trois onglets du panneau « part », bascule de persona dans la topbar, ligne Kiko du roster. Le persona de départ est « artiste » pour prouver que le CTA impose « structure » lui-même.

Artefact de capture corrigé dans le harnais (pas un défaut produit) : les barres Recharts ne se montent qu'une fois visibles à l'écran ; un screenshot fullPage sans défilement préalable montrait le « P&L par artiste » du roster avec des axes vides. Vérifié : après défilement, les barres sont là (hauteurs 160 / 60 / 72 / 87 px…). Le harnais fait défiler toute la page avant chaque capture.

## Pages × thèmes × viewport

Légende : OK = aucune assertion en échec et rien à signaler à l'œil ; les numéros renvoient à la table des défauts.

### Parcours de démo (desktop 1440×900 et mobile 390×844, nuit / aube / jour)

| # | Étape | Nuit | Aube | Jour | Mobile (3 thèmes) |
|---|---|---|---|---|---|
| 1 | `/welcome?source=universal` | OK | OK | OK | OK (URL de la fausse barre tronquée proprement) |
| 2 | CTA → `/roster` (structure) | ① P&L vide = artefact | ① | ① | ② topbar 466 px |
| 3 | `/pulse` roster | ③ badges sidebar | ③ | ③ | ② |
| 4 | clic Dadju → `/pulse` Dadju | ③ ⑨ TikTok « tes sons » | ③ ⑨ | ③ ⑨ | OK |
| 5 | `/streams` Dadju | ③ | ③ | ③ | ④ en-tête 431 px |
| 6 | `/revenue?period=day` (tuile « Hier » cernée) | ③ ⑧ « Ta part » en vue structure | ③ ⑧ | ③ ⑧ | ⑤ grille 456 px, ⑥ onglets superposés |
| 6b | onglet « 30 jours » (URL `?period=month`, tuile cernée) | OK | OK | OK | ⑤ |
| 6c | panneau part : onglets import / courrier | ⑧ | ⑧ | ⑧ | ⑤ ⑥ |
| 7 | `/audit` Dadju | ③ | ③ | ③ | OK |
| 8 | bascule artiste → `/pulse` artiste Dadju | ③ | ③ | ③ | OK |
| 8b | `/revenue` artiste (ajouté après ⑩) | OK | OK | OK | OK |
| 9 | retour structure → `/roster` → clic Kiko → `/pulse` Kiko | ③ | ③ | ③ | OK |
| 10 | `/onboardings` | ③ ⑪ « Un… », date 18/09 | ③ ⑪ | ③ ⑪ | ⑦ colonnes 417 px |
| 11 | `/welcome?source=believe` | OK | OK | OK | OK |

Contrôles ponctuels : Pulse à **1280×800** (label zoomé et artiste) → ⑫ ; EN sur `/revenue` (structure zoomée, artiste) et `/welcome?source=universal` → OK, `html[lang=en]`, parité des clés vérifiée par test unitaire.

### Audit des 30 routes × 3 thèmes (vue structure) + 5 routes en persona artiste — desktop 1440×900

105 / 105 sans erreur console, sans débordement, sans texte suspect, dans les 3 thèmes. Revue à l'œil des pages du parcours dans les 3 thèmes (badges de provenance lisibles en nuit / aube / jour ; anneau de la tuile cernée visible en jour — violet pâle — et en aube — orange). Les 23 autres routes ont été parcourues en vignettes sans défaut relevé au-delà de ③ (sidebar, partout).

## Défauts

| # | Page · thème · viewport | Défaut | Gravité | Sort |
|---|---|---|---|---|
| ③ | Toutes les pages du dashboard · 3 thèmes · desktop | Badges « NOUVEAU / BIENTÔT / BÊTA » de la sidebar rognés (« NOUVEA », « BIENTÔ », « BÊT ») : le viewport Radix ScrollArea (`display: table`) s'élargit au texte non tronqué | gênant (à l'écran pendant toute la démo) | **corrigé** `5ff231d` — libellés tronqués avec `title`, badges entiers |
| ⑧ | `/revenue` · structure zoomée sur Dadju · 3 thèmes | Panneau « Ta part, c'est ton contrat », « tes streams », « ta part est simulée » lu par un label | gênant (copie, étape 6 de la démo) | **corrigé** `f53a10a` — `revenue.shares.label.*` fr/en : « Sa part, c'est son contrat », « la part de Dadju est simulée (20 %) », « Dadju est auteur et/ou compositeur »… + test de miroir des clés |
| ⑨ | `/pulse` · structure zoomée · 3 thèmes | Carte TikTok « vidéos utilisent tes sons » en vue structure | cosmétique (copie) | **corrigé** `f53a10a` — « les sons de Dadju » (`overnight.tiktokLabel`) |
| ⑩ | `/revenue` · structure zoomée | Sous-titre « Tous tes revenus » + insights « de tes revenus » en vue structure | cosmétique (copie) | **corrigé** `f53a10a` + `efda472` — « Tous les revenus de Dadju » en structure seulement (ma première version l'appliquait aussi à l'artiste : régression vue en relisant les captures, corrigée et couverte par le parcours) ; insights neutres (« des revenus ») |
| ⑪ | `/onboardings` · 3 thèmes · 1440 | Cartes Universal et Believe : nom tronqué « Un… » / « Be… » par le badge « Priorité absolue » ; prochaine action « Présentation du 18/09 » | gênant (carte montrée à Universal) | **corrigé** `a84f232` — badge sur la ligne du tag (« Major · Priorité absolue »), date 19/09 (message fr/en + échéance) |
| ⑫ | `/pulse` · zoomé · 1280–1440 px | Rangée de 7 KPIs : « 113,9 k € » (128 px en 24 px) déborde de sa tuile (94 px à 1280, 106 à 1366, mord le padding à 1440) | gênant à 1280/1366, cosmétique à 1440 | **corrigé** `905d3e4` — container query sur la carte : 20 px sous 128 px de content-box, 18 px sous 108, 16 px sous 96 ; mesuré après : 16 / 18 / 20 / 24 px à 1280 / 1366 / 1440 / 1536, zéro dépassement |
| ② | Topbar · mobile 390 · vue structure | « Day 1 Dashboard Pro » + thème + langue : page à 466 px | gênant (mobile) | **corrigé** `701a6aa` — seul le sélecteur d'identité se compresse (nom tronqué « Day 1… ») |
| ④ | `/streams` · mobile | Badge artiste + onglets de période sur une ligne : 431 px | gênant (mobile) | **corrigé** `701a6aa` — les actions du PageHeader passent à la ligne |
| ⑤ | `/revenue` · mobile | Grille donut / liste par source : 456 px (`min-width: auto` des cellules de grille) | gênant (mobile) | **corrigé** `701a6aa` — `min-w-0` |
| ⑥ | `/revenue` panneau part · mobile | Onglets repliés recouvrant le champ « Part artiste sur le master » (`h-8` de la variante horizontale primait sur `h-auto`) | **bloquant sur mobile** (formulaire illisible) | **corrigé** `a35d6b2` |
| ⑦ | `/onboardings` · mobile | Colonnes du kanban : 417 px | gênant (mobile) | **corrigé** `701a6aa` — `min-w-0` |
| ① | `/roster` · captures fullPage | « P&L par artiste » sans barres | artefact de capture | harnais : défilement avant capture (`e47c71b`) |
| — | Partout (police `num`) | L'espace fine insécable de `Intl.NumberFormat` fr est rendue pleine chasse en mono : « 187 291  € », « (20  %) » | cosmétique | **laissé** — choix de police, touche tous les chiffres ; à traiter globalement (remplacer U+202F par U+00A0 dans `fmtEur`/`num`) hors fenêtre de démo |
| — | `/pulse` · 1440 | Libellés « Streams · 7 jours », « Gains estimés · 7 jours » sur deux lignes à cause du chip delta / badge : lignes de base des chiffres décalées entre tuiles | cosmétique | **laissé** — contrainte de la rangée à 7 tuiles ; une refonte du KpiCard (badge sous le libellé) n'est pas un « petit diff » |
| — | `/onboardings`, roster | Rien à signaler sur la table roster à 3 artistes, la carte TikTok, les cartes d'écart de l'audit, le tableau « Par plateforme » (défile dans son conteneur à 390 px, la page ne bouge pas) | — | — |

Jugements (pas des mesures) : les gravités ci-dessus sont mon avis ; « bloquant » est réservé à ce qui rend une étape inutilisable, « gênant » à ce qu'un spectateur remarque, « cosmétique » à ce qu'il faut chercher.

## Observations hors périmètre visuel (données), à assumer en salle

- La puce de date de Pulse affiche **mercredi 16 septembre** : c'est le dernier jour de snapshot (`LATEST_DATE`), pas la date du jour. Après le `npm run snapshot` du 19 au matin elle dira 18 septembre.
- Le premier insight de `/welcome?source=believe` (persona artiste) cite l'écart **du roster entier** (187 291 €) avec une phrase à la 2e personne (« tes derniers relevés ») — cohérent pour Universal, discutable pour Believe. Non corrigé (choix de contenu).
- Kiko : « Prochaine date : Ancienne Belgique, Bruxelles — 1 116 / 2 000 billets » pour un artiste à 24 k auditeurs, même salle que Dadju. Donnée simulée ; ne pas s'y attarder.

## Captures à regarder (après correctifs)

- `e2e/screenshots/demo-desktop-night-06-revenue-day.png` — Revenus en structure zoomée : tuile « Hier » cernée, « Sa part, c'est son contrat », tableau par plateforme.
- `e2e/screenshots/demo-desktop-night-02-roster-label.png` — roster 3 artistes, sidebar avec badges entiers, P&L avec ses barres.
- `e2e/screenshots/demo-desktop-day-13-pulse-kiko.png` — thème jour : badges MESURÉ / ESTIMÉ / SIMULÉ lisibles, anneau du héros.
- `e2e/screenshots/pulse-1280-label-dadju.png` — la rangée de 7 KPIs à 1280 px sans dépassement.
- `e2e/screenshots/demo-mobile-night-06-revenue-day.png` — mobile : onglets du panneau part empilés, tableau qui défile dans sa carte.
- `e2e/screenshots/demo-desktop-night-14-onboardings.png` — carte Universal Music France entière, « Présentation du 19/09 ».

## Commits

| SHA | Objet |
|---|---|
| `e47c71b` | test(e2e): parcours de démo — personas, thèmes, mobile, assertions d'intégrité |
| `5ff231d` | fix(ui): sidebar — les badges Nouveau / Bientôt / Bêta ne sont plus rognés |
| `701a6aa` | fix(ui): mobile 390 px — plus de débordement horizontal sur la topbar, Streams, Revenus, Onboardings |
| `a35d6b2` | fix(ui): panneau « part » — les onglets empilés sur mobile ne recouvrent plus le formulaire |
| `a84f232` | fix(ui): onboardings — nom du partenaire lisible à côté du badge Priorité, démo Universal datée du 19/09 |
| `905d3e4` | fix(ui): Pulse — le chiffre des KPIs se réduit avec la tuile (7 colonnes entre 1280 et 1536 px) |
| `f53a10a` | fix(i18n): vue structure — « Sa part, c'est son contrat », TikTok et sous-titre Revenus à la 3e personne |
| `1afbfc7` | test(e2e): le parcours vérifie le panneau « part » en vue structure |
| `763235a` | chore(lint): ignorer .next-e2e (build de prod de la QA) |
| `efda472` | fix(i18n): Revenus — le sous-titre à la 3e personne ne s'applique qu'en vue structure |

## Angles morts (ce que je n'ai pas vérifié, et pourquoi)

- **La prod Vercel** : tout est mesuré sur un build local de `demo-universal`. Rien ne dit que le déploiement du 19 aura les mêmes captures — refaire `E2E_BASE_URL=https://… E2E_SERVER=prod npx playwright test e2e/demo-path.spec.ts` contre la prod après le redeploy (le `webServer` est réutilisé ; avec une URL distante, lancer un `next start` local factice ou passer `reuseExistingServer`).
- **Safari / Firefox** : Chromium seulement (projet Playwright unique). Les container queries et `@max-[…]` sont supportées par Safari ≥ 16 ; non mesuré ici.
- **Les 23 routes hors parcours** ont été vues en vignettes, pas à la loupe ; les assertions automatiques y sont vertes.
- **Le survol et les tooltips** (badges de provenance) ne sont pas capturés ; le tooltip de chart visible sur certaines premières captures venait de la position de la souris après un clic, pas d'un défaut.
- **Le dev server** (`npm run dev`) n'a pas été testé après les changements de `playwright.config.ts` — le mode par défaut reste `npm run dev`, non exercé dans cette session.
- **La persistance réelle du persona** entre onglets / rechargements a été exercée par le parcours (CTA puis `goto`), pas la lecture de `?persona=` après un partage de lien depuis un autre navigateur.
