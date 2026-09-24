# Parcours de démo — roster Universal

**Chiffres relevés le 24 septembre 2026 sur le commit `279306a` (branche `demo-universal`), lus un par un sur
`http://localhost:3000`, thème nuit + vue structure.** Aucun chiffre de ce document n'est recopié d'une version
précédente : ce qui n'a pas pu être lu à l'écran est marqué *invérifié*.

> **Avant de rouvrir ce script, lire ceci.**
> **La prod ne sert pas cette version.** Le 24/09, `https://deploy-one-tawny-59.vercel.app/audit` renvoyait encore
> « Montant récupérable détecté » et « Montant récupérable sur le roster » — l'ancien vocabulaire, supprimé depuis.
> Démo faite aujourd'hui sur la prod = ancienne interface + anciens chiffres, et ce document devient faux à l'écran.
> Donc : `npm run snapshot` → commit → `vercel deploy --prod --yes`, **puis refaire ce parcours et réécrire les
> chiffres**. Un snapshot déplace toutes les valeurs quotidiennes.

**Réglages avant d'entrer en salle.** Le persona et le thème sont mémorisés dans le navigateur.
Sur `/pulse`, poser `localStorage.theme = "night"` et `localStorage["day1-role"] = {"persona":"label","focusedArtistId":null}`.
Pour zoomer sur un artiste : `focusedArtistId` = `"dadju"` ou `"kiko"`. Pour la vue artiste : `persona` = `"artist"`.
Écran large de préférence.

**Puce de date.** Le Pulse affiche « vendredi 18 septembre · relevé de 09:00 · prochain demain 09:00 » — c'est le
dernier jour de snapshot, pas aujourd'hui. Après un nouveau snapshot la puce avance ; si on démo sans re-snapshoter,
elle affiche une date passée en promettant un relevé « demain ». À corriger ou à assumer d'une phrase.

*Historique : ce parcours a servi à la présentation Universal du vendredi 19 septembre 2026. Depuis, les 29 pages ont
été refondues (feuille teintée + points affiliés, `/overview` supprimée, « montant récupérable » retiré) et les données
de démo corrigées. Le script ci-dessous est la version post-refonte, réutilisable pour la prochaine séance.*

---

## Le parcours

| # | URL | Ce qu'on montre | Le chiffre à pointer | Si on nous demande « c'est vrai ? » |
|---|---|---|---|---|
| 1 | `/welcome?source=universal` | Le canal co-brandé, les 3 étapes, le premier insight | **⚠ NE PAS MONTRER EN L'ÉTAT** — l'insight affiche « **0 €** d'écart […] chez **0 artiste** » | Bug mesuré le 24/09, voir « Ce qui est cassé ». Tant qu'il n'est pas corrigé, entrer directement par `/roster` |
| 2 | `/roster` (vue structure) | Les 3 artistes, la dépendance du roster, la matrice croissance × marge | **74,8 %** des revenus du roster viennent de Dadju (12 mois glissants) ; revenus 12 mois **14,8 M €** | La page le dit elle-même : « Un roster qui tient à un seul nom tient à son contrat : c'est la dépendance qu'on surveille ici. » |
| 2b | (même page) tableau comparatif | Les 3 lignes, cliquables pour zoomer tout le dashboard | Dadju **109,6 M** streams 30 j / marge **+46,9 %** · Nono **48,5 M** / **+53,8 %** · Kiko **444,2 k** / **−15,5 %** | Streams : Spotify **mesuré** (Kworb + page publique), autres DSP **estimés** ; revenus non-streaming et dépenses **simulés**, dimensionnés |
| 3 | `/pulse`, `focusedArtistId="dadju"` | Le brief du matin sur un artiste réel | Hero **3,4 M** streams hier, **+1,9 %**, badge *mesuré* — puis **24 M** sur 7 j (−5,6 %) et **109,6 M** sur 30 j | Chaque feuille porte sa provenance. Sous les 30 jours, la page écrit « Spotify reconstitué, autres estimés » |
| 3b | (même page) feuilles Audience et Position algo | Le signal social à côté des streams, badgé *simulé* | **115,6 k** vidéos utilisent ses sons (+442 hier) · **n° 45** des sons en tendance FR | **Simulé** en attendant Soundcharts. On montre la place du signal, pas la mesure — ne pas le vendre comme un chiffre |
| 4 | `/streams` (Dadju) | Répartition par DSP, provenance ligne à ligne, heatmap 365 jours | **109,7 M** sur 30 j · Spotify **53 M** (**48,4 %**, *reconstitué*) · Deezer **26,2 M** (**23,9 %**, *estimé*) · Apple **13,5 M** · YouTube **8,2 M** (*reconstitué*) · Amazon **5,8 M** · Autres **2,9 M** | Personne n'a les streams Apple/Deezer/Amazon d'un artiste — nous non plus, et on l'écrit sur chaque ligne. La note TikTok sous le tableau : « signal de viralité, pas un stream rémunéré » |
| 5 | `/revenue?period=day` (Dadju) | L'estimation live. **Sélecteur d'onglets** Hier / 7 j / 30 j / 90 j / 12 mois (ce ne sont plus des tuiles) | Hier : brut master **13 197 €** (**11 468 – 14 926 €**) · Spotify **1,6 M** streams → **5 071 €** à **0,0031 €/stream** *mesuré* · Deezer **0,0059** *estimé* | Ancrage SNEP, corrigé plateforme et territoire. Cliquer « 30 jours » : **427,6 k €** (371,6 – 483,6 k €), l'onglet s'active et l'URL suit (`?period=month`) |
| 5b | (même page) hero **Évolution mensuelle par source** | **La provenance de la comparaison d'année, affichée** | **11 M €** sur 12 mois, **−28,7 %** vs les 12 mois précédents | Lire la note sous le graphe, mot pour mot : « Les deux fenêtres comparées précèdent les relevés réels : leur historique est reconstitué depuis le cumul et le débit du jour, puis converti en euros ; les revenus hors streaming sont des données de démonstration. » C'est nouveau, et c'est l'argument : on affiche la faiblesse de la comparaison au lieu de la cacher |
| 5c | (même page) panneau **« Sa part, c'est son contrat »** | La part artiste est une hypothèse tant que le contrat n'est pas là : 3 onglets — pourcentages, import du contrat, courrier de demande | « Aujourd'hui, la part de Dadju est **simulée (20 %)** pour la démo » | Phrase de la page : « Ce que Dadju touche dépend de son contrat — et on ne l'invente pas. » Onglet import : « Le fichier reste sur votre appareil : rien n'est transmis. » Ne rien saisir en salle (persisté dans le navigateur) |
| 6 | `/audit` (Dadju) | L'écart estimé / déclaré et la lettre prête | Hero **Écart détecté : 198,3 k €** — déclaré **632,6 k €**, attendu **830,9 k €**. Plus gros écart : **86 505 €** sur Spotify 2026-T2 (confiance 78 %) | **Lire la ligne sous le chiffre, c'est elle qui vend :** « Un écart n'est pas une créance : c'est une question à poser, pas une somme acquise. » Toujours attribué au DSP, jamais au label ni au distributeur |
| 6b | (même page) dépli « Comment cet écart est calculé » | Les 4 étapes : ingestion, rapprochement, score de confiance, lettre & suivi | Confiance moyenne **75 %**, la plus basse **73 %** | La page se ferme elle-même sur : « Données de démonstration — les montants attendus sont des estimations du modèle, pas des créances certaines » |
| 6c | `/audit` sans zoom (vue roster) | Le même écran à l'échelle du label | **Écart détecté sur le roster : 299,5 k €** · **13** écarts ouverts · **5** sources croisées · **3** artistes sur 3 | Détail par artiste à l'écran : Dadju **198 286 €**, Nono **101 245 €** |
| 7 | Bascule persona → **vue artiste** (Dadju) | Ce que voit l'artiste : les mêmes chiffres, et le rappel que sa part est une hypothèse | Gains estimés hier **2 639 €** (part artiste 20 % simulée) | Bloc « Deux fichiers rendraient ces chiffres exacts » — *part simulée à 20 % · fourchette ±30 %* — boutons Importer mon relevé / Importer mon contrat / Demander à mon label. « Les deux restent sur ton appareil » |
| 8 | `/splits` (vue artiste) | Signer un partage à la main (souris, doigt) | **9 / 14** titres signés — 4 en attente, 1 brouillon, **8** collaborateurs, part moyenne **67,1 %** | Ouvrir la modale sans signer : « Signe avec la souris ou le doigt. La signature reste sur cet appareil : rien n'est envoyé. » |
| 9 | `/pulse` puis `/revenue`, `focusedArtistId="kiko"` | Le cas indé : même produit, autre échelle | **23,9 k** auditeurs · **14,7 k** streams hier · brut master **4 €**/jour · **1 944 €** sur 12 mois (+82 %) | Le coefficient territorial se lit dans le tableau par plateforme : Spotify paie Kiko **0,0005 €/stream** contre **0,0031** à Dadju, YouTube **0,0002**. Même plateforme, six fois moins — c'est le pays, pas un bug |
| 10 | `/market` (vue structure) | Parts du Top 200 Spotify France par groupe / artiste / genre (cases à cocher), lecture du matin | Warner **18,5 %** · Believe **11,4 %** · Sony **9,2 %** · Universal **4,6 %** · « Indé / autre » **54,7 %**. Roster : Nono **n° 22** (LOVE YOU), Dadju **n° 187** (Compliqué), Kiko absent | « Le ℗ Spotify nomme le label, pas le distributeur : un label distribué sous licence sans le dire dans son ℗ tombe en “Indé / autre”. Avec vos données de distribution, on rend ça exact. » **45,3 %** des streams citent un groupe. La lecture du matin est « à base de règles sur les parts mesurées — aucun modèle de langage » |
| 11 | `/day1-index` | Le score, et les 5 choses qui le font bouger — en français, sans jargon | Dadju **88 / 100** : audience **100**, croissance **12**, sources de revenus **100**, fans fidèles **72**, élan récent **60**. Rang : **1ᵉʳ sur 3 au roster** | Le badge « Top X % des artistes comparables » a été **supprimé** : il se calculait `100 − score` sans aucune population de comparaison. On annonce un rang dans le roster, qui est vérifiable |
| 12 | `/settings` | Le dashboard se taille : chaque page s'active ou se désactive | **2 modules désactivés** par défaut en vue structure : « vs Concurrents » et « Onboardings partenaires », les deux marqués *Interne* | « Une page désactivée reste accessible par son adresse — rien n'est supprimé. » Le **Simulateur de revenus** (ex-« Revenue Calculator ») est bien **actif**, sous Finances |

**En réserve, à ne sortir que si on nous pousse.**

| # | URL | Ce qu'on montre | Le chiffre à pointer | Si on nous demande « c'est vrai ? » |
|---|---|---|---|---|
| R1 | `/calculator` | Le Simulateur de revenus : scénario de sortie, points de croissance | **16,3 M €** projetés sur 12 mois pour le roster (**12,3 – 20,3 M €**), soit **+10,5 %** vs les 12 mois passés | Une projection, pas une prévision : la fourchette est affichée, et l'ordre de grandeur reste celui du réalisé (15,4 M € sur l'année écoulée) |
| R2 | `/onboardings` | **INTERNE.** Le pipeline partenaires | **7** canaux engagés sur **9** visés · 6 en discussion, 1 pilote, **0 signé** · 4 owners nommés | Cette page liste Believe, Capitol et Universal côte à côte, avec leurs termes. Voir « Points de jugement » avant de l'ouvrir devant un major |

---

## Ce qui est cassé, et qu'il faut corriger avant la prochaine démo

Constaté le 24/09 sur `279306a`, non corrigé (hors périmètre de cette mise à jour).

1. **`/welcome` annonce 0 € — sur tous les canaux.** L'insight affiche « 0 € d'écart estimé / déclaré […] chez
   0 artiste », alors que `/audit` affiche 299,5 k € sur le même roster au même moment. Cause :
   `src/app/welcome/page.tsx:28` filtre les écarts avec `f.source.includes("écart")`, or `AuditFinding.source`
   contient le payeur (« Spotify », « SACEM », « ADAMI » — cf. `src/lib/demo/types.ts:206`), jamais le mot « écart ».
   Le filtre ne retient rien. **C'est la première phrase que lit le prospect : bloquant.**
2. **La part artiste de Kiko se contredit d'un écran à l'autre.** `/pulse` écrit « part simulée à **20 %** » ;
   `/revenue` écrit « la part de Kiko est simulée (**90 %**) » et calcule sur 90 %. Le 20 % de `/pulse` ne dépend pas
   de l'artiste (Dadju affiche la même chaîne). Sur un produit dont l'argument est la provenance, deux chiffres
   contradictoires au même endroit coûtent cher.
3. **Le Top 200 ne dit pas la même chose sur deux pages.** `/pulse` : « **2** titres du roster », badge ***simulé***.
   `/market` : « **3** titres classés », badge ***MESURÉ*** — et le bloc « Roster Day One » de cette même page
   en détaille **4** (1 Dadju + 3 Nono). Trois comptes, deux provenances.
4. **Kiko n'a qu'une ville.** `/audience` affiche un seul « Top villes » : Abidjan, 4,5 k. *Groupe témoin :* Dadju
   affiche 8 villes sur la même page, donc le composant fonctionne — c'est la donnée de Kiko qui est vide.
   **Conséquence directe :** la phrase « mesuré sur ses 5 villes (Lomé, Abidjan, Cotonou, Kinshasa, Conakry) » du
   script précédent n'est plus soutenable. Elle a été retirée du tableau ci-dessus.
5. **Deux feuilles ne varient pas d'un artiste à l'autre.** « Streams gagnés en 14 jours **+31 %** », « Entrées en
   playlists édito **6** cette semaine » et « **3 briefs** de synchro, 2 ferment cette semaine » sont identiques pour
   Dadju et pour Kiko. Idem pour la prochaine date, Bruxelles pour les deux. Ne pas pointer ces chiffres en salle.
6. **Le zoom label et la vue artiste sont le même écran.** Avec `persona: "label"` + `focusedArtistId: "dadju"`,
   `/pulse` dit déjà « Bonjour Dadju », « tes chiffres », « Demander à mon label ». La bascule de l'étape 7 ne
   change que la disparition du sélecteur « Vue roster ». L'effet de révélation annoncé n'existe pas.

---

## Ce qui est vrai / reconstitué / estimé / simulé

- **Mesuré** : auditeurs mensuels et abonnés Spotify, play counts des titres phares (delta J/J-1), total et débit
  quotidien par titre Kworb (Dadju, Nono), fans Deezer, vues YouTube par clip (delta J/J-1), villes d'écoute,
  et les parts du Top 200 France (streams Kworb + lignes ℗ / © lues sur chaque page Spotify).
- **Reconstitué** : l'historique quotidien antérieur au premier snapshot — sur 30 jours, Spotify et YouTube portent
  donc le badge *reconstitué*, pas *mesuré*. La page `/streams` l'affiche ligne par ligne.
- **Estimé** : streams Deezer / Apple / Amazon / autres (mix DSP), tous les € (fourchette + confiance), l'écart
  d'audit, la démographie d'audience.
- **Simulé** : contrats et parts, splits, dépenses, relevés déclarés, tournée, équipe, droits SACEM/ADAMI,
  valorisation, signal TikTok, et les revenus hors streaming de l'historique.

---

## Ce que la refonte rend démontrable et qui ne l'était pas

Deux arguments, à dire simplement — ils valent parce qu'ils sont vérifiables à l'écran, pas parce qu'ils sont gros.

- **La comparaison d'année dit sur quoi elle repose.** `/revenue` affiche « −28,7 % vs les 12 mois précédents » et,
  juste dessous, que les deux fenêtres comparées précèdent les relevés réels et sont reconstituées. Un outil qui
  affiche la faiblesse de sa propre comparaison est un outil qu'on peut laisser entre les mains d'un artiste.
  C'est tout ce que ça prouve — ça ne rend pas la comparaison juste.
- **`/audit` ne promet plus d'argent.** Le hero s'appelle « Écart détecté », plus « Montant récupérable », et la page
  écrit sous le chiffre qu'un écart est une question à poser, pas une somme acquise. Le dépli méthode se termine sur
  « pas des créances certaines ». Face à un juriste de major, c'est la différence entre un outil de réclamation et un
  outil de chantage. À vendre comme une posture, pas comme une performance technique.

---

## Points de jugement à assumer si on les soulève

Ce sont des avis, pas des mesures — étiquetés comme tels.

- **Deezer pèse lourd chez Dadju** : `/streams` le mesure à **26,2 M** de streams sur 30 j, **23,9 %**, deuxième DSP,
  badge *estimé*. *(L'ancien script citait « 3,3 M de fans Deezer » : ce chiffre n'apparaît sur aucun écran du
  parcours — **invérifié**, ne pas le citer.)*
- **Valorisation catalogue roster 159,3 M €** : multiples simulés sur des revenus estimés. Dire « ordre de grandeur,
  méthode NPS × multiple », jamais un prix.
- **Kiko rapporte 162 €/mois en moyenne sur 12 mois** : conséquence du territoire, pas un bug. C'est aussi le
  meilleur argument du produit — aucun outil ne lui dit pourquoi.
- **`/onboardings` est une page interne** — l'app la désactive elle-même par défaut. Elle affiche Believe en
  « Priorité absolue » avec un rev-share de 25 %, Capitol et Universal Music France sur la même colonne, et
  **0 partenaire signé**. *Avis :* ne pas l'ouvrir devant Universal. L'ancien script en faisait l'étape 9 ; c'est un
  risque pour un gain de crédibilité faible.
- **`/comparatif` est interne aussi** : elle nomme Believe comme concurrent alors que `/onboardings` en fait un
  partenaire prioritaire. Ne pas l'ouvrir en salle.
- **Les échéances de `/onboardings` sont ancrées sur le dernier relevé, pas sur aujourd'hui.** La page annonce
  « prochaine échéance 18 sept. 2026 » et « 4 échéances déjà passées **par rapport au dernier relevé** ». C'est écrit,
  donc honnête, mais ça se lit mal un mois plus tard.
- **Deux totaux de revenus 12 mois coexistent** : 14,8 M € sur `/roster` (12 mois glissants) et 15,4 M € sur `/pulse`
  (« L'année du roster »). Écart faible, fenêtres différentes — à ne pas pointer côte à côte.

---

## Répétition

Chronométrer le parcours complet à voix haute. Objectif : **8 minutes** de parole pour les étapes 1 à 12.
Temps de la séance : ______

*Repère machine, à ne pas confondre avec un temps de parole :* le parcours automatisé du 24/09 — environ 23
chargements de page, vérifications et contre-vérifications comprises — a pris **8 min 50 s**. C'est le temps que met
la machine à tout charger et relire, pas le temps que met un humain à le raconter.

---

## Angles morts de ce relevé

Ce que ce document **n'a pas** vérifié, et pourquoi :

- **La prod.** Tous les chiffres viennent de `localhost:3000` sur `279306a`. La seule chose mesurée sur
  `deploy-one-tawny-59.vercel.app` est qu'elle sert encore l'ancien vocabulaire. Ses chiffres n'ont pas été relevés.
- **Les lettres d'audit.** Les boutons « Voir la lettre » et « Générer la lettre » sont présents ; leur contenu n'a
  pas été ouvert.
- **Le comportement au clic de la plupart des liens.** Le parcours a été refait en posant les URL et le
  `localStorage` directement. Seuls quatre clics réels ont été testés : l'onglet « 30 jours » de `/revenue`
  (URL confirmée), l'onglet « Importer son contrat », le dépli « Comment cet écart est calculé » et la modale
  de signature de `/splits`.
- **Nono La Grinta.** Ses chiffres n'ont été lus que dans les tableaux de `/roster`, `/audit` et `/market` — aucune
  page ne lui a été dédiée pendant ce relevé.
- **Le rendu visuel sous 1440 px.** Le thème nuit et la structure « feuille teintée + quatre points affiliés » ont
  été confirmés par capture, mais la largeur du volet de prévisualisation n'a pas permis de valider les mises en
  page larges. À vérifier sur l'écran de la salle.
- **Le Copilot (`⌘K`), l'import de relevé, l'export** : non testés.
