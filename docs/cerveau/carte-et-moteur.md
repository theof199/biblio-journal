# Fiche : la carte du Voyage et son moteur

Ce que la carte fait est dans le `README.md` (« La carte du Voyage », « Les pages du Voyage » pour les
célébrations), les règles d'un monde dans `CLAUDE.md` (« Un monde, un dossier ») : cette fiche dit
quelle zone lire. `src/carte/moteur.ts` et `src/carte/moteur.test.ts` ne se lisent jamais en entier.

## Où ça vit

- **Le plan** : `src/carte/moteur.ts` › `MoteurCarte`, trois bandeaux `// --- …` (ce que la page relaie,
  ce qu'elle commande, l'intérieur), après les types `EtatCarte`, `Rappels` et `Dependances`.
- **Une image** : `src/carte/meneur.ts` › `constaterLeRepos`, puis `maj` (l'horloge ; la caméra par
  `src/carte/meneur.ts` › `avancer`), `src/carte/moteur.ts` › `signalerAvatar`, `dessiner`. L'ordre des
  couches est dans la méthode `scene` du moteur, sept blocs numérotés `// 1.` à `// 7.`.
- **La caméra** : `camY` ne s'écrit que dans `src/carte/meneur.ts` › `Meneur`, `Terrain` (ce que le moteur
  lui donne à lire). Cinq meneurs, le défilement natif, l'avatar, un chantier, le roulement, le passage :
  `src/carte/meneur.ts` › `constaterLeDefilement`, `suivreLAvatar`, `viser`, `rouler`, `direBonjour`, `arretsAutour`.
  Les calculs purs : `src/carte/camera.ts` › `cibleCamera`, `poidsSections`, `presencesSections`.
- **Le toucher** : `src/carte/geste.ts` › `APPUI_LONG_MS` (la classe `Geste`), `src/carte/zones.ts` › `trouverZone`,
  puis la méthode `toucher` du moteur ; une bobine ramassée, `src/carte/moteur.ts` › `ouVole`, `atterrir`.
- **La vue d'ensemble** : `src/carte/moteur.ts` › `quitterEnsemble`, `sortieDeLEnsemble` ; ouverte, ni rappel
  ni passage (`src/carte/meneur.ts` › `ouvrirLEnsemble`) ; `src/carte/ensemble.ts` › `genreDeBande` ; `src/carte/dessin/ensemble.ts` › `dessinerEnsemble`.
- **Un monde** : ce qu'il reçoit se fabrique dans `src/carte/moteur.ts` › `vueMonde` (dont, par année, les adresses de ses affiches : `src/mondes/types.ts` › `CaseVue`) ; ce qu'il doit,
  `src/mondes/types.ts` › `SceneCollante`, `HabillagePages`, `JETONS_DE_PAGE`. Il se branche par
  `src/mondes/index.ts` › `FABRIQUES` ; le modèle est `src/mondes/1890/index.ts` › `creerMonde1890`,
  le plus court `src/mondes/avenir/index.ts` › `mondeAVenir`, le seul à `scene` `src/mondes/1900/index.ts` › `creerMonde1900` (sa fiche : `docs/cerveau/monde-1900.md`). `src/carte/placement.ts` › `placerCarte` pose les sections.
- **Le pont et la page** : `src/carte/CarteCanvas.tsx` › `fabriqueReelle`, `FabriqueMoteurContexte`, `imagesDesMondes`, `affichesDecodees` (deux tables d'images, plus bas) ;
  `src/carte/avancee.ts` › `jouerAvancee` (un monde à passage : porte, adieu, tampon, bonjour, clap, marche) ; deux enveloppes `fond`, la toile et le reste, par `src/pages/Carte.tsx` › `INERTE`, `aUnPassage` : la toile seule répond, le temps du passage ; les années cachées, `src/voyage/regles.ts` › `premiereDecennieCachee`.
- **Les célébrations** : quoi jouer, `src/voyage/celebrations/scenes.ts` › `scenesDuRetour`,
  `sceneDuRattrapage` ; les pas, `src/voyage/celebrations/deroule.ts` › `useDeroule`, `PAS_DE_L_ANNEE` ;
  le ticket montré, `src/voyage/celebrations/Celebrations.tsx` › `useMontrerLeTicket`.
- **Les bancs de test** : `src/test/contexteFactice.ts` › `contexteFactice` (le moteur dessine dedans),
  `src/test/vueFactice.ts` › `vueFactice` (un monde seul), `src/test/moteurFactice.ts` › `moteurFactice`.

## Ce qu'on casse sans le voir

- **L'horloge du décor s'arrête au calme.** Ce qu'on date pour l'animer passe par la méthode `instant`
  (-9 : déjà fini), se finit dans `src/carte/moteur.ts` › `achever`, et entre dans la condition de
  `boucle`. Sinon sa promesse ne se résout jamais, et la page, qui attend `jouerAvancee`, reste inerte.
- **Tout glissement passe par `src/carte/meneur.ts` › `prendreLaCamera`.** `suivre` et `visee`
  arrêtent le roulement et le passage à chaque image. La caméra s'écrit avec `defilerVers`, jamais du
  moteur (`meneur.test.ts`) : la page rend un `defiler`, un écho que le meneur attend (`attendu`) et oublie sitôt rendu, pas un geste.
- **Chaque `majEtat` vide les tuiles du sol** : son état reste mémoïsé (`src/pages/Carte.tsx` › `donneesDesFiches`).
- **Cinq identifiants de zone sont au moteur** : `case`, `clap`, `roulotte`, `bobine`, `date`. Les deux
  derniers lisent `data` comme un rang dans `bobines` et `dates` du monde qui a inscrit la zone (sa `section`,
  jamais `camY + y`) ; tout autre va à `reagir`, jamais au calme. Une priorité l'emporte sur toute distance.
- **Un registre par appelant** (`src/mondes/index.ts` › `creerRegistre`) : le `Monde` que tient une
  page n'est pas celui que le moteur dessine, et ne sait rien de ce que l'autre garde entre deux images.
- **Le tracé de 1890 et du monde « à venir » vit hors de leur dossier** (`src/mondes/trace.ts` › `trace1890`, `traceAVenir`, `HAUTEUR_MIN_SECTION`), celui de 1900 dans le sien ; `src/mondes/1890/ciel.ts` › `VIDE_DU_HAUT` voisine une copie de sa hauteur.
- **Une image de monde se reconnaît à son adresse exacte** (`src/carte/CarteCanvas.tsx` › `ADRESSES_DES_MONDES`), jamais à un préfixe : elle n'est alors jamais évincée. Hors de l'ensemble, elle passe par le `Lru` des affiches et peut sortir ; sa borne (`BORNE_DES_AFFICHES`) tient au-dessus de ce qu'une seule image demande, colonnes (`AFFICHES_DES_COLONNES`) et monde (`AFFICHES_D_UN_MONDE`).
- **`src/voyage/tempo.test.ts` ne lit ni `src/carte/` ni un sous-dossier de `src/voyage/celebrations/`.**
  Seuls l'envol (moteur), le roulement et le passage (meneur) sont au tempo ; ni la marche, ni l'adieu. Côté page, l'annonce hors de vue seule (`src/pages/Carte.tsx` › `DUREE_DE_L_ANNONCE`). Les temps d'un passage s'écrivent en base (`src/mondes/1900/entree.ts` › `ENTREE`).

## Les commandes

```bash
grep -n "^export \|^  // ---\|^    // [1-7]\. " src/carte/moteur.ts  # le plan du moteur et des couches
grep -nE "^  (private )?(get )?[a-zA-Z]+\(.*\{$" src/carte/moteur.ts  # ses méthodes
grep -n "describe(" src/carte/moteur.test.ts                         # où lire dans les tests
npx vitest run src/carte src/mondes src/voyage/celebrations src/voyage/tempo.test.ts
```
