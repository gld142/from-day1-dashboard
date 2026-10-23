# Vue label — vérification mesurée en navigateur (23/10/2026)

Espace de test « Label Nord (test) », type `label`, propriétaire `test.label@example.com`, deux
artistes avec un relevé chacun (Dadju : avr. → sept. 2026 ; Kiko : juin → sept. 2026), créé par
`.superpowers/qa/seed-label.mjs` (hors git), supprimé ensuite par `clean-label.mjs`. Même session
(cookies partagés sur localhost) sur deux serveurs : **témoin** = ancien code `e468871` (port
3003, worktree `/tmp/day1-avant`), **après** = branche `achat` à `4e1f2b9` (port 3004).

Tout ce qui suit est **lu à l'écran** (texte de page, `data-skin`, menu, barre du haut), sauf
mention « déduit ».

## Témoin AVANT (e468871)

| Point | Mesuré |
|---|---|
| Arrivée d'un label | `/mon-releve` de Dadju, titre « Dadju (test) » |
| Skin | `artist` |
| Menu | Mon relevé, Roster, Catalogue, Pulse… |
| Barre du haut | bloc fixe « Dadju (test) · Mon espace », pas de menu d'artistes |
| /revenue | un seul artiste, pas de sélecteur |
| Septembre 2026 | Dadju 17 500 streams, 28 € ; Kiko 3 750 streams, 6 € |
| Période entière | Dadju 88 750 streams, 142 € ; Kiko 11 875 streams, 19 € |

## APRÈS (4e1f2b9)

| Point | Attendu (déduit du seed) | Mesuré |
|---|---|---|
| Arrivée d'un label | `/roster` | `/roster` |
| Bloc « Le label ce mois-ci » | 34 €, 21 250 streams, 2 sur 2, +9,7 % vs août | « 34 € · revenus déclarés, 2 artistes couverts · +9,7 % vs août 26 », « 21,3 k », « 2 sur 2 », 0 retard, 0 alerte |
| Skin | `structure` | `structure` |
| Menu | Roster, Relevé de Dadju (test), Catalogue | idem |
| Barre du haut | menu d'artistes | « Changer d'artiste : Dadju (test) » + chevron ; items `/espace/ouvrir/<id>?vers=/revenue?perimetre=label` |
| Menu → Kiko depuis `/revenue?perimetre=label` | `/revenue` sur Kiko, périmètre retiré | `/revenue`, « Kiko (test) · Relevé DistroKid · juin 26 → sept. 26 », skin `structure` |
| `/revenue?perimetre=label` | 161 € ; avril et mai partiels ; titres « Titre · Artiste » | « Tout le label · 2 artistes, 2 relevés · avr. 26 → sept. 26 », 161 €, note « avr. 26, mai 26 : 1 artiste sur 2 (le relevé de Kiko (test) couvre juin 26 → sept. 26) », « Dadju Hit · Dadju (test) », « Intro · Dadju (test) », « Intro · Kiko (test) » distincts, sélecteur Tout le label / Dadju / Kiko |
| `/streams?perimetre=label` | 100 625 streams | « 100,6 k », même note de couverture, « Les titres du label les plus écoutés » |
| `/espace` → type Artiste → ouvrir Dadju | `/mon-releve`, skin `artist`, pas de bloc label sur /roster | idem ; menu d'artistes conservé (2 artistes) |
| `/espace` → type Label | retour `/roster`, bloc présent | idem |
| Artiste invité (Kiko, via lien d'invitation) | ni Roster ni A&R, barre fixe, skin `artist`, `?perimetre=label` ignoré | menu sans Roster/A&R, « K( Kiko (test) · Mon espace », skin `artist`, `/revenue?perimetre=label` → Kiko seul (19 €, pas de sélecteur), `/roster` → `/mon-releve` |

## Deux défauts trouvés par la mesure

1. **Corrigé (4e1f2b9)** — formulaire « Type d'espace » : après l'enregistrement, l'état React
   portait la nouvelle valeur mais le `<select>` affichait l'ancienne (React 19 réinitialise le
   formulaire après l'action et ramène le `<select>` contrôlé à l'option du HTML initial ;
   console instrumentée : `kind=publisher, value=publisher`, DOM `management`). Un `key={kind}`
   seul ramenait à la première option. Forme retenue : `<select defaultValue>` dans un
   sous-composant keyé par le type. Mesuré après correctif, dans les deux sens : champ = valeur
   enregistrée, « Enregistré. », bouton inactif, persistance au rechargement.
2. **Préexistant, hors vue label, non corrigé** — navigation latérale en navigation client :
   depuis `/roster`, clic Contrats puis Splits (liens de la sidebar) : les pages se rendent, mais
   Splits affiche « 0 titre des relevés sans split » alors qu'un chargement complet de `/splits`
   en affiche **4**. Cause (déduite de la source de Next 16 en relecture, cohérente avec la
   mesure) : le layout `(dashboard)` charge les données par chemin et n'est pas re-rendu sur une
   navigation client. Touche toutes les pages dont les données viennent du layout (contrats,
   splits, droits, finances…) dès qu'on y arrive par la sidebar. À traiter dans un chantier à
   part (charger par page, ou forcer le re-rendu du layout).

## Non vérifié

- Rendu mobile et impression des nouveaux éléments (sélecteur, bloc du mois).
- Un label de plus de deux artistes, des relevés en devises différentes, des homonymes.
- Le relevé virtuel avec le détail mois par mois (le seed n'en a pas : la ligne « Délai de
  paiement » affiche bien « Dadju (test), Kiko (test) : relevé importé avant le détail mois par
  mois »).
