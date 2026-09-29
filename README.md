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

## La coque à onglets

Une fois connecté, tout passe par la coque, `Coque` (`src/coque/Coque.tsx`, export par défaut) :
la page de l'onglet courant au-dessus, la barre de cinq onglets en bas (`ONGLETS`, même fichier,
dans l'ordre de l'appli Android). Elle est montée dans `App.tsx` sous `RouteProtegee` : sans
session, toute route mène à `/connexion` ; une route inconnue ramène à `/`.

| Onglet | Chemin | Icône Tabler | Page |
|---|---|---|---|
| Accueil | `/` | `building-pavilion` | `pages/Accueil.tsx` (provisoire : il salue) |
| Voyage | `/voyage` | `route` | `pages/Voyage.tsx` (attente : « La carte arrive ») |
| Suivis | `/suivis` | `chair-director` | `pages/Suivis.tsx` (attente) |
| Au ciné | `/au-cine` | `ticket` | `pages/AuCine.tsx` (attente) |
| Profil | `/profil` | `armchair` | `pages/Profil.tsx` : le pseudo, « Se déconnecter » |

**Brancher une page** : la déclarer en route enfant de `<Route element={<Coque />}>` dans
`App.tsx`, avec un chemin relatif. La page d'un onglet remplace l'élément de sa route
(`<Route path="voyage" element={<Carte />} />`) ; ses sous-pages vivent sous son préfixe
(`<Route path="voyage/:annee" element={…} />`) et gardent l'onglet marqué, puisqu'un onglet reste
actif sur tout ce qui commence par son chemin. Une route hors de ce bloc n'a ni barre ni garde.

La page s'affiche dans le `<main>` de la coque, qui est `position: relative` et remplit la hauteur
au-dessus de la barre : une page plein écran s'y pose en `position: absolute; inset: 0`. Un
élément en `position: fixed` doit laisser libre le bas de l'écran, `var(--coque-bas)` (la barre et
la zone sûre du téléphone) ; la barre est au-dessus de tout le reste (`--z-barre-onglets`, 20).

Les icônes viennent de `@tabler/icons-react`, importées une à une par leur nom : le build n'en
garde que celles-là.

## Le thème

`src/ui/theme.css` porte tout l'habillage de l'app hors du Voyage, en variables CSS : couleurs,
polices, tailles de texte, espacements, rayons, ombres, gabarits. Une base neutre, en clair et en
sombre (le réglage du téléphone ; `data-theme="clair"` ou `"sombre"` sur `<html>` force l'un ou
l'autre). Les `*.module.css` des composants ne portent aucune valeur en dur : redessiner l'app,
c'est changer ces variables, puis au besoin les styles des composants, sans toucher au code.
`src/ui/theme.test.ts` y veille : hors du Voyage (dossiers `carte/`, `mondes/`, `voyage/`, fichiers
`Voyage*.module.css`), une feuille qui porte une couleur ou un nombre en dur (hormis `0`, `100%`,
`100dvh`, `flex: 1`) ou lit une variable absente de `theme.css` fait échouer les tests ; le même
fichier garde la zone sûre de la barre d'onglets.
Seuls `theme-color` (`index.html`) et les couleurs du manifeste (`vite.config.ts`) restent à
accorder à la main.

Le Voyage a son habillage à lui, par décennie : `src/ui/voyage.css` (les quatre couleurs de
`../biblio-android/docs/design.md`, la classe `.celebration`). Le thème général ne les lit pas.

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
