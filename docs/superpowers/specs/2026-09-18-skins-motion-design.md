# Deux signatures — « structure » et « artiste » — avec Componentry et Motion

**Demande de Gaël (18/09, nuit)** : intégrer componentry.dev et motion.dev, sélectionner ce qui sert un design soft, professionnel, minimaliste, « 2028 pure tech pure soft » ; un style structuré pour un dirigeant de label (Bertil David) en vue structure, un style artiste en vue artiste.

**Mesuré** : Componentry = 50 composants React animés, open source, installés via le registre shadcn (`npx shadcn@latest add @componentry/<nom>`, registre `https://componentry.fun/r/{name}.json`), dépendants de framer-motion (déjà en place, v12) ; certains en WebGL (Silk Aurora, Animated Gradient) avec error boundary. Motion = Framer Motion renommé, MIT ; Motion+ (payant, paiement unique) = Ticker, AnimateNumber, Carousel, Cursor, Typewriter, ScrambleText, splitText, Curtains — non nécessaire : NumberFlow couvre les chiffres, framer-motion le reste. **Ni l'un ni l'autre n'apporte tableaux, graphiques ou planisphère** : ces briques restent shadcn / recharts / react-simple-maps.

## Principe
Une **skin** dérivée de la persona (`label` → `structure`, `artist` → `artist`), posée en `data-skin` sur le shell du dashboard, qui ne change **que** des tokens et la signature de mouvement. Les trois thèmes (nuit / aube / jour) restent. Tout mouvement respecte `prefers-reduced-motion`. Aucun effet sur les pages de données lourdes (tables, cartes) hormis les transitions de layout.

## Skin « structure » (Bertil) — précision, retenue
- Tokens : rayon 8 px, accent violet désaturé (−15 % de saturation), aucune lueur (`brand-glow` neutralisé), séparateurs en filet, chiffres tabulaires.
- Titres de page : `KineticTextReveal` (mots, vers le haut, 280 ms, stagger 25 ms) — une fois par navigation.
- Roster / tableaux : transitions `layout` framer-motion sur le tri et les filtres (250 ms, ease-out), lignes qui glissent, pas de fondu.
- KPI : tick de NumberFlow conservé ; entrée sans translation (opacité seule).
- Welcome (`/welcome`, vue structure) : `StickyScrollCards` pour les trois étapes **uniquement sur cette page** (dépendance `lenis` isolée à cette route).

## Skin « artiste » — chaleur, souffle
- Tokens : rayon 14 px, accent violet plus chaud (+8° de teinte, +10 % de saturation), `brand-glow` doux conservé sur le héros.
- Pulse artiste : fond du héros en `SilkAurora` (WebGL, opacité 0,18, teintes de la marque, désactivé si reduced-motion ou si WebGL indisponible → fond plat), ligne de salutation « Bonjour Dadju » en `LetterCascade`.
- Titres de page : `TextMorph` à la bascule d'artiste (le nom se transforme), sinon `KineticTextReveal` doux (caractères, 400 ms).
- Board d'estimation : tuiles en entrée décalée (stagger 60 ms) ; badges de provenance inchangés.
- Welcome (`/welcome`, vue artiste) : `AnimatedGradient` très léger derrière le bandeau co-brandé.

## Ce qu'on n'installe pas
Split Flap Display (gadget, illisible pour un label), Matrix Rain, Image Ripple/Trail, Eye Tracking, Particle Typography, Music Player (pas d'audio ni de pochettes réels), Motion+ (pas nécessaire).

## Garde-fous
- Aucun changement sur `main`/prod avant validation : branche `motion-skins`, déploiement **preview** Vercel.
- Tests et audit visuel Playwright verts ; détecteur impeccable rejoué sur Pulse / Roster / Revenus / Welcome : les signalements « dark-glow », « ai-color-palette » ne doivent pas augmenter en skin structure.
- Budget performance : Pulse artiste ≤ +150 ms de TTI sur un MacBook ; WebGL uniquement sur le héros.
