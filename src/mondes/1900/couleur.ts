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
 * feuille, le prend d'ici (le poteau, l'étiquette et le contrepoids de l'aiguillage d'une halte, le
 * guidon du chef de gare), comme les encres vertes des badges de la malle (`pages/malle.ts`). La
 * maquette n'a qu'un vert : elle l'écrit `--halte` pour la halte et en clair partout ailleurs.
 */
export const VERT = '#2f6b47'

/**
 * La lampe de table du wagon-restaurant (maquette : `.lien-wr`, l. 2296, et la scène de la table,
 * l. 2342-2460) : le halo, la soie de l'abat-jour, ses plis, son bord et sa frange. Nommées une fois
 * pour la petite lampe de la porte (`pages/PorteDuWagon.tsx`) ; le tracé de la table, engendré de la
 * maquette, garde les siennes en clair. Son pied est au laiton du monde (`--m-or`).
 */
export const LAMPE = { halo: '#ffd98a', soie: '#f1c06c', plis: '#a8642a', bord: '#8a4a1e', frange: '#c9853f' } as const

/** Les polices du rail et de la presse (maquette : `--f-rail`, `--f-presse`). */
export const F_RAIL = "'League Gothic', 'Oswald', 'Arial Narrow', sans-serif"
export const F_PRESSE = "'Courier Prime', 'Courier New', monospace"
/** La police du corps, à la main sur l'étiquette d'une plaque (maquette : `--f-corps`). */
export const F_CORPS = "'Spectral', 'Iowan Old Style', Georgia, serif"
