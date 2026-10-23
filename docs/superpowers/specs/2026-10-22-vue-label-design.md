# Vue label — design

Date : 22 octobre 2026. Branche `achat` (le produit, pas la démo figée).
Validé avec Gaël sur maquette (`.superpowers/brainstorm/2026-10-22-vue-label/vue-label-maquette.html`, non versionnée).

## Problème

Mesuré le 22/10/2026 dans le code (`src/lib/accounts/customer.ts`, `src/lib/role.tsx`,
`src/lib/nav.ts`, `src/lib/userdata/use-modules.ts`) :

- L'espace a un type (`workspaces.kind` : artist, label, management, publisher, distributor,
  other), posé à l'achat depuis le profil de la lead (`provision.ts`), **jamais lu** par le
  dashboard.
- Le dashboard ne lit que le rôle du membre (owner, member, artist). La « vue structure » se
  résume à deux pages : `/roster` et `/ar-watch`.
- Un label connecté arrive sur `/mon-releve` du **premier artiste** de la liste.
- Pour changer d'artiste, il faut sortir vers `/espace` et cliquer « Ouvrir » (cookie
  `d1_artist`, route `/espace/ouvrir/[artistId]`).
- `CustomerRoleProvider` force la persona `artist` : la skin « structure » (`src/lib/skin.ts`,
  tokens dans `globals.css`) n'est jamais appliquée à un client.
- Revenus, Streams, Audit, Catalogue… parlent d'un artiste à la fois. Seule Finances a un
  sélecteur « Toute la structure / un artiste ».

## Décisions prises avec Gaël (22/10)

1. **Ce qui déclenche la vue label : le type déclaré à l'achat.** Tout type autre que `artist`
   donne la vue label, même avec un seul artiste. Un artiste invité (rôle `artist`) reste
   toujours en vue artiste. Le propriétaire peut corriger le type dans `/espace`.
2. **Accueil du label : le Roster enrichi** d'un bloc « Le label ce mois-ci » en tête.
3. **Périmètre « Tout le label » sur Revenus et Streams** seulement (Finances l'a déjà). Audit,
   Catalogue, Contrats, Splits, Droits restent par artiste.
4. **Tutoiement partout**, y compris pour un label. Les phrases de la vue label se reformulent
   (« les titres du label », « ce que chaque plateforme paie au label »), pas de vouvoiement.
5. **Fusion côté serveur** des relevés en un relevé virtuel du label, affiché par les pages
   existantes (plutôt que des pages label dédiées ou une fusion dans le navigateur).

## Architecture

### 1. La vue, calculée à la connexion

`customerView()` (`src/lib/accounts/customer.ts`) lit déjà `workspaces` et `workspace_members`.
Elle lit en plus `workspaces.kind` et renvoie dans `CustomerInfo` :

```ts
view: "artist" | "label";
workspaceKind: WorkspaceKind;          // 'artist' | 'label' | 'management' | 'publisher' | 'distributor' | 'other'
artists: { id: string; name: string }[]; // tous les artistes visibles (RLS), triés par création
```

Règle, dans une fonction pure `viewFor(kind, role)` (`src/lib/accounts/view.ts`) :
`role === "artist"` → `artist` ; sinon `kind === "artist"` → `artist` ; sinon `label`.

`CustomerRoleProvider` ne change pas (persona `artist`, `isLabel: false`) : la démo et ses
pages continuent de raisonner sur la persona ; la vue client est une notion à part.

### 2. Skin

`useSkin()` (`src/lib/skin.ts`) lit d'abord `useCustomer()` : en mode client, la skin est
`structure` si `view === "label"`, sinon `artist`. Hors mode client, inchangé (`skinFor(persona)`).
`customer-mode.tsx` n'importe pas `skin.ts` : pas de cycle.

### 3. Accueil et navigation

- `nav.ts` : `CUSTOMER_HOME` devient `customerHome(view)` → `/roster` en vue label,
  `/mon-releve` sinon. Utilisé par le layout (`src/app/(dashboard)/layout.tsx`) et la route
  `/espace/ouvrir/[artistId]`.
- `use-modules.ts`, section « Vue d'ensemble » en vue label : Roster, « Relevé de {artiste} »,
  Catalogue. `NavItem` gagne `label?: string` (texte déjà résolu, prioritaire sur `labelKey`) ;
  la sidebar, le menu mobile, la palette ⌘K et Réglages lisent ce champ quand il existe.
  En vue artiste : inchangé (Mon relevé, Roster pour owner/member, Catalogue).
- `isCustomerPath` ne change pas : les pages ouvertes dépendent toujours du rôle.

### 4. Changer d'artiste depuis la barre du haut

Dans `topbar.tsx`, branche client : le bloc « avatar · nom · espace » devient un menu déroulant
quand `customer.artists.length > 1` ou `view === "label"`. Contenu : « Artistes de {espace} »,
un item par artiste (nom, coche sur l'artiste ouvert), séparateur, « Gérer les artistes et
l'équipe » → `/espace`. Un artiste invité (un seul artiste visible) garde le bloc fixe.

Choisir un artiste navigue vers `/espace/ouvrir/{id}?vers={chemin courant}`. La route accepte
`vers` seulement si c'est un chemin interne du dashboard ouvert à ce rôle : fonction pure
`returnPath(vers, role, view)` dans `nav.ts` — commence par `/`, pas `//`, pas de `..`,
`isCustomerPath(chemin sans query, role)` vrai, query conservée sauf `perimetre` (on rouvre
l'artiste, donc le périmètre redevient l'artiste). Sinon : `customerHome(view)`. La valeur
`import` actuelle reste acceptée (`?vers=import` → `/import`).

Le menu n'affiche pas l'état des relevés par artiste (la maquette le montrait) : `customerView`
ne charge pas les imports de tous les artistes, et le Roster les montre déjà.

### 5. Roster enrichi : « Le label ce mois-ci »

`summarizeRoster` (`src/lib/userdata/roster.ts`) gagne `latest: LatestMonth | null` :

```ts
type LatestMonth = {
  month: string;                               // dernier mois couvert par au moins un relevé
  revenue: number; streams: number;            // somme des artistes dont le relevé couvre ce mois
  per1000: number | null;
  covered: { id: string; name: string }[];     // artistes dont le relevé couvre ce mois
  uncovered: { id: string; name: string; reason: "missing" | "behind" }[];
  previous: { revenue: number; streams: number; change: number | null; onArtists: number } | null;
    // mois précédent, calculé sur les artistes qui couvrent les DEUX mois ; change = revenus
    // (mois − précédent) / précédent sur ce même ensemble ; null si précédent = 0 ou aucun
    // artiste ne couvre les deux mois.
};
```

Le bloc (nouveau composant `LabelMonthSheet` dans `src/components/modules/structure/`) s'affiche
en tête de `CustomerRoster` **en vue label seulement**, sous la famille `money` :
deux grands chiffres (revenus, streams du mois, évolution si `previous.change` non null),
points affiliés : « {covered} sur {total} artistes avec un relevé pour {mois} » (note : noms
non couverts, raison), « € pour 1 000 streams », « relevé arrêté à … » si un artiste est en
retard, nombre d'alertes de baisse (nom). Deux boutons : « Revenus du label → »
(`/revenue?perimetre=label`), « Streams du label → » (`/streams?perimetre=label`).
Sans aucun relevé : le bloc n'apparaît pas (le Roster affiche déjà « Aucun relevé importé »).

### 6. Relevé virtuel du label (Revenus, Streams)

**Chargement.** `customerLabelStatement(workspaceId, workspaceName)` (`accounts/customer.ts`)
lit, pour chaque artiste de l'espace, son DERNIER `artist_imports.data` (une lecture par artiste,
`limit(1)`, en parallèle : jamais tout l'historique), et renvoie
`mergeStatements(entries, { artistName: workspaceName, artists })`. Le layout l'appelle **en vue
label** quand le chemin est `/revenue` ou `/streams` et que l'URL porte `?perimetre=label` (le
proxy transmet la query au layout dans l'en-tête `x-d1-search`). Coût = N lectures + une fusion
par requête, acceptable jusqu'à quelques dizaines d'artistes ; au-delà, une fonction SQL
`distinct on (artist_id)` en un aller-retour. Nouveau contexte `useCustomerLabelStatement()`
dans `customer-mode.tsx`.

**Fusion.** `mergeStatements(entries: { id, name, data: UserData }[], opts: { artistName, artists }): LabelStatement`
dans `src/lib/userdata/merge.ts`, fonction pure :

```ts
type LabelStatement = {
  data: UserData;                              // le relevé virtuel
  artists: number; withStatement: number;
  coverage: Record<string, number>;            // mois → nombre d'artistes dont le relevé couvre ce mois
  spans: { id: string; name: string; from: string; to: string }[]; // période de chaque relevé (explique les mois partiels)
  missingDetail: { id: string; name: string; what: ("platforms" | "titles" | "countries" | "detail")[] }[];
};
```

Règles :
- `months` = union triée. `revenueByMonth`, `streamsByMonth` (par DSP), `countryStreams`,
  `countryRevenue`, `countryMonthStreams`, `countryMonthRevenue`, `saleReportRevenue` :
  sommes.
- Titres : clés `"{titre} · {artiste}"` pour `trackStreams`, `trackRevenue`, `trackIsrc`,
  `trackMonthStreams`, `trackMonthRevenue`, `trackSpotify12` (deux « Intro » ne se mélangent
  jamais). Deux artistes homonymes (aucune unicité du nom en base) sont suffixés par leur rang :
  « Intro · Léo #1 », « Intro · Léo #2 ». Pas de plafond à 300 : les pages affichent déjà un top N.
- Témoin « detail » : les cinq champs mois par mois (`trackMonthStreams`, `trackMonthRevenue`,
  `countryMonthStreams`, `countryMonthRevenue`, `saleReportRevenue`) doivent tous être présents.
- `totalRevenueEur` du relevé virtuel = somme des `revenueByMonth` fusionnés, au centime
  (l'import arrondit son propre total à l'euro ; on ne reprend pas cet écart).
- Champs optionnels (`revenueByMonthDsp`, `trackRevenue`, `countryRevenue`, `trackMonth*`,
  `countryMonth*`, `saleReportRevenue`) : fusionnés seulement si **tous** les artistes avec
  relevé les ont ; sinon omis et les artistes qui en manquent sont listés dans `missingDetail`
  (what : platforms / titles / countries / detail).
- `trackIsrc` : correspondance titre → code, pas une somme — fusionné indépendamment du
  détail mois par mois, émis seulement s'il n'est pas vide (décidé le 23/10 en relecture :
  un artiste sans ISRC ne fausse pas les autres).
- `spotifyWindow` : gardé si identique chez tous, sinon omis avec `trackSpotify12`.
- `withheldEur` : somme des valeurs définies ; absent si aucune.
- `artistRevenue`, `fx` : omis. `eurRate: 1`, `sourceCurrency: "EUR"` (tout est déjà en euros à
  l'import), `format: "generic"`, `importedAt` = le plus récent, `artistName` = nom de
  l'espace, `version: 1`.
- `data.scope = { kind: "label", artists, withStatement, coverage }` : nouveau champ **optionnel**
  de `UserData` (absent d'un relevé d'artiste ; les relevés en base ne changent pas).
- Zéro artiste avec relevé → `data: null` (le type devient `data: UserData | null`).

**Pages.** `CustomerRevenue` et `CustomerStreams` lisent le périmètre dans l'URL :
`?perimetre=label` → `scope = "label"`, sinon l'artiste ouvert. Un hook commun
`useStatementScope()` (`src/lib/customer-scope.ts`) renvoie `{ scope, data, label }` :
`data` = relevé fusionné (`useCustomerLabelStatement().data`) en périmètre label, sinon le
relevé de l'artiste (store, comme aujourd'hui). Si le périmètre label est demandé hors vue
label (URL tapée), on retombe sur l'artiste.

Sur ces deux pages, en vue label :
- Sélecteur en tête (`<select>`, même motif que Finances) : « Tout le label » + un item par
  artiste. Artiste → navigation complète vers `/espace/ouvrir/{id}?vers=/revenue` ; label →
  navigation complète vers `/revenue?perimetre=label`. Jamais `router.push` ni `<Link>` : le
  relevé du label est chargé par le layout `(dashboard)`, que Next ne re-rend pas sur une
  navigation client (mesuré dans la source de Next 16 en relecture du 23/10). Même règle pour
  les deux liens du bloc « Le label ce mois-ci » du Roster.
- Sous-titre : « Tout le label · {artists} artistes, {withStatement} relevés · {de} → {à} ».
- Sous « Mois par mois », quand la couverture varie : « {mois…} : {n} artistes sur {N}
  ({explication : le relevé de X commence en …}) » ; les mois partiels sont hachurés dans le
  graphique (`MonthPoint` gagne `partial?: boolean`, posé depuis `coverage`).
- Formulations (`data.scope?.kind === "label"`) : « Ce que chaque plateforme paie au label »,
  « Les titres du label qui rapportent le plus » / « les plus écoutés », « Où l'on écoute le
  label », « calculé sur les relevés ». Les textes artiste restent tels quels.
- Détail manquant : au lieu de « réimporte pour voir le détail », une ligne par artiste de
  `missingDetail` : « {nom} : relevé importé avant le détail par titre. Réimporte son relevé
  pour voir ses titres ici. »
- Export CSV : fichier `day1-revenus-label` / `day1-streams-label`.
- Streams, « Santé du catalogue » : les notes « détail par titre / par pays » ne s'y affichent
  pas (elles portent sur le détail des REVENUS, les tables de streams sont toujours complètes).
  La demi-vie d'un titre est dite « non calculable sur le label » dès que les relevés ne couvrent
  pas les mêmes mois (mesuré le 23/10 : sur l'union des mois, un titre dont le relevé s'arrête
  tôt semble tomber à zéro) ; le seuil Spotify est dit « non calculable » quand les fenêtres de
  12 mois diffèrent.
- Aucun relevé dans l'espace : le message « Aucun relevé importé » actuel, avec le lien Importer.

### 7. Type d'espace dans `/espace`

Carte « Espace » (propriétaire seulement), au-dessus d'« Abonnement » : nom (lecture seule, comme
aujourd'hui), « Type d'espace » (select : Artiste, Label, Management, Éditeur, Distributeur,
Autre) avec l'aide : « Un label arrive sur son roster ; un artiste sur son relevé. Un artiste
invité garde sa vue à lui quoi qu'il arrive. » Action serveur `setWorkspaceKind` dans
`src/app/espace/actions.ts` : propriétaire vérifié (`editableWorkspaceById` + rôle owner),
valeur dans la liste, écriture avec la clé secrète, puis `revalidatePath("/espace")`.
Le message de bienvenue après achat dit « Commence par ajouter tes artistes » quand le type
n'est pas `artist`.

## Ce qui ne change pas

- La persona de démo, `CustomerRoleProvider`, la RLS, les tables (aucune migration : `kind`
  existe déjà avec sa contrainte).
- Les pages Audit, Catalogue, Contrats, Splits, Droits, Pulse, Marché… restent sur l'artiste
  ouvert. Finances garde son sélecteur actuel.
- Un artiste invité ne voit rien de nouveau : ni menu d'artistes, ni bloc label, ni sélecteur.
- Un espace de type `artist` avec plusieurs artistes : accueil Mon relevé, skin artiste, mais
  le menu d'artistes de la barre du haut (utile, sans coût).

## Erreurs et cas limites

- Vue label, aucun artiste : déjà bloqué avant (`no-artist` → `/espace`).
- Vue label, artistes sans aucun relevé : accueil `/roster` (pas de redirection vers `/import`,
  `needsStatement` l'exclut déjà) ; Revenus / Streams en périmètre label affichent « Aucun
  relevé importé ».
- `?vers=` malveillant ou hors dashboard : retour à l'accueil de la vue.
- Relevés en devises différentes : déjà convertis en euros à l'import, la fusion additionne des
  euros.
- Un artiste dont le relevé n'a pas de détail par titre : le label voit les titres des autres,
  et la ligne qui nomme l'artiste manquant.

## Tests

Unitaires (vitest), un fichier par unité :
- `view.test.ts` : `viewFor` sur les six types × trois rôles.
- `merge.test.ts` : union des mois ; sommes revenus / streams par DSP / pays ; titres distincts
  par artiste ; couverture par mois ; champs optionnels omis dès qu'un artiste en manque, avec
  `missingDetail` nommé ; `spotifyWindow` ; `withheldEur` ; zéro relevé → `data: null` ;
  un seul relevé → égal au relevé (hors clés de titres, scope, artistName).
- `roster.test.ts` (étendu) : `latest` — mois, couverts / non couverts avec raison, évolution
  sur l'ensemble commun, null quand le précédent est 0 ou vide.
- `nav-customer.test.ts` (étendu) : `customerHome`, `returnPath` (chemins valides, `//`, `..`,
  externe, page fermée au rôle, `import`, query conservée sans `perimetre`).
- `use-modules` / sidebar : « Relevé de {artiste} » en vue label, Mon relevé sinon.

Vérification mesurée en navigateur (dev local, `DEMO_MODE` éteint), avec un espace de test
`test.label@example.com` de type `label` et deux artistes ayant chacun un relevé de test
(fichiers CSV des fixtures existantes, mois décalés pour produire une couverture partielle) :
1. **Témoin avant** (code actuel) : captures de la page d'arrivée (`/mon-releve`), de la barre
   du haut, de `/revenue`.
2. **Après** : arrivée sur `/roster` avec le bloc du mois ; chiffres du bloc recoupés à l'euro
   avec la somme des deux `/mon-releve` ; menu d'artistes → même page sur l'autre artiste ;
   `/revenue?perimetre=label` : total = somme des deux pages artiste, mois partiel hachuré et
   nommé ; `/espace` : changer le type en `artist` → arrivée sur `/mon-releve`, skin artiste.
3. Artiste invité du même espace : aucun des éléments nouveaux.
4. Comptes et relevés de test supprimés ensuite (règle du dépôt : base à 0).

Commandes :

    npx vitest run src/lib/userdata src/lib/accounts src/lib/__tests__/nav-customer.test.ts
    npm run build

## Hors périmètre, pour plus tard

Demi-vie sur le label avec des relevés de périodes différentes : tronquer la série de chaque
titre à la période du relevé de son artiste dans `halfLives` (`src/lib/kpi/statement.ts`), avec
un test de couverture partielle — remplace le « non calculable » actuel.

Périmètre label sur Audit / Catalogue / Pulse ; aperçu label dans `/espace` ; état des relevés
dans le menu d'artistes ; fusion côté client pour changer d'artiste sans recharger ; vouvoiement ;
mise en ligne du produit (projet Vercel séparé).
