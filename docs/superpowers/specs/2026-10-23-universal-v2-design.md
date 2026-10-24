# Universal v2 — design

Date : 23 octobre 2026. Branche `universal-v2` (dossier `from-day1-dashboard-universal`), créée
depuis `achat` à b201e96. Gaël a validé l'orientation à l'oral le 23/10 (« explique, choisis le
mieux, lance tout ») ; les décisions ci-dessous sont les miennes, prises sur cette base.

## Objectif

Second rendez-vous Universal (date à confirmer). Présentation en deux temps :

1. **Notre dashboard** (Day 1 Dashboard Pro), roster de démo élargi et classé.
2. **« Day One × Universal »**, la même chose co-brandée, qui projette Universal dans ce qu'on
   co-construirait : un dashboard par métier (DA, finance, juridique, direction, présidence) et un
   fil d'information entre services — le besoin qu'Universal a exprimé au premier rendez-vous.

Pourquoi deux adresses et un seul code : la présentation veut deux objets distincts, le
développement n'en veut qu'un. Une « maison » (tenant) choisie au déploiement règle le nom, le
logo, le roster et les rôles.

## Décisions

1. **Base : `achat`** (code produit + pages de démo derrière `DEMO_MODE=on` + vue label + correctifs
   d'octobre). La démo figée du 25/09 (`_deploy`, étiquette `demo-2026-09-25`) reste le filet de
   sécurité et n'est remplacée qu'en fin de chantier, après vérification visuelle.
2. **Maison par variable de build** `NEXT_PUBLIC_TENANT` = `day1` (défaut) ou `universal`. Deux
   projets Vercel : `_deploy` (day1, remplace la démo figée) et `day1-universal` (nouveau).
3. **Roster** : trois catégories (`urbain`, `variete`, `compositeur`) et un DA par artiste.
   Démo day1 : sans Kiko. Démo Universal : sans Dadju. Six artistes ajoutés avec leurs compteurs
   publics réels (Spotify, Deezer, YouTube) via le relevé quotidien existant.
4. **Rôles** (maison Universal seulement) : DA, finance, juridique, direction, présidence.
   Un rôle = une page d'arrivée, une navigation, et pour le DA un périmètre (ses artistes).
5. **Fil entre services** : notes adressées à des services, rattachées à un artiste, avec
   urgence et échéance ; visibles dans « À faire aujourd'hui » du rôle visé, dans une page
   « Fil », et comptées sur le roster. En démo : stockage local du navigateur, exemples
   pré-remplis. L'envoi d'emails et la base restent pour le produit.
6. **Tutoiement conservé**, textes en français (la démo a un menu EN : les nouveaux textes passent
   par `messages/<locale>/` comme les autres).

## 1. Maison (tenant)

`src/lib/tenant.ts` (pur, importable partout) :

```ts
export type TenantId = "day1" | "universal";
export type Tenant = {
  id: TenantId;
  name: string;            // « Day 1 Dashboard Pro » / « Day One × Universal »
  shortName: string;       // sidebar : « Day 1 » / « Day One × Universal »
  tagline: string;
  logo: { text: string; bg: string; fg: string } | null;   // co-marque (null = Day 1 seul)
  excludedArtists: string[];   // day1 : ["kiko"] ; universal : ["dadju"]
  roles: boolean;              // sélecteur de rôle métier (universal : true)
};
export const TENANT: Tenant;   // lu depuis process.env.NEXT_PUBLIC_TENANT, défaut day1
```

Consommateurs : `LABEL.name` (data.ts) → `TENANT.name` ; marque de la sidebar (`sidebar.tsx`) et du
menu mobile ; titre des pages (`layout.tsx` racine, metadata) ; `ARTISTS` filtrés par
`excludedArtists` à la source (`src/lib/demo/data.ts` exporte `ARTISTS` déjà filtrés ; les six
fichiers de relevés restent, un artiste exclu n'est simplement pas dans la liste). Les textes
existants qui citent « Day 1 Dashboard Pro » en dur passent par `TENANT.name`.

Local : `.env.local` du dossier porte `DEMO_MODE=on` ; `NEXT_PUBLIC_TENANT=universal` à la demande
(`NEXT_PUBLIC_TENANT=universal npm run dev -- -p 3005`).

## 2. Artistes et catégories

`Artist` (`src/lib/demo/types.ts`) gagne :

```ts
category: "urbain" | "variete" | "compositeur";
/** DA (directeur artistique) qui suit l'artiste — id de DAS. */
daId: string;
```

`src/lib/demo/data.ts` : `export const DAS: { id: string; name: string; category: Category }[]` —
trois DA de démo (prénoms fictifs, à remplacer par les vrais si Gaël les donne) :
`da-urbain` « Inès M. » (urbain), `da-variete` « Julien R. » (variété), `da-compos` « Sofia K. »
(compositeurs). Chaque artiste est rattaché au DA de sa catégorie.

Roster complet (12 artistes ; la maison retire le sien) :

| Catégorie | Artistes | Métier |
|---|---|---|
| urbain | Dadju, Nono La Grinta, November Ultra, ElGrandeToto, Kiko, Leto, Dakeez | interprètes |
| variete | Louane, Wamen | interprètes |
| compositeur | Zeg P, Gustave Rudman, Brice Davoli | compositeurs (`kind: "composer"`, revenus = œuvres écrites pour d'autres, droits d'auteur ; Brice Davoli : grand catalogue Sacem selon Gaël, non vérifié) |

Six nouveaux (Leto, Dakeez, Louane, Wamen, Gustave Rudman, Brice Davoli) : entrée dans `ARTISTS`
(genre, teinte, initiales, stade, type de contrat, `kind`, éditeur), entrée dans
`scripts/artists.json` (ids Spotify / Deezer / YouTube **vérifiés** par la recherche du 23/10 ;
un id incertain est laissé vide et le relevé passe la source), puis `npm run snapshot` pour le
premier relevé réel. Sans relevé (compositeur sans page artiste), l'artiste garde ses valeurs de
secours et son badge « simulé », comme la démo le fait déjà. Les générateurs de démo (contrats,
splits, droits, dépenses, dates) qui bouclent sur `ARTISTS` couvrent automatiquement les nouveaux ;
leurs paramètres par artiste (index, taux de croissance, auditeurs de secours) sont posés à la main
avec des ordres de grandeur plausibles et le badge « simulé ».

Identifiants vérifiés le 23/10 (API Deezer, oEmbed Spotify, MusicBrainz, Wikidata) :

| Artiste | Spotify | Deezer | YouTube | Remarque |
|---|---|---|---|---|
| Leto | `6HCBnyTBSLdb3TFn2ayulY` | 455796 | `UCP9zhgBhlIwgF5UEf3Pmj8Q` | rap, PSO Thug |
| Dakeez | `63TYAXPLsZ7A3AFeGiGGGu` | 53565962 | — | R&B / trapsoul, Lyon |
| Louane | `7wjeXCtRND2ZdKfMJFu6JC` | 4453455 | `UCxROfILs1ORiiUWCDdkfqaA` (incertain) | pop / variété |
| Wamen | `3IrNp8pf0ugwmIEiGJCRse` | 182945357 | — | R&B / soul, Paris |
| Gustave Rudman | `2yGaqlHUHvNEpdRlmQCMEC` | 4722593 | — | compositeur-producteur (orthographe : Gustave) |
| Brice Davoli | `27kwwOnjG09lmLHv3zle84` (lu dans le navigateur le 23/10) | 1570143 | — | compositeur-arrangeur |

Les auditeurs mensuels n'ont pas pu être lus (pages Spotify rendues en JS) : les valeurs de
secours sont posées à la main, badge « simulé », et le premier `npm run snapshot` les remplace
là où une page existe.

## 3. Roster par catégories et DA

Page `/roster` de démo (`DemoRoster`, `src/app/(dashboard)/roster/page.tsx` + composants
`structure/roster-*.tsx`) :

- **Filtres** en tête (pastilles) : catégorie (toutes / urbain / variété / compositeurs) et DA
  (tous / un DA). État dans l'URL (`?cat=`, `?da=`) : partageable, et un rôle DA arrive déjà
  filtré. Par défaut, tout est visible.
- **Tableau groupé par catégorie** : un en-tête de groupe par catégorie (nom, nombre d'artistes,
  streams et revenus du groupe), les lignes dessous ; la matrice et les barres P&L respectent le
  filtre. Les totaux en tête (« Streams du roster », etc.) suivent le filtre et disent le
  périmètre (« 7 artistes · urbain »).
- Chaque ligne montre sa catégorie et son DA ; un compteur de notes ouvertes du fil (section 5).
- La page client (`CustomerRoster`, vue label) n'est pas touchée dans ce chantier.

Périmètre commun : `src/lib/demo/scope.ts` expose `scopedArtists({ category?, daId? })` ; les
agrégats label de `api.ts` qui lisent `ARTISTS` (rosterRows, labelTotals, pnlByArtist,
rosterDspEstimates, rosterEstimateSummaries, alertes) acceptent une liste d'artistes en option et
gardent leur comportement par défaut (tous).

## 4. Rôles métier (maison Universal)

`RoleState` (`src/lib/role.tsx`) gagne `jobRole: JobRole | null` et `daId: string | null`
(persistés comme la persona). `JobRole = "da" | "finance" | "juridique" | "direction" |
"presidence"`. Quand `TENANT.roles` est vrai, le sélecteur de la barre du haut propose les rôles
(à la place de « Vue artiste / Vue structure » ; la persona reste `label`) ; choisir « DA » demande
lequel (liste `DAS`).

`src/lib/roles.ts` (pur) : par rôle, page d'arrivée, items de navigation épinglés et cachés (même
mécanique que `SourceConfig` de `welcome/sources.ts`), et périmètre :

| Rôle | Arrivée | Navigation | Périmètre |
|---|---|---|---|
| DA | `/roster?da=<id>` | Roster, Pulse, Streams, Audience, A&R, Contrats, Fil | ses artistes (`daId`) partout où un agrégat label existe |
| Finance | `/revenue` | Revenus, Dépenses & P&L, Droits, Valorisation, Audit, Fil | tout le roster |
| Juridique | `/contracts` | Contrats, Splits, Droits, Œuvres & placements, Fil | tout le roster |
| Direction | `/pulse` | tout | tout |
| Présidence | `/pulse` | Pulse, Roster, Valorisation, Fil | tout ; Pulse ouvert sur la synthèse (streams, revenus, valorisation, alertes) |

Le rôle change la navigation (préréglage de modules, comme Réglages → Modules), la page d'arrivée et
le périmètre DA ; il ne crée aucune page nouvelle hormis le Fil. Maison day1 : pas de sélecteur de
rôle, comportement inchangé.

## 5. Fil entre services

Besoin d'Universal : qu'un service inscrive une info importante au moment où il l'a, que le service
concerné la voie au bon moment, sans attendre la réunion.

`src/lib/userdata/feed-store.ts` (motif `shares-store.ts` : localStorage `day1-feed`, cache module,
`subscribe/snapshot`, hydratation explicite) :

```ts
type FeedNote = {
  id: string; createdAt: string;
  from: JobRole; fromName: string;          // « Juridique · Camille »
  to: JobRole[];                            // services visés
  artistId: string | null;
  urgency: "info" | "important" | "urgent";
  dueDate: string | null;                   // AAAA-MM-JJ
  text: string;                             // 500 caractères max
  status: "open" | "done";
  doneAt: string | null;
};
```

- **Page `/fil`** (« Fil entre services », item de navigation avec compteur des notes ouvertes
  adressées à mon rôle) : liste triée urgence puis échéance, filtres « à traiter pour moi / tout /
  par artiste », bouton « Nouvelle note » (dialogue : texte, artiste, services visés, urgence,
  échéance), action « Traité ». Sans rôle choisi (maison day1), le fil montre tout et l'auteur est
  « Structure ».
- **Pulse, bloc « À faire aujourd'hui »** : une ligne « {n} notes à traiter » quand n > 0, lien vers
  `/fil`.
- **Roster** : compteur de notes ouvertes par artiste (lien vers le fil filtré).
- **Exemples pré-remplis** (posés au premier chargement si le fil est vide, datés par rapport à
  aujourd'hui) : juridique → finance « clause de recoupement de l'avance de Nono La Grinta,
  échéance 15 jours » (urgent) ; finance → DA urbain « avance de Leto recoupée à 80 %, prévoir
  renégociation » (important) ; DA variété → juridique « option sur Louane à lever avant le 30 »
  (urgent) ; direction → tous « comité catalogue vendredi, remonter les œuvres sans split signé »
  (info) ; juridique → DA compositeurs « contrat d'édition Gustave Rudman reçu, relecture en cours »
  (info) ; finance → direction « relevé Deezer Q3 reçu, écart d'audit sur ElGrandeToto » (important).
- Hors périmètre ici : emails, base de données, pièces jointes, commentaires en fil de discussion.

## 6. Mise en ligne

- **`day1-universal`** : nouveau projet Vercel, `DEMO_MODE=on`, `NEXT_PUBLIC_TENANT=universal`,
  protection Vercel désactivée, porte à mot de passe de la démo conservée (`/acces`).
- **`_deploy`** (démo actuelle) : `DEMO_MODE=on`, `NEXT_PUBLIC_TENANT=day1`, déployé depuis un
  worktree propre de `universal-v2`, **après** un passage visuel page par page contre la démo
  figée (mêmes pages, mêmes chiffres de Dadju / Nono / November / Zeg P / ElGrandeToto, Kiko en
  moins, six artistes en plus). Retour arrière possible : `vercel rollback` vers le déploiement du
  25/09 (`dpl_9aWB8EN71TCNnVeAnd64XpnJhhWL`).
- Relevé du matin : `npm run snapshot` puis redéploiement des deux projets.

## Tests

Unitaires : `tenant.ts` (maison par défaut, exclusions), `scope.ts` (filtres catégorie / DA),
`roles.ts` (arrivée, navigation, périmètre par rôle), `feed-store.ts` (tri, filtres, exemples
posés une fois, « traité », compteurs par rôle et par artiste), `data.ts` (chaque artiste a une
catégorie, un DA existant et des ids cohérents ; exclusions par maison), nav (item Fil, préréglages).
Suite complète verte et `npm run build` pour les deux maisons.

Vérification en navigateur (dev local, `DEMO_MODE=on`), les deux maisons :
roster groupé et filtré, sélecteur de rôle, arrivée par rôle, fil (créer, traiter, compteurs
Pulse / roster / navigation), co-marque, absence de Kiko (day1) et de Dadju (universal). Puis la
comparaison visuelle avec la démo figée avant de toucher `_deploy`.

## Hors périmètre, pour plus tard

Fil en base avec emails (produit) ; droits d'accès réels par rôle (le sélecteur de démo n'est pas
une authentification) ; vrais prénoms des DA ; vue label du produit pour Universal ; nouveaux
artistes dans la version produit.
