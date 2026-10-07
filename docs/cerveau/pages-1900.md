# Fiche : les pages des années 1900

Le mécanisme des gabarits est dans `CLAUDE.md` (« Un monde, un dossier ») ; ce que chaque page fait,
dans le `README.md` (« Les pages du Voyage »). La maquette `docs/maquettes/voyage-immobile-1900.html`
fait foi pour la composition (ses écrans, à partir de la l. 1788) : `grep`, puis des plages. Le plan
du lot : `../biblio-back/docs/superpowers/plans/2026-10-07-journal-web-voyage-les-pages-1900.md`.

## Où ça vit

- **Le costume** : `src/mondes/1900/pages.ts` › `PAGES_1900`, `JETONS`, `TECK`, `unie` (les jetons du `:root` de la maquette, les mots de ses écrans, les gabarits, cinq toiles au fond uni). Branché par `src/mondes/1900/index.ts` › `creerMonde1900`.
- **Les clés de gabarit** : `src/mondes/types.ts` › `GabaritsDesPages` ; la lecture, `src/voyage/gabarit.ts` › `gabaritDe`. Chaque clé est typée par les propriétés exportées de son défaut : `src/voyage/annee/Bandeau.tsx` › `PropsTeteDAnnee`, `src/voyage/annee/Fronton.tsx` › `PropsFronton`, `src/voyage/annee/AnneeFermee.tsx` › `PropsAnneeFermee`.
- **La tête de la gare** (`teteDAnnee`) : `src/mondes/1900/pages/Tete.tsx` › `CHIFFRES`, `libelleDeLaPhoto` ; ses règles, `src/mondes/1900/pages/gare.ts` › `heureDeLaGare`, `rangDeLaGare`, `mentionDeLaPlaque`, `libelleDeLaPhoto`. Sa photographie est `g<année>` de `src/mondes/1900/images.ts` › `imageDu1900`.
- **Sous la tête** (`fronton`) : `src/mondes/1900/pages/SousLaTete.tsx` › `heureDeLaGare` : l'heure de la gare et ce que la fiche accroche (le ruban de la récompense).
- **Le corps fermé ou en attente** (`anneeFermee`) : `src/mondes/1900/pages/VoieFermee.tsx` › `nomDuChemin`, `tropLent`, `vusEnAvance`, `phraseDuChemin`.
- **Les tests** : `src/mondes/1900/pages/pages1900.test.tsx` › `MARQUES`, `montrees` (la page montée dans l'app entière, par le registre).

## Ce que 1900 compose, et ce qui reste par défaut

| Section de la fiche d'année | Aujourd'hui |
|---|---|
| La tête (quatre modes, et pendant le chargement) | 1900 : `Tete` |
| Le fronton (fiche prête, en préparation) | 1900 : `SousLaTete` |
| Le corps d'une année fermée ou en attente | 1900 : `VoieFermee` |
| La corde, le boniment, le programme, la parade, la séance, les salles, la ligne du bas | Défaut de `src/voyage/`, aux jetons et aux mots de 1900 |
| La feuille du chroniqueur, la manivelle, les fêtes | Défaut, aux jetons et aux mots de 1900 |
| L'estrade, la scène d'un film, le monument, le guichet | Toiles au fond uni (`unie`) |

Les autres pages (film, billet, décennie, boîte, guichet, sacoche) sont les défauts, au costume.

**Les mots que la maquette ne donne pas** sont ceux du monde « à venir » : `lireOuverture`, `echos`,
`nouvelleSalle`, `jury`, `introuvable`, `fermee.dejaVus` et `enAvance`, `feuille.pied` et `imprimeur`,
`decennie.palissade`, `boite.sur`, `tous` et `vide`, `recherche.affiche`, `vide`, `ouvrir` et `partout`.
Écrits ici, sans source dans la maquette : `annonce.enCours`, `fermee.pancarte`, `intertitre`,
`feuille.titre` et `sous`, `billet.tamponAutour`, `manivelle.tirer`, `relacher`, `charge` et `fait`.

## Ce qu'on casse sans le voir

- **Le titre de la page est dans la tête.** La plaque porte le seul `h1` de la fiche : `SousLaTete` et
  `VoieFermee` ne montent jamais `Fronton`, qui le répéterait. Un monde qui remplit `fronton` sans
  `teteDAnnee` laisse la fiche sans titre.
- **Le mode de la tête vient de la page** (`modeDuBandeau`, `src/pages/VoyageAnnee.tsx`) : la fiche
  d'abord, sinon la carte. Tant que la carte charge, la tête est en cours.
- **Rien ne bouge au calme.** La feuille de la tête n'anime que sous `data-vivante='oui'`, que `Tete`
  pose d'après `calme`. Une animation écrite hors de ce sélecteur tourne au calme ; un test la refuse.
- **Une boucle se déclare.** La trotteuse, la lanterne et le feu sont nommés dans `AMBIANCE` de
  `src/voyage/tempo.test.ts` ; toute autre durée d'une feuille de monde s'écrit au tempo, et `Tete`
  pose `--tempo` sur sa racine.
- **Aucune variable CSS hors des jetons** : l'angle des aiguilles se pose en style sur chaque aiguille.
- **Le gabarit ne lit rien.** `VoieFermee` reçoit le journal et la parade de la page ; il ne monte ni
  `Parade` ni une lecture. Tout ce que `AnneeFermee` offre y est : le retirer casse un test nommé.
- **Les tests qui disaient « 1900 est à venir »** visent désormais 1910 ; ceux des autres pages
  comparent 1900 à `PAGES_1900`.

## Commandes

```bash
npx vitest run src/mondes/1900/pages src/voyage/habillage.test.ts src/voyage/tempo.test.ts
npx vitest run src/pages/VoyageAnnee.test.tsx src/cerveau.test.ts
```
