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
| Accueil | `/` | `building-pavilion` | `pages/Accueil.tsx` : le fronton, « Ce soir », « Ensuite », la grille du journal |
| Voyage | `/voyage` | `route` | `pages/Carte.tsx` : la carte (plus bas) ; sous-pages `voyage/:annee` (`pages/VoyageAnnee.tsx`, la fiche d'une année), `voyage/:annee/films/:filmId` (`pages/VoyageFilm.tsx`), `…/billet` et `…/billet/corriger` (`pages/VoyageBillet.tsx`) : « Les pages du Voyage », plus bas |
| Suivis | `/suivis` | `chair-director` | `pages/Suivis.tsx` : réalisateurs et sagas suivis ; sous-pages `suivis/realisateurs/:tmdbId`, `suivis/sagas/:tmdbId`, `suivis/films/:tmdbId` |
| Au ciné | `/au-cine` | `ticket` | `pages/AuCine.tsx` : mes séances et les sorties en salle |
| Profil | `/profil` | `armchair` | `pages/Profil.tsx` : le pseudo, les chiffres de `/stats`, le bilan (dont les réalisateurs et sagas suivis) et les graphiques (`profil/`), « Mes films » (`pages/MesFilms.tsx`, sous `/profil/mes-films`), l’import Letterboxd (`pages/ImportLetterboxd.tsx`, sous `/profil/import-letterboxd`), « Se déconnecter », la mention TMDB |

Hors des onglets, la barre restant visible : `recherche`, `journal/nouveau`, `journal/:id` et
`journal/:id/corriger` (`Recherche`, `Formulaire`, `Fiche`).

**Brancher une page** : la déclarer en route enfant de `<Route element={<Coque />}>` dans
`App.tsx`, avec un chemin relatif. La page d'un onglet remplace l'élément de sa route
(`<Route path="voyage" element={<Carte />} />`) ; ses sous-pages vivent sous son préfixe
(`<Route path="voyage/:annee" element={…} />`) et gardent l'onglet marqué, puisqu'un onglet reste
actif sur tout ce qui commence par son chemin. Une route hors de ce bloc n'a ni barre ni garde.

La page s'affiche dans le `<main>` de la coque, qui est `position: relative` et remplit la hauteur
au-dessus de la barre : une page plein écran s'y pose en `position: absolute; inset: 0`. Un
élément en `position: fixed` doit laisser libre le bas de l'écran, `var(--coque-bas)` (la barre et
la zone sûre du téléphone) ; la barre est au-dessus de tout le reste (`--z-barre-onglets`, 20).

Le document ne défile pas : ce `<main>` est la seule zone qui défile. Elle se comporte comme le
navigateur (`coque/defilement.ts`) : une navigation nouvelle part du haut, un retour dans
l'historique retrouve la position que la page avait, en attendant au besoin qu'une liste ait
rechargé ses pages (cinq secondes au plus, et jamais contre un geste du membre). Le bouton
« Retour » des pages sans onglet (`ui/BoutonRetour.tsx`) recule donc dans l'historique dès qu'il y a
de quoi ; son `vers` n'est que le repli d'une page ouverte d'un lien.

Les icônes viennent de `@tabler/icons-react`, importées une à une par leur nom : le build n'en
garde que celles-là.

## La carte de `src/`

| Dossier | Rôle |
|---|---|
| `api/` | Le client (`client.ts`), les clés de cache (`cles.ts`) et un fichier par famille de routes ; `types.ts` est engendré du contrat. |
| `session/`, `coque/`, `pwa/`, `ui/` | La session et sa route gardée, la coque à onglets, le bandeau de mise à jour, le thème et les petits composants communs. |
| `pages/` | Une page par route (`App.tsx` les branche). |
| `accueil/`, `cinema/`, `formulaire/`, `mesFilms/`, `profil/`, `recherche/`, `suivis/` | Les règles pures et les morceaux de chaque onglet, testés sans réseau ni rendu. |
| `voyage/`, `carte/`, `mondes/` | Le Voyage : les règles, le moteur de la carte, un dossier par monde (plus bas). |
| `test/` | Les doublures et les gabarits des tests (le contexte de dessin factice, le moteur factice, le faux serveur). |

## La carte du Voyage

L'onglet Voyage (`/voyage`, dans la coque) montre `pages/Carte.tsx` : la carte du Voyage du membre,
lue sur `GET /me/voyage`, avec son ticket, sa marche d'une année à l'autre, la roulotte du Voyage
suivi et l'adieu d'un monde. Où vit quoi :

- `src/voyage/regles.ts` : les règles côté client (l'état d'une case, la jauge, le prochain pas,
  la frontière d'une avancée), sans dessin.
- `src/carte/` : le moteur (`moteur.ts`, sur un `<canvas>`, monté par `CarteCanvas.tsx`), la
  géométrie, le toucher, la mise en scène d'une avancée (`avancee.ts`) et le dessin commun à tous
  les mondes (`dessin/`).
- `src/mondes/` : l'interface d'un monde (`types.ts`), le registre (`index.ts`), un dossier par
  décennie (`1890/`) et le monde « à venir » (`avenir/`) des décennies sans chantier.

**Voir la carte sans API de dev.** Le proxy peut viser l'instance en ligne :
`VITE_API_TARGET=https://mini-mediatheque.fr/api npm run dev`, puis se connecter avec le pseudo et
le mot de passe du propriétaire (formulaire de `/connexion`). Sans elle, la carte n'a que les
données de l'API locale.

**« Moins d'animations »** (`prefers-reduced-motion`, lu par `ui/mouvement.ts`) met le moteur au
calme : l'horloge du décor s'arrête (image figée, sans particules), la marche et l'adieu finissent
d'un coup, la roulotte se gare, et une foire qui se bâtit est posée déjà bâtie ; si le réglage
change pendant un chantier, il s'achève.

**L'ouverture et les deux pastilles.** La caméra ne défile pas sous 0 : sans vide, la première case de
1895 (à 150 px du haut de son monde) tombait sous le bandeau. `placement.ts` laisse donc `MARGE_HAUT`
au-dessus de la première section, que le ciel du monde remplit ; la caméra, à l'ouverture, met
l'avatar vers le milieu de l'écran quelle que soit l'année (`carte/depart.test.ts`). En bas à droite,
deux pastilles rondes à icône (nom dans `aria-label`) : la vue d'ensemble, et « Tu es ici », qui ne
s'offre que quand le moteur dit l'avatar hors de l'écran (rappel `avatarVisible`).

**Quand la foire se bâtit.** À l'ouverture d'une année, au bout de la marche de l'avatar, la
caméra allant chercher le chantier s'il est hors de l'écran ; la séance de 1895, elle, à la toute
première visite d'un membre (aucune année vue, l'avatar au départ du Voyage). Jamais au
rechargement ni au retour sur la carte : l'appareil garde la dernière année montrée, par membre
(`journal.carte.annee-vue.<membre>`, `carte/memoire.ts`).

**Les images.** Chaque dossier `assets/` (`src/carte/assets/` pour les images communes,
`src/mondes/<décennie>/assets/`) a son `CREDITS.md`, où chaque fichier porte son œuvre, sa source,
sa licence et son traitement (`src/test/credits.test.ts` l'exige). `mondes/1890/assets/virer.sh`
cuit la rampe sépia dans une image ou une extraction vidéo. `npm run verifier:dist` constate sur
`dist/` que chaque `.webp` ou `.png` est précaché et sous son plafond (384 Kio), qu'aucune
`.webm` ne l'est (plafond 600 Kio), et que les images tiennent ensemble dans 1,5 Mio.

## Les pages du Voyage

Toucher une année de la carte ouvre sa fiche, `/voyage/:annee`, lue sur
`GET /me/voyage/annees/{annee}` à chaque ouverture (plan 2b). Selon la forme que rend l'API : l'année
en cours ou bouclée (la corde des billets, le boniment, le programme, la parade du podium, la séance
du soir, les salles, le ticket), une année fermée (la pancarte, le chemin, mes films vus en avance),
une année qui attend le Voyage suivi (« Tu le rattrapes bientôt »), ou l'ouverture qui s'écrit
(relue toutes les cinq secondes, trente-six fois au plus, puis « Réessayer »). Une affiche de salle
ouvre la fiche du film, `/voyage/:annee/films/:filmId` (`filmId` est la ligne de salle, pas un
identifiant TMDB) : la projection, le guichet, le programme et ses bobines. « Je l’ai vu » ouvre le
billet de séance (`…/billet`, `?bobine=<tmdb_id>` pour une bobine d'un programme), « Corriger » le
billet de correction (`…/billet/corriger`, l'entrée du journal dans l'état de navigation) ;
composter enregistre le visionnage comme le formulaire du journal (`creerVisionnage`, ou
`construirePatch` en correction) et revient à l'année.

Où vit quoi :

- `src/voyage/` : les règles pures de ces pages (`annee.ts`, `salles.ts`, `podium.ts`, `seance.ts`,
  `film.ts`, `billet.ts`, `feuille.ts`, `relecture.ts` pour les intervalles et les plafonds des
  relectures) et leurs composants (`annee/`, `salles/`, `parade/`, `seance/`, `film/`, `billet/`,
  la feuille du chroniqueur `Feuille.tsx`, le petit calque des choix `Feuillet.tsx`, la toile
  `Toile.tsx`).
- `Monde.pages` (`src/mondes/types.ts`, `HabillagePages`) : l'habillage d'une page par la décennie
  de son année, trouvé par le registre comme pour la carte — les jetons CSS posés sur la racine de
  la page (couleurs et polices, `JETONS_DE_PAGE`), les mots (« La parade », « Ce soir à la
  baraque »), les hauteurs et les trois dessins (le bandeau d'une année, la scène d'un film,
  l'estrade du chroniqueur). Le monde « à venir » habille les années sans chantier. En 1890, les
  pages s'écrivent en IM Fell English et IM Fell English SC (`@fontsource`, précachées,
  `ui/polices.ts`).

**Les calques vivent dans l'adresse** (`voyage/calque.ts`) : `feuille=` (`ouverture`,
`generique`, `salle-<id>`, `film`), `marche=`, `podium=`, `nouvelle-salle=`, `remplacer=`. Le geste
« retour » du téléphone ferme donc un calque sans quitter la page. Ouvert par la page, il se ferme
en reculant dans l'historique ; arrivé avec l'adresse, en retirant son paramètre. Échap ne ferme
que le dernier calque ouvert (`voyage/dialogue.ts`).

**Le chroniqueur n'est appelé que sur un geste** : ouvrir une année, lire le générique, ouvrir le
contexte d'une salle qui n'est pas encore écrit, « En voir plus », « Ouvrir une nouvelle salle »,
« D’autres pistes », « Composer une séance », « Le film » (le carton). Un texte écrit ne se
redemande pas. Hors du compte IA, les gestes que l'API refuserait (`403`) ne s'affichent pas.

**Le retour d'un billet.** Le billet confie à l'année ce qu'elle doit jouer
(`voyage/annee/retour.ts` : un seul membre, trente secondes au plus) ; l'année relue, les billets
gagnés roulent sur la corde, un « +1 » tombe, la région d'état le dit, et le téléphone vibre au
palier (Android ; Safari n'a pas de vibration). Au compte IA, après une création d'un film sorti
l'année en cours, la fiche se relit toutes les cinq secondes, douze fois au plus, pour le verdict du
jury. Ni un rechargement ni le retour suivant ne rejouent rien.

**L'historique.** Depuis la fiche d'un film, composter **remplace** le billet par l'année ; depuis la
séance de l'année, il recule vers elle. La page d'un réalisateur (onglet Suivis) mène un film qui
figure dans une salle à sa fiche du Voyage (la plus ancienne année où il figure), l'onglet Voyage
marqué : « Retour » y recule jusqu'au réalisateur. Composter depuis là donne l'historique
`[réalisateur, film, année]` : le retour depuis l'année ramène au film, désormais vu, puis au
réalisateur.

**« Moins d'animations »** y pose tout à l'état final : chaque toile peint une image immobile
(repeinte au rendu et quand une police finit de charger), la feuille du chroniqueur se pose d'un
coup sans minuterie, la corde ne se balance plus, les compteurs sont à leur valeur, aucun « +1 »
ne vole, aucun confetti ne tombe du poinçon, et le téléphone ne vibre pas.

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
