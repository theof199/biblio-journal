import { auTempo } from '../../voyage/tempo'

/**
 * Les durées des animations du monde 1900, en millisecondes, au tempo (`voyage/tempo.ts`) : chaque
 * valeur de ce fichier s'écrit `auTempo(…)`, et `voyage/tempo.test.ts` refuse un nombre nu. Les
 * temps du passage d'entrée n'y sont pas : ils s'écrivent en base, le moteur seul les joue au tempo.
 */

/** Le développement d'une plaque à l'ouverture de son année (maquette : `.positif`, 2,6 s à l'écran, l. 785). */
export const DEVELOPPEMENT = auTempo(1300)
/** Un souffle de la lampe du laboratoire, de sombre à vive (maquette : `lampe-labo`, 5 s à l'écran, l. 563). */
export const SOUFFLE_DE_LA_LAMPE = auTempo(2500)
/** Une boucle de la pluie sur la vitre (maquette : `m-tombe`, 0,42 s à l'écran, l. 1080). */
export const AVERSE = auTempo(210)
/** Une boucle de chacun des trois plans de neige, du plus lointain au plus proche (maquette : `m-flocons-1` à `3`, 9 s, 6 s et 3,8 s à l'écran, l. 1082-1084). */
export const FLOCONS_LOIN = auTempo(4500)
export const FLOCONS_MOYENS = auTempo(3000)
export const FLOCONS_PROCHES = auTempo(1900)
/** Le ruissellement d'une goutte sur la vitre, de la plus vive à la plus lente, et de combien elles sont décalées (maquette : `--d`, de 3,4 à 7,8 s, et `--t`, jusqu'à 6 s, l. 3567). */
export const RUISSELLEMENT_VIF = auTempo(1700)
export const RUISSELLEMENT_LENT = auTempo(3900)
export const DECALAGE_DES_GOUTTES = auTempo(3000)
