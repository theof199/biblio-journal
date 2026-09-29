import { creerRampe } from '../../carte/rampe'

/**
 * La rampe sépia de la maquette du 29 septembre 2026 (`SEP`, et `C` qui mêle 64 % de rampe à 36 %
 * de la couleur d'origine). Tout le dessin du monde y passe, sauf l'affiche de 1900, où « la
 * couleur arrive ».
 */
export const RAMPE = creerRampe([[18, 12, 8], [92, 62, 36], [170, 126, 80], [247, 236, 214]], 0.64)
export const c = RAMPE.couleur
