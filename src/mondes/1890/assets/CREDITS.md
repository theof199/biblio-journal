# Crédits des images du monde 1890

Une entrée par fichier du dossier, titrée par son nom exact entre accents graves, avec ses quatre
lignes : `- Œuvre :`, `- Source :`, `- Licence :`, `- Traitement :`.

## `train.webp`

- Œuvre : *L’Arrivée d’un train à La Ciotat*, Louis Lumière, 1895 (date de la page Commons) : 64 photogrammes de l’approche du train, en planche de 8 × 8 images de 256 × 196, en niveaux de gris.
- Source : https://commons.wikimedia.org/wiki/File:L%27arriv%C3%A9e_d%27un_train_%C3%A0_La_Ciotat_(1895)_-_fr%C3%A8res_Lumi%C3%A8re.webm
- Licence : domaine public, selon la page du fichier : auteur mort depuis plus de soixante-dix ans ; publié avant le 1er janvier 1931 aux États-Unis ; Public Domain Mark 1.0.
- Traitement : planche préparée pour la maquette des écrans 1890 (29 septembre 2026, `ARCHIVE_TRAIN`), extraite à l’octet près par `sed … | base64 -d` ; pas de `virer.sh` : le sépia (par composition, au travers de la rampe) et le grain se posent au dessin (`projectionTrain`, `mondes/1890/moyen.ts`).

## `lune.webp`

- Œuvre : *Le Voyage dans la Lune*, Georges Méliès, 1902 : la Lune d’un photogramme de la copie coloriée à la main, mise en pochoir (cinq encres, repérage lâche, trame, ciel transparent).
- Source : https://commons.wikimedia.org/wiki/File:Melies_color_Voyage_dans_la_lune.jpg
- Licence : domaine public, selon la page du fichier : Méliès mort en 1938 (PD-old-80-expired) ; publié avant le 1er janvier 1931 aux États-Unis ; PD-Art ; Public Domain Mark 1.0. La page cite pour source un article d’octobre 2011 sur la MoMA : si l’image vient de la restauration de 2011 de la copie coloriée, la règle des restaurations récentes (tâche 6) la vise, et le propriétaire tranche.
- Traitement : pochoir préparé pour la maquette des écrans 1890 (29 septembre 2026, `ARCHIVE_LUNE`), extrait à l’octet près par `sed … | base64 -d` ; pas de `virer.sh` : l’affiche de 1900 est hors de la rampe (« la couleur arrive »).

## `locomotive.webp`

- Œuvre : *Les Locomotives françaises (P.L.M.)*, carte postale nº 10, éditée par Fernand Fleury (« F. F. Paris », mort le 18 juillet 1918) : la machine C-127 du Paris-Lyon-Méditerranée, une « coupe-vent » compound à quatre cylindres pour trains express (série C-61 à C-180, construite de 1898 à 1902, plaque « Ateliers d’Arles »), photographiée de profil, son mécanicien à la fenêtre de l’abri. Photographe non nommé ; la carte est postérieure à 1902 (sa légende) et antérieure à 1918. Le P.L.M. est la compagnie du train de La Ciotat que projette la baraque.
- Source : https://commons.wikimedia.org/wiki/File:PLM_220_C127.jpg
- Licence : domaine public, selon la page du fichier (métadonnées de Commons : « Public domain », auteur Fernand Fleury, mort en 1918, depuis plus de soixante-dix ans).
- Traitement : détourée à la main le 7 octobre 2026 avec Python et Pillow seuls (ni ImageMagick ni réseau de neurones sur le poste), depuis le fichier d’origine de 3300 × 2020 : le ciel ôté par remplissage depuis le bord au-dessus d’un seuil de clarté, après un filtre médian ; le titre, la légende, le sol, le tender, le chauffeur debout, le hangar, le bâtiment devant le nez et la lanterne de traverse (coupée par le cadre de la carte) ôtés par polygones ; la poche de ciel entre la main courante et le foyer ôtée ; **les jours de la palissade visible derrière les roues bouchés à l’ombre** (les courses claires de moins de 27 pixels, les bielles polies étant plus longues), si bien que rien du fond ne se voit entre les rayons : c’est une retouche, pas la photographie ; le bord rongé de deux pixels contre la frange claire ; puis la rampe sépia de `virer.sh` recopiée en Pillow (mêmes paliers, 64 % de rampe et 36 % de la couleur d’origine), l’alpha gardé ; réduite à 720 × 305, WebP qualité 80. Le grain n’est pas cuit : la pellicule du moteur le pose. Pas de fumée : la photographie n’en a pas, et le train ne bouge pas (`mondes/1890/train.ts`).
