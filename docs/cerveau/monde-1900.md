# Fiche : le monde 1900, le voyage immobile

Ce que le monde montre, son déblocage et son passage côté page sont dans le `README.md` (« La carte
du Voyage ») ; ce qu'une `scene` doit au moteur, dans `CLAUDE.md` (« Un monde, un dossier ») ; la
caméra, dans `docs/cerveau/carte-et-moteur.md`. Les tables recopiées de la maquette et leurs sources :
`docs/maquettes/voyage-immobile-1900-donnees.md`. La maquette elle-même ne se lit jamais en entier.

## Où ça vit

- **Le monde** : `src/mondes/1900/index.ts` › `creerMonde1900` (la palette, la `scene`, ce qu'il ne fait pas : ni chantier, ni adieu, ni réaction) ; sa ligne au registre, `src/mondes/index.ts` › `FABRIQUES`.
- **Le tracé** : `src/mondes/1900/trace.ts` › `trace1900`, `ARRETS`, `PAS`, `HAUTEUR` ; les positions du passage y sont aussi, `src/mondes/1900/trace.ts` › `U0`, `A1`, `S1` et `B1`.
- **Les quatre toiles** : `src/mondes/1900/toiles.ts` › `RAPPORTS`, `decalages`, `fenetre`, `dansLaFenetre`.
- **Les gares et leurs plaques** : `src/mondes/1900/gares.ts` › `ecranDeLaCase`, `gareALEcran`, `estFermee`, `aDevelopper`, `developpement`, `dessinerMoyen` ; les dépêches et les bobines s'y posent et s'y inscrivent.
- **Le passage** : ses temps, `src/mondes/1900/entree.ts` › `ENTREE` ; ses règles, `src/mondes/1900/passage.ts` › `montee`, `trajet`, `vitreALEcran`, `vitreOuverte` ; son trait, `src/mondes/1900/montee.ts` › `dessinerSousLaVitre`, `dessinerDevantLaVitre`.
- **L'habillage** (l'heure, les chefs de gare, la lanterne) : les tables, `src/mondes/1900/donnees.ts` › `HEURES`, `LABO`, `AMBIANCE` ; les règles, `src/mondes/1900/habillage.ts` › `heureSurLaLigne`, `voileDuLaboratoire`, `partDeLHeure` ; le trait, `src/mondes/1900/dessus.ts` › `dessinerSurLaBrume`.
- **Le fond, le lointain, le sol** : `src/mondes/1900/fonds.ts` › `dessinerFond`, `src/mondes/1900/lointain.ts` › `vuesALEcran`, `src/mondes/1900/ciel.ts` › `dessinerCiel`, `src/mondes/1900/sol.ts` › `dessinerSol`, `dessinerProche`.
- **Les images** : `src/mondes/1900/images.ts` › `imageDu1900`, `TAILLES` ; ce qui se peint une fois pour être reposé, `src/mondes/1900/cuisson.ts` › `cuire`, `fondre`.
- **Le reste** : `src/mondes/1900/suivi.ts` › `voitureALEcran`, `src/mondes/1900/bande.ts` › `lectureDeLaBande`, `src/mondes/1900/bobines.ts` › `CACHETTES`, `src/mondes/1900/depeches.ts` › `PLACES_DES_DEPECHES`, `src/mondes/1900/roulement.ts` › `ROULEMENT`, `src/mondes/1900/durees.ts` › `DEVELOPPEMENT`.
- **Côté page** : `src/voyage/regles.ts` › `premiereDecennieCachee`, `anneesMontrees`, `estMontree` ; `src/carte/avancee.ts` › `jouerAvancee` ; `src/pages/Carte.tsx` › `aUneScene`, `aUnPassage`.

## Ce qu'on casse sans le voir

- **Tout se tire d'`avance`.** Le passage ne lit ni `v.t` ni `v.entree` : la même avance donne la même
  image, qu'il se joue, se rejoue à l'envers ou soit posé d'un coup (`passage.test.ts`). Un effet daté de
  l'horloge y casserait l'envers et le calme.
- **Deux fichiers de durées, deux règles contraires.** `durees.ts` ne porte que des `auTempo(…)` ;
  `entree.ts` s'écrit en base, sans tempo, que le meneur seul applique. `src/voyage/tempo.test.ts` refuse l'inverse.
- **Une plaque a deux gardes** (`aDevelopper`) : l'année fermée, et l'année où le membre n'est pas encore
  arrivé. Sans la seconde, la plaque paraît développée le temps du trajet, puis redevient négative. « Fermée »
  n'a qu'une règle, `estFermee`, que la bande lit aussi : verrouillée, ou en attente du Voyage suivi (`CaseVue.attente`).
- **L'heure est celle de la gare.** Le monde ne lit ni `VueMonde.nuit` ni `VueMonde.lum` et n'appelle pas
  `v.feu`. Le voile de nuit du moteur, posé après ses plans, ne lui appartient pas.
- **Les deux premiers points de `trace1900` sont ceux de `traceAVenir`** : le bas de 1890 en dépend, donc
  `src/carte/reference1890.test.ts`. Le tracé prend tout début de la suite
  1900 à 1909 (1900 à 1902 suffisent) et lève dès qu'une année n'est pas à son rang, depuis 1900 et dans l'ordre.
- **`siteDuChantier` rend nul**, exprès : une visée arrêterait le roulement vers la gare.
- **Ce qui se touche** : les années, les dépêches, les bobines et la voiture du Voyage suivi, rien tant que
  la vitre n'a pas rempli l'écran. L'habillage et le trait du passage n'inscrivent aucune zone.
- **La clé d'une bobine est ce que l'appareil retient** ; son rang est celui de `CACHETTES`.
- **Une image entre avec son entrée au `CREDITS.md` du dossier et, posée à ses proportions, sa ligne
  dans `TAILLES`.** Aucun fondu n'est dans les fichiers : `cuire` le peint une fois, dans une mémoire bornée.
- **Le rendu du décor n'a pas de test** : les tests gardent les règles (`habillage.ts`, `passage.ts`,
  `toiles.ts`). Ce qui doit être gardé s'écrit en règle pure, pas dans le trait.
- **La maquette montre plus que le monde ne dessine** (pluie, tunnel, aiguillage, contrôleur, horaire,
  objets trouvés, affiches du compartiment) : rien de cela n'est livré, et ne se dessine pas d'après elle.

## Les commandes

```bash
npx vitest run src/mondes/1900 src/voyage/tempo.test.ts src/carte/reference1890.test.ts
grep -n "^export " src/mondes/1900/*.ts          # le plan du dossier
grep -n "describe(\|  it(" src/mondes/1900/*.test.ts
```
