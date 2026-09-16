# Parcours de démo — Universal, jeudi 18 septembre 2026

Prod : https://deploy-one-tawny-59.vercel.app — état au 16/09 soir (commit `7721425`, snapshots du 15 et du 16).
Avant la réunion : `npm run snapshot` → commit → `vercel deploy --prod --yes` (un jour mesuré de plus).
Le persona et le thème sont mémorisés dans le navigateur : régler **thème nuit + vue structure** avant d'entrer en salle, puis suivre l'ordre.

| # | URL | Ce qu'on montre | Le chiffre à pointer | Si on nous demande « c'est vrai ? » |
|---|---|---|---|---|
| 1 | `/welcome?source=universal` | Le canal co-brandé, 3 étapes, le premier insight | **138 472 €** d'écart estimé / déclaré sur les 3 artistes (T2 2026) | Écart calculé par notre algo entre streams publics et un relevé **simulé** — le vrai relevé le remplacera |
| 2 | CTA → `/roster` (vue structure) | Les 3 artistes réels, streams 30 j, revenus, valorisation | Dadju 17,6 M streams / 30 j ; Kiko 361 k | Streams : Spotify **mesuré** (Kworb + page publique), autres DSP **estimés** ; revenus non-streaming et dépenses : simulés, dimensionnés |
| 3 | `/pulse` (roster) → clic Dadju | Le brief du matin sur le réel : « Reine 85 k streams hier » | Streams aujourd'hui **3,3 M** badge *mesuré* ; « Ce que ça rapporte » : 19,5 k€ hier / 614 k€ 30 j (roster) | Badges de provenance sur chaque chiffre : mesuré / reconstitué / estimé |
| 4 | `/streams` | Répartition par plateforme, légende de provenance | Spotify 1,6 M/j mesuré ; Deezer, Apple, Amazon estimés | Personne n'a les streams Apple/Deezer/Amazon d'un artiste — nous non plus, on le dit |
| 5 | `/revenue` | Estimation live + tableau par plateforme | Brut master 30 j ≈ 480 k€ (Dadju) ; taux effectif €/stream par DSP | Ancrage SNEP 2025 (553 M€ / 122 Md streams), corrigé plateforme, territoire, Deezer artist-centric |
| 6 | `/audit` | L'écart estimé / déclaré, la lettre prête | « Spotify · écart estimé/déclaré 2026-T2 : 84,6 k€ » | Toujours attribué au DSP, jamais au label ni au distributeur |
| 7 | Bascule persona → vue artiste (Dadju) | Ce que voit l'artiste : sa part | Gains estimés hier **2,6 k€** (part artiste 20 % simulée) | La part contractuelle est simulée ; le vrai contrat la remplace |
| 8 | Roster → Kiko | Le cas indé : 24 k auditeurs, 100 % Afrique | ≈ 3 €/jour, coefficient territorial 0,15 | La même écoute ne vaut pas le même prix selon le pays — c'est mesuré sur ses 5 villes (Lomé, Abidjan, Cotonou, Kinshasa, Conakry) |

## Ce qui est vrai / reconstitué / estimé / simulé
- **Mesuré** : auditeurs mensuels et abonnés Spotify, play counts des 5 titres phares (delta J/J-1), total et débit quotidien par titre Kworb (Dadju, Nono), fans Deezer, vues YouTube par clip (delta J/J-1), les 5 villes d'écoute.
- **Reconstitué** : l'historique quotidien avant le 15/09 (ancré sur le réel, marqué comme tel).
- **Estimé** : streams Deezer / Apple / Amazon / autres (mix DSP), tous les € (fourchette + confiance).
- **Simulé** : contrats, splits, dépenses, relevés déclarés, tournée, équipe, droits SACEM/ADAMI, valorisation.

## Points de jugement à assumer si on les soulève
- Deezer pèse lourd chez Dadju (3,3 M de fans Deezer) : hypothèses rendues conservatrices le 16/09, Spotify reste n°1.
- Valorisation catalogue roster ≈ 154 M€ : multiples simulés sur des revenus estimés — dire « ordre de grandeur, méthode NPS × multiple ».
- Kiko ≈ 100 €/mois : conséquence du territoire, pas un bug.

## Répétition
Chronométrer le parcours complet (objectif 8 minutes). Noter le temps ici : ______
