# Parcours de démo — Universal, vendredi 19 septembre 2026

Prod : https://deploy-one-tawny-59.vercel.app — état au 17/09 (branche `demo-universal`, audit visuel `docs/superpowers/qa/2026-09-17-audit-visuel.md`, snapshots jusqu'au 16/09).
Avant la réunion : `npm run snapshot` → commit → `vercel deploy --prod --yes` (un jour mesuré de plus ; la puce de date de Pulse affichera alors « jeudi 18 septembre » = dernier jour de snapshot).
Le persona et le thème sont mémorisés dans le navigateur : régler **thème nuit + vue structure** avant d'entrer en salle, puis suivre l'ordre. Écran ≥ 1440 px de large de préférence (à 1280 les KPIs de Pulse passent en petit corps, sans dépasser).

Les chiffres ci-dessous sont ceux du 17/09 ; ils bougeront avec le snapshot du 19.

| # | URL | Ce qu'on montre | Le chiffre à pointer | Si on nous demande « c'est vrai ? » |
|---|---|---|---|---|
| 1 | `/welcome?source=universal` | Le canal co-brandé, 3 étapes, le premier insight | **187 291 €** d'écart estimé / déclaré sur les 3 artistes (T2 2026) | Écart calculé par notre algo entre streams publics et un relevé **simulé** — le vrai relevé le remplacera |
| 2 | CTA → `/roster` (vue structure) | Les 3 artistes réels, streams 30 j, revenus, valorisation | Dadju 135,2 M streams / 30 j ; Kiko 644,5 k | Streams : Spotify **mesuré** (Kworb + page publique), autres DSP **estimés** ; revenus non-streaming et dépenses : simulés, dimensionnés |
| 3 | `/pulse` (roster) → clic Dadju | Le brief du matin sur le réel : « Reine 171,5 k streams hier » | Streams aujourd'hui **4,2 M** badge *mesuré* ; « Ce que ça rapporte » : 16,1 k€ hier / 519 k€ 30 j (Dadju) — 27,5 k€ / 847 k€ pour le roster | Badges de provenance sur chaque chiffre : mesuré / reconstitué / estimé |
| 3b | (même page) carte **TikTok · signal**, badge *simulé* | Le signal de viralité à côté des streams : « ≈ 115,4 k vidéos utilisent les sons de Dadju, n° 45 des tendances France » | La note sous la carte : « signal de viralité, pas un stream rémunéré » | **Simulé** en attendant Soundcharts — on montre la place du signal, pas la mesure ; ne pas le vendre comme un chiffre |
| 4 | `/streams` | Répartition par plateforme, légende de provenance | Spotify 64,2 M / 30 j (47,5 %) ; Deezer, Apple, Amazon estimés | Personne n'a les streams Apple/Deezer/Amazon d'un artiste — nous non plus, on le dit |
| 5 | `/revenue?period=day` | Estimation live : **sélecteur de période** (Hier → 12 mois) en haut à droite, la tuile choisie est cernée ; le tableau « Par plateforme » suit la période | Hier : brut master **16 051 €** (13 944 – 18 159) ; Spotify 2 M streams → 6 141 € à 0,0031 €/stream *mesuré*, Deezer 0,0059 *estimé* | Ancrage SNEP 2025 (553 M€ / 122 Md streams), corrigé plateforme, territoire, Deezer artist-centric. Cliquer « 30 jours » : 519 k€, la tuile se déplace, l'URL aussi (`?period=month`) |
| 5b | (même page) panneau **« Sa part, c'est son contrat »**, badge *simulé* | La part artiste est une hypothèse tant que le contrat n'est pas renseigné : trois onglets — pourcentages, import du contrat (lu localement, jamais envoyé), courrier de demande | « Aujourd'hui, la part de Dadju est **simulée (20 %)** pour la démo » | À dire : « on ne connaît pas son contrat, on ne l'invente pas : 20 % est une hypothèse de contrat d'artiste ; le jour où le label ou l'artiste renseigne le vrai pourcentage, toutes les cascades se recalculent et le badge passe à *renseigné* ». Ne pas saisir de valeur en salle (persistée dans le navigateur) |
| 6 | `/audit` | L'écart estimé / déclaré, la lettre prête | « Spotify · écart estimé/déclaré 2026-T2 : −104 753 € » ; montant récupérable 109 056 € | Toujours attribué au DSP, jamais au label ni au distributeur |
| 7 | Bascule persona → vue artiste (Dadju) | Ce que voit l'artiste : sa part, le rappel « Ta part artiste est simulée » avec le bouton « Renseigner ma part » | Gains estimés hier **3 210 €** (part artiste 20 % simulée) | La part contractuelle est simulée ; le vrai contrat la remplace |
| 8 | Roster → Kiko | Le cas indé : 24 k auditeurs, écoute en Afrique | ≈ 6 €/jour (21,1 k streams), coefficient territorial | La même écoute ne vaut pas le même prix selon le pays — c'est mesuré sur ses 5 villes (Lomé, Abidjan, Cotonou, Kinshasa, Conakry) |
| 9 | `/onboardings` (si le temps) | La carte **Universal Music France** — « Major · Priorité absolue », prochaine action « Présentation du 19/09 » | 4 partenaires en discussion, 1 pilote | Pipeline interne, statuts modifiables (persistés dans le navigateur) |

## Ce qui est vrai / reconstitué / estimé / simulé
- **Mesuré** : auditeurs mensuels et abonnés Spotify, play counts des 5 titres phares (delta J/J-1), total et débit quotidien par titre Kworb (Dadju, Nono), fans Deezer, vues YouTube par clip (delta J/J-1), les 5 villes d'écoute.
- **Reconstitué** : l'historique quotidien avant le 15/09 (ancré sur le réel, marqué comme tel) — sur 30 jours, Spotify porte donc le badge *reconstitué*, pas *mesuré*.
- **Estimé** : streams Deezer / Apple / Amazon / autres (mix DSP), tous les € (fourchette + confiance).
- **Simulé** : contrats et parts (20 % par défaut), splits, dépenses, relevés déclarés, tournée, équipe, droits SACEM/ADAMI, valorisation, signal TikTok.

## Points de jugement à assumer si on les soulève
- Deezer pèse lourd chez Dadju (3,3 M de fans Deezer) : hypothèses rendues conservatrices le 16/09, Spotify reste n°1.
- Valorisation catalogue roster ≈ 191 M€ : multiples simulés sur des revenus estimés — dire « ordre de grandeur, méthode NPS × multiple ».
- Kiko ≈ 170 €/mois : conséquence du territoire, pas un bug.
- Le premier insight de la page Believe reprend l'écart du roster entier : ne pas ouvrir `/welcome?source=believe` devant Universal.

## Répétition
Chronométrer le parcours complet (objectif 8 minutes). Noter le temps ici : ______
