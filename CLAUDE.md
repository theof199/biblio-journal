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
et trois dessins : le bandeau, la scène, l'estrade). Une page ou un composant de `src/voyage/`
n'importe jamais un monde précis : il passe par le registre. **Une couleur ou une police de page
passe par un jeton** : aucune feuille de `src/voyage/` ni `src/pages/Voyage*.module.css` ne porte de
couleur ni de police en dur, ni ne lit une variable hors des jetons du monde, de `--corail`, de `--coque-bas` et des
`--z-*` (`src/voyage/habillage.test.ts`). Une couleur de maquette sans jeton en gagne un, dans
`JETONS_DE_PAGE` et dans chaque monde ; une feuille neuve s'ajoute au plancher du même test.

Si l'interface ne
suffit pas au monde qu'on écrit, **elle s'étend d'abord, dans une tâche à part, avec le monde « à
venir »** (que la signature oblige à suivre) : jamais un contournement dans le moteur ou la page.

**Les images.** Un fichier d'un dossier `assets/` n'entre qu'avec son entrée dans le `CREDITS.md` du
même dossier : œuvre, source (la page du fichier), licence et sa raison, traitement
(`src/test/credits.test.ts`). Jamais une restauration récente (Lobster, Institut Lumière) : le scan
peut porter ses propres droits. Jamais une vidéo au précache (`verifier:dist` la refuse, comme une
image au-dessus de son plafond ou hors du budget).

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
