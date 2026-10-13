# Les habillages de la télécommande

La télécommande du Feuilleton change d'apparence à chaque chapitre du jeu. Tout ce qui s'en voit
(couleurs, formes des touches, cadre, écran, polices, capitales, graisses, pointillés, la marque
gravée au pied) tient dans **un habillage** : un fichier de variables et une ligne de table. Les composants ne changent pas.

## Les fichiers

| Chemin | Rôle |
|---|---|
| `src/feuilleton/habillages/chapitre-1.module.css` | L'habillage du chapitre 1 : une classe `.habillage` qui pose les variables `--h-*`, chacune tirée d'un jeton de `src/ui/theme.css`. |
| `src/feuilleton/habillages/index.ts` | `HABILLAGES`, la table des chapitres (la classe, et les deux libellés d'ambiance `marque` et `modele`), et `habillageActif()`, **le seul endroit où le chapitre se choisit**. |
| `src/feuilleton/telecommande/*.module.css` | La structure : boîtes, tailles, rangées. Ces feuilles ne lisent au thème que des mesures, et tout le reste par `var(--h-…)`. |
| `src/feuilleton/Feuilleton.tsx` | Le seul appelant de `habillageActif()` : il passe l'habillage au bouton rond et au panneau, qui posent sa classe sur leur racine (avec `data-chapitre`, pour qui inspecte la page). |

## Ajouter un chapitre

1. Copier `chapitre-1.module.css` en `chapitre-2.module.css` et changer les valeurs. La classe garde
   son nom, `.habillage`.
2. Ajouter sa ligne à `HABILLAGES` dans `index.ts` :
   `'chapitre-2': { classe: chapitre2.habillage ?? '', marque: '…', modele: '…' }`.
3. Le rendre actif : faire rendre `'chapitre-2'` à `habillageActif()` (le jour où le jeu le dira,
   c'est là que se lit l'état du joueur).

Aucun fichier de `src/feuilleton/telecommande/` n'est à ouvrir, **et aucun test n'est à retoucher** :
ils ne comptent pas les chapitres.

- `habillages.test.ts` exige autant de fichiers `chapitre-N.module.css` que de lignes dans
  `HABILLAGES`, du même nom (l'étape 1 sans l'étape 2 tombe, et l'inverse), que chaque ligne ait sa
  classe, sa marque et son modèle, et que `habillageActif()` rende un nom de la table. Il lit chaque
  chapitre : toutes les variables du contrat, rien que des jetons, rien d'orphelin.
- `src/ui/theme.test.ts` (« ne lit que des variables de theme.css ») tient pour connues les `--h-*`
  de **tous** les fichiers de `habillages/`.
- `chapitreDEssai.test.tsx` déclare son propre chapitre : il ne dépend pas du chapitre actif.

Un test qui nomme le chapitre 1 (`HABILLAGES['chapitre-1']`, sa marque) ne tombe pas à l'ajout d'un
chapitre : il ne tomberait qu'au retrait du premier.

## Les variables qu'un chapitre doit définir

Toutes celles que les composants lisent ; `habillages.test.ts` en tire la liste des feuilles
elles-mêmes et refuse un chapitre qui en oublie une, ou qui en définit une que personne ne lit.

- **Couleurs** : `--h-voile` ; `--h-boitier-fond`, `-contour`, `-texte`, `-texte-doux` ;
  `--h-ecran-fond`, `-contour`, `-texte`, `-texte-doux` ; `--h-touche-fond`, `-texte`, `-contour` ;
  `--h-principale-fond`, `-texte`, `-contour` ; `--h-alerte` ; `--h-bouton-fond`, `-icone`, `-cerne` ;
  `--h-mono-fond`, `-texte` (le monogramme d'un membre, plus bas).
- **Formes** : `--h-rayon-boitier`, `-ecran`, `-touche`, `-principale`, `-ronde` ; `--h-trait`,
  `--h-trait-fort` ; `--h-pied-touche` (l'ombre intérieure qui fait le pied d'une touche) ;
  `--h-ombre-boitier`, `--h-ombre-bouton` ; `--h-icone-trait-fort`.
- **Polices** : `--h-police-titre`, `-code`, `-libelle`, `-touche`, parmi les trois rôles du thème.
- **Ambiance** : `--h-casse-libelle` (la casse des libellés gravés : `--telecommande-casse`) ;
  `--h-graisse-legere`, `-moyenne`, `-forte` (parmi `--graisse-*`) ; `--h-trait-de-note` (le style du
  contour d'un message, d'une note, d'un état vide : `--telecommande-trait-de-note`). Une feuille de
  composant n'écrit ni `uppercase`, ni une graisse, ni `dashed` : le test le refuse.

Une valeur est toujours un jeton de `theme.css` (ou une autre variable `--h-*`) : ni couleur ni
police en dur. Une couleur que le thème n'a pas y gagne d'abord un jeton, dans ses trois blocs si
elle change entre le jour et la nuit.

Un chapitre qui veut plus qu'une valeur (une touche d'une autre forme) ajoute ses règles dans son
fichier, sous sa classe, en visant les pièces par leur attribut : `.habillage [data-piece='touche']`.
Les pièces : `boitier`, `voile`, `ecran`, `touche`, `touche-principale`, `rangee-principale`,
`message`, `voyant`, `pied`, `point`, `monogramme`, `champ` (la recherche de l'ajout). Un résultat de
recherche et une saison de la fiche sont des `ecran` (`data-etat` : `resultat`, `saison`, `fiche`).

**Le monogramme d'un membre** porte une couleur qui n'est pas de l'app : sa couleur d'identité, une
donnée (`identity_color`). `src/feuilleton/Monogramme.tsx`, hors de `telecommande/`, la pose en
`--identite` sur la pièce, et rien d'autre ; c'est le chapitre qui décide d'en faire le fond
(`--h-mono-fond: var(--identite)`) et de quelle encre écrire dessus (`--h-mono-texte`). Une variable se
résout là où elle est déclarée : le chapitre redéclare donc `--h-mono-fond` sur
`[data-piece='monogramme']`, sans quoi `--identite` serait celle de la page.

## Ce qu'un chapitre ne change jamais

- La structure : quelles vues, quelles rangées, dans quel ordre.
- Les libellés d'action (« Vu », « Annuler », « Tout jusqu'ici »…) : `marque` et `modele` ne sont
  que de l'ambiance, cachés aux lecteurs d'écran.
- Les tailles de cible (44 px au moins) et la hauteur fixe des rangées.
- Le sens des couleurs d'état : `--h-alerte` est ce qui attend, et rien d'autre.
- Les seuils de contraste de la table en tête de `docs/maquettes/telecommande.html` : 4,5 pour le
  texte courant, 3 pour le grand texte et les contours. Ils se remesurent pour chaque chapitre, en
  jour et en nuit ; aucun test ne le fait.

## Le vérifier

```bash
npx vitest run src/feuilleton/habillages src/ui/theme.test.ts
```

`habillages.test.ts` garde la séparation (aucune couleur, police, graisse, rayon ni ombre du thème
dans un composant ; aucune couleur nommée, `currentColor` compris ; un seul importeur des chapitres ;
un seul appel de `habillageActif()` ; rien de `src/feuilleton/` n'importe `studio/` ni `maison/`) et le contrat de
chaque chapitre ; `chapitreDEssai.test.tsx` déclare un chapitre dans le test et constate qu'il
s'applique au bouton et au panneau sans toucher à un composant. Puis regarder : le bouton rond sur
les deux espaces et le panneau ouvert (`/feuilleton/maison?telecommande=telecommande`), en jour et
en nuit, à 390 et à 320 px ; l'ajout (`?telecommande=ajouter`) et une fiche (`?telecommande=fiche-<identifiant>`)
de même, et le boîtier centré sur grand écran.
