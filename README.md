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
| Accueil | `/` | `building-pavilion` | `pages/Accueil.tsx` : le fronton, « Ce soir », « Ensuite », le journal en pellicules (une par mois) |
| Voyage | `/voyage` | `route` | `pages/Carte.tsx` : la carte (plus bas) ; sous-pages `voyage/:annee` (`pages/VoyageAnnee.tsx`, la fiche d'une année), `voyage/:annee/films/:filmId` (`pages/VoyageFilm.tsx`), `…/billet` et `…/billet/corriger` (`pages/VoyageBillet.tsx`), `voyage/decennies/:decennie` (`pages/VoyageDecennie.tsx`, la page d'une décennie), `…/billets` (`pages/VoyageBoite.tsx`, la boîte à billets), `…/recherche` (`pages/VoyageRecherche.tsx`, le guichet), `voyage/sacoche` (`pages/VoyageSacoche.tsx`, la sacoche du voyageur) : « Les pages du Voyage », « Les pages d'une décennie » et « La sacoche du voyageur », plus bas |
| Suivis | `/suivis` | `chair-director` | `pages/Suivis.tsx` : le mur des suivis (rétrospectives et cycles, « Ensuite », la recherche pour suivre : « Le thème », plus bas) ; sous-pages `suivis/realisateurs/:tmdbId`, `suivis/sagas/:tmdbId`, `suivis/films/:tmdbId` |
| Au ciné | `/au-cine` | `ticket` | `pages/AuCine.tsx` : « Prochaines séances » (le tableau du hall, `cinema/TableauDuHall.tsx`), les sorties en salle, mes séances : « Le thème », plus bas ; sous-page `au-cine/films/:tmdbId` (`pages/FicheFilm.tsx`, la fiche d'un film ouverte d'une séance ou d'une tuile) |
| Profil | `/profil` | `armchair` | `pages/Profil.tsx` : la carte d’adhérent (le pseudo, la couleur du membre, les films et les heures de `/stats`, « Mes films »), puis les graphiques du journal entier dessinés en objets de cinéma (`profil/` : notes, réactions, décennies, mois) et, en bas, le ticket de caisse qui mène à la sous-page `/profil/reglages` (`pages/Caisse.tsx` : thème jour / nuit, « Mes films », l’import Letterboxd (`pages/ImportLetterboxd.tsx`, sous `/profil/import-letterboxd`), la liaison SensCritique (`profil/SensCritique.tsx` : relier son compte, voir ce qui attend, le délier ; masquée tant que l’API n’a pas sa `SENSCRITIQUE_CLE` ; une session que SensCritique a refusée se dit « expirée », avec l’offre de se reconnecter (la file attend et repart alors) ou de délier, qui l’arrête ; ses films à apparier se tranchent sur `pages/AppariementSensCritique.tsx`, sous `/profil/senscritique`), la liaison Cinoche (`profil/Cinoche.tsx`, sa jumelle sans appariement, sur la même feuille de style : l’e-mail et le mot de passe du compte Cinoche, jamais gardés, la même session expirée ; masquée tant que l’API n’a pas sa `CINOCHE_CLE`, indépendamment de l’autre), le rattrapage, les doublons, « Se déconnecter », la mention TMDB, la version) |

Hors des onglets, la barre restant visible : `recherche`, `journal/nouveau`, `journal/:id`,
`journal/:id/corriger` et `journal/:id/papier` (`Recherche`, `Formulaire`, `Fiche`, `PapierRendu`) :
le guichet, le billet du critique (création et correction), la fiche d'un visionnage, et la coupure de
presse qui suit une création (« Le thème », plus bas).

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

La barre est le rouleau du guichet (`Coque.module.css`) : cinq billets du papier de ceux du profil
(`--ticket-papier`), joints par leurs pointillés, les coins mordus par un masque, l'icône au-dessus
de son libellé en League Gothic. Le billet de la page courante est sorti du rouleau (levé, un peu
penché, son encre pleine, une bande rouge au bord haut). La nuit, le projecteur d'en bas
l'éclaire : les quatre autres billets tombent dans la pénombre, le courant rayonne et un cône de
lumière monte de la zone sûre jusqu'à lui ; de jour tout cela est éteint et la forme ne change pas.
Les valeurs sont les jetons `--billet-onglet-*` de `ui/theme.css`, les cinq lumières
(`-faisceau`, `-faisceau-vif`, `-penombre`, `-eclat`, `-papier-eclaire`) éteintes dans `:root` et
allumées, des mêmes valeurs, dans les deux blocs sombres. Le cône est pendu au `li`, non au lien :
le masque couperait tout ce qui dépasse du billet, jusqu'à l'anneau de focus du dehors, que
`:focus-visible` trace donc dans le billet. La hauteur de la barre (`--barre-onglets-hauteur`) et
`--coque-bas` ne changent pas : le cône n'a que la hauteur de la zone sûre.

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
- `src/carte/` : le moteur (`moteur.ts`, sur un `<canvas>`, monté par `CarteCanvas.tsx`), le meneur
  de la caméra (`meneur.ts`), la géométrie, le toucher, la mise en scène d'une avancée
  (`avancee.ts`) et le dessin commun à tous les mondes (`dessin/`).
- `src/mondes/` : l'interface d'un monde (`types.ts`), le registre (`index.ts`), un dossier par
  décennie (`1890/`, `1900/`) et le monde « à venir » (`avenir/`) des décennies sans chantier.
- `src/carte/son.ts` : l'ambiance sonore ; `src/carte/dessin/bobines.ts` : le dessin des bobines
  perdues et de leur envol.

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
des pastilles rondes à icône (nom dans `aria-label`) : « Son » (plus bas), la vue d'ensemble, et
« Tu es ici », qui ne s'offre que quand le moteur dit l'avatar hors de l'écran (rappel
`avatarVisible`).

**Quand la foire se bâtit.** À l'ouverture d'une année, au bout de la marche de l'avatar, la
caméra allant chercher le chantier s'il est hors de l'écran ; la séance de 1895, elle, à la toute
première visite d'un membre (aucune année vue, l'avatar au départ du Voyage). Jamais au
rechargement ni au retour sur la carte : l'appareil garde la dernière année montrée, par membre
(`journal.carte.annee-vue.<membre>`, `carte/memoire.ts`).

**Le son** (plan 2d ; `carte/son.ts`, `Ambiance`). Le ronron du projecteur, le clap, le carillon
d'une bobine retrouvée, et la musique de chaque monde à l'écran, au volume de son poids de mélange
(`Monde.musique` : l'orgue de barbarie de 1890, `mondes/1890/orgue.ts` ; le roulement du train de
1900, `mondes/1900/roulement.ts`, son seul son ; rien pour le monde « à venir »). Tout est synthétisé par WebAudio, sans fichier. Coupé par défaut : **seul le bouton
« Son »** (la pastille du haut, en bas à droite) crée le contexte audio, dans son geste, et le reprend
s'il naît suspendu (Safari d'iOS). Une fois né, il vit autant que la page (`ambianceDeLaPage`) : une
fiche ouverte puis refermée retrouve le son. Il appartient au membre qui l'a allumé : la déconnexion
ne recharge pas la page, et le membre suivant dans le même onglet le trouve coupé. Il se tait quand la page passe en arrière-plan ou que la
carte est quittée. Le choix se garde sur l'appareil, par membre (`journal.carte.son.<membre>`,
`carte/memoire.ts`) ; il ne rallume rien au rechargement, il fait seulement proposer au bouton de
« reprendre » le son.

**Les bobines perdues** (plan 2d). Trois films réellement perdus cachés dans le décor de 1890
(`Monde.bobines`, `mondes/1890/bobines.ts`) : derrière le pied d'un bec de gaz, dans la brume au bas
de la section (un éclat la trahit de temps en temps), au pied de la tour Eiffel au loin. Trois
autres en 1900 (`mondes/1900/bobines.ts`), en gare de 1900, de 1901 et de 1904. Le monde les
pose par `VueMonde.bobine`, le moteur les dessine et inscrit leur zone, qui passe devant le reste du
décor. Un toucher la ramasse : elle vole vers le compteur du HUD (`DUREE_DE_L_ENVOL`, au tempo), qui
n'apparaît qu'à la première trouvaille ; un message dit le film, puis, à la troisième, que les trois
sont retrouvées. Au calme, elle arrive d'un coup. Les trouvailles se gardent sur l'appareil, par
membre (`journal.carte.bobines.<membre>`) : une bobine trouvée ne se dessine plus, sa zone ne se
touche plus. Un stockage illisible vaut « coupé » et « aucune ».

**Le compteur va par décennie** (plan 3a ; `pages/Carte.tsx`). Il compte les bobines du monde de la
décennie à l'écran : celle du monde au plus fort poids de mélange (le premier des deux à égalité),
que le moteur dit à chaque image par `Rappels.presences` et dont la page ne retient que le
changement. À l'ouverture, c'est la décennie de l'année en cours, ou la dernière avant elle dont le
monde cache des bobines. Devant un monde sans bobines (le monde « à venir »), il garde la décennie
qu'il montrait. Il reste caché tant que rien n'est trouvé dans la décennie qu'il montre. Pendant le
vol, la décennie de la bobine l'emporte, même ramassée à une frontière devant un autre monde, et la
bobine en vol n'est comptée qu'à son arrivée. Le message compte alors dans la décennie de la bobine,
et le compteur y reste jusqu'à ce que le moteur dise une autre décennie : jamais de retour à l'image
suivante. Le dernier message dit « les trois » pour un monde de trois bobines, « toutes » sinon.

**Les objets oubliés sur le quai** (lot d'écrans, brief 4 ; maquette « Voyage immobile 1900 »,
`OBJETS`). Un objet d'époque par gare de 1900 à 1909 (`Monde.objets`, `mondes/1900/objets.ts` : le
catalogue de la sacoche, avec la place de chacun sur son quai ; celles de la lanterne et du parapluie,
que la maquette ne place pas, sont posées à droite du quai). Le monde dit lesquels se proposent
(`gares.ts`, `objetsSurLeQuai` : dans une gare **développée** seulement, à l'écran, et jamais tant
que la vitre n'a pas rempli l'écran) et les dessine lui-même, des mêmes tracés que la sacoche, tant
que le moteur ne les dit pas ramassés ; le moteur n'inscrit que leur zone, qui passe devant le décor
comme celle d'une bobine. **Ils ne sont pas gardés sur l'appareil** : la carte lit l'état du voyageur
(`GET /me/voyage/voyageur`, la clé de la sacoche), **seulement si elle montre un monde qui cache des
objets** : 1890 n'en cache pas et 1900 est caché à qui ne l'a pas atteint, un membre de 1890 ne lit
rien de neuf (`pages/Carte.objets.test.tsx`). Tant que cet état n'est pas lu, ou en panne, aucun objet
ne se propose, sans un mot. Un toucher (au calme aussi) l'ôte du décor et la page l'écrit
(`POST /me/voyage/objets/{cle}/ramasser`), une fois par objet (un verrou par clé). Accepté, **le cache
ne gagne que la ligne rendue** : ni le préfixe `voyage` périmé, ni l'état relu, et la consigne de la
sacoche le montre sans rien relire ; une lecture de l'état encore en vol est annulée avant l'écriture
(`cancelQueries`, sur la clé exacte : atterrie après, elle effacerait la ligne) ; l'objet vole du quai
au milieu de la pastille de la sacoche (`DUREE_DE_L_ENVOL` de la page, au tempo, que
`voyage/tempo.test.ts` lie à la durée de `.vol` dans la feuille), puis la région d'état dit « Objet trouvé 2 sur 10 », compté
sur le catalogue du monde, et la phrase de l'objet (`ObjetCache.phrase`). Au calme, rien ne vole ni
n'attend. Refusé ou en panne, il est rendu au moteur (`rendreObjet`) et revient sur le quai, sans un
mot. Le moteur tient deux listes : ce que la page dit ramassé (`reglerObjets`) et ce qu'un toucher
vient de prendre, que la liste de la page n'efface pas.

**Le point rouge de la pastille de la sacoche** (lot d'écrans, brief 5 ; maquette « Voyage immobile
1900 », `.pastilles .point`) dit qu'il y a du neuf, et le nom du lien dit pourquoi : « Sacoche du
voyageur : une étiquette vient d'être collée sur la malle et un objet trouvé en gare ». Éteint, le
lien se nomme exactement « Sacoche du voyageur ». La liste des rubriques qui l'allument s'écrit en un
point (`voyage/voyageur.ts`, `RUBRIQUES_DE_LA_PASTILLE` : `etiquette` par les `collee_le` de la malle,
`courrier` par les `postee_le` des cartes postales **reçues**, jamais des envoyées, et sans regarder
`lue_le` : c'est la visite de la rubrique qui l'éteint, `objet` par les `ramasse_le` ; `bobine` jamais), et **la carte ne regarde
que celles dont la sacoche du monde de mon année en cours monte le bloc** (`rubriquesDeLaPastille`) :
elle lit alors l'état du voyageur (la même clé que pour les objets du quai, une seule lecture), pour
`etiquette` la malle de ma décennie, et pour `courrier` ma boîte aux cartes postales (`cles.courrier`),
**dont elle ne montre rien** : une carte postale ne se lit que dans la sacoche, et son mot n'entre ni
dans le nom du lien ni dans son titre. Un membre de 1890 ne lit rien de plus ; un membre du monde « à
venir » n'a pas de point, même devant les quais de 1900, car sa sacoche ne marquerait rien vu. La carte
n'attend aucune de ces deux lectures, et leur panne se tait : pas de point pour la rubrique qu'elle
prive de ses dates, et la carte reste. **Le point se lit sur le cache, que deux écritures tiennent
champ par champ** : la sacoche y pose le `vue_le` rendu par le serveur (`useVisiteDeRubrique`), si bien
qu'au retour le point est éteint sans rien relire ; ramasser y ajoute sa ligne, datée par le serveur
après ma visite, et le rallume. L'état relu en panne, le point et les objets ramassés restent ceux du
cache. Il bat en boucle (hors tempo, déclaré dans `AMBIANCE` de `voyage/tempo.test.ts`, qui
garde depuis toute la feuille `carte/Carte.module.css` ; l'aperçu et le carton, d'avant, y sont des
`EXEMPTIONS_HERITEES`, une table qui ne s'allonge pas) ; au calme, un point fixe
(`pages/Carte.point.test.tsx`).

**La référence de 1890** (`carte/reference1890.test.ts`). Ce que le moteur dessine pour le vrai
monde 1890 suivi du monde « à venir » est figé en empreintes : chaque appel au contexte et chaque
écriture de propriété, les nombres arrondis à six décimales. C'est le garde-fou de « 1890 ne bouge
pas » : un travail sur le moteur la laisse verte **sans y toucher**, et une empreinte ne se refait
que si le changement de dessin est voulu, et dit dans le commit. Une empreinte ne dit pas quel appel
a bougé : avec `VITE_REFERENCE_1890_SORTIE` posée sur un dossier en chemin absolu, hors du dépôt,
chaque cas y écrit sa suite, un appel par ligne, à comparer d'un commit à l'autre par `diff -r`
(l'en-tête du fichier donne les commandes).

**La section collante** (plan 3a ; `Monde.scene`, `mondes/types.ts`). Un monde qui porte une `scene`
ne laisse plus sa section glisser sous la caméra : il dessine lui-même ses années d'après
`VueMonde.avance` (`camY − y0`, donné à tous les mondes). **Le monde 1900 est le seul à en porter
une** ; 1890 et le monde « à venir » ont `scene: null`. Dans une telle section, le moteur s'efface :

- Le sol, le chemin parcouru et la brume de l'avenir sont coupés net à ses bords (`bandesDuSol`,
  `couperAuxBandes`, `dessin/sol.ts`). Sans section collante sur la carte, les bandes sont nulles et
  rien n'est coupé : le dessin reste celui d'avant, appel pour appel.
- Ni case commune, ni avatar, ni clap. Le moteur n'inscrit que la zone `case` et ne pose le corail
  qu'au point que rend `ecranDeLaCase` ; rien pour une année que le monde dit hors de vue.
- Le Voyage suivi garé dans la section est dessiné par `dessinerSuivi`, qui inscrit lui-même sa
  zone `roulotte`.
- Deux nombres par monde (`carte/camera.ts`), qui ne diffèrent qu'à l'entrée d'une section
  collante. Le **poids de mélange** (`poidsSections`) : ce qui se mêle d'un monde à l'autre (le
  ciel, le virage, la musique) ; il y suit la part de l'écran passée sous la frontière. La
  **présence** (`presencesSections`) : ce que le monde reçoit pour dessiner, et ce qui dit s'il
  dessine ; elle y vaut 1 sans fondu, pour le monde quitté tant que sa section est à l'écran, pour
  le monde collant dès que la sienne y entre.

**La caméra roule d'arrêt en arrêt.** `scene.arrets` donne un `y` par année, que le moteur borne à
ce que le défilement atteint. Dans une section collante, `marcher` ne fait marcher personne : la
caméra roule jusqu'à l'arrêt de l'année (`DUREE_DU_ROULEMENT`, des millisecondes de base jouées au
tempo, la même durée quelle que soit la distance, allongée du seul ralenti que le monde déclare sur le
trajet : `SceneCollante.ralentis`, en 1900 celui du tunnel) et la promesse se résout à l'arrivée ; d'un coup
au calme, ou quand elle y est déjà (`A_L_ARRET`). `allerIci` y mène à l'arrêt de l'année du membre,
`passerLaPorte` n'y fait rien, et `avatarVisible` dit vrai quand la caméra est posée à cet arrêt.
Un seul glissement tient la caméra à la fois (`prendreLaCamera`) : celui qui commence arrête les
autres et libère qui les attendait.

**Le rappel à l'arrêt.** Le moteur n'a que `defiler` pour savoir que le membre défile : l'arrêt se
constate aux images, quand `defiler` s'est tu depuis `REPOS_DU_DEFILEMENT` (un seuil, pas une
animation : il ne suit pas le tempo) et qu'aucun doigt n'est posé. La caméra laissée entre deux
arrêts revient alors au plus proche en roulant ; au calme, elle se pose d'un coup à l'arrêt suivant
dans le sens du geste, choisi une fois par geste. Le rappel vaut du premier arrêt au bas de la
section, pas avant le premier arrêt (la zone du passage d'entrée). Ce que la page rend d'un
`defilerVers` est un écho, pas un geste : pendant un roulement, un défilement tombé entre son
départ et là où il en est ne compte pas, et un roulement qu'on attend (`marcher`) n'est détourné par
aucun geste. Hors du roulement, l'écho attendu s'oublie dès que la page l'a rendu, la caméra ne
glissant plus : le défilement suivant est un geste. **`doigtsPoses`** : `CarteCanvas` relaie `targetTouches.length` à `touchstart`,
`touchend` et `touchcancel`, parce que le navigateur relève le pointeur (`pointercancel`) dès qu'il
prend le geste pour défiler. Tant qu'un doigt reste posé, le moteur ne rappelle ni ne pose la
caméra : il combattrait le défilement que le doigt mène.

**`direBonjour` et le passage d'entrée.** `direBonjour(decennie, sens)` joue `scene.entree`, le
jumeau de `direAdieu` : la caméra est posée d'un coup au premier temps du sens joué, y tient sa
pause, puis glisse d'un temps au suivant ; à l'envers, c'est le retournement exact de l'endroit (la
durée appartient au segment, pas au sens). Les durées et les pauses s'écrivent dans le monde en
millisecondes de base : le moteur seul les joue au tempo. Le monde reçoit `VueMonde.entree`, les
secondes écoulées, -1 hors passage. La promesse se résout après la pause du dernier temps ; aussitôt
pour un monde sans `scene` ou sans temps ; aussitôt au calme, la caméra posée au dernier temps du
sens joué. Un seul passage à la fois : demandé pendant qu'un autre joue, il ne relance rien et se
résout avec lui. Pendant le passage, un défilement du membre ne le détourne pas ; un toucher le
pose à sa fin et n'ouvre pas l'année qui se trouve sous le doigt. **Le geste le lance** : un
défilement laissé entre le premier et le dernier temps, parti d'au-dessus, joue le passage à
l'endroit ; parti d'au-dessous, à l'envers ; parti dans la zone, rien. Sous la même garde que le
rappel (jamais sous un doigt posé), et avant lui. Le rappel optionnel `entreeProche` dit la décennie
dont le premier temps est à un écran au plus sous la caméra, nulle sinon et tant qu'un passage se
joue. La page s'en sert de deux façons (plus bas, « Le passage, côté page »).

**Le meneur** (`carte/meneur.ts`, `Meneur`). Tout ce qui précède sur la caméra vit là, hors du
moteur : la position de la caméra ne s'écrit que dans le meneur, et la page n'apprend que par lui
où le moteur la veut (`defilerVers`). Cinq meneurs se la partagent, un seul glissement à la fois :
le défilement natif, l'avatar qu'on suit, un chantier qu'on vise, le roulement vers un arrêt, le
passage d'entrée. Le moteur commande et lui prête de quoi lire la carte (`Terrain` : les sections,
leurs arrêts, les temps de leur passage, la hauteur de l'écran, où en est l'avatar), relu à chaque
appel ; le meneur arbitre. La vue d'ensemble ouverte, il ne lance ni rappel ni passage.

**Le monde 1900** (`mondes/1900/`, « Le voyage immobile »). Le Panorama transsibérien de
l'Exposition : quatre toiles défilent à des vitesses différentes derrière la vitre d'un train qui
ne bouge pas (`toiles.ts`, `RAPPORTS`), et tout se tire de l'avance de la caméra. La section porte
en haut la zone du passage, puis dix gares, une par année, à 700 px de geste l'une de l'autre
(`trace.ts`, `ARRETS`, `PAS`) ; chaque gare est une photographie d'époque. Une année fermée, en
attente du Voyage suivi (`estFermee`, la règle de la carte entière, dans `voyage/regles.ts` : la gare, la bande de la vue d'ensemble et la liste des années de la page lisent la même), ou où
le membre n'est pas encore arrivé, se montre en plaque négative (`gares.ts`, `aDevelopper`), sous une
lanterne rouge de 1901 à 1909 ; la plaque se développe sous les yeux à l'arrivée du membre
(`durees.ts`, `DEVELOPPEMENT`). L'heure est celle de la gare, de l'aube de 1900 à la nuit de 1909
(`donnees.ts`, `HEURES` ; les règles, pures, dans `habillage.ts`), jamais celle du visiteur : le
monde ne lit ni `VueMonde.nuit` ni `VueMonde.lum`. Le voile de nuit que le moteur pose sur tout
l'écran d'après l'heure du visiteur, lui, reste. Il pleut à Couville et à Brest, il neige à Allaman
et à Bassersdorf (`donnees.ts`, `METEO` ; les règles dans `meteo.ts`, le trait dans
`intemperies.ts`) : des motifs répétés qui glissent et onze gouttes, posés immobiles quand le
visiteur demande moins d'animations, absents du passage. À Creil, la vitre est embuée (`donnees.ts`,
`BUEE` ; les règles dans `buee.ts`) : un glissement horizontal du doigt l'essuie sans faire rouler le
train (`Monde.glisser`), au calme aussi ; le doigt levé, deux gouttes coulent ; la vitre se réembue
dès que le train s'est éloigné à plus de mi-chemin de la gare voisine, et aussi dès qu'on quitte la carte (ouvrir une année et revenir). Entre Longueville et Allaman, le seul tunnel
de la ligne (`donnees.ts`, `TUNNEL` ; les règles dans `tunnel.ts`, le trait dans `voute.ts`) : sa
bouche de pierre arrive, le noir balaie la vitre, la paroi défile, l'autre bouche passe et le jour
revient sur la neige ; il ne suit que le doigt, à l'aller comme au retour, et
n'existe pas quand le visiteur demande moins d'animations. D'une bouche à l'autre, le train qui roule
lève le pied (`TUNNEL.allure`, la part de vitesse gardée ; `ralentisDuTunnel` le déclare dans
`scene.ralentis`) : l'avancée de 1903 à 1904 dure une fois et six dixièmes celle des autres ; sous le
doigt, le tunnel passe à la vitesse du doigt, et l'élan du défilement natif, le doigt levé, le traverse
sans ralentir non plus : seuls l'avancée, « Tu es ici » et le rappel sont freinés (un écart à la
maquette, où tout ce qui suit le lever ralentit). Le compartiment se remplit : la première
affiche de chaque année ouverte de la décennie, les cinq plus récentes au plus, se pince sur une
ficelle sous la vitre à la montée en voiture et revient en reflet léger dans le tunnel (la règle
dans `ficelle.ts`, le trait dans `accroches.ts`) ; aucune année ouverte avec une affiche, aucune ficelle.
Le Voyage suivi y est une voiture garée à quai dans sa gare (`suivi.ts`). Trois dépêches épinglées aux quais tiennent lieu de dates vraies
(`depeches.ts`). Rien ne s'y bâtit (`siteDuChantier` rend nul), aucun toucher du décor ne sonne ni
ne s'anime, et le monde s'en va sans adieu. Ses pages (les fiches d'année, la décennie) sont encore
celles du monde « à venir ». Les tables recopiées de la maquette et leurs sources :
`docs/maquettes/voyage-immobile-1900-donnees.md`.

**Le déblocage** (`voyage/regles.ts`, `premiereDecennieCachee`, `anneesMontrees`). Une décennie dont
le monde porte une `scene` reste cachée tant que l'année en cours du membre ne l'a pas atteinte :
ni un ticket gagné ou gardé, ni le tampon de la décennie d'avant ne l'ouvrent. Tout ce qui suit une
décennie cachée l'est aussi, monde « à venir » compris. La carte ôte ces années de ce qu'elle donne
au moteur et de sa liste pour lecteur d'écran ; le bouton d'un ticket qui ouvre une décennie dit
« 1899 → nouveau monde », sans nommer l'année ; le Voyage suivi rendu dans une décennie cachée n'a pas de roulotte. La règle
ne connaît aucun monde : la page lui dit, par le registre, quelles décennies ont une scène.

**Le passage, côté page** (`carte/avancee.ts`, `jouerAvancee` ; `pages/Carte.tsx`). Une avancée qui
change de décennie vers un monde dont `scene.entree` n'est pas vide ne joue ni la marche ni le
carton : la porte du monde quitté, son adieu, le tampon si le passeport porte la décennie, le
passage (`direBonjour`, à l'endroit), le clap ; puis le roulement jusqu'à l'année d'arrivée si elle
n'est pas la première de sa décennie (un rattrapage de 1898 à 1903). Les lignes du carton sont
dites hors de vue, pour un lecteur d'écran. Pendant toute l'avancée, rien derrière ne répond ; le
temps du passage seulement, la toile sort de l'inertie, pour que le toucher qui pose le passage à sa
fin atteigne le moteur. L'année vue ne s'écrit sur l'appareil qu'à la fin de l'avancée : rechargée
en plein passage, la carte rejoue tout. Sans mémoire d'appareil, ou quand le stockage lève, rien ne
se joue : la carte s'ouvre à l'arrêt de l'année en cours.
Hors d'une avancée, le bouton « Prendre le train pour 1900 » s'offre quand le moteur dit l'entrée
proche (`entreeProche`), à qui a atteint la décennie, jamais sous la vue d'ensemble : il ne joue que
le passage, sans porte ni adieu.
La halte au bout de la foire (`mondes/1890/halte.ts`) : une petite gare dessinée (pignon à horloge,
fronton « DÉPARTS », marquise rayée, sémaphore), posée sur le bout de la pellicule sous la case de
1899, dès 1895 et par-dessus la brume de l'avenir, où elle n'est qu'une ombre et ses fenêtres. Sans
ticket, elle est seule et ne répond pas. Dès que le ticket de 1900 est émis (`VueMonde.ticketDApres`,
que la page tire de `GET /me/voyage/tickets`), un train vient à quai devant elle et n'en repart plus,
le ticket utilisé ou non. 1900 atteint, la porte s'éclaire, le bras du sémaphore se lève, et toucher
la gare ou le train lance le même passage que le bouton (`VueMonde.passer`, qui appelle
`direBonjour`), au calme aussi, où il pose en gare de 1900. Seules bougent la fumée et les lampes,
jamais au calme.

**La vue d'ensemble d'un monde à `scene`.** Il dessine sa bande lui-même (`dessinerBande`), dans le
cadre que tiendrait la bande commune : le moteur n'y pose ni fond ni marquise, seul le voile plein
écran reste commun. Le contexte porte déjà l'ouverture (`globalAlpha` vaut `e`), et ce que le monde
y laisse est défait après l'appel. La bande ne pèse que `POIDS_REPLIEE`, quelle que soit la hauteur
de la section (`genreDeBande`, `carte/ensemble.ts`, que le géomètre et le dessin lisent tous deux).
Le monde rend de quoi lire un point de l'écran (`LectureDeBande`) : quittée par un toucher ou un
pincement dans sa bande, la vue d'ensemble pose la caméra à l'arrêt de l'année désignée, et la
laisse où elle est si le point n'en désigne aucune. Dans une bande ordinaire, elle la pose à
l'endroit touché, au milieu de l'écran ; si cela tombait dans une section collante, au haut de la
section touchée. Fermée sans désigner d'endroit (le bouton), elle ne bouge pas la caméra.
Cette sortie prend la caméra sur toute carte, 1890 comprise : celle qui suivait l'avatar ou visait
un chantier reste où l'on a touché, et la marche finit hors champ s'il le faut. Sur une carte à
section collante, l'écho qu'en rend la page ne lance ni passage ni rappel. `direAdieu` la prend de
même : posée au haut du monde quitté, elle n'en repart pas vers un chantier.

**Les images.** Chaque dossier `assets/` (`src/carte/assets/` pour les images communes,
`src/mondes/<décennie>/assets/`) a son `CREDITS.md`, où chaque fichier porte son œuvre, sa source,
sa licence et son traitement (`src/test/credits.test.ts` l'exige). `mondes/1890/assets/virer.sh`
cuit la rampe sépia dans une image ou une extraction vidéo. `npm run verifier:dist` constate sur
`dist/` que chaque `.webp` ou `.png` est précaché et sous son plafond (384 Kio), qu'aucune
`.webm` ne l'est (plafond 600 Kio), et que les images tiennent ensemble dans 1,5 Mio.

**La mémoire des images** (`carte/CarteCanvas.tsx`). Deux tables d'images décodées, qui vivent autant
que l'onglet. `imagesDesMondes` : les images des dossiers `assets/` des mondes et de `carte/assets/`,
**jamais évincées** (une photographie sortie manquerait à un ou plusieurs rendus, le temps de se
recharger) ; la table est bornée par les dossiers eux-mêmes. `affichesDecodees` : toute autre image,
venue de l'API ou de TMDB (les affiches des colonnes, et celles qu'un monde demande pour lui-même,
comme la ficelle de 1900), dans un `Lru` (`carte/lru.ts`) borné à `BORNE_DES_AFFICHES` : ce qu'une
seule image du moteur peut demander, `AFFICHES_DES_COLONNES` et `AFFICHES_D_UN_MONDE` ensemble, la
plus anciennement demandée sortant la première. Une adresse est celle d'une image de monde
par son appartenance exacte à l'ensemble que Vite rend pour ces dossiers (`ADRESSES_DES_MONDES`),
jamais par un préfixe : une affiche peut venir de la même origine.

## Les pages du Voyage

Toucher une année de la carte ouvre sa fiche, `/voyage/:annee`, lue sur
`GET /me/voyage/annees/{annee}` à chaque ouverture (plan 2b). Selon la forme que rend l'API : l'année
en cours ou bouclée (la corde des billets, le boniment, le programme, la parade du podium, la séance
du soir, les salles, le ticket), une année fermée (la pancarte, le chemin, mes films vus en avance),
une année qui attend le Voyage suivi (« Théo est trop lent », le pseudo du voyageur suivi :
`tropLent`, `voyage/regles.ts`), ou l'ouverture qui s'écrit
(relue toutes les cinq secondes, trente-six fois au plus, puis « Réessayer »). Une affiche de salle
ouvre la fiche du film, `/voyage/:annee/films/:filmId` (`filmId` est la ligne de salle, pas un
identifiant TMDB) : la projection, le guichet, le programme et ses bobines (vu en partie, ses
gestes et « Le film » visent la première bobine qui reste à voir, `tmdbVise`). « Je l’ai vu » (le mot
que le monde donne au geste, `mots.billet.ouvrir` : « Composter une séance » en 1900) ouvre le
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
  baraque »), les hauteurs et les cinq dessins (le bandeau d'une année, la scène d'un film,
  l'estrade du chroniqueur, puis, pour les pages d'une décennie, le monument et le guichet). Le
  monde « à venir » habille les années sans chantier. En 1890, les pages s'écrivent en IM Fell
  English et IM Fell English SC, les millésimes au pochoir en Stardos Stencil (`@fontsource`,
  précachées, `ui/polices.ts`). Les polices de la maquette 1900 y sont aussi, aux seules graisses
  qu'elle emploie : Oswald 600 et 700, Spectral 400, 400 italique et 600, Courier Prime 700.
- `Monde.pages.gabarits` (`GabaritsDesPages`) : les sections qu'un monde compose lui-même. La page
  lit `gabaritDe(monde, cle, Defaut)` (`voyage/gabarit.ts`) et monte le composant du monde, avec les
  propriétés du défaut, ou le défaut si le monde n'en fournit pas ; les lectures et les gestes restent
  à la page. Quarante et une clés, deux sur la carte, treize sur la fiche d'année, trois sur la fiche d'un film, une sur le billet de séance, deux sur la boîte à billets, six sur la page d'une décennie, deux sur le guichet, huit sur la sacoche et quatre sur les célébrations (plus bas, « Les célébrations »). Sept d'entre elles, `controleurDeLaCarte` et `halteDeLaCarte` sur la carte, `horaireDeLAnnee` sur la fiche d'année, `malleDeLaSacoche`, `courrierDeLaSacoche` et `objetsDeLaSacoche` sur la sacoche, `feteDuBadge` sur les célébrations, **n'ont pas de défaut** : elles se lisent par `gabaritSeul(monde, cle)`, qui rend le composant du monde ou rien, et leur bloc lecteur ne se monte ni ne lit rien dans un monde qui ne les compose pas (plus bas, « Le jeu des années 1900 »). Sur la fiche d'année : `teteDAnnee` (la tête, à la place du bandeau
  dessiné sur une toile, `voyage/annee/Bandeau.tsx` ; le lien de retour et la plaque du chapitre
  restent à la page), `fronton` (sous la tête d'une fiche prête ou en préparation), `anneeFermee`
  (le corps d'une année fermée ou en attente), puis, sur une fiche prête, `corde`, `boniment` et
  `programme`, et `tirette` (le dessin de ce qu'on tire pour recharger, que `Manivelle` lit
  elle-même : le geste, les seuils, les écouteurs et le bouton du bas ne passent pas au monde). La
  corde et le programme reçoivent les arrivées de l'année (`arriveesDeLAnnee`, `voyage/annee.ts` : les
  films et l'Ours, les essentiels et le Lion, les salles et la Palme, le ticket, chacun atteint ou
  non), si l'année est bouclée (`estBouclee` : son ticket est émis, ou elle est derrière soi) et ce
  que le retour d'un billet a gagné ; le programme se monte sur toute fiche prête, et ne reçoit de pas
  que pour l'année en cours. Enfin `salles` (le cadre des salles, `voyage/salles/Rayons.tsx`) et
  `salle` (une salle, `voyage/salles/Salle.tsx`), que `voyage/salles/Salles.tsx` lit : il garde
  « En voir plus » et son guet (`useFournee`, une fois par salle), la requête du contexte, la nouvelle
  salle et le calque `voiture`, et passe à chaque salle son numéro (`numeroDeLaSalle`,
  `voyage/salles.ts` : son rang, jamais sa place dans la réponse), si elle est dépliée, et les deux
  gestes qui la déplient et la replient. La dixième, `ordreDAnnee` (`voyage/annee/Ordre.tsx`), range
  les sections d'une fiche prête : elle les reçoit montées (la corde avec sa région d'état, le
  boniment, le programme, l'horaire de la gare, nul dans un monde qui ne le compose pas, la parade, la
  séance, les salles, la ligne du bas) et n'en compose ni n'en omet aucune. Enfin `parade` (le podium, `voyage/parade/Marches.tsx`, que `voyage/parade/Parade.tsx`
  lit : il garde le feuillet d'une marche, les écritures et leur garde, et passe les deux gestes,
  ouvrir le feuillet et vider) et `seance` (la séance du soir, `voyage/seance/Prospectus.tsx`, que
  `voyage/seance/Seance.tsx` lit : il garde composer, prendre, ignorer, leur verrou, le guet et le
  feuillet des remplacements). Sur la fiche d'un film : `projection` (la tête, par défaut la scène du
  monde sur une toile, `voyage/film/Projection.tsx` ; elle reçoit l'image que la page a chargée,
  `useImageDuFilm`, et le calme), `noticeDuFilm` (`voyage/film/Notice.tsx` : le titre, les
  réalisateurs, la raison, ta note ; elle reçoit le programme et le guichet déjà montés) et
  `guichetDuFilm` (le dessin du guichet, `voyage/film/Comptoir.tsx`, que `voyage/film/Guichet.tsx`
  lit : il garde les écritures et leur verrou, les adresses du billet et le feuillet du podium, et
  passe les gestes offerts, `boutonsDuFilm`). Sur le billet de séance : `billetDeSeance` (son dessin,
  `voyage/billet/BilletDeSeance.tsx`, que `pages/VoyageBillet.tsx` lit : la page garde le brouillon et
  sa garde, l'écriture, la suppression, qu'elle passe toute montée, la boîte où se lit le numéro et la
  séquence du compostage, dont le dessin ne reçoit que l'étape, le tirage et le numéro). Sur la boîte à billets : `casier`
  (`voyage/boite/Casier.tsx`, que `pages/VoyageBoite.tsx` lit : la page garde ses deux lectures,
  l'intercalaire et le billet ouvert dans l'adresse, le billet rangé montré une fois, et passe les
  billets déjà numérotés) et `billetEnGrand` (le dessin du billet ouvert, `voyage/boite/BilletEnGrand.tsx`,
  que `voyage/boite/Visionneuse.tsx` lit en gardant la lecture du catalogue des réactions). Sur la page
  d'une décennie, que `pages/VoyageDecennie.tsx` lit : `monument` (`voyage/decennie/Monument.tsx` : la
  toile et son toucher ; la page garde la navigation, le lien de retour et la plaque du chapitre),
  `frontonDeDecennie` (le titre de la page ; il reçoit les arrêts de la ligne), `livret` (le passeport :
  il reçoit en plus la frontière passée, le tampon de la décennie d'avant et le nom de son monde,
  `sortieDe`, et si mon année en cours a atteint la décennie, `entreeFaite`), `registre` (une ligne par
  année, `arrets`, `voyage/decennie.ts` : la ligne du registre, et si l'année est fermée, bouclée, où en
  est l'année en cours, `jauge`, et le voyageur suivi quand il y est, `voyageurSuivi`),
  `liensDeDecennie` (la boîte et le guichet, avec le compte de mes billets une fois le journal lu) et
  `ordreDeDecennie` (le passeport, la palissade, le registre et les liens, montés par la page : un
  monde les range autrement, et la palissade est la seule section qu'il peut ne pas montrer). Les
  défauts ne lisent rien de ce qui s'ajoute. Sur le guichet (`pages/VoyageRecherche.tsx`) :
  `teteDuGuichet` (`voyage/recherche/Tete.tsx` : le bandeau sur sa toile et la fenêtre ; elle reçoit
  le lien de retour monté, le formulaire et le champ tout réglés, que la page écoute : la saisie, sa
  mémoire et la montée au-dessus du clavier restent à la page) et `catalogueDuGuichet`
  (`voyage/recherche/Catalogue.tsx` : les années prêtes à cocher, le titre de la page, les vues déjà
  cherchées, l'attente, la panne, la phrase du vide). Chaque vue porte la voie de sa salle
  (`Vue.voie`, `voyage/catalogue.ts`, lue par `numeroDeLaSalle`), que le défaut ne montre pas. 1890 et le monde « à venir » n'en fournissent aucune.
- **Les années 1900 ont leurs pages** (`src/mondes/1900/pages.ts`, `PAGES_1900` ; les composants dans
  `src/mondes/1900/pages/`) : les jetons et les mots de la maquette « Voyage immobile 1900 », et ces
  sections, que la gare range à sa façon (`Gare`, pour `ordreDAnnee` : l'indicateur passe au-dessus du
  guide, pour que la ligne pointée au retour d'un billet se voie sans défiler, et l'horaire de la gare vient sous l'indicateur : « Le jeu des années 1900 »). La tête est la gare de l'année : sa photographie, sa plaque émaillée, qui porte
  le titre de la page et le rang de la gare, et selon le mode l'horloge (l'année est l'heure :
  19 h 03 en 1903, `heureDeLaGare`) avec le tampon d'une ligne bouclée (la page lui passe
  `anneeBouclee`, la règle d'`estBouclee` : la tête tamponne dès le ticket émis, comme l'indicateur, et
  le ruban « Bouclée » du fronton par défaut ne s'y montre pas), le négatif sous la lanterne
  rouge d'une année fermée, ou la gare assombrie et le sémaphore à l'arrêt d'une voie qui attend le
  Voyage suivi. Au calme, rien n'y bouge. Le corps d'une année ouverte : le **compteur** des arrivées
  à la place de la corde (`Compteur`), le **guide du voyageur** à la place du boniment (`Guide`, avec
  ses deux gestes), l'**indicateur** à la place du programme (`Indicateur`), sur toute fiche prête :
  quatre lignes, celles d'`arriveesDeLAnnee`, arrivées ou attendues, sans titre de film ni heure
  (leurs mots : `mondes/1900/pages/lignes.ts`) ; le jury n'y est promis qu'au compte IA. Une année
  derrière soi sans ticket n'a pas la ligne du ticket (`lignesDeLAnnee`), et la Palme n'y arrive que
  par la récompense : deux salles complètes sans le Lion l'attendent, « avec le Lion ». Une année
  bouclée (`estBouclee`) y porte le tampon rouge « Ligne bouclée » et sa récompense. Au retour d'un
  billet, la ligne gagnée se pointe en rouge, un « +1 » monte au compteur et sa molette tourne quand
  une ligne vient d'arriver (`venuesDArriver`), au tempo ; au calme, la ligne est pointée et le nombre
  posé d'un coup. La manivelle se dessine en **courroie** (`Courroie`) : une sangle qui s'allonge avec
  le geste, les seuils et les écouteurs restant ceux de `Manivelle`. Les salles sont des **voies de
  correspondance** (`Correspondances`, `Voie`) : la plaque émaillée du numéro (le rang de la salle), son
  nom, son compte, et si la voiture est complète ou se remplit. Toucher une voie ouvre sa **voiture**
  (`Voiture`), un dialogue par-dessus la gare, dans l'adresse (`?voiture=<id>`) : la vue prise d'un
  train en marche, le panneau, la raison d'être (qui ouvre le contexte quand il se lit), un
  compartiment par film (l'affiche à sa fenêtre ou « sans affiche », sa lettre, son état, sa plaque
  « occupé », « libre » ou le mot d'un introuvable ; il ouvre la fiche du film), les bobines d'un
  programme, et la porte au bout (« En voir plus » au compte IA). Leurs mots et leurs règles :
  `mondes/1900/pages/voies.ts`. Rien n'y bouge. Le podium est une voiture à **trois classes**
  (`Classes`) : trois portières, la première au centre et plus haute, le chiffre romain de la classe,
  l'affiche à la fenêtre. Toucher une portière occupée ouvre son film quand il est dans une salle de
  l'année (`filmDeLaMarche`, `mondes/1900/pages/classes.ts`) ; « Changer », une place libre, ou un film
  hors des salles ouvrent le feuillet de la marche ; tenir une portière occupée la vide. Une année en
  attente a les mêmes portières, sans film à ouvrir. La séance est un **train du soir** (`TrainDuSoir`) :
  l'affichette « Train de plaisir », le long en voiture et le court en tête, l'anecdote du trajet, les
  quatre talons, le tampon « Prise » (le seul à bouger, jamais au calme), « Composer une séance » et les
  séances passées ; la porte du wagon-restaurant de la maquette attend le lot À deux. **La fiche d'un
  film** se regarde du fond d'un Hale's Tours (écran 5) : la fausse voiture (`Hale`, pour `projection`),
  ses banquettes, et l'écran au bout de l'allée, qui porte la seule image que la page a chargée et
  tangue, sauf au calme ; la notice (`NoticeDuFilm`) garde le titre, les réalisateurs et leurs liens
  vers les Suivis, la raison, montre l'entrée d'un Hale's Tours (`hale`) et sa légende, et dit « Tes
  séances » en une phrase (la date, la note, les réactions du dernier visionnage, jamais la remarque) ;
  le guichet (`GuichetDuFilm`) rend les gestes que `Guichet` lui passe, « Composter une séance »
  (`mots.billet.ouvrir`) et « Corriger » sur le bouton corail commun (`Action`). « Trois
  photogrammes », le studio, le mois de sortie et le nombre de séances de la maquette n'y sont pas :
  aucune donnée ne les porte sans une lecture de plus. **Le billet de séance** est un carton Edmondson
  sous son composteur (écrans 6 et 7 ; `Composteur`, pour `billetDeSeance`) : le carton (`Carton`, que
  la liasse du casier reprend et que le « Bon pour » d'une année bouclée reprendra) porte le titre de la page, la
  ligne du film et de sa gare, le numéro, et montre ce qu'on écrit dessous : la date se presse sur sa
  tranche (« 30 SE 26 », `datePressee`), la note s'y perce, un trou par point (`trousDuCarton`), ou
  « sans note ». Le formulaire garde tous les gestes du billet par défaut : « Aujourd’hui », « Hier »,
  « ‹ » et « › » autour de la presse à dater, dix poinçons et « sans note », les réactions en coupons
  (douze au plus), la remarque en carnet, privée. La page joue seule le compostage et n'en passe que
  l'étape : le composteur avale le carton, le frappe (« VU », à l'encre violette), le rend, le numéro
  roule (« N° ···· » si le casier n'a pas répondu), puis le carton part, aux durées de `FRAPPE`, au
  tempo ; au calme, rien ne se joue. En correction, le carton est déjà tamponné, son numéro se lit en
  tête, « Corriger le billet » ne composte rien et « Supprimer » reste celui de la page. Dessous, « Le
  modèle » : les billets du Métropolitain de 1900 (`billets-metro`). La mention de classe de la
  maquette n'y est pas (décision 6). **Le poinçon doré du contrôleur** (un cercle perlé, une étoile
  percée : un dessin, dont les couleurs sont la donnée) est au carton, qui ne le porte que si on le
  lui passe (`poincon` : ce qu'il dit à qui ne le voit pas, et `frais` quand il vient d'être percé) :
  le composteur ne le passe jamais, billet en correction compris (décision 11) ; leurs mots
  et leurs règles : `mondes/1900/pages/carton.ts`. **La nouvelle salle, la ligne du bas, les
  feuillets, la feuille du chroniqueur, le programme d'un film et ses bobines gardent encore les
  composants par défaut**, aux mots et aux couleurs de 1900 ; l'estrade du chroniqueur est un fond
  uni. **Le guichet** (écran 11, `Grille` et `TableauDesDeparts`) : sous le fronton « Billets · 1900 à
  1909 », une grille de laiton en plein cintre, l'employé derrière elle, qui paraît à l'ouverture et
  hoche la tête à chaque lettre, et la tablette où l'on demande son film, que la page amène au-dessus
  du clavier. Dessous, les années prêtes en plaques de laiton, puis le tableau des départs : l'année,
  le film (son titre, et dessous son réalisateur et son état, sans tiret pour une bobine), la voie de
  sa salle, celle de la fiche d'année (`Vue.voie`) ; le passage trouvé reste souligné, les réglettes
  glissent à leur place, rien au calme. « Aucun départ pour ce nom. Essayez un réalisateur. » et
  « Chercher hors du Voyage » sont les mots de la maquette ; ses mots et ses règles :
  `mondes/1900/pages/guichet.ts`. **La sacoche** (écran 15) : plus bas, « La sacoche du voyageur ».
  `docs/cerveau/pages-1900.md` tient le compte.

**Les calques vivent dans l'adresse** (`voyage/calque.ts`) : `feuille=` (`ouverture`,
`generique`, `salle-<id>`, `film`), `marche=`, `podium=`, `nouvelle-salle=`, `remplacer=`,
`voiture=` (l'identifiant de la salle dépliée, pour un monde qui range ses films derrière elle). Le geste
« retour » du téléphone ferme donc un calque sans quitter la page. Ouvert par la page, il se ferme
en reculant dans l'historique ; arrivé avec l'adresse, en retirant son paramètre. **Une fermeture
par ouverture** : deux fermetures avant le rendu (deux touchers, deux Échap) ne reculent que d'une
entrée, la première est retenue jusqu'à ce que l'adresse ait bougé. Échap ne ferme
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

**Les célébrations** (`voyage/celebrations/` ; maquette 1890, écran IX). Au même retour, sur la fiche
relue, ce que le billet a bouclé se fête en plein écran, dans le costume du monde, au-dessus de la
barre d'onglets : `scenesDuRetour` (`scenes.ts`, sans rendu) compare l'avant, que le billet confie
avec le reste (`Avant.fete`), à l'après, et rend les scènes dans l'ordre. Un toucher passe à la
suivante.

- **La salle bouclée** (`SalleBouclee.tsx`) : le compte de l'API a monté (`salles_completes`, hors
  essentiels) ; la salle se referme en rideau, le carton la nomme quand la fiche le dit.
- **La récompense** (`PresseAMedailles.tsx`) : l'Ours, le Lion ou la Palme vient d'être gagné ; le
  balancier lance la vis, la presse frappe, l'emblème (`Embleme.tsx`) sort en tournant.
- **L'année bouclée** (`AnneeBouclee.tsx`) : le ticket de l'année suivante vient d'être gagné ; les
  cinq ampoules du fronton (`Fronton.tsx`), la médaille sous les confettis de la carte
  (`Particules`), puis le guichet tend le billet. « Le garder » ferme ; « L’utiliser » encaisse le
  ticket comme le « Utiliser » du bas de la fiche, et mène à la carte, qui joue l'avancée. Les deux
  appellent `POST /me/voyage/tickets/{annee}/montre`, une seule fois (`useMontrerLeTicket`). Un
  toucher pendant la scène pose son état final ; elle ne se quitte que par un choix, dont les
  boutons restent inertes un instant après être apparus (`GARDE_DU_CHOIX`) : le toucher redoublé ne
  dépense pas le billet.

Rien ne se mémorise : ni un rechargement ni le retour suivant ne rejouent une scène. Seule l'année
bouclée se **rattrape** : tant que le verdict du jury est guetté sur la fiche, le ticket qu'il
accorde la joue à son arrivée ; sinon, à l'ouverture de la carte, `ticket_a_montrer` de
`GET /me/voyage` la joue une fois (`sceneDuRattrapage`), après la marche s'il y en a une,
« L’utiliser » ne s'y offrant que pour le ticket de l'année qui suit mon année en cours. Une
relecture en panne ne consomme rien : la fête et les gains attendent la relecture réussie.

**Le dessin d'une fête se lit au monde** de l'année fêtée (`feteDeLaSalle`, `feteDeLaRecompense`,
`feteDeLAnnee`, par `gabaritDe`) ; sans gabarit, le rideau, la presse et le fronton restent
(`DessinDeLaSalle.tsx`, `DessinDeLaRecompense.tsx`, `DessinDeLAnnee.tsx`). Chaque scène garde son
cadre, son déroulé, ce qui s'entend et se sent, et l'année bouclée son choix et sa garde : un dessin
ne séquence, ne lit ni n'offre rien. Le séquenceur lui passe ce que la page a déjà lu (`lues.ts`,
sans requête) : la salle bouclée telle que la fiche la montre (`salleFetee` : son numéro, ses films ;
nulle à plusieurs), les récompenses des années d'avant de la décennie, lues de la carte en cache
(`recompensesDAvant`), et les arrivées de l'année par la règle de la fiche (`arriveesFetees`, jamais
recomptées). La fiche est celle que la page de l'année tient (`fiche`) ; la carte, qui rattrape, n'en
passe pas, et le dessin reçoit alors des manques. `salve` dit au dessin de l'année que le pas de la
médaille s'est joué : rien n'éclate au calme ni d'un toucher impatient.

**Une étiquette de la malle qui vient de se coller a sa scène** (`BadgeColle.tsx`, le type `badge` :
« étiquette » seul désigne la récompense), entre la récompense et l'année bouclée, une par étiquette,
par numéro. Son dessin est la clé **sans défaut** `feteDuBadge` : dans un monde qui ne la compose
pas, rien ne se lit et rien ne se joue. Ce qui vient de se coller est la différence entre deux
malles (`scenes.ts`, `badgesColles` : collée se lit sur `collee_le`, jamais sur la progression).
Celle **d'avant** est lue par le billet en s'ouvrant (`pages/VoyageBillet.tsx`, un `GET` qui n'écrit
rien, sans attente, panne muette), prise dans le cache juste avant l'écriture et confiée avec le
retour (`Avant.fete.malle`). Celle **d'après** est relue par l'année (`pages/VoyageAnnee.tsx`),
seulement si un retour lui confie une malle d'avant, toujours (`refetchOnMount: 'always'`), et ne
compte que relue avec succès après le montage : la fête l'attend pour ranger ses scènes, et se joue
sans elle si elle tombe en panne. Sans avant (le billet n'a pas pu la lire), aucune étiquette ne se
fête : la sacoche et son point rouge le diront. Ni un rechargement ni une année ouverte sans retour
ne lisent la malle. `src/pages/VoyageBillet.badge.test.tsx` tient les deux lectures sur un 1890
auquel on prête un dessin.

**En 1900, les fêtes se jouent dans le train** (maquette, écran 13 ; `mondes/1900/pages/`, une seule
feuille, `Fetes.module.css`, mots et règles dans `fetes.ts`). La salle bouclée est une **voiture
complète** (`VoitureComplete.tsx`) : la voiture à quai, sa voie (le numéro de la salle), les affiches
de ses quatre derniers films aux fenêtres (la fenêtre et la plaque du compartiment de
`Voies.module.css`, reprises et non copiées), la dernière qui s'allume, « Complet » qui tombe, le
guidon qui se lève, puis le carton « Voiture complète » ; à plusieurs salles, ou sans fiche, une
voiture sans voie ni film nommé. La récompense est une **étiquette de malle** (`EtiquetteDeMalle.tsx`) :
la malle porte celles des années d'avant de la décennie, le pinceau passe, l'étiquette de l'année se
colle au pas de la frappe. Un **badge collé** (`BadgeColleSurLaMalle.tsx`, la clé sans défaut
`feteDuBadge` ; maquette, « Étiquette collée ») se fête sur la même malle (`MalleDeFete.tsx`, que les
deux dessins montent) : les badges collés avant lui autour (`BadgeDeMalle`, celui de la sacoche ;
`placeDuBadge`, quatorze places), le pinceau, la colle, puis le sien au milieu au premier pas, et à la
fin « Étiquette collée », son nom et **la devise servie** (la maquette y écrit une phrase que le
contrat ne sert pas). L'année bouclée est une **ligne bouclée** (`LigneBouclee.tsx`) : la plaque
de la gare, les lignes de l'indicateur (`lignesDeLAnnee`, `ligneDeLIndicateur` : celles de la fiche
d'année) qui se pointent une à une, jamais une ligne encore attendue, le tampon rouge au pas de la
médaille sous les confettis du poinçon, puis le guichet tend le carton Edmondson du « Bon pour »
(`Carton.tsx`, sans note ni trous ; `trajetDuBon` dit la gare où le ticket mène) ; « Le garder » et
« L’utiliser » restent les boutons de la scène. Au rattrapage de la carte, sans fiche, la ligne
bouclée n'a pas d'indicateur. Les durées de la feuille suivent les pas de `deroule.ts` : le pinceau
et la colle servent deux scènes, et `fetes.test.tsx` les lie à `RECOMPENSE` comme à `BADGE`. Le nom
du dialogue reste celui de la scène (« Salle complète : … », « Étiquette collée : … »). **N'en sont
pas** : le tampon du douanier et l'adieu par la vitre
arrière, qui se joueront sur la carte avec les années 1910 ; le vert du guidon et de la Palme, sans
jeton, est le bleu de l'émail.

Le séquenceur (`Celebrations.tsx`) pose les jetons du monde et le tempo sur son calque. Chaque pas
attend au tempo (`deroule.ts`, `useDeroule`), et **une scène démontée n'écrit plus rien** : ni état,
ni son, ni vibration. Chaque scène est un dialogue qui garde le focus (`Cadre.tsx` : Tab tourne entre
ses boutons). Le son est celui de la carte, `clap()` et `carillon()`, et seulement si le
membre l'a allumé (son réglage, et l'ambiance en marche : `celebrations/son.ts`) ; hors de la carte,
où l'ambiance est tue, la fête la réveille le temps de ses scènes (l'orgue reprend avec elle), puis
la rend au silence. Le téléphone vibre avec le clap ou le carillon, jamais seul.

**L'historique.** Depuis la fiche d'un film, composter **remplace** le billet par l'année ; depuis la
séance de l'année, il recule vers elle. La page d'un réalisateur (onglet Suivis) mène un film qui
figure dans une salle à sa fiche du Voyage (la plus ancienne année où il figure), l'onglet Voyage
marqué, et sa ligne l'annonce (« · Voyage 1896 ») : « Retour » y recule jusqu'au réalisateur. Composter depuis là donne l'historique
`[réalisateur, film, année]` : le retour depuis l'année ramène au film, désormais vu, puis au
réalisateur.

**« Moins d'animations »** y pose tout à l'état final : chaque toile peint une image immobile
(repeinte au rendu et quand une police finit de charger), la feuille du chroniqueur se pose d'un
coup sans minuterie, la corde ne se balance plus, les compteurs sont à leur valeur, aucun « +1 »
ne vole, aucun confetti ne tombe du poinçon, et le téléphone ne vibre pas. Le billet ne se
tamponne pas (l'année revient aussitôt), la manivelle ne tourne pas, le guichetier ne bouge pas, le
manège se fige à un angle où aucun cheval n'est derrière le pilier (`ANGLE_AU_CALME`,
`mondes/1890/monument.ts`), et aucun tampon du passeport ne frappe. Une célébration pose son état
final d'un coup : le carton et son bouton, sans minuterie, sans confettis ni vibration ; en 1900,
la voiture est complète, l'étiquette ou le badge collés et les lignes pointées d'emblée, sans pinceau.

**La manivelle** (`voyage/annee/Manivelle.tsx`, règles dans `voyage/manivelle.ts`) enveloppe la
fiche de toute année, quelle que soit sa forme. Tout en haut de la page (le `<main>` de la coque à
`scrollTop` 0), tirer vers le bas : le contenu suit le doigt à mi-course (110 px au plus), le bras
tourne ; lâché au-delà de 70, la fiche et la carte se relisent, elles seules (`refetchQueries`
`exact` : ni les autres fiches, ni le journal, ni le générique), le contenu tenu à 80 px pendant
au moins un tour (`UN_TOUR`, 500 ms), puis une bulle au-dessus de la barre d'onglets dit que la
bobine est rechargée (4 s), ou le refus de l'API. Un tirage ne commence qu'au-delà de 10 px
(`BOUGE_PX`, le seuil de la carte) : en deçà, c'est un toucher, qui ouvre ce qu'il touche ; le
`click` qui suit un vrai tirage (500 ms) n'ouvre rien. Jamais au milieu de la page, sous un calque
ouvert (son voile compris), pendant une saisie, ni pendant un rechargement. Les écouteurs sont
natifs et non passifs : React pose `touchmove` en passif, et son `preventDefault` serait ignoré. En
bas de la fiche, « Recharger la bobine » fait la même relecture, sans tour, pour qui ne tire pas.

## Les pages d'une décennie

Trois pages sous l'onglet Voyage (plan 2c), chacune habillée par le monde de sa décennie comme les
fiches. Une adresse qui n'est pas une décennie du Voyage (pas un multiple de dix, avant 1890, après
la décennie de l'année civile **à Paris**, `anneeCivile`) ramène à la carte (`decennieDeLAdresse`).
**Aucune n'enfile d'ouverture chez le chroniqueur** : la page d'une décennie lit la carte, mes
tickets et mes visionnages des films sortis dans la décennie (`journalDesAnnees`, `GET /me/journal`
borné par `sortie_min` et `sortie_max`) ; la boîte, la carte et ces visionnages (et le catalogue des
réactions à l'ouverture d'un billet qui en porte) ; ni l'une ni
l'autre ne lit de fiche d'année. Le guichet lit la carte, puis les seules fiches déjà écrites et
ouvertes.

**La page d'une décennie** (`/voyage/decennies/:decennie`). On y entre par la plaque du chapitre :
le titre du HUD de la carte (la décennie de l'année en cours) et la plaque du bandeau d'une année
(la décennie de cette année). Dans l'ordre :

- **Le monument** du monde, sur une toile : en 1890, le manège, un cheval par année
  (`mondes/1890/monument.ts`). Le toucher achevé (`Toile.onChoisir`, le `click`) ouvre l'année du
  cheval le plus proche sous le doigt, si elle a sa page ; le premier contact (`onToucher`,
  `pointerdown`) n'ouvre jamais rien, puisqu'un défilement commence aussi par lui, et emballe le
  manège hors d'un cheval qui s'ouvre. Les chevaux de derrière se touchent aussi, mais un doigt qui
  tombe à la fois sur un cheval de devant et sur un de derrière ouvre toujours celui de devant
  (`figureTouchee`, le plan que chaque figure inscrit). Le monde « à
  venir » ne dessine qu'un fond, sans rien à toucher. Le libellé de la toile finit par un mot du
  monde (`mots.decennie.toucher`, « touchez un cheval pour ouvrir son année » en 1890) ; nul, il
  s'arrête à la décennie : c'est le cas du monde « à venir ».
- **Le passeport** (`voyage/decennie/Livret.tsx`) : l'anneau des années de la décennie qui portent
  leur récompense, puis ce qui manque en clair (« Il manque une récompense en 1897 et 1899, et le
  ticket de 1900. », `ceQuiManque`, le jumeau de `calculerTampons` de l'API). Le ticket se juge sur
  `GET /me/voyage/tickets` : tant qu'ils ne sont pas lus, rien ne se dit ; leur panne se dit à la
  place de la phrase. Dessous, le tampon posé, ou sa place.
- **La palissade** : les affiches de mes films de chaque année, quatre au plus, les millésimes au
  pochoir.
- **Le registre des recettes** : une ligne par année (films vus, récompense, ma meilleure note) ;
  une année qui a sa page en est le lien, le chemin du clavier et du lecteur d'écran.
- **Les liens** vers la boîte et le guichet, ceux de `PAGES_DE_LA_DECENNIE` (`voyage/decennie.ts`)
  seulement : une page sans route y ramènerait à l'accueil, hors du Voyage.

**En 1900, la page est la ligne des années** (maquette « Voyage immobile 1900 », écrans 1 et 9 ;
`mondes/1900/pages/`, par les six clés de gabarit de la page). En tête, l'affiche du Transsibérien à
la place du monument (`Affiche` : rien ne s'y touche), le titre de la page (« Années 1900 », en petit au-dessus du nom du monde) et une phrase qui dit
où j'en suis, calculée sur les arrêts (`phraseDeLaLigne`, `mondes/1900/pages/ligne.ts`). Puis
**l'indicateur de la ligne** à la place du registre (`IndicateurDeLaLigne`) : dix arrêts, l'année en
heure (« 19.04 »), le lieu de sa photographie (`LIEU`), et son état : la récompense, « Bouclée »
(comme la fiche de l'année le dit, `estBouclee`), le compte de l'année en cours (`jauge`), « à
développer ». « Tu es ici » marque mon année en cours, « Léa y est » celle du Voyage suivi
(`voyageurSuivi`, jamais au compte IA). Un arrêt qui a sa page en est le lien : c'est le seul chemin
vers une année, pour le doigt comme pour le clavier. Ni les films vus (sauf en avance) ni la meilleure
note du registre n'y sont dits. Puis les liens, le casier avec le compte de mes billets et le guichet.
Puis **le passeport** (`Frontiere`), une page à tampons de frontière : la sortie de la décennie d'avant,
datée du `boucle_le` de son tampon à Paris et absente sans lui (`sortieDe`), l'entrée une fois mon année
en cours dans la décennie (`entreeFaite`), le tampon de la décennie (celui de la carte) ou sa place, la
photo de la douane du Donon (`douane`), et « Il manque… », tu tant que les tickets ne sont pas lus. La
palissade n'y est pas (plan des pages 1900, décision 5) : une panne de mon journal ne s'y dit donc nulle
part, et ne coûte que le compte du casier.

Pour un membre hors IA, une année que le Voyage suivi n'a pas encore ouverte (`etatDeCase`,
`attente`) n'est jamais « en cours » : son cheval est terne au pointillé or, comme sa case de la
carte, qui ne porte plus de corail ; le registre dit « Théo est trop lent » (`tropLent`). Le compte IA,
ou un compte qui ne suit personne, ne le dit de personne.
Derrière le voyageur suivi (son `annee_en_cours` plus loin que la mienne), mon année en cours, elle
seule, ajoute « tu le rattrapes bientôt » à son état : le HUD, l'aperçu, le lien de la carte et le
registre (`rattrapeBientot`, `voyage/regles.ts`) ; jamais sur une année en attente.

**Le tampon du passeport** (`voyage/passeport/Tampon.tsx`), le même sur la carte, dans le livret et dans la sacoche :
un rond de papier à l'encre rouge du monde (jamais le corail), « Passeport », « Années 1890 » au
pochoir, « bouclée », le titre du voyageur, et le jour où la décennie a été bouclée, **à Paris**
(`boucle_le`, « 1er janvier 2000 »). Il ne frappe que posé à l'instant (`frappe`) : sur la carte, au
passage de la décennie ; jamais dans le livret, qui le montre posé depuis des mois. Il ne descend
pas sous 196 px de côté, où son jour ne se lirait plus.

**La boîte à billets** (`/voyage/decennies/:decennie/billets`). Un billet par visionnage d'un film
sorti dans la décennie, à partir du départ du Voyage (`depart` de la carte : les films de 1890 à
1894 n'ont ni billet ni numéro), numéroté du premier vu au dernier (`billetsDeLaDecennie` : la date du
visionnage, puis sa création, puis son identifiant) ; le numéro se recalcule à chaque lecture et
n'est stocké nulle part, si bien qu'un visionnage ancien ajouté après coup décale ceux qui le
suivent. Un intercalaire par année du Voyage, et « Tous ». L'intercalaire vit dans l'adresse (`?annee=`), le billet ouvert
en grand aussi (`?billet=`) : il dit la date, la note, les réactions et ma remarque privée, prend le
focus, se ferme à Échap ou par le geste « retour ». « Corriger le billet » ne s'offre que si la fiche
de l'année du film est déjà en cache (`voyage/boite/correction.ts`) : la boîte ne la lit jamais. Le
billet que la séance vient de ranger (`voyage/billet/range.ts`, en mémoire, par membre) y est mis en
avant une fois, son casier ouvert, d'un liseré or. **Si le monde de la décennie compose le contrôleur**
(`controleurDeLaCarte`, la clé sans défaut de la carte : la boîte n'en regarde que la présence), la
page lit aussi l'état du voyageur, sous la clé de la carte, et passe au casier (`poinconnes`) et au
billet sorti (`poinconne`) les billets que le contrôleur a poinçonnés, **par leur entrée de journal,
jamais par leur film** (`voyage/voyageur.ts`, `entreesPoinconnees`) : deux séances du même film n'en
portent qu'un. Elle n'attend pas cette lecture et sa panne se tait : le casier se montre entier, sans
poinçon. La boîte par défaut ignore les deux champs, et la boîte d'un monde sans contrôleur ne lit
rien de plus **ni ne montre aucun poinçon, même si la carte a déjà mis l'état du voyageur en cache**
(retenir la lecture ne retient pas ce que le cache rend : la page ne regarde l'état que si le monde
compose la clé) (`pages/VoyageBoite.poincon.test.tsx`, sur un 1890 auquel on prête des dessins). **En
1900, un billet présenté garde son poinçon doré au casier**, sur son carton de la liasse (le bouton du
carton le dit : « Poinçon doré du contrôleur ») comme sorti en grand, posé sans bruit : rien ne s'y
perce ni n'y luit, la percée est à la portière. Présenté sur la carte, il se voit au casier sans
rechargement : la réponse a garni le cache que la boîte lit (`mondes/1900/pages/casier.test.tsx`,
`controleur.test.tsx`).

Dans les années 1900, la boîte est **le casier du contrôleur** (maquette, écran 8 ;
`mondes/1900/pages/CasierDuControleur.tsx`, pour la clé `casier`) : un meuble à une case par année du
Voyage, les cartons empilés dans leur fente, « Tous » sur une plaque de laiton, et sous lui la liasse
de la case choisie, du plus ancien billet au plus récent (`liasseDe`, `mondes/1900/pages/casier.ts`),
deux cartons Edmondson de front, chacun à son numéro de séance, sa note percée, sa date pressée et
son tampon. Le billet sorti en grand (`BilletDuCasier`, pour `billetEnGrand`) montre le carton, la
date de la séance en toutes lettres, les réactions en coupons et ma remarque sur le carnet, puis
« Corriger le billet » (le bouton corail, quand la page l'offre) et « Ranger au casier ». La page
garde tout le reste : sa tête, son pied, ses deux lectures, l'adresse, le billet rangé.

**Le billet numéroté.** Composter sur le billet de séance (« Tamponner « Vu » » · « et ranger le
billet ») joue la séquence de la maquette (`FRAPPE` et `DUREE_DU_COMPOSTAGE`, `voyage/billet.ts`) :
le marteau descend (360 ms de base), l'encre se pose et le téléphone vibre, une pause (140), le
marteau remonte (320), le numéroteur fait dix tirages (45 chacun), une pause (200), le talon part
(700) ; puis l'année revient, comme au plan 2b, où le compteur roule et le « +1 » vole. **Le tempo**
(`TEMPO`, `voyage/tempo.ts`) multiplie chaque durée et chaque délai de cette séquence, et des
célébrations qui la suivent, en JS
(`auTempo`) comme en CSS (`calc(360ms * var(--tempo))`) : ×2 depuis le 1er octobre 2026, soit
4 340 ms du toucher au retour à l'année au lieu de 2 170. C'est le seul chiffre à changer ;
`voyage/tempo.test.ts` refuse une durée de la séquence écrite sans lui. Le numéro se lit dans la boîte, par la
même requête et la même clé : celui du billet est celui de la boîte. Si elle n'a pas répondu à la fin
des tirages, le numéroteur s'arrête sur « N° ···· » et la séquence continue. Au calme, rien de tout
cela : l'année revient aussitôt, et le numéro se lit dans la boîte. Corriger ne tamponne pas : le
numéro se lit en tête.

**Le guichet** (`/voyage/decennies/:decennie/recherche`). Il cherche dans le catalogue des salles
déjà écrites de la décennie : la page ne lit que les fiches des années visitées et non verrouillées
(`anneesDuCatalogue`, le jumeau de `apercuLitLaFiche`, l'aperçu de la carte), ce qui n'enfile rien
chez le chroniqueur. Films et bobines des programmes, par titre ou réalisateur, sans accents ni
casse, apostrophes, ligatures et espaces pliées (`voyage/catalogue.ts`), le passage trouvé souligné ;
filtré par années, dont les boutons ne viennent que des fiches prêtes. Rien ne part à la frappe. Sans
saisie, « les plus demandées » : les essentiels pas encore vus, six au plus. La saisie et les années
cochées sont retenues sous l'entrée d'historique (`voyage/recherche/memoire.ts`, `sessionStorage`) :
revenir d'une fiche de film les retrouve, une navigation nouvelle ouvre un guichet vide. Au doigt, la
fenêtre monte au-dessus du clavier, sur une place que la page ajoute en bas ; cette place ne se rend
qu'après le `click` d'un toucher commencé dans la page, sans quoi la liste glisserait sous le doigt
et le toucher d'un résultat serait perdu. « Chercher hors du Voyage » mène à la recherche du journal.

Où vit quoi : les règles, sans rendu, dans `src/voyage/` (`decennie.ts` : l'adresse, les chevaux,
le toucher, le registre, la palissade ; `passeport.ts` : le tampon et ce qui lui manque ;
`billets.ts` : le numéro, les intercalaires, le casier ; `catalogue.ts` : le pliage et la
recherche ; `manivelle.ts` ; `billet/range.ts` : le billet rangé) ; les morceaux dans
`voyage/decennie/`, `voyage/boite/`, `voyage/passeport/`, `voyage/billet/` (`Tampon.tsx`,
`Numeroteur.tsx`) et `voyage/recherche/` ; le monument et le guichet de 1890 dans
`mondes/1890/monument.ts` et `mondes/1890/guichetPage.ts`.

## La sacoche du voyageur

**La sacoche** (`/voyage/sacoche`, `pages/VoyageSacoche.tsx`) regroupe ce que j'ai accompli dans le
Voyage, repris du profil de l'appli Android, au costume du Voyage : habillée par le monde de mon
année en cours, sous l'onglet Voyage. On l'ouvre par la pastille « Sacoche du voyageur » de la
carte (l'icône de la mallette, à côté du son) ; le retour ramène à la carte. Trois blocs fixes (le
passeport, le portefeuille, les coulisses), et deux de plus dans un monde qui les compose (la malle
entre le passeport et le portefeuille, les objets trouvés entre le portefeuille et les coulisses :
plus bas, « La malle aux étiquettes » et « Les objets trouvés »), chacun lisant ses données et
tombant seul en panne (`voyage/sacoche/`, règles sans rendu dans `voyage/sacoche.ts`). **Tant que la carte n'a pas répondu, aucun monde n'habille la page** (ouverte
par un lien direct, elle ne montre pas la sacoche de la foire à un voyageur de 1900) : elle attend
comme la carte attend, sans jetons, les trois blocs fixes déjà montés, cachés et sans dessin, leurs lectures
parties ; la carte en panne, elle prend le monde du départ et chaque bloc dit ce qu'il a. Chaque bloc
garde sa région (elle ne se remonte ni quand la carte répond ni quand le monde change : le pli des
coulisses y survit), ses lectures, ses écritures et sa navigation, et passe ce qu'il a lu à un dessin qu'un monde peut composer (`GabaritsDesPages`) : `teteDeLaSacoche`
(`Tete.tsx`, le titre de la page), `passeportDeLaSacoche` (`Pages.tsx`, le cadre du passeport),
`portefeuille` (`Tickets.tsx`) et `coulisses` (`Repli.tsx`) se lisent au monde de mon année en
cours ; `pageDuPasseport` (`Page.tsx`) se lit **au monde de la décennie de la page**, si bien que la
page des années 1890 garde son dessin dans la sacoche d'un autre monde :

- **Le passeport** (`Passeport.tsx`) : une page par décennie, du départ à celle de mon année en
  cours, chacune habillée par son monde et menant à la page de la décennie. Bouclée, son tampon
  (posé, il ne frappe pas) ; sinon, son anneau (`voyage/passeport/Anneau.tsx`, le même que le
  livret), décennie en cours comprise.
- **Le portefeuille** (`Portefeuille.tsx`) : les tickets à utiliser, puis les utilisés, pâlis, avec
  le jour de Paris où ils l'ont été. « Utiliser » ne s'offre que sur le ticket que la carte offre
  (`ticketOffert`) ; encaissé, il ramène à la carte, qui joue l'avancée, sans laisser la sacoche
  derrière elle dans l'historique.
- **Les Coulisses** (`Coulisses.tsx`), repliées : les dépenses au chroniqueur, lues au dépli
  seulement (`enabled`), montrées une fois la liste connue et non vide (le mois courant est celui du serveur, en
  UTC, où l'API les range), et les crédits des images, lus au build dans les
  `CREDITS.md`.

**En 1900, la sacoche est de cuir** (maquette, écran 15 ; `mondes/1900/pages/`, une seule feuille,
`Sacoche.module.css`, mots et règles dans `sacoche.ts`) : le rabat et son fermoir de laiton portent
« Chemins de fer du Voyage » et le titre de la page (`Rabat`) ; le passeport range ses pages sur une
colonne (`PasseportDeLaSacoche` : le tampon d'une décennie ne se lit pas sous 196 px, la maquette
en montre deux) ; la page des années 1900 est une feuille de papier, l'anneau de ses récompenses et
son compte au cœur, « En cours », ou le tampon de la décennie et « Tampon posé »
(`PageDeLaSacoche`, qui pose ses jetons sur elle : la sacoche d'un autre monde la montre telle
quelle, comme celle de 1900 montre la page de la foire sur son velours) ; les tickets sont des
cartons à bande rouge, « Utiliser » au corail sur le seul ticket offert (`PortefeuilleDeLaSacoche`) ;
les coulisses tiennent dans un casier que leur titre ouvre (`CoulissesDeLaSacoche`). Rien n'y bouge.

**La malle aux étiquettes** (maquette, écrans 15 et 18 ; `MalleDeLaSacoche`, sa feuille
`Malle.module.css`, mots et règles dans `malle.ts`) tient entre le passeport et le portefeuille, en
1900 seulement : c'est la clé sans défaut `malleDeLaSacoche`, que `voyage/sacoche/Malle.tsx` lit avec
la malle de la décennie de mon année en cours et l'état du voyageur (plus bas, « Le jeu des années
1900 »). Sa ligne de cuir montre l'étiquette collée en dernier (par l'instant, jamais par le texte de
sa date), « 5 étiquettes sur 15 » **avec le total que le serveur sert**, « La Correspondance, collée le
29 septembre 2026 » au jour de Paris, et « 1 nouvelle » pour ce qui s'est collé depuis ma dernière
visite. La toucher ouvre la malle par-dessus la sacoche, **dans l'adresse** (`?malle=ouverte` : le
retour du téléphone, « Refermer » et Échap la referment, un rechargement la rouvre) : la valise, ses
places telles que le serveur les range, par numéro, chacune son badge (`BadgeDeMalle`, muet : le
bouton de la place porte le seul nom lu), « Nouvelle » sous celles qui le sont et dans leur nom lu
(`nomLuDeLaPlace`), la plaque de la
décennie ; au pied, la fiche de la place touchée (la dernière collée en s'ouvrant, sinon la
première) : son numéro, son nom, sa règle, « Collée le … » ou ce qui manque avec sa jauge, « à
gagner » pour un seuil de un, et rien d'elle pour une cachée. Une décennie sans malle ne montre rien ;
en panne, la malle le dit sous sa rubrique, et elle seule.

**Les objets trouvés** (maquette, écran 15 ; `ObjetsDeLaSacoche`, sa feuille `Consigne.module.css`,
mots et règles dans `consigne.ts`) tiennent entre le portefeuille et les coulisses, en 1900 seulement :
c'est la clé sans défaut `objetsDeLaSacoche`, que `voyage/sacoche/Objets.tsx` lit avec le seul état du
voyageur. **Le catalogue est au monde** (`mondes/1900/objets.ts` : dix objets, un par gare de 1900 à
1909, par `cle` du contrat, chacun son nom, son nom court et **un seul dessin**, une suite de tracés
que le quai reprendra) : le serveur ne sert que les objets ramassés. Dix places de consigne dans
l'ordre des années : ramassé, l'objet pend à son étiquette de papier, datée de sa gare, sous son nom
court (lu « 1900 : une lanterne de chef de gare, dans la sacoche ») ; sinon sa silhouette, l'année et
« à trouver » (lu « 1903 : un objet à trouver en gare »), **sans rien qui le nomme**. Le compte, « 2
sur 10 », se dit sur le catalogue : une clé servie qu'il ne connaît pas n'a pas de place et ne compte
pas. En panne, la consigne le dit sous sa rubrique, et elle seule : la malle garde sa ligne. On ne
ramasse rien ici : c'est le geste de la carte (« La carte du Voyage », les objets oubliés sur le quai).
**Le courrier** (brief 13 des écrans des lots) vient entre le portefeuille et les objets trouvés, par
la clé sans défaut `courrierDeLaSacoche`, que `voyage/sacoche/Courrier.tsx` lit avec ma boîte
(`GET /me/voyage/cartes-postales`, sous `cles.courrier`) et, par le crochet de la visite, l'état du
voyageur. Le bloc passe la boîte **telle que servie** : les reçues de la plus récente à la plus
ancienne (nouvelle tant que `lue_le` est nul), les envoyées par gare, **dont rien ne dit la lecture**
(le serveur ne sert `lue_le` qu'au destinataire). Une carte s'ouvre **dans l'adresse**, par son
identifiant (`?carte=<id>`, `voyage/calque.ts` : le retour du téléphone la referme, un rechargement la
rouvre, un identifiant que la boîte ne connaît pas n'ouvre rien) ; **jamais son mot**, qui est privé et
ne s'écrit ni dans une adresse, ni dans un titre, ni dans un journal de console. **Ouvrir une carte
reçue pas encore lue la marque lue** (`POST …/cartes-postales/{id}/lue`) : une fois par carte (un
verrou), jamais une carte envoyée (le serveur répondrait `404`), jamais pendant une relecture de la
boîte ni après une relecture en panne ; « nouvelle » tient jusqu'à la réponse du serveur, le cache
n'apprend que la carte rendue (une relecture en vol est annulée d'abord, `exact`), **rien n'est
périmé**, et une panne rend le verrou : la carte reste nouvelle et sa prochaine ouverture la remarque.
La rubrique `courrier` se marque vue une fois par visite (`useVisiteDeRubrique`) dès que j'ai reçu une
carte, jamais pour une boîte vide ou des envoyées seules (le point rouge se date sur les reçues). En
panne, le bloc le dit, et lui seul ; une carte ouverte quand la relecture tombe reste à l'écran, et la
panne se dit une fois refermée. `pages/VoyageSacoche.courrier.test.tsx` le tient sur un 1890 auquel on
prête un dessin. **1900 la dessine** (maquette « Voyage immobile 1900 », écrans 15 et 19 ;
`mondes/1900/pages/CourrierDeLaSacoche.tsx`, `Courrier.module.css`, les mots et les règles dans
`courrier.ts`) : la rubrique « Le courrier · les cartes postales », puis « Reçues », un pli de papier
par carte (la photographie de la gare d'où elle part, ou un dos de carte ; « De Léa · gare de 1902 » ;
le mot sur deux lignes au plus ; « Nouvelle » tant que `lue_le` est nul), puis « Envoyées » (« À Léa ·
gare de 1902 », l'adresse servie), et « Aucune carte encore. » pour une boîte vide. Ouverte, la carte
est un dialogue par-dessus la sacoche (« Refermer la carte » prend le focus et le rend, Échap ferme) :
**le recto de sa gare seulement si 1900 en a la photographie** (ses dix gares ; une carte partie d'une
gare de la foire ou d'après 1909 n'a que son verso, décision 8, jamais une image cassée), sa légende
(le lieu de l'image), puis le dos divisé d'époque : « Correspondance », le mot à la plume, signé de son
expéditeur ; « Adresse », le timbre, le tampon à date (la gare d'où elle part, le jour de l'envoi **à
Paris**) et l'adresse **telle que servie** (`destinataire.pseudo`, `gare_destinataire` figée à l'envoi,
et le lieu de cette gare si 1900 le connaît), jamais mon année en cours. **Le mot est un texte d'un
autre membre** : rendu en texte, en entier, ses retours à la ligne visibles, jamais en HTML ; aucun
attribut, aucun nom lu, aucun titre ne le porte. Rien n'y bouge. On n'y écrit pas de carte (brief 14 :
`en_attente` est lu, rien ne l'annonce). `mondes/1900/pages/courrierDeLaSacoche.test.tsx` tient ce
qu'il dit. Le point rouge de la
pastille est sur la carte (« La carte du Voyage ») (`mondes/1900/pages/sacoche.test.tsx` nomme, route par route, ce que la sacoche de 1900 a
le droit de lire, et la liste entière de ses rubriques).

Elle lit la carte (`GET /me/voyage`) et les tickets (`GET /me/voyage/tickets`) sous les clés de la
carte, au dépli des Coulisses les dépenses (`GET /me/voyage/depenses`), et en 1900 seulement la malle
de ma décennie, ma boîte aux cartes postales et l'état du voyageur, dont elle marque les rubriques
`etiquette`, `courrier` et `objet` vues (et, au geste, la carte reçue qu'on ouvre) :
**jamais une fiche d'année** (`pages/VoyageSacoche.test.tsx` compte les requêtes parties, et
`mondes/1900/pages/sacoche.test.tsx` pour la sacoche de 1900). Pas de générique au toucher
d'un tampon : il n'est pas venu avec les célébrations, et reste à faire. Le Profil n'en porte rien.

### Le jeu des années 1900 : le socle

L'API sert huit choses que seul 1900 dessine ou dessinera (la malle aux étiquettes, les objets
trouvés, le point rouge, le contrôleur et son poinçon, l'horaire, la halte, la carte postale, le
wagon-restaurant) : **la malle et les objets trouvés ont leur écran, dans la sacoche, et les objets se
ramassent sur le quai de la carte, où la pastille de la sacoche porte son point rouge ; le contrôleur des
billets passe sur la carte et son poinçon doré reste au casier ; l'horaire se prend, se retire et se dit
sur la fiche de son année, et la plaque de sa gare le dit sur la carte ; la halte s'ouvre sur la carte ;
les cartes postales reçues et envoyées se lisent dans la sacoche ; écrire une carte et le
wagon-restaurant n'ont rien à l'écran**
(`docs/cerveau/jeu-1900.md` tient où en est chaque écran) :

- **Les routes** (`api/voyage.ts`, les types par alias sur le contrat) : `lireVoyageur`
  (`GET /me/voyage/voyageur` : mes objets ramassés, mes rubriques vues, le contrôleur, mes poinçons),
  `lireMalle` (`GET /me/voyage/decennies/{decennie}/etiquettes`), `ramasserObjet`,
  `marquerRubriqueVue`, `repondreAuControleur`, `accepterHoraire` (sans corps : le serveur seul choisit
  l'échéance) et `retirerHoraire`. **Les cartes postales** (brief 13) : `lireCourrier`
  (`GET /me/voyage/cartes-postales` : mes cartes reçues, envoyées, et mes gares bouclées qui attendent
  la leur ; il n'écrit rien), `marquerCarteLue` (rejouable, `404` pour une carte que j'ai envoyée) et
  `posterCartePostale` (le corps tel quel, strict côté serveur ; aucun écran ne l'appelle encore). **Le
  mot d'une carte est privé** : il ne s'écrit ni dans un journal de console, ni dans une adresse, ni
  dans un titre. Rien encore pour les tables. **Mes abonnements** (brief 14, `api/abonnements.ts`, un
  fichier à part : la route n'est pas du Voyage) : `lireMesAbonnements` lit `GET /users/me/following`
  **page après page** (cent par page, le curseur rendu tel quel, jusqu'à `next_cursor` nul) et rend les
  membres dans l'ordre servi, sous `cles.abonnements`, **hors du préfixe `voyage`** ; la carte postale à
  écrire et la table à dresser y choisissent « un membre que je suis », par cette fonction seule.
- **Les clés** (`api/cles.ts`) : `voyageur`, `malle(decennie)` et `courrier`, **sous le préfixe
  `voyage`** : une écriture au journal, qui colle une étiquette, change le billet que le contrôleur
  demande ou boucle une gare (qui attend alors sa carte : `en_attente`), les
  périme sans qu'aucune page hors Voyage les connaisse (`api/cles.test.ts`,
  `pages/VoyageBillet.test.tsx`). L'état du voyageur n'a qu'une clé et qu'une fonction, pour la
  carte, la sacoche et le casier.
- **Le point rouge** (`voyage/voyageur.ts`, sans rendu) : `rubriquesAllumees` dit, pour les rubriques
  servies et les dates de leurs éléments, lesquelles sont allumées (un élément daté strictement après
  `vue_le`, ou la rubrique jamais vue et non vide ; une rubrique inconnue s'ignore) ; `estNouveau` dit
  ce qui est nouveau depuis une date. Deux instants s'y comparent, jamais deux chaînes. Le serveur ne
  calcule ni l'un ni l'autre. La carte le montre sur la pastille de la sacoche (`RUBRIQUES_DE_LA_PASTILLE`,
  `rubriquesDeLaPastille`, `nouveautesDeLaSacoche`, `nomDeLaSacoche` : « La carte du Voyage »).
- **La carte en sait plus, sans rien dessiner** (brief 9 des écrans des lots). `GET /me/voyage` sert
  déjà l'horaire de chaque année et les haltes : `pages/Carte.tsx` les met dans l'état de la carte,
  dans le même `useMemo` que les cases (relue à l'identique, la carte ne refait pas son état), et le
  moteur les passe au monde. Par année, `CaseVue.horaire` : l'état (`accepte`, `tenu`, `manque`) et
  l'échéance tels que servis, ou nul ; l'appli ne calcule ni l'un ni l'autre. Par monde,
  `VueMonde.haltes` : la clé, le nom servi (depuis le brief 12, pour le poteau de l'embranchement), `apres`, et de quoi dire « 2 sur 3 » (les films vus, sur ceux que le
  serveur sert), pour les seules haltes qui s'embranchent après une année de sa section ; une halte
  d'une année que la carte ne montre pas (une décennie cachée) n'est pas passée. **Une septième zone
  est au moteur, `aiguillage`** (`halte` est déjà la gare au bout de la foire, et reste au monde) : le
  monde qui dessinera un embranchement l'inscrit, `data` au rang de la halte dans sa vue, et son
  toucher dit la clé de la halte à la page (`Rappels.aiguillage`, relayé par `CarteCanvas`), au calme
  aussi (c'est une lecture), jamais à `reagir`. **La page l'écoute** (brief 12 ; `pages/Carte.tsx`,
  `prendreLAiguillage`) : la halte s'ouvre **dans l'adresse** (`?halte=<clé>`, `voyage/calque.ts` : le
  retour du téléphone la ferme, Échap et son bouton aussi, un rechargement la rouvre), par une clé de
  gabarit sans défaut, `halteDeLaCarte`, lue au monde **de la décennie de la halte** (son `apres`) :
  sans elle ni le toucher ni l'adresse n'ouvrent rien. Elle n'existe que servie et montrée par la
  carte : une clé inconnue n'ouvre rien, aucun catalogue n'est dans l'appli. Le bloc lecteur
  (`voyage/halte/Halte.tsx`) ne lit ni n'écrit aucune route (une halte n'a pas d'écriture : un film vu
  passe par le journal) ; il garde Échap, le focus et le compte (`voyage/halte/compte.ts`,
  `compteDeLaHalte` : les films à l'état `vu` sur ceux que le serveur sert, la même règle que pour le
  monde) et passe la halte telle que servie. **Jamais par-dessus autre chose** : la carte tire un seul
  « dialogue courant » d'un ordre écrit une fois (`pages/Carte.tsx`, `ORDRE_DES_DIALOGUES`,
  `dialogueCourant`) : l'avancée, la fête du rattrapage, un passage, la vue d'ensemble, l'affiche
  d'une date, l'aperçu, puis la portière du contrôleur, puis la halte. Le premier qui prétend à l'écran
  le tient, les autres attendent : une halte que l'adresse porte (un rechargement, l'historique
  avancé) attend son tour (`halteOuverte`), et ouverte elle tient le plein écran (le contrôleur
  attend). Ce qui ne fait que passer (un message, la carte relue, un vol, un ramassage, la phrase de la
  roulotte) n'est pas dans l'ordre : il ne ferme pas une halte ouverte. **Un dialogue neuf s'ajoute
  d'un nom dans cet ordre**, et le type oblige à dire quand il prétend à l'écran. Le toucher du levier
  lit `pleinEcranOccupe` (le dialogue courant ou ce qui passe) : sous un dialogue courant il est
  refusé net ; pendant que quelque chose passe (en gare de 1902 le parapluie ramassé et son message
  tiennent l'écran plus de quatre secondes), sa clé est retenue, la dernière seulement, et la halte
  s'ouvre quand l'écran se libère, sauf si un dialogue a pris l'écran entre-temps (`halteAttendue`).
  Les deux enveloppes sont inertes sous elle comme sous la portière
  (`dialogueOuvert`), et refermée le focus tombé au document revient au titre. Le moteur ne
  dédoublonne pas : deux touchers avant le rendu n'empilent qu'une entrée d'historique
  (`halteEnRoute`). `pages/Carte.halte.test.tsx` le tient sur un 1890 auquel on prête un dessin.
  **1900 la dessine** (maquette « Voyage immobile 1900 », l'aiguillage et `#halte`). Sur la carte
  (`mondes/1900/aiguillage.ts`) : pour chaque halte **servie** et aucune autre, un levier à contrepoids
  au bout du quai de la gare `apres`, sous une étiquette au nom servi, et un poteau fléché sur le
  tronçon, qui écrit le nom et « EMBRANCHEMENT · n FILMS » sur le compte servi ; la règle de place est
  pure (`aiguillagesALEcran` : ni dans une gare à développer, ni hors de la fenêtre de la section ; le
  levier est à l'écran quand le train est arrêté en gare d'`apres`), et elle dit aussi la zone du
  levier (son centre à mi-hauteur de sa vue, son rayon, sa priorité 2, devant la case et la voiture
  de sa gare, derrière une bobine), que le monde inscrit telle quelle, `aiguillage`, au rang de la
  halte dans sa vue. Rien n'y bouge, le trait n'a pas de test. Le dialogue
  (`mondes/1900/pages/HalteDeLaCarte.tsx`, `Halte.module.css`, les mots dans `halte.ts`) : la petite
  gare dessinée (`DessinDeLaHalte.tsx`, les tracés de la maquette, aucune photographie), la plaque au
  nom servi et « hors ligne · embranchement », l'indicateur (« Halte · n films », « v sur n », puis par
  film son affiche ou « sans affiche », son titre, son année, son état par les mots d'un film de salle,
  les cinq du contrat, et « Voir sur le Plex » s'il en a un) et « Revenir sur la ligne », le seul
  bouton : **aucun geste n'y marque un film vu et aucun film ne s'y ouvre** (décision 9). Il entre en
  glissant au tempo, jamais au calme, et son bouton reste inerte un instant hors du calme
  (`GARDE_DU_CHOIX`). Le vert de la maquette n'est pas porté : le bleu de l'émail, en attendant le
  choix du propriétaire (décision 12). Le HUD réécrit pour la halte et le levier qui bascule ne sont
  pas faits. `mondes/1900/monde1900.test.ts` et `mondes/1900/pages/halte.test.tsx` le tiennent.
  **La plaque d'une gare dit son horaire** (brief 11 ; `voyage/horaire.ts`, `horaireDePlaque`, une
  règle pure tirée de `CaseVue.horaire`) : tenu, « à l'heure » et `tenu` pour le filet doré ; accepté,
  « avant » et le jour de la semaine de l'échéance servie (`semaineDeLEcheance` : un mercredi se dit
  « avant mercredi », jamais « dimanche » écrit d'avance) ; **manqué, rien** (décision 7), comme sans
  horaire ; et rien sur une plaque fermée. 1900 la lit pour sa plaque émaillée
  (`mondes/1900/gares.ts`, `horaireSurLaPlaque` : une plaque à développer ne dit rien, ses deux gardes
  comprises), qui gagne une ligne en grandissant vers le haut, son bas restant au-dessus du corail de
  l'année en cours ; rien n'y bouge, et le trait n'a pas de test. La liste des années pour lecteur
  d'écran (`pages/Carte.tsx`, `horaireLu`) dit les mêmes mots après l'état de l'année (« 1902, passée,
  à l'heure »), dans un monde qui compose `horaireDeLAnnee` seulement : en 1890 elle se tait, quoi que
  serve l'API ; elle se tait aussi, comme la plaque à développer, pour une année fermée (`estFermee`)
  et tant que l'avatar n'y est pas arrivé (le trajet). Ni la bande de la vue d'ensemble ni l'aperçu d'une année ne le disent. Aucune requête
  de plus : tout vient de `GET /me/voyage`. `voyage/horaire.test.ts`, `mondes/1900/habillage.test.ts`
  et `pages/Carte.haltes.test.tsx` le tiennent.
  `carte/moteur.test.ts` et `pages/Carte.haltes.test.tsx` le tiennent.
- **L'horaire d'une gare, sur la fiche de son année** (brief 10 des écrans des lots ;
  `voyage/annee/Horaire.tsx`, la clé sans défaut `horaireDeLAnnee`). La page ne monte le bloc que si le
  monde de l'année compose la clé, à la place `horaire` de l'ordre des sections (sous le programme par
  défaut). **Il ne lit aucune route** : `horaire` et `horaire_proposable` viennent de la fiche prête
  que la page tient ; ni l'un ni l'autre, le bloc n'existe pas. Il passe au dessin l'horaire tel que
  servi (son état, son échéance), l'échéance que la gare propose, l'instant de l'arrivée d'un horaire
  tenu (`ticket.emis_le` : le ticket de l'année suivante émis, la seule définition de « bouclée » côté
  serveur) et les deux gestes quand ils s'offrent : « Tenir l'horaire » quand la fiche propose, « Sans
  horaire » tant que l'horaire est `accepte`, jamais `tenu` ni `manque` (le serveur répondrait `409`).
  **Le serveur décide de l'échéance** : le `POST` part sans corps, rien ne se calcule sur l'appareil.
  Les deux écritures passent sous un verrou par référence. Une écriture ne change que l'horaire de
  cette gare, sur sa fiche et sur sa case de la carte : accepté, le cache l'apprend de la réponse
  (l'horaire rendu, plus de proposition ; la case de l'année sur la carte), puis la fiche et la carte
  se relisent **en `exact`** ; retiré, la fiche se relit d'abord (la gare repropose une échéance que
  seul le serveur connaît), les gestes attendent, et elle ne s'écrit à la main, sans horaire ni
  proposition, que si cette relecture échoue : elle se re-périme alors aussitôt, sans se relire (écrite
  à la main elle se dirait fraîche et sa panne serait effacée), et le bloc reste à l'écran le temps de
  dire le retrait, sans rien offrir. **Jamais le préfixe `voyage`** : la malle (que la fête
  d'un retour attend), les tickets, l'état du voyageur et les autres fiches montées seraient relus
  pour rien. Un `409` (la gare a changé ailleurs) ou le `404` d'un horaire déjà retiré : la fiche et
  la carte se relisent, rien ne se dit ; si la fiche ne peut pas se relire, le refus du serveur se dit
  (l'écran resterait sur l'état refusé, et le geste rejouerait le même refus muet). Tout autre refus et une panne du réseau se disent avec le
  message reçu, l'horaire reste ce qu'il était et le geste se refait. Ce que le cache apprend est
  dans `useMutation` : la page quittée pendant l'envoi, la carte le sait quand même. La tête et le
  programme reçoivent de quoi dire un horaire tenu (`aLHeure`, `horaireTenu` : son échéance, son
  arrivée), deux propriétés facultatives que les défauts ignorent et que la page ne passe que dans un
  monde qui compose la clé. `pages/VoyageAnnee.horaire.test.tsx` tient le bloc sur un 1890 auquel on
  prête un dessin, et le vrai 1890, qui ne dit rien de l'horaire et ne lit que la session, la carte et
  sa fiche (la liste entière de ses requêtes). **1900 la remplit** (maquette, écrans 2 et 14 ;
  `mondes/1900/pages/HoraireDeLaGare.tsx`, sa feuille `Horaire.module.css`, ses mots `horaire.ts`), et
  `Gare` range le bloc sous l'indicateur, avant le guide : une affichette de papier, « Proposé en gare
  de 1904 » ou « Accepté en gare de 1904 », le titre « Arriver avant dimanche 11 octobre 2026 », et deux
  talons, « Tenir l'horaire » et « Sans horaire ». Celui qui dit l'état présent est enfoncé
  (`aria-pressed`) et ne porte aucun geste ; l'autre écrit, et se dit en attente tant que l'écriture
  est partie. Dessous, une région d'état dit ce que le geste vient de faire (« Horaire accepté :
  arriver avant… », « Sans horaire : la gare de 1904 se boucle quand tu veux, rien ne se perd. » ; la
  maquette y ajoute « la plaque le dit sur la carte » : la phrase n'a pas été rallongée quand la carte
  s'est mise à le dire, au brief 11), puis l'alerte
  d'un refus. **Tenu, le bloc ne dessine rien** : la plaque de la tête porte un filet doré et « à
  l'heure » (`Tete`, `aLHeure`), et l'indicateur dit en tête de ses lignes « Horaire tenu », l'échéance
  et le jour de l'arrivée (`Indicateur`, `horaireTenu` : « Avant dimanche 11 octobre 2026 : arrivé le
  samedi 10 octobre 2026. »). **Manqué, une ligne**, sans talon : « Il fallait arriver avant… Rien ne se
  perd. » (décision 7). La région et son titre portent un seul nom, « L'horaire » (« facultatif » se voit
  dans le titre et se lit comme la description de la région) ; quand les talons disparaissent sous les
  yeux (un refus qui mène à « manqué », un retrait dont la fiche ne se relit pas), la région reprend le
  focus tombé au document, et sa région d'état, la même d'un état à l'autre, dit « Horaire manqué. Il
  fallait arriver avant… ». **Le jour se lit dans la date servie** (`voyage/horaire.ts`, que la carte
  reprend) : `jourDeLEcheance` dit une échéance sans heure sans passer par le fuseau de l'appareil
  (la maquette écrit « dimanche » en dur ; la base ne tient pas « un dimanche »), `jourDArrivee` dit
  l'instant du ticket émis à Paris, comme le serveur le compte. Rien n'y bouge ;
  `mondes/1900/pages/horaire.test.tsx` tient les mots et ce qui s'offre, `voyage/horaire.test.ts` les
  jours.
- **Le contrôleur passe sur la carte** (`voyage/controleur/Controleur.tsx`, la clé sans défaut
  `controleurDeLaCarte`, que `pages/Carte.tsx` lit au monde de mon année en cours (l'autre clé de la carte, `halteDeLaCarte`, se lit au monde de la halte) ; 1900 la
  remplit). Sans elle, la carte ne lit pas l'état du voyageur pour lui et aucune portière ne
  s'ouvre. Avec elle, **il entre seul quand `controleur.attend` est vrai, une fois par visite de la
  carte** (une référence de la page : rien n'est retenu sur l'appareil, la carte remontée le revoit
  entrer tant qu'il attend), **jamais par-dessus autre chose** : la carte dérive un seul fait,
  `pleinEcranOccupe`, vrai pendant une avancée **ou avant celle qui vient** (l'avatar pas encore rendu
  à mon année en cours), la fête du rattrapage lancée ou sur le point de l'être, un passage au geste
  (fini ou en échec, il rend la main) **ou lancé sans le bouton** (la halte au bout de la foire, le
  repos d'un défilement arrêté dans l'entrée : le moteur le dit par `Rappels.passage`, vrai puis faux,
  faux aussi quand le moteur est détruit pendant un passage, jamais au calme où rien n'est en cours), la vue d'ensemble, un ticket en cours d'encaissement
  (« L'utiliser » à la fête comme « Utiliser le ticket »), puis la carte en relecture, qui peut poser
  l'avancée, et tant que quelque chose est déjà ouvert (l'affiche d'une date, un aperçu, une bobine ou
  un objet en vol, un message d'état comme « Objet trouvé », la phrase de la roulotte) ; il entre quand
  ce fait retombe. **Tout dialogue de la carte qui entre de lui-même lit ce fait, et tout dialogue
  neuf s'ajoute à l'ordre dont il se tire** (`ORDRE_DES_DIALOGUES` ; la halte y est, après la portière ;
  l'horaire n'est pas un dialogue : il se dit sur la plaque et sur la fiche). Son dialogue rend la carte
  inerte dessous, et l'inertie comme le rendu se lisent sur un seul booléen, `portiereOuverte` (la
  portière est le dialogue courant : le billet retenu **et** le dessin du monde, et rien de plus fort
  à l'écran ; une avancée ou une fête que la carte relue poserait la couvre le temps de se jouer) :
  portière ouverte, mon année en cours passée à un monde sans la clé ne laisse pas
  une carte inerte sans dialogue. Le bloc lecteur montre **le billet demandé tel
  que mon journal le dit** (le contrat n'en donne que deux identifiants) : il lit la première page du
  journal, sous la clé de l'accueil, y cherche l'entrée par son identifiant, jamais la page suivante,
  et prend le numéro du billet à la boîte de sa décennie si elle est en cache ; sinon, ou en panne, la
  portière reste sans carton, sans un mot. **Un journal déjà en cache n'est pas relu**, même vieilli
  (`staleTime: Infinity` sur cet observateur seulement : le relire relirait toutes ses pages pour un
  seul carton ; périmé par une écriture, il se relit quand même, et absent du cache il se lit une
  fois, sa première page). Le numéro suit la règle du casier : un film d'avant le départ du Voyage
  n'en a pas et ne décale rien. **Deux boutons écrivent, sous un verrou** ; refermer, par
  son bouton ou par Échap, n'écrit rien et n'est pas un refus. Acceptée, la réponse apprend au cache de
  l'état du voyageur qu'il n'attend plus, et le poinçon rendu, champ par champ, une lecture en vol
  annulée d'abord, sans rien périmer d'autre (la route n'écrit que la réponse de la semaine, que seul
  cet état sert). **Le serveur décide du billet poinçonné** : si ce n'est pas celui que la portière
  montrait (supprimé ou redaté avant la réponse, il en a pris un autre), le carton montré ne se perce
  pas à sa place ; la portière montre le bon s'il est sur les pages du journal en cache, aucun carton
  sinon. La portière refermée, **le focus revient à l'élément qui l'avait, et sinon au titre de la
  carte** (il est entré seul : le plus souvent rien ne l'avait, et il tomberait au document).
  `409` (il n'attendait plus) : la portière se referme et l'état se relit, sans rien
  dire. Toute autre panne se dit dans le dialogue, avec le message du serveur, et la réponse se
  refait. **`controleur.attend` change avec l'horloge du serveur, sans écriture** : une carte restée
  ouverte ne le voit entrer qu'à sa prochaine lecture de l'état (trente secondes de fraîcheur, aucune
  relecture au retour de la fenêtre, aucun sondage) ; `pages/Carte.controleur.test.tsx` tient le tout
  sur un 1890 auquel on prête un dessin. **En 1900** (`mondes/1900/pages/ControleurDeLaCarte.tsx`, sa
  feuille `Controleur.module.css`, ses mots et ses règles dans `controleur.ts` ; maquette, `#controle`) :
  un dialogue par-dessus la carte assombrie, sans photographie ; le contrôleur dessiné
  (`DessinDuControleur.tsx`, les tracés de la maquette) entre par la droite, sa bulle dit « Contrôle des
  billets, s’il vous plaît. », le billet demandé est le carton Edmondson (sa ligne ne dit « gare de »
  que d'une année de 1900 à 1909, son numéro seulement si la boîte l'a donné), puis « Présenter le
  billet » et « Pas ce soir ». Présenté : « En règle. Bon voyage ! », le poinçon doré se perce sur le
  carton (`Carton` le porte, le même qu'au casier, ici `frais` : il luit et se perce) ; refusé : « Bonne
  soirée. » ; puis « Refermer la portière », qui reprend le focus et, hors du calme, **reste inerte un
  instant** (`GARDE_DU_CHOIX`, la garde du choix de l'année bouclée, `aria-disabled`) : il prend la
  place exacte des deux réponses, et un second toucher ne referme pas avant qu'on ait lu ; Échap
  referme toujours. La panne s'y dit en alerte. Il pose
  lui-même les jetons du monde, que la carte ne pose pas ; ses durées sont au tempo et rien n'y bouge
  au calme. La note « sans titre de transport » de la maquette n'est pas portée
  (`mondes/1900/pages/controleur.test.tsx`).
- **Le badge d'une place de la malle** (`mondes/1900/pages/BadgeDeMalle.tsx`, ses règles et sa table dans
  `mondes/1900/pages/malle.ts` ; maquette, écran 18) : les quinze étiquettes dessinées en SVG, **par `cle`
  du contrat**, dans leurs trois états. Collée (`collee_le` non nul) : la forme en papier, ses encres, son
  dessin, son nom court et la devise servie. En trace de colle : la forme pâle et « 3 sur 4 », « à gagner »
  pour un seuil de un ; `fait` au seuil sans `collee_le` reste une trace. Cachée non gagnée (`cle` nul, et
  non `cachee` vrai) : un « ? », sans forme, et un nom lu qui ne dit rien d'elle. Une clé inconnue garde sa
  place : une forme neutre, le nom servi. `muet`, il se tait : la malle le pose dans un bouton ou à côté
  d'un texte qui dit déjà son nom.
- **Ces écrans sont de 1900 seulement** (décision du propriétaire, 8 octobre 2026) : des clés de
  gabarit sans défaut (`ClesSansDefaut`, `mondes/types.ts`), lues par `gabaritSeul`
  (`voyage/gabarit.ts`), si bien que 1890 et le monde « à venir » ne montent aucun de leurs blocs et
  ne lisent aucune de ces routes. La première est `malleDeLaSacoche`, que 1900 remplit (plus haut, « La
  sacoche du voyageur ») : son bloc lecteur
  (`voyage/sacoche/Malle.tsx`, entre le passeport et le portefeuille) lit la malle de la décennie de
  mon année en cours et l'état du voyageur, ne rend rien pour une décennie sans malle, tombe seul en
  panne et ouvre la malle dans l'adresse (`?malle=ouverte` : le retour la referme ; ouverte, la malle
  en cache reste à l'écran si sa relecture tombe en panne, et la panne se dit une fois refermée). **La rubrique
  `etiquette` se marque vue une fois par visite**, la malle lue (`voyage/sacoche/visite.ts`,
  `useVisiteDeRubrique`, qui servira aux objets trouvés et au courrier) : « nouvelle » se calcule sur
  le `vue_le` lu à l'arrivée, figé pour la visite, et le cache n'apprend que la date du serveur, une
  relecture de l'état encore en vol annulée d'abord
  (`pages/VoyageSacoche.malle.test.tsx`, sur un 1890 auquel on prête un dessin). La seconde est
  `objetsDeLaSacoche`, que 1900 remplit aussi (plus haut, « La sacoche du voyageur ») : son bloc lecteur (`voyage/sacoche/Objets.tsx`,
  entre le portefeuille et les coulisses) ne lit que l'état du voyageur, passe au dessin ce que le
  serveur sert, tel quel (le catalogue des objets est au monde, qui range, ignore une clé inconnue et
  compte), ne paraît pas tant que l'état n'est pas lu, tombe seul en panne sans éteindre la malle, et
  **marque la rubrique `objet` vue une fois par visite** par le même crochet : jamais en panne, jamais
  pour une consigne vide. **Le crochet ne marque aucune rubrique pendant une relecture de l'état du
  voyageur, ni après une relecture en panne** (la malle comprise : sa marque, partie sur l'état en
  cache, effacerait la panne que les objets trouvés doivent dire ; `pages/VoyageSacoche.objets.test.tsx`). `mondes/1900/pages/sacoche.test.tsx` tient ce que la sacoche de 1900
  ne montre ni ne lit encore, un interdit par rubrique (`PAS_ENCORE`), que le lot de chacune lèvera.

## Le thème

`src/ui/theme.css` porte tout l'habillage de l'app hors du Voyage, en variables CSS : couleurs,
polices, tailles de texte, espacements, rayons, ombres, gabarits. Une façade de cinéma : une palette
de bleus, de jour et de nuit (le réglage du téléphone ; `data-theme="clair"` ou `"sombre"` sur
`<html>` force l'un ou l'autre), et trois faces, League Gothic pour le fronton, Bodoni Moda pour les
titres et Jost pour le texte. Les `*.module.css` des composants ne portent aucune valeur en dur : redessiner l'app,
c'est changer ces variables, puis au besoin les styles des composants, sans toucher au code.
`src/ui/theme.test.ts` y veille : hors du Voyage (dossiers `carte/`, `mondes/`, `voyage/`, fichiers
`Voyage*.module.css`), une feuille qui porte une couleur ou un nombre en dur (hormis `0`, `100%`,
`100dvh`, `flex: 1`) ou lit une variable absente de `theme.css` fait échouer les tests ; le même
fichier garde la zone sûre de la barre d'onglets.
Seuls `theme-color` (`index.html`) et les couleurs du manifeste (`vite.config.ts`) restent à
accorder à la main : ils prennent le haut du ciel, jour et nuit.

Le ciel (`--fond-ciel`) est le fond de tout le bâtiment, zones sûres comprises : `theme.css` le peint
sur le corps, que le document passe à sa toile, et les pages sont transparentes. La barre d'onglets
prend la couleur du bas du ciel (`--barre-onglets-fond`), pour que la zone sûre du bas prolonge la
page. Le Voyage n'en reçoit rien : la coque pose `data-lieu="ecran"` sur `<html>` tant qu'il est à
l'écran, et le corps garde alors son fond plat. Dans l'app installée (`display-mode: standalone`), la
page fait `100lvh` de haut : sur iOS 26, la barre d'état translucide raccourcit la fenêtre de sa
hauteur (WebKit 301108), et sans cela la barre d'onglets, fixée au bas, flotterait d'autant au-dessus
du bord ; dans un onglet du navigateur, `dvh` reste. Le texte, lui, garde sa taille
quand le téléphone tourne (`text-size-adjust: 100%` sur `html`, onglet compris) : sans cela iOS le grossit
en paysage et ne le ramène pas toujours au retour.

Hors du Voyage, les pages prennent la largeur d'un écran de bureau : au-delà de 64rem, un seul bloc
`@media` de `theme.css` redéfinit des jetons de mise en page (`--largeur-page`, les `--grille-*-colonnes`,
`--accueil-colonnes`, `--profil-colonnes`…), et aucune feuille de composant ne porte de point de
rupture. Une page qui devient une grille garde, sur téléphone, une unique piste `minmax(0, 1fr)`, et ses
éléments portent `min-width: 0` ; `theme.test.ts` y veille. Les pages dessinées comme un objet (le
billet du critique, la coupure de presse, le ticket de caisse, le panneau de connexion) gardent
`--largeur-contenu` ou leur largeur propre : elles ne s'étirent pas. Le Voyage n'en reçoit rien.

Le fronton de l'accueil change d'enseigne avec la décennie du film qu'il annonce (`data-decennie`
sur son lien, `decennieDeAnnee` dans `src/accueil/fronton.ts`) : le cadre et ses ampoules restent, le
panneau, l'encre et la police du titre sont ceux de la décennie, un bloc `[data-decennie='…']` par
décennie de 1890 à 2020 dans `theme.css` qui re-pose les variables `--fronton-*` et `--enseigne-*`.
Sans année, avant 1890 ou journal vide, c'est l'enseigne de 1940 (celle de la maison) ; après 2029,
celle de 2020. Le jour, seules les lueurs s'éteignent (`--enseigne-nuit-*`, posées dans les deux blocs
sombres). Une décennie de plus : son bloc, sa police dans `polices.ts`, sa ligne dans `DECENNIES`
(`src/accueil/enseignes.test.ts` les rapproche).

Le journal de l'accueil est une pellicule 35 mm par mois (`src/accueil/Pellicule.tsx`) : une bande qui défile de côté, sans barre, jusqu'au bord droit de l'écran (`--debord-page`), terminée par l'amorce et le bout déchiré. Un film sans affiche y prend l'enseigne de sa décennie (`SigneDeFilm.tsx`), dessinée à la taille du fronton puis réduite (`--signe-echelle`), avec le même découpage du titre que lui (`titre.ts`). Un mois de plus de trois films se déroule en planche-contact (le bouton « Dérouler », « Rembobiner » pour le remettre en bande) : le même film posé à plat, trois colonnes (`--grille-planche-colonnes`) dans les marges de la page, sur sa base noire (`--pellicule-base`), sans perforations, sans bout déchiré, sans date ni amorce ; le rang et le réalisateur restent. Les mois déroulés sont gardés pour la session (`useMoisDeroules`, jumeau de `useFiltresMemorises`) : `coque/defilement.ts` rend sa position à la page au retour d'une fiche, et un mois qui se serait enroulé de lui-même la laisserait plus courte, la sentinelle irait chercher des pages que personne n'a demandées. Dérouler ne lit ni ne demande rien. En tête du journal, « Mes films » mène à la liste complète (`/profil/mes-films`).

Le profil est le portefeuille du membre : une carte d'adhérent, puis chaque graphique dessiné comme un objet (la jauge et les diodes sur laiton, des billets pour les réactions, une pellicule pour les décennies, des ampoules pour les mois), et le ticket de caisse. Ses valeurs (`--carte-*`, `--panneau-*`, `--ticket-*`, `--perforation-*`, `--ampoule-*`, `--papier-*`, et le rythme `--rythme-*`) sont dans `theme.css` : celles du jour dans `:root`, celles de la nuit dans les deux blocs sombres, les lueurs éteintes le jour. La couleur du membre (`identity_color`) est posée par la page dans `--identite` et ne touche que ses marques à lui. Le ciel de l'accueil s'appelle désormais `--fond-ciel` : c'est le ciel du bâtiment, partagé par l'accueil, le profil et la caisse. Le réglage jour / nuit / auto de la caisse (`src/ui/theme.ts`) se garde dans ce navigateur et pose ou ôte `data-theme` sur `<html>` dès le démarrage (`main.tsx`).

Les Suivis sont le bureau de la programmation, dont le mur porte les suivis en affichettes de papier crème punaisées, le papier des billets du profil (`src/suivis/` et `pages/Suivis.tsx`). En haut, « + Suivre » ouvre sous l'en-tête une recherche unique : un champ cherche les réalisateurs et les sagas ensemble (les deux requêtes partent, `cles.realisateurs` et `cles.sagas` plus `'recherche'`), en deux groupes dont celui qui ne trouve personne est absent, et suivre n'invalide que la liste du suivi ajouté. Vient ensuite « Ensuite » (`RangeeEnsuite`) : le prochain film à voir de chaque réalisateur et de chaque saga en cours, mêlés, du suivi le plus récemment actif au plus ancien (`filmsEnsuite`), chacun menant où mène sa ligne de la page de son réalisateur ou de sa saga (`suivis/destination.ts`, partagé avec elles). Dessous, deux intercalaires : les rétrospectives, une affichette par réalisateur sur un mur de deux colonnes (`Affichette` : le portrait imprimé à l'encre bleue, l'affiche du prochain film collée à son coin, le nom en deux corps, « 9 séances sur 22 » et un trou poinçonné par film), et les cycles, une planche pleine largeur par saga (`PlancheCycle` : ses films en affiches, six par rangée, cochés au crayon, le prochain cerclé de rouge, un introuvable marqué « perdu »). Seule la liste ouverte est dessinée, mais les deux filmographies se chargent toujours l'une après l'autre : le compte de l'en-tête et « Ensuite » ont besoin des deux. Un suivi bouclé quitte le mur pour des archives, repliées derrière « Archives · n », où son affichette porte le bandeau « Complet » et sa date de clôture. L'intercalaire choisi et les archives dépliées se retiennent le temps de la session (`useMemoireSuivis`, une mémoire par client de requêtes, comme `useMoisDeroules`) : `coque/defilement.ts` rend sa position à la page quand on revient d'une fiche, et une page qui reviendrait plus courte la fausserait ; la recherche, elle, ne se retient pas. Rien n'y bouge. Le papier est le même de jour comme de nuit : seules l'ombre (`--ticket-ombre`) et la lampe qui l'éclaire (`--affichette-lampe`) changent, posées dans `:root` et dans les deux blocs sombres.

La page d'un réalisateur (`pages/PageRealisateur.tsx`, logique pure dans `suivis/realisateur.ts`) range sa filmographie sous deux titres, « Longs métrages » puis « Courts métrages » (`court`, un film de moins de quarante minutes chez TMDB) ; une section sans film à montrer, par exemple tous masqués comme introuvables, s'efface avec son titre. Sous le nom, « Compter : séparément / ensemble / longs seulement » règle la ligne de compte (« 8 vus sur 12 · courts 1 sur 4 », « 9 vus sur 16 », « 8 vus sur 12 ») et le sceau « Rétrospective complète », qui ne regarde que les longs en « longs seulement ». Le choix est le même pour tous les réalisateurs et se retient sur l'appareil (`localStorage`, `journal.realisateur-compte`) : il n'est jamais envoyé au back. Un film du Plex porte « · Sur le Plex » dans sa ligne, vu ou non, et un bouton « Plex » ouvre sa fiche Plex dans un autre onglet quand le back donne `plex_url` ; le bouton est le frère du lien de la ligne, jamais dedans.

Au ciné s'ouvre sur « Prochaines séances » (`cinema/TableauDuHall.tsx`), le tableau du hall : le panneau, le rail et les ampoules du fronton de l'accueil (`--fronton-*`, ses ampoules reprises de `accueil/Fronton.module.css`), une ligne de deux pas de rail par séance à venir aujourd'hui (heure, titre, cinéma, distance quand elle est connue, version, le sceau d'un réalisateur ou d'une saga suivi), cinq d'abord, « Tout voir (N) » dépliant le reste en place. Une seule requête, `GET /me/cinema/seances` (`api/seances.ts`, `cles.prochainesSeances`) ; la fiche d'un film en ajoute une seule, `GET /reference/films/{tmdbId}/seances`, pour « Séances aujourd'hui » (`cinema/SeancesDuFilm.tsx`, sous l'en-tête, avant le synopsis : un cadre par cinéma, ses heures en pastilles sans geste ni réservation). L'ordre (`cinema/seances.ts`, fonctions pures) : par début, puis à début égal le cinéma le plus proche, ceux sans coordonnées (ou tous, sans position) après, par nom. **Le temps qui passe ne rappelle jamais l'API** : `useMaintenant` relit l'horloge toutes les trente secondes et la page refiltre ; une séance commencée s'en va, « dans 5 min » (« dans 1 h 05 » à partir d'une heure) suit, et quand il n'en reste plus le tableau dit « Plus de séance ce soir. » sans rien promettre de demain. Chaque tuile de « Sorti cette semaine » porte, en bas à gauche, l'heure de sa prochaine séance ; toucher un film (ligne ou tuile avec `tmdb_id`) ouvre sa fiche sous `au-cine/films/:tmdbId` (l'état de navigation de `FicheFilm`, `etatFiche` dans `AuCine.tsx`), l'onglet restant marqué. **La position du membre** ne sert qu'à classer les salles par distance (haversine, `cinema/distance.ts`, sur le téléphone) et ne se demande **qu'au toucher de « Autoriser »** ; déjà accordée, elle se lit sans geste, refusée elle n'est jamais offerte. Elle vit en mémoire (`FournisseurPosition`, dans `App.tsx`, lue par `usePosition`) : jamais envoyée dans une requête, jamais stockée ; la fiche d'un film la reprend sans la demander. Les mesures du tableau sont les jetons `--tableau-*` et `--sceau-mini-*` de `theme.css`.

Le guichet, le billet du critique et le papier rendu sont le chemin d'un film vers le journal, sur le papier des billets du profil (`--ticket-*`, `--papier-*`, le même de jour comme de nuit : seul le ciel derrière change). **Le guichet** (`pages/Recherche.tsx`) est la recherche : la rubrique « Le guichet », la question « Quel film as-tu vu ? », un champ de papier crème souligné de rouge, les dernières recherches en mots au crayon (`--police-crayon`, Caveat : l'écriture du membre, jamais le décor), puis chaque liste (résultats, « Tes Ensuite », « Pas encore vus, cette année du Voyage ») en affiches, trois par rangée (`--grille-guichet-colonnes`) ; un film déjà au journal porte une étiquette de papier collée de travers sur son affiche, ses étoiles s'il est noté (`ui/Etoiles.tsx` : une note sur 10 en cinq étoiles, deux points par étoile, demies comprises) ou le mot « vu » au crayon. **Le billet du critique** (`pages/Formulaire.tsx`, création et correction) est un billet de presse, coins mordus (`--billet-onglet-masque`) et bande rouge au bord haut : « Presse » et « Projection » en tête, le film, la date (« Séance du », un champ de date dont `appearance: none` et `min-width: 0` garantissent qu'il ne déborde plus l'écran d'un iPhone), « Mon avis » en dix trous poinçonnés sur une rangée (`formulaire/RangeeDeNote.tsx` : toujours un radiogroupe de dix radios, qu'un doigt glissant le long de la rangée parcourt, `touch-action: pan-y` laissant le défilement vertical ; le verdict et la note s'écrivent au crayon à côté, `formulaire/verdict.ts`), les réactions en tampons encreurs (`formulaire/Tampons.tsx` : les trois les plus posées du journal, que `compterReactions` de `profil/bilan.ts` classe, ou les trois premières du catalogue à défaut ; une réaction cochée ne se cache jamais, « + 10 autres » déplie le reste), et sous le billet la page de notes d'un carnet à spirale, qui grandit avec son texte. Le bouton (« Rendre mon papier », « Corriger mon papier ») reste collé au bas de la zone de contenu, au-dessus de la barre ; la suppression reste « Déchirer ce billet », avec sa confirmation. Ce que le billet dit « en plus » (le numéro du billet, le rappel « Déjà vu le … », les réactions favorites) ne vient **que du cache de requêtes** (`formulaire/journalEnCache.ts`) : aucune requête de plus ne part, et rien ne s'affiche quand le cache n'a pas la donnée. Un cache déjà périmé par l'écriture d'un visionnage (`isInvalidated`) ne se lit pas non plus, sauf pour le classement des réactions : un numéro qui se répète ou un compte du mois faux vaudraient moins qu'une ligne absente. **Le papier rendu** (`pages/PapierRendu.tsx`, `journal/:id/papier`) suit une création, jamais une correction ni une suppression, qui reviennent où elles revenaient (`etatCorrection.retour`, sinon l'accueil) : la critique imprimée comme dans un journal d'aujourd'hui (`--journal-*`), découpée aux ciseaux par un `clip-path` tiré de l'identifiant de l'entrée (`formulaire/decoupe.ts` ; la page le pose en ligne dans `--decoupe`, comme `--part` ailleurs), l'ombre portée par le cadre, que le `clip-path` couperait sinon. Une remarque de plus de cent dix caractères se met en colonne avec sa lettrine, les étoiles et le verdict en chapeau ; une remarque courte, ou aucune, laisse la une à la note (et à la remarque en citation). Sous elle, « En bref », une seconde coupure, seulement des lignes que le cache prouve (`formulaire/enBref.ts`, `enBrefEnCache.ts`) : la rétrospective ou le cycle suivis dont la filmographie en cache contient le film (« Bouclée ! » quand la séance les referme), « Deuxième séance au journal », le rang du film dans son mois **seulement** quand le cache contient tout le mois (le journal entier, ou une entrée plus ancienne que lui). Elles se calculent dans `onSuccess` de la création, avant les invalidations qui vident ce cache, et passent par l'état de navigation avec l'entrée et les réactions résolues : la page n'a rien à demander, et sans cet état (rechargement) elle renvoie à l'accueil. `fetch` n'y part jamais, jamais une fiche d'année du Voyage non plus (`Recherche.tsx` garde sa lecture de la fiche, et son test).

Une page qui attend ses données montre ses propres objets laissés en blanc, dans sa propre mise en page, et non une ligne « Chargement… » : `ui/Attente.tsx` pose la zone (un seul `role="status"`, dont le libellé est le seul texte que lisent les lecteurs d'écran ; `muet` pour une petite attente dans une carte dont le texte dit déjà ce qui manque), `Barre` y dessine une ligne de texte en blanc (de l'encre de ce qui la porte), une `Affiche` sans image et sans titre y tient la place d'un film, et les classes de la page (la même `ul`, les mêmes `li`) donnent la forme, pour que rien ne bouge à l'arrivée des données. Toutes les formes respirent ensemble (`--attente-*`), et c'est la seule animation qui boucle hors du Voyage (`theme.test.ts` y veille) ; sous `prefers-reduced-motion` elles restent immobiles. Un squelette ne lance ni ne change aucune requête, et les lignes « Chargement… » de fin de liste (la page suivante d'une liste infinie) restent du texte.

Le Voyage a son habillage à lui, par décennie : `src/ui/voyage.css` (les quatre couleurs de
`../biblio-android/docs/design.md`, la classe `.celebration`, que portent le carton d'un nouveau monde
et les titres des célébrations). Le thème général ne les lit pas.

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
