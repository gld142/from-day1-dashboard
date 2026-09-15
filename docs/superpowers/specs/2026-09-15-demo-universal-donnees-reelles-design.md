# Démo Universal — Day 1 Dashboard Pro sur données réelles + canal Universal

**Date** : 15 septembre 2026
**Échéance** : présentation à Universal jeudi 18 septembre 2026 (à confirmer par Gaël)
**Statut** : design validé à l'oral, en attente de relecture écrite

## 1. Contexte et objectif

Day 1 présente à Universal son produit indépendant, **Day 1 Dashboard Pro**, en
deux vues (artiste et label), puis l'idée d'un canal d'acquisition dédié
« Universal × From Day 1 » — sur le modèle des onboardings co-brandés du brief
Believe du 24 juin 2026 (`/welcome?source=believe`, `?source=sacem`, etc.).

Ce que la démo doit faire dire à la salle : « on veut ça ». Ce n'est **pas** un
produit livrable : pas d'auth, pas de backend, pas de facturation. Le produit
Universal × Day 1 se concevra après, avec ce qu'Universal aura dit en réunion.

Ce qui est vrai dans la démo : **les streams et l'audience** des trois
artistes. Ce qui est inventé mais cohérent : contrats, splits, dépenses,
relevés, tournée, équipe — tout ce qu'on ne peut pas obtenir de l'extérieur.

Décision de coût prise le 15/09 : **0 € de données payantes** jusqu'au premier
ou deuxième client ; à ce moment-là, Soundcharts Starter (50 $/mois). Le code
doit rendre cette bascule triviale (voir §7, interface `StreamSource`).

## 2. Périmètre

### Dedans

1. Couche de données réelles pour Kiko, Dadju, Nono La Grinta (snapshots
   quotidiens versionnés dans le repo) : Spotify, Kworb, Deezer, YouTube,
   villes d'écoute.
2. L'algo Day 1 : estimateur de revenus multi-DSP en fourchette, mix DSP par
   artiste, calibration par relevé, écart d'audit, Position algo, Day 1 Index et
   Pulse alimentés par le réel.
3. Roster : le tenant démo devient « Day 1 Dashboard Pro », roster = les 3
   artistes réels, les 6 artistes fictifs disparaissent. Vue label et vue
   artiste fonctionnent sur les trois.
4. Badge de provenance sur les chiffres : *mesuré* / *reconstitué* / *simulé*.
5. Canal Universal : route `/welcome?source=universal` (écran co-brandé + bloc
   « ce que cet onboarding résout » côté major), et Believe porté depuis le
   proto legacy pour montrer que c'est un template. Universal ajouté comme 7ᵉ
   canal dans le board `/onboardings`.
6. Vérification : état témoin avant/après, tests unitaires des nouveaux
   modules, audit visuel 3 thèmes, déploiement prod, répétition chronométrée.

### Dehors (jusqu'après la réunion)

Auth, backend et persistance, Soundcharts live, les cinq autres
canaux (SACEM, ADAMI, SPEDIDAM, MaMA, Bolero), l'import S4A automatisé au-delà
d'un parser CSV, tout nouveau module.

## 3. Les artistes et les sources — ce qui a été mesuré le 15/09

| | Kiko | Dadju | Nono La Grinta |
|---|---|---|---|
| Spotify artist id | `4P2zZ1OLqeeKDLXc34Yfsv` | `4sbXXFzEWJY2zsZjelerjX` | `4P2HohWBtvSxxwabNDdYXN` |
| Auditeurs mensuels Spotify | 24 468 | 6 481 936 | 4 731 080 |
| Streams cumulés (Kworb) | absent de Kworb | 4 633 277 280 | 584 564 236 |
| Streams / jour (Kworb) | — | 1 587 902 | 949 847 |
| Titres suivis par Kworb | — | 239 | ~55 |
| Play counts publics top 5 (page Spotify rendue) | *Odjo* 203 809, *Business class* 122 254, *One in a million* 124 394, *Rayon de soleil* 69 866, *Ding Deng Dong* 91 405 | oui | oui |
| Deezer artist id / fans | à identifier (candidat `9161`, à vérifier par les titres) | `4803754` / 3 276 021 | `194146027` / 289 972 |
| YouTube | chaîne à identifier | chaîne `UC8HMvOLE0etpO_eVjJ98bHA` (DADJU), 8,01 M d'abonnés ; *Reine* (clip) 439 698 165 vues | chaîne à identifier |
| Statut dans la démo | indé (distribution) | signé label (deal artiste) | signé label (deal artiste) |

Kiko = « Golden Boy from Togo », confirmé par Gaël.

### Sources, par ordre de fiabilité

| Source | Ce qu'elle donne | Légalité | Usage |
|---|---|---|---|
| Page artiste Spotify (HTML statique) | auditeurs mensuels | page publique | quotidien |
| Page artiste Spotify (rendue JS, Playwright) | play count cumulé des 5 titres populaires | page publique | quotidien ; delta J/J-1 = streams réels du jour pour ces 5 titres |
| Kworb `spotify/artist/<id>_songs.html` | total cumulé + débit quotidien **par titre** | site public | quotidien (Dadju, Nono) |
| API Deezer publique `api.deezer.com` | fans artiste, rang de popularité par titre | API officielle sans clé | quotidien, signal de mix DSP |
| YouTube Data API v3 (clé Google Cloud gratuite, 10 000 unités/jour) | vues cumulées par vidéo (chaîne officielle + chaîne « Topic »), abonnés | API officielle | quotidien ; delta J/J-1 = vues réelles du jour |
| Page artiste Spotify rendue — bloc « Plus d'infos » | les 5 villes où l'artiste est le plus écouté, avec auditeurs | page publique | quotidien, pondération territoriale (§5.1) |
| Export Spotify for Artists de Kiko (CSV) | historique quotidien réel par titre | fourni par l'artiste | si Gaël l'obtient avant mercredi |
| Apple Music | rien de public (métadonnées iTunes seulement) | — | estimé uniquement |

Ce qui n'existe pour personne, même payant : les streams Apple, Deezer et
Amazon d'un artiste. Tout le marché les estime ; nous aussi, mais on le dit.
YouTube, lui, est mesurable : on ne compte que les vues des chaînes de
l'artiste (officielle + « Topic »), jamais le Content ID sur des vidéos tierces.

## 4. Couche de données réelles

### 4.1 Snapshots

Un script `scripts/snapshot.mjs` (Node + Playwright, déjà en devDependency)
relève les sources ci-dessus pour les trois artistes et écrit
`src/lib/real/snapshots/<artistId>/<YYYY-MM-DD>.json` :

```jsonc
{
  "date": "2026-09-15",
  "spotify": {
    "monthlyListeners": 6481936,
    "followers": null,                      // si non trouvé
    "topTracks": [{ "name": "Reine", "spotifyId": null, "playcount": 228869436 }]   // id si trouvé
  },
  "kworb": {
    "totalStreams": 4633277280,
    "dailyStreams": 1587902,
    "tracks": [{ "name": "Reine", "total": 228869436, "daily": 82112 }]
  },
  "deezer": { "fans": 3276021, "topTracks": [{ "title": "…", "rank": 963029 }] },
  "youtube": {
    "subscribers": 8010000,
    "videos": [{ "videoId": "tVKaN_H35xs", "title": "Reine", "channel": "official", "views": 439698165 }]
  },
  "topCities": [{ "city": "Paris", "country": "FR", "listeners": 512000 }]   // page Spotify rendue
}
```

Les snapshots sont **commités** : la démo n'appelle rien au runtime, l'app
reste 100 % statique. `npm run snapshot` est lancé à la main chaque jour
jusqu'à la démo (par Claude, sortie brute montrée à Gaël). Une source qui
échoue ne bloque pas les autres : le champ est `null`, le script le signale.

### 4.2 Séries et provenance

Chaque point de série porte une `provenance` :

- `measured` — jour couvert par deux snapshots consécutifs (delta) ou par un
  débit quotidien Kworb relevé ce jour-là, ou par l'export S4A.
- `reconstructed` — jour antérieur au premier snapshot, reconstitué.
- `simulated` — donnée inventée (contrats, dépenses, relevés…).

Le type `StreamPoint` gagne un champ `provenance`, et les composants qui
affichent une valeur agrégée montrent le badge de la provenance la plus faible
présente dans l'agrégat (un mois qui mélange mesuré et reconstitué est
« reconstitué »).

### 4.3 Reconstruction de l'historique

Pour un titre avec total cumulé `T` et débit du jour `d` :

- horizon 365 jours ; le débit `d_t` suit une courbe lisse ancrée sur `d`
  aujourd'hui, avec une saisonnalité hebdomadaire (vendredi-samedi +8 à +12 %,
  lundi −5 %), un bruit déterministe (seed = artistId + trackName), et pour les
  titres dont la date de sortie est connue et récente, un pic de sortie qui
  décroît ;
- contrainte : `Σ d_t sur 365 j ≤ T`, et pour les titres récents, `Σ d_t depuis
  la sortie ≈ T` ;
- artiste = somme des titres ; pour Kiko (pas de Kworb), les 5 titres publics
  sont reconstitués à partir de leurs play counts, le reste du catalogue est
  extrapolé pour que le total mensuel soit cohérent avec les auditeurs mensuels.

Déterministe : deux builds donnent la même courbe (test).

### 4.4 Adaptateur

`src/lib/real/real-source.ts` expose la même forme que les générateurs actuels
(`streamSeries`, `dailyTotals`, `countryBreakdown`…) pour les artistes qui
ont des snapshots, et la façade `src/lib/demo/api.ts` route vers lui quand
`hasRealData(artistId)` est vrai. Aucune page ne change d'API.

Derrière une interface `StreamSource` (`getDailyStreams(artistId, range)`,
`getMonthlyListeners`, `getTopTracks`) : implémentation `SnapshotSource`
aujourd'hui, `SoundchartsSource` plus tard. Deux fichiers, une interface, pas
d'abstraction supplémentaire.

### 4.5 Export Spotify for Artists (optionnel)

Si Kiko envoie son export S4A, un parser dans `src/lib/userdata/parse-s4a.ts`
(même style que `parse-csv.ts`) le convertit en points `measured` qui
remplacent la reconstruction sur la période couverte. Si l'export n'arrive pas,
rien ne casse.

## 5. L'algo Day 1

### 5.1 Estimateur de revenus — le stream rémunérateur

Principe : partir d'un taux **mesuré pour la France** et le corriger par ce
qu'on sait de l'artiste, plutôt que d'appliquer une moyenne mondiale.

**Ancrage (mesuré, SNEP bilan 2025, côté producteur = brut master)** :
abonnement audio 553 M€ pour 122 Md de streams premium → **0,00453 €/stream
premium** ; freemium ≈ 84 M€ (déduit de « +12 %, soit +9 M€ ») pour ≈ 30 Md
de streams → **≈ 0,0028 €** ; audio mixé 80/20 → ≈ 0,0042 €. Ces trois
valeurs et leur source sont dans `params.ts`.

Pour chaque jour, titre et DSP :

```
€ brut master = streams_rémunérateurs × taux(DSP, territoire, tier)
```

1. **Rémunérabilité** — un stream compte s'il est ≥ 30 s (les compteurs
   publics Spotify sont supposés suivre cette règle ; à vérifier sur le relevé
   de Kiko), si le titre dépasse le seuil du DSP (Spotify : ≥ 1 000 streams sur
   12 mois glissants, sinon 0 €), et s'il n'est pas retiré comme artificiel
   (on n'a pas ce signal : on affiche l'hypothèse « 0 % retiré »). L'UI montre
   « streams » et « streams rémunérateurs » côte à côte.
2. **DSP** — coefficient par DSP appliqué au taux France : Spotify 0,85
   (plus de gratuit), Deezer 1,15, Apple 1,45 (pas de gratuit), Amazon 1,0,
   YouTube : clips officiels 0,25 (AVOD), art tracks « Topic » 0,7. Bornes
   basse/haute ± 15 % autour de chaque coefficient. Valeurs de départ
   (hypothèses, cohérentes avec les fourchettes publiées), à recaler par relevé.
3. **Deezer artist-centric** (modèle lancé avec Universal en 2023, étendu à la
   SACEM en 2025) — si l'artiste est « professionnel » (≥ 1 000 streams/mois
   par ≥ 500 auditeurs uniques : les trois le sont), ses streams Deezer pèsent
   ×2 ; les écoutes actives (recherche, playlist non algorithmique) ×2 encore.
   Part d'écoutes actives : hypothèse 40 % (paramètre). Poids Deezer effectif
   affiché dans l'UI — c'est un argument face à Universal.
4. **Territoire** — la page Spotify publique donne les 5 premières villes
   d'écoute ; on en déduit une répartition par zone (France/Belgique/Suisse,
   Europe, Amérique du Nord, Afrique, reste) et un taux par zone en fraction du
   taux France (départ : FR/BE/CH 1,0 ; Europe 0,9 ; Amérique du Nord 1,1 ;
   Afrique 0,15 ; reste 0,5). Pour Kiko, c'est le correctif principal.
5. **Tier** — part premium/gratuit : 80/20 (France) par défaut ; le relevé
   distributeur, qui sépare Spotify Free et Premium par pays, la remplace.

Sorties : jour, semaine, mois, année glissante, en **fourchette** basse /
centrale / haute, avec un **niveau de confiance** :

- *élevé* : période mesurée, taux et mix calibrés par relevé ;
- *moyen* : mesuré avec paramètres par défaut, ou reconstitué avec calibration ;
- *indicatif* : reconstitué et paramètres par défaut.

Deux cascades, affichées séparément :

- **Master** : brut master → vue label = brut ; vue artiste = brut ×
  part contractuelle (simulée, cohérente avec `dealType` : distribution 85–100 %,
  deal artiste 18–25 % du net, recoupement ignoré dans la démo).
- **Édition (droits d'auteur)** : ≈ 15 % du chiffre DSP part vers l'édition ;
  l'artiste auteur-compositeur en touche sa part via la SACEM (paramètre de
  départ : 50 % de la part édition, simulé par titre selon les splits).

Précision attendue (avis, à vérifier sur Kiko) : ± 25 % sans relevé, ± 20 %
avec le mix corrigé, ± 5 % après calibration.

### 5.2 Mix DSP par artiste

Parts de marché France streaming audio (hypothèse de départ, dans
`params.ts`) : Spotify 55 %, Deezer 17 %, Apple 14 %, Amazon 6 %, YouTube Music
5 %, autres 3 %.

Correction par artiste avec deux signaux réels : `r = fansDeezer / auditeursMensuelsSpotify`
pour Deezer ; pour YouTube, pas d'estimation : les vues sont mesurées (§3).
La médiane de marché `r₀` est un paramètre (départ : 0,25). Le poids Deezer de
l'artiste est multiplié par `clamp(r / r₀, 0,5, 2,5)`, puis le mix est
renormalisé. Dadju (r ≈ 0,51) voit sa part Deezer relevée ; Kiko (à mesurer)
probablement abaissée. Chaque DSP affiche « mesuré » (Spotify) ou « estimé ».

### 5.3 Calibration par relevé

Quand un relevé distributeur est importé (mode « Mes données » existant), on
calcule le taux effectif réel par DSP et par territoire sur la période, et il
remplace le taux par défaut pour les estimations suivantes. Le mix réel
remplace le mix estimé. Dans la démo, on le montre sur Kiko avec un relevé
simulé cohérent si le vrai n'arrive pas.

### 5.4 Écart d'audit

`écart = estimé_central − déclaré` par DSP et par période. Au-delà d'un seuil
relatif (paramètre, départ 12 %) et absolu (100 €), un `AuditFinding` est
produit, **toujours attribué au DSP** (jamais au distributeur ni au label — même
logique que la tension Believe §2.6 du brief). Pour Dadju et Nono, le relevé
est simulé de sorte qu'un écart plausible apparaisse sur Spotify.

### 5.5 Position algo, Day 1 Index, Pulse

- **Position algo** : alimenté par le réel — ratio streams quotidiens /
  auditeurs mensuels (intensité d'écoute), concentration du catalogue (part du
  titre n°1 dans le quotidien), tendance 7 j / 28 j, nombre de titres actifs
  (> 1 000 streams/j).
- **Day 1 Index** : recalculé à partir de ces signaux plus les composantes
  simulées existantes ; la formule actuelle est conservée, seules les entrées
  changent.
- **Pulse** : le brief du matin cite les chiffres réels de la veille (« Hier :
  1,59 M streams, ~4 400–6 200 € bruts estimés »).

## 6. Roster, personas, provenance

- `LABEL` devient `{ id: "day1-dashboard-pro", name: "Day 1 Dashboard Pro" }`.
- `ARTISTS` = Kiko (`kiko`, Afro-pop / rap, `dealType: "distribution"`,
  `careerStage: "emerging"`, TG/FR), Dadju (`dadju`, R&B / pop urbaine,
  `dealType: "artiste"`, `established`, FR), Nono La Grinta (`nono-la-grinta`,
  rap, `dealType: "artiste"`, `developing`, FR). `monthlyListeners` et
  `growthRate` viennent des snapshots ; `hue`, `initials`, `day1Index`,
  `signedSince` sont simulés.
- Les 6 artistes fictifs et leurs tracks/contrats/splits sont retirés de
  `data.ts`. Les pages qui comptaient sur 6 artistes pour « avoir du relief »
  (roster, P&L par artiste, comparatif, A&R Watch) doivent rester lisibles à 3 ;
  A&R Watch garde ses artistes émergents fictifs (ce ne sont pas des membres du
  roster).
- `DEMO_ARTIST_ID` passe à `dadju` : la vue artiste par défaut est Dadju.
- Le badge « DÉMO » de la topbar reste. Un badge de provenance (`mesuré` /
  `reconstitué` / `simulé`) apparaît sur les KPI et en légende des graphes,
  discret, avec tooltip expliquant la source. Face à Universal, l'honnêteté sur
  la provenance est un argument.

## 7. Canal Universal

- Route `src/app/welcome/page.tsx`, hors du groupe `(dashboard)` (pas de
  sidebar), paramètre `?source=universal|believe`, source inconnue ou absente →
  variante « direct ».
- Écran co-brandé « UNIVERSAL × FROM DAY 1 » porté depuis
  `legacy/From-Day-1_Dashboard-Prototype.html` (structure : bandeau
  co-brandé, accroche, incentive, trois étapes, premier insight, bloc « ce que
  cet onboarding résout », sidebar par défaut). Contenu Universal :
  - accroche : « Vos artistes voient enfin ce que vous voyez — et vous voyez ce
    que les plateformes ne vous disent pas. » ;
  - étapes : 1) connexion catalogue Universal (roster, contrats, relevés
    semestriels) → 2) cartographie contrats & droits (options, recoupements,
    fins de période, splits, SACEM) → 3) premier brief roster ;
  - « ce que cet onboarding résout » : transparence des relevés artistes →
    rétention, moins de litiges ; alertes contractuelles → aucune option ni fin
    de période ratée ; signaux A&R en continu → roster piloté à la donnée ;
    audit DSP côté label → récupérer ce que les plateformes sous-paient ;
    portail artiste co-brandé → l'artiste comprend ses gains ;
  - sidebar par défaut = vue label.
- Believe porté à l'identique du proto (contenu du brief), pour montrer le
  template.
- Universal ajouté comme 7ᵉ canal dans le board `/onboardings` (statut « en
  discussion »).
- Toutes les chaînes dans `src/messages/{fr,en}/welcome.json` (ESLint
  anti-hardcode, test de parité existant).

## 8. Architecture — fichiers

Nouveaux :

```
scripts/snapshot.mjs
src/lib/real/snapshots/<artistId>/<date>.json
src/lib/real/index.ts            // hasRealData, loadSnapshots
src/lib/real/stream-source.ts    // interface StreamSource + SnapshotSource
src/lib/real/reconstruct.ts      // §4.3
src/lib/real/real-source.ts      // §4.4
src/lib/real/params.ts           // taux, parts de marché, seuils, r₀
src/lib/real/estimator.ts        // §5.1
src/lib/real/dsp-mix.ts          // §5.2
src/lib/real/territory.ts        // §5.1 point 4 — villes → zones → coefficient
src/lib/real/calibration.ts      // §5.3
src/lib/real/audit-gap.ts        // §5.4
src/lib/userdata/parse-s4a.ts    // §4.5, optionnel
src/app/welcome/page.tsx
src/components/modules/welcome/* // écran co-brandé, données par source
src/components/ui/provenance-badge.tsx
src/messages/{fr,en}/welcome.json
```

Modifiés : `src/lib/demo/data.ts` (roster), `seed.ts`, `types.ts`
(`provenance`, champs Deezer/Spotify ids sur `Artist`), `api.ts` (routage vers
`real-source`), `generators.ts` (recalibrage autour du réel), `role.tsx`
(`DEMO_ARTIST_ID`), les modules Pulse / Streams / Revenus / Position algo /
Audit / Day 1 Index / Roster (consommation des nouvelles sorties + badges),
`package.json` (script `snapshot`), tests existants qui nomment le roster.

## 9. Vérification

1. **État témoin** avant toute modification : `npm run build`, `npm test`,
   `npm run lint` — sortie brute conservée dans `docs/superpowers/qa/`.
2. Tests unitaires (vitest) : reconstruction (déterminisme, contrainte de
   somme, saisonnalité), estimateur (fourchettes, confiance), mix DSP
   (correction et renormalisation), calibration (le taux importé remplace le
   défaut), écart d'audit (seuils, attribution DSP), parser S4A, parité
   fr/en.
3. Tests existants adaptés au roster à 3.
4. Audit visuel Playwright existant (`e2e/visual-audit.spec.ts`) sur les 3
   thèmes, pages touchées + `/welcome`.
5. Déploiement `vercel deploy --prod`, captures de la **prod** montrées à Gaël.
6. Mercredi soir : répétition du parcours de démo, chronométrée, sur la prod.

## 10. Parcours de démo (à répéter)

1. `/welcome?source=universal` — le canal.
2. Vue label : `/roster` → les trois artistes, chiffres réels → zoom Dadju.
3. `/pulse` Dadju : le brief du matin avec la veille réelle.
4. `/streams` puis `/revenue` : mesuré vs estimé, fourchette, mix DSP.
5. `/audit` : l'écart estimé/déclaré, la lettre prête.
6. Bascule persona → vue artiste Dadju : ce que lui voit, sa part.
7. Kiko : le cas indé, import relevé → calibration.

## 11. Calendrier

- **Mardi 15** : état témoin, script snapshot + premier snapshot, roster réel,
  reconstruction, adaptateur.
- **Mercredi 16** : estimateur, mix DSP, calibration, écart d'audit, badges,
  modules alimentés ; snapshot du jour ; canal Universal + Believe.
- **Jeudi 17** : snapshot, polish, audit visuel, déploiement prod, répétition.
- **Jeudi 18** (à confirmer) : réunion. Snapshot le matin, redéploiement si
  utile.

## 12. Risques et angles morts

- Kworb ou la page Spotify changent de format d'ici jeudi → le script signale,
  on garde le dernier snapshot valide.
- Les taux par stream sont des hypothèses : affichés en fourchette et
  étiquetés, jamais un chiffre net.
- Deezer id de Kiko à vérifier par ses titres avant de l'utiliser.
- Clé YouTube Data API à créer par Gaël (Google Cloud, gratuit). Sans clé, le
  script lit les pages publiques YouTube (`viewCount` dans le HTML), avec la
  même provenance `measured` ; l'API reste la voie à garder en prod.
- Pas de vrai relevé pour Dadju et Nono : l'écart d'audit est une mise en
  scène cohérente, et on le dit si on nous le demande.
- Je n'ai pas encore relancé build et tests : l'état témoin de mardi peut
  révéler des surprises après deux mois sans commit.
