import type { TempsDEntree, TempsDeRetour } from '../types'
import { A1, B1, S1, U0 } from './trace'

/**
 * Le passage de la foire au train : quatre positions où la caméra se tient (maquette :
 * `planDuPassage`, l. 3273-3277 ; fiche de données, « Ce que 12 joue »). La descente mène au quai,
 * où l'on s'arrête le temps de lire ; la montée assied dans le compartiment, encore à quai ; le
 * trajet mène en gare de 1900, le premier arrêt de la section.
 *
 * Les durées et les pauses sont en millisecondes de base : la moitié de ce qu'on voit à l'écran. Le
 * moteur seul les joue au tempo, et `voyage/tempo.test.ts` refuse ici le tempo par le texte du
 * fichier. À l'envers, le moteur repasse par les mêmes positions, aux durées de `RETOUR`.
 */
export const ENTREE: readonly TempsDEntree[] = [
  { y: U0, duree: 0, arret: 0 },
  { y: A1, duree: 1300, arret: 550 },
  { y: S1, duree: 1100, arret: 500 },
  { y: B1, duree: 2300, arret: 0 },
]

/**
 * Le retour du train à la foire, abrégé (maquette : `TEMPS`, l. 2747, et `planDuPassage`, l. 3276 ;
 * décision du propriétaire du 9 octobre 2026) : 5,6 s à l'écran au lieu des 11,5 s de l'aller, sans
 * pause, ni au compartiment ni au quai. Une ligne par temps de `ENTREE`, au même rang : la durée est
 * celle du segment qui relie ce temps à celui d'avant, parcouru au retour (`retourFoire` du quai à
 * la foire, `retourQuai` du compartiment au quai, `retourTrain` de la gare au compartiment). En
 * millisecondes de base, comme `ENTREE`.
 */
export const RETOUR: readonly TempsDeRetour[] = [
  { duree: 0, arret: 0 },
  { duree: 900, arret: 0 },
  { duree: 700, arret: 0 },
  { duree: 1200, arret: 0 },
]
