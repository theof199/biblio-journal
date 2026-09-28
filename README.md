# Journal — le web app de la médiathèque

Le journal des films du propriétaire, en application web installable, servie sous
`https://mini-mediatheque.fr/journal/` par-dessus l'API de `../biblio-back`. Conception dans
`../biblio-back/docs/superpowers/specs/2026-09-28-journal-web-design.md`, apparence héritée de
`../biblio-android/docs/design.md`.

## Démarrer

    npm ci
    npm run dev

`http://localhost:5174/journal/`, par-dessus l'instance locale de l'API (`http://localhost:3000`),
lancée dans `../biblio-back` par `bin/dev`. Une autre cible se fixe par `VITE_API_TARGET`, en
variable de shell ou dans un `.env.local` : `vite.config.ts` la lit par `loadEnv`, et son proxy
relaie `/api` (préfixe retiré) et `/covers` vers elle, pour que le cookie de session reparte sur la
même origine (`SameSite=Lax`). L'instance en ligne se vise **avec** son `/api`
(`VITE_API_TARGET=https://mini-mediatheque.fr/api`) : le proxy retire le préfixe, la cible le
remet. L'origine nue enverrait `/api/auth/me` sur `/auth/me`, que le nginx du front sert par son
`index.html` : l'app répondrait `MALFORMED` partout.

## Commandes

    npm run dev            # serveur de développement
    npm run build           # tsc --noEmit puis vite build, dans dist/
    npm run preview          # sert dist/ localement, port 5174
    npm run lint             # eslint, zéro avertissement toléré
    npm test                 # vitest, une fois
    npm run types:check      # le contrat régénère-t-il les mêmes types ?

## Le contrat

`contract/openapi.json` est une copie de `../biblio-back/docs/openapi.json`, et `src/api/types.ts`
en est engendré par `openapi-typescript` : ni l'un ni l'autre ne se modifie à la main.

    npm run contract:pull   # recopie le contrat depuis ../biblio-back (BACK_REPO pour un autre chemin), puis régénère les types
    npm run types            # régénère seulement les types, si le contrat a déjà bougé

La CI (`npm run types:check`) refuse une dérive entre les deux, et `livrer.yml` (dans
`biblio-back`) refuse un tag si `contract/openapi.json` n'est pas identique au contrat commité du
back : la copie se refait à la main après chaque tag.

## La PWA

Le Journal s'installe comme une app, sous la portée `/journal/` (`vite-plugin-pwa`, plugin
`VitePWA` dans `vite.config.ts`). Le service worker est **coupé en dev** (`devOptions` n'est pas
posé) : `npm run dev` ne l'enregistre jamais, seul `dist/` le fait. Il précache l'enveloppe de
l'app (JS, CSS, HTML, polices, icônes) et rien d'autre : `/api/` et `/covers/` ne sont jamais mis
en cache, une requête réseau les sert toujours. Toute navigation sous `/journal/`, avec ou sans
réseau, reçoit l'`index.html` précaché : c'est lui qui charge la version installée, jusqu'à ce que
le joueur accepte la suivante.

Une nouvelle version en ligne pendant l'usage **ne recharge jamais de force** : `<MiseAJour />`
(`src/pwa/MiseAJour.tsx`, monté dans `main.tsx`) affiche le bandeau `BandeauMiseAJour` avec un
bouton « Recharger », qui n'agit qu'à la demande.

`npm run verifier:dist` (après `npm run build`, lancé par la CI et par `livrer.yml` de
`biblio-back`) constate que le livrable est conforme : le manifeste porte sa portée, ses icônes et
sa langue ; tout chemin absolu d'`index.html` reste sous `/journal/` ; `sw.js` n'a qu'une route (la
navigation) et précache les polices ; aucun fichier du livrable ne contient `dev-login`, l'outil de
connexion réservé au développement ; le code client est celui de `registerType: 'prompt'`, pas
celui d'`autoUpdate` qui rechargerait la page dès qu'une version s'active.

Un service worker exige HTTPS hors de `localhost` : depuis le téléphone, `http://<poste>:5174/journal/`
montre l'app mais ne l'installe pas ; l'installation s'éprouve en ligne, sur
`https://mini-mediatheque.fr/journal/`.

## La livraison

Le Journal n'a pas de tag ni d'image à lui : il se livre au tag de `bibliotheque-back`. Au moment
d'un tag `vX.Y.Z`, `livrer.yml` (dans `biblio-back`) épingle
`theof199/biblio-journal@main`, construit ce commit (`npm run build` puis `npm run verifier:dist`)
et glisse le `dist/` produit dans l'image du front comme contexte Docker nommé `journal` — l'étage
`FROM scratch AS journal` de `Dockerfile.nas` (`Aceep/Library`). Le Journal n'a pas d'image propre :
il est servi sous `/journal/` par l'image `mediatheque-front`. Le corps de la Release porte
`journal_source=theof199/biblio-journal@<sha>`, écrite pour un humain, pas lue par `deployer.py`.

Avant de construire, `livrer.yml` compare `contract/openapi.json` (ce dépôt) à `docs/openapi.json`
(le back) : s'ils diffèrent, le tag est refusé avec le message
`le contrat du Journal a pris du retard sur l'API`. Remède : `npm run contract:pull` ici, une PR,
puis reposer le tag.

**Conséquence assumée : un correctif du Journal seul attend un tag de l'API.** Fusionner une PR sur
`main` ne le met pas en service ; il faut ensuite un tag `vX.Y.Z` de `bibliotheque-back`, même sans
changement côté API.
