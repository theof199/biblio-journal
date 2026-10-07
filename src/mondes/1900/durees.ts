import { auTempo } from '../../voyage/tempo'

/**
 * Les durées des animations du monde 1900, en millisecondes, au tempo (`voyage/tempo.ts`) : chaque
 * valeur de ce fichier s'écrit `auTempo(…)`, et `voyage/tempo.test.ts` refuse un nombre nu. Les
 * temps du passage d'entrée n'y sont pas : ils s'écrivent en base, le moteur seul les joue au tempo.
 */

/** Le développement d'une plaque à l'ouverture de son année (maquette : `.positif`, 2,6 s à l'écran, l. 785). */
export const DEVELOPPEMENT = auTempo(1300)
