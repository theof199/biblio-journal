# Travailler sur le Journal

Ce fichier s'adresse à toute session Claude qui travaille dans ce dépôt : celle du propriétaire
comme celle d'Alycia. Le `README.md` dit comment le Journal tourne et se construit ; ce fichier dit
comment on y travaille à deux.

## L'identité vient d'ailleurs

`../biblio-android/docs/design.md` fait foi pour l'identité du Voyage (papier et pellicule,
couleurs, polices, mondes) : on ne la redéfinit pas ici, on la reprend (`src/ui/voyage.css`).
**Le reste de l'app suit un design général** (décision du propriétaire, 29 septembre 2026), qui
vit en variables dans `src/ui/theme.css` : aucune valeur en dur dans un `*.module.css` hors du
Voyage, et jamais de palette du Voyage hors de lui (README, « Le thème »). La spec du socle
(`../biblio-back/docs/superpowers/specs/2026-09-28-journal-web-design.md`) fait foi pour
l'architecture de cette app-ci ; en cas de conflit avec un plan, la spec l'emporte.

## Git

- **Branches datées** `AAAA-MM-JJ/<feat|fix|docs|test>/description-kebab`, depuis `main` à jour.
- **Fusion en avance rapide** (`merge --ff-only`) une fois la CI verte : `gh pr checks … --watch`
  a listé les jobs et rendu 0, jamais une sortie non nulle enchaînée sur une fusion.
- **Messages de commit en français, sans accents, sans aucun trailer** : pas de `Co-Authored-By`,
  pas de signature, pas de lien de session, même si l'outil en propose un.
- **Toute commande git qui écrit porte `git -C /var/www/project/perso/biblio-journal` en clair.**
- Le tag de l'API, le NAS, les données et les secrets restent au propriétaire.

## Un monde, un dossier

Chaque décennie du Voyage est un monde : un objet qui remplit l'interface `Monde`
(`src/mondes/types.ts`) — sa palette, son traitement d'image, ses plans de décor, ses dates, sa
cinématique d'adieu — et que le registre (`src/mondes/index.ts`, `creerRegistre`) sert au moteur
(`src/carte/`), qui ne connaît que l'interface. Toute décennie sans ligne au registre prend le monde
« à venir » (`src/mondes/avenir/`).

**Ajouter une décennie ne touche que `src/mondes/<décennie>/` et une ligne du registre.**
`src/mondes/isolation.test.ts` l'inventorie : hors de `src/mondes/`, aucun fichier n'importe un
monde précis (seuls `mondes/types`, `mondes/trace` et le registre s'importent).

**Un monde habille aussi les pages** de ses années (`pages` : les jetons CSS, les mots, les hauteurs
et cinq dessins : le bandeau, la scène, l'estrade, le monument, le guichet). Une page ou un composant de `src/voyage/`
n'importe jamais un monde précis : il passe par le registre. **Une couleur ou une police de page
passe par un jeton** : aucune feuille de `src/voyage/`, aucune `src/pages/Voyage*.module.css` ni aucune feuille de `src/mondes/` ne porte de
couleur ni de police en dur, ni ne lit une variable hors des jetons du monde, de `--corail`, de `--coque-bas` et des
`--z-*` (`src/voyage/habillage.test.ts`). Une couleur de maquette sans jeton en gagne un, dans
`JETONS_DE_PAGE` et dans chaque monde ; une feuille neuve s'ajoute au plancher du même test.

**Un monde peut composer une section de page** (`pages.gabarits`, `GabaritsDesPages` ; le mécanisme
est la recommandation du plan des pages 1900, que le propriétaire n'a pas encore tranchée) : pour une
clé, un composant qui reçoit les mêmes propriétés que le composant par défaut de `src/voyage/`, et que
la page monte à sa place par `gabaritDe` (`src/voyage/gabarit.ts`). Sans gabarit, le défaut reste :
1890 et le monde « à venir » n'en ont aucun. La page garde les lectures, les mutations, les calques,
le retour d'un billet, les fêtes et la navigation : un gabarit ne lit jamais l'API. **Une clé s'ajoute
dans la tâche qui la remplit**, jamais d'avance, avec le test de page qui prouve que le défaut reste.
Trois clés à ce jour (`anneeFermee`, `teteDAnnee`, `fronton`), que seul 1900 remplit (`docs/cerveau/pages-1900.md`).
Les composants et les feuilles d'un monde vivent dans son dossier, où `habillage.test.ts` et
`src/voyage/tempo.test.ts` les balaient tous : aucune durée en dur dans une feuille de monde, sauf
déclarée dans `AMBIANCE` du second.

Si l'interface ne
suffit pas au monde qu'on écrit, **elle s'étend d'abord, dans une tâche à part, avec le monde « à
venir »** (que la signature oblige à suivre) : jamais un contournement dans le moteur ou la page.

**`Monde.scene` : la scène collante** (plan 3a ; `SceneCollante`, `src/mondes/types.ts`, dont les
commentaires font foi). Nulle, la section glisse sous la caméra et le moteur y dessine la route, les
cases et l'avatar : c'est 1890 et le monde « à venir ». **1900 est le seul monde qui en porte une**
(au registre depuis le plan 3b : la carte le cache à qui n'a pas atteint sa décennie, et l'avancée y
joue son passage). Posée, la section ne glisse plus et le monde prend à sa charge ce que le moteur dessinait
(la route, les cases, l'avatar, la roulotte garée, la brume, sa bande de la vue d'ensemble) ; tout
ce qui bouge se tire de `VueMonde.avance`. Ses six membres, et ce que chacun doit au moteur :

- `ecranDeLaCase` : où se tient une année à l'écran, nul hors de vue. Le moteur y inscrit la zone
  `case` et y pose le corail ; nul, l'année n'est ni touchable ni marquée.
- `dessinerSuivi` : le Voyage suivi garé dans son année ; le monde inscrit lui-même sa zone
  `roulotte` (`v.zone`), sans quoi la roulotte ne se touche pas.
- `dessinerBande` : sa bande de la vue d'ensemble, fond compris. `cadre.e` est déjà sur le contexte :
  le multiplier encore l'appliquerait deux fois. Elle rend une `LectureDeBande`, d'où la sortie de la
  vue d'ensemble tire l'année touchée.
- `arrets` : un `y` de la section par année, dans l'ordre des années. Une année sans arrêt n'est
  atteinte ni par `marcher`, ni par « Tu es ici », ni par la sortie de la vue d'ensemble.
- `entree` : les temps du passage d'entrée, dans l'ordre de l'endroit ; vide, aucun passage. Durées
  et pauses en millisecondes **de base, sans tempo** : le moteur seul les joue au tempo.
- `ralentis` : où la caméra qui roule ralentit, en `y` de la section, croissants, disjoints, sans
  arrêt dedans ni rien avant le premier arrêt ; le moteur ne le vérifie pas, un test du monde si.

Le moteur côté carte (le meneur de la caméra, les arrêts, le rappel, `direBonjour`), le monde 1900,
son déblocage et son passage côté page sont décrits dans le `README.md`, « La carte du Voyage ». Étendre le moteur laisse `src/carte/reference1890.test.ts` verte **sans y
toucher** : une empreinte ne se recopie pas pour faire passer un test.

**Les images.** Un fichier d'un dossier `assets/` n'entre qu'avec son entrée dans le `CREDITS.md` du
même dossier : œuvre, source (la page du fichier), licence et sa raison, traitement
(`src/test/credits.test.ts`). Une restauration récente (Lobster, Institut Lumière) est permise,
décision du propriétaire du 2 octobre 2026 : l'appli est personnelle, sans but commercial, et la
meilleure image l'emporte ; son entrée au `CREDITS.md` dit seulement d'où elle vient. Jamais une vidéo au précache (`verifier:dist` la refuse, comme une
image au-dessus de son plafond ou hors du budget).

## Le Voyage : ce qu'on casse sans le voir

La carte des fichiers du Voyage est dans le `README.md` (« Les pages du Voyage », « Les pages d'une
décennie »). Trois règles, que les plans 2b et 2c ont payées :

- **Lire une fiche d'année n'est pas anodin.** `GET /me/voyage/annees/{annee}` enfile l'ouverture
  de l'année chez le chroniqueur, au compte IA, quand elle n'est ni visitée ni après l'année en
  cours : une lecture sans geste du membre dépense des jetons Anthropic. La page d'une décennie et
  la boîte à billets ne lisent aucune fiche (la boîte ne fait que consulter le cache, pour offrir la
  correction) ; le billet ne lit que celle de son année, d'où l'on vient ; le guichet, la recherche
  du journal et l'aperçu de la carte ne lisent que les fiches déjà écrites et ouvertes
  (`apercuLitLaFiche`, `src/voyage/regles.ts`) ; la manivelle ne relit que la fiche ouverte et la
  carte, en `exact` ; la sacoche (passeport, portefeuille, coulisses) n'en lit aucune. La décennie,
  la boîte, le guichet, la recherche du journal, l'aperçu de la carte, la manivelle et la sacoche ont
  chacun un test qui compte les requêtes parties : une lecture ajoutée doit y passer.
- **Une séquence lancée d'un rappel de `mutate` vérifie que la page est montée.** TanStack tait ces
  rappels pour un composant démonté à leur appel, pas après les attentes qu'ils lancent : le
  compostage dure plus de quatre secondes (`voyage/tempo.ts`), et un membre parti entre-temps serait ramené à l'année depuis ailleurs.
  Relire un drapeau `monte` après chaque attente, avant tout `setState`, toute vibration et toute
  navigation (`pages/VoyageBillet.tsx`, `tamponner`). Ce que le cache ou une autre page doit
  apprendre (les péremptions, le retour confié à l'année, le billet rangé) va dans `onSuccess` de
  `useMutation`, qui survit au départ ; la navigation reste dans les rappels de `mutate`.
- **Une toile n'ouvre rien au premier contact.** Un défilement commence par un `pointerdown` :
  ouvrir une page passe par `Toile.onChoisir` (le `click`, que le navigateur ne donne pas après un
  défilement), jamais par `onToucher`, qui ne sert qu'à animer (le manège qui s'emballe).

## Les fiches

Une fiche de `docs/cerveau/` dit, pour un sujet, où ça vit, ce qu'on casse sans le voir et les
commandes : elle se lit **avant** d'ouvrir le code qu'elle décrit, et renvoie au `README.md` sans le
recopier. Qui change le code change sa fiche dans le même commit ; `src/cerveau.test.ts` refuse un
renvoi `` `chemin` › `symbole` `` devenu faux, une fiche de plus de soixante lignes, et une fiche
absente de cette table.

| Fiche | Quand la lire |
|---|---|
| `docs/cerveau/carte-et-moteur.md` | Avant d'ouvrir `src/carte/moteur.ts`, `src/carte/meneur.ts` ou leurs tests, d'ajouter un monde, de toucher à la caméra, aux zones, à la mémoire des images, à l'enveloppe de `pages/Carte.tsx` ou à une célébration. |
| `docs/cerveau/monde-1900.md` | Avant d'ouvrir `src/mondes/1900/` : le tracé et les gares, les quatre toiles, le passage de la foire au train, l'habillage (l'heure, la lanterne), la météo, le tunnel, la ficelle d'affiches, ses images, ou la règle du déblocage. |
| `docs/cerveau/pages-1900.md` | Avant d'ouvrir `src/mondes/1900/pages.ts` ou `src/mondes/1900/pages/`, d'ajouter une clé de gabarit, ou de changer un mot ou un jeton des pages 1900 : ce que 1900 compose déjà, ce qui reste par défaut, les gardes qui balaient ses feuilles. |

**La consigne de lecture** vaut pour toute session et tout sous-agent, sans que le brief la répète :
chercher par `grep` avant de lire ; lire par plage (`offset`, `limit`) tout fichier de plus de 500
lignes ; ne pas relire un fichier déjà lu, sauf s'il vient de changer.

## Le contrat de l'API

`contract/openapi.json` est une copie de `../biblio-back/docs/openapi.json`, et `src/api/types.ts`
en est engendré : ni l'un ni l'autre ne se modifie à la main. `npm run contract:pull` refait les
deux d'un geste. Une donnée qui manque au contrat demande un changement du back, jamais un
contournement ici.

**Un contrat en retard bloque le tag de l'API, pas seulement la CI d'ici.** Le Journal se livre
dans l'image du front au tag de `bibliotheque-back` (`README.md`, « La livraison ») ; `livrer.yml`
y compare `contract/openapi.json` à `docs/openapi.json` et refuse le tag si `main` de ce dépôt a
pris du retard — même quand rien d'autre n'a changé côté API.

## Les tests

Vitest et Testing Library, `fetch` toujours doublé : aucun test n'appelle l'API réelle, aucun ne
dépense de jeton Anthropic. **Un test interdit, il ne décrit pas** : chaque assertion se prouve en
cassant ce qu'elle garde et en la voyant échouer — c'est la preuve qui compte, pas le compte de
tests.
