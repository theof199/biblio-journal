# Fiche : le monde 1900, le voyage immobile

Ce que le monde montre, son déblocage et son passage côté page sont dans le `README.md` (« La carte
du Voyage ») ; ce qu'une `scene` doit au moteur, dans `CLAUDE.md` (« Un monde, un dossier ») ; la
caméra, dans `docs/cerveau/carte-et-moteur.md`. Les tables recopiées de la maquette et leurs sources :
`docs/maquettes/voyage-immobile-1900-donnees.md`. La maquette elle-même ne se lit jamais en entier.

## Où ça vit

- **Le monde** : `src/mondes/1900/index.ts` › `creerMonde1900` (la palette, la `scene`, ce qu'il ne fait pas : ni chantier, ni adieu, ni réaction) ; sa ligne au registre, `src/mondes/index.ts` › `FABRIQUES`.
- **Le tracé** : `src/mondes/1900/trace.ts` › `trace1900`, `ARRETS`, `PAS`, `HAUTEUR` ; les positions du passage y sont aussi, `src/mondes/1900/trace.ts` › `U0`, `A1`, `S1` et `B1`.
- **Les quatre toiles** : `src/mondes/1900/toiles.ts` › `RAPPORTS`, `decalages`, `fenetre`, `dansLaFenetre`.
- **Les gares et leurs plaques** : `src/mondes/1900/gares.ts` › `ecranDeLaCase`, `gareALEcran`, `estFermee`, `aDevelopper`, `developpement`, `dessinerMoyen`, `horaireSurLaPlaque` (ce que la plaque dit de l'horaire de son année, brief 11 des écrans des lots : la règle commune `src/voyage/horaire.ts` › `horaireDePlaque`, que la liste des années de `src/pages/Carte.tsx` lit aussi ; tenu, « à l'heure » et un filet doré, accepté, « avant » et le jour servi, manqué rien, et rien sur une plaque à développer ; la plaque grandit vers le haut, son bas reste au-dessus du corail) ; les dépêches, les bobines, les objets oubliés et les aiguillages s'y posent et s'y inscrivent. **L'aiguillage d'une halte** (brief 12 des écrans des lots) : `src/mondes/1900/aiguillage.ts` › `aiguillagesALEcran` (la règle pure : un par halte de `VueMonde.haltes`, **aucun sans halte servie**, le levier au bout du quai de la gare `apres`, le poteau sur le tronçon, rien dans une gare à développer), `filmsDuPoteau`, `RAYON_DU_LEVIER`, `dessinerAiguillages` (le trait, et la zone `aiguillage` au rang de la halte dans la vue) ; la halte ouverte est un dialogue de page (`docs/cerveau/jeu-1900.md`).
- **Les objets oubliés** (un par gare, le catalogue de la sacoche) : leur place sur le quai, `src/mondes/1900/objets.ts` › `OBJETS` (`quai`), `phraseDeLObjet` ; lesquels se proposent, `src/mondes/1900/gares.ts` › `objetsSurLeQuai`, `RAYON_D_OBJET` ; le dessin en SVG de l'envol et de la sacoche, `src/mondes/1900/pages/DessinDObjet.tsx`.
- **Le passage** : ses temps, `src/mondes/1900/entree.ts` › `ENTREE` ; ses règles, `src/mondes/1900/passage.ts` › `montee`, `trajet`, `vitreALEcran`, `vitreOuverte` ; son trait, `src/mondes/1900/montee.ts` › `dessinerSousLaVitre`, `dessinerDevantLaVitre`.
- **L'habillage** (l'heure, les chefs de gare, la lanterne) : les tables, `src/mondes/1900/donnees.ts` › `HEURES`, `LABO`, `AMBIANCE` ; les règles, `src/mondes/1900/habillage.ts` › `heureSurLaLigne`, `voileDuLaboratoire`, `partDeLHeure` ; le trait, `src/mondes/1900/dessus.ts` › `dessinerSurLaBrume`.
- **La météo** (pluie, neige) : la table, `src/mondes/1900/donnees.ts` › `METEO` ; les règles, `src/mondes/1900/habillage.ts` › `forceEnGare` (la buée la lit aussi), `src/mondes/1900/meteo.ts` › `forceDuTemps`, `partsDuTemps`, `glissement`, `goutteALEcran` ; le trait, `src/mondes/1900/intemperies.ts` › `dessinerMeteo`.
- **La buée de Creil** (un glissement horizontal l'essuie) : la table, `src/mondes/1900/donnees.ts` › `BUEE` ; les règles, `src/mondes/1900/buee.ts` › `forceDeLaBuee`, `bueePrise`, `essuyer`, `creerVitre` (la mémoire, dans la fermeture du monde, branchée sur `glisser`) ; le trait, à la fin de `dessinerMeteo`, sur une toile à elle (`src/mondes/1900/cuisson.ts` › `toileHorsEcran`).
- **Le tunnel** (un seul ; le train qui roule y lève le pied) : la table, allure comprise, `src/mondes/1900/donnees.ts` › `TUNNEL` ; les règles, `src/mondes/1900/tunnel.ts` › `bornesDuTunnel`, `tunnelALEcran`, `sousLaVoute`, `ralentisDuTunnel` (pour `scene.ralentis`) ; le trait, `src/mondes/1900/voute.ts` › `dessinerTunnel`.
- **La ficelle** (les affiches des années ouvertes, cinq au plus, dans le compartiment et en reflet dans le tunnel) : la règle, `src/mondes/1900/ficelle.ts` › `affichesDeLaFicelle`, `PLAFOND_DE_LA_FICELLE`, `cleDeLaFicelle` (une affiche qui arrive fait recuire) ; le trait, `src/mondes/1900/accroches.ts` › `dessinerFicelle`, une seule toile cuite. Son plafond tient sous `src/carte/CarteCanvas.tsx` › `AFFICHES_D_UN_MONDE`.
- **Le fond, le lointain, le sol** : `src/mondes/1900/fonds.ts` › `dessinerFond`, `src/mondes/1900/lointain.ts` › `vuesALEcran`, `src/mondes/1900/ciel.ts` › `dessinerCiel`, `src/mondes/1900/sol.ts` › `dessinerSol`, `dessinerProche`.
- **Les images** : `src/mondes/1900/images.ts` › `imageDu1900`, `TAILLES` ; ce qui se peint une fois pour être reposé, `src/mondes/1900/cuisson.ts` › `cuire`, `fondre`.
- **Le reste** : `src/mondes/1900/suivi.ts` › `voitureALEcran`, `src/mondes/1900/bande.ts` › `lectureDeLaBande`, `src/mondes/1900/bobines.ts` › `CACHETTES`, `src/mondes/1900/depeches.ts` › `PLACES_DES_DEPECHES`, `src/mondes/1900/roulement.ts` › `ROULEMENT`, `src/mondes/1900/durees.ts` › `DEVELOPPEMENT`.
- **Côté page** : `src/voyage/regles.ts` › `premiereDecennieCachee`, `anneesMontrees`, `estMontree` ; `src/carte/avancee.ts` › `jouerAvancee` ; `src/pages/Carte.tsx` › `aUneScene`, `aUnPassage`.

## Ce qu'on casse sans le voir

- **Tout se tire d'`avance`.** Le passage ne lit ni `v.t` ni `v.entree` : la même avance donne la même
  image, qu'il se joue, se rejoue à l'envers ou soit posé d'un coup (`passage.test.ts`). Un effet daté de
  l'horloge y casserait l'envers et le calme. Le tunnel de même, qui n'existe pas au calme : nul en gare sur tout écran (sa présence s'efface au départ) ; sous son noir plein, `dessinerSurLaBrume` ne dessine ni heure, ni lanterne, ni météo.
- **Seul ce qui tombe lit l'horloge** (`glissement`, `goutteALEcran`), jamais au calme ; la force de la
  météo se tire d'`avance` et vaut zéro avant la gare de 1900, quelle que soit la table. Une tuile se
  cuit une fois et se pose d'un remplissage par plan : pas de particules ; sous la lanterne, le voile de neige s'efface.
- **L'essuyage est la seule mémoire du monde hors d'`avance`** : une liste bornée de traits (`PLAFOND_DES_TRAITS`), dont la toile n'est que le cache, jamais recuite pour un trait de plus. Elle s'oublie dès que la buée n'a plus de force et dès qu'on quitte la carte (le moteur renaît au montage), ne lit pas l'horloge, vaut au calme ; la prise se décide au `debut`, la suite essuie tant qu'il reste de la force. La `fin` d'un glissement n'est pas un lever : les deux gouttes coulent quand même. Le repli si un navigateur défile avant que le geste soit reconnu : `src/mondes/1900/buee.ts` › `PORTEE_DE_L_ESSUYAGE`, une ligne.
- **Deux fichiers de durées, deux règles contraires.** `durees.ts` ne porte que des `auTempo(…)` ;
  `entree.ts` s'écrit en base, sans tempo, que le meneur seul applique. `src/voyage/tempo.test.ts` refuse l'inverse, et balaie tout le dossier : un `.tsx` ou une feuille qu'on y pose n'écrit aucune durée en dur (`src/voyage/habillage.test.ts` y refuse de même couleur et police hors jeton).
- **Une plaque a deux gardes** (`aDevelopper`) : l'année fermée, et l'année où le membre n'est pas encore
  arrivé. Sans la seconde, la plaque paraît développée le temps du trajet, puis redevient négative. « Fermée »
  n'a qu'une règle, `estFermee`, que la bande lit aussi : verrouillée, ou en attente du Voyage suivi (`CaseVue.attente`).
- **L'heure est celle de la gare.** Le monde ne lit ni `VueMonde.nuit` ni `VueMonde.lum` et n'appelle pas
  `v.feu`. Le voile de nuit du moteur, posé après ses plans, ne lui appartient pas.
- **Les deux premiers points de `trace1900` sont ceux de `traceAVenir`** : le bas de 1890 en dépend, donc
  `src/carte/reference1890.test.ts`. Le tracé prend tout début de la suite
  1900 à 1909 (1900 à 1902 suffisent) et lève dès qu'une année n'est pas à son rang, depuis 1900 et dans l'ordre.
- **`siteDuChantier` rend nul**, exprès : une visée arrêterait le roulement vers la gare.
- **Ce qui se touche** : les années, les dépêches, les bobines, les objets oubliés, le levier d'une halte et la voiture du Voyage suivi, rien tant que la vitre n'a pas rempli l'écran (la buée ne les couvre pas : un glissement n'est pas un toucher ; le melon de Creil se devine sous elle). Un objet ne se propose que dans une gare développée ; ramassé ou non, le monde l'apprend du moteur (`VueMonde.objetRamasse`), jamais d'une mémoire à lui. L'habillage et le trait du passage n'inscrivent aucune zone. **La clé d'une bobine est ce que l'appareil retient** ; son rang est celui de `CACHETTES`.
- **Une image entre avec son entrée au `CREDITS.md` du dossier et, posée à ses proportions, sa ligne
  dans `TAILLES`.** Aucun fondu n'est dans les fichiers : `cuire` le peint une fois, dans une mémoire bornée.
- **Le rendu du décor n'a pas de test** : les tests gardent les règles (`habillage.ts`, `passage.ts`,
  `toiles.ts`). Ce qui doit être gardé s'écrit en règle pure, pas dans le trait.
- **Le ralenti du tunnel se tire des bornes du dessin** (un palier, d'une bouche à l'autre), jamais d'un second jeu de nombres. Le moteur ne garde pas son contrat, `tunnel.test.ts` si : une allure dans `]0, 1[`, strictement entre deux arrêts (un arrêt dedans, et son rappel roule au pas). Le dessin n'en sait rien ; ni le doigt ni l'élan du défilement natif ne sont freinés.
- **La maquette montre plus que le monde ne dessine** (vent, le levier qui bascule, l'horaire sur la bande de la vue d'ensemble, l'éclat qui trahit un objet) : rien de cela n'est livré, et ne se dessine pas d'après elle. Le contrôleur, lui, est un dialogue de page, pas un décor du monde (`docs/cerveau/jeu-1900.md`).

## Les commandes

```bash
npx vitest run src/mondes/1900 src/voyage/tempo.test.ts src/carte/reference1890.test.ts
grep -n "^export " src/mondes/1900/*.ts          # le plan du dossier
grep -n "describe(\|  it(" src/mondes/1900/*.test.ts
```
