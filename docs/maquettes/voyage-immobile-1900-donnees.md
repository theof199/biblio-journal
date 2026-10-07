# Les données du monde 1900

La fiche de ce que les tâches 11a, 11b et 12 du lot 2 consomment (plan 3b, dans `biblio-back` :
`docs/superpowers/plans/2026-10-06-journal-web-voyage-3b-le-lot-2-du-monde-1900.md`). Elle est
écrite le 6 octobre 2026, d'après la maquette « Voyage immobile 1900 », version 11
(`voyage-immobile-1900.html`, à côté de ce fichier ; les « l. » ci-dessous sont ses lignes).

Chaque fait porte sa source. **Un fait qui n'a pas de source n'est pas ici** : la fin de la fiche
dit ce qui en est sorti. Les nombres de dessin sont recopiés de la maquette, pas réinventés ; ce
qui ne vient pas d'elle est marqué **« repli »** ou **« écart »**.

## Les images

Vingt-deux fichiers WebP dans `src/mondes/1900/assets/`, extraits à l'octet près de la maquette
(l. 1413-1434), chacun avec son entrée au `CREDITS.md` du dossier. Largeur × hauteur, puis poids
en octets :

| Fichier | Taille | Octets | Fichier | Taille | Octets |
|---|---|---|---|---|---|
| `quai` | 624 × 459 | 29 802 | `g1904` | 760 × 473 | 32 490 |
| `interieur` | 720 × 1037 | 30 702 | `g1905` | 640 × 449 | 57 918 |
| `fond` | 941 × 419 | 37 426 | `g1906` | 640 × 419 | 27 760 |
| `loin1` | 883 × 469 | 19 610 | `g1907` | 560 × 467 | 21 108 |
| `loin2` | 845 × 488 | 21 172 | `g1908` | 640 × 340 | 29 534 |
| `loin3` | 893 × 493 | 20 778 | `g1909` | 640 × 328 | 22 542 |
| `voisin` | 900 × 270 | 23 602 | `aff1900` | 560 × 411 | 49 682 |
| `g1900` | 760 × 716 | 68 010 | `aff1901` | 350 × 275 | 7 274 |
| `g1901` | 760 × 397 | 25 226 | `aff1902` | 420 × 518 | 16 274 |
| `g1902` | 760 × 433 | 34 600 | `aff1903` | 489 × 405 | 11 044 |
| `g1903` | 760 × 451 | 79 946 | `aff1904` | 560 × 419 | 20 836 |

La somme : 687 336 octets (671 Kio, ce que la maquette annonce l. 2569). Avec les 374 444 octets de
1890 : **1 061 780 octets, pour un budget de 1 572 864** (1536 Kio, `scripts/verifier-dist.mjs`). Le
plus lourd, `g1903`, pèse 79 946 octets pour un plafond de 393 216. Rien n'a été réduit.

Les tailles sont celles de `window.TAILLES` (l. 2656), relues sur les fichiers. Les gares de 1900 à
1904 sont coloriées ; celles de 1905 à 1909 ne sont que virées : ce sont les plaques, que le dessin
montre en négatif tant que l'année est fermée.

### Le fondu : laissé au dessin

Aucun fondu n'est cuit dans les fichiers, et aucun script n'accompagne les images. La mesure
(ffmpeg, WebP qualité 70, le masque de `POSE` et de `CADRE_LOIN` écrit dans une couche alpha, sur
les dix gares et les trois vues lointaines) :

| | Octets |
|---|---|
| les treize fichiers tels qu'ils sont | 460 694 |
| réencodés à la qualité 70, sans alpha | 476 450 |
| réencodés à la qualité 70, le fondu cuit | 464 980 |

Le poids ne départage rien : 4 286 octets d'écart, moins de 1 %. Ce qui tranche :

- **le canvas sait le faire sans lire un pixel** : l'image sur une toile hors écran, puis un
  dégradé linéaire par bord en `destination-in`, une fois par image, au chargement ;
- **une même image sert sous plusieurs masques** : `g1900` est dessinée deux fois (plus bas),
  `g1903`, `g1904` et `g1906` paraissent entières dans les pages (l. 1823, 2193, 2262), `loin1` et
  `loin3` ailleurs avec d'autres fondus (l. 1208, 375) ;
- **`POSE` se règle à l'essai** : cuit, chaque retouche demanderait de refaire un fichier ;
- cuire, c'est réencoder un WebP déjà compressé : une seconde perte, pour rien.

**Ce que le fondu ne couvre pas : le ciel ôté de 1900.** La maquette dessine `g1900` une seconde
fois, par-dessus, avec un filtre SVG qui rend transparent ce qui est clair (`#sans-ciel`, l. 1448 :
alpha = 6,33 − 1,77 R − 5,96 G − 0,6 B ; l. 111-113 et 2781). Ce n'est pas un dégradé : sans lire
un pixel, le canvas n'a pour cela que `ctx.filter`, dont le support par Safari n'a pas été vérifié
ici. Cuit dans un second fichier (alpha par la même formule, qualité 70), ce calque pèserait
121 958 octets, sous le plafond et dans le budget. Rien n'est cuit : c'est à trancher en 11b, qui
peut aussi s'en passer (un `multiply` sur le ciel de l'heure laisse le blanc disparaître).

**Tranché en 11b, le 7 octobre 2026 : le `multiply`.** Le haut de `g1900` est posé une seconde
fois en `multiply`, fondu aux mêmes bornes (`gares.ts`, `poserLaPositive`) : le blanc du ciel
disparaît, la tour reste. Ni `ctx.filter`, ni pixel lu, ni second fichier. Les autres fondus sont
cuits au premier dessin sur des toiles hors écran, en `destination-in` (`cuisson.ts`).

## Les gares : le lieu et la date de chaque photographie

`LIEU` (l. 2733) dit le lieu ; la date est celle de la page Commons de l'image, relue le 6 octobre
2026 (les adresses sont au `CREDITS.md`). **Les lieux sont ceux des photographies disponibles, pas
ceux des événements de l'année** (maquette, l. 2635).

| Gare | `LIEU` | Ce que la page dit de la date | Ce que la page dit de plus |
|---|---|---|---|
| 1899 (le quai) | Toulouse, gare Matabiau | 4 octobre 1899 | Eugène Trutat |
| 1900 | Paris, l’Exposition | 1900 | les jardins du Trocadéro, la section de l'Asie russe et le pavillon du Transsibérien à gauche ; pas le Champ-de-Mars que dit le titre |
| 1901 | Creil | carte postale du début des années 1900 | « vers 1900 » |
| 1902 | Couville | carte postale du début des années 1900 | éditions Lesventes, à Couville |
| 1903 | Longueville | vers 1900 | auteur inconnu |
| 1904 | Allaman | vers 1905 | le chef de gare Constant Simon |
| 1905 | Bassersdorf | vers 1905 | le chef de gare Schlatter |
| 1906 | Brest | début des années 1900 | la gare départementale |
| 1907 | Monte-Carlo | vers 1905 | Eugène Trutat ; Commons la classe au chemin de fer à crémaillère de La Turbie |
| 1908 | Ponteland | 1er juin 1905 | le premier train de voyageurs à Ponteland |
| 1909 | Iguerande | début des années 1900 | photographie Combier, à Mâcon |

Seules trois dates sont au jour ou au mois près (1899, 1908, et avril 1906 pour `loin3`). Les
autres sont des estimations de leur page : une légende écrit « vers 1900 » ou « vers 1905 », jamais
une année.

`voisin` : une voiture du Transsibérien, Jules Beau, album daté « décembre 1900 ». `fond` (le pic
de Maupas), `loin1` et `loin2` : Trutat, « entre 1859 et 1910 » ; `loin3` : Roquebrune-Cap-Martin,
avril 1906.

## Les bobines

Trois bobines, **en gare de 1900, 1901 et 1904** (`BOBINES`, l. 2717-2721 : `i` vaut 0, 1 et 4 ;
décision 3 du plan : *Hamlet* est en gare de 1901). `dx` et `bas` sont la place dans la gare, en
pixels du milieu et en pourcentage du bas.

| `cle` | Gare | `dx` | `bas` | `titre` | `qui` |
|---|---|---|---|---|---|
| `soldiers` | 1900 | −122 | 33 | Soldiers of the Cross | Joseph Perry et Herbert Booth, 1900 |
| `hamlet` | 1901 | 24 | 27 | Hamlet | Georges Méliès, 1907 |
| `fairylogue` | 1904 | 112 | 41 | The Fairylogue and Radio-Plays | Francis Boggs et Otis Turner, 1908 |

- ***Soldiers of the Cross*** : **en grande partie perdue**, et dite telle. Un spectacle de
  l'Armée du Salut australienne, fait de films et de plaques de lanterne, dirigé par Joseph Perry,
  avec la conférence d'Herbert Booth ; première le 13 septembre 1900 à Melbourne. Aucune bobine ne
  subsiste, il reste environ deux cents plaques de verre.
  Source : https://en.wikipedia.org/wiki/Soldiers_of_the_Cross_(film), lue le 6 octobre 2026.
- ***Hamlet*** : Georges Méliès, 1907, présumé perdu.
  Source : https://en.wikipedia.org/wiki/Hamlet_(1907_film), lue le même jour.
- ***The Fairylogue and Radio-Plays*** : 1908, perdu (le texte de la conférence et des
  photographies subsistent). **Écart à la maquette**, qui écrit « L. Frank Baum, 1908 » : Baum en
  est l'auteur et le conférencier ; Francis Boggs a réalisé la partie d'Oz, Otis Turner *John
  Dough and the Cherub*.
  Source : https://en.wikipedia.org/wiki/The_Fairylogue_and_Radio-Plays, lue le même jour.

## Les dépêches

Trois dépêches (`DATES`, l. 2724-2728), dans la forme `DateVraie` (`src/mondes/types.ts`). `x` et
`y` sont des coordonnées de la section : elles viennent du tracé de la tâche 11a ; la maquette ne
donne que `dx` (pixels du milieu de la gare) et `bas` (pourcentage du bas). Elle ne donne aucune
`image`.

| `an` | `dx` | `bas` | `court` | `lieu` | `titre` | `jour` |
|---|---|---|---|---|---|---|
| 1900 | −44 | 53 | 14 avril | Paris | L’Exposition ouvre | Samedi 14 avril 1900 |
| 1902 | −128 | 47 | sept. 1902 | Paris · théâtre Robert-Houdin | Le Voyage dans la Lune | Septembre 1902 |
| 1903 | 110 | 47 | déc. 1903 | New York · Edison | The Great Train Robbery | Décembre 1903 |

Les `texte`, recopiés :

- 1900 : « L’Exposition universelle ouvre ses portes. Au Trocadéro, le Panorama transsibérien fait
  voyager des spectateurs assis dans de vraies voitures. »
- 1902 : « Georges Méliès présente Le Voyage dans la Lune, tourné dans son studio de verre de
  Montreuil. »
- 1903 : « Edwin S. Porter sort The Great Train Robbery : un train arrêté dans le New Jersey, et un
  bandit qui tire vers la salle. »

Les sources, lues le 6 octobre 2026 :

- **1900.** L'Exposition ouvre le 14 avril 1900 (https://en.wikipedia.org/wiki/Exposition_Universelle_(1900)) ;
  ce jour est un samedi (calcul du calendrier). Le panorama, commandé par la Compagnie
  internationale des wagons-lits, fait asseoir le public dans de vraies voitures
  (https://en.wikipedia.org/wiki/Trans-Siberian_Railway_Panorama) ; « au Trocadéro » se lit sur
  l'affiche d'époque (`aff1900`).
- **1902. Écart à la maquette**, qui écrit « Lundi 1er septembre 1902 » et « 1er sept. » : le jour
  n'a pas de source, et la maquette le dit elle-même (l. 2628). Le mois en a une : une copie
  coloriée est projetée au théâtre Robert-Houdin de septembre à décembre 1902 ; le studio de
  Montreuil est une serre de verre (https://en.wikipedia.org/wiki/A_Trip_to_the_Moon). `court`
  devient « sept. 1902 », sur le modèle de « déc. 1903 ».
- **1903.** Tourné en novembre 1903 à New York et dans le New Jersey, pour Edison, mis en vente au
  début de décembre ; le plan du bandit qui tire vers la caméra
  (https://en.wikipedia.org/wiki/The_Great_Train_Robbery_(1903_film)).

*Le Sacre d’Édouard VII* : aucune dépêche de la maquette ne nomme ce film. S'il s'écrit un jour,
c'est sous ce titre et non « Le Couronnement d’Édouard VII » : Georges Méliès et Charles Urban,
1902 (https://fr.wikipedia.org/wiki/Le_Sacre_d%27%C3%89douard_VII).

## Ce que 11b dessine

Recopié de la maquette, à la lettre. Les indices vont de 0 (1900) à 9 (1909).

**`AMBIANCE`** (l. 2710), l'ambiance du fond, gare par gare :

```js
['ville', 'ville', 'campagne', 'campagne', 'montagne', 'montagne', 'mer', 'mer', 'campagne', 'campagne']
```

**`POSE`** (l. 2712), où finit le ciel de chaque photo, en pourcentage de sa hauteur, puis la part
de ses côtés qui se fond :

```js
{ quai: [10, 8], 1900: [16, 15], 1901: [22, 10], 1902: [22, 10], 1903: [14, 10], 1904: [16, 10],
  1905: [20, 12], 1906: [26, 12], 1907: [14, 16], 1908: [18, 10], 1909: [18, 10] }
```

Le masque est le produit de deux dégradés (l. 107-109) : de transparent à plein sur la part des
côtés, à gauche comme à droite ; de transparent en haut à plein à la hauteur du ciel. Le même
dégradé du haut multiplie la photo d'un voile `#c6b99c`, qui s'éteint à la même hauteur. La gare de
1900 fait exception (l. 2774-2783) : son bas se fond de 53 % à 60 %, et son haut est le calque au
ciel ôté décrit plus haut, fondu de 0 à 2,5 % en haut et de 55 % à 62 % en bas (l. 111-113).

**`LABO`** (l. 2715), la lanterne rouge de chaque plaque : où pend la lampe (pixels du milieu,
pourcentage de la vitre), où tient l'étiquette (deux nombres), et de combien elle penche :

| Gare | Lampe, px | Lampe, % | Étiquette | Étiquette | Penche | Origine |
|---|---|---|---|---|---|---|
| 1901 | −112 | 27 | 0 | 0 | −3 | **repli** : la place de 1905 |
| 1902 | 104 | 25 | 30 | 34 | 2,5 | **repli** : la place de 1906 |
| 1903 | −30 | 29,5 | −34 | 46 | −5 | **repli** : la place de 1907 |
| 1904 | 124 | 26,5 | 22 | −6 | 1,5 | **repli** : la place de 1908 |
| 1905 | −112 | 27 | 0 | 0 | −3 | maquette |
| 1906 | 104 | 25 | 30 | 34 | 2,5 | maquette |
| 1907 | −30 | 29,5 | −34 | 46 | −5 | maquette |
| 1908 | 124 | 26,5 | 22 | −6 | 1,5 | maquette |
| 1909 | −132 | 28,5 | −8 | 40 | −2 | maquette |

Les quatre lignes « repli » **ne viennent pas de la maquette**, qui ne place la lanterne que de
1905 à 1909 : décision 6 du propriétaire, le 6 octobre 2026. Elles se régleront à l'essai sur
téléphone. Ni la maquette ni la décision ne donnent de lanterne à 1900.

**`CADRE_LOIN`** (l. 2854), le cadre de chaque vue lointaine : gauche et droite en parts de
l'image, puis le fondu du ciel, de et à, en pourcentage de sa hauteur :

```js
{ loin1: [0.01, 0.99, 0, 34], loin2: [0.19, 0.93, 14, 38], loin3: [0.01, 0.56, 6, 32] }
```

La suite des vues (l. 2859), « m » pour retournée : `loin1`, `loin2`, `loin3 m`, `loin3`,
`loin2 m`, `loin2`, `loin3 m`, `loin3`, `loin2 m`, `loin1 m`, `loin1`, `loin2`, `loin3 m`, `loin3`.
Chaque vue se fond sur la précédente sur 130 px de son bord (l. 98-100).

**`HEURES`** (l. 3492-3503), une heure par gare : la teinte qui multiplie (haut et bas du ciel), la
lueur de l'astre (rouge, vert, bleu, opacité), sa place en pourcentage de la vitre, la part du
soleil, la part de nuit :

| Gare | `nom` | `haut` | `bas` | `lueur` | `lx` | `ly` | `sol` | `nuit` |
|---|---|---|---|---|---|---|---|---|
| 1900 | aube | 172, 168, 200 | 250, 212, 182 | 255, 168, 118, 0.5 | 80 | 29 | 1 | 0.3 |
| 1901 | petit matin | 204, 215, 232 | 255, 236, 208 | 255, 226, 180, 0.3 | 72 | 23 | 1 | 0 |
| 1902 | matinée | 228, 236, 242 | 255, 248, 232 | 255, 240, 210, 0.2 | 64 | 14 | 0.5 | 0 |
| 1903 | fin de matinée | 244, 247, 248 | 255, 253, 244 | 255, 250, 230, 0.14 | 56 | 9 | 0 | 0 |
| 1904 | plein midi | 255, 255, 255 | 255, 255, 250 | 255, 255, 240, 0.16 | 50 | 6 | 0 | 0 |
| 1905 | début d’après-midi | 255, 250, 236 | 255, 244, 220 | 255, 240, 200, 0.16 | 44 | 10 | 0 | 0 |
| 1906 | fin d’après-midi | 250, 232, 200 | 250, 222, 176 | 255, 214, 150, 0.28 | 36 | 20 | 0.6 | 0 |
| 1907 | crépuscule | 150, 128, 172 | 250, 160, 110 | 255, 130, 60, 0.6 | 28 | 30 | 1 | 0.45 |
| 1908 | heure bleue | 84, 98, 152 | 140, 130, 168 | 210, 120, 130, 0.28 | 20 | 33 | 0 | 0.75 |
| 1909 | nuit | 58, 72, 124 | 88, 98, 146 | 150, 170, 230, 0.16 | 72 | 19 | 0 | 1 |

**`LUNE`** (l. 3504) : `[72, 19]`, la place de la lune en pourcentage de la vitre.

**`FENETRES`** (l. 3510-3515), les fenêtres allumées, en parts de la photo de la gare :
`[x, y, largeur, hauteur]` ; un cinquième terme fait un halo. Trois gares seulement : 1907, 1908 et
1909 (indices 7, 8, 9).

```js
const rame1908 = Array.from({ length: 12 }, (_, k) => [0.112 + k * 0.027, 0.4 - k * 0.0068, 0.011 + k * 0.0004, 0.03 + k * 0.001]);
const FENETRES = {
  7: [[0.79, 0.125, 0.027, 0.08], [0.916, 0.13, 0.04, 0.065], [0.71, 0.19, 0.014, 0.09], [0.2, 0.345, 0.03, 0.065], [0.36, 0.34, 0.03, 0.1]],
  8: [...rame1908, [0.632, 0.21, 0.026, 0.1], [0.6, 0.44, 0.012, 0.03], [0.3, 0.62, 0.5, 0.3, 1]],
  9: [[0.477, 0.305, 0.023, 0.107], [0.512, 0.29, 0.019, 0.107], [0.544, 0.26, 0.031, 0.137], [0.644, 0.503, 0.036, 0.13], [0.46, 0.5, 0.11, 0.17, 1], [0.36, 0.5, 0.4, 0.4, 1]],
};
```

**Écart, 11b :** la maquette laisse 14 % de l'heure sous la lanterne (`1 - 0.86 * voile`,
l. 3700) ; le monde n'en laisse rien à l'arrêt d'une année fermée (`habillage.ts`, `partDeLHeure`).
Le guidon du chef suit la seule distance (décision 5), et son bras monte sur 40 px de geste, un
nombre choisi en 11b.

L'heure et les fenêtres sont un décor, pas un fait : rien ne dit que la nuit tombait à Iguerande le
jour de la photographie (maquette, l. 2638).

## Ce que 12 joue

**`TEMPS`** (l. 2747), les cinq durées de l'endroit, **telles qu'on les voit à l'écran** : la
maquette y a déjà compté le tempo de l'appli (l. 2746).

| Temps | À l'écran, ms |
|---|---|
| `descente` | 2600 |
| `quai` | 1100 |
| `montee` | 2200 |
| `assis` | 1000 |
| `trajet` | 4600 |

Onze secondes et demie en tout. Les trois durées du retour (`retourTrain` 2400, `retourQuai` 1400,
`retourFoire` 1800) sont dans la maquette et **ne sont pas jouées** : le moteur rejoue l'endroit
retourné (plan 3b, tâche 12).

**Les quatre positions** (plan 3b, tâche 12 ; `planDuPassage`, l. 3273-3277 ; les positions,
l. 2951-2955). « En base » vaut la moitié de l'écran : `TEMPO` vaut 2, et le moteur seul joue au
tempo.

| Rang | Où la caméra se tient | `duree` à l'écran | `duree` en base | `arret` à l'écran | `arret` en base |
|---|---|---|---|---|---|
| 0 | le bas de la foire (`U0`) | jamais lue | jamais lue | 0 | 0 |
| 1 | le quai (`A1`) | 2600 (la descente) | 1300 | 1100 | 550 |
| 2 | assis, encore à quai (`S1`) | 2200 (la montée) | 1100 | 1000 | 500 |
| 3 | la gare de 1900 (`B1`), `arrets[0]` | 4600 (le trajet) | 2300 | 0 | 0 |

Les `y` sont ceux du tracé de la tâche 11a ; cette fiche n'en fixe que l'ordre. Dans la maquette
(l. 2742-2744 et 2951-2955) : `A1` est le bas de la carte de 1890 plus une jonction de 180 px,
`S1 = A1 + 560 × 0,44`, `B1 = A1 + 560`.

## Ce qui est sorti de la fiche

Rien de ce que le lot 2 écrit n'est sorti faute de source : les trois bobines et les trois
dépêches ont la leur. Deux faits de la maquette sont **corrigés** plutôt que sortis : le jour de la
dépêche de 1902 (retiré, le mois reste) et le `qui` de *The Fairylogue and Radio-Plays*.

Un fait de la spec n'est pas repris : elle dit de *Soldiers of the Cross* que « les plaques et deux
films subsistent ». La page lue dit qu'aucune bobine ne subsiste. La fiche écrit ce que la page
dit ; « en grande partie perdue » tient dans les deux cas.

Restent « non vérifiés » dans la maquette, hors du lot 2, et dans aucune fiche (l. 2636-2637 et
2640-2642) : le 28 décembre 1895, les films derrière les étiquettes, la Halte Méliès, la carte
postale, les objets trouvés. Leurs lots les vérifieront.
