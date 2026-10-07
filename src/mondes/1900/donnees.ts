/**
 * Les tables de l'habillage du monde 1900, recopiées de la fiche de données
 * (`docs/maquettes/voyage-immobile-1900-donnees.md`, « Ce que 11b dessine »), elle-même recopiée de
 * la maquette « Voyage immobile 1900 », version 11. Les rangs vont de 0 (1900) à 9 (1909). Ce
 * fichier n'importe rien : les règles qui lisent ces tables sont dans `habillage.ts`.
 */

export type Ambiance = 'ville' | 'campagne' | 'montagne' | 'mer'

/** L'ambiance du fond, gare par gare (maquette : `AMBIANCE`, l. 2710). */
export const AMBIANCE: readonly Ambiance[] = ['ville', 'ville', 'campagne', 'campagne', 'montagne', 'montagne', 'mer', 'mer', 'campagne', 'campagne']

/**
 * Où finit le ciel de chaque photographie, en pourcentage de sa hauteur, puis la part de ses côtés
 * qui se fond (maquette : `POSE`, l. 2712).
 */
export const POSE: Readonly<Record<string, readonly [number, number]>> = {
  quai: [10, 8], 1900: [16, 15], 1901: [22, 10], 1902: [22, 10], 1903: [14, 10], 1904: [16, 10],
  1905: [20, 12], 1906: [26, 12], 1907: [14, 16], 1908: [18, 10], 1909: [18, 10],
}

/**
 * La lanterne rouge de chaque plaque (maquette : `LABO`, l. 2715) : où pend la lampe (pixels du
 * milieu de la gare, pourcentage de la vitre), où tient l'étiquette (deux nombres, en pixels), et de
 * combien elle penche, en degrés. Les lignes de 1901 à 1904 sont des **replis** (décision 6 du
 * propriétaire, 6 octobre 2026) : les places de 1905 à 1908, à régler à l'essai. 1900 n'en a pas.
 */
export const LABO: Readonly<Record<number, readonly [number, number, number, number, number]>> = {
  1901: [-112, 27, 0, 0, -3], 1902: [104, 25, 30, 34, 2.5], 1903: [-30, 29.5, -34, 46, -5], 1904: [124, 26.5, 22, -6, 1.5],
  1905: [-112, 27, 0, 0, -3], 1906: [104, 25, 30, 34, 2.5], 1907: [-30, 29.5, -34, 46, -5], 1908: [124, 26.5, 22, -6, 1.5],
  1909: [-132, 28.5, -8, 40, -2],
}

/**
 * Le cadre de chaque vue lointaine (maquette : `CADRE_LOIN`, l. 2854) : gauche et droite en parts
 * de l'image, puis le fondu du ciel, de et à, en pourcentage de sa hauteur.
 */
export const CADRE_LOIN: Readonly<Record<string, readonly [number, number, number, number]>> = {
  loin1: [0.01, 0.99, 0, 34], loin2: [0.19, 0.93, 14, 38], loin3: [0.01, 0.56, 6, 32],
}

/** La suite des vues lointaines (maquette, l. 2859), « m » pour retournée. */
export const SUITE_LOIN: readonly string[] = ['loin1', 'loin2', 'loin3 m', 'loin3', 'loin2 m', 'loin2', 'loin3 m', 'loin3', 'loin2 m', 'loin1 m', 'loin1', 'loin2', 'loin3 m', 'loin3']

/** De combien de pixels chaque vue lointaine se fond sur la précédente (maquette, l. 98-100). */
export const RACCORD_LOIN = 130

export interface Heure {
  nom: string
  /** La teinte qui multiplie le paysage, en haut puis en bas du ciel. */
  haut: readonly [number, number, number]
  bas: readonly [number, number, number]
  /** La lueur de l'astre : rouge, vert, bleu, opacité. */
  lueur: readonly [number, number, number, number]
  /** La place de l'astre, en pourcentage de la vitre. */
  lx: number
  ly: number
  /** La part du soleil, la part de nuit. */
  sol: number
  nuit: number
}

/** Une heure par gare, de l'aube de 1900 à la nuit de 1909 (maquette : `HEURES`, l. 3492-3503). */
export const HEURES: readonly Heure[] = [
  { nom: 'aube', haut: [172, 168, 200], bas: [250, 212, 182], lueur: [255, 168, 118, 0.5], lx: 80, ly: 29, sol: 1, nuit: 0.3 },
  { nom: 'petit matin', haut: [204, 215, 232], bas: [255, 236, 208], lueur: [255, 226, 180, 0.3], lx: 72, ly: 23, sol: 1, nuit: 0 },
  { nom: 'matinée', haut: [228, 236, 242], bas: [255, 248, 232], lueur: [255, 240, 210, 0.2], lx: 64, ly: 14, sol: 0.5, nuit: 0 },
  { nom: 'fin de matinée', haut: [244, 247, 248], bas: [255, 253, 244], lueur: [255, 250, 230, 0.14], lx: 56, ly: 9, sol: 0, nuit: 0 },
  { nom: 'plein midi', haut: [255, 255, 255], bas: [255, 255, 250], lueur: [255, 255, 240, 0.16], lx: 50, ly: 6, sol: 0, nuit: 0 },
  { nom: 'début d’après-midi', haut: [255, 250, 236], bas: [255, 244, 220], lueur: [255, 240, 200, 0.16], lx: 44, ly: 10, sol: 0, nuit: 0 },
  { nom: 'fin d’après-midi', haut: [250, 232, 200], bas: [250, 222, 176], lueur: [255, 214, 150, 0.28], lx: 36, ly: 20, sol: 0.6, nuit: 0 },
  { nom: 'crépuscule', haut: [150, 128, 172], bas: [250, 160, 110], lueur: [255, 130, 60, 0.6], lx: 28, ly: 30, sol: 1, nuit: 0.45 },
  { nom: 'heure bleue', haut: [84, 98, 152], bas: [140, 130, 168], lueur: [210, 120, 130, 0.28], lx: 20, ly: 33, sol: 0, nuit: 0.75 },
  { nom: 'nuit', haut: [58, 72, 124], bas: [88, 98, 146], lueur: [150, 170, 230, 0.16], lx: 72, ly: 19, sol: 0, nuit: 1 },
]

/** La place de la lune, en pourcentage de la vitre (maquette : `LUNE`, l. 3504). */
export const LUNE: readonly [number, number] = [72, 19]

const RAME_1908: number[][] = Array.from({ length: 12 }, (_, k) => [0.112 + k * 0.027, 0.4 - k * 0.0068, 0.011 + k * 0.0004, 0.03 + k * 0.001])

/**
 * Les fenêtres allumées, en parts de la photographie de la gare : `[x, y, largeur, hauteur]` ; un
 * cinquième terme fait un halo (maquette : `FENETRES`, l. 3510-3515). Trois gares : 1907, 1908, 1909.
 */
export const FENETRES: Readonly<Record<number, readonly (readonly number[])[]>> = {
  7: [[0.79, 0.125, 0.027, 0.08], [0.916, 0.13, 0.04, 0.065], [0.71, 0.19, 0.014, 0.09], [0.2, 0.345, 0.03, 0.065], [0.36, 0.34, 0.03, 0.1]],
  8: [...RAME_1908, [0.632, 0.21, 0.026, 0.1], [0.6, 0.44, 0.012, 0.03], [0.3, 0.62, 0.5, 0.3, 1]],
  9: [[0.477, 0.305, 0.023, 0.107], [0.512, 0.29, 0.019, 0.107], [0.544, 0.26, 0.031, 0.137], [0.644, 0.503, 0.036, 0.13], [0.46, 0.5, 0.11, 0.17, 1], [0.36, 0.5, 0.4, 0.4, 1]],
}
