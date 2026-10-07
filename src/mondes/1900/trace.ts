import type { Trace } from '../trace'

/**
 * Le tracé de la section 1900 (maquette « Voyage immobile 1900 », l. 2738-2744 et 2948-2956). La
 * section est collante : rien n'y glisse, et un `y` de la section n'est qu'une avance de la caméra
 * (`VueMonde.avance`). En haut, la zone du passage ; puis dix gares, une par année.
 */
export const ANNEES: readonly number[] = [1900, 1901, 1902, 1903, 1904, 1905, 1906, 1907, 1908, 1909]

/** Les pixels de geste d'une gare à la suivante (maquette : `PAS`). */
export const PAS = 700
/** Les pixels de la toile des gares d'une gare à la suivante (maquette : `E`). */
export const E = 900
/** La jonction dessinée sous la carte de 1890, avant le quai (maquette : `J`). */
export const JONCTION = 180
/** La part du passage qui va du quai à la gare de 1900 (maquette : `MONTEE`). */
export const MONTEE = 560

/** La part de la montée où l'on est assis, la vitre montrant encore le quai ; puis celle où le train s'ébranle (maquette : `T_ASSIS`, `T_DEPART`). */
export const T_ASSIS = 0.44
export const T_DEPART = 0.46

/**
 * Les positions du passage (maquette : `A1`, `S1`, `B1`), en `y` de la section. Le haut de la
 * section est le bas de la carte de 1890 : le quai remplit l'écran une jonction plus bas ; on est
 * assis à 44 % de la montée (`T_ASSIS`), arrondi au pixel ; la gare de 1900 est au bout.
 */
export const A1 = JONCTION
export const S1 = Math.round(A1 + MONTEE * T_ASSIS)
export const B1 = A1 + MONTEE
/**
 * Le bas de la foire, d'où part le passage : la caméra au-dessus de la section, la jonction au bas
 * de l'écran. La maquette le tire de la hauteur de son écran (`U0`, l. 2955 : 678 px au-dessus du
 * quai sur 760 px de haut) ; un temps du passage n'a qu'un `y`, le même sur tout écran.
 */
export const U0 = A1 - 678

/** Où la caméra se pose, une gare par année, dans l'ordre des années. */
export const ARRETS: readonly number[] = ANNEES.map((_, i) => B1 + i * PAS)

/**
 * La section finit mille pixels sous la gare de 1909 : posée à cette gare, la caméra ne montre rien
 * de la section suivante sur un écran de moins de mille pixels de haut.
 */
export const HAUTEUR = B1 + 9 * PAS + 1000

/**
 * Les deux premiers points sont ceux de `traceAVenir` (`../trace`) : la courbe de la pellicule sous
 * 1899 dépend d'eux, et le bas de 1890 ne bouge pas quand 1900 remplace le monde « à venir ».
 * Ensuite un point par gare, à son arrêt, et la sortie de la section.
 */
export function trace1900(annees: readonly number[]): Trace {
  if (annees.some((a, i) => a !== ANNEES[i])) throw new Error(`les années 1900 du Voyage vont de 1900 à 1909, dans l’ordre et depuis 1900, reçu ${annees.join(', ')}`)
  const points: Array<readonly [number, number]> = [[195, 40], [110, 170]]
  const cases = annees.map((_, i) => {
    points.push([195, ARRETS[i]!])
    return points.length - 1
  })
  points.push([195, HAUTEUR - 110])
  return { points, cases, porte: points.length - 1, hauteur: HAUTEUR }
}
