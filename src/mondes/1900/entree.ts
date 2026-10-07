import type { TempsDEntree } from '../types'
import { A1, B1, S1, U0 } from './trace'

/**
 * Le passage de la foire au train : quatre positions où la caméra se tient (maquette :
 * `planDuPassage`, l. 3273-3277 ; fiche de données, « Ce que 12 joue »). La descente mène au quai,
 * où l'on s'arrête le temps de lire ; la montée assied dans le compartiment, encore à quai ; le
 * trajet mène en gare de 1900, le premier arrêt de la section.
 *
 * Les durées et les pauses sont en millisecondes de base : la moitié de ce qu'on voit à l'écran. Le
 * moteur seul les joue au tempo, et `voyage/tempo.test.ts` refuse ici le tempo par le texte du
 * fichier. À l'envers, le moteur rejoue les mêmes segments et tient les mêmes pauses : les durées de
 * retour de la maquette ne sont pas reprises.
 */
export const ENTREE: readonly TempsDEntree[] = [
  { y: U0, duree: 0, arret: 0 },
  { y: A1, duree: 1300, arret: 550 },
  { y: S1, duree: 1100, arret: 500 },
  { y: B1, duree: 2300, arret: 0 },
]
