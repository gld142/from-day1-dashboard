# Day One Dashboard × Capitol — grille de présentation

**Rendez-vous** : Capitol Music France, jeudi 18 septembre 2026. **Objectif de sortie** : 2-3 artistes et 2-3 DA en pilote, une utilité du produit reconnue par eux.
**Prod** : https://deploy-one-tawny-59.vercel.app — entrée Capitol : `/welcome?source=capitol`.
Principe : on ne vend pas un produit qu'on aime, on répond à un problème qu'ils ont. Chaque écran est présenté par la phrase qu'ils disent déjà entre eux.

Ce document sépare ce qui est **mesuré** (chiffres réels des artistes de la démo, faits publiés) de ce qui est **proposé** (offre, tarifs, promesses) — ne jamais annoncer le second comme le premier.

---

## 1. Ce qu'ils vivent — le problème, dans leur langage

Capitol Music France : label généraliste d'Universal Music France, structuré en sous-labels par genre (Capitol Label Services depuis 2018), n° 1 des labels en France en 2022 (11,8 % de parts de marché, 12,8 Md de streams) ; Millenium / Capitol dirigé par Bouna Traoré, ancien directeur artistique. Source : Wikipédia, MusicBiz (mars 2026).

| Qui | Ce qu'il vit aujourd'hui | Ce qu'il dit |
|---|---|---|
| **Le DA / label manager** | L'information est dispersée : Spotify for Artists, Deezer Backstage, YouTube Studio, TikTok, les relevés semestriels, les contrats au juridique. Il prépare ses réunions à la main, la veille. | « J'ouvre six onglets pour répondre à une question. » |
| **La direction du label** | Options, fins de période, recoupements suivis sur tableur ; l'audit des plateformes n'est fait que quand un artiste réclame ; les sessions studio réservées puis gâchées sont un coût invisible. | « On découvre l'échéance quand l'avocat de l'artiste nous écrit. » |
| **L'artiste signé** | Il ne voit rien de ce que voit son label. Il demande « je touche combien ? » et personne n'a la réponse en un clic. | « Mon label sait tout et ne me dit rien. » |
| **La DAF** | Elle passe après. Ce qui compte pour elle : exports propres, dépenses studio sous contrôle, un fournisseur qui passe par UniPort. | « Pas de bon de commande, pas de facture. » |

Le fil commun : **l'information existe, elle n'est jamais au bon endroit au bon moment.** Day One la met dans une seule app, ouverte avant la réunion.

---

## 2. Ce qu'on montre — le produit, par interlocuteur

Un écran = une phrase = un chiffre à pointer. Chiffres du 17/09 (ils bougent chaque jour avec le relevé).

### 2.1 Pour le DA — « la réponse avant la réunion »
| Écran | La phrase | Le chiffre | Provenance |
|---|---|---|---|
| **Pulse roster** (`/pulse`, vue structure) | « Le matin, 30 secondes : ce qui a bougé cette nuit sur tout le roster. » | 4,9 M streams hier, top movers, alertes contrats | Spotify mesuré, autres plateformes estimées |
| **Pulse artiste** (clic Dadju) | « Titre moteur, plateforme en tête, momentum, TikTok, prochaine date, alerte contrat — sans ouvrir six onglets. » | « Reine » 85 k streams hier ; TikTok ≈ 115 k vidéos, n° 45 tendances FR | mesuré / simulé (TikTok, en attendant Soundcharts) |
| **Streams live** (`/streams`) | « Cumulé et par plateforme, 7 j à 12 mois, avec la provenance de chaque chiffre. » | Spotify 1,59 M/j mesuré ; Deezer, Apple, Amazon estimés | badges |
| **Position algo Spotify** | « Est-ce que l'algo pousse encore le titre ? » | intensité d'écoute, concentration du catalogue | dérivé du mesuré |
| **Audience** | « Où il est écouté, vraiment. » | Dadju : Paris, Abidjan, Montréal, Marseille, Lyon | mesuré (villes Spotify) |

### 2.2 Pour la direction du label — « piloter, alerter, récupérer »
| Écran | La phrase | Le chiffre | Provenance |
|---|---|---|---|
| **Roster** (`/roster`) | « Santé, rentabilité, valorisation — les trois artistes sur une ligne chacun. » | streams 30 j, revenus 12 m, net, valorisation | streams mesurés ; P&L et valorisation simulés |
| **Revenus** (`/revenue`) | « Ce que génèrent les streams, jour par jour, en fourchette — et ce que ça devient après contrat. » | Dadju : ~13-16 k€ bruts master / jour tous DSP | estimé, ancré SNEP 2025 (553 M€ / 122 Md streams) |
| **Audit** (`/audit`) | « L'écart entre ce que les plateformes devraient verser et ce qu'elles déclarent — attribué à la plateforme, jamais au label. » | 137 k€ d'écart estimé / déclaré sur 3 artistes (T2) | estimé vs relevé simulé |
| **Contrats** | « Chaque échéance devient une alerte : option, fin de période, clause inhabituelle. » | option Dadju à lever avant le 19/11 | simulé |
| **Exports** | « CSV, PDF comptable, en un clic. » | — | — |

### 2.3 Pour l'artiste Capitol — le portail co-brandé
| Écran | La phrase | Le chiffre |
|---|---|---|
| **Pulse artiste** (vue artiste) | « Ce que tu as gagné hier, ta semaine, ton mois. » | gains estimés hier : part artiste 2,6-3,2 k€ |
| **Revenus → « Ta part, c'est ton contrat »** | « On ne devine pas ta part : renseigne tes pourcentages, importe ton contrat, ou demande-le au label — on te prépare le courrier. » | simulé 20 % → renseigné |
| **Day 1 Index, Droits FR, Splits** | « Ton CV musical, tes droits SACEM lisibles, tes splits signés. » | — |

### 2.4 Pour la DAF — Wavely × UniPort
UniPort est le portail fournisseurs d'Universal Music : un fournisseur s'y inscrit, chaque prestation passe par un **bon de commande**, la prestation est **réceptionnée** par le contact métier chez Universal, puis la facture est déposée contre ce bon de commande (source : guides UniPort Universal Music, theuniport.com). C'est l'« exception comptable » : rien ne se paie en dehors.

Ce que Wavely apporte, dit dans leur langage :
- **Un crédit studio annuel** sous forme de compte : les DA et les artistes réservent directement, sans bon de commande à chaque session.
- **Wavely est le fournisseur UniPort unique** : un bon de commande cadre, chaque session réceptionnée, une facture consolidée — la DAF ne voit qu'une ligne propre.
- **Une session contrôlée** : réservation, présence, livrable (le son sorti), coût — plus de séance réservée « dans le vent », et un studio maison saturé ne bloque plus un artiste.
- **L'analytique** remonte dans Day One (dépenses studio par artiste, par projet), déjà prévue dans Dépenses & P&L (source « Wavely »).

---

## 3. L'intégration Capitol × Day One — l'offre

### 3.1 Le canal co-brandé
`/welcome?source=capitol` : écran CAPITOL × FROM DAY 1, trois étapes (connexion du roster → cartographie contrats & droits → premier brief roster), premier insight réel, sidebar par défaut pour un DA. Le portail artiste porte le logo Capitol.

### 3.2 Le pilote — 90 jours *(proposition)*
- **Périmètre** : 2-3 artistes Capitol (idéalement un établi, un en développement, un émergent), 2-3 DA, un référent label.
- **Semaine 1** : les artistes apparaissent avec leurs streams publics (Spotify mesuré, YouTube mesuré, le reste estimé) — aucune donnée Capitol nécessaire pour démarrer.
- **Semaines 2-4** : Capitol partage les relevés DSP et un contrat par artiste → calibration (précision ±5 % au lieu de ±25 %), alertes contractuelles réelles, écart d'audit sur relevés réels.
- **Semaines 5-12** : usage quotidien par les DA ; Wavely ouvert aux 3 artistes avec un crédit studio test ; Soundcharts activé (TikTok, Shazam, mix DSP).
- **Ce qu'on mesure** : M+1 — les 3 DA ouvrent Pulse ≥ 3 matins par semaine ; M+3 — une décision (renégociation, réclamation DSP, budget marketing) prise avec un chiffre Day One ; une réclamation DSP documentée.

### 3.3 Tarifs *(proposition, à arbitrer par Gaël — grille interne : B2B Major dès 499 €/mois)*
| Palier | Contenu | Prix |
|---|---|---|
| **Pilote 90 jours** | 3 artistes, 3 DA, calibration sur relevés, Soundcharts inclus | offert *(ou 499 €/mois symbolique si Capitol préfère un engagement)* |
| **Capitol × Day One** | jusqu'à 30 artistes, DA illimités, portail artiste co-brandé, exports, API, SLA, account manager | 990 €/mois par label |
| **Universal Music France** | tous les labels, intégration relevés + contrats, SSO | sur devis (dès 2 490 €/mois) |
| **Wavely** | crédit studio annuel géré via UniPort, sessions contrôlées, analytique | commission studio incluse dans le prix des sessions ; module Day One offert avec le crédit |

Pourquoi ces niveaux : un DA coûte plus cher par mois que le produit ; un seul écart DSP récupéré paie l'année ; le pilote offert enlève l'objection « on ne sait pas si on l'utilisera ».

### 3.4 Ce qu'on demande à Capitol pour démarrer
1. Les noms des 2-3 artistes et des 2-3 DA, un référent.
2. Pour chaque artiste : le dernier relevé DSP (ou l'accès Spotify for Artists en lecture) et le contrat, même caviardé.
3. Un logo et une couleur pour le co-branding.
4. Un contact DAF pour l'inscription Wavely dans UniPort.

---

## 4. Mener la réunion

### 4.1 Le déroulé (25 minutes)
1. **2 min — leur problème, pas notre produit** : « Combien d'onglets ouvre un DA pour préparer une réunion artiste ? » Laisser répondre.
2. **8 min — la démo, vue DA** : `/welcome?source=capitol` → Roster → Pulse roster → Dadju → Streams → Revenus (sélecteur de période, « Ta part ») → Audit. Toujours pointer les badges : mesuré / reconstitué / estimé / simulé.
3. **5 min — la vue artiste** : bascule persona, « ce que voit l'artiste », le courrier au label.
4. **5 min — Wavely × UniPort** pour celui qui pense DAF.
5. **5 min — le pilote** : périmètre, 90 jours, ce qu'on leur demande. Fermer sur les noms.

### 4.2 Les objections, et la réponse
| Objection | Réponse |
|---|---|
| « Ces chiffres sont faux / simulés. » | « Ceux qui sont simulés portent le badge simulé. Les streams Spotify et YouTube sont mesurés chaque jour. Donnez-nous un relevé, et l'estimation devient une mesure à 5 % près. » |
| « On a déjà Spotify for Artists / Deezer Backstage. » | « Oui — six outils, aucun cumul, aucun euro. Day One les met sur une ligne et les convertit en argent et en échéances. » |
| « Nos données sont confidentielles. » | « Le pilote démarre sans aucune donnée Capitol. Les relevés restent en local dans le navigateur de l'utilisateur ; rien n'est envoyé. Pour la suite : hébergement France, DPA dès le pilote. » |
| « L'audit, c'est nous que vous allez auditer. » | « Jamais. L'écart est toujours attribué à la plateforme. Le label est le demandeur, pas l'audité — c'est contractuel. » |
| « Combien ça coûte ? » | « Le pilote ne coûte rien. Ensuite moins qu'un demi-poste par label, et un seul écart DSP récupéré paie l'année. » |

### 4.3 La sortie
Repartir avec : les 2-3 noms d'artistes, les 2-3 DA, une date de démarrage, le contact DAF. Envoyer le soir même : le lien `/welcome?source=capitol`, cette grille en une page, et la liste des 4 éléments à fournir.

---

## Après la réunion — la V2 par profil (à concevoir, pas à promettre)
Le dashboard s'adapte au **compte** (la structure qui possède le compte, ses accès et ses connexions) et au **profil** de la personne : DA, label manager, DAF, artiste signé, artiste indé, **auteur-compositeur qui ne fait que de la synchro**, **producteur crédité artiste principal**, manager. Chaque profil a sa sidebar, son Pulse, ses alertes, et le parcours d'onboarding pose la question dès l'entrée (« tu es… ») pour ne montrer que ce qui le concerne.
