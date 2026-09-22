# Refonte de Pulse — design validé

Date : 22 septembre 2026 · Branche : `demo-universal` · Validé par Gaël en séance
Maquettes de référence : `.superpowers/brainstorm/37174-1790080838/content/17-pulse-final.html` (non versionné)

## 1. Pourquoi

Le dashboard s'est construit par accumulation : 29 pages, chacune avec ses cartes, ses badges
et ses libellés. Sur Pulse, la conséquence mesurée au 18/09 : 6 tuiles KPI encadrées de force
égale, 9 badges, deux blocs de tableaux, 6 cartes d'insights — **tout au même niveau, aucune
hiérarchie**. Gaël : « l'information mal classée ou mal espacée, l'utilisateur a besoin de
toutes ces infos mais peut se perdre sur tout le flux ».

Objectif : que Pulse se lise d'un coup, sans fatiguer, et que chaque chiffre se range dans une
famille identifiable à sa couleur.

## 2. Le système visuel

Il s'applique à Pulse d'abord, puis à toutes les pages (spec séparé).

**Base** — le blanc du site vitrine : fond `#FAFAFE`, encre `#15141F`, Instrument Sans.
Continuité directe avec from-day1.com.

**Papiers teintés — la couleur code la famille, pas la décoration.**

| Famille | Fond | Encre | Filet |
|---|---|---|---|
| Streams | `#EFEAFB` lavande | `#4B3F7A` | `#6B41D2` |
| Argent | `#FBF4E4` ivoire | `#7F560A` | `#B8811A` |
| Audience | `#E8F5EE` menthe | `#1B6F53` | `#2B9A76` |
| Tendances | `#FBEDF0` rosé | `#8A3A4C` | `#C9536B` |

Pas de dégradé décoratif, pas de halo, pas de blob. Un chiffre se reconnaît à la couleur de sa
feuille, sur toutes les pages.

**Provenance** — plus de badge encadré. Une pastille de 6 px + le mot, en capitales fines :
mesuré (vert `#2B9A76`), estimé (or `#B8811A`), simulé (gris `#9B99B5`). Légende en pied de page.

**Deux gabarits.**
- **H — pour Pulse** : le chiffre clé **centré**, ses points affiliés dessous, séparés par un
  filet de la couleur de la famille. Un point est affilié parce qu'il est *dans la feuille, sous
  le filet*.
- **I — pour les autres pages** : le chiffre clé à gauche, ses lignes attachées à droite, chacune
  préfixée d'un tiret de la couleur de la famille.

**Rédaction** — zéro jargon d'indicateur. On écrit le fait et sa cause, pas le nom de la métrique.
Dans les textes, **les chiffres et noms propres en encre pleine**, les urgences en rouge
`#B4453B`, le reste en gris : l'œil accroche la valeur avant de lire la phrase.

| Avant | Après |
|---|---|
| Momentum 7 jours : −5,6 % vs la semaine précédente | Ta semaine — Tu as fait **5,6 % de streams en moins** que la semaine dernière. **Spotify** recule, Deezer et Apple tiennent. |
| Top mover | Qui accélère |
| Titre moteur | Titre en tête |
| TikTok · signal | Vidéos qui utilisent tes sons |
| Impact J+14 | Streams gagnés en 14 jours |

**Menu** — plus de pastilles « NOUVEAU », plus de « IA » dans les libellés (« Audit royalties »,
« Copilot »).

## 3. Pulse — vue artiste

Un seul écran, dans cet ordre.

1. **En-tête** — « Bonjour {prénom} », date, heure du relevé, pastille live, « prochain demain
   09:00 » en mono. À droite : **la barre de question** (Ask), remontée du panneau « Brief du
   jour ».
2. **Feuille lavande — le héros (variante V2 validée)** : un vrai graphique pleine feuille — axe
   des valeurs (0 / 2 M / 3 M / 4 M), grille horizontale, repères de temps (21 juin / juillet /
   août / hier), pic annoté, point d'hier marqué, aire remplie, **sélecteur de période 7 j / 30 j
   / 90 j / 12 mois**. Le chiffre du jour est posé **au centre géométrique** dans une réserve
   claire `rgba(239,234,251,.94)`. Sous le filet, 4 points affiliés : 7 jours · 30 jours · titre
   en tête · plateforme en tête.
3. **Trois feuilles** :
   - **Argent (ivoire)** — gains d'hier + fourchette, tableau 7 j / 30 j / 12 mois × brut master /
     ta part / droits d'auteur, puis revenus du mois en cours, projection fin de mois, puis la
     cascade « ce qui te reste » (§ 5).
   - **Audience (menthe)** — auditeurs mensuels, Day 1 Index, vidéos qui utilisent tes sons,
     nouveaux auditeurs ce mois, 1ʳᵉ ville d'écoute.
   - **Tendances (rosé)** — rang TikTok en chiffre clé, rangs Spotify / YouTube / Apple · Deezer ·
     Instagram, streams gagnés en 14 jours.
4. **Bande de la nuit, 4 colonnes** — Ta semaine · D'où vient la poussée · Prochaine date · À faire
   aujourd'hui.
5. **Bande d'import** (une seule, § 5).
6. **De l'argent à aller chercher** (§ 5).
7. **Aller plus loin** — les portes (§ 4).
8. **Le reste de ton dashboard** — une ligne (§ 4).
9. Pied : légende de provenance.

## 4. Les portes d'entrée

Règle : **toute feature qui a sa propre page n'est jamais développée sur Pulse.** Elle y apparaît
sur une ligne — libellé + son chiffre de base + une flèche.

Deux niveaux :
- **Aller plus loin** (6 lignes, chiffre en gras, urgences en rouge) : part du marché FR · Splits ·
  Contrats · Day 1 Index · Dépenses & P&L · URSSAF pour l'artiste ; part du marché · valorisation ·
  droits FR · contrats · A&R Watch pour la structure.
- **Le reste de ton dashboard** (une ligne en 11,5 px, gris) : Fans · Catalogue · Tournée ·
  Discovery Lab · Audience · Simulateur. Un chiffre chacun. Rien n'est caché, rien ne bombarde.

## 5. Les trois ajouts validés

**a) La cascade « ce qui te reste », dans la feuille argent.**
Le brut seul est trompeur : l'artiste lit « 2 639 € » et croit que c'est pour lui.

- *Artiste en contrat d'artiste* (`dealType: "artiste"`) : ta part → **− reste à recouper sur
  l'avance** (les coûts sont avancés par le producteur et récupérés sur les redevances ;
  `CONTRACTS.advance` et `recoupedPct` existent déjà) → **− cotisations artiste-auteur** →
  ce qui te reste.
- *Artiste indépendant* (`dealType: "indé"`) : la ligne de recoupement devient de vraies dépenses.
- *Structure* : **− dépenses du mois** (avances, promo, studio) → résultat du mois. Les dépenses
  vivent côté label, pas côté artiste.

> **Correction de fond.** Les cotisations du régime des artistes-auteurs portent sur les **revenus
> d'auteur** (SACEM, édition, sync) — pas sur la part master. L'app fait déjà juste
> (`urssaf/page.tsx:46` : `AUTHOR_SOURCES = new Set(["sacem", "sync"])`) ; ne pas régresser.
> Les redevances d'artiste-interprète relèvent de l'art. L7121-8 C. trav., les cachets de scène du
> régime salarié via l'employeur. **URSSAF = artiste uniquement.**
> *À confirmer avant d'afficher des montants fermes : le taux global retenu et le traitement des
> droits voisins ADAMI/SPEDIDAM.*

**b) « De l'argent à aller chercher »** — une bande avant les portes, le seul bloc orienté
« gagner » : écart avec les relevés Spotify (sort des portes, c'est l'argument n° 1) · briefs de
synchro correspondant au catalogue, **avec leur date de fermeture en rouge** · SACEM estimé non
versé.

**c) Une seule bande d'import**, en bas — le bandeau de calibration du haut est supprimé
(doublon visuel) : « **Deux fichiers rendraient ces chiffres exacts.** Ton **relevé distributeur**
calibre les euros et rend l'écart d'audit exact. Ton **contrat** remplace l'hypothèse de 20 % par
ta vraie part. Les deux restent sur ton appareil. » Trois actions : Importer mon relevé · Importer
mon contrat · Demander à mon label.

## 6. Pulse — vue structure

Même squelette, **héros différent** : la courbe agrégée d'un roster ne dit rien (elle est écrasée
par l'artiste qui pèse 62 % des revenus). Donc gabarit I :

- **À gauche** : streams du roster hier, centré, avec sa courbe 90 jours en réduction discrète
  (opacité .5) et « voir le détail → ».
- **À droite** : **« Qui bouge · 30 derniers jours »** — les 6 artistes **triés par variation**,
  chacun avec nom / micro-courbe verte ou rouge / streams 30 j / delta. Cliquable (remplace
  `TopMovers`).
- Points affiliés : 7 jours · 30 jours · **Dadju · 62 %** (d'où vient l'argent) · plateforme en tête.
- Feuilles : le roster rapporte (brut / net après dépenses / valorisation + résultat du mois) ·
  audience du roster · position algo (titres du roster dans le Top 200).
- Bande : Qui accélère · D'où vient la poussée · Prochaine date · À faire aujourd'hui.
- Bande contrats : « 4 contrats sur 6 non renseignés ».

## 7. Ce qui disparaît

- **Le panneau « Brief du jour »** (`components/dashboard/daily-brief.tsx`, monté uniquement dans
  `topbar.tsx`) : c'était un second Pulse caché derrière un bouton. Tout son contenu est désormais
  sur Pulse. `AskBar` — qui n'était utilisée nulle part ailleurs — remonte en en-tête de Pulse.
- Les 6 cartes `InsightCard` → une bande de 4 colonnes en texte.
- Les 6 `KpiCard` encadrées → le héros + les points affiliés + les feuilles.
- Les badges de provenance encadrés → pastille + mot.

## 8. Contraintes mesurées

- Vue artiste **1 430 px**, vue structure **1 259 px** (maquette, 1440 px de large).
- Sur un écran 900 px : tout est visible jusqu'à la bande de la nuit. L'import, l'argent à aller
  chercher et les portes demandent un scroll. **Arbitrage retenu** : ce qui change chaque matin est
  au-dessus de la ligne de flottaison ; les destinations sont en dessous.
- Aucun repli, aucun accordéon sur Pulse — décision de Gaël : « c'est un pulse, tout doit être vu ».

## 9. Angles morts

- **Les comptes TikTok nommés sont inventés.** La case « D'où vient la poussée » affiche trois @
  cliquables pour que l'artiste aille commenter (un commentaire relance la diffusion de la vidéo,
  qui ramène des ajouts Spotify — boucle voulue par Gaël). Mais : Soundcharts ne donne qu'un
  *nombre* de vidéos, et la page publique d'un son TikTok est une coquille anti-bot (mesuré le
  17/09). La case reste badgée *simulé* tant que la source n'existe pas. À instruire : API TikTok
  Research/Display, ou un fournisseur avec endpoint « top videos ».
- Les taux de cotisation et le traitement ADAMI/SPEDIDAM (§ 5) ne sont pas vérifiés.
- Le design des 28 autres pages n'est pas couvert par ce spec — seul le gabarit I est posé.
- Le nom du produit reste incohérent (l'app dit « From Day 1 · Dashboard 360° », le site « Day 1
  Pro », les maquettes « Day 1 Pro ») — décision non prise.

## 10. Hors périmètre

Le P&L structure (saisie SACEM / live / merch / dépenses), le Copilot sur un vrai LLM, le roster
fictif pour les surfaces publiques, l'auth et les connexions API : chantiers distincts, chacun son
spec.
