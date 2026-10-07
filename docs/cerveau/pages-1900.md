# Fiche : les pages des années 1900

Le mécanisme des gabarits est dans `CLAUDE.md` (« Un monde, un dossier ») ; ce que chaque page fait,
dans le `README.md` (« Les pages du Voyage »). La maquette `docs/maquettes/voyage-immobile-1900.html`
fait foi pour la composition (ses écrans, à partir de la l. 1788) : `grep`, puis des plages. Le plan
du lot : `../biblio-back/docs/superpowers/plans/2026-10-07-journal-web-voyage-les-pages-1900.md`.

## Où ça vit

- **Le costume** : `src/mondes/1900/pages.ts` › `PAGES_1900`, `JETONS`, `TECK`, `unie` (les jetons du `:root` de la maquette, les mots de ses écrans, les gabarits, cinq toiles au fond uni). Branché par `src/mondes/1900/index.ts` › `creerMonde1900`.
- **Les clés de gabarit** : `src/mondes/types.ts` › `GabaritsDesPages` ; la lecture, `src/voyage/gabarit.ts` › `gabaritDe`. Chaque clé est typée par les propriétés exportées de son défaut : `src/voyage/annee/Bandeau.tsx` › `PropsTeteDAnnee`, `src/voyage/annee/Fronton.tsx` › `PropsFronton`, `src/voyage/annee/AnneeFermee.tsx` › `PropsAnneeFermee`, `src/voyage/annee/Corde.tsx` › `PropsCordeDAnnee`, `src/voyage/annee/Boniment.tsx` › `PropsBoniment`, `src/voyage/annee/Programme.tsx` › `PropsProgramme`, `src/voyage/annee/Manivelle.tsx` › `PropsTirette`, `Poignee`.
- **La tête de la gare** (`teteDAnnee`) : `src/mondes/1900/pages/Tete.tsx` › `CHIFFRES`, `libelleDeLaPhoto` ; ses règles, `src/mondes/1900/pages/gare.ts` › `heureDeLaGare`, `rangDeLaGare`, `mentionDeLaPlaque`, `libelleDeLaPhoto`. Sa photographie est `g<année>` de `src/mondes/1900/images.ts` › `imageDu1900`.
- **Sous la tête** (`fronton`) : `src/mondes/1900/pages/SousLaTete.tsx` › `heureDeLaGare` : l'heure de la gare et ce que la fiche accroche (le ruban de la récompense).
- **Le corps fermé ou en attente** (`anneeFermee`) : `src/mondes/1900/pages/VoieFermee.tsx` › `nomDuChemin`, `tropLent`, `vusEnAvance`, `phraseDuChemin`.
- **Le corps d'une année ouverte** : `src/mondes/1900/pages/Compteur.tsx` (`corde` : la molette des arrivées, le « +1 »), `src/mondes/1900/pages/Guide.tsx` (`boniment`), `src/mondes/1900/pages/Indicateur.tsx` (`programme`, sur toute fiche prête), `src/mondes/1900/pages/Courroie.tsx` (`tirette`). Les lignes : `src/voyage/annee.ts` › `arriveesDeLAnnee`, `estBouclee` (la règle, que la fête du brief 11 relit sans recompter) ; leurs mots, `src/mondes/1900/pages/lignes.ts` › `ligneDeLIndicateur`, `gainDe`, `venuesDArriver`, `phraseDuCompteur`.
- **Les tests** : `src/mondes/1900/pages/pages1900.test.tsx` › `MARQUES`, `montrees` (la page montée dans l'app entière, par le registre).

## Ce que 1900 compose, et ce qui reste par défaut

| Section de la fiche d'année | Aujourd'hui |
|---|---|
| La tête (quatre modes, et pendant le chargement) | 1900 : `Tete` |
| Le fronton (fiche prête, en préparation) | 1900 : `SousLaTete` |
| Le corps d'une année fermée ou en attente | 1900 : `VoieFermee` |
| La corde, le boniment, le programme, le dessin de la manivelle | 1900 : `Compteur`, `Guide`, `Indicateur`, `Courroie` |
| La parade, la séance, les salles, la ligne du bas, la feuille du chroniqueur, les fêtes | Défaut de `src/voyage/`, aux jetons et aux mots de 1900 |
| L'estrade, la scène d'un film, le monument, le guichet | Toiles au fond uni (`unie`) |

Les autres pages (film, billet, décennie, boîte, guichet, sacoche) sont les défauts, au costume.

**Les mots que la maquette ne donne pas** sont ceux du monde « à venir » : `lireOuverture`, `echos`,
`nouvelleSalle`, `jury`, `introuvable`, `fermee.dejaVus` et `enAvance`, `feuille.pied` et `imprimeur`,
`decennie.palissade`, `boite.sur`, `tous` et `vide`, `recherche.affiche`, `vide`, `ouvrir` et `partout`.
Écrits ici, sans source dans la maquette : `annonce.enCours`, `fermee.pancarte`, `intertitre`,
`feuille.titre` et `sous`, `billet.tamponAutour`, `manivelle.tirer`, `relacher`, `charge` et `fait` ; et les mots des lignes de l'indicateur (`lignes.ts`), que `MotsDesPages` ne porte pas.

## Ce qu'on casse sans le voir

- **Le titre de la page est dans la tête.** La plaque porte le seul `h1` de la fiche : `SousLaTete` et
  `VoieFermee` ne montent jamais `Fronton`, qui le répéterait. Un monde qui remplit `fronton` sans
  `teteDAnnee` laisse la fiche sans titre.
- **Le mode de la tête vient de la page** (`modeDuBandeau`) : la fiche d'abord, sinon la carte.
- **Rien ne bouge au calme.** Une feuille n'anime que sous `data-vivante='oui'`, que la racine du
  composant pose d'après le calme (`Tete`, `Compteur`, `Indicateur`, `Courroie`) ; un test refuse le reste.
- **Une boucle se déclare** dans `AMBIANCE` de `src/voyage/tempo.test.ts` (la trotteuse, la lanterne,
  le feu, l'anneau de la courroie) ; toute autre durée s'écrit au tempo, `--tempo` posé sur la racine.
- **L'indicateur ne dit que ce que la fiche compte** (décision 2) : quatre lignes, ni titre de film ni
  heure. Bouclée se dit dès le ticket émis : la tête, elle, ne tamponne qu'une année derrière soi.
- **La courroie n'est qu'un dessin** (geste, seuils, bouton : `Manivelle`). Un angle, une longueur se posent en style, jamais en variable CSS.
- **Le gabarit ne lit rien** et ne monte pas la section d'un autre : `VoieFermee` reçoit le journal et
  la parade de la page. Tout ce que le défaut offre y est : le retirer casse un test nommé.
- **Les tests qui disaient « 1900 est à venir »** visent désormais 1910 ; ceux des autres pages
  comparent 1900 à `PAGES_1900`.

## Commandes

```bash
npx vitest run src/mondes/1900/pages src/voyage/habillage.test.ts src/voyage/tempo.test.ts
npx vitest run src/pages/VoyageAnnee.test.tsx src/cerveau.test.ts
```
