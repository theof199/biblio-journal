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
| Suivis | `/suivis` | `chair-director` | `pages/Suivis.tsx` : réalisateurs et sagas suivis ; sous-pages `suivis/realisateurs/:tmdbId`, `suivis/sagas/:tmdbId`, `suivis/films/:tmdbId` |
| Au ciné | `/au-cine` | `ticket` | `pages/AuCine.tsx` : mes séances et les sorties en salle |
| Profil | `/profil` | `armchair` | `pages/Profil.tsx` : la carte d’adhérent (le pseudo, la couleur du membre, les films et les heures de `/stats`, « Mes films »), puis les graphiques du journal entier dessinés en objets de cinéma (`profil/` : notes, réactions, décennies, mois) et, en bas, le ticket de caisse qui mène à la sous-page `/profil/reglages` (`pages/Caisse.tsx` : thème jour / nuit, « Mes films », l’import Letterboxd (`pages/ImportLetterboxd.tsx`, sous `/profil/import-letterboxd`), le rattrapage, les doublons, « Se déconnecter », la mention TMDB, la version) |

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
d'une bobine retrouvée, et la musique de chaque monde à l'écran, au volume de sa présence
(`Monde.musique` : l'orgue de barbarie de 1890, `mondes/1890/orgue.ts` ; rien pour le monde « à
venir »). Tout est synthétisé par WebAudio, sans fichier. Coupé par défaut : **seul le bouton
« Son »** (la pastille du haut, en bas à droite) crée le contexte audio, dans son geste, et le reprend
s'il naît suspendu (Safari d'iOS). Une fois né, il vit autant que la page (`ambianceDeLaPage`) : une
fiche ouverte puis refermée retrouve le son. Il appartient au membre qui l'a allumé : la déconnexion
ne recharge pas la page, et le membre suivant dans le même onglet le trouve coupé. Il se tait quand la page passe en arrière-plan ou que la
carte est quittée. Le choix se garde sur l'appareil, par membre (`journal.carte.son.<membre>`,
`carte/memoire.ts`) ; il ne rallume rien au rechargement, il fait seulement proposer au bouton de
« reprendre » le son.

**Les bobines perdues** (plan 2d). Trois films réellement perdus cachés dans le décor de 1890
(`Monde.bobines`, `mondes/1890/bobines.ts`) : derrière le pied d'un bec de gaz, dans la brume au bas
de la section (un éclat la trahit de temps en temps), au pied de la tour Eiffel au loin. Le monde les
pose par `VueMonde.bobine`, le moteur les dessine et inscrit leur zone, qui passe devant le reste du
décor. Un toucher la ramasse : elle vole vers le compteur du HUD (`DUREE_DE_L_ENVOL`, au tempo), qui
n'apparaît qu'à la première trouvaille ; un message dit le film, puis, à la troisième, que les trois
sont retrouvées. Au calme, elle arrive d'un coup. Les trouvailles se gardent sur l'appareil, par
membre (`journal.carte.bobines.<membre>`) : une bobine trouvée ne se dessine plus, sa zone ne se
touche plus. Un stockage illisible vaut « coupé » et « aucune ».

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
une année qui attend le Voyage suivi (« Théo est trop lent », le pseudo du voyageur suivi :
`tropLent`, `voyage/regles.ts`), ou l'ouverture qui s'écrit
(relue toutes les cinq secondes, trente-six fois au plus, puis « Réessayer »). Une affiche de salle
ouvre la fiche du film, `/voyage/:annee/films/:filmId` (`filmId` est la ligne de salle, pas un
identifiant TMDB) : la projection, le guichet, le programme et ses bobines (vu en partie, ses
gestes et « Le film » visent la première bobine qui reste à voir, `tmdbVise`). « Je l’ai vu » ouvre le
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
  précachées, `ui/polices.ts`).

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
marqué, et sa ligne l'annonce (« · Voyage 1896 ») : « Retour » y recule jusqu'au réalisateur. Composter depuis là donne l'historique
`[réalisateur, film, année]` : le retour depuis l'année ramène au film, désormais vu, puis au
réalisateur.

**« Moins d'animations »** y pose tout à l'état final : chaque toile peint une image immobile
(repeinte au rendu et quand une police finit de charger), la feuille du chroniqueur se pose d'un
coup sans minuterie, la corde ne se balance plus, les compteurs sont à leur valeur, aucun « +1 »
ne vole, aucun confetti ne tombe du poinçon, et le téléphone ne vibre pas. Le billet ne se
tamponne pas (l'année revient aussitôt), la manivelle ne tourne pas, le guichetier ne bouge pas, le
manège se fige à un angle où aucun cheval n'est derrière le pilier (`ANGLE_AU_CALME`,
`mondes/1890/monument.ts`), et aucun tampon du passeport ne frappe.

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
  venir » ne dessine qu'un fond, sans rien à toucher.
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
avant une fois, son casier ouvert, d'un liseré or.

**Le billet numéroté.** Composter sur le billet de séance (« Tamponner « Vu » » · « et ranger le
billet ») joue la séquence de la maquette (`FRAPPE` et `DUREE_DU_COMPOSTAGE`, `voyage/billet.ts`) :
le marteau descend (360 ms de base), l'encre se pose et le téléphone vibre, une pause (140), le
marteau remonte (320), le numéroteur fait dix tirages (45 chacun), une pause (200), le talon part
(700) ; puis l'année revient, comme au plan 2b, où le compteur roule et le « +1 » vole. **Le tempo**
(`TEMPO`, `voyage/tempo.ts`) multiplie chaque durée et chaque délai de cette séquence, en JS
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
fenêtre monte au-dessus du clavier. « Chercher hors du Voyage » mène à la recherche du journal.

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
carte (l'icône de la mallette, à côté du son) ; le retour ramène à la carte. Trois blocs, chacun
lisant ses données et tombant seul en panne (`voyage/sacoche/`, règles sans rendu dans
`voyage/sacoche.ts`) :

- **Le passeport** (`Passeport.tsx`) : une page par décennie, du départ à celle de mon année en
  cours, chacune habillée par son monde et menant à la page de la décennie. Bouclée, son tampon
  (posé, il ne frappe pas) ; sinon, son anneau (`voyage/passeport/Anneau.tsx`, le même que le
  livret), décennie en cours comprise.
- **Le portefeuille** (`Portefeuille.tsx`) : les tickets à utiliser, puis les utilisés, pâlis, avec
  le jour de Paris où ils l'ont été. « Utiliser » ne s'offre que sur le ticket que la carte offre
  (`ticketOffert`) ; encaissé, il ramène à la carte, qui joue l'avancée, sans laisser la sacoche
  derrière elle dans l'historique.
- **Les Coulisses** (`Coulisses.tsx`), repliées : les dépenses au chroniqueur, lues au dépli
  seulement, montrées une fois la liste connue et non vide (le mois courant est celui du serveur, en
  UTC, où l'API les range), et les crédits des images, lus au build dans les
  `CREDITS.md`.

Elle lit la carte (`GET /me/voyage`) et les tickets (`GET /me/voyage/tickets`) sous les clés de la
carte, et au dépli des Coulisses les dépenses (`GET /me/voyage/depenses`) : **jamais une fiche
d'année** (`pages/VoyageSacoche.test.tsx` compte les requêtes parties). Pas de générique au toucher
d'un tampon : il viendra avec les célébrations. Le Profil n'en porte rien.

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
accorder à la main.

Le fronton de l'accueil change d'enseigne avec la décennie du film qu'il annonce (`data-decennie`
sur son lien, `decennieDeAnnee` dans `src/accueil/fronton.ts`) : le cadre et ses ampoules restent, le
panneau, l'encre et la police du titre sont ceux de la décennie, un bloc `[data-decennie='…']` par
décennie de 1890 à 2020 dans `theme.css` qui re-pose les variables `--fronton-*` et `--enseigne-*`.
Sans année, avant 1890 ou journal vide, c'est l'enseigne de 1940 (celle de la maison) ; après 2029,
celle de 2020. Le jour, seules les lueurs s'éteignent (`--enseigne-nuit-*`, posées dans les deux blocs
sombres). Une décennie de plus : son bloc, sa police dans `polices.ts`, sa ligne dans `DECENNIES`
(`src/accueil/enseignes.test.ts` les rapproche).

Le journal de l'accueil est une pellicule 35 mm par mois (`src/accueil/Pellicule.tsx`) : une bande qui défile de côté, sans barre, jusqu'au bord droit de l'écran (`--debord-page`), terminée par l'amorce et le bout déchiré. Un film sans affiche y prend l'enseigne de sa décennie (`SigneDeFilm.tsx`), dessinée à la taille du fronton puis réduite (`--signe-echelle`), avec le même découpage du titre que lui (`titre.ts`).

Le profil est le portefeuille du membre : une carte d'adhérent, puis chaque graphique dessiné comme un objet (la jauge et les diodes sur laiton, des billets pour les réactions, une pellicule pour les décennies, des ampoules pour les mois), et le ticket de caisse. Ses valeurs (`--carte-*`, `--panneau-*`, `--ticket-*`, `--perforation-*`, `--ampoule-*`, `--papier-*`, et le rythme `--rythme-*`) sont dans `theme.css` : celles du jour dans `:root`, celles de la nuit dans les deux blocs sombres, les lueurs éteintes le jour. La couleur du membre (`identity_color`) est posée par la page dans `--identite` et ne touche que ses marques à lui. Le ciel de l'accueil s'appelle désormais `--fond-ciel` : c'est le ciel du bâtiment, partagé par l'accueil, le profil et la caisse. Le réglage jour / nuit / auto de la caisse (`src/ui/theme.ts`) se garde dans ce navigateur et pose ou ôte `data-theme` sur `<html>` dès le démarrage (`main.tsx`).

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
