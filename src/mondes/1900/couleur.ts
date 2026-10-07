import { creerRampe } from '../../carte/rampe'

/**
 * La rampe du monde 1900 : la part de teinte est nulle, chaque couleur sort telle que la maquette
 * « Voyage immobile 1900 » l'écrit. Le virage des photographies est dans les fichiers (tâche 9) :
 * une rampe de plus teinterait deux fois.
 */
export const RAMPE = creerRampe([[21, 17, 13], [93, 80, 64], [185, 178, 162], [244, 239, 226]], 0)
export const c = RAMPE.couleur

/** Les polices du rail et de la presse (maquette : `--f-rail`, `--f-presse`). */
export const F_RAIL = "'League Gothic', 'Oswald', 'Arial Narrow', sans-serif"
export const F_PRESSE = "'Courier Prime', 'Courier New', monospace"
