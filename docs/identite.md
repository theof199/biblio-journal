# L'identité du Journal

Le Journal est mon cinéma : un petit cinéma de quartier, la nuit, dont je suis à la fois la
patronne, la projectionniste et la seule spectatrice. Chaque page de l'app est un endroit du
bâtiment, et ce qu'on y voit est fait des objets qu'on y trouverait. Ce fichier dit lesquels, pour
qu'une page neuve se dessine à partir du lieu plutôt qu'à partir de l'écran d'avant.

Le Voyage est l'écran : ce qui se projette quand les lumières s'éteignent, le rêve. Il a son
identité à lui (`../biblio-android/docs/design.md`), libre, par décennie, et ne doit rien au
bâtiment. Tout le reste est le bâtiment : réel, matériel, fait de bois, de verre, de pellicule et
d'ampoules. Les deux ne se mélangent jamais : rien du rêve ne passe dans le bâtiment (ni ses
couleurs ni ses polices, `README.md`, « Le thème »), et le bâtiment ne cherche jamais à ressembler
au rêve. Les valeurs (couleurs, tailles, géométries) vivent dans `src/ui/theme.css` ; ce
fichier-ci ne porte que les intentions.

## Le lieu

| Page | L'endroit | Ce qu'on y voit |
|---|---|---|
| Voyage | L'écran | Le rêve : hors de ce fichier, voir `design.md` ; le bâtiment n'en montre que le programme (la bande du Voyage de l'accueil) |
| Accueil | La façade, vue du trottoir | L'enseigne du fronton (le film de ce soir, ou le prochain, ou le dernier), les affiches sous verre en éventail, le programme du Voyage, puis le journal : une bobine de pellicule par mois |
| Profil | Le portefeuille | Ma carte d'adhérent (mon monogramme, ma couleur, mon pseudo, mes chiffres) ; dessous, mes graphiques dessinés comme des objets (notes, réactions, décennies, mois) ; en bas, le ticket de caisse |
| Réglages (`profil/reglages`) | La caisse | Un ticket de caisse : jour ou nuit, mes films, l'import Letterboxd, le rattrapage, les doublons, la déconnexion, la mention TMDB et la version en pied de ticket |
| Au ciné | Le hall et la caisse | Mes billets de séance, les affiches « prochainement » des sorties en salle |
| Suivis | Le bureau de la programmation | Un mur d'affichettes punaisées : une par réalisateur que je suis (son portrait imprimé à l'encre bleue, un trou poinçonné par film vu), une planche par saga ; au-dessus, le prochain film de chacun ; les suivis bouclés rangés aux archives |
| Fiche d'un film (`journal/:id`) | La boîte de la bobine | L'étiquette du film : l'affiche, la date, la note, ce que j'en ai écrit |
| Recherche, nouveau film | Le guichet | On demande un titre sur du papier crème, on choisit à l'affiche (trois par rangée) ; un film déjà vu y porte une étiquette de papier, ses étoiles ou « vu » au crayon. Puis le billet du critique : un billet de presse, coins mordus, bande rouge ; dix trous poinçonnés pour la note, des tampons pour les réactions, la page de notes d'un carnet à spirale dessous ; enfin le papier rendu, sa critique imprimée comme une coupure de presse |

Une seule ligne reste une proposition, la fiche d'un film (`journal/:id`) : elle se confirme avant sa maquette.

## Les objets, jamais les cartes

Une section est toujours un objet du cinéma : une enseigne, une pellicule, un ruban adhésif, une
amorce, un billet, une étiquette. Jamais une carte à coins arrondis, une puce, un badge, un bloc de
chiffres sur fond gris. Si une maquette ressemble à n'importe quelle app, elle est à refaire.

- Un chiffre se lit sur l'objet qui le porte : une jauge pour une moyenne, des perforations pour
  une couverture, une rangée de diodes pour une distribution, un compte à rebours pour un rang.
- Un lien d'action est un objet qu'on manipule : une enseigne qu'on touche, une collure, un billet.
- La matière se dessine en CSS (dégradés, ombres, `clip-path`), jamais en image, sauf les affiches
  des films et les images du Voyage.
- Un seul objet par section, à la taille d'un téléphone (390 px, et 320 px doit tenir) : l'app se
  lit d'une main, les écrans larges n'ont qu'une colonne plus aérée.

## Le jour et la nuit

La nuit est l'état naturel du cinéma ; le jour est le même bâtiment, ses lumières éteintes. Un
objet ne change pas de forme entre les deux : seules ses lueurs, ses halos et ses ampoules
s'éteignent (`--enseigne-nuit-*`), et le ciel passe du bleu de nuit au bleu de jour. Si un dessin
n'existe qu'en nuit, il n'est pas fini.

## La palette

Une nuit américaine : des bleus de nuit pour le ciel et les murs, du crème pour ce qui est écrit
ou éclairé, un rouge chaud pour ce qui s'allume. Le Voyage garde ses propres couleurs et ne les
prête pas. La couleur d'identité du membre (`identity_color`) ne touche que ses marques à lui : son
monogramme, son étoile, jamais le décor.

Les enseignes font exception par décennie : chaque décennie de 1890 à 2020 a son panneau, son
encre et sa police, posés dans un bloc `[data-decennie='…']` de `theme.css` ; le cadre et ses
ampoules, eux, ne changent jamais. La décennie 1940 est celle de la maison.

## Les polices

Trois rôles, pas plus, hors enseignes :

- **League Gothic** (`--police-fronton`) : ce qui est peint ou imprimé en capitales sur un objet,
  les étiquettes, les libellés de mois, les titres de sections ; toujours en capitales espacées.
- **Bodoni Moda** (`--police-titre`) : les titres de films et les grands titres de page.
- **Jost** (`--police-texte`) : tout le texte courant.

Une police par décennie pour l'enseigne (`src/ui/polices.ts`, `src/accueil/enseignes.test.ts`).
Une écriture manuscrite n'apparaît que sur ce que le membre a « écrit lui-même » (son prénom, ses
chiffres au crayon gras, ses recherches, son « vu », son verdict, sa remarque, sa signature) ; elle demande une police de plus, et donc un accord avant de l'ajouter.

## Le mouvement

Un seul allumage par page, une fois, à l'arrivée (les lettres du fronton, les ampoules). Rien ne
boucle, rien ne clignote, à une exception : une page qui attend ses données laisse ses objets en
blanc, et ils respirent lentement, tous ensemble, jusqu'à l'arrivée des données (`src/ui/Attente.tsx`).
Sous `prefers-reduced-motion`, tout est allumé d'emblée (`src/ui/mouvement.ts`) et les objets en blanc
restent immobiles. Un défilement est toujours celui du doigt, jamais automatique.

## Les mots

Le vocabulaire est celui de la salle, pas celui d'une app : une séance, un programme, une bobine,
une amorce, une enseigne, une affiche, un billet. Les libellés sont courts, en français, sans
anglicisme, et posés sur l'objet qui les porte (« Se déconnecter » est écrit sur un bout de ruban,
pas dans un bouton).

## Dessiner une page neuve

1. Nommer son endroit et ses objets en une ligne, à partir du tableau ci-dessus ; une page sans
   endroit n'est pas prête.
2. La maquetter en nuit et en jour, à 390 px, sur le canevas, avant toute ligne de code.
3. Se demander si elle pourrait être une page d'une autre app. Si oui, recommencer.
4. Poser ses valeurs en jetons dans `theme.css`, puis ses composants ; `src/ui/theme.test.ts`
   refuse toute valeur en dur.
