import { creerRampe } from '../../carte/rampe'

/**
 * La rampe du monde 1900 : la part de teinte est nulle, chaque couleur sort telle que la maquette
 * « Voyage immobile 1900 » l'écrit. Le virage des photographies est dans les fichiers (tâche 9) :
 * une rampe de plus teinterait deux fois.
 */
export const RAMPE = creerRampe([[21, 17, 13], [93, 80, 64], [185, 178, 162], [244, 239, 226]], 0)
export const c = RAMPE.couleur

/**
 * Le vert de 1900 (maquette : `--halte`, `--etq`), **écrit ici et nulle part ailleurs** : le jeton
 * `--m-vert` des pages le reprend (`pages.ts`), et le dessin au canvas, qui ne lit aucune variable de
 * feuille, le prend d'ici (le poteau, l'étiquette et le contrepoids de l'aiguillage d'une halte).
 */
export const VERT = '#2f6b47'

/** Les polices du rail et de la presse (maquette : `--f-rail`, `--f-presse`). */
export const F_RAIL = "'League Gothic', 'Oswald', 'Arial Narrow', sans-serif"
export const F_PRESSE = "'Courier Prime', 'Courier New', monospace"
/** La police du corps, à la main sur l'étiquette d'une plaque (maquette : `--f-corps`). */
export const F_CORPS = "'Spectral', 'Iowan Old Style', Georgia, serif"
